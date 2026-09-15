// VistaraX - User management (Admin only): add / edit / delete accounts,
// filter & search, bulk import from CSV/Excel, delete-all, block/unblock and
// reset password (folded into the edit form), and open-ended roles that can
// be picked from a list or typed in fresh.
const express = require('express');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { bulkUpload } = require('../middleware/upload');
const { userValidators, handleValidation } = require('../utils/validators');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const BCRYPT_ROUNDS = () => parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

function slugifyRole(label) {
  let base = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = 'role';
  let key = base;
  let i = 1;
  while (db.prepare('SELECT 1 FROM roles WHERE key = ?').get(key)) key = `${base}_${i++}`;
  return key;
}

// Resolves a role input (an existing role's key, an existing role's label -
// case-insensitively, or a brand-new label) to a role key, creating the role
// if it doesn't exist yet. This is what makes the Role field on the Add/Edit
// User form and the bulk-import sheet behave like "select OR type".
function ensureRole(roleInput) {
  const value = String(roleInput || '').trim();
  if (!value) return null;
  const byKey = db.prepare('SELECT key FROM roles WHERE key = ?').get(value);
  if (byKey) return byKey.key;
  const byLabel = db.prepare('SELECT key FROM roles WHERE label = ? COLLATE NOCASE').get(value);
  if (byLabel) return byLabel.key;
  const key = slugifyRole(value);
  db.prepare('INSERT INTO roles (key, label, is_system) VALUES (?, ?, 0)').run(key, value);
  return key;
}

// --- LIST / SEARCH / FILTER -------------------------------------------------
router.get('/', (req, res) => {
  const { q, role, status } = req.query;
  const clauses = [];
  const params = [];

  if (q) {
    clauses.push('(name LIKE ? OR username LIKE ? OR phone LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  if (role && role !== 'all') {
    clauses.push('role = ?');
    params.push(role);
  }
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db
    .prepare(`SELECT id, name, username, role, phone, email, status, created_at FROM users ${where} ORDER BY id DESC`)
    .all(...params);
  res.json({ data: rows });
});

// Normalizes an optional email: trims/lowercases, or returns null for an
// empty value. Used by both create and update below.
function cleanEmail(value) {
  const v = String(value || '').trim().toLowerCase();
  return v || null;
}

// --- CREATE ------------------------------------------------------------------
router.post('/', userValidators, handleValidation, (req, res) => {
  const { name, username, password, role, phone, email } = req.body;
  if (!password || password.length < 6) {
    return res.status(422).json({ error: 'Password must be at least 6 characters.' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'That username is already taken.' });

  const roleKey = ensureRole(role);
  if (!roleKey) return res.status(422).json({ error: 'Role is required.' });

  const emailValue = cleanEmail(email);
  if (emailValue) {
    const emailClash = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(emailValue);
    if (emailClash) return res.status(409).json({ error: 'That email is already in use by another account.' });
  }

  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS());
  const info = db
    .prepare('INSERT INTO users (name, username, password_hash, role, phone, email) VALUES (?,?,?,?,?,?)')
    .run(name, username, hash, roleKey, phone.trim(), emailValue);

  logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'users', recordId: info.lastInsertRowid, ip: req.ip });
  const user = db.prepare('SELECT id, name, username, role, phone, email, status FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

// --- BULK IMPORT (CSV / Excel) ------------------------------------------------
// Expects columns (case-insensitive, a couple of aliases accepted): Name,
// Username, Password, Role, Phone. Unknown roles are created automatically,
// same as a single Add User. Every row is validated independently so one bad
// row never blocks the rest of the file.
router.post('/bulk', bulkUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(422).json({ error: 'Please choose a CSV or Excel file to upload.' });

  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } catch (e) {
    return res.status(422).json({ error: 'Could not read that file. Please upload a valid CSV or Excel file.' });
  }
  if (!rows.length) return res.status(422).json({ error: 'The file has no rows to import.' });

  const pick = (row, ...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k);
      if (found && String(row[found]).trim() !== '') return String(row[found]).trim();
    }
    return '';
  };

  const results = { created: 0, skipped: 0, errors: [] };
  const rounds = BCRYPT_ROUNDS();

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // header occupies row 1
    const name = pick(row, 'name', 'full name');
    const username = pick(row, 'username');
    const password = pick(row, 'password');
    const roleInput = pick(row, 'role');
    const phone = pick(row, 'phone', 'contact', 'contact no', 'contact number');
    const emailInput = pick(row, 'email', 'email address'); // optional - enables Forgot Password later

    if (!name || !username || !password || !roleInput || !phone) {
      results.skipped += 1;
      results.errors.push(`Row ${rowNum}: name, username, password, role and phone are all required.`);
      return;
    }
    if (password.length < 6) {
      results.skipped += 1;
      results.errors.push(`Row ${rowNum}: password must be at least 6 characters.`);
      return;
    }
    if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
      results.skipped += 1;
      results.errors.push(`Row ${rowNum}: username "${username}" already exists.`);
      return;
    }
    const emailValue = emailInput ? emailInput.trim().toLowerCase() : null;
    if (emailValue && db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE').get(emailValue)) {
      results.skipped += 1;
      results.errors.push(`Row ${rowNum}: email "${emailValue}" is already in use.`);
      return;
    }

    const roleKey = ensureRole(roleInput);
    const hash = bcrypt.hashSync(password, rounds);
    const info = db
      .prepare('INSERT INTO users (name, username, password_hash, role, phone, email) VALUES (?,?,?,?,?,?)')
      .run(name, username, hash, roleKey, phone, emailValue);
    logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'users', recordId: info.lastInsertRowid, ip: req.ip });
    results.created += 1;
  });

  logAudit({ userId: req.user.id, username: req.user.username, action: 'BULK_IMPORT', module: 'users', recordId: `${results.created} created`, ip: req.ip });
  res.json(results);
});

