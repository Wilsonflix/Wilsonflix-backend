// routes/anime.js
const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../config/database');
const { requireAuth, requireAdmin, optionalAuth } = require('../middleware/auth');
const { searchLimiter } = require('../middleware/security');

// ── LISTAR ANIMES (com filtros) ──
router.get('/', optionalAuth, (req, res) => {
  const {
    page = 1, limit = 20,
    genre, status, type, year,
    sort = 'avg_rating', order = 'DESC',
    featured, dubbed,
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const allowed_sorts = ['avg_rating','view_count','title','start_date','created_at'];
  const sortCol = allowed_sorts.includes(sort) ? sort : 'avg_rating';
  const sortDir = order === 'ASC' ? 'ASC' : 'DESC';

  let where = ['1=1'];
  const params = [];

  if (status) { where.push('status=?'); params.push(status); }
  if (type)   { where.push('type=?');   params.push(type); }
  if (year)   { where.push('year=?');   params.push(parseInt(year)); }
  if (featured) { where.push('featured=1'); }
  if (dubbed)   { where.push('is_dubbed=1'); }
  if (genre)  { where.push("genres LIKE ?"); params.push(`%${genre}%`); }

  const whereStr = where.join(' AND ');

  const total = db.prepare(`SELECT COUNT(*) as n FROM animes WHERE ${whereStr}`).get(...params).n;
  const animes = db.prepare(`
    SELECT id,title,title_jp,slug,cover_image,poster_image,type,status,
           genres,year,episode_count,avg_rating,rating_count,view_count,
           age_rating,is_dubbed,featured,start_date
    FROM animes WHERE ${whereStr}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    data: animes.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })),
    meta: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
  });
});

// ── PESQUISA ──
router.get('/search', searchLimiter, optionalAuth, (req, res) => {
  const { q, page = 1, limit = 15 } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'Termo de pesquisa necessário.' });

  const term = `%${q.trim()}%`;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const results = db.prepare(`
    SELECT id,title,title_jp,title_en,slug,poster_image,type,status,
           year,avg_rating,episode_count,is_dubbed,genres
    FROM animes
    WHERE title LIKE ? OR title_jp LIKE ? OR title_en LIKE ?
    ORDER BY avg_rating DESC, view_count DESC
    LIMIT ? OFFSET ?
  `).all(term, term, term, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as n FROM animes
    WHERE title LIKE ? OR title_jp LIKE ? OR title_en LIKE ?
  `).get(term, term, term).n;

  res.json({
    data: results.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })),
    meta: { total, page: parseInt(page), query: q },
  });
});

// ── TRENDING ──
router.get('/trending', (req, res) => {
  const animes = db.prepare(`
    SELECT id,title,slug,poster_image,cover_image,type,status,
           avg_rating,view_count,year,episode_count,genres
    FROM animes ORDER BY view_count DESC, avg_rating DESC LIMIT 10
  `).all();
  res.json(animes.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })));
});

// ── EM EXIBIÇÃO ──
router.get('/airing', (req, res) => {
  const animes = db.prepare(`
    SELECT id,title,slug,poster_image,type,avg_rating,episode_count,genres,year
    FROM animes WHERE status='current'
    ORDER BY avg_rating DESC LIMIT 20
  `).all();
  res.json(animes.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })));
});

// ── EM BREVE ──
router.get('/upcoming', (req, res) => {
  const animes = db.prepare(`
    SELECT id,title,slug,poster_image,type,start_date,genres
    FROM animes WHERE status='upcoming'
    ORDER BY start_date ASC LIMIT 20
  `).all();
  res.json(animes.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })));
});

// ── TOP AVALIADOS ──
router.get('/top-rated', (req, res) => {
  const { limit = 20 } = req.query;
  const animes = db.prepare(`
    SELECT id,title,slug,poster_image,type,status,avg_rating,rating_count,year,genres
    FROM animes WHERE rating_count > 0
    ORDER BY avg_rating DESC, rating_count DESC
    LIMIT ?
  `).all(parseInt(limit));
  res.json(animes.map(a => ({ ...a, genres: JSON.parse(a.genres || '[]') })));
});

// ── DETALHES DE UM ANIME ──
router.get('/:slug', optionalAuth, (req, res) => {
  const anime = db.prepare('SELECT * FROM animes WHERE slug=? OR id=?')
    .get(req.params.slug, req.params.slug);
  if (!anime) return res.status(404).json({ error: 'Anime não encontrado.' });

  // Incrementa views
  db.prepare('UPDATE animes SET view_count=view_count+1 WHERE id=?').run(anime.id);

  // Episódios
  const episodes = db.prepare(`
    SELECT id,number,season,title,thumbnail,duration,air_date,is_filler,is_dubbed
    FROM episodes WHERE anime_id=? ORDER BY season, number
  `).all(anime.id);

  // Avaliação do utilizador
  let userRating = null;
  let userWatchlist = null;
  if (req.user) {
    userRating = db.prepare('SELECT score FROM ratings WHERE user_id=? AND anime_id=?')
      .get(req.user.id, anime.id);
    userWatchlist = db.prepare('SELECT status,score,episodes_watched FROM watchlist WHERE user_id=? AND anime_id=?')
      .get(req.user.id, anime.id);
  }

  // Animes relacionados (mesmo género)
  const related = db.prepare(`
    SELECT id,title,slug,poster_image,avg_rating,type
    FROM animes WHERE id != ? AND genres LIKE ?
    ORDER BY avg_rating DESC LIMIT 6
  `).all(anime.id, `%${JSON.parse(anime.genres||'[]')[0] || ''}%`);

  res.json({
    ...anime,
    genres: JSON.parse(anime.genres || '[]'),
    studios: JSON.parse(anime.studios || '[]'),
    episodes,
    userRating: userRating?.score || null,
    userWatchlist,
    related: related.map(a => ({ ...a })),
  });
});

