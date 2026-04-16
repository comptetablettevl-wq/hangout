/**
 * Système de vérification des permissions basé sur les rôles customs.
 * Hiérarchie : owner > admin > moderator > member (rôle système)
 * + rôles customs avec permissions granulaires
 *
 * Cache en mémoire (30s) pour éviter une requête DB par event socket.
 */
const { GuildMember, MemberRole, Role } = require('../models');

// Cache : `${guildId}:${userId}` -> { permissions, expiresAt }
const permCache = new Map();
const TTL = 30_000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of permCache) {
    if (v.expiresAt < now) permCache.delete(k);
  }
}, 60_000);

/**
 * Résout les permissions effectives d'un user dans un guild.
 * Owner et admin système ont toutes les permissions.
 * Les rôles customs s'accumulent (union des permissions).
 */
const resolvePermissions = async (guildId, userId) => {
  const cacheKey = `${guildId}:${userId}`;
  const cached = permCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.perms;

  const member = await GuildMember.findOne({
    where: { guild_id: guildId, user_id: userId },
    include: [{
      model: MemberRole, as: 'memberRoles',
      include: [{ model: Role, as: 'role' }],
    }],
  });

  if (!member) {
    permCache.set(cacheKey, { perms: null, expiresAt: Date.now() + TTL });
    return null; // pas membre
  }

  // Owner et admin système : toutes les permissions
  if (['owner', 'admin'].includes(member.role)) {
    const allPerms = {
      is_admin: true,
      can_send_messages: true, can_read_history: true, can_add_reactions: true,
      can_mention_everyone: true, can_manage_messages: true, can_kick: true,
      can_ban: true, can_manage_channels: true, can_manage_roles: true,
      can_manage_guild: true,
    };
    permCache.set(cacheKey, { perms: allPerms, expiresAt: Date.now() + TTL });
    return allPerms;
  }

  // Moderator : kick + manage_messages par défaut
  const base = {
    is_admin: false,
    can_send_messages: true,
    can_read_history: true,
    can_add_reactions: true,
    can_mention_everyone: false,
    can_manage_messages: member.role === 'moderator',
    can_kick: member.role === 'moderator',
    can_ban: false,
    can_manage_channels: false,
    can_manage_roles: false,
    can_manage_guild: false,
  };

  // Fusionner les rôles customs (union des permissions activées)
  for (const mr of (member.memberRoles || [])) {
    const role = mr.role;
    if (!role) continue;
    const PERM_KEYS = [
      'can_send_messages', 'can_read_history', 'can_add_reactions',
      'can_mention_everyone', 'can_manage_messages', 'can_kick', 'can_ban',
      'can_manage_channels', 'can_manage_roles', 'can_manage_guild',
    ];
    PERM_KEYS.forEach(k => {
      if (role[k] === true) base[k] = true;
    });
  }

  permCache.set(cacheKey, { perms: base, expiresAt: Date.now() + TTL });
  return base;
};

/**
 * Vérifie une permission spécifique. Retourne true/false.
 */
const hasPermission = async (guildId, userId, permission) => {
  const perms = await resolvePermissions(guildId, userId);
  if (!perms) return false;
  return perms[permission] === true;
};

/**
 * Invalide le cache pour un user (après changement de rôle).
 */
const invalidatePermCache = (guildId, userId) => {
  permCache.delete(`${guildId}:${userId}`);
};

/**
 * Middleware Express : vérifie une permission sur le serveur.
 * Utiliser avec mergeParams: true sur le router.
 * req.params.id ou req.params.guildId doit contenir le guildId.
 */
const requirePermission = (permission) => async (req, res, next) => {
  try {
    const guildId = req.params.id || req.params.guildId;
    const ok = await hasPermission(guildId, req.user.id, permission);
    if (!ok) return res.status(403).json({ error: 'Permissions insuffisantes' });
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { resolvePermissions, hasPermission, invalidatePermCache, requirePermission };
