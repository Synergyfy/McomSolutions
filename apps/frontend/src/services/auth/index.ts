import { apiClient, setSharedAuthCookies, clearSharedAuthCookies } from '../api';
import type { LoginCredentials, RegisterData, ResetPasswordData, SettingsUpdateData } from './hooks';

export const authApi = {
  sendOtp: async (email: string) => {
    const res = await apiClient.post('/auth/send-otp', { email });
    return res.data;
  },

  verifyOtp: async (email: string, code: string) => {
    const res = await apiClient.post('/auth/verify-otp', { email, code });
    return res.data;
  },

  resendOtp: async (email: string) => {
    const res = await apiClient.post('/auth/resend-otp', { email });
    return res.data;
  },

  login: async (credentials: LoginCredentials) => {
    const res = await apiClient.post('/auth/login', credentials);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res.data;
  },

  register: async (data: RegisterData) => {
    const res = await apiClient.post('/auth/register', data);
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken);
      localStorage.setItem('business_user', JSON.stringify(res.data.user));
      setSharedAuthCookies(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res.data;
  },

  getCurrentUser: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },

  getSsoToken: async (targetClientId?: string) => {
    const params = targetClientId ? `?target_client_id=${encodeURIComponent(targetClientId)}` : '';
    const res = await apiClient.get(`/auth/sso/token${params}`);
    return res.data;
  },

  forgotPassword: async (email: string) => {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (data: ResetPasswordData) => {
    const res = await apiClient.post('/auth/reset-password', data);
    return res.data;
  },

  postSsoAuthorize: async (clientId: string, redirectUri: string, scope?: string, state?: string) => {
    const res = await apiClient.post('/auth/sso/authorize', {
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
    });
    return res.data;
  },

  updateSettings: async (updates: SettingsUpdateData) => {
    const res = await apiClient.put('/auth/settings', updates);
    return res.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('business_user');
    localStorage.removeItem('businessOnboarding');
    localStorage.removeItem('businessOnboardingStep');
    localStorage.removeItem('businessOnboardingCompleted');
    clearSharedAuthCookies();
  },
};
