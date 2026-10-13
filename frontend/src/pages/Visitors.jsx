// VistaraX - Entry Point: the front-desk's single job is logging whoever
// just walked in, so this page is now nothing but that form, fully open
// the moment it loads - no list, no export/print/delete-all clutter.
// Every visitor logged here is saved through the same /visitors endpoint
// the rest of the app already reads from, so they show up immediately in
// Reports (the full register) and in Currently Inside while checked in -
// this page doesn't need to duplicate either of those views.
//
// The topbar's quick-search still deep-links here with ?q=... or
// ?focus=<id> (see components/Topbar.jsx), so a lightweight, read-only
// results list and the visitor profile drawer are kept for that path -
// but neither is part of the default view.
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  UserPlus, User, MapPinned, Camera as CameraIcon, CheckCircle2, RefreshCcw,
  ArrowRight, Search, X, BarChart3, DoorOpen, Sparkles,
} from 'lucide-react';
import Layout from '../components/Layout.jsx';
import PhotoCapture from '../components/PhotoCapture.jsx';
import MapPicker from '../components/MapPicker.jsx';
import VisitorProfileDrawer from '../components/VisitorProfileDrawer.jsx';
import { Spinner, Badge, EmptyState } from '../components/UI.jsx';
import client, { API_URL } from '../api/client.js';

const emptyForm = {
  name: '', contact_no: '', whatsapp_no: '', aadhaar_no: '', companions: '', whom_to_visit: '', purpose: '',
  remarks: '', latitude: null, longitude: null, address: '', vehicle_no: '', visitor_type: 'regular',
};

function SectionLabel({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold text-accent-cyan uppercase tracking-wide">
      <Icon size={14} /> {children}
    </p>
  );
}

