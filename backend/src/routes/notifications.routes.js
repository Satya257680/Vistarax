// VistaraX - Notifications feed
const express = require('express');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE is_read = 0').get().c;
  res.json({ data: rows, unread });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ ok: true });
});

router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
