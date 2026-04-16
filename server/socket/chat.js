const { Message, Reaction, User, GuildMember, Attachment, MessageHistory } = require('../models');
const { sanitize } = require('../middleware/sanitize');
const { checkSocketRate } = require('../middleware/socketRateLimit');
const { hasPermission, invalidatePermCache } = require('../middleware/permissions');

const msgInclude = [
  { model: User,       as: 'author',      attributes: ['id','username','avatar'] },
  { model: Reaction,   as: 'reactions',   include: [{ model: User, as: 'user', attributes: ['id'] }] },
  { model: Attachment, as: 'attachments' },
  { model: Message,    as: 'replyMessage', include: [{ model: User, as: 'author', attributes: ['id','username'] }] },
];

module.exports = (io, socket) => {

  socket.on('channel:join', (data) => {
    try {
      const { guildId, channelId } = data || {};
      if (!channelId || typeof channelId !== 'string') return;
      if (socket.currentChannel) socket.leave(`channel:${socket.currentChannel}`);
      socket.currentChannel = channelId;
      socket.currentGuild   = guildId;
      socket.join(`channel:${channelId}`);
    } catch (_) {}
  });

  socket.on('message:send', async (data) => {
    try {
      const { guildId, channelId, content, reply_to } = data || {};
      if (checkSocketRate(socket, 'msg_send', 5, 1000)) return;
      if (!content || typeof content !== 'string' || !guildId || !channelId) return;

      // ── Vérification permissions ──────────────────────
      const canSend = await hasPermission(guildId, socket.user.id, 'can_send_messages');
      if (!canSend) {
        socket.emit('error', { message: 'Tu n\'as pas la permission d\'envoyer des messages', code: 'NO_PERMISSION' });
        return;
      }

      const clean = sanitize(content.trim());
      if (!clean || clean.length > 2000) return;

      // Anti-spoofing : vérifier que le socket est bien dans ce channel/guild
      if (socket.currentGuild !== guildId || socket.currentChannel !== channelId) return;

      // Vérifier @everyone
      if (clean.includes('@everyone') || clean.includes('@here')) {
        const canMention = await hasPermission(guildId, socket.user.id, 'can_mention_everyone');
        if (!canMention) {
          // Neutraliser la mention
          const sanitizedContent = clean.replace(/@(everyone|here)/g, '@\u200beveryone');
          return handleSend(io, socket, guildId, channelId, sanitizedContent, reply_to);
        }
      }

      await handleSend(io, socket, guildId, channelId, clean, reply_to);
    } catch (err) {
      socket.emit('error', { message: 'Erreur envoi', code: 'SEND_FAILED' });
    }
  });

  socket.on('message:edit', async (data) => {
    try {
      const { messageId, content } = data || {};
      if (checkSocketRate(socket, 'msg_edit', 10, 5000)) return;
      if (!messageId || !content || typeof content !== 'string') return;
      const clean = sanitize(content.trim());
      if (!clean || clean.length > 2000) return;

      const msg = await Message.findByPk(messageId);
      if (!msg || msg.author_id !== socket.user.id) return;

      await MessageHistory.create({ message_id: msg.id, content: msg.content, edited_at: new Date() });
      await msg.update({ content: clean, edited: true, edited_at: new Date() });

      io.to(`channel:${msg.channel_id}`).emit('message:edited', {
        id: msg.id, content: msg.content, edited: true, edited_at: msg.edited_at,
      });
    } catch (_) {}
  });

  socket.on('message:delete', async (data) => {
    try {
      const { messageId, guildId } = data || {};
      if (!messageId || !guildId) return;

      const msg = await Message.findByPk(messageId);
      if (!msg || msg.guild_id !== guildId) return;

      const isAuthor = msg.author_id === socket.user.id;
      const canManage = await hasPermission(guildId, socket.user.id, 'can_manage_messages');
      if (!isAuthor && !canManage) return;

      const channelId = msg.channel_id;
      await msg.destroy();
      io.to(`channel:${channelId}`).emit('message:deleted', { id: messageId });
    } catch (_) {}
  });

  socket.on('message:react', async (data) => {
    try {
      const { messageId, emoji } = data || {};
      if (checkSocketRate(socket, 'react', 20, 10000)) return;
      if (!messageId || !emoji || typeof emoji !== 'string') return;

      const msg = await Message.findByPk(messageId);
      if (!msg) return;

      // Vérifier permission réactions
      const canReact = await hasPermission(msg.guild_id, socket.user.id, 'can_add_reactions');
      if (!canReact) {
        socket.emit('error', { message: 'Tu n\'as pas la permission de réagir', code: 'NO_PERMISSION' });
        return;
      }

      const cleanEmoji = emoji.replace(/[<>"'&]/g, '').slice(0, 8);
      if (!cleanEmoji) return;

      const existing = await Reaction.findOne({
        where: { message_id: messageId, user_id: socket.user.id, emoji: cleanEmoji },
      });

      if (existing) {
        await existing.destroy();
      } else {
        const count = await Reaction.count({ where: { message_id: messageId }, distinct: true, col: 'emoji' });
        if (count >= 20) return;
        await Reaction.create({ message_id: messageId, user_id: socket.user.id, emoji: cleanEmoji });
      }

      const reactions = await Reaction.findAll({
        where: { message_id: messageId },
        include: [{ model: User, as: 'user', attributes: ['id'] }],
      });
      io.to(`channel:${msg.channel_id}`).emit('message:reaction', { messageId, reactions });
    } catch (_) {}
  });

  socket.on('typing:start', (data) => {
    try {
      const { channelId } = data || {};
      if (!channelId) return;
      if (checkSocketRate(socket, 'typing', 3, 2000)) return;
      socket.to(`channel:${channelId}`).emit('typing:update', {
        userId: socket.user.id, username: socket.user.username, typing: true,
      });
    } catch (_) {}
  });

  socket.on('typing:stop', (data) => {
    try {
      const { channelId } = data || {};
      if (!channelId) return;
      socket.to(`channel:${channelId}`).emit('typing:update', {
        userId: socket.user.id, username: socket.user.username, typing: false,
      });
    } catch (_) {}
  });
};

async function handleSend(io, socket, guildId, channelId, clean, reply_to) {
  const validReplyTo = reply_to && typeof reply_to === 'string' && reply_to.length === 36 ? reply_to : null;
  const msg = await Message.create({
    channel_id: channelId, guild_id: guildId,
    author_id: socket.user.id, content: clean, reply_to: validReplyTo,
  });
  const populated = await Message.findByPk(msg.id, { include: msgInclude });
  io.to(`channel:${channelId}`).emit('message:new', populated);
  io.to(`guild:${guildId}`).except(`channel:${channelId}`).emit('message:notify', {
    guildId, channelId, author: socket.user.username, content: clean.slice(0, 80),
  });
}
