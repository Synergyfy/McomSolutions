import axios from 'axios';

// ═══════════════════════════════════════════════════════════
// MOCK MODE — set VITE_MOCK_API=true in .env to use mocks
// When true, all API calls return hardcoded data (no backend needed)
// ═══════════════════════════════════════════════════════════
const USE_MOCK = import.meta.env.VITE_MOCK_API === 'true';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

apiClient.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
  }
  return Promise.reject(error);
});

// ═══ Mock helpers ═══
const MOCK_USER = {
  id: 'mock-user-001',
  email: 'test@business.com',
  firstName: 'Test',
  lastName: 'Owner',
  name: 'Test Owner',
  role: 'BUSINESS',
  businessName: 'Test Business Ltd',
  sector: 'Hospitality',
  category: 'Restaurant',
  membership: 'Gold',
  membershipSub: 'Pro',
};

const MOCK_TOKEN = 'mock-jwt-token-abc123';

function mockResponse(data: any) {
  return { data };
}

async function withFallback<T>(real: () => Promise<T>, mock: () => T): Promise<T> {
  if (USE_MOCK) return mock();
  try {
    return await real();
  } catch (err: any) {
    if (err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED' || !err?.response) {
      console.warn(`[MOCK] Backend unreachable — using mock data for: ${err?.config?.url || 'unknown'}`);
      return mock();
    }
    throw err;
  }
}

