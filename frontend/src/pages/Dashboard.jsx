// VistaraX - Dashboard: KPI cards + visitor activity chart + currently inside + recent entries
import React, { useEffect, useState, useCallback } from 'react';
import { Users, DoorOpen, CheckCircle2, CalendarDays } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import Layout from '../components/Layout.jsx';
import { StatCard, Spinner } from '../components/UI.jsx';
import VisitorTable from '../components/VisitorTable.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22d3ee', '#f59e0b', '#10b981'];

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);

  const load = useCallback(async () => {
    const [{ data: s }, { data: r }] = await Promise.all([
      client.get('/visitors/stats/summary'),
      client.get('/visitors', { params: { pageSize: 6 } }),
    ]);
    setStats(s);
    setRecent(r.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => load();
    socket.on('visitor:checkin', refresh);
    socket.on('visitor:checkout', refresh);
    socket.on('visitor:deleted', refresh);
    return () => {
      socket.off('visitor:checkin', refresh);
      socket.off('visitor:checkout', refresh);
      socket.off('visitor:deleted', refresh);
    };
  }, [socket, load]);

  async function checkout(id) {
    await client.post(`/visitors/${id}/checkout`);
    load();
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-24"><Spinner size={32} /></div>
      </Layout>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's happening at your front desk today.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Users} label="Today's Visitors" value={stats.todayCount} tint="blue" />
        <StatCard icon={DoorOpen} label="Currently Inside" value={stats.inside} tint="green" />
        <StatCard icon={CheckCircle2} label="Checked Out Today" value={stats.checkedOutToday} tint="violet" />
        <StatCard icon={CalendarDays} label="This Month" value={stats.monthTotal} tint="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 card p-5">
          <p className="text-sm font-semibold text-white mb-4">Visitor Activity — Last 7 Days</p>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={stats.last7}>
              <defs>
                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0d1220', border: '1px solid #ffffff20', borderRadius: 10, fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} fill="url(#colorVisitors)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <p className="text-sm font-semibold text-white mb-4">Today by Purpose</p>
          {stats.byPurpose.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={stats.byPurpose} dataKey="count" nameKey="purpose" innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {stats.byPurpose.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0d1220', border: '1px solid #ffffff20', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-sm text-slate-600">No visitors yet today</div>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
            {stats.byPurpose.map((p, i) => (
              <div key={p.purpose} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {p.purpose} ({p.count})
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <p className="text-sm font-semibold text-white mb-4">Recent Entries</p>
        <VisitorTable
          rows={recent}
          onView={setViewId}
          onCheckout={checkout}
          canDelete={false}
        />
      </div>

      {viewId && <VisitorProfileDrawer visitorId={viewId} onClose={() => setViewId(null)} onChanged={load} canDelete={isAdmin} />}
    </Layout>
  );
}
