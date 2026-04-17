const sequelize = require('../db');

const INDEXES = [
  // Messages
  { sql: 'CREATE INDEX idx_messages_channel_created ON Messages (channel_id, created_at)', name: 'idx_messages_channel_created', table: 'Messages' },
  { sql: 'CREATE INDEX idx_messages_guild ON Messages (guild_id)', name: 'idx_messages_guild', table: 'Messages' },
  { sql: 'CREATE INDEX idx_messages_author ON Messages (author_id)', name: 'idx_messages_author', table: 'Messages' },
  { sql: 'ALTER TABLE Messages ADD FULLTEXT INDEX ft_messages_content (content)', name: 'ft_messages_content', table: 'Messages' },

  // GuildMembers
  { sql: 'CREATE INDEX idx_guildmembers_user ON GuildMembers (user_id)', name: 'idx_guildmembers_user', table: 'GuildMembers' },
  { sql: 'CREATE INDEX idx_guildmembers_guild ON GuildMembers (guild_id)', name: 'idx_guildmembers_guild', table: 'GuildMembers' },

  // Reactions
  { sql: 'CREATE INDEX idx_reactions_message ON Reactions (message_id)', name: 'idx_reactions_message', table: 'Reactions' },
  { sql: 'CREATE INDEX idx_reactions_user_msg ON Reactions (user_id, message_id)', name: 'idx_reactions_user_msg', table: 'Reactions' },

  // DirectMessages
  { sql: 'CREATE INDEX idx_dm_participants ON DirectMessages (sender_id, receiver_id)', name: 'idx_dm_participants', table: 'DirectMessages' },
  { sql: 'CREATE INDEX idx_dm_created ON DirectMessages (created_at)', name: 'idx_dm_created', table: 'DirectMessages' },

  // FriendRequests
  { sql: 'CREATE INDEX idx_friends_sender ON FriendRequests (sender_id)', name: 'idx_friends_sender', table: 'FriendRequests' },
  { sql: 'CREATE INDEX idx_friends_receiver ON FriendRequests (receiver_id)', name: 'idx_friends_receiver', table: 'FriendRequests' },

  // PinnedMessages
  { sql: 'CREATE INDEX idx_pins_channel ON PinnedMessages (channel_id)', name: 'idx_pins_channel', table: 'PinnedMessages' },

  // Users
  { sql: 'CREATE INDEX idx_users_username ON Users (username)', name: 'idx_users_username', table: 'Users' },

  { sql: 'CREATE INDEX idx_categories_guild ON Categories (guild_id)', name: 'idx_categories_guild', table: 'Categories' },
  { sql: 'CREATE INDEX idx_channels_category ON Channels (category_id)', name: 'idx_channels_category', table: 'Channels' },
  { sql: 'CREATE INDEX idx_pwdreset_token ON PasswordResetTokens (token)', name: 'idx_pwdreset_token', table: 'PasswordResetTokens' },
  { sql: 'CREATE INDEX idx_pwdreset_user ON PasswordResetTokens (user_id)', name: 'idx_pwdreset_user', table: 'PasswordResetTokens' },
  // GuildSettings
  { sql: 'CREATE INDEX idx_guildsettings_guild ON GuildSettings (guild_id)', name: 'idx_guildsettings_guild', table: 'GuildSettings' },

  // Threads
  { sql: 'CREATE INDEX idx_threads_parent ON Threads (parent_id)', name: 'idx_threads_parent', table: 'Threads' },
  { sql: 'CREATE INDEX idx_threads_channel ON Threads (channel_id)', name: 'idx_threads_channel', table: 'Threads' },
  { sql: 'CREATE INDEX idx_threadmessages_thread ON ThreadMessages (thread_id)', name: 'idx_threadmessages_thread', table: 'ThreadMessages' },

  // MessageHistory
  { sql: 'CREATE INDEX idx_msghistory_message ON MessageHistories (message_id)', name: 'idx_msghistory_message', table: 'MessageHistories' },

  // SystemEvents
  { sql: 'CREATE INDEX idx_sysevents_channel ON SystemEvents (channel_id, created_at)', name: 'idx_sysevents_channel', table: 'SystemEvents' },
];

const applyIndexes = async () => {
  let ok = 0, skip = 0, fail = 0;

  for (const idx of INDEXES) {
    try {
      // Vérifier si l'index existe déjà avant de le créer
      const [rows] = await sequelize.query(
        `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS 
         WHERE table_schema = DATABASE() 
         AND table_name = :table 
         AND index_name = :name`,
        { replacements: { table: idx.table, name: idx.name } }
      );
      
      if (rows[0].cnt > 0) {
        skip++;
        continue;
      }

      await sequelize.query(idx.sql);
      ok++;
    } catch (err) {
      // Ignorer les erreurs de doublon silencieusement
      if (err.message?.includes('Duplicate key name') || err.message?.includes('already exists')) {
        skip++;
      } else {
        console.warn(`[Index] Warning: ${err.message?.slice(0, 80)}`);
        fail++;
      }
    }
  }

  console.log(`[Index] ${ok} créés, ${skip} existants, ${fail} échecs`);
};

module.exports = { applyIndexes };
