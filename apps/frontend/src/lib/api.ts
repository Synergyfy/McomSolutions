import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add bearer token
apiClient.interceptors.request.use(
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

// Response interceptor to handle session expiration (401)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('business_user');
      }
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
    document.cookie = `packageInfo=${encodeURIComponent(JSON.stringify({ planType: 'Bronze' }))}; path=/; max-age=604800`;
  }
};

export const clearSharedAuthCookies = () => {
  document.cookie = 'access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'refresh=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'userId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'userName=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'packageInfo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
};

export const businessApi = {
  sendOtp: async (email: string) => {
    const res = await apiClient.post('/auth/send-otp', { email });
    return res.data;
  },

  verifyOtp: async (email: string, code: string) => {
    const res = await apiClient.post('/auth/verify-otp', { email, code });
    return res.data;
  },

  login: async (credentials: any) => {
    const res = await apiClient.post('/auth/login', credentials);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
      // Set shared cookies for localhost ports SSO
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res.data;
  },

  register: async (data: any) => {
    const res = await apiClient.post('/auth/register', data);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
      // Set shared cookies for localhost ports SSO
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res.data;
  },

  getCurrentUser: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  getSsoToken: async () => {
    const res = await apiClient.get('/auth/sso/token');
    return res.data;
  },

  updateSettings: async (updates: any) => {
    const res = await apiClient.put('/auth/settings', updates);
    return res.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
    localStorage.removeItem('businessOnboarding');
    localStorage.removeItem('businessOnboardingStep');
    localStorage.removeItem('businessOnboardingCompleted');
    // Clear shared cookies for localhost ports SSO
    clearSharedAuthCookies();
  },

  // Onboarding API mappings
  searchAddress: async (postcode: string) => {
    const res = await apiClient.get(`/business/search-address?postcode=${encodeURIComponent(postcode)}`);
    return res.data;
  },

  checkLocation: async (postcode: string) => {
    const res = await apiClient.post('/localmall/onboarding/check-location', { postcode });
    return res.data;
  },

  searchGoogleBusinesses: async (queryText: string, radius: number = 5000) => {
    const res = await apiClient.get(`/google/google-business?queryText=${encodeURIComponent(queryText)}&radius=${radius}`);
    return res.data;
  },

  getGooglePlaceDetails: async (placeId: string) => {
    const res = await apiClient.get(`/google/google-business/${placeId}`);
    return res.data;
  },

  startClaim: async (placeId: string, returnUrl: string) => {
    const res = await apiClient.post('/claim/start', { placeId, returnUrl });
    return res.data;
  },

  mapGoogleCategory: async (googleCategoryId: string) => {
    const res = await apiClient.get(`/google-business/map-category?googleCategoryId=${encodeURIComponent(googleCategoryId)}`);
    return res.data;
  },

  completeGoogleOnboarding: async (data: any) => {
    const res = await apiClient.post('/google-business/complete-onboarding', data);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  // Profile management
  getProfile: async () => {
    const res = await apiClient.get('/business/profile');
    return res.data;
  },

  updateProfile: async (updates: any) => {
    const res = await apiClient.put('/business/profile', updates);
    return res.data;
  },

  generateApiKey: async () => {
    const res = await apiClient.post('/business/api-key');
    return res.data;
  },

  // Subscriptions & Packages
  getPlans: async () => {
    const res = await apiClient.get('/pricing/plans');
    return res.data;
  },

  subscribeMembership: async (level: string, tier: string) => {
    const res = await apiClient.post('/pricing/subscribe', { level, tier });
    return res.data;
  },

  // ─── Payment (Stripe & PayPal) ────────────────────────────────────────────

  stripeInitiate: async (level: string, tier: string, billing: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/stripe/initiate', { level, tier, billing, isTrial });
    return res.data; // { clientSecret, type }
  },

  stripeConfirm: async (level: string, tier: string, billing: string, paymentIntentId: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/stripe/confirm', { level, tier, billing, paymentIntentId, isTrial });
    return res.data;
  },

  paypalInitiate: async (level: string, tier: string, billing: string, returnUrl: string, cancelUrl: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/paypal/initiate', { level, tier, billing, returnUrl, cancelUrl, isTrial });
    return res.data; // { orderId, approvalUrl }
  },

  paypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/paypal/capture', { orderId });
    return res.data;
  },

  purchasePackage: async (platform: string, packageName: string) => {
    const res = await apiClient.post('/pricing/packages/purchase', { platform, packageName });
    return res.data;
  },

  getTransactions: async () => {
    const res = await apiClient.get('/pricing/transactions');
    return res.data;
  },

  // Notifications API
  getNotifications: async () => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  markAllNotificationsRead: async () => {
    const res = await apiClient.post('/notifications/read-all');
    return res.data;
  },

  deleteNotification: async (id: string) => {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  },

  // Directory API
  getAllBusinesses: async (searchQuery?: string) => {
    const url = searchQuery ? `/business?search=${encodeURIComponent(searchQuery)}` : '/business';
    const res = await apiClient.get(url);
    return res.data;
  },

  getBusinessById: async (id: string) => {
    const res = await apiClient.get(`/business/${id}`);
    return res.data;
  },

  deleteBusiness: async (id: string) => {
    const res = await apiClient.delete(`/business/${id}`);
    return res.data;
  }
};
