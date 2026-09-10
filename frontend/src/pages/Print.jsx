// VistaraX - Printable visitor register (photos included), opened in a new tab
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import client, { API_URL } from '../api/client.js';

export default function Print() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [company, setCompany] = useState('VistaraX');

  useEffect(() => {
    async function load() {
      const ids = params.get('ids');
      const [{ data: settings }] = await Promise.all([client.get('/settings')]);
      setCompany(settings.settings.company_name);

      if (ids) {
        const results = await Promise.all(ids.split(',').map((id) => client.get(`/visitors/${id}`)));
        setRows(results.map((r) => r.data.visitor));
      } else {
        const { data } = await client.get('/visitors', { params: { pageSize: 200 } });
        setRows(data.data);
      }
      setTimeout(() => window.print(), 600);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white text-slate-900 min-h-screen p-8 print:p-0">
      <style>{`
        @media print { @page { size: landscape; margin: 12mm; } }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; text-align: left; }
        th { background: #f1f5f9; }
      `}</style>
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold">{company}</h1>
        <p className="text-sm text-slate-500">Visitor Register — Printed {new Date().toLocaleString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Photo</th><th>Name</th><th>Contact</th><th>Whom to Visit</th><th>Purpose</th>
            <th>Check-in</th><th>Check-out</th><th>Status</th><th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v, i) => (
            <tr key={v.id}>
              <td>{i + 1}</td>
              <td>{v.photo_url ? <img src={`${API_URL}${v.photo_url}`} alt={v.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} /> : '-'}</td>
              <td>{v.name}</td>
              <td>{v.contact_no}</td>
              <td>{v.whom_to_visit}</td>
              <td>{v.purpose || '-'}</td>
              <td>{new Date(v.checkin_time).toLocaleString()}</td>
              <td>{v.checkout_time ? new Date(v.checkout_time).toLocaleString() : '-'}</td>
              <td>{v.status === 'inside' ? 'Inside' : 'Checked Out'}</td>
              <td>{v.remarks || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
