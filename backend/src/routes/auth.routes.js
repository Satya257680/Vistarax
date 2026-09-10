// VistaraX - Authentication routes: login, me, logout, change-password
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db, logAudit } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loginValidators, handleValidation } = require('../utils/validators');

const router = express.Router();

// Brute-force protection: 8 attempts per 15 minutes per IP on the login route
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

router.post('/login', loginLimiter, loginValidators, handleValidation, (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  // Constant-ish response shape whether or not the user exists, to avoid
  // leaking which usernames are valid.
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily locked due to failed login attempts. Try again later.' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    const attempts = user.failed_attempts + 1;
    let lockedUntil = null;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString();
    }
    db.prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?').run(
      attempts,
      lockedUntil,
      user.id
    );
    logAudit({ userId: user.id, username: user.username, action: 'LOGIN_FAILED', module: 'auth', ip: req.ip });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  db.prepare('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });

  logAudit({ userId: user.id, username: user.username, action: 'LOGIN_SUCCESS', module: 'auth', ip: req.ip });

  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, role: user.role },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', requireAuth, (req, res) => {
  logAudit({ userId: req.user.id, username: req.user.username, action: 'LOGOUT', module: 'auth', ip: req.ip });
  // JWTs are stateless; the client simply discards the token. Nothing to invalidate server-side
  // in this minimal deployment (a token-blacklist table can be added later if needed).
  res.json({ ok: true });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!new_password || new_password.length < 6) {
    return res.status(422).json({ error: 'New password must be at least 6 characters.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(current_password || '', user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }
  const hash = bcrypt.hashSync(new_password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, user.id);
  logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_CHANGED', module: 'auth', ip: req.ip });
  res.json({ ok: true });
});

module.exports = router;
