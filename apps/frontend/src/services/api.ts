import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3010/api/v1',
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('business_user');
      localStorage.removeItem('admin_user');
    }
    return Promise.reject(error);
  }
);

export const setSharedAuthCookies = (accessToken: string, refreshToken: string | null, user: any) => {
  document.cookie = `access=${accessToken}; path=/; max-age=86400`;
  if (refreshToken) {
    document.cookie = `refresh=${refreshToken}; path=/; max-age=604800`;
  }
  if (user) {
    const role = user.role === 'BUSINESS' ? 'owner' : (user.role || 'customer').toLowerCase();
    const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0];
    document.cookie = `userId=${user.id}; path=/; max-age=604800`;
    document.cookie = `userRole=${role}; path=/; max-age=604800`;
    document.cookie = `userName=${encodeURIComponent(name)}; path=/; max-age=604800`;
    const planType = user.businessProfile?.membershipLevel || user.membershipLevel || 'Bronze';
    document.cookie = `packageInfo=${encodeURIComponent(JSON.stringify({ planType }))}; path=/; max-age=604800`;
  }
};

export const clearSharedAuthCookies = () => {
  ['access', 'refresh', 'userId', 'userRole', 'userName', 'packageInfo'].forEach(c => {
    document.cookie = `${c}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
};
