import { apiClient } from '../../../../services/api'
import type {
  AppHealthResult,
  ConsoleAuditLog,
  ConsoleAuditQuery,
  RegisterAppInput,
  RegisterAppResult,
  SsoClientDetail,
  SsoClientListItem,
  UpdateAppInput,
} from '../../../../services/admin/types'

export const consoleApi = {
  listApps: () => apiClient.get<SsoClientListItem[]>('/admin/console/apps').then((r) => r.data),

  getApp: (clientId: string) =>
    apiClient.get<SsoClientDetail>(`/admin/console/apps/${clientId}`).then((r) => r.data),

  registerApp: (dto: RegisterAppInput) =>
    apiClient.post<RegisterAppResult>('/admin/console/apps', dto).then((r) => r.data),

  updateApp: (clientId: string, dto: UpdateAppInput) =>
    apiClient.patch<SsoClientDetail>(`/admin/console/apps/${clientId}`, dto).then((r) => r.data),

  deactivateApp: (clientId: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/admin/console/apps/${clientId}`).then((r) => r.data),

  rotateClientSecret: (clientId: string, reason?: string) =>
    apiClient.post<{ clientSecret: string }>(`/admin/console/apps/${clientId}/rotate-secret`, { reason }).then((r) => r.data),

  rotateApiKey: (clientId: string, reason?: string) =>
    apiClient.post<{ apiKey: string }>(`/admin/console/apps/${clientId}/rotate-api-key`, { reason }).then((r) => r.data),

  rotateHmacSecret: (clientId: string, reason?: string) =>
    apiClient.post<{ hmacSecret: string }>(`/admin/console/apps/${clientId}/rotate-hmac`, { reason }).then((r) => r.data),

  rotateWebhookSecret: (clientId: string, reason?: string) =>
    apiClient.post<{ webhookSecret: string }>(`/admin/console/apps/${clientId}/rotate-webhook-secret`, { reason }).then((r) => r.data),

  getAppHealth: (clientId: string) =>
    apiClient.get<AppHealthResult>(`/admin/console/apps/${clientId}/health`).then((r) => r.data),

  getAuditLogs: (params: ConsoleAuditQuery) =>
    apiClient
      .get<{ success: boolean; data: ConsoleAuditLog[]; total: number; page: number; limit: number; totalPages: number }>(
        '/admin/console/audit-logs',
        { params },
      )
      .then((r) => r.data),
}