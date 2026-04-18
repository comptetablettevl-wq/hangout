const helmet = require('helmet');
const { clientUrl } = require('../config');

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'cdn.socket.io'],
      scriptSrcAttr:  ["'unsafe-inline'"],   // ← autorise les onclick="..." dans le HTML
      styleSrc:       ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc:        ["'self'", 'fonts.gstatic.com', 'fonts.googleapis.com'],
      imgSrc:         ["'self'", 'data:', 'blob:', '*'],
      connectSrc:     ["'self'", 'wss:', 'ws:', 'https:'],
      mediaSrc:       ["'self'", 'blob:'],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],
      baseUri:        ["'self'"],
    },
  },
  crossOriginEmbedderPolicy:  false,
  crossOriginResourcePolicy:  { policy: 'cross-origin' },
});

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (!clientUrl || clientUrl === '*') return callback(null, true);
    const allowed = [clientUrl, `https://${new URL(clientUrl).hostname}`];
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

module.exports = { helmetMiddleware, corsOptions };
