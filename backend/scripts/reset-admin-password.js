// Offline admin password reset (the web "Forgot password" is intentionally disabled for admins).
//   npm run reset-admin -- <username> <new-password>
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { one, run, pool, logAudit } = require('../src/db');
const { passwordProblem } = require('../src/utils/validators');

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) { console.error('Usage: npm run reset-admin -- <username> <new-password>'); process.exit(1); }
  const problem = passwordProblem(password);
  if (problem) { console.error(problem); process.exit(1); }
  const user = await one('SELECT id, role FROM users WHERE username = ?', [username]);
  if (!user) { console.error('No such user.'); process.exit(1); }
  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
  await run("UPDATE users SET password_hash = ?, status = 'active', failed_attempts = 0, locked_until = NULL, password_changed_at = UTC_TIMESTAMP() WHERE id = ?", [hash, user.id]);
  await logAudit({ username, action: 'PASSWORD_RESET_CLI', module: 'auth', recordId: user.id });
  console.log(`Password for "${username}" updated. All existing sessions for that user are now invalid.`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
