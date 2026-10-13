// VistaraX - Visitor Management System API
// Express + MySQL backend with JWT auth, RBAC, rate limiting, helmet, Socket.IO.

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { Server } = require('socket.io');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  // eslint-disable-next-line no-console
  console.error('[VistaraX] FATAL: JWT_SECRET is missing or shorter than 32 characters. Generate one with:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const { initDb, pool } = require('./src/db');
const { initSocket } = require('./src/socket');
const authRoutes = require('./src/routes/auth.routes');
const visitorRoutes = require('./src/routes/visitors.routes');
const userRoutes = require('./src/routes/users.routes');
const roleRoutes = require('./src/routes/roles.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const notificationRoutes = require('./src/routes/notifications.routes');
const exportRoutes = require('./src/routes/export.routes');

const app = express();
const server = http.createServer(app);

// Behind nginx / a load balancer set TRUST_PROXY=1, otherwise req.ip is the proxy's
// address and every user shares ONE login rate-limit bucket.
if (process.env.TRUST_PROXY) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(tp) ? parseInt(tp, 10) : tp === 'true' ? 1 : tp);
}

// Comma-separated list of allowed origins (web app + optional Android/Capacitor app)
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean);
const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true); // no Origin = curl / same-origin
    return cb(null, false);
  },
  credentials: true,
};

const io = new Server(server, { cors: corsOptions });
initSocket(io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/', rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }));

// Uploaded photos. NOTE: these URLs are public to anyone who has the link
// (file names are random). See SECURITY_REPORT.md for the hardening option.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { index: false, dotfiles: 'deny' }));

app.use('/api/auth', authRoutes);
app.use('/api/visitors', visitorRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'VistaraX API', db: 'mysql', time: new Date().toISOString() });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// --- Error handling ------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message && (err.message.includes('Only JPEG') || err.message.includes('are allowed') || err.message.includes('Only CSV'))) {
    return res.status(422).json({ error: err.message });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large.' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body.' });
  if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That record already exists.' });
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});
app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await initDb();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[VistaraX] FATAL: could not initialise MySQL:', e.code || '', e.message);
    // eslint-disable-next-line no-console
    console.error('Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME in backend/.env');
    process.exit(1);
  }
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[VistaraX] API + realtime server running on port ${PORT} (MySQL)`);
  });
})();

const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
