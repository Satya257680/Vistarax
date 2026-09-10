// VistaraX - Visitor Management System API
// Standalone Express + SQLite backend with JWT auth, RBAC, rate limiting,
// helmet security headers, and Socket.IO for real-time notifications.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  // eslint-disable-next-line no-console
  console.error('[VistaraX] FATAL: JWT_SECRET is missing or too short. Set a long random value in your .env file before starting.');
  process.exit(1);
}

const { initSocket } = require('./src/socket');
const authRoutes = require('./src/routes/auth.routes');
const visitorRoutes = require('./src/routes/visitors.routes');
const userRoutes = require('./src/routes/users.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const notificationRoutes = require('./src/routes/notifications.routes');
const exportRoutes = require('./src/routes/export.routes');

const app = express();
const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const io = new Server(server, { cors: { origin: corsOrigin, credentials: true } });
initSocket(io);

// --- Security middleware --------------------------------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow frontend to load photos
  })
);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// General API rate limit (separate, stricter limiter is applied to /auth/login)
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
app.use('/api/', apiLimiter);

// Static: uploaded visitor / logo photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Routes ------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'VistaraX API', time: new Date().toISOString() }));

// --- Error handling ------------------------------------------------------
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('Only JPEG')) {
    return res.status(422).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large.' });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[VistaraX] API + realtime server running on port ${PORT}`);
});
