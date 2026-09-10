// VistaraX - Notifications feed (real-time + history)
import React, { useEffect, useState } from 'react';
import { Bell, LogIn, LogOut, CheckCheck, Trash2 } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import { EmptyState, Spinner, ConfirmDialog } from '../components/UI.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

export default function Notifications() {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);

  async function load() {
    const { data } = await client.get('/notifications');
    setRows(data.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('visitor:checkin', refresh);
    socket.on('visitor:checkout', refresh);
    return () => {
      socket.off('visitor:checkin', refresh);
      socket.off('visitor:checkout', refresh);
    };
  }, [socket]);

  async function markAllRead() {
    await client.post('/notifications/read-all');
    load();
  }

  async function clearAll() {
    await client.delete('/notifications');
    setClearOpen(false);
    load();
  }

  // Clicking a notification jumps straight to the exact visitor record it's
  // about, and marks that one notification read on the way.
  async function openNotification(n) {
    if (!n.is_read) {
      client.post(`/notifications/${n.id}/read`).then(load).catch(() => {});
    }
    if (n.visitor_id) setViewId(n.visitor_id);
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Bell size={22} /> Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">Real-time visitor activity across the front desk. Click one to jump to that visitor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm"><CheckCheck size={15} /> Mark all read</button>
          {rows.length > 0 && (
            <button onClick={() => setClearOpen(true)} className="btn-danger flex items-center gap-2 text-sm"><Trash2 size={15} /> Clear All</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={Bell} title="No notifications yet" message="You'll see live check-in and check-out alerts here." /></div>
      ) : (
        <div className="card divide-y divide-white/5">
          {rows.map((n) => (
            <button
              key={n.id}
              onClick={() => openNotification(n)}
              className={`w-full flex items-start gap-3 p-4 text-left hover:bg-white/[0.04] transition ${!n.is_read ? 'bg-accent-blue/5' : ''}`}
            >
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${n.type === 'checkin' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-blue-500/15 text-blue-400'}`}>
                {n.type === 'checkin' ? <LogIn size={16} /> : <LogOut size={16} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100">{n.title}</p>
                <p className="text-sm text-slate-500">{n.message}</p>
                <p className="text-xs text-slate-600 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <span className="h-2 w-2 rounded-full bg-accent-blue mt-2 shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {viewId && (
        <VisitorProfileDrawer
          visitorId={viewId}
          onClose={() => setViewId(null)}
          onChanged={load}
          canDelete={isAdmin}
        />
      )}

      {clearOpen && (
        <ConfirmDialog
          title="Clear All Notifications?"
          message="This removes every notification from this feed. Visitor records themselves are not affected."
          confirmLabel="Clear All"
          danger
          onConfirm={clearAll}
          onCancel={() => setClearOpen(false)}
        />
      )}
    </Layout>
  );
}
