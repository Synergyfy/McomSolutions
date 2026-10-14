import { useQuery } from '@tanstack/react-query';
import { referralApi } from './index';

const hasToken = () =>
  typeof window !== 'undefined' && Boolean(localStorage.getItem('auth_token'));

export const useReferralInfo = (enabled = true) => {
  return useQuery({
    queryKey: ['referrals', 'me'],
    queryFn: () => referralApi.getMyReferralInfo(),
    staleTime: 1000 * 60 * 5, // 5 minutes — code/link rarely change
    enabled: Boolean(enabled && hasToken()),
    retry: false,
  });
};

export const useReferralStats = (enabled = true) => {
  return useQuery({
    queryKey: ['referrals', 'stats'],
    queryFn: () => referralApi.getMyReferralStats(),
    staleTime: 1000 * 60, // 1 minute
    enabled: Boolean(enabled && hasToken()),
    retry: false,
  });
};

export const useReferrals = (page = 1, limit = 20, enabled = true) => {
  return useQuery({
    queryKey: ['referrals', 'list', page, limit],
    queryFn: () => referralApi.listMyReferrals(page, limit),
    staleTime: 1000 * 60, // 1 minute
    enabled: Boolean(enabled && hasToken()),
    retry: false,
  });
};
