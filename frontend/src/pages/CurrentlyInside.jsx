// VistaraX - Currently Inside: live view of visitors still on premises with duration
import React, { useCallback, useEffect, useState } from 'react';
import { DoorOpen, Clock } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { EmptyState, Spinner, Badge } from '../components/UI.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import client, { API_URL } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

function Duration({ since }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.max(0, Math.round((now - new Date(since).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const long = mins > 120;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${long ? 'text-amber-400' : 'text-slate-400'}`}>
      <Clock size={12} /> {h > 0 ? `${h}h ` : ''}{m}m {long && '⚠️'}
    </span>
  );
}

export default function CurrentlyInside() {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);

  const load = useCallback(async () => {
    const { data } = await client.get('/visitors', { params: { status: 'inside', pageSize: 200 } });
    setRows(data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('visitor:checkin', refresh);
    socket.on('visitor:checkout', refresh);
    return () => {
      socket.off('visitor:checkin', refresh);
      socket.off('visitor:checkout', refresh);
    };
  }, [socket, load]);

  async function checkout(id) {
    await client.post(`/visitors/${id}/checkout`);
    load();
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><DoorOpen size={22} className="text-emerald-400" /> Currently Inside</h1>
        <p className="text-sm text-slate-500 mt-1">{rows.length} visitor{rows.length !== 1 ? 's' : ''} on premises right now</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={DoorOpen} title="No one is currently inside" message="Visitors will appear here as soon as they check in." /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((v) => (
            <div key={v.id} className="card p-4 hover:border-emerald-500/30 transition cursor-pointer" onClick={() => setViewId(v.id)}>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center font-bold text-slate-400">
                  {v.photo_url ? <img src={`${API_URL}${v.photo_url}`} className="h-full w-full object-cover" alt={v.name} /> : v.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">{v.name}</p>
                  <p className="text-xs text-slate-500 truncate">Visiting {v.whom_to_visit}</p>
                </div>
                <Badge tone="green">Inside</Badge>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <Duration since={v.checkin_time} />
                <button
                  onClick={(e) => { e.stopPropagation(); checkout(v.id); }}
                  className="text-xs font-medium text-accent-blue hover:underline"
                >
                  Check Out
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewId && <VisitorProfileDrawer visitorId={viewId} onClose={() => setViewId(null)} onChanged={load} canDelete={isAdmin} />}
    </Layout>
  );
}
