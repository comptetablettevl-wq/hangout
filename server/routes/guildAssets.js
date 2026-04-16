const router = require('express').Router({ mergeParams: true });
const path   = require('path');
const fs     = require('fs');
const { Guild, GuildMember } = require('../models');
const { uploadImage, verifyImageIntegrity } = require('../middleware/uploadSecurity');
const { uploadLimiter } = require('../middleware/rateLimiter');
const auth   = require('../middleware/auth');
const { uploadsDir } = require('../config');

const isAdmin = async (guildId, userId) => {
  const guild = await Guild.findByPk(guildId);
  if (guild?.owner_id === userId) return { ok: true, guild };
  const m = await GuildMember.findOne({ where: { guild_id: guildId, user_id: userId } });
  return { ok: m && ['owner','admin'].includes(m?.role), guild };
};

const deleteOldFile = (url) => {
  if (!url?.startsWith('/uploads/')) return;
  const file = path.join(uploadsDir, path.basename(url));
  fs.unlink(file, () => {});
};

// POST /api/servers/:id/icon
router.post('/icon',
  auth, uploadLimiter,
  uploadImage.single('file'),
  verifyImageIntegrity,
  async (req, res) => {
    try {
      const { ok, guild } = await isAdmin(req.params.id, req.user.id);
      if (!ok) return res.status(403).json({ error: 'Permissions insuffisantes' });
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

      deleteOldFile(guild.icon);
      const url = `/uploads/${req.file.filename}`;
      await guild.update({ icon: url });
      res.json({ icon: url });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/servers/:id/icon
router.delete('/icon', auth, async (req, res) => {
  try {
    const { ok, guild } = await isAdmin(req.params.id, req.user.id);
    if (!ok) return res.status(403).json({ error: 'Permissions insuffisantes' });
    deleteOldFile(guild.icon);
    await guild.update({ icon: null });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/servers/:id/banner
router.post('/banner',
  auth, uploadLimiter,
  uploadImage.single('file'),
  verifyImageIntegrity,
  async (req, res) => {
    try {
      const { ok, guild } = await isAdmin(req.params.id, req.user.id);
      if (!ok) return res.status(403).json({ error: 'Permissions insuffisantes' });
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });

      deleteOldFile(guild.banner);
      const url = `/uploads/${req.file.filename}`;
      await guild.update({ banner: url });
      res.json({ banner: url });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/servers/:id/banner
router.delete('/banner', auth, async (req, res) => {
  try {
    const { ok, guild } = await isAdmin(req.params.id, req.user.id);
    if (!ok) return res.status(403).json({ error: 'Permissions insuffisantes' });
    deleteOldFile(guild.banner);
    await guild.update({ banner: null });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
