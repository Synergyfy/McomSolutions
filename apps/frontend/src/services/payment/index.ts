import { apiClient } from '../api';
import type { PlatformConfirm, PlatformPurchase } from '../../types/contracts';

export const paymentApi = {
  stripeInitiate: async (level: string, tier: string, billing: string, isTrial: boolean, paymentPlan: string = 'full', couponCode?: string, autoRenew: boolean = false) => {
    const res = await apiClient.post('/payment/stripe/initiate', { level, tier, billing, isTrial, paymentPlan, couponCode, autoRenew });
    return res.data;
  },

  stripeConfirm: async (level: string, tier: string, billing: string, paymentIntentId: string, isTrial: boolean, paymentPlan: string = 'full', couponCode?: string) => {
    const res = await apiClient.post('/payment/stripe/confirm', { level, tier, billing, paymentIntentId, isTrial, paymentPlan, couponCode });
    return res.data;
  },

  paypalInitiate: async (level: string, tier: string, billing: string, returnUrl: string, cancelUrl: string, isTrial: boolean, paymentPlan: string = 'full', couponCode?: string, autoRenew: boolean = false) => {
    const res = await apiClient.post('/payment/paypal/initiate', { level, tier, billing, returnUrl, cancelUrl, isTrial, paymentPlan, couponCode, autoRenew });
    return res.data;
  },

  paypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/paypal/capture', { orderId });
    return res.data;
  },

  // ─── Platform Plan Purchases ──────────────────────────────────────────
  platformStripeInitiate: async (data: PlatformPurchase) => {
    const res = await apiClient.post('/payment/platform/stripe/initiate', data);
    return res.data;
  },

  platformStripeConfirm: async (data: PlatformConfirm) => {
    const res = await apiClient.post('/payment/platform/stripe/confirm', data);
    return res.data;
  },

  platformPaypalInitiate: async (data: PlatformPurchase) => {
    const res = await apiClient.post('/payment/platform/paypal/initiate', data);
    return res.data;
  },

  platformPaypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/platform/paypal/capture', { orderId });
    return res.data;
  },

  // ─── Recurring subscriptions ──────────────────────────────────────────
  listRecurring: async () => {
    const res = await apiClient.get('/recurring');
    return res.data;
  },

  cancelRecurring: async (id: string, immediate = false) => {
    const res = await apiClient.post(`/recurring/${id}/cancel`, { immediate });
    return res.data;
  },

  resumeRecurring: async (id: string) => {
    const res = await apiClient.post(`/recurring/${id}/resume`);
    return res.data;
  },

  setRecurringAutoRenew: async (id: string, enabled: boolean) => {
    const res = await apiClient.patch(`/recurring/${id}/auto-renew`, { enabled });
    return res.data;
  },

  enableWalletRecurring: async (data: {
    scope: 'MEMBERSHIP' | 'PLATFORM';
    billingCycle: string;
    platform?: string;
  }) => {
    const res = await apiClient.post('/recurring/wallet', data);
    return res.data;
  },

  // ─── Public Platform Plans (no auth) ──────────────────────────────────
  getPlatformPlans: async (platform: string) => {
    const res = await apiClient.get('/plans/platform', { params: { platform } });
    return res.data;
  },

  // ─── Verification Fee (£1.00) ─────────────────────────────────────────
  verificationStripeInitiate: async () => {
    const res = await apiClient.post('/payment/verification-fee/stripe/initiate');
    return res.data;
  },

  verificationStripeConfirm: async (paymentIntentId: string) => {
    const res = await apiClient.post('/payment/verification-fee/stripe/confirm', { paymentIntentId });
    return res.data;
  },

  verificationPaypalInitiate: async (returnUrl?: string, cancelUrl?: string) => {
    const res = await apiClient.post('/payment/verification-fee/paypal/initiate', { returnUrl, cancelUrl });
    return res.data;
  },

  verificationPaypalCapture: async (orderId: string) => {
    const res = await apiClient.post('/payment/verification-fee/paypal/capture', { orderId });
    return res.data;
  },

};
