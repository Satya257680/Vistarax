// End-to-end smoke test against a RUNNING server + empty-ish MySQL database.
//   BASE=http://localhost:5000 ADMIN_USER=admin ADMIN_PASS=... npm run test:smoke
// Creates a few test users/visitors (prefixed "zz_smoke") and cleans up after itself.
const BASE = process.env.BASE || 'http://localhost:5000';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin@12345';

let pass = 0; let fail = 0;
const ok = (cond, label, extra = '') => { if (cond) { pass += 1; console.log(`  PASS  ${label}`); } else { fail += 1; console.log(`  FAIL  ${label} ${extra}`); } };

// 1x1 PNG (valid magic bytes)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function api(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  const type = res.headers.get('content-type') || '';
  const data = type.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer());
  return { status: res.status, data, headers: res.headers };
}

function visitorForm(over = {}, withPhoto = true) {
  const f = new FormData();
  const base = { name: 'zz_smoke Visitor', contact_no: '9876543210', aadhaar_no: '123456789012', whom_to_visit: 'Mr Smoke', purpose: 'Meeting', ...over };
  Object.entries(base).forEach(([k, v]) => f.append(k, v));
  if (withPhoto) f.append('photo', new Blob([PNG], { type: 'image/png' }), 'p.png');
  return f;
}

