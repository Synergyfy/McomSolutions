# 247GBS Local Affiliate System — Codebase Fit & Implementation Analysis

**Status:** Analysis only. No code written.
**Scope:** Strictly the Local Affiliate business/technical model as supplied. Nothing outside it.
**Repos inspected:**
- `central-hub-solution/apps/backend` (NestJS + Prisma, 73 migrations, schema 3,472 lines)
- `central-hub-solution/apps/frontend` (React 19 + Vite + Router 7)
- `mcom-mall/apps/mcom_mallAPI` (NestJS 11 + **TypeORM**, not Prisma), `McomMall`, `McomMallAdmin` (Next.js 16)

---

## 0. How to read this

The source document is a *business and technical model*. This document is the **fit analysis**: what already exists in CHS that the model should reuse, what is missing, what the external providers actually allow, and where the model needs a decision before anyone builds.

Three things came out of the investigation that materially change the plan:

1. **The word "Affiliate" is already taken in CHS and means something else.** There is a shipping `src/affiliate/` module for the *247GBS Affiliates agency* (AGENT / CONSULTANT / ACCOUNT_MANAGER doing commissioned work for businesses). It must not be reused, renamed, or confused with Local Affiliates.
2. **MCOM Mall has no attribution surface at all.** No order metadata, no click id, no source field, and its `Webhook` table is registered but nothing ever dispatches it. The doc's "MCOM Mall sends the transaction information to the affiliate platform" requires a Mall change, not a Central-only change.
3. **Awin is pull-only, not push.** There is no transaction webhook. Attribution must be built as a scheduled reconciliation against a 31-day-max window query, with `clickRef` as the only reliably readable attribution carrier. This is a stronger constraint than the doc implies.

---

## 1. Verdict in one page

| Doc section | Feasible as written? | Note |
|---|---|---|
| §1 Registration (existing / new CHS customer) | ✅ Yes | `User` + `CustomerProfile` + `registerCustomer` already do most of it. Needs a *link-not-duplicate* path plus a separate "activate affiliate" step. |
| §2 Promotable sources (Mall / external / Awin) | ✅ Yes | Architecturally clean; Mall is the only one with real friction. |
| §3 Central marketplace | ✅ Yes | New tables only. |
| §4 Sharing & tracking journey | ⚠️ Mostly | Internal link/click layer is easy. Provider click + provider transaction confirmation is the hard part per provider. |
| §5 Reward types | ✅ Yes, phased | Points + vouchers first is correct. Wallet is a *money* ledger, so don't put pending points in it. |
| §6 Redemption | ✅ Yes | Needs a real voucher/issuance table; CHS `Coupon` is membership/access-only and cannot be reused. |
| §7 ThriveCart | ⚠️ Yes, with a correction | Two workable attribution paths. The doc's "not necessarily" answer is right; the *reason* is stronger than stated. |
| §8 Awin | ⚠️ Yes, but blocked | Confirmed: needs Awin Subnetwork approval + written consent. Also confirmed: no webhooks, so design is polling. |
| §9 Admin config | ✅ Yes | Fits the existing `AdminLayout` `NAV_GROUPS` four-point registration. |
| §10 Mock data | ✅ Yes | Add a dedicated seed, clearly flagged. |
| §11 Affiliate dashboard | ✅ Yes | Extend `CustomerDashboard`, do not build a second portal. |
| §12 DB structure | ✅ Yes, mostly | 21 of 22 proposed entities map cleanly. `chs_users` already exists. |
| §13 Attribution policy | ✅ Yes | All six states are representable; needs an explicit state machine. |
| §14 Multi-provider per affiliate | ✅ Yes | Falls out of the design if links are per `(affiliate, offer)`. |
| §15 Two beneficiaries | ✅ Yes | Must be two records, not two fields. |
| §16 Integration levels 1–4 | ✅ Yes | Best idea in the document; make it a hard gate on reward rules. |
| §17 Phases | ✅ Yes | Order is right. Phase 2 is the real gate, not Phase 1. |
| §18 Decisions | ✅ Yes | 5 business questions + 6 technical ones surfaced below. |

**Bottom line:** the model fits this codebase unusually well because CHS already has the three hard primitives — a single consumer identity, a transactional credit ledger with idempotency, and a service mesh with signed partner endpoints. What it does *not* have is any of the affiliate domain itself, and one provider (Mall) needs a first-party change before Phase 2 is real.

---

## 2. What already exists (evidence-based)

### 2.1 ⚠️ "Affiliate" already means the agency, not the consumer

`src/affiliate/` is a mature module: `AffiliateTask`, `AffiliateProject`, `AffiliateServiceRequest`, `AffiliateTaskSettlement` (escrow), reputation, ratings, reports, and **business acquisition** (`AffiliateBusinessInvitation`, `AffiliateBusinessClaim`).

Its participants are `Role.AGENT | CONSULTANT | ACCOUNT_MANAGER` (`AFFILIATE_ROLES` in `business-acquisition.service.ts`). They are *recruited*, sign up through the external `247gbsaffiliates.com` portal, and earn commission on business work.

**Consequences:**

| Risk | Detail |
|---|---|
| Name collision | A new `src/affiliate/` module is impossible. Table prefix `affiliate_*` is already in use (`affiliate_tasks`, `affiliate_projects`, `affiliate_task_settlements`, `affiliate_ratings`, …). |
| **`isAffiliate` is already defined** | `buildSsoIdentity()` sets `isAffiliate: user.registrationSource === 'affiliate-portal'`. MCOM Mall mirrors this into `User.isAffiliate`. If Local Affiliates reuse `registrationSource='affiliate-portal'`, they will be indistinguishable from agency agents inside Mall and in every SSO consumer. |
| Route collision | `/register/affiliate/*` already means the **agency** signup funnel (`AffiliateRoleSelection`, `AffiliateSignup`, `AffiliateCheckEmail`, `AffiliateVerifyEmail`). The doc's example link `247gbs.com/affiliate/LAF-000125` must not be nested there. |
| Wrong defaults | Local Affiliates are consumers, not operators. They must not inherit agency permissions, tasks, escrow, or the `AGENT` role. |

