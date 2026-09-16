// VistaraX - Forgot Password: a two-step, self-service reset flow.
// There's no SMTP server in this deployment, so instead of emailing a
// link we verify identity directly (role + username + the email an admin
// has on file for that account), then let the visitor set a brand new
// password on the spot. See backend/src/routes/auth.routes.js for the
// matching /auth/forgot-password/verify and /reset endpoints.
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, KeyRound, Mail, UserRound, Lock, Eye, EyeOff, ArrowRight,
  ArrowLeft, CheckCircle2, ShieldAlert,
} from 'lucide-react';
import client from '../api/client.js';

const ROLE_OPTIONS = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Manager' },
  { key: 'entry_boy', label: 'Entry Boy' },
  { key: 'entry_girl', label: 'Entry Girl' },
  { key: 'employee', label: 'Employee' },
];

const PW_MIN = 8;
const PW_MAX = 15;

function StepDot({ active, done }) {
  return (
    <span
      className={`h-1.5 rounded-full transition-all ${
        done ? 'w-8 bg-emerald-400' : active ? 'w-8 bg-accent-blue' : 'w-4 bg-white/15'
      }`}
    />
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('identify'); // identify -> reset -> done

  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    if (!role) return setError('Please select a role.');
    setBusy(true);
    try {
      const { data } = await client.post('/auth/forgot-password/verify', {
        role,
        username: username.trim(),
        email: email.trim(),
      });
      setResetToken(data.resetToken);
      setVerifiedName(data.name || '');
      setStep('reset');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword.length < PW_MIN || newPassword.length > PW_MAX) {
      return setError(`New password must be between ${PW_MIN} and ${PW_MAX} characters.`);
    }
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    setBusy(true);
    try {
      await client.post('/auth/forgot-password/reset', {
        resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reset your password. Please verify your details again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-950 bg-grid-glow relative overflow-hidden px-4 py-10">
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent-blue/20 blur-[120px]" />
      <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent-violet/20 blur-[120px]" />

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <Link to="/" className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow mb-4">
            <ShieldCheck size={28} className="text-white" />
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">VistaraX</h1>
          <p className="text-xs text-slate-500 tracking-widest uppercase mt-1">Account Recovery</p>
        </div>

        <div className="glass-strong rounded-2xl p-7 shadow-glass">
          <div className="flex items-center justify-center gap-2 mb-6">
            <StepDot active={step === 'identify'} done={step !== 'identify'} />
            <StepDot active={step === 'reset'} done={step === 'done'} />
          </div>

          {step === 'identify' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2"><KeyRound size={18} /> Forgot your password?</h2>
              <p className="text-sm text-slate-500 mb-6">Confirm your role, username and the email on file to continue.</p>

              {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={role} onChange={(e) => setRole(e.target.value)} required>
                    <option value="" disabled>Select your role...</option>
                    {ROLE_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Username</label>
                  <div className="relative">
                    <UserRound size={16} className="field-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className="input input-with-icon" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
                  </div>
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail size={16} className="field-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="email" className="input input-with-icon" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">Must match the email an administrator has on your account.</p>
                </div>

                <button type="submit" disabled={busy} className="btn-primary w-full mt-2 py-2.5 flex items-center justify-center gap-2">
                  {busy ? 'Verifying...' : (<>Verify Identity <ArrowRight size={16} /></>)}
                </button>
              </form>
            </>
          )}

          {step === 'reset' && (
            <>
              <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2"><Lock size={18} /> Set a new password</h2>
              <p className="text-sm text-slate-500 mb-6">
                {verifiedName ? <>Identity verified for <span className="text-slate-300 font-medium">{verifiedName}</span>. Choose a new password below.</> : 'Choose a new password below.'}
              </p>

              {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <Lock size={16} className="field-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      className="input input-with-icon pr-9"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={PW_MIN}
                      maxLength={PW_MAX}
                      autoFocus
                      required
                    />
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1.5">{PW_MIN}–{PW_MAX} characters.</p>
                </div>
                <div>
                  <label className="label">Confirm New Password</label>
                  <div className="relative">
                    <Lock size={16} className="field-icon absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showPw2 ? 'text' : 'password'}
                      className="input input-with-icon pr-9"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={PW_MIN}
                      maxLength={PW_MAX}
                      required
                    />
                    <button type="button" onClick={() => setShowPw2((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={busy} className="btn-primary w-full mt-2 py-2.5 flex items-center justify-center gap-2">
                  {busy ? 'Updating...' : (<>Reset Password <ArrowRight size={16} /></>)}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep('identify'); setError(''); }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  <ArrowLeft size={12} /> Verify a different account
                </button>
              </form>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-2">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">Password updated</h2>
              <p className="text-sm text-slate-500 mb-6">You can now sign in to VistaraX with your new password.</p>
              <button onClick={() => navigate('/login')} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
                Go to Sign In <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        {step !== 'done' && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 mt-5">
            <ShieldAlert size={12} />
            <span>An administrator can set or update the email on your account from Users.</span>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-5">
          <Link to="/login" className="hover:text-slate-400 transition inline-flex items-center gap-1.5"><ArrowLeft size={12} /> Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
