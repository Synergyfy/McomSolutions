# Mcom Console — Full Engineering Implementation Plan
### Dynamic Platform Registration for the McomSolutions Ecosystem

> **Document Status**: Approved for Implementation  
> **Engineer Audience**: Full-stack — NestJS backend + React/TypeScript frontend  
> **Priority**: Backward Compatibility is non-negotiable. Every change must be additive.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Audit](#2-current-architecture-audit)
3. [Conceptual Model](#3-the-mcom-console--conceptual-model)
4. [Backward Compatibility — Proof Per Component](#4-backward-compatibility--proof-per-component)
5. [Data Model Changes](#5-data-model-changes)
6. [Backend API Surface](#6-backend--complete-api-surface)
7. [Caching & Performance Architecture](#7-caching--performance-architecture)
8. [Security Model](#8-security-model--everything-the-engineer-needs)
9. [Input Validation Rules](#9-input-validation-rules)
10. [Error Handling Patterns](#10-error-handling-patterns)
11. [Frontend — Console UI](#11-frontend--mcom-console-ui)
12. [New App Integration Guide](#12-new-app-integration-guide-what-the-consumer-dev-does)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment Checklist](#14-deployment-checklist)
15. [Implementation Execution Order](#15-implementation-execution-order)
16. [Future Extensions](#16-future-extensions)
17. [Dynamic Memberships & Packages Page](#17-dynamic-memberships--packages-page)
18. [Billing API Security Model](#18-billing-api-security-model)

---

## 1. Executive Summary

**The Problem Today**

Adding a new platform (e.g. Mcom vCard) to the McomSolutions ecosystem currently requires touching at least **6 separate files and 2 environment files**, then triggering a **full redeploy**:

1. `prisma.service.ts` — hard-coded `seedDefaultSsoClients()` with secrets, redirect URIs, API keys.
2. `connector.factory.ts` — new entry in `SUPPORTED_PLATFORMS` dict + new switch case.
3. `main.ts` — new origin added to `defaultOrigins[]` CORS allow-list.
4. `.env` on McomSolutions — new `MCOM_VCARD_SECRET=` variable.
5. `.env` on the new app — multiple `MCOM_*` variables manually sourced from the team.
6. A brand-new `mcom-vcard.connector.ts` class wired into NestJS DI.
7. Full deploy of McomSolutions.

**The Solution: Mcom Console**

An admin panel — inside the existing McomSolutions admin dashboard — modelled on **Google Cloud Console's OAuth Credentials page**. An admin:

1. Fills a form → app is registered in the database.
2. Gets back 4 credentials to paste into the new app's `.env`.
3. Never touches McomSolutions source code again for routine onboarding.

McomSolutions becomes a **dynamic identity and billing platform** — its source code changes only for new *capabilities*, never for new *tenants*.

---

## 2. Current Architecture Audit

### 2.1 What Already Exists (Assets to Build On)

| Layer | Asset | File | Notes |
|---|---|---|---|
| SSO | `SsoClient` Prisma model | `prisma/schema.prisma` | Already has `clientId`, `clientSecret`, `apiKey`, `redirectUris`, `scopes`, `logoUrl`, `isActive` |
| SSO Service | `registerClient()`, `listClients()`, `updateClient()`, `getClientByClientId()` | `auth/sso.service.ts` | Core CRUD exists; needs extension |
| SSO Controller | Admin-gated `POST/GET/PATCH /auth/sso/clients` | `auth/sso.controller.ts` | Admin endpoints already gated by `JwtAuthGuard + role === ADMIN` |
| SSO Cache | Redis caching of `SsoClient` per `clientId` (5 min TTL) | `sso.service.ts:getClientByClientId()` | Pattern to reuse for CORS cache |
| Connector Interface | `ServiceConnector` interface | `service-connectors/connectors/connector.interface.ts` | Clean interface; generic connector will implement it |
| Connector Factory | `ConnectorFactory.getConnector()` | `connector.factory.ts` | Switch-case today; extend with DB fallback |
| Named Connectors | `McomMallConnector`, `McomRewardsConnector` | `connectors/` | Stay untouched |
| Data Sharing | HMAC-signed inter-service API | `data-sharing/` | Guard reads `SSO_API_SECRET` env var today |
| Admin Dashboard | Tabbed React admin UI | `AdminDashboard.tsx` | `ADMIN_TABS` array; `renderPanel()` switch |
| Platform Launcher | Static `ALL_PLATFORMS[]` array | `DashboardAllProducts.tsx` | To be made API-driven in Phase 6 |
| Permissions | `calculatePermissions()` | `data-sharing.service.ts` | Hard-coded platform flags |

### 2.2 What's Hard-Coded (The Six Problems)

| # | Pain Point | Exact Location | Developer Cost Per New App |
|---|---|---|---|
| 1 | SSO client seeds | `prisma.service.ts:20-99` | Edit seed array + redeploy |
| 2 | CORS origins | `main.ts:17-32` | Edit array + redeploy |
| 3 | HMAC secret per service | `.env` file | Edit env on both apps |
| 4 | Connector factory | `connector.factory.ts:6-13, 30-37` | New class + DI + switch case |
| 5 | Permission flags | `data-sharing.service.ts:169-217` | Edit `calculatePermissions()` |
| 6 | Platform launcher UI | `DashboardAllProducts.tsx:25-120` | Edit static array |

---

## 3. The Mcom Console — Conceptual Model

Think: **Google Cloud Console OAuth Credentials** page, embedded in the existing `/admin` dashboard.

### Admin Flow — Registering "Mcom vCard"

```
Admin opens /admin/console
  → clicks "Register New Application"
  → fills:
      App Name:         Mcom vCard
      App Slug:         mcom-vcard         (auto-derived, editable)
      Platform Slug:    vcard              (for permissions: "canAccess_vcard")
      Redirect URIs:    https://vcard.mcom.com/auth/callback
      CORS Origins:     https://vcard.mcom.com
      Billing API URL:  https://api.vcard.mcom.com   (optional)
      Scopes:           profile, email, business
      Webhook URL:      https://api.vcard.mcom.com/webhooks  (optional)
  → clicks "Register Application"
  → Console displays ONE TIME:
      ✅ Client ID:      mcom-vcard
      ✅ Client Secret:  cs_xxxx...   [Copy]
      ✅ API Key:        ak_xxxx...   [Copy]
      ✅ HMAC Secret:    hm_xxxx...   [Copy]
      ✅ Webhook Secret: wh_xxxx...   [Copy]
      📋 .env snippet   [Copy All]

Dev of vCard pastes 4 values into their .env → Integration complete.
No code change to McomSolutions.
No redeploy of McomSolutions.
```

---

## 4. Backward Compatibility — Proof Per Component

> This is the most critical section. Read every item carefully before implementing.

### 4.1 SSO Client Seeds (`prisma.service.ts`)

**Current behaviour**: On every app startup, `seedDefaultSsoClients()` runs. It creates `mcom-mall`, `mcom-loyalty`, `247gbs` if they don't exist. If they exist, it merges new default redirect URIs into what's already in the DB.

**Change**: None. The seed function is kept exactly as-is. The new console simply provides a UI that calls the same `registerClient()` method via the API. The seeded clients become manageable via the console UI, but the seed still runs on startup as a safety net.

**Risk**: Zero. Seeded records gain new nullable columns (`hmacSecret`, `corsOrigins`, etc.) that default to `null`/`[]`. Existing code that reads those records never reads the new columns, so it is unaffected.

---

### 4.2 CORS Origins (`main.ts`)

**Current behaviour**: `defaultOrigins[]` is a hard-coded array in source. `envOrigins` are read from `FRONTEND_URL`, `MCOM_MALL_API_URL`, `MCOM_REWARDS_API_URL`. Both are merged into `allowedOrigins` at startup.

**Change strategy**: The static arrays **remain in the code unchanged** as the hard fallback. On bootstrap, we additionally query the DB for `corsOrigins` from all active `SsoClient` records and merge them in. The final set is `staticOrigins ∪ envOrigins ∪ dbOrigins`.

```typescript
// main.ts — NEW bootstrap logic (additive only)
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mcommall.vercel.app',
  'https://mcomloyalty.vercel.app',
  'https://mcom-solutions-backend.vercel.app',
  'https://centralhubsolution.com',
  'https://www.centralhubsolution.com',
  // ← these lines STAY, never removed
];

// NEW: load db origins at startup
const ssoService = app.get(SsoService);
const dbOrigins = await ssoService.getAllCorsOrigins(); // queries SsoClient.corsOrigins

const envOrigins = [
  process.env.FRONTEND_URL,
  process.env.MCOM_MALL_API_URL,
  process.env.MCOM_REWARDS_API_URL,
].filter((o): o is string => Boolean(o?.trim()));

const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins, ...dbOrigins])];
```

**For post-startup CORS updates** (when admin adds a new origin via Console without restarting): CORS middleware is configured once at startup. For runtime updates, the **Redis CORS cache** approach is used — see Section 7.2.

**Risk**: Zero. Adding origins to the allowed list is additive. No existing origin is ever removed.

---

### 4.3 HMAC Auth (`data-sharing` guard)

**Current behaviour**: The `DataSharingGuard` reads a single shared `SSO_API_SECRET` from env to verify HMAC signatures from all partner services.

**Current `.env` setup**:
```env
SSO_API_SECRET="your-hmac-shared-secret"
# MCOM_MALL_SECRET="mall-hmac-secret"
# MCOM_REWARDS_SECRET="rewards-hmac-secret"
```

**Change**: Implement a **3-tier fallback** in the guard:

```typescript
// data-sharing.guard.ts — new lookup chain
async verifyHmac(clientId: string, signature: string, body: string): Promise<boolean> {
  // Tier 1: per-client secret from DB (new apps registered via Console)
  const client = await this.ssoService.getClientByClientId(clientId);
  if (client?.hmacSecret) {
    return this.compareHmac(body, signature, client.hmacSecret);
  }

  // Tier 2: per-service env var (existing apps: MCOM_MALL_SECRET, MCOM_REWARDS_SECRET)
  const envKey = `MCOM_${clientId.replace(/-/g, '_').toUpperCase()}_SECRET`;
  const envSecret = this.configService.get<string>(envKey);
  if (envSecret) {
    return this.compareHmac(body, signature, envSecret);
  }

  // Tier 3: global shared secret (original fallback — unchanged)
  const globalSecret = this.configService.get<string>('SSO_API_SECRET');
  return this.compareHmac(body, signature, globalSecret);
}
```

**For partner apps to send `clientId`**: add an `X-Mcom-Client-ID` header to HMAC requests. Existing apps without this header fall through to Tier 3 (global secret) as before.

**Risk**: Zero. Existing callers without `X-Mcom-Client-ID` skip Tiers 1 and 2 and hit the global secret exactly as before.

---

### 4.4 Connector Factory (`connector.factory.ts`)

**Current behaviour**: Hard-coded `SUPPORTED_PLATFORMS` dict and switch-case. Throws if platform not found.

**Change**: Named connectors are checked **first** (highest priority). DB lookup is the fallback for unknown names. Throw behaviour is preserved for platforms with no named connector AND no DB record.

```typescript
// connector.factory.ts — full replacement logic
async getConnector(platform: string): Promise<ServiceConnector> {
  // PRIORITY 1: Named connectors — never change, never remove these
  switch (platform) {
    case 'MCOM Mall':    return this.mcomMall;
    case 'MCOM Rewards': return this.mcomRewards;
  }

  // PRIORITY 2: DB-driven generic connector (new apps via Console)
  const cacheKey = `connector_client:${platform}`;
  let client = await this.redisService.get<SsoClient>(cacheKey);
  if (!client) {
    client = await this.prisma.ssoClient.findFirst({
      where: {
        OR: [
          { name: platform },
          { platformSlug: platform.toLowerCase() },
        ],
        isActive: true,
        billingApiUrl: { not: null },
      },
    });
    if (client) {
      await this.redisService.set(cacheKey, client, 300); // 5-min cache
    }
  }

  if (client) return new GenericHttpConnector(client);

  // Same throw as before — existing behaviour preserved
  throw new BadRequestException(
    `Platform "${platform}" is not supported.`,
  );
}
```

**Risk**: Zero. Existing platform strings `'MCOM Mall'` and `'MCOM Rewards'` hit the switch-case immediately and never reach the DB lookup.

---

### 4.5 Permission Flags (`data-sharing.service.ts`)

**Current behaviour**: `calculatePermissions()` returns a fixed object:
```typescript
{ canAccessMall: bool, canAccessRewards: bool, canAccessSpin: bool, canAccessAudit: bool, canAccessExpo: bool }
```

**All existing consumers** (Mcom Mall, Mcom Rewards, etc.) expect these exact key names.

**Change**: The function returns the exact same fixed keys **plus** additional dynamic keys:

```typescript
private calculatePermissions(role, membershipLevel, membershipStatus, packages) {
  // Admin shortcut — identical to today
  if (role === 'ADMIN') {
    return {
      canAccessMall: true, canAccessRewards: true, canAccessSpin: true,
      canAccessAudit: true, canAccessExpo: true,
    };
  }

  // Build dynamic map from packages (new — no old consumer sees this key format)
  const dynamic: Record<string, boolean> = {};
  if (membershipStatus === 'active') {
    packages.forEach(pkg => {
      if (pkg.status === 'active' && pkg.platform) {
        dynamic[`canAccess_${pkg.platform.toLowerCase().replace(/[^a-z0-9]/g, '_')}`] = true;
      }
    });
    if (membershipLevel === 'Platinum') {
      // Platinum still grants everything as before
      ['mall','rewards','spin','audit','expo'].forEach(p => {
        dynamic[`canAccess_${p}`] = true;
      });
    }
  }

  // BACKWARD-COMPAT ALIASES — always present, always match old key names
  return {
    // ↓ These 5 lines are exactly what existed before — untouched
    canAccessMall:    dynamic['canAccess_mall']    ?? false,
    canAccessRewards: dynamic['canAccess_rewards'] ?? false,
    canAccessSpin:    dynamic['canAccess_spin']    ?? false,
    canAccessAudit:   dynamic['canAccess_audit']   ?? false,
    canAccessExpo:    dynamic['canAccess_expo']    ?? false,
    // ↓ New dynamic keys for new platforms — old consumers ignore these
    ...dynamic,
  };
}
```

**Risk**: Zero. The 5 original keys are always present. New `canAccess_vcard` style keys are invisible to old consumers.

---

### 4.6 Platform Launcher UI (`DashboardAllProducts.tsx`)

**Current behaviour**: Static `ALL_PLATFORMS[]` array, hardcoded.

**Change strategy**: Keep the static array as a **fallback/skeleton**. Fetch registered apps from the API and merge them in. If the API is down, static array is shown.

```typescript
// In DashboardAllProducts.tsx
const { data: registeredApps } = useQuery(['console-apps'], fetchRegisteredApps, {
  onError: () => {/* silently fall back to static list */},
});

const platforms = registeredApps
  ? mergeWithStaticList(ALL_PLATFORMS, registeredApps)
  : ALL_PLATFORMS; // ← original behaviour if API fails
```

**Risk**: Minimal. The static array is preserved. API failure degrades gracefully to current behaviour.

---

### 4.7 Existing API Endpoints

**Rule**: Zero changes to any existing route path, method, request body, or response shape.

- `/api/v1/auth/sso/*` — unchanged
- `/api/v1/data-sharing/*` — unchanged (HMAC guard updated internally, same interface)
- `/api/v1/service-connectors/*` — unchanged
- `/api/v1/admin/*` (existing) — unchanged

All new routes are under `/api/v1/admin/console/*` — a net-new namespace.

---

## 5. Data Model Changes

### 5.1 Prisma Migration — Extend `SsoClient`

Add only optional fields. Never modify or remove existing fields. Generate as a single `ALTER TABLE` migration.

```prisma
model SsoClient {
  // ── EXISTING FIELDS (DO NOT TOUCH) ──────────────────────────────
  id            String        @id @default(cuid())
  clientId      String        @unique
  clientSecret  String
  name          String
  redirectUris  String[]
  scopes        String[]
  logoUrl       String?
  apiKey        String        @unique
  isActive      Boolean       @default(true)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  ssoAuthCodes  SsoAuthCode[]
  ssoSessions   SsoSession[]

  // ── NEW FIELDS (all nullable/defaulted — safe migration) ─────────
  description   String?
  appUrl        String?            // Frontend URL (https://vcard.mcom.com)
  billingApiUrl String?            // Backend URL for Generic Connector
  hmacSecret    String?            // Per-client HMAC secret (stored encrypted)
  webhookSecret String?            // For webhook payload verification
  webhookUrl    String?            // Where to POST lifecycle events
  platformSlug  String?   @unique  // e.g. "vcard" → "canAccess_vcard"
  corsOrigins   String[]  @default([])
  isSystemApp   Boolean   @default(false) // True = not deletable via Console
  metadata      Json?               // Extensible future config blob
  lastWebhookAt DateTime?           // Monitoring: last successful webhook delivery
  webhookFailCount Int    @default(0)
}
```

**Migration command**:
```bash
npx prisma migrate dev --name add_console_fields_to_sso_client
```

> ⚠️ Run migration BEFORE deploying the new code. The migration is additive — existing records gain nullable columns. Production data is safe.

### 5.2 New Table: `AppWebhookLog`

```prisma
model AppWebhookLog {
  id           String    @id @default(cuid())
  clientId     String
  event        String    // "user.registered", "package.created", etc.
  payload      Json
  statusCode   Int?
  responseBody String?
  deliveredAt  DateTime?
  failed       Boolean   @default(false)
  createdAt    DateTime  @default(now())

  @@index([clientId])
  @@index([createdAt])
}
```

### 5.3 New Table: `ConsoleAuditLog`

Every admin action in the Console must be auditable. This is separate from app-level webhooks.

```prisma
model ConsoleAuditLog {
  id         String   @id @default(cuid())
  adminId    String                     // Which admin performed the action
  clientId   String                     // Which app was affected
  action     String                     // "register", "update", "deactivate", "rotate_secret", etc.
  changes    Json?                      // { before: {...}, after: {...} }
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([clientId])
  @@index([adminId])
  @@index([createdAt])
}
```

---

## 6. Backend — Complete API Surface

### 6.1 New Module: `console`

Create the following file structure:

```
apps/backend/src/console/
  console.module.ts
  console.controller.ts
  console.service.ts
  dto/
    register-app.dto.ts
    update-app.dto.ts
    rotate-secret.dto.ts
  guards/
    console-admin.guard.ts     (same as JwtAuthGuard + ADMIN check, extracted for reuse)
```

### 6.2 `ConsoleService` — Full Method List

```typescript
@Injectable()
export class ConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────

  async registerApp(dto: RegisterAppDto, adminId: string): Promise<RegisterAppResult>
  // Returns: { client (without secrets), plainSecrets: { clientSecret, apiKey, hmacSecret, webhookSecret } }
  // Plain secrets shown ONCE, never stored in plain form.

  async listApps(): Promise<AppListItem[]>
  // Returns: all SsoClient records (sensitive fields excluded)

  async getApp(clientId: string): Promise<AppDetail>
  // Returns: single record (sensitive fields masked as "••••••")

  async updateApp(clientId: string, dto: UpdateAppDto, adminId: string): Promise<AppDetail>
  // Updates allowed fields; invalidates Redis cache; logs to ConsoleAuditLog.

  async deactivateApp(clientId: string, adminId: string): Promise<void>
  // Soft-delete: sets isActive = false. isSystemApp check: throw if true.
  // Invalidates all SSO sessions for this client.
  // Logs to ConsoleAuditLog.

  // ── SECRET ROTATION ───────────────────────────────────────────────

  async rotateClientSecret(clientId: string, adminId: string): Promise<{ clientSecret: string }>
  // Generates new random secret, bcrypt-hashes and stores it, returns plain value ONCE.
  // Invalidates Redis SSO client cache.
  // Logs rotation event to ConsoleAuditLog.

  async rotateApiKey(clientId: string, adminId: string): Promise<{ apiKey: string }>
  // Generates new api_key_<hex>, stores plain (needed for comparison), returns it ONCE.
  // Invalidates Redis cache.

  async rotateHmacSecret(clientId: string, adminId: string): Promise<{ hmacSecret: string }>
  // Generates new HMAC secret. Stores encrypted. Returns plain ONCE.
  // Invalidates Redis cache.

  async rotateWebhookSecret(clientId: string, adminId: string): Promise<{ webhookSecret: string }>

  // ── UTILITY ───────────────────────────────────────────────────────

  async getAllCorsOrigins(): Promise<string[]>
  // Used by main.ts on bootstrap. Flattens corsOrigins from all active SsoClient records.
  // Redis cached: key = "cors:all_origins", TTL = 60s.

  async invalidateCorsCache(): Promise<void>
  // Called whenever corsOrigins are updated via Console.

  async pingAppHealth(clientId: string): Promise<{ reachable: boolean; latencyMs: number }>
  // HEAD request to billingApiUrl. Used by Console health dashboard.
}
```

### 6.3 `ConsoleController` — Endpoints

All routes: `@UseGuards(JwtAuthGuard)` + role check `req.user.role !== 'ADMIN'` → throw `ForbiddenException`.

```typescript
@ApiTags('Mcom Console')
@Controller('admin/console')
export class ConsoleController {

  @Post('apps')            // Register new app
  @Get('apps')             // List all apps
  @Get('apps/:clientId')   // Get app detail
  @Patch('apps/:clientId') // Update app
  @Delete('apps/:clientId') // Deactivate app (soft)

  @Post('apps/:clientId/rotate-secret')
  @Post('apps/:clientId/rotate-api-key')
  @Post('apps/:clientId/rotate-hmac')
  @Post('apps/:clientId/rotate-webhook-secret')

  @Get('apps/:clientId/health')  // Ping billingApiUrl
  @Get('audit-logs')             // List ConsoleAuditLog with filters
}
```

### 6.4 `RegisterAppDto` — Complete DTO

```typescript
import { IsString, IsUrl, IsArray, IsOptional, IsBoolean, Matches, MinLength, MaxLength, ArrayMaxSize } from 'class-validator';

export class RegisterAppDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name: string;                         // "Mcom vCard"

  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'clientId must be lowercase letters, numbers, and hyphens only' })
  @MaxLength(50)
  clientId: string;                     // "mcom-vcard"

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]+$/, { message: 'platformSlug must be lowercase letters, numbers, underscores only' })
  @MaxLength(30)
  platformSlug?: string;                // "vcard" → permission key "canAccess_vcard"

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsUrl()
  appUrl?: string;

  @IsOptional()
  @IsUrl()
  billingApiUrl?: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(20)
  redirectUris: string[];

  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(20)
  corsOrigins: string[];

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  scopes: string[];                     // ['profile', 'email', 'business']

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsBoolean()
  isSystemApp?: boolean;               // Only super-admins should set this
}
```

### 6.5 Secret Generation Strategy

```typescript
// In ConsoleService — secret generation helpers (use crypto, never Math.random)
import * as crypto from 'crypto';

private generateClientSecret(): string {
  return `cs_${crypto.randomBytes(32).toString('hex')}`;  // 65 chars
}

private generateApiKey(): string {
  return `ak_${crypto.randomBytes(24).toString('hex')}`;  // 51 chars
}

private generateHmacSecret(): string {
  return `hm_${crypto.randomBytes(32).toString('hex')}`;  // 65 chars
}

private generateWebhookSecret(): string {
  return `wh_${crypto.randomBytes(24).toString('hex')}`;  // 51 chars
}
```

**Storage rules**:
- `clientSecret` → bcrypt hash stored. Plain returned once.
- `apiKey` → stored plain (must be comparable for auth). Transmitted only over HTTPS admin API.
- `hmacSecret` → stored encrypted (AES-256-GCM via a `CONSOLE_ENCRYPTION_KEY` env var). Plain returned once.
- `webhookSecret` → same as hmacSecret.

### 6.6 `GenericHttpConnector` — Full Implementation

```typescript
// service-connectors/connectors/generic-http.connector.ts
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';
import { ServiceConnector, ExternalPlan, CreateExternalPlanInput, UpdateExternalPlanInput } from './connector.interface';

export class GenericHttpConnector implements ServiceConnector {
  readonly platform: string;
  private readonly http: AxiosInstance;

  constructor(private readonly client: { name: string; apiKey: string; billingApiUrl: string }) {
    this.platform = client.name;
    this.http = axios.create({
      baseURL: `${client.billingApiUrl}/api/v1`,
      timeout: 8000,
      headers: {
        'Content-Type': 'application/json',
        'x-mcom-solution-api-key': client.apiKey,
      },
    });
  }

  async createPlan(input: CreateExternalPlanInput): Promise<ExternalPlan> {
    return this.call(() => this.http.post('/system/plans', input));
  }

  async getPlans(): Promise<ExternalPlan[]> {
    const data = await this.call(() => this.http.get('/system/plans'));
    return Array.isArray(data) ? data : data?.data ?? [];
  }

  async getPlanById(id: string): Promise<ExternalPlan> {
    return this.call(() => this.http.get(`/system/plans/${id}`));
  }

  async updatePlan(id: string, input: UpdateExternalPlanInput): Promise<ExternalPlan> {
    return this.call(() => this.http.patch(`/system/plans/${id}`, input));
  }

  async deletePlan(id: string): Promise<void> {
    await this.call(() => this.http.delete(`/system/plans/${id}`));
  }

  private async call<T>(fn: () => Promise<{ data: T }>): Promise<T> {
    try {
      const { data } = await fn();
      return data;
    } catch (err) {
      if (isAxiosError(err)) {
        const status = err.response?.status ?? HttpStatus.BAD_GATEWAY;
        const message = err.response?.data?.message ?? `${this.platform} API error`;
        throw new HttpException(message, status);
      }
      throw new HttpException(`Failed to reach ${this.platform}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
```

---

## 7. Caching & Performance Architecture

Performance is critical here because the `SsoClient` record is read on **every authenticated request** across the ecosystem.

### 7.1 Multi-Layer Cache Strategy

```
Request
  └─► L1: In-Memory (process-level Map, TTL: 30s)   ← fastest, no network
       └─► L2: Redis (TTL: 300s)                     ← fast, shared across instances
            └─► L3: PostgreSQL                        ← source of truth
```

**L1 cache** — add to `SsoService`:

```typescript
private readonly memCache = new Map<string, { data: SsoClient; exp: number }>();

async getClientByClientId(clientId: string): Promise<SsoClient | null> {
  // L1 check
  const mem = this.memCache.get(clientId);
  if (mem && mem.exp > Date.now()) return mem.data;

  // L2 check (existing Redis logic)
  const cacheKey = `sso_client:${clientId}`;
  const cached = await this.redisService.get<SsoClient>(cacheKey);
  if (cached) {
    this.memCache.set(clientId, { data: cached, exp: Date.now() + 30_000 });
    return cached;
  }

  // L3: DB
  const client = await this.prisma.ssoClient.findUnique({ where: { clientId } });
  if (client) {
    await this.redisService.set(cacheKey, client, 300);
    this.memCache.set(clientId, { data: client, exp: Date.now() + 30_000 });
  }
  return client;
}
```

### 7.2 CORS Origins Cache

CORS is configured once at startup. For runtime updates via Console (adding a new origin without restart), we need a middleware-level check:

```typescript
// main.ts — use a closure over a refreshable set
const corsOriginSet = new Set<string>();

async function refreshCorsOrigins(ssoService: SsoService) {
  const origins = await ssoService.getAllCorsOrigins();
  corsOriginSet.clear();
  [...staticOrigins, ...origins].forEach(o => corsOriginSet.add(o));
}

// Refresh on startup
await refreshCorsOrigins(ssoService);

// Refresh every 60 seconds
setInterval(() => refreshCorsOrigins(ssoService), 60_000);

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || corsOriginSet.has(origin)) callback(null, true);
    else callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Mcom-Client-ID', 'ngrok-skip-browser-warning'],
});
```

The `corsOriginSet` is a live Set that refreshes every 60s from Redis → DB. When admin adds a new origin via Console, the CORS cache is invalidated immediately in Redis. Next polling cycle (max 60s) picks it up — no restart needed.

### 7.3 Cache Invalidation Rules

| Trigger | What Gets Invalidated | How |
|---|---|---|
| Admin updates app config | `sso_client:<clientId>`, L1 mem cache entry | `ConsoleService.updateApp()` calls `redis.del()` and clears `memCache` |
| Admin rotates any secret | `sso_client:<clientId>`, L1 mem cache entry | Same |
| Admin adds/removes CORS origin | `cors:all_origins` Redis key | `ConsoleService.invalidateCorsCache()` |
| Admin deactivates app | `sso_client:<clientId>`, all SSO sessions for this client | Cascade delete sessions + cache clear |

### 7.4 DB Index Recommendations

```sql
-- Run these if not already present
CREATE INDEX CONCURRENTLY idx_sso_client_platform_slug ON "SsoClient" ("platformSlug") WHERE "platformSlug" IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_sso_client_is_active ON "SsoClient" ("isActive");
CREATE INDEX CONCURRENTLY idx_webhook_log_client_created ON "AppWebhookLog" ("clientId", "createdAt" DESC);
CREATE INDEX CONCURRENTLY idx_console_audit_created ON "ConsoleAuditLog" ("createdAt" DESC);
```

### 7.5 HTTP Connector Timeout & Retry

The `GenericHttpConnector` talks to third-party apps. Those apps may be slow or down. Configure defensively:

```typescript
this.http = axios.create({
  baseURL: `${client.billingApiUrl}/api/v1`,
  timeout: 8000,          // 8s hard timeout — never block main thread longer
});
```

Do **not** retry inside the connector. Let the caller (ConsoleService or ServiceConnectorsService) decide retry policy. Fail fast and return 502 to the admin UI.

---

## 8. Security Model — Everything the Engineer Needs

### 8.1 Secret Storage Matrix

| Secret | Stored As | Where | Retrievable After Creation? |
|---|---|---|---|
| `clientSecret` | bcrypt hash (`$2b$12$...`) | `SsoClient.clientSecret` (DB) | No. Only verifiable. Admin must rotate. |
| `apiKey` | Plain string | `SsoClient.apiKey` (DB) | Masked in UI (`ak_****`). Admin can rotate. |
| `hmacSecret` | AES-256-GCM encrypted | `SsoClient.hmacSecret` (DB) | No. Shown once, then masked. Admin must rotate. |
| `webhookSecret` | AES-256-GCM encrypted | `SsoClient.webhookSecret` (DB) | No. Same rules. |

### 8.2 Encryption for HMAC & Webhook Secrets

Add to `.env`:
```env
CONSOLE_ENCRYPTION_KEY="32-bytes-hex-string-here"  # openssl rand -hex 32
```

```typescript
// console/crypto.util.ts
import * as crypto from 'crypto';

const ALG = 'aes-256-gcm';

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + tag.toString('hex') + encrypted.toString('hex');
}

export function decrypt(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(encoded.slice(0, 24), 'hex');
  const tag = Buffer.from(encoded.slice(24, 56), 'hex');
  const ciphertext = Buffer.from(encoded.slice(56), 'hex');
  const decipher = crypto.createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
```

### 8.3 Console API Authorization

Every Console endpoint must pass **two** checks:

```typescript
// console-admin.guard.ts
@Injectable()
export class ConsoleAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();
    if (req.user.role !== 'ADMIN') throw new ForbiddenException('ADMIN role required');
    return true;
  }
}
```

Apply with `@UseGuards(JwtAuthGuard, ConsoleAdminGuard)` on the controller class-level.

### 8.4 Rate Limiting on Console Endpoints

Console endpoints are admin-only but still need rate limiting to prevent accidental hammering and brute-force secret exposure:

```typescript
// Install: pnpm add @nestjs/throttler
// In ConsoleModule:
ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])
// 30 requests per minute per admin user. Secret rotation endpoints get tighter limits.
```

For secret rotation specifically:
```typescript
@Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 rotations per minute
@Post('apps/:clientId/rotate-secret')
```

### 8.5 HMAC Verification (Exact Implementation)

```typescript
// data-sharing/hmac.util.ts
import * as crypto from 'crypto';

export function verifyHmac(
  body: string | Buffer,
  receivedSig: string,
  secret: string,
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Use timingSafeEqual to prevent timing attacks
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(receivedSig.replace(/^sha256=/, ''), 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
```

Partner apps must send: `X-Mcom-Signature: sha256=<hmac-hex>` + `X-Mcom-Client-ID: <clientId>`.

### 8.6 Redirect URI Validation Rules

When an admin registers or updates redirect URIs, enforce:

```typescript
function validateRedirectUri(uri: string): void {
  const url = new URL(uri); // throws if malformed

  // Disallow open redirects
  if (uri.includes('..')) throw new BadRequestException('Relative paths not allowed in redirect URI');

  // Allow localhost only if not production
  if (url.hostname === 'localhost' && process.env.NODE_ENV === 'production') {
    // Log a warning — don't block, but flag it
  }

  // Must be https in production
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new BadRequestException('Redirect URI must use HTTPS in production');
  }
}
```

### 8.7 Audit Trail — What Must Be Logged

Every write action on the Console must be recorded in `ConsoleAuditLog`:

| Action | `action` field value | `changes` content |
|---|---|---|
| Register app | `"register_app"` | Full new record (secrets masked) |
| Update app | `"update_app"` | `{ before: {...}, after: {...} }` |
| Deactivate app | `"deactivate_app"` | `{ clientId, name }` |
| Rotate client secret | `"rotate_client_secret"` | `{ clientId, rotatedAt }` |
| Rotate API key | `"rotate_api_key"` | `{ clientId, rotatedAt }` |
| Rotate HMAC secret | `"rotate_hmac_secret"` | `{ clientId, rotatedAt }` |
| Rotate webhook secret | `"rotate_webhook_secret"` | `{ clientId, rotatedAt }` |

```typescript
// In ConsoleService — helper
private async audit(adminId: string, clientId: string, action: string, changes?: object, req?: Request) {
  await this.prisma.consoleAuditLog.create({
    data: {
      adminId,
      clientId,
      action,
      changes: changes ?? {},
      ip: req?.ip ?? null,
      userAgent: req?.headers['user-agent'] ?? null,
    },
  });
}
```

### 8.8 `isSystemApp` Protection

System apps (`mcom-mall`, `mcom-loyalty`, `247gbs`) must never be accidentally deleted or deactivated via the Console. Guard this at service level:

```typescript
async deactivateApp(clientId: string) {
  const app = await this.prisma.ssoClient.findUnique({ where: { clientId } });
  if (!app) throw new NotFoundException();
  if (app.isSystemApp) throw new ForbiddenException('System apps cannot be deactivated via Console. Edit the seed configuration instead.');
  // ... proceed
}
```

### 8.9 Secret Displayed Only Once

When `registerApp()` or any `rotate*()` method returns, it includes the plain secret. The controller returns it to the frontend. **The frontend must display this in a non-dismissible modal with "I have copied this" confirmation before allowing navigation away.** The plain secret is never stored — after the HTTP response, it's gone.

---

## 9. Input Validation Rules

| Field | Rule | Error Message |
|---|---|---|
| `clientId` | `/^[a-z0-9-]+$/`, 3-50 chars, unique | "Client ID must be lowercase alphanumeric with hyphens" |
| `platformSlug` | `/^[a-z0-9_]+$/`, 2-30 chars, unique | "Platform slug must be lowercase alphanumeric with underscores" |
| `name` | 3-80 chars | "Name must be between 3 and 80 characters" |
| `redirectUris` | Valid URL, HTTPS in prod, max 20, no wildcards | "Invalid redirect URI" |
| `corsOrigins` | Valid URL, scheme + hostname only (no path), max 20 | "CORS origin must be scheme + hostname only, e.g. https://app.com" |
| `billingApiUrl` | Valid URL, reachable (optional ping) | "Billing API URL is not reachable" |
| `scopes` | From allowed list: `profile`, `email`, `business`, `membership`, `packages` | "Invalid scope" |
| `webhookUrl` | Valid URL, HTTPS, max 200 chars | "Webhook URL must be HTTPS" |

Apply all via NestJS `class-validator` decorators on the DTO. Enable `whitelist: true` and `forbidNonWhitelisted: true` globally (already done in `main.ts`).

---

## 10. Error Handling Patterns

### 10.1 Backend Error Responses

All errors follow the existing NestJS exception format. No new format needed.

| Scenario | Exception | HTTP Code |
|---|---|---|
| `clientId` already exists | `ConflictException` | 409 |
| App not found | `NotFoundException` | 404 |
| Deactivate system app | `ForbiddenException` | 403 |
| Non-admin access | `ForbiddenException` | 403 |
| Invalid DTO fields | `BadRequestException` (auto) | 400 |
| billingApiUrl unreachable | `BadGatewayException` | 502 |
| DB timeout | `ServiceUnavailableException` | 503 |

### 10.2 Frontend Error Handling

```typescript
// In ConsolePanel API calls
try {
  const result = await registerApp(dto);
  // Show one-time credentials modal
} catch (err) {
  if (err.status === 409) toast.error('An app with this Client ID already exists');
  else if (err.status === 403) toast.error('You need ADMIN access');
  else toast.error('Registration failed. Please try again.');
}
```

### 10.3 Webhook Delivery Failures

When McomSolutions tries to deliver a webhook to a registered app and it fails:

1. Log to `AppWebhookLog` with `failed: true`.
2. Increment `SsoClient.webhookFailCount`.
3. After 10 consecutive failures, send an admin notification.
4. Never block the original user action for webhook failures — webhooks are fire-and-forget.

---

## 11. Frontend — Mcom Console UI

### 11.1 New Admin Tab

In [`AdminDashboard.tsx`](file:///C:/Users/Azeem/Documents/github/Mcom/McomSolutions/apps/frontend/src/pages/AdminDashboard.tsx):

```typescript
// Add to ADMIN_TABS array:
'console'

// Add to getTabInfo map:
'console': { title: 'Mcom Console', subtitle: 'Register and manage ecosystem applications' }

// Add to renderPanel switch:
case 'console':
  return <ConsolePanel />;
```

### 11.2 File Structure for Console UI

```
apps/frontend/src/components/admin/console/
  ConsolePanel.tsx          ← main panel (list view + routing)
  AppList.tsx               ← table of registered apps
  AppDetail.tsx             ← credentials + config view
  RegisterAppModal.tsx      ← registration form
  CredentialsSuccess.tsx    ← one-time secret display modal
  AppHealthBadge.tsx        ← ping status indicator
  hooks/
    useConsoleApps.ts       ← fetch + mutation hooks
    useAppHealth.ts
  api/
    console.api.ts          ← axios calls to /admin/console/*
```

### 11.3 Screen Map

#### View A — App Registry List

```
┌────────────────────────────────────────────────────────────────────┐
│  Mcom Console                          [+ Register New Application]│
│  Manage platform integrations. Each app gets its own credentials.  │
├──────────┬────────────────┬────────────┬──────────┬───────────────┤
│ Client ID│ Name           │ Status     │ Platform │ Actions        │
├──────────┼────────────────┼────────────┼──────────┼───────────────┤
│ mcom-mall│ MCOM Mall      │ ● Active   │ mall     │[Manage][···]   │
│mcom-loyal│ MCOM Loyalty   │ ● Active   │ rewards  │[Manage][···]   │
│  247gbs  │ 247GBS         │ ● Active   │ gbs      │[Manage][···]   │
│mcom-vcard│ Mcom vCard     │ ● Active   │ vcard    │[Manage][···]   │
│mcom-spin │ Mcom Spin      │ ○ Inactive │ spin     │[Manage][···]   │
└──────────┴────────────────┴────────────┴──────────┴───────────────┘
```

#### View B — App Detail (click "Manage")

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Back to Apps                                                     │
│ Mcom vCard                              ● Active   [Disable App]   │
├───────────────────────────┬────────────────────────────────────────┤
│ CREDENTIALS               │ CONFIGURATION                          │
│                           │                                        │
│ Client ID                 │ App Name                               │
│ mcom-vcard         [Copy] │ [Mcom vCard                        ]   │
│                           │                                        │
│ Client Secret             │ Description                            │
│ ••••••••••••••••   [Copy] │ [Digital vCard platform...         ]   │
│                   [🔄 Rotate]                                      │
│                           │ App Frontend URL                       │
│ API Key                   │ [https://vcard.mcom.com            ]   │
│ ••••••••••••••••   [Copy] │                                        │
│                   [🔄 Rotate]                                      │
│                           │ Billing API URL                        │
│ HMAC Secret               │ [https://api.vcard.mcom.com        ]   │
│ ••••••••••••••••   [Copy] │                                        │
│                   [🔄 Rotate]                                      │
│                           │ Platform Slug                          │
│ Webhook Secret            │ [vcard                             ]   │
│ ••••••••••••••••   [Copy] │                                        │
│                   [🔄 Rotate]                                      │
│                           │ Scopes                                 │
│ Health                    │ [profile ×] [email ×] [business ×]     │
│ billingApiUrl: ● 142ms    │ [+ Add Scope]                          │
│                           │                                        │
│                           │ Redirect URIs                          │
│                           │ [https://vcard.mcom.com/auth/cb ×]     │
│                           │ [+ Add URI]                            │
│                           │                                        │
│                           │ CORS Origins                           │
│                           │ [https://vcard.mcom.com ×]             │
│                           │ [+ Add Origin]                         │
│                           │                                        │
│                           │ Webhook URL                            │
│                           │ [https://api.vcard.mcom.com/hooks  ]   │
│                           │              [Save Changes]            │
├───────────────────────────┴────────────────────────────────────────┤
│ INTEGRATION QUICKSTART                                             │
│ Add these to your app's .env file:                  [Copy All]    │
│                                                                    │
│ MCOM_SOLUTIONS_URL=https://api.mcomsolutions.com                  │
│ MCOM_CLIENT_ID=mcom-vcard                                         │
│ MCOM_CLIENT_SECRET=<rotate to reveal>                             │
│ MCOM_API_KEY=<rotate to reveal>                                   │
│ MCOM_HMAC_SECRET=<rotate to reveal>                               │
├────────────────────────────────────────────────────────────────────┤
│ AUDIT LOG (last 10 events)                                        │
│ 2026-08-25 18:30  admin@mcom.com  rotate_api_key                  │
│ 2026-08-24 14:12  admin@mcom.com  update_app  (corsOrigins added) │
└────────────────────────────────────────────────────────────────────┘
```

#### View C — Register New App Modal

```
┌────────────────────────────────────────────────────────────────────┐
│ Register New Application                                    [✕]   │
├────────────────────────────────────────────────────────────────────┤
│ App Name *              [Mcom vCard                            ]   │
│ Client ID *             [mcom-vcard] (auto-generated, editable)    │
│ Platform Slug *         [vcard     ] → canAccess_vcard permission  │
│ Description             [Business card platform...             ]   │
│                                                                    │
│ App Frontend URL        [https://vcard.mcom.com                ]   │
│ Billing API URL         [https://api.vcard.mcom.com            ]   │
│  (optional — needed for plan management)                           │
│                                                                    │
│ Redirect URIs *         [https://vcard.mcom.com/auth/callback  ]   │
│                         [+ Add Redirect URI]                       │
│                                                                    │
│ CORS Origins *          [https://vcard.mcom.com                ]   │
│                         [+ Add Origin]                             │
│                                                                    │
│ Scopes *                [✓] profile  [✓] email  [✓] business       │
│                         [ ] membership  [ ] packages               │
│                                                                    │
│ Webhook URL             [https://api.vcard.mcom.com/webhooks   ]   │
│  (optional — receive ecosystem events)                             │
│                                                                    │
│                              [Cancel]  [Register Application →]   │
└────────────────────────────────────────────────────────────────────┘
```

#### View D — One-Time Credentials (shown ONCE after registration)

```
┌────────────────────────────────────────────────────────────────────┐
│ ✅ Application Registered Successfully                             │
│                                                                    │
│  ⚠️ These credentials will only be shown ONCE.                    │
│  Copy them now and store them securely.                           │
├────────────────────────────────────────────────────────────────────┤
│  Client ID                                                         │
│  mcom-vcard                                              [Copy]   │
│                                                                    │
│  Client Secret                                                     │
│  cs_a3f2b1c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9  [Copy]  │
│                                                                    │
│  API Key                                                           │
│  ak_1234567890abcdef1234567890abcdef123456              [Copy]   │
│                                                                    │
│  HMAC Secret                                                       │
│  hm_fedcba9876543210fedcba9876543210fedcba9876543210    [Copy]   │
│                                                                    │
│  Webhook Secret                                                    │
│  wh_abcdef1234567890abcdef1234567890abcdef123456        [Copy]   │
│                                                                    │
│  ─────────────────────────────────────────────────────────────    │
│  .env Quickstart                                        [Copy All]│
│                                                                    │
│  MCOM_SOLUTIONS_URL=https://api.mcomsolutions.com                 │
│  MCOM_CLIENT_ID=mcom-vcard                                        │
│  MCOM_CLIENT_SECRET=cs_a3f2b1c8...                               │
│  MCOM_API_KEY=ak_1234567890...                                    │
│  MCOM_HMAC_SECRET=hm_fedcba98...                                  │
│  MCOM_WEBHOOK_SECRET=wh_abcdef12...                              │
│                                                                    │
│  [ ] I have copied and securely stored these credentials          │
│                                    [Close]  ← enabled after check │
└────────────────────────────────────────────────────────────────────┘
```

---

## 12. New App Integration Guide (What the Consumer Dev Does)

Once the Console registers the app, the developer of the new app (e.g. Mcom vCard) needs to do the following. This guide should be published as internal developer documentation.

### Step 1 — Receive credentials from admin

Admin sends 5 env values (copied from the one-time credentials screen):

```env
# Paste these into .env of the new app (e.g. mcom-vcard-api/.env)
MCOM_SOLUTIONS_URL=https://api.mcomsolutions.com
MCOM_CLIENT_ID=mcom-vcard
MCOM_CLIENT_SECRET=cs_xxxx...
MCOM_API_KEY=ak_xxxx...
MCOM_HMAC_SECRET=hm_xxxx...
```

### Step 2 — Implement the SSO login redirect

When a user hits "Login" on the new app:

```typescript
// GET /login → redirect to McomSolutions SSO
const state = crypto.randomBytes(16).toString('hex');
req.session.oauthState = state; // store to validate on callback

const ssoUrl = new URL(`${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/authorize`);
ssoUrl.searchParams.set('client_id', MCOM_CLIENT_ID);
ssoUrl.searchParams.set('redirect_uri', 'https://vcard.mcom.com/auth/callback');
ssoUrl.searchParams.set('state', state);
ssoUrl.searchParams.set('scope', 'profile email business');

res.redirect(ssoUrl.toString());
```

### Step 3 — Handle the callback

```typescript
// GET /auth/callback?code=xxx&state=yyy
const { code, state } = req.query;

// Validate state to prevent CSRF
if (state !== req.session.oauthState) throw new Error('State mismatch');

// Exchange code for tokens (server-side call — never expose clientSecret to browser)
const { data: tokens } = await axios.post(
  `${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token`,
  {
    code,
    client_id: MCOM_CLIENT_ID,
    client_secret: MCOM_CLIENT_SECRET,
    redirect_uri: 'https://vcard.mcom.com/auth/callback',
  },
  { headers: { 'Content-Type': 'application/json' } }
);

// tokens.accessToken, tokens.refreshToken, tokens.user
// Store in session or issue your own JWT from here
```

### Step 4 — Fetch user profile (optional — if you need more than the token payload)

```typescript
const { data: userInfo } = await axios.get(
  `${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/userinfo`,
  { headers: { Authorization: `Bearer ${tokens.accessToken}` } }
);
// userInfo.packages[].platformName tells you what the user has access to
// userInfo.membershipLevel, membershipStatus, etc.
```

### Step 5 — Refresh the token

```typescript
const { data } = await axios.post(
  `${MCOM_SOLUTIONS_URL}/api/v1/auth/sso/token/refresh`,
  { refresh_token: storedRefreshToken }
);
// data.accessToken = new access token
```

### Step 6 — (Optional) Verify user has access to your platform

```typescript
// The userInfo.packages array includes all purchased packages.
// Check if user has an active package for your platform:
const hasAccess = userInfo.packages.some(
  pkg => pkg.platformName.toLowerCase() === 'vcard' && pkg.status === 'active'
);
// OR use the permissions object:
const hasAccess = userInfo.permissions?.canAccess_vcard === true;
```

### Step 7 — (Optional) Implement the Billing API contract

If you want McomSolutions admin to be able to manage plans for your app:

```typescript
// In your app's backend — protect with the API key
// middleware
app.use('/api/v1/system/plans', (req, res, next) => {
  const key = req.headers['x-mcom-solution-api-key'];
  if (key !== process.env.MCOM_API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// Routes to implement:
// POST   /api/v1/system/plans
// GET    /api/v1/system/plans
// GET    /api/v1/system/plans/:id
// PATCH  /api/v1/system/plans/:id
// DELETE /api/v1/system/plans/:id
```

Response shape must match `ExternalPlan` from `connector.interface.ts`.

### Step 8 — (Optional) Verify incoming webhooks

When McomSolutions sends a webhook to your `webhookUrl`:

```typescript
// POST /webhooks (in new app)
app.post('/webhooks', (req, res) => {
  const sig = req.headers['x-mcom-signature']; // "sha256=<hex>"
  const body = req.rawBody; // important: use raw body string

  const expected = crypto
    .createHmac('sha256', MCOM_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(sig.replace('sha256=', ''), 'hex'),
    Buffer.from(expected, 'hex')
  )) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body; // { type: "user.registered", data: {...} }
  // Handle event...
  res.json({ received: true });
});
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

**`ConsoleService`** — mock `PrismaService`, `RedisService`, `ConfigService`:
- `registerApp()`: generates unique secrets, hashes clientSecret, encrypts hmacSecret, logs to audit.
- `deactivateApp()`: blocks system apps, soft-deletes, invalidates cache.
- `rotateClientSecret()`: new hash stored, old cache purged, audit logged.
- `getAllCorsOrigins()`: returns flattened unique origins.

**`GenericHttpConnector`** — mock axios:
- Maps response correctly to `ExternalPlan` shape.
- Throws `HttpException(502)` on ECONNREFUSED.
- Throws `HttpException(status)` on API error response.

**`calculatePermissions()`**:
- Returns all 5 old keys for every input (backward compat assertion).
- Returns `canAccess_vcard: true` when vcard package is active.
- Returns `canAccess_vcard: false` when package is inactive.
- ADMIN role returns all-true (old and new keys).

**`verifyHmac()`**:
- Correct HMAC → returns true.
- Wrong HMAC → returns false (not throws).
- Timing-safe: no short-circuit on prefix match.

### 13.2 Integration Tests

- Register app via `POST /admin/console/apps` → verify DB record, audit log, returned credentials.
- CORS origins added via console → `getAllCorsOrigins()` returns new origins within 60s.
- HMAC verification with per-client DB secret → succeeds.
- HMAC verification with no `X-Mcom-Client-ID` header → falls back to global secret → succeeds.
- Connector factory for new DB-registered app → returns `GenericHttpConnector`.
- Connector factory for `'MCOM Mall'` → returns `McomMallConnector` (no DB hit).

### 13.3 Regression Tests (Backward Compatibility)

These must pass **without modification** after implementation:

- Existing SSO flow (`/auth/sso/authorize` → `/auth/sso/token`) for `mcom-mall`.
- Existing data-sharing HMAC with global `SSO_API_SECRET`.
- `calculatePermissions()` returns `canAccessMall: boolean` for a business with `mall` package.
- `ConnectorFactory.getConnector('MCOM Mall')` does not hit the database.
- All seeded clients still have `isActive: true` after migration.

---

## 14. Deployment Checklist

> Run through this before and after every phase deployment.

### Before First Deployment

- [ ] `CONSOLE_ENCRYPTION_KEY` is set in production `.env` (32-byte hex).
- [ ] `CONSOLE_ENCRYPTION_KEY` is stored in your secrets manager (not just `.env` file).
- [ ] Prisma migration reviewed: no `DROP`, no `NOT NULL` without default on existing column.
- [ ] Migration tested on a database backup/clone first.
- [ ] Redis is running and reachable.
- [ ] `seedDefaultSsoClients()` runs on startup and creates expected records (test in staging).

### After Each Phase

- [ ] All existing SSO flows tested end-to-end.
- [ ] Admin login and existing admin tabs still work.
- [ ] CORS headers correct for existing apps (check network tab on Mcom Mall, Mcom Rewards).
- [ ] Data-sharing HMAC still works for existing callers.
- [ ] No new lint errors. `pnpm build` passes (without running in dev).

### Phase 5+ (Console UI Deployed)

- [ ] Console tab visible only to ADMIN role.
- [ ] Non-admin user gets 403 from all `/admin/console/*` API calls.
- [ ] Credentials modal cannot be dismissed without checkbox confirmation.
- [ ] Secret values are masked in all API list/detail responses.
- [ ] Audit log records every Console action.

---

## 15. Implementation Execution Order

Each phase is independently deployable. Deploy Phase 1 before starting Phase 2.

### Phase 1 — Data Model & Console Backend
1. Add `CONSOLE_ENCRYPTION_KEY` to `.env.example` and production secrets.
2. Write Prisma migration — new optional fields on `SsoClient`, `AppWebhookLog`, `ConsoleAuditLog`.
3. Run migration on staging, verify no data loss.
4. Create `console/console.module.ts`, `console.service.ts`, `console.controller.ts`.
5. Implement `ConsoleService` — all CRUD + rotation methods.
6. Implement `crypto.util.ts` (encrypt/decrypt).
7. Write unit tests for `ConsoleService`.
8. Register `ConsoleModule` in `AppModule`.
9. Deploy to staging. Test all endpoints via Swagger.

### Phase 2 — Dynamic CORS & HMAC
1. Add `getAllCorsOrigins()` to `SsoService`.
2. Update `main.ts` to use closure-based dynamic CORS with 60s polling.
3. Update `DataSharingGuard` with 3-tier HMAC fallback.
4. Write integration tests for HMAC fallback chain.
5. Deploy to staging. Verify existing Mcom Mall + Mcom Rewards calls work unmodified.

### Phase 3 — Generic HTTP Connector
1. Create `generic-http.connector.ts`.
2. Update `ConnectorFactory.getConnector()` with DB fallback (keep switch-case for named connectors).
3. Unit test: named connector lookup does not hit DB.
4. Deploy to staging. Verify `'MCOM Mall'` and `'MCOM Rewards'` connectors work unchanged.

### Phase 4 — Dynamic Permissions
1. Update `calculatePermissions()` with dynamic slug keys + backward-compat aliases.
2. Update `getUserInfoFromToken()` to include full permissions object.
3. Regression test: `canAccessMall`, `canAccessRewards`, etc. still present in all API responses.
4. Deploy to staging.

### Phase 5 — Console Frontend
1. Add `console` to `ADMIN_TABS` in `AdminDashboard.tsx`.
2. Build `ConsolePanel`, `AppList`, `AppDetail`, `RegisterAppModal`, `CredentialsSuccess`.
3. Build `useConsoleApps` hooks.
4. Build `console.api.ts` (all API calls).
5. Test all views: list, detail, register, rotate secret.
6. Deploy to staging. Test as ADMIN and non-ADMIN role.

### Phase 6 — Dynamic Platform Launcher
1. Add `fetchRegisteredApps()` to `DashboardAllProducts.tsx`.
2. Merge API results with static `ALL_PLATFORMS[]` fallback.
3. Deploy. Verify existing platform cards unchanged, newly registered apps appear.

### Phase 7 — First New App Integration
1. Register "Mcom vCard" via Console → copy credentials.
2. Add env vars to vCard app.
3. Implement SSO redirect and callback.
4. Verify end-to-end SSO flow for vCard.
5. (Optional) Implement billing API contract on vCard side.
6. Document lessons learned. Update integration guide if needed.

---

## 16. Future Extensions

| Feature | Description | Dependencies |
|---|---|---|
| Webhook delivery engine | Background queue that POSTs lifecycle events (`user.registered`, `package.created`, `subscription.cancelled`) to each app's `webhookUrl`. | Bull/BullMQ + Redis |
| App health dashboard | Console UI widget showing last-ping status, latency, and uptime for each app's `billingApiUrl`. | `AppHealthBadge` component + cron job |
| Per-app rate limiting | Admin sets RPM limits per `clientId`. Enforced at API gateway or NestJS throttler. | `metadata` JSON field on `SsoClient` |
| Consent screen customization | Admin customises what the SSO login/consent page shows per app (logo, scopes description). | New `consentConfig` JSON field |
| App versioning | Track which version of the integration contract each app is on. Alert when a breaking change is published. | `apiVersion` field |
| Delegate admin | Allow app owners (not just MCOM super-admins) to manage their own app's config. | New `AppAdmin` role + row-level security |
| Terraform/IaC export | Export all registered apps as Terraform config or JSON for disaster recovery. | ConsoleService.exportAll() |

---

## Summary Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MCOM SOLUTIONS (Central Hub)                     │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                    Mcom Console (Admin UI)                     │   │
│  │  Register App → Issue Credentials → Manage → Rotate → Audit   │   │
│  └────────────────────────────┬──────────────────────────────────┘   │
│                               │ write                                │
│  ┌────────────────────────────▼──────────────────────────────────┐   │
│  │              SsoClient Table (PostgreSQL)                      │   │
│  │  clientId, clientSecret(hash), apiKey, hmacSecret(enc),        │   │
│  │  corsOrigins[], redirectUris[], billingApiUrl, platformSlug    │   │
│  └────┬───────────────┬──────────────────────┬────────────────────┘  │
│       │               │                      │                        │
│  ┌────▼────┐  ┌────────▼──────┐   ┌──────────▼──────────┐           │
│  │  SSO /  │  │  CORS Origins │   │  Connector Factory   │           │
│  │  OAuth  │  │  (dynamic,    │   │  ① named connectors  │           │
│  │ (OAuth  │  │   60s cache)  │   │  ② DB generic HTTP   │           │
│  │  flow)  │  └───────────────┘   └──────────┬──────────┘           │
│  └────┬────┘                                 │                        │
│       │  L1 mem → L2 Redis → L3 DB           │                        │
│  ┌────▼────────────────────────────────────────────────────────────┐  │
│  │                   Redis Cache Layer                              │  │
│  │   sso_client:<id>, cors:all_origins, connector_client:<name>    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
         │                                     │
┌────────▼──────────┐                 ┌────────▼──────────────────┐
│  Existing Apps    │                 │  New Apps (zero code       │
│  mcom-mall        │                 │  change to McomSolutions)  │
│  mcom-loyalty     │                 │  mcom-vcard               │
│  247gbs           │                 │  mcom-spin                │
│  (named connector)│                 │  mcom-anything            │
│                   │                 │  (generic HTTP connector)  │
└───────────────────┘                 └───────────────────────────┘
```

---

*Document Author: Antigravity (Senior Systems Design Review)*  
*Date: August 2026*  
*Status: Ready for Engineering Implementation*

---

## 17. Dynamic Memberships & Packages Page

### 17.1 The Problem Today

`/admin/memberships` (`PlanManagementPanel.tsx`) hard-codes the platforms it manages:

```typescript
// PlanManagementPanel.tsx — CURRENT (hard-coded, must change)
const MALL_PLATFORM = 'MCOM Mall';
const REWARDS_PLATFORM = 'MCOM Rewards';
```

And `getSupportedPlatforms()` in `AdminOpsService` returns a **static array**:

```typescript
// admin-ops.service.ts — CURRENT (static, must change)
private static readonly EXTERNAL_PLATFORMS = [
  'MCOM Mall', 'MCOM Rewards', 'MCOM Spin', 'GBS Audit', 'GBS Expo',
];
getSupportedPlatforms() {
  return { success: true, data: AdminOpsService.EXTERNAL_PLATFORMS };
}
```

This means every time a new app is registered via the Console, an engineer must:
1. Edit the `EXTERNAL_PLATFORMS` static list.
2. Add a new `const NEWAPP_PLATFORM = '...'` constant in `PlanManagementPanel.tsx`.
3. Add a new rendered section in the JSX.

**Goal**: When an admin registers a new app in `/admin/console` with a `billingApiUrl`, it should automatically appear as a manageable platform in `/admin/memberships` — **zero code changes**.

---

### 17.2 Backend: Make `getSupportedPlatforms` Dynamic

#### 17.2.1 Update `getSupportedPlatforms()` in `AdminOpsService`

The method currently returns the hard-coded array. Replace it with a DB query that merges the static named-connector platforms (MCOM Mall, MCOM Rewards — which must always appear) with any Console-registered apps that have a `billingApiUrl`.

```typescript
// admin-ops.service.ts — UPDATED
// Inject ServiceConnectorsService to get named platform names
constructor(
  private readonly prisma: PrismaService,
  private readonly connectorsService: ServiceConnectorsService,  // ADD
) {}

// Named platforms that always exist (regardless of SsoClient records)
private static readonly NAMED_PLATFORMS = ['MCOM Mall', 'MCOM Rewards'];

async getSupportedPlatforms(): Promise<{ success: boolean; data: PlatformInfo[] }> {
  // Named platforms — always first
  const named: PlatformInfo[] = AdminOpsService.NAMED_PLATFORMS.map(name => ({
    name,
    clientId: null,
    isNamed: true,         // Has a dedicated connector class (not generic HTTP)
    hasBillingApi: true,
  }));

  // DB-registered apps with a billingApiUrl
  const dbApps = await this.prisma.ssoClient.findMany({
    where: { isActive: true, billingApiUrl: { not: null } },
    select: { name: true, clientId: true, billingApiUrl: true },
    orderBy: { name: 'asc' },
  });

  const dynamic: PlatformInfo[] = dbApps
    .filter(app => !AdminOpsService.NAMED_PLATFORMS.includes(app.name)) // avoid duplicates
    .map(app => ({
      name: app.name,
      clientId: app.clientId,
      isNamed: false,
      hasBillingApi: true,
      billingApiUrl: app.billingApiUrl!,
    }));

  return { success: true, data: [...named, ...dynamic] };
}
```

> **Backward compatibility**: The named platforms (`MCOM Mall`, `MCOM Rewards`) always appear first, exactly as before. New apps only appear after they have a registered `billingApiUrl`.

#### 17.2.2 `PlatformInfo` Type (add to `connector.interface.ts` or a shared types file)

```typescript
export interface PlatformInfo {
  name: string;           // Display name, used as the connector lookup key
  clientId: string | null;
  isNamed: boolean;       // true = has dedicated connector, false = GenericHttpConnector
  hasBillingApi: boolean;
  billingApiUrl?: string;
}
```

#### 17.2.3 Update `AdminOpsModule` to import `ServiceConnectorsModule`

```typescript
// admin.module.ts — add import
@Module({
  imports: [ServiceConnectorsModule], // ADD — so AdminOpsService can inject ConnectorFactory
  ...
})
```

---

### 17.3 Frontend: Make `PlanManagementPanel` Dynamic

#### 17.3.1 Replace Hard-Coded Constants with `useSupportedPlatforms()`

The hook `useSupportedPlatforms()` already exists in `hooks.ts` and calls `GET /admin/packages/external/platforms`. Once the backend returns `PlatformInfo[]` instead of `string[]`, update the hook's return type and use it to drive the UI.

```typescript
// PlanManagementPanel.tsx — UPDATED
import { useSupportedPlatforms, useExternalPlans, ... } from '../../services/admin/hooks';

export default function PlanManagementPanel() {
  // Fetch all registered platforms dynamically
  const { data: platformsRes, isLoading: platformsLoading } = useSupportedPlatforms();
  const platforms: PlatformInfo[] = platformsRes?.data ?? [];

  // ... rest of state
}
```

#### 17.3.2 Render Platform Sections Dynamically

Instead of two hard-coded sections (Mall and Rewards), render one generic `PlatformPlansSection` per platform:

```tsx
// In the "packages" tab render
{tab === 'packages' && (
  <div>
    {platformsLoading ? (
      <div className="flex items-center justify-center py-8 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading platforms...
      </div>
    ) : (
      platforms.map(platform => (
        <PlatformPlansSection
          key={platform.name}
          platform={platform}
        />
      ))
    )}
    {/* Local packages (non-platform) */}
    <LocalPackagesSection ... />
  </div>
)}
```

#### 17.3.3 `PlatformPlansSection` — Generic Platform Component

Create a new shared component that replaces the duplicated `MCOM Mall` / `MCOM Rewards` sections:

```tsx
// components/admin/PlatformPlansSection.tsx
import { useState } from 'react';
import { ExternalLink, Plus, Loader2, Edit3, Trash2 } from 'lucide-react';
import { useExternalPlans, useCreateExternalPlan, useUpdateExternalPlan, useDeleteExternalPlan } from '../../services/admin/hooks';
import type { PlatformInfo } from '../../services/admin/types';

export function PlatformPlansSection({ platform }: { platform: PlatformInfo }) {
  const { data: plansRes, isLoading } = useExternalPlans(platform.name);
  const plans = plansRes?.data ?? [];
  const [showAdd, setShowAdd] = useState(false);
  // ... modal state

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-brand-blue" />
          {platform.name}
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {platform.isNamed ? 'via API' : 'via Console'}
          </span>
        </h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-brand-blue text-white rounded-xl font-bold text-xs hover:bg-blue-600 transition-all shadow-glow flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create Plan
        </button>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading {platform.name} plans...
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
          <ExternalLink className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No plans on {platform.name} yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <ExternalPlanCard key={plan.id} plan={plan} platform={platform.name} />
          ))}
        </div>
      )}
      {/* Add/edit modals use the generic ExternalPlanFormModal */}
    </div>
  );
}
```

> **Backward compatibility**: MCOM Mall and MCOM Rewards still appear first (from `NAMED_PLATFORMS`). Their plan forms and quota fields are unchanged. The only difference is they're now rendered by the same generic component rather than two bespoke JSX blocks.

#### 17.3.4 Generic `ExternalPlanFormModal`

The current codebase has `MallPlanFormModal` and `RewardsPlanFormModal` — two near-identical components duplicated for each platform. Replace both with a single `ExternalPlanFormModal` that takes a `platformName` prop. The quota/feature-flag fields shown can be driven by a per-platform config object:

```typescript
// In ExternalPlanFormModal.tsx
const PLATFORM_QUOTA_CONFIG: Record<string, QuotaFieldDef[]> = {
  'MCOM Mall': [
    { key: 'maxListings', label: 'Max Listings', unlimited: true },
    { key: 'maxProducts', label: 'Max Products', unlimited: true },
    // ...
  ],
  'MCOM Rewards': [
    { key: 'maxActiveCampaigns', label: 'Max Campaigns', unlimited: true },
    { key: 'maxActiveRewards', label: 'Max Rewards', unlimited: true },
    // ...
  ],
  // New platforms: empty quotas by default, extensible via metadata
  _default: [],
};
```

This way, MCOM Mall and MCOM Rewards retain their rich quota UI. New apps get a simpler form (name, description, pricing, features) that still works with the `ExternalPlan` contract.

---

### 17.4 How It All Connects (End-to-End)

```
Admin registers "Mcom vCard" in /admin/console
  → Sets billingApiUrl = https://api.vcard.mcom.com
  → SsoClient record saved with billingApiUrl

