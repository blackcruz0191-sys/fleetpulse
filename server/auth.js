const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

// In a real deployment this must come from a secret manager / environment variable.
// Kept as a local dev fallback so the app runs out of the box.
const JWT_SECRET = process.env.JWT_SECRET || 'fleetpulse-dev-secret-change-in-production';
const TOKEN_EXPIRY = '30d';

function signToken(user) {
  return jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion when read aloud

async function generateUniqueDriverCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!(await db.findUserByDriverCode(code))) return code;
  }
  throw new Error('No se pudo generar un código de chofer único');
}

async function register({ username, password, companyName, role }) {
  if (!username || !password) {
    return { error: 'Usuario y contraseña son obligatorios', status: 400 };
  }
  if (password.length < 6) {
    return { error: 'La contraseña debe tener al menos 6 caracteres', status: 400 };
  }
  const normalizedRole = role === 'driver' ? 'driver' : 'admin';
  if ((await db.countUsers()) >= db.MAX_FREE_ACCOUNTS) {
    return { error: 'Se alcanzó el límite de 5000 cuentas gratuitas registradas', status: 403 };
  }
  if (await db.findUserByUsername(username)) {
    return { error: 'Ese nombre de usuario ya está registrado', status: 409 };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const driverCode = normalizedRole === 'driver' ? await generateUniqueDriverCode() : null;
  const user = await db.createUser({ username, passwordHash, companyName, role: normalizedRole, driverCode });
  const token = signToken(user);

  return {
    token,
    user: { id: user.id, username: user.username, companyName: user.companyName, role: user.role, driverCode: user.driverCode }
  };
}

async function login({ username, password }) {
  if (!username || !password) {
    return { error: 'Usuario y contraseña son obligatorios', status: 400 };
  }

  const user = await db.findUserByUsername(username);
  if (!user) {
    return { error: 'Usuario o contraseña incorrectos', status: 401 };
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return { error: 'Usuario o contraseña incorrectos', status: 401 };
  }

  const token = signToken(user);
  return {
    token,
    user: { id: user.id, username: user.username, companyName: user.company_name, role: user.role, driverCode: user.driver_code }
  };
}

function verifyToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return { id: payload.sub, username: payload.username };
  } catch (e) {
    return null;
  }
}

// Express middleware: requires a valid "Authorization: Bearer <token>" header.
function authMiddleware(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de autenticación requerido' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: 'Token inválido o expirado' });
  }

  req.userId = Number(user.id);
  req.username = user.username;
  next();
}

module.exports = { register, login, verifyToken, authMiddleware, JWT_SECRET };
