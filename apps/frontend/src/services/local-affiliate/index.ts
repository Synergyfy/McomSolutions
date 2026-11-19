import { apiClient } from '../api';

// ── Types ────────────────────────────────────────────────────────────────

export type RewardUnit = 'POINTS' | 'CREDIT';

export interface RewardBalances {
  unit: RewardUnit;
  pending: number;
  approved: number;
  available: number;
  redeemed: number;
  expired: number;
  reversed: number;
  totalEarned: number;
}

export interface LocalAffiliateProfile {
  id: string;
  affiliateCode: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  displayName: string | null;
  affiliateLink: string;
  cardStatus: 'NOT_LINKED' | 'PENDING' | 'LINKED' | 'FAILED';
  createdAt: string;
  alreadyActive: boolean;
  balances?: RewardBalances;
}

export interface AffiliateOfferSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  media: string[];
  source: {
    providerCode: string | null;
    providerName: string | null;
    providerType: string | null;
    businessName: string | null;
  };
  category: { slug: string; name: string } | null;
  customerBenefit: Record<string, unknown> | null;
  redemptionMethod: string;
  integrationLevel: string;
  reward: {
    id: string;
    version: number;
    qualifyingEvent: string;
    rewardType: string;
    unit: RewardUnit;
    calculation: string;
    fixedUnits: string | number | null;
    percentage: string | number | null;
    approvalMode: string;
  } | null;
  startsAt: string | null;
  endsAt: string | null;
  canPromote: boolean;
  blockedReason?: string;
}

export interface AffiliateActivityItem {
  id: string;
  eventType: string;
  status: string;
  amountMinor: number | null;
  currency: string;
  occurredAt: string;
  offer: { id: string; title: string; slug: string; imageUrl: string | null } | null;
  reward: {
    units: string | number;
    unit: RewardUnit;
    status: string;
    explanationCode: string | null;
    explanationText: string | null;
  } | null;
}

export interface RewardLedgerRow {
  id: string;
  entryType: 'CREDIT' | 'DEBIT' | 'EXPIRY' | 'REVERSAL' | 'ADJUSTMENT';
  unit: RewardUnit;
  units: string | number;
  status: string;
  description: string;
  explanationCode: string | null;
  explanationText: string | null;
  createdAt: string;
  expiresAt: string | null;
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const unwrap = <T>(promise: Promise<{ data: T }>): Promise<T> =>
  promise.then((res) => res.data);

// ── API ──────────────────────────────────────────────────────────────────

export const localAffiliateApi = {
  // Registration
  activate: (body: {
    termsVersion: string;
    acceptTerms: boolean;
    inviteCode?: string;
  }) => unwrap<{ success: boolean; data: LocalAffiliateProfile }>(
    apiClient.post('/local-affiliate/activate', body),
  ),

  register: (body: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    postcode?: string;
    termsVersion: string;
    acceptTerms: boolean;
    inviteCode?: string;
  }) => unwrap<{ accessToken: string; data: LocalAffiliateProfile }>(
    apiClient.post('/local-affiliate/register', body),
  ),

  verifyEmail: (code: string) =>
    unwrap<{ success: boolean; data: { status: string; alreadyVerified: boolean } }>(
      apiClient.post('/local-affiliate/verify-email', { code }),
    ),
  resendVerification: () =>
    unwrap<{ success: boolean; message: string }>(
      apiClient.post('/local-affiliate/verification/resend'),
    ),

  // Profile
  me: () =>
    unwrap<{ success: boolean; data: LocalAffiliateProfile | null }>(
      apiClient.get('/local-affiliate/me'),
    ),
  updateMe: (body: { displayName?: string; marketingOptIn?: boolean }) =>
    unwrap(apiClient.patch('/local-affiliate/me', body)),
  link: () =>
    unwrap<{
      success: boolean;
      data: {
        affiliateCode: string;
        personalPageUrl: string;
        qrPayload: string;
        status: string;
      };
    }>(apiClient.get('/local-affiliate/link')),

  // Activity
  activitySummary: () =>
    unwrap<{
      success: boolean;
      data: {
        clicks: number;
        conversions: number;
        byEventType: Record<string, number>;
        byStatus: Record<string, number>;
        rewards: RewardBalances;
      };
    }>(apiClient.get('/local-affiliate/activity/summary')),
  activity: (params?: Record<string, unknown>) =>
    unwrap<Paginated<AffiliateActivityItem>>(
      apiClient.get('/local-affiliate/activity', { params }),
    ),
  clicks: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(apiClient.get('/local-affiliate/activity/clicks', { params })),