Admin opens /admin/memberships → Packages tab
  → Frontend calls GET /admin/packages/external/platforms
  → AdminOpsService.getSupportedPlatforms() queries SsoClient where billingApiUrl IS NOT NULL
  → Returns [...NAMED_PLATFORMS, { name: 'Mcom vCard', clientId: 'mcom-vcard', isNamed: false }]
  → PlanManagementPanel renders a "Mcom vCard" section automatically

Admin clicks "Create Plan" in the Mcom vCard section
  → Fills name, description, pricing
  → Frontend calls POST /admin/packages/external { platform: 'Mcom vCard', ... }
  → AdminOpsService.createExternalPlan() stores in ExternalPlan table
  → ServiceConnectorsService.createPlan('Mcom vCard', ...) calls ConnectorFactory
  → ConnectorFactory finds 'Mcom vCard' in SsoClient DB → GenericHttpConnector
  → GenericHttpConnector POSTs to https://api.vcard.mcom.com/api/v1/system/plans
     with header: x-mcom-solution-api-key: <vCard's apiKey from SsoClient>
  → vCard backend validates the key → creates plan → returns ExternalPlan
  → Plan appears in the Mcom vCard section
```

**No code changes to McomSolutions needed when adding future apps.**

---

### 17.5 Implementation Steps

1. **Backend**:
   - Add `PlatformInfo` interface to `connector.interface.ts`.
   - Update `getSupportedPlatforms()` in `AdminOpsService` to query `SsoClient` table (additive DB query).
   - Update `admin-ops.controller.ts` return type annotation (no route change).
   - Update `AdminOpsModule` imports to include `ServiceConnectorsModule`.

2. **Frontend**:
   - Update `adminApi.getSupportedPlatforms()` return type to `ApiResponse<PlatformInfo[]>`.
   - Create `PlatformPlansSection.tsx` generic component.
   - Create unified `ExternalPlanFormModal.tsx` with `PLATFORM_QUOTA_CONFIG` map.
   - Update `PlanManagementPanel.tsx` to remove hard-coded `MALL_PLATFORM`/`REWARDS_PLATFORM` constants and render `platforms.map(...)`.

3. **Backward compatibility**: MCOM Mall and MCOM Rewards still render first with the same quota fields. The only visual change is the badge label switches from "via Mall API" to "via API" (or a richer display name can be kept via `isNamed`).

---

## 18. Billing API Security Model

### 18.1 The Two-Directional Security Problem

There are **two distinct request directions** in the plans flow, each needing separate security:

```
Direction A: McomSolutions Admin UI → McomSolutions Backend → Partner App
  (admin manages plans on the partner app)

