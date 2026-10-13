// VistaraX - Roles & Permissions (Admin only)
const express = require('express');
const { one, query, run, withTransaction, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PERMISSION_CATALOG } = require('../utils/permissions');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const isPerm = (p) => PERMISSION_CATALOG.some((c) => c.key === p);

async function slugifyRole(label) {
  let base = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
  if (!base) base = 'role';
  let key = base;
  let i = 1;
  while (await one('SELECT 1 AS x FROM roles WHERE role_key = ?', [key])) key = `${base}_${i++}`;
  return key;
}

router.get('/', asyncHandler(async (req, res) => {
  const roles = await query('SELECT * FROM roles ORDER BY is_system DESC, label ASC');
  const perms = await query('SELECT role_key, permission_key FROM role_permissions');
  const counts = await query('SELECT role, COUNT(*) c FROM users GROUP BY role');
  const countMap = Object.fromEntries(counts.map((c) => [c.role, c.c]));

  const data = roles.map((r) => ({
    key: r.role_key,
    label: r.label,
    is_system: !!r.is_system,
    userCount: countMap[r.role_key] || 0,
    permissions: r.role_key === 'admin' ? PERMISSION_CATALOG.map((p) => p.key) : perms.filter((p) => p.role_key === r.role_key).map((p) => p.permission_key),
  }));
  res.json({ data, catalog: PERMISSION_CATALOG });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { label, permissions } = req.body || {};
  if (!label || !String(label).trim()) return res.status(422).json({ error: 'Role name is required.' });
  const trimmed = String(label).trim().slice(0, 100);
  if (await one('SELECT 1 AS x FROM roles WHERE label = ?', [trimmed])) {
    return res.status(409).json({ error: 'A role with that name already exists.' });
  }
  const key = await slugifyRole(trimmed);
  const validPerms = Array.isArray(permissions) ? [...new Set(permissions.filter(isPerm))] : [];
  await withTransaction(async (tx) => {
    await tx.run('INSERT INTO roles (role_key, label, is_system) VALUES (?, ?, 0)', [key, trimmed]);
    for (const p of validPerms) await tx.run('INSERT IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)', [key, p]);
  });
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'roles', recordId: key, ip: req.ip });
  res.status(201).json({ role: { key, label: trimmed, is_system: false, userCount: 0, permissions: validPerms } });
}));

router.put('/:key', asyncHandler(async (req, res) => {
  const role = await one('SELECT * FROM roles WHERE role_key = ?', [req.params.key]);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.is_system) return res.status(400).json({ error: 'System roles cannot be renamed.' });
  const { label } = req.body || {};
  if (!label || !String(label).trim()) return res.status(422).json({ error: 'Role name is required.' });
  await run('UPDATE roles SET label = ? WHERE role_key = ?', [String(label).trim().slice(0, 100), role.role_key]);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'roles', recordId: role.role_key, ip: req.ip });
  res.json({ ok: true });
}));

router.put('/:key/permissions', asyncHandler(async (req, res) => {
  const role = await one('SELECT * FROM roles WHERE role_key = ?', [req.params.key]);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.role_key === 'admin') return res.status(400).json({ error: 'Admin always has full access and cannot be changed.' });
  const { permissions } = req.body || {};
  if (!Array.isArray(permissions)) return res.status(422).json({ error: 'permissions must be an array.' });

  const validPerms = [...new Set(permissions.filter(isPerm))];
  await withTransaction(async (tx) => {
    await tx.run('DELETE FROM role_permissions WHERE role_key = ?', [role.role_key]);
    for (const p of validPerms) await tx.run('INSERT INTO role_permissions (role_key, permission_key) VALUES (?, ?)', [role.role_key, p]);
  });
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'role_permissions', recordId: role.role_key, ip: req.ip });
  res.json({ ok: true, permissions: validPerms });
}));

router.delete('/:key', asyncHandler(async (req, res) => {
  const role = await one('SELECT * FROM roles WHERE role_key = ?', [req.params.key]);
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  if (role.is_system) return res.status(400).json({ error: 'System roles cannot be deleted.' });
  const { c } = await one('SELECT COUNT(*) c FROM users WHERE role = ?', [role.role_key]);
  if (c > 0) return res.status(409).json({ error: `${c} user${c === 1 ? '' : 's'} still have this role. Reassign them first.` });
  await run('DELETE FROM roles WHERE role_key = ?', [role.role_key]); // role_permissions cascade
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'roles', recordId: role.role_key, ip: req.ip });
  res.json({ ok: true });
}));

module.exports = router;
