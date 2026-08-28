import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { consoleApi } from '../api/console.api'
import type { RegisterAppInput, UpdateAppInput } from '../../../../services/admin/types'

const appsKey = ['admin', 'console', 'apps'] as const
const appKey = (clientId: string) => ['admin', 'console', 'apps', clientId] as const

export const useConsoleApps = () =>
  useQuery({
    queryKey: appsKey,
    queryFn: () => consoleApi.listApps(),
    staleTime: 1000 * 60,
  })

export const useConsoleApp = (clientId: string) =>
  useQuery({
    queryKey: appKey(clientId),
    queryFn: () => consoleApi.getApp(clientId),
    enabled: !!clientId,
    staleTime: 1000 * 30,
  })

export const useRegisterApp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: RegisterAppInput) => consoleApi.registerApp(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appsKey })
    },
  })
}

export const useUpdateApp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: UpdateAppInput }) =>
      consoleApi.updateApp(clientId, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: appsKey })
      queryClient.invalidateQueries({ queryKey: appKey(vars.clientId) })
    },
  })
}

export const useDeactivateApp = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (clientId: string) => consoleApi.deactivateApp(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appsKey })
    },
  })
}

export const useRotateClientSecret = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason?: string }) =>
      consoleApi.rotateClientSecret(clientId, reason),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: appsKey })
      queryClient.invalidateQueries({ queryKey: appKey(vars.clientId) })
    },
  })
}

export const useRotateApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason?: string }) =>
      consoleApi.rotateApiKey(clientId, reason),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: appsKey })
      queryClient.invalidateQueries({ queryKey: appKey(vars.clientId) })
    },
  })
}

export const useRotateHmacSecret = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason?: string }) =>
      consoleApi.rotateHmacSecret(clientId, reason),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: appsKey })
      queryClient.invalidateQueries({ queryKey: appKey(vars.clientId) })
    },
  })
}

export const useRotateWebhookSecret = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ clientId, reason }: { clientId: string; reason?: string }) =>
      consoleApi.rotateWebhookSecret(clientId, reason),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: appsKey })
      queryClient.invalidateQueries({ queryKey: appKey(vars.clientId) })
    },
  })
}