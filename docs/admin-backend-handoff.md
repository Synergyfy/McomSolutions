# Admin Dashboard — Backend Handoff

This doc is for the **frontend team**. It lists every admin endpoint the backend now exposes
that the admin dashboard panels need to consume. The backend side of the mock-data audit is
complete; what remains is wiring these endpoints into the React panels.

> Base URL: `/api/v1` · Auth: `Authorization: Bearer <admin JWT>` · All routes require the `ADMIN` role.

## Conventions

- Every response uses the standard envelope: `{ success, data, message? }`.
- List endpoints return `data` as an array; where paginated, `total/page/limit/totalPages` are included.
- API keys are returned **masked** (e.g. `sk_abc123****wxyz`) — the full key is returned **only once** at creation.
  Keys are stored **hashed** (SHA-256) + a 4-char display suffix; the raw key is never persisted.

---

## 1. Local Malls — `LocalMallsPanel`

Model: `LocalMall` (full ~90-field coverage in `prisma/schema.prisma`).

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/localities/local-malls` | List all local malls |
| POST | `/admin/localities/local-malls` | Create a local mall (slug must be unique) |
| PUT | `/admin/localities/local-malls/:id` | Update a local mall |
| DELETE | `/admin/localities/local-malls/:id` | Delete a local mall |

DTO: `CreateLocalMallDto` / `UpdateLocalMallDto` in `src/admin/dto/admin.dto.ts`.

**Frontend wiring:** replace hardcoded `initialLocalMalls` + `MOCK_AFFILIATE_USERS` + fake stats in
`LocalMallsPanel.tsx` with `useAdminLocalMalls`. Note: affiliate users / rewards / spin / revenue
per-mall live stats are not yet sourced — only the core mall config + aggregate counters
(`businesses`, `customers`, `campaigns`, `events`) are stored. See §5 for borough-level metrics.

---

## 2. Admin Settings — `ConfigPanel`

The three "coming soon" tabs are backed by a single settings resource.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/system/settings` | Get global settings (creates defaults on first call) |
| PUT | `/admin/system/settings` | Update global settings |

The `SystemSettings` record contains three JSON sub-configs (already default-seeded):
- `authConfig` — login/registration/SSO/password rules/session
- `registrationFlow` — business/customer fields, verification & auto-approve toggles
- `businessProfileConfig` — storefront, google fields, location/media fields

DTO: `UpdateSystemSettingsDto` in `src/admin/dto/admin.dto.ts`.

**Frontend wiring:** the `useAdminSettings` hook (`getSettings`) already exists in
`services/admin/index.ts`; wire the three tabs to read/write the relevant JSON sub-config.

---

## 3. Programme Management — `ProgrammeManagementPanel`

New `ProgrammeModule` (`src/programme/`) — replaces `localStorage` persistence.

### Phases
| Method | Path |
|--------|------|
| GET | `/admin/programme/phases` |
| GET | `/admin/programme/phases/:id` |
| POST | `/admin/programme/phases` |
| PUT | `/admin/programme/phases/:id` |
| DELETE | `/admin/programme/phases/:id` |

### Readiness gates
| Method | Path |
|--------|------|
| GET | `/admin/programme/gates` |
| POST | `/admin/programme/gates` |
| PUT | `/admin/programme/gates/:id` |
| DELETE | `/admin/programme/gates/:id` |

### Support agents
| Method | Path |
|--------|------|
| GET | `/admin/programme/agents` |
| POST | `/admin/programme/agents` |
| PUT | `/admin/programme/agents/:id` |
| DELETE | `/admin/programme/agents/:id` |

### Business programme records
| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/programme/businesses` | Includes phase relation |
| POST | `/admin/programme/businesses` | Create a business programme |
| PUT | `/admin/programme/businesses/:id` | Update |
| DELETE | `/admin/programme/businesses/:id` | Delete |
| POST | `/admin/programme/businesses/:id/action` | Body `{ action, days? }` — `pause`, `resume`, `fastTrack`, `extend`, `skipPhase`, `reset` |
| GET | `/admin/programme/businesses/:id/tasks` | Returns `{ [missionId]: taskStatus }` |
| PUT | `/admin/programme/businesses/:id/tasks` | Body `{ missionId, status }` — `not_started` / `in_progress` / `completed` |

DTOs: `src/programme/dto/programme.dto.ts`.

---

## 4. Integrations — `IntegrationPanel`

### API keys
| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/system/api-keys` | Masked keys |
| POST | `/admin/system/api-keys` | Full key returned once |
| PUT | `/admin/system/api-keys/:id` | Update name/permissions/status |
| DELETE | `/admin/system/api-keys/:id` | Delete |

### Integrations
| Method | Path |
|--------|------|
| GET | `/admin/system/integrations` |
| POST | `/admin/system/integrations` |
| PUT | `/admin/system/integrations/:id` |
| DELETE | `/admin/system/integrations/:id` |

