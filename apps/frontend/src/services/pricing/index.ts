import { apiClient } from '../api';

export const pricingApi = {
  getPlans: async () => {
    const res = await apiClient.get('/pricing/plans');
    return res.data;
  },

  subscribeMembership: async (level: string, tier: string) => {
    const res = await apiClient.post('/pricing/subscribe', { level, tier });
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
};
