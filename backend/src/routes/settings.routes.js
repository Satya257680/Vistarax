// VistaraX - Company / app settings
const express = require('express');
const { one, run, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload, verifyUploadedImage, removeUpload } = require('../middleware/upload');
const { asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const toBool = (v, fallback) => (v === undefined ? fallback : (v === true || v === 'true' || v === '1' || v === 1 ? 1 : 0));

router.get('/', asyncHandler(async (req, res) => {
  res.json({ settings: await one('SELECT * FROM settings WHERE id = 1') });
}));

router.put('/', requireRole('admin'), upload.single('logo'), verifyUploadedImage, asyncHandler(async (req, res) => {
  const b = req.body;
  const current = await one('SELECT * FROM settings WHERE id = 1');
  let logoUrl = current.logo_url;
  if (req.file) {
    removeUpload(current.logo_url);
    logoUrl = `/uploads/visitors/${req.file.filename}`;
  }
  const str = (v, fb, max) => (v === undefined ? fb : String(v).slice(0, max));

  await run(
    `UPDATE settings SET company_name=?, logo_url=?, address=?, contact=?, timezone=?, date_format=?,
       photo_required=?, location_required=?, accent_color=? WHERE id = 1`,
    [
      str(b.company_name, current.company_name, 150) || current.company_name, logoUrl,
      str(b.address, current.address, 500), str(b.contact, current.contact, 100),
      str(b.timezone, current.timezone, 60), str(b.date_format, current.date_format, 30),
      toBool(b.photo_required, current.photo_required), toBool(b.location_required, current.location_required),
      str(b.accent_color, current.accent_color, 30),
    ]
  );
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'settings', ip: req.ip });
  res.json({ settings: await one('SELECT * FROM settings WHERE id = 1') });
}));

module.exports = router;
