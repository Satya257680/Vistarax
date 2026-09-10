// VistaraX - Small reusable UI primitives shared across pages
import React from 'react';
import { X } from 'lucide-react';

export function StatCard({ icon: Icon, label, value, sub, tint = 'blue' }) {
  const tints = {
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-300',
    violet: 'from-violet-500/20 to-violet-500/5 text-violet-300',
    green: 'from-emerald-500/20 to-emerald-500/5 text-emerald-300',
    amber: 'from-amber-500/20 to-amber-500/5 text-amber-300',
    red: 'from-red-500/20 to-red-500/5 text-red-300',
  };
  return (
    <div className="card p-5 hover:border-white/20 transition group">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tints[tint]} flex items-center justify-center group-hover:scale-105 transition`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    green: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    blue: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    red: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <div
      className="rounded-full border-2 border-white/10 border-t-accent-blue animate-spin"
      style={{ height: size, width: size }}
    />
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className={`glass-strong rounded-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto shadow-glass`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 sticky top-0 glass-strong z-10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel, requireText }) {
  const [typed, setTyped] = React.useState('');
  const disabled = requireText ? typed !== requireText : false;
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-300 mb-4">{message}</p>
      {requireText && (
        <div className="mb-4">
          <label className="label">
            Type <span className="text-red-400 font-semibold">{requireText}</span> to confirm
          </label>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} disabled={disabled} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ToastStack({ toasts }) {
  if (!toasts?.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div key={t.id} className="glass-strong rounded-xl p-4 shadow-glass animate-fade-in border-l-4"
          style={{ borderLeftColor: t.kind === 'checkin' ? '#22c55e' : '#3b82f6' }}>
          <p className="text-sm font-semibold text-white">{t.title}</p>
          <p className="text-xs text-slate-400 mt-1">{t.message}</p>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, message, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="text-slate-600 mb-3" />}
      <p className="text-slate-300 font-medium">{title}</p>
      {message && <p className="text-slate-500 text-sm mt-1 max-w-sm">{message}</p>}
    </div>
  );
}
