/**
 * Indexes MySQL — noms de tables en PascalCase pluriel (comportement Sequelize par défaut)
 * Sequelize pluralise le nom du modèle : User→Users, GuildMember→GuildMembers, etc.
 */
const sequelize = require('../db');

const INDEXES = [
  // Messages
  'CREATE INDEX IF NOT EXISTS idx_messages_channel ON Messages (channel_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_messages_guild ON Messages (guild_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_author ON Messages (author_id)',

  // GuildMembers
  'CREATE INDEX IF NOT EXISTS idx_guildmembers_user ON GuildMembers (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_guildmembers_guild ON GuildMembers (guild_id)',

  // Reactions
  'CREATE INDEX IF NOT EXISTS idx_reactions_message ON Reactions (message_id)',
  'CREATE INDEX IF NOT EXISTS idx_reactions_user ON Reactions (user_id, message_id)',

  // DirectMessages
  'CREATE INDEX IF NOT EXISTS idx_dm_participants ON DirectMessages (sender_id, receiver_id)',
  'CREATE INDEX IF NOT EXISTS idx_dm_created ON DirectMessages (created_at DESC)',

  // FriendRequests
  'CREATE INDEX IF NOT EXISTS idx_friends_sender ON FriendRequests (sender_id)',
  'CREATE INDEX IF NOT EXISTS idx_friends_receiver ON FriendRequests (receiver_id)',

  // PinnedMessages
  'CREATE INDEX IF NOT EXISTS idx_pins_channel ON PinnedMessages (channel_id)',

  // Users
  'CREATE INDEX IF NOT EXISTS idx_users_username ON Users (username)',
  'CREATE INDEX IF NOT EXISTS idx_users_email ON Users (email)',

  // Categories & Channels
  'CREATE INDEX IF NOT EXISTS idx_categories_guild ON Categories (guild_id, position)',
  'CREATE INDEX IF NOT EXISTS idx_channels_category ON Channels (category_id)',

  // PasswordResetTokens
  'CREATE INDEX IF NOT EXISTS idx_pwdreset_user ON PasswordResetTokens (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_pwdreset_token ON PasswordResetTokens (token)',



  // UserStreaks & UnlockedCosmetics
  'CREATE INDEX IF NOT EXISTS idx_userstreaks_user ON UserStreaks (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_unlockedcosmetics_user ON UnlockedCosmetics (user_id)',
  'CREATE INDEX IF NOT EXISTS idx_unlockedcosmetics_pair ON UnlockedCosmetics (user_id, cosmetic_id)',

  // FriendNicknames
  'CREATE INDEX IF NOT EXISTS idx_friendnicknames_owner ON FriendNicknames (owner_id)',
  'CREATE INDEX IF NOT EXISTS idx_friendnicknames_pair ON FriendNicknames (owner_id, target_id)',

  // GuildSettings
  'CREATE INDEX IF NOT EXISTS idx_guildsettings_guild ON GuildSettings (guild_id)',

  // Threads
  'CREATE INDEX IF NOT EXISTS idx_threads_parent ON Threads (parent_id)',
  'CREATE INDEX IF NOT EXISTS idx_threads_channel ON Threads (channel_id)',
  'CREATE INDEX IF NOT EXISTS idx_threadmsgs_thread ON ThreadMessages (thread_id)',

  // MessageHistories
  'CREATE INDEX IF NOT EXISTS idx_msghistory_msg ON MessageHistories (message_id)',

  // SystemEvents
  'CREATE INDEX IF NOT EXISTS idx_sysevents_channel ON SystemEvents (channel_id, created_at DESC)',
];

const applyIndexes = async () => {
  // Récupérer les vraies tables existantes pour skipper silencieusement celles manquantes
  let existingTables = new Set();
  try {
    const [rows] = await sequelize.query('SHOW TABLES');
    rows.forEach(r => existingTables.add(Object.values(r)[0]));
  } catch (_) {}

  let ok = 0, skip = 0, fail = 0;

  for (const sql of INDEXES) {
    const match = sql.match(/ON (\w+) \(/i);
    const tableName = match?.[1];

    if (tableName && existingTables.size > 0 && !existingTables.has(tableName)) {
      skip++;
      continue;
    }

    try {
      await sequelize.query(sql);
      ok++;
    } catch (err) {
      if (err.message.includes('Duplicate') || err.message.includes('already exists')) {
        skip++;
      } else {
        console.warn('[Index] Warning:', err.message.slice(0, 100));
        fail++;
      }
    }
  }

  console.log(`[Index] ${ok} créés, ${skip} skippés, ${fail} échecs`);
};

module.exports = { applyIndexes };
