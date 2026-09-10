// VistaraX - Authentication & authorization middleware
// Every protected route runs through requireAuth first, then optionally
// requireRole(...) or requirePermission(...) - access checks are enforced
// here on the server, never only hidden in the UI.

const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { getPermissionsForRole } = require('../utils/permissions');

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
    // Attach the role's effective permission set so downstream handlers (and
    // requirePermission below) never have to re-query it themselves.
    user.permissions = getPermissionsForRole(db, user.role);
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

// Permission-based gate for RBAC roles that aren't simply "admin" - admin is
// always allowed through, everyone else needs at least one of the listed
// permission keys on their role.
function requirePermission(...keys) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role === 'admin') return next();
    const has = keys.some((k) => req.user.permissions?.includes(k));
    if (!has) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requirePermission };
