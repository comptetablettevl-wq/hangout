const router = require('express').Router();
const { UserStreak, UnlockedCosmetic, User } = require('../models');
const { COSMETICS, COSMETICS_MAP } = require('../services/cosmetics');
const { getStreakData } = require('../services/streakService');
const auth = require('../middleware/auth');

// GET /api/streaks/me
router.get('/me', auth, async (req, res) => {
  try {
    const { streak, unlocked } = await getStreakData(req.user.id);
    const streakData = await UserStreak.findOne({ where: { user_id: req.user.id } });
    res.json({
      current_streak:  streak.current_streak,
      longest_streak:  streak.longest_streak,
      total_days:      streak.total_days,
      last_login:      streak.last_login,
      unlocked:        unlocked,
      equipped_username_cosmetic: streakData?.equipped_username_cosmetic || null,
      equipped_avatar_cosmetic:   streakData?.equipped_avatar_cosmetic   || null,
      cosmetics:       COSMETICS, // catalogue complet
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/streaks/:userId — profil public
router.get('/:userId', auth, async (req, res) => {
  try {
    const { streak, unlocked } = await getStreakData(req.params.userId);
    const streakData = await UserStreak.findOne({ where: { user_id: req.params.userId } });
    res.json({
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      total_days:     streak.total_days,
      equipped_username_cosmetic: streakData?.equipped_username_cosmetic || null,
      equipped_avatar_cosmetic:   streakData?.equipped_avatar_cosmetic   || null,
      unlocked:       unlocked,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/streaks/equip — équiper un cosmétique
router.post('/equip', auth, async (req, res) => {
  try {
    const { cosmetic_id, slot } = req.body;
    // slot = 'username' | 'avatar' | null (déséquiper)

    if (!['username', 'avatar', null].includes(slot))
      return res.status(400).json({ error: 'Slot invalide' });

    // Vérifier que le cosmétique est débloqué
    if (cosmetic_id) {
      const unlocked = await UnlockedCosmetic.findOne({
        where: { user_id: req.user.id, cosmetic_id },
      });
      if (!unlocked) return res.status(403).json({ error: 'Cosmétique non débloqué' });

      const cosmetic = COSMETICS_MAP[cosmetic_id];
      if (!cosmetic) return res.status(404).json({ error: 'Cosmétique introuvable' });

      // Vérifier que le slot correspond au type
      if (slot === 'username' && cosmetic.type !== 'username')
        return res.status(400).json({ error: 'Ce cosmétique ne s\'applique pas au pseudo' });
      if (slot === 'avatar' && cosmetic.type !== 'avatar')
        return res.status(400).json({ error: 'Ce cosmétique ne s\'applique pas à l\'avatar' });
    }

    const update = {};
    if (slot === 'username') update.equipped_username_cosmetic = cosmetic_id || null;
    if (slot === 'avatar')   update.equipped_avatar_cosmetic   = cosmetic_id || null;

    await UserStreak.update(update, { where: { user_id: req.user.id } });
    res.json({ ok: true, equipped: cosmetic_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
