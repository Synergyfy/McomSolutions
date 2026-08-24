# Backend Endpoints Missing — Full Audit

> Compiled from frontend admin panel audit. All endpoints below are called by the frontend but **do not exist** in `admin.controller.ts`.

---

## 1. External Platform Packages

**Needed by:** `PlanManagementPanel.tsx`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/admin/packages/external` | Create external platform plan (MCOM Mall, MCOM Rewards, etc.) |
| `GET` | `/admin/packages/external` | List all external platform plans |
| `GET` | `/admin/packages/external/:id` | Get single external plan |
| `PATCH` | `/admin/packages/external/:id` | Update external plan |
| `DELETE` | `/admin/packages/external/:id` | Delete external plan |
| `GET` | `/admin/packages/external/platforms` | List supported platform names for dropdown |

**Frontend API methods already defined:** `createExternalPlan`, `getExternalPlans`, `getExternalPlan`, `updateExternalPlan`, `deleteExternalPlan`, `getSupportedPlatforms`

**Frontend hooks already defined:** `useExternalPlans`, `useCreateExternalPlan`, `useUpdateExternalPlan`, `useDeleteExternalPlan`, `useSupportedPlatforms`

---

## 2. Analytics Dashboard

**Needed by:** `AnalyticsPanel.tsx`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/analytics` | Get analytics data (revenue trends, transaction volumes, platform usage, business growth) |

**Frontend API method:** `getAnalytics()`

**Frontend hook:** `useAdminAnalytics()`

**Note:** The panel also has hardcoded `CHART_DATA` (12-month revenue/transaction/business arrays) and `PLATFORM_DATA` (4 platform entries). The backend should return these as part of the analytics response.

---

## 3. Dropdown Data

**Needed by:** Multiple panels (forpopulating dropdowns without loading full datasets)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/dropdowns` | Get lightweight lists for dropdowns (boroughs, managers, platforms, etc.) |

**Frontend API method:** `getDropdowns()`

**Frontend hook:** `useAdminDropdowns()`

---

## 4. Borough Stats & Metrics

**Needed by:** `BoroughsPanel.tsx` (detail view)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/localities/boroughs/:id/stats` | Get stats for a specific borough |
| `GET` | `/admin/localities/boroughs/:id/metrics` | Get metrics list for a borough |
| `POST` | `/admin/localities/boroughs/:id/metrics` | Create a metric for a borough |
| `PUT` | `/admin/localities/boroughs/metrics/:metricId` | Update a borough metric |
| `DELETE` | `/admin/localities/boroughs/metrics/:metricId` | Delete a borough metric |

**Frontend API methods:** `getBoroughStats`, `getBoroughMetrics`, `createBoroughMetric`, `updateBoroughMetric`, `deleteBoroughMetric`

**Frontend hooks:** `useBoroughStats`, `useBoroughMetrics`, `useCreateBoroughMetric`, `useUpdateBoroughMetric`, `useDeleteBoroughMetric`

---

## 5. Activity Feed

**Needed by:** `HighStreetsPanel.tsx` (operational feed sidebar)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/activities` | List recent activities (currently using audit-logs as workaround) |
| `POST` | `/admin/activities` | Create activity entry |
| `PUT` | `/admin/activities/:id` | Update activity |
| `DELETE` | `/admin/activities/:id` | Delete activity |

**Frontend API methods:** `getActivities`, `createActivity`, `updateActivity`, `deleteActivity`

**Frontend hooks:** `useAdminActivities`, `useCreateActivity`

**Note:** The `HighStreetsPanel` currently uses `useAdminAuditLogs` as a workaround. Once this endpoint exists, switch to `useAdminActivities`.

---

## 6. Programme Management

**Needed by:** `ProgrammeManagementPanel.tsx`

### Programme Phases
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/programme/phases` | List programme phases |
| `POST` | `/admin/programme/phases` | Create a phase |
| `PUT` | `/admin/programme/phases/:id` | Update a phase |
| `DELETE` | `/admin/programme/phases/:id` | Delete a phase |

### Programme Gates
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/programme/gates` | List programme gates |
| `POST` | `/admin/programme/gates` | Create a gate |
| `PUT` | `/admin/programme/gates/:id` | Update a gate |
| `DELETE` | `/admin/programme/gates/:id` | Delete a gate |

### Programme Support Agents
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/programme/agents` | List programme support agents |
| `POST` | `/admin/programme/agents` | Create a support agent |
| `PUT` | `/admin/programme/agents/:id` | Update a support agent |
| `DELETE` | `/admin/programme/agents/:id` | Delete a support agent |

### Programme Businesses
| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/programme/businesses` | List businesses in programme |
| `POST` | `/admin/programme/businesses` | Add business to programme |
| `PUT` | `/admin/programme/businesses/:id` | Update business programme record |
| `DELETE` | `/admin/programme/businesses/:id` | Remove business from programme |
| `POST` | `/admin/programme/businesses/:id/action` | Trigger action on business (extend, approve, etc.) |
| `GET` | `/admin/programme/businesses/:id/tasks` | Get tasks for a business |
| `PUT` | `/admin/programme/businesses/:id/tasks` | Update a business task status |

**Frontend API methods & hooks:** All already defined in `services/admin/index.ts` and `hooks.ts`

---

## 7. System — API Keys

**Needed by:** `SystemPanel.tsx`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/system/api-keys` | List all API keys |
| `POST` | `/admin/system/api-keys` | Create an API key |
| `PUT` | `/admin/system/api-keys/:id` | Update an API key (name, permissions, active) |
| `DELETE` | `/admin/system/api-keys/:id` | Delete an API key |

**Frontend API methods:** `getApiKeys`, `createApiKey`, `updateApiKey`, `deleteApiKey`

