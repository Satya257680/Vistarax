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

// Same protection, applied separately to the forgot-password endpoints so an
// attacker can't use them to enumerate usernames/emails or brute-force a
// reset token.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// The five system roles a person can pick from on the Forgot Password
// screen (mirrors utils/permissions.js SYSTEM_ROLES) - kept here as a plain
// list of keys so we don't need to touch the roles table (custom roles can
// still reset via a direct admin edit).
const RESETTABLE_ROLES = ['admin', 'manager', 'entry_boy', 'entry_girl', 'employee'];
const RESET_PASSWORD_MIN = 8;
const RESET_PASSWORD_MAX = 15;

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

// --- FORGOT PASSWORD (step 1): verify role + username + email ---------------
// No SMTP server in this deployment, so instead of emailing a link we verify
// the account directly against the role/username/email an admin set on it
// and hand back a short-lived reset token the client uses for step 2. Every
// outcome below intentionally avoids HTTP 401 - the frontend's axios
// interceptor treats a 401 as "session expired" and force-redirects to
// /login, which would break this page for a signed-out visitor.
router.post('/forgot-password/verify', forgotLimiter, (req, res) => {
  const { role, username, email } = req.body || {};
  const cleanRole = String(role || '').trim();
  const cleanUsername = String(username || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanRole || !RESETTABLE_ROLES.includes(cleanRole)) {
    return res.status(422).json({ error: 'Please select a valid role.' });
  }
  if (!cleanUsername || !cleanEmail) {
    return res.status(422).json({ error: 'Username and email are both required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(cleanUsername);
  const matches = user && user.role === cleanRole && user.email && user.email.toLowerCase() === cleanEmail;

  if (!matches) {
    logAudit({ action: 'PASSWORD_RESET_VERIFY_FAILED', module: 'auth', recordId: cleanUsername, ip: req.ip });
    return res.status(404).json({ error: "We couldn't verify an account with that role, username and email. Double-check the details, or ask an administrator to confirm the email on file." });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  }

  const resetToken = jwt.sign({ sub: user.id, purpose: 'pwreset' }, process.env.JWT_SECRET, { expiresIn: '10m' });
  logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_RESET_VERIFIED', module: 'auth', ip: req.ip });
  res.json({ resetToken, name: user.name });
});

// --- FORGOT PASSWORD (step 2): set a new password using the reset token ----
router.post('/forgot-password/reset', forgotLimiter, (req, res) => {
  const { resetToken, new_password, confirm_password } = req.body || {};

  if (!new_password || new_password.length < RESET_PASSWORD_MIN || new_password.length > RESET_PASSWORD_MAX) {
    return res.status(422).json({ error: `New password must be between ${RESET_PASSWORD_MIN} and ${RESET_PASSWORD_MAX} characters.` });
  }
  if (confirm_password !== undefined && confirm_password !== new_password) {
    return res.status(422).json({ error: 'Passwords do not match.' });
  }

  let payload;
  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch {
    return res.status(422).json({ error: 'This reset session has expired. Please verify your details again.' });
  }
  if (!payload || payload.purpose !== 'pwreset') {
    return res.status(422).json({ error: 'Invalid reset session. Please verify your details again.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user) return res.status(404).json({ error: 'This account no longer exists.' });
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  }

  const hash = bcrypt.hashSync(new_password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
  db.prepare(
    `UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`
  ).run(hash, user.id);

  logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_RESET_COMPLETED', module: 'auth', ip: req.ip });
  res.json({ ok: true });
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
