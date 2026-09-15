// VistaraX - Login page: professional split-panel layout (brand panel +
// sign-in card), premium dark glass theme, "Remember me" and a real
// "Forgot password?" flow.
import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import {
  ShieldCheck, Eye, EyeOff, Lock, UserRound, ArrowRight, Camera,
  DoorOpen, BarChart3, BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const HIGHLIGHTS = [
  { icon: Camera, text: 'Photo-verified check-ins at every entry' },
  { icon: DoorOpen, text: 'Live view of who is on-site right now' },
  { icon: BarChart3, text: 'Audit-ready reports, exportable anytime' },
];

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password, remember);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-base-950 bg-grid-glow relative overflow-hidden">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-blue/20 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-[120px]" />

      <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_1fr] rounded-3xl overflow-hidden shadow-glass border border-white/10 animate-fade-in">

          {/* Brand panel */}
          <div className="hidden lg:flex relative flex-col justify-between p-10 bg-gradient-to-br from-base-900 via-base-850 to-base-900 overflow-hidden">
            <div className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-accent-blue/20 blur-[100px]" />
            <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-violet/20 blur-[100px]" />

            <div className="relative">
              <Link to="/" className="flex items-center gap-3">
                <img src="/vistarax-logo.png" alt="VistaraX" className="h-11 w-11 rounded-xl shadow-glow" />
                <div>
                  <p className="font-bold text-white text-lg leading-none">VistaraX</p>
                  <p className="text-[10px] text-slate-500 tracking-widest uppercase mt-1">Visitor Intelligence</p>
                </div>
              </Link>

              <h2 className="text-2xl font-bold text-white mt-12 leading-snug">
                Every visitor, verified<br />the moment they arrive.
              </h2>
              <p className="text-sm text-slate-400 mt-3 max-w-sm">
                Built in-house for the Jawandsons Group's front desk — one secure portal for check-ins, reports and access control.
              </p>

              <div className="space-y-3 mt-8">
                {HIGHLIGHTS.map((h) => (
                  <div key={h.text} className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent-cyan shrink-0">
                      <h.icon size={15} />
                    </div>
                    {h.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Floating "verified visitor" mock card */}
            <div className="relative mt-10">
              <div className="glass-strong rounded-2xl p-4 w-64 rotate-[-3deg] shadow-glass">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center text-white font-bold">S</div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">Satyajit Nayak</p>
                    <p className="text-[11px] text-slate-500 truncate">VST-2026-000142</p>
                  </div>
                  <BadgeCheck size={18} className="text-emerald-400 ml-auto shrink-0" />
                </div>
                <div className="h-2 w-full bg-white/5 rounded mt-3" />
                <div className="h-2 w-2/3 bg-white/5 rounded mt-1.5" />
                <span className="inline-block mt-3 text-[10px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Checked In</span>
              </div>
            </div>
          </div>

          {/* Sign-in card */}
          <div className="glass-strong p-7 sm:p-10 flex flex-col justify-center">
            <div className="flex lg:hidden flex-col items-center mb-7">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow mb-4">
                <ShieldCheck size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">VistaraX</h1>
              <p className="text-xs text-slate-500 tracking-widest uppercase mt-1">Visitor Management System</p>
            </div>

            <h2 className="text-xl font-semibold text-white mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-6">Sign in to access the reception dashboard</p>

            {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <div className="relative">
                  <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input className="input pl-9" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0">Password</label>
                  <Link to="/forgot-password" className="text-xs text-accent-blue hover:underline">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    className="input pl-9 pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-400 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="accent-accent-blue h-4 w-4 rounded"
                />
                Remember me on this device
              </label>

              <button type="submit" disabled={busy} className="btn-primary w-full mt-2 py-2.5 flex items-center justify-center gap-2">
                {busy ? 'Signing in...' : (<>Sign In <ArrowRight size={16} /></>)}
              </button>
            </form>

            <p className="text-[11px] text-slate-600 text-center mt-6 leading-relaxed">
              Protected by JWT authentication, bcrypt password hashing, and role-based access control.
            </p>

            <p className="text-xs text-slate-600 text-center mt-4">
              <Link to="/" className="hover:text-slate-400 transition">← Back to VistaraX home</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