**Recommendation:** name the domain **Local Affiliate** everywhere — `src/local-affiliate/`, models `LocalAffiliateProfile`, `AffiliateOffer`, `AffiliateCampaign`, tables `local_affiliate_*`. Use a distinct `registrationSource` value (e.g. `local-affiliate`). Never touch `Role.AGENT`.

### 2.2 Identity & registration — nearly all present

| Need | Exists | Where |
|---|---|---|
| Single CHS identity | ✅ | `User` (uuid, unique email, `role`, `tokenVersion`, soft delete) |
| Consumer profile | ✅ | `CustomerProfile` (phone, postcode, city/borough/high-street/local-mall, `loyaltyPoints`) |
| "Does this email already exist?" | ✅ | `GET /auth/check-email` (`CheckEmailQueryDto`) |
| New customer creation | ✅ | `AuthService.registerCustomer()` — creates `User` + `Wallet` in one transaction, resolves postcode → geography, honours `referredByCode` |
| Email verification | ✅ | `POST /auth/send-otp`, `/verify-otp`, `OtpPurpose` enum |
| Login / refresh / logout | ✅ | `LocalStrategy`, `RefreshSession`, token rotation |
| Consumer route protection | ✅ | `ProtectedCustomerRoute` |

**Missing:** an "activate affiliate on an existing identity" flow, and the affiliate profile itself. The doc's Scenario A is literally: authenticate → confirm → accept terms → create profile → generate ID/link → open dashboard. That is one new endpoint plus one new table.

**Scenario B is mostly done already** — `registerCustomer()` is the "create CHS account" step. The affiliate profile must be created in the *same transaction* as the user, or immediately after with a retry-safe step, so a failed profile creation cannot leave a customer with no affiliate record and no way to retry.

### 2.3 Money & ledger — right primitives, wrong semantics for points

`Wallet` / `WalletTransaction`:
- `balance Decimal(18,4)`, currency `MCOM`, `TransactionCategory` already includes `REWARD`, `TransactionType` CREDIT/DEBIT, `TransactionStatus` COMPLETED/PENDING/FAILED/REVERSED.
- `WalletTransaction.idempotencyKey @unique` — replay-safe.
- `WalletHold` with `ACTIVE/CAPTURED/RELEASED/EXPIRED` and expiry.
- Row locking (`withWalletRowLock`) + distributed lock (`lockUtil.withLock`) + max-balance and daily/monthly debit limits.
- Internal callers already exist (`referral-commission.service.ts`, `task-reward.processor.ts`, `payment.service.ts`, `access.service.ts`) using `MCOM_CENTRAL_PARTNER`.

`ReferralCommission` is the **best template in the repo** for rewards:
- immutable `ReferralConfig` versions, `isCurrent` flag
- one row per evaluated purchase, including *skipped* rows (auditable)
- `status` PENDING → CREDITED with explicit skip reasons
- `idempotencyKey @unique` per source purchase
- on approval: `creditWallet(MCOM_CENTRAL_PARTNER, { category: REWARD }, 'referral-payout:<id>')`

**Critical distinction:** the wallet balance is *spendable the instant it is credited*. The doc requires **Pending ≠ Available**. So pending affiliate rewards must **not** live in the wallet. They live in the affiliate reward ledger; only the approved portion is materialised (as credits, a voucher, or a redemption) — exactly how `ReferralCommission` already works.

**Points vs credits:** `CustomerProfile.loyaltyPoints` is a bare `Int` with no ledger and is only touched by admin CRUD. Do not extend it. Build a proper ledger.

### 2.4 Ecosystem integration plumbing — this is the biggest asset

| Capability | Where | Relevance |
|---|---|---|
| RS256 service tokens, JWKS, offline verification | `src/service-identity/` | Central is the control plane; peers verify locally. |
| Deny-by-default inbound mesh guard + scopes | `src/mesh-inbound/` (`ServiceAuthGuard`, `ServiceScopesGuard`, `@RequireServiceScopes`) | Ready-made pattern for `partner/affiliate/*`. |
| Feature-flag guard returning `503 FEATURE_DISABLED` | `PartnerFeatureGuard`, `PartnerFeature` enum | Add a flag rather than ship a half-open endpoint. |
| Signed, retried, logged outbound webhooks + BullMQ | `src/webhook-dispatcher/` (5 attempts, exponential backoff, `AppWebhookLog`) | Reuse for notifying partners about reward events. |
| Outbound partner event catalogue | `src/ecosystem-events/` (`central.coupon.redeemed`, …) | Matches doc §6's "Mall confirms the order". |
| AES-256-GCM secret-at-rest | `src/console/crypto.util.ts` (`encrypt`/`decrypt`, `CONSOLE_ENCRYPTION_KEY`) | Provider API keys must be stored this way. |
| Durable queues | `src/queue/queue.constants.ts` (BullMQ) | Reconciliation, webhook processing, reward approval. |
| Idempotent inbound webhook ledger | `ProcessedWebhookEvent` | Reuse for provider webhook dedupe. |
| Consumable code/voucher services | `Coupon`, `CouponRedemption`, `AccessPassCode` | Pattern reference only — see §8. |
| Notification + chat | `Notification`, `PushSubscription`, `ChatOutbox` | "why is my reward pending" messaging. |

**Existing examples of the exact shape we need:** `PartnerCatalogController` (`partner/catalog`), `PartnerCouponsController` (`partner/coupons`), `PartnerGrantsController`, `PartnerUsersController`. An affiliate conversion ingest endpoint slots straight into this family.

### 2.5 Geography & eligibility — a free win

`City → Borough → HighStreet → LocalMall` already exists, and **`CustomerProfile` already carries `cityId`/`boroughId`/`highStreetId`/`localMallId`**, auto-resolved from postcode at registration (`assignCustomer`). `LocalMall` even has `affiliateCount`, `customers`, `campaigns` counters and per-mall `assignedAgentIds` / `leadConsultantId`.

