// VistaraX - Export visitors as CSV / Excel / PDF (with photos)
const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { db, logAudit } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

function getRows(query) {
  const { from, to, status } = query;
  const clauses = [];
  const params = [];
  if (from) {
    clauses.push('visit_date >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('visit_date <= ?');
    params.push(to);
  }
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM visitors ${where} ORDER BY id DESC`).all(...params);
}

router.get('/csv', (req, res) => {
  const rows = getRows(req.query);
  const headers = [
    'Serial No', 'Name', 'Contact', 'WhatsApp', 'Companions', 'Whom To Visit', 'Purpose',
    'Check-in', 'Check-out', 'Status', 'Address', 'Visit Date', 'Day', 'Remarks',
  ];
  const csvRows = [headers.join(',')];
  rows.forEach((v) => {
    const line = [
      v.serial_no, v.name, v.contact_no, v.whatsapp_no || '', v.companions || '', v.whom_to_visit,
      v.purpose || '', v.checkin_time, v.checkout_time || '', v.status, (v.address || '').replace(/,/g, ';'),
      v.visit_date, v.visit_day, (v.remarks || '').replace(/,/g, ';'),
    ].map((val) => `"${String(val).replace(/"/g, '""')}"`);
    csvRows.push(line.join(','));
  });
  logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_CSV', module: 'visitors', ip: req.ip });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="visitors.csv"');
  res.send(csvRows.join('\n'));
});

router.get('/excel', (req, res) => {
  const rows = getRows(req.query).map((v) => ({
    'Serial No': v.serial_no,
    Name: v.name,
    Contact: v.contact_no,
    WhatsApp: v.whatsapp_no || '',
    Companions: v.companions || '',
    'Whom To Visit': v.whom_to_visit,
    Purpose: v.purpose || '',
    'Check-in': v.checkin_time,
    'Check-out': v.checkout_time || '',
    Status: v.status,
    Address: v.address || '',
    'Visit Date': v.visit_date,
    Day: v.visit_day,
    Remarks: v.remarks || '',
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Visitors');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_EXCEL', module: 'visitors', ip: req.ip });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="visitors.xlsx"');
  res.send(buf);
});

router.get('/pdf', (req, res) => {
  const rows = getRows(req.query);
  const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();

  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="visitor-register.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor('#1e293b').text(settings.company_name || 'VistaraX', { align: 'center' });
  doc.fontSize(11).fillColor('#64748b').text('Visitor Register', { align: 'center' });
  doc.moveDown(1);

  const colX = [30, 65, 130, 250, 340, 440, 540, 620, 700, 760];
  const headers = ['#', 'Photo', 'Name', 'Contact', 'Whom Visit', 'Purpose', 'Check-in', 'Check-out', 'Status'];
  let y = doc.y;
  doc.fontSize(9).fillColor('#0f172a');
  headers.forEach((h, i) => doc.text(h, colX[i], y, { width: (colX[i + 1] || 820) - colX[i] - 4 }));
  doc.moveTo(30, y + 14).lineTo(800, y + 14).strokeColor('#cbd5e1').stroke();
  y += 20;

  rows.forEach((v, idx) => {
    if (y > 520) {
      doc.addPage();
      y = 40;
    }
    const photoPath = v.photo_url ? path.join(__dirname, '..', '..', v.photo_url.replace(/^\//, '')) : null;
    try {
      if (photoPath && fs.existsSync(photoPath)) {
        doc.image(photoPath, colX[1], y, { width: 28, height: 28, fit: [28, 28] });
      }
    } catch (e) { /* skip broken images */ }

    doc.fontSize(8).fillColor('#334155');
    doc.text(String(idx + 1), colX[0], y + 8);
    doc.text(v.name, colX[2], y + 8, { width: colX[3] - colX[2] - 4 });
    doc.text(v.contact_no, colX[3], y + 8, { width: colX[4] - colX[3] - 4 });
    doc.text(v.whom_to_visit, colX[4], y + 8, { width: colX[5] - colX[4] - 4 });
    doc.text(v.purpose || '-', colX[5], y + 8, { width: colX[6] - colX[5] - 4 });
    doc.text(new Date(v.checkin_time).toLocaleString(), colX[6], y + 8, { width: colX[7] - colX[6] - 4 });
    doc.text(v.checkout_time ? new Date(v.checkout_time).toLocaleString() : '-', colX[7], y + 8, { width: colX[8] - colX[7] - 4 });
    doc.text(v.status === 'inside' ? 'Inside' : 'Checked out', colX[8], y + 8, { width: 60 });

    y += 34;
  });

  logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_PDF', module: 'visitors', ip: req.ip });
  doc.end();
});

module.exports = router;
