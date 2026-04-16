const router = require('express').Router();
const { Op } = require('sequelize');
const { FriendRequest, User } = require('../models');
const auth = require('../middleware/auth');

const friendInclude = [
  { model: User, as: 'sender',   attributes: ['id','username','avatar','status'] },
  { model: User, as: 'receiver', attributes: ['id','username','avatar','status'] },
];

// GET /api/friends — liste amis + demandes
router.get('/', auth, async (req, res) => {
  try {
    const all = await FriendRequest.findAll({
      where: {
        [Op.or]: [{ sender_id: req.user.id }, { receiver_id: req.user.id }],
      },
      include: friendInclude,
    });
    const friends  = all.filter(r => r.status === 'accepted');
    const pending  = all.filter(r => r.status === 'pending' && r.receiver_id === req.user.id);
    const sent     = all.filter(r => r.status === 'pending' && r.sender_id === req.user.id);
    res.json({ friends, pending, sent });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/friends/add — envoyer demande par username
router.post('/add', auth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username requis' });

    const target = await User.findOne({ where: { username } });
    if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
    if (target.id === req.user.id) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });

    // Vérifier si relation existe déjà
    const existing = await FriendRequest.findOne({
      where: {
        [Op.or]: [
          { sender_id: req.user.id, receiver_id: target.id },
          { sender_id: target.id,   receiver_id: req.user.id },
        ],
      },
    });
    if (existing) {
      if (existing.status === 'accepted') return res.status(409).json({ error: 'Déjà amis' });
      if (existing.status === 'pending')  return res.status(409).json({ error: 'Demande déjà envoyée' });
      // Si declined, recréer
      await existing.destroy();
    }

    const req_ = await FriendRequest.create({ sender_id: req.user.id, receiver_id: target.id });
    const populated = await FriendRequest.findByPk(req_.id, { include: friendInclude });
    res.status(201).json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/friends/:id/accept
router.patch('/:id/accept', auth, async (req, res) => {
  try {
    const fr = await FriendRequest.findByPk(req.params.id);
    if (!fr || fr.receiver_id !== req.user.id) return res.status(404).json({ error: 'Demande introuvable' });
    await fr.update({ status: 'accepted' });
    const populated = await FriendRequest.findByPk(fr.id, { include: friendInclude });
    res.json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/friends/:id/decline
router.patch('/:id/decline', auth, async (req, res) => {
  try {
    const fr = await FriendRequest.findByPk(req.params.id);
    if (!fr || fr.receiver_id !== req.user.id) return res.status(404).json({ error: 'Demande introuvable' });
    await fr.update({ status: 'declined' });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/friends/:id — supprimer ami ou annuler demande
router.delete('/:id', auth, async (req, res) => {
  try {
    const fr = await FriendRequest.findByPk(req.params.id);
    if (!fr) return res.status(404).json({ error: 'Introuvable' });
    if (fr.sender_id !== req.user.id && fr.receiver_id !== req.user.id)
      return res.status(403).json({ error: 'Accès refusé' });
    await fr.destroy();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/friends/search?q=username — chercher un user
router.get('/search', auth, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json([]);
    const { Op } = require('sequelize');
    const users = await User.findAll({
      where: { username: { [Op.like]: `%${q}%` }, id: { [Op.ne]: req.user.id } },
      attributes: ['id','username','avatar','status'],
      limit: 10,
    });
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
