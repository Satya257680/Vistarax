// VistaraX - All Visitors: search, filter, add/edit, delete (single & all), export, print
import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Download, Printer, Trash2, Filter, FileSpreadsheet, FileText, File as FileIcon } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import VisitorTable from '../components/VisitorTable.jsx';
import VisitorModal from '../components/VisitorModal.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import { ConfirmDialog, Spinner } from '../components/UI.jsx';
import client, { API_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Visitors() {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editVisitor, setEditVisitor] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteAll, setDeleteAll] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const pageSize = 10;

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

  async function checkout(id) {
    await client.post(`/visitors/${id}/checkout`);
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
          <button onClick={() => { setEditVisitor(null); setShowForm(true); }} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Visitor
          </button>
        </div>
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
            onCheckout={checkout}
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
