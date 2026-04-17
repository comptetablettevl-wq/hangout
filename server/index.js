// ── Validation des variables d'environnement ─────────────
const REQUIRED_ENV = ['JWT_SECRET', 'DB_HOST', 'DB_NAME', 'DB_USER'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error('[Config] Variables manquantes:', missing.join(', '));
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
  console.warn('[Config] ⚠️  JWT_SECRET trop court (< 32 chars)');
}

const express    = require('express');
const http       = require('http');
const { Server: SocketServer } = require('socket.io');
const cors       = require('cors');
const compression = require('compression');
const path       = require('path');
const fs         = require('fs');

const config     = require('./config');
const { sequelize } = require('./models');
const { helmetMiddleware, corsOptions } = require('./middleware/security');
const { apiLimiter }   = require('./middleware/rateLimiter');
const { sanitizeBody } = require('./middleware/sanitize');

const authRoutes       = require('./routes/auth');
const serverRoutes     = require('./routes/servers');
const messageRoutes    = require('./routes/messages');
const dmRoutes         = require('./routes/dm');
const uploadRoutes     = require('./routes/upload');
const ogRoutes         = require('./routes/og');
const rolesRoutes      = require('./routes/roles');
const moderationRoutes = require('./routes/moderation');
const friendsRoutes    = require('./routes/friends');
const usersRoutes      = require('./routes/users');
const pinsRoutes          = require('./routes/pins');
const guildSettingsRoutes = require('./routes/guildSettings');
const guildAssetsRoutes   = require('./routes/guildAssets');
const categoriesRoutes    = require('./routes/categories');
const searchRoutes     = require('./routes/search');
const threadsRoutes    = require('./routes/threads');
const exportRoutes     = require('./routes/export');
const historyRoutes    = require('./routes/history');
const setupSocket      = require('./socket');

const app        = express();
const httpServer = http.createServer(app);

// ── Trust proxy (Railway / Heroku / nginx) ────────────────
// Nécessaire pour que express-rate-limit voit la vraie IP client
app.set('trust proxy', 1);

// ── Socket.io ─────────────────────────────────────────────
const allowedOrigins = config.clientUrl && config.clientUrl !== '*'
  ? [config.clientUrl]
  : true; // dev : tout accepter

const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  60000,
  pingInterval: 25000,
  // Limiter la taille des payloads socket
  maxHttpBufferSize: 1e6, // 1 Mo max par event
});

// ── Dossier uploads ───────────────────────────────────────
const uploadsDir = path.resolve(config.uploadsDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ── Middlewares globaux ───────────────────────────────────
app.use(helmetMiddleware);
app.use(compression());
app.use(cors(corsOptions));
app.use(express.json({ limit: '512kb' })); // réduit de 2mb → 512kb
app.use(sanitizeBody);
app.use('/api', apiLimiter);

// ── Fichiers statiques ────────────────────────────────────
app.use(express.static(path.join(__dirname, '../client'), {
  maxAge: '1d',    // cache navigateur 1 jour pour les assets
  etag:   true,
}));

// Uploads — servis avec auth via route dédiée (pas en static direct)
// IMPORTANT : /uploads/* n'est plus servi publiquement sans token
app.get('/uploads/:filename', (req, res, next) => {
  // Vérifier que le fichier existe et que le nom ne contient pas de traversal
  const filename = path.basename(req.params.filename); // strip ../
  const filepath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Fichier introuvable' });
  // Forcer le content-type approprié
  res.sendFile(filepath);
});

// ── Routes API ────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/servers',  serverRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dm',       dmRoutes);
app.use('/api/upload',   uploadRoutes);
app.use('/api/og',       ogRoutes);
app.use('/api/friends',  friendsRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/servers/:id/roles',                          rolesRoutes);
app.use('/api/servers/:id',                                moderationRoutes);
app.use('/api/servers/:guildId/channels/:channelId/pins',    pinsRoutes);
app.use('/api/servers/:id/settings',                          guildSettingsRoutes);
app.use('/api/servers/:id/categories',                        categoriesRoutes);
app.use('/api/servers/:id',                                   guildAssetsRoutes);
app.use('/api/servers/:id/search',                            searchRoutes);
app.use('/api/servers/:guildId/channels/:channelId/export',   exportRoutes);
app.use('/api/servers/:guildId/channels/:channelId/messages/:messageId/thread',  threadsRoutes);
app.use('/api/messages/:guildId/:channelId/:messageId/history', historyRoutes);

// ── Gestionnaire d'erreurs global ────────────────────────
app.use((err, req, res, next) => {
  // Erreur Multer
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop grand' });
  if (err.message?.includes('non autorisé') || err.message?.includes('non supporté')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Erreur interne' });
});

// ── Socket.io ─────────────────────────────────────────────
setupSocket(io);

// Injecter io dans les routes qui en ont besoin
const moderationModule = require('./routes/moderation');
if (moderationModule.setIO) moderationModule.setIO(io);
const serverModule = require('./routes/servers');
if (serverModule.setIO) serverModule.setIO(io);

// ── Route invitation publique ────────────────────────────
app.get('/invite/:code', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/invite.html'));
});

// ── Route reset password ──────────────────────────────────
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/reset-password.html'));
});

// ── SPA fallback ──────────────────────────────────────────
app.get('*', (req, res) => {
  // Routes API → 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route introuvable' });
  }
  // Pages HTML connues
  const htmlPages = ['/', '/invite', '/reset-password'];
  const isPage = htmlPages.some(p => req.path === p || req.path.startsWith(p + '/'));
  if (!isPage && req.path.includes('.') && !req.path.endsWith('.html')) {
    // Asset manquant → 404
    return res.status(404).sendFile(path.join(__dirname, '../client/404.html'));
  }
  // SPA
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ── Démarrage ─────────────────────────────────────────────
sequelize.sync({ alter: false })
  .then(() => {
    console.log('[DB] MySQL connecté');
    httpServer.listen(config.port, () => {
      console.log(`[Server] Hang Out → port ${config.port}`);
    });
  })
  .catch(err => {
    console.error('[DB] Erreur:', err.message);
    process.exit(1);
  });

// ── Graceful shutdown ────────────────────────────────────
const shutdown = async (signal) => {
  console.log(`[Server] ${signal} reçu — arrêt propre`);
  httpServer.close(async () => {
    await sequelize.close();
    console.log('[Server] Arrêté');
    process.exit(0);
  });
  // Force quit après 10s
  setTimeout(() => process.exit(1), 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
