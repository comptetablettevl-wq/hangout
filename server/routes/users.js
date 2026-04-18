const router = require('express').Router();
const { User, FriendRequest, FriendNickname } = require('../models');
const auth = require('../middleware/auth');
const { uploadAvatar, verifyImageIntegrity } = require('../middleware/uploadSecurity');
const { uploadLimiter } = require('../middleware/rateLimiter');
const path = require('path');
const fs   = require('fs');
const { uploadsDir } = require('../config');

// ── PATCH /api/users/me — profil complet ─────────────────
router.patch('/me', auth, async (req, res) => {
  try {
    const { username, custom_status, biography, activity_type, activity_text } = req.body;
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

    if (custom_status !== undefined)
      update.custom_status = String(custom_status).slice(0, 128);

    if (biography !== undefined)
      update.biography = biography ? String(biography).slice(0, 512) : null;

    if (activity_type !== undefined) {
      const validTypes = ['playing','watching','listening','competing','none'];
      if (!validTypes.includes(activity_type))
        return res.status(400).json({ error: 'Type d\'activité invalide' });
      update.activity_type = activity_type;
    }

    if (activity_text !== undefined)
      update.activity_text = activity_text ? String(activity_text).slice(0, 128) : null;

    if (!Object.keys(update).length)
      return res.status(400).json({ error: 'Rien à mettre à jour' });

    await req.user.update(update);
    res.json({ user: req.user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/users/me/password ──────────────────────────
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

// ── POST /api/users/me/avatar ─────────────────────────────
router.post('/me/avatar', auth, uploadLimiter,
  uploadAvatar.single('avatar'), verifyImageIntegrity,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Aucun fichier' });
      if (req.user.avatar?.startsWith('/uploads/')) {
        fs.unlink(path.join(uploadsDir, path.basename(req.user.avatar)), () => {});
      }
      const url = `/uploads/${req.file.filename}`;
      await req.user.update({ avatar: url });
      res.json({ avatar: url, user: req.user.toPublic() });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ── DELETE /api/users/me/avatar ───────────────────────────
router.delete('/me/avatar', auth, async (req, res) => {
  try {
    if (req.user.avatar?.startsWith('/uploads/')) {
      fs.unlink(path.join(uploadsDir, path.basename(req.user.avatar)), () => {});
    }
    await req.user.update({ avatar: null });
    res.json({ user: req.user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/users/:id — profil public ───────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id','username','avatar','status','custom_status','biography','activity_type','activity_text','createdAt'],
    });
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const data = user.toJSON();

    // Inclure le surnom si l'appelant en a défini un
    const nickname = await FriendNickname.findOne({
      where: { owner_id: req.user.id, target_id: req.params.id },
    });
    data.nickname = nickname?.nickname || null;

    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/users/:id/nickname — définir un surnom ───────
router.put('/:id/nickname', auth, async (req, res) => {
  try {
    if (req.params.id === req.user.id)
      return res.status(400).json({ error: 'Tu ne peux pas te donner un surnom' });

    const { nickname } = req.body;

    if (!nickname || !String(nickname).trim()) {
      // Supprimer le surnom
      await FriendNickname.destroy({
        where: { owner_id: req.user.id, target_id: req.params.id },
      });
      return res.json({ nickname: null });
    }

    const clean = String(nickname).trim().slice(0, 64);

    const [record] = await FriendNickname.upsert({
      owner_id:  req.user.id,
      target_id: req.params.id,
      nickname:  clean,
    });

    res.json({ nickname: clean });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/users/:id/nickname ───────────────────────
router.delete('/:id/nickname', auth, async (req, res) => {
  try {
    await FriendNickname.destroy({
      where: { owner_id: req.user.id, target_id: req.params.id },
    });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
