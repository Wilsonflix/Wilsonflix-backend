// server.js — Wilsonflix Backend v1.0
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const compression = require('compression');
const path    = require('path');

// ── Inicializar DB primeiro ──
require('./config/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════
// MIDDLEWARES GLOBAIS
// ══════════════════════════════════
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('dev'));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-CSRF-Token','X-Requested-With'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Segurança
const { globalLimiter, sanitizeBody, injectionGuard, securityHeaders } = require('./middleware/security');
app.use(globalLimiter);
app.use(sanitizeBody);
app.use(injectionGuard);
app.use(securityHeaders);

// Ficheiros estáticos (avatares, capas)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ══════════════════════════════════
// ROTAS
// ══════════════════════════════════
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/anime',         require('./routes/anime'));
app.use('/api/users',         require('./routes/user'));
app.use('/api/watchlist',     require('./routes/watchlist'));
app.use('/api/history',       require('./routes/history'));
app.use('/api/comments',      require('./routes/comments'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/admin',         require('./routes/admin'));

// ── Health check ──
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  version: '1.0.0',
  platform: 'Wilsonflix',
  timestamp: new Date().toISOString(),
}));

// ── Géneros ──
app.get('/api/genres', (req, res) => {
  const db = require('./config/database');
  res.json(db.prepare('SELECT * FROM genres ORDER BY name').all());
});

// ── 404 ──
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('❌ Erro:', err.message);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno.' : err.message,
  });
});

// ══════════════════════════════════
// START
// ══════════════════════════════════
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🎌 WILSONFLIX BACKEND v1.0       ║
  ╠══════════════════════════════════════╣
  ║  🚀 Servidor: http://localhost:${PORT}  ║
  ║  📊 Base de dados: SQLite            ║
  ║  🔐 Segurança: Helmet + RateLimit    ║
  ║  🌍 Ambiente: ${process.env.NODE_ENV || 'development'}             ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
