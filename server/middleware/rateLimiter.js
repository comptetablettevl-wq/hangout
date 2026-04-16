const rateLimit = require('express-rate-limit');

// Limiteur général pour l'API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes, réessaie dans 15 minutes' },
});

// Limiteur strict pour auth (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives de connexion, réessaie dans 15 minutes' },
  skipSuccessfulRequests: true,
});

// Limiteur upload fichiers
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Trop d\'uploads, attends 1 minute' },
});

module.exports = { apiLimiter, authLimiter, uploadLimiter };
