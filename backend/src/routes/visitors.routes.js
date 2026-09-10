// VistaraX - Visitor CRUD, check-in/out, search, delete, photo upload
const express = require('express');
const path = require('path');
const fs = require('fs');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { visitorValidators, handleValidation } = require('../utils/validators');
const { emitEvent } = require('../socket');

const router = express.Router();
router.use(requireAuth);

function nextSerial() {
  const year = new Date().getFullYear();
  const row = db
    .prepare(`SELECT COUNT(*) as c FROM visitors WHERE serial_no LIKE ?`)
    .get(`VST-${year}-%`);
  const seq = String(row.c + 1).padStart(6, '0');
  return `VST-${year}-${seq}`;
}

function dayName(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
}

// --- LIST / SEARCH -----------------------------------------------------
router.get('/', (req, res) => {
  const { q, status, from, to, purpose, whom, page = 1, pageSize = 20 } = req.query;
  const clauses = [];
  const params = [];

  if (q) {
    clauses.push(
      `(name LIKE ? OR contact_no LIKE ? OR whatsapp_no LIKE ? OR serial_no LIKE ? OR whom_to_visit LIKE ? OR purpose LIKE ? OR address LIKE ?)`
    );
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like);
  }
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  if (purpose && purpose !== 'all') {
    clauses.push('purpose = ?');
    params.push(purpose);
  }
  if (whom && whom !== 'all') {
    clauses.push('whom_to_visit = ?');
    params.push(whom);
  }
  if (from) {
    clauses.push('visit_date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('visit_date <= ?');
    params.push(to);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as c FROM visitors ${where}`).get(...params).c;

  const limit = Math.min(parseInt(pageSize, 10) || 20, 200);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;

  const rows = db
    .prepare(`SELECT * FROM visitors ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
});

// --- DASHBOARD STATS -----------------------------------------------------
router.get('/stats/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);

  const todayCount = db.prepare(`SELECT COUNT(*) c FROM visitors WHERE visit_date = ?`).get(today).c;
  const inside = db.prepare(`SELECT COUNT(*) c FROM visitors WHERE status = 'inside'`).get().c;
  const checkedOutToday = db
    .prepare(`SELECT COUNT(*) c FROM visitors WHERE visit_date = ? AND status = 'checked_out'`)
    .get(today).c;
  const monthTotal = db
    .prepare(`SELECT COUNT(*) c FROM visitors WHERE visit_date LIKE ?`)
    .get(`${monthPrefix}%`).c;

  const last7 = db
    .prepare(
      `SELECT visit_date as date, COUNT(*) as count FROM visitors
       WHERE visit_date >= date('now','-6 days') GROUP BY visit_date ORDER BY visit_date ASC`
    )
    .all();

  const byPurpose = db
    .prepare(
      `SELECT COALESCE(NULLIF(purpose,''),'Not specified') as purpose, COUNT(*) as count
       FROM visitors WHERE visit_date = ? GROUP BY purpose`
    )
    .all(today);

  res.json({
    todayCount,
    inside,
    checkedOutToday,
    monthTotal,
    last7,
    byPurpose,
  });
});

// --- SINGLE VISITOR -------------------------------------------------------
router.get('/:id', (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });

  // Visit history for the same contact number
  const history = db
    .prepare(
      `SELECT id, visit_date, checkin_time, checkout_time, whom_to_visit, purpose FROM visitors
       WHERE contact_no = ? AND id != ? ORDER BY id DESC LIMIT 20`
    )
    .all(visitor.contact_no, visitor.id);

  res.json({ visitor, history });
});

