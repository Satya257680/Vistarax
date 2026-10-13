// VistaraX - small shared helpers
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';

// 'YYYY-MM-DD' for "now + offsetDays" in the business timezone (not UTC, so the
// dashboard "today" flips at local midnight instead of 05:30 IST).
function localDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: APP_TIMEZONE });
}

function isValidDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Weekday name computed in UTC so the result never shifts with server timezone.
function dayName(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

// Escapes LIKE wildcards so a search for "100%" or "a_b" is literal.
function likeEscape(s) {
  return String(s).replace(/[\\%_]/g, (m) => `\\${m}`);
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Neutralises spreadsheet formula injection (=, +, -, @, tab, CR at cell start).
function csvSafe(v) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toIso(v) {
  if (!v) return '';
  return v instanceof Date ? v.toISOString() : String(v);
}

// express (v4) does not catch rejected promises - wrap every async handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { APP_TIMEZONE, localDate, isValidDateStr, dayName, likeEscape, numOrNull, csvSafe, toIso, asyncHandler };
