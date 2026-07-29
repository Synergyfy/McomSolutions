import { apiClient, setSharedAuthCookies } from '../api';

export const businessApi = {
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
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken ?? null, res.data.user);
    }
    return res.data;
  },

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
  },
};
