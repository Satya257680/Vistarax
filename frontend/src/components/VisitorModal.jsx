// VistaraX - Add / Edit visitor form modal
import React, { useState } from 'react';
import { Modal } from './UI.jsx';
import PhotoCapture from './PhotoCapture.jsx';
import MapPicker from './MapPicker.jsx';
import client from '../api/client.js';

const emptyForm = {
  name: '', contact_no: '', whatsapp_no: '', companions: '', whom_to_visit: '', purpose: '',
  remarks: '', latitude: null, longitude: null, address: '',
};

export default function VisitorModal({ visitor, onClose, onSaved }) {
  const isEdit = Boolean(visitor);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: visitor.name, contact_no: visitor.contact_no, whatsapp_no: visitor.whatsapp_no || '',
          companions: visitor.companions || '', whom_to_visit: visitor.whom_to_visit, purpose: visitor.purpose || '',
          remarks: visitor.remarks || '', latitude: visitor.latitude, longitude: visitor.longitude, address: visitor.address || '',
        }
      : emptyForm
  );
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.contact_no.trim() || !form.whom_to_visit.trim()) {
      setError('Name, contact number and whom-to-visit are required.');
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      if (photo) fd.append('photo', photo);

      if (isEdit) {
        await client.put(`/visitors/${visitor.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await client.post('/visitors', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Edit Visitor' : 'New Visitor Entry'} onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>}

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Visitor Information</p>
            <div>
              <label className="label">Full Name *</label>
              <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact Number *</label>
                <input className="input" value={form.contact_no} onChange={(e) => set('contact_no', e.target.value)} required />
              </div>
              <div>
                <label className="label">WhatsApp Number</label>
                <input className="input" value={form.whatsapp_no} onChange={(e) => set('whatsapp_no', e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div>
              <label className="label">Others With Them</label>
              <input className="input" value={form.companions} onChange={(e) => set('companions', e.target.value)} placeholder="e.g. 2 colleagues" />
            </div>

            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">Visit Information</p>
            <div>
              <label className="label">Whom to Visit *</label>
              <input className="input" value={form.whom_to_visit} onChange={(e) => set('whom_to_visit', e.target.value)} required />
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
              <textarea className="input resize-none" rows={2} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Laptop bag, documents, etc." />
            </div>
          </div>

          <div className="space-y-4">
            <PhotoCapture value={visitor?.photo_url ? `${client.defaults.baseURL.replace('/api','')}${visitor.photo_url}` : null} onChange={setPhoto} />
            <MapPicker
              lat={form.latitude}
              lng={form.longitude}
              address={form.address}
              onChange={(v) => setForm((f) => ({ ...f, ...(v.lat !== undefined ? { latitude: v.lat, longitude: v.lng } : {}), ...(v.address !== undefined ? { address: v.address } : {}) }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Visitor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
