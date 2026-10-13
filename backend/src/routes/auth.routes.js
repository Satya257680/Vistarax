// VistaraX - Authentication routes: login, me, logout, change-password, forgot-password
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { one, run, logAudit } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { loginValidators, handleValidation, passwordProblem } = require('../utils/validators');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const rounds = () => parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// SECURITY: the self-service reset only checks facts an insider can easily
// know (role + username + email) - there is no SMTP/OTP proof of ownership.
// So it is NOT offered for the admin role (admins reset via `npm run reset-admin`
// or another admin), and can be switched off entirely with ALLOW_SELF_SERVICE_RESET=false.
const RESETTABLE_ROLES = ['manager', 'entry_boy', 'entry_girl', 'employee'];
const SELF_RESET_ENABLED = String(process.env.ALLOW_SELF_SERVICE_RESET || 'true').toLowerCase() !== 'false';

// Used to burn the same CPU time when the username doesn't exist (stops
// username enumeration through response-time differences).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', loginLimiter, loginValidators, handleValidation, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await one('SELECT * FROM users WHERE username = ?', [username]);

  if (!user) {
    await bcrypt.compare(password, DUMMY_HASH);
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return res.status(403).json({ error: 'Account temporarily locked due to failed login attempts. Try again later.' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    // If a previous lock has expired, start counting from zero again
    const previous = user.locked_until ? 0 : user.failed_attempts;
    const attempts = previous + 1;
    const lock = attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null;
    await run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lock, user.id]);
    await logAudit({ userId: user.id, username: user.username, action: 'LOGIN_FAILED', module: 'auth', ip: req.ip });
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  await run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  await logAudit({ userId: user.id, username: user.username, action: 'LOGIN_SUCCESS', module: 'auth', ip: req.ip });
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
}));

// --- FORGOT PASSWORD (step 1) ------------------------------------------------
// Never returns 401 (the frontend treats 401 as "session expired" and redirects).
router.post('/forgot-password/verify', forgotLimiter, asyncHandler(async (req, res) => {
  if (!SELF_RESET_ENABLED) {
    return res.status(403).json({ error: 'Self-service password reset is disabled. Please ask an administrator to reset your password.' });
  }
  const { role, username, email } = req.body || {};
  const cleanRole = String(role || '').trim();
  const cleanUsername = String(username || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!cleanRole) return res.status(422).json({ error: 'Please select a valid role.' });
  if (cleanRole === 'admin') {
    return res.status(403).json({ error: 'Administrator passwords cannot be reset here. Ask another administrator, or use the server command "npm run reset-admin".' });
  }
  if (!RESETTABLE_ROLES.includes(cleanRole)) return res.status(422).json({ error: 'Please select a valid role.' });
  if (!cleanUsername || !cleanEmail) return res.status(422).json({ error: 'Username and email are both required.' });

  const user = await one('SELECT * FROM users WHERE username = ?', [cleanUsername]);
  const matches = user && user.role === cleanRole && user.email && user.email.toLowerCase() === cleanEmail;
  if (!matches) {
    await logAudit({ action: 'PASSWORD_RESET_VERIFY_FAILED', module: 'auth', recordId: cleanUsername, ip: req.ip });
    return res.status(404).json({ error: "We couldn't verify an account with that role, username and email. Double-check the details, or ask an administrator to confirm the email on file." });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  }

  // `pwv` fingerprints the current password hash: once the password is changed
  // the token stops working, so a reset token is effectively single-use.
  const pwv = crypto.createHash('sha256').update(user.password_hash).digest('hex').slice(0, 16);
  const resetToken = jwt.sign({ sub: user.id, purpose: 'pwreset', pwv }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '10m' });
  await logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_RESET_VERIFIED', module: 'auth', ip: req.ip });
  res.json({ resetToken, name: user.name });
}));

// --- FORGOT PASSWORD (step 2) ------------------------------------------------
router.post('/forgot-password/reset', forgotLimiter, asyncHandler(async (req, res) => {
  if (!SELF_RESET_ENABLED) return res.status(403).json({ error: 'Self-service password reset is disabled.' });
  const { resetToken, new_password, confirm_password } = req.body || {};

  const problem = passwordProblem(new_password);
  if (problem) return res.status(422).json({ error: problem });
  if (confirm_password !== undefined && confirm_password !== new_password) {
    return res.status(422).json({ error: 'Passwords do not match.' });
  }

  let payload;
  try {
    payload = jwt.verify(String(resetToken || ''), process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(422).json({ error: 'This reset session has expired. Please verify your details again.' });
  }
  if (!payload || payload.purpose !== 'pwreset') {
    return res.status(422).json({ error: 'Invalid reset session. Please verify your details again.' });
  }

  const user = await one('SELECT * FROM users WHERE id = ?', [payload.sub]);
  if (!user) return res.status(404).json({ error: 'This account no longer exists.' });
  if (user.status === 'blocked') return res.status(403).json({ error: 'This account has been blocked. Contact an administrator.' });
  if (user.role === 'admin') return res.status(403).json({ error: 'Administrator passwords cannot be reset here.' });

  const pwvNow = crypto.createHash('sha256').update(user.password_hash).digest('hex').slice(0, 16);
  if (payload.pwv !== pwvNow) {
    return res.status(422).json({ error: 'This reset link was already used. Please verify your details again.' });
  }

  const hash = await bcrypt.hash(new_password, rounds());
  await run(
    'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, password_changed_at = UTC_TIMESTAMP() WHERE id = ?',
    [hash, user.id]
  );
  await logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_RESET_COMPLETED', module: 'auth', ip: req.ip });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'LOGOUT', module: 'auth', ip: req.ip });
  // JWTs are stateless; the client discards the token.
  res.json({ ok: true });
}));

router.post('/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  const problem = passwordProblem(new_password);
  if (problem) return res.status(422).json({ error: problem });

  const user = await one('SELECT * FROM users WHERE id = ?', [req.user.id]);
  // 400 (not 401): the frontend interceptor logs the user out on any 401
  if (!(await bcrypt.compare(String(current_password || ''), user.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  const hash = await bcrypt.hash(new_password, rounds());
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  await logAudit({ userId: user.id, username: user.username, action: 'PASSWORD_CHANGED', module: 'auth', ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
