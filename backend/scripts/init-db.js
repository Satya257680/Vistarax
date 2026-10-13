// Creates the database (if allowed), all tables, default roles and the first admin.
require('dotenv').config();
const { initDb, pool } = require('../src/db');
initDb().then(() => { console.log('[VistaraX] Database ready.'); return pool.end(); })
  .catch((e) => { console.error('[VistaraX] init failed:', e.message); process.exit(1); });
