const { FriendRequest, User } = require('../models');
const { emitToUser } = require('./socketUtils');

module.exports = (io, socket, onlineUsers) => {

  socket.on('friend:request', async (data) => {
    try {
      const { receiverId } = data || {};
      if (!receiverId) return;
      const fr = await FriendRequest.findOne({
        where: { sender_id: socket.user.id, receiver_id: receiverId, status: 'pending' },
        include: [
          { model: User, as: 'sender',   attributes: ['id','username','avatar','status'] },
          { model: User, as: 'receiver', attributes: ['id','username','avatar','status'] },
        ],
        order: [['created_at', 'DESC']],
      });
      if (fr) emitToUser(io, onlineUsers, receiverId, 'friend:request_received', fr);
    } catch (_) {}
  });

  socket.on('friend:accepted', (data) => {
    try {
      const { senderId } = data || {};
      if (!senderId) return;
      emitToUser(io, onlineUsers, senderId, 'friend:accepted', {
        userId:   socket.user.id,
        username: socket.user.username,
        avatar:   socket.user.avatar,
      });
    } catch (_) {}
  });
};
