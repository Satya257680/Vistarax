// VistaraX - User management (Admin only)
const express = require('express');
const bcrypt = require('bcryptjs');
const XLSX = require('xlsx');
const { one, query, run, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { bulkUpload } = require('../middleware/upload');
const { userValidators, handleValidation, passwordProblem } = require('../utils/validators');
const { likeEscape, asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const rounds = () => parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BULK_MAX_ROWS = 500;

async function slugifyRole(label) {
  let base = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  if (!base) base = 'role';
  let key = base;
  let i = 1;
  while (await one('SELECT 1 AS x FROM roles WHERE role_key = ?', [key])) key = `${base}_${i++}`;
  return key;
}

// "select OR type" role field: existing key, existing label, or brand-new label.
async function ensureRole(roleInput) {
  const value = String(roleInput || '').trim().slice(0, 100);
  if (!value) return null;
  const byKey = await one('SELECT role_key FROM roles WHERE role_key = ?', [value]);
  if (byKey) return byKey.role_key;
  const byLabel = await one('SELECT role_key FROM roles WHERE label = ?', [value]);
  if (byLabel) return byLabel.role_key;
  const key = await slugifyRole(value);
  await run('INSERT INTO roles (role_key, label, is_system) VALUES (?, ?, 0)', [key, value]);
  return key;
}

const cleanEmail = (v) => String(v || '').trim().toLowerCase() || null;

async function activeAdminCountExcluding(userId) {
  return (await one("SELECT COUNT(*) c FROM users WHERE role = 'admin' AND status = 'active' AND id != ?", [userId])).c;
}

router.get('/', asyncHandler(async (req, res) => {
  const { q, role, status } = req.query;
  const clauses = [];
  const params = [];
  if (q) {
    const like = `%${likeEscape(String(q).slice(0, 100))}%`;
    clauses.push('(name LIKE ? OR username LIKE ? OR phone LIKE ?)');
    params.push(like, like, like);
  }
  if (role && role !== 'all') { clauses.push('role = ?'); params.push(String(role)); }
  if (status && status !== 'all') { clauses.push('status = ?'); params.push(String(status)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const data = await query(`SELECT id, name, username, role, phone, email, status, created_at FROM users ${where} ORDER BY id DESC`, params);
  res.json({ data });
}));

router.post('/', userValidators, handleValidation, asyncHandler(async (req, res) => {
  const { name, username, password, role, phone, email } = req.body;
  const problem = passwordProblem(password);
  if (problem) return res.status(422).json({ error: problem });
  if (await one('SELECT id FROM users WHERE username = ?', [username])) return res.status(409).json({ error: 'That username is already taken.' });

  const emailValue = cleanEmail(email);
  if (emailValue && (await one('SELECT id FROM users WHERE email = ?', [emailValue]))) {
    return res.status(409).json({ error: 'That email is already in use by another account.' });
  }
  const roleKey = await ensureRole(role);
  if (!roleKey) return res.status(422).json({ error: 'Role is required.' });

  const hash = await bcrypt.hash(password, rounds());
  const info = await run('INSERT INTO users (name, username, password_hash, role, phone, email) VALUES (?,?,?,?,?,?)',
    [name, username, hash, roleKey, phone.trim(), emailValue]);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'users', recordId: info.insertId, ip: req.ip });
  const user = await one('SELECT id, name, username, role, phone, email, status FROM users WHERE id = ?', [info.insertId]);
  res.status(201).json({ user });
}));

// --- BULK IMPORT (CSV / Excel) ----------------------------------------------
router.post('/bulk', bulkUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(422).json({ error: 'Please choose a CSV or Excel file to upload.' });
  let rows;
  try {
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  } catch (e) {
    return res.status(422).json({ error: 'Could not read that file. Please upload a valid CSV or Excel file.' });
  }
  if (!rows.length) return res.status(422).json({ error: 'The file has no rows to import.' });
  if (rows.length > BULK_MAX_ROWS) return res.status(422).json({ error: `Please import at most ${BULK_MAX_ROWS} users at a time.` });

  const pick = (row, ...keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find((rk) => rk.trim().toLowerCase() === k);
      if (found && String(row[found]).trim() !== '') return String(row[found]).trim();
    }
    return '';
  };
  const results = { created: 0, skipped: 0, errors: [] };
  const skip = (n, msg) => { results.skipped += 1; results.errors.push(`Row ${n}: ${msg}`); };

  for (let idx = 0; idx < rows.length; idx += 1) {
    const row = rows[idx];
    const n = idx + 2;
    const name = pick(row, 'name', 'full name');
    const username = pick(row, 'username');
    const password = pick(row, 'password');
    const roleInput = pick(row, 'role');
    const phone = pick(row, 'phone', 'contact', 'contact no', 'contact number');
    const emailValue = cleanEmail(pick(row, 'email', 'email address'));

    if (!name || !username || !password || !roleInput || !phone) { skip(n, 'name, username, password, role and phone are all required.'); continue; }
    if (name.length > 150) { skip(n, 'name is too long.'); continue; }
    if (!USERNAME_RE.test(username)) { skip(n, 'username must be 3-50 characters (letters, numbers, "_" or ".").'); continue; }
    if (!/^[0-9+\-\s()]{6,20}$/.test(phone)) { skip(n, 'phone number is not valid.'); continue; }
    const pwProblem = passwordProblem(password);
    if (pwProblem) { skip(n, pwProblem.replace('Password', 'password')); continue; }
    if (emailValue && (!EMAIL_RE.test(emailValue) || emailValue.length > 150)) { skip(n, 'email is not valid.'); continue; }
    if (await one('SELECT id FROM users WHERE username = ?', [username])) { skip(n, `username "${username}" already exists.`); continue; }
    if (emailValue && (await one('SELECT id FROM users WHERE email = ?', [emailValue]))) { skip(n, `email "${emailValue}" is already in use.`); continue; }

    const roleKey = await ensureRole(roleInput);
    const hash = await bcrypt.hash(password, rounds());
    const info = await run('INSERT INTO users (name, username, password_hash, role, phone, email) VALUES (?,?,?,?,?,?)',
      [name, username, hash, roleKey, phone, emailValue]);
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'users', recordId: info.insertId, ip: req.ip });
    results.created += 1;
  }
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'BULK_IMPORT', module: 'users', recordId: `${results.created} created`, ip: req.ip });
  res.json(results);
}));

