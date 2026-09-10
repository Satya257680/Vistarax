// VistaraX - User management (Admin only): add/edit/delete accounts, search
// & filter, bulk upload from CSV/Excel, delete all, and open-ended roles
// (admin, entry boy, entry girl, manager, employee, or any role typed in on
// the fly) that follow RBAC end to end.
import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCog, Plus, Pencil, Trash2, UploadCloud, Download, Filter, X, Search,
} from 'lucide-react';
import Layout from '../components/Layout.jsx';
import { Modal, Badge, Spinner, EmptyState, ConfirmDialog, Combobox } from '../components/UI.jsx';
import client from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { name: '', username: '', password: '', role: '', phone: '', status: 'active' };

const STATUS_TONE = { active: 'green', blocked: 'red' };

export default function Users() {
  const { user: me } = useAuth();
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Add / edit modal
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete (single / all)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  // Bulk upload
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState('');

  const roleOptions = useMemo(() => roles.map((r) => ({ key: r.key, label: r.label })), [roles]);
  const roleLabel = (key) => roles.find((r) => r.key === key)?.label
    || String(key || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  async function loadUsers() {
    setLoading(true);
    const { data } = await client.get('/users', {
      params: { q: q || undefined, role: roleFilter, status: statusFilter },
    });
    setRows(data.data);
    setLoading(false);
  }

  async function loadRoles() {
    const { data } = await client.get('/roles');
    setRoles(data.data);
  }

  useEffect(() => { loadRoles(); }, []);
  useEffect(() => {
    const t = setTimeout(loadUsers, 250); // debounce search typing
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, roleFilter, statusFilter]);

  const filtersActive = q !== '' || roleFilter !== 'all' || statusFilter !== 'all';
  function clearFilters() {
    setQ('');
    setRoleFilter('all');
    setStatusFilter('all');
  }

  function openAdd() {
    setEditUser(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ name: u.name, username: u.username, password: '', role: u.role, phone: u.phone || '', status: u.status });
    setError('');
    setShowForm(true);
  }

  async function submitForm(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.username.trim() || !form.role.trim() || !form.phone.trim()) {
      setError('Name, username, contact number and role are all required.');
      return;
    }
    if (!editUser && form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editUser) {
        const payload = { name: form.name, username: form.username, role: form.role, phone: form.phone, status: form.status };
        if (form.password) payload.password = form.password;
        await client.put(`/users/${editUser.id}`, payload);
      } else {
        await client.post('/users', { name: form.name, username: form.username, password: form.password, role: form.role, phone: form.phone });
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditUser(null);
      await Promise.all([loadUsers(), loadRoles()]); // a freshly-typed role may have just been created
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save this user.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await client.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete this user.');
      setDeleteTarget(null);
    }
  }

  async function confirmDeleteAll() {
    await client.post('/users/delete-all', { confirm: 'DELETE' });
    setDeleteAllOpen(false);
    loadUsers();
  }

  async function downloadTemplate() {
    const res = await client.get('/users/bulk/template', { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitBulk(e) {
    e.preventDefault();
    if (!bulkFile) return;
    setBulkBusy(true);
    setBulkError('');
    setBulkResult(null);
    try {
      const fd = new FormData();
      fd.append('file', bulkFile);
      const { data } = await client.post('/users/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBulkResult(data);
      await Promise.all([loadUsers(), loadRoles()]);
    } catch (err) {
      setBulkError(err.response?.data?.error || 'Could not import that file.');
    } finally {
      setBulkBusy(false);
    }
  }

  function closeBulk() {
    setBulkOpen(false);
    setBulkFile(null);
    setBulkResult(null);
    setBulkError('');
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><UserCog size={22} /> Users</h1>
          <p className="text-sm text-slate-500 mt-1">Manage staff accounts, roles and access.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setBulkOpen(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <UploadCloud size={15} /> Bulk Upload
          </button>
          <button onClick={() => setDeleteAllOpen(true)} className="btn-danger flex items-center gap-2 text-sm">
            <Trash2 size={15} /> Delete All
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm"><Plus size={15} /> Add User</button>
        </div>
      </div>

      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search by name, username or phone..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-slate-500" />
          <select className="input !w-auto" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All Roles</option>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        {filtersActive && (
          <button onClick={clearFilters} className="btn-secondary flex items-center gap-2 text-sm">
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : rows.length === 0 ? (
        <div className="card"><EmptyState icon={UserCog} title="No users found" message={filtersActive ? 'Try adjusting or clearing your filters.' : 'Add your first staff account to get started.'} /></div>
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
                  <td className="px-4 py-3"><Badge tone={u.role === 'admin' ? 'blue' : 'slate'}>{roleLabel(u.role)}</Badge></td>
                  <td className="px-4 py-3 text-slate-400">{u.phone || '-'}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[u.status] || 'slate'}>{u.status}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"><Pencil size={15} /></button>
                      <button
                        onClick={() => u.id !== me.id && setDeleteTarget(u)}
                        title={u.id === me.id ? "You can't delete your own account" : 'Delete'}
                        disabled={u.id === me.id}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editUser ? `Edit User — ${editUser.name}` : 'Add New User'} onClose={() => setShowForm(false)}>
          {/* autoComplete="off" plus off-brand field names/new-password keeps
              Chrome (and friends) from silently filling this admin form with
              a previously-saved login (e.g. the admin's own credentials). */}
          <form onSubmit={submitForm} className="space-y-4" autoComplete="off">
            {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>}
            <div>
              <label className="label">Full Name *</label>
              <input className="input" autoComplete="off" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Username *</label>
                <input
                  className="input"
                  name="vx_username_field"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">{editUser ? 'New Password' : 'Password *'}</label>
                <input
                  type="password"
                  className="input"
                  name="vx_password_field"
                  autoComplete="new-password"
                  placeholder={editUser ? 'Leave blank to keep unchanged' : ''}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editUser}
                  minLength={6}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Role *</label>
                <Combobox
                  value={form.role}
                  onChange={(role) => setForm({ ...form, role })}
                  options={roleOptions}
                  placeholder="Select or type a role..."
                  createLabel={(v) => `Create new role "${v}"`}
                  required
                />
              </div>
              <div>
                <label className="label">Contact Number *</label>
                <input className="input" autoComplete="off" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
              </div>
            </div>
            {editUser && (
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : (editUser ? 'Save Changes' : 'Create User')}</button>
            </div>
          </form>
        </Modal>
      )}

      {bulkOpen && (
        <Modal title="Bulk Upload Users" onClose={closeBulk}>
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Upload a CSV or Excel file with columns <span className="text-slate-200 font-medium">Name, Username, Password, Role, Phone</span>.
              Unknown roles are created automatically.
            </p>
            <button type="button" onClick={downloadTemplate} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={14} /> Download Template
            </button>

            {bulkError && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">{bulkError}</div>}

            {!bulkResult ? (
              <form onSubmit={submitBulk} className="space-y-4">
                <div>
                  <label className="label">CSV or Excel File</label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="input"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" className="btn-secondary" onClick={closeBulk}>Cancel</button>
                  <button type="submit" disabled={!bulkFile || bulkBusy} className="btn-primary">{bulkBusy ? 'Uploading...' : 'Upload'}</button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="card p-3 flex-1 text-center">
                    <p className="text-2xl font-bold text-emerald-300">{bulkResult.created}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Created</p>
                  </div>
                  <div className="card p-3 flex-1 text-center">
                    <p className="text-2xl font-bold text-amber-300">{bulkResult.skipped}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Skipped</p>
                  </div>
                </div>
                {bulkResult.errors?.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/5 p-3 space-y-1">
                    {bulkResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-300">{e}</p>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button className="btn-secondary" onClick={() => { setBulkResult(null); setBulkFile(null); }}>Upload Another</button>
                  <button className="btn-primary" onClick={closeBulk}>Done</button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete User"
          message={`This will permanently remove ${deleteTarget.name}'s account. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {deleteAllOpen && (
        <ConfirmDialog
          title="Delete All Users?"
          message="This will permanently remove every user account except your own. This action cannot be undone."
          confirmLabel="Delete All"
          danger
          requireText="DELETE"
          onConfirm={confirmDeleteAll}
          onCancel={() => setDeleteAllOpen(false)}
        />
      )}
    </Layout>
  );
}
