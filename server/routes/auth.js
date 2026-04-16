const router = require('express').Router();
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
