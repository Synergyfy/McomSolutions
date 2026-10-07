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
};
