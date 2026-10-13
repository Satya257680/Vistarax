// VistaraX - Authentication & authorization middleware
// Every protected route runs requireAuth first, then requireRole(...) or
// requirePermission(...). Access checks are enforced here on the server.

const jwt = require('jsonwebtoken');
const { one, query } = require('../db');
const { getPermissionsForRole } = require('../utils/permissions');

// Single place that verifies tokens, so HTTP and Socket.IO behave identically.
// - algorithm pinned to HS256 (blocks "alg" confusion)
// - tokens that carry a `purpose` (e.g. the password-reset token) are NOT
//   session tokens and are refused here
async function authenticateToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  if (payload.purpose) throw new Error('not a session token');

  const user = await one('SELECT id, name, username, role, status, password_changed_at FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.status !== 'active') return null;

  // Password reset by an admin / via "forgot password" kills older sessions.
  if (user.password_changed_at && payload.iat < Math.floor(new Date(user.password_changed_at).getTime() / 1000)) {
    return null;
  }
  delete user.password_changed_at;
  user.permissions = await getPermissionsForRole(query, user.role);
  return user;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const user = await authenticateToken(token);
    if (!user) return res.status(401).json({ error: 'Account not active. Contact an administrator.' });
    req.user = user;
    next();
  } catch (err) {
    if (err && (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError' || err.name === 'NotBeforeError' || err.message === 'not a session token')) {
      return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
    }
    return next(err); // DB outage etc. -> 500, not a bogus "please sign in again"
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

// admin always passes; everyone else needs at least one listed permission key.
function requirePermission(...keys) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (req.user.role === 'admin') return next();
    if (!keys.some((k) => req.user.permissions?.includes(k))) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requirePermission, authenticateToken };
