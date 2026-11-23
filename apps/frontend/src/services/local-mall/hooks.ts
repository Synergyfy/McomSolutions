import { useQuery } from '@tanstack/react-query';
import { localMallApi } from './index';

export const localMallQueryKeys = {
  all: ['local-mall'] as const,
  overview: () => [...localMallQueryKeys.all, 'overview'] as const,
};

export const useMyLocalMall = (enabled = true) =>
  useQuery({
    queryKey: localMallQueryKeys.overview(),
    queryFn: () => localMallApi.getOverview(),
    // Location assignment can change right after a postcode edit. Keep the
    // window short so the card recovers on its own even if an invalidation is
    // missed (e.g. edited from another device).
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
    enabled,
  });
