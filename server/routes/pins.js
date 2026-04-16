const router = require('express').Router({ mergeParams: true });
const { PinnedMessage, Message, User, GuildMember } = require('../models');
const auth = require('../middleware/auth');

const canPin = async (guildId, userId) => {
  const m = await GuildMember.findOne({ where: { guild_id: guildId, user_id: userId } });
  return m && ['owner','admin','moderator'].includes(m.role);
};

// GET /api/servers/:guildId/channels/:channelId/pins
router.get('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({ where: { guild_id: req.params.guildId, user_id: req.user.id } });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const pins = await PinnedMessage.findAll({
      where: { channel_id: req.params.channelId },
      include: [
        { model: Message, as: 'message', include: [{ model: User, as: 'author', attributes: ['id','username','avatar'] }] },
        { model: User, as: 'pinnedBy', attributes: ['id','username'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json(pins);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:guildId/channels/:channelId/pins/:messageId
router.post('/:messageId', auth, async (req, res) => {
  try {
    if (!await canPin(req.params.guildId, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const msg = await Message.findByPk(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message introuvable' });

    const count = await PinnedMessage.count({ where: { channel_id: req.params.channelId } });
    if (count >= 50) return res.status(400).json({ error: 'Maximum 50 messages épinglés par channel' });

    const [pin, created] = await PinnedMessage.findOrCreate({
      where: { channel_id: req.params.channelId, message_id: req.params.messageId },
      defaults: {
        channel_id: req.params.channelId,
        guild_id:   req.params.guildId,
        message_id: req.params.messageId,
        pinned_by:  req.user.id,
      },
    });
    res.status(created ? 201 : 200).json({ ok: true, created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:guildId/channels/:channelId/pins/:messageId
router.delete('/:messageId', auth, async (req, res) => {
  try {
    if (!await canPin(req.params.guildId, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    await PinnedMessage.destroy({
      where: { channel_id: req.params.channelId, message_id: req.params.messageId },
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
