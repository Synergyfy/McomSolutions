import { apiClient } from '../../../../services/api';

export type AppChargeMethod = 'stripe' | 'paypal' | 'wallet';
export type AppChargeStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export interface AppCharge {
  id: string;
  appClientId: string;
  amountMinor: string;
  currency: string;
  feeMinor: string;
  netMinor: string;
  method: AppChargeMethod;
  status: AppChargeStatus;
  reference?: string | null;
  description?: string | null;
  mcomUserId?: string | null;
  externalCustomerId?: string | null;
  provider?: string | null;
  providerRef?: string | null;
  walletDebitAmount?: string | null;
  paidAt?: string | null;
  createdAt: string;
  source?: 'app' | 'central';
}

export interface AppLedgerEntry {
  id: string;
  account: string;
  direction: 'debit' | 'credit';
  amountMinor: string;
  currency: string;
  provider?: string | null;
  providerRef?: string | null;
  reference?: string | null;
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

export interface AppChargeFilters {
  search?: string;
  appClientId?: string;
  status?: AppChargeStatus | '';
  mcomUserId?: string;
  reference?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Read-only admin surface for the MCOM Pay ledger.
 * Deliberately exposes NO create/update/delete calls — the ledger is immutable.
 */
export const mcomPayAdminApi = {
  listCharges: (params: AppChargeFilters) =>
    apiClient
      .get<Paginated<AppCharge>>('/admin/app-payments/charges', { params })
      .then((r) => r.data),

  getCharge: (id: string) =>
    apiClient.get<AppCharge>(`/admin/app-payments/charges/${id}`).then((r) => r.data),

  getLedger: (id: string) =>
    apiClient.get<AppLedgerEntry[]>(`/admin/app-payments/charges/${id}/ledger`).then((r) => r.data),
};