// ── EPISÓDIOS DE UM ANIME ──
router.get('/:id/episodes', (req, res) => {
  const { season } = req.query;
  let query = 'SELECT * FROM episodes WHERE anime_id=?';
  const params = [req.params.id];
  if (season) { query += ' AND season=?'; params.push(parseInt(season)); }
  query += ' ORDER BY season, number';
  res.json(db.prepare(query).all(...params));
});

// ── AVALIAR ANIME ──
router.post('/:id/rate', requireAuth, (req, res) => {
  const { score } = req.body;
  if (!score || score < 1 || score > 10)
    return res.status(400).json({ error: 'Nota deve ser entre 1 e 10.' });

  const anime = db.prepare('SELECT id FROM animes WHERE id=?').get(req.params.id);
  if (!anime) return res.status(404).json({ error: 'Anime não encontrado.' });

  const id = uuid();
  db.prepare(`
    INSERT INTO ratings (id, user_id, anime_id, score)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, anime_id) DO UPDATE SET score=excluded.score
  `).run(id, req.user.id, req.params.id, score);

  // Atualiza média
  const avg = db.prepare(`
    SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE anime_id=?
  `).get(req.params.id);

  db.prepare('UPDATE animes SET avg_rating=?, rating_count=? WHERE id=?')
    .run(avg.avg, avg.cnt, req.params.id);

  res.json({ message: 'Avaliação guardada.', score, avg: avg.avg });
});

// ── ADMIN: CRIAR ANIME ──
router.post('/', requireAdmin, (req, res) => {
  const {
    title, title_jp = '', title_en = '', synopsis = '',
    cover_image, poster_image, banner_image, trailer_youtube,
    type = 'TV', status = 'upcoming', genres = [], studios = [],
    season, year, start_date, end_date, episode_count, episode_length,
    age_rating, kitsu_id, featured = 0, is_dubbed = 0,
  } = req.body;

  if (!title) return res.status(400).json({ error: 'Título obrigatório.' });

  const slugify = require('slugify');
  const id = uuid();
  const slug = slugify(title, { lower: true, strict: true }) + '-' + id.slice(0,6);

  db.prepare(`
    INSERT INTO animes (
      id, kitsu_id, title, title_jp, title_en, slug, synopsis,
      cover_image, poster_image, banner_image, trailer_youtube,
      type, status, genres, studios, season, year, start_date, end_date,
      episode_count, episode_length, age_rating, featured, is_dubbed
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, kitsu_id||null, title, title_jp, title_en, slug, synopsis,
    cover_image||null, poster_image||null, banner_image||null, trailer_youtube||null,
    type, status, JSON.stringify(genres), JSON.stringify(studios),
    season||null, year||null, start_date||null, end_date||null,
    episode_count||null, episode_length||null, age_rating||null, featured?1:0, is_dubbed?1:0
  );

  res.status(201).json({ id, slug, message: 'Anime criado.' });
});

// ── ADMIN: EDITAR ANIME ──
router.put('/:id', requireAdmin, (req, res) => {
  const anime = db.prepare('SELECT id FROM animes WHERE id=?').get(req.params.id);
  if (!anime) return res.status(404).json({ error: 'Anime não encontrado.' });

  const fields = ['title','title_jp','synopsis','cover_image','poster_image',
    'trailer_youtube','type','status','genres','season','year',
    'start_date','end_date','episode_count','featured','is_dubbed'];

  const updates = [];
  const values = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f}=?`);
      values.push(['genres','studios'].includes(f) ? JSON.stringify(req.body[f]) : req.body[f]);
    }
  });

  if (!updates.length) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

  updates.push('updated_at=CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.prepare(`UPDATE animes SET ${updates.join(',')} WHERE id=?`).run(...values);
  res.json({ message: 'Anime atualizado.' });
});

// ── ADMIN: ADICIONAR EPISÓDIO ──
router.post('/:id/episodes', requireAdmin, (req, res) => {
  const { number, season = 1, title = '', synopsis = '',
    thumbnail, duration, air_date, is_filler = 0, is_dubbed = 0, video_url } = req.body;

  if (!number) return res.status(400).json({ error: 'Número do episódio obrigatório.' });

  const epId = uuid();
  db.prepare(`
    INSERT INTO episodes (id,anime_id,number,season,title,synopsis,thumbnail,duration,air_date,is_filler,is_dubbed,video_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(epId, req.params.id, number, season, title, synopsis, thumbnail||null,
    duration||null, air_date||null, is_filler?1:0, is_dubbed?1:0, video_url||null);

  res.status(201).json({ id: epId, message: 'Episódio adicionado.' });
});

module.exports = router;
