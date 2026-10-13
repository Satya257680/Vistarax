// VistaraX - Real-time layer (Socket.IO)
// Clients connect with their JWT; it is verified (same rules as HTTP) before the
// socket may join the broadcast room.
const { authenticateToken } = require('./middleware/auth');

let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const user = await authenticateToken(token);
      if (!user) return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('staff');
  });
}

function emitEvent(event, payload) {
  if (ioInstance) ioInstance.to('staff').emit(event, payload);
}

module.exports = { initSocket, emitEvent };
