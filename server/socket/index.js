const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { jwtSecret } = require('../config');
const chatHandlers     = require('./chat');
const presenceHandlers = require('./presence');
const voiceHandlers    = require('./voice');
const dmHandlers       = require('./dm');
const friendHandlers   = require('./friends');

const onlineUsers = new Map();

module.exports = (io) => {

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Token manquant'));
    try {
      const payload = jwt.verify(token, jwtSecret);
      const user = await User.findByPk(payload.id, { attributes: { exclude: ['password'] } });
      if (!user) return next(new Error('Utilisateur introuvable'));
      socket.user = user;
      next();
    } catch (err) { next(new Error('Token invalide')); }
  });

  io.on('connection', async (socket) => {
    onlineUsers.set(socket.user.id, { socketId: socket.id, status: 'online' });
    await User.update({ status: 'online' }, { where: { id: socket.user.id } }).catch(() => {});

    chatHandlers(io, socket, onlineUsers);
    presenceHandlers(io, socket, onlineUsers);
    voiceHandlers(io, socket, onlineUsers);
    dmHandlers(io, socket, onlineUsers);
    friendHandlers(io, socket, onlineUsers);

    socket.emit('connected', { userId: socket.user.id });
  });
};
