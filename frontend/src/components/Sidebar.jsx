// VistaraX - Sidebar navigation ("Premium Glass Command Center" theme)
// Renders as a permanent rail on large screens and a slide-in drawer on
// phones/tablets (controlled by Layout via `mobileOpen` / `onClose`), so
// navigation is actually reachable on mobile instead of just disappearing.
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, UserPlus, DoorOpen, BarChart3, Bell, UserCog, Settings, KeyRound, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const item = 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition group';
const active = 'bg-gradient-to-r from-accent-blue/20 to-accent-violet/10 text-white border border-white/10 shadow-glow';
const inactive = 'text-slate-400 hover:text-white hover:bg-white/5';

function SidebarContent({ onNavigate }) {
  const { isAdmin } = useAuth();

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/visitors', label: 'Entry Point', icon: UserPlus },
    { to: '/currently-inside', label: 'Currently Inside', icon: DoorOpen },
    { to: '/reports', label: 'Reports', icon: BarChart3 },
    { to: '/notifications', label: 'Notifications', icon: Bell },
  ];
  const adminLinks = [
    { to: '/users', label: 'Users', icon: UserCog },
    { to: '/roles', label: 'Roles & Permissions', icon: KeyRound },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <>
      <div className="flex items-center gap-2.5 px-2 mb-8">
        <img src="/vistarax-logo.png" alt="VistaraX" className="h-9 w-9 rounded-xl shadow-glow shrink-0" />
        <div>
          <p className="font-bold text-white text-base leading-none">VistaraX</p>
          <p className="text-[10px] text-slate-500 tracking-wide mt-0.5">VISITOR INTELLIGENCE</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-auto">
        <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Main</p>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} onClick={onNavigate} className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
            <l.icon size={18} />
            {l.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Administration</p>
            {adminLinks.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={onNavigate} className={({ isActive }) => `${item} ${isActive ? active : inactive}`}>
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
    </>
  );
}

export default function Sidebar({ mobileOpen, onClose }) {
  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 h-screen sticky top-0 glass border-r border-white/10 px-4 py-5">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
          <aside className="relative flex flex-col w-72 max-w-[85vw] h-full glass-strong border-r border-white/10 px-4 py-5 animate-fade-in">
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition">
              <X size={18} />
            </button>
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
