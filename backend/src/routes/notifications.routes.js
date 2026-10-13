// VistaraX - Notifications feed
const express = require('express');
const { one, query, run } = require('../db');
const { requireAuth, requirePermission, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requirePermission('notifications.view'));

router.get('/', asyncHandler(async (req, res) => {
  const data = await query('SELECT * FROM notifications ORDER BY id DESC LIMIT 100');
  const { c } = await one('SELECT COUNT(*) c FROM notifications WHERE is_read = 0');
  res.json({ data, unread: c });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await run('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
  res.json({ ok: true });
}));

router.post('/:id/read', asyncHandler(async (req, res) => {
  await run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
}));

// Clearing the shared feed wipes it for every staff member -> admin only.
router.delete('/', requireRole('admin'), asyncHandler(async (req, res) => {
  await run('DELETE FROM notifications');
  res.json({ ok: true });
}));

module.exports = router;
