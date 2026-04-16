const router = require('express').Router();
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { ogCacheGet, ogCacheSet, isSSRFBlocked } = require('../middleware/ogCache');

// GET /api/og?url=<url>
router.get('/', auth, apiLimiter, async (req, res) => {
  const url = req.query.url;
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL invalide' });

  // Protection SSRF
  if (isSSRFBlocked(url)) return res.status(403).json({ error: 'URL non autorisée' });

  // Vérifier le cache
  const cached = ogCacheGet(url);
  if (cached) return res.json(cached);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'HangOut/2.0 (preview bot)',
        'Accept': 'text/html',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) { ogCacheSet(url, {}); return res.json({}); }

    const ct = response.headers.get('content-type') || '';
    if (!ct.includes('text/html')) { ogCacheSet(url, {}); return res.json({}); }

    // Lire seulement les 50 premiers Ko (pas besoin de la page entière)
    const reader = response.body.getReader();
    let html = '';
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      totalBytes += value.length;
      if (totalBytes > 50_000) { reader.cancel(); break; }
    }

    const get = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,500})["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]+content=["']([^"']{1,500})["'][^>]+(?:property|name)=["']${prop}["']`, 'i'));
      return m?.[1]?.trim() || null;
    };

    const title       = get('og:title') || get('twitter:title') || html.match(/<title[^>]*>([^<]{1,200})<\/title>/i)?.[1]?.trim() || null;
    const description = get('og:description') || get('twitter:description') || get('description') || null;
    const image       = get('og:image') || get('twitter:image') || null;

    // Ne pas retourner d'image si elle pointe vers une IP privée (SSRF via redirect)
    const safeImage = image && !isSSRFBlocked(image) ? image : null;

    const data = {
      title:       title?.slice(0, 200) || null,
      description: description?.slice(0, 400) || null,
      image:       safeImage,
    };

    ogCacheSet(url, data);
    res.json(data);
  } catch (err) {
    ogCacheSet(url, {}); // Cacher même les erreurs pour éviter le spam
    res.json({});
  }
});

module.exports = router;
