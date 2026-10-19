import { useState, useEffect, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

export function useGeolocation({ autoRequest = true }: { autoRequest?: boolean } = {}) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
    permissionDenied: false,
  });

  const requestLocation = useCallback(() => new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      const error = new Error('Location is not supported by this browser. Enter your postcode instead.');
      setState(prev => ({ ...prev, error: error.message, loading: false, permissionDenied: true }));
      reject(error);
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, permissionDenied: false }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setState({ ...location, error: null, loading: false, permissionDenied: false });
        resolve(location);
      },
      (error) => {
        let message = 'We could not get your location. Enter your postcode instead.';
        let denied = false;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location access was not allowed. Enter your postcode instead.';
            denied = true;
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Your device could not determine its location. Enter your postcode instead.';
            break;
          case error.TIMEOUT:
            message = 'Finding your location took too long. Enter your postcode instead.';
            break;
        }
        setState({ latitude: null, longitude: null, error: message, loading: false, permissionDenied: denied });
        reject(new Error(message));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }), []);

  useEffect(() => {
    if (autoRequest) requestLocation().catch(() => undefined);
  }, [autoRequest, requestLocation]);

  return { ...state, requestLocation };
}