That answers doc §18 Q4 structurally: location-scoped offers are implementable on day one, not a later feature. It also means the marketplace can be "offers near me" by default with a global fallback.

Note: `src/campaign/campaign.ts` (`Campaign`, `locationType: high_street | borough | local_mall`) is a **geographic marketing campaign**, not an affiliate campaign. Different concept, confusingly similar name — keep affiliate campaigns in `local_affiliate_campaigns`.

### 2.6 Frontend surfaces

| Need (doc §11) | Current state |
|---|---|
| Consumer dashboard | ✅ `pages/CustomerDashboard.tsx`, nav = Overview / Ecosystem / Wallet / Messages / Notifications / Settings |
| Wallet UI | ✅ `components/DashboardWallet.tsx` (balance, Stripe top-up, holds, transactions) |
| Referral card | ✅ `DashboardReferrals.tsx`, `ReferralLinkCard.tsx`, `ReferralEarningsCard.tsx` |
| Access passes / codes | ✅ `DashboardAccessPasses.tsx` |
| Admin shell | ✅ `AdminLayout.tsx` `NAV_GROUPS` + `AdminDashboard.tsx` (`AdminTab`, `ADMIN_TABS`, `getTabInfo`, `renderPanel`) — a clean 5-point registration for a new group |
| Affiliate (consumer) pages | ❌ none |
| Offers / marketplace / rewards / vouchers | ❌ none |
| VCard / EV Card | ❌ none (MCOM vCard is a *registered external platform*: `clientId: mcom-vcard`, `platformSlug: vcard`, `data-sharing` permission key `canAccess_vcard`) |
| Shared UI kit | ⚠️ none — tables/modals are duplicated per feature. Expect to duplicate once more, or introduce a small `components/ui/` kit as part of this work. |

`247gbsaffiliates.com` (the agency portal) is a **separate application** — `ProtectedBusinessRoute` redirects agent roles to `VITE_AFFILIATE_PORTAL_URL`. Do not put consumer affiliate UI there.

### 2.7 MCOM Mall — the first provider, and the biggest gap

Stack reality: **NestJS 11 + TypeORM** (`apps/mcom_mallAPI`, ~160 `*.entity.ts`, SQL migrations). No Prisma. `setGlobalPrefix('api/v1')`, `CamelCaseInterceptor` (snake → camel on responses), global `JwtAuthGuard` with `@Public()`.

**What we can build on:**
- `products` / `Product` — `id, business, title, price, salePrice, sku, stock, category, productStatus, visibility, media[], isPromotionEligible`. Catalogue is readable over the mesh: `GET /partner/catalog/products`, `/partner/catalog/business/:id/products`, `/partner/catalog/business/:id/services`.
- `Business.centralBusinessId` + `User.centralUserId` — direct identity mapping to CHS. This is the join key that makes "reuse the CHS identity" trivial.
- Real transactional outbox precedent: `partner_redemption_outbox`, `reward_redemption_outbox`, `failed_wallet_refunds`, swept by `partner-callback.service.ts` with `(operation, issuanceId, code)` idempotency.
- Rewards integration handbook (`mcom-mall/MCOM_REWARDS_MALL_INTEGRATION.md`) — the ecosystem's canonical integration pattern.

**What is missing (blocking Phase 2):**

| Gap | Impact |
|---|---|
| `Order` has **no** metadata / source / click / affiliate / referral field | Cannot attribute a purchase. |
| `checkout/initiate` and `checkout/complete` DTOs accept **no** free-form attribution | Cannot carry the affiliate id through checkout. |
| `Webhook` entity exists but **no dispatcher** — nothing is ever delivered | "Mall sends the order to Central" is not a small config change. |
| No commission ledger for third parties | Mall cannot express "this sale owes affiliate X". |
| `User.isAffiliate` mirrors the *agency* flag | Repurposing it would silently conflate two populations. |

**Required Mall change set (minimum):**
1. `orders.attribution` jsonb **or** a new `order_attribution` table (`clickRef`, `trackingLinkId`, `localAffiliateId`, `campaignId`, `provider`, `raw`).
2. Accept attribution on `checkout/initiate` and persist it onto the order (do **not** trust a client-supplied affiliate id alone — validate it server-to-server against Central, or verify the signed tracking reference).
3. Emit `order.paid` / `order.refunded` to Central through an outbox (reuse the existing `partner-callback` pattern; do not build a second dispatcher style).

---

## 3. Research corrections that change the design

### 3.1 Awin — pull, not push; one usable attribution field

Verified against Awin's publisher API docs:

| Fact | Consequence |
|---|---|
| Transactions are retrieved via `GET /publishers/{publisherId}/transactions/` with `accessToken`; **no transaction webhook exists** | Reconciliation must be a **scheduled job**, not a webhook handler. |
| `startDate`/`endDate` are mandatory with a **maximum 31-day range** | Sync must page by trailing windows and keep a durable cursor + overlap for late validations. |
| Statuses: `pending`, `approved`, `declined`, `deleted` | Maps 1:1 to reward statuses; approval is asynchronous and can arrive days later — the doc's "there may be a delay" is structural, not incidental. |
| `dateType` supports `transaction` \| `validation` \| `amendment` | Three separate sync passes are needed; a transaction can be **amended** after it was seen. |
| `clickRef` always readable by publishers; `clickRef2`–`clickRef6` readable by publishers; `orderRef` only **if the publisher is activated to see it**; `customParameters` only if the advertiser shares them | **Attribution must ride on `clickRef` alone.** Do not design around `orderRef` or `customParameters`. |
| Link Builder supports a single link or **batches up to 100** | Link provisioning is a batch operation, good for campaign-wide rollout. |
| Commission is expressed in `transactionParts[].commissionGroupCode` with amounts | Consumer reward should be derived from *our* rule, optionally capped by the actual commission amount. |
| Subnetwork: Awin explicitly gates the model ("Awin's Subnetwork publisher requirements"), and a sublicense **cannot be further sublicensed without Awin's prior written consent** | The doc's §8 warning is **confirmed and stronger than stated**: do not launch any Awin offer as an individually rewarded consumer campaign until Subnetwork status and attribution/payout treatment are confirmed in writing. |

