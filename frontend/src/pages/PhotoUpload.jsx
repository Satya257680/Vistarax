import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CheckCircle2, RefreshCw, Upload } from 'lucide-react';
import { API_URL } from '../api/client.js';

export default function PhotoUpload() {
  const { token } = useParams();
  const videoRef = useRef(null); const streamRef = useRef(null); const inputRef = useRef(null);
  const [cameraError, setCameraError] = useState(''); const [preview, setPreview] = useState('');
  const [file, setFile] = useState(null); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const stop = () => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  async function startCamera() {
    setCameraError('');
    try { const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }); streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; }
    catch { setCameraError('Camera access was blocked. Allow camera access or use Upload Photo below.'); }
  }
  useEffect(() => { startCamera(); return stop; }, []);
  function capture() { const v=videoRef.current; if(!v || !v.videoWidth) return; const c=document.createElement('canvas'); c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0); c.toBlob(b=>{if(!b)return; const f=new File([b],`visitor-${Date.now()}.jpg`,{type:'image/jpeg'});setFile(f);setPreview(URL.createObjectURL(f));stop();},'image/jpeg',.9); }
  function choose(e) { const f=e.target.files?.[0]; if(!f)return; if(f.size>5*1024*1024){setCameraError('Please choose a photo smaller than 5 MB.');return;} setFile(f);setPreview(URL.createObjectURL(f));stop(); }
  async function send() { if(!file)return; setBusy(true);setCameraError(''); try { const fd=new FormData();fd.append('photo',file);const r=await fetch(`${API_URL}/api/photo-upload/${encodeURIComponent(token)}`,{method:'POST',body:fd});const d=await r.json();if(!r.ok)throw new Error(d.error||'Upload failed');setDone(true);stop(); } catch(e){setCameraError(e.message||'Could not upload photo. Ask reception for a new QR code.');} finally{setBusy(false);} }
  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.06] backdrop-blur-2xl p-5 shadow-2xl"><div className="bg-white rounded-xl p-3 mb-5 flex justify-center"><img src="/brand/jawandsons-logo.png" alt="Jawandsons" className="h-16 max-w-full object-contain"/></div><h1 className="text-xl font-bold text-center">Visitor photo capture</h1><p className="text-sm text-slate-400 text-center mt-1 mb-5">Take a clear photo. It will be sent directly to reception.</p>{done ? <div className="text-center py-10"><CheckCircle2 className="mx-auto text-emerald-400" size={48}/><h2 className="font-semibold mt-3">Photo sent successfully</h2><p className="text-sm text-slate-400 mt-1">You can return this phone to the visitor.</p></div> : <>{preview ? <img src={preview} alt="Photo preview" className="w-full aspect-[4/3] object-cover rounded-2xl mb-4"/> : <div className="rounded-2xl overflow-hidden bg-black/40 aspect-[4/3] mb-4 flex items-center justify-center">{cameraError ? <p className="p-4 text-sm text-amber-300 text-center">{cameraError}</p> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>}</div>}{cameraError && <p className="text-sm text-amber-300 mb-3">{cameraError}</p>}<div className="grid grid-cols-2 gap-2 mb-3"><button onClick={preview?()=>{setPreview('');setFile(null);startCamera();}:capture} className="btn-primary flex items-center justify-center gap-2"><Camera size={16}/>{preview?'Retake photo':'Capture photo'}</button><button onClick={()=>inputRef.current?.click()} className="btn-secondary flex items-center justify-center gap-2"><Upload size={16}/>Upload photo</button><input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={choose} className="hidden"/></div><button disabled={!file||busy} onClick={send} className="btn-primary w-full">{busy?'Sending photo…':'Send photo to reception'}</button><p className="text-[11px] text-slate-500 text-center mt-3">Secure one-time QR · Expires in 10 minutes · Max 5 MB</p></>}</section></main>;
}
