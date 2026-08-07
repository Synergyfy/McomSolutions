import { apiClient } from '../api'
import type {
  DashboardStats,
  BusinessUser,
  CustomerUser,
  AgentUser,
  ConsultantUser,
  AccountManager,
  MembershipPlan,
  PackageTemplate,
  Subscription,
  Platform,
  PlatformsResponse,
  PermissionRole,
  Payment,
  RevenueRecord,
  BroadcastNotification,
  SupportTicket,
  AuditLog,
  SystemSettings,
  Borough,
  HighStreet,
  LocalMall,
  PaginatedResponse,
  ApiResponse,
  LaunchRule,
  CreateBusinessInput,
  CreateCustomerInput,
  CreateAgentInput,
  CreateConsultantInput,
  CreateAccountManagerInput,
  CreateSubscriptionInput,
  CreateLaunchRuleInput,
  RecordPaymentInput,
  CreateNotificationInput,
  UpdateTicketInput,
  CreatePlanInput,
  UpdatePlanInput,
  CreatePackageInput,
  ExternalPlan,
  CreateExternalPlanInput,
} from './types'

export const adminApi = {
  // ─── Admin Auth ───────────────────────────────────────
  login: async ({ email, password }: { email: string; password: string }) => {
    const res = await apiClient.post('/admin/auth/login', { email, password })
    if (res.data?.accessToken) {
      localStorage.setItem('auth_token', res.data.accessToken)
      localStorage.setItem('admin_user', JSON.stringify(res.data.admin))
    }
    return res.data as { accessToken: string; refreshToken: string; admin: { id: string; email: string; name: string; role: string } }
  },

  // ─── Dashboard Stats ────────────────────────────────
  getStats: async () => {
    const res = await apiClient.get('/admin/stats')
    return res.data as ApiResponse<DashboardStats>
  },

  // ─── Business Users ──────────────────────────────────
  getBusinesses: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/users/businesses', { params })
    return res.data as PaginatedResponse<BusinessUser>
  },

  createBusiness: async (data: CreateBusinessInput) => {
    const res = await apiClient.post('/admin/users/businesses', data)
    return res.data as ApiResponse<any>
  },

  updateBusiness: async (id: string, data: Partial<CreateBusinessInput>) => {
    const res = await apiClient.put(`/admin/users/businesses/${id}`, data)
    return res.data as ApiResponse<any>
  },

  deleteBusiness: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/businesses/${id}`)
    return res.data
  },

  // ─── Customer Users ──────────────────────────────────
  getCustomers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/users/customers', { params })
    return res.data as PaginatedResponse<CustomerUser>
  },

  createCustomer: async (data: CreateCustomerInput) => {
    const res = await apiClient.post('/admin/users/customers', data)
    return res.data as ApiResponse<any>
  },

  updateCustomer: async (id: string, data: Partial<CreateCustomerInput>) => {
    const res = await apiClient.put(`/admin/users/customers/${id}`, data)
    return res.data as ApiResponse<any>
  },

  deleteCustomer: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/customers/${id}`)
    return res.data
  },

  // ─── Agent Users ─────────────────────────────────────
  getAgents: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/users/agents', { params })
    return res.data as PaginatedResponse<AgentUser>
  },

  createAgent: async (data: CreateAgentInput) => {
    const res = await apiClient.post('/admin/users/agents', data)
    return res.data as ApiResponse<any>
  },

  updateAgent: async (id: string, data: Partial<CreateAgentInput>) => {
    const res = await apiClient.put(`/admin/users/agents/${id}`, data)
    return res.data as ApiResponse<any>
  },

  deleteAgent: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/agents/${id}`)
    return res.data
  },

  // ─── Consultant Users ────────────────────────────────
  getConsultants: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/users/consultants', { params })
    return res.data as PaginatedResponse<ConsultantUser>
  },

  createConsultant: async (data: CreateConsultantInput) => {
    const res = await apiClient.post('/admin/users/consultants', data)
    return res.data as ApiResponse<any>
  },

  updateConsultant: async (id: string, data: Partial<CreateConsultantInput>) => {
    const res = await apiClient.put(`/admin/users/consultants/${id}`, data)
    return res.data as ApiResponse<any>
  },

  deleteConsultant: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/consultants/${id}`)
    return res.data
  },

  // ─── Account Managers ────────────────────────────────
  getAccountManagers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/users/account-managers', { params })
    return res.data as PaginatedResponse<AccountManager>
  },

  createAccountManager: async (data: CreateAccountManagerInput) => {
    const res = await apiClient.post('/admin/users/account-managers', data)
    return res.data as ApiResponse<any>
  },

  updateAccountManager: async (id: string, data: Partial<CreateAccountManagerInput>) => {
    const res = await apiClient.put(`/admin/users/account-managers/${id}`, data)
    return res.data as ApiResponse<any>
  },

  deleteAccountManager: async (id: string) => {
    const res = await apiClient.delete(`/admin/users/account-managers/${id}`)
    return res.data
  },

  // ─── Membership Plans ────────────────────────────────
  getPlans: async () => {
    const res = await apiClient.get('/admin/plans')
    return res.data as ApiResponse<MembershipPlan[]>
  },

  createPlan: async (data: CreatePlanInput) => {
    const res = await apiClient.post('/admin/plans', data)
    return res.data as ApiResponse<MembershipPlan>
  },

  updatePlan: async (id: string, data: UpdatePlanInput) => {
    const res = await apiClient.put(`/admin/plans/${id}`, data)
    return res.data as ApiResponse<MembershipPlan>
  },

  deletePlan: async (id: string) => {
    const res = await apiClient.delete(`/admin/plans/${id}`)
    return res.data
  },

  // ─── Package Templates ───────────────────────────────
  getPackages: async () => {
    const res = await apiClient.get('/admin/packages')
    return res.data as ApiResponse<PackageTemplate[]>
  },

  createPackage: async (data: CreatePackageInput) => {
    const res = await apiClient.post('/admin/packages', data)
    return res.data as ApiResponse<PackageTemplate>
  },

  updatePackage: async (id: string, data: Partial<CreatePackageInput & { archived: boolean }>) => {
    const res = await apiClient.put(`/admin/packages/${id}`, data)
    return res.data as ApiResponse<PackageTemplate>
  },

  deletePackage: async (id: string) => {
    const res = await apiClient.delete(`/admin/packages/${id}`)
    return res.data
  },

  // ─── Subscriptions ───────────────────────────────────
  getSubscriptions: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/subscriptions', { params })
    return res.data as PaginatedResponse<Subscription>
  },

  createSubscription: async (data: CreateSubscriptionInput) => {
    const res = await apiClient.post('/admin/subscriptions', data)
    return res.data as ApiResponse<Subscription>
  },

  updateSubscription: async (id: string, data: Partial<CreateSubscriptionInput>) => {
    const res = await apiClient.put(`/admin/subscriptions/${id}`, data)
    return res.data as ApiResponse<Subscription>
  },

  // ─── Platforms & Launch Rules ────────────────────────
  getPlatforms: async () => {
    const res = await apiClient.get('/admin/platforms')
    return res.data as ApiResponse<PlatformsResponse>
  },

  updatePlatform: async (id: string, data: Partial<Platform>) => {
    const res = await apiClient.put(`/admin/platforms/${id}`, data)
    return res.data as ApiResponse<any>
  },

  createLaunchRule: async (data: CreateLaunchRuleInput) => {
    const res = await apiClient.post('/admin/platforms/launch-rules', data)
    return res.data as ApiResponse<LaunchRule>
  },

  updateLaunchRule: async (id: string, data: Partial<CreateLaunchRuleInput>) => {
    const res = await apiClient.put(`/admin/platforms/launch-rules/${id}`, data)
    return res.data as ApiResponse<LaunchRule>
  },

  deleteLaunchRule: async (id: string) => {
    const res = await apiClient.delete(`/admin/platforms/launch-rules/${id}`)
    return res.data
  },

  // ─── Permission Matrix ───────────────────────────────
  getPermissions: async () => {
    const res = await apiClient.get('/admin/permissions')
    return res.data as ApiResponse<PermissionRole[]>
  },

  updatePermissionRole: async (role: string, data: { permissions: Record<string, boolean> }) => {
    const res = await apiClient.put(`/admin/permissions/${role}`, data)
    return res.data as ApiResponse<PermissionRole>
  },

  // ─── Finance & Billing ───────────────────────────────
  getPayments: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/finance/payments', { params })
    return res.data as PaginatedResponse<Payment>
  },

  recordPayment: async (data: RecordPaymentInput) => {
    const res = await apiClient.post('/admin/finance/payments', data)
    return res.data as ApiResponse<Payment>
  },

  updatePaymentStatus: async (id: string, data: { status: string }) => {
    const res = await apiClient.put(`/admin/finance/payments/${id}/status`, data)
    return res.data as ApiResponse<Payment>
  },

  getRevenue: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/finance/revenue', { params })
    return res.data as PaginatedResponse<RevenueRecord>
  },

  // ─── Communication ───────────────────────────────────
  getNotifications: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/communication/notifications', { params })
    return res.data as PaginatedResponse<BroadcastNotification>
  },

  createNotification: async (data: CreateNotificationInput) => {
    const res = await apiClient.post('/admin/communication/notifications', data)
    return res.data as ApiResponse<BroadcastNotification>
  },

  updateNotification: async (id: string, data: Partial<CreateNotificationInput & { sentCount: number }>) => {
    const res = await apiClient.put(`/admin/communication/notifications/${id}`, data)
    return res.data as ApiResponse<BroadcastNotification>
  },

  deleteNotification: async (id: string) => {
    const res = await apiClient.delete(`/admin/communication/notifications/${id}`)
    return res.data
  },

  getTickets: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/communication/tickets', { params })
    return res.data as PaginatedResponse<SupportTicket>
  },

  updateTicket: async (id: string, data: UpdateTicketInput) => {
    const res = await apiClient.put(`/admin/communication/tickets/${id}`, data)
    return res.data as ApiResponse<SupportTicket>
  },

  // ─── System Audit & Settings ─────────────────────────
  getAuditLogs: async (params?: { page?: number; limit?: number; search?: string }) => {
    const res = await apiClient.get('/admin/system/audit-logs', { params })
    return res.data as PaginatedResponse<AuditLog>
  },

  clearAuditLogs: async () => {
    const res = await apiClient.post('/admin/system/audit-logs/clear', { confirm: 'CONFIRM' })
    return res.data
  },

  getSettings: async () => {
    const res = await apiClient.get('/admin/system/settings')
    return res.data as ApiResponse<SystemSettings>
  },

  updateSettings: async (data: Partial<SystemSettings>) => {
    const res = await apiClient.put('/admin/system/settings', data)
    return res.data as ApiResponse<SystemSettings>
  },

  // ─── Localities ──────────────────────────────────────
  getBoroughs: async () => {
    const res = await apiClient.get('/admin/localities/boroughs')
    return res.data as ApiResponse<Borough[]>
  },

  createBorough: async (data: Partial<Borough>) => {
    const res = await apiClient.post('/admin/localities/boroughs', data)
    return res.data as ApiResponse<Borough>
  },

  updateBorough: async (id: string, data: Partial<Borough>) => {
    const res = await apiClient.put(`/admin/localities/boroughs/${id}`, data)
    return res.data as ApiResponse<Borough>
  },

  deleteBorough: async (id: string) => {
    const res = await apiClient.delete(`/admin/localities/boroughs/${id}`)
    return res.data
  },

  getHighStreets: async () => {
    const res = await apiClient.get('/admin/localities/high-streets')
    return res.data as ApiResponse<HighStreet[]>
  },

  createHighStreet: async (data: Partial<HighStreet>) => {
    const res = await apiClient.post('/admin/localities/high-streets', data)
    return res.data as ApiResponse<HighStreet>
  },

  updateHighStreet: async (id: string, data: Partial<HighStreet>) => {
    const res = await apiClient.put(`/admin/localities/high-streets/${id}`, data)
    return res.data as ApiResponse<HighStreet>
  },

  deleteHighStreet: async (id: string) => {
    const res = await apiClient.delete(`/admin/localities/high-streets/${id}`)
    return res.data
  },

  getLocalMalls: async () => {
    const res = await apiClient.get('/admin/localities/local-malls')
    return res.data as ApiResponse<LocalMall[]>
  },

  createLocalMall: async (data: Partial<LocalMall>) => {
    const res = await apiClient.post('/admin/localities/local-malls', data)
    return res.data as ApiResponse<LocalMall>
  },

  updateLocalMall: async (id: string, data: Partial<LocalMall>) => {
    const res = await apiClient.put(`/admin/localities/local-malls/${id}`, data)
    return res.data as ApiResponse<LocalMall>
  },

  deleteLocalMall: async (id: string) => {
    const res = await apiClient.delete(`/admin/localities/local-malls/${id}`)
    return res.data
  },

  // ─── External Service Plans (MCOM Mall, etc.) ─────────────────────────
  createExternalPlan: async (data: CreateExternalPlanInput) => {
    const res = await apiClient.post('/admin/packages/external', data)
    return res.data as ApiResponse<ExternalPlan>
  },

  getExternalPlans: async (platform: string) => {
    const res = await apiClient.get('/admin/packages/external', { params: { platform } })
    return res.data as ApiResponse<ExternalPlan[]>
  },

  getExternalPlan: async (id: string, platform: string) => {
    const res = await apiClient.get(`/admin/packages/external/${id}`, { params: { platform } })
    return res.data as ApiResponse<ExternalPlan>
  },

  updateExternalPlan: async (id: string, platform: string, data: Partial<CreateExternalPlanInput>) => {
    const res = await apiClient.patch(`/admin/packages/external/${id}`, data, { params: { platform } })
    return res.data as ApiResponse<ExternalPlan>
  },

  deleteExternalPlan: async (id: string, platform: string) => {
    const res = await apiClient.delete(`/admin/packages/external/${id}`, { params: { platform } })
    return res.data
  },

  getSupportedPlatforms: async () => {
    const res = await apiClient.get('/admin/packages/external/platforms')
    return res.data as ApiResponse<string[]>
  },
}
