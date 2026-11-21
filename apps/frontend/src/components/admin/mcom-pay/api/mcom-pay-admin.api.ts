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

export type WalletActivityType = 'CREDIT' | 'DEBIT';

export type WalletActivityCategory =
  | 'TOP_UP'
  | 'REWARD'
  | 'REFUND'
  | 'ADMIN_CREDIT'
  | 'TRANSFER_IN'
  | 'SUBSCRIPTION'
  | 'PURCHASE'
  | 'SERVICE_FEE'
  | 'ADMIN_DEBIT'
  | 'TRANSFER_OUT'
  | 'HOLD_CAPTURE';

export interface WalletActivity {
  id: string;
  type: WalletActivityType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  currency: string;
  category: WalletActivityCategory;
  reference?: string | null;
  description?: string | null;
  status: string;
  platformClientId?: string | null;
  platformName?: string | null;
  platformSlug?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role?: string | null;
  } | null;
  business?: {
    id: string;
    businessName: string;
    email?: string | null;
  } | null;
}

export interface WalletActivityFilters {
  search?: string;
  category?: WalletActivityCategory | '';
  type?: WalletActivityType | '';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
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

  listWalletActivity: (params: WalletActivityFilters) =>
    apiClient
      .get<Paginated<WalletActivity>>('/admin/app-payments/wallet-activity', { params })
      .then((r) => r.data),
};

// ─── Central ledger (Phase 6) ───────────────────────────────────────────────

export type LedgerIntent =
  | 'ORDER'
  | 'BOOKING'
  | 'DELEGATION'
  | 'PURCHASE'
  | 'SUBSCRIPTION'
  | 'REFERRAL_COMMISSION'
  | 'TOP_UP'
  | 'REFUND'
  | 'PAYOUT'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'FEE'
  | 'CHARGEBACK'
  | 'OPENING_BALANCE';

export interface LedgerOverview {
  platformWalletMinor: string;
  currency: string;
  userFloatMinor: string;
  owedToPartnersMinor: string;
  assetsMinor: string;
  liabilitiesMinor: string;
  equityMinor: string;
  inflow30dMinor: string;
  outflow30dMinor: string;
  net30dMinor: string;
  gmv30dMinor: string;
  transfersToday: number;
  chargesAwaitingSettlement: number;
  generatedAt: string;
}

export interface PlatformWalletSummary {
  code?: string;
  balanceMinor: string;
  currency: string;
  status: string;
  lifetimeInflowMinor?: string;
  lifetimeOutflowMinor?: string;
  pendingReferralPayouts?: number;
}

export interface LedgerAccountRow {
  code: string;
  type: string;
  scope: string;
  ownerRef: string | null;
  currency: string;
  balanceMinor: string;
  status: string;
}

export interface LedgerTransferRow {
  id: string;
  intent: LedgerIntent;
  platformId: string | null;
  reference: string | null;
  description: string | null;
  initiatorType: string;
  createdAt: string;
  amountMinor: string;
  steps: number;
  legs: number;
  accounts: string[];
  debitAccounts: string[];
  from: string[];
  to: string[];
}

export interface LedgerEntry {
  id: string;
  account: string;
  accountLabel?: string;
  accountType: string;
  direction: 'debit' | 'credit';
  amountMinor: string;
  currency: string;
}

export interface LedgerTransaction {
  id: string;
  currency: string;
  amountMinor: string;
  status: string;
  postedAt: string;
  entries: LedgerEntry[];
}

export interface LedgerTransferDetail {
  id: string;
  intent: LedgerIntent;
  platformId: string | null;
  reference: string | null;
  description: string | null;
  initiatorType: string;
  initiatorId: string | null;
  idempotencyKey: string;
  reversalOfId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  amountMinor: string;
  transactions: LedgerTransaction[];
  siblings: Array<{ id: string; intent: LedgerIntent; createdAt: string; amountMinor: string }>;
}

