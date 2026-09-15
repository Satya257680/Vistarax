// VistaraX - All Visitors: search, filter, add/edit, delete (single & all), export, print
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Download, Printer, Trash2, Filter, FileSpreadsheet, FileText, File as FileIcon, UserPlus } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import VisitorTable from '../components/VisitorTable.jsx';
import VisitorModal from '../components/VisitorModal.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import { ConfirmDialog, CheckoutDialog, Spinner } from '../components/UI.jsx';
import client, { API_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Visitors() {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();
  // The topbar quick-search deep-links here with ?q=... (open the list
  // pre-filtered) or ?focus=<id> (jump straight to that visitor's profile).
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(() => searchParams.get('q') || '');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVisitor, setEditVisitor] = useState(null);
  const [viewId, setViewId] = useState(() => {
    const focus = searchParams.get('focus');
    return focus ? Number(focus) : null;
  });
  const [deleteId, setDeleteId] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const pageSize = 10;

  // Once the deep-link has been consumed, drop it from the URL so it
  // doesn't re-trigger (e.g. re-open the drawer) on a later back/refresh.
  useEffect(() => {
    if (searchParams.get('q') || searchParams.get('focus')) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await client.get('/visitors', { params: { q, status, page, pageSize } });
    setRows(data.data);
    setTotal(data.total);
    setLoading(false);
  }, [q, status, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('visitor:checkin', refresh);
    socket.on('visitor:checkout', refresh);
    socket.on('visitor:deleted', refresh);
    socket.on('visitor:delete-all', refresh);
    return () => {
      socket.off('visitor:checkin', refresh);
      socket.off('visitor:checkout', refresh);
      socket.off('visitor:deleted', refresh);
      socket.off('visitor:delete-all', refresh);
    };
  }, [socket, load]);

  async function confirmCheckout(remarks) {
    await client.post(`/visitors/${checkoutTarget.id}/checkout`, { remarks });
    setCheckoutTarget(null);
    load();
  }

  async function confirmDelete() {
    await client.delete(`/visitors/${deleteId}`);
    setDeleteId(null);
    load();
  }

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  function exportUrl(type) {
    const token = localStorage.getItem('vistarax_token');
    return `${API_URL}/api/export/${type}?token=${token}`;
  }

  async function doExport(type) {
    const res = await client.get(`/export/${type}`, { params: { status }, responseType: 'blob' });
    const blob = new Blob([res.data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitors.${type === 'excel' ? 'xlsx' : type}`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">All Visitors</h1>
          <p className="text-sm text-slate-500 mt-1">{total} total record{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <button onClick={() => setExportOpen((o) => !o)} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={15} /> Export
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-2 w-44 glass-strong rounded-xl shadow-glass overflow-hidden z-20 animate-fade-in">
                <button onClick={() => doExport('csv')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"><FileText size={14} /> CSV</button>
                <button onClick={() => doExport('excel')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"><FileSpreadsheet size={14} /> Excel</button>
                <button onClick={() => doExport('pdf')} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5"><FileIcon size={14} /> PDF</button>
              </div>
            )}
          </div>
          <button onClick={() => window.open('/print', '_blank')} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer size={15} /> Print
          </button>
          {isAdmin && (
            <button onClick={() => setDeleteAll(true)} className="btn-danger flex items-center gap-2 text-sm">
              <Trash2 size={15} /> Delete All
            </button>
          )}
        </div>
      </div>

      {/* A normal, always-visible way in - not a small button tucked in a
          corner - since logging a visitor is the most common action here. */}
      <div className="card p-5 mb-4 flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-r from-accent-blue/10 via-transparent to-accent-violet/10">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow shrink-0">
          <UserPlus size={26} className="text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-base font-semibold text-white">Log a New Visitor</h3>
          <p className="text-sm text-slate-400 mt-0.5">Capture their photo, contact details and exact location in seconds.</p>
        </div>
        <button onClick={() => { setEditVisitor(null); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm px-5 py-2.5 shrink-0">
          <Plus size={16} /> Add Visitor
        </button>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <input className="input" placeholder="Search by name, contact, purpose, address..." value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-500" />
          <select className="input !w-auto" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            <option value="all">All Status</option>
            <option value="inside">Currently Inside</option>
            <option value="checked_out">Checked Out</option>
          </select>
        </div>
      </div>

      <div className="card p-2">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : (
          <VisitorTable
            rows={rows}
            onView={setViewId}
            onEdit={(v) => { setEditVisitor(v); setShowForm(true); }}
            onDelete={setDeleteId}
            onCheckout={(id) => setCheckoutTarget(rows.find((r) => r.id === id))}
            canDelete={isAdmin || true}
          />
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

      {viewId && <VisitorProfileDrawer visitorId={viewId} onClose={() => setViewId(null)} onChanged={load} canDelete={isAdmin} />}

      {checkoutTarget && (
        <CheckoutDialog
          visitorName={checkoutTarget.name}
          onConfirm={confirmCheckout}
          onCancel={() => setCheckoutTarget(null)}
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