// --- BULK IMPORT TEMPLATE ------------------------------------------------
router.get('/bulk/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { Name: 'Jane Doe', Username: 'jane.doe', Password: 'Passw0rd!', Role: 'Employee', Phone: '9876543210', Email: 'jane.doe@example.com' },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="users-import-template.xlsx"');
  res.send(buf);
});

// --- UPDATE ------------------------------------------------------------------
router.put('/:id', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const { name, username, phone, role, status, password, email } = req.body;

  if (name !== undefined && !String(name).trim()) {
    return res.status(422).json({ error: 'Full name cannot be empty.' });
  }
  if (phone !== undefined && !String(phone).trim()) {
    return res.status(422).json({ error: 'Phone number cannot be empty.' });
  }
  if (password && password.length < 6) {
    return res.status(422).json({ error: 'Password must be at least 6 characters.' });
  }
  if (email !== undefined && String(email).trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(422).json({ error: 'Please enter a valid email address.' });
  }

  let finalUsername = target.username;
  if (username !== undefined && String(username).trim() && String(username).trim() !== target.username) {
    const clash = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(String(username).trim(), target.id);
    if (clash) return res.status(409).json({ error: 'That username is already taken.' });
    finalUsername = String(username).trim();
  }

  let finalEmail = target.email;
  if (email !== undefined) {
    finalEmail = String(email).trim() ? String(email).trim().toLowerCase() : null;
    if (finalEmail) {
      const emailClash = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?').get(finalEmail, target.id);
      if (emailClash) return res.status(409).json({ error: 'That email is already in use by another account.' });
    }
  }

  const roleKey = role ? ensureRole(role) : target.role;

  db.prepare(
    `UPDATE users SET name = ?, username = ?, phone = ?, role = ?, status = ?, email = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(name ?? target.name, finalUsername, phone ?? target.phone, roleKey, status ?? target.status, finalEmail, target.id);

  if (password) {
    const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS());
    db.prepare('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?').run(hash, target.id);
  }

  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'users', recordId: target.id, ip: req.ip });
  const user = db.prepare('SELECT id, name, username, role, phone, email, status FROM users WHERE id = ?').get(target.id);
  res.json({ user });
});

// --- DELETE ALL (admin only, requires explicit confirm phrase) ---------------
// Deletes every user except the one making the request, so an admin can
// never accidentally lock themselves out of their own system.
router.post('/delete-all', (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm this irreversible action.' });
  }
  const count = db.prepare('SELECT COUNT(*) c FROM users WHERE id != ?').get(req.user.id).c;
  db.prepare('DELETE FROM users WHERE id != ?').run(req.user.id);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE_ALL', module: 'users', recordId: `${count} records`, ip: req.ip });
  res.json({ ok: true, deleted: count });
});

// --- DELETE SINGLE -------------------------------------------------------------
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