// --- CREATE ----------------------------------------------------------------
router.post('/', upload.single('photo'), visitorValidators, handleValidation, (req, res) => {
  const b = req.body;
  const now = new Date();
  const visitDate = b.visit_date || now.toISOString().slice(0, 10);

  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
  if (settings.photo_required && !req.file) {
    return res.status(422).json({ error: 'A visitor photo is required.' });
  }

  const serial = nextSerial();
  const photoUrl = req.file ? `/uploads/visitors/${req.file.filename}` : null;

  const info = db
    .prepare(
      `INSERT INTO visitors
        (serial_no, name, contact_no, whatsapp_no, companions, whom_to_visit, purpose,
         checkin_time, photo_url, latitude, longitude, address, visit_date, visit_day, remarks, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'inside', ?)`
    )
    .run(
      serial,
      b.name,
      b.contact_no,
      b.whatsapp_no || null,
      b.companions || null,
      b.whom_to_visit,
      b.purpose || null,
      now.toISOString(),
      photoUrl,
      b.latitude || null,
      b.longitude || null,
      b.address || null,
      visitDate,
      dayName(visitDate),
      b.remarks || null,
      req.user.id
    );

  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(info.lastInsertRowid);

  db.prepare(
    `INSERT INTO notifications (type, title, message, visitor_id) VALUES ('checkin', ?, ?, ?)`
  ).run('New visitor checked in', `${visitor.name} has checked in to see ${visitor.whom_to_visit}.`, visitor.id);

  logAudit({ userId: req.user.id, username: req.user.username, action: 'CREATE', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:checkin', visitor);

  res.status(201).json({ visitor });
});

// --- UPDATE ------------------------------------------------------------------
router.put('/:id', upload.single('photo'), (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });

  const b = req.body;
  let photoUrl = visitor.photo_url;
  if (req.file) {
    // remove old photo file
    if (visitor.photo_url) {
      const oldPath = path.join(__dirname, '..', '..', visitor.photo_url.replace(/^\//, ''));
      fs.existsSync(oldPath) && fs.unlink(oldPath, () => {});
    }
    photoUrl = `/uploads/visitors/${req.file.filename}`;
  }

  db.prepare(
    `UPDATE visitors SET
      name = ?, contact_no = ?, whatsapp_no = ?, companions = ?, whom_to_visit = ?, purpose = ?,
      photo_url = ?, latitude = ?, longitude = ?, address = ?, remarks = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    b.name ?? visitor.name,
    b.contact_no ?? visitor.contact_no,
    b.whatsapp_no ?? visitor.whatsapp_no,
    b.companions ?? visitor.companions,
    b.whom_to_visit ?? visitor.whom_to_visit,
    b.purpose ?? visitor.purpose,
    photoUrl,
    b.latitude ?? visitor.latitude,
    b.longitude ?? visitor.longitude,
    b.address ?? visitor.address,
    b.remarks ?? visitor.remarks,
    visitor.id
  );

  const updated = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitor.id);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'UPDATE', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:updated', updated);
  res.json({ visitor: updated });
});

// --- CHECK OUT -----------------------------------------------------------------
router.post('/:id/checkout', (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });
  if (visitor.status === 'checked_out') {
    return res.status(409).json({ error: 'Visitor is already checked out.' });
  }
  db.prepare(
    `UPDATE visitors SET status = 'checked_out', checkout_time = datetime('now'), updated_at = datetime('now') WHERE id = ?`
  ).run(visitor.id);
  const updated = db.prepare('SELECT * FROM visitors WHERE id = ?').get(visitor.id);

  db.prepare(
    `INSERT INTO notifications (type, title, message, visitor_id) VALUES ('checkout', ?, ?, ?)`
  ).run('Visitor checked out', `${updated.name} checked out.`, updated.id);

  logAudit({ userId: req.user.id, username: req.user.username, action: 'CHECKOUT', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:checkout', updated);
  res.json({ visitor: updated });
});

// --- DELETE SINGLE (any staff can delete their own workflow entries; enforce admin for safety) ---
router.delete('/:id', requireRole('admin', 'entry_boy'), (req, res) => {
  const visitor = db.prepare('SELECT * FROM visitors WHERE id = ?').get(req.params.id);
  if (!visitor) return res.status(404).json({ error: 'Visitor not found.' });

  if (visitor.photo_url) {
    const p = path.join(__dirname, '..', '..', visitor.photo_url.replace(/^\//, ''));
    fs.existsSync(p) && fs.unlink(p, () => {});
  }
  db.prepare('DELETE FROM visitors WHERE id = ?').run(visitor.id);
  logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE', module: 'visitors', recordId: visitor.id, ip: req.ip });
  emitEvent('visitor:deleted', { id: visitor.id });
  res.json({ ok: true });
});

// --- DELETE ALL (admin only, requires explicit confirm phrase) ---------------
router.post('/delete-all', requireRole('admin'), (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE to confirm this irreversible action.' });
  }
  const rows = db.prepare('SELECT photo_url FROM visitors').all();
  rows.forEach((r) => {
    if (r.photo_url) {
      const p = path.join(__dirname, '..', '..', r.photo_url.replace(/^\//, ''));
      fs.existsSync(p) && fs.unlink(p, () => {});
    }
  });
  const count = db.prepare('SELECT COUNT(*) c FROM visitors').get().c;
  db.prepare('DELETE FROM visitors').run();
  logAudit({ userId: req.user.id, username: req.user.username, action: 'DELETE_ALL', module: 'visitors', recordId: `${count} records`, ip: req.ip });
  emitEvent('visitor:delete-all', {});
  res.json({ ok: true, deleted: count });
});

module.exports = router;
