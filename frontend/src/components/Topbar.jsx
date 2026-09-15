// VistaraX - Topbar: live quick-search, notifications bell, profile menu, logout
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, LogOut, User, Wifi, WifiOff, Menu, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import client, { API_URL } from '../api/client.js';
import { ConfirmDialog, Badge } from './UI.jsx';

export default function Topbar({ onOpenMenu }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef(null);

  // --- Quick search: type 2+ characters and a live dropdown of matching
  // visitors (name, contact, purpose...) appears; press Enter or click
  // "See all results" to open the full Visitors list pre-filtered; click a
  // result to jump straight to that visitor's profile.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

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
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close the dropdown and clear the query whenever we navigate away.
  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await client.get('/visitors', { params: { q, pageSize: 6 } });
        setResults(data.data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  function goToVisitor(id) {
    setSearchOpen(false);
    setQuery('');
    navigate(`/visitors?focus=${id}`);
  }

  function seeAllResults() {
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    navigate(`/visitors?q=${encodeURIComponent(q)}`);
  }

  function onSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      seeAllResults();
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
    }
  }

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

      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          placeholder="Search visitors, contacts, purpose..."
          className="input pl-9 pr-9"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
          onFocus={() => query.trim().length >= 2 && setSearchOpen(true)}
          onKeyDown={onSearchKeyDown}
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
        {!searching && query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setSearchOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}

        {searchOpen && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 mt-2 glass-strong rounded-xl shadow-glass overflow-hidden z-40 animate-fade-in">
            {results.length > 0 ? (
              <>
                <div className="max-h-80 overflow-y-auto">
                  {results.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => goToVisitor(v.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition"
                    >
                      <div className="h-8 w-8 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-[11px] text-slate-500 font-semibold shrink-0">
                        {v.photo_url ? <img src={`${API_URL}${v.photo_url}`} alt={v.name} className="h-full w-full object-cover" /> : v.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-100 font-medium truncate">{v.name}</p>
                        <p className="text-xs text-slate-500 truncate">{v.contact_no} · {v.whom_to_visit}</p>
                      </div>
                      <Badge tone={v.status === 'inside' ? 'green' : 'slate'}>{v.status === 'inside' ? 'Inside' : 'Out'}</Badge>
                    </button>
                  ))}
                </div>
                <button onClick={seeAllResults} className="w-full text-center px-4 py-2.5 text-xs font-medium text-accent-blue hover:bg-white/5 border-t border-white/10 transition">
                  See all results for "{query.trim()}"
                </button>
              </>
            ) : !searching ? (
              <p className="px-4 py-4 text-sm text-slate-500 text-center">No visitors match "{query.trim()}".</p>
            ) : (
              <p className="px-4 py-4 text-sm text-slate-500 text-center">Searching...</p>
            )}
          </div>
        )}
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
