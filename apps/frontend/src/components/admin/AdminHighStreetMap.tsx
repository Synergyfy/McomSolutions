import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CheckCircle2, Clock, MapPin, Store } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { HighStreet } from '../../services/admin/types';

const defaultCenter: [number, number] = [51.5074, -0.1278];

interface GeocodedLocation {
  lat: number;
  lng: number;
}

interface AdminHighStreetMapProps {
  highStreets: HighStreet[];
}

/** Nominatim requires a descriptive request and is rate-limited to ~1 req/s. */
const NOMINATIM_DELAY_MS = 1100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function FitBounds({ markers }: { markers: Array<HighStreet & { coords: GeocodedLocation }> }) {
  const map = useMap();
  const signature = markers.map((m) => `${m.id}:${m.coords.lat}:${m.coords.lng}`).join('|');

  useEffect(() => {
    if (markers.length === 0) return;
    const bounds = L.latLngBounds(markers.map((m) => [m.coords.lat, m.coords.lng]));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    // `signature` captures the marker identity/position without depending on
    // the freshly-created array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
}

/**
 * Keyless OpenStreetMap view for the admin high-street registry.
 *
 * Coordinates stored on the HighStreet row are used directly. Legacy rows
 * without coordinates are geocoded via Nominatim (the same free service the
 * activation wizard uses), so the map keeps working without a Google billing
 * account or API key.
 */
export default function AdminHighStreetMap({ highStreets }: AdminHighStreetMapProps) {
  const [geocoded, setGeocoded] = useState<Map<string, GeocodedLocation>>(new Map());
  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodeCacheRef = useRef<Map<string, GeocodedLocation>>(new Map());
  const latestStreetsRef = useRef(highStreets);
  latestStreetsRef.current = highStreets;

  // Stable dependency: the parent rebuilds `highStreets` on every render.
  const streetsSignature = highStreets
    .map((hs) => `${hs.id}:${hs.name}:${hs.borough}:${hs.lat ?? ''}:${hs.lng ?? ''}`)
    .join('|');

  useEffect(() => {
    let cancelled = false;

    const buildLocations = async () => {
      const next = new Map<string, GeocodedLocation>();
      const pending: HighStreet[] = [];

      for (const hs of latestStreetsRef.current) {
        const key = `${hs.name}|${hs.borough}`;
        if (typeof hs.lat === 'number' && typeof hs.lng === 'number') {
          next.set(key, { lat: hs.lat, lng: hs.lng });
          continue;
        }
        const cached = geocodeCacheRef.current.get(key);
        if (cached) {
          next.set(key, cached);
          continue;
        }
        pending.push(hs);
      }

      if (pending.length > 0) {
        setIsGeocoding(true);
        for (let i = 0; i < pending.length; i++) {
          const hs = pending[i];
          const key = `${hs.name}|${hs.borough}`;
          try {
            const params = new URLSearchParams({
              q: `${hs.name}, ${hs.borough}, London, UK`,
              format: 'json',
              limit: '1',
              addressdetails: '1',
            });
            const res = await fetch(
              `https://nominatim.openstreetmap.org/search?${params.toString()}`,
              { headers: { 'Accept-Language': 'en' } },
            );
            if (res.ok) {
              const results = (await res.json()) as Array<{ lat: string; lon: string }>;
              if (results.length > 0) {
                const coords = {
                  lat: parseFloat(results[0].lat),
                  lng: parseFloat(results[0].lon),
                };
                geocodeCacheRef.current.set(key, coords);
                next.set(key, coords);
              }
            }
          } catch {
            // A failed geocode simply leaves that street off the map.
          }
          if (i < pending.length - 1) await sleep(NOMINATIM_DELAY_MS);
        }
      }

      if (!cancelled) {
        setGeocoded(next);
        setIsGeocoding(false);
      }
    };

    buildLocations();

    return () => {
      cancelled = true;
    };
  }, [streetsSignature]);

  const markers = useMemo(() => {
    return highStreets
      .map((hs) => {
        const coords = geocoded.get(`${hs.name}|${hs.borough}`);
        if (!coords) return null;
        return { ...hs, coords };
      })
      .filter(Boolean) as Array<HighStreet & { coords: GeocodedLocation }>;
  }, [highStreets, geocoded]);

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden">
      <MapContainer
        center={defaultCenter}
        zoom={11}
        style={{ width: '100%', height: '100%', minHeight: 400 }}
        className="z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((hs) => (
          <CircleMarker
            key={hs.id}
            center={[hs.coords.lat, hs.coords.lng]}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: '#f97316',
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div className="p-1 min-w-[200px]">
                <div className="mb-2">
                  <h4 className="font-bold text-sm text-gray-900 leading-tight">{hs.name}</h4>
                  <p className="text-xs text-gray-500 font-medium">{hs.borough}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                      hs.status === 'Active'
                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                        : hs.status === 'Pending'
                          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
                          : 'bg-gray-50 text-gray-600 ring-gray-500/20',
                    )}
                  >
                    {hs.status === 'Active' && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                    {hs.status === 'Pending' && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                    {hs.status}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                    <Store className="h-3 w-3" />
                    {hs.businessCount} businesses
                  </div>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        <FitBounds markers={markers} />
      </MapContainer>

      {/* Map overlay legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-3 space-y-1.5 z-[500]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
          <span className="text-[10px] font-bold text-gray-600">High Street</span>
        </div>
      </div>

      {/* Marker count badge */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg px-3 py-1.5 z-[500]">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {isGeocoding && markers.length === 0
            ? 'Locating high streets…'
            : `${markers.length} of ${highStreets.length} plotted`}
        </span>
      </div>

      {!isGeocoding && markers.length === 0 && highStreets.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-lg px-5 py-4 text-center max-w-xs">
            <MapPin className="h-6 w-6 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-gray-600">No plottable locations yet</p>
            <p className="text-[11px] text-gray-400 mt-1">
              Add coordinates when activating a high street, or ensure the street name resolves in
              OpenStreetMap.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
