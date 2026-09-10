// VistaraX - Database layer (SQLite via better-sqlite3)
// Standalone by design: no external DB server required. Swap this file for a
// Postgres/pg adapter later if you need multi-server scaling - the rest of
// the app only talks to the functions exported here.

const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } = require('./utils/permissions');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'vistarax.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee',
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Roles are open-ended: the five seeded below always exist, but an admin can
-- create more at any time (from the Roles & Permissions screen, or simply by
-- typing a new role name straight into a user's Role field).
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS visitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  serial_no TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  contact_no TEXT NOT NULL,
  whatsapp_no TEXT,
  companions TEXT,
  whom_to_visit TEXT NOT NULL,
  purpose TEXT,
  checkin_time TEXT NOT NULL DEFAULT (datetime('now')),
  checkout_time TEXT,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  visit_date TEXT NOT NULL,
  visit_day TEXT NOT NULL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'inside' CHECK(status IN ('inside','checked_out')),
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visitors_name ON visitors(name);
CREATE INDEX IF NOT EXISTS idx_visitors_contact ON visitors(contact_no);
CREATE INDEX IF NOT EXISTS idx_visitors_date ON visitors(visit_date);
CREATE INDEX IF NOT EXISTS idx_visitors_status ON visitors(status);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  visitor_id INTEGER REFERENCES visitors(id) ON DELETE CASCADE,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL DEFAULT 'VistaraX',
  logo_url TEXT,
  address TEXT,
  contact TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  date_format TEXT NOT NULL DEFAULT 'DD MMM YYYY',
  photo_required INTEGER NOT NULL DEFAULT 1,
  location_required INTEGER NOT NULL DEFAULT 0,
  accent_color TEXT NOT NULL DEFAULT 'blue',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// --- Migration: older installs locked users.role to CHECK(role IN
// ('admin','entry_boy')). Roles are now open-ended (kept in the `roles`
// table instead), so anyone upgrading needs that column widened in place
// without losing existing accounts.
(function migrateUserRoleColumn() {
  const tbl = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'`).get();
  if (tbl && /CHECK\s*\(\s*role\s+IN/i.test(tbl.sql)) {
    // visitors.created_by and audit_logs.user_id both hold a FOREIGN KEY
    // REFERENCES users(id). Two things have to be true while we swap the
    // table out from under them:
    //  1. `legacy_alter_table` must be ON so SQLite's rename doesn't rewrite
    //     those columns' FK target to "users_pre_rbac" (which we then drop).
    //  2. `foreign_keys` must be OFF for the duration, otherwise dropping
    //     users_pre_rbac while real visitor/audit rows still point at it
    //     fails with "FOREIGN KEY constraint failed".
    // Both PRAGMAs are restored to their previous state afterwards.
    const fkWasOn = db.pragma('foreign_keys', { simple: true }) === 1;
    db.pragma('foreign_keys = OFF');
    db.pragma('legacy_alter_table = ON');
    try {
      const migrate = db.transaction(() => {
        db.exec(`ALTER TABLE users RENAME TO users_pre_rbac`);
        db.exec(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'employee',
            phone TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','blocked')),
            failed_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `);
        db.exec(`INSERT INTO users SELECT * FROM users_pre_rbac`);
        db.exec(`DROP TABLE users_pre_rbac`);
      });
      migrate();
    } finally {
      db.pragma('legacy_alter_table = OFF');
      if (fkWasOn) db.pragma('foreign_keys = ON');
    }
    // eslint-disable-next-line no-console
    console.log('[VistaraX] Migrated users.role to support custom roles.');
  }
})();

// Seed default settings row
const settingsRow = db.prepare('SELECT id FROM settings WHERE id = 1').get();
if (!settingsRow) {
  db.prepare(`INSERT INTO settings (id, company_name) VALUES (1, 'VistaraX')`).run();
}

// Seed the system roles and their default permission sets (idempotent - safe
// to run on every boot; INSERT OR IGNORE skips anything already there).
function seedRoles() {
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (key, label, is_system) VALUES (?, ?, 1)');
  SYSTEM_ROLES.forEach((r) => insertRole.run(r.key, r.label));

  const insertPerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)');
  Object.entries(DEFAULT_ROLE_PERMISSIONS).forEach(([roleKey, perms]) => {
    perms.forEach((p) => insertPerm.run(roleKey, p));
  });
}
seedRoles();

// Seed default admin (only if no users exist yet)
function seedAdmin() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe@123';
    const name = process.env.DEFAULT_ADMIN_NAME || 'System Admin';
    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hash = bcrypt.hashSync(password, rounds);
    db.prepare(
      `INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')`
    ).run(name, username, hash);
    // eslint-disable-next-line no-console
    console.log(`[VistaraX] Seeded default admin user "${username}". Please log in and change the password immediately.`);
  }
}
seedAdmin();

function logAudit({ userId, username, action, module, recordId, ip }) {
  db.prepare(
    `INSERT INTO audit_logs (user_id, username, action, module, record_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId || null, username || null, action, module, recordId ? String(recordId) : null, ip || null);
}

module.exports = { db, logAudit };
