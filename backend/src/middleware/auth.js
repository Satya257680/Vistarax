// VistaraX - Authentication & authorization middleware
// Every protected route runs through requireAuth first, then optionally
// requireRole(...) - role checks are enforced here on the server, never
// only hidden in the UI.

const jwt = require('jsonwebtoken');
const { db } = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db
      .prepare('SELECT id, name, username, role, status FROM users WHERE id = ?')
      .get(payload.sub);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Account not active. Contact an administrator.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
