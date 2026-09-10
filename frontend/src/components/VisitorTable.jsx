// VistaraX - Photo-first visitor table used by Visitors & Currently Inside pages
import React from 'react';
import { Eye, Edit2, Trash2, LogOut } from 'lucide-react';
import { Badge, EmptyState } from './UI.jsx';
import { API_URL } from '../api/client.js';
import { Users } from 'lucide-react';

export default function VisitorTable({ rows, onView, onEdit, onDelete, onCheckout, canDelete, selected, onToggleSelect }) {
  if (!rows.length) {
    return <EmptyState icon={Users} title="No visitors found" message="Try adjusting your search or filters, or add a new visitor entry." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-slate-500">
            {onToggleSelect && <th className="px-4 py-3 w-8"></th>}
            <th className="px-4 py-3">Photo</th>
            <th className="px-4 py-3">Visitor</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Whom to Visit</th>
            <th className="px-4 py-3">Purpose</th>
            <th className="px-4 py-3">Check-in</th>
            <th className="px-4 py-3">Check-out</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((v) => (
            <tr key={v.id} className="hover:bg-white/[0.03] transition">
              {onToggleSelect && (
                <td className="px-4 py-2.5">
                  <input type="checkbox" checked={selected?.has(v.id)} onChange={() => onToggleSelect(v.id)} className="accent-accent-blue" />
                </td>
              )}
              <td className="px-4 py-2.5">
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-xs text-slate-500 font-semibold">
                  {v.photo_url ? <img src={`${API_URL}${v.photo_url}`} alt={v.name} className="h-full w-full object-cover" /> : v.name[0]}
                </div>
              </td>
              <td className="px-4 py-2.5">
                <p className="text-slate-100 font-medium">{v.name}</p>
                <p className="text-slate-500 text-xs font-mono">{v.serial_no}</p>
              </td>
              <td className="px-4 py-2.5 text-slate-300">{v.contact_no}</td>
              <td className="px-4 py-2.5 text-slate-300">{v.whom_to_visit}</td>
              <td className="px-4 py-2.5 text-slate-400">{v.purpose || '-'}</td>
              <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{new Date(v.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
              <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{v.checkout_time ? new Date(v.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              <td className="px-4 py-2.5">
                <Badge tone={v.status === 'inside' ? 'green' : 'slate'}>{v.status === 'inside' ? 'Inside' : 'Checked Out'}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onView(v.id)} title="View" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"><Eye size={15} /></button>
                  {onEdit && (
                    <button onClick={() => onEdit(v)} title="Edit" className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"><Edit2 size={15} /></button>
                  )}
                  {v.status === 'inside' && onCheckout && (
                    <button onClick={() => onCheckout(v.id)} title="Check out" className="p-1.5 rounded-lg hover:bg-white/10 text-emerald-400 hover:text-emerald-300 transition"><LogOut size={15} /></button>
                  )}
                  {canDelete && onDelete && (
                    <button onClick={() => onDelete(v.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition"><Trash2 size={15} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
