// routes/auth.js
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

// ── Validações ──
const registerRules = [
  body('username').trim().isLength({min:3,max:30}).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username inválido.'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({min:6}).withMessage('Senha mínima: 6 caracteres.'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
  next();
}

// ── REGISTER ──
router.post('/register', authLimiter, registerRules, validate, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (db.prepare('SELECT id FROM users WHERE email=?').get(email))
      return res.status(409).json({ error: 'Email já registado.' });
    if (db.prepare('SELECT id FROM users WHERE username=?').get(username))
      return res.status(409).json({ error: 'Username já existe.' });

    const hash = await bcrypt.hash(password, 12);
    const id = uuid();
    const verifyToken = uuid();

    db.prepare(`
      INSERT INTO users (id, username, email, password, verify_token)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, email, hash, verifyToken);

    const user = db.prepare('SELECT id,username,email,role,plan FROM users WHERE id=?').get(id);
    const accessToken = signAccess({ id, role: user.role });
    const refreshToken = signRefresh({ id });

    db.prepare('UPDATE users SET refresh_token=? WHERE id=?').run(refreshToken, id);

    res.status(201).json({
      message: 'Conta criada com sucesso!',
      user,
      accessToken,
      refreshToken,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── LOGIN ──
router.post('/login', authLimiter, loginRules, validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);

    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Email ou senha incorretos.' });

    if (user.is_banned)
      return res.status(403).json({ error: 'Conta suspensa.', reason: user.ban_reason });

    const accessToken = signAccess({ id: user.id, role: user.role });
    const refreshToken = signRefresh({ id: user.id });

    db.prepare('UPDATE users SET refresh_token=?, last_seen=CURRENT_TIMESTAMP WHERE id=?')
      .run(refreshToken, user.id);

    const { password: _, refresh_token: __, ...safeUser } = user;
    res.json({ user: safeUser, accessToken, refreshToken });
  } catch (e) {
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ── REFRESH TOKEN ──
router.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token necessário.' });

  try {
    const decoded = verifyRefresh(refreshToken);
    const user = db.prepare('SELECT id,role,refresh_token,is_banned FROM users WHERE id=?').get(decoded.id);

    if (!user || user.refresh_token !== refreshToken)
      return res.status(401).json({ error: 'Token inválido.' });
    if (user.is_banned)
      return res.status(403).json({ error: 'Conta suspensa.' });

    const newAccess = signAccess({ id: user.id, role: user.role });
    const newRefresh = signRefresh({ id: user.id });
    db.prepare('UPDATE users SET refresh_token=? WHERE id=?').run(newRefresh, user.id);

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch(e) {
    res.status(401).json({ error: 'Token expirado ou inválido.' });
  }
});

// ── LOGOUT ──
router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET refresh_token=NULL WHERE id=?').run(req.user.id);
  res.json({ message: 'Sessão terminada.' });
});

// ── ME ──
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT id,username,email,avatar,bio,role,plan,plan_expires_at,
           is_verified,language,audio_pref,quality_pref,
           notif_episodes,notif_releases,notif_comments,notif_newsletter,
           created_at,last_seen
    FROM users WHERE id=?
  `).get(req.user.id);
  res.json(user);
});

// ── ALTERAR SENHA ──
router.put('/change-password', requireAuth,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({min:6}),
  validate,
  async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare('SELECT password FROM users WHERE id=?').get(req.user.id);
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ error: 'Senha atual incorreta.' });

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password=?, refresh_token=NULL WHERE id=?').run(hash, req.user.id);
    res.json({ message: 'Senha alterada com sucesso.' });
  }
);

// ── FORGOT PASSWORD ──
router.post('/forgot-password', authLimiter,
  body('email').isEmail().normalizeEmail(), validate,
  async (req, res) => {
    const user = db.prepare('SELECT id,email FROM users WHERE email=?').get(req.body.email);
    if (!user) return res.json({ message: 'Se o email existir, receberás um link.' });

    const token = uuid();
    const expires = new Date(Date.now() + 3600000).toISOString(); // 1h
    db.prepare('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?')
      .run(token, expires, user.id);

    // Em produção: enviar email com link
    console.log(`🔑 Reset token para ${user.email}: ${token}`);
    res.json({ message: 'Se o email existir, receberás um link de recuperação.' });
  }
);

// ── RESET PASSWORD ──
router.post('/reset-password', authLimiter,
  body('token').notEmpty(),
  body('password').isLength({min:6}),
  validate,
  async (req, res) => {
    const { token, password } = req.body;
    const user = db.prepare(`
      SELECT id FROM users
      WHERE reset_token=? AND reset_token_expires > CURRENT_TIMESTAMP
    `).get(token);

    if (!user) return res.status(400).json({ error: 'Token inválido ou expirado.' });

    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?')
      .run(hash, user.id);

    res.json({ message: 'Senha redefinida com sucesso.' });
  }
);

module.exports = router;
