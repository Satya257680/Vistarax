// VistaraX - Premium visitor pass and visitor register printing.
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client, { API_URL } from '../api/client.js';

const assetUrl = (path) => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL.replace(/\/$/, '')}/${String(path).replace(/^\//, '')}`;
};

const displayDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

function VisitorPass({ visitor, company }) {
  const photo = assetUrl(visitor.photo_url);
  return (
    <article className="vx-pass">
      <header className="vx-pass-header">
        <div className="vx-brand">
          <span className="vx-brand-mark" aria-hidden="true">V</span>
          <span className="vx-brand-copy">
            <strong>{company || 'VistaraX'}</strong>
            <small>VISITOR MANAGEMENT</small>
          </span>
        </div>
        <div className="vx-pass-label">VISITOR<br />PASS</div>
      </header>

      <div className="vx-pass-body">
        <div className="vx-photo-frame">
          {photo ? (
            <img
              src={photo}
              alt={`${visitor.name} visitor photograph`}
              className="vx-visitor-photo"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
                event.currentTarget.nextElementSibling?.classList.remove('vx-hidden');
              }}
            />
          ) : null}
          <div className={`vx-photo-placeholder ${photo ? 'vx-hidden' : ''}`}>
            <span>{String(visitor.name || 'V').trim().charAt(0).toUpperCase()}</span>
            <small>{photo ? 'Photo unavailable' : 'No photo'}</small>
          </div>
        </div>

        <div className="vx-visitor-details">
          <div className="vx-pass-number">
            <span>PASS NUMBER</span>
            <strong>{visitor.serial_no || `VST-${visitor.id}`}</strong>
          </div>
          <h1>{visitor.name || 'Visitor'}</h1>
          {visitor.visitor_type === 'special' && <span className="vx-special-tag">SPECIAL VISITOR</span>}
          <dl>
            <div><dt>HOST</dt><dd>{visitor.whom_to_visit || '—'}</dd></div>
            <div><dt>PURPOSE</dt><dd>{visitor.purpose || 'Meeting'}</dd></div>
            {visitor.vehicle_no && <div><dt>VEHICLE</dt><dd>{visitor.vehicle_no}</dd></div>}
            <div><dt>ENTRY TIME</dt><dd>{displayDate(visitor.checkin_time)}</dd></div>
          </dl>
        </div>
      </div>

      <footer className="vx-pass-footer">
        <span>PLEASE DISPLAY THIS PASS WHILE ON THE PREMISES</span>
        <span className="vx-footer-dot" aria-hidden="true" />
      </footer>
    </article>
  );
}

