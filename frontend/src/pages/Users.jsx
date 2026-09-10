// VistaraX - User management (Admin only): add Entry Boy / Admin accounts,
// block/unblock, reset password, change role.
import React, { useEffect, useState } from 'react';
import { UserCog, Plus, ShieldOff, ShieldCheck as ShieldOn, KeyRound } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { Modal, Badge, Spinner, EmptyState } from '../components/UI.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { name: '', username: '', password: '', role: 'entry_boy', phone: '' };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  async function load() {
    setLoading(true);
    const { data } = await client.get('/users');
    setRows(data.data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function createUser(e) {
    e.preventDefault();
    setError('');
    try {
      await client.post('/users', form);
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user.');
    }
  }

  async function toggleStatus(u) {
    await client.put(`/users/${u.id}`, { status: u.status === 'active' ? 'blocked' : 'active' });
    load();
  }

  async function resetPassword() {
    if (newPassword.length < 6) return;
    await client.put(`/users/${resetTarget.id}`, { password: newPassword });
    setResetTarget(null);
    setNewPassword('');
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UserCog size={22} /> Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage Admin and Entry Boy accounts.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Add User</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={UserCog} title="No users yet" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-slate-100 font-medium">{u.name} {u.id === me.id && <span className="text-xs text-slate-500">(you)</span>}</td>
                  <td className="px-4 py-3 text-slate-400">{u.username}</td>
                  <td className="px-4 py-3"><Badge tone={u.role === 'admin' ? 'blue' : 'slate'}>{u.role === 'admin' ? 'Admin' : 'Entry Boy'}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{u.phone || '-'}</td>
                  <td className="px-4 py-3"><Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setResetTarget(u)} title="Reset password" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"><KeyRound size={15} /></button>
                      {u.id !== me.id && (
                        <button onClick={() => toggleStatus(u)} title={u.status === 'active' ? 'Block' : 'Unblock'} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition">
                          {u.status === 'active' ? <ShieldOff size={15} /> : <ShieldOn size={15} />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="Add New User" onClose={() => setShowForm(false)}>
          <form onSubmit={createUser} className="space-y-4">
            {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>}
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username</label>
                <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="entry_boy">Entry Boy</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create User</button>
            </div>
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.name}`} onClose={() => setResetTarget(null)}>
          <label className="label">New Password</label>
          <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} autoFocus />
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
            <button className="btn-primary" onClick={resetPassword} disabled={newPassword.length < 6}>Reset Password</button>
          </div>
        </Modal>
      )}
    </Layout>
  );
}
