// VistaraX - Secure photo upload handling (multer)
// Restricts to image mimetypes, caps file size, writes random filenames so
// the original client-supplied name is never trusted or exposed.

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

module.exports = { upload, UPLOAD_DIR };
