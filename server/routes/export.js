const router = require('express').Router({ mergeParams: true });
const { Op } = require('sequelize');
const { Message, User, GuildMember, Channel } = require('../models');
const auth = require('../middleware/auth');

// GET /api/servers/:guildId/channels/:channelId/export?format=json|csv
router.get('/', auth, async (req, res) => {
  try {
    // Seuls les admins peuvent exporter
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.guildId, user_id: req.user.id },
    });
    if (!member || !['owner','admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Réservé aux admins' });
    }

    const channel = await Channel.findOne({
      where: { id: req.params.channelId, guild_id: req.params.guildId },
    });
    if (!channel) return res.status(404).json({ error: 'Channel introuvable' });

    const messages = await Message.findAll({
      where: { channel_id: req.params.channelId, guild_id: req.params.guildId },
      order: [['created_at', 'ASC']],
      limit: 10000, // max 10k messages par export
      include: [{ model: User, as: 'author', attributes: ['id','username'] }],
    });

    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const safeName = channel.name.replace(/[^a-z0-9-_]/gi, '_');
    const date = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      const lines = [
        'id,author,content,created_at,edited',
        ...messages.map(m => [
          m.id,
          `"${(m.author?.username || '?').replace(/"/g, '""')}"`,
          `"${m.content.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
          m.created_at?.toISOString(),
          m.edited ? 'true' : 'false',
        ].join(',')),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${date}.csv"`);
      return res.send('\uFEFF' + lines.join('\n')); // BOM pour Excel
    }

    // JSON
    const data = {
      channel: { id: channel.id, name: channel.name },
      exported_at: new Date().toISOString(),
      exported_by: req.user.username,
      message_count: messages.length,
      messages: messages.map(m => ({
        id:         m.id,
        author:     m.author?.username,
        author_id:  m.author_id,
        content:    m.content,
        created_at: m.created_at,
        edited:     m.edited,
        edited_at:  m.edited_at,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}-${date}.json"`);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
