const router = require('express').Router();
const { Op } = require('sequelize');
const { Message, User, Reaction, Attachment, GuildMember, Channel } = require('../models');
const { hasPermission } = require('../middleware/permissions');
const auth = require('../middleware/auth');

const msgInclude = [
  { model: User, as: 'author', attributes: ['id','username','avatar'] },
  { model: Reaction, as: 'reactions', include: [{ model: User, as: 'user', attributes: ['id'] }] },
  { model: Attachment, as: 'attachments' },
  {
    model: Message, as: 'replyMessage',
    include: [{ model: User, as: 'author', attributes: ['id','username'] }],
  },
];

// GET /api/messages/:guildId/:channelId?before=<ISO>&limit=50
router.get('/:guildId/:channelId', auth, async (req, res) => {
  try {
    // Vérifier appartenance
    const canRead = await hasPermission(req.params.guildId, req.user.id, 'can_read_history');
    if (!canRead) return res.status(403).json({ error: 'Tu n\'as pas accès à l\'historique de ce channel' });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const where = { channel_id: req.params.channelId, guild_id: req.params.guildId };
    if (req.query.before) {
      where.created_at = { [Op.lt]: new Date(req.query.before) };
    }

    const messages = await Message.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      include: msgInclude,
    });

    res.json(messages.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
