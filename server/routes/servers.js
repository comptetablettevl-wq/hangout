const { emitSystemEvent } = require('../socket/systemEvents');
let _io = null;
const setIO = (io) => { _io = io; };

const router = require('express').Router();
const { Op } = require('sequelize');
const { Guild, GuildMember, Channel, User, GuildSettings, Category } = require('../models');
const { invalidatePermCache } = require('../middleware/permissions');
const auth = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { v4: uuidv4 } = require('uuid');

const memberInclude = {
  model: GuildMember, as: 'members',
  include: [{ model: User, as: 'user', attributes: ['id','username','avatar','status'] }],
};
const settingsInclude = { model: GuildSettings, as: 'settings' };
const categoryInclude = {
  model: Category, as: 'categories',
  include: [{ model: Channel, as: 'channels', order: [['position','ASC']] }],
  order: [['position','ASC']],
};

const isAdmin = (guild, userId) => {
  const m = guild.members?.find(m => m.user_id === userId);
  return m && ['owner','admin'].includes(m.role);
};

// GET /api/servers
router.get('/', auth, async (req, res) => {
  try {
    const memberships = await GuildMember.findAll({ where: { user_id: req.user.id } });
    const guildIds = memberships.map(m => m.guild_id);
    const guilds = await Guild.findAll({
      where: { id: { [Op.in]: guildIds } },
      include: [memberInclude, settingsInclude, categoryInclude, { model: Channel, as: 'channels', order: [['position','ASC']] }],
    });
    res.json(guilds);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// GET /api/servers/invite/:code — preview publique (sans auth)
router.get('/invite/:code', async (req, res) => {
  try {
    const guild = await Guild.findOne({
      where: { invite_code: req.params.code },
      attributes: ['id','name','icon','banner','description','invite_code','created_at'],
      include: [{ model: GuildMember, as: 'members', attributes: ['id'] }],
    });
    if (!guild) return res.status(404).json({ error: 'Invitation invalide ou expirée' });
    // Compter les membres en ligne via onlineUsers si disponible
    const memberCount  = guild.members?.length || 0;

    res.json({
      id:           guild.id,
      name:         guild.name,
      icon:         guild.icon,
      banner:       guild.banner,
      description:  guild.description,
      invite_code:  guild.invite_code,
      member_count: memberCount,
      online_count: 0, // sera mis à jour côté client via State
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers
router.post('/', auth, validate(schemas.createGuild), async (req, res) => {
  try {
    const guild = await Guild.create({ name: req.body.name, owner_id: req.user.id });
    await GuildMember.create({ guild_id: guild.id, user_id: req.user.id, role: 'owner' });
    // Créer les catégories par défaut
    const catText  = await Category.create({ guild_id: guild.id, name: 'TEXTE', position: 0 });
    const catVoice = await Category.create({ guild_id: guild.id, name: 'VOCAL', position: 1 });

    const channels = await Channel.bulkCreate([
      { guild_id: guild.id, name: 'général',   type: 'text',  position: 0, category_id: catText.id },
      { guild_id: guild.id, name: 'off-topic',  type: 'text',  position: 1, category_id: catText.id },
      { guild_id: guild.id, name: 'Général',   type: 'voice', position: 0, category_id: catVoice.id },
    ]);
    // Créer les settings par défaut — pointer les events vers #général
    await GuildSettings.create({
      guild_id: guild.id,
      event_member_join_channel:  channels[0].id,
      event_member_leave_channel: channels[0].id,
      event_member_kick_channel:  channels[0].id,
      event_member_ban_channel:   channels[0].id,
    });
    const full = await Guild.findByPk(guild.id, {
      include: [memberInclude, settingsInclude, categoryInclude, { model: Channel, as: 'channels' }],
    });
    res.status(201).json(full);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/join/:code
router.post('/join/:code', auth, async (req, res) => {
  try {
    const guild = await Guild.findOne({
      where: { invite_code: req.params.code },
      include: [memberInclude, settingsInclude, categoryInclude, { model: Channel, as: 'channels' }],
    });
    if (!guild) return res.status(404).json({ error: 'Invitation invalide' });

    const already = await GuildMember.findOne({ where: { guild_id: guild.id, user_id: req.user.id } });
    if (!already) {
      await GuildMember.create({ guild_id: guild.id, user_id: req.user.id, role: 'member' });
    }
    const full = await Guild.findByPk(guild.id, {
      include: [memberInclude, settingsInclude, categoryInclude, { model: Channel, as: 'channels' }],
    });
    // System event : membre a rejoint
    if (_io) {
      emitSystemEvent(_io, guild.id, 'member_join', null, req.user.id, {
        username: req.user.username,
      });
    }
    res.json(full);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/leave
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    const guild = await Guild.findByPk(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    if (guild.owner_id === req.user.id)
      return res.status(400).json({ error: 'Le propriétaire ne peut pas quitter' });
    await GuildMember.destroy({ where: { guild_id: guild.id, user_id: req.user.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/channels
router.post('/:id/channels', auth, validate(schemas.createChannel), async (req, res) => {
  try {
    const guild = await Guild.findByPk(req.params.id, { include: [memberInclude] });
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    if (!isAdmin(guild, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const count = await Channel.count({ where: { guild_id: guild.id } });
    const channel = await Channel.create({
      guild_id: guild.id,
      name: req.body.name,
      type: req.body.type || 'text',
      position: count,
    });
    res.status(201).json(channel);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/channels/:channelId
router.delete('/:id/channels/:channelId', auth, async (req, res) => {
  try {
    const guild = await Guild.findByPk(req.params.id, { include: [memberInclude] });
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    if (!isAdmin(guild, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    await Channel.destroy({ where: { id: req.params.channelId, guild_id: guild.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id/members/:userId/role
router.patch('/:id/members/:userId/role', auth, async (req, res) => {
  try {
    const guild = await Guild.findByPk(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    if (guild.owner_id !== req.user.id)
      return res.status(403).json({ error: 'Seul le propriétaire peut changer les rôles' });
    const member = await GuildMember.findOne({ where: { guild_id: guild.id, user_id: req.params.userId } });
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    await member.update({ role: req.body.role });
    invalidatePermCache(req.params.id, req.params.userId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// PATCH /api/servers/:id — renommer, description
router.patch('/:id', auth, async (req, res) => {
  try {
    const guild = await Guild.findByPk(req.params.id, { include: [memberInclude] });
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });
    if (!isAdmin(guild, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const update = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 64) return res.status(400).json({ error: 'Nom invalide (2-64 caractères)' });
      update.name = name;
    }
    if (req.body.description !== undefined) {
      update.description = String(req.body.description).slice(0, 256);
    }

    if (!Object.keys(update).length) return res.status(400).json({ error: 'Rien à mettre à jour' });

    await guild.update(update);

    // System event renommage
    if (update.name && _io) {
      const { emitSystemEvent } = require('../socket/systemEvents');
      emitSystemEvent(_io, guild.id, 'server_renamed', req.user.id, null, { name: update.name });
    }

    res.json({ ok: true, name: guild.name, description: guild.description });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

module.exports.setIO = setIO;