DTOs: `CreateSystemApiKeyDto`, `CreateSystemIntegrationDto` in `src/admin/dto/admin-ops.dto.ts`.

---

## 5. Boroughs — `BoroughsPanel`

Replaces the hardcoded detail-view stats (`1,284 Businesses`, `42.5k Customers`, `8.2k/day Footfall`, `£1.42M Impact`, bar chart).

### Monthly metrics CRUD
| Method | Path |
|--------|------|
| GET | `/admin/localities/boroughs/:id/metrics` |
| POST | `/admin/localities/boroughs/:id/metrics` | 409 if borough/month exists |
| PUT | `/admin/localities/boroughs/metrics/:metricId` |
| DELETE | `/admin/localities/boroughs/metrics/:metricId` |

### Detail stats (aggregated)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/localities/boroughs/:id/stats` | Returns `{ borough, stats, trends, chart }` |

`stats`: `totalBusinesses`, `activeCustomers`, `footfallDensityPerDay`, `mcomImpact`.
`trends`: `businessGrowth`, `customerGrowth`, `footfallTrend`, `revenueTrend` (all % month-over-month).
`chart`: `{ footfall[], revenue[], months[] }`.

---

## 6. Analytics — `AnalyticsPanel`

Replaces `Math.floor(total * 0.15)` fake growth and the hardcoded 60/30/10 revenue split.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/analytics` | Real period-over-period growth + revenue breakdown |

Returns `{ growth: { businessGrowth, customerGrowth, revenueGrowth }, revenueBreakdown: [{ type, amount, percentage }], totalRevenue }`.

---

## 7. Activity Feed — `HighStreetsPanel`

Replaces the fake operational feed items ("Marylebone spike detected", etc.).

| Method | Path |
|--------|------|
| GET | `/admin/activities?highStreetId=&page=&limit=` |
| POST | `/admin/activities` |
| PUT | `/admin/activities/:id` |
| DELETE | `/admin/activities/:id` |

DTO: `CreateActivityFeedDto` (severity: `info` / `success` / `warning` / `danger`). GET is paginated (`page`, `limit` max 100) and returns `{ data, total, page, limit, totalPages }`.

---

## 8. Assessment — `AssessmentPanel`

Replaces in-memory `AdminDataContext` questions.

| Method | Path |
|--------|------|
| GET | `/admin/assessment/questions` |
| POST | `/admin/assessment/questions` |
| PUT | `/admin/assessment/questions/:id` |
| DELETE | `/admin/assessment/questions/:id` |
| PUT | `/admin/assessment/questions/reorder` | Body `{ orderedIds: string[] }` |

DTO: `CreateAssessmentQuestionDto` (fieldType: `single-choice`, `multi-choice`, `text`, `textarea`, `number`, `date`, `rating`, `yes-no`).

---

## 9. System Developer Center — `SystemPanel`

Replaces the 6 non-functional cards.

| Card | Method | Path |
|------|--------|------|
| System Health | GET | `/admin/system/health` |
| Background Jobs | GET | `/admin/system/jobs` |
| Background Jobs (create) | POST | `/admin/system/jobs` |
| Background Jobs (update) | PUT | `/admin/system/jobs/:id` |
| Background Jobs (delete) | DELETE | `/admin/system/jobs/:id` |
| Error Logs | GET | `/admin/system/error-logs` |
| Error Logs (create) | POST | `/admin/system/error-logs` |

(`API Docs` → Swagger at `/api/docs`; `Webhooks` → IntegrationPanel §4; `Integration Logs` → §7 activity feed.)

---

## 10. Dropdown Data — `UserManagementPanel`

Replaces hardcoded dropdown options.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/dropdowns` | Membership tiers, platforms, permissions, sources, registration sources, permission roles |

Returns `{ membershipTiers[], platforms[], permissions[], permissionLabels[], sources[], registrationSources[], permissionRoles[] }`.

`permissions` are the raw keys (e.g. `view_businesses`); `permissionLabels` are the human-readable forms (e.g. `View Businesses`) for dropdown display.

---

## Existing `services/admin` wiring gaps (frontend)

`apps/frontend/src/services/admin/index.ts` already has: `getStats`, `getPlans`, `getPlatforms`,
`getPermissions`, `getSettings`, `getBoroughs`, `getHighStreets`, `getLocalMalls`, and the
user/plan/package/subscription/finance/communication methods.

**Missing (need to be added by frontend):**
- `getAnalytics`, `getDropdowns`
- Local mall create/update/delete
- `ProgrammeModule` calls (phases, gates, agents, businesses, tasks, actions)
- `AdminOps` calls (api-keys, integrations, assessment, activities, borough metrics/stats, jobs, error-logs, health)
