/**
 * Définition de tous les cosmétiques débloquables par streak
 * Chaque cosmétique a un id unique, un palier requis, et des données CSS/JS
 */

const COSMETICS = [
  // ── Badges ────────────────────────────────────────────
  {
    id:       'badge_regular',
    type:     'badge',
    name:     'Régulier',
    emoji:    '🔥',
    days:     3,
    desc:     '3 jours de connexion consécutifs',
    css:      null,
  },
  {
    id:       'badge_devoted',
    type:     'badge',
    name:     'Dévot',
    emoji:    '⚡',
    days:     14,
    desc:     '14 jours de connexion consécutifs',
    css:      null,
  },
  {
    id:       'badge_legend',
    type:     'badge',
    name:     'Légende',
    emoji:    '👑',
    days:     100,
    desc:     '100 jours de connexion consécutifs',
    css:      null,
  },
  {
    id:       'badge_eternal',
    type:     'badge',
    name:     'Éternel',
    emoji:    '🌟',
    days:     200,
    desc:     '200 jours de connexion consécutifs',
    css:      null,
  },

  // ── Couleurs / dégradés pseudo ─────────────────────────
  {
    id:       'username_gold',
    type:     'username',
    name:     'Pseudo doré',
    emoji:    '✨',
    days:     7,
    desc:     '7 jours consécutifs',
    css:      'color:#f0c040;text-shadow:0 0 8px rgba(240,192,64,0.4)',
  },
  {
    id:       'username_gradient_red',
    type:     'username',
    name:     'Dégradé Flamme',
    emoji:    '🔴',
    days:     30,
    desc:     '30 jours consécutifs',
    css:      'background:linear-gradient(90deg,#ff6b35,#f7c59f,#ff3d00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700',
  },
  {
    id:       'username_gradient_purple',
    type:     'username',
    name:     'Dégradé Galactique',
    emoji:    '🟣',
    days:     60,
    desc:     '60 jours consécutifs',
    css:      'background:linear-gradient(90deg,#7b2ff7,#a855f7,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700',
  },
  {
    id:       'username_rainbow',
    type:     'username',
    name:     'Arc-en-ciel',
    emoji:    '🌈',
    days:     100,
    desc:     '100 jours consécutifs',
    css:      'background:linear-gradient(90deg,#ff0000,#ff8800,#ffff00,#00ff00,#0088ff,#8800ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;animation:rainbow-shift 3s linear infinite;background-size:200%',
  },
  {
    id:       'username_fire',
    type:     'username',
    name:     'Flammes',
    emoji:    '🔥',
    days:     200,
    desc:     '200 jours consécutifs',
    css:      'background:linear-gradient(180deg,#fff700,#ff8c00,#ff0000);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:900;animation:fire-flicker 1.5s ease-in-out infinite;text-shadow:0 0 10px rgba(255,100,0,0.6)',
  },

  // ── Effets avatar ──────────────────────────────────────
  {
    id:       'avatar_glow',
    type:     'avatar',
    name:     'Aura lumineuse',
    emoji:    '💫',
    days:     21,
    desc:     '21 jours consécutifs',
    css:      'box-shadow:0 0 12px 4px rgba(88,101,242,0.7)',
  },
  {
    id:       'avatar_particles',
    type:     'avatar',
    name:     'Particules',
    emoji:    '✨',
    days:     75,
    desc:     '75 jours consécutifs',
    css:      'animation:avatar-particles 2s ease-in-out infinite;box-shadow:0 0 0 2px rgba(255,215,0,0.8)',
  },
  {
    id:       'avatar_gold_aura',
    type:     'avatar',
    name:     'Aura dorée',
    emoji:    '🌟',
    days:     150,
    desc:     '150 jours consécutifs',
    css:      'box-shadow:0 0 20px 8px rgba(255,215,0,0.6),0 0 40px 16px rgba(255,165,0,0.3);animation:gold-pulse 2s ease-in-out infinite',
  },

  // ── Effets profil popup ────────────────────────────────
  {
    id:       'profile_confetti',
    type:     'profile_effect',
    name:     'Confettis',
    emoji:    '🎊',
    days:     50,
    desc:     '50 jours consécutifs — animation au clic sur le profil',
    css:      null,
  },
  {
    id:       'profile_fireworks',
    type:     'profile_effect',
    name:     'Feux d\'artifice',
    emoji:    '🎆',
    days:     100,
    desc:     '100 jours consécutifs',
    css:      null,
  },
];

// Map pour accès rapide par ID
const COSMETICS_MAP = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

/**
 * Retourne les cosmétiques débloqués pour un streak donné
 */
const getUnlockedByStreak = (streak) =>
  COSMETICS.filter(c => c.days <= streak);

/**
 * Retourne les cosmétiques nouvellement débloqués entre deux valeurs de streak
 */
const getNewlyUnlocked = (prevStreak, newStreak) =>
  COSMETICS.filter(c => c.days > prevStreak && c.days <= newStreak);

module.exports = { COSMETICS, COSMETICS_MAP, getUnlockedByStreak, getNewlyUnlocked };
