import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from './index';

export const useStripeInitiate = () => {
  return useMutation({
    mutationFn: ({ level, tier, billing, isTrial, paymentPlan, couponCode }: { level: string; tier: string; billing: string; isTrial: boolean; paymentPlan?: string; couponCode?: string }) =>
      paymentApi.stripeInitiate(level, tier, billing, isTrial, paymentPlan ?? 'full', couponCode),
  });
};

export const useStripeConfirm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ level, tier, billing, paymentIntentId, isTrial, paymentPlan, couponCode }: { level: string; tier: string; billing: string; paymentIntentId: string; isTrial: boolean; paymentPlan?: string; couponCode?: string }) =>
      paymentApi.stripeConfirm(level, tier, billing, paymentIntentId, isTrial, paymentPlan ?? 'full', couponCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
    },
  });
};

export const usePaypalInitiate = () => {
  return useMutation({
    mutationFn: ({ level, tier, billing, returnUrl, cancelUrl, isTrial, paymentPlan, couponCode }: { level: string; tier: string; billing: string; returnUrl: string; cancelUrl: string; isTrial: boolean; paymentPlan?: string; couponCode?: string }) =>
      paymentApi.paypalInitiate(level, tier, billing, returnUrl, cancelUrl, isTrial, paymentPlan ?? 'full', couponCode),
  });
};

export const usePaypalCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentApi.paypalCapture(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
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


// ─── Verification Fee Hooks ──────────────────────────────────────────
export const useVerificationStripeInitiate = () => {
  return useMutation({
    mutationFn: () => paymentApi.verificationStripeInitiate(),
  });
};

export const useVerificationStripeConfirm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (paymentIntentId: string) => paymentApi.verificationStripeConfirm(paymentIntentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['businessProfile'] });
    },
  });
};

export const useVerificationPaypalInitiate = () => {
  return useMutation({
    mutationFn: ({ returnUrl, cancelUrl }: { returnUrl?: string; cancelUrl?: string }) =>
      paymentApi.verificationPaypalInitiate(returnUrl, cancelUrl),
  });
};

export const useVerificationPaypalCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentApi.verificationPaypalCapture(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['businessProfile'] });
    },
  });
};
