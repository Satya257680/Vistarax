// VistaraX - Real-time layer (Socket.IO)
// Clients connect with their JWT; we verify it before letting them join the
// broadcast room so notifications never reach an unauthenticated socket.

const jwt = require('jsonwebtoken');
const { db } = require('./db');

let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, name, role, status FROM users WHERE id = ?').get(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('unauthorized'));
      socket.user = user;
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('staff'); // all authenticated staff receive live visitor activity
    socket.on('disconnect', () => {});
  });
}

function emitEvent(event, payload) {
  if (ioInstance) ioInstance.to('staff').emit(event, payload);
}

module.exports = { initSocket, emitEvent };
