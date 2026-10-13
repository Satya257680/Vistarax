// One-off data import: old SQLite file  ->  MySQL.
//
//   cd backend
//   npm install better-sqlite3 --no-save        (only needed for this script)
//   node scripts/migrate-sqlite-to-mysql.js [path/to/vistarax.db]
//
// Default path: backend/data/vistarax.db. IDs are preserved so photo links,
// notifications and audit history keep pointing at the right records.
// Run it ONCE against an empty database (it refuses if users already exist,
// unless you pass --force).
require('dotenv').config();
// initDb() seeds a throw-away admin on an empty DB; give it a dummy password so no
// random password is printed - that account is replaced by your imported users.
if (!process.env.DEFAULT_ADMIN_PASSWORD) process.env.DEFAULT_ADMIN_PASSWORD = 'temporary-import-password';
const path = require('path');
const { initDb, pool, withTransaction, one } = require('../src/db');

let Database;
try { Database = require('better-sqlite3'); } catch {
  console.error('Run:  npm install better-sqlite3 --no-save   and try again.'); process.exit(1);
}

const file = process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(__dirname, '..', 'data', 'vistarax.db');
const force = process.argv.includes('--force');

// SQLite stores "YYYY-MM-DD HH:MM:SS" (UTC) or full ISO strings -> MySQL DATETIME (UTC)
const dt = (v) => {
  if (!v) return null;
  const s = String(v);
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const cut = (v, n) => (v === null || v === undefined ? null : String(v).slice(0, n));

(async () => {
  const src = new Database(file, { readonly: true, fileMustExist: true });
  await initDb();
  const { c } = await one('SELECT COUNT(*) c FROM users');
  // initDb() seeds one default admin on an empty DB - that single row is replaced by the import.
  const seeded = (await one("SELECT COUNT(*) c FROM audit_logs")).c === 0 && c === 1;
  if (c > 0 && !seeded && !force) { console.error('Target database already has users. Use --force to import anyway.'); process.exit(1); }

  const tableExists = (t) => !!src.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
  const rows = (t) => (tableExists(t) ? src.prepare(`SELECT * FROM ${t}`).all() : []);

  await withTransaction(async (tx) => {
    await tx.run('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['audit_logs', 'notifications', 'visitors', 'role_permissions', 'roles', 'users']) await tx.run(`DELETE FROM ${t}`);

    for (const u of rows('users')) {
      await tx.run(
        `INSERT INTO users (id, name, username, password_hash, role, phone, email, status, failed_attempts, locked_until, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [u.id, cut(u.name, 150), cut(u.username, 50), u.password_hash, cut(u.role, 60) || 'employee', cut(u.phone, 20),
          u.email ? String(u.email).toLowerCase() : null, u.status === 'blocked' ? 'blocked' : 'active', u.failed_attempts || 0,
          dt(u.locked_until), dt(u.created_at) || new Date(), dt(u.updated_at) || new Date()]
      );
    }
    for (const r of rows('roles')) {
      await tx.run('INSERT INTO roles (id, role_key, label, is_system, created_at) VALUES (?,?,?,?,?)',
        [r.id, cut(r.key, 60), cut(r.label, 100), r.is_system ? 1 : 0, dt(r.created_at) || new Date()]);
    }
    for (const p of rows('role_permissions')) {
      await tx.run('INSERT IGNORE INTO role_permissions (role_key, permission_key) VALUES (?,?)', [p.role_key, p.permission_key]);
    }
    for (const v of rows('visitors')) {
      await tx.run(
        `INSERT INTO visitors (id, serial_no, name, contact_no, whatsapp_no, aadhaar_no, companions, whom_to_visit, purpose,
           checkin_time, checkout_time, photo_url, latitude, longitude, address, visit_date, visit_day, remarks, checkout_remarks,
           status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [v.id, v.serial_no, cut(v.name, 150), cut(v.contact_no, 20), cut(v.whatsapp_no, 20), cut(v.aadhaar_no, 20), cut(v.companions, 300),
          cut(v.whom_to_visit, 150), cut(v.purpose, 200), dt(v.checkin_time) || new Date(), dt(v.checkout_time), cut(v.photo_url, 255),
          v.latitude, v.longitude, cut(v.address, 500), String(v.visit_date).slice(0, 10), cut(v.visit_day, 20), cut(v.remarks, 500),
          cut(v.checkout_remarks, 500), v.status === 'checked_out' ? 'checked_out' : 'inside', v.created_by,
          dt(v.created_at) || new Date(), dt(v.updated_at) || new Date()]
      );
    }
    for (const n of rows('notifications')) {
      await tx.run('INSERT INTO notifications (id, type, title, message, visitor_id, is_read, created_at) VALUES (?,?,?,?,?,?,?)',
        [n.id, cut(n.type, 30), cut(n.title, 150), cut(n.message, 500), n.visitor_id, n.is_read ? 1 : 0, dt(n.created_at) || new Date()]);
    }
    for (const a of rows('audit_logs')) {
      await tx.run('INSERT INTO audit_logs (id, user_id, username, action, module, record_id, ip_address, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [a.id, a.user_id, cut(a.username, 50), cut(a.action, 50), cut(a.module, 40), cut(a.record_id, 100), cut(a.ip_address, 64), dt(a.created_at) || new Date()]);
    }
    const s = rows('settings')[0];
    if (s) {
      await tx.run(
        `UPDATE settings SET company_name=?, logo_url=?, address=?, contact=?, timezone=?, date_format=?, photo_required=?, location_required=?, accent_color=? WHERE id=1`,
        [cut(s.company_name, 150) || 'VistaraX', cut(s.logo_url, 255), cut(s.address, 500), cut(s.contact, 100), s.timezone || 'Asia/Kolkata',
          s.date_format || 'DD MMM YYYY', s.photo_required ? 1 : 0, s.location_required ? 1 : 0, s.accent_color || 'blue']
      );
    }
    await tx.run('SET FOREIGN_KEY_CHECKS = 1');
  });

  // rebuild the serial counters from the imported data
  await pool.query('DELETE FROM serial_counters');
  await initDb();

  const counts = {};
  for (const t of ['users', 'roles', 'visitors', 'notifications', 'audit_logs']) counts[t] = (await one(`SELECT COUNT(*) c FROM ${t}`)).c;
  console.log('Import complete:', counts);
  src.close();
  await pool.end();
})().catch((e) => { console.error('Migration failed:', e.message); process.exit(1); });
