// VistaraX - Central permission catalog & default role -> permission mapping.
// Used to seed the roles / role_permissions tables and to render the
// "Roles & Permissions" admin screen. Admin is special-cased everywhere
// (always full access) so the system can never lock every admin out.

const PERMISSION_CATALOG = [
  { key: 'dashboard.view', label: 'View dashboard', module: 'Dashboard' },

  { key: 'visitors.view', label: 'View visitors', module: 'Visitors' },
  { key: 'visitors.manage', label: 'Add / edit visitors', module: 'Visitors' },
  { key: 'visitors.delete', label: 'Delete a visitor', module: 'Visitors' },
  { key: 'visitors.delete_all', label: 'Delete all visitors', module: 'Visitors' },
  { key: 'visitors.export', label: 'Export / print visitors', module: 'Visitors' },

  { key: 'currently_inside.view', label: 'View currently inside', module: 'Currently Inside' },
  { key: 'reports.view', label: 'View reports', module: 'Reports' },
  { key: 'notifications.view', label: 'View notifications', module: 'Notifications' },

  { key: 'users.view', label: 'View users', module: 'Administration' },
  { key: 'users.manage', label: 'Add / edit users', module: 'Administration' },
  { key: 'users.delete', label: 'Delete users', module: 'Administration' },
  { key: 'users.bulk_upload', label: 'Bulk upload users', module: 'Administration' },
  { key: 'settings.manage', label: 'Manage settings', module: 'Administration' },
  { key: 'roles.manage', label: 'Manage roles & permissions', module: 'Administration' },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

// System roles seeded on first run. New roles can also be created on the fly
// (typed straight into the Role field when adding/editing/bulk-importing a
// user, or from the Roles & Permissions screen) - those are stored the same
// way but flagged is_system = 0 so they can be renamed/removed later.
const SYSTEM_ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'entry_boy', label: 'Entry Boy' },
  { key: 'entry_girl', label: 'Entry Girl' },
  { key: 'employee', label: 'Employee' },
];

const DEFAULT_ROLE_PERMISSIONS = {
  admin: ALL_PERMISSION_KEYS,
  manager: [
    'dashboard.view', 'visitors.view', 'visitors.manage', 'visitors.export',
    'currently_inside.view', 'reports.view', 'notifications.view', 'users.view',
  ],
  entry_boy: [
    'dashboard.view', 'visitors.view', 'visitors.manage', 'visitors.export',
    'currently_inside.view', 'notifications.view',
  ],
  entry_girl: [
    'dashboard.view', 'visitors.view', 'visitors.manage', 'visitors.export',
    'currently_inside.view', 'notifications.view',
  ],
  employee: ['dashboard.view', 'visitors.view', 'currently_inside.view', 'notifications.view'],
};

// Admin always resolves to every permission, regardless of what (if anything)
// is stored for it in role_permissions - takes a `db` handle as an argument
// instead of requiring ../db itself, so this file never has to know about
// the database module (db.js requires this file to seed itself, so the
// reverse require would be circular).
function getPermissionsForRole(db, roleKey) {
  if (roleKey === 'admin') return ALL_PERMISSION_KEYS;
  const rows = db.prepare('SELECT permission_key FROM role_permissions WHERE role_key = ?').all(roleKey);
  return rows.map((r) => r.permission_key);
}

module.exports = {
  PERMISSION_CATALOG,
  ALL_PERMISSION_KEYS,
  SYSTEM_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  getPermissionsForRole,
};
