// VistaraX - High-accuracy location picker using the browser/device geolocation API.
// The app does NOT accept a coarse location as the visitor's current location.
// A current-location fix is saved only when the device reports <= 50m accuracy.
// If the device cannot provide that accuracy, the user can retry or place the
// pin manually. This prevents a 5km/50km Windows location estimate from being
// silently saved as the visitor's actual position.
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, LocateFixed, ExternalLink, Settings2 } from 'lucide-react';

export function googleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const REQUIRED_ACCURACY_METERS = 50;
const LOCATION_TIMEOUT_MS = 60000;

export default function MapPicker({ lat, lng, address, onChange }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const watchRef = useRef(null);
  const timerRef = useRef(null);
  const bestAccuracyRef = useRef(Infinity);
  const bestPositionRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [locateError, setLocateError] = useState('');

  useEffect(() => {
    if (mapInstance.current) return;

    const startLat = Number.isFinite(Number(lat)) ? Number(lat) : 20.5937;
    const startLng = Number.isFinite(Number(lng)) ? Number(lng) : 78.9629;
    const hasInitialPin = lat != null && lng != null;

    const map = L.map(mapRef.current).setView(
      [startLat, startLng],
      hasInitialPin ? 19 : 5
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 20,
    }).addTo(map);

    const marker = L.marker([startLat, startLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      stopLocationWatch();
      setAccuracy(null);
      setLocateError('');
      onChange({ lat: p.lat, lng: p.lng });
    });

    map.on('click', (e) => {
      stopLocationWatch();
      marker.setLatLng(e.latlng);
      setAccuracy(null);
      setLocateError('');
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstance.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 200);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapInstance.current && markerRef.current && lat != null && lng != null) {
      markerRef.current.setLatLng([Number(lat), Number(lng)]);
      mapInstance.current.setView([Number(lat), Number(lng)], 19, { animate: true });
    }
  }, [lat, lng]);

  function stopLocationWatch() {
    if (watchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1`,
        { headers: { Accept: 'application/json' } }
      );
      if (!response.ok) return;
      const data = await response.json();
      if (data?.display_name) onChange({ address: data.display_name });
    } catch (_) {
      // Address is optional; coordinates remain valid even if reverse geocoding fails.
    }
  }

  function acceptPosition(pos) {
    const { latitude, longitude, accuracy: reportedAccuracy } = pos.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const acc = Number(reportedAccuracy);
    if (!Number.isFinite(acc)) return;

    // Keep only the best fix received during this attempt.
    if (acc >= bestAccuracyRef.current) return;
    bestAccuracyRef.current = acc;
    bestPositionRef.current = pos;
    setAccuracy(acc);

    // IMPORTANT: do not save a coarse Windows/IP/Wi-Fi estimate.
    if (acc > REQUIRED_ACCURACY_METERS) return;

    onChange({ lat: latitude, lng: longitude });
    if (mapInstance.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapInstance.current.setView([latitude, longitude], 20, { animate: true });
    }

    setLocateError('');
    setLocating(false);
    stopLocationWatch();
    reverseGeocode(latitude, longitude);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError('This browser/device does not support location services.');
      return;
    }

    stopLocationWatch();
    bestAccuracyRef.current = Infinity;
    bestPositionRef.current = null;
    setAccuracy(null);
    setLocateError('');
    setLocating(true);

    // Clear the previous GPS pin so an old/coarse position is never mistaken
    // for the fresh current location being requested now.
    onChange({ lat: null, lng: null });

    const options = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: LOCATION_TIMEOUT_MS,
    };

    const handleError = (err) => {
      // A timeout can happen while the browser is still able to produce a
      // better reading through watchPosition, so only show the final error
      // when the overall 60s attempt ends.
      if (err?.code === err.PERMISSION_DENIED) {
        stopLocationWatch();
        setLocating(false);
        setLocateError('Location permission was denied. Allow location for localhost in Chrome and enable Windows Location Services.');
      }
    };

    // watchPosition is intentional here: browsers may first return a coarse
    // Wi-Fi/IP estimate and then provide a better reading as location services
    // refine it. We keep listening until <=50m is available or 60 seconds pass.
    watchRef.current = navigator.geolocation.watchPosition(
      acceptPosition,
      handleError,
      options
    );

    // Also ask once immediately. Some desktop browsers provide a better fix
    // through getCurrentPosition while watchPosition is warming up.
    navigator.geolocation.getCurrentPosition(acceptPosition, handleError, options);

    timerRef.current = setTimeout(() => {
      const best = bestPositionRef.current;
      stopLocationWatch();
      setLocating(false);

      if (best && Number(best.coords.accuracy) <= REQUIRED_ACCURACY_METERS) return;

      const bestAcc = best ? Math.round(best.coords.accuracy) : null;
      if (bestAcc != null) {
        setLocateError(
          `Your device is only reporting about ±${bestAcc}m accuracy. VistaraX did not save that coarse point. Enable Windows Location Services/precise location and try again, or drag the pin manually.`
        );
      } else {
        setLocateError(
          'No precise location fix was received. Enable Windows Location Services/precise location and try again, preferably near a window or outdoors.'
        );
      }
    }, LOCATION_TIMEOUT_MS);
  }

  useEffect(() => () => stopLocationWatch(), []);

  const accuracyGood = accuracy != null && accuracy <= REQUIRED_ACCURACY_METERS;
  const accuracyPoor = accuracy != null && accuracy > REQUIRED_ACCURACY_METERS;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="label !mb-0">
          Location <span className="text-slate-600">(click map or drag pin)</span>
        </label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-xs flex items-center gap-1 text-accent-blue hover:underline disabled:opacity-60"
        >
          <LocateFixed size={13} />
          {locating ? 'Finding precise location...' : 'Use current location'}
        </button>
      </div>

      <div ref={mapRef} className="h-48 w-full rounded-xl overflow-hidden border border-white/10" />

      {locateError && (
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
          <p className="text-xs text-amber-300">{locateError}</p>
          <a
            href="ms-settings:privacy-location"
            className="mt-1 inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
          >
            <Settings2 size={12} /> Open Windows Location Settings
          </a>
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin size={13} />
          {lat != null && lng != null
            ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
            : 'No precise current-location pin set'}
          {accuracy != null && (
            <span className={accuracyGood ? 'text-emerald-400' : 'text-amber-400'}>
              (±{Math.round(accuracy)}m)
            </span>
          )}
        </div>

        {lat != null && lng != null && (
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

      {accuracyGood && (
        <p className="text-xs text-emerald-400 mt-1">
          Precise location locked — device accuracy is about {Math.round(accuracy)}m.
        </p>
      )}

      {accuracyPoor && (
        <p className="text-xs text-amber-400 mt-1">
          Current device reading is too coarse (±{Math.round(accuracy)}m). It will not be saved until the device reaches 50m or better.
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
