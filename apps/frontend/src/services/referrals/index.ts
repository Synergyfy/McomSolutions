import { apiClient } from '../api';

export interface ReferredUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
}

export interface ReferralListResponse {
  success: boolean;
  data: ReferredUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReferralInfoResponse {
  success: boolean;
  referralCode: string;
  referralLink: string;
}

export interface ReferralStatsResponse {
  success: boolean;
  totalReferrals: number;
}

export interface ReferralConfigSnapshot {
  id: string;
  version: number;
  isActive: boolean;
  rewardMode: 'SINGLE' | 'PER_ROLE';
  rewardType: 'PERCENTAGE' | 'FIXED';
  percentage: number | null;
  fixedAmountGbp: number | null;
  eligibleRoles: string[];
  qualifyAllMemberships: boolean;
  qualifyAllAccessPasses: boolean;
  qualifiedMembershipPlanIds: string[];
  qualifiedAccessPlanIds: string[];
  commissionFrequency: 'ONE_TIME' | 'RECURRING';
  note: string | null;
  createdAt: string;
}

export interface ReferralReferredUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  role: string;
  joinedAt: string;
  earnedCredits: number;
  earnedGbp: number;
  creditedCount: number;
  evaluationCount: number;
  lastActivityAt: string | null;
}

export interface ReferralCommissionHistory {
  id: string;
  sourceType: 'MEMBERSHIP' | 'ACCESS_PASS';
  sourceName: string | null;
  purchaseAmountGbp: number;
  commissionAmountGbp: number;
  commissionCredits: number;
  status: string;
  referredUserId: string;
  referredName: string | null;
  referredEmail: string | null;
  configVersion: number | null;
  createdAt: string;
}

export interface ReferralEarnings {
  summary: {
    totalReferrals: number;
    creditedReferrals: number;
    totalEarnedCredits: number;
    totalEarnedGbp: number;
    creditedCommissionCount: number;
    configActive: boolean;
    configVersion: number | null;
  };
  referredUsers: ReferralReferredUser[];
  history: ReferralCommissionHistory[];
  config: ReferralConfigSnapshot | null;
}

export interface ReferralEarningsResponse {
  success: boolean;
  data: ReferralEarnings;
}

export const referralApi = {
  getMyReferralInfo: async (): Promise<ReferralInfoResponse> => {
    const res = await apiClient.get('/referrals/me');
    return res.data;
  },

  listMyReferrals: async (page = 1, limit = 20): Promise<ReferralListResponse> => {
    const res = await apiClient.get('/referrals', { params: { page, limit } });
    return res.data;
  },

  getMyReferralStats: async (): Promise<ReferralStatsResponse> => {
    const res = await apiClient.get('/referrals/stats');
    return res.data;
  },

  getMyReferralEarnings: async (limit = 20): Promise<ReferralEarningsResponse> => {
    const res = await apiClient.get('/referrals/earnings', { params: { limit } });
    return res.data;
  },
};
