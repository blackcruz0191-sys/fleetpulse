const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const auth = require('./auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Uploaded files (driver license photos, etc.) — served statically and never executed.
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve the web dashboard (Leaflet map, login, etc.) from the same server/URL as the API,
// so a single Render deploy covers both — no separate static-site hosting needed.
const WEB_DIR = path.join(__dirname, '..', 'web');
if (fs.existsSync(WEB_DIR)) {
  app.use(express.static(WEB_DIR));
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `license-${req.userId}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido (solo JPEG, PNG o WEBP)'));
    }
    cb(null, true);
  }
});

// In-Memory Fleet State Cache (hydrated from the database at boot, kept in sync on every write)
// Real, durable records live in the database (SQLite locally, Postgres in production via
// DATABASE_URL) — this Map only avoids a DB read on every high-frequency GPS tick.
const fleetState = new Map();

function toClientVehicle(row) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    plate: row.plate,
    name: row.name,
    type: row.type,
    status: row.status,
    driver: {
      name: row.driver_name,
      phone: row.driver_phone,
      license: {
        number: row.license_number,
        category: row.license_category,
        issueDate: row.license_issue_date,
        expiryDate: row.license_expiry_date,
        photoUrl: row.license_photo_url,
        restrictions: row.license_restrictions,
        infractions: row.license_infractions
      }
    },
    cargo: { type: row.cargo_type, weightKg: row.cargo_weight_kg },
    telemetry: {
      lat: row.lat,
      lng: row.lng,
      speed: row.speed,
      heading: row.heading,
      accuracy: row.accuracy,
      battery: row.battery,
      fuel: row.fuel,
      temp: row.temp,
      odometer: row.odometer
    },
    lastUpdate: row.last_update ? Number(row.last_update) : null
  };
}

async function hydrateFleetFromDb() {
  const rows = await db.getAllVehicles();
  rows.forEach(row => fleetState.set(row.id, toClientVehicle(row)));
  console.log(`[DB] ${rows.length} vehículo(s) cargado(s) desde la base de datos (${db.isPg ? 'Postgres' : 'SQLite local'})`);
}

function emitToOwner(ownerUserId, event, payload) {
  io.to(`user:${ownerUserId}`).emit(event, payload);
}

// Wraps an async route handler so a rejected promise becomes a 500 response
// instead of crashing the process (Express doesn't await handlers itself).
function asyncRoute(handler) {
  return (req, res) => handler(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  });
}

// ============================================================
// AUTH - Registro / Login (hasta 5000 cuentas gratuitas)
// ============================================================

app.post('/api/v1/auth/register', asyncRoute(async (req, res) => {
  const { username, password, company_name } = req.body;
  const result = await auth.register({ username, password, companyName: company_name });

  if (result.error) {
    return res.status(result.status).json({ success: false, message: result.error });
  }

  return res.status(201).json({ success: true, token: result.token, user: result.user });
}));

app.post('/api/v1/auth/login', asyncRoute(async (req, res) => {
  const { username, password } = req.body;
  const result = await auth.login({ username, password });

  if (result.error) {
    return res.status(result.status).json({ success: false, message: result.error });
  }

  return res.json({ success: true, token: result.token, user: result.user });
}));

app.get('/api/v1/auth/me', auth.authMiddleware, asyncRoute(async (req, res) => {
  const user = await db.findUserById(req.userId);
  if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
  res.json({ success: true, user: { id: user.id, username: user.username, companyName: user.company_name } });
}));

// Every route below requires a valid "Authorization: Bearer <token>" header.
app.use('/api/v1/telemetry', auth.authMiddleware);
app.use('/api/v1/driver', auth.authMiddleware);
app.use('/api/v1/documents', auth.authMiddleware);
app.use('/api/v1/vehicles', auth.authMiddleware);
app.use('/api/v1/routes', auth.authMiddleware);
app.use('/api/v1/alerts', auth.authMiddleware);
app.use('/api/v1/upload', auth.authMiddleware);

// Confirms the authenticated user owns vehicleId, auto-registering it under their
// account on first contact (e.g. the very first GPS ping before a profile exists).
async function assertOwnership(vehicleId, ownerUserId) {
  const existing = await db.getVehicle(vehicleId);
  if (existing && existing.owner_user_id !== ownerUserId) {
    return false;
  }
  return true;
}

// 1. Endpoint REST POST API - Recibe la ubicación enviada por la App Android
app.post('/api/v1/telemetry/location', asyncRoute(async (req, res) => {
  const { vehicle_id, plate, driver_name, cargo_info, latitude, longitude, speed_kmh, heading, accuracy_meters, battery_level, fuel_level } = req.body;

  if (!vehicle_id || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'Datos incompletos' });
  }

  if (!(await assertOwnership(vehicle_id, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const speed = parseFloat(speed_kmh || 0);

  const row = await db.upsertVehicle({
    id: vehicle_id,
    owner_user_id: req.userId,
    plate: plate || null,
    driver_name: driver_name || null,
    cargo_type: cargo_info || null,
    status: speed > 80 ? 'alert' : (speed > 0 ? 'active' : 'idle'),
    lat: parseFloat(latitude),
    lng: parseFloat(longitude),
    speed,
    heading: parseFloat(heading || 0),
    accuracy: parseFloat(accuracy_meters || 0),
    battery: battery_level !== undefined ? parseInt(battery_level, 10) : null,
    fuel: fuel_level !== undefined ? parseFloat(fuel_level) : null
  });

  const vehicle = toClientVehicle(row);
  fleetState.set(vehicle_id, vehicle);

  console.log(`[GPS API Recibido] Vehículo: ${vehicle_id} (user ${req.userId}) | Lat: ${latitude}, Lng: ${longitude} | Vel: ${speed} km/h`);

  emitToOwner(req.userId, 'location_update', vehicle);

  return res.json({ success: true, message: 'Ubicación procesada y retransmitida exitosamente' });
}));

// 2. Endpoint REST GET API - Obtener la lista de vehículos del usuario autenticado
app.get('/api/v1/vehicles', asyncRoute(async (req, res) => {
  const rows = await db.getVehiclesByOwner(req.userId);
  res.json(rows.map(toClientVehicle));
}));

// 3. Endpoint REST POST API - Registrar/Actualizar perfil de chofer y vehículo
app.post('/api/v1/driver/profile', asyncRoute(async (req, res) => {
  const {
    vehicle_id, plate, driver_name, driver_phone, vehicle_model, cargo_type, cargo_weight_kg,
    license_number, license_category, license_issue_date, license_expiry_date,
    license_photo_url, license_restrictions, license_infractions
  } = req.body;

  if (!vehicle_id || !driver_name || !plate) {
    return res.status(400).json({ success: false, message: 'Datos de perfil incompletos' });
  }

  if (!(await assertOwnership(vehicle_id, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const row = await db.upsertVehicle({
    id: vehicle_id,
    owner_user_id: req.userId,
    plate,
    name: vehicle_model || null,
    vehicle_model,
    driver_name,
    driver_phone: driver_phone || null,
    cargo_type: cargo_type || null,
    cargo_weight_kg: cargo_weight_kg || null,
    license_number: license_number || null,
    license_category: license_category || null,
    license_issue_date: license_issue_date || null,
    license_expiry_date: license_expiry_date || null,
    license_photo_url: license_photo_url || null,
    license_restrictions: license_restrictions || null,
    license_infractions: license_infractions || null
  });

  const vehicle = toClientVehicle(row);
  fleetState.set(vehicle_id, vehicle);

  console.log(`[Perfil Actualizado] Vehículo: ${vehicle_id} (user ${req.userId}) | Chofer: ${driver_name} | Placa: ${plate}`);

  emitToOwner(req.userId, 'profile_update', vehicle);

  return res.json({ success: true, message: 'Perfil de chofer y vehículo registrado exitosamente' });
}));

// 4. Endpoint REST POST API - Registrar un documento digital (Factura, Boleta, Guía de Remisión)
app.post('/api/v1/documents', asyncRoute(async (req, res) => {
  const { id, vehicle_id, doc_type, doc_number, client_name, client_ruc, delivery_address, items_summary, total_amount, status, created_at } = req.body;

  if (!vehicle_id || !doc_type || !client_name) {
    return res.status(400).json({ success: false, message: 'Datos del documento incompletos' });
  }

  if (!(await assertOwnership(vehicle_id, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const document = {
    id: id || `DOC-${Date.now().toString().slice(-6)}`,
    vehicle_id,
    owner_user_id: req.userId,
    doc_type,
    doc_number: doc_number || '',
    client_name,
    client_ruc: client_ruc || '',
    delivery_address: delivery_address || '',
    items_summary: items_summary || '',
    total_amount: total_amount || 0,
    status: status || 'EMITIDO',
    created_at: created_at || Date.now()
  };

  await db.insertDocument(document);

  console.log(`[Documento Emitido] Vehículo: ${vehicle_id} (user ${req.userId}) | Tipo: ${doc_type} | Cliente: ${client_name}`);

  emitToOwner(req.userId, 'document_created', {
    id: document.id,
    vehicleId: document.vehicle_id,
    docType: document.doc_type,
    docNumber: document.doc_number,
    clientName: document.client_name,
    clientRuc: document.client_ruc,
    deliveryAddress: document.delivery_address,
    itemsSummary: document.items_summary,
    totalAmount: document.total_amount,
    status: document.status,
    createdAt: document.created_at
  });

  return res.json({ success: true, message: 'Documento digital registrado exitosamente' });
}));

// 5. Endpoint REST GET API - Obtener documentos digitales de un vehículo (solo si es dueño)
app.get('/api/v1/documents/:vehicleId', asyncRoute(async (req, res) => {
  if (!(await assertOwnership(req.params.vehicleId, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const rows = await db.getDocumentsByVehicle(req.params.vehicleId);
  const docs = rows.map(d => ({
    id: d.id,
    vehicleId: d.vehicle_id,
    docType: d.doc_type,
    docNumber: d.doc_number,
    clientName: d.client_name,
    clientRuc: d.client_ruc,
    deliveryAddress: d.delivery_address,
    itemsSummary: d.items_summary,
    totalAmount: d.total_amount,
    status: d.status,
    createdAt: d.created_at
  }));

  res.json(docs);
}));

// 6. Endpoint REST POST API - Asignar una ruta con paradas a un vehículo
app.post('/api/v1/routes', asyncRoute(async (req, res) => {
  const { vehicle_id, stops } = req.body;

  if (!vehicle_id || !Array.isArray(stops) || stops.length === 0) {
    return res.status(400).json({ success: false, message: 'Se requiere vehicle_id y al menos una parada' });
  }

  if (!(await assertOwnership(vehicle_id, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const route = await db.setActiveRoute({
    id: `RT-${Date.now().toString().slice(-8)}`,
    vehicleId: vehicle_id,
    ownerUserId: req.userId,
    stops
  });

  console.log(`[Ruta Asignada] Vehículo: ${vehicle_id} (user ${req.userId}) | ${stops.length} parada(s)`);

  emitToOwner(req.userId, 'route_updated', route);

  return res.json({ success: true, message: 'Ruta asignada exitosamente', route });
}));

// 7. Endpoint REST GET API - Obtener la ruta activa de un vehículo
app.get('/api/v1/routes/:vehicleId', asyncRoute(async (req, res) => {
  if (!(await assertOwnership(req.params.vehicleId, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const route = await db.getActiveRoute(req.params.vehicleId);
  res.json(route || null);
}));

// 8. Endpoint REST POST API - Registrar una alerta operativa
// type: FUEL_STOP | EMERGENCY | BREAKDOWN | DRIVER_CHANGE
const VALID_ALERT_TYPES = ['FUEL_STOP', 'EMERGENCY', 'BREAKDOWN', 'DRIVER_CHANGE'];

app.post('/api/v1/alerts', asyncRoute(async (req, res) => {
  const { vehicle_id, type, message, lat, lng } = req.body;

  if (!vehicle_id || !VALID_ALERT_TYPES.includes(type)) {
    return res.status(400).json({ success: false, message: `Tipo de alerta inválido. Use: ${VALID_ALERT_TYPES.join(', ')}` });
  }

  if (!(await assertOwnership(vehicle_id, req.userId))) {
    return res.status(403).json({ success: false, message: 'Ese vehículo pertenece a otra cuenta' });
  }

  const alert = await db.insertAlert({
    id: `ALT-${Date.now().toString().slice(-8)}`,
    vehicle_id,
    owner_user_id: req.userId,
    type,
    message: message || null,
    lat: lat !== undefined ? parseFloat(lat) : null,
    lng: lng !== undefined ? parseFloat(lng) : null,
    created_at: Date.now()
  });

  // A breakdown or emergency should surface as an alert-status vehicle on the dashboard.
  if (type === 'EMERGENCY' || type === 'BREAKDOWN') {
    const row = await db.upsertVehicle({ id: vehicle_id, owner_user_id: req.userId, status: 'alert' });
    emitToOwner(req.userId, 'location_update', toClientVehicle(row));
  }

  console.log(`[Alerta] Vehículo: ${vehicle_id} (user ${req.userId}) | Tipo: ${type}`);

  emitToOwner(req.userId, 'alert_created', {
    id: alert.id,
    vehicleId: alert.vehicle_id,
    type: alert.type,
    message: alert.message,
    lat: alert.lat,
    lng: alert.lng,
    status: 'OPEN',
    createdAt: alert.created_at
  });

  return res.json({ success: true, message: 'Alerta registrada exitosamente', alert });
}));

// 9. Endpoint REST GET API - Listar alertas recientes del usuario
app.get('/api/v1/alerts', asyncRoute(async (req, res) => {
  const rows = await db.getAlertsByOwner(req.userId);
  const alerts = rows.map(a => ({
    id: a.id,
    vehicleId: a.vehicle_id,
    type: a.type,
    message: a.message,
    lat: a.lat,
    lng: a.lng,
    status: a.status,
    createdAt: Number(a.created_at),
    resolvedAt: a.resolved_at ? Number(a.resolved_at) : null
  }));
  res.json(alerts);
}));

// 10. Endpoint REST POST API - Marcar una alerta como resuelta
app.post('/api/v1/alerts/:id/resolve', asyncRoute(async (req, res) => {
  const alert = await db.resolveAlert(req.params.id, req.userId);
  emitToOwner(req.userId, 'alert_resolved', { id: req.params.id });
  res.json({ success: true, alert });
}));

// 11. Endpoint REST POST API - Subir foto del brevete (multipart/form-data, campo "photo")
app.post('/api/v1/upload/license-photo', (req, res) => {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Archivo inválido (solo JPEG/PNG/WEBP, máx. 8MB)' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo (campo "photo")' });
    }

    const url = `/uploads/${req.file.filename}`;
    console.log(`[Foto Subida] Usuario ${req.userId} | Archivo: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)} KB)`);
    return res.json({ success: true, url });
  });
});

// Simple health check for uptime monitors / deployment platforms.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// WebSocket Connection - requires a valid JWT passed as socket.handshake.auth.token
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const user = token ? auth.verifyToken(token) : null;

  if (!user) {
    return next(new Error('unauthorized'));
  }

  socket.userId = Number(user.id);
  next();
});

io.on('connection', (socket) => {
  console.log(`[WebSocket] Nuevo Panel Web Conectado: ${socket.id} (user ${socket.userId})`);

  socket.join(`user:${socket.userId}`);

  db.getVehiclesByOwner(socket.userId)
    .then(rows => socket.emit('initial_fleet', rows.map(toClientVehicle)))
    .catch(err => console.error('[WebSocket] Error cargando flota inicial:', err));

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Panel Web Desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;

hydrateFleetFromDb()
  .catch(err => console.error('[DB] Error al cargar la flota inicial:', err))
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 FleetPulse Backend Server corriendo en puerto ${PORT}`);
      console.log(`  - Base de datos: ${db.isPg ? 'Postgres (DATABASE_URL)' : 'SQLite local (server/data/fleetpulse.db)'}`);
      console.log(`  - Auth: POST /api/v1/auth/register, POST /api/v1/auth/login`);
      console.log(`  - REST API GPS: /api/v1/telemetry/location`);
      console.log(`  - WebSockets Server activo`);
      console.log(`====================================================`);
    });
  });
