// VistaraX - Sidebar navigation ("Premium Glass Command Center" theme)
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, DoorOpen, BarChart3, Bell, UserCog, Settings, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const item = 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition group';
const active = 'bg-gradient-to-r from-accent-blue/20 to-accent-violet/10 text-white border border-white/10 shadow-glow';
const inactive = 'text-slate-400 hover:text-white hover:bg-white/5';

export default function Sidebar() {
  const { isAdmin } = useAuth();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/visitors', label: 'Visitors', icon: Users },
    { to: '/currently-inside', label: 'Currently Inside', icon: DoorOpen },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ];
  const adminLinks = [
    { to: '/users', label: 'Users', icon: UserCog },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 glass border-r border-white/10 px-4 py-5">
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow">
          <ShieldCheck size={19} className="text-white" />
        </div>
        <div>
          <p className="font-bold text-white text-base leading-none">VistaraX</p>
          <p className="text-[10px] text-slate-500 tracking-wide mt-0.5">VISITOR INTELLIGENCE</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Main</p>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
            <l.icon size={18} />
            {l.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Administration</p>
            {adminLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
                <l.icon size={18} />
                {l.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="glass rounded-xl p-3.5 mt-4">
        <p className="text-xs font-semibold text-white">Secure Session</p>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          Your session is protected with JWT auth and role-based access control.
        </p>
      </div>
    </aside>
  );
}
