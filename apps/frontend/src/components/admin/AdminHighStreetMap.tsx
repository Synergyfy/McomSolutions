import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GoogleMap, Marker, InfoWindow, useLoadScript } from '@react-google-maps/api';
import { MapPin, Store, CheckCircle2, Clock, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { HighStreet } from '../../services/admin/types';

const mapContainerStyle = { width: '100%', height: '100%' };
const defaultCenter = { lat: 51.5074, lng: -0.1278 };
const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'visualization')[] = ['places'];

interface GeocodedLocation {
  lat: number;
  lng: number;
}

interface AdminHighStreetMapProps {
  highStreets: HighStreet[];
}

export default function AdminHighStreetMap({ highStreets }: AdminHighStreetMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapRef = useRef<google.maps.Map | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState<Map<string, GeocodedLocation>>(new Map());
  const geocodeCacheRef = useRef<Map<string, GeocodedLocation>>(new Map());

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const markerIcon = useMemo(() => ({
    url: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
    scaledSize: isLoaded ? new google.maps.Size(36, 36) : undefined,
    anchor: isLoaded ? new google.maps.Point(18, 36) : undefined,
  }), [isLoaded]);

  const selectedMarkerIcon = useMemo(() => ({
    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
    scaledSize: isLoaded ? new google.maps.Size(42, 42) : undefined,
    anchor: isLoaded ? new google.maps.Point(21, 42) : undefined,
  }), [isLoaded]);

  const geocodeHighStreet = useCallback(async (hs: HighStreet): Promise<GeocodedLocation | null> => {
    const cacheKey = `${hs.name}|${hs.borough}`;
    if (geocodeCacheRef.current.has(cacheKey)) {
      return geocodeCacheRef.current.get(cacheKey)!;
    }

    try {
      const query = `${hs.name}, ${hs.borough}, London, UK`;
      const params = new URLSearchParams({
        address: query,
        key: apiKey,
        region: 'uk',
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.status === 'OK' && data.results?.length > 0) {
        const loc = data.results[0].geometry.location;
        const coords: GeocodedLocation = { lat: loc.lat, lng: loc.lng };
        geocodeCacheRef.current.set(cacheKey, coords);
        return coords;
      }
      return null;
    } catch {
      return null;
    }
  }, [apiKey]);

  useEffect(() => {
    if (!isLoaded || highStreets.length === 0) return;

    const geocodeAll = async () => {
      const newMap = new Map(geocoded);
      const toGeocode = highStreets.filter(hs => {
        const key = `${hs.name}|${hs.borough}`;
        return !newMap.has(key);
      });

      if (toGeocode.length === 0) return;

      const results = await Promise.allSettled(
        toGeocode.map(hs => geocodeHighStreet(hs))
      );

      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          const key = `${toGeocode[i].name}|${toGeocode[i].borough}`;
          newMap.set(key, result.value);
        }
      });

      setGeocoded(newMap);
    };

    geocodeAll();
  }, [isLoaded, highStreets, geocodeHighStreet]);

  const markers = useMemo(() => {
    return highStreets
      .map(hs => {
        const key = `${hs.name}|${hs.borough}`;
        const coords = geocoded.get(key);
        if (!coords) return null;
        return { ...hs, coords };
      })
      .filter(Boolean) as (HighStreet & { coords: GeocodedLocation })[];
  }, [highStreets, geocoded]);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    markers.forEach(m => bounds.extend(m.coords));
    mapRef.current.fitBounds(bounds, 60);
  }, [markers]);

  const selectedHighStreet = markers.find(m => m.id === selectedId) || null;

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-2xl">
        <div className="text-center space-y-2">
          <MapPin className="h-8 w-8 text-gray-300 mx-auto" />
          <p className="text-sm font-semibold text-gray-400">Failed to load Google Maps</p>
          <p className="text-xs text-gray-300">Check API key configuration</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-2xl min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400 font-medium">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={11}
        center={defaultCenter}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
        }}
      >
        {markers.map(hs => (
          <Marker
            key={hs.id}
            position={hs.coords}
            onClick={() => setSelectedId(hs.id === selectedId ? null : hs.id)}
            icon={selectedId === hs.id ? selectedMarkerIcon : markerIcon}
            animation={selectedId === hs.id ? google.maps.Animation.BOUNCE : undefined}
            title={hs.name}
          />
        ))}

        {selectedHighStreet && (
          <InfoWindow
            position={selectedHighStreet.coords}
            onCloseClick={() => setSelectedId(null)}
            options={{ pixelOffset: new google.maps.Size(0, -42) }}
          >
            <div className="p-1 min-w-[200px]">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 leading-tight">{selectedHighStreet.name}</h4>
                  <p className="text-xs text-gray-500 font-medium">{selectedHighStreet.borough}</p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors -mt-0.5 -mr-1"
                >
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset",
                  selectedHighStreet.status === 'Active'
                    ? "bg-green-50 text-green-700 ring-green-600/20"
                    : selectedHighStreet.status === 'Pending'
                    ? "bg-amber-50 text-amber-700 ring-amber-600/20"
                    : "bg-gray-50 text-gray-600 ring-gray-500/20"
                )}>
                  {selectedHighStreet.status === 'Active' && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                  {selectedHighStreet.status === 'Pending' && <Clock className="h-2.5 w-2.5 mr-0.5" />}
                  {selectedHighStreet.status}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-500 font-semibold">
                  <Store className="h-3 w-3" />
                  {selectedHighStreet.businessCount} businesses
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Map overlay legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg p-3 space-y-1.5 z-10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
          <span className="text-[10px] font-bold text-gray-600">High Street</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
          <span className="text-[10px] font-bold text-gray-600">Selected</span>
        </div>
      </div>

      {/* Marker count badge */}
      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl border border-gray-100 shadow-lg px-3 py-1.5 z-10">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
          {markers.length} of {highStreets.length} plotted
        </span>
      </div>
    </div>
  );
}
