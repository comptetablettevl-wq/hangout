/**
 * Utilitaires partagés pour les handlers socket
 * onlineUsers : Map<userId, { socketId, status }>
 */

/**
 * Trouve un socket par userId en O(1) via la Map onlineUsers
 * Beaucoup plus rapide que de boucler sur io.sockets.sockets
 */
const getSocketByUserId = (io, onlineUsers, userId) => {
  const entry = onlineUsers.get(userId);
  if (!entry) return null;
  return io.sockets.sockets.get(entry.socketId) || null;
};

/**
 * Émet un event à un user spécifique s'il est en ligne
 * Retourne true si le message a été délivré
 */
const emitToUser = (io, onlineUsers, userId, event, data) => {
  const sock = getSocketByUserId(io, onlineUsers, userId);
  if (sock) { sock.emit(event, data); return true; }
  return false;
};

module.exports = { getSocketByUserId, emitToUser };
