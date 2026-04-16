/**
 * Indexes MySQL pour les performances
 * Appelé une fois après sync via migrate.js
 */
const sequelize = require('../db');

const INDEXES = [
  // Messages — les plus importants (requêtes fréquentes)
  'CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON Messages (channel_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_messages_guild ON Messages (guild_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_author ON Messages (author_id)',
  'ALTER TABLE Messages ADD FULLTEXT INDEX IF NOT EXISTS ft_messages_content (content)',

  // GuildMembers
  'CREATE INDEX IF NOT EXISTS idx_guildmembers_user ON GuildMembers (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_guildmembers_guild ON GuildMembers (guild_id)',

  // Reactions
  'CREATE INDEX IF NOT EXISTS idx_reactions_message ON Reactions (message_id)',
  'CREATE INDEX IF NOT EXISTS idx_reactions_user_msg ON Reactions (user_id, message_id)',

  // DirectMessages
  'CREATE INDEX IF NOT EXISTS idx_dm_participants ON DirectMessages (sender_id, receiver_id)',
  'CREATE INDEX IF NOT EXISTS idx_dm_created ON DirectMessages (created_at DESC)',

  // FriendRequests
  'CREATE INDEX IF NOT EXISTS idx_friends_sender ON FriendRequests (sender_id)',
  'CREATE INDEX IF NOT EXISTS idx_friends_receiver ON FriendRequests (receiver_id)',

  // PinnedMessages
  'CREATE INDEX IF NOT EXISTS idx_pins_channel ON PinnedMessages (channel_id)',

  // GuildSettings
  'CREATE INDEX IF NOT EXISTS idx_guildsettings_guild ON GuildSettings (guild_id)',

  // Threads
  'CREATE INDEX IF NOT EXISTS idx_threads_parent ON Threads (parent_id)',
  'CREATE INDEX IF NOT EXISTS idx_threads_channel ON Threads (channel_id)',
  'CREATE INDEX IF NOT EXISTS idx_threadmessages_thread ON ThreadMessages (thread_id)',

  // MessageHistory
  'CREATE INDEX IF NOT EXISTS idx_msghistory_message ON MessageHistories (message_id)',

  // SystemEvents
  'CREATE INDEX IF NOT EXISTS idx_sysevents_channel ON SystemEvents (channel_id, created_at DESC)',

  // Users — recherche par username
  'CREATE INDEX IF NOT EXISTS idx_users_username ON Users (username)',
  'CREATE INDEX IF NOT EXISTS idx_users_email ON Users (email)',
];

const applyIndexes = async () => {
  let ok = 0, skip = 0, fail = 0;
  for (const sql of INDEXES) {
    try {
      await sequelize.query(sql);
      ok++;
    } catch (err) {
      // IF NOT EXISTS n'est pas supporté partout — ignorer les doublons
      if (err.message.includes('Duplicate') || err.message.includes('already exists')) {
        skip++;
      } else {
        console.warn('[Index] Warning:', err.message.slice(0, 80));
        fail++;
      }
    }
  }
  console.log(`[Index] ${ok} créés, ${skip} existants, ${fail} échecs`);
};

module.exports = { applyIndexes };