Direction B: Partner App → McomSolutions Backend
  (partner app uses SSO, data-sharing, webhooks)
```

Section 8 covers Direction B thoroughly. This section covers Direction A.

---

### 18.2 How McomSolutions Authenticates to Partner Apps (Direction A)

When the admin calls `POST /admin/packages/external { platform: 'Mcom vCard', ... }`, the request eventually hits:

```typescript
// GenericHttpConnector — outbound call to partner app
this.http = axios.create({
  baseURL: `${client.billingApiUrl}/api/v1`,
  headers: {
    'x-mcom-solution-api-key': client.apiKey,  // ← The SsoClient.apiKey
  },
});
```

The **`SsoClient.apiKey`** (format: `ak_<hex>`) is used as a **shared secret** that McomSolutions presents to the partner app. This is the same `apiKey` that is shown to the developer in the one-time credentials screen.

**Key properties**:
- Generated once at `registerApp()` time by McomSolutions.
- Stored **plain** in `SsoClient.apiKey` (it must be comparable — it's an API key, not a password).
- Never exposed via list or detail API responses (masked as `ak_****`).
- Can be rotated via `POST /admin/console/apps/:clientId/rotate-api-key` if compromised.
- Transmitted only over HTTPS admin connections.

---

### 18.3 How Partner Apps Must Validate the API Key

When the partner app receives a request to `POST /api/v1/system/plans`, it **must** validate the `x-mcom-solution-api-key` header:

```typescript
// Recommended: NestJS guard on the partner app (example)
@Injectable()
export class McomSolutionsApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-mcom-solution-api-key'];

    // Load from env — set from the one-time credentials screen
    const expectedKey = process.env.MCOM_API_KEY;

    if (!key || !expectedKey) return false;

    // Use timingSafeEqual to prevent timing attacks
    const a = Buffer.from(key);
    const b = Buffer.from(expectedKey);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
}

