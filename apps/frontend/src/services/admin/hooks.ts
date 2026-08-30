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
  CreateCampaignInput,
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

export const useExternalPlanSchema = (platform: string) => {
  return useQuery({
    queryKey: ['admin', 'externalPlanSchema', platform],
    queryFn: () => adminApi.getExternalPlanSchema(platform),
    staleTime: 1000 * 60 * 5,
    enabled: !!platform,
  })
}

export const useExternalPlatformSeasons = (platform: string) => {
  return useQuery({
    queryKey: ['admin', 'externalPlatformSeasons', platform],
    queryFn: () => adminApi.getExternalPlatformSeasons(platform),
    staleTime: 1000 * 60 * 5,
    enabled: !!platform,
  })
}
// ─── Analytics ──────────────────────────────────────────
export const useAdminAnalytics = () => {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => adminApi.getAnalytics(),
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Dropdowns ──────────────────────────────────────────
export const useAdminDropdowns = () => {
  return useQuery({
    queryKey: ['admin', 'dropdowns'],
    queryFn: () => adminApi.getDropdowns(),
    staleTime: 1000 * 60 * 30,
  })
}

// ─── Borough Stats ──────────────────────────────────────
export const useBoroughStats = (id: string) => {
  return useQuery({
    queryKey: ['admin', 'boroughStats', id],
    queryFn: () => adminApi.getBoroughStats(id),
    staleTime: 1000 * 60 * 5,
    enabled: !!id,
  })
}

export const useBoroughMetrics = (id: string) => {
  return useQuery({
    queryKey: ['admin', 'boroughMetrics', id],
    queryFn: () => adminApi.getBoroughMetrics(id),
    staleTime: 1000 * 60 * 5,
    enabled: !!id,
  })
}

export const useCreateBoroughMetric = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ boroughId, data }: { boroughId: string; data: any }) =>
      adminApi.createBoroughMetric(boroughId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughStats', variables.boroughId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughMetrics', variables.boroughId] })
    },
  })
}

export const useUpdateBoroughMetric = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ metricId, data }: { metricId: string; data: any }) =>
      adminApi.updateBoroughMetric(metricId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughStats'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughMetrics'] })
    },
  })
}

export const useDeleteBoroughMetric = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (metricId: string) => adminApi.deleteBoroughMetric(metricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughStats'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'boroughMetrics'] })
    },
  })
}

// ─── Activities (Feed) ──────────────────────────────────
export const useAdminActivities = (params?: { highStreetId?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin', 'activities', params],
    queryFn: () => adminApi.getActivities(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateActivity = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { type: string; title: string; details?: string; location?: string; severity?: string; source?: string; highStreetId?: string }) =>
      adminApi.createActivity(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'activities'] }),
  })
}

export const useUpdateActivity = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ type: string; title: string; details: string; location: string; severity: string; source: string; highStreetId: string }> }) =>
      adminApi.updateActivity(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'activities'] }),
  })
}

export const useDeleteActivity = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteActivity(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'activities'] }),
  })
}

// ─── Programme Management ───────────────────────────────
// Phases
export const useProgrammePhases = () => {
  return useQuery({
    queryKey: ['admin', 'programmePhases'],
    queryFn: () => adminApi.getProgrammePhases(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateProgrammePhase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => adminApi.createProgrammePhase(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmePhases'] }),
  })
}

export const useUpdateProgrammePhase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateProgrammePhase(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmePhases'] }),
  })
}

export const useDeleteProgrammePhase = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProgrammePhase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmePhases'] }),
  })
}

// Readiness Gates
export const useProgrammeGates = () => {
  return useQuery({
    queryKey: ['admin', 'programmeGates'],
    queryFn: () => adminApi.getProgrammeGates(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateProgrammeGate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => adminApi.createProgrammeGate(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeGates'] }),
  })
}

export const useUpdateProgrammeGate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateProgrammeGate(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeGates'] }),
  })
}

export const useDeleteProgrammeGate = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProgrammeGate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeGates'] }),
  })
}

// Support Agents
export const useProgrammeAgents = () => {
  return useQuery({
    queryKey: ['admin', 'programmeAgents'],
    queryFn: () => adminApi.getProgrammeAgents(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateProgrammeAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => adminApi.createProgrammeAgent(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeAgents'] }),
  })
}

export const useUpdateProgrammeAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateProgrammeAgent(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeAgents'] }),
  })
}

export const useDeleteProgrammeAgent = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProgrammeAgent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeAgents'] }),
  })
}

