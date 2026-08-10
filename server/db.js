const path = require('path');
const fs = require('fs');

// Two backends behind the same async API:
//   - DATABASE_URL set (production/cloud)  -> Postgres via `pg` (real persistence on hosts
//     with an ephemeral filesystem, e.g. Render's free web service).
//   - DATABASE_URL unset (local dev)       -> SQLite file on disk via node:sqlite, zero setup.
const isPg = !!process.env.DATABASE_URL;

const MAX_FREE_ACCOUNTS = 5000;

let pgPool = null;
let sqliteDb = null;

if (isPg) {
  const { Pool } = require('pg');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
} else {
  const { DatabaseSync } = require('node:sqlite');
  const DATA_DIR = path.join(__dirname, 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  sqliteDb = new DatabaseSync(path.join(DATA_DIR, 'fleetpulse.db'));
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
}

// Translates a Postgres-style "$1, $2..." query into SQLite's "?" placeholders,
// and runs it through the right driver. `mode` is 'run' | 'get' | 'all'.
async function query(sql, params, mode) {
  if (isPg) {
    const result = await pgPool.query(sql, params);
    if (mode === 'get') return result.rows[0] || null;
    if (mode === 'all') return result.rows;
    return result;
  }

  const sqliteSql = sql.replace(/\$(\d+)/g, '?');
  const stmt = sqliteDb.prepare(sqliteSql);
  if (mode === 'get') return stmt.get(...params) ?? null;
  if (mode === 'all') return stmt.all(...params);
  return stmt.run(...params);
}

async function setup() {
  if (isPg) {
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        company_name TEXT,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        plate TEXT, name TEXT, type TEXT DEFAULT 'truck', status TEXT DEFAULT 'idle',
        driver_name TEXT, driver_phone TEXT, vehicle_model TEXT, cargo_type TEXT, cargo_weight_kg REAL,
        lat REAL, lng REAL, speed REAL DEFAULT 0, heading REAL DEFAULT 0, accuracy REAL,
        battery INTEGER, fuel REAL, temp REAL, odometer REAL, last_update BIGINT,
        license_number TEXT, license_category TEXT, license_issue_date TEXT, license_expiry_date TEXT,
        license_photo_url TEXT, license_restrictions TEXT, license_infractions TEXT,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        doc_type TEXT NOT NULL, doc_number TEXT, client_name TEXT NOT NULL, client_ruc TEXT,
        delivery_address TEXT, items_summary TEXT, total_amount REAL DEFAULT 0,
        status TEXT DEFAULT 'EMITIDO', created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        stops_json TEXT NOT NULL, status TEXT DEFAULT 'active', created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
        owner_user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL, message TEXT, lat REAL, lng REAL,
        status TEXT DEFAULT 'OPEN', created_at BIGINT NOT NULL, resolved_at BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON documents(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_routes_vehicle ON routes(vehicle_id);
      CREATE INDEX IF NOT EXISTS idx_alerts_vehicle ON alerts(vehicle_id);
    `);
    return;
  }

  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      owner_user_id INTEGER NOT NULL,
      plate TEXT, name TEXT, type TEXT DEFAULT 'truck', status TEXT DEFAULT 'idle',
      driver_name TEXT, driver_phone TEXT, vehicle_model TEXT, cargo_type TEXT, cargo_weight_kg REAL,
      lat REAL, lng REAL, speed REAL DEFAULT 0, heading REAL DEFAULT 0, accuracy REAL,
      battery INTEGER, fuel REAL, temp REAL, odometer REAL, last_update INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL, doc_number TEXT, client_name TEXT NOT NULL, client_ruc TEXT,
      delivery_address TEXT, items_summary TEXT, total_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'EMITIDO', created_at INTEGER NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      stops_json TEXT NOT NULL, status TEXT DEFAULT 'active', created_at INTEGER NOT NULL,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL,
      type TEXT NOT NULL, message TEXT, lat REAL, lng REAL,
      status TEXT DEFAULT 'OPEN', created_at INTEGER NOT NULL, resolved_at INTEGER,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY (owner_user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON vehicles(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_documents_vehicle ON documents(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_routes_vehicle ON routes(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_vehicle ON alerts(vehicle_id);
  `);

  // Lightweight migration for DBs created before the license_* columns existed.
  const existing = new Set(sqliteDb.prepare(`PRAGMA table_info(vehicles)`).all().map(c => c.name));
  const licenseColumns = {
    license_number: 'TEXT', license_category: 'TEXT', license_issue_date: 'TEXT',
    license_expiry_date: 'TEXT', license_photo_url: 'TEXT', license_restrictions: 'TEXT', license_infractions: 'TEXT'
  };
  for (const [name, def] of Object.entries(licenseColumns)) {
    if (!existing.has(name)) sqliteDb.exec(`ALTER TABLE vehicles ADD COLUMN ${name} ${def}`);
  }
}

const setupPromise = setup();

async function countUsers() {
  await setupPromise;
  const row = await query('SELECT COUNT(*) AS count FROM users', [], 'get');
  return Number(row.count);
}

async function createUser({ username, passwordHash, companyName }) {
  await setupPromise;
  const now = Date.now();
  if (isPg) {
    const row = await query(
      'INSERT INTO users (username, password_hash, company_name, created_at) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, passwordHash, companyName || null, now], 'get'
    );
    return { id: Number(row.id), username, companyName: companyName || null };
  }
  const info = await query(
    'INSERT INTO users (username, password_hash, company_name, created_at) VALUES ($1, $2, $3, $4)',
    [username, passwordHash, companyName || null, now], 'run'
  );
  return { id: Number(info.lastInsertRowid), username, companyName: companyName || null };
}

async function findUserByUsername(username) {
  await setupPromise;
  return query('SELECT * FROM users WHERE username = $1', [username], 'get');
}

async function findUserById(id) {
  await setupPromise;
  return query('SELECT * FROM users WHERE id = $1', [id], 'get');
}

async function getVehicle(vehicleId) {
  await setupPromise;
  return query('SELECT * FROM vehicles WHERE id = $1', [vehicleId], 'get');
}

async function getVehiclesByOwner(ownerUserId) {
  await setupPromise;
  return query('SELECT * FROM vehicles WHERE owner_user_id = $1', [ownerUserId], 'all');
}

async function upsertVehicle(vehicle) {
  await setupPromise;
  const existing = await getVehicle(vehicle.id);
  const now = Date.now();

  const fields = [
    'plate', 'name', 'type', 'status', 'driver_name', 'driver_phone', 'vehicle_model',
    'cargo_type', 'cargo_weight_kg', 'lat', 'lng', 'speed', 'heading', 'accuracy',
    'battery', 'fuel', 'temp', 'odometer',
    'license_number', 'license_category', 'license_issue_date', 'license_expiry_date',
    'license_photo_url', 'license_restrictions', 'license_infractions'
  ];

  if (existing) {
    const setClauses = fields.map((f, i) => `${f} = COALESCE($${i + 1}, ${f})`).join(', ');
    const values = fields.map(f => vehicle[f] ?? null);
    await query(
      `UPDATE vehicles SET ${setClauses}, last_update = $${fields.length + 1} WHERE id = $${fields.length + 2}`,
      [...values, now, vehicle.id],
      'run'
    );
  } else {
    const insertFields = ['id', 'owner_user_id', ...fields, 'last_update', 'created_at'];
    const placeholders = insertFields.map((_, i) => `$${i + 1}`).join(', ');
    const values = [
      vehicle.id, vehicle.owner_user_id,
      ...fields.map(f => (f === 'type' ? vehicle[f] ?? 'truck' : f === 'status' ? vehicle[f] ?? 'idle' : f === 'speed' ? vehicle[f] ?? 0 : f === 'heading' ? vehicle[f] ?? 0 : vehicle[f] ?? null)),
      now, now
    ];
    await query(`INSERT INTO vehicles (${insertFields.join(', ')}) VALUES (${placeholders})`, values, 'run');
  }

  return getVehicle(vehicle.id);
}

async function insertDocument(doc) {
  await setupPromise;
  await query(
    `INSERT INTO documents (id, vehicle_id, owner_user_id, doc_type, doc_number, client_name, client_ruc,
      delivery_address, items_summary, total_amount, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [doc.id, doc.vehicle_id, doc.owner_user_id, doc.doc_type, doc.doc_number || null,
      doc.client_name, doc.client_ruc || null, doc.delivery_address || null,
      doc.items_summary || null, doc.total_amount || 0, doc.status || 'EMITIDO', doc.created_at],
    'run'
  );
  return doc;
}

async function getDocumentsByVehicle(vehicleId) {
  await setupPromise;
  return query('SELECT * FROM documents WHERE vehicle_id = $1 ORDER BY created_at DESC', [vehicleId], 'all');
}

async function setActiveRoute({ id, vehicleId, ownerUserId, stops }) {
  await setupPromise;
  await query(`UPDATE routes SET status = 'replaced' WHERE vehicle_id = $1 AND status = 'active'`, [vehicleId], 'run');
  await query(
    `INSERT INTO routes (id, vehicle_id, owner_user_id, stops_json, status, created_at) VALUES ($1, $2, $3, $4, 'active', $5)`,
    [id, vehicleId, ownerUserId, JSON.stringify(stops), Date.now()],
    'run'
  );
  return getActiveRoute(vehicleId);
}

async function getActiveRoute(vehicleId) {
  await setupPromise;
  const row = await query(
    `SELECT * FROM routes WHERE vehicle_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [vehicleId], 'get'
  );
  if (!row) return null;
  return { id: row.id, vehicleId: row.vehicle_id, stops: JSON.parse(row.stops_json), createdAt: Number(row.created_at) };
}

async function insertAlert(alert) {
  await setupPromise;
  await query(
    `INSERT INTO alerts (id, vehicle_id, owner_user_id, type, message, lat, lng, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8)`,
    [alert.id, alert.vehicle_id, alert.owner_user_id, alert.type, alert.message || null,
      alert.lat ?? null, alert.lng ?? null, alert.created_at],
    'run'
  );
  return alert;
}

async function getAlertsByOwner(ownerUserId, limit = 50) {
  await setupPromise;
  return query('SELECT * FROM alerts WHERE owner_user_id = $1 ORDER BY created_at DESC LIMIT $2', [ownerUserId, limit], 'all');
}

async function resolveAlert(alertId, ownerUserId) {
  await setupPromise;
  await query(`UPDATE alerts SET status = 'RESOLVED', resolved_at = $1 WHERE id = $2 AND owner_user_id = $3`,
    [Date.now(), alertId, ownerUserId], 'run');
  return query('SELECT * FROM alerts WHERE id = $1', [alertId], 'get');
}

async function getAllVehicles() {
  await setupPromise;
  return query('SELECT * FROM vehicles', [], 'all');
}

module.exports = {
  isPg,
  MAX_FREE_ACCOUNTS,
  countUsers,
  createUser,
  findUserByUsername,
  findUserById,
  getVehicle,
  getVehiclesByOwner,
  getAllVehicles,
  upsertVehicle,
  insertDocument,
  getDocumentsByVehicle,
  setActiveRoute,
  getActiveRoute,
  insertAlert,
  getAlertsByOwner,
  resolveAlert
};
