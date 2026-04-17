const router = require('express').Router({ mergeParams: true });
const { Category, Channel, Guild, GuildMember } = require('../models');
const auth = require('../middleware/auth');

const isAdmin = async (guildId, userId) => {
  const guild = await Guild.findByPk(guildId);
  if (guild?.owner_id === userId) return true;
  const m = await GuildMember.findOne({ where: { guild_id: guildId, user_id: userId } });
  return m && ['owner','admin'].includes(m?.role);
};

// GET /api/servers/:id/categories
router.get('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({ where: { guild_id: req.params.id, user_id: req.user.id } });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    const categories = await Category.findAll({
      where: { guild_id: req.params.id },
      include: [{ model: Channel, as: 'channels', order: [['position','ASC']] }],
      order: [['position','ASC']],
    });
    res.json(categories);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/categories
router.post('/', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const { name } = req.body;
    if (!name || name.trim().length < 1) return res.status(400).json({ error: 'Nom requis' });

    const count = await Category.count({ where: { guild_id: req.params.id } });
    const cat = await Category.create({
      guild_id: req.params.id,
      name: name.trim().toUpperCase().slice(0, 32),
      position: count,
    });
    res.status(201).json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id/categories/:catId
router.patch('/:catId', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const cat = await Category.findOne({ where: { id: req.params.catId, guild_id: req.params.id } });
    if (!cat) return res.status(404).json({ error: 'Catégorie introuvable' });

    const update = {};
    if (req.body.name !== undefined) update.name = req.body.name.trim().toUpperCase().slice(0, 32);
    if (req.body.collapsed !== undefined) update.collapsed = Boolean(req.body.collapsed);
    if (req.body.position !== undefined) update.position = parseInt(req.body.position);

    await cat.update(update);
    res.json(cat);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/categories/:catId
router.delete('/:catId', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    // Désassocier les channels avant de supprimer la catégorie
    await Channel.update({ category_id: null }, {
      where: { category_id: req.params.catId, guild_id: req.params.id },
    });
    await Category.destroy({ where: { id: req.params.catId, guild_id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id/channels/:channelId/category — assigner un channel à une catégorie
router.patch('/assign/:channelId', auth, async (req, res) => {
  try {
    if (!await isAdmin(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const channel = await Channel.findOne({ where: { id: req.params.channelId, guild_id: req.params.id } });
    if (!channel) return res.status(404).json({ error: 'Channel introuvable' });

    await channel.update({ category_id: req.body.category_id || null });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
