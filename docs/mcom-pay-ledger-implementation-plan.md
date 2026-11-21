# MCOM Pay → Central Ledger — Implementation Plan

> **Status**: Proposed (pre-implementation). **Progress is tracked in `docs/mcom-pay-ledger-progress.md`** — Phases 0–4 are applied: migrations deployed, history backfilled, books reconciled, every live money path posts through the ledger, and charges can split to payees with an approval-gated payout flow. Phase 5 (retry jobs, delegation trail, admin read surface) is done; Phases 0–6 are done: the ledger is live, the admin console has its tabs, and analytics are rolled up. Remaining: payout UI and retiring the legacy ledger table.
> **Scope**: `/admin/mcom-pay` internals, the platform's own wallet, wallet-to-wallet money movement, transaction intents, ledger visibility, per-platform analytics.
> **Basis**: audit of the current codebase on 2026-11-20, plus the currency and referral corrections agreed on 2026-11-20.
> **Decisions already locked**: see §2.

---

## Table of Contents

1. [What exists today (audit)](#1-what-exists-today-audit)
2. [Locked decisions](#2-locked-decisions)
3. [The problem that must be fixed first](#3-the-problem-that-must-be-fixed-first)
4. [Target architecture](#4-target-architecture)
5. [Chart of accounts](#5-chart-of-accounts)
6. [How each money flow posts](#6-how-each-money-flow-posts)
7. [Database changes](#7-database-changes)
8. [Backend design](#8-backend-design)
9. [API surface](#9-api-surface)
10. [Analytics model](#10-analytics-model)
11. [Frontend plan](#11-frontend-plan)
12. [Retiring MCOM credits](#12-retiring-mcom-credits)
13. [Backfill & cutover](#13-backfill--cutover)
14. [Testing](#14-testing)
15. [Risks & mitigations](#15-risks--mitigations)
16. [Phased delivery](#16-phased-delivery)
17. [Open questions](#17-open-questions)

---

## 1. What exists today (audit)

### 1.1 The wallet subsystem — `apps/backend/src/wallet`

| Piece | Reality |
|---|---|
| `Wallet` | One row per `User` (`userId @unique`), `balance Decimal(18,4)`, `currency` default `"MCOM"`, status ACTIVE/FROZEN/SUSPENDED/CLOSED (`prisma/schema.prisma:2362`) |
| `WalletTransaction` | **Single-entry, per wallet.** `type CREDIT\|DEBIT`, `amount`, `balanceBefore`, `balanceAfter`, `category` (11 values), `platformClientId/Name/Slug`, `reference`, `metadata`, `idempotencyKey @unique` (`schema.prisma:2388`) |
| `WalletHold` | Pre-authorisation with expiry; captured or released (`schema.prisma:2434`) |
| `WalletTopUpRequest` | GBP in → MCOM credits out, `exchangeRate` snapshotted (`schema.prisma:2479`) |
| `FxRate` | `base/quote/rate`; env fallback `MCOM_GBP_RATE` default `1` (`schema.prisma:2511`, `wallet-topup.service.ts:316`) |
| Partner API | `POST /wallet/partner/{debit,credit,hold/*}`, `GET /wallet/partner/balance/:userId` — HMAC (`wallet-partner.controller.ts`) |
| User API | `/wallet`, `/wallet/transactions`, `/wallet/topup/*`, `/wallet/holds`, `/wallet/summary` (`wallet.controller.ts`) |
| Admin API | freeze/close, manual credit/debit, limits, reverse, `reports/platform-summary`, `reports/daily-volume`, `reports/reconciliation` (`wallet-admin.controller.ts`) |
| Locking | Redis lock + `SELECT … FOR UPDATE` + relative `increment/decrement` (`wallet.service.ts:113-260`) |

Sound single-entry bookkeeping. It answers "what did this user's balance do" and nothing else.

### 1.2 MCOM Pay — `apps/backend/src/app-payments`

| Piece | Reality |
|---|---|
| `AppCharge` | `amountMinor BigInt` (pence), `feeMinor`, `netMinor`, `refundedMinor`, `method stripe\|paypal\|wallet`, status, **payer only** (`mcomUserId`), per-app idempotency + request hash (`schema.prisma:351`) |
| `AppRefund` | One row per refund attempt (`schema.prisma:398`) |
| `AppPaymentLedgerEntry` | Real double-entry, but accounts are a **global enum**: `gateway_clearing \| wallet_clearing \| app_payable \| mcom_revenue \| refund` (`schema.prisma:343, 465`) |
| Posting | debit clearing / credit `app_payable` (net) / credit `mcom_revenue` (fee) (`app-payments-ledger.service.ts:152`) |
| Fees | `SsoClient.feePercent` + `feeFixedMinor`, fallback `ProgrammeSetting` (`schema.prisma:518`) |
| Outbox | `AppPaymentOutbox`, `ProcessedWebhookEvent`, partner webhook retries (`schema.prisma:427, 444`) |

### 1.3 Affiliate delegation — `affiliate/affiliate-settlement.service.ts`

The only place money moves between two users' wallets today:

1. `placeHold` on the business wallet
2. on approval: `captureHold` → business debit (`HOLD_CAPTURE`)
3. `creditWallet` → affiliate credit (`TRANSFER_IN`)
4. fee + margin → `RevenueRecord`

Two independent `WalletTransaction` rows, correlated only by a free-text `reference`. `AffiliateTaskSettlement` does already store the exact split (`businessChargePence`, `compensationPence`, `platformFeeCredits`, `platformMarginCredits`, `affiliatePayoutCredits`, `fundingSource` — `schema.prisma:2906`), so the ledger legs can be read straight off it.

### 1.4 Referral commissions — `referrals/referral-commission.service.ts`

- Called from **6 sites**: `pricing.service.ts:636,1023`, `access.service.ts:637,843,1348`, `recurring.service.ts:1003` — always fire-and-forget via `void`.
- Computes the reward from `ReferralConfig`, creates a `ReferralCommission` row (PENDING → CREDITED/FAILED), then **credits the referrer's wallet with newly created money** (`creditWallet`, `:218`).
- **There is no debit anywhere.** The platform mints the commission. And there is **no cron**, so `PENDING`/`FAILED` commissions are never retried.
- `commissionCredits = commissionAmountGbp × fxRate` (`:177`) — MCOM conversion baked in.

This is exactly the flow the user corrected: the commission must come **out of the platform's own wallet**.

### 1.5 Membership / plan revenue

| Writer | Location |
|---|---|
| Stripe/PayPal activation | `payment/payment.service.ts:2803, 3288` → `BillingTransaction` |
| Wallet auto-renewal | `recurring/recurring.service.ts:1216` → `debitWallet` + `BillingTransaction` (`:1082`) |
| Plan purchase | `pricing/pricing.service.ts` → `BillingTransaction` |
| Access pass | `access/access.service.ts` → wallet debit + `AccessPurchase` |

`RevenueRecord` (`schema.prisma:1762`) is a `Float` + `YYYY-MM-DD` string reporting table with no platform dimension. It is not a ledger.

### 1.6 Admin UI — `/admin/mcom-pay`

`AdminDashboard.tsx:65-67` derives the tab from the path segment, so `/admin/mcom-pay` renders `McomPayPanel` (`:209-210`). Two views only: **charge ledger** and **raw wallet activity**. No balances, no platform wallet, no analytics.

### 1.7 What the current system cannot answer

| Question | Today |
|---|---|
| "What is the platform's own balance?" | **No.** There is no platform account; `mcom_revenue` is an enum value, not an instance. |
| "Customer A −£90, Business B +£87.19 — show the pair" | **No.** No shared id between legs; Mall cannot even name a payee. |
| "Where did our referral commissions come from?" | **No.** They are created from nothing, with no funding leg. |
| "Money in per platform, over time" | **Partial.** `reports/platform-summary` covers `WalletTransaction` only — no gateway charges, no time series by platform. |
| "What was this for — order, booking, delegation, purchase, commission?" | **No.** Only `category` + free text. |

---

## 2. Locked decisions

These were confirmed and drive the design:

1. **One currency: GBP.** MCOM credits are retired. No in-house currency.
2. **Mall is wallet-to-wallet.** Buying a product or booking a service debits the buyer and credits the seller's wallet.
3. **Card payments follow the same path.** Stripe/PayPal money is charged from the buyer and credited to the seller's wallet. The gateway is just the funding source.
4. **Platform-bound money goes to the platform's own wallet.** Plans, memberships, access passes and fees credit `platform:wallet:GBP`, so the platform has a real, visible balance and its own ledger.
5. **Referral commission is funded by the platform.** We credit our wallet on the purchase, then **debit our wallet** to credit the referrer. Two legs, both in the ledger.
6. **Delegation is business-wallet → affiliate-wallet**, with fee/margin staying in the platform wallet. Platform-funded delegations debit the platform wallet instead.
7. **No riders.** Referral and commission are in scope; delivery/riders are not.

---

## 3. The problem that must be fixed first

Today a £90 Mall order paid from a wallet writes **two records of one event**:

```
wallet_transactions            app_payment_ledger_entries
  wallet:<customer> −90 MCOM     debit  wallet_clearing   9000 GBP pence
  (single side)                  credit app_payable      8719
                                 credit mcom_revenue      281
        └──── no link ──────────┘
```

Two units, two books, no join. `reports/reconciliation` only checks wallets against wallet rows, so a divergence between the books is undetectable. Meanwhile the **seller is never credited** — `AppCharge` has no payee field.

The fix is a single journal where every economic event is one balanced transfer, and both the buyer's and seller's wallet rows are projections of it.

---

## 4. Target architecture

### 4.1 Principles

1. **One journal, posted once.** `GlPostingService` is the only writer of money; every flow calls it inside an existing DB transaction.
2. **Every transaction balances.** `Σdebits == Σcredits`, enforced in code and by a deferred DB trigger.
3. **A `GlTransfer` is one business event.** It may contain several balanced transactions (e.g. gateway → platform → seller). The admin drill-down shows the whole trail.
4. **Two layers.** `GlTransfer/GlTransaction/GlEntry` are the books. `WalletTransaction` remains the **user's receipt** (same API contract) and gains `intent`, `transferId`, `counterpartyWalletId`.
5. **Balances are materialised and reconciled**, never summed at read time.
6. **Money is integer pence (`BigInt`).** `Wallet.balance` stays `Decimal(18,4)` GBP for API compatibility.
7. **Immutability.** No updates, no deletes. Corrections are reversing transfers.

### 4.2 Shape

```
                        ┌─────────────────────────────────────────┐
  Mall / 247GBS ───────▶│           GlPostingService               │
  Wallet module ───────▶│  resolve accounts → assert balanced      │
  MCOM Pay ────────────▶│  → lock (sorted) → write transfer +      │
  Membership ──────────▶│    transactions + entries → move balances│
  Referral ────────────▶└───────────────┬─────────────────────────┘
  Delegation ──────────▶                │
                                        ▼
                     GlTransfer ── GlTransaction ── GlEntry ──▶ GlAccount.balanceMinor
                          │              │              └──────▶ WalletTransaction (receipt)
                          └──────────────┴─────────────────────▶ GlDailyRollup (analytics)
```

### 4.3 Account model

Accounts are **instances identified by a code**, not enum values:

```
wallet:<walletId>          a user's wallet (business, customer, affiliate, agent…)
platform:wallet:GBP        the platform's own wallet (one row, system account)
gateway:stripe:GBP         money held at the PSP, not yet banked
gateway:paypal:GBP
bank:GBP                   money in the bank account
payable:app:<clientId>     money an external app is owed (only if it isn't a wallet holder)
equity:opening:GBP         counterparty for backfilled history
suspense:GBP               unmatched gateway money awaiting investigation
```

There are **no `revenue` accounts**. Revenue is not a balance we hold — it is money that entered `platform:wallet:GBP` and did not leave. That keeps one truthful "our money" figure, which is what was asked for, and the gross/net split is recovered from intents (§10).

---

## 5. Chart of accounts

| Type | Code | Meaning | Normal side | Counted in |
|---|---|---|---|---|
| `ASSET_GATEWAY_CLEARING` | `gateway:stripe:GBP`, `gateway:paypal:GBP` | Funds at the PSP, pre-bank-settlement | debit | Assets |
| `ASSET_BANK` | `bank:GBP` | Bank balance | debit | Assets |
| `PLATFORM_WALLET` | `platform:wallet:GBP` | **The platform's wallet** | credit | Equity (excluded from user float) |
| `LIABILITY_USER_WALLET` | `wallet:<walletId>` | What we owe a user | credit | User float |
| `LIABILITY_APP_PAYABLE` | `payable:app:<clientId>` | What we owe a non-wallet partner | credit | Payables |
| `LIABILITY_PAYABLE` | `payable:payee:<ref>` | Owed to a named external payee | credit | Payables |
| `SUSPENSE` | `suspense:GBP` | Unidentified incoming money | credit | Suspense |
| `EQUITY_OPENING` | `equity:opening:GBP` | Backfill counterparty | credit | Equity |

The balance-sheet identity becomes checkable on demand, which is a much stronger control than today's per-wallet check:

```
ASSET_GATEWAY_CLEARING + ASSET_BANK
  = LIABILITY_USER_WALLET + LIABILITY_APP_PAYABLE + LIABILITY_PAYABLE + LIABILITY (suspense)
  + PLATFORM_WALLET + EQUITY_OPENING
```

**Why the platform wallet is not a user wallet:** it has no `userId`, it is never a liability to a customer, and it must be excluded from float metrics and from `/wallet/admin/wallets`. It gets its own account, its own ledger view, and its own card in the admin UI.

---

## 6. How each money flow posts

All amounts in pence. `platform:wallet` is the platform's own wallet.

### 6.1 Wallet top-up — £50 by Stripe

```
intent: TOP_UP            platform: mcom-central
T: debit  gateway:stripe:GBP     5000
   credit wallet:<user>          5000
```
Processing fees are handled one of two ways (see Q4):

- **Net (Phase 1, recommended):** book the amount that actually clears. The PSP fee stays in the provider's own reporting; `AppCharge.feeMinor` remains our *commercial* fee, a different thing from the PSP's cost.
- **Gross (later, for bank reconciliation):** book `debit gateway:stripe:GBP 5000 / credit wallet:<user> 5000`, then a separate `intent: FEE` transfer for the PSP cost. Requires ingesting the PSP fee from the balance-transaction webhook.

### 6.2 Mall order £90, paid from the buyer's wallet

Fee 2.9% + 20p = £2.81 → seller net £87.19.

```
intent: ORDER             platform: mcom-mall         reference: order_12345
T: debit  wallet:<buyer>          9000     ← −£90.00
   credit wallet:<seller>         8719     ← +£87.19
   credit platform:wallet:GBP      281     ← +£2.81 (our fee)
```

One transfer, three legs, both sides of the user's "−90 / +90" visible in a single row.

### 6.3 Mall order £90, paid by card

Same economics, gateway is only the funding source. One transfer, two transactions:

```
T1: debit  gateway:stripe:GBP     9000
    credit platform:wallet:GBP    9000      ← money in
T2: debit  platform:wallet:GBP    8719
    credit wallet:<seller>        8719      ← money allocated
```

The £2.81 fee is simply what remained in the platform wallet. `GlTransfer` links T1 and T2, so the drawer shows funding → allocation for one order.

### 6.4 Membership / plan / access pass — £29

```
intent: PURCHASE (or SUBSCRIPTION for renewals)     platform: mcom-central
Card:    T1: debit gateway:stripe:GBP 2900 / credit platform:wallet:GBP 2900
Wallet:  T : debit wallet:<buyer>     2900 / credit platform:wallet:GBP 2900
```

That is the whole posting. The platform's balance rises immediately and is visible in real time.

### 6.5 Referral commission — £5 on the £29 purchase

Funded by us, as specified:

```
intent: REFERRAL_COMMISSION     platform: mcom-central   reference: purchase:<billingTxnId>
T: debit  platform:wallet:GBP     500
   credit wallet:<referrer>       500
```

If the commission is 20% of a £29 purchase, the platform wallet received £29 in §6.4 and gives back £5 — net £24. No money is created.

**Ordering & atomicity:** §6.4 posts at purchase activation. §6.5 posts when the commission row is evaluated. Both are independently idempotent (`purchase:<billingTxnId>`, `referral:<commissionId>`), because the existing call sites are fire-and-forget (`void`).

**Insufficient funds:** if `platform:wallet` cannot cover the commission (possible on a one-off configuration error), the commission stays `PENDING` with `failureReason = INSUFFICIENT_PLATFORM_BALANCE` and a cron retries it. It never silently mints money and never drives the platform wallet negative. See Q1.

### 6.6 Delegation, business-funded

£100 business charge, £80 affiliate, £5 fee, £15 margin:

```
intent: DELEGATION        platform: 247gbs-affiliate     reference: affiliate-task:<taskId>
T: debit  wallet:<business>        10000
   credit wallet:<affiliate>        8000
   credit platform:wallet:GBP       2000     ← fee + margin
```

One transfer replaces the two unlinked rows. `AffiliateTaskSettlement` keeps its transaction ids, now backed by real entries.

### 6.7 Delegation, platform-funded (paid membership allowance)

```
intent: DELEGATION
T: debit  platform:wallet:GBP       8000
   credit wallet:<affiliate>        8000
```

The platform funds the payout — matching today's `fundingSource = PLATFORM`, but now it actually costs us money on the books.

### 6.8 Refund — partial £20

Wallet-funded order:
```
intent: REFUND
T: debit  wallet:<seller>          1938    ← net proportion
   debit  platform:wallet:GBP        62    ← fee proportion returned
   credit wallet:<buyer>           2000
```

Card-funded order (money must leave via the gateway):
```
intent: REFUND
T: debit  wallet:<seller>          1938
   debit  platform:wallet:GBP        62
   credit gateway:stripe:GBP       2000
```

Fee proration reuses the hardened `computeRefundFee` (`app-payments-ledger.service.ts:127`). This confirms the existing policy that the fee is refundable — see Q3.

### 6.9 Platform wallet → bank (real cash out)

```
intent: PAYOUT
T: debit  bank:GBP
   credit gateway:stripe:GBP       ← PSP settles to bank
```
This is a treasury movement, not revenue. Optionally recorded in Phase 6 when bank reconciliation is in scope.

### 6.10 Partner app debit/credit (existing `/wallet/partner/*`)

An external app that is **not** a wallet holder (e.g. an app charging for its own service):

- Debit user: `debit wallet:<user> / credit payable:app:<clientId>`
- Credit user: `debit payable:app:<clientId> / credit wallet:<user>`

An app payable may go negative — that is the app owing us, which should be visible in the payables view.

### 6.11 Admin manual adjustment

```
intent: ADJUSTMENT
T: debit|credit wallet:<user>  /  opposing leg on equity:opening:GBP
```
Reason is mandatory (already enforced by `WalletAuditLog`).

---

## 7. Database changes

All additive. The `Gl*` prefix avoids the existing `LedgerAccount` enum (`schema.prisma:343`).

### 7.1 New enums

```prisma
enum GlAccountType {
  ASSET_GATEWAY_CLEARING
  ASSET_BANK
  PLATFORM_WALLET
  LIABILITY_USER_WALLET
  LIABILITY_APP_PAYABLE
  LIABILITY_PAYABLE
  SUSPENSE
  EQUITY_OPENING
}

enum GlIntent {
  ORDER
  BOOKING
  DELEGATION
  PURCHASE
  SUBSCRIPTION
  REFERRAL_COMMISSION
  TOP_UP
  REFUND
  PAYOUT
  TRANSFER
  ADJUSTMENT
  FEE
  CHARGEBACK
  OPENING_BALANCE
}

enum GlEntryDirection { debit credit }
enum GlTransactionStatus { pending posted reversed }
enum GlAccountStatus { ACTIVE FROZEN CLOSED }
```

### 7.2 New models

```prisma
model GlAccount {
  id           String          @id @default(cuid())
  code         String          @unique          // 'platform:wallet:GBP', 'wallet:<id>', 'gateway:stripe:GBP'
  type         GlAccountType
  currency     String          @default("GBP")
  scope        String                            // 'platform' | 'wallet' | 'app' | 'payee' | 'gateway'
  ownerRef     String?                           // walletId | clientId | provider | null
  balanceMinor BigInt          @default(0)       // materialised; == Σ entries
  status       GlAccountStatus @default(ACTIVE)
  isSystem     Boolean         @default(false)
  metadata     Json?
  createdAt    DateTime        @default(now()) @map("created_at")
  updatedAt    DateTime        @updatedAt @map("updated_at")

  entries      GlEntry[]

  @@index([type, currency])
  @@index([scope, ownerRef])
  @@index([status])
  @@map("gl_accounts")
}

model GlTransfer {
  id             String      @id @default(cuid())
  intent         GlIntent
  platformId     String?     @map("platform_id")      // SsoClient.clientId; null = platform-internal
  reference      String?                              // order id, task id, charge id, billing txn id
  description    String?
  initiatorType  String      @map("initiator_type")   // user | app | admin | system
  initiatorId    String?     @map("initiator_id")
  idempotencyKey String      @unique @map("idempotency_key")
  reversalOfId   String?     @unique @map("reversal_of_id")
  metadata       Json?
  createdAt      DateTime    @default(now()) @map("created_at")

  transactions   GlTransaction[]

  @@index([platformId, createdAt(sort: Desc)])
  @@index([intent, createdAt(sort: Desc)])
  @@index([reference])
  @@index([createdAt(sort: Desc)])
  @@map("gl_transfers")
}

model GlTransaction {
  id                    String              @id @default(cuid())
  transferId            String              @map("transfer_id")
  transfer              GlTransfer          @relation(fields: [transferId], references: [id], onDelete: Restrict)
  currency              String              @default("GBP")
  amountMinor           BigInt              @map("amount_minor")   // Σ debits for this transaction
  status                GlTransactionStatus @default(posted)
  reversesTransactionId String?             @unique @map("reverses_transaction_id")
  postedAt              DateTime            @default(now()) @map("posted_at")

  entries               GlEntry[]

  @@index([transferId])
  @@index([postedAt])
  @@map("gl_transactions")
}

model GlEntry {
  id                  String           @id @default(cuid())
  transactionId       String           @map("transaction_id")
  transaction         GlTransaction    @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  accountId           String           @map("account_id")
  account             GlAccount        @relation(fields: [accountId], references: [id], onDelete: Restrict)
  direction           GlEntryDirection
  amountMinor         BigInt           @map("amount_minor")
  currency            String           @default("GBP")

  // provenance — at most one set
  walletTransactionId String?          @unique @map("wallet_transaction_id")
  appChargeId         String?          @map("app_charge_id")
  appRefundId         String?          @map("app_refund_id")
  settlementId        String?          @map("settlement_id")
  referralCommissionId String?         @map("referral_commission_id")

  createdAt           DateTime         @default(now()) @map("created_at")

  @@index([accountId, createdAt(sort: Desc)])
  @@index([transactionId])
  @@index([appChargeId])
  @@index([referralCommissionId])
  @@index([createdAt(sort: Desc)])
  @@map("gl_entries")
}

model GlDailyRollup {
  id          String    @id @default(cuid())
  date        String                                  // YYYY-MM-DD (UTC)
  platformId  String    @default("mcom-central") @map("platform_id")
  intent      GlIntent
  currency    String    @default("GBP")
  debitMinor  BigInt    @default(0) @map("debit_minor")
  creditMinor BigInt    @default(0) @map("credit_minor")
  txnCount    Int       @default(0) @map("txn_count")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  @@unique([date, platformId, intent, currency])
  @@index([date])
  @@map("gl_daily_rollups")
}
```

### 7.3 Additive columns on existing models

```prisma
model WalletTransaction {
  // …existing fields unchanged…
  intent               GlIntent?  @map("intent")
  transferId           String?    @map("transfer_id")            // GlTransfer.id
  counterpartyWalletId String?    @map("counterparty_wallet_id")
  ledgerEntryId        String?    @unique @map("ledger_entry_id") // GlEntry.id

  @@index([intent])
  @@index([transferId])
}

model AppCharge {
  intent          GlIntent @default(ORDER)
  payeeType       String?  @map("payee_type")   // 'mcom_user' | 'external'
  payeeRef        String?  @map("payee_ref")
  transferId      String?  @map("transfer_id")
  settlementState String   @default("NA") @map("settlement_state") // NA | PENDING | SETTLED | FAILED
}

model AppChargeSplit {
  id                  String    @id @default(cuid())
  chargeId            String    @map("charge_id")
  charge              AppCharge @relation(fields: [chargeId], references: [id], onDelete: Cascade)
  payeeType           String    @map("payee_type")    // mcom_user | external
  payeeUserId         String?   @map("payee_user_id")
  payeeExternalId     String?   @map("payee_external_id")
  amountMinor         BigInt    @map("amount_minor")  // gross share
  feeMinor            BigInt    @default(0) @map("fee_minor")
  netMinor            BigInt    @map("net_minor")
  status              String    @default("pending")   // pending | credited | payable | failed
  walletTransactionId String?   @map("wallet_transaction_id")
  failureReason       String?   @map("failure_reason")
  createdAt           DateTime  @default(now()) @map("created_at")

  @@index([chargeId])
  @@index([payeeUserId])
  @@index([status])
  @@map("app_charge_splits")
}

model ReferralCommission {
  // …existing fields unchanged…
  purchaseTransferId String? @map("purchase_transfer_id")  // the platform receipt
  payoutTransferId   String? @map("payout_transfer_id")    // our debit → referrer credit
  retryCount         Int     @default(0) @map("retry_count")
  nextRetryAt        DateTime? @map("next_retry_at")
}
```

### 7.4 Integrity trigger (hand-written migration)

```sql
CREATE OR REPLACE FUNCTION gl_assert_transaction_balanced() RETURNS trigger AS $$
DECLARE d numeric; c numeric;
BEGIN
  SELECT
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'debit'), 0),
    COALESCE(SUM(amount_minor) FILTER (WHERE direction = 'credit'), 0)
  INTO d, c
  FROM gl_entries WHERE transaction_id = NEW.transaction_id;

  IF d <> c THEN
    RAISE EXCEPTION 'gl_transaction % unbalanced: debit %, credit %', NEW.transaction_id, d, c;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER gl_entries_balanced
  AFTER INSERT OR UPDATE ON gl_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION gl_assert_transaction_balanced();
```

An unbalanced journal becomes physically impossible, not just test-caught.

> Repository warning (`docs/app-payments-hardening.md`): `prisma migrate dev` reports `20261021000000_add_coupons` as modified. **Write these migrations by hand and apply with `migrate deploy`.**

---

## 8. Backend design

### 8.1 New module — `apps/backend/src/ledger/`

```
ledger/
├── ledger.module.ts
├── chart-of-accounts.service.ts      // resolve/create accounts by code; seeds platform:wallet
├── gl-posting.service.ts             // the ONLY writer of money
├── ledger-query.service.ts           // transfers / accounts / entries
├── ledger-analytics.service.ts       // trends, rollups, per-platform
├── ledger-reconciliation.service.ts  // drift detection + cron
├── ledger-backfill.service.ts        // one-shot, idempotent
├── ledger-admin.controller.ts        // /admin/mcom-pay/*
├── dto/ + *.spec.ts
```

Registered in `app.module.ts` after `WalletModule`.

### 8.2 `GlPostingService` — the contract

```ts
post(params: {
  intent: GlIntent;
  platformId?: string | null;
  reference?: string | null;
  description?: string;
  initiatorType: 'user' | 'app' | 'admin' | 'system';
  initiatorId?: string;
  idempotencyKey: string;
  // One transfer may contain several balanced steps (gateway → platform → seller)
  transactions: Array<{
    legs: Array<{ account: string; direction: 'debit' | 'credit'; amountMinor: bigint }>;
  }>;
  metadata?: Prisma.InputJsonValue;
  provenance?: { appChargeId?: string; appRefundId?: string; settlementId?: string; referralCommissionId?: string };
}, tx: Prisma.TransactionClient): Promise<{ transferId: string }>
```

Inside:
1. Reject non-positive amounts, unknown accounts, mixed currencies.
2. Per transaction: reduce legs to per-account deltas (drop zeroes), assert `Σdebit == Σcredit`.
3. Collect all account codes across the transfer, sort, `SELECT … FOR UPDATE` in that order — deadlock-free for the 3–4 leg cases.
4. Insert `gl_transfer`; on `P2002` return the existing transfer (idempotent replay).
5. Insert transactions + entries.
6. Apply deltas with relative `increment/decrement`.
7. Guard: `LIABILITY_USER_WALLET` never goes negative; `PLATFORM_WALLET` may not go negative unless `allowNegative` is explicitly set (used by backfill only); `payable:*` may go negative by design.

### 8.3 Wallet integration

`wallet.service.ts` keeps its public methods, but a `WalletTransaction` is never written alone. A private helper wraps the existing row-lock transaction, calls `GlPostingService` with the wallet leg plus a counterparty, then writes the receipt row with `transferId`, `intent`, `counterpartyWalletId`, `ledgerEntryId`.

Signatures gain one optional argument (defaults preserve behaviour):

```ts
debitWallet(partner, dto, idempotencyKey, ipAddress, opts?: {
  intent?: GlIntent;
  counterparty?: { type: 'wallet'; id: string } | { type: 'platform' } | { type: 'app'; clientId: string };
  allowNegativeCounterparty?: boolean;
})
```

Existing callers that pass nothing default to `counterparty = { type: 'app', clientId: partner.clientId }`.

### 8.4 App-payments integration

- `markPaid` (`:1435`) → `postChargeSettlement` in the same transaction that claims the charge.
- `settleRefund` (`:669`) / `refundWallet` (`:933`) → `postRefund`.
- `createWalletCharge` (`:273`) → wallet debit only; settlement posts the buyer→seller transfer.
- **New:** `allocateSplits(totalNet, splits[])` with **largest-remainder rounding**, so `Σsplits == totalNet` exactly — never off by a penny.
- `wallet_clearing` account disappears; the wallet debit is the payer leg.

### 8.5 Membership integration

| Call site | Posting |
|---|---|
| `payment/payment.service.ts:2803, 3288` | `intent: PURCHASE`, gateway → platform wallet |
| `recurring/recurring.service.ts:1216, 1082` | `intent: SUBSCRIPTION`, wallet → platform wallet |
| `pricing/pricing.service.ts` | `intent: PURCHASE` / `BOOKING` for services |
| `access/access.service.ts` | `intent: PURCHASE`, wallet or gateway → platform wallet |

A safety-net reconciler scans `BillingTransaction` and `AccessPurchase` rows with no journal transfer and posts them idempotently — so a missed call site can never silently drop revenue.

### 8.6 Referral integration

`referral-commission.service.ts`:

1. Replace the `creditWallet` call (`:218`) with a `GlPostingService.post` (`intent: REFERRAL_COMMISSION`) that debits `platform:wallet:GBP` and credits the referrer's wallet, keyed `referral:<commissionId>`.
2. Store `payoutTransferId` on the commission row.
3. If the platform wallet cannot cover it, keep `PENDING` with a reason and set `nextRetryAt`; a cron retries (no cron exists today — this adds one).
4. Drop the `fxRate` / `commissionCredits` conversion entirely; `commissionAmountGbp` is the amount.

The purchase receipt (§6.4) is posted at the payment call site, not here, so the commission is always funded by the event that triggered it.

### 8.7 Affiliate delegation integration

`affiliate-settlement.service.ts` steps (2)–(3) become **one** `post` call with 3–4 legs, reading `businessChargePence`, `compensationPence`, `platformFeeCredits`, `platformMarginCredits`, `fundingSource` off `AffiliateTaskSettlement` (`schema.prisma:2906`). No new pricing logic. Retry/release paths are unchanged — they operate on holds.

### 8.8 Rollups

`@Cron` 01:10 UTC computes yesterday's `gl_daily_rollups`; an hourly job refreshes today's partial row. Rollups are derived and can always be rebuilt (`rebuild(dateRange)`).

---

## 9. API surface

### 9.1 New — admin (`/api/v1/admin/mcom-pay`, `JwtAuthGuard + ConsoleAdminGuard`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/overview` | Platform wallet balance, user float, payables, revenue today/30d, GMV 30d, commissions paid 30d, unreconciled count |
| GET | `/platform-wallet` | The platform's own wallet: balance + recent activity |
| GET | `/platform-wallet/transactions` | Paginated entries for `platform:wallet:GBP` (filters: intent, date, reference) |
| GET | `/accounts` | Chart of accounts with balances |
| GET | `/accounts/:code/entries` | Entries for one account |
| GET | `/transfers` | Filters: `intent`, `platformId`, `reference`, `dateFrom/To`, `accountCode`, `search` |
| GET | `/transfers/:id` | Full trail: every transaction + every debit/credit leg + provenance |
| GET | `/analytics/trend` | `metric=gmv\|revenue\|commissions\|float&groupBy=day\|week\|month&from&to&platformId&intent` |
| GET | `/analytics/by-platform` | Money in, GMV, fees, commissions, net per platform |
| GET | `/analytics/by-intent` | Volume + count per intent |
| GET | `/payables` | Per-app payable balances + aging |
| GET | `/reconciliation` | Journal vs wallet vs PSP drift |
| POST | `/reconciliation/rebuild` | Recompute balances from entries (audited) |

Responses use the existing envelope (`{ success, data, total, page, limit, totalPages }`), per `.agent/api-conventions.md`.

### 9.2 Extended — partner (`/api/v1/app-payments`)

`POST /charges` gains:

```jsonc
{
  "amountMinor": "9000",
  "currency": "GBP",
  "method": "wallet",              // or stripe | paypal
  "intent": "ORDER",               // required
  "reference": "order_12345",
  "mcomUserId": "usr_…",           // buyer
  "splits": [                      // omit → today's behaviour
    { "payeeType": "mcom_user", "payeeUserId": "usr_seller", "amountMinor": "9000" }
  ]
}
```

- `Σ splits.amountMinor` must equal `amountMinor` (422 otherwise).
- Fee is computed on the gross and apportioned across splits proportionally, largest-remainder.

New: `GET /app-payments/charges/:id/splits`.

### 9.3 Extended — user wallet

`GET /wallet/transactions` items gain `intent`, `transferId`, and:

```jsonc
"counterparty": { "type": "user", "displayName": "Acme Ltd" }
```

`GET /wallet/transactions/:id` gains a `legs` array containing **only the caller's own leg** — two-sided data must never leak another user's balance movement (same principle as `wallet-ledger.service.ts:74`).

New filters: `intent`, `counterpartyType`.

---

## 10. Analytics model

### 10.1 Metric definitions (show these in the UI tooltips so nobody argues about a number)

| Metric | Definition |
|---|---|
| **Platform wallet balance** | `platform:wallet:GBP` balance — our money |
| **Gross inflow** | Σ credits to `platform:wallet` |
| **Fee revenue** | Σ credit legs to `platform:wallet` on transfers with `intent IN (ORDER, BOOKING)` |
| **Subscription revenue** | Σ credits to `platform:wallet` with `intent IN (PURCHASE, SUBSCRIPTION)` |
| **Commission paid** | Σ debits from `platform:wallet` with `intent IN (REFERRAL_COMMISSION, DELEGATION)` |
| **Net platform income** | gross inflow − commission paid |
| **GMV** | Σ payer-side debit legs on `intent IN (ORDER, BOOKING, PURCHASE, SUBSCRIPTION)` |
| **User float** | Σ `LIABILITY_USER_WALLET` balances |
| **Owed to partners** | Σ `LIABILITY_APP_PAYABLE` + `LIABILITY_PAYABLE` |
| **Money in by platform** | credits to `platform:wallet` and `gateway:*` grouped by `GlTransfer.platformId` |

GMV, revenue, float and payables are deliberately separate numbers. Conflating them is how finance dashboards lose trust.

### 10.2 Storage

- Detail (`/transfers`, drill-down) → `gl_entries` / `gl_transfers` with the §7.2 indexes.
- Charts → `gl_daily_rollups` only.
- If `gl_entries` exceeds ~10M rows, add monthly `PARTITION BY RANGE (created_at)` — designed for, not built now.

### 10.3 Example — money in per platform

```
date        platform          gmv        fees      subs      commissions   net in
2026-11-18  mcom-mall         £12,400    £361      £0        £0            £361
2026-11-18  mcom-central      £2,900     £0        £2,900    £580          £2,320
2026-11-18  247gbs-affiliate  £1,100     £220      £0        £0            £220
```

---

## 11. Frontend plan

`/admin/mcom-pay` is a path segment resolved in `AdminDashboard.tsx:65-67`.

### 11.1 `McomPayPanel` tabs

| Tab | Content |
|---|---|
| **Overview** (new, default) | Cards: **Platform wallet balance**, User float, Owed to partners, Revenue today/30d, Commissions paid 30d, GMV 30d. Sparkline. Unreconciled badge. |
| **Platform wallet** (new) | Our own wallet exactly like a user wallet: balance, running-balance ledger, filters. This is the "see our own balance" surface. |
| **Transfers** (new) | Columns: date, intent badge, platform, reference, amount, legs, status. Row → drawer with the full debit/credit table (§6.2 / §6.3 shapes). |
| **Accounts** (new) | Chart of accounts, grouped by type, live balances, click through to entries. |
| **Analytics** (new) | GMV vs revenue line, stacked bar by platform, donut by intent, per-platform table with take rate. |
| **Charges** (existing) | Add `intent` column + filter. |
| **Wallet activity** (existing) | Add `intent` column. |
| **Reconciliation** (new) | Journal vs wallet vs PSP drift; "Rebuild balances" behind a confirm dialog. |

### 11.2 Files

```
components/admin/mcom-pay/
├── McomPayPanel.tsx              (tab router only)
├── OverviewTab.tsx
├── PlatformWalletTab.tsx
├── TransfersTab.tsx
├── TransferDrawer.tsx
├── AccountsTab.tsx
├── AnalyticsTab.tsx
├── ReconciliationTab.tsx
├── api/mcom-pay-admin.api.ts     (extend)
└── hooks/useMcomPayAdmin.ts      (extend)
```

Check for an existing chart dependency before adding one; otherwise inline SVG charts.

### 11.3 User wallet (`components/DashboardWallet.tsx`)

- Rows show intent label ("Order", "Delegation payout", "Referral commission", "Top-up"), counterparty name, platform badge.
- Filter chips by intent.
- Detail drawer: amount, running balance, counterparty — never the other party's balance or history.
- Remove "credits / 1 GBP = 1.00 MCOM credit" copy (§12).

---

## 12. Retiring MCOM credits

Currency-only occurrences (not the `MCOM` brand) that must change.

### 12.1 Backend

| File | Change |
|---|---|
| `wallet/wallet.service.ts:52` | wallet `currency: 'GBP'` |
| `auth/auth.service.ts:874, 985, 1071` | wallet `currency: 'GBP'` |
| `business/business.service.ts:1165` | wallet `currency: 'GBP'` |
| `local-affiliate/local-affiliate.service.ts:261` | wallet `currency: 'GBP'` |
| `wallet/wallet.service.ts:91-107` | delete `getGbpToMcomRate` / `convertGbpToCredits` (or make identity + deprecate) |
| `wallet/wallet-topup.service.ts:316` | `getExchangeRate` → always 1; drop `FxRate` lookup |
| `wallet/wallet-topup.service.ts:516` and error strings | "MCOM" → "GBP" |
| `access/access.service.ts:87, 415, 494` | `walletCurrency: 'GBP'`; drop conversion |
| `payment/payment.service.ts:1064` | remove `convertGbpToCredits` |
| `referrals/referral-commission.service.ts:177-178` | remove `fxRate`; `commissionAmountGbp` is the amount |
| `affiliate/affiliate-settlement.service.ts` | `fxRate: 1`, `fxQuote: 'GBP'` |
| `app-payments/app-payments.service.ts:2182` | `resolveWalletCredits` → pence ÷ 100 |
| `wallet/dto/responses.dto.ts`, `access/access.controller.ts` | keep `walletCurrency` / `walletCredits` fields for one release; always equal to GBP / `finalAmount`; mark deprecated in Swagger |

### 12.2 Database

One hand-written migration:

```sql
-- preflight (abort if not empty / not 1)
SELECT rate FROM fx_rates WHERE base='GBP' AND quote='MCOM' AND rate <> 1;           -- must be 0 rows
SELECT count(*) FROM wallet_top_up_requests
  WHERE round(amount * exchange_rate, 4) <> amount;                                   -- must be 0

UPDATE wallets SET currency = 'GBP' WHERE currency = 'MCOM';
UPDATE wallet_top_up_requests SET wallet_currency = 'GBP', exchange_rate = 1;
UPDATE affiliate_task_settlements SET fx_quote = 'GBP', fx_rate = 1;
UPDATE referral_commissions SET commission_credits = commission_amount_gbp, fx_rate = 1;
```

Do **not** rescale balances: at a 1:1 historical rate the numbers are already GBP. The preflight queries are what makes that assertion safe rather than assumed. If either returns rows, stop and bring the data to review before migrating.

`FxRate` and `MCOM_GBP_RATE` are left in place but unused, and removed in the final cleanup migration.

### 12.3 Frontend copy

Currency strings to fix (brand strings like "MCOM Solutions" / "MCOM Mall" stay):

`components/DashboardWallet.tsx:399,439,499`, `components/payment/MembershipPaymentModal.tsx:617,621`, `components/payment/AccessPassPaymentModal.tsx:508`, `components/admin/wallet/WalletIntegrationModal.tsx:295,296,434,454,487,742`, `components/admin/wallet/WalletActivityPanel.tsx:101`, `components/ReferralEarningsCard.tsx:34`, `components/admin/AffiliateSettlementLedger.tsx:110`, `components/admin/AffiliateTaskAdminPanel.tsx:993`, `components/admin/ReferralAdminPanel.tsx:354`, `components/DashboardDelegatedTasks.tsx:732-736`.

---

## 13. Backfill & cutover

### 13.1 Why this is the risky part

History is single-sided. A `WalletTransaction` credit has no known counterparty, and referral commissions were minted from nothing. We must not invent counterparties silently.

### 13.2 Strategy — deterministic, idempotent, reviewable

`npm run ledger:backfill -- --dry-run|--apply --since=YYYY-MM-DD`:

1. **Accounts** — `wallet:<id>` per existing wallet; `platform:wallet:GBP`, `gateway:*`, `bank:GBP`, `suspense:GBP`, `equity:opening:GBP`; `payable:app:<clientId>` per `SsoClient`.
2. **Wallet transactions** → one transfer each, key `backfill:wallet-txn:<id>`:
   - `TOP_UP` with a known provider → counterparty `gateway:<provider>:GBP`
   - Debits with `platformClientId` → `payable:app:<clientId>`
   - Referral `REWARD` rows with a matching `ReferralCommission` → `equity:opening:GBP` (the platform funded it), flagged
   - Anything unattributable → `equity:opening:GBP`
   - `metadata.backfilled = true`, `metadata.sourceTable`
3. **AppPaymentLedgerEntry** → one transfer per charge; `app_payable` → `payable:app:<clientId>`, `mcom_revenue` → would-be `platform:wallet` credit (fee retained). Key `backfill:app-charge:<chargeId>`.
4. **BillingTransaction** (central sales) → `intent: PURCHASE`, `gateway`/`wallet` → `platform:wallet`.
5. **Affiliate settlements** → pair the two `WalletTransaction` rows into one transfer where `businessTransactionId` and `affiliateTransactionId` both exist.
6. **Balances** — recompute every `gl_accounts.balance_minor` from entries; assert `wallet:<id> == Wallet.balance`; abort with a diff file on any mismatch.

Historical rows keep their original amounts; nothing is re-priced. `equity:opening` absorbs the unattributable side so the journal still balances.

### 13.3 Shadow mode

After Phase 4, every new flow writes to both the old path and the ledger for 5–10 business days. A nightly `ledger-shadow-compare` reports:

- charges with a transfer but no entries (and vice versa)
- `Σ entries per app` vs `AppCharge` totals
- `Wallet.balance` vs `wallet:<id>` account balance
- `BillingTransaction` count vs platform-wallet inflow count

Cut over only after 3 consecutive zero-mismatch days.

### 13.4 Rollback

Feature flags, all default-off:

`LEDGER_WRITE_ENABLED`, `LEDGER_READ_ENABLED`, `LEDGER_WALLET_COUNTERPARTY`, `LEDGER_PLATFORM_WALLET`.

Turning a flag off restores today's behaviour exactly. Nothing already written is lost.

---

## 14. Testing

### 14.1 Invariants (never skipped)

- `post()` rejects unbalanced legs and mixed currencies.
- Replaying an identical `idempotencyKey` returns the same transfer and writes nothing.
- Same key + different legs → `409`.
- Split allocation of 100 into 3 parts sums exactly to 100.
- `wallet:<id>` never goes negative; `platform:wallet` never goes negative on live flows; `payable:*` may.
- Every flow helper produces a journal where, per transaction, `Σdebit == Σcredit`.

### 14.2 Concurrency

- N parallel debits on one wallet: correct final balance, no overspend.
- 4-leg delegation transfers under parallel load: no deadlock (sorted lock order).
- Double webhook delivery: exactly one journal.

### 14.3 End-to-end

| Scenario | Assertion |
|---|---|
| Mall order, wallet | buyer −£90, seller +£87.19, platform +£2.81, one transfer |
| Mall order, Stripe | gateway 9000 → platform 9000; platform 8719 → seller; fee retained |
| Partial refund (wallet & card) | seller debited net, platform fee returned, buyer/gateway credited gross |
| Membership, Stripe | platform wallet +£29 |
| Membership, wallet renewal | buyer −£29, platform +£29 |
| Referral commission | platform −£5, referrer +£5, and platform balance = purchase − commission |
| Referral with insufficient platform funds | stays PENDING, retried, never negative, never minted |
| Delegation, business-funded | 4 legs, sums to business charge |
| Delegation, platform-funded | platform debited, affiliate credited |
| Partner wallet debit | payable increases, books balance |

### 14.4 Migration tests

- Backfill twice → identical state.
- Backfill on a fixture with a known imbalance → abort + diff file, nothing partially written.
- Reconciliation repairs a deliberately corrupted `balance_minor`.
- Currency migration preflight fails loudly on a non-1 historical rate.

---

## 15. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Double counting** `AppPaymentLedgerEntry` vs `GlEntry` | Inflated reports | Single read path per metric; analytics read `Gl*` only; old table deprecated after shadow mode; test that no metric queries both |
| **MCOM retirement breaks stored data** | Wrong balances | Preflight queries in §12.2; abort on any non-1 rate; no rescaling |
| **Backfill invents counterparties** | Misleading history | Every inferred leg flagged `backfilled: true`; UI labels it |
| **Referral commissions drain the platform wallet** | Negative balance | Guard + retry queue; alert when commission > prior 30d inflow |
| **Fire-and-forget referral call sites silently fail** | Missing commissions | New retry cron + the purchase reconciler safety net |
| **Deadlocks** on multi-leg transfers | Failed payments | Sorted lock acquisition + bounded retry on 40001 |
| **Partner API semantics change** (debit → `payable:app`) | Mall/247GBS behaviour shift | Flag `LEDGER_WALLET_COUNTERPARTY`; document in `partner docs/` |
| **Immutable ledger vs GDPR erasure** | Legal | Store ids, resolve names at read time; document retention |
| **Aggregate cost** as entries grow | Slow dashboards | Rollups, composite indexes, monthly partitioning past ~10M rows |
| **BigInt JSON** | Serialisation bugs | Follow existing convention (`.toString()`), as in `app-payments` DTOs |

---

## 16. Phased delivery

### Phase 0 — Currency removal (3–4 days)
Wallet `currency: 'GBP'` everywhere, delete FX helpers, data migration with preflight, API aliases deprecated, frontend copy, `partner docs/` updated.

**Done when**: no runtime code path reads `FxRate` or writes `MCOM` as a currency; wallet screens show GBP.

### Phase 1 — Ledger core (4–6 days)
Schema + hand-written migration + trigger; `chart-of-accounts` (seeds `platform:wallet:GBP`), `gl-posting`; unit + concurrency tests.

**Done when**: a transfer posts in tests and the DB rejects an unbalanced one.

### Phase 2 — Backfill & reconciliation (3–4 days)
`ledger-backfill` (dry-run + apply), balance recompute, drift report, reconciliation cron.

**Done when**: staging copy backfills with zero drift and a re-run is a no-op.

### Phase 3 — Platform wallet & membership (4–5 days)
`platform:wallet` live; posting from `payment`, `recurring`, `pricing`, `access`; purchase reconciler.

**Done when**: a plan purchase visibly raises the platform wallet balance.

### Phase 4 — Wallet-to-wallet & MCOM Pay splits (5–7 days)
Two-sided wallet postings, `AppChargeSplit`, `allocateSplits`, buyer→seller settlement for wallet and card, refunds.

**Done when**: a Mall order credits the seller in one atomic transfer, from either funding source.

### Phase 5 — Referral & delegation (4–5 days)
Referral payout from platform wallet + retry cron; delegation 4-leg transfer.

**Done when**: commission reduces the platform wallet and the sum (purchase − commission) reconciles.

### Phase 6 — Admin & user read surfaces (5–7 days)
`/admin/mcom-pay/*` endpoints; panel tabs (Overview, Platform wallet, Transfers, Accounts); user ledger fields.

**Done when**: the −£90/+£87.19 pair is visible on screen and users see intent + counterparty.

### Phase 7 — Analytics (3–4 days)
Rollups, cron, `/analytics/*`, Analytics tab.

**Done when**: per-platform GMV/revenue/commission figures match a hand-computed period.

### Phase 8 — Cutover & cleanup (2–3 days)
Flip `LEDGER_READ_ENABLED`; stop writing `AppPaymentLedgerEntry`; remove `postChargeLedger`; retire `RevenueRecord` writers; drop `FxRate`.

**Total: ~30–40 engineering days.** Phase 3 and 4 can overlap if two engineers are on it.

---

## 17. Open questions

Only four left; the rest are settled.

1. **Referral commission when the platform wallet can't cover it** — queue and retry (recommended), or reject the configuration at save time? Recommended: queue, alert, never negative.
2. **Is commission deducted from our revenue, or charged on top of the purchase?** Reading your description ("we charge the person buying the plan… then debit ourselves"), it is **deducted from revenue** — the buyer pays the plan price only. Confirm, because "on top" would add a second debit on the buyer.
3. **Card refunds: do we return the fee?** Current code returns it proportionally (`computeRefundFee`). For Mall merchants this is a commercial decision, not a technical one.
4. **Gateway processing fees** — record gross with a separate `FEE` transfer (full gross tracking), or record net as received (simpler)? Recommended: net in Phase 1, gross when bank reconciliation is in scope.

---

## Appendix A — Current → target mapping

| Today | Becomes |
|---|---|
| `Wallet.currency 'MCOM'` | `'GBP'`; FX helpers deleted |
| `Wallet.balance` | projection of `wallet:<id>` account (kept, reconciled) |
| `WalletTransaction` | user receipt (kept) + `intent`, `transferId`, `counterpartyWalletId`, `ledgerEntryId` |
| `WalletTransaction.category` | kept for user grouping; `intent` is the business dimension |
| `AppPaymentLedgerEntry` | superseded by `GlTransaction`/`GlEntry`; dual-write then retire |
| `AppCharge` (payer only) | gains `intent`, `payeeType/Ref`, `transferId`, `AppChargeSplit[]` |
| `app_payable` (one global account) | `payable:app:<clientId>` per app |
| `mcom_revenue` (one global account) | **removed** — fees are what stayed in `platform:wallet:GBP` |
| no platform account | `platform:wallet:GBP`, first-class, with its own ledger and UI |
| referral credits minted from nothing | `platform:wallet` debit → referrer credit, with a retry queue |
| `RevenueRecord` | reporting convenience fed from rollups; no longer a source of truth |
| affiliate settlement's two loose rows | one balanced `GlTransfer`, 3–4 legs |
| `reports/platform-summary` | `/admin/mcom-pay/analytics/by-platform` (includes gateway charges) |

## Appendix B — Files this plan touches

```
apps/backend/prisma/schema.prisma                          (new models + additive columns)
apps/backend/prisma/migrations/<new>/migration.sql          (hand-written, incl. trigger + currency)
apps/backend/src/ledger/**                                  (new module)
apps/backend/src/app.module.ts                              (register LedgerModule)
apps/backend/src/wallet/wallet.service.ts                   (two-sided posting, GBP)
apps/backend/src/wallet/wallet-topup.service.ts             (no FX)
apps/backend/src/wallet/wallet-ledger.service.ts            (intent/counterparty DTOs)
apps/backend/src/wallet/wallet-admin.service.ts             (adjustments, reconciliation)
apps/backend/src/app-payments/app-payments.service.ts       (splits, buyer→seller settlement)
apps/backend/src/app-payments/app-payments-ledger.service.ts (retired after cutover)
apps/backend/src/affiliate/affiliate-settlement.service.ts  (single multi-leg transfer)
apps/backend/src/referrals/referral-commission.service.ts   (platform-funded payout + retry)
apps/backend/src/payment/payment.service.ts                 (platform wallet receipt)
apps/backend/src/recurring/recurring.service.ts             (platform wallet receipt)
apps/backend/src/pricing/pricing.service.ts                 (platform wallet receipt)
apps/backend/src/access/access.service.ts                   (platform wallet receipt, GBP)
apps/backend/src/auth/auth.service.ts, business/business.service.ts,
  local-affiliate/local-affiliate.service.ts                (wallet currency GBP)
apps/frontend/src/components/admin/mcom-pay/**              (tabs, drawer, analytics)
apps/frontend/src/components/DashboardWallet.tsx            (user ledger UX)
apps/frontend/src/services/wallet/{index.ts,hooks.ts}       (types + hooks)
partner docs/mcom_plans_and_centralized_payment_integration_guide.md (currency + splits)
docs/app-payments-hardening.md                              (guarantees still hold)
```
