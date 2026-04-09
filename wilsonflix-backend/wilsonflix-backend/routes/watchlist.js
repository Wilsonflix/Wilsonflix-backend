// routes/watchlist.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT w.*, a.title, a.poster_image, a.episode_count, a.type, a.status as anime_status, a.slug
    FROM watchlist w JOIN animes a ON w.anime_id=a.id
    WHERE w.user_id=?
  `;
  const params = [req.user.id];
  if (status) { query += ' AND w.status=?'; params.push(status); }
  query += ' ORDER BY w.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

router.post('/', requireAuth, (req, res) => {
  const { anime_id, status = 'plan_to_watch' } = req.body;
  if (!anime_id) return res.status(400).json({ error: 'anime_id necessário.' });
  const id = uuid();
  db.prepare(`
    INSERT INTO watchlist (id,user_id,anime_id,status)
    VALUES (?,?,?,?)
    ON CONFLICT(user_id,anime_id) DO UPDATE SET status=excluded.status, updated_at=CURRENT_TIMESTAMP
  `).run(id, req.user.id, anime_id, status);
  res.status(201).json({ message: 'Adicionado à watchlist.' });
});

router.put('/:anime_id', requireAuth, (req, res) => {
  const { status, score, episodes_watched, notes } = req.body;
  const updates = []; const vals = [];
  if (status) { updates.push('status=?'); vals.push(status); }
  if (score !== undefined) { updates.push('score=?'); vals.push(score); }
  if (episodes_watched !== undefined) { updates.push('episodes_watched=?'); vals.push(episodes_watched); }
  if (notes !== undefined) { updates.push('notes=?'); vals.push(notes); }
  if (!updates.length) return res.status(400).json({ error: 'Nada para atualizar.' });
  updates.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(req.user.id, req.params.anime_id);
  db.prepare(`UPDATE watchlist SET ${updates.join(',')} WHERE user_id=? AND anime_id=?`).run(...vals);
  res.json({ message: 'Watchlist atualizada.' });
});

router.delete('/:anime_id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE user_id=? AND anime_id=?').run(req.user.id, req.params.anime_id);
  res.json({ message: 'Removido da watchlist.' });
});

module.exports = router;