export default function Visitors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const storedUser = JSON.parse(localStorage.getItem('vistarax_user') || sessionStorage.getItem('vistarax_user') || 'null');
  const isAdmin = storedUser?.role === 'admin';
  const [locationVisible, setLocationVisible] = useState(false);
  useEffect(() => { client.get('/settings/location-capture').then(({data}) => setLocationVisible(Boolean(data.enabled))).catch(() => setLocationVisible(false)); }, []);
  const [oldVisitor, setOldVisitor] = useState(null);
  const [recipients, setRecipients] = useState([]);
  useEffect(() => { client.get('/recipients').then(({data}) => setRecipients(data.data || [])).catch(() => setRecipients([])); }, []);
  const [lookingUp, setLookingUp] = useState(false);

  // --- Deep-link search / focus, driven by the topbar (not this page's
  // own UI) --------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [viewId, setViewId] = useState(() => {
    const focus = searchParams.get('focus');
    return focus ? Number(focus) : null;
  });

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    const focus = searchParams.get('focus');
    setViewId(focus ? Number(focus) : null);
  }, [searchParams]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }
    let active = true;
    setSearchLoading(true);
    client.get('/visitors', { params: { q: searchQuery.trim(), pageSize: 20 } })
      .then(({ data }) => { if (active) setSearchResults(data.data); })
      .finally(() => { if (active) setSearchLoading(false); });
    return () => { active = false; };
  }, [searchQuery]);

  function backToEntryPoint() {
    setSearchParams({}, { replace: true });
  }

  // --- The entry form itself ---------------------------------------------
  const [form, setForm] = useState(emptyForm);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // { name, serial_no }
  const [formKey, setFormKey] = useState(0); // bump to force-reset Photo/Map's own internal state

  const set = useCallback((key, val) => setForm((f) => ({ ...f, [key]: val })), []);

  function clearForm() {
    setForm(emptyForm);
    setPhoto(null);
    setError('');
    setFormKey((k) => k + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.whom_to_visit.trim() || (form.visitor_type !== 'special' && (!form.contact_no.trim() || !form.aadhaar_no.trim()))) {
      setError(form.visitor_type === 'special' ? 'Name and whom-to-visit are required.' : 'Name, contact number, Aadhaar number and whom-to-visit are required.');
      return;
    }
    if (form.visitor_type !== 'special' && !/^\d{12}$/.test(form.aadhaar_no.trim())) {
      setError('Aadhaar number must contain exactly 12 digits.');
      return;
    }
    if ((form.latitude == null) !== (form.longitude == null)) {
      setError('Please set a complete location pin or clear the location before submitting.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);
      const { data } = await client.post('/visitors', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess({ name: data.visitor?.name || form.name, serial_no: data.visitor?.serial_no, id: data.visitor?.id });
      clearForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const searchMode = Boolean(searchParams.get('q'));

  return (
    <Layout>
      {searchMode ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Search size={22} /> Search Results</h1>
              <p className="text-sm text-slate-500 mt-1">Matches for "{searchQuery}"</p>
            </div>
            <button onClick={backToEntryPoint} className="btn-secondary flex items-center gap-2 text-sm">
              <X size={15} /> Back to Entry Point
            </button>
          </div>

          <div className="card p-2">
            {searchLoading ? (
              <div className="flex justify-center py-16"><Spinner size={28} /></div>
            ) : searchResults.length === 0 ? (
              <EmptyState icon={Search} title="No visitors match this search" message="Try a different name, contact number or purpose." />
            ) : (
              <div className="divide-y divide-white/5">
                {searchResults.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setViewId(v.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition rounded-xl"
                  >
                    <div className="h-10 w-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500 font-semibold shrink-0">
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
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-accent-blue to-accent-violet flex items-center justify-center shadow-glow shrink-0">
                  <UserPlus size={18} className="text-white" />
                </span>
                Entry Point
              </h1>
              <p className="text-sm text-slate-500 mt-1.5">Log every visitor the moment they arrive — it's saved straight to Reports and Currently Inside.</p>
            </div>
          </div>

          {success && (
            <div className="card p-5 mb-5 flex flex-wrap items-center gap-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-accent-cyan/5 border-emerald-500/20 animate-fade-in">
              <div className="h-11 w-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{success.name} checked in{success.serial_no ? ` — ${success.serial_no}` : ''}</p>
                <p className="text-xs text-slate-400 mt-0.5">Already visible in Reports and Currently Inside. Ready for the next visitor.</p>
              </div>
              <button onClick={() => success.id && navigate(`/print?ids=${success.id}&pass=1`)} className="btn-primary text-xs">Print Entry Pass</button>
              <button onClick={() => setSuccess(null)} className="text-slate-500 hover:text-slate-300 p-1"><X size={16} /></button>
            </div>
          )}

          <form key={formKey} onSubmit={handleSubmit} className="card p-6 sm:p-8 shadow-glass">
            {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-6">{error}</div>}

            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
              <div className="space-y-5">
                <SectionLabel icon={User}>Visitor Information</SectionLabel>
                {isAdmin && <div className="rounded-xl border border-accent-violet/30 bg-accent-violet/5 p-3"><label className="label">Visitor category (Admin)</label><select className="input" value={form.visitor_type} onChange={e => { set('visitor_type', e.target.value); setOldVisitor(null); }}><option value="regular">Regular visitor — ID verification</option><option value="special">Special visitor — buyer / business partner / VIP (ID not required)</option></select><p className="text-xs text-slate-500 mt-1">Special visitor makes photo, contact and Aadhaar optional. Entry staff cannot change this setting.</p></div>}
                {form.visitor_type === 'special' && isAdmin && <p className="text-xs text-amber-300">Special visitor mode is enabled by administrator.</p>}
                <div>
                  <label className="label">Full Name *</label>
                  <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus required />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Contact Number {form.visitor_type === 'special' ? '(Optional)' : '*'}</label>
                    <input className="input" value={form.contact_no} onChange={(e) => set('contact_no', e.target.value)} inputMode="tel" required={form.visitor_type !== 'special'} />
                  </div>
                  <div>
                    <label className="label">WhatsApp Number</label>
                    <input className="input" value={form.whatsapp_no} onChange={(e) => set('whatsapp_no', e.target.value)} placeholder="Optional" inputMode="tel" />
                  </div>
                </div>
                <div>
                  <label className="label">Aadhaar Number {form.visitor_type === 'special' ? '(Optional)' : '*'}</label>
                  <input
                    className="input tracking-[0.08em]"
                    value={form.aadhaar_no}
                    onChange={(e) => set('aadhaar_no', e.target.value.replace(/\D/g, '').slice(0, 12))}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={12}
                    placeholder="Enter 12-digit Aadhaar number"
                    required={form.visitor_type !== 'special'}
                    onBlur={async () => { if (form.visitor_type === 'special' || !/^\d{12}$/.test(form.aadhaar_no)) return; setLookingUp(true); try { const {data} = await client.get('/visitors/lookup/aadhaar', {params:{aadhaar:form.aadhaar_no}}); if(data.visitor){ const v=data.visitor; setOldVisitor(v); setForm(f=>({...f,name:v.name||f.name,contact_no:v.contact_no||f.contact_no,whatsapp_no:v.whatsapp_no||f.whatsapp_no,companions:v.companions||f.companions,vehicle_no:v.vehicle_no||f.vehicle_no,remarks:v.remarks||f.remarks})); } else setOldVisitor(null); } catch { setOldVisitor(null); } finally { setLookingUp(false); } }}
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">{lookingUp ? 'Checking previous visitor record…' : oldVisitor ? `Previous record found: ${oldVisitor.name}. Recent details filled; verify before saving.` : form.visitor_type === 'special' ? 'Optional for special visitors.' : '12 digits required. Existing visitor details will be suggested.'}</p>
                </div>
                <div>
                  <label className="label">Vehicle Number (Optional)</label>
                  <input className="input uppercase" value={form.vehicle_no} onChange={e => set('vehicle_no', e.target.value.toUpperCase().slice(0,20))} placeholder="e.g. OD01AB1234 — car or motorcycle" />
                </div>
                <div>
                  <label className="label">Others With Them</label>
                  <input className="input" value={form.companions} onChange={(e) => set('companions', e.target.value)} placeholder="e.g. 2 colleagues" />
                </div>

                <div className="h-px bg-white/10 my-2" />

                <SectionLabel icon={DoorOpen}>Visit Information</SectionLabel>
                <div>
                  <label className="label">Whom to Visit *</label>
                  <input className="input" list="recipient-list" value={form.whom_to_visit} onChange={(e) => set('whom_to_visit', e.target.value)} required placeholder="Search company host or enter a name" />
                  <datalist id="recipient-list">{recipients.map(person => <option key={person.id} value={person.name}>{[person.designation, person.department].filter(Boolean).join(' · ')}</option>)}</datalist>
                </div>
                <div>
                  <label className="label">Purpose of Visit</label>
                  <input className="input" list="purpose-list" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Meeting, Interview, Delivery..." />
                  <datalist id="purpose-list">
                    <option value="Meeting" /><option value="Interview" /><option value="Delivery" /><option value="Vendor" /><option value="Personal" />
                  </datalist>
                </div>
                <div>
                  <label className="label">Remarks / Items Carried</label>
                  <textarea className="input resize-none" rows={3} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Laptop bag, documents, etc." />
                </div>
              </div>

              <div className="space-y-5">
                <SectionLabel icon={CameraIcon}>Visitor Photo</SectionLabel>
                <PhotoCapture value={null} onChange={setPhoto} />

                {isAdmin && <div className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-3"><div><p className="text-sm text-slate-200">Location capture</p><p className="text-xs text-slate-500">Admin controls whether the map appears on entry forms.</p></div><button type="button" className="btn-secondary text-xs" onClick={async () => { const next=!locationVisible; try { const {data}=await client.put('/settings/location-capture',{enabled:next}); setLocationVisible(Boolean(data.enabled)); } catch(err) { setError(err.response?.data?.error || 'Could not update global location setting.'); } }}>{locationVisible ? 'ON · Hide location' : 'OFF · Show location'}</button></div>}
                {isAdmin && locationVisible && <><SectionLabel icon={MapPinned}>Location (Admin only)</SectionLabel>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  address={form.address}
                  onChange={(v) => setForm((f) => ({
                    ...f,
                    ...(v.lat !== undefined ? { latitude: v.lat, longitude: v.lng } : {}),
                    ...(v.address !== undefined ? { address: v.address } : {}),
                  }))}
                />
                </>}
                {!isAdmin && <div className="glass rounded-xl p-4 text-xs text-slate-500">Location capture is managed by an administrator.</div>}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-6 mt-6 border-t border-white/10">
              <button type="button" onClick={clearForm} className="btn-secondary flex items-center gap-2 text-sm">
                <RefreshCcw size={15} /> Clear Form
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5">
                {saving ? 'Saving...' : (<><Sparkles size={15} /> Add Visitor <ArrowRight size={15} /></>)}
              </button>
            </div>
          </form>

          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div className="card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent-cyan shrink-0"><DoorOpen size={16} /></div>
              <p className="text-xs text-slate-400">Checked-in visitors appear instantly on <span className="text-slate-200 font-medium">Currently Inside</span>.</p>
            </div>
            <div className="card p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-accent-violet shrink-0"><BarChart3 size={16} /></div>
              <p className="text-xs text-slate-400">Every entry is recorded in full detail under <span className="text-slate-200 font-medium">Reports</span>.</p>
            </div>
          </div>
        </>
      )}

      {viewId && (
        <VisitorProfileDrawer
          visitorId={viewId}
          onClose={() => {
            setViewId(null);
            if (searchParams.get('focus')) {
              const next = new URLSearchParams(searchParams);
              next.delete('focus');
              setSearchParams(next, { replace: true });
            }
          }}
          onChanged={() => {
            if (searchQuery.trim()) {
              client.get('/visitors', { params: { q: searchQuery.trim(), pageSize: 20 } }).then(({ data }) => setSearchResults(data.data));
            }
          }}
          canDelete
        />
      )}
    </Layout>
  );
}
