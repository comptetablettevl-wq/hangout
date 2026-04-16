const { GuildMember } = require('../models');

const voiceRooms = new Map(); // channelId -> Set<socketId>

module.exports = (io, socket) => {

  socket.on('voice:join', async ({ channelId, guildId }) => {
    try {
      // Vérifier appartenance au guild
      const member = await GuildMember.findOne({ where: { guild_id: guildId, user_id: socket.user.id } });
      if (!member) return socket.emit('error', { message: 'Accès refusé au vocal' });

      if (socket.voiceChannel) leaveVoice(io, socket);

      socket.voiceChannel = channelId;
      socket.voiceGuild   = guildId;
      socket.join(`voice:${channelId}`);

      if (!voiceRooms.has(channelId)) voiceRooms.set(channelId, new Set());
      voiceRooms.get(channelId).add(socket.id);

      socket.to(`voice:${channelId}`).emit('voice:user_joined', {
        userId: socket.user.id, username: socket.user.username, socketId: socket.id,
      });

      const peers = [];
      voiceRooms.get(channelId).forEach(sid => {
        if (sid === socket.id) return;
        const s = io.sockets.sockets.get(sid);
        if (s) peers.push({ socketId: sid, userId: s.user.id, username: s.user.username });
      });
      socket.emit('voice:peers', { peers });

      broadcastVoiceUpdate(io, guildId, channelId);
    } catch (err) { socket.emit('error', { message: err.message }); }
  });

  socket.on('voice:leave',       () => leaveVoice(io, socket));
  socket.on('disconnect',        () => { if (socket.voiceChannel) leaveVoice(io, socket); });

  socket.on('voice:offer',  ({ to, offer })     => io.to(to).emit('voice:offer',  { from: socket.id, offer }));
  socket.on('voice:answer', ({ to, answer })    => io.to(to).emit('voice:answer', { from: socket.id, answer }));
  socket.on('voice:ice',    ({ to, candidate }) => io.to(to).emit('voice:ice',    { from: socket.id, candidate }));

  socket.on('voice:mute', ({ muted }) => {
    if (!socket.voiceChannel) return;
    socket.to(`voice:${socket.voiceChannel}`).emit('voice:mute_update', {
      userId: socket.user.id, muted,
    });
  });
};

function leaveVoice(io, socket) {
  const channelId = socket.voiceChannel;
  const guildId   = socket.voiceGuild;
  if (!channelId) return;

  socket.leave(`voice:${channelId}`);
  const room = voiceRooms.get(channelId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) voiceRooms.delete(channelId);
  }

  socket.to(`voice:${channelId}`).emit('voice:user_left', {
    userId: socket.user.id, socketId: socket.id,
  });

  socket.voiceChannel = null;
  socket.voiceGuild   = null;

  if (guildId) broadcastVoiceUpdate(io, guildId, channelId);
}

function broadcastVoiceUpdate(io, guildId, channelId) {
  const room = voiceRooms.get(channelId) || new Set();
  const members = [];
  room.forEach(sid => {
    const s = io.sockets.sockets.get(sid);
    if (s) members.push({ socketId: sid, userId: s.user.id, username: s.user.username });
  });
  io.to(`guild:${guildId}`).emit('voice:members_update', { channelId, members });
}
