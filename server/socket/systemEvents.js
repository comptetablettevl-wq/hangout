const { SystemEvent, GuildSettings, Channel } = require('../models');

const SYSTEM_MESSAGES = {
  member_join:       (meta) => `👋 **${meta.username}** a rejoint le serveur`,
  member_leave:      (meta) => `👋 **${meta.username}** a quitté le serveur`,
  member_kick:       (meta) => `👢 **${meta.target}** a été expulsé par **${meta.actor}**`,
  member_ban:        (meta) => `🔨 **${meta.target}** a été banni par **${meta.actor}**${meta.reason ? ` — *${meta.reason}*` : ''}`,
  channel_created:   (meta) => `📢 Le channel **#${meta.name}** a été créé`,
  channel_deleted:   (meta) => `🗑️ Le channel **#${meta.name}** a été supprimé`,
  server_renamed:    (meta) => `✏️ Le serveur a été renommé en **${meta.name}**`,
  role_created:      (meta) => `🎭 Le rôle **${meta.name}** a été créé`,
};

// Cache settings en mémoire (TTL 30s) pour éviter une requête DB à chaque event
const settingsCache = new Map(); // guildId -> { settings, expiresAt }
const CACHE_TTL = 30_000;

const getSettings = async (guildId) => {
  const cached = settingsCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.settings;

  const settings = await GuildSettings.findOne({ where: { guild_id: guildId } });
  settingsCache.set(guildId, { settings, expiresAt: Date.now() + CACHE_TTL });
  return settings;
};

// Invalider le cache quand les settings changent
const invalidateSettingsCache = (guildId) => {
  settingsCache.delete(guildId);
};

const emitSystemEvent = async (io, guildId, type, actorId, targetId, meta = {}) => {
  try {
    // 1. Consulter les settings du serveur
    const settings = await getSettings(guildId);

    // Clés de config pour ce type d'event
    const enabledKey = `event_${type}_enabled`;
    const channelKey = `event_${type}_channel`;

    // Si les settings existent et que l'event est désactivé → stop
    if (settings && settings[enabledKey] === false) return;

    // 2. Déterminer le channel cible
    let targetChannelId = settings?.[channelKey] || null;

    if (!targetChannelId) {
      // Fallback : premier channel texte du serveur
      const firstChannel = await Channel.findOne({
        where: { guild_id: guildId, type: 'text' },
        order: [['position', 'ASC']],
      });
      if (!firstChannel) return;
      targetChannelId = firstChannel.id;
    }

    // 3. Vérifier que le channel existe toujours
    const channel = await Channel.findOne({
      where: { id: targetChannelId, guild_id: guildId },
    });
    if (!channel) return;

    // 4. Créer l'event en DB
    const event = await SystemEvent.create({
      channel_id: channel.id,
      guild_id:   guildId,
      type,
      actor_id:   actorId  || null,
      target_id:  targetId || null,
      meta,
    });

    // 5. Broadcaster
    const message = SYSTEM_MESSAGES[type]?.(meta) || type;

    io.to(`channel:${channel.id}`).emit('system:event', {
      id:         event.id,
      type,
      message,
      meta,
      channel_id: channel.id,
      created_at: event.created_at,
    });
  } catch (_) {}
};

module.exports = { emitSystemEvent, SYSTEM_MESSAGES, invalidateSettingsCache };
