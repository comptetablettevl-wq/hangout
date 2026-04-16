const router = require('express').Router();
const { User } = require('../models');
const auth = require('../middleware/auth');
const { uploadAvatar, verifyImageIntegrity } = require('../middleware/uploadSecurity');
const { uploadLimiter } = require('../middleware/rateLimiter');

// PATCH /api/users/me
router.patch('/me', auth, async (req, res) => {
  try {
    const { username, custom_status } = req.body;
    const update = {};

    if (username !== undefined) {
      const u = String(username).trim();
      if (u.length < 2 || u.length > 32)
        return res.status(400).json({ error: 'Pseudo invalide (2-32 caractères)' });
      if (!/^[\w\-. ]+$/.test(u))
        return res.status(400).json({ error: 'Pseudo contient des caractères invalides' });
      const exists = await User.findOne({ where: { username: u } });
      if (exists && exists.id !== req.user.id)
        return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      update.username = u;
    }

    if (custom_status !== undefined) {
      update.custom_status = String(custom_status).slice(0, 128);
    }

    if (!Object.keys(update).length) return res.status(400).json({ error: 'Rien à mettre à jour' });

    await req.user.update(update);
    res.json({ user: req.user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/users/me/password
router.patch('/me/password', auth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
      return res.status(400).json({ error: 'Champs manquants' });
    if (new_password.length < 6 || new_password.length > 128)
      return res.status(400).json({ error: 'Mot de passe invalide (6-128 caractères)' });

    const user = await User.findByPk(req.user.id);
    if (!await user.comparePassword(current_password))
      return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    await user.update({ password: new_password });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/users/me/avatar
router.post('/me/avatar',
  auth,
  uploadLimiter,
  uploadAvatar.single('avatar'),
  verifyImageIntegrity,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
      // Supprimer l'ancien avatar si c'est un fichier local
      if (req.user.avatar?.startsWith('/uploads/')) {
        const fs = require('fs');
        const path = require('path');
        const { uploadsDir } = require('../config');
        const oldFile = path.join(uploadsDir, path.basename(req.user.avatar));
        fs.unlink(oldFile, () => {}); // Silencieux si déjà supprimé
      }
      const url = `/uploads/${req.file.filename}`;
      await req.user.update({ avatar: url });
      res.json({ avatar: url, user: req.user.toPublic() });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// DELETE /api/users/me/avatar
router.delete('/me/avatar', auth, async (req, res) => {
  try {
    if (req.user.avatar?.startsWith('/uploads/')) {
      const fs = require('fs');
      const path = require('path');
      const { uploadsDir } = require('../config');
      const oldFile = path.join(uploadsDir, path.basename(req.user.avatar));
      fs.unlink(oldFile, () => {});
    }
    await req.user.update({ avatar: null });
    res.json({ user: req.user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/users/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'avatar', 'status', 'custom_status', 'createdAt'],
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
