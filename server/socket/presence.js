const { User, GuildMember } = require('../models');
const { emitSystemEvent } = require('./systemEvents');

module.exports = (io, socket, onlineUsers) => {

  const broadcastPresence = async (status) => {
    try {
      const memberships = await GuildMember.findAll({
        where: { user_id: socket.user.id },
        attributes: ['guild_id'],
      });
      memberships.forEach(m => {
        io.to(`guild:${m.guild_id}`).emit('presence:update', {
          userId: socket.user.id,
          status,
        });
      });
    } catch (_) {}
  };

  socket.on('guilds:join', async () => {
    try {
      const memberships = await GuildMember.findAll({
        where: { user_id: socket.user.id },
        attributes: ['guild_id'],
      });
      memberships.forEach(m => socket.join(`guild:${m.guild_id}`));
    } catch (_) {}
  });

  socket.on('status:set', async (data) => {
    try {
      const { status } = data || {};
      if (!['online','idle','dnd'].includes(status)) return;
      await User.update({ status }, { where: { id: socket.user.id } });
      const entry = onlineUsers.get(socket.user.id) || {};
      onlineUsers.set(socket.user.id, { ...entry, status });
      broadcastPresence(status);
    } catch (_) {}
  });

  socket.on('disconnect', async () => {
    try {
      onlineUsers.delete(socket.user.id);
      await User.update({ status: 'offline' }, { where: { id: socket.user.id } });
      broadcastPresence('offline');
    } catch (_) {}
  });
};
