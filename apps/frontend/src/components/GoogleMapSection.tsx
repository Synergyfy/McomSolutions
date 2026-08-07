import { useMemo, useEffect, useRef } from 'react';
import { GoogleMap, Marker, useLoadScript } from '@react-google-maps/api';

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const defaultCenter = { lat: 51.5074, lng: -0.1278 }; // London

interface GoogleMapSectionProps {
  businesses: any[];
  selectedBusiness: any;
  onSelectBusiness: (business: any) => void;
  userLocation?: { lat: number; lng: number } | null;
  mapCenter?: { lat: number; lng: number } | null;
}

const LIBRARIES: ('places' | 'geometry' | 'drawing' | 'visualization')[] = ['places'];

function getBusinessPosition(business: any): { lat: number; lng: number } | null {
  // Support both flat { lat, lng } and nested { geometry: { location: { lat, lng } } }
  if (typeof business.lat === 'number' && typeof business.lng === 'number') {
    return { lat: business.lat, lng: business.lng };
  }
  if (business.geometry?.location) {
    return {
      lat: business.geometry.location.lat,
      lng: business.geometry.location.lng,
    };
  }
  return null;
}

export default function GoogleMapSection({
  businesses,
  selectedBusiness,
  onSelectBusiness,
  userLocation,
  mapCenter,
}: GoogleMapSectionProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  const center = useMemo(() => {
    if (mapCenter) return mapCenter;
    if (userLocation) return userLocation;
    const firstPos = businesses.length > 0 ? getBusinessPosition(businesses[0]) : null;
    if (firstPos) return firstPos;
    return defaultCenter;
  }, [mapCenter, userLocation, businesses]);

  // Pan map when mapCenter changes
  useEffect(() => {
    if (mapRef.current && mapCenter) {
      mapRef.current.panTo(mapCenter);
      mapRef.current.setZoom(15);
    }
  }, [mapCenter]);

  // Pan to selected business
  useEffect(() => {
    if (mapRef.current && selectedBusiness) {
      const pos = getBusinessPosition(selectedBusiness);
      if (pos) {
        mapRef.current.panTo(pos);
        mapRef.current.setZoom(16);
      }
    }
  }, [selectedBusiness]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-sm font-medium">
        Failed to load Google Maps. Please check your API key configuration.
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">Loading map...</span>
        </div>
      </div>
    );
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      zoom={14}
      center={center}
      onLoad={(map) => { mapRef.current = map; }}
      options={{
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
      }}
    >
      {userLocation && (
        <Marker
          position={userLocation}
          icon={{
            url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new google.maps.Size(32, 32),
          }}
          title="Your location"
        />
      )}

      {businesses.map((business: any) => {
        const pos = getBusinessPosition(business);
        if (!pos) return null;
        const placeId = business.place_id || business.placeId || business.googlePlaceId;
        const isSelected = selectedBusiness?.googlePlaceId === placeId ||
          selectedBusiness?.place_id === placeId;

        return (
          <Marker
            key={placeId}
            position={pos}
            onClick={() => onSelectBusiness(business)}
            animation={isSelected ? google.maps.Animation.BOUNCE : undefined}
            icon={{
              url: isSelected
                ? 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png'
                : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
              scaledSize: new google.maps.Size(32, 32),
            }}
          />
        );
      })}
    </GoogleMap>
  );
}
