// routes/user.js — Perfil, Preferências, Avatar
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Atualizar perfil
router.put('/profile', requireAuth, (req, res) => {
  const { username, bio } = req.body;
  if (username) {
    const exists = db.prepare('SELECT id FROM users WHERE username=? AND id!=?').get(username, req.user.id);
    if (exists) return res.status(409).json({ error: 'Username já em uso.' });
  }
  const updates = []; const vals = [];
  if (username) { updates.push('username=?'); vals.push(username); }
  if (bio !== undefined) { updates.push('bio=?'); vals.push(bio); }
  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar.' });
  updates.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
  res.json({ message: 'Perfil atualizado.' });
});

// Atualizar preferências
router.put('/preferences', requireAuth, (req, res) => {
  const { language, audio_pref, quality_pref,
    notif_episodes, notif_releases, notif_comments, notif_newsletter } = req.body;
  const map = { language, audio_pref, quality_pref,
    notif_episodes, notif_releases, notif_comments, notif_newsletter };
  const updates = []; const vals = [];
  Object.entries(map).forEach(([k, v]) => {
    if (v !== undefined) { updates.push(`${k}=?`); vals.push(v); }
  });
  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar.' });
  vals.push(req.user.id);
  db.prepare(`UPDATE users SET ${updates.join(',')} WHERE id=?`).run(...vals);
  res.json({ message: 'Preferências guardadas.' });
});

// Avatar (URL)
router.put('/avatar', requireAuth, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'URL do avatar necessária.' });
  db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id);
  res.json({ message: 'Avatar atualizado.', avatar });
});

// Perfil público
router.get('/:username', (req, res) => {
  const user = db.prepare(`
    SELECT id,username,avatar,bio,plan,created_at FROM users WHERE username=?
  `).get(req.params.username);
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado.' });
  const favCount = db.prepare('SELECT COUNT(*) as n FROM watchlist WHERE user_id=?').get(user.id).n;
  res.json({ ...user, favorites: favCount });
});

module.exports = router;
