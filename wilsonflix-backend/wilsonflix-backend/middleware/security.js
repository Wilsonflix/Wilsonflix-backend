// middleware/security.js
const rateLimit = require('express-rate-limit');
const xss = require('xss');

// ── Rate limiters ──
exports.globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  message: { error: 'Demasiados pedidos. Tenta novamente em 15 minutos.' },
  standardHeaders: true, legacyHeaders: false,
});

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { error: 'Demasiadas tentativas de login. Tenta em 15 minutos.' },
});

exports.searchLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30,
  message: { error: 'Demasiadas pesquisas. Tenta em 1 minuto.' },
});

exports.uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 20,
  message: { error: 'Limite de uploads atingido.' },
});

// ── XSS Sanitizer ──
exports.sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

function sanitizeObject(obj) {
  if (typeof obj === 'string') return xss(obj.trim());
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj !== null && typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) clean[k] = sanitizeObject(v);
    return clean;
  }
  return obj;
}

// ── Injection guard ──
const INJECTION_RE = /(\bSELECT\b|\bDROP\b|\bINSERT\b|\bUNION\b|\bEXEC\b|--|;--|\/\*)/i;

exports.injectionGuard = (req, res, next) => {
  const check = JSON.stringify({ ...req.body, ...req.query, ...req.params });
  if (INJECTION_RE.test(check)) {
    return res.status(400).json({ error: 'Input inválido detectado.' });
  }
  next();
};

// ── Headers de segurança extras ──
exports.securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};
