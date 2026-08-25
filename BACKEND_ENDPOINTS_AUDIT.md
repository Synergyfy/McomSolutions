# Backend Endpoints Audit — Verified State (August 2026)

> **Status: RESOLVED.** The original audit claimed ~55 endpoints were missing. A full codebase re-verification found that **all** of those endpoints already exist across `admin-ops.controller.ts`, `programme.controller.ts`, and `admin.controller.ts`. This document records the verified state, the one real bug found and fixed, and the new work completed.

---

## Verified: Endpoints that already existed

All endpoints below are **confirmed present** (route, method, and service implementation) in the listed controller.

| # | Area | Endpoints | Controller |
|---|------|-----------|------------|
| 1 | External platform packages | `GET/POST /admin/packages/external`, `GET/PATCH/DELETE /admin/packages/external/:id`, `GET /admin/packages/external/platforms` | `AdminOpsController` (`admin-ops.controller.ts`) |
| 2 | Analytics | `GET /admin/analytics` (growth, revenue breakdown, total revenue) | `AdminController` (`admin.controller.ts`) |
| 3 | Dropdowns | `GET /admin/dropdowns` | `AdminController` |
| 4 | Borough stats & metrics | `GET /admin/localities/boroughs/:id/stats`, `GET/POST /admin/localities/boroughs/:id/metrics`, `PUT/DELETE /admin/localities/boroughs/metrics/:metricId` | `AdminOpsController` |
| 5 | Activity feed | `GET/POST /admin/activities`, `PUT/DELETE /admin/activities/:id` | `AdminOpsController` |
| 6 | Programme management | Phases, gates, agents, businesses, `:id/action`, `:id/tasks` (19 routes) | `ProgrammeController` (`programme.controller.ts`) |
| 7 | System API keys | `GET/POST/PUT/DELETE /admin/system/api-keys`, `PUT/DELETE .../:id` | `AdminOpsController` |
| 8 | System integrations | `GET/POST/PUT/DELETE /admin/system/integrations`, `PUT/DELETE .../:id` | `AdminOpsController` |
| 9 | System health / jobs / error logs | `GET /admin/system/health`, `GET/POST/PUT/DELETE /admin/system/jobs`, `GET/POST /admin/system/error-logs` | `AdminOpsController` |
| 10 | Assessment questions | `GET/POST/PUT/DELETE /admin/assessment/questions`, `PUT /admin/assessment/questions/reorder` | `AdminOpsController` |
| 11 | HighStreet lat/lng/assignedTo | `HighStreet` Prisma model already has `lat Float?`, `lng Float?`, `assignedTo String?`; DTOs (`CreateHighStreetDto` / `UpdateHighStreetDto`) already accept them | schema.prisma + `admin/dto/admin.dto.ts` |

---

## Bug fixed — `/admin/packages/external` route collision

**Two controllers** mapped identical routes:

- `AdminOpsController` (`@Controller('admin')` + `packages/external`) → **local DB** via `ExternalPlan` Prisma model (this is what the frontend `adminApi` calls).
- `ServiceConnectorsController` (`@Controller('admin/packages/external')`) → external connector API (MCOM Mall / Rewards).

**Resolution (per user decision):** Keep the local-DB implementation. Removed `ServiceConnectorsController` (deleted `service-connectors.controller.ts`, dropped it from `service-connectors.module.ts`).

**Preserved:** `PlansController` (public `GET /plans/platform`, used by `services/payment/index.ts`), `ServiceConnectorsService`, `ConnectorFactory`, and the Mall/Rewards connectors — those still serve the public plan-listing route and remain available for future use.

---

## New work completed

### Campaign backend (built from scratch — no campaign domain existed)

- **Prisma model `Campaign`** + migration `20260825162235_add_campaigns` (`prisma/schema.prisma`).
  - Fields: `name`, `description?`, `locationType` (`high_street | borough | local_mall`), `locationId?`, `locationName?`, `status` (`active | paused | completed | draft`), `startDate?`, `endDate?`.
  - Indexes on `locationType`, `status`, `locationId`.
- **New `CampaignModule`** (`src/campaign/`): `campaign.controller.ts`, `campaign.service.ts`, `dto/campaign.dto.ts`, `campaign.module.ts`. Registered in `app.module.ts`.
- **Endpoints** (Swagger-documented, `JwtAuthGuard` + `RolesGuard`, `Roles(ADMIN)`, `@Controller('admin/campaigns')`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/admin/campaigns` | List campaigns (optional `locationType` / `locationId` filters) |
| `GET` | `/admin/campaigns/:id` | Get single campaign |
| `POST` | `/admin/campaigns` | Create a campaign |
| `PATCH` | `/admin/campaigns/:id` | Update a campaign |
| `DELETE` | `/admin/campaigns/:id` | Delete a campaign |
| `POST` | `/admin/campaigns/:id/action` | Pause / resume / complete |

### Frontend campaign integration

- `services/admin/types.ts`: added `Campaign`, `CreateCampaignInput`.
- `services/admin/index.ts`: added `getCampaigns`, `getCampaign`, `createCampaign`, `updateCampaign`, `deleteCampaign`, `campaignAction`.
- `services/admin/hooks.ts`: added `useAdminCampaigns`, `useCreateCampaign`, `useUpdateCampaign`, `useDeleteCampaign`, `useCampaignAction`.

### UI wired to real endpoints (previously no-op / placeholder)

- **`HighStreetsPanel.tsx`**
  - "Launch Campaign" modal now creates a real campaign (`POST /admin/campaigns`, `locationType: high_street`, linked to the high street). Removed the "will be available once the backend…" notice.
  - "View Analytics" modal now shows real data: campaign counts for the high street + the high street's activity feed entries. Removed the placeholder notice.
- **`BoroughsPanel.tsx`**
  - "Campaigns Control" detail tab now lists real borough campaigns from `useAdminCampaigns` (filtered by borough `locationId`).
  - "Launch New Campaign" modal now creates a real campaign (`locationType: borough`) with a submitting state.
- **`SystemPanel.tsx`** — Audit Logs "Export" button now exports the filtered logs to CSV.
- **`LocalMallsPanel.tsx`** — "Export" button now exports the filtered LocalMalls to CSV.

---

## Previously-flagged items that are now resolved / not applicable

| Audit claim | Verified reality |
|-------------|------------------|
| `LocalMallsPanel` contains `MOCK_MALLS` array | No such array — only a `LocalMallData` type interface. Data comes from `useAdminLocalMalls`. |
| `AnalyticsPanel` hardcodes `CHART_DATA` / `PLATFORM_DATA` | No hardcoded arrays. Panel derives revenue/platform stats from `useAdminStats` + `useAdminAnalytics`. |
| `IntegrationPanel` is a placeholder ("will be available soon") | Rewritten — full API Keys + Integrations management using the real `/admin/system/*` endpoints. |
| `HighStreetsPanel` uses `useAdminAuditLogs` as a workaround | Already uses `useAdminActivities`. |

---

## Summary

| Category | Count |
|----------|-------|
| Missing backend endpoints at time of verification | **0** |
| Route collision bugs found & fixed | **1** (`/admin/packages/external`) |
| New campaign endpoints built | **6** |
| Frontend panels newly wired to real endpoints | **4** (`HighStreetsPanel`, `BoroughsPanel`, `SystemPanel` export, `LocalMallsPanel` export) |
| Prisma migrations applied | **1** (`add_campaigns`) |