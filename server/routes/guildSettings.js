const router = require('express').Router({ mergeParams: true });
const { invalidateSettingsCache } = require('../socket/systemEvents');
const { GuildSettings, Guild, GuildMember, Channel } = require('../models');
const auth = require('../middleware/auth');

// Liste des types d'événements valides
const EVENT_TYPES = [
  'member_join', 'member_leave', 'member_kick', 'member_ban',
  'channel_created', 'channel_deleted', 'server_renamed', 'role_created',
];

// GET /api/servers/:id/settings
router.get('/', auth, async (req, res) => {
  try {
    const member = await GuildMember.findOne({
      where: { guild_id: req.params.id, user_id: req.user.id },
    });
    if (!member) return res.status(403).json({ error: 'Accès refusé' });

    let settings = await GuildSettings.findOne({ where: { guild_id: req.params.id } });

    // Créer les settings si inexistants (migration pour les serveurs existants)
    if (!settings) {
      const firstChannel = await Channel.findOne({
        where: { guild_id: req.params.id, type: 'text' },
        order: [['position', 'ASC']],
      });
      settings = await GuildSettings.create({
        guild_id: req.params.id,
        event_member_join_channel:  firstChannel?.id || null,
        event_member_leave_channel: firstChannel?.id || null,
        event_member_kick_channel:  firstChannel?.id || null,
        event_member_ban_channel:   firstChannel?.id || null,
      });
    }

    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/servers/:id/settings
router.patch('/', auth, async (req, res) => {
  try {
    // Seuls les admins/owner peuvent modifier les settings
    const guild = await Guild.findByPk(req.params.id);
    if (!guild) return res.status(404).json({ error: 'Serveur introuvable' });

    const member = await GuildMember.findOne({
      where: { guild_id: req.params.id, user_id: req.user.id },
    });
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    }

    // Construire l'objet de mise à jour — whitelist stricte des champs
    const update = {};
    EVENT_TYPES.forEach(type => {
      const enabledKey = `event_${type}_enabled`;
      const channelKey = `event_${type}_channel`;

      if (req.body[enabledKey] !== undefined) {
        update[enabledKey] = Boolean(req.body[enabledKey]);
      }
      if (req.body[channelKey] !== undefined) {
        // Valider que c'est un UUID ou null
        const val = req.body[channelKey];
        if (val === null || (typeof val === 'string' && val.length === 36)) {
          update[channelKey] = val;
        }
      }
    });

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'Aucun champ valide à mettre à jour' });
    }

    let settings = await GuildSettings.findOne({ where: { guild_id: req.params.id } });
    if (!settings) {
      settings = await GuildSettings.create({ guild_id: req.params.id, ...update });
    } else {
      await settings.update(update);
    }

    invalidateSettingsCache(req.params.id);
    res.json(settings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
module.exports.EVENT_TYPES = EVENT_TYPES;
module.exports.EVENT_TYPES = EVENT_TYPES;