export const setSharedAuthCookies = (accessToken: string, refreshToken: string | null, user: any) => {
  document.cookie = `access=${accessToken}; path=/; max-age=86400`;
  if (refreshToken) document.cookie = `refresh=${refreshToken}; path=/; max-age=604800`;
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
  ['access', 'refresh', 'userId', 'userRole', 'userName', 'packageInfo'].forEach(c => {
    document.cookie = `${c}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  });
};

// ═══ Business API (with mock fallback) ═══
export const businessApi = {
  sendOtp: async (email: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/auth/send-otp', { email }); return res.data; },
      () => ({ success: true })
    );
  },

  verifyOtp: async (email: string, code: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/auth/verify-otp', { email, code }); return res.data; },
      () => ({ valid: true })
    );
  },

  login: async (credentials: any) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/auth/login', credentials);
        if (res.data?.accessToken) {
          localStorage.setItem('auth_token', res.data.accessToken);
          localStorage.setItem('business_user', JSON.stringify(res.data.user));
          setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
        }
        return res.data;
      },
      () => {
        const data = { accessToken: MOCK_TOKEN, refreshToken: MOCK_TOKEN + '-refresh', user: MOCK_USER };
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('business_user', JSON.stringify(data.user));
        setSharedAuthCookies(data.accessToken, data.refreshToken, data.user);
        return data;
      }
    );
  },

  register: async (data: any) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/auth/register', data);
        if (res.data?.accessToken) {
          localStorage.setItem('auth_token', res.data.accessToken);
          localStorage.setItem('business_user', JSON.stringify(res.data.user));
          setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
        }
        return res.data;
      },
      () => {
        const mockData = {
          accessToken: MOCK_TOKEN, refreshToken: MOCK_TOKEN + '-refresh',
          user: { ...MOCK_USER, ...data, id: 'mock-user-' + Date.now() },
        };
        localStorage.setItem('auth_token', mockData.accessToken);
        localStorage.setItem('business_user', JSON.stringify(mockData.user));
        setSharedAuthCookies(mockData.accessToken, mockData.refreshToken, mockData.user);
        return mockData;
      }
    );
  },

  getCurrentUser: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/auth/me'); return res.data; },
      () => MOCK_USER
    );
  },

  getSsoToken: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/auth/sso/token'); return res.data; },
      () => ({ token: MOCK_TOKEN + '-sso', expiresIn: 3600 })
    );
  },

  updateSettings: async (updates: any) => {
    return withFallback(
      async () => { const res = await apiClient.put('/auth/settings', updates); return res.data; },
      () => ({ success: true, ...updates })
    );
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
    localStorage.removeItem('businessOnboarding');
    localStorage.removeItem('businessOnboardingStep');
    localStorage.removeItem('businessOnboardingCompleted');
    clearSharedAuthCookies();
  },

  // Onboarding
  searchAddress: async (postcode: string) => {
    return withFallback(
      async () => { const res = await apiClient.get(`/business/search-address?postcode=${encodeURIComponent(postcode)}`); return res.data; },
      () => [
        { displayName: '10 Downing Street, Westminster, London, SW1A 2AA', line1: '10 Downing Street', line2: 'Westminster', city: 'London', postcode: postcode || 'SW1A 2AA', country: 'UK' },
        { displayName: '221B Baker Street, Marylebone, London, NW1 6XE', line1: '221B Baker Street', line2: 'Marylebone', city: 'London', postcode: postcode || 'NW1 6XE', country: 'UK' },
      ]
    );
  },

  checkLocation: async (postcode: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/localmall/onboarding/check-location', { postcode }); return res.data; },
      () => ({ available: true, area: 'Central London', borough: 'Westminster' })
    );
  },

  searchGoogleBusinesses: async (queryText: string, radius: number = 5000) => {
    return withFallback(
      async () => { const res = await apiClient.get(`/google/google-business?queryText=${encodeURIComponent(queryText)}&radius=${radius}`); return res.data; },
      () => ({
        businesses: [
          { placeId: 'mock-place-001', name: queryText + ' - Central', address: '123 High Street, London', category: 'Restaurant', rating: 4.5, totalReviews: 120 },
          { placeId: 'mock-place-002', name: queryText + ' - North', address: '456 North Road, London', category: 'Cafe', rating: 4.2, totalReviews: 85 },
        ]
      })
    );
  },

  getGooglePlaceDetails: async (placeId: string) => {
    return withFallback(
      async () => { const res = await apiClient.get(`/google/google-business/${placeId}`); return res.data; },
      () => ({
        placeId, name: 'Test Business', address: '123 High Street, London, SW1A 1AA',
        phone: '+44 20 7946 0000', website: 'https://example.com', category: 'Restaurant',
        openingHours: { monday: '9:00-17:00' },
      })
    );
  },

  startClaim: async (placeId: string, returnUrl: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/claim/start', { placeId, returnUrl }); return res.data; },
      () => ({ claimId: 'mock-claim-' + Date.now(), status: 'pending', verificationUrl: returnUrl })
    );
  },

  mapGoogleCategory: async (googleCategoryId: string) => {
    return withFallback(
      async () => { const res = await apiClient.get(`/google-business/map-category?googleCategoryId=${encodeURIComponent(googleCategoryId)}`); return res.data; },
      () => ({ mcomCategory: 'Food & Dining', subcategory: 'Restaurant' })
    );
  },

  completeGoogleOnboarding: async (data: any) => {
    return withFallback(
      async () => {
        const res = await apiClient.post('/google-business/complete-onboarding', data);
        if (res.data?.accessToken) {
          localStorage.setItem('auth_token', res.data.accessToken);
          localStorage.setItem('business_user', JSON.stringify(res.data.user));
        }
        return res.data;
      },
      () => {
        const mockData = { accessToken: MOCK_TOKEN, user: { ...MOCK_USER, ...data } };
        localStorage.setItem('auth_token', mockData.accessToken);
        localStorage.setItem('business_user', JSON.stringify(mockData.user));
        return mockData;
      }
    );
  },

  // Profile
  getProfile: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/business/profile'); return res.data; },
      () => ({
        id: 'mock-biz-001', businessName: MOCK_USER.businessName, sector: MOCK_USER.sector,
        category: MOCK_USER.category, email: MOCK_USER.email, phone: '+44 20 7946 0000',
        address: '123 High Street, London, SW1A 1AA', postcode: 'SW1A 1AA',
        membership: 'Gold', membershipSub: 'Pro', status: 'active',
        logo: null, website: 'https://example.com',
      })
    );
  },

  updateProfile: async (updates: any) => {
    return withFallback(
      async () => { const res = await apiClient.put('/business/profile', updates); return res.data; },
      () => ({ success: true, ...updates })
    );
  },

  generateApiKey: async () => {
    return withFallback(
      async () => { const res = await apiClient.post('/business/api-key'); return res.data; },
      () => ({ apiKey: 'mcom_mock_key_' + Date.now(), createdAt: new Date().toISOString() })
    );
  },

  // Pricing & Plans
  getPlans: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/pricing/plans'); return res.data; },
      () => []
    );
  },

  subscribeMembership: async (level: string, tier: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/pricing/subscribe', { level, tier }); return res.data; },
      () => ({ success: true, membership: level, tier, status: 'active', startDate: new Date().toISOString() })
    );
  },

  purchasePackage: async (platform: string, packageName: string) => {
    return withFallback(
      async () => { const res = await apiClient.post('/pricing/packages/purchase', { platform, packageName }); return res.data; },
      () => ({ success: true, platform, packageName, purchaseDate: new Date().toISOString() })
    );
  },

  getTransactions: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/pricing/transactions'); return res.data; },
      () => [
        { id: 'txn-001', description: 'Gold Pro Membership', amount: 599, date: '2026-01-15', status: 'paid' },
        { id: 'txn-002', description: 'MCOM Rewards Package', amount: 79, date: '2026-02-01', status: 'paid' },
      ]
    );
  },

  // Notifications
  getNotifications: async () => {
    return withFallback(
      async () => { const res = await apiClient.get('/notifications'); return res.data; },
      () => [
        { id: 'n-1', message: 'Your Gold membership is active', type: 'success', read: false, createdAt: new Date().toISOString() },
        { id: 'n-2', message: 'Welcome to the 90-Day Business Success Programme', type: 'info', read: false, createdAt: new Date().toISOString() },
        { id: 'n-3', message: 'Complete your business profile to earn readiness points', type: 'warning', read: true, createdAt: new Date().toISOString() },
      ]
    );
  },

  markAllNotificationsRead: async () => {
    return withFallback(
      async () => { const res = await apiClient.post('/notifications/read-all'); return res.data; },
      () => ({ success: true })
    );
  },

  deleteNotification: async (id: string) => {
    return withFallback(
      async () => { const res = await apiClient.delete(`/notifications/${id}`); return res.data; },
      () => ({ success: true })
    );
  },

  // Directory
  getAllBusinesses: async (searchQuery?: string) => {
    return withFallback(
      async () => {
        const url = searchQuery ? `/business?search=${encodeURIComponent(searchQuery)}` : '/business';
        const res = await apiClient.get(url);
        return res.data;
      },
      () => [
        { id: 'biz-001', businessName: 'Test Restaurant', sector: 'Hospitality', category: 'Restaurant', status: 'active' },
        { id: 'biz-002', businessName: 'Test Shop', sector: 'Retail', category: 'Fashion', status: 'active' },
      ]
    );
  },

  getBusinessById: async (id: string) => {
    return withFallback(
      async () => { const res = await apiClient.get(`/business/${id}`); return res.data; },
      () => ({ id, businessName: 'Test Business', sector: 'Hospitality', category: 'Restaurant', status: 'active' })
    );
  },

  deleteBusiness: async (id: string) => {
    return withFallback(
      async () => { const res = await apiClient.delete(`/business/${id}`); return res.data; },
      () => ({ success: true })
    );
  },
};
