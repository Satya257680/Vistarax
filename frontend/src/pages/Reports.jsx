// VistaraX - Reports: date-range filtered exports + summary
import React, { useState } from 'react';
import { BarChart3, Download, FileSpreadsheet, FileText, File as FileIcon } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { Spinner } from '../components/UI.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Reports() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function runPreview() {
    setBusy(true);
    const { data } = await client.get('/visitors', { params: { from, to, status, pageSize: 5 } });
    setPreview(data);
    setBusy(false);
  }

  async function download(type) {
    const res = await client.get(`/export/${type}`, { params: { from, to, status }, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-report.${type === 'excel' ? 'xlsx' : type}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="card p-8 text-center text-slate-400">Reports & exports are available to administrators only.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 size={22} /> Reports</h1>
        <p className="text-sm text-slate-500 mt-1">Filter by date range and export the visitor register.</p>
      </div>

      <div className="card p-5 mb-6">
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="inside">Currently Inside</option>
              <option value="checked_out">Checked Out</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={runPreview} className="btn-secondary w-full">{busy ? <Spinner size={16} /> : 'Preview'}</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-white/10">
          <button onClick={() => download('csv')} className="btn-secondary flex items-center gap-2 text-sm"><FileText size={15} /> Export CSV</button>
          <button onClick={() => download('excel')} className="btn-secondary flex items-center gap-2 text-sm"><FileSpreadsheet size={15} /> Export Excel</button>
          <button onClick={() => download('pdf')} className="btn-primary flex items-center gap-2 text-sm"><FileIcon size={15} /> Export PDF (with photos)</button>
        </div>
      </div>

      {preview && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-white mb-3">{preview.total} record{preview.total !== 1 ? 's' : ''} match this filter (showing first {preview.data.length})</p>
          <div className="space-y-2">
            {preview.data.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-sm text-slate-400 border-b border-white/5 pb-2">
                <span className="text-slate-200">{v.name}</span>
                <span>{v.visit_date}</span>
                <span>{v.whom_to_visit}</span>
                <span className="capitalize">{v.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  );
}
