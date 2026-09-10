// VistaraX - User management (admin only)
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { userValidators, handleValidation } = require('../utils/validators');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT id, name, username, role, phone, status, created_at FROM users ORDER BY id DESC')
    .all();
  res.json({ data: rows });
});

router.post('/', userValidators, handleValidation, (req, res) => {
  const { name, username, password, role, phone } = req.body;
  if (!password || password.length < 6) {
    return res.status(422).json({ error: 'Password must be at least 6 characters.' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'That username is already taken.' });

  const hash = bcrypt.hashSync(password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
  const info = db
    .prepare('INSERT INTO users (name, username, password_hash, role, phone) VALUES (?,?,?,?,?)')
    .run(name, username, hash, role, phone || null);

  logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'users', recordId: info.lastInsertRowid, ip: req.ip });
  const user = db.prepare('SELECT id, name, username, role, phone, status FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

router.put('/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const { name, phone, role, status, password } = req.body;

  db.prepare(
    `UPDATE users SET name = ?, phone = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name ?? target.name, phone ?? target.phone, role ?? target.role, status ?? target.status, target.id);

  if (password) {
    if (password.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters.' });
    const hash = bcrypt.hashSync(password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
    db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, target.id);
  }

  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'users', recordId: target.id, ip: req.ip });
  const user = db.prepare('SELECT id, name, username, role, phone, status FROM users WHERE id = ?').get(target.id);
  res.json({ user });
});

router.delete('/:id', (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account while signed in.' });
  }
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'users', recordId: target.id, ip: req.ip });
  res.json({ ok: true });
});

module.exports = router;
