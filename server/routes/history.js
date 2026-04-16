const router = require('express').Router({ mergeParams: true });
const { MessageHistory, Message, GuildMember } = require('../models');
const auth = require('../middleware/auth');

// GET /api/messages/:guildId/:channelId/:messageId/history
router.get('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.guildId, user_id: req.user.id },
    });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const msg = await Message.findByPk(req.params.messageId);
    if (!msg || msg.guild_id !== req.params.guildId) return res.status(404).json({ error: 'Message introuvable' });

    const history = await MessageHistory.findAll({
      where: { message_id: req.params.messageId },
      order: [['edited_at', 'DESC']],
      limit: 20,
    });

    res.json(history);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