**Design change vs the doc:** instead of `clickRef = LAF000125_CAM00045` (coupled, length-risky, leaks internal ids, hard to rotate), use **`clickRef = <opaque tracking link id>`** and resolve `→ affiliate, offer, campaign, provider` in our own `affiliate_tracking_links` table. One field, one lookup, rotatable, and it survives campaign changes.

### 3.2 ThriveCart — two attribution paths, pick deliberately

Confirmed capabilities:
- **Native affiliate management:** `POST /api/external/affiliates` (create, with `product_ids`, `auto_approve`, `parent_affiliate`), `POST /api/external/affiliates/:affiliate_id/register`, `.../approve`. Events: `affiliate_approved`, `affiliate_rejected`, `affiliate_commission_earned`, `affiliate_commission_payout`, `affiliate_commission_refund`.
- **Passthrough variables:** `passthrough[<key>]=<value>` on the checkout URL (and `data-thrivecart-querystring` for embeddable checkouts), returned with the order and in webhooks.
- **Order events:** `order_created`, `order_payment_product|bump|upsell|downsell`, `order_rebill*`, `order_refund_*`, `subscription_paused|resumed`, `cart_abandoned`. `order.success` payload includes `webhook_id` (stable across retries), `event_id`, `order_id`, `base_product`, `customer`, `order.total`, `purchase_map_flat`, and echoes `thrivecart_secret` for verification.

| Path | How | Verdict |
|---|---|---|
| **A. Passthrough (`passthrough[la_tracking_id]=<id>`)** | One code path for every ThriveCart checkout. We compute the reward ourselves from `order_payment_*` events. | ✅ **Default.** Provider-independent, no dependency on ThriveCart's affiliate feature, works the same way as Mall. |
| B. ThriveCart native affiliates | Create/register/approve one ThriveCart affiliate per Local Affiliate (or nest under a CHS `parent_affiliate`), consume `affiliate_commission_earned`. | ⚠️ Only where a business insists on ThriveCart paying affiliates directly. It makes ThriveCart the commission authority and creates a second payout relationship — contrary to §19's "one central affiliate relationship". |

**Additional finding that settles it:** ThriveCart states affiliate payouts **only happen in live mode** — "this will not receive any test mode notifications" for `affiliate_commission_earned`. So Path B is impossible to exercise in a realistic dev/staging environment, while Path A can be fully simulated. Combined with the idempotency value of `webhook_id`, Path A should be the baseline.

**This also sharpens the doc's §7 answer:** the reason Mall products don't need a ThriveCart twin isn't just "avoid duplication" — it is that **ThriveCart cannot be *our* attribution authority** without giving up the central ledger, and it can't even be tested in test mode. ThriveCart should be treated as *a checkout that echoes our attribution back*, not as *the affiliate system*.

### 3.3 Mall — the integration must be Mall → Central, not Central → Mall

Central could call `partner/catalog` to read products (needs an outbound mesh client in Central, which does not exist yet, plus a `allowedCallers` entry). But conversions must flow the other way, because only Mall knows when an order is paid. Mall already has the outbox + idempotent partner-callback pattern, so:

```
Mall checkout (attribution captured)
  → order completed  → emit in Mall event bus (exists)
  → write affiliate_conversion_outbox row (pattern exists)
  → sweep → POST Central /api/v1/partner/affiliate/conversions   (mesh, central:issue)
      headers: Bearer <RS256 service token>, X-Caller-Id: mcom-mall
  → Central dedupes on (sourceProviderId, providerOrderId) → conversion → reward ledger
```

Product *import* can be the cheap direction: Mall's `partner/catalog` is already exposed; Central can read it either by (a) adding a small outbound mesh client, or (b) a signed pull triggered from Admin "Sync now". Either is fine; (b) is a smaller first step because it needs no new caller on Mall's side.

---

## 4. Proposed shape in this repo

### 4.1 Module layout (follows existing conventions)

```
src/local-affiliate/
  local-affiliate.controller.ts             // consumer: my profile, my link, my activity, my rewards
  local-affiliate-admin.controller.ts       // admin: profiles, offers, campaigns, reward rules, reconciliation
  local-affiliate-public.controller.ts      // public: /go/:code, /r/:trackingId redirect, offer page data
  affiliate-offer.controller.ts             // consumer: marketplace browse/filter
  affiliate-reward.controller.ts            // consumer: balances, ledger, redeem
  affiliate-redemption.controller.ts        // business-facing: validate a redemption code
  affiliate-provider.controller.ts          // admin: provider accounts, test connection, sync
  local-affiliate.service.ts
  affiliate-offer.service.ts
  affiliate-tracking.service.ts             // link creation, click capture, attribution resolution
  affiliate-conversion.service.ts           // conversion ingest + attribution matching
  affiliate-reward.service.ts               // rule evaluation + ledger
  affiliate-redemption.service.ts           // issuance, validation, reversal
  affiliate-reconciliation.service.ts       // provider sync, unmatched events
  providers/
    provider.interface.ts                   // one contract, four implementations
    mall.provider.ts                        // internal, mesh
    thrivecart.provider.ts                  // API + event subscriptions
    awin.provider.ts                        // pull reconciliation
    external-manual.provider.ts             // levels 1–3
  dto/
  guards/
  local-affiliate.module.ts
```

### 4.2 Data model — mapped to the doc's §12 list

The doc proposes 22 entities. `chs_users` already exists. 20 of the remaining 21 map cleanly; two need renaming to avoid collisions.

