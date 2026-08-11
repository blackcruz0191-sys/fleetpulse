/**
 * FleetPulse - Auth Client (Register / Login / Session Storage)
 */

const AuthClient = {
  API_BASE: 'https://fleetpulse-4knj.onrender.com',

  getToken() {
    return localStorage.getItem('fleetpulse_token');
  },

  getUser() {
    const raw = localStorage.getItem('fleetpulse_user');
    return raw ? JSON.parse(raw) : null;
  },

  saveSession(token, user) {
    localStorage.setItem('fleetpulse_token', token);
    localStorage.setItem('fleetpulse_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('fleetpulse_token');
    localStorage.removeItem('fleetpulse_user');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async login(username, password) {
    const res = await fetch(`${this.API_BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo iniciar sesión');
    this.saveSession(data.token, data.user);
    return data.user;
  },

  async register(username, password, companyName, role = 'admin') {
    const res = await fetch(`${this.API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, company_name: companyName, role })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'No se pudo crear la cuenta');
    this.saveSession(data.token, data.user);
    return data.user;
  },

  // Wrapper around fetch() that injects the Authorization header automatically.
  authedFetch(path, options = {}) {
    const headers = Object.assign({}, options.headers, {
      'Authorization': `Bearer ${this.getToken()}`
    });
    return fetch(`${this.API_BASE}${path}`, Object.assign({}, options, { headers }));
  }
};
