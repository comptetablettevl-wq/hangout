const { DirectMessage, User } = require('../models');
const { sanitize } = require('../middleware/sanitize');
const { checkSocketRate } = require('../middleware/socketRateLimit');
const { emitToUser } = require('./socketUtils');

module.exports = (io, socket, onlineUsers) => {

  socket.on('dm:send', async (data) => {
    try {
      const { receiverId, content } = data || {};
      if (checkSocketRate(socket, 'dm_send', 5, 1000)) return;
      if (!receiverId || !content || typeof content !== 'string') return;
      if (receiverId === socket.user.id) return;
      const clean = sanitize(content.trim());
      if (!clean || clean.length > 2000) return;

      const receiver = await User.findByPk(receiverId, { attributes: ['id','username','avatar','status'] });
      if (!receiver) return;

      const msg = await DirectMessage.create({
        sender_id: socket.user.id, receiver_id: receiverId, content: clean,
      });

      const populated = await DirectMessage.findByPk(msg.id, {
        include: [
          { model: User, as: 'sender',   attributes: ['id','username','avatar'] },
          { model: User, as: 'receiver', attributes: ['id','username','avatar'] },
        ],
      });

      socket.emit('dm:new', populated);
      emitToUser(io, onlineUsers, receiverId, 'dm:new', populated);
      emitToUser(io, onlineUsers, receiverId, 'dm:notify', {
        senderId: socket.user.id,
        username: socket.user.username,
        content:  clean.slice(0, 80),
      });
    } catch (_) {}
  });

  socket.on('dm:edit', async (data) => {
    try {
      const { messageId, content } = data || {};
      if (!messageId || !content) return;
      const clean = sanitize(String(content).trim());
      if (!clean || clean.length > 2000) return;

      const msg = await DirectMessage.findByPk(messageId);
      if (!msg || msg.sender_id !== socket.user.id) return;

      await msg.update({ content: clean, edited: true, edited_at: new Date() });
      const update = { id: msg.id, content: msg.content, edited: true };
      socket.emit('dm:edited', update);
      emitToUser(io, onlineUsers, msg.receiver_id, 'dm:edited', update);
    } catch (_) {}
  });

  socket.on('dm:delete', async (data) => {
    try {
      const { messageId } = data || {};
      if (!messageId) return;
      const msg = await DirectMessage.findByPk(messageId);
      if (!msg || msg.sender_id !== socket.user.id) return;
      const receiverId = msg.receiver_id;
      await msg.destroy();
      socket.emit('dm:deleted', { id: messageId });
      emitToUser(io, onlineUsers, receiverId, 'dm:deleted', { id: messageId });
    } catch (_) {}
  });

  socket.on('dm:typing', (data) => {
    try {
      const { receiverId, typing } = data || {};
      if (!receiverId || typeof typing !== 'boolean') return;
      if (checkSocketRate(socket, 'dm_typing', 3, 2000)) return;
      emitToUser(io, onlineUsers, receiverId, 'dm:typing', {
        senderId: socket.user.id, username: socket.user.username, typing,
      });
    } catch (_) {}
  });
};
