# Mcom Centralized Wallet System — Full Engineering Design Plan
### Cross-Ecosystem Wallet, Transaction Ledger & Inter-Service Payment Protocol

> **Document Status**: Approved for Implementation
> **Engineer Audience**: Full-stack — NestJS backend + React/TypeScript frontend + Partner App Integration Teams
> **Priority**: Financial accuracy is non-negotiable. Every credit and debit must be recorded atomically.
> **Companion Document**: `mcom-console-plan.md` — Wallet system builds on top of the Console registered-app model.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Core Concepts & Terminology](#3-core-concepts--terminology)
4. [Data Model — Complete Schema](#4-data-model--complete-schema)
5. [Wallet Lifecycle](#5-wallet-lifecycle)
6. [Transaction Ledger Design](#6-transaction-ledger-design)
7. [Backend — Complete API Surface](#7-backend--complete-api-surface)
8. [Inter-Service Communication Protocol](#8-inter-service-communication-protocol)
9. [Security Model](#9-security-model)
10. [Idempotency & Double-Spend Prevention](#10-idempotency--double-spend-prevention)
11. [Filtering, Pagination & Reporting](#11-filtering-pagination--reporting)
12. [Caching & Performance Architecture](#12-caching--performance-architecture)
13. [Error Handling & Failure Recovery](#13-error-handling--failure-recovery)
14. [Partner App Integration Guide](#14-partner-app-integration-guide)
15. [Admin Console — Wallet Management UI](#15-admin-console--wallet-management-ui)
16. [Frontend — User Wallet UI](#16-frontend--user-wallet-ui)
17. [Testing Strategy](#17-testing-strategy)
18. [Deployment & Migration Checklist](#18-deployment--migration-checklist)
19. [Implementation Execution Order](#19-implementation-execution-order)
20. [Future Extensions](#20-future-extensions)

---

## 1. Executive Summary

### What We Are Building

A **Centralized Wallet System** that lives exclusively inside **McomSolutions** (the hub). Every user who registers on any Mcom ecosystem platform gets one wallet. That single wallet can be funded and spent across **any registered Mcom platform** — MCOM Mall, MCOM Rewards, MCOM Spin, VemTap, 247GBS Audit, Expo, or any future platform registered via the Mcom Console.

### Key Principles

| Principle | Why It Matters |
|---|---|
| **One wallet per user identity** | Wallet is owned by the McomSolutions user, not by any individual platform |
| **Atomic double-entry ledger** | Every transaction creates a matching debit/credit pair — balance always derivable from ledger |
| **Idempotent operations** | Partner apps retry safely — no double charges, ever |
| **Platform-attributed transactions** | Every debit/credit knows which platform triggered it — filterable |
| **Read-replica safe** | Balance served from a dedicated running-balance field, not recalculated from ledger sum |
| **Backward compatible** | Wallet module is new — zero changes to existing auth, SSO, or billing modules |

### The Flow in Plain English

```
User registers on McomSolutions → Wallet auto-created (balance: 0)
User tops up wallet via payment gateway → Wallet credited → Ledger entry created
User pays on MCOM Mall:
  MCOM Mall backend → POST /api/v1/wallet/partner/debit (HMAC-signed)
  McomSolutions validates signature, checks balance, debits wallet atomically
  Returns transaction receipt → MCOM Mall acknowledges
User opens McomSolutions dashboard → sees full transaction history across all platforms
```

**No platform stores wallet balances. McomSolutions is the single source of truth.**

---

## 2. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        MCOM SOLUTIONS (HUB)                                  │
│  ┌───────────────┐   ┌──────────────────┐   ┌──────────────────────────┐   │
│  │  Auth / SSO   │   │  Wallet Service   │   │   Transaction Ledger     │   │
│  │  (existing)   │   │  (NEW)            │   │   (NEW — append-only)    │   │
│  └───────┬───────┘   └────────┬─────────┘   └─────────────┬────────────┘   │
│  ┌───────▼────────────────────▼─────────────────────────────▼───────────┐  │
│  │              PostgreSQL — User → Wallet → WalletTransaction           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Redis — wallet:balance:<id>  wallet:lock:<id>  wallet:idempotency:* │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
        ▲ HMAC           ▲ HMAC           ▲ HMAC           ▲ HMAC
  ┌─────┴──────┐  ┌──────┴──────┐  ┌─────┴──────┐  ┌──────┴──────┐
  │  MCOM Mall │  │MCOM Rewards │  │   VemTap   │  │  247GBS     │
  └────────────┘  └─────────────┘  └────────────┘  └─────────────┘
```

### Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Ledger type | Double-entry append-only | Industry standard. Immutable audit trail. |
| Balance storage | Materialized running balance + ledger | Fast reads; ledger is reconciliation source of truth |
| Locking | Redis distributed lock per wallet | Prevents race conditions on concurrent debits |
| Inter-service auth | HMAC-signed requests (existing Console pattern) | Already built; no new auth system needed |
| Idempotency | Redis + DB unique constraint (24h TTL) | Partner apps safely retry failed requests |
| Currency | MCOM credits with 4dp decimal | Extend to multi-currency in a future phase |

---

## 3. Core Concepts & Terminology

| Term | Definition |
|---|---|
| **Wallet** | One per McomSolutions user. Holds a balance. |
| **Balance** | Current spendable amount. Always >= 0. |
| **Credit** | Inflow — top-up, cashback, admin credit |
| **Debit** | Outflow — subscription, purchase, fee |
| **Ledger Entry** | Immutable `WalletTransaction` row. NEVER updated or deleted. |
| **Idempotency Key** | Partner-supplied string preventing duplicate processing |
| **Platform** | Any Console-registered app with `clientId` + `platformSlug` |
| **Hold** | Temporarily reserved funds before a debit is confirmed |
| **Wallet Lock** | Short-lived Redis lock preventing concurrent balance changes |
| **Reconciliation** | Verifying `Wallet.balance` equals `SUM(credits) - SUM(debits)` from ledger |

---

## 4. Data Model — Complete Schema

### 4.1 `Wallet` Model

```prisma
model Wallet {
  id              String        @id @default(cuid())
  userId          String        @unique
  balance         Decimal       @default(0) @db.Decimal(18, 4)
  currency        String        @default("MCOM")
  status          WalletStatus  @default(ACTIVE)

  dailyDebitLimit   Decimal?    @db.Decimal(18, 4)
  monthlyDebitLimit Decimal?    @db.Decimal(18, 4)
  maxBalance        Decimal?    @db.Decimal(18, 4)

  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  lastTransactionAt DateTime?

  user         User              @relation(fields: [userId], references: [id])
  transactions WalletTransaction[]
  holds        WalletHold[]

  @@index([userId])
  @@index([status])
}

enum WalletStatus { ACTIVE FROZEN SUSPENDED CLOSED }
```

### 4.2 `WalletTransaction` — The Ledger (NEVER UPDATE OR DELETE)

```prisma
model WalletTransaction {
  id            String   @id @default(cuid())
  walletId      String

  type          TransactionType
  amount        Decimal  @db.Decimal(18, 4)       // Always positive
  balanceBefore Decimal  @db.Decimal(18, 4)       // Snapshot BEFORE
  balanceAfter  Decimal  @db.Decimal(18, 4)       // Snapshot AFTER
  currency      String   @default("MCOM")

  platformClientId String?                        // FK -> SsoClient.clientId
  platformName     String?                        // Denormalized: "MCOM Mall"
  platformSlug     String?                        // "mall" — used for filtering

  category      TransactionCategory
  reference     String?                           // Invoice ID, order ID
  description   String?
  metadata      Json?

  idempotencyKey String?  @unique                 // Guarantees no duplicate processing

  status        TransactionStatus @default(COMPLETED)
  failureReason String?
  holdId        String?
  initiatedBy   String?                           // "platform:mcom-mall"
  ipAddress     String?

  createdAt     DateTime @default(now())           // IMMUTABLE

  wallet  Wallet      @relation(fields: [walletId], references: [id])
  hold    WalletHold? @relation(fields: [holdId], references: [id])

  @@index([walletId])
  @@index([walletId, createdAt(sort: Desc)])
  @@index([platformClientId])
  @@index([platformSlug])
  @@index([category])
  @@index([type])
  @@index([createdAt(sort: Desc)])
  @@index([idempotencyKey])
  @@index([reference])
  @@index([status])
  @@index([walletId, platformSlug, createdAt(sort: Desc)])  // Most common query
}

enum TransactionType     { CREDIT DEBIT }

enum TransactionCategory {
  // Credits
  TOP_UP REWARD REFUND ADMIN_CREDIT TRANSFER_IN
  // Debits
  SUBSCRIPTION PURCHASE SERVICE_FEE ADMIN_DEBIT TRANSFER_OUT HOLD_CAPTURE
}

enum TransactionStatus { COMPLETED PENDING FAILED REVERSED }
```

### 4.3 `WalletHold` — Pre-Authorization

```prisma
model WalletHold {
  id               String     @id @default(cuid())
  walletId         String
  amount           Decimal    @db.Decimal(18, 4)
  platformClientId String
  platformName     String
  reference        String?
  description      String?
  status           HoldStatus @default(ACTIVE)
  expiresAt        DateTime                     // Auto-released if not captured
  capturedAt       DateTime?
  releasedAt       DateTime?
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt

  wallet       Wallet              @relation(fields: [walletId], references: [id])
  transactions WalletTransaction[]

  @@index([walletId])
  @@index([platformClientId])
  @@index([expiresAt])
  @@index([status])
}

enum HoldStatus { ACTIVE CAPTURED RELEASED EXPIRED }
```

### 4.4 `WalletAuditLog`

```prisma
model WalletAuditLog {
  id        String   @id @default(cuid())
  walletId  String
  adminId   String
  action    String   // "freeze","unfreeze","manual_credit","manual_debit","close","adjust_limit"
  reason    String   // Mandatory — required for compliance
  changes   Json?    // { before: {...}, after: {...} }
  ip        String?
  userAgent String?
  createdAt DateTime @default(now())

  @@index([walletId])
  @@index([adminId])
  @@index([createdAt(sort: Desc)])
}
```

### 4.5 `WalletTopUpRequest`

```prisma
model WalletTopUpRequest {
  id             String      @id @default(cuid())
  walletId       String
  userId         String
  amount         Decimal     @db.Decimal(18, 4)
  currency       String      @default("GBP")
  walletCurrency String      @default("MCOM")
  exchangeRate   Decimal     @default(1) @db.Decimal(10, 6)

  provider       String                          // "stripe", "paystack"
  providerRef    String?     @unique             // Stripe PaymentIntent ID
  providerStatus String?

  status         TopUpStatus @default(PENDING)
  transactionId  String?                         // Set after wallet is credited

  createdAt      DateTime    @default(now())
  completedAt    DateTime?

  @@index([walletId])
  @@index([userId])
  @@index([providerRef])
  @@index([status])
}

enum TopUpStatus { PENDING PROCESSING COMPLETED FAILED CANCELLED }
```

### 4.6 `User` Model Extension (Additive Only)

```prisma
// Append to existing User model — NO columns added, virtual relation only:
model User {
  // ... all existing fields untouched ...
  wallet Wallet?
}
```

### 4.7 Migration

```bash
npx prisma migrate dev --name add_centralized_wallet_system
npx prisma generate
```

> The migration is **fully additive**. New tables are created. Zero impact on existing data.

---

## 5. Wallet Lifecycle

### 5.1 Wallet Creation

Auto-created in the same Prisma `$transaction` as user registration:

```typescript
async createUser(dto: CreateUserDto): Promise<User> {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { ...dto } });
    await tx.wallet.create({
      data: { userId: user.id, balance: 0, currency: 'MCOM', status: 'ACTIVE' },
    });
    return user;
  });
}
// If wallet creation fails → user creation rolls back. No orphaned users.
```

### 5.2 Status Transitions

```
ACTIVE ──► FROZEN      (admin: freeze — fraud/non-payment)
ACTIVE ──► SUSPENDED   (admin: temporary hold)
ACTIVE ──► CLOSED      (admin: termination — irreversible)
FROZEN ──► ACTIVE      (admin: unfreeze)
FROZEN ──► CLOSED
SUSPENDED ► ACTIVE     (admin: restore)
SUSPENDED ► CLOSED
CLOSED ──► [TERMINAL — no transitions out]
```

| Status | Credits | Debits | Holds |
|---|---|---|---|
| ACTIVE | ✅ | ✅ | ✅ |
| FROZEN | ❌ | ❌ | ❌ |
| SUSPENDED | ❌ | ❌ | ❌ |
| CLOSED | ❌ | ❌ | ❌ |

---

## 6. Transaction Ledger Design

### 6.1 The Golden Rules (Non-Negotiable)

1. `WalletTransaction` records are **NEVER updated or deleted** — append-only.
2. Every transaction captures `balanceBefore` AND `balanceAfter` at write time.
3. Balance update and ledger entry are **ALWAYS atomic** — same Prisma `$transaction`.
4. A **distributed Redis lock** is held per wallet during every balance-modifying operation.
5. `amount` is **ALWAYS positive**. `type` (CREDIT/DEBIT) determines direction.

### 6.2 Debit Processing Flow

```
Partner POST /api/v1/wallet/partner/debit
  1. Validate HMAC signature            [WalletHmacGuard]
  2. Check idempotency key in Redis     [cache hit → return cached result]
  3. Validate DTO                       [class-validator]
  4. Acquire Redis wallet lock (SETNX TTL=10s) [fail → 409]
  5. Re-load wallet inside lock
  6. Check wallet.status               [reject if not ACTIVE]
  7. Check available balance           [reject if balance < amount]
  8. Check daily/monthly limits
  9. prisma.$transaction([
       createWalletTransaction(balanceBefore, balanceAfter),
       updateWallet(balance -= amount)
     ])
  10. Release wallet lock
  11. Cache idempotency result (24h TTL)
  12. Invalidate balance cache
  13. Return TransactionReceiptDto
```

### 6.3 Credit Flow (Top-Up via Payment Gateway)

```
User POST /api/v1/wallet/topup/initiate
  → Create WalletTopUpRequest (PENDING)
  → Create Stripe payment session
  → Return checkoutUrl

Stripe POST /api/v1/wallet/webhook/stripe (payment.succeeded)
  → Verify Stripe-Signature
  → Find WalletTopUpRequest by providerRef
  → Idempotency: if already COMPLETED → return 200 (no-op)
  → prisma.$transaction([
       updateTopUpRequest(COMPLETED),
       createWalletTransaction(CREDIT, TOP_UP),
       updateWallet(balance += amount)
     ])
  → Return 200 OK
```

### 6.4 Ledger Entry Example

```json
{
  "id": "clx8p2qr10000x4vj3k5m7n9p",
  "walletId": "clx8p2abc0000x4vj3k5m7n9p",
  "type": "DEBIT",
  "amount": "50.0000",
  "balanceBefore": "150.0000",
  "balanceAfter": "100.0000",
  "currency": "MCOM",
  "platformClientId": "mcom-mall",
  "platformName": "MCOM Mall",
  "platformSlug": "mall",
  "category": "SUBSCRIPTION",
  "reference": "sub_inv_20260826_0042",
  "description": "MCOM Mall — Gold Package Subscription (August 2026)",
  "idempotencyKey": "mcom-mall-sub-inv-0042-aug2026",
  "status": "COMPLETED",
  "initiatedBy": "platform:mcom-mall",
  "metadata": { "packageId": "gold-monthly", "period": "2026-08-01/2026-08-31" },
  "createdAt": "2026-08-26T11:15:00.000Z"
}
```

### 6.5 Balance Reconciliation Formula

```
Wallet.balance = SUM(amount WHERE type=CREDIT AND status=COMPLETED)
               - SUM(amount WHERE type=DEBIT  AND status=COMPLETED)
               - SUM(WalletHold.amount WHERE status=ACTIVE)
```

Nightly job checks all wallets. Any drift triggers an alert — drift means a bug.

---

## 7. Backend — Complete API Surface

### 7.1 Module File Structure

```
apps/backend/src/wallet/
  wallet.module.ts
  wallet.controller.ts             ← User-facing (JWT auth)
  wallet-admin.controller.ts       ← Admin (JWT + ADMIN role)
  wallet-partner.controller.ts     ← Partner apps (HMAC auth)
  wallet.service.ts                ← Core debit/credit logic
  wallet-topup.service.ts          ← Payment gateway integration
  wallet-ledger.service.ts         ← Query, filtering, reporting
  wallet-reconciliation.service.ts ← Nightly reconciliation + hold expiry
  dto/
    debit-wallet.dto.ts
    credit-wallet.dto.ts
    topup-initiate.dto.ts
    filter-transactions.dto.ts
    admin-adjust-wallet.dto.ts
    place-hold.dto.ts
    capture-hold.dto.ts
  guards/
    wallet-hmac.guard.ts
  utils/
    wallet-lock.util.ts
    decimal.util.ts
```

### 7.2 User-Facing Endpoints — `/api/v1/wallet`

Protected by `JwtAuthGuard`. Wallet derived from `req.user.id`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/wallet` | My wallet (balance, status) |
| `GET` | `/wallet/transactions` | Paginated history with all filters |
| `GET` | `/wallet/transactions/:id` | Transaction detail |
| `POST` | `/wallet/topup/initiate` | Start top-up → Stripe checkout URL |
| `GET` | `/wallet/topup/history` | Top-up request history |
| `GET` | `/wallet/holds` | Active holds |
| `GET` | `/wallet/summary?period=30d` | Spending breakdown by platform & category |

### 7.3 Partner App Endpoints — `/api/v1/wallet/partner`

Protected by `WalletHmacGuard`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/partner/debit` | Debit a user's wallet |
| `POST` | `/partner/credit` | Credit a user's wallet (reward/refund) |
| `POST` | `/partner/hold/place` | Reserve funds |
| `POST` | `/partner/hold/capture` | Convert hold to real debit |
| `POST` | `/partner/hold/release` | Release hold back to balance |
| `GET` | `/partner/balance/:userId` | Check user's wallet balance |
| `GET` | `/partner/transactions/:userId` | Transactions *this platform* originated |
| `GET` | `/partner/transaction/:id?by=id` | Look up by ID or idempotencyKey |

### 7.4 Admin Endpoints — `/api/v1/wallet/admin`

Protected by `JwtAuthGuard + ConsoleAdminGuard`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/wallets` | List all wallets |
| `GET` | `/admin/wallets/:walletId` | Wallet detail |
| `GET` | `/admin/wallets/user/:userId` | Wallet by user |
| `PATCH` | `/admin/wallets/:walletId/freeze` | Freeze (body: `{reason}`) |
| `PATCH` | `/admin/wallets/:walletId/unfreeze` | Unfreeze |
| `PATCH` | `/admin/wallets/:walletId/close` | Close permanently |
| `POST` | `/admin/wallets/:walletId/credit` | Manual credit |
| `POST` | `/admin/wallets/:walletId/debit` | Manual debit |
| `GET` | `/admin/wallets/:walletId/transactions` | Full history with all filters |
| `PATCH` | `/admin/transactions/:id/reverse` | Reverse (creates compensating entry) |
| `PATCH` | `/admin/wallets/:walletId/limits` | Set daily/monthly limits |
| `GET` | `/admin/reports/platform-summary` | Debits/credits grouped by platform |
| `GET` | `/admin/reports/daily-volume` | Day-by-day volume |
| `GET` | `/admin/reports/reconciliation` | Balance vs ledger verification |
| `GET` | `/admin/audit-log` | Admin action audit log |

### 7.5 Webhook Endpoints — `/api/v1/wallet/webhook`

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhook/stripe` | Stripe payment.succeeded |
| `POST` | `/webhook/paystack` | Paystack payment success |

> ⚠️ These endpoints need raw body parsing (not JSON-parsed) for signature verification.

### 7.6 Core DTOs

#### `DebitWalletDto`
```typescript
export class DebitWalletDto {
  @IsString() @IsNotEmpty()
  userId: string;

  @IsNumber() @IsPositive() @Max(100000) @Type(() => Number)
  amount: number;

  @IsEnum(TransactionCategory)
  category: TransactionCategory;      // SUBSCRIPTION | PURCHASE | SERVICE_FEE

  @IsString() @IsNotEmpty() @MaxLength(200)
  description: string;

  @IsOptional() @IsString() @MaxLength(200)
  reference?: string;                 // Your invoice/order ID

  @IsOptional() @IsObject()
  metadata?: Record<string, any>;
}
```

#### `FilterTransactionsDto` (all filters optional, all composable)
```typescript
export class FilterTransactionsDto {
  @IsOptional() @IsString()             platformSlug?: string;
  @IsOptional() @IsString()             platformClientId?: string;
  @IsOptional() @IsEnum(TransactionType) type?: TransactionType;
  @IsOptional() @IsEnum(TransactionCategory) category?: TransactionCategory;
  @IsOptional() @IsEnum(TransactionStatus)   status?: TransactionStatus;
  @IsOptional() @IsDateString()         dateFrom?: string;   // "2026-08-01"
  @IsOptional() @IsDateString()         dateTo?: string;     // "2026-08-31" (inclusive EOD)
  @IsOptional() @IsString()             search?: string;     // Searches description + reference
  @IsOptional() @IsNumberString()       minAmount?: string;
  @IsOptional() @IsNumberString()       maxAmount?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
}
```

---

## 8. Inter-Service Communication Protocol

This is the **integration contract** every partner platform backend must follow.

### 8.1 Required Headers

| Header | Value | Required On |
|---|---|---|
| `X-Mcom-Client-ID` | `mcom-mall` | All requests |
| `X-Mcom-Signature` | `sha256=<hmac-hex>` | All requests |
| `X-Idempotency-Key` | unique-per-event string | All write (POST) operations |
| `Content-Type` | `application/json` | All requests |

### 8.2 HMAC Signature Generation

```typescript
import * as crypto from 'crypto';

function signRequest(body: object, hmacSecret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', hmacSecret)
    .update(JSON.stringify(body)).digest('hex');
}

// Usage — debit a user wallet:
const body = {
  userId: 'user_abc123',
  amount: 50,
  category: 'SUBSCRIPTION',
  description: 'MCOM Mall Gold Package — August 2026',
  reference: 'sub_inv_0042',
};

const response = await fetch(`${MCOM_SOLUTIONS_URL}/api/v1/wallet/partner/debit`, {
  method: 'POST',
  headers: {
    'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
    'X-Mcom-Signature': signRequest(body, process.env.MCOM_HMAC_SECRET),
    'X-Idempotency-Key': 'mcom-mall-sub-inv-0042-aug2026',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});
```

### 8.3 `WalletHmacGuard` (Server Side)

```typescript
@Injectable()
export class WalletHmacGuard implements CanActivate {
  constructor(private ssoService: SsoService, private config: ConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const clientId  = req.headers['x-mcom-client-id'] as string;
    const signature = req.headers['x-mcom-signature'] as string;

    if (!clientId || !signature) throw new UnauthorizedException('Missing auth headers');

    const client = await this.ssoService.getClientByClientId(clientId);
    if (!client?.isActive) throw new UnauthorizedException('Unknown or inactive client');

    const hmacSecret = client.hmacSecret
      ? decrypt(client.hmacSecret, this.config.get('CONSOLE_ENCRYPTION_KEY'))
      : this.config.get('SSO_API_SECRET');  // Fallback for legacy clients

    const rawBody = (req as any).rawBody;
    if (!rawBody) throw new BadRequestException('Raw body unavailable');

    if (!verifyHmac(rawBody, signature, hmacSecret))
      throw new UnauthorizedException('Invalid HMAC signature');

    (req as any).partnerClient = client;  // Available to controllers
    return true;
  }
}
```

### 8.4 Raw Body Middleware (Add to `main.ts`)

```typescript
// Before app.use(json()) — required for HMAC verification
app.use('/api/v1/wallet/partner', express.raw({ type: 'application/json' }));
app.use('/api/v1/wallet/webhook', express.raw({ type: 'application/json' }));
```

### 8.5 Response Shapes

**Successful Debit:**
```json
{
  "success": true,
  "transactionId": "clx8p2qr10000x4vj3k5m7n9p",
  "type": "DEBIT",
  "amount": 50.0000,
  "balanceBefore": 150.0000,
  "balanceAfter": 100.0000,
  "currency": "MCOM",
  "reference": "sub_inv_0042",
  "idempotencyKey": "mcom-mall-sub-inv-0042-aug2026",
  "processedAt": "2026-08-26T11:15:00.000Z"
}
```

**Insufficient Balance (422):**
```json
{
  "statusCode": 422,
  "error": "INSUFFICIENT_BALANCE",
  "message": "Wallet balance (50.00 MCOM) is insufficient for debit of 100.00 MCOM",
  "availableBalance": 50.0000
}
```

---

## 9. Security Model

### 9.1 Defence-in-Depth

| Layer | Mechanism | Prevents |
|---|---|---|
| Network | HTTPS only | MITM |
| Authentication | HMAC per request | Unauthorized partner API access |
| Authorization | JWT + roles | Unauthorized user/admin access |
| Input validation | class-validator DTOs | Injection, overflow |
| Financial validation | Balance check before every debit | Overdraft |
| Concurrency | Redis distributed wallet lock | Race conditions, double-spend |
| Idempotency | Redis + DB `@unique` constraint | Duplicate charges on retry |
| Ledger integrity | Append-only, balanceBefore/After | Tampering, silent errors |
| Admin actions | Mandatory reason + WalletAuditLog | Unauthorized adjustments |
| Secret storage | AES-256-GCM (existing Console pattern) | Secret exposure |
| Rate limiting | Per-client throttle | Brute force, abuse |

### 9.2 Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /partner/debit` | 60/min per client |
| `POST /partner/credit` | 60/min per client |
| `GET /partner/balance/:userId` | 120/min per client |
| `GET /partner/transactions/:userId` | 30/min per client |
| All admin endpoints | 30/min per admin |

### 9.3 Decimal Arithmetic — CRITICAL

**NEVER use JavaScript floating-point for financial math.** Use Prisma's `Decimal` type:

```typescript
// utils/decimal.util.ts
import { Decimal } from '@prisma/client/runtime/library';
export const safeSubtract = (a: Decimal, b: Decimal) => a.minus(b);
export const safeAdd      = (a: Decimal, b: Decimal) => a.plus(b);
export const isGte        = (a: Decimal, b: Decimal) => a.greaterThanOrEqualTo(b);

// ❌ WRONG: const newBal = wallet.balance - amount;  // Float imprecision!
// ✅ RIGHT: const newBal = safeSubtract(wallet.balance, new Decimal(amount));
```

### 9.4 Partner Data Isolation

Partners can **only read transactions they originated**. `platformClientId` is always injected server-side from the authenticated header — never trusted from the request body:

```typescript
where: {
  wallet: { userId },
  platformClientId: partnerClientId,  // From req.partnerClient — NOT user-supplied
}
```

---

## 10. Idempotency & Double-Spend Prevention

### 10.1 Three-Layer Defence

**Layer 1 — Redis:** Result stored for 24h. Retries get cached result without touching DB.

**Layer 2 — DB Unique Constraint:** `WalletTransaction.idempotencyKey @unique`. If Redis misses (restart), DB insert fails with conflict — service catches it and returns existing transaction.

**Layer 3 — Distributed Wallet Lock:** Redis SETNX blocks concurrent operations on the same wallet.

### 10.2 Idempotency Key Format

```
Format:  <platform>-<event-type>-<your-unique-reference>

Examples:
  mcom-mall-sub-inv_0042_aug2026
  mcom-rewards-cashback-campaign_5_user_abc
  vemtap-purchase-order_abc123

Rules:
  - Max 255 chars, ASCII only
  - Unique per BUSINESS EVENT (not per HTTP retry)
  - NEVER reuse for a different amount or operation
  - Must be deterministically derivable from your internal record
```

### 10.3 Full Debit Service Implementation

```typescript
async debitWallet(partnerClientId: string, dto: DebitWalletDto, idempKey: string) {

  // 1. Redis + DB idempotency check
  const existing = await this.checkIdempotency(idempKey);
  if (existing) return existing;

  validateAmount(dto.amount);

  const wallet = await this.prisma.wallet.findUnique({ where: { userId: dto.userId } });
  if (!wallet) throw new NotFoundException('Wallet not found');
  if (wallet.status !== 'ACTIVE') throw new ForbiddenException(`Wallet is ${wallet.status}`);

  return this.lockUtil.withLock(wallet.id, async () => {
    // Re-read inside lock — balance may have changed
    const fresh  = await this.prisma.wallet.findUnique({ where: { id: wallet.id } });
    const amount = new Decimal(dto.amount);
    const holds  = await this.getTotalActiveHolds(fresh.id);
    const avail  = safeSubtract(fresh.balance, holds);

    if (!isGte(avail, amount)) throw new UnprocessableEntityException({
      error: 'INSUFFICIENT_BALANCE', availableBalance: avail.toNumber(),
      message: `Balance ${avail} MCOM < debit ${amount} MCOM`,
    });

    await this.checkDailyLimit(fresh, amount);

    const balanceBefore = fresh.balance;
    const balanceAfter  = safeSubtract(balanceBefore, amount);
    const ssoClient     = await this.ssoService.getClientByClientId(partnerClientId);

    const [txn] = await this.prisma.$transaction([
      this.prisma.walletTransaction.create({ data: {
        walletId: fresh.id, type: 'DEBIT', amount, balanceBefore, balanceAfter,
        currency: fresh.currency,
        platformClientId: partnerClientId,
        platformName: ssoClient?.name ?? partnerClientId,
        platformSlug: ssoClient?.platformSlug ?? partnerClientId,
        category: dto.category, reference: dto.reference,
        description: dto.description, metadata: dto.metadata ?? {},
        idempotencyKey: idempKey, status: 'COMPLETED',
        initiatedBy: `platform:${partnerClientId}`,
      }}),
      this.prisma.wallet.update({
        where: { id: fresh.id },
        data: { balance: balanceAfter, lastTransactionAt: new Date() },
      }),
    ]);

    const receipt = this.toReceipt(txn);
    await this.finalizeIdempotency(idempKey, receipt);
    await this.redis.del(`wallet:balance:${dto.userId}`);
    return receipt;
  });
}
```

### 10.4 Distributed Wallet Lock

```typescript
@Injectable()
export class WalletLockUtil {
  private readonly TTL = 10; // seconds — auto-release prevents deadlock

  constructor(private readonly redis: RedisService) {}

  async withLock<T>(walletId: string, fn: () => Promise<T>): Promise<T> {
    const key = `wallet:lock:${walletId}`;
    const ok  = await this.redis.client.set(key, '1', 'EX', this.TTL, 'NX');
    if (ok !== 'OK') throw new ConflictException('Wallet locked — retry in a moment');
    try   { return await fn(); }
    finally { await this.redis.del(key); }
  }
}
```

### 10.5 Idempotency Check with DB Fallback

```typescript
async checkIdempotency(key: string): Promise<TransactionReceiptDto | null> {
  // Fast path: Redis
  const cached = await this.redis.get(`wallet:idempotency:${key}`);
  if (cached) return cached;

  // Slow path: DB fallback (handles Redis restart between step 9 and 11)
  const existing = await this.prisma.walletTransaction.findUnique({
    where: { idempotencyKey: key },
  });
  if (existing) {
    const receipt = this.toReceipt(existing);
    await this.redis.set(`wallet:idempotency:${key}`, receipt, 86400);
    return receipt;
  }
  return null;
}
```

---

## 11. Filtering, Pagination & Reporting

### 11.1 Filter Reference

All filters composable. Example: `?platformSlug=mall&type=DEBIT&dateFrom=2026-08-01&dateTo=2026-08-31`

| Filter | Example |
|---|---|
| `platformSlug` | `?platformSlug=mall` |
| `platformClientId` | `?platformClientId=mcom-mall` |
| `type` | `?type=DEBIT` or `?type=CREDIT` |
| `category` | `?category=SUBSCRIPTION` |
| `status` | `?status=COMPLETED` |
| `dateFrom` | `?dateFrom=2026-08-01` |
| `dateTo` | `?dateTo=2026-08-31` (inclusive to 23:59:59) |
| `search` | `?search=inv-0042` (searches description + reference) |
| `minAmount` | `?minAmount=10` |
| `maxAmount` | `?maxAmount=500` |
| `page` | `?page=2` (default: 1) |
| `limit` | `?limit=50` (default: 20, max: 100) |

### 11.2 Transaction Query Builder

```typescript
async getTransactions(walletId: string, filters: FilterTransactionsDto, partnerClientId?: string) {
  const where: Prisma.WalletTransactionWhereInput = {
    walletId,
    ...(partnerClientId       && { platformClientId: partnerClientId }),
    ...(filters.platformSlug  && { platformSlug: filters.platformSlug }),
    ...(filters.type          && { type: filters.type }),
    ...(filters.category      && { category: filters.category }),
    ...(filters.status        && { status: filters.status }),
    ...(filters.search        && { OR: [
      { description: { contains: filters.search, mode: 'insensitive' } },
      { reference:   { contains: filters.search, mode: 'insensitive' } },
    ]}),
    ...(filters.minAmount     && { amount: { gte: new Decimal(filters.minAmount) } }),
    ...(filters.maxAmount     && { amount: { lte: new Decimal(filters.maxAmount) } }),
    ...((filters.dateFrom || filters.dateTo) && { createdAt: {
      ...(filters.dateFrom && { gte: new Date(filters.dateFrom) }),
      ...(filters.dateTo   && { lte: new Date(filters.dateTo + 'T23:59:59.999Z') }),
    }}),
  };

  const [total, data] = await this.prisma.$transaction([
    this.prisma.walletTransaction.count({ where }),
    this.prisma.walletTransaction.findMany({
      where, orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit, take: filters.limit,
    }),
  ]);

  return { data: data.map(this.toDto), total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
}
```

### 11.3 Wallet Summary (Analytics)

```typescript
async getWalletSummary(userId: string, period: '30d' | '90d' | '1y') {
  const days  = period === '30d' ? 30 : period === '90d' ? 90 : 365;
  const since = new Date(Date.now() - days * 86400000);

  const [debits, credits, byPlatform, byCategory] = await this.prisma.$transaction([
    this.prisma.walletTransaction.aggregate({
      where: { wallet: { userId }, type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: since } },
      _sum: { amount: true }, _count: true,
    }),
    this.prisma.walletTransaction.aggregate({
      where: { wallet: { userId }, type: 'CREDIT', status: 'COMPLETED', createdAt: { gte: since } },
      _sum: { amount: true }, _count: true,
    }),
    this.prisma.walletTransaction.groupBy({
      by: ['platformSlug', 'platformName'],
      where: { wallet: { userId }, type: 'DEBIT', status: 'COMPLETED', createdAt: { gte: since } },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } }, take: 10,
    }),
    this.prisma.walletTransaction.groupBy({
      by: ['category'],
      where: { wallet: { userId }, status: 'COMPLETED', createdAt: { gte: since } },
      _sum: { amount: true }, _count: true,
      orderBy: { _sum: { amount: 'desc' } }, take: 5,
    }),
  ]);

  return {
    period,
    totalSpent:      debits._sum.amount?.toNumber()  ?? 0,
    totalCredited:   credits._sum.amount?.toNumber() ?? 0,
    netFlow:        (credits._sum.amount?.toNumber() ?? 0) - (debits._sum.amount?.toNumber() ?? 0),
    spentByPlatform: byPlatform.map(p => ({ platformSlug: p.platformSlug, platformName: p.platformName, totalSpent: p._sum.amount?.toNumber() ?? 0, txnCount: p._count })),
    topCategories:   byCategory.map(c => ({ category: c.category, total: c._sum.amount?.toNumber() ?? 0, count: c._count })),
  };
}
```

---

## 12. Caching & Performance Architecture

| Data | Cache | TTL | Invalidation |
|---|---|---|---|
| Wallet balance | Redis `wallet:balance:<userId>` | 30s | After every successful transaction |
| Idempotency result | Redis `wallet:idempotency:<key>` | 24h | Natural expiry |
| SsoClient (platform info) | L1 mem (30s) + L2 Redis (5min) | See Console plan | On Console update |
| Transaction lists | **NOT cached — always DB** | — | — |

Transaction lists are never cached — users expect real-time financial accuracy.

### 12.1 Hold Expiry Job (Every 5 Minutes)

```typescript
@Cron('*/5 * * * *')
async expireStaleHolds(): Promise<void> {
  const expired = await this.prisma.walletHold.findMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } }, take: 100,
  });
  for (const hold of expired) await this.releaseHoldInternal(hold.id, 'EXPIRED');
}
```

### 12.2 Nightly Reconciliation Job (2AM)

```typescript
@Cron('0 2 * * *')
async runReconciliation(): Promise<void> {
  // Compare Wallet.balance vs SUM from ledger for all wallets
  // Alert on any discrepancy — drift = bug
}
```

---

## 13. Error Handling & Failure Recovery

### 13.1 Error Code Reference

| HTTP | `error` | Meaning | Partner action |
|---|---|---|---|
| 200 | — | Success | ✅ Process |
| 400 | `VALIDATION_ERROR` | Bad DTO | Fix request — don't retry |
| 401 | `INVALID_SIGNATURE` | Bad HMAC | Check/rotate HMAC secret |
| 403 | `WALLET_FROZEN` | Frozen | Notify user; contact support |
| 403 | `WALLET_CLOSED` | Closed | Same |
| 404 | `WALLET_NOT_FOUND` | No wallet | Contact Mcom |
| 409 | `WALLET_LOCKED` | Concurrent op | Retry after 1-2s |
| 422 | `INSUFFICIENT_BALANCE` | Not enough funds | Show top-up prompt |
| 422 | `DAILY_LIMIT_EXCEEDED` | Daily limit hit | Notify user |
| 429 | `RATE_LIMITED` | Too many requests | Exponential backoff |
| 500 | `INTERNAL_ERROR` | Server error | Retry with backoff |
| 503 | `SERVICE_UNAVAILABLE` | DB/Redis down | Retry with backoff |

### 13.2 Partner Retry Strategy

```typescript
async function debitWithRetry(body, idempKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${MCOM_URL}/api/v1/wallet/partner/debit`, {
        method: 'POST',
        headers: {
          'X-Mcom-Client-ID': CLIENT_ID,
          'X-Mcom-Signature': signRequest(body, HMAC_SECRET),
          'X-Idempotency-Key': idempKey,  // SAME KEY on every retry!
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.ok) return res.json();
      const err = await res.json();
      // Permanent — do NOT retry:
      if ([400, 401, 403, 404, 409, 422].includes(res.status)) throw err;
      // Transient — retry with backoff:
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
  }
}
```

---

## 14. Partner App Integration Guide

### 14.1 Environment Variables

```env
MCOM_SOLUTIONS_URL=https://api.mcomsolutions.com
MCOM_CLIENT_ID=your-platform-client-id    # From Mcom Console
MCOM_HMAC_SECRET=hm_xxxxxxxxxxxx          # From Mcom Console — shown once
MCOM_WALLET_ENABLED=true
```

### 14.2 Drop-In NestJS Service

```typescript
@Injectable()
export class McomWalletService {
  private base: string;
  private clientId: string;
  private hmacSecret: string;

  constructor(private config: ConfigService) {
    this.base       = config.get('MCOM_SOLUTIONS_URL');
    this.clientId   = config.get('MCOM_CLIENT_ID');
    this.hmacSecret = config.get('MCOM_HMAC_SECRET');
  }

  private sign(body: object) {
    return 'sha256=' + crypto.createHmac('sha256', this.hmacSecret)
      .update(JSON.stringify(body)).digest('hex');
  }

  private headers(body: object, idempKey?: string) {
    return {
      'Content-Type': 'application/json',
      'X-Mcom-Client-ID': this.clientId,
      'X-Mcom-Signature': this.sign(body),
      ...(idempKey && { 'X-Idempotency-Key': idempKey }),
    };
  }

  async getBalance(userId: string) {
    const res = await fetch(`${this.base}/api/v1/wallet/partner/balance/${userId}`,
      { headers: this.headers({}) });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ balance: number; availableBalance: number; status: string }>;
  }

  async debit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res  = await fetch(`${this.base}/api/v1/wallet/partner/debit`, {
      method: 'POST', headers: this.headers(body, opts.idempotencyKey), body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.json(); throw new McomWalletError(err.error, err.message, res.status); }
    return res.json();
  }

  async credit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res  = await fetch(`${this.base}/api/v1/wallet/partner/credit`, {
      method: 'POST', headers: this.headers(body, opts.idempotencyKey), body: JSON.stringify(body),
    });
    if (!res.ok) { const err = await res.json(); throw new McomWalletError(err.error, err.message, res.status); }
    return res.json();
  }
}

export class McomWalletError extends Error {
  constructor(public code: string, message: string, public httpStatus: number) {
    super(message); this.name = 'McomWalletError';
  }
}
```

### 14.3 Idempotency Key Generation

```typescript
const idempKey = `${CLIENT_ID}-sub-${invoiceId}`;          // Subscriptions
const idempKey = `${CLIENT_ID}-purchase-${orderId}`;       // Purchases
const idempKey = `${CLIENT_ID}-refund-${originalTxnId}`;   // Refunds
const idempKey = `${CLIENT_ID}-reward-${campaignId}-${userId}-${date}`;
```

### 14.4 Handling `INSUFFICIENT_BALANCE`

```typescript
try {
  const receipt = await mcomWallet.debit(userId, amount, opts);
} catch (err) {
  if (err instanceof McomWalletError && err.code === 'INSUFFICIENT_BALANCE') {
    return res.status(402).json({
      error: 'WALLET_INSUFFICIENT_FUNDS',
      message: 'Top up your Mcom Wallet to continue.',
      topUpUrl: 'https://mcomsolutions.com/dashboard/wallet',
    });
  }
  throw err;
}
```

---

## 15. Admin Console — Wallet Management UI

### 15.1 New Admin Tab

```typescript
// AdminDashboard.tsx additions:
'wallet'  // add to ADMIN_TABS
'wallet': { title: 'Wallet Management', subtitle: 'View and manage user wallets and transactions' }
case 'wallet': return <WalletAdminPanel />;
```

### 15.2 Wallet List Screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Wallet Management                        [Search by email or user ID   ] │
│  Status: [All ▼]                                       [Export CSV]        │
├──────────────────┬────────────┬──────────┬────────────┬────────────────────┤
│ User Email       │ Balance    │ Currency │ Status     │ Actions            │
├──────────────────┼────────────┼──────────┼────────────┼────────────────────┤
│ john@mcom.com    │  1,250.00  │ MCOM     │ ● Active   │ [View]             │
│ bob@mcom.com     │      0.00  │ MCOM     │ ❄ Frozen   │ [View]             │
│ alice@mcom.com   │  4,800.00  │ MCOM     │ ● Active   │ [View]             │
└──────────────────┴────────────┴──────────┴────────────┴────────────────────┘
```

### 15.3 Wallet Detail Screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Back   john@example.com — Wallet        ● Active  [Freeze] [Adjust]     │
├────────────────────────────┬───────────────────────────────────────────────┤
│ Balance:  1,250.00 MCOM    │ LAST 30 DAYS                                  │
│ Available:1,200.00 MCOM    │ Spent:    320.00 MCOM  Received: 540.00 MCOM  │
│ (50.00 on hold)            │ Txns: 18  Top: MCOM Mall (120.00)             │
├────────────────────────────┴───────────────────────────────────────────────┤
│ TRANSACTIONS  Platform [All ▼] Type [All ▼] [Date]–[Date] [Search]       │
├──────────┬───────────┬────────┬───────────────────────────────┬────────────┤
│ Date     │ Platform  │ Type   │ Description                   │ Amount     │
├──────────┼───────────┼────────┼───────────────────────────────┼────────────┤
│ 26/08/26 │ MCOM Mall │ DEBIT  │ Gold Package — Aug 26         │ -50.00     │
│ 24/08/26 │ System    │ CREDIT │ Wallet Top-Up                 │+200.00     │
│ 23/08/26 │ Rewards   │ CREDIT │ Campaign Cashback #5          │ +15.00     │
└──────────┴───────────┴────────┴───────────────────────────────┴────────────┘
  Page 1 of 4                                               Total: 18 txns
```

### 15.4 Admin Reports Screen

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Wallet Reports       Date: [2026-08-01] to [2026-08-31]                   │
├─────────────────────────────────────────────────────────────────────────-──┤
│  PLATFORM SUMMARY                                                           │
│  Platform        │ Debits      │ Credits      │ Net Flow  │ Txn Count       │
│  ────────────────┼─────────────┼──────────────┼───────────┼───────────      │
│  MCOM Mall       │ 24,500 MCOM │   2,100 MCOM │ -22,400   │   412           │
│  MCOM Rewards    │  1,200 MCOM │  18,500 MCOM │ +17,300   │   289           │
│  VemTap          │  8,900 MCOM │     500 MCOM │  -8,400   │   134           │
│  System (Top-Up) │           — │  65,000 MCOM │ +65,000   │   201           │
├─────────────────────────────────────────────────────────────────────────-──┤
│  DAILY VOLUME — [line chart: credits vs debits per day]                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 16. Frontend — User Wallet UI

Route: `/dashboard/wallet`

### 16.1 Wallet Dashboard

```
┌────────────────────────────────────────────────────────────────────────────┐
│  My Wallet                                              [Top Up Wallet]    │
├─────────────────────────┬──────────────────────────────────────────────────┤
│  MCOM Balance           │  This Month                                      │
│  1,250.00 MCOM          │  ▼ Spent:    320.00   ▲ Received: 540.00        │
│  Available: 1,200.00    │  Net: +220.00                                    │
├─────────────────────────┴──────────────────────────────────────────────────┤
│  SPENDING BY PLATFORM (30 days)                                             │
│  MCOM Mall    ████████████████████  120.00 MCOM (46%)                      │
│  VemTap       ████████████           80.00 MCOM (31%)                      │
│  247GBS       ████████               60.00 MCOM (23%)                      │
├────────────────────────────────────────────────────────────────────────────┤
│  TRANSACTIONS  [All Platforms ▼] [All Types ▼] [This Month ▼] [Search]   │
│                                                                            │
│  26 Aug 2026                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 🏪 MCOM Mall                              -50.00 MCOM              │   │
│  │ Gold Package Subscription — Aug 2026                               │   │
│  │ Ref: sub_inv_0042 · 11:15 AM                         [Details →]  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 💰 Wallet Top-Up                         +200.00 MCOM              │   │
│  │ Stripe — Card ending 4242 · 09:00 AM                 [Details →]  │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│  [Load More]                                             Page 1 of 4       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Top-Up Flow

```
Click "Top Up Wallet"
  → Modal: enter amount (min £5, max £500) + select provider
  → POST /api/v1/wallet/topup/initiate → returns Stripe checkout URL
  → Redirect to Stripe Checkout
  → Payment succeeds → Stripe webhook → wallet credited
  → Redirect back → success toast → balance updated
```

---

## 17. Testing Strategy

### 17.1 Key Integration Tests

```typescript
it('debits wallet and creates ledger entry atomically');
// Credit 100 → debit 50 → balance = 50, one DEBIT ledger entry

it('rejects debit with insufficient balance → 422 INSUFFICIENT_BALANCE');
// Credit 10 → debit 50 → error

it('returns cached result on retry with same idempotency key');
// Debit with key A → debit again with key A → same transactionId, balance not double-debited

it('prevents concurrent debits via wallet lock');
// Two concurrent 60-debit on 100-balance wallet → exactly one succeeds, final balance = 40

it('auto-releases holds past expiresAt');
// Place hold → advance time → run expiry job → HoldStatus = EXPIRED, balance restored

it('detects balance drift in reconciliation');
// Manually corrupt Wallet.balance → reconciliation report hasDiscrepancy = true
```

### 17.2 E2E Tests (Supertest)

```typescript
// 401 — missing auth headers
// 401 — invalid HMAC signature
// 422 — insufficient balance
// 200 — valid debit
// 200 — retry with same idempotency key returns same transactionId
// 409 — concurrent debit while lock held
// Admin freeze → 403 on all partner ops → unfreeze → 200 again
```

---

## 18. Deployment & Migration Checklist

### 18.1 Pre-Deployment

```bash
# 1. Backup
pg_dump $DATABASE_URL > backup_pre_wallet_$(date +%Y%m%d).sql

# 2. Run migration (additive — production safe)
npx prisma migrate deploy
npx prisma migrate status
```

### 18.2 New Environment Variables

```env
WALLET_MAX_SINGLE_TXN=10000
WALLET_DEFAULT_DAILY_LIMIT=50000
WALLET_HOLD_DEFAULT_TTL_HOURS=24
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Optional:
PAYSTACK_SECRET_KEY=sk_...
PAYSTACK_WEBHOOK_SECRET=...
```

### 18.3 Deployment Order

```
1. Run Prisma migration (no code — data safe)
2. Deploy backend with wallet module (new routes only — backward compatible)
3. Deploy frontend wallet UI (new tab — no existing tabs affected)
4. Enable wallet auto-creation for new user registrations
5. Run backfill script for existing users
6. Enable partner platforms one by one
```

### 18.4 Existing User Backfill Script

```typescript
// scripts/backfill-wallets.ts
const users = await prisma.user.findMany({ where: { wallet: null } });
console.log(`Backfilling ${users.length} users...`);
for (const user of users) {
  await prisma.wallet.upsert({
    where: { userId: user.id },
    create: { userId: user.id, balance: 0, currency: 'MCOM', status: 'ACTIVE' },
    update: {}, // No-op if already exists
  });
  process.stdout.write('.');
}
console.log('\nDone.');
```

```bash
npx ts-node scripts/backfill-wallets.ts
```

### 18.5 Post-Deployment Verification

```bash
# Table exists
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Wallet";'

# User endpoint returns 200
curl -H "Authorization: Bearer <user_token>" https://api.mcomsolutions.com/api/v1/wallet

# Partner endpoint is guarded — expect 401
curl -X POST https://api.mcomsolutions.com/api/v1/wallet/partner/debit \
  -H "Content-Type: application/json" -d '{}'

# Reconciliation shows zero discrepancies on fresh wallets
curl -H "Authorization: Bearer <admin_token>" \
  https://api.mcomsolutions.com/api/v1/wallet/admin/reports/reconciliation
```

---

## 19. Implementation Execution Order

### Phase 1 — Data Layer (Week 1)
- [ ] Prisma schema (5 new models)
- [ ] `decimal.util.ts` + `wallet-lock.util.ts`
- [ ] Deploy migration to production
- [ ] Run backfill script for existing users

### Phase 2 — Core Wallet Service (Week 1-2)
- [ ] `WalletService.debitWallet()` — full idempotency + lock + atomic $transaction
- [ ] `WalletService.creditWallet()`
- [ ] `WalletHmacGuard`
- [ ] `checkIdempotency()` with Redis + DB fallback
- [ ] Unit + integration + E2E tests
- [ ] Deploy `/api/v1/wallet/partner/*`

### Phase 3 — Ledger, Filtering, User API (Week 2)
- [ ] `WalletLedgerService` with full query builder + all filters
- [ ] `getWalletSummary()` with groupBy aggregates
- [ ] Deploy `/api/v1/wallet/*` user-facing

### Phase 4 — Admin API & Console UI (Week 2-3)
- [ ] `WalletAdminController` — all endpoints
- [ ] `WalletAuditLog` capture on every admin action
- [ ] Transaction reversal (compensating entry pattern — never edit original)
- [ ] Admin wallet list, detail, adjust, freeze UI
- [ ] Admin reports (platform summary, daily volume, reconciliation)

### Phase 5 — Top-Up & Payment Gateway (Week 3)
- [ ] `WalletTopUpService`
- [ ] Stripe webhook integration
- [ ] User top-up flow UI

### Phase 6 — User Wallet UI (Week 3-4)
- [ ] Wallet dashboard widget in user dashboard
- [ ] Full `/dashboard/wallet` page with filters
- [ ] Transaction detail view

### Phase 7 — Reconciliation & Monitoring (Week 4)
- [ ] Nightly reconciliation job (2AM cron)
- [ ] Hold expiry job (every 5 min cron)
- [ ] Alerts on reconciliation discrepancy + error rate spikes

### Phase 8 — Partner Onboarding (Ongoing)
- [ ] MCOM Mall → MCOM Rewards → VemTap → 247GBS → future platforms via Console

---

## 20. Future Extensions

| Feature | Architecture Support |
|---|---|
| **Multi-currency** | `Wallet.currency` + `WalletTransaction.currency` already present |
| **Wallet-to-wallet transfers** | `TRANSFER_IN/OUT` categories in schema; add `transfer()` service method |
| **Crypto top-up** | New provider in `WalletTopUpService`; schema unchanged |
| **Escrow / Marketplace** | `WalletHold` already supports the pattern |
| **Spending push notifications** | Hook into post-transaction event emitter |
| **Loyalty ↔ MCOM credits** | MCOM Rewards calls `/partner/credit` with `category: REWARD` |
| **KYC/AML for large top-ups** | Add `kycStatus` to `Wallet`; gate high-value top-ups |
| **Auto-pay subscriptions** | Scheduled job with deterministic idempotency key from invoice ID |
| **Statement PDF export** | All data already in `WalletTransaction`; format and stream as PDF |

---

## Appendix — Quick Reference for Partner Engineers

```
Base URL:     https://api.mcomsolutions.com
API Prefix:   /api/v1/wallet/partner

Required Headers (all writes):
  X-Mcom-Client-ID     → your clientId from Console
  X-Mcom-Signature     → sha256=HMAC-SHA256(rawBody, hmacSecret)
  X-Idempotency-Key    → unique-per-business-event string
  Content-Type         → application/json

Key Endpoints:
  GET  /partner/balance/:userId          Check user's wallet balance
  POST /partner/debit                    Debit user wallet
  POST /partner/credit                   Credit user wallet (reward/refund)
  POST /partner/hold/place               Reserve funds
  POST /partner/hold/capture             Convert hold to debit
  POST /partner/hold/release             Release hold
  GET  /partner/transactions/:userId     Your transactions for this user (scoped)

Error Codes:
  INSUFFICIENT_BALANCE  → Prompt user to top up at /dashboard/wallet
  WALLET_FROZEN         → Contact Mcom support
  WALLET_LOCKED         → Retry after 1-2 seconds (use same idempotency key)
  INVALID_SIGNATURE     → Verify/rotate HMAC secret in Mcom Console
  RATE_LIMITED          → Exponential backoff

Console:    https://mcomsolutions.com/admin/console
```

---

> **Document Version**: 1.0.0
> **Last Updated**: 2026-08-26
> **Review Required By**: Backend Lead, Security Lead, Finance/Compliance
