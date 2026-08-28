import { apiClient } from '../../../../services/api';

export interface AdminWalletListItem {
  id: string;
  userId: string;
  email: string;
  balance: number;
  availableBalance: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface AdminWalletDetail extends AdminWalletListItem {
  dailyDebitLimit?: number | null;
  monthlyDebitLimit?: number | null;
  maxBalance?: number | null;
  activeHolds: Array<{ id: string; amount: number; platformClientId: string; platformName: string; reference?: string | null; status: string; expiresAt: string }>;
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  platformClientId?: string | null;
  platformName?: string | null;
  platformSlug?: string | null;
  category: string;
  reference?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const walletAdminApi = {
  listWallets: (params?: Record<string, any>) =>
    apiClient.get<Paginated<AdminWalletListItem>>('/wallet/admin/wallets', { params }).then((r) => r.data),

  getWallet: (walletId: string) =>
    apiClient.get<AdminWalletDetail>(`/wallet/admin/wallets/${walletId}`).then((r) => r.data),

  getWalletByUser: (userId: string) =>
    apiClient.get<AdminWalletDetail>(`/wallet/admin/wallets/user/${userId}`).then((r) => r.data),

  freeze: (walletId: string, reason: string) =>
    apiClient.patch(`/wallet/admin/wallets/${walletId}/freeze`, { reason }).then((r) => r.data),

  unfreeze: (walletId: string, reason: string) =>
    apiClient.patch(`/wallet/admin/wallets/${walletId}/unfreeze`, { reason }).then((r) => r.data),

  close: (walletId: string, reason: string) =>
    apiClient.patch(`/wallet/admin/wallets/${walletId}/close`, { reason }).then((r) => r.data),

  adjust: (walletId: string, direction: 'credit' | 'debit', data: any) =>
    apiClient.post(`/wallet/admin/wallets/${walletId}/${direction}`, data).then((r) => r.data),

  setLimits: (walletId: string, data: any) =>
    apiClient.patch(`/wallet/admin/wallets/${walletId}/limits`, data).then((r) => r.data),

  getTransactions: (walletId: string, params?: Record<string, any>) =>
    apiClient
      .get<Paginated<WalletTransaction>>(`/wallet/admin/wallets/${walletId}/transactions`, { params })
      .then((r) => r.data),

  reverseTransaction: (id: string, reason: string) =>
    apiClient.post(`/wallet/admin/transactions/${id}/reverse`, { reason }).then((r) => r.data),

  getPlatformSummary: (dateFrom?: string, dateTo?: string) =>
    apiClient.get('/wallet/admin/reports/platform-summary', { params: { dateFrom, dateTo } }).then((r) => r.data),

  getDailyVolume: (dateFrom?: string, dateTo?: string) =>
    apiClient.get('/wallet/admin/reports/daily-volume', { params: { dateFrom, dateTo } }).then((r) => r.data),

  getReconciliation: () =>
    apiClient.get('/wallet/admin/reports/reconciliation').then((r) => r.data),

  getAuditLog: (params?: Record<string, any>) =>
    apiClient.get('/wallet/admin/audit-log', { params }).then((r) => r.data),
};