import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { walletApi } from './index';

export const walletQueryKeys = {
  all: ['wallet'] as const,
  wallet: () => [...walletQueryKeys.all, 'wallet'] as const,
  transactions: (filters?: Record<string, any>) => [...walletQueryKeys.all, 'transactions', filters] as const,
  transaction: (id: string) => [...walletQueryKeys.all, 'transactions', id] as const,
  holds: () => [...walletQueryKeys.all, 'holds'] as const,
  summary: (period: string) => [...walletQueryKeys.all, 'summary', period] as const,
  topUpHistory: () => [...walletQueryKeys.all, 'topup'] as const,
};

export const useMyWallet = () =>
  useQuery({
    queryKey: walletQueryKeys.wallet(),
    queryFn: () => walletApi.getMyWallet(),
    staleTime: 30 * 1000, // balance cached server-side 30s
  });

export const useWalletTransactions = (filters?: Record<string, any>) =>
  useQuery({
    queryKey: walletQueryKeys.transactions(filters),
    queryFn: () => walletApi.getTransactions(filters),
  });

export const useWalletTransaction = (id: string) =>
  useQuery({
    queryKey: walletQueryKeys.transaction(id),
    queryFn: () => walletApi.getTransaction(id),
    enabled: !!id,
  });

export const useWalletSummary = (period: '30d' | '90d' | '1y' = '30d') =>
  useQuery({
    queryKey: walletQueryKeys.summary(period),
    queryFn: () => walletApi.getSummary(period),
  });

export const useWalletHolds = () =>
  useQuery({
    queryKey: walletQueryKeys.holds(),
    queryFn: () => walletApi.getHolds(),
  });

export const useTopUpHistory = () =>
  useQuery({
    queryKey: walletQueryKeys.topUpHistory(),
    queryFn: () => walletApi.getTopUpHistory(),
  });

export const useInitiateTopUp = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, returnUrl, cancelUrl }: { amount: number; returnUrl?: string; cancelUrl?: string }) =>
      walletApi.initiateTopUp(amount, returnUrl, cancelUrl),
    onSuccess: () => {
      // Balance refreshes once the Stripe webhook credits the wallet.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: walletQueryKeys.all }), 4000);
    },
  });
};