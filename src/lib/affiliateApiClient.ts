import axios from 'axios';

const affiliateApiClient = axios.create({
  baseURL: import.meta.env.VITE_AFFILIATE_API_URL || 'http://localhost:3067/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add bearer token
affiliateApiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors (e.g., 401 Unauthorized)
affiliateApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
    }
    return Promise.reject(error);
  }
);

export default affiliateApiClient;
