const sequelize = require('../db');
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── User ──────────────────────────────────────────────────
const User = sequelize.define('User', {
  id:            { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  username:      { type: DataTypes.STRING(32), allowNull: false, unique: true },
  email:         { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password:      { type: DataTypes.STRING(255), allowNull: false },
  avatar:        { type: DataTypes.STRING(500), defaultValue: null },
  status:        { type: DataTypes.ENUM('online','idle','dnd','offline'), defaultValue: 'offline' },
  custom_status: { type: DataTypes.STRING(128), defaultValue: '' },
}, {
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) user.password = await bcrypt.hash(user.password, 12);
    },
  },
});
User.prototype.comparePassword = function(p) { return bcrypt.compare(p, this.password); };
User.prototype.toPublic = function() {
  return { id: this.id, username: this.username, avatar: this.avatar, status: this.status, custom_status: this.custom_status };
};

// ── Guild ─────────────────────────────────────────────────
const Guild = sequelize.define('Guild', {
  id:          { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  name:        { type: DataTypes.STRING(64), allowNull: false },
  icon:        { type: DataTypes.STRING(500), defaultValue: null },
  banner:      { type: DataTypes.STRING(500), defaultValue: null },
  description: { type: DataTypes.STRING(256), defaultValue: null },
  invite_code: { type: DataTypes.STRING(16), defaultValue: () => uuidv4().slice(0,8), unique: true },
  owner_id:    { type: DataTypes.UUID, allowNull: false },
});

// ── GuildMember ──────────────────────────────────────────
const GuildMember = sequelize.define('GuildMember', {
  id:       { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id: { type: DataTypes.UUID, allowNull: false },
  user_id:  { type: DataTypes.UUID, allowNull: false },
  role:     { type: DataTypes.ENUM('owner','admin','moderator','member'), defaultValue: 'member' },
  nickname: { type: DataTypes.STRING(32), defaultValue: null },
});

// ── Role (rôles customs) ──────────────────────────────────
const Role = sequelize.define('Role', {
  id:                  { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id:            { type: DataTypes.UUID, allowNull: false },
  name:                { type: DataTypes.STRING(32), allowNull: false },
  color:               { type: DataTypes.STRING(7), defaultValue: '#99aab5' },
  position:            { type: DataTypes.INTEGER, defaultValue: 0 },
  can_manage_channels: { type: DataTypes.BOOLEAN, defaultValue: false },
  can_manage_roles:    { type: DataTypes.BOOLEAN, defaultValue: false },
  can_kick:            { type: DataTypes.BOOLEAN, defaultValue: false },
  can_ban:             { type: DataTypes.BOOLEAN, defaultValue: false },
  can_manage_messages:   { type: DataTypes.BOOLEAN, defaultValue: false },
  can_send_messages:     { type: DataTypes.BOOLEAN, defaultValue: true },
  can_read_history:      { type: DataTypes.BOOLEAN, defaultValue: true },
  can_add_reactions:     { type: DataTypes.BOOLEAN, defaultValue: true },
  can_mention_everyone:  { type: DataTypes.BOOLEAN, defaultValue: false },
  can_manage_guild:      { type: DataTypes.BOOLEAN, defaultValue: false },
  is_default:            { type: DataTypes.BOOLEAN, defaultValue: false },
});

// ── MemberRole ────────────────────────────────────────────
const MemberRole = sequelize.define('MemberRole', {
  id:        { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  member_id: { type: DataTypes.UUID, allowNull: false },
  role_id:   { type: DataTypes.UUID, allowNull: false },
});

// ── Ban ───────────────────────────────────────────────────
const Ban = sequelize.define('Ban', {
  id:        { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id:  { type: DataTypes.UUID, allowNull: false },
  user_id:   { type: DataTypes.UUID, allowNull: false },
  banned_by: { type: DataTypes.UUID, allowNull: false },
  reason:    { type: DataTypes.STRING(512), defaultValue: null },
});

// ── FriendRequest ─────────────────────────────────────────
const FriendRequest = sequelize.define('FriendRequest', {
  id:          { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  sender_id:   { type: DataTypes.UUID, allowNull: false },
  receiver_id: { type: DataTypes.UUID, allowNull: false },
  status:      { type: DataTypes.ENUM('pending','accepted','declined'), defaultValue: 'pending' },
});


// ── Category (catégories de channels) ────────────────────
const Category = sequelize.define('Category', {
  id:       { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id: { type: DataTypes.UUID, allowNull: false },
  name:     { type: DataTypes.STRING(32), allowNull: false },
  position: { type: DataTypes.INTEGER, defaultValue: 0 },
  collapsed:{ type: DataTypes.BOOLEAN, defaultValue: false },
});

// ── Channel ───────────────────────────────────────────────
const Channel = sequelize.define('Channel', {
  id:       { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id: { type: DataTypes.UUID, allowNull: false },
  name:     { type: DataTypes.STRING(32), allowNull: false },
  type:     { type: DataTypes.ENUM('text','voice'), defaultValue: 'text' },
  position:    { type: DataTypes.INTEGER, defaultValue: 0 },
  category_id: { type: DataTypes.UUID, defaultValue: null },
});

// ── Message ───────────────────────────────────────────────
const Message = sequelize.define('Message', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  channel_id: { type: DataTypes.UUID, allowNull: false },
  guild_id:   { type: DataTypes.UUID, allowNull: false },
  author_id:  { type: DataTypes.UUID, allowNull: false },
  content:    { type: DataTypes.TEXT, allowNull: false },
  edited:     { type: DataTypes.BOOLEAN, defaultValue: false },
  edited_at:  { type: DataTypes.DATE, defaultValue: null },
  reply_to:   { type: DataTypes.UUID, defaultValue: null },
});

// ── Reaction ──────────────────────────────────────────────
const Reaction = sequelize.define('Reaction', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  message_id: { type: DataTypes.UUID, allowNull: false },
  user_id:    { type: DataTypes.UUID, allowNull: false },
  emoji:      { type: DataTypes.STRING(16), allowNull: false },
});

// ── DirectMessage ─────────────────────────────────────────
const DirectMessage = sequelize.define('DirectMessage', {
  id:          { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  sender_id:   { type: DataTypes.UUID, allowNull: false },
  receiver_id: { type: DataTypes.UUID, allowNull: false },
  content:     { type: DataTypes.TEXT, allowNull: false },
  read:        { type: DataTypes.BOOLEAN, defaultValue: false },
  edited:      { type: DataTypes.BOOLEAN, defaultValue: false },
  edited_at:   { type: DataTypes.DATE, defaultValue: null },
});

// ── Attachment ────────────────────────────────────────────
const Attachment = sequelize.define('Attachment', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  message_id: { type: DataTypes.UUID, allowNull: true },
  dm_id:      { type: DataTypes.UUID, allowNull: true },
  url:        { type: DataTypes.STRING(500), allowNull: false },
  name:       { type: DataTypes.STRING(255) },
  mime_type:  { type: DataTypes.STRING(100) },
  size:       { type: DataTypes.INTEGER },
});

// ── PinnedMessage ─────────────────────────────────────────
const PinnedMessage = sequelize.define('PinnedMessage', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  channel_id: { type: DataTypes.UUID, allowNull: false },
  guild_id:   { type: DataTypes.UUID, allowNull: false },
  message_id: { type: DataTypes.UUID, allowNull: false },
  pinned_by:  { type: DataTypes.UUID, allowNull: false },
});


// ── Thread ────────────────────────────────────────────────
const Thread = sequelize.define('Thread', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  channel_id: { type: DataTypes.UUID, allowNull: false },
  guild_id:   { type: DataTypes.UUID, allowNull: false },
  parent_id:  { type: DataTypes.UUID, allowNull: false }, // message parent
  name:       { type: DataTypes.STRING(100), allowNull: false },
  author_id:  { type: DataTypes.UUID, allowNull: false },
  archived:   { type: DataTypes.BOOLEAN, defaultValue: false },
  message_count: { type: DataTypes.INTEGER, defaultValue: 0 },
});

// ── ThreadMessage ─────────────────────────────────────────
const ThreadMessage = sequelize.define('ThreadMessage', {
  id:        { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  thread_id: { type: DataTypes.UUID, allowNull: false },
  author_id: { type: DataTypes.UUID, allowNull: false },
  content:   { type: DataTypes.TEXT, allowNull: false },
  edited:    { type: DataTypes.BOOLEAN, defaultValue: false },
  edited_at: { type: DataTypes.DATE, defaultValue: null },
});

// ── MessageHistory ────────────────────────────────────────
const MessageHistory = sequelize.define('MessageHistory', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  message_id: { type: DataTypes.UUID, allowNull: false },
  content:    { type: DataTypes.TEXT, allowNull: false },
  edited_at:  { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// ── SystemEvent (messages système dans le chat) ───────────
const SystemEvent = sequelize.define('SystemEvent', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  channel_id: { type: DataTypes.UUID, allowNull: false },
  guild_id:   { type: DataTypes.UUID, allowNull: false },
  type:       { type: DataTypes.ENUM(
    'member_join', 'member_leave', 'member_kick', 'member_ban',
    'channel_created', 'channel_deleted', 'server_renamed', 'role_created'
  ), allowNull: false },
  actor_id:   { type: DataTypes.UUID, defaultValue: null },  // qui a fait l'action
  target_id:  { type: DataTypes.UUID, defaultValue: null },  // sur qui
  meta:       { type: DataTypes.JSON, defaultValue: {} },    // données supplémentaires
});


// ── GuildSettings ─────────────────────────────────────────
// Un enregistrement par serveur, créé automatiquement à la création du serveur
const GuildSettings = sequelize.define('GuildSettings', {
  id:       { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  guild_id: { type: DataTypes.UUID, allowNull: false, unique: true },

  // Pour chaque type d'événement :
  //   event_<type>_enabled  : boolean (activer/désactiver)
  //   event_<type>_channel  : UUID du channel cible (null = 1er channel texte)

  event_member_join_enabled:     { type: DataTypes.BOOLEAN, defaultValue: true },
  event_member_join_channel:     { type: DataTypes.UUID, defaultValue: null },

  event_member_leave_enabled:    { type: DataTypes.BOOLEAN, defaultValue: true },
  event_member_leave_channel:    { type: DataTypes.UUID, defaultValue: null },

  event_member_kick_enabled:     { type: DataTypes.BOOLEAN, defaultValue: true },
  event_member_kick_channel:     { type: DataTypes.UUID, defaultValue: null },

  event_member_ban_enabled:      { type: DataTypes.BOOLEAN, defaultValue: true },
  event_member_ban_channel:      { type: DataTypes.UUID, defaultValue: null },

  event_channel_created_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  event_channel_created_channel: { type: DataTypes.UUID, defaultValue: null },

  event_channel_deleted_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  event_channel_deleted_channel: { type: DataTypes.UUID, defaultValue: null },

  event_server_renamed_enabled:  { type: DataTypes.BOOLEAN, defaultValue: false },
  event_server_renamed_channel:  { type: DataTypes.UUID, defaultValue: null },

  event_role_created_enabled:    { type: DataTypes.BOOLEAN, defaultValue: false },
  event_role_created_channel:    { type: DataTypes.UUID, defaultValue: null },
});


// ── PasswordResetToken ────────────────────────────────────
const PasswordResetToken = sequelize.define('PasswordResetToken', {
  id:         { type: DataTypes.UUID, defaultValue: () => uuidv4(), primaryKey: true },
  user_id:    { type: DataTypes.UUID, allowNull: false },
  token:      { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  used:       { type: DataTypes.BOOLEAN, defaultValue: false },
});

// ── Associations ──────────────────────────────────────────
Guild.hasMany(GuildMember, { foreignKey: 'guild_id', as: 'members' });
GuildMember.belongsTo(Guild, { foreignKey: 'guild_id' });
GuildMember.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(GuildMember, { foreignKey: 'user_id' });

Guild.hasMany(Role, { foreignKey: 'guild_id', as: 'roles', onDelete: 'CASCADE' });
Role.belongsTo(Guild, { foreignKey: 'guild_id' });
GuildMember.hasMany(MemberRole, { foreignKey: 'member_id', as: 'memberRoles', onDelete: 'CASCADE' });
MemberRole.belongsTo(GuildMember, { foreignKey: 'member_id' });
MemberRole.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

Guild.hasMany(Ban, { foreignKey: 'guild_id', as: 'bans', onDelete: 'CASCADE' });
Ban.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Ban.belongsTo(User, { foreignKey: 'banned_by', as: 'bannedBy' });

FriendRequest.belongsTo(User, { foreignKey: 'sender_id',   as: 'sender' });
FriendRequest.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });

Category.belongsTo(Guild, { foreignKey: 'guild_id' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id' });
Guild.hasMany(Category, { foreignKey: 'guild_id', as: 'categories', onDelete: 'CASCADE' });
Category.hasMany(Channel, { foreignKey: 'category_id', as: 'channels' });
Channel.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

Guild.hasMany(Channel, { foreignKey: 'guild_id', as: 'channels', onDelete: 'CASCADE' });
Channel.belongsTo(Guild, { foreignKey: 'guild_id' });

Channel.hasMany(Message, { foreignKey: 'channel_id', as: 'messages', onDelete: 'CASCADE' });
Message.belongsTo(Channel, { foreignKey: 'channel_id' });
Message.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Message.hasMany(Reaction, { foreignKey: 'message_id', as: 'reactions', onDelete: 'CASCADE' });
Message.belongsTo(Message, { foreignKey: 'reply_to', as: 'replyMessage' });
Message.hasMany(Attachment, { foreignKey: 'message_id', as: 'attachments', onDelete: 'CASCADE' });

Reaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Reaction.belongsTo(Message, { foreignKey: 'message_id' });

DirectMessage.belongsTo(User, { foreignKey: 'sender_id',   as: 'sender' });
DirectMessage.belongsTo(User, { foreignKey: 'receiver_id', as: 'receiver' });
DirectMessage.hasMany(Attachment, { foreignKey: 'dm_id', as: 'attachments', onDelete: 'CASCADE' });

PinnedMessage.belongsTo(Message, { foreignKey: 'message_id', as: 'message' });
PinnedMessage.belongsTo(User, { foreignKey: 'pinned_by', as: 'pinnedBy' });

Guild.hasOne(GuildSettings, { foreignKey: 'guild_id', as: 'settings', onDelete: 'CASCADE' });
GuildSettings.belongsTo(Guild, { foreignKey: 'guild_id' });

Thread.belongsTo(Message, { foreignKey: 'parent_id', as: 'parentMessage' });
Thread.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Thread.hasMany(ThreadMessage, { foreignKey: 'thread_id', as: 'messages', onDelete: 'CASCADE' });
ThreadMessage.belongsTo(Thread, { foreignKey: 'thread_id' });
ThreadMessage.belongsTo(User, { foreignKey: 'author_id', as: 'author' });
Message.hasOne(Thread, { foreignKey: 'parent_id', as: 'thread' });

MessageHistory.belongsTo(Message, { foreignKey: 'message_id' });

SystemEvent.belongsTo(User, { foreignKey: 'actor_id',  as: 'actor'  });
SystemEvent.belongsTo(User, { foreignKey: 'target_id', as: 'target' });

module.exports = {
  sequelize, User, Guild, GuildMember, Role, MemberRole,
  Ban, FriendRequest, Channel, Message, Reaction, DirectMessage, Attachment, PinnedMessage,
  Thread, ThreadMessage, MessageHistory, SystemEvent, GuildSettings, Category, PasswordResetToken
};