**Frontend hooks:** `useAdminApiKeys`, `useCreateApiKey`, `useUpdateApiKey`, `useDeleteApiKey`

---

## 8. System — Integrations

**Needed by:** `SystemPanel.tsx` (and the placeholder `IntegrationPanel.tsx`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/system/integrations` | List all integrations (Stripe, PayPal, email, SMS, etc.) |
| `POST` | `/admin/system/integrations` | Create an integration config |
| `PUT` | `/admin/system/integrations/:id` | Update integration config |
| `DELETE` | `/admin/system/integrations/:id` | Delete an integration |

**Frontend API methods:** `getIntegrations`, `createIntegration`, `updateIntegration`, `deleteIntegration`

**Frontend hooks:** `useAdminIntegrations`, `useCreateIntegration`, `useUpdateIntegration`, `useDeleteIntegration`

---

## 9. System — Health, Jobs, Error Logs

**Needed by:** `SystemPanel.tsx`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/system/health` | Get system health status (DB, API, uptime, memory) |
| `GET` | `/admin/system/jobs` | List scheduled jobs |
| `POST` | `/admin/system/jobs` | Create a scheduled job |
| `PUT` | `/admin/system/jobs/:id` | Update a job |
| `DELETE` | `/admin/system/jobs/:id` | Delete a job |
| `GET` | `/admin/system/error-logs` | Get system error logs |
| `POST` | `/admin/system/error-logs` | Log an error (for testing) |

**Frontend API methods:** `getSystemHealth`, `getSystemJobs`, `createSystemJob`, `updateSystemJob`, `deleteSystemJob`, `getSystemErrorLogs`, `createSystemErrorLog`

**Frontend hooks:** `useSystemHealth`, `useSystemJobs`, `useCreateSystemJob`, `useUpdateSystemJob`, `useDeleteSystemJob`, `useSystemErrorLogs`, `useCreateSystemErrorLog`

---

## 10. Assessment Questions

**Needed by:** `AssessmentPanel.tsx`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/assessment/questions` | List assessment questions |
| `POST` | `/admin/assessment/questions` | Create a question |
| `PUT` | `/admin/assessment/questions/:id` | Update a question |
| `DELETE` | `/admin/assessment/questions/:id` | Delete a question |
| `PUT` | `/admin/assessment/questions/reorder` | Reorder questions |

**Frontend API methods:** `getAssessmentQuestions`, `createAssessmentQuestion`, `updateAssessmentQuestion`, `deleteAssessmentQuestion`, `reorderAssessmentQuestions`

**Frontend hooks:** `useAssessmentQuestions`, `useCreateAssessmentQuestion`, `useUpdateAssessmentQuestion`, `useDeleteAssessmentQuestion`, `useReorderAssessmentQuestions`

---

## 11. High Street Actions (Backend Enhancement)

**Needed by:** `HighStreetsPanel.tsx` action buttons

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `PATCH` | `/admin/localities/high-streets/:id` | Add `lat`, `lng`, `assignedTo` fields to HighStreet model |

**Note:** The `CreateHighStreetDto` currently only accepts `name`, `borough`, `status`, `businessCount`. Need to add optional `lat`, `lng`, `assignedTo` fields. The Prisma `HighStreet` model also needs these columns added.

---

## Panels with Hardcoded/Mock Data

| Panel | Issue |
|-------|-------|
| `LocalMallsPanel.tsx` | Contains `MOCK_MALLS` array — used as seed data when API returns empty. Should be removed once API is reliable. |
| `AnalyticsPanel.tsx` | `CHART_DATA` (12-month trends) and `PLATFORM_DATA` (4 platforms) are hardcoded arrays. Backend `/admin/analytics` should return these. |
| `IntegrationPanel.tsx` | 100% placeholder — "will be available soon" text. No API calls. Should be replaced with real integration management (uses `/admin/system/integrations` endpoints above). |

---

## Summary

| Category | Count |
|----------|-------|
| Missing backend endpoints | **~55** |
| Panels needing new endpoints | **8** (`PlanManagementPanel`, `AnalyticsPanel`, `BoroughsPanel`, `HighStreetsPanel`, `ProgrammeManagementPanel`, `SystemPanel`, `IntegrationPanel`, `AssessmentPanel`) |
| Panels fully wired (no changes needed) | **11** (`OverviewPanel`, `UserManagementPanel`, `PlanManagementPanel` (internal plans), `SubscriptionManagementPanel`, `PlatformPanel`, `PermissionPanel`, `FinancePanel`, `CommunicationPanel`, `ConfigPanel`, `HighStreetActivationWizard`, `AdminHighStreetMap`) |
| Prisma schema changes needed | `HighStreet` model — add `lat Float?`, `lng Float?`, `assignedTo String?` |

---

## Recommended Implementation Order

1. **Borough Stats & Metrics** (5 endpoints) — BoroughsPanel detail view is broken without these
2. **External Platform Packages** (6 endpoints) — PlanManagementPanel external plans tab is empty
3. **Programme Management** (20 endpoints) — ProgrammeManagementPanel is the largest gap
4. **System — API Keys + Integrations + Health/Jobs/Errors** (16 endpoints) — SystemPanel tabs show empty
5. **Assessment Questions** (5 endpoints) — AssessmentPanel is wired but backend is missing
6. **Analytics** (1 endpoint) — AnalyticsPanel has hardcoded chart data
7. **Dropdown Data** (1 endpoint) — Quality-of-life improvement for all dropdowns
8. **Activity Feed** (4 endpoints) — HighStreetsPanel is using audit-logs workaround
9. **HighStreet schema update** — Add lat/lng/assignedTo to Prisma model
