import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { walletAdminApi } from '../api/wallet-admin.api';

export const walletAdminKeys = {
  all: ['wallet-admin'] as const,
  wallets: (params?: Record<string, any>) => ['wallet-admin', 'wallets', params] as const,
  wallet: (id: string) => ['wallet-admin', 'wallet', id] as const,
  transactions: (id: string, params?: Record<string, any>) => ['wallet-admin', 'transactions', id, params] as const,
  reports: () => ['wallet-admin', 'reports'] as const,
  auditLog: () => ['wallet-admin', 'audit'] as const,
};

export const useAdminWallets = (params?: Record<string, any>) =>
  useQuery({
    queryKey: walletAdminKeys.wallets(params),
    queryFn: () => walletAdminApi.listWallets(params),
    placeholderData: (prev: any) => prev,
  });

export const useAdminWallet = (walletId: string) =>
  useQuery({
    queryKey: walletAdminKeys.wallet(walletId),
    queryFn: () => walletAdminApi.getWallet(walletId),
    enabled: !!walletId,
  });

export const useAdminWalletTransactions = (walletId: string, params?: Record<string, any>) =>
  useQuery({
    queryKey: walletAdminKeys.transactions(walletId, params),
    queryFn: () => walletAdminApi.getTransactions(walletId, params),
    enabled: !!walletId,
  });

export const useAdminWalletMutation = (walletId: string, action: 'freeze' | 'unfreeze' | 'close' | 'credit' | 'debit' | 'limits') => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => {
      switch (action) {
        case 'freeze':
        case 'unfreeze':
        case 'close':
          return walletAdminApi[action](walletId, payload.reason);
        case 'credit':
        case 'debit':
          return walletAdminApi.adjust(walletId, action, payload);
        case 'limits':
          return walletAdminApi.setLimits(walletId, payload);
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletAdminKeys.wallet(walletId) });
      queryClient.invalidateQueries({ queryKey: walletAdminKeys.wallets() });
    },
  });
};

export const useReverseTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      walletAdminApi.reverseTransaction(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: walletAdminKeys.all });
    },
  });
};

export const useWalletReports = () =>
  useQuery({
    queryKey: walletAdminKeys.reports(),
    queryFn: async () => ({
      platformSummary: await walletAdminApi.getPlatformSummary(),
      dailyVolume: await walletAdminApi.getDailyVolume(),
      reconciliation: await walletAdminApi.getReconciliation(),
    }),
  });

export const useWalletAuditLog = (params?: Record<string, any>) =>
  useQuery({
    queryKey: walletAdminKeys.auditLog(),
    queryFn: () => walletAdminApi.getAuditLog(params),
  });