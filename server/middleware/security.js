const helmet = require('helmet');
const { clientUrl } = require('../config');

/**
 * Helmet configuré pour une app SPA + Socket.io
 * CSP assez strict tout en autorisant Socket.io et les fonts Google
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'cdn.socket.io', 'fonts.googleapis.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:        ["'self'", 'fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'blob:', '*'],   // images externes pour les OG previews
      connectSrc:     ["'self'", 'wss:', 'ws:'],
      mediaSrc:       ["'self'", 'blob:'],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,    // nécessaire pour les médias WebRTC
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // pour les uploads
});

/**
 * CORS strict — n'accepte que l'origine configurée
 * En dev (CLIENT_URL non défini) : accepte tout
 */
const corsOptions = {
  origin: (origin, callback) => {
    // Requêtes sans origine (curl, Postman, server-side) : autoriser
    if (!origin) return callback(null, true);
    // En dev ou si CLIENT_URL = '*'
    if (!clientUrl || clientUrl === '*') return callback(null, true);
    // Vérifier que l'origine correspond exactement ou est un sous-domaine
    const allowed = [clientUrl, `https://${new URL(clientUrl).hostname}`];
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

module.exports = { helmetMiddleware, corsOptions };
