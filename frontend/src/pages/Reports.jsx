// VistaraX - Reports: the detailed visitor register (exact check-in/out
// times, geolocation, checkout remarks) with its own delete / delete-all /
// edit controls - kept out of the everyday All Visitors list so that page
// stays simple, while this one has everything an audit needs.
import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3, Download, FileSpreadsheet, FileText, File as FileIcon, Filter, X,
  ExternalLink, MapPin, Pencil, Trash2,
} from 'lucide-react';
import Layout from '../components/Layout.jsx';
import VisitorModal from '../components/VisitorModal.jsx';
import { Spinner, Badge, EmptyState, ConfirmDialog } from '../components/UI.jsx';
import { googleMapsUrl } from '../components/MapPicker.jsx';
import client, { API_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Reports() {
  const { isAdmin } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('all');
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 15;

  const [editVisitor, setEditVisitor] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await client.get('/visitors', { params: { from, to, status, page, pageSize } });
    setRows(data.data);
    setTotal(data.total);
    setLoading(false);
  }, [from, to, status, page]);

  useEffect(() => {
    const t = setTimeout(load, 200); // small debounce so date-field typing doesn't refetch per keystroke
    return () => clearTimeout(t);
  }, [load]);

  const filtersActive = from !== '' || to !== '' || status !== 'all';
  function clearFilters() {
    setFrom('');
    setTo('');
    setStatus('all');
    setPage(1);
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

  async function confirmDelete() {
    await client.delete(`/visitors/${deleteId}`);
    setDeleteId(null);
    load();
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  if (!isAdmin) {
    return (
      <Layout>
        <div className="card p-8 text-center text-slate-400">Reports are available to administrators only.</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><BarChart3 size={22} /> Reports</h1>
          <p className="text-sm text-slate-500 mt-1">{total} record{total !== 1 ? 's' : ''} — the full visitor register, with exact times and location.</p>
        </div>
        <button onClick={() => setDeleteAll(true)} className="btn-danger flex items-center gap-2 text-sm">
          <Trash2 size={15} /> Delete All
        </button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">From Date</label>
          <input type="date" className="input" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} />
        </div>
        <div>
          <label className="label">To Date</label>
          <input type="date" className="input" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-500 mb-2.5" />
          <div>
            <label className="label">Status</label>
            <select className="input !w-auto" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
              <option value="all">All</option>
              <option value="inside">Currently Inside</option>
              <option value="checked_out">Checked Out</option>
            </select>
          </div>
        </div>
        {filtersActive && (
          <button onClick={clearFilters} className="btn-secondary flex items-center gap-2 text-sm">
            <X size={14} /> Clear Filters
          </button>
        )}
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => download('csv')} className="btn-secondary flex items-center gap-2 text-sm"><FileText size={15} /> CSV</button>
          <button onClick={() => download('excel')} className="btn-secondary flex items-center gap-2 text-sm"><FileSpreadsheet size={15} /> Excel</button>
          <button onClick={() => download('pdf')} className="btn-primary flex items-center gap-2 text-sm"><FileIcon size={15} /> PDF</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={BarChart3} title="No records match this filter" message={filtersActive ? 'Try widening the date range or clearing filters.' : 'Visitor check-ins will appear here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Visitor</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Whom to Visit</th>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Check-in</th>
                  <th className="px-4 py-3">Check-out</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Checkout Remarks</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-xs text-slate-500 font-semibold shrink-0">
                          {v.photo_url ? <img src={`${API_URL}${v.photo_url}`} alt={v.name} className="h-full w-full object-cover" /> : v.name[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-slate-100 font-medium truncate">{v.name}</p>
                          <p className="text-slate-500 text-xs font-mono">{v.serial_no}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{v.contact_no}</td>
                    <td className="px-4 py-3 text-slate-300">{v.whom_to_visit}</td>
                    <td className="px-4 py-3 text-slate-400">{v.purpose || '-'}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDateTime(v.checkin_time)}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDateTime(v.checkout_time)}</td>
                    <td className="px-4 py-3">
                      {v.latitude ? (
                        <a
                          href={googleMapsUrl(v.latitude, v.longitude)}
                          target="_blank" rel="noreferrer"
                          className="text-xs flex items-center gap-1 text-accent-blue hover:underline whitespace-nowrap"
                          title={`${v.latitude}, ${v.longitude}`}
                        >
                          <MapPin size={12} /> {Number(v.latitude).toFixed(4)}, {Number(v.longitude).toFixed(4)} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-slate-600 text-xs">Not captured</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate" title={v.checkout_remarks || ''}>{v.checkout_remarks || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={v.status === 'inside' ? 'green' : 'slate'}>{v.status === 'inside' ? 'Inside' : 'Checked Out'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setEditVisitor(v); setShowForm(true); }} title="Edit" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"><Pencil size={14} /></button>
                        <button onClick={() => setDeleteId(v.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-30">Prev</button>
          <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !px-3 !py-1.5 text-sm disabled:opacity-30">Next</button>
        </div>
      )}

      {showForm && (
        <VisitorModal
          visitor={editVisitor}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          title="Delete Visitor"
          message="This will permanently remove this visitor record and their photo. This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {deleteAll && (
        <ConfirmDialog
          title="Delete All Visitors?"
          message="This will permanently remove every visitor record in the system. This action cannot be undone."
          confirmLabel="Delete All"
          danger
          requireText="DELETE"
          onConfirm={async () => { await client.post('/visitors/delete-all', { confirm: 'DELETE' }); setDeleteAll(false); load(); }}
          onCancel={() => setDeleteAll(false)}
        />
      )}
    </Layout>
  );
}
