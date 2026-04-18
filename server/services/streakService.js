/**
 * Service de gestion des streaks de connexion
 * Appelé à chaque login réussi
 */
const { UserStreak, UnlockedCosmetic } = require('../models');
const { getNewlyUnlocked } = require('./cosmetics');

/**
 * Met à jour le streak d'un user au login
 * Retourne { streak, newCosmetics } — newCosmetics = cosmétiques fraîchement débloqués
 */
const updateLoginStreak = async (userId) => {
  const today     = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  let streak = await UserStreak.findOne({ where: { user_id: userId } });

  // Première connexion
  if (!streak) {
    streak = await UserStreak.create({
      user_id:        userId,
      current_streak: 1,
      longest_streak: 1,
      total_days:     1,
      last_login:     today,
    });
    // Débloquer les cosmétiques du palier 1+ si applicable
    const newCosmetics = await syncUnlockedCosmetics(userId, 0, 1);
    return { streak, newCosmetics };
  }

  const lastLogin = streak.last_login?.toString().slice(0, 10);

  // Déjà connecté aujourd'hui → ne rien changer
  if (lastLogin === today) {
    return { streak, newCosmetics: [] };
  }

  const prevStreak = streak.current_streak;
  let newStreak;

  if (lastLogin === yesterday) {
    // Connexion consécutive → streak++
    newStreak = prevStreak + 1;
  } else {
    // Streak cassé → repartir à 1
    newStreak = 1;
  }

  const newLongest = Math.max(streak.longest_streak, newStreak);

  await streak.update({
    current_streak: newStreak,
    longest_streak: newLongest,
    total_days:     streak.total_days + 1,
    last_login:     today,
  });

  // Débloquer les nouveaux cosmétiques
  const newCosmetics = await syncUnlockedCosmetics(userId, prevStreak, newStreak);

  return { streak, newCosmetics };
};

/**
 * Synchronise les cosmétiques débloqués pour un user
 * Retourne la liste des nouveaux cosmétiques débloqués
 */
const syncUnlockedCosmetics = async (userId, prevStreak, newStreak) => {
  const toUnlock = getNewlyUnlocked(prevStreak, newStreak);
  if (!toUnlock.length) return [];

  const newCosmetics = [];
  for (const cosmetic of toUnlock) {
    try {
      await UnlockedCosmetic.create({ user_id: userId, cosmetic_id: cosmetic.id });
      newCosmetics.push(cosmetic);
    } catch (_) {} // Ignore si déjà débloqué (contrainte unique)
  }
  return newCosmetics;
};

/**
 * Récupère le streak + cosmétiques d'un user
 */
const getStreakData = async (userId) => {
  const streak = await UserStreak.findOne({ where: { user_id: userId } });
  const unlocked = await UnlockedCosmetic.findAll({ where: { user_id: userId } });
  return {
    streak:    streak || { current_streak: 0, longest_streak: 0, total_days: 0 },
    unlocked:  unlocked.map(u => u.cosmetic_id),
  };
};

module.exports = { updateLoginStreak, getStreakData };
