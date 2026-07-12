import { useMutation, useQueryClient } from '@tanstack/react-query';
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
