// middleware/auth.js
const { verifyAccess } = require('../utils/jwt');
const db = require('../config/database');

// Requer login
exports.requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token de acesso necessário.' });

  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccess(token);
    const user = db.prepare('SELECT id,username,email,role,plan,is_banned FROM users WHERE id=?').get(decoded.id);
    if (!user) return res.status(401).json({ error: 'Utilizador não encontrado.' });
    if (user.is_banned) return res.status(403).json({ error: 'Conta suspensa.', reason: user.ban_reason });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
};

// Requer plano premium
exports.requirePremium = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.user.plan === 'free')
    return res.status(403).json({ error: 'Plano Premium necessário.', upgrade: true });
  next();
};

// Requer ser admin
exports.requireAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (req.user.role !== 'admin')
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  next();
};

// Requer ser mod ou admin
exports.requireMod = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
  if (!['mod','admin'].includes(req.user.role))
    return res.status(403).json({ error: 'Acesso restrito a moderadores.' });
  next();
};

// Opcional (não bloqueia se não autenticado)
exports.optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const token = header.split(' ')[1];
    const decoded = verifyAccess(token);
    const user = db.prepare('SELECT id,username,email,role,plan,is_banned FROM users WHERE id=?').get(decoded.id);
    if (user && !user.is_banned) req.user = user;
  } catch(e) {}
  next();
};
