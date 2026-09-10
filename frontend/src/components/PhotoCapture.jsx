// VistaraX - Visitor photo capture: live camera snapshot OR file upload
import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, RotateCcw, X } from 'lucide-react';

export default function PhotoCapture({ value, onChange }) {
  const [mode, setMode] = useState('idle'); // idle | camera | preview
  const [preview, setPreview] = useState(value || null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => () => stopCamera(), []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setMode('camera');
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 50);
    } catch (e) {
      alert('Could not access the camera. Please allow camera permissions or upload a photo instead.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setPreview(URL.createObjectURL(blob));
      onChange(file);
      stopCamera();
      setMode('preview');
    }, 'image/jpeg', 0.9);
  }

  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be smaller than 5MB.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    onChange(file);
    setMode('preview');
  }

  function retake() {
    setPreview(null);
    onChange(null);
    setMode('idle');
  }

  return (
    <div>
      <label className="label">Visitor Photo</label>
      <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.03] overflow-hidden">
        {mode === 'camera' && (
          <div className="relative">
            <video ref={videoRef} autoPlay playsInline className="w-full h-56 object-cover" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
              <button type="button" onClick={capture} className="btn-primary !px-5">Capture</button>
              <button type="button" onClick={() => { stopCamera(); setMode('idle'); }} className="btn-secondary">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {mode === 'preview' && preview && (
          <div className="relative">
            <img src={preview} alt="Visitor" className="w-full h-56 object-cover" />
            <button type="button" onClick={retake} className="absolute top-3 right-3 btn-secondary !px-3 !py-1.5 text-xs flex items-center gap-1.5">
              <RotateCcw size={14} /> Retake
            </button>
          </div>
        )}

        {mode === 'idle' && (
          <div className="flex flex-col items-center justify-center h-56 gap-3">
            <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center text-slate-500">
              <Camera size={24} />
            </div>
            <p className="text-sm text-slate-500">No photo captured yet</p>
            <div className="flex gap-2">
              <button type="button" onClick={startCamera} className="btn-secondary flex items-center gap-2 text-sm">
                <Camera size={15} /> Take Photo
              </button>
              <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
                <Upload size={15} /> Upload
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
