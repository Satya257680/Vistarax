// VistaraX - Shared input validation helpers (express-validator chains)
const { body, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

const loginValidators = [
  body('username').trim().isLength({ min: 2, max: 100 }).escape(),
  body('password').isLength({ min: 4, max: 200 }),
];

const visitorValidators = [
  body('name').trim().isLength({ min: 1, max: 150 }),
  body('contact_no').trim().isLength({ min: 6, max: 20 }).matches(/^[0-9+\-\s()]+$/),
  body('whatsapp_no').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
  body('whom_to_visit').trim().isLength({ min: 1, max: 150 }),
  body('purpose').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('companions').optional({ checkFalsy: true }).trim().isLength({ max: 300 }),
  body('address').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('remarks').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  body('latitude').optional({ checkFalsy: true }).isFloat({ min: -90, max: 90 }),
  body('longitude').optional({ checkFalsy: true }).isFloat({ min: -180, max: 180 }),
];

const userValidators = [
  body('name').trim().isLength({ min: 1, max: 150 }),
  body('username').trim().isLength({ min: 3, max: 50 }).matches(/^[a-zA-Z0-9_.]+$/),
  body('role').isIn(['admin', 'entry_boy']),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 20 }),
];

module.exports = { handleValidation, loginValidators, visitorValidators, userValidators };