export interface LedgerEntryRow {
  id: string;
  direction: 'debit' | 'credit';
  amountMinor: string;
  currency: string;
  createdAt: string;
  transfer: {
    id: string;
    intent: LedgerIntent;
    platformId: string | null;
    reference: string | null;
    description: string | null;
    createdAt: string;
  };
}

export interface AccountEntriesPage {
  success: boolean;
  data: LedgerEntryRow[];
  account: { code: string; type: string; balanceMinor: string; currency: string };
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TransferFilters {
  intent?: LedgerIntent | '';
  platformId?: string;
  reference?: string;
  accountCode?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface LedgerParty {
  account: string;
  label: string;
  amountMinor: string;
}

export interface EventPayer {
  identified: boolean;
  /** The Central Hub Solution user id the app supplied, if any. */
  mcomUserId: string | null;
  userId: string | null;
  name: string | null;
  email: string | null;
  /** The app's own customer reference — not a CHS identity. */
  appCustomerRef: string | null;
  method: string;
  provider: string | null;
}

export interface LedgerEventRow {
  key: string;
  reference: string | null;
  primaryIntent: LedgerIntent;
  intents: LedgerIntent[];
  platformIds: string[];
  createdAt: string;
  debits: LedgerParty[];
  credits: LedgerParty[];
  totalDebitMinor: string;
  totalCreditMinor: string;
  transfers: number;
  transferId: string;
  payer: EventPayer | null;
  noPayee: boolean | null;
}

export type PlatformActivityRow = LedgerEventRow;

export interface EventChargeSplit {
  id: string;
  payeeType: string;
  payeeUserId: string | null;
  payeeExternalId: string | null;
  amountMinor: string;
  feeMinor: string;
  netMinor: string;
  status: string;
  walletTransactionId: string | null;
  failureReason: string | null;
}

export interface EventCharge {
  id: string;
  appClientId: string;
  method: string;
  status: string;
  amountMinor: string;
  feeMinor: string;
  netMinor: string;
  refundedMinor: string;
  reference: string | null;
  mcomUserId: string | null;
  provider: string | null;
  providerRef: string | null;
  settlementState: string;
  paidAt: string | null;
  createdAt: string;
  feeConfig: { feePercent: string | null; feeFixedMinor: string | null };
  currentFeeConfig: { feePercent: string; feeFixedMinor: string; source: string };
  splits: EventChargeSplit[];
}

export interface EventJournalEntry {
  id: string;
  account: string;
  accountLabel: string;
  accountType: string;
  direction: 'debit' | 'credit';
  amountMinor: string;
  currency: string;
}

export interface EventTransfer {
  id: string;
  intent: LedgerIntent;
  reference: string | null;
  description: string | null;
  platformId: string | null;
  initiatorType: string;
  initiatorId: string | null;
  idempotencyKey: string;
  reversalOfId: string | null;
  createdAt: string;
  steps: Array<{
    id: string;
    amountMinor: string;
    currency: string;
    status: string;
    postedAt: string;
    entries: EventJournalEntry[];
  }>;
}

export interface EventWalletTransaction {
  id: string;
  type: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  currency: string;
  category: string;
  status: string;
  walletId: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

export interface LedgerEventDetail {
  key: string;
  reference: string | null;
  primaryIntent: LedgerIntent;
  intents: LedgerIntent[];
  platformIds: string[];
  createdAt: string;
  descriptions: string[];
  debits: LedgerParty[];
  credits: LedgerParty[];
  transfers: EventTransfer[];
  charge: EventCharge | null;
  walletTransactions: EventWalletTransaction[];
  payer: EventPayer | null;
  noPayee: boolean | null;
}

export interface TrendPoint {
  bucket: string;
  volumeMinor: string;
  transfers: number;
  platformInflowMinor: string;
  platformOutflowMinor: string;
}

export interface PlatformAnalyticsRow {
  platformId: string;
  volumeMinor: string;
  transfers: number;
  platformInflowMinor: string;
  platformOutflowMinor: string;
}

export interface IntentAnalyticsRow {
  intent: LedgerIntent;
  volumeMinor: string;
  transfers: number;
  share: number;
}

export const ledgerAdminApi = {
  getOverview: () =>
    apiClient.get<{ success: boolean; data: LedgerOverview }>('/admin/mcom-pay/overview').then((r) => r.data.data),

  getPlatformWallet: () =>
    apiClient
      .get<{ success: boolean; data: PlatformWalletSummary }>('/admin/mcom-pay/platform-wallet')
      .then((r) => r.data.data),

  getPlatforms: () =>
    apiClient
      .get<{ success: boolean; data: Array<{ platformId: string; name: string }> }>(
        '/admin/mcom-pay/platforms',
      )
      .then((r) => r.data.data),

  getEvents: (params: {
    page?: number;
    limit?: number;
    platformId?: string;
    intent?: LedgerIntent | '';
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) =>
    apiClient
      .get<Paginated<LedgerEventRow> & { account: { balanceMinor: string; currency: string } | null }>(
        '/admin/mcom-pay/events',
        { params },
      )
      .then((r) => r.data),

  getEvent: (key: string) =>
    apiClient
      .get<{ success: boolean; data: LedgerEventDetail }>(`/admin/mcom-pay/events/${encodeURIComponent(key)}`)
      .then((r) => r.data.data),

  getPlatformActivity: (params: { page?: number; limit?: number }) =>
    apiClient
      .get<{
        success: boolean;
        data: PlatformActivityRow[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        account: { code: string; balanceMinor: string; currency: string } | null;
      }>('/admin/mcom-pay/platform-wallet/activity', { params })
      .then((r) => r.data),

  getPlatformWalletEntries: (params: { page?: number; limit?: number }) =>
    apiClient
      .get<AccountEntriesPage>('/admin/mcom-pay/platform-wallet/transactions', { params })
      .then((r) => r.data),

  listAccounts: (params?: { type?: string; scope?: string; search?: string }) =>
    apiClient
      .get<{ success: boolean; data: LedgerAccountRow[]; total: number }>('/admin/mcom-pay/accounts', { params })
      .then((r) => r.data),

  getAccountEntries: (code: string, params: { page?: number; limit?: number }) =>
    apiClient
      .get<AccountEntriesPage>(`/admin/mcom-pay/accounts/${encodeURIComponent(code)}/entries`, { params })
      .then((r) => r.data),

  listTransfers: (params: TransferFilters) =>
    apiClient
      .get<Paginated<LedgerTransferRow>>('/admin/mcom-pay/transfers', { params })
      .then((r) => r.data),

  getTransfer: (id: string) =>
    apiClient
      .get<{ success: boolean; data: LedgerTransferDetail }>(`/admin/mcom-pay/transfers/${id}`)
      .then((r) => r.data.data),

  getReconciliation: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/admin/mcom-pay/reconciliation').then((r) => r.data.data),

  getShadow: () =>
    apiClient.get<{ success: boolean; data: unknown }>('/admin/mcom-pay/reconciliation/shadow').then((r) => r.data.data),

  getTrend: (params: { from?: string; to?: string; groupBy?: 'day' | 'week' | 'month'; platformId?: string }) =>
    apiClient
      .get<{ success: boolean; data: TrendPoint[]; meta: any }>('/admin/mcom-pay/analytics/trend', { params })
      .then((r) => r.data),

  getByPlatform: (params: { from?: string; to?: string }) =>
    apiClient
      .get<{ success: boolean; data: PlatformAnalyticsRow[]; totals: any; meta: any }>(
        '/admin/mcom-pay/analytics/by-platform',
        { params },
      )
      .then((r) => r.data),

  getByIntent: (params: { from?: string; to?: string }) =>
    apiClient
      .get<{ success: boolean; data: IntentAnalyticsRow[]; meta: any }>(
        '/admin/mcom-pay/analytics/by-intent',
        { params },
      )
      .then((r) => r.data),
};
