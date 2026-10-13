// VistaraX - Visitor CRUD, check-in/out, search, delete, photo upload
const express = require('express');
const { one, query, run, withTransaction, logAudit } = require('../db');
const { requireAuth, requirePermission, requireRole } = require('../middleware/auth');
const { upload, verifyUploadedImage, removeUpload } = require('../middleware/upload');
const { visitorValidators, visitorUpdateValidators, handleValidation } = require('../utils/validators');
const { emitEvent } = require('../socket');
const { localDate, isValidDateStr, dayName, likeEscape, numOrNull, asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// Atomic, never-reused serial number. The counter row is locked for the
// duration of the surrounding transaction, so two simultaneous check-ins can
// not get the same number, and deleting visitors can not cause a repeat
// (the old COUNT(*)+1 approach crashed with a UNIQUE error after any delete).
async function nextSerial(tx, year) {
  await tx.run(
    'INSERT INTO serial_counters (year, last_seq) VALUES (?, 1) ON DUPLICATE KEY UPDATE last_seq = last_seq + 1',
    [year]
  );
  const row = await tx.one('SELECT last_seq FROM serial_counters WHERE year = ?', [year]);
  return `VST-${year}-${String(row.last_seq).padStart(6, '0')}`;
}

// --- LIST / SEARCH -----------------------------------------------------
router.get('/', requirePermission('visitors.view'), asyncHandler(async (req, res) => {
  const { q, status, from, to, purpose, whom } = req.query;
  const clauses = [];
  const params = [];

  if (q) {
    const like = `%${likeEscape(String(q).slice(0, 100))}%`;
    clauses.push('(name LIKE ? OR contact_no LIKE ? OR whatsapp_no LIKE ? OR aadhaar_no LIKE ? OR serial_no LIKE ? OR whom_to_visit LIKE ? OR purpose LIKE ? OR address LIKE ?)');
    for (let i = 0; i < 8; i += 1) params.push(like);
  }
  if (status && status !== 'all') { clauses.push('status = ?'); params.push(String(status)); }
  if (purpose && purpose !== 'all') { clauses.push('purpose = ?'); params.push(String(purpose)); }
  if (whom && whom !== 'all') { clauses.push('whom_to_visit = ?'); params.push(String(whom)); }
  if (from && isValidDateStr(from)) { clauses.push('visit_date >= ?'); params.push(from); }
  if (to && isValidDateStr(to)) { clauses.push('visit_date <= ?'); params.push(to); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 20, 1), 200);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * limit;

  const { c: total } = await one(`SELECT COUNT(*) AS c FROM visitors ${where}`, params);
  const rows = await query(`SELECT * FROM visitors ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data: rows, total, page, pageSize: limit });
}));

// --- DASHBOARD STATS (before /:id so "stats" isn't parsed as an id) -----
router.get('/stats/summary', requirePermission('dashboard.view'), asyncHandler(async (req, res) => {
  const today = localDate(0);
  const monthPrefix = today.slice(0, 7);

  const todayCount = (await one('SELECT COUNT(*) c FROM visitors WHERE visit_date = ?', [today])).c;
  const inside = (await one("SELECT COUNT(*) c FROM visitors WHERE status = 'inside'")).c;
  const checkedOutToday = (await one("SELECT COUNT(*) c FROM visitors WHERE visit_date = ? AND status = 'checked_out'", [today])).c;
  const monthTotal = (await one("SELECT COUNT(*) c FROM visitors WHERE DATE_FORMAT(visit_date, '%Y-%m') = ?", [monthPrefix])).c;

  const last7 = await query(
    'SELECT visit_date AS date, COUNT(*) AS count FROM visitors WHERE visit_date >= ? GROUP BY visit_date ORDER BY visit_date ASC',
    [localDate(-6)]
  );
  const byPurpose = await query(
    `SELECT COALESCE(NULLIF(purpose, ''), 'Not specified') AS purpose, COUNT(*) AS count
     FROM visitors WHERE visit_date = ? GROUP BY COALESCE(NULLIF(purpose, ''), 'Not specified')`,
    [today]
  );
  res.json({ todayCount, inside, checkedOutToday, monthTotal, last7, byPurpose });
}));

// --- LOOKUP EXISTING VISITOR BY AADHAAR (return latest record only) --------
router.get('/lookup/aadhaar', requirePermission('visitors.view'), asyncHandler(async (req, res) => {
  const aadhaar = String(req.query.aadhaar || '').trim();
  if (!/^\d{12}$/.test(aadhaar)) return res.status(422).json({ error: 'Enter a valid 12-digit Aadhaar number.' });
  const visitor = await one('SELECT id, name, contact_no, whatsapp_no, companions, vehicle_no, remarks FROM visitors WHERE aadhaar_no = ? ORDER BY id DESC LIMIT 1', [aadhaar]);
  res.json({ visitor: visitor || null });
}));

// --- SINGLE VISITOR -------------------------------------------------------
router.get('/:id', requirePermission('visitors.view'), asyncHandler(async (req, res) => {
  const visitor = await one('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });
  const history = await query(
    `SELECT id, visit_date, checkin_time, checkout_time, whom_to_visit, purpose FROM visitors
     WHERE contact_no = ? AND id != ? ORDER BY id DESC LIMIT 20`,
    [visitor.contact_no, visitor.id]
  );
  res.json({ visitor, history });
}));

// --- CREATE ----------------------------------------------------------------
router.post('/', requirePermission('visitors.manage'), upload.single('photo'), verifyUploadedImage,
  visitorValidators, handleValidation, asyncHandler(async (req, res) => {
    const b = req.body;
    const special = String(b.visitor_type || 'regular') === 'special';
    if (special && req.user.role !== 'admin') { if (req.file) removeUpload(`/uploads/visitors/${req.file.filename}`); return res.status(403).json({ error: 'Only an administrator can register special visitors.' }); }
    if (!String(b.name || '').trim() || !String(b.whom_to_visit || '').trim()) return res.status(422).json({ error: 'Name and whom-to-visit are required.' });
    if (!special && (!/^[0-9+\-\s()]{6,20}$/.test(String(b.contact_no || '').trim()) || !/^\d{12}$/.test(String(b.aadhaar_no || '').trim()))) return res.status(422).json({ error: 'Regular visitors require a valid contact number and 12-digit Aadhaar number.' });
    const visitDate = b.visit_date || localDate(0);
    const cleanup = () => req.file && removeUpload(`/uploads/visitors/${req.file.filename}`);

    if (!isValidDateStr(visitDate)) { cleanup(); return res.status(422).json({ error: 'visit_date is not a valid date.' }); }

    const settings = await one('SELECT photo_required FROM settings WHERE id = 1');
    if (!special && settings && settings.photo_required && !req.file) {
      return res.status(422).json({ error: 'A visitor photo is required.' });
    }

    const photoUrl = req.file ? `/uploads/visitors/${req.file.filename}` : null;
    let visitorId;
    try {
      visitorId = await withTransaction(async (tx) => {
        const serial = await nextSerial(tx, Number(visitDate.slice(0, 4)) || new Date().getFullYear());
        const info = await tx.run(
          `INSERT INTO visitors
            (serial_no, name, contact_no, whatsapp_no, aadhaar_no, companions, whom_to_visit, purpose, vehicle_no, visitor_type,
             checkin_time, photo_url, latitude, longitude, address, visit_date, visit_day, remarks, status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'inside', ?)`,
          [serial, b.name, b.contact_no || null, b.whatsapp_no || null, b.aadhaar_no || null, b.companions || null, b.whom_to_visit,
            b.purpose || null, b.vehicle_no || null, special ? 'special' : 'regular', new Date(), photoUrl, numOrNull(b.latitude), numOrNull(b.longitude), b.address || null,
            visitDate, dayName(visitDate), b.remarks || null, req.user.id]
        );
        await tx.run(
          "INSERT INTO notifications (type, title, message, visitor_id) VALUES ('checkin', ?, ?, ?)",
          ['New visitor checked in', `${b.name} has checked in to see ${b.whom_to_visit}.`.slice(0, 500), info.insertId]
        );
        return info.insertId;
      });
    } catch (e) { cleanup(); throw e; }

    const visitor = await one('SELECT * FROM visitors WHERE id = ?', [visitorId]);
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'visitors', recordId: visitor.id, ip: req.ip });
    emitEvent('visitor:checkin', visitor);
    res.status(201).json({ visitor });
  }));

// --- UPDATE ------------------------------------------------------------------
router.put('/:id', requirePermission('visitors.manage'), upload.single('photo'), verifyUploadedImage,
  visitorUpdateValidators, handleValidation, asyncHandler(async (req, res) => {
    const visitor = await one('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
    if (!visitor) {
      if (req.file) removeUpload(`/uploads/visitors/${req.file.filename}`);
      return res.status(404).json({ error: 'Visitor not found.' });
    }
    const b = req.body;
    let photoUrl = visitor.photo_url;
    if (req.file) {
      removeUpload(visitor.photo_url);
      photoUrl = `/uploads/visitors/${req.file.filename}`;
    }

    await run(
      `UPDATE visitors SET name = ?, contact_no = ?, whatsapp_no = ?, aadhaar_no = ?, companions = ?, whom_to_visit = ?,
         purpose = ?, vehicle_no = ?, photo_url = ?, latitude = ?, longitude = ?, address = ?, remarks = ? WHERE id = ?`,
      [
        b.name ?? visitor.name, b.contact_no ?? visitor.contact_no, b.whatsapp_no ?? visitor.whatsapp_no,
        b.aadhaar_no !== undefined ? String(b.aadhaar_no).trim() : visitor.aadhaar_no,
        b.companions ?? visitor.companions, b.whom_to_visit ?? visitor.whom_to_visit, b.purpose ?? visitor.purpose,
        b.vehicle_no ?? visitor.vehicle_no, photoUrl,
        b.latitude !== undefined ? numOrNull(b.latitude) : visitor.latitude,
        b.longitude !== undefined ? numOrNull(b.longitude) : visitor.longitude,
        b.address ?? visitor.address, b.remarks ?? visitor.remarks, visitor.id,
      ]
    );
    const updated = await one('SELECT * FROM visitors WHERE id = ?', [visitor.id]);
    await logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'visitors', recordId: visitor.id, ip: req.ip });
    emitEvent('visitor:updated', updated);
    res.json({ visitor: updated });
  }));

// --- CHECK OUT -----------------------------------------------------------------
router.post('/:id/checkout', requirePermission('visitors.manage'), asyncHandler(async (req, res) => {
  const visitor = await one('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });

  const remarks = req.body?.remarks ? String(req.body.remarks).trim().slice(0, 500) : null;
  // Conditional UPDATE: if two staff click "check out" at once only one wins.
  const r = await run(
    "UPDATE visitors SET status = 'checked_out', checkout_time = ?, checkout_remarks = ? WHERE id = ? AND status = 'inside'",
    [new Date(), remarks || null, visitor.id]
  );
  if (r.affectedRows === 0) return res.status(409).json({ error: 'Visitor is already checked out.' });

  const updated = await one('SELECT * FROM visitors WHERE id = ?', [visitor.id]);
  await run("INSERT INTO notifications (type, title, message, visitor_id) VALUES ('checkout', ?, ?, ?)",
    ['Visitor checked out', `${updated.name} checked out.`.slice(0, 500), updated.id]);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'CHECKOUT', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:checkout', updated);
  res.json({ visitor: updated });
}));

// --- DELETE SINGLE -------------------------------------------------------------
router.delete('/:id', requirePermission('visitors.delete'), asyncHandler(async (req, res) => {
  const visitor = await one('SELECT * FROM visitors WHERE id = ?', [req.params.id]);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });
  await run('DELETE FROM visitors WHERE id = ?', [visitor.id]);
  removeUpload(visitor.photo_url);
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:deleted', { id: visitor.id });
  res.json({ ok: true });
}));

// --- DELETE ALL (admin only, explicit confirm phrase) ---------------------------
router.post('/delete-all', requireRole('admin'), asyncHandler(async (req, res) => {
  if ((req.body || {}).confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm this irreversible action.' });
  }
  const photos = await query('SELECT photo_url FROM visitors WHERE photo_url IS NOT NULL');
  const r = await run('DELETE FROM visitors');
  photos.forEach((p) => removeUpload(p.photo_url));
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE_ALL', module: 'visitors', recordId: `${r.affectedRows} records`, ip: req.ip });
  emitEvent('visitor:delete-all', {});
  res.json({ ok: true, deleted: r.affectedRows });
}));

module.exports = router;
