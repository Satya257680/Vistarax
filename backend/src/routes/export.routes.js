// VistaraX - Export visitors as CSV / Excel / PDF (with photos)
const express = require('express');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const { one, query, logAudit } = require('../db');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { UPLOAD_DIR } = require('../middleware/upload');
const { APP_TIMEZONE, isValidDateStr, csvSafe, toIso, asyncHandler } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, requirePermission('visitors.export'));

async function getRows({ from, to, status }) {
  const clauses = [];
  const params = [];
  if (from && isValidDateStr(from)) { clauses.push('visit_date >= ?'); params.push(from); }
  if (to && isValidDateStr(to)) { clauses.push('visit_date <= ?'); params.push(to); }
  if (status && status !== 'all') { clauses.push('status = ?'); params.push(String(status)); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return query(`SELECT * FROM visitors ${where} ORDER BY id DESC`, params);
}

const HEADERS = ['Serial No', 'Name', 'Contact', 'WhatsApp', 'Aadhaar No', 'Companions', 'Whom To Visit', 'Purpose',
  'Check-in', 'Check-out', 'Status', 'Address', 'Latitude', 'Longitude', 'Visit Date', 'Day', 'Remarks', 'Checkout Remarks'];
const toLine = (v) => [v.serial_no, v.name, v.contact_no, v.whatsapp_no || '', v.aadhaar_no || '', v.companions || '', v.whom_to_visit,
  v.purpose || '', toIso(v.checkin_time), toIso(v.checkout_time), v.status, v.address || '', v.latitude ?? '', v.longitude ?? '',
  v.visit_date, v.visit_day, v.remarks || '', v.checkout_remarks || ''];

router.get('/csv', asyncHandler(async (req, res) => {
  const rows = await getRows(req.query);
  const out = [HEADERS.map(csvSafe).join(',')];
  rows.forEach((v) => out.push(toLine(v).map(csvSafe).join(',')));
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_CSV', module: 'visitors', ip: req.ip });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="visitors.csv"');
  res.send(`\uFEFF${out.join('\r\n')}`); // BOM so Excel reads UTF-8 names correctly
}));

router.get('/excel', asyncHandler(async (req, res) => {
  const rows = (await getRows(req.query)).map((v) => Object.fromEntries(HEADERS.map((h, i) => [h, toLine(v)[i]])));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows, { header: HEADERS }), 'Visitors');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  await logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_EXCEL', module: 'visitors', ip: req.ip });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="visitors.xlsx"');
  res.send(buf);
}));

router.get('/pdf', asyncHandler(async (req, res) => {
  const rows = await getRows(req.query);
  const settings = await one('SELECT company_name FROM settings WHERE id = 1');
  const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: APP_TIMEZONE }) : '-');

  await logAudit({ userId: req.user.id, username: req.user.username, action: 'EXPORT_PDF', module: 'visitors', ip: req.ip });
  const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="visitor-register.pdf"');
  doc.pipe(res);

  doc.fontSize(18).fillColor('#1e293b').text((settings && settings.company_name) || 'VistaraX', { align: 'center' });
  doc.fontSize(11).fillColor('#64748b').text('Visitor Register', { align: 'center' });
  doc.moveDown(1);

  const colX = [30, 65, 130, 250, 340, 440, 540, 620, 700, 760];
  const heads = ['#', 'Photo', 'Name', 'Contact', 'Whom Visit', 'Purpose', 'Check-in', 'Check-out', 'Status'];
  let y = doc.y;
  doc.fontSize(9).fillColor('#0f172a');
  heads.forEach((h, i) => doc.text(h, colX[i], y, { width: (colX[i + 1] || 820) - colX[i] - 4 }));
  doc.moveTo(30, y + 14).lineTo(800, y + 14).strokeColor('#cbd5e1').stroke();
  y += 20;

  rows.forEach((v, idx) => {
    if (y > 520) { doc.addPage(); y = 40; }
    if (v.photo_url) {
      const photoPath = path.join(UPLOAD_DIR, path.basename(v.photo_url));
      try { if (fs.existsSync(photoPath)) doc.image(photoPath, colX[1], y, { fit: [28, 28] }); } catch (e) { /* skip broken image */ }
    }
    doc.fontSize(8).fillColor('#334155');
    doc.text(String(idx + 1), colX[0], y + 8);
    doc.text(v.name, colX[2], y + 8, { width: colX[3] - colX[2] - 4 });
    doc.text(v.contact_no, colX[3], y + 8, { width: colX[4] - colX[3] - 4 });
    doc.text(v.whom_to_visit, colX[4], y + 8, { width: colX[5] - colX[4] - 4 });
    doc.text(v.purpose || '-', colX[5], y + 8, { width: colX[6] - colX[5] - 4 });
    doc.text(fmt(v.checkin_time), colX[6], y + 8, { width: colX[7] - colX[6] - 4 });
    doc.text(fmt(v.checkout_time), colX[7], y + 8, { width: colX[8] - colX[7] - 4 });
    doc.text(v.status === 'inside' ? 'Inside' : 'Checked out', colX[8], y + 8, { width: 60 });
    y += 34;
  });
  doc.end();
}));

module.exports = router;
