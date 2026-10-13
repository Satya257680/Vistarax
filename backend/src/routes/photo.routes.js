// Temporary QR photo handoff. Tokens expire after 10 minutes and can be used once.
const express = require('express');
const crypto = require('crypto');
const { one, run } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { upload, verifyUploadedImage, removeUpload } = require('../middleware/upload');
const { asyncHandler } = require('../utils/helpers');
const router = express.Router();

router.post('/session', requireAuth, requirePermission('visitors.manage'), asyncHandler(async (req, res) => {
  const token = crypto.randomBytes(24).toString('hex');
  await run('INSERT INTO photo_upload_sessions (token, expires_at) VALUES (?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))', [token]);
  res.status(201).json({ token, expiresInSeconds: 600 });
}));

router.get('/session/:token', requireAuth, requirePermission('visitors.manage'), asyncHandler(async (req, res) => {
  const row = await one('SELECT photo_url, expires_at, used_at FROM photo_upload_sessions WHERE token = ?', [req.params.token]);
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return res.status(404).json({ error: 'QR session expired. Generate a new QR code.' });
  res.json({ photo_url: row.photo_url, uploaded: Boolean(row.photo_url), used: Boolean(row.used_at) });
}));

// Public only with an unguessable, short-lived token printed inside the QR code.
router.post('/:token', upload.single('photo'), verifyUploadedImage, asyncHandler(async (req, res) => {
  const row = await one('SELECT token, photo_url, expires_at, used_at FROM photo_upload_sessions WHERE token = ?', [req.params.token]);
  if (!row || new Date(row.expires_at).getTime() < Date.now() || row.used_at) {
    if (req.file) removeUpload(`/uploads/visitors/${req.file.filename}`);
    return res.status(410).json({ error: 'This QR code has expired or has already been used. Ask reception for a new one.' });
  }
  if (!req.file) return res.status(422).json({ error: 'Take a photo or choose an image first.' });
  const photoUrl = `/uploads/visitors/${req.file.filename}`;
  await run('UPDATE photo_upload_sessions SET photo_url = ?, used_at = UTC_TIMESTAMP() WHERE token = ? AND used_at IS NULL', [photoUrl, req.params.token]);
  res.json({ ok: true, photo_url: photoUrl, message: 'Photo sent to reception successfully.' });
}));
module.exports = router;