  // Rewards
  rewardsSummary: () =>
    unwrap<{ success: boolean; data: { points: RewardBalances; credits: RewardBalances } }>(
      apiClient.get('/local-affiliate/rewards/summary'),
    ),
  ledger: (params?: Record<string, unknown>) =>
    unwrap<Paginated<RewardLedgerRow>>(
      apiClient.get('/local-affiliate/rewards/ledger', { params }),
    ),
  redeem: (body: { rewardType: 'VOUCHER' | 'POINTS'; units: number; offerId?: string }) =>
    unwrap<{
      success: boolean;
      data: {
        redemptionId: string;
        voucherCode: string;
        unitsSpent: number;
        balanceAfter: number;
        offerId: string;
      };
    }>(apiClient.post('/local-affiliate/rewards/redeem', body)),
  redemptions: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(
      apiClient.get('/local-affiliate/rewards/redemptions', { params }),
    ),

  // Marketplace
  offers: (params?: Record<string, unknown>) =>
    unwrap<Paginated<AffiliateOfferSummary>>(apiClient.get('/affiliate-offers', { params })),
  offer: (slug: string) =>
    unwrap<{ success: boolean; data: AffiliateOfferSummary }>(
      apiClient.get(`/affiliate-offers/${slug}`),
    ),
  createLink: (offerId: string, body: { campaignId?: string } = {}) =>
    unwrap<{
      success: boolean;
      data: {
        trackingCode: string;
        trackingUrl: string;
        destinationUrl: string;
        qrPayload: string;
        offerId: string;
        campaignId: string | null;
      };
    }>(apiClient.post(`/affiliate-offers/${offerId}/link`, body)),
  campaigns: () => unwrap<{ success: boolean; data: any[] }>(apiClient.get('/affiliate-campaigns')),

  // Public
  publicAffiliate: (code: string) =>
    unwrap<{ success: boolean; data: any }>(apiClient.get(`/public/affiliate/${code}`)),
};

// ── Admin API ────────────────────────────────────────────────────────────

export const localAffiliateAdminApi = {
  listAffiliates: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(apiClient.get('/admin/local-affiliates', { params })),
  affiliateDetail: (id: string) =>
    unwrap<{ success: boolean; data: any }>(apiClient.get(`/admin/local-affiliates/${id}`)),
  setAffiliateStatus: (id: string, action: 'suspend' | 'reinstate' | 'close', reason?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/local-affiliates/${id}/${action}`, { reason }),
    ),

  listProviders: () => unwrap<{ success: boolean; data: any[] }>(apiClient.get('/admin/affiliate-providers')),
  createProvider: (body: Record<string, unknown>) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post('/admin/affiliate-providers', body)),
  testProvider: (id: string) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post(`/admin/affiliate-providers/${id}/test`)),

  listOffers: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(apiClient.get('/admin/affiliate-offers', { params })),
  createOffer: (body: Record<string, unknown>) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post('/admin/affiliate-offers', body)),
  approveOffer: (id: string) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post(`/admin/affiliate-offers/${id}/approve`)),
  pauseOffer: (id: string) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post(`/admin/affiliate-offers/${id}/pause`)),

  listCampaigns: () => unwrap<{ success: boolean; data: any[] }>(apiClient.get('/admin/affiliate-campaigns')),
  createCampaign: (body: Record<string, unknown>) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post('/admin/affiliate-campaigns', body)),

  listRewardRules: () =>
    unwrap<{ success: boolean; data: any[] }>(apiClient.get('/admin/affiliate-reward-rules')),
  createRewardRule: (body: Record<string, unknown>) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post('/admin/affiliate-reward-rules', body)),
  previewRewardRule: (id: string, amountMinor: number) =>
    unwrap<{ success: boolean; data: { units: number; unit: string } }>(
      apiClient.get(`/admin/affiliate-reward-rules/${id}/preview`, {
        params: { amountMinor },
      }),
    ),

  listConversions: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(apiClient.get('/admin/affiliate-conversions', { params })),
  approveConversion: (id: string, reason?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/affiliate-conversions/${id}/approve`, { reason }),
    ),
  rejectConversion: (id: string, reasonCode?: string, reason?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/affiliate-conversions/${id}/reject`, { reasonCode, reason }),
    ),
  reverseConversion: (id: string, reasonCode?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/affiliate-conversions/${id}/reverse`, { reasonCode }),
    ),
  attributeConversion: (id: string, trackingCode: string, reason?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/affiliate-conversions/${id}/attribute`, { trackingCode, reason }),
    ),

  listVouchers: (params?: Record<string, unknown>) =>
    unwrap<Paginated<any>>(apiClient.get('/admin/affiliate-vouchers', { params })),
  issueVoucher: (body: Record<string, unknown>) =>
    unwrap<{ success: boolean; data: any }>(apiClient.post('/admin/affiliate-vouchers', body)),
  revokeVoucher: (id: string, reason?: string) =>
    unwrap<{ success: boolean; data: any }>(
      apiClient.post(`/admin/affiliate-vouchers/${id}/revoke`, { reason }),
    ),

  reconciliation: (queue?: string) =>
    unwrap<{ success: boolean; data: Record<string, { count: number; items: any[] }> }>(
      apiClient.get('/admin/affiliate-reconciliation', { params: queue ? { queue } : undefined }),
    ),
  overview: () => unwrap<{ success: boolean; data: any }>(apiClient.get('/admin/affiliate-reports/overview')),
};
