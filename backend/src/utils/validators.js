// VistaraX - Shared input validation helpers (express-validator chains)
const fs = require('fs');
const { body, validationResult } = require('express-validator');

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (pw.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  return null;
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // multer has already written the upload to disk by now - don't leave an orphan behind
    if (req.file && req.file.path) fs.unlink(req.file.path, () => {});
    return res.status(422).json({ error: errors.array()[0].msg !== 'Invalid value' ? errors.array()[0].msg : 'Validation failed', details: errors.array() });
  }
  next();
}

// NOTE: no .escape() on username - it silently rewrote characters before the
// DB lookup. Parameterised queries already make injection impossible.
const loginValidators = [
  body('username').isString().trim().isLength({ min: 2, max: 100 }),
  body('password').isString().isLength({ min: 1, max: 200 }),
];

const phoneRule = (chain) => chain.trim().isLength({ min: 6, max: 20 }).matches(/^[0-9+\-\s()]+$/);

const visitorFields = (opt) => {
  const o = (c) => (opt ? c.optional() : c);
  return [
    o(body('name').trim().isLength({ min: 1, max: 150 })),
    body('contact_no').optional({ checkFalsy: true }).trim().isLength({ min: 6, max: 20 }).matches(/^[0-9+\-\s()]+$/),
    body('whatsapp_no').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
    body('aadhaar_no').optional({ checkFalsy: true }).trim().matches(/^\d{12}$/).withMessage('Aadhaar number must contain exactly 12 digits.'),
    o(body('whom_to_visit').trim().isLength({ min: 1, max: 150 })),
    body('purpose').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
    body('companions').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
    body('address').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
    body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
    body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
    body('visit_date').optional({ checkFalsy: true }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('visit_date must be YYYY-MM-DD.'),
  ];
};

const visitorValidators = visitorFields(false);
const visitorUpdateValidators = visitorFields(true);

const userValidators = [
  body('name').trim().isLength({ min: 1, max: 150 }),
  body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_.]+$/).withMessage('Username may contain letters, numbers, "_" and "." only.'),
  body('role').trim().isLength({ min: 1, max: 60 }),
  phoneRule(body('phone')),
  body('email').optional({ checkFalsy: true }).trim().isEmail().isLength({ max: 150 }),
];

module.exports = {
  handleValidation, loginValidators, visitorValidators, visitorUpdateValidators, userValidators,
  PASSWORD_MIN, PASSWORD_MAX, passwordProblem,
};