export default function Print() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [company, setCompany] = useState('VistaraX');
  const [loadError, setLoadError] = useState('');
  const passMode = params.get('pass') === '1';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const ids = params.get('ids');
        const settingsResult = await client.get('/settings');
        if (cancelled) return;
        setCompany(settingsResult.data?.settings?.company_name || 'VistaraX');

        let visitors = [];
        if (ids) {
          const results = await Promise.all(
            ids.split(',').filter(Boolean).map((id) => client.get(`/visitors/${encodeURIComponent(id)}`))
          );
          visitors = results.map((result) => result.data.visitor).filter(Boolean);
        } else {
          const { data } = await client.get('/visitors', { params: { pageSize: 200 } });
          visitors = data.data || [];
        }
        if (cancelled) return;
        setRows(visitors);

        // Wait for the React render and any uploaded visitor photo to load before
        // opening print preview, so the photograph is included in the pass.
        window.setTimeout(async () => {
          if (cancelled) return;
          const images = Array.from(document.querySelectorAll('.vx-visitor-photo'));
          await Promise.all(images.map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            });
          }));
          if (!cancelled) window.print();
        }, 350);
      } catch (error) {
        if (!cancelled) setLoadError(error.response?.data?.error || 'Unable to load visitor details. Please return and try again.');
      }
    }
    load();
    return () => { cancelled = true; };
    // Search params are intentionally read once when this print tab opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`vx-print-page ${passMode ? 'vx-pass-mode' : 'vx-register-mode'}`}>
      <style>{`
        * { box-sizing: border-box; }
        .vx-print-page { min-height:100vh; padding:30px; color:#eaf1ff; background:radial-gradient(ellipse at 15% 0%,#132d5a 0,transparent 40%),radial-gradient(ellipse at 90% 20%,#24184d 0,transparent 35%),#070b16; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        .vx-preview-heading { max-width:1100px; margin:0 auto 22px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
        .vx-preview-heading h2 { margin:0; font-size:22px; font-weight:750; letter-spacing:-.03em; }
        .vx-preview-heading p { margin:5px 0 0; color:#9caccb; font-size:13px; }
        .vx-print-action { border:1px solid rgba(255,255,255,.16); border-radius:12px; padding:10px 16px; color:white; background:linear-gradient(110deg,#1688ff,#8155f5); font-weight:700; cursor:pointer; box-shadow:0 8px 25px #316aff35; }
        .vx-preview-stage { max-width:1100px; margin:0 auto; padding:28px; display:flex; justify-content:center; align-items:flex-start; border:1px solid rgba(161,190,255,.16); border-radius:24px; background:linear-gradient(145deg,rgba(255,255,255,.055),rgba(255,255,255,.018)); box-shadow:0 24px 80px #0005; }
        .vx-pass { width:90mm; height:55mm; min-height:55mm; overflow:hidden; display:flex; flex-direction:column; position:relative; color:#fff; border-radius:3.2mm; background:linear-gradient(120deg,#061333 0%,#0b2260 47%,#201354 100%); border:1px solid #527cff; box-shadow:0 10px 32px rgba(0,0,0,.32); print-color-adjust:exact; -webkit-print-color-adjust:exact; }
        .vx-pass:before { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at 4% 100%,rgba(0,194,255,.35),transparent 40%),radial-gradient(ellipse at 98% 10%,rgba(153,91,255,.30),transparent 40%); }
        .vx-pass-header { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:8px; padding:3.2mm 3.5mm 2.5mm; border-bottom:1px solid rgba(154,187,255,.35); }
        .vx-brand { display:flex; align-items:center; min-width:0; gap:2mm; }
        .vx-brand-mark { width:8mm; height:8mm; flex:0 0 8mm; display:grid; place-items:center; border-radius:2mm; font-weight:900; font-size:17px; color:#fff; background:linear-gradient(145deg,#15baff,#4b6bff 55%,#a65cff); box-shadow:0 0 14px #4c7dff66; }
        .vx-brand-copy { min-width:0; display:flex; flex-direction:column; gap:.5mm; }
        .vx-brand-copy strong { font-size:12px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:-.03em; }
        .vx-brand-copy small { color:#a9c7ff; font-size:5.5px; letter-spacing:.12em; }
        .vx-pass-label { flex-shrink:0; text-align:right; font-size:9px; font-weight:900; line-height:1.2; letter-spacing:.17em; }
        .vx-pass-body { position:relative; z-index:1; flex:1; min-height:0; display:grid; grid-template-columns:22mm minmax(0,1fr); gap:3mm; padding:2.7mm 3.5mm 2mm; }
        .vx-photo-frame { height:27mm; width:22mm; overflow:hidden; align-self:start; border-radius:2mm; border:1px solid #8eb6ff; background:linear-gradient(145deg,#e8f3ff,#cbd8ff); box-shadow:0 0 0 1px #4d7cff55,0 3px 10px #0004; }
        .vx-visitor-photo { display:block; width:100%; height:100%; object-fit:cover; object-position:center top; }
        .vx-photo-placeholder { width:100%; height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; gap:2px; color:#243967; background:linear-gradient(145deg,#f0f6ff,#cbd8ff); }
        .vx-photo-placeholder span { font-size:25px; font-weight:800; }
        .vx-photo-placeholder small { font-size:6px; }
        .vx-hidden { display:none !important; }
        .vx-visitor-details { min-width:0; overflow:hidden; }
        .vx-pass-number { display:flex; flex-direction:column; gap:.6mm; margin-bottom:1mm; }
        .vx-pass-number span, .vx-visitor-details dt { color:#a7c5ff; font-size:5.5px; font-weight:800; letter-spacing:.12em; }
        .vx-pass-number strong { color:#ffc95e; font-size:8px; letter-spacing:.035em; }
        .vx-visitor-details h1 { margin:0 0 1mm; font-size:13px; line-height:1.1; font-weight:850; letter-spacing:-.035em; overflow-wrap:anywhere; }
        .vx-special-tag { display:inline-block; margin:0 0 1mm; padding:.5mm 1.2mm; border:1px solid #f3c76c88; border-radius:999px; color:#ffdb8a; font-size:5px; font-weight:800; letter-spacing:.08em; }
        .vx-visitor-details dl { display:grid; gap:1mm; margin:0; }
        .vx-visitor-details dl div { display:grid; grid-template-columns:14mm minmax(0,1fr); gap:1mm; align-items:baseline; min-width:0; }
        .vx-visitor-details dt { margin:0; font-size:5px; }
        .vx-visitor-details dd { margin:0; min-width:0; color:#f3f6ff; font-size:7px; font-weight:550; line-height:1.15; overflow-wrap:anywhere; }
        .vx-pass-footer { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:3mm; padding:2mm 3.5mm; border-top:1px solid rgba(119,157,255,.4); background:rgba(0,0,0,.16); color:#c5d7ff; font-size:5.4px; font-weight:800; letter-spacing:.08em; }
        .vx-footer-dot { width:2mm; height:2mm; border-radius:50%; background:#54e5b1; box-shadow:0 0 5px #54e5b1; flex-shrink:0; }
        .vx-register { width:100%; color:#111827; background:white; }
        .vx-register h1 { text-align:center; font-size:20px; margin:0 0 4px; }
        .vx-register .vx-register-meta { text-align:center; font-size:11px; color:#64748b; margin-bottom:16px; }
        .vx-register table { border-collapse:collapse; width:100%; background:white; }
        .vx-register th,.vx-register td { border:1px solid #cbd5e1; padding:6px 8px; font-size:11px; text-align:left; }
        .vx-register th { background:#f1f5f9; }
        .vx-register img { width:32px;height:32px;object-fit:cover;border-radius:4px; }
        .vx-error { max-width:800px; margin:40px auto; padding:20px; border:1px solid #f87171; border-radius:14px; color:#fecaca; background:#7f1d1d33; }
        @page { size:landscape; margin:10mm; }
        @page pass { size:90mm 55mm; margin:0; }
        .vx-pass { page:pass; }
        @media print {
          html, body, #root { min-height:0 !important; height:auto !important; margin:0 !important; background:#fff !important; }
          .vx-print-page { min-height:0 !important; padding:0 !important; color:#111827 !important; background:#fff !important; }
          .vx-preview-heading { display:none !important; }
          .vx-preview-stage { max-width:none !important; padding:0 !important; margin:0 !important; border:0 !important; border-radius:0 !important; box-shadow:none !important; background:#fff !important; }
          .vx-pass-mode { width:90mm !important; height:55mm !important; }
          .vx-pass-mode .vx-pass { width:90mm !important; height:55mm !important; min-height:55mm !important; margin:0 !important; box-shadow:none !important; break-inside:avoid; }
          .vx-pass-mode .vx-pass:not(:first-child) { break-before:page; }
          .vx-register-mode { padding:0 !important; }
          .vx-register { display:block !important; }
          .vx-print-action { display:none !important; }
          * { print-color-adjust:exact !important; -webkit-print-color-adjust:exact !important; }
        }
      `}</style>

      <div className="vx-preview-heading">
        <div>
          <h2>{passMode ? 'Print visitor pass' : 'Print visitor register'}</h2>
          <p>{passMode ? 'Photo is included when one was uploaded during entry.' : `Visitor register · ${new Date().toLocaleString()}`}</p>
        </div>
        <button className="vx-print-action" onClick={() => window.print()}>Print pass</button>
      </div>

      {loadError ? <div className="vx-error">{loadError}</div> : (
        <div className="vx-preview-stage">
          {passMode ? (
            <div className="vx-pass-stack">
              {rows.map((visitor) => <VisitorPass key={visitor.id} visitor={visitor} company={company} />)}
            </div>
          ) : (
            <div className="vx-register">
              <h1>{company}</h1>
              <div className="vx-register-meta">Visitor Register — Printed {new Date().toLocaleString()}</div>
              <table>
                <thead><tr><th>#</th><th>Photo</th><th>Name</th><th>Contact</th><th>Whom to Visit</th><th>Purpose</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Remarks</th></tr></thead>
                <tbody>{rows.map((visitor, index) => (
                  <tr key={visitor.id}>
                    <td>{index + 1}</td>
                    <td>{visitor.photo_url ? <img src={assetUrl(visitor.photo_url)} alt={visitor.name} /> : '—'}</td>
                    <td>{visitor.name}</td><td>{visitor.contact_no || '—'}</td><td>{visitor.whom_to_visit || '—'}</td>
                    <td>{visitor.purpose || '—'}</td><td>{displayDate(visitor.checkin_time)}</td>
                    <td>{visitor.checkout_time ? displayDate(visitor.checkout_time) : '—'}</td>
                    <td>{visitor.status === 'inside' ? 'Inside' : 'Checked Out'}</td><td>{visitor.remarks || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
