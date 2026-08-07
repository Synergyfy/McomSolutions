import { apiClient } from '../api';

export const paymentApi = {
  stripeInitiate: async (level: string, tier: string, billing: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/stripe/initiate', { level, tier, billing, isTrial });
    return res.data;
  },

  stripeConfirm: async (level: string, tier: string, billing: string, paymentIntentId: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/stripe/confirm', { level, tier, billing, paymentIntentId, isTrial });
    return res.data;
  },

  paypalInitiate: async (level: string, tier: string, billing: string, returnUrl: string, cancelUrl: string, isTrial: boolean) => {
    const res = await apiClient.post('/payment/paypal/initiate', { level, tier, billing, returnUrl, cancelUrl, isTrial });
    return res.data;
  },

  paypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/paypal/capture', { orderId });
    return res.data;
  },

  // ─── Platform Plan Purchases ──────────────────────────────────────────
  platformStripeInitiate: async (data: { platform: string; externalPlanId: string; billingCycle: string; returnUrl?: string; cancelUrl?: string }) => {
    const res = await apiClient.post('/payment/platform/stripe/initiate', data);
    return res.data;
  },

  platformStripeConfirm: async (data: { platform: string; externalPlanId: string; billingCycle: string; paymentIntentId: string }) => {
    const res = await apiClient.post('/payment/platform/stripe/confirm', data);
    return res.data;
  },

  platformPaypalInitiate: async (data: { platform: string; externalPlanId: string; billingCycle: string; returnUrl?: string; cancelUrl?: string }) => {
    const res = await apiClient.post('/payment/platform/paypal/initiate', data);
    return res.data;
  },

  platformPaypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/platform/paypal/capture', { orderId });
    return res.data;
  },

  // ─── Public Platform Plans (no auth) ──────────────────────────────────
  getPlatformPlans: async (platform: string) => {
    const res = await apiClient.get('/plans/platform', { params: { platform } });
    return res.data;
  },
};
