const router = require('express').Router();
const { updateLoginStreak } = require('../services/streakService');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const auth = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate, schemas } = require('../middleware/validate');
const { jwtSecret, jwtExpiry } = require('../config');

const sign = (id) => jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiry });

// POST /api/auth/register
router.post('/register', authLimiter, validate(schemas.register), async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    const user = await User.create({ username, email, password });
    res.status(201).json({ token: sign(user.id), user: user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    res.json({ token: sign(user.id), user: user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => res.json({ user: req.user.toPublic() }));

// PATCH /api/auth/status
router.patch('/status', auth, validate(schemas.updateStatus), async (req, res) => {
  try {
    const { status, custom_status } = req.body;
    await req.user.update({ status, custom_status: custom_status ?? req.user.custom_status });
    res.json({ user: req.user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const user = await User.findOne({ where: { email } });
    // Toujours retourner 200 pour ne pas révéler si l'email existe
    if (!user) return res.json({ ok: true });

    const { PasswordResetToken } = require('../models');
    const { sendMail } = require('../services/mailer');
    const crypto = require('crypto');

    // Invalider les anciens tokens
    await PasswordResetToken.destroy({ where: { user_id: user.id } });

    // Créer un nouveau token (expire dans 1h)
    const token = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      user_id:    user.id,
      token,
      expires_at: new Date(Date.now() + 3600_000),
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password.html?token=${token}`;

    await sendMail({
      to:      email,
      subject: 'Hang Out — Réinitialisation de mot de passe',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="color:#5865F2">Hang Out</h2>
          <p>Tu as demandé une réinitialisation de mot de passe.</p>
          <p>Clique sur ce bouton dans l'heure :</p>
          <a href="${resetUrl}" style="display:inline-block;background:#5865F2;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
            Réinitialiser mon mot de passe
          </a>
          <p style="color:#666;font-size:13px">Si tu n'as pas fait cette demande, ignore cet email.</p>
          <p style="color:#999;font-size:12px">Lien : ${resetUrl}</p>
        </div>`,
      text: `Réinitialise ton mot de passe Hang Out : ${resetUrl}`,
    });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token et mot de passe requis' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court' });

    const { PasswordResetToken } = require('../models');

    const reset = await PasswordResetToken.findOne({
      where: { token, used: false },
      include: [{ model: User, as: null, foreignKey: 'user_id' }],
    });

    if (!reset) return res.status(400).json({ error: 'Token invalide' });
    if (new Date(reset.expires_at) < new Date()) {
      await reset.destroy();
      return res.status(400).json({ error: 'Token expiré — refais une demande' });
    }

    const user = await User.findByPk(reset.user_id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

    await user.update({ password });
    await reset.update({ used: true });

    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
