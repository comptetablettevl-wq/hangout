const { emitSystemEvent } = require('../socket/systemEvents');
const { invalidatePermCache } = require('../middleware/permissions');
const router = require('express').Router({ mergeParams: true });
const { Ban, GuildMember, Guild, User } = require('../models');
let _io = null;
const setIO = (io) => { _io = io; };
const auth = require('../middleware/auth');

const hasPerm = async (guildId, userId, perm) => {
  const guild = await Guild.findByPk(guildId);
  if (guild?.owner_id === userId) return true;
  const m = await GuildMember.findOne({ where: { guild_id: guildId, user_id: userId } });
  if (!m) return false;
  if (['owner','admin'].includes(m.role)) return true;
  if (perm === 'kick' && m.role === 'moderator') return true;
  return false;
};

// POST /api/servers/:id/kick/:userId
router.post('/kick/:userId', auth, async (req, res) => {
  try {
    const { id: guildId } = req.params;
    if (!await hasPerm(guildId, req.user.id, 'kick'))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const target = await GuildMember.findOne({ where: { guild_id: guildId, user_id: req.params.userId } });
    if (!target) return res.status(404).json({ error: 'Membre introuvable' });
    if (['owner','admin'].includes(target.role) && req.user.id !== (await Guild.findByPk(guildId))?.owner_id)
      return res.status(403).json({ error: 'Impossible de kick un admin' });

    const targetUser = await User.findByPk(req.params.userId, { attributes: ['username'] });
    await target.destroy();
    invalidatePermCache(guildId, req.params.userId);
    if (_io) {
      const { emitSystemEvent } = require('../socket/systemEvents');
const { invalidatePermCache } = require('../middleware/permissions');
      await emitSystemEvent(_io, guildId, 'member_kick', req.user.id, req.params.userId, {
        actor: req.user.username, target: targetUser?.username || '?',
      });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/ban/:userId
router.post('/ban/:userId', auth, async (req, res) => {
  try {
    const { id: guildId } = req.params;
    if (!await hasPerm(guildId, req.user.id, 'ban'))
      return res.status(403).json({ error: 'Permissions insuffisantes' });

    const target = await GuildMember.findOne({ where: { guild_id: guildId, user_id: req.params.userId } });
    if (!target) return res.status(404).json({ error: 'Membre introuvable' });

    // Créer le ban
    await Ban.findOrCreate({
      where: { guild_id: guildId, user_id: req.params.userId },
      defaults: { guild_id: guildId, user_id: req.params.userId, banned_by: req.user.id, reason: req.body.reason || null },
    });
    // Kick aussi
    await target.destroy();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/servers/:id/ban/:userId — unban
router.delete('/ban/:userId', auth, async (req, res) => {
  try {
    const { id: guildId } = req.params;
    if (!await hasPerm(guildId, req.user.id, 'ban'))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    await Ban.destroy({ where: { guild_id: guildId, user_id: req.params.userId } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/servers/:id/bans
router.get('/bans', auth, async (req, res) => {
  try {
    if (!await hasPerm(req.params.id, req.user.id, 'ban'))
      return res.status(403).json({ error: 'Permissions insuffisantes' });
    const bans = await Ban.findAll({
      where: { guild_id: req.params.id },
      include: [
        { model: User, as: 'user', attributes: ['id','username','avatar'] },
        { model: User, as: 'bannedBy', attributes: ['id','username'] },
      ],
    });
    res.json(bans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

module.exports.setIO = setIO;