router.get('/bulk/template', (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet([
    { Name: 'Jane Doe', Username: 'jane.doe', Password: 'Passw0rd!', Role: 'Employee', Phone: '9876543210', Email: 'jane.doe@example.com' },
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Users');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="users-import-template.xlsx"');
  res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
});

// --- UPDATE --------------------------------------------------------------------
router.put('/:id', asyncHandler(async (req, res) => {
  const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const { name, username, phone, role, status, password, email } = req.body || {};

  if (name !== undefined && (!String(name).trim() || String(name).length > 150)) return res.status(422).json({ error: 'Full name is required (max 150 characters).' });
  if (phone !== undefined && !/^[0-9+\-\s()]{6,20}$/.test(String(phone).trim())) return res.status(422).json({ error: 'Please enter a valid phone number.' });
  if (status !== undefined && !['active', 'blocked'].includes(status)) return res.status(422).json({ error: 'Status must be "active" or "blocked".' });
  if (password) { const p = passwordProblem(password); if (p) return res.status(422).json({ error: p }); }
  if (email !== undefined && String(email).trim() && !EMAIL_RE.test(String(email).trim())) return res.status(422).json({ error: 'Please enter a valid email address.' });

  let finalUsername = target.username;
  if (username !== undefined && String(username).trim() && String(username).trim() !== target.username) {
    const u = String(username).trim();
    if (!USERNAME_RE.test(u)) return res.status(422).json({ error: 'Username may contain letters, numbers, "_" and "." only (3-50 characters).' });
    if (await one('SELECT id FROM users WHERE username = ? AND id != ?', [u, target.id])) return res.status(409).json({ error: 'That username is already taken.' });
    finalUsername = u;
  }
  let finalEmail = target.email;
  if (email !== undefined) {
    finalEmail = cleanEmail(email);
    if (finalEmail && (await one('SELECT id FROM users WHERE email = ? AND id != ?', [finalEmail, target.id]))) {
      return res.status(409).json({ error: 'That email is already in use by another account.' });
    }
  }
  const roleKey = role ? await ensureRole(role) : target.role;
  const finalStatus = status ?? target.status;

  // Lock-out protection: never allow the system to be left without an active admin.
  const losingAdmin = target.role === 'admin' && target.status === 'active' && (roleKey !== 'admin' || finalStatus !== 'active');
  if (losingAdmin && (await activeAdminCountExcluding(target.id)) === 0) {
    return res.status(400).json({ error: 'You cannot demote or block the last active administrator.' });
  }
  if (target.id === req.user.id && finalStatus !== 'active') {
    return res.status(400).json({ error: 'You cannot block your own account.' });
  }

  await run('UPDATE users SET name = ?, username = ?, phone = ?, role = ?, status = ?, email = ? WHERE id = ?',
    [name ?? target.name, finalUsername, phone !== undefined ? String(phone).trim() : target.phone, roleKey, finalStatus, finalEmail, target.id]);

  if (password) {
    const hash = await bcrypt.hash(password, rounds());
    // password_changed_at invalidates the user's existing sessions
    await run('UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, password_changed_at = UTC_TIMESTAMP() WHERE id = ?', [hash, target.id]);
  }
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'users', recordId: target.id, ip: req.ip });
  res.json({ user: await one('SELECT id, name, username, role, phone, email, status FROM users WHERE id = ?', [target.id]) });
}));

// --- DELETE ALL (everyone except the requesting admin) -----------------------------
router.post('/delete-all', asyncHandler(async (req, res) => {
  if ((req.body || {}).confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm this irreversible action.' });
  const r = await run('DELETE FROM users WHERE id != ?', [req.user.id]);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE_ALL', module: 'users', recordId: `${r.affectedRows} records`, ip: req.ip });
  res.json({ ok: true, deleted: r.affectedRows });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account while signed in.' });
  const target = await one('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  // visitors.created_by / audit_logs.user_id are ON DELETE SET NULL, so history is kept
  await run('DELETE FROM users WHERE id = ?', [target.id]);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'users', recordId: target.id, ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
