import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from './index'
import type {
  BusinessUser,
  CustomerUser,
  AgentUser,
  ConsultantUser,
  AccountManager,
  MembershipPlan,
  PackageTemplate,
  Platform,
  Subscription,
  LaunchRule,
  BroadcastNotification,
  SupportTicket,
  SystemSettings,
  Borough,
  HighStreet,
  LocalMall,
  CreateBusinessInput,
  CreateCustomerInput,
  CreateAgentInput,
  CreateConsultantInput,
  CreateAccountManagerInput,
  CreatePlanInput,
  UpdatePlanInput,
  CreatePackageInput,
  CreateSubscriptionInput,
  CreateLaunchRuleInput,
  RecordPaymentInput,
  CreateNotificationInput,
  UpdateTicketInput,
  ExternalPlan,
  CreateExternalPlanInput,
} from './types'

// ─── Admin Auth ────────────────────────────────────────
export const useAdminLogin = () => {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      adminApi.login({ email, password }),
  })
}

// ─── Dashboard ─────────────────────────────────────────
export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    staleTime: 1000 * 60 * 2,
  })
}

// ─── Businesses ────────────────────────────────────────
export const useAdminBusinesses = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'businesses', params],
    queryFn: () => adminApi.getBusinesses(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBusinessInput) => adminApi.createBusiness(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] }),
  })
}

export const useUpdateBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateBusinessInput> }) =>
      adminApi.updateBusiness(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] }),
  })
}

export const useDeleteBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteBusiness(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'businesses'] }),
  })
}

// ─── Customers ─────────────────────────────────────────
export const useAdminCustomers = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'customers', params],
    queryFn: () => adminApi.getCustomers(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCustomerInput) => adminApi.createCustomer(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  })
}

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCustomerInput> }) =>
      adminApi.updateCustomer(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  })
}

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCustomer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] }),
  })
}

// ─── Agents ────────────────────────────────────────────
export const useAdminAgents = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'agents', params],
    queryFn: () => adminApi.getAgents(params),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAgentInput) => adminApi.createAgent(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] }),
  })
}

export const useUpdateAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAgentInput> }) =>
      adminApi.updateAgent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] }),
  })
}

export const useDeleteAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'agents'] }),
  })
}

// ─── Consultants ───────────────────────────────────────
export const useAdminConsultants = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'consultants', params],
    queryFn: () => adminApi.getConsultants(params),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateConsultant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateConsultantInput) => adminApi.createConsultant(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consultants'] }),
  })
}

export const useUpdateConsultant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateConsultantInput> }) =>
      adminApi.updateConsultant(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consultants'] }),
  })
}

export const useDeleteConsultant = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteConsultant(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'consultants'] }),
  })
}

// ─── Account Managers ──────────────────────────────────
export const useAdminAccountManagers = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'accountManagers', params],
    queryFn: () => adminApi.getAccountManagers(params),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateAccountManager = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAccountManagerInput) => adminApi.createAccountManager(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'accountManagers'] }),
  })
}

export const useUpdateAccountManager = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateAccountManagerInput> }) =>
      adminApi.updateAccountManager(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'accountManagers'] }),
  })
}

export const useDeleteAccountManager = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAccountManager(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'accountManagers'] }),
  })
}

// ─── Membership Plans ──────────────────────────────────
export const useAdminPlans = () => {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.getPlans(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useCreatePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePlanInput) => adminApi.createPlan(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}

export const useUpdatePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePlanInput }) =>
      adminApi.updatePlan(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}

export const useDeletePlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deletePlan(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'plans'] }),
  })
}

// ─── Packages ──────────────────────────────────────────
export const useAdminPackages = () => {
  return useQuery({
    queryKey: ['admin', 'packages'],
    queryFn: () => adminApi.getPackages(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useCreatePackage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePackageInput) => adminApi.createPackage(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] }),
  })
}

export const useUpdatePackage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePackageInput & { archived: boolean }> }) =>
      adminApi.updatePackage(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] }),
  })
}

export const useDeletePackage = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deletePackage(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] }),
  })
}

// ─── Subscriptions ─────────────────────────────────────
export const useAdminSubscriptions = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'subscriptions', params],
    queryFn: () => adminApi.getSubscriptions(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSubscriptionInput) => adminApi.createSubscription(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  })
}

export const useUpdateSubscription = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSubscriptionInput> }) =>
      adminApi.updateSubscription(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  })
}

// ─── Platforms & Launch Rules ──────────────────────────
export const useAdminPlatforms = () => {
  return useQuery({
    queryKey: ['admin', 'platforms'],
    queryFn: () => adminApi.getPlatforms(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useUpdatePlatform = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Platform> }) =>
      adminApi.updatePlatform(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'platforms'] }),
  })
}

export const useCreateLaunchRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLaunchRuleInput) => adminApi.createLaunchRule(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'platforms'] }),
  })
}

export const useUpdateLaunchRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LaunchRule> }) =>
      adminApi.updateLaunchRule(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'platforms'] }),
  })
}

