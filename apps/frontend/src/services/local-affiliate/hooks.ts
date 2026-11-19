import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { localAffiliateAdminApi, localAffiliateApi } from './index';

export const affiliateQueryKeys = {
  all: ['local-affiliate'] as const,
  me: () => [...affiliateQueryKeys.all, 'me'] as const,
  link: () => [...affiliateQueryKeys.all, 'link'] as const,
  activitySummary: () => [...affiliateQueryKeys.all, 'activity-summary'] as const,
  activity: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.all, 'activity', params] as const,
  rewards: () => [...affiliateQueryKeys.all, 'rewards'] as const,
  ledger: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.all, 'ledger', params] as const,
  redemptions: () => [...affiliateQueryKeys.all, 'redemptions'] as const,
  offers: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.all, 'offers', params] as const,
  offer: (slug: string) => [...affiliateQueryKeys.all, 'offer', slug] as const,
  publicAffiliate: (code: string) =>
    [...affiliateQueryKeys.all, 'public', code] as const,

  admin: ['local-affiliate-admin'] as const,
  adminAffiliates: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.admin, 'affiliates', params] as const,
  adminAffiliate: (id: string) => [...affiliateQueryKeys.admin, 'affiliate', id] as const,
  adminProviders: () => [...affiliateQueryKeys.admin, 'providers'] as const,
  adminOffers: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.admin, 'offers', params] as const,
  adminCampaigns: () => [...affiliateQueryKeys.admin, 'campaigns'] as const,
  adminRules: () => [...affiliateQueryKeys.admin, 'rules'] as const,
  adminConversions: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.admin, 'conversions', params] as const,
  adminVouchers: (params?: Record<string, unknown>) =>
    [...affiliateQueryKeys.admin, 'vouchers', params] as const,
  adminReconciliation: (queue?: string) =>
    [...affiliateQueryKeys.admin, 'reconciliation', queue] as const,
  adminOverview: () => [...affiliateQueryKeys.admin, 'overview'] as const,
};

// ── Consumer ─────────────────────────────────────────────────────────────

export const useMyAffiliateProfile = (enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.me(),
    queryFn: () => localAffiliateApi.me(),
    enabled,
    staleTime: 30_000,
  });

export const useAffiliateLink = (enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.link(),
    queryFn: () => localAffiliateApi.link(),
    enabled,
    staleTime: 60_000,
  });

export const useAffiliateActivitySummary = (enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.activitySummary(),
    queryFn: () => localAffiliateApi.activitySummary(),
    enabled,
    staleTime: 30_000,
  });

export const useAffiliateActivity = (params?: Record<string, unknown>, enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.activity(params),
    queryFn: () => localAffiliateApi.activity(params),
    enabled,
  });

export const useAffiliateRewards = (enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.rewards(),
    queryFn: () => localAffiliateApi.rewardsSummary(),
    enabled,
    staleTime: 30_000,
  });

export const useAffiliateLedger = (params?: Record<string, unknown>, enabled = true) =>
  useQuery({
    queryKey: affiliateQueryKeys.ledger(params),
    queryFn: () => localAffiliateApi.ledger(params),
    enabled,
  });

export const useAffiliateOffers = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: affiliateQueryKeys.offers(params),
    queryFn: () => localAffiliateApi.offers(params),
    staleTime: 60_000,
  });

export const useAffiliateOffer = (slug: string) =>
  useQuery({
    queryKey: affiliateQueryKeys.offer(slug),
    queryFn: () => localAffiliateApi.offer(slug),
    enabled: !!slug,
  });

export const usePublicAffiliate = (code: string) =>
  useQuery({
    queryKey: affiliateQueryKeys.publicAffiliate(code),
    queryFn: () => localAffiliateApi.publicAffiliate(code),
    enabled: !!code,
  });

export const useActivateAffiliate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { termsVersion: string; acceptTerms: boolean; inviteCode?: string }) =>
      localAffiliateApi.activate(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affiliateQueryKeys.all });
    },
  });
};

export const useCreateAffiliateLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ offerId, campaignId }: { offerId: string; campaignId?: string }) =>
      localAffiliateApi.createLink(offerId, { campaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affiliateQueryKeys.all });
    },
  });
};

export const useRedeemReward = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { rewardType: 'VOUCHER' | 'POINTS'; units: number; offerId?: string }) =>
      localAffiliateApi.redeem(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affiliateQueryKeys.rewards() });
      queryClient.invalidateQueries({ queryKey: affiliateQueryKeys.ledger() });
    },
  });
};

// ── Admin ────────────────────────────────────────────────────────────────

export const useAdminAffiliates = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminAffiliates(params),
    queryFn: () => localAffiliateAdminApi.listAffiliates(params),
  });

export const useAdminAffiliateDetail = (id: string) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminAffiliate(id),
    queryFn: () => localAffiliateAdminApi.affiliateDetail(id),
    enabled: !!id,
  });

export const useAdminProviders = () =>
  useQuery({
    queryKey: affiliateQueryKeys.adminProviders(),
    queryFn: () => localAffiliateAdminApi.listProviders(),
  });

export const useAdminOffers = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminOffers(params),
    queryFn: () => localAffiliateAdminApi.listOffers(params),
  });

export const useAdminCampaigns = () =>
  useQuery({
    queryKey: affiliateQueryKeys.adminCampaigns(),
    queryFn: () => localAffiliateAdminApi.listCampaigns(),
  });

export const useAdminRewardRules = () =>
  useQuery({
    queryKey: affiliateQueryKeys.adminRules(),
    queryFn: () => localAffiliateAdminApi.listRewardRules(),
  });

export const useAdminConversions = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminConversions(params),
    queryFn: () => localAffiliateAdminApi.listConversions(params),
  });

export const useAdminVouchers = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminVouchers(params),
    queryFn: () => localAffiliateAdminApi.listVouchers(params),
  });

export const useAdminReconciliation = (queue?: string) =>
  useQuery({
    queryKey: affiliateQueryKeys.adminReconciliation(queue),
    queryFn: () => localAffiliateAdminApi.reconciliation(queue),
  });

export const useAdminAffiliateOverview = () =>
  useQuery({
    queryKey: affiliateQueryKeys.adminOverview(),
    queryFn: () => localAffiliateAdminApi.overview(),
  });

const invalidateAdmin = (queryClient: ReturnType<typeof useQueryClient>) =>
  queryClient.invalidateQueries({ queryKey: affiliateQueryKeys.admin });

export const useAdminAffiliateMutation = <TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => invalidateAdmin(queryClient),
  });
};
