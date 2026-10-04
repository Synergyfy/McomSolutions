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

let redirectingToLogin = false;

// Phase 3: single-flight silent refresh. Concurrent 401s share one
// POST /auth/refresh call (rotation would otherwise invalidate siblings).
let refreshInFlight: Promise<string> | null = null;

const readRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
};

const clearAuthState = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('business_user');
  localStorage.removeItem('admin_user');
};

const doRefresh = async (): Promise<string> => {
  if (!refreshInFlight) {
    const refreshToken = readRefreshToken();
    if (!refreshToken) return Promise.reject(new Error('no-refresh-token'));
    refreshInFlight = axios
      .post(
        `${apiClient.defaults.baseURL}/auth/refresh`,
        { refreshToken },
        { headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } },
      )
      .then((res) => {
        const accessToken = res.data?.accessToken as string;
        const nextRefresh = res.data?.refreshToken as string | undefined;
        if (!accessToken) throw new Error('refresh-failed');
        localStorage.setItem('auth_token', accessToken);
        if (nextRefresh) {
          localStorage.setItem('refresh_token', nextRefresh);
          setSharedAuthCookies(accessToken, nextRefresh, res.data?.user ?? null);
        }
        return accessToken;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const AUTH_ROUTES = ['/auth/login', '/auth/register', '/auth/refresh'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const requestUrl: string = original?.url || '';
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !original?._retried &&
      !AUTH_ROUTES.some((r) => requestUrl.includes(r))
    ) {
      original._retried = true;
      try {
        const accessToken = await doRefresh();
        if (original.headers) original.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(original);
      } catch {
        clearAuthState();
      }
    }
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearAuthState();
      if (requestUrl.startsWith('/admin/') && !requestUrl.includes('/admin/auth/login') && !redirectingToLogin) {
        redirectingToLogin = true;
        window.location.assign('/admin/login');
      }
    }
    return Promise.reject(error);
  }
);

export const setSharedAuthCookies = (accessToken: string, refreshToken: string | null, user: any) => {
  document.cookie = `access=${accessToken}; path=/; max-age=86400`;
  if (refreshToken) {
    document.cookie = `refresh=${refreshToken}; path=/; max-age=604800`;
    try {
      localStorage.setItem('refresh_token', refreshToken);
    } catch {
      // storage unavailable (private mode) — cookie copy still set above
    }
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
  try {
    localStorage.removeItem('refresh_token');
  } catch {
    // ignore
  }
};
