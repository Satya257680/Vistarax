// VistaraX - Roles & Permissions (Admin only)
// Lists every role with its permission set and lets an admin create new
// roles, rename/delete custom ones, and toggle what each role can do. The
// "admin" role is hard-protected: always full access, can't be edited or
// removed, so there's never a way to lock every admin out of the system.
const express = require('express');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PERMISSION_CATALOG } = require('../utils/permissions');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

function slugifyRole(label) {
  let base = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base) base = 'role';
  let key = base;
  let i = 1;
  while (db.prepare('SELECT 1 FROM roles WHERE key = ?').get(key)) key = `${base}_${i++}`;
  return key;
}

// --- LIST ----------------------------------------------------------------
router.get('/', (req, res) => {
  const roles = db.prepare('SELECT * FROM roles ORDER BY is_system DESC, label ASC').all();
  const permsByRole = db.prepare('SELECT role_key, permission_key FROM role_permissions').all();
  const counts = db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all();
  const countMap = Object.fromEntries(counts.map((c) => [c.role, c.c]));

  const data = roles.map((r) => ({
    key: r.key,
    label: r.label,
    is_system: !!r.is_system,
    userCount: countMap[r.key] || 0,
    permissions:
      r.key === 'admin'
        ? PERMISSION_CATALOG.map((p) => p.key)
        : permsByRole.filter((p) => p.role_key === r.key).map((p) => p.permission_key),
  }));

  res.json({ data, catalog: PERMISSION_CATALOG });
});

// --- CREATE (label only; key is auto-generated & guaranteed unique) --------
router.post('/', (req, res) => {
  const { label, permissions } = req.body;
  if (!label || !String(label).trim()) {
    return res.status(422).json({ error: 'Role name is required.' });
  }
  const trimmed = String(label).trim();
  const clash = db.prepare('SELECT 1 FROM roles WHERE label = ? COLLATE NOCASE').get(trimmed);
  if (clash) return res.status(409).json({ error: 'A role with that name already exists.' });

  const key = slugifyRole(trimmed);
  db.prepare('INSERT INTO roles (key, label, is_system) VALUES (?, ?, 0)').run(key, trimmed);

  const validPerms = Array.isArray(permissions) ? permissions.filter((p) => PERMISSION_CATALOG.some((c) => c.key === p)) : [];
  const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
  validPerms.forEach((p) => insertPerm.run(key, p));

  logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'roles', recordId: key, ip: req.ip });
  res.status(201).json({ role: { key, label: trimmed, is_system: false, userCount: 0, permissions: validPerms } });
});

// --- RENAME (custom roles only) -------------------------------------------
router.put('/:key', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE key = ?').get(req.params.key);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.is_system) return res.status(400).json({ error: 'System roles cannot be renamed.' });

  const { label } = req.body;
  if (!label || !String(label).trim()) return res.status(422).json({ error: 'Role name is required.' });

  db.prepare('UPDATE roles SET label = ? WHERE key = ?').run(String(label).trim(), role.key);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'roles', recordId: role.key, ip: req.ip });
  res.json({ ok: true });
});

// --- UPDATE PERMISSIONS (admin is locked out of this - always full access) ---
router.put('/:key/permissions', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE key = ?').get(req.params.key);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.key === 'admin') {
    return res.status(400).json({ error: 'Admin always has full access and cannot be changed.' });
  }
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) return res.status(422).json({ error: 'permissions must be an array.' });

  const validPerms = permissions.filter((p) => PERMISSION_CATALOG.some((c) => c.key === p));
  const apply = db.transaction(() => {
    db.prepare('DELETE FROM role_permissions WHERE role_key = ?').run(role.key);
    const insertPerm = db.prepare('INSERT INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
    validPerms.forEach((p) => insertPerm.run(role.key, p));
  });
  apply();

  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'role_permissions', recordId: role.key, ip: req.ip });
  res.json({ ok: true, permissions: validPerms });
});

// --- DELETE (custom roles only, and only while unused) ---------------------
router.delete('/:key', (req, res) => {
  const role = db.prepare('SELECT * FROM roles WHERE key = ?').get(req.params.key);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.is_system) return res.status(400).json({ error: 'System roles cannot be deleted.' });

  const inUse = db.prepare('SELECT COUNT(*) c FROM users WHERE role = ?').get(role.key).c;
  if (inUse > 0) {
    return res.status(409).json({ error: `${inUse} user${inUse === 1 ? '' : 's'} still have this role. Reassign them first.` });
  }

  db.prepare('DELETE FROM role_permissions WHERE role_key = ?').run(role.key);
  db.prepare('DELETE FROM roles WHERE key = ?').run(role.key);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'roles', recordId: role.key, ip: req.ip });
  res.json({ ok: true });
});

module.exports = router;
