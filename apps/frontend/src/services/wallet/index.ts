import { apiClient } from '../api';

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  availableBalance: number;
  currency: string;
  status: string;
  dailyDebitLimit?: number | null;
  monthlyDebitLimit?: number | null;
  createdAt: string;
  lastTransactionAt?: string | null;
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
  initiatedBy?: string | null;
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

export interface WalletSummary {
  period: string;
  totalSpent: number;
  totalCredited: number;
  netFlow: number;
  spentByPlatform: Array<{ platformSlug: string; platformName: string; totalSpent: number; txnCount: number }>;
  topCategories: Array<{ category: string; total: number; count: number }>;
}

export interface TopUpInitiateResult {
  sessionId: string;
  checkoutUrl: string;
  status: string;
}

export const walletApi = {
  getMyWallet: () => apiClient.get<Wallet>('/wallet').then((r) => r.data),

  getTransactions: (filters?: Record<string, any>) =>
    apiClient.get<Paginated<WalletTransaction>>('/wallet/transactions', { params: filters }).then((r) => r.data),

  getTransaction: (id: string) =>
    apiClient.get<WalletTransaction>(`/wallet/transactions/${id}`).then((r) => r.data),

  initiateTopUp: (amount: number, returnUrl?: string, cancelUrl?: string) =>
    apiClient
      .post<TopUpInitiateResult>('/wallet/topup/initiate', { amount, returnUrl, cancelUrl })
      .then((r) => r.data),

  getTopUpHistory: (page = 1, limit = 20) =>
    apiClient.get('/wallet/topup/history', { params: { page, limit } }).then((r) => r.data),

  getHolds: () => apiClient.get('/wallet/holds').then((r) => r.data),

  getSummary: (period: '30d' | '90d' | '1y' = '30d') =>
    apiClient.get<WalletSummary>('/wallet/summary', { params: { period } }).then((r) => r.data),
};