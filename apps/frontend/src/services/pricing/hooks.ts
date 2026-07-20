import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingApi } from './index';

export const usePlans = () => {
  return useQuery({
    queryKey: ['plans'],
    queryFn: () => pricingApi.getPlans(),
    staleTime: 1000 * 60 * 10, // 10 minutes — plans rarely change
  });
};

export const useSubscribeMembership = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ level, tier }: { level: string; tier: string }) =>
      pricingApi.subscribeMembership(level, tier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};

export const usePurchasePackage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ platform, packageName }: { platform: string; packageName: string }) =>
      pricingApi.purchasePackage(platform, packageName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useTransactions = () => {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => pricingApi.getTransactions(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
};
