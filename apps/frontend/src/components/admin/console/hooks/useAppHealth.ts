import { useQuery } from '@tanstack/react-query'
import { consoleApi } from '../api/console.api'

export const useAppHealth = (clientId: string, enabled = true) =>
  useQuery({
    queryKey: ['admin', 'console', 'apps', clientId, 'health'],
    queryFn: () => consoleApi.getAppHealth(clientId),
    enabled: !!clientId && enabled,
    refetchInterval: 30000,
    staleTime: 10000,
    retry: false,
  })

export const useConsoleAuditLogs = (params: { clientId?: string; action?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: ['admin', 'console', 'audit-logs', params],
    queryFn: () => consoleApi.getAuditLogs(params),
    staleTime: 1000 * 30,
  })