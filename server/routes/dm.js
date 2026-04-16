const router = require('express').Router();
const { Op } = require('sequelize');
const { DirectMessage, User, Attachment } = require('../models');
const auth = require('../middleware/auth');

const dmInclude = [
  { model: User, as: 'sender',   attributes: ['id','username','avatar','status'] },
  { model: User, as: 'receiver', attributes: ['id','username','avatar','status'] },
  { model: Attachment, as: 'attachments' },
];

// GET /api/dm/conversations — liste des conversations
router.get('/conversations', auth, async (req, res) => {
  try {
    // Trouver tous les utilisateurs avec qui on a échangé
    const messages = await DirectMessage.findAll({
      where: {
        [Op.or]: [{ sender_id: req.user.id }, { receiver_id: req.user.id }],
      },
      order: [['created_at', 'DESC']],
      include: dmInclude,
    });

    // Grouper par interlocuteur, garder le dernier message
    const convMap = new Map();
    messages.forEach(msg => {
      const otherId = msg.sender_id === req.user.id ? msg.receiver_id : msg.sender_id;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          user: msg.sender_id === req.user.id ? msg.receiver : msg.sender,
          lastMessage: msg,
          unread: 0,
        });
      }
      if (msg.receiver_id === req.user.id && !msg.read) {
        convMap.get(otherId).unread++;
      }
    });

    res.json(Array.from(convMap.values()));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/dm/:userId?before=<ISO>
router.get('/:userId', auth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const where = {
      [Op.or]: [
        { sender_id: req.user.id,       receiver_id: req.params.userId },
        { sender_id: req.params.userId, receiver_id: req.user.id },
      ],
    };
    if (req.query.before) {
      where.created_at = { [Op.lt]: new Date(req.query.before) };
    }

    const messages = await DirectMessage.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      include: dmInclude,
    });

    // Marquer comme lus
    await DirectMessage.update(
      { read: true },
      { where: { sender_id: req.params.userId, receiver_id: req.user.id, read: false } }
    );

    res.json(messages.reverse());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
