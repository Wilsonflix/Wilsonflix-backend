// routes/notifications.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const notifs = db.prepare(`
    SELECT * FROM notifications WHERE user_id=?
    ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  const unread = db.prepare('SELECT COUNT(*) as n FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).n;
  res.json({ notifications: notifs, unread });
});

router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ message: 'Todas marcadas como lidas.' });
});

router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Marcada como lida.' });
});

router.delete('/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Notificação eliminada.' });
});

// Helper para criar notificações (uso interno)
exports.createNotification = (user_id, type, title, message, link = null, image = null) => {
  const id = uuid();
  db.prepare(`
    INSERT INTO notifications (id,user_id,type,title,message,link,image)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, user_id, type, title, message, link, image);
};

module.exports = router;