| Doc entity | Proposed model / table | Notes |
|---|---|---|
| `chs_users` | `User` (existing) | Reuse. No new table. |
| `affiliate_profiles` | `LocalAffiliateProfile` / `local_affiliate_profiles` | 1:1 with `User` (`userId @unique`). `affiliateCode` (`LAF-000125`) unique, human-readable, sequential. `status` PENDING/ACTIVE/SUSPENDED/CLOSED. `termsAcceptedAt`, `termsVersion`. `locationId` mirrored from `CustomerProfile`. |
| `affiliate_cards` | `LocalAffiliateCard` / `local_affiliate_cards` | `provider` (vcard/evcard), `externalCardId`, `status`, `linkedAt`. Treat as a *linked external record*; there is no VCard code in these repos. |
| `affiliate_providers` | `AffiliateProvider` / `affiliate_providers` | name, type (`INTERNAL_PLATFORM`, `EXTERNAL_CHECKOUT`, `AFFILIATE_NETWORK`, `EXTERNAL_BUSINESS`), `integrationLevel` (LINK_ONLY / REDEMPTION_CODE / MANUAL_CONFIRMATION / API / WEBHOOK), `supportedEvents[]`, `supportedRewardMethods[]`, status, notes. |
| `provider_accounts` | `AffiliateProviderAccount` / `affiliate_provider_accounts` | Encrypted credentials via `console/crypto.util` (`encrypt`/`decrypt` with `CONSOLE_ENCRYPTION_KEY`). Separate row from provider so one provider can hold multiple accounts (e.g. two ThriveCart accounts). Holds sync cursor: `lastSyncedAt`, `syncCursor`. |
| `businesses` | `BusinessProfile` (existing) + `ExternalBusiness` / `external_businesses` | MCOM businesses reuse `BusinessProfile`. External businesses are a *new, thin* record (name, website, contact, location, category, verification status) — deliberately not `BusinessProfile`, which implies membership/packages/SSO. |
| `affiliate_products` | `AffiliateProduct` / `affiliate_products` | Mirror/cache of a source product: `providerId`, `externalProductId`, `businessId`, title, description, media, price, currency, category, destinationUrl, availability, `lastSyncedAt`, `sourcePayload` jsonb. Unique on `(providerId, externalProductId)`. |
| `affiliate_offers` | `AffiliateOffer` / `affiliate_offers` | `productId?`, `providerId`, `businessId?`, title, description, image, `destinationUrl`, `trackingMethod`, `eligibility` jsonb, `customerBenefit` jsonb, `rewardRuleId`, `status` DRAFT/PENDING_APPROVAL/ACTIVE/PAUSED/ENDED, `startsAt`/`endsAt`, `redemptionMethod`. |
| `affiliate_campaigns` | `AffiliateCampaign` / `local_affiliate_campaigns` | Avoids confusion with the existing geographic `Campaign`. Budget/cap, eligible affiliate groups, dates, status. |
| `campaign_offers` | `AffiliateCampaignOffer` join | `@@id([campaignId, offerId])`. |
| `affiliate_tracking_links` | `AffiliateTrackingLink` / `affiliate_tracking_links` | **The core row.** `@@unique([localAffiliateId, offerId, campaignId])`. `code` (opaque, used in URLs), `provider` (`INTERNAL`/`THRIVECART`/`AWIN`), `providerLinkUrl`, `providerClickRef`, generated/last-used timestamps. Never store an affiliate id on the product. |
| `affiliate_clicks` | `AffiliateClick` / `affiliate_clicks` | `trackingLinkId`, timestamps, ip hash (**not** raw IP), user agent, referrer, `visitorFingerprint`, `convertedAt`. High-volume: partition/archive policy needed. |
| `affiliate_leads` | `AffiliateLead` / `affiliate_leads` | Qualifying lead records with `verifiedAt`/`verifiedBy`. |
| `affiliate_conversions` | `AffiliateConversion` / `affiliate_conversions` | One row per qualifying event: `trackingLinkId`, `offerId`, `campaignId`, `eventType`, `providerId`, `providerTransactionId`, `amountMinor`, `currency`, `occurredAt`, `attributionMethod`, `attributionWindowDays`, `status`. |
| `provider_transactions` | `AffiliateProviderTransaction` / `affiliate_provider_transactions` | Raw provider truth. `@@unique([providerAccountId, providerTransactionId])` — this is the duplicate-reward guard. Stores `commissionAmountMinor`, `commissionStatus`, `raw` jsonb, `firstSeenAt`, `lastSyncedAt`, `validationDate`. |
| `reward_rules` | `AffiliateRewardRule` / `affiliate_reward_rules` | `qualifyingEvent`, `rewardType` (POINTS/VOUCHER/CREDIT/DISCOUNT/STAMP/CAMPAIGN), `calculation` (FIXED | PERCENTAGE | TIERED), `value`, `maxReward`, `minPurchaseMinor`, `approvalMode`, `reversalPolicy`, `expiryDays`, `capPerAffiliate`, `capPerCampaign`. Versioned rather than mutated. |
| `reward_ledger` | `AffiliateRewardLedger` / `affiliate_reward_ledger` | **Append-only.** `entryType` (CREDIT/DEBIT/EXPIRY/REVERSAL/ADJUSTMENT), `units`, `unit` (POINTS | CREDIT), `status` (PENDING/APPROVED/AVAILABLE/REDEEMED/REJECTED/CANCELLED/REVERSED/EXPIRED), `conversionId`, `rewardRuleId`, `idempotencyKey @unique`, `expiresAt`, `approvedAt`. Balances are always derived, never overwritten. |
| `reward_redemptions` | `AffiliateRewardRedemption` / `affiliate_reward_redemptions` | What the affiliate spent. Links to one or more ledger entries. |
| `provider_webhook_events` | `AffiliateProviderEvent` / `affiliate_provider_events` | `@@unique([providerId, externalEventId])`; raw body, signature status, processing state. For Awin there are no webhooks → this table stays empty for Awin by design. |
| `conversion_attributions` | `AffiliateAttribution` / `affiliate_attributions` | The *decision* record: which click won, why, confidence, superseded links. Keeps "why did John get this?" answerable forever. |
| `integration_sync_logs` | `AffiliateSyncLog` / `affiliate_sync_logs` | Per run: provider account, window, fetched/created/skipped/errored, duration. |

**Two additional tables the doc implies but does not name (needed for §6 and §16):**

