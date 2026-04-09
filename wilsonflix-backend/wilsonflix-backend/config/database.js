// config/database.js — SQLite Schema Completo
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/wilsonflix.db';

// Garante que a pasta existe
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ══════════════════════════════════════
// SCHEMA COMPLETO
// ══════════════════════════════════════
db.exec(`

-- UTILIZADORES
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  avatar      TEXT DEFAULT NULL,
  bio         TEXT DEFAULT '',
  role        TEXT DEFAULT 'user' CHECK(role IN ('user','mod','admin')),
  plan        TEXT DEFAULT 'free' CHECK(plan IN ('free','premium','ultra')),
  plan_expires_at DATETIME DEFAULT NULL,
  is_verified INTEGER DEFAULT 0,
  is_banned   INTEGER DEFAULT 0,
  ban_reason  TEXT DEFAULT NULL,
  language    TEXT DEFAULT 'pt',
  audio_pref  TEXT DEFAULT 'dubbed' CHECK(audio_pref IN ('dubbed','subbed','original')),
  quality_pref TEXT DEFAULT 'auto',
  notif_episodes INTEGER DEFAULT 1,
  notif_releases INTEGER DEFAULT 1,
  notif_comments INTEGER DEFAULT 1,
  notif_newsletter INTEGER DEFAULT 0,
  refresh_token TEXT DEFAULT NULL,
  reset_token TEXT DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  verify_token TEXT DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ANIMES
CREATE TABLE IF NOT EXISTS animes (
  id          TEXT PRIMARY KEY,
  kitsu_id    TEXT UNIQUE,
  mal_id      TEXT DEFAULT NULL,
  title       TEXT NOT NULL,
  title_jp    TEXT DEFAULT '',
  title_en    TEXT DEFAULT '',
  slug        TEXT UNIQUE NOT NULL,
  synopsis    TEXT DEFAULT '',
  cover_image TEXT DEFAULT NULL,
  poster_image TEXT DEFAULT NULL,
  banner_image TEXT DEFAULT NULL,
  trailer_youtube TEXT DEFAULT NULL,
  type        TEXT DEFAULT 'TV' CHECK(type IN ('TV','Movie','OVA','ONA','Special','Music')),
  status      TEXT DEFAULT 'current' CHECK(status IN ('current','finished','upcoming','tba')),
  genres      TEXT DEFAULT '[]',
  studios     TEXT DEFAULT '[]',
  season      TEXT DEFAULT NULL,
  year        INTEGER DEFAULT NULL,
  start_date  TEXT DEFAULT NULL,
  end_date    TEXT DEFAULT NULL,
  episode_count INTEGER DEFAULT NULL,
  episode_length INTEGER DEFAULT NULL,
  age_rating  TEXT DEFAULT NULL,
  avg_rating  REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  view_count  INTEGER DEFAULT 0,
  featured    INTEGER DEFAULT 0,
  is_dubbed   INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- EPISÓDIOS
CREATE TABLE IF NOT EXISTS episodes (
  id          TEXT PRIMARY KEY,
  anime_id    TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
  number      INTEGER NOT NULL,
  season      INTEGER DEFAULT 1,
  title       TEXT DEFAULT '',
  title_jp    TEXT DEFAULT '',
  synopsis    TEXT DEFAULT '',
  thumbnail   TEXT DEFAULT NULL,
  duration    INTEGER DEFAULT NULL,
  air_date    TEXT DEFAULT NULL,
  is_filler   INTEGER DEFAULT 0,
  is_dubbed   INTEGER DEFAULT 0,
  video_url   TEXT DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(anime_id, season, number)
);

-- HISTÓRICO DE VISUALIZAÇÃO
CREATE TABLE IF NOT EXISTS watch_history (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id    TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
  episode_id  TEXT REFERENCES episodes(id) ON DELETE SET NULL,
  progress    INTEGER DEFAULT 0,
  duration    INTEGER DEFAULT 0,
  completed   INTEGER DEFAULT 0,
  watched_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, episode_id)
);

-- WATCHLIST / FAVORITOS
CREATE TABLE IF NOT EXISTS watchlist (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id    TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'watching' CHECK(status IN ('watching','completed','dropped','plan_to_watch','on_hold')),
  score       INTEGER DEFAULT NULL CHECK(score IS NULL OR (score >= 1 AND score <= 10)),
  episodes_watched INTEGER DEFAULT 0,
  notes       TEXT DEFAULT '',
  added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id)
);

-- AVALIAÇÕES
CREATE TABLE IF NOT EXISTS ratings (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id    TEXT NOT NULL REFERENCES animes(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK(score >= 1 AND score <= 10),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, anime_id)
);

-- COMENTÁRIOS
CREATE TABLE IF NOT EXISTS comments (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anime_id    TEXT REFERENCES animes(id) ON DELETE CASCADE,
  episode_id  TEXT REFERENCES episodes(id) ON DELETE CASCADE,
  parent_id   TEXT REFERENCES comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  likes       INTEGER DEFAULT 0,
  is_spoiler  INTEGER DEFAULT 0,
  is_deleted  INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- LIKES DE COMENTÁRIOS
CREATE TABLE IF NOT EXISTS comment_likes (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, comment_id)
);

-- NOTIFICAÇÕES
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  link        TEXT DEFAULT NULL,
  image       TEXT DEFAULT NULL,
  is_read     INTEGER DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SUBSCRIÇÕES / PLANOS
CREATE TABLE IF NOT EXISTS subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL CHECK(plan IN ('premium','ultra')),
  price       REAL NOT NULL,
  currency    TEXT DEFAULT 'BRL',
  status      TEXT DEFAULT 'active' CHECK(status IN ('active','cancelled','expired')),
  starts_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  payment_ref TEXT DEFAULT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- GÉNEROS
CREATE TABLE IF NOT EXISTS genres (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT UNIQUE NOT NULL,
  slug  TEXT UNIQUE NOT NULL,
  color TEXT DEFAULT '#666'
);

-- RELATÓRIOS / REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK(target_type IN ('comment','anime','user')),
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  details     TEXT DEFAULT '',
  status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','reviewed','resolved','dismissed')),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SESSÕES ATIVAS
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  device      TEXT DEFAULT 'unknown',
  ip          TEXT DEFAULT NULL,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ÍNDICES para performance
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_anime ON watch_history(anime_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id);
CREATE INDEX IF NOT EXISTS idx_comments_episode ON comments(episode_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_episodes_anime ON episodes(anime_id);
CREATE INDEX IF NOT EXISTS idx_animes_status ON animes(status);
CREATE INDEX IF NOT EXISTS idx_animes_featured ON animes(featured);

`);

// ── Géneros padrão ──
const insertGenre = db.prepare(`INSERT OR IGNORE INTO genres (name, slug, color) VALUES (?, ?, ?)`);
const defaultGenres = [
  ['Ação','acao','#e50914'],['Aventura','aventura','#5b9bd5'],
  ['Comédia','comedia','#d05a22'],['Drama','drama','#2c3e6b'],
  ['Fantasia','fantasia','#d4760d'],['Romance','romance','#d46b8a'],
  ['Sci-Fi','sci-fi','#b5a48a'],['Shounen','shounen','#1e5a8a'],
  ['Seinen','seinen','#2c3e50'],['Slice of Life','slice-of-life','#2e8b57'],
  ['Sobrenatural','sobrenatural','#8b7fb5'],['Mecha','mecha','#607d8b'],
  ['Isekai','isekai','#8b6914'],['Escolar','escolar','#6b5a3e'],
  ['Dublado','dublado','#2e8b57'],['Terror','terror','#4a0000'],
];
defaultGenres.forEach(([name, slug, color]) => insertGenre.run(name, slug, color));

console.log('✅ Base de dados inicializada com sucesso.');
module.exports = db;
