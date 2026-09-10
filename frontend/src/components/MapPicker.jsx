// VistaraX - Location pin picker using Leaflet + OpenStreetMap (no API key
// needed). Falls back gracefully - location is optional unless Settings
// makes it mandatory.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed } from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function MapPicker({ lat, lng, address, onChange }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (mapInstance.current) return;
    const startLat = lat || 20.5937;
    const startLng = lng || 78.9629;
    const map = L.map(mapRef.current).setView([startLat, startLng], lat ? 15 : 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstance.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapInstance.current && lat && lng) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstance.current.setView([lat, lng], 15);
    }
  }, [lat, lng]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label !mb-0">Location <span className="text-slate-600">(click map or drag pin)</span></label>
        <button type="button" onClick={useMyLocation} className="text-xs flex items-center gap-1 text-accent-blue hover:underline">
          <LocateFixed size={13} /> {locating ? 'Locating...' : 'Use current location'}
        </button>
      </div>
      <div ref={mapRef} className="h-48 w-full rounded-xl overflow-hidden border border-white/10" />
      <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
        <MapPin size={13} />
        {lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'No pin set yet'}
      </div>
      <div className="mt-2">
        <label className="label">Address</label>
        <textarea
          className="input resize-none"
          rows={2}
          placeholder="Street, city, state (auto-fill or type manually)"
          value={address || ''}
          onChange={(e) => onChange({ address: e.target.value })}
        />
      </div>
    </div>
  );
}