(async () => {
  console.log('Auth');
  let r = await api('POST', '/api/auth/login', { json: { username: ADMIN_USER, password: 'wrong-password' } });
  ok(r.status === 401, 'wrong password -> 401');
  r = await api('POST', '/api/auth/login', { json: { username: ADMIN_USER, password: ADMIN_PASS } });
  ok(r.status === 200 && r.data.token, 'admin login');
  const T = r.data.token;
  r = await api('GET', '/api/auth/me', { token: T });
  ok(r.status === 200 && r.data.user.role === 'admin' && r.data.user.permissions.length > 5, '/me returns role + permissions');
  r = await api('GET', '/api/visitors');
  ok(r.status === 401, 'no token -> 401');

  console.log('Users / RBAC');
  r = await api('POST', '/api/users', { token: T, json: { name: 'Smoke Emp', username: 'zz_smoke_emp', password: 'Passw0rd!x', role: 'Employee', phone: '9999999999', email: 'zz_smoke_emp@example.com' } });
  ok(r.status === 201, 'create employee user', JSON.stringify(r.data));
  const empId = r.data.user && r.data.user.id;
  r = await api('POST', '/api/users', { token: T, json: { name: 'Smoke Desk', username: 'zz_smoke_desk', password: 'Passw0rd!x', role: 'entry_boy', phone: '9999999998' } });
  ok(r.status === 201, 'create entry_boy user');
  const deskId = r.data.user && r.data.user.id;
  r = await api('POST', '/api/users', { token: T, json: { name: 'x', username: 'zz_short', password: 'abc', role: 'employee', phone: '9999999997' } });
  ok(r.status === 422, 'weak password rejected');

  const emp = (await api('POST', '/api/auth/login', { json: { username: 'zz_smoke_emp', password: 'Passw0rd!x' } })).data.token;
  const desk = (await api('POST', '/api/auth/login', { json: { username: 'zz_smoke_desk', password: 'Passw0rd!x' } })).data.token;
  r = await api('POST', '/api/visitors', { token: emp, form: visitorForm() });
  ok(r.status === 403, 'employee (view-only) cannot create visitors');
  r = await api('GET', '/api/users', { token: desk });
  ok(r.status === 403, 'entry_boy cannot list users');
  r = await api('GET', '/api/visitors', { token: emp });
  ok(r.status === 200, 'employee can view visitors');

  console.log('Visitors');
  r = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ name: 'zz_smoke 100%' }) });
  ok(r.status === 201 && /^VST-\d{4}-\d{6}$/.test(r.data.visitor.serial_no), 'create visitor with photo', JSON.stringify(r.data));
  const v1 = r.data.visitor;
  ok(/^\d{4}-\d{2}-\d{2}$/.test(v1.visit_date) && typeof v1.checkin_time === 'string' && v1.checkin_time.endsWith('Z'), 'dates serialise as YYYY-MM-DD / ISO-Z', `${v1.visit_date} ${v1.checkin_time}`);
  r = await api('POST', '/api/visitors', { token: desk, form: visitorForm({}, false) });
  ok(r.status === 422, 'photo required by default');
  r = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ aadhaar_no: '123' }) });
  ok(r.status === 422, 'bad aadhaar rejected');
  const fake = visitorForm({}, false); fake.append('photo', new Blob(['<script>alert(1)</script>'.padEnd(40, ' ')], { type: 'image/png' }), 'x.png');
  r = await api('POST', '/api/visitors', { token: desk, form: fake });
  ok(r.status === 422, 'fake image (wrong magic bytes) rejected');
  r = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ visit_date: '2026-02-31' }) });
  ok(r.status === 422, 'impossible visit_date rejected');

  // regression: old COUNT(*)+1 serials collided after a delete
  const del = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ name: 'zz_smoke del' }) });
  r = await api('DELETE', `/api/visitors/${del.data.visitor.id}`, { token: desk });
  ok(r.status === 200, 'entry_boy can delete one visitor');
  const after = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ name: 'zz_smoke after-delete' }) });
  ok(after.status === 201 && after.data.visitor.serial_no !== del.data.visitor.serial_no, 'serial not reused after delete', JSON.stringify(after.data));

  // concurrency: 12 parallel check-ins -> 12 distinct serials
  const par = await Promise.all(Array.from({ length: 12 }, (_, i) => api('POST', '/api/visitors', { token: desk, form: visitorForm({ name: `zz_smoke par${i}` }) })));
  const serials = new Set(par.map((p) => p.data.visitor && p.data.visitor.serial_no));
  ok(par.every((p) => p.status === 201) && serials.size === 12, '12 concurrent check-ins -> 12 unique serials', par.map((p) => p.status).join(','));

  r = await api('GET', `/api/visitors?q=${encodeURIComponent('100%')}`, { token: desk });
  ok(r.status === 200 && r.data.total === 1, 'search treats % literally', `total=${r.data.total}`);
  r = await api('GET', `/api/visitors?q=zz_smoke&pageSize=5&page=2`, { token: desk });
  ok(r.status === 200 && r.data.data.length === 5, 'pagination');
  r = await api('GET', `/api/visitors/${v1.id}`, { token: desk });
  ok(r.status === 200 && Array.isArray(r.data.history), 'single visitor + history');
  r = await api('PUT', `/api/visitors/${v1.id}`, { token: desk, form: (() => { const f = new FormData(); f.append('remarks', 'updated'); return f; })() });
  ok(r.status === 200 && r.data.visitor.remarks === 'updated', 'partial update');
  r = await api('GET', '/api/visitors/stats/summary', { token: desk });
  ok(r.status === 200 && r.data.todayCount >= 14 && Array.isArray(r.data.last7) && r.data.byPurpose.length >= 1, 'dashboard stats', JSON.stringify(r.data));
  r = await api('POST', `/api/visitors/${v1.id}/checkout`, { token: desk, json: { remarks: 'badge returned' } });
  ok(r.status === 200 && r.data.visitor.status === 'checked_out' && r.data.visitor.checkout_time > r.data.visitor.checkin_time, 'checkout time after check-in');
  r = await api('POST', `/api/visitors/${v1.id}/checkout`, { token: desk, json: {} });
  ok(r.status === 409, 'double checkout -> 409');
  r = await api('POST', '/api/visitors/delete-all', { token: desk, json: { confirm: 'DELETE' } });
  ok(r.status === 403, 'entry_boy cannot delete-all');

  console.log('Notifications / settings / roles');
  r = await api('GET', '/api/notifications', { token: desk });
  ok(r.status === 200 && r.data.data.length > 0 && r.data.unread > 0, 'notifications list');
  r = await api('DELETE', '/api/notifications', { token: desk });
  ok(r.status === 403, 'only admin clears notifications');
  r = await api('POST', '/api/notifications/read-all', { token: desk });
  ok(r.status === 200, 'mark all read');
  r = await api('GET', '/api/settings', { token: desk });
  ok(r.status === 200 && r.data.settings.company_name, 'settings read');
  let f = new FormData(); f.append('company_name', 'Smoke Co'); f.append('photo_required', 'true');
  r = await api('PUT', '/api/settings', { token: desk, form: f });
  ok(r.status === 403, 'entry_boy cannot change settings');
  r = await api('PUT', '/api/settings', { token: T, form: f });
  ok(r.status === 200 && r.data.settings.company_name === 'Smoke Co' && r.data.settings.photo_required === 1, 'admin updates settings');
  r = await api('GET', '/api/roles', { token: T });
  ok(r.status === 200 && r.data.data.some((x) => x.key === 'entry_boy' && x.permissions.includes('visitors.manage')), 'roles list');
  r = await api('POST', '/api/roles', { token: T, json: { label: 'zz_smoke role', permissions: ['visitors.view', 'bogus.perm'] } });
  ok(r.status === 201 && r.data.role.permissions.length === 1, 'create role (bogus permission dropped)');
  const roleKey = r.data.role.key;
  r = await api('PUT', `/api/roles/${roleKey}/permissions`, { token: T, json: { permissions: ['visitors.view', 'dashboard.view'] } });
  ok(r.status === 200, 'update role permissions');
  r = await api('DELETE', `/api/roles/${roleKey}`, { token: T });
  ok(r.status === 200, 'delete unused custom role');

  console.log('Exports');
  r = await api('GET', '/api/export/csv', { token: desk });
  ok(r.status === 200 && r.data.toString().includes('VST-'), 'csv export (entry_boy has visitors.export)');
  const inj = await api('POST', '/api/visitors', { token: desk, form: visitorForm({ name: '=HYPERLINK("http://evil","x")' }) });
  r = await api('GET', '/api/export/csv', { token: T });
  ok(r.data.toString().includes(`"'=HYPERLINK`) && !r.data.toString().includes(',"=HYPERLINK'), 'csv formula injection neutralised');
  r = await api('GET', '/api/export/excel', { token: T });
  ok(r.status === 200 && r.data.slice(0, 2).toString() === 'PK', 'xlsx export');
  r = await api('GET', '/api/export/pdf', { token: T });
  ok(r.status === 200 && r.data.slice(0, 4).toString() === '%PDF', 'pdf export');
  r = await api('GET', '/api/export/csv', { token: emp });
  ok(r.status === 403, 'employee cannot export');
  void inj;

  console.log('Security');
  // reset token must never work as a session
  r = await api('POST', '/api/auth/forgot-password/verify', { json: { role: 'employee', username: 'zz_smoke_emp', email: 'zz_smoke_emp@example.com' } });
  ok(r.status === 200 && r.data.resetToken, 'forgot-password verify works for non-admin');
  const rt = r.data.resetToken;
  r = await api('GET', '/api/auth/me', { token: rt });
  ok(r.status === 401, 'reset token is NOT accepted as a login session');
  r = await api('POST', '/api/auth/forgot-password/verify', { json: { role: 'admin', username: ADMIN_USER, email: 'x@y.com' } });
  ok(r.status === 403, 'admin account cannot use self-service reset');
  r = await api('POST', '/api/auth/forgot-password/reset', { json: { resetToken: rt, new_password: 'NewPassw0rd!', confirm_password: 'NewPassw0rd!' } });
  ok(r.status === 200, 'reset with token');
  r = await api('POST', '/api/auth/forgot-password/reset', { json: { resetToken: rt, new_password: 'Another0ne!!', confirm_password: 'Another0ne!!' } });
  ok(r.status === 422, 'reset token is single-use');
  r = await api('GET', '/api/auth/me', { token: emp });
  ok(r.status === 401, 'old session invalidated after password reset');
  r = await api('POST', '/api/auth/login', { json: { username: 'ZZ_SMOKE_EMP', password: 'NewPassw0rd!' } });
  ok(r.status === 200, 'login works with new password (username case-insensitive)');
  r = await api('POST', '/api/auth/change-password', { token: desk, json: { current_password: 'nope', new_password: 'Whatever123!' } });
  ok(r.status === 400, 'wrong current password -> 400 (not 401, so UI is not logged out)');

  console.log('User admin safeguards');
  r = await api('PUT', `/api/users/${(await api('GET', '/api/auth/me', { token: T })).data.user.id}`, { token: T, json: { role: 'employee' } });
  ok(r.status === 400, 'cannot demote the last admin');
  r = await api('PUT', `/api/users/${deskId}`, { token: T, json: { status: 'banana' } });
  ok(r.status === 422, 'invalid status rejected (was a 500)');
  r = await api('DELETE', `/api/users/${deskId}`, { token: T });
  ok(r.status === 200, 'delete a user who created visitors (was an FK 500)');
  r = await api('GET', '/api/visitors?q=zz_smoke&pageSize=1', { token: T });
  ok(r.status === 200 && r.data.total > 0, 'their visitor records survive');

  console.log('Cleanup');
  r = await api('GET', '/api/visitors?q=zz_smoke&pageSize=200', { token: T });
  for (const v of r.data.data) await api('DELETE', `/api/visitors/${v.id}`, { token: T });
  const inj2 = await api('GET', '/api/visitors?q=HYPERLINK&pageSize=50', { token: T });
  for (const v of inj2.data.data) await api('DELETE', `/api/visitors/${v.id}`, { token: T });
  await api('DELETE', `/api/users/${empId}`, { token: T });

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
