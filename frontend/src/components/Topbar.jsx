// VistaraX - Topbar: search, notifications bell, profile menu, logout
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, LogOut, User, Wifi, WifiOff, Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import client from '../api/client.js';
import { ConfirmDialog } from './UI.jsx';

export default function Topbar({ onSearch, onOpenMenu }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const { data } = await client.get('/notifications');
        if (mounted) setUnread(data.unread);
      } catch { /* ignore */ }
    }
    poll();
    const t = setInterval(poll, 20000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 glass border-b border-white/10 px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-4">
      <button
        onClick={onOpenMenu}
        className="lg:hidden h-10 w-10 shrink-0 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition"
        aria-label="Open menu"
      >
        <Menu size={18} className="text-slate-300" />
      </button>

      <img src="/vistarax-logo.png" alt="VistaraX" className="lg:hidden h-8 w-8 rounded-lg shrink-0" />

      <div className="flex-1 max-w-md relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          placeholder="Search visitors, contacts, purpose..."
          className="input pl-9"
          onChange={(e) => onSearch && onSearch(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 px-2">
          {connected ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-slate-600" />}
          {connected ? 'Live' : 'Offline'}
        </div>

        <button
          onClick={() => navigate('/notifications')}
          className="relative h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition"
        >
          <Bell size={18} className="text-slate-300" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center font-semibold border-2 border-base-900">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-white leading-none">{user?.name}</p>
              <p className="text-[10px] text-slate-500 leading-none mt-1 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 glass-strong rounded-xl shadow-glass overflow-hidden animate-fade-in">
              <button onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition">
                <User size={15} /> My Profile
              </button>
              <button onClick={() => { setMenuOpen(false); setConfirmLogout(true); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition">
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {confirmLogout && (
        <ConfirmDialog
          title="Sign out of VistaraX?"
          message="You will need to sign in again to access the visitor management dashboard."
          confirmLabel="Sign Out"
          danger
          onConfirm={async () => { await logout(); navigate('/login'); }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}
    </header>
  );
}