| Model | Why |
|---|---|
| `AffiliateVoucher` / `affiliate_vouchers` | The consumer-facing voucher from Example B. `code @unique`, `maxUses`, `maxUsesPerCustomer`, `usedCount`, `status`, `expiresAt`, `offerId`, `campaignId`, `issuedToUserId`. Must be single-use by default. CHS `Coupon` is scoped to memberships/access (`CouponProductType`) and cannot carry this. |
| `AffiliateRedemption` / `affiliate_redemptions` | Voucher presentation → validation → confirmation. `@@unique([voucherId, customerUserId])` enforces one-per-customer. Records `validatedBy`, `validatedAt`, `posReference`, `rejectionReason`. This is the record that *proves* the qualifying event for Level 2 providers. |

### 4.3 Identifier model (doc §4)

The doc lists nine identifiers. In this system they resolve as:

| Identifier | Home |
|---|---|
| CHS user id | `User.id` |
| Local affiliate id | `LocalAffiliateProfile.affiliateCode` (`LAF-000125`) + internal `id` |
| Affiliate tracking link id | `AffiliateTrackingLink.code` — **the single external token** |
| Campaign id | `AffiliateCampaign.id` (resolved, never exposed to providers) |
| Offer id | `AffiliateOffer.id` |
| Product / service id | `AffiliateProduct.externalProductId` (Mall `Product.id`, ThriveCart product id, …) |
| Provider id | `AffiliateProvider.id` |
| Provider click reference | `AffiliateTrackingLink.providerClickRef` (Awin `clickRef`; ThriveCart `passthrough[la_tracking_id]`) |
| Provider transaction / order id | `AffiliateProviderTransaction.providerTransactionId` |

**Rule:** exactly one opaque token crosses the boundary (`trackingLinkId`). Everything else is resolved internally. This is the difference between a system that survives a campaign rename and one that doesn't.

### 4.4 URL design (resolves the route collision)

| Purpose | Path | Why |
|---|---|---|
| Personal affiliate page (doc §4) | `/a/:affiliateCode` | `LAF-000125` is human-shareable. |
| Offer-specific page | `/a/:affiliateCode/o/:offerSlug` | Preserves affiliate identity while adding an offer. |
| **Tracking redirect** | `/r/:trackingLinkCode` | Records the click, sets a first-party attribution cookie, 302s to the provider destination with provider-specific params appended. |
| Public offer page (no affiliate) | `/offers/:offerSlug` | Marketplace browsing. |
| **Explicitly not** `/affiliate/*` | — | Reserved for the agency funnel. |

Redirect behaviour by provider:
- **Mall:** append `?laf=<trackingLinkCode>`; Mall product page carries it to checkout; Mall stores it on `order_attribution`.
- **ThriveCart:** append `passthrough[la_tracking_id]=<trackingLinkCode>` (or `data-thrivecart-querystring` for embeds).
- **Awin:** generate/reuse a Link Builder link with `clickref=<trackingLinkCode>`.
- **External Level 1:** append `?laf=<trackingLinkCode>` where the site tolerates it; record the click regardless.

### 4.5 Attribution state machine (doc §13)

Doc requires these not be interchangeable. Encode them as explicit states on `AffiliateConversion`:

```
click_recorded            AffiliateClick exists (internal, may be ours only)
provider_click_recorded   provider acknowledged the click (Awin/ThriveCart signal)
transaction_received      provider reported a transaction (unmatched or matched)
attribution_confirmed     AffiliateAttribution committed (which affiliate, which rule)
reward_pending            ledger entry in PENDING
reward_approved           provider or admin confirmed eligibility
reward_available          released for redemption
reward_redeemed           consumed
reward_reversed           refund/cancel clawback
```

Policy defaults (per doc, admin-configurable):
- window: 30 days, `attributionWindowDays` **snapshotted onto the conversion** so a later policy change doesn't rewrite history;
- `LAST_ELIGIBLE_CLICK`;
- provider decision wins where provider terms require it → `attributionMethod = PROVIDER` and our window is ignored;
- no reward when the provider cannot confirm → enforced by `assertRewardVerifiable(offer)`.

### 4.6 Reward engine (doc §5, §15)

Evaluation order per conversion:
1. Load `AffiliateOffer.rewardRule` **as of `occurredAt`** (rules are versioned).
2. `assertRewardVerifiable(offer)` — the qualifying event must be verifiable by the provider's `integrationLevel`. A Level-1 (link-only) offer can never have `qualifyingEvent = APPROVED_PURCHASE`.
3. Check caps: per affiliate, per campaign, per offer, reward maximum.
4. Check customer-benefit and affiliate-reward are **two separate records** (§15) and that one redemption cannot fire both twice.
5. Write a `PENDING` ledger entry with `idempotencyKey = conversion:<id>:<rewardRuleVersion>`.
6. On approval (provider `approved`, admin confirmation, or redemption validation) → `APPROVED` → `AVAILABLE`.
7. On refund/cancel/decline → `REVERSED`, writing a **new** ledger row (never mutating the original).

