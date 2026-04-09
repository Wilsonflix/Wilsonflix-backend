// routes/history.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

// Histórico completo
router.get('/', requireAuth, (req, res) => {
  const history = db.prepare(`
    SELECT wh.*, a.title, a.poster_image, a.slug,
           e.number as ep_number, e.season, e.title as ep_title, e.thumbnail
    FROM watch_history wh
    JOIN animes a ON wh.anime_id=a.id
    LEFT JOIN episodes e ON wh.episode_id=e.id
    WHERE wh.user_id=?
    ORDER BY wh.watched_at DESC LIMIT 50
  `).all(req.user.id);
  res.json(history);
});

// Continuar a assistir
router.get('/continue', requireAuth, (req, res) => {
  const items = db.prepare(`
    SELECT wh.anime_id, wh.episode_id, wh.progress, wh.duration, wh.watched_at,
           a.title, a.poster_image, a.cover_image, a.slug,
           e.number, e.season, e.title as ep_title, e.thumbnail
    FROM watch_history wh
    JOIN animes a ON wh.anime_id=a.id
    LEFT JOIN episodes e ON wh.episode_id=e.id
    WHERE wh.user_id=? AND wh.completed=0 AND wh.progress > 0
    ORDER BY wh.watched_at DESC LIMIT 10
  `).all(req.user.id);
  res.json(items);
});

// Guardar progresso
router.post('/progress', requireAuth, (req, res) => {
  const { anime_id, episode_id, progress, duration } = req.body;
  if (!anime_id) return res.status(400).json({ error: 'anime_id necessário.' });
  const completed = progress && duration ? (progress / duration >= 0.9 ? 1 : 0) : 0;
  const id = uuid();
  db.prepare(`
    INSERT INTO watch_history (id,user_id,anime_id,episode_id,progress,duration,completed)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id,episode_id) DO UPDATE SET
      progress=excluded.progress, duration=excluded.duration,
      completed=excluded.completed, watched_at=CURRENT_TIMESTAMP
  `).run(id, req.user.id, anime_id, episode_id||null, progress||0, duration||0, completed);

  // Atualiza episódios assistidos na watchlist
  if (completed && episode_id) {
    db.prepare(`
      UPDATE watchlist SET episodes_watched=episodes_watched+1, updated_at=CURRENT_TIMESTAMP
      WHERE user_id=? AND anime_id=? AND episodes_watched < (SELECT episode_count FROM animes WHERE id=?)
    `).run(req.user.id, anime_id, anime_id);
  }

  res.json({ message: 'Progresso guardado.', completed: !!completed });
});

// Limpar histórico
router.delete('/', requireAuth, (req, res) => {
  db.prepare('DELETE FROM watch_history WHERE user_id=?').run(req.user.id);
  res.json({ message: 'Histórico limpo.' });
});

module.exports = router;
