import { useState, useEffect } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    permissionDenied: false,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by this browser.',
        loading: false,
        permissionDenied: true,
      }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
          permissionDenied: false,
        });
      },
      (error) => {
        let message = 'Failed to get your location.';
        let denied = false;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied. Please enter your location manually.';
            denied = true;
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable.';
            break;
          case error.TIMEOUT:
            message = 'The request to get your location timed out.';
            break;
        }
        setState({
          latitude: null,
          longitude: null,
          error: message,
          loading: false,
          permissionDenied: denied,
        });
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  }, []);

  return state;
}