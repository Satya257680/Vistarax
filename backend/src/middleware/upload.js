// VistaraX - Secure file upload handling (multer)
// `upload` restricts visitor photos to image mimetypes, caps file size, and
// writes random filenames so the original client-supplied name is never
// trusted or exposed. `bulkUpload` is a separate, memory-backed config for
// the Users "Bulk Upload" CSV/Excel import - small files, parsed in-process
// with the `xlsx` package, never written to disk.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'visitors');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME.has(file.mimetype)
      ? '.' + file.mimetype.split('/')[1].replace('jpeg', 'jpg')
      : '.bin';
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG or WEBP images are allowed.'));
  }
  cb(null, true);
}

const maxSizeMb = parseInt(process.env.MAX_PHOTO_SIZE_MB || '5', 10);

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxSizeMb * 1024 * 1024, files: 1 },
});

// --- Bulk user import (CSV / Excel) ----------------------------------------
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const okExt = /\.(csv|xlsx|xls)$/i.test(file.originalname || '');
    if (!okExt) {
      return cb(new Error('Only CSV or Excel (.xlsx/.xls) files are allowed.'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// --- Content sniffing ---------------------------------------------------------
// multer's fileFilter only sees the *claimed* Content-Type header, which any
// client can forge. After the file is on disk, check its real magic bytes.
function looksLikeImage(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return true; // PNG
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return true; // WEBP
  return false;
}

function verifyUploadedImage(req, res, next) {
  if (!req.file) return next();
  try {
    const fd = fs.openSync(req.file.path, 'r');
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (!looksLikeImage(buf)) {
      fs.unlink(req.file.path, () => {});
      return res.status(422).json({ error: 'The uploaded file is not a valid JPEG, PNG or WEBP image.' });
    }
  } catch (e) {
    return next(e);
  }
  next();
}

// Safely removes a stored upload given its public URL (/uploads/visitors/xyz.jpg).
function removeUpload(photoUrl) {
  if (!photoUrl) return;
  const file = path.join(UPLOAD_DIR, path.basename(photoUrl));
  fs.unlink(file, () => {});
}

module.exports = { upload, UPLOAD_DIR, bulkUpload, verifyUploadedImage, removeUpload };
