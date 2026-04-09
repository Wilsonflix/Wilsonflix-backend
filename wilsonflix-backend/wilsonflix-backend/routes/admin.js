// routes/admin.js
const router = require('express').Router();
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Dashboard stats
router.get('/stats', requireAdmin, (req, res) => {
  res.json({
    users:       db.prepare('SELECT COUNT(*) as n FROM users').get().n,
    animes:      db.prepare('SELECT COUNT(*) as n FROM animes').get().n,
    episodes:    db.prepare('SELECT COUNT(*) as n FROM episodes').get().n,
    comments:    db.prepare('SELECT COUNT(*) as n FROM comments WHERE is_deleted=0').get().n,
    premium:     db.prepare("SELECT COUNT(*) as n FROM users WHERE plan!='free'").get().n,
    reports:     db.prepare("SELECT COUNT(*) as n FROM reports WHERE status='pending'").get().n,
    today_views: db.prepare("SELECT COUNT(*) as n FROM watch_history WHERE watched_at >= date('now')").get().n,
  });
});

// Listar utilizadores
router.get('/users', requireAdmin, (req, res) => {
  const { page = 1, limit = 30, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = '1=1'; const params = [];
  if (search) { where += ' AND (username LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const users = db.prepare(`
    SELECT id,username,email,role,plan,is_banned,is_verified,created_at,last_seen
    FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);
  const total = db.prepare(`SELECT COUNT(*) as n FROM users WHERE ${where}`).get(...params).n;
  res.json({ data: users, meta: { total, page: parseInt(page) } });
});

// Banir/desbanir utilizador
router.put('/users/:id/ban', requireAdmin, (req, res) => {
  const { ban, reason = '' } = req.body;
  db.prepare('UPDATE users SET is_banned=?, ban_reason=? WHERE id=?')
    .run(ban ? 1 : 0, reason, req.params.id);
  res.json({ message: ban ? 'Utilizador banido.' : 'Ban removido.' });
});

// Alterar role
router.put('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user','mod','admin'].includes(role)) return res.status(400).json({ error: 'Role inválido.' });
  db.prepare('UPDATE users SET role=? WHERE id=?').run(role, req.params.id);
  res.json({ message: `Role alterado para ${role}.` });
});

// Listar reports
router.get('/reports', requireAdmin, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, u.username as reporter FROM reports r
    JOIN users u ON r.reporter_id=u.id
    WHERE r.status='pending' ORDER BY r.created_at DESC LIMIT 50
  `).all();
  res.json(reports);
});

// Resolver report
router.put('/reports/:id', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['reviewed','resolved','dismissed'].includes(status)) return res.status(400).json({ error: 'Status inválido.' });
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ message: 'Report atualizado.' });
});

// Eliminar anime (admin)
router.delete('/animes/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM animes WHERE id=?').run(req.params.id);
  res.json({ message: 'Anime eliminado.' });
});

// Criar admin (via secret)
router.post('/promote', requireAuth, (req, res) => {
  const { secret } = req.body;
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Chave inválida.' });
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(req.user.id);
  res.json({ message: '🎉 Promovido a admin!' });
});

module.exports = router;
