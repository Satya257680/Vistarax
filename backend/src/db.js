// VistaraX - Database layer (MySQL / MariaDB via mysql2/promise)
//
// Everything is async now. Exports:
//   pool, query(sql, params) -> rows, one(sql, params) -> first row | null,
//   run(sql, params) -> { insertId, affectedRows }, withTransaction(fn),
//   initDb(), logAudit(...)
//
// All values go through "?" placeholders (never string concatenation).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { SYSTEM_ROLES, DEFAULT_ROLE_PERMISSIONS } = require('./utils/permissions');

const DB_NAME = process.env.DB_NAME || 'vistarax';

const baseConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  charset: 'utf8mb4',
  timezone: 'Z', // DATETIME columns are UTC; Date objects serialise to ISO "...Z"
  dateStrings: ['DATE'], // visit_date stays 'YYYY-MM-DD' instead of becoming a Date
  decimalNumbers: true,
  ...(String(process.env.DB_SSL).toLowerCase() === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
};

const pool = mysql.createPool({
  ...baseConfig,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  queueLimit: 0,
  enableKeepAlive: true,
});

async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}
async function run(sql, params = []) {
  const [res] = await pool.query(sql, params);
  return res; // { insertId, affectedRows, ... }
}

// Runs fn(conn) inside a transaction. conn has the same query/one/run helpers.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  const tx = {
    query: async (sql, p = []) => (await conn.query(sql, p))[0],
    one: async (sql, p = []) => (await conn.query(sql, p))[0][0] || null,
    run: async (sql, p = []) => (await conn.query(sql, p))[0],
  };
  try {
    await conn.beginTransaction();
    const result = await fn(tx);
    await conn.commit();
    return result;
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw err;
  } finally {
    conn.release();
  }
}

function loadSchemaStatements() {
  const raw = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
  return raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureDatabase() {
  // Creates the database if the DB user is allowed to. If not (shared hosting),
  // create it yourself in phpMyAdmin / cPanel and this step is simply skipped.
  try {
    const conn = await mysql.createConnection(baseConfig);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME.replace(/`/g, '')}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.end();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[VistaraX] Could not auto-create database "${DB_NAME}" (${e.code || e.message}). Assuming it already exists.`);
  }
}

async function seedRoles() {
  for (const r of SYSTEM_ROLES) {
    const res = await run('INSERT IGNORE INTO roles (role_key, label, is_system) VALUES (?, ?, 1)', [r.key, r.label]);
    // Default permissions are applied ONLY when the role is first created, so
    // permissions an admin later removes in the UI are not silently re-added
    // on the next restart.
    if (res.affectedRows === 1) {
      for (const p of DEFAULT_ROLE_PERMISSIONS[r.key] || []) {
        await run('INSERT IGNORE INTO role_permissions (role_key, permission_key) VALUES (?, ?)', [r.key, p]);
      }
    }
  }
}

async function seedSerialCounters() {
  // Keeps serial numbers monotonic when the DB already holds visitors
  // (for example after importing from SQLite).
  await run(
    `INSERT IGNORE INTO serial_counters (year, last_seq)
     SELECT CAST(SUBSTRING(serial_no, 5, 4) AS UNSIGNED), MAX(CAST(SUBSTRING(serial_no, 10) AS UNSIGNED))
     FROM visitors WHERE serial_no REGEXP '^VST-[0-9]{4}-[0-9]+$'
     GROUP BY 1`
  );
}

async function seedAdmin() {
  const { c } = await one('SELECT COUNT(*) AS c FROM users');
  if (c > 0) return;
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
  let password = process.env.DEFAULT_ADMIN_PASSWORD;
  let generated = false;
  if (!password) {
    password = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }
  const name = process.env.DEFAULT_ADMIN_NAME || 'System Admin';
  const email = (process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase() || null;
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
  const hash = await bcrypt.hash(password, rounds);
  await run(
    `INSERT INTO users (name, username, password_hash, role, status, email) VALUES (?, ?, ?, 'admin', 'active', ?)`,
    [name, username, hash, email]
  );
  // eslint-disable-next-line no-console
  console.log(`[VistaraX] Seeded default admin "${username}".`);
  if (generated) {
    // eslint-disable-next-line no-console
    console.log(`[VistaraX] Generated one-time admin password: ${password}   <-- save it now, it is not shown again.`);
  } else {
    // eslint-disable-next-line no-console
    console.log('[VistaraX] Log in and change the password immediately.');
  }
}

async function initDb() {
  await ensureDatabase();
  for (const stmt of loadSchemaStatements()) {
    await pool.query(stmt);
  }
  await run(`INSERT IGNORE INTO settings (id, company_name) VALUES (1, 'VistaraX')`);
  await seedRoles();
  await seedSerialCounters();
  await seedAdmin();
}

// Audit logging must never break the request it is describing.
async function logAudit({ userId, username, action, module: mod, recordId, ip }) {
  try {
    await run(
      `INSERT INTO audit_logs (user_id, username, action, module, record_id, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, username || null, action, mod, recordId ? String(recordId).slice(0, 100) : null, ip ? String(ip).slice(0, 64) : null]
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[VistaraX] audit log write failed:', e.message);
  }
}

module.exports = { pool, query, one, run, withTransaction, initDb, logAudit };