// Business Programme Records
export const useProgrammeBusinesses = () => {
  return useQuery({
    queryKey: ['admin', 'programmeBusinesses'],
    queryFn: () => adminApi.getProgrammeBusinesses(),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateProgrammeBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => adminApi.createProgrammeBusiness(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinesses'] }),
  })
}

export const useUpdateProgrammeBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateProgrammeBusiness(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinesses'] }),
  })
}

export const useDeleteProgrammeBusiness = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteProgrammeBusiness(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinesses'] }),
  })
}

export const useProgrammeBusinessAction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { action: string; days?: number } }) =>
      adminApi.programmeBusinessAction(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinesses'] }),
  })
}

export const useProgrammeBusinessTasks = (id: string) => {
  return useQuery({
    queryKey: ['admin', 'programmeBusinessTasks', id],
    queryFn: () => adminApi.getProgrammeBusinessTasks(id),
    staleTime: 1000 * 60 * 2,
    enabled: !!id,
  })
}

export const useUpdateProgrammeBusinessTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { missionId: string; status: string } }) =>
      adminApi.updateProgrammeBusinessTask(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinessTasks', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'programmeBusinesses'] })
    },
  })
}

// ─── System — API Keys ──────────────────────────────────
export const useAdminApiKeys = () => {
  return useQuery({
    queryKey: ['admin', 'apiKeys'],
    queryFn: () => adminApi.getApiKeys(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; permissions?: string[] }) => adminApi.createApiKey(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'apiKeys'] }),
  })
}

export const useUpdateApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; permissions: string[]; status: string }> }) =>
      adminApi.updateApiKey(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'apiKeys'] }),
  })
}

export const useDeleteApiKey = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteApiKey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'apiKeys'] }),
  })
}

// ─── System — Integrations ──────────────────────────────
export const useAdminIntegrations = () => {
  return useQuery({
    queryKey: ['admin', 'integrations'],
    queryFn: () => adminApi.getIntegrations(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateIntegration = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; type: string; config?: any }) => adminApi.createIntegration(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  })
}

export const useUpdateIntegration = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateIntegration(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  })
}

export const useDeleteIntegration = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteIntegration(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] }),
  })
}

// ─── System — Health, Jobs, Error Logs ──────────────────
export const useSystemHealth = () => {
  return useQuery({
    queryKey: ['admin', 'systemHealth'],
    queryFn: () => adminApi.getSystemHealth(),
    staleTime: 1000 * 30,
  })
}

export const useSystemJobs = () => {
  return useQuery({
    queryKey: ['admin', 'systemJobs'],
    queryFn: () => adminApi.getSystemJobs(),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateSystemJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; status?: string; progress?: number; error?: string }) => adminApi.createSystemJob(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'systemJobs'] }),
  })
}

export const useUpdateSystemJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateSystemJob(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'systemJobs'] }),
  })
}

export const useDeleteSystemJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteSystemJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'systemJobs'] }),
  })
}

export const useSystemErrorLogs = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin', 'systemErrorLogs', params],
    queryFn: () => adminApi.getSystemErrorLogs(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateSystemErrorLog = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { level: string; message: string; source?: string; stack?: string }) =>
      adminApi.createSystemErrorLog(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'systemErrorLogs'] }),
  })
}

// ─── Assessment Questions ───────────────────────────────
export const useAssessmentQuestions = () => {
  return useQuery({
    queryKey: ['admin', 'assessmentQuestions'],
    queryFn: () => adminApi.getAssessmentQuestions(),
    staleTime: 1000 * 60 * 5,
  })
}

export const useCreateAssessmentQuestion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => adminApi.createAssessmentQuestion(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'assessmentQuestions'] }),
  })
}

export const useUpdateAssessmentQuestion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateAssessmentQuestion(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'assessmentQuestions'] }),
  })
}

export const useDeleteAssessmentQuestion = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteAssessmentQuestion(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'assessmentQuestions'] }),
  })
}

export const useReorderAssessmentQuestions = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderedIds: string[]) => adminApi.reorderAssessmentQuestions(orderedIds),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'assessmentQuestions'] }),
  })
}

// ─── Campaigns ─────────────────────────────────────────
export const useAdminCampaigns = (params?: { locationType?: string; locationId?: string; page?: number; limit?: number }) => {
  return useQuery({
    queryKey: ['admin', 'campaigns', params],
    queryFn: () => adminApi.getCampaigns(params),
    staleTime: 1000 * 60 * 2,
  })
}

export const useCreateCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCampaignInput) => adminApi.createCampaign(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  })
}

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateCampaignInput> }) =>
      adminApi.updateCampaign(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  })
}

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteCampaign(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  })
}

export const useCampaignAction = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { action: 'pause' | 'resume' | 'complete' } }) =>
      adminApi.campaignAction(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'campaigns'] }),
  })
}
