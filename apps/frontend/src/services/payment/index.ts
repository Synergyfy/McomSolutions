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
};
