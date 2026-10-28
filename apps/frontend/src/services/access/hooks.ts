import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accessApi } from './index'

export const accessQueryKeys = {
  all: ['access'] as const,
  plans: () => ['access', 'plans'] as const,
  conflict: (accessPlanId: string) => ['access', 'conflict', accessPlanId] as const,
  purchases: () => ['access', 'purchases'] as const,
  codes: () => ['access', 'codes'] as const,
  rewardsPasses: () => ['access', 'mcom-rewards-passes'] as const,
}

export const useMcomRewardsAccessPassPlans = (enabled: boolean) =>
  useQuery({
    queryKey: accessQueryKeys.rewardsPasses(),
    queryFn: () => accessApi.getMcomRewardsAccessPassPlans(),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  })

export const useAccessPlans = (enabled = true) =>
  useQuery({
    queryKey: accessQueryKeys.plans(),
    queryFn: () => accessApi.getPlans(),
    enabled,
    staleTime: 60 * 1000,
  })

export const useAccessConflict = (accessPlanId: string | null | undefined) =>
  useQuery({
    queryKey: accessQueryKeys.conflict(accessPlanId ?? ''),
    queryFn: () => accessApi.getConflict(accessPlanId!),
    enabled: Boolean(accessPlanId),
    staleTime: 15 * 1000,
    retry: false,
  })

export const useAccessPurchases = () =>
  useQuery({
    queryKey: accessQueryKeys.purchases(),
    queryFn: () => accessApi.getPurchases(),
    staleTime: 15 * 1000,
  })

export const useAccessCodes = () =>
  useQuery({
    queryKey: accessQueryKeys.codes(),
    queryFn: () => accessApi.getCodes(),
    staleTime: 15 * 1000,
  })

export const useRedeemAccessCode = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => accessApi.redeemCode(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accessQueryKeys.purchases() })
      queryClient.invalidateQueries({ queryKey: accessQueryKeys.codes() })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
    },
  })
}

export const invalidateAccessQueries = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: accessQueryKeys.purchases() })
  queryClient.invalidateQueries({ queryKey: accessQueryKeys.codes() })
}