Materialisation:
- **Points:** stay in the ledger. Redeemable against vouchers/benefits per `reward_redemptions`.
- **Vouchers:** issue an `AffiliateVoucher` on approval.
- **Cashback credit (later):** `creditWallet(MCOM_CENTRAL_PARTNER, { category: REWARD }, 'local-affiliate:<ledgerId>')` — exactly the `ReferralCommission` pattern, and only after settlement arrangements exist (doc's recommendation).

### 4.7 Provider contract (doc §16)

One interface, four implementations, so adding a provider never touches the reward engine:

```
getProducts(since?)            → AffiliateProduct[]
buildTrackingUrl(link)         → { url, providerClickRef }
verifyEvent(headers, rawBody)  → ProviderEvent | null     // null for pull-only providers
fetchConversions(window)       → ProviderTransaction[]    // Awin, Mall backfill
mapEventToConversion(event)    → NormalisedConversion
testConnection()               → { ok, detail }
```

`AwinProvider.fetchConversions()` is the scheduled path; `AwinProvider.verifyEvent()` returns `null` by design — that asymmetry is documented, not a bug.

---

## 5. Proposed API surface

Follows `.agent/api-conventions.md` (envelope, pagination, `@ApiBearerAuth`, kebab-case, plural nouns).

**Consumer (JWT, `Role.CUSTOMER`, self-scoped)**
```
POST   /api/v1/local-affiliate/activate            // Scenario A: existing CHS user
POST   /api/v1/local-affiliate/register            // Scenario B: one-shot, transactional
GET    /api/v1/local-affiliate/me                  // profile, affiliateCode, link, card status
GET    /api/v1/local-affiliate/link                // link + QR payload
GET    /api/v1/local-affiliate/activity            // clicks/leads/bookings/purchases, paginated
GET    /api/v1/local-affiliate/rewards             // balances by status (pending/approved/available/redeemed/expired/reversed)
GET    /api/v1/local-affiliate/rewards/ledger      // append-only entries
POST   /api/v1/local-affiliate/rewards/:id/redeem
GET    /api/v1/affiliate-offers                    // marketplace: ?category&location&date&rewardType&page&limit
GET    /api/v1/affiliate-offers/:slug
```

**Public (no auth, throttled)**
```
GET    /api/v1/public/affiliate/:affiliateCode          // personal page payload
GET    /api/v1/r/:trackingLinkCode                      // 302 redirect + click capture (raw, not enveloped)
POST   /api/v1/public/affiliate/redemptions/validate    // business validates a code (throttled, audited)
```

**Partner (mesh `central:issue`, `PartnerFeatureGuard`)**
```
POST   /api/v1/partner/affiliate/conversions   // Mall / ThriveCart push: order paid, refunded
GET    /api/v1/partner/affiliate/attribution   // validate a tracking code before checkout (Mall pre-flight)
POST   /api/v1/partner/affiliate/events        // generic provider event ingest
```

**Admin (`Role.ADMIN`, `adminRole`)**
```
GET/POST/PATCH   /api/v1/admin/local-affiliates[/:id]
GET/POST/PATCH   /api/v1/admin/affiliate-providers[/:id]
POST             /api/v1/admin/affiliate-providers/:id/test
POST             /api/v1/admin/affiliate-providers/:id/sync
GET/POST/PATCH   /api/v1/admin/affiliate-offers[/:id]
GET/POST/PATCH   /api/v1/admin/affiliate-campaigns[/:id]
GET/POST/PATCH   /api/v1/admin/affiliate-reward-rules[/:id]
GET/PATCH        /api/v1/admin/affiliate-conversions[/:id]
GET/POST         /api/v1/admin/affiliate-redemptions
GET              /api/v1/admin/affiliate-reconciliation        // unmatched, failed, stale
```

Contract details worth pre-deciding:
- conversion ingest is **idempotent on `(providerId, providerOrderId)`** and returns `202` on duplicate — never `409`;
- reward state transitions are the only mutation path; there is no "set balance" endpoint;
- raw provider bodies are stored **before** parsing, so a mapping bug is recoverable.

---

## 6. Admin & consumer UI mapping

**Admin** — new `NAV_GROUPS` group "Local Affiliates" with tabs:
`local-affiliates`, `affiliate-providers`, `affiliate-offers`, `affiliate-campaigns`, `affiliate-reward-rules`, `affiliate-redemptions`, `affiliate-reconciliation`, `affiliate-integrations`.
Registration is the documented 5 points (`AdminTab`, `NAV_GROUPS`, `ADMIN_TABS`, `getTabInfo`, `renderPanel`). The doc's §9 "do not put everything in one generic campaign form" is naturally satisfied: each tab is its own panel.

**Consumer** — extend `CustomerDashboard.tsx` `NAV_ITEMS` with `Offers to Share`, `My Affiliate`, `My Rewards`, shown only when a `LocalAffiliateProfile` exists. Reuse `DashboardWallet` for any credit balance; do **not** show pending points there (semantics differ).

**VCard/EV Card** — render a link/status card that calls the existing ecosystem integration (SSO client `mcom-vcard`). Phase 1 shows status only; no provisioning until that platform exposes an API.

---

## 7. Seed / mock data (doc §10)

A dedicated `prisma/seed-local-affiliate.ts` (the repo convention) with deterministic cuid-like ids and an explicit `isDemo` marker on every row, plus a guard that refuses to run when `NODE_ENV=production`.

It must seed the *hard* cases, not just happy paths:
- an existing-CHS affiliate (Scenario A) and a new-account affiliate (Scenario B);
- one affiliate in `PENDING`, one `SUSPENDED`;
- at least one conversion in **every** ledger status including `REVERSED` and `EXPIRED`, so the dashboard can be tested against the doc's §10F list;
- one offer per integration level (L1–L4) — this is what proves `assertRewardVerifiable()` works;
- one Awin transaction that is `pending` then `approved` on a later sync, to exercise the delay UX;
- one duplicate Mall order push, to prove idempotency;
- one refund that reverses an already-approved reward.

---

## 8. Phasing, with the real dependencies

The doc's order is right. The dependencies are sharper than the doc says:

| Phase | Includes | Hard dependency / risk |
|---|---|---|
| **1 — Foundation** | LocalAffiliate profile (both scenarios), affiliate code + link, `/r/:code` redirect + click capture, offer/campaign/reward-rule admin, reward ledger, vouchers + redemption, consumer dashboard, seed data | None external. This is the only phase that can start today. |
| **2 — Mall** | Product import via `partner/catalog`, `laf` param through Mall checkout, `order_attribution`, `order.paid`/`order.refunded` outbox → Central | **Mall work required.** Blocked until Mall adds attribution + an outbox dispatcher. This is the phase that proves or breaks the design. |
| **3 — ThriveCart** | Provider account, product import, `passthrough[la_tracking_id]` link building, event subscription + `order_payment_*` / `order_refund_*` ingest | Needs a real ThriveCart account with products. Low risk if Passthrough (Path A) is chosen. |
| **4 — Awin** | Publisher account, programme/offer import, Link Builder with `clickref`, scheduled `transactions` reconciliation with 31-day windows and validation/amendment passes | **Blocked on Awin.** Do not begin as an individually-rewarded campaign until Subnetwork status + attribution + payout treatment are confirmed in writing. |
| **5 — External businesses** | `ExternalBusiness` + offer registration, L1–L3 tracking, manual confirmation, redemption codes | None external; depends on Phase 1 redemption engine. |

**Do not reorder 2 behind 3/4.** The doc is right that Mall first gives a controlled environment — and the investigation adds a second reason: Mall is the only provider where we can *change both sides*, so it is the only place the attribution contract can be designed properly rather than adapted to someone else's constraints.

---

## 9. Decisions needed before implementation

### The doc's five, with my read on each

| # | Question | Recommendation | Why (from the codebase) |
|---|---|---|---|
| 1 | Commission share, fixed reward, or either? | **Either, per campaign**, defaulting to fixed. | `ReferralConfig` already supports `PERCENTAGE | FIXED` with `SINGLE | PER_ROLE`; the same flexibility is cheap and avoids a rewrite. |
| 2 | Who funds the consumer reward? | Configurable: `BUSINESS_WALLET | PROVIDER_COMMISSION | PLATFORM`. | `AffiliateSettlementFunding` already has `BUSINESS_WALLET | PLATFORM` and the escrow service already debits business → credits affiliate. Reuse that vocabulary. |
| 3 | Points + vouchers only, or cashback too? | **Points + vouchers in Phase 1.** Cashback after settlement. | `Wallet` credits are immediately spendable MCOM balance; cashback requires settlement + reversal machinery. The ledger design above defers it cleanly. |
| 4 | Every approved offer, or location-scoped only? | **Location-scoped by default**, global opt-in per offer. | `CustomerProfile` already carries city/borough/high-street/local-mall; scoping is nearly free and makes "offers near me" real on day one. |
| 5 | Personal page, individual links, or both? | **Both** (doc's own recommendation). | `/a/:affiliateCode` + `/a/:code/o/:offerSlug`; per-(affiliate, offer, campaign) tracking rows make this a rendering choice, not a data-model choice. |

### Six further decisions I found that the doc doesn't cover

| # | Decision | Why it matters |
|---|---|---|
| 6 | **Name the domain `LocalAffiliate`, not `Affiliate`.** New `registrationSource` value; never `affiliate-portal`; never `Role.AGENT`. | `isAffiliate` currently means "agency agent via the affiliate portal" and is mirrored into MCOM Mall. Overloading it silently merges two different populations. |
| 7 | **Awin attribution rides on `clickRef` only.** One opaque `trackingLinkCode`. | `clickRef` is the only field Awin always exposes to publishers; `orderRef` and `customParameters` are conditional. |
| 8 | **ThriveCart = Passthrough (Path A) by default**, native affiliates only on request. | Native affiliate events don't fire in test mode, and Path B cedes the commission relationship to ThriveCart. |
| 9 | **Mall attribution is a first-party Mall change** (`order_attribution` + outbox), validated server-side. | There is no metadata on orders today; a client-supplied affiliate id must not be trusted. |
| 10 | **Pending rewards never touch `Wallet`.** Separate append-only ledger; wallet only on cashback materialisation. | Wallet balance is spendable immediately; the doc's whole status model depends on Pending ≠ Available. |
| 11 | **Awin offers are feature-flagged off until written confirmation.** | Awin subnetworks cannot be further sublicensed without prior written consent. Shipping the capability is fine; switching it on is a business gate. |

---

## 10. Recommended first slice

If we build only one thing first, build this — it is entirely self-contained and proves the two riskiest parts of the model (identity linking and the reward state machine) without touching any external provider:

1. `LocalAffiliateProfile` + `activate` / `register` for both scenarios, with the "already an affiliate → route to dashboard" guard.
2. Affiliate code + `/a/:code` page + `/r/:code` click capture.
3. `AffiliateOffer` (external, Level 2) + `AffiliateRewardRule` + `AffiliateTrackingLink`.
4. Voucher issue → validate → redeem, with one-redeem-per-customer enforced.
5. Pending → approved → available → redeemed → reversed ledger, driven by a **manual admin confirmation** (Level 3).
6. Consumer dashboard tabs + the seed file covering every status.

That exercises Scenario A, Scenario B, the click journey, the two-beneficiary rule, redemption, and reversal — with zero dependency on Mall, ThriveCart, or Awin. Everything after that is provider-specific adapters behind the same interface.

---

## 11. Summary of concrete file-level touch points

| Area | Files to add | Files to modify |
|---|---|---|
| Backend module | `src/local-affiliate/**` (see §4.1) | `src/app.module.ts` |
| Backend mesh | — | `src/mesh-inbound/service-mesh.constants.ts` (add `PartnerFeature` flag) |
| Backend schema | ~24 new models/enums | `prisma/schema.prisma` + one migration |
| Backend seeds | `prisma/seed-local-affiliate.ts` | `prisma/seed.ts` (opt-in hook) |
| Frontend consumer | `pages/affiliate/*` or new panels under `components/` | `pages/CustomerDashboard.tsx` (`NAV_ITEMS`, guards), `App.tsx` (public `/a`, `/r`, `/offers` routes) |
| Frontend admin | `components/admin/local-affiliate/*` | `components/AdminLayout.tsx` (`AdminTab`, `NAV_GROUPS`), `pages/AdminDashboard.tsx` (`ADMIN_TABS`, `getTabInfo`, `renderPanel`) |
| Frontend services | `services/local-affiliate/{index.ts,hooks.ts}` | — |
| Mall (separate repo) | `order_attribution` entity + migration, `affiliate_conversion_outbox`, sweep job | `checkout/initiate` + `checkout/complete` DTOs, order completion path, `partner-callback` pattern |

---

*Prepared against commit state of `central-hub-solution` (latest migration `20261116000000_add_business_banner_and_media`) and `mcom-mall` (`apps/mcom_mallAPI`, TypeORM). External provider behaviour verified against Awin publisher API documentation and ThriveCart developer documentation; the two commercial dependencies (Awin Subnetwork approval, ThriveCart affiliate-feature availability per product) remain business confirmations, not technical assumptions.*