export const useDeleteLaunchRule = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteLaunchRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'platforms'] }),
  })
}

// ─── Permissions ───────────────────────────────────────
export const useAdminPermissions = () => {
  return useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: () => adminApi.getPermissions(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useUpdatePermissionRole = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ role, data }: { role: string; data: { permissions: Record<string, boolean> } }) =>
      adminApi.updatePermissionRole(role, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'permissions'] }),
  })
}

// ─── Finance ───────────────────────────────────────────
export const useAdminPayments = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'payments', params],
    queryFn: () => adminApi.getPayments(params),
    staleTime: 1000 * 60 * 5,
  })
}

export const useRecordPayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: RecordPaymentInput) => adminApi.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
    },
  })
}

export const useUpdatePaymentStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: string } }) =>
      adminApi.updatePaymentStatus(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] }),
  })
}

export const useAdminRevenue = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'revenue', params],
    queryFn: () => adminApi.getRevenue(params),
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Communication ─────────────────────────────────────
export const useAdminNotifications = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'notifications', params],
    queryFn: () => adminApi.getNotifications(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateNotification = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateNotificationInput) => adminApi.createNotification(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  })
}

export const useUpdateNotification = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateNotificationInput & { sentCount: number }> }) =>
      adminApi.updateNotification(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  })
}

export const useDeleteNotification = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteNotification(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] }),
  })
}

export const useAdminTickets = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'tickets', params],
    queryFn: () => adminApi.getTickets(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useUpdateTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketInput }) =>
      adminApi.updateTicket(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
  })
}

// ─── System ────────────────────────────────────────────
export const useAdminAuditLogs = (params?: { page?: number; limit?: number; search?: string }) => {
  return useQuery({
    queryKey: ['admin', 'auditLogs', params],
    queryFn: () => adminApi.getAuditLogs(params),
    staleTime: 1000 * 60 * 5,
  })
}

export const useClearAuditLogs = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.clearAuditLogs(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'auditLogs'] }),
  })
}

export const useAdminSettings = () => {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useUpdateSettings = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<SystemSettings>) => adminApi.updateSettings(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  })
}

// ─── Localities ────────────────────────────────────────
export const useAdminBoroughs = () => {
  return useQuery({
    queryKey: ['admin', 'boroughs'],
    queryFn: () => adminApi.getBoroughs(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useCreateBorough = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Borough>) => adminApi.createBorough(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'boroughs'] }),
  })
}

export const useUpdateBorough = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Borough> }) =>
      adminApi.updateBorough(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'boroughs'] }),
  })
}

export const useDeleteBorough = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteBorough(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'boroughs'] }),
  })
}

export const useAdminHighStreets = () => {
  return useQuery({
    queryKey: ['admin', 'highStreets'],
    queryFn: () => adminApi.getHighStreets(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useCreateHighStreet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<HighStreet>) => adminApi.createHighStreet(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'highStreets'] }),
  })
}

export const useUpdateHighStreet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HighStreet> }) =>
      adminApi.updateHighStreet(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'highStreets'] }),
  })
}

export const useDeleteHighStreet = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteHighStreet(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'highStreets'] }),
  })
}

export const useAdminLocalMalls = () => {
  return useQuery({
    queryKey: ['admin', 'localMalls'],
    queryFn: () => adminApi.getLocalMalls(),
    staleTime: 1000 * 60 * 10,
  })
}

export const useCreateLocalMall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<LocalMall>) => adminApi.createLocalMall(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'localMalls'] }),
  })
}

export const useUpdateLocalMall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LocalMall> }) =>
      adminApi.updateLocalMall(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'localMalls'] }),
  })
}

export const useDeleteLocalMall = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteLocalMall(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'localMalls'] }),
  })
}

// ─── External Service Plans (MCOM Mall, etc.) ──────────────────────────
export const useExternalPlans = (platform: string) => {
  return useQuery({
    queryKey: ['admin', 'externalPlans', platform],
    queryFn: () => adminApi.getExternalPlans(platform),
    staleTime: 1000 * 60 * 5,
    enabled: !!platform,
  })
}

export const useCreateExternalPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExternalPlanInput) => adminApi.createExternalPlan(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'externalPlans', variables.platform] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'packages'] })
    },
  })
}

export const useUpdateExternalPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, platform, data }: { id: string; platform: string; data: Partial<CreateExternalPlanInput> }) =>
      adminApi.updateExternalPlan(id, platform, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'externalPlans', variables.platform] })
    },
  })
}

export const useDeleteExternalPlan = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, platform }: { id: string; platform: string }) =>
      adminApi.deleteExternalPlan(id, platform),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'externalPlans', variables.platform] })
    },
  })
}

export const useSupportedPlatforms = () => {
  return useQuery({
    queryKey: ['admin', 'supportedPlatforms'],
    queryFn: () => adminApi.getSupportedPlatforms(),
    staleTime: 1000 * 60 * 60,
  })
}
