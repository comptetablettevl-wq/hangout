const router = require('express').Router({ mergeParams: true });
const { Op, literal } = require('sequelize');
const { Message, User, GuildMember, Channel } = require('../models');
const auth = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// GET /api/servers/:id/search?q=<query>&channel=<id>&limit=20
router.get('/', auth, apiLimiter, async (req, res) => {
  try {
    const { q, channel, limit: lim } = req.query;
    if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Requête trop courte (min 2 chars)' });

    // Vérifier appartenance
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.id, user_id: req.user.id },
    });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const limit = Math.min(parseInt(lim) || 20, 50);
    const query = q.trim().slice(0, 100);

    const where = {
      guild_id: req.params.id,
      [Op.or]: [
        // FULLTEXT search (rapide, utilise l'index)
        literal(`MATCH(content) AGAINST(${JSON.stringify(query)} IN BOOLEAN MODE)`),
        // Fallback LIKE pour les termes courts
        { content: { [Op.like]: `%${query}%` } },
      ],
    };

    if (channel) where.channel_id = channel;

    const results = await Message.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      include: [
        { model: User, as: 'author', attributes: ['id','username','avatar'] },
        { model: Channel, as: null, attributes: [], where: { guild_id: req.params.id } },
      ],
      attributes: ['id','content','channel_id','guild_id','author_id','created_at','edited'],
    });

    res.json(results);
  } catch (err) {
    // Si FULLTEXT échoue (index pas encore créé), fallback sur LIKE seul
    try {
      const member = await GuildMember.findOne({
        where: { guild_id: req.params.id, user_id: req.user.id },
      });
      if (!member) return res.status(403).json({ error: 'Accès refusé' });

      const limit = Math.min(parseInt(req.query.limit) || 20, 50);
      const query = req.query.q.trim().slice(0, 100);
      const where = {
        guild_id: req.params.id,
        content:  { [Op.like]: `%${query}%` },
      };
      if (req.query.channel) where.channel_id = req.query.channel;

      const results = await Message.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        include: [{ model: User, as: 'author', attributes: ['id','username','avatar'] }],
      });
      res.json(results);
    } catch (err2) {
      res.status(500).json({ error: err2.message });
    }
  }
});

module.exports = router;
