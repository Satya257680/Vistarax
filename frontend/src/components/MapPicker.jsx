// VistaraX - Location pin picker using Leaflet + OpenStreetMap (no API key
// needed). Falls back gracefully - location is optional unless Settings
// makes it mandatory.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed, ExternalLink } from 'lucide-react';

// Google Maps needs no API key for a plain "show me this pin" link - this is
// used both here and in the Reports table so a location always opens the
// same way.
export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

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
  const [accuracy, setAccuracy] = useState(null);
  const [locateError, setLocateError] = useState('');

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
      setAccuracy(null); // a manually-dropped pin is exact, not a GPS estimate
      onChange({ lat: p.lat, lng: p.lng });
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      setAccuracy(null);
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
    if (!navigator.geolocation) {
      setLocateError('Your browser does not support geolocation.');
      return;
    }
    setLocating(true);
    setLocateError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setAccuracy(pos.coords.accuracy); // meters - shown so a rough reading isn't mistaken for exact
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === err.PERMISSION_DENIED
            ? 'Location access was denied. Allow it in your browser, or click the map to drop the pin manually.'
            : 'Could not get your exact location. Click the map or drag the pin to set it manually.'
        );
      },
      // maximumAge: 0 forces a fresh GPS/Wi-Fi fix instead of a cached one,
      // which is usually the difference between "close enough" and "exact".
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
      {locateError && <p className="text-xs text-amber-400 mt-2">{locateError}</p>}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={13} />
          {lat && lng ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'No pin set yet'}
          {accuracy != null && <span className="text-slate-600">(±{Math.round(accuracy)}m)</span>}
        </div>
        {lat && lng && (
          <a
            href={googleMapsUrl(lat, lng)}
            target="_blank"
            rel="noreferrer"
            className="text-xs flex items-center gap-1 text-accent-blue hover:underline"
          >
            <ExternalLink size={12} /> Open Map
          </a>
        )}
      </div>
      {accuracy != null && accuracy > 50 && (
        <p className="text-xs text-amber-400 mt-1">
          This reading is only accurate to about {Math.round(accuracy)}m — drag the pin on the map above to fine-tune the exact spot.
        </p>
      )}
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