// Apply on the plans router
@UseGuards(McomSolutionsApiKeyGuard)
@Controller('api/v1/system/plans')
export class SystemPlansController { ... }
```

> **Do NOT use `===` for key comparison** — it is vulnerable to timing attacks. Always use `crypto.timingSafeEqual`.

---

### 18.4 Environment Variables Reference (Partner App Side)

After registering via Console, the partner app's `.env` will contain:

```env
# Received from the one-time credentials screen
MCOM_SOLUTIONS_URL=https://api.mcomsolutions.com
MCOM_CLIENT_ID=mcom-vcard
MCOM_CLIENT_SECRET=cs_xxxx...     # Used for SSO token exchange
MCOM_API_KEY=ak_xxxx...           # Used to validate incoming calls FROM McomSolutions
MCOM_HMAC_SECRET=hm_xxxx...       # Used to sign outgoing HMAC requests TO McomSolutions
MCOM_WEBHOOK_SECRET=wh_xxxx...    # Used to verify webhook payloads FROM McomSolutions
```

**Which key protects which flow:**

| Flow | Key Used | Direction | Who Validates |
|---|---|---|---|
| SSO authorize/token | `MCOM_CLIENT_ID` + `MCOM_CLIENT_SECRET` | Partner → Mcom | McomSolutions |
| Plan CRUD (billing API) | `MCOM_API_KEY` (as `x-mcom-solution-api-key`) | Mcom → Partner | Partner app |
| Data-sharing HMAC | `MCOM_HMAC_SECRET` | Partner → Mcom | McomSolutions (`DataSharingGuard`) |
| Webhook delivery | `MCOM_WEBHOOK_SECRET` | Mcom → Partner | Partner app |

---

### 18.5 McomSolutions `GET /plans/platform` — Access Control Decision

The existing public `GET /plans/platform?platform=...` endpoint (in `PlansController`) was designed for unauthenticated frontends (e.g. pricing pages). This is intentional for some platforms.

**Decision matrix** — the engineer must choose per deployment:

| Scenario | Recommended approach |
|---|---|
| Plans are public pricing info (landing page, pricing page) | Keep public — no auth required |
| Plans contain sensitive pricing (B2B, tiered) | Add `JwtAuthGuard` — only logged-in users can see plans |
| Plans are internal admin-only | Move call to admin-gated endpoint entirely |

**To gate it behind auth** (if needed in the future — additive change):

```typescript
// plans.controller.ts — optionally add guard
@UseGuards(JwtAuthGuard)  // ADD if plans should be non-public
@Get('platform')
async getPlatformPlans(@Query('platform') platform: string) { ... }
```

> ⚠️ Do NOT add auth to this endpoint without checking all current consumers (pricing pages, onboarding flows). It is currently public by design.

---

### 18.6 Securing the Partner App's Plan Endpoint — Checklist

Every partner app implementing the billing API contract (Step 7 in Section 12) **must**:

- [ ] Read `MCOM_API_KEY` from environment (never hardcode).
- [ ] Validate `x-mcom-solution-api-key` header on every `system/plans` route using `timingSafeEqual`.
- [ ] Return `401 Unauthorized` (not 403) when key is missing or invalid.
- [ ] Scope the guard to only the `/api/v1/system/plans` namespace.
- [ ] Never log or return the key value in responses or error messages.
- [ ] Rotate the key via Console if it has been exposed.
- [ ] Ensure `billingApiUrl` is HTTPS in production (McomSolutions enforces this for all registered apps).

---

### 18.7 Key Rotation Without Downtime

When the API key is rotated via `POST /admin/console/apps/:clientId/rotate-api-key`:

1. McomSolutions generates a new `ak_` key and updates `SsoClient.apiKey` immediately.
2. All future `GenericHttpConnector` calls to the partner app use the **new** key.
3. The partner app must update `MCOM_API_KEY` in its environment and restart.

**Zero-downtime rotation** (for high-availability partner apps): The partner app can support a short dual-key window by accepting **either** the old or new key for a grace period (e.g. 5 minutes). After the grace period, remove the old key. This is an optional enhancement — document it in the partner app's README.

---

### 18.8 What Is NOT Covered by This Security Model

| Concern | Status |
|---|---|
| Man-in-the-middle on `billingApiUrl` | Protected — `billingApiUrl` must be HTTPS |
| Replay attacks on plan create/update | Not protected — add `X-Request-Timestamp` + nonce if needed |
| IP allowlisting | Optional — partner app can additionally allowlist McomSolutions IPs |
| Rate limiting on plan endpoints | Handled by partner app's own throttler (not McomSolutions' responsibility) |
| Audit of who changed plans | ✅ Covered — `ConsoleAuditLog` records all plan operations via Console |

