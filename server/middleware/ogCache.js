/**
 * Cache en mémoire pour les OG previews
 * TTL : 1 heure par défaut
 * Aussi : protection SSRF (bloque les IPs privées / localhost)
 */

const cache = new Map(); // url -> { data, expiresAt }
const TTL_MS = 60 * 60 * 1000; // 1 heure

// Nettoyer les entrées expirées toutes les 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (val.expiresAt < now) cache.delete(key);
  }
}, 10 * 60 * 1000);

const ogCacheGet = (url) => {
  const entry = cache.get(url);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { cache.delete(url); return null; }
  return entry.data;
};

const ogCacheSet = (url, data) => {
  cache.set(url, { data, expiresAt: Date.now() + TTL_MS });
};

/**
 * Protection SSRF — bloque les URLs pointant vers des ressources internes
 */
const SSRF_BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^169\.254\./,  // link-local
  /\.local$/i,
  /\.internal$/i,
];

const isSSRFBlocked = (url) => {
  try {
    const { hostname } = new URL(url);
    return SSRF_BLOCKED_PATTERNS.some(p => p.test(hostname));
  } catch {
    return true; // URL invalide = bloquer
  }
};

module.exports = { ogCacheGet, ogCacheSet, isSSRFBlocked };
