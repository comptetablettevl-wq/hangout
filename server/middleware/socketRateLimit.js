/**
 * Rate limiter pour les events Socket.io
 * Empêche le spam de messages et les abus
 */

// Compteurs par userId : { count, resetAt }
const counters = new Map();

// Nettoyer les compteurs expirés toutes les minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of counters) {
    if (val.resetAt < now) counters.delete(key);
  }
}, 60_000);

/**
 * Crée un rate limiter pour un event socket
 * @param {number} max       — requêtes max dans la fenêtre
 * @param {number} windowMs  — durée de la fenêtre en ms
 * @param {string} keyPrefix — préfixe pour isoler les compteurs par event
 */
const socketRateLimit = (max, windowMs, keyPrefix = '') => {
  return (socket, next) => {
    const key = `${keyPrefix}:${socket.user?.id || socket.id}`;
    const now = Date.now();
    const entry = counters.get(key);

    if (!entry || entry.resetAt < now) {
      counters.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      socket.emit('error', {
        message: 'Trop de requêtes — attends un moment',
        code: 'RATE_LIMITED',
      });
      return; // ne pas appeler next()
    }

    entry.count++;
    next();
  };
};

/**
 * Wrapper pour utiliser socketRateLimit comme middleware inline dans les handlers
 * Usage : if (checkSocketRate(socket, 'msg', 5, 1000)) return;
 */
const checkSocketRate = (socket, key, max, windowMs) => {
  const fullKey = `${key}:${socket.user?.id || socket.id}`;
  const now = Date.now();
  const entry = counters.get(fullKey);

  if (!entry || entry.resetAt < now) {
    counters.set(fullKey, { count: 1, resetAt: now + windowMs });
    return false; // pas limité
  }

  if (entry.count >= max) {
    socket.emit('error', { message: 'Trop de messages — ralentis', code: 'RATE_LIMITED' });
    return true; // limité
  }

  entry.count++;
  return false;
};

module.exports = { socketRateLimit, checkSocketRate };
