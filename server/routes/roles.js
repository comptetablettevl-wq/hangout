const router = require('express').Router({ mergeParams: true });
const { Role, MemberRole, GuildMember, Guild } = require('../models');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const canManageRoles = async (guildId, userId) => {
  const m = await GuildMember.findOne({ where: { guild_id: guildId, user_id: userId } });
  return m && ['owner','admin'].includes(m.role);
};

// GET /api/servers/:id/roles
router.get('/', auth, async (req, res) => {
  try {
    const roles = await Role.findAll({ where: { guild_id: req.params.id }, order: [['position','ASC']] });
    res.json(roles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/roles
router.post('/', auth, async (req, res) => {
  try {
    if (!await canManageRoles(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    const { name, color, can_manage_channels, can_manage_roles, can_kick, can_ban, can_manage_messages } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });
    const count = await Role.count({ where: { guild_id: req.params.id } });
    const role = await Role.create({
      guild_id: req.params.id, name, color: color || '#99aab5',
      position: count, can_manage_channels, can_manage_roles,
      can_kick, can_ban, can_manage_messages,
    });
    res.status(201).json(role);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id/roles/:roleId
router.patch('/:roleId', auth, async (req, res) => {
  try {
    if (!await canManageRoles(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    const role = await Role.findOne({ where: { id: req.params.roleId, guild_id: req.params.id } });
    if (!role) return res.status(404).json({ error: 'Rôle introuvable' });

    // Whitelist stricte des champs modifiables
    const ALLOWED = ['name','color','position',
      'can_manage_channels','can_manage_roles','can_kick','can_ban','can_manage_messages',
      'can_send_messages','can_read_history','can_add_reactions','can_mention_everyone',
      'can_manage_guild',
    ];
    const update = {};
    ALLOWED.forEach(k => { if (req.body[k] !== undefined) update[k] = req.body[k]; });

    // Empêcher de modifier un rôle de niveau supérieur si on est juste admin
    const guild = await require('../models').Guild.findByPk(req.params.id);
    if (guild?.owner_id !== req.user.id && update.can_manage_roles) {
      return res.status(403).json({ error: 'Seul le propriétaire peut déléguer la gestion des rôles' });
    }

    if (!Object.keys(update).length) return res.status(400).json({ error: 'Rien à mettre à jour' });
    await role.update(update);
    res.json(role);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/roles/:roleId
router.delete('/:roleId', auth, async (req, res) => {
  try {
    if (!await canManageRoles(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    await Role.destroy({ where: { id: req.params.roleId, guild_id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/members/:userId/roles/:roleId — assigner un rôle
router.post('/assign/:userId/:roleId', auth, async (req, res) => {
  try {
    if (!await canManageRoles(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    const member = await GuildMember.findOne({ where: { guild_id: req.params.id, user_id: req.params.userId } });
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    const [mr, created] = await MemberRole.findOrCreate({
      where: { member_id: member.id, role_id: req.params.roleId },
      defaults: { member_id: member.id, role_id: req.params.roleId },
    });
    res.json({ ok: true, created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/roles/assign/:userId/:roleId — retirer un rôle
router.delete('/assign/:userId/:roleId', auth, async (req, res) => {
  try {
    if (!await canManageRoles(req.params.id, req.user.id))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    const member = await GuildMember.findOne({ where: { guild_id: req.params.id, user_id: req.params.userId } });
    if (!member) return res.status(404).json({ error: 'Membre introuvable' });
    await MemberRole.destroy({ where: { member_id: member.id, role_id: req.params.roleId } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
