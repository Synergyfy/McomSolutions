import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from './index';

export const useStripeInitiate = () => {
  return useMutation({
    mutationFn: ({ level, tier, billing, isTrial }: { level: string; tier: string; billing: string; isTrial: boolean }) =>
      paymentApi.stripeInitiate(level, tier, billing, isTrial),
  });
};

export const useStripeConfirm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ level, tier, billing, paymentIntentId, isTrial }: { level: string; tier: string; billing: string; paymentIntentId: string; isTrial: boolean }) =>
      paymentApi.stripeConfirm(level, tier, billing, paymentIntentId, isTrial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

export const usePaypalInitiate = () => {
  return useMutation({
    mutationFn: ({ level, tier, billing, returnUrl, cancelUrl, isTrial }: { level: string; tier: string; billing: string; returnUrl: string; cancelUrl: string; isTrial: boolean }) =>
      paymentApi.paypalInitiate(level, tier, billing, returnUrl, cancelUrl, isTrial),
  });
};

export const usePaypalCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentApi.paypalCapture(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

// ─── Platform Plan Purchases ──────────────────────────────────────────
export const usePlatformStripeInitiate = () => {
  return useMutation({
    mutationFn: (data: { platform: string; externalPlanId: string; billingCycle: string; returnUrl?: string; cancelUrl?: string }) =>
      paymentApi.platformStripeInitiate(data),
  });
};

export const usePlatformStripeConfirm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { platform: string; externalPlanId: string; billingCycle: string; paymentIntentId: string }) =>
      paymentApi.platformStripeConfirm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['activePlans'] });
    },
  });
};

export const usePlatformPaypalInitiate = () => {
  return useMutation({
    mutationFn: (data: { platform: string; externalPlanId: string; billingCycle: string; returnUrl?: string; cancelUrl?: string }) =>
      paymentApi.platformPaypalInitiate(data),
  });
};

export const usePlatformPaypalCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentApi.platformPaypalCapture(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['activePlans'] });
    },
  });
};

// ─── Public Platform Plans ──────────────────────────────────────────
export const usePlatformPlans = (platform: string | null) => {
  return useQuery({
    queryKey: ['platformPlans', platform],
    queryFn: () => paymentApi.getPlatformPlans(platform!),
    enabled: !!platform,
  });
};
