// VistaraX - Visitor profile modal: large photo, full-screen viewer, history
import React, { useEffect, useState } from 'react';
import { Modal, Badge, Spinner, CheckoutDialog } from './UI.jsx';
import { googleMapsUrl } from './MapPicker.jsx';
import client, { API_URL } from '../api/client.js';
import { Phone, MessageCircle, MapPin, Clock, LogOut, Printer, Trash2, X, ZoomIn, ExternalLink } from 'lucide-react';

export default function VisitorProfileDrawer({ visitorId, onClose, onChanged, canDelete }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    client.get(`/visitors/${visitorId}`).then(({ data }) => mounted && setData(data)).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [visitorId]);

  async function checkOut(remarks) {
    await client.post(`/visitors/${visitorId}/checkout`, { remarks });
    onChanged?.();
    onClose();
  }

  async function remove() {
    if (!confirm('Delete this visitor record permanently?')) return;
    await client.delete(`/visitors/${visitorId}`);
    onChanged?.();
    onClose();
  }

  if (loading || !data) {
    return (
      <Modal title="Visitor Profile" onClose={onClose}>
        <div className="flex justify-center py-12"><Spinner /></div>
      </Modal>
    );
  }

  const v = data.visitor;
  const photo = v.photo_url ? `${API_URL}${v.photo_url}` : null;

  return (
    <>
      <Modal title="Visitor Profile" onClose={onClose} wide>
        <div className="grid md:grid-cols-[220px_1fr] gap-6">
          <div>
            <div className="relative group rounded-2xl overflow-hidden border border-white/10 h-56 bg-white/5">
              {photo ? (
                <>
                  <img src={photo} alt={v.name} className="w-full h-full object-cover cursor-zoom-in" onClick={() => setFullscreen(true)} />
                  <button onClick={() => setFullscreen(true)} className="absolute top-2 right-2 bg-black/50 rounded-lg p-1.5 opacity-0 group-hover:opacity-100 transition">
                    <ZoomIn size={16} className="text-white" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 text-4xl font-bold">{v.name[0]}</div>
              )}
            </div>
            <p className="text-center text-xs text-slate-500 mt-2 font-mono">{v.serial_no}</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-xl font-bold text-white">{v.name}</h4>
                <p className="text-sm text-slate-400 mt-0.5">Visiting: {v.whom_to_visit}</p>
              </div>
              <Badge tone={v.status === 'inside' ? 'green' : 'slate'}>{v.status === 'inside' ? 'Currently Inside' : 'Checked Out'}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-slate-300"><Phone size={14} className="text-slate-500" /> {v.contact_no}</div>
              {v.whatsapp_no && <div className="flex items-center gap-2 text-slate-300"><MessageCircle size={14} className="text-slate-500" /> {v.whatsapp_no}</div>}
              <div className="flex items-center gap-2 text-slate-300"><Clock size={14} className="text-slate-500" /> In: {new Date(v.checkin_time).toLocaleString()}</div>
              <div className="flex items-center gap-2 text-slate-300"><Clock size={14} className="text-slate-500" /> Out: {v.checkout_time ? new Date(v.checkout_time).toLocaleString() : '—'}</div>
            </div>

            {v.purpose && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Purpose</p>
                <p className="text-sm text-slate-300">{v.purpose}</p>
              </div>
            )}
            {v.companions && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Others With Them</p>
                <p className="text-sm text-slate-300">{v.companions}</p>
              </div>
            )}
            {(v.address || v.latitude) && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1 flex items-center gap-1"><MapPin size={12} /> Location</p>
                {v.address && <p className="text-sm text-slate-300">{v.address}</p>}
                {v.latitude && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-slate-500 font-mono">{Number(v.latitude).toFixed(5)}, {Number(v.longitude).toFixed(5)}</p>
                    <a
                      className="text-xs flex items-center gap-1 text-accent-blue hover:underline"
                      target="_blank" rel="noreferrer"
                      href={googleMapsUrl(v.latitude, v.longitude)}
                    >
                      <ExternalLink size={11} /> Open Map
                    </a>
                  </div>
                )}
              </div>
            )}
            {v.remarks && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Remarks (check-in)</p>
                <p className="text-sm text-slate-300">{v.remarks}</p>
              </div>
            )}
            {v.checkout_remarks && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Remarks (check-out)</p>
                <p className="text-sm text-slate-300">{v.checkout_remarks}</p>
              </div>
            )}

            {data.history?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Previous Visits ({data.history.length})</p>
                <div className="max-h-28 overflow-y-auto space-y-1.5">
                  {data.history.map((h) => (
                    <div key={h.id} className="text-xs text-slate-400 flex justify-between border-b border-white/5 pb-1">
                      <span>{h.visit_date} — {h.whom_to_visit}</span>
                      <span>{h.purpose || '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
              {v.status === 'inside' && (
                <button onClick={() => setShowCheckout(true)} className="btn-primary flex items-center gap-1.5 text-sm"><LogOut size={14} /> Check Out</button>
              )}
              <button onClick={() => window.open(`/print?ids=${v.id}`, '_blank')} className="btn-secondary flex items-center gap-1.5 text-sm"><Printer size={14} /> Print</button>
              {canDelete && (
                <button onClick={remove} className="btn-danger flex items-center gap-1.5 text-sm ml-auto"><Trash2 size={14} /> Delete</button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {fullscreen && photo && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-6" onClick={() => setFullscreen(false)}>
          <button className="absolute top-5 right-5 text-white/80 hover:text-white"><X size={28} /></button>
          <img src={photo} alt={v.name} className="max-h-full max-w-full rounded-lg object-contain" />
        </div>
      )}

      {showCheckout && (
        <CheckoutDialog
          visitorName={v.name}
          onConfirm={async (remarks) => { await checkOut(remarks); }}
          onCancel={() => setShowCheckout(false)}
        />
      )}
    </>
  );
}
