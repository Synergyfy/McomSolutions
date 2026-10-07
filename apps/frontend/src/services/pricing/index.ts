import { apiClient } from '../api';

export const pricingApi = {
  getPlans: async () => {
    const res = await apiClient.get('/pricing/plans');
    return res.data;
  },

  subscribeMembership: async (
    level: string,
    tier: string = 'standard',
    billing: string = 'monthly',
    isTrial: boolean = false,
  ) => {
    const res = await apiClient.post('/pricing/subscribe', { level, tier, billing, isTrial });
    return res.data;
  },

  // purchasePackage + getPackageTemplates — REMOVED (memberships-only model).
  // Standalone packages are bought on the console-registered external platforms.

  getTransactions: async () => {
    const res = await apiClient.get('/pricing/transactions');
    return res.data;
  },

  getSubscriptions: async () => {
    const res = await apiClient.get('/pricing/subscriptions');
    return res.data;
  },
};

