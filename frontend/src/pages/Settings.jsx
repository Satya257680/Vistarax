// VistaraX - Settings: company info + visitor rules (admin) & change password (everyone)
import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Building2, KeyRound, ToggleLeft, ToggleRight } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { Spinner } from '../components/UI.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Settings() {
  const { isAdmin, user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  useEffect(() => {
    client.get('/settings').then(({ data }) => setSettings(data.settings));
  }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData();
    ['company_name', 'address', 'contact', 'timezone', 'date_format', 'accent_color'].forEach((k) => fd.append(k, settings[k] || ''));
    fd.append('photo_required', settings.photo_required ? 'true' : 'false');
    fd.append('location_required', settings.location_required ? 'true' : 'false');
    const { data } = await client.put('/settings', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    setSettings(data.settings);
    setSaving(false);
    setSavedMsg('Settings saved.');
    setTimeout(() => setSavedMsg(''), 2500);
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pw.new_password !== pw.confirm) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    try {
      await client.post('/auth/change-password', pw);
      setPwSuccess('Password updated successfully.');
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwError(err.response?.data?.error || 'Could not update password.');
    }
  }

  if (!settings) {
    return <Layout><div className="flex justify-center py-16"><Spinner size={28} /></div></Layout>;
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2"><SettingsIcon size={22} /> Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Signed in as <span className="text-slate-300">{user.name}</span> ({user.role.replace('_', ' ')})</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {isAdmin && (
          <form onSubmit={saveSettings} className="card p-6 space-y-4">
            <p className="text-sm font-semibold text-white flex items-center gap-2"><Building2 size={16} /> Company & Visitor Rules</p>
            <div>
              <label className="label">Company Name</label>
              <input className="input" value={settings.company_name || ''} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={settings.address || ''} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Contact</label>
                <input className="input" value={settings.contact || ''} onChange={(e) => setSettings({ ...settings, contact: e.target.value })} />
              </div>
              <div>
                <label className="label">Timezone</label>
                <input className="input" value={settings.timezone || ''} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-slate-200">Require photo on check-in</p>
                <p className="text-xs text-slate-500">Reception must capture a photo before adding a visitor.</p>
              </div>
              <button type="button" onClick={() => setSettings({ ...settings, photo_required: settings.photo_required ? 0 : 1 })}>
                {settings.photo_required ? <ToggleRight className="text-accent-blue" size={30} /> : <ToggleLeft className="text-slate-600" size={30} />}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-white/10 pt-4">
              <div>
                <p className="text-sm text-slate-200">Require location pin</p>
                <p className="text-xs text-slate-500">Map location must be set before saving a visitor.</p>
              </div>
              <button type="button" onClick={() => setSettings({ ...settings, location_required: settings.location_required ? 0 : 1 })}>
                {settings.location_required ? <ToggleRight className="text-accent-blue" size={30} /> : <ToggleLeft className="text-slate-600" size={30} />}
              </button>
            </div>

            {savedMsg && <p className="text-sm text-emerald-400">{savedMsg}</p>}
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving...' : 'Save Settings'}</button>
          </form>
        )}

        <form onSubmit={changePassword} className="card p-6 space-y-4 h-fit">
          <p className="text-sm font-semibold text-white flex items-center gap-2"><KeyRound size={16} /> Change Password</p>
          {pwError && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">{pwError}</div>}
          {pwSuccess && <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">{pwSuccess}</div>}
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required minLength={6} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={6} />
          </div>
          <button type="submit" className="btn-primary w-full">Update Password</button>
        </form>
      </div>
    </Layout>
  );
}
