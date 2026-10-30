import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentApi } from './index';

export const useStripeInitiate = () => {
  return useMutation({
    mutationFn: ({ level, tier, billing, isTrial, paymentPlan, couponCode, autoRenew }: { level: string; tier: string; billing: string; isTrial: boolean; paymentPlan?: string; couponCode?: string; autoRenew?: boolean }) =>
      paymentApi.stripeInitiate(level, tier, billing, isTrial, paymentPlan ?? 'full', couponCode, autoRenew ?? false),
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
    mutationFn: ({ level, tier, billing, returnUrl, cancelUrl, isTrial, paymentPlan, couponCode, autoRenew }: { level: string; tier: string; billing: string; returnUrl: string; cancelUrl: string; isTrial: boolean; paymentPlan?: string; couponCode?: string; autoRenew?: boolean }) =>
      paymentApi.paypalInitiate(level, tier, billing, returnUrl, cancelUrl, isTrial, paymentPlan ?? 'full', couponCode, autoRenew ?? false),
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

// ─── MCOM Wallet Membership Purchases ─────────────────────────────────
export const useMembershipWalletPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: {
        level: string;
        tier: string;
        billing: string;
        paymentPlan?: string;
        couponCode?: string;
        autoRenew?: boolean;
      };
      idempotencyKey: string;
    }) => paymentApi.membershipWalletPurchase(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['my-coupons'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
};

// ─── Access Pass Purchases ────────────────────────────────────────────
export const useAccessStripeInitiate = () => {
  return useMutation({
    mutationFn: (data: {
      accessPlanId: string;
      couponCode?: string;
      purchaseMode?: 'SELF' | 'GIFT' | 'CODE';
      recipientEmail?: string;
      entitlementChoice?: 'membership' | 'access_pass';
    }) => paymentApi.accessStripeInitiate(data),
  });
};

export const useAccessStripeConfirm = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { accessPlanId: string; paymentIntentId: string }) =>
      paymentApi.accessStripeConfirm(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useAccessPaypalInitiate = () => {
  return useMutation({
    mutationFn: (data: {
      accessPlanId: string;
      returnUrl: string;
      cancelUrl: string;
      couponCode?: string;
      purchaseMode?: 'SELF' | 'GIFT' | 'CODE';
      recipientEmail?: string;
      entitlementChoice?: 'membership' | 'access_pass';
    }) => paymentApi.accessPaypalInitiate(data),
  });
};

export const useAccessPaypalCapture = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => paymentApi.accessPaypalCapture(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useAccessWalletPurchase = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      data,
      idempotencyKey,
    }: {
      data: {
        accessPlanId: string;
        couponCode?: string;
        purchaseMode?: 'SELF' | 'GIFT' | 'CODE';
        recipientEmail?: string;
        entitlementChoice?: 'membership' | 'access_pass';
      };
      idempotencyKey: string;
    }) => paymentApi.accessWalletPurchase(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
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

// ─── Recurring subscriptions ───────────────────────────────────────────
export const useRecurringMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  };
  return {
    cancel: useMutation({
      mutationFn: ({ id, immediate }: { id: string; immediate?: boolean }) =>
        paymentApi.cancelRecurring(id, immediate ?? false),
      onSuccess: invalidate,
    }),
    resume: useMutation({
      mutationFn: (id: string) => paymentApi.resumeRecurring(id),
      onSuccess: invalidate,
    }),
    setAutoRenew: useMutation({
      mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
        paymentApi.setRecurringAutoRenew(id, enabled),
      onSuccess: invalidate,
    }),
    enableWallet: useMutation({
      mutationFn: (data: { scope: 'MEMBERSHIP' | 'PLATFORM'; billingCycle: string; platform?: string }) =>
        paymentApi.enableWalletRecurring(data),
      onSuccess: invalidate,
    }),
  };
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
