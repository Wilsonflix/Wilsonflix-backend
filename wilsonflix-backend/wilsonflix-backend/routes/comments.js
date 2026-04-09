// routes/comments.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth, optionalAuth, requireMod } = require('../middleware/auth');

// Comentários de um anime
router.get('/anime/:anime_id', optionalAuth, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const comments = db.prepare(`
    SELECT c.id, c.content, c.likes, c.is_spoiler, c.created_at, c.parent_id,
           u.id as user_id, u.username, u.avatar, u.plan
    FROM comments c JOIN users u ON c.user_id=u.id
    WHERE c.anime_id=? AND c.parent_id IS NULL AND c.is_deleted=0
    ORDER BY c.likes DESC, c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.anime_id, parseInt(limit), offset);

  // Respostas
  const withReplies = comments.map(c => {
    const replies = db.prepare(`
      SELECT c.id, c.content, c.likes, c.created_at,
             u.id as user_id, u.username, u.avatar
      FROM comments c JOIN users u ON c.user_id=u.id
      WHERE c.parent_id=? AND c.is_deleted=0
      ORDER BY c.created_at ASC LIMIT 5
    `).all(c.id);
    return { ...c, replies };
  });

  res.json(withReplies);
});

// Comentários de um episódio
router.get('/episode/:episode_id', optionalAuth, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const comments = db.prepare(`
    SELECT c.id, c.content, c.likes, c.is_spoiler, c.created_at,
           u.username, u.avatar, u.plan
    FROM comments c JOIN users u ON c.user_id=u.id
    WHERE c.episode_id=? AND c.is_deleted=0
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.episode_id, parseInt(limit), offset);
  res.json(comments);
});

// Criar comentário
router.post('/', requireAuth, (req, res) => {
  const { anime_id, episode_id, parent_id, content, is_spoiler = 0 } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comentário vazio.' });
  if (content.length > 2000) return res.status(400).json({ error: 'Máximo 2000 caracteres.' });
  if (!anime_id && !episode_id) return res.status(400).json({ error: 'anime_id ou episode_id necessário.' });

  const id = uuid();
  db.prepare(`
    INSERT INTO comments (id,user_id,anime_id,episode_id,parent_id,content,is_spoiler)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, req.user.id, anime_id||null, episode_id||null, parent_id||null, content.trim(), is_spoiler?1:0);

  const comment = db.prepare(`
    SELECT c.*, u.username, u.avatar FROM comments c
    JOIN users u ON c.user_id=u.id WHERE c.id=?
  `).get(id);
  res.status(201).json(comment);
});

// Like/unlike comentário
router.post('/:id/like', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT id FROM comments WHERE id=?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });

  const liked = db.prepare('SELECT 1 FROM comment_likes WHERE user_id=? AND comment_id=?')
    .get(req.user.id, req.params.id);

  if (liked) {
    db.prepare('DELETE FROM comment_likes WHERE user_id=? AND comment_id=?').run(req.user.id, req.params.id);
    db.prepare('UPDATE comments SET likes=MAX(0,likes-1) WHERE id=?').run(req.params.id);
    res.json({ liked: false });
  } else {
    db.prepare('INSERT OR IGNORE INTO comment_likes (user_id,comment_id) VALUES (?,?)').run(req.user.id, req.params.id);
    db.prepare('UPDATE comments SET likes=likes+1 WHERE id=?').run(req.params.id);
    res.json({ liked: true });
  }
});

// Eliminar comentário
router.delete('/:id', requireAuth, (req, res) => {
  const comment = db.prepare('SELECT user_id FROM comments WHERE id=?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'Não encontrado.' });
  if (comment.user_id !== req.user.id && !['mod','admin'].includes(req.user.role))
    return res.status(403).json({ error: 'Sem permissão.' });
  db.prepare('UPDATE comments SET is_deleted=1, content="[eliminado]" WHERE id=?').run(req.params.id);
  res.json({ message: 'Comentário eliminado.' });
});

module.exports = router;
