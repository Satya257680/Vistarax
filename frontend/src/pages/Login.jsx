// VistaraX - Login page: premium gradient background, glass card
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { ShieldCheck, Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-950 bg-grid-glow relative overflow-hidden px-4">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-blue/20 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-[120px]" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow mb-4">
            <ShieldCheck size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">VistaraX</h1>
          <p className="text-xs text-slate-500 tracking-widest uppercase mt-1">Visitor Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-7 shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
          <p className="text-sm text-slate-500 mb-6">Sign in to access the reception dashboard</p>

          {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input className="input pl-9" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
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
          </div>

          <button type="submit" disabled={busy} className="btn-primary w-full mt-6 py-2.5">
            {busy ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-[11px] text-slate-600 text-center mt-5 leading-relaxed">
            Protected by JWT authentication, bcrypt password hashing, and role-based access control.
          </p>
        </form>
      </div>
    </div>
  );
}
