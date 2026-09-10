// VistaraX - Company / app settings
const express = require('express');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({ settings });
});

router.put('/', requireRole('admin'), upload.single('logo'), (req, res) => {
  const b = req.body;
  const current = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  const logoUrl = req.file ? `/uploads/visitors/${req.file.filename}` : current.logo_url;

  db.prepare(
    `UPDATE settings SET company_name=?, logo_url=?, address=?, contact=?, timezone=?, date_format=?,
      photo_required=?, location_required=?, accent_color=?, updated_at = datetime('now') WHERE id = 1`
  ).run(
    b.company_name ?? current.company_name,
    logoUrl,
    b.address ?? current.address,
    b.contact ?? current.contact,
    b.timezone ?? current.timezone,
    b.date_format ?? current.date_format,
    b.photo_required !== undefined ? (b.photo_required === 'true' || b.photo_required === true ? 1 : 0) : current.photo_required,
    b.location_required !== undefined ? (b.location_required === 'true' || b.location_required === true ? 1 : 0) : current.location_required,
    b.accent_color ?? current.accent_color,
  );

  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'settings', ip: req.ip });
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  res.json({ settings });
});

module.exports = router;
