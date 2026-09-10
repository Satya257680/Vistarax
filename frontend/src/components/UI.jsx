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

// Confirms a visitor check-out with an optional remarks note (e.g. "took a
// laptop bag with them") - used anywhere a Check Out action appears.
export function CheckoutDialog({ visitorName, onConfirm, onCancel }) {
  const [remarks, setRemarks] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm(remarks.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Check Out${visitorName ? ` — ${visitorName}` : ''}`} onClose={onCancel}>
      <p className="text-sm text-slate-300 mb-4">Confirm this visitor's check-out time now.</p>
      <label className="label">Remarks <span className="text-slate-600">(optional — e.g. items taken with them)</span></label>
      <textarea
        className="input resize-none"
        rows={3}
        autoFocus
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        placeholder="Laptop bag, visitor badge returned, etc."
      />
      <div className="flex justify-end gap-3 pt-4">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Checking out...' : 'Check Out'}</button>
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

// A text input that behaves like a "select or type" combobox: pick one of
// the given options from a dropdown, or type a brand-new value that isn't in
// the list yet (the caller decides what happens with unrecognized values -
// e.g. the Users page's Role field sends it straight to the API, which
// creates a matching role on the fly).
export function Combobox({
  value,
  onChange,
  options = [],
  placeholder = 'Select or type...',
  allowCreate = true,
  createLabel = (v) => `Use "${v}"`,
  disabled = false,
  required = false,
  name,
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const wrapRef = React.useRef(null);

  const selected = options.find((o) => o.key === value);
  const displayValue = open ? query : (selected ? selected.label : (value || ''));

  React.useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  function pick(opt) {
    onChange(opt.key);
    setQuery('');
    setOpen(false);
  }

  function useTyped() {
    const typed = query.trim();
    if (!typed) return;
    onChange(typed);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        className="input"
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        name={name}
        autoComplete="off"
        value={displayValue}
        onFocus={() => { setQuery(selected ? selected.label : (value || '')); setOpen(true); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered.length && !exactMatch) pick(filtered[0]);
            else useTyped();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full max-h-56 overflow-y-auto glass-strong rounded-xl shadow-glass py-1">
          {filtered.map((o) => (
            <button
              type="button"
              key={o.key}
              onClick={() => pick(o)}
              className="w-full text-left px-3.5 py-2 text-sm text-slate-200 hover:bg-white/10 transition"
            >
              {o.label}
            </button>
          ))}
          {allowCreate && query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={useTyped}
              className="w-full text-left px-3.5 py-2 text-sm text-accent-blue hover:bg-white/10 transition border-t border-white/10"
            >
              + {createLabel(query.trim())}
            </button>
          )}
          {!filtered.length && !(allowCreate && query.trim()) && (
            <p className="px-3.5 py-2 text-xs text-slate-500">No matches.</p>
          )}
        </div>
      )}
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
