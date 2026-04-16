const router = require('express').Router({ mergeParams: true });
const { Thread, ThreadMessage, User, Message, GuildMember } = require('../models');
const { sanitize } = require('../middleware/sanitize');
const auth = require('../middleware/auth');

const threadMsgInclude = [
  { model: User, as: 'author', attributes: ['id','username','avatar'] },
];

// GET /api/servers/:guildId/channels/:channelId/messages/:messageId/thread
router.get('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.guildId, user_id: req.user.id },
    });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const thread = await Thread.findOne({
      where: { parent_id: req.params.messageId },
      include: [
        { model: User, as: 'author', attributes: ['id','username','avatar'] },
        { model: ThreadMessage, as: 'messages', include: threadMsgInclude, order: [['created_at','ASC']], limit: 100 },
      ],
    });

    if (!thread) return res.json(null);
    res.json(thread);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:guildId/channels/:channelId/messages/:messageId/thread
// Créer un thread ou envoyer un message dans un thread existant
router.post('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.guildId, user_id: req.user.id },
    });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const { content, name } = req.body;
    const clean = sanitize(String(content || '').trim());
    if (!clean || clean.length > 2000) return res.status(400).json({ error: 'Contenu invalide' });

    // Vérifier que le message parent existe
    const parent = await Message.findByPk(req.params.messageId);
    if (!parent) return res.status(404).json({ error: 'Message introuvable' });

    // Trouver ou créer le thread
    let thread = await Thread.findOne({ where: { parent_id: req.params.messageId } });

    if (!thread) {
      const threadName = sanitize(String(name || clean).slice(0, 100));
      thread = await Thread.create({
        channel_id: req.params.channelId,
        guild_id:   req.params.guildId,
        parent_id:  req.params.messageId,
        author_id:  socket?.user?.id || req.user.id,
        name:       threadName,
        author_id:  req.user.id,
      });
    }

    const msg = await ThreadMessage.create({
      thread_id: thread.id,
      author_id: req.user.id,
      content:   clean,
    });

    // Incrémenter le compteur
    await thread.increment('message_count');

    const populated = await ThreadMessage.findByPk(msg.id, { include: threadMsgInclude });
    res.status(201).json({ thread, message: populated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
