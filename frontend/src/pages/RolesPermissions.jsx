// VistaraX - Roles & Permissions (Admin only): create custom roles and
// control exactly what each role can do across the app. Admin itself is
// shown as always-on / locked, since it must always have full access.
import React, { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Trash2, Lock } from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { Badge, Spinner, ConfirmDialog } from '../components/UI.jsx';
import client from '../api/client.js';

export default function RolesPermissions() {
  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [creating, setCreating] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    const { data } = await client.get('/roles');
    setRoles(data.data);
    setCatalog(data.catalog);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const grouped = catalog.reduce((acc, p) => {
    (acc[p.module] ||= []).push(p);
    return acc;
  }, {});

  async function togglePermission(role, permKey) {
    if (role.key === 'admin') return;
    setError('');
    const has = role.permissions.includes(permKey);
    const next = has ? role.permissions.filter((p) => p !== permKey) : [...role.permissions, permKey];
    setRoles((rs) => rs.map((r) => (r.key === role.key ? { ...r, permissions: next, saving: true } : r)));
    try {
      await client.put(`/roles/${role.key}/permissions`, { permissions: next });
      setRoles((rs) => rs.map((r) => (r.key === role.key ? { ...r, saving: false } : r)));
    } catch (err) {
      setRoles((rs) => rs.map((r) => (r.key === role.key ? { ...r, permissions: role.permissions, saving: false } : r)));
      setError(err.response?.data?.error || 'Could not update permissions.');
    }
  }

  async function createRole(e) {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await client.post('/roles', { label: newRoleName.trim() });
      setNewRoleName('');
      setAddOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create role.');
    } finally {
      setCreating(false);
    }
  }

  async function confirmDeleteRole() {
    try {
      await client.delete(`/roles/${deleteTarget.key}`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete this role.');
      setDeleteTarget(null);
    }
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><ShieldCheck size={22} /> Roles &amp; Permissions</h1>
          <p className="text-sm text-slate-500 mt-1">Control what each role can see and do across VistaraX.</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Add Role</button>
      </div>

      {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : (
        <div className="space-y-5">
          {roles.map((role) => (
            <div key={role.key} className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-semibold text-white">{role.label}</h3>
                  {role.is_system && <Badge tone="slate">System</Badge>}
                  <span className="text-xs text-slate-500">{role.userCount} user{role.userCount === 1 ? '' : 's'}</span>
                  {role.saving && <Spinner size={13} />}
                </div>
                {role.key === 'admin' ? (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5"><Lock size={12} /> Always full access</span>
                ) : !role.is_system && (
                  <button
                    onClick={() => setDeleteTarget(role)}
                    disabled={role.userCount > 0}
                    title={role.userCount > 0 ? 'Reassign every user with this role before deleting it' : 'Delete role'}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition disabled:opacity-30 disabled:pointer-events-none"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(grouped).map(([moduleName, perms]) => (
                  <div key={moduleName}>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">{moduleName}</p>
                    <div className="space-y-1.5">
                      {perms.map((p) => (
                        <label key={p.key} className={`flex items-center gap-2 text-sm ${role.key === 'admin' ? 'text-slate-500' : 'text-slate-300 cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            className="rounded border-white/20 bg-white/5 text-accent-blue focus:ring-accent-blue/40"
                            checked={role.key === 'admin' ? true : role.permissions.includes(p.key)}
                            disabled={role.key === 'admin'}
                            onChange={() => togglePermission(role, p.key)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <form onSubmit={createRole} className="glass-strong rounded-2xl w-full max-w-sm p-6 shadow-glass space-y-4">
            <h3 className="text-lg font-semibold text-white">Add Role</h3>
            <div>
              <label className="label">Role Name</label>
              <input className="input" autoComplete="off" autoFocus value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} required />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" className="btn-secondary" onClick={() => { setAddOpen(false); setNewRoleName(''); }}>Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create Role'}</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Role"
          message={`This will permanently remove the "${deleteTarget.label}" role.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDeleteRole}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Layout>
  );
}
