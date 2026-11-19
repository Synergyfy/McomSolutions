# PRD — 247GBS Local Affiliate System

**Version:** 1.0
**Date:** 17 November 2026
**Repos:** `central-hub-solution` (backend `apps/backend`, frontend `apps/frontend`), `mcom-mall`
**Predecessor:** `docs/local-affiliate-system-analysis.md` (codebase fit analysis)
**Source of business direction:** the "247GBS Local Affiliate System — End-to-End Business and Technical Model"

---

## 0. Document control

### 0.1 Requirement labelling

Every requirement carries exactly one label:

| Label | Meaning | Authority |
|---|---|---|
| `[CONFIRMED]` | Business direction taken directly from the source model. | Business owner. Do not change without sign-off. |
| `[PROPOSED]` | Technical design decision made during analysis to satisfy a `[CONFIRMED]` requirement. | Engineering. Changeable, but a change is a design decision that must be recorded. |
| `[OPEN]` | Not decided. A default is stated so build can proceed; the default is not a commitment. | Business owner. Must be closed before the relevant phase ships. |

### 0.2 Where this PRD deviates from a literal reading of the source model

Three deviations, each justified in the analysis. All are `[PROPOSED]` and all preserve the business intent:

1. **The domain is called "Local Affiliate", not "Affiliate".** CHS already ships an `Affiliate` domain meaning the 247GBS Affiliates *agency* (AGENT / CONSULTANT / ACCOUNT_MANAGER). `isAffiliate` already means "agency agent via the affiliate portal" and is mirrored into MCOM Mall. Reusing the word would merge two different populations. See `AN-2.1` in the analysis.
2. **One opaque token crosses external boundaries.** The model's example `clickRef = LAF000125_CAM00045` is replaced by `clickRef = <trackingLinkCode>`. Awin only guarantees `clickRef`; `orderRef` and `customParameters` are conditional. Internal ids are resolved server-side.
3. **Pending rewards are never wallet balance.** The MCOM wallet is spendable the instant it is credited. Pending points live in an append-only affiliate ledger; the wallet is used only when cashback materialisation is enabled in a later phase.

### 0.3 Non-goals (explicitly out of scope)

- The 247GBS Affiliates agency portal (`247gbsaffiliates.com`), agency tasks, escrow, reputation.
- Cash payout / bank settlement to consumers (`[OPEN]`; doc recommends deferring).
- Changing MCOM Mall's checkout, pricing, or fulfilment beyond the attribution surface defined in §8.2.
- Building MCOM VCard / EV Card provisioning (external platform, no API in these repos).
- Buyless/cashback card networks, taxation reporting, KYC on affiliates.
- Redesigning the shared UI kit (see §14.6 — a known cost, accepted for this phase).

---

## 1. Terminology

| Term | Definition |
|---|---|
| **CHS identity** | A row in `users`. One per person, irrespective of how many roles they hold. |
| **Local Affiliate** | A CHS identity with a `LocalAffiliateProfile`. A consumer earning rewards by sharing offers. Never `Role.AGENT`. |
| **Agency Affiliate** | `Role.AGENT / CONSULTANT / ACCOUNT_MANAGER`. Out of scope. Named "agency" throughout this PRD to avoid ambiguity. |
| **Provider** | The owner of a product, service, offer, checkout or redemption mechanism. Mall, ThriveCart, Awin, or an external business. |
| **Integration level** | How much a provider lets us verify: `LINK_ONLY` → `REDEMPTION_CODE` → `MANUAL_CONFIRMATION` → `PROVIDER_API` / `PROVIDER_WEBHOOK`. |
| **Offer** | A promotable thing. Owned by a provider, promoted by us. |
| **Campaign** | A time-boxed grouping of offers with shared rules, budget and eligibility. |
| **Tracking link** | The per-`(affiliate, offer, campaign)` link. The unit of attribution. |
| **Conversion** | A qualifying event received from a provider, before or after attribution. |
| **Attribution** | The decision that a specific conversion belongs to a specific tracking link. |
| **Reward** | What the affiliate earns. Units of `POINTS` or `CREDIT`. |
| **Redemption** | The affiliate spending a reward. |
| **Voucher** | A code the *referred customer* presents to the provider (the customer benefit). Distinct from the affiliate's reward. |

---

## 2. Personas and permissions

| Persona | Role | Can |
|---|---|---|
| Prospective affiliate (existing CHS user) | any non-`ADMIN` | Activate a Local Affiliate profile on their existing identity. |
| Prospective affiliate (new user) | — | Register a CHS identity and an affiliate profile in one journey. |
| Local Affiliate | `CUSTOMER` + profile (other roles permitted, see `FR-1.3`) | Browse offers, create links, share, view activity, view/redeem rewards. |
| Referred customer | any | Visit an offer, receive the customer benefit. Never sees affiliate rewards. |
| Business (MCOM) | `BUSINESS` / `BUSINESS_OWNER` | Validate redemption codes for their own offers. |
| External business operator | `BUSINESS` with `x-api-key` | Validate redemption codes via API. |
| Admin | `ADMIN` with `adminRole` | Full management, approvals, reconciliation, manual confirmation. |

`[PROPOSED]` All consumer endpoints are self-scoped: the service resolves `localAffiliateId` from `req.user.id` and never accepts it from the client. Ownership is re-verified in the service layer, not only in the guard (per `.agent/security-rules.md`).

---

## 3. Architecture context

### 3.1 Position in the ecosystem

```
                  ┌──────────────────────────────────────────────┐
                  │  CHS / 247GBS Central (apps/backend)         │
                  │                                              │
Local Affiliate ──┤  Local Affiliate domain (NEW)                │
  (browser)       │   • identity + affiliate profile             │
                  │   • offers / campaigns / tracking links      │
                  │   • conversions / attribution                │
                  │   • reward ledger / redemptions / vouchers   │
                  │   • reconciliation + admin                   │
                  └───────┬───────────────────────┬──────────────┘
                          │ mesh (RS256)          │ provider adapters
                          │                       │
              ┌───────────▼─────────┐   ┌─────────▼─────────────────────┐
              │ MCOM Mall           │   │ ThriveCart (API + events)     │
              │ order_attribution   │   │ Awin (pull reconciliation)    │
              │ + outbox            │   │ External business (L1–L3)     │
              └─────────────────────┘   └───────────────────────────────┘
```

### 3.2 Ownership boundary `[CONFIRMED]`

From the source model §19, restated as a testable rule:

- Central owns **identity, affiliate relationship, attribution records and the consumer reward ledger**.
- Providers own **product, price, checkout, fulfilment and redemption mechanics**.
- **No provider may be the source of truth for an affiliate's reward balance.** Where a provider computes commission (Awin, ThriveCart native affiliates), its figure is an *input* to our rules, never the balance.

`[PROPOSED]` Enforcement: the reward ledger has no write path that accepts a provider-supplied balance. All ledger writes go through `AffiliateRewardService.applyRule()`, which reads our own `AffiliateRewardRule`.

---

## 4. Functional requirements

### FR-1 — Registration and identity linking

#### FR-1.1 Scenario A — existing CHS identity
`[CONFIRMED]` An existing CHS user signing in and activating an affiliate profile must **not** create a second `users` row.

| ID | Requirement |
|---|---|
| `FR-1.1.1` | `[CONFIRMED]` The activation flow is: authenticate → confirm identity → present affiliate terms → accept → create profile → generate code and link → open dashboard. |
| `FR-1.1.2` | `[PROPOSED]` Activation is a single endpoint, `POST /api/v1/local-affiliate/activate`, authenticated by JWT. It creates exactly one `local_affiliate_profiles` row keyed `userId @unique`. |
| `FR-1.1.3` | `[PROPOSED]` Activation is idempotent: a second call returns `200` with `alreadyActive: true` and the existing profile, never a second profile and never a `409`. |
| `FR-1.1.4` | `[CONFIRMED]` If a profile already exists, the user is routed to their dashboard rather than offered a second identity. |
| `FR-1.1.5` | `[PROPOSED]` Terms acceptance is recorded as `termsVersion` + `termsAcceptedAt`; a version bump requires re-acceptance before activation continues. |
| `FR-1.1.6` | `[PROPOSED]` Activation never mutates `Role`, never sets `registrationSource = 'affiliate-portal'`, and never grants agency permissions. |

#### FR-1.2 Scenario B — new CHS identity
`[CONFIRMED]` A new user completes CHS registration and affiliate profile creation in **one** journey, without the agency recruitment process.

| ID | Requirement |
|---|---|
| `FR-1.2.1` | `[PROPOSED]` `POST /api/v1/local-affiliate/register` creates `User` + `Wallet` + `CustomerProfile` + `LocalAffiliateProfile` in **one Prisma transaction**. A partial identity is never left behind. |
| `FR-1.2.2` | `[PROPOSED]` `registrationSource` is set to `local-affiliate` (distinct from `affiliate-portal` and from `direct`). |
| `FR-1.2.3` | `[CONFIRMED]` If email or mobile is already registered, do not create an account. |
| `FR-1.2.4` | `[PROPOSED]` The endpoint returns `409` with `errors: ["EMAIL_ALREADY_REGISTERED"]`; the client must offer "sign in instead", deep-linked to `POST …/activate` after login. |
| `FR-1.2.5` | `[CONFIRMED]` Email (or mobile) verification is required before affiliate status becomes `ACTIVE`. |
| `FR-1.2.6` | `[PROPOSED]` Until verified, the profile exists with `status = PENDING`. Dashboard access is allowed but link creation and sharing are blocked with a clear reason. |
| `FR-1.2.7` | `[PROPOSED]` Optional `inviteCode` (business invitation / QR / EV Card link) is recorded on the profile as `acquisitionSource` + `acquisitionRef` for reporting only. It must not affect rewards. |
| `FR-1.2.8` | `[PROPOSED]` Password rules follow the existing `RegisterDto` (`MinLength(8)`); the stronger `IsStrongPassword` policy in `.agent/dto-validation.md` is **not** enforced because existing customer registration does not, and divergence would break login parity. Recorded as a follow-up. |

#### FR-1.3 Eligibility to be an affiliate
| ID | Requirement |
|---|---|
| `FR-1.3.1` | `[OPEN]` Should a `BUSINESS`-role identity be allowed to become a Local Affiliate? **Default: yes**, because the model states one identity may be consumer, business participant and Local Affiliate subject to permissions. `ADMIN` is excluded. |
| `FR-1.3.2` | `[PROPOSED]` `ADMIN` receives `403 AFFILIATE_NOT_ELIGIBLE` (mirrors `ReferralsService`, which already blocks admins). |
| `FR-1.3.3` | `[PROPOSED]` A soft-deleted or suspended user cannot activate. |
| `FR-1.3.4` | `[OPEN]` Minimum age / residency requirement. **Default: none implemented**; the terms cover it. |

#### FR-1.4 Affiliate identity and code
| ID | Requirement |
|---|---|
| `FR-1.4.1` | `[CONFIRMED]` Each affiliate gets a unique human-readable id and a personal link. |
| `FR-1.4.2` | `[PROPOSED]` `affiliateCode` format is `LAF-` + zero-padded 6-digit sequence (`LAF-000125`). Generated from a dedicated Postgres sequence `local_affiliate_code_seq` created in the migration. Sequence gaps on rollback are acceptable and documented. |
| `FR-1.4.3` | `[PROPOSED]` Codes are permanent and never reissued, even after closure, to protect historical links. |
| `FR-1.4.4` | `[PROPOSED]` Tracking link tokens are separate from the affiliate code: base62, 10 characters, cryptographically random, unique, and opaque (no embedded ids, no affiliate code). |

#### FR-1.5 EV Card / MCOM VCard
| ID | Requirement |
|---|---|
| `FR-1.5.1` | `[CONFIRMED]` Connect an existing card, or provision one if the integration supports it; otherwise continue without one. |
| `FR-1.5.2` | `[PROPOSED]` `local_affiliate_cards` records a *linked external* card (`provider`, `externalCardId`, `status`, `linkedAt`). No provisioning API exists in these repos; MCOM vCard is a registered ecosystem platform (`clientId: mcom-vcard`). |
| `FR-1.5.3` | `[PROPOSED]` Card status is always optional and never blocks activation, link creation or rewards. A failure to link must not fail activation. |
| `FR-1.5.4` | `[PROPOSED]` In Phase 1 the card is read-only status display. NFC/QR destination handling is Phase 2. |

---

### FR-2 — Personal affiliate page and sharing

| ID | Requirement |
|---|---|
| `FR-2.1` | `[CONFIRMED]` Each affiliate has a permanent personal page listing their available offers and campaigns. |
| `FR-2.2` | `[PROPOSED]` URL: `/a/:affiliateCode`. Offer-specific page: `/a/:affiliateCode/o/:offerSlug`. The affiliate identity is preserved when moving from page to offer. |
| `FR-2.3` | `[CONFIRMED]` The affiliate can share: the personal page, a specific product/service link, a campaign link, an EV Card link, and a QR/NFC destination. |
| `FR-2.4` | `[PROPOSED]` All shares resolve through one redirect: `/r/:trackingLinkCode`. Sharing a raw provider URL directly is not supported and must not be presented in the UI. |
| `FR-2.5` | `[PROPOSED]` Routes must not live under `/affiliate/*` — that path is the agency signup funnel (`/register/affiliate/*`). |
| `FR-2.6` | `[PROPOSED]` QR codes are generated client-side from the share URL; the API returns the URL only. No server-side image rendering in Phase 1. |
| `FR-2.7` | `[PROPOSED]` The public page payload exposes display name and offers only — never email, phone, postcode, balances or reward values. |

---

### FR-3 — Offer catalogue

| ID | Requirement |
|---|---|
| `FR-3.1` | `[CONFIRMED]` Offers originate from MCOM Mall, other 247GBS platforms, external businesses, ThriveCart and Awin, and all appear in one catalogue. |
| `FR-3.2` | `[CONFIRMED]` MCOM Mall product data is **retrieved**, not re-entered by the business. |
| `FR-3.3` | `[CONFIRMED]` Every offer shows its source to the affiliate, but not the integration mechanics. |
| `FR-3.4` | `[PROPOSED]` `affiliate_products` is a read-through cache of provider products (`@@unique([providerId, externalProductId])`). The provider stays authoritative; `sourcePayload` retains the raw snapshot. |
| `FR-3.5` | `[PROPOSED]` `affiliate_offers` references a product (optional for pure external links) and always records `providerId`, `destinationUrl`, `integrationLevel`, `trackingMethod`, `eligibility`, `customerBenefit` and `rewardRuleId`. |
| `FR-3.6` | `[CONFIRMED]` Admin must approve an offer before it is visible. Lifecycle: `DRAFT → PENDING_APPROVAL → ACTIVE → PAUSED → ENDED → ARCHIVED`. |
| `FR-3.7` | `[PROPOSED]` An offer cannot move to `ACTIVE` unless `assertRewardVerifiable()` passes (see `FR-8.3`). This is enforced in the service, not the UI. |
| `FR-3.8` | `[CONFIRMED]` Marketplace categories: Local Businesses, MCOM Mall, 247GBS Offers, External Offers, Online Products, Seasonal Campaigns, Events & Experiences. |
| `FR-3.9` | `[PROPOSED]` Categories are a seeded reference table (`affiliate_offer_categories`) rather than an enum, so Admin can add categories without a migration. |
| `FR-3.10` | `[CONFIRMED]` Filters: location, category, offer type, campaign date, reward type. |

---

### FR-4 — Campaigns

| ID | Requirement |
|---|---|
| `FR-4.1` | `[CONFIRMED]` A campaign brings offers, tracking method, qualifying event, reward rule, approval conditions, dates, materials and budget/cap together. |
| `FR-4.2` | `[CONFIRMED]` One campaign may contain offers from **different providers**, each with a valid tracking and conversion mechanism. |
| `FR-4.3` | `[PROPOSED]` Campaign and offer are independent: an offer may run without a campaign (direct-to-marketplace), and a campaign may include an offer that also runs standalone. `affiliate_campaign_offers` is the join. |
| `FR-4.4` | `[PROPOSED]` Campaign budget is expressed in reward units and enforced at reward-write time, not at display time. When the cap is reached the campaign auto-pauses and Admin is notified. |
| `FR-4.5` | `[PROPOSED]` Table name is `local_affiliate_campaigns` and model `AffiliateCampaign` — the name `campaigns` / `Campaign` is already taken by geographic marketing campaigns. |
| `FR-4.6` | `[CONFIRMED]` Eligible affiliate groups are configurable per campaign. `[OPEN]` Definition of "group". **Default: derive from location scope + membership tier; no manual grouping in Phase 1.** |

---

### FR-5 — Tracking and attribution

| ID | Requirement |
|---|---|
| `FR-5.1` | `[CONFIRMED]` The system must preserve: CHS user id, affiliate id, tracking link id, campaign id, offer id, product/service id, provider id, provider click reference, provider transaction/order id. |
| `FR-5.2` | `[PROPOSED]` Mapping: `trackingLinkId` is the only value that leaves the platform (URL path, `laf` query param, ThriveCart `passthrough`, Awin `clickRef`). All others are joined internally. |
| `FR-5.3` | `[CONFIRMED]` A click is not a sale; a purchase is not an immediately spendable reward. |
| `FR-5.4` | `[PROPOSED]` Seven distinct states, each independently observable, never collapsed: `CLICK_RECORDED`, `PROVIDER_CLICK_RECORDED`, `TRANSACTION_RECEIVED`, `ATTRIBUTION_CONFIRMED`, `REWARD_PENDING`, `REWARD_APPROVED`, `REWARD_AVAILABLE`. |
| `FR-5.5` | `[CONFIRMED]` Default policy: 30-day window, last eligible click wins, provider's own attribution decision takes precedence, no reward when the provider cannot confirm. |
| `FR-5.6` | `[PROPOSED]` The window is configurable per offer and per campaign; the **effective value is snapshotted onto the conversion** (`attributionWindowDays`) so a later policy change never rewrites history. |
| `FR-5.7` | `[PROPOSED]` `attribution_method` records which rule was applied (`INTERNAL_LAST_CLICK`, `PROVIDER_LAST_CLICK`, `PROVIDER_DECISION`, `MANUAL`). Every decided attribution is immutable; a re-decision supersedes, never overwrites. |
| `FR-5.8` | `[PROPOSED]` The redirect (`GET /r/:code`) must never fail the visitor. Any persistence error is logged and the redirect still completes. |
| `FR-5.9` | `[PROPOSED]` The redirect resolves the destination **server-side from the offer**. A caller-supplied destination parameter is never honoured (open-redirect protection). |
| `FR-5.10` | `[PROPOSED]` Clicks store a hashed IP (`ipHash`), never the raw address; raw IP retention is explicitly rejected. |
| `FR-5.11` | `[CONFIRMED]` Attribution limits caused by cookie loss, device switching, tracking protection and provider rules must be assumed and communicated, not hidden. |

---

### FR-6 — Providers and integration levels

| ID | Requirement |
|---|---|
| `FR-6.1` | `[CONFIRMED]` Admin creates a provider record per source with name, type, integration type, auth status, supported tracking methods, supported conversion events, supported reward methods, connection status, notes, last successful sync. |
| `FR-6.2` | `[CONFIRMED]` Credentials are stored securely and never exposed to affiliates. |
| `FR-6.3` | `[PROPOSED]` Credentials are encrypted at rest with AES-256-GCM using the existing `console/crypto.util` (`CONSOLE_ENCRYPTION_KEY`). They are never returned by any read endpoint — only a masked status. |
| `FR-6.4` | `[CONFIRMED]` Four integration levels: `LINK_ONLY`, `REDEMPTION_CODE`, `MANUAL_CONFIRMATION`, `PROVIDER_API` (+ `PROVIDER_WEBHOOK` as the event-driven variant). |
| `FR-6.5` | `[CONFIRMED]` The campaign configuration must restrict rewards to events the integration can actually verify. |
| `FR-6.6` | `[PROPOSED]` Verification matrix is enforced in code, not documentation: |

| Qualifying event | LINK_ONLY | REDEMPTION_CODE | MANUAL_CONFIRMATION | PROVIDER_API | PROVIDER_WEBHOOK |
|---|---|---|---|---|---|
| `LINK_CLICK` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `QUALIFIED_VISIT` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `VERIFIED_LEAD` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `COMPLETED_BOOKING` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `APPROVED_PURCHASE` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `VERIFIED_REDEMPTION` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `CANCELLED_REFUNDED` | ❌ | ❌ | ✅ | ✅ | ✅ |

| ID | Requirement |
|---|---|
| `FR-6.7` | `[PROPOSED]` Offering a reward on an unverifiable event is a `400 REWARD_EVENT_NOT_VERIFIABLE` at offer save time and again at reward write time (defence in depth). |
| `FR-6.8` | `[CONFIRMED]` A `LINK_ONLY` offer may still appear in the marketplace and record traffic — it simply cannot promise a sale reward. |
| `FR-6.9` | `[PROPOSED]` Each provider adapter implements one interface (`getProducts`, `buildTrackingUrl`, `verifyEvent`, `fetchConversions`, `mapEventToConversion`, `testConnection`) so adding a provider never touches the reward engine. |
| `FR-6.10` | `[PROPOSED]` Providers are individually feature-flagged (`AFFILIATE_PROVIDER_<CODE>_ENABLED`). Disabled providers keep historical data but stop accepting new events. |

---

### FR-7 — Conversions and provider events

| ID | Requirement |
|---|---|
| `FR-7.1` | `[CONFIRMED]` Provider transaction/order ids must be unique per provider account, so duplicate notifications cannot credit twice. |
| `FR-7.2` | `[PROPOSED]` Two layers of dedupe: `affiliate_provider_transactions @@unique([providerAccountId, providerTransactionId])` and `affiliate_conversions @@unique([providerId, providerTransactionId, eventType])`. |
| `FR-7.3` | `[PROPOSED]` Raw provider payloads are persisted **before** mapping, in `affiliate_provider_events` (webhook) or `affiliate_provider_transactions.raw` (pull), so a mapping bug is recoverable without asking the provider to resend. |
| `FR-7.4` | `[PROPOSED]` Ingest always returns `202 Accepted` for duplicates — never `409`. Providers must not retry-storm. |
| `FR-7.5` | `[PROPOSED]` Unmatched conversions are retained with `status = UNMATCHED` and retried by a scheduled matcher (15 min). They are never discarded. |
| `FR-7.6` | `[PROPOSED]` A conversion that cannot be attributed after the retention window becomes `EXPIRED_UNATTRIBUTED` and appears in reconciliation. |
| `FR-7.7` | `[CONFIRMED]` Refunds and cancellations must reverse or cancel the associated reward. |
| `FR-7.8` | `[PROPOSED]` A provider `amend` (Awin) or partial refund produces a **new** conversion row and a delta ledger entry; it never mutates the original. |

---

### FR-8 — Reward rules

| ID | Requirement |
|---|---|
| `FR-8.1` | `[CONFIRMED]` Reward types: points, cashback credit, voucher, discount reward, loyalty stamp, campaign reward. |
| `FR-8.2` | `[CONFIRMED]` Rules configure: qualifying event, reward type, value, minimum purchase, maximum reward, approval basis, reversal policy, expiry. They may be fixed, percentage, tiered, campaign-limited, or purchase-conditional. |
| `FR-8.3` | `[PROPOSED]` Reward rules are **immutable and versioned** (`version @unique`, `isCurrent`), mirroring `ReferralConfig`. Evaluation always uses the version current at the conversion's `occurredAt`. |
| `FR-8.4` | `[PROPOSED]` Phase 1 supports `POINTS` and `VOUCHER` only. `CREDIT` (cashback) is modelled but disabled behind `AFFILIATE_CASHBACK_ENABLED=false` until settlement exists. |
| `FR-8.5` | `[PROPOSED]` `DISCOUNT`, `LOYALTY_STAMP`, `CAMPAIGN_BENEFIT` are modelled as enums and rules but are not selectable in the Phase 1 UI. |
| `FR-8.6` | `[CONFIRMED]` Customer benefit and affiliate reward are configured **separately** even when triggered by the same event. |

---

### FR-9 — Reward ledger

| ID | Requirement |
|---|---|
| `FR-9.1` | `[CONFIRMED]` The ledger records every credit, debit, expiry and reversal. A balance is never simply overwritten. |
| `FR-9.2` | `[CONFIRMED]` Statuses: Pending, Approved, Available, Redeemed, plus Rejected, Cancelled, Reversed, Expired. |
| `FR-9.3` | `[PROPOSED]` The ledger is **append-only**. Units are never mutated after insert. Only `status` and lifecycle timestamps transition, and every transition writes an `affiliate_ledger_events` row. |
| `FR-9.4` | `[PROPOSED]` Spending and expiry are recorded as `DEBIT` / `EXPIRY` rows, not by mutating the earning row. Balances are derived by aggregation. |
| `FR-9.5` | `[PROPOSED]` Every ledger write carries a unique `idempotencyKey`. Replays are no-ops returning the existing row. |
| `FR-9.6` | `[CONFIRMED]` The dashboard must distinguish: total earned, pending, approved, available, redeemed, expired, reversed. |
| `FR-9.7` | `[CONFIRMED]` The dashboard must explain **why** a reward is pending, rejected or reversed. `[PROPOSED]` `explanationCode` + `explanationText` on the ledger row. |
| `FR-9.8` | `[PROPOSED]` Pending rewards never appear in the MCOM wallet balance. |

---

### FR-10 — Redemption

| ID | Requirement |
|---|---|
| `FR-10.1` | `[CONFIRMED]` Two separate processes: the referred customer uses the offer; the affiliate earns after verification. |
| `FR-10.2` | `[CONFIRMED]` The visitor receives the customer offer; the affiliate earns the affiliate reward. |
| `FR-10.3` | `[CONFIRMED]` A voucher must not be redeemable repeatedly unless the campaign explicitly allows multiple uses. |
| `FR-10.4` | `[CONFIRMED]` The platform must prevent one redemption generating repeated affiliate rewards. |
| `FR-10.5` | `[PROPOSED]` `affiliate_vouchers` with `maxUses` (default 1), `maxUsesPerCustomer` (default 1), and `affiliate_redemptions @@unique([voucherId, customerKey])`. |
| `FR-10.6` | `[PROPOSED]` `customerKey` is `customerUserId` when known, otherwise a stable hash of the redeeming identity/business reference — because PostgreSQL treats `NULL`s as distinct and a nullable unique column would not enforce the rule. |
| `FR-10.7` | `[CONFIRMED]` Redemption creates a unique code the provider validates. |
| `FR-10.8` | `[PROPOSED]` Voucher codes are crypto-random over an unambiguous alphabet (no `0/O/1/I/L`), 8 characters, displayed as `XXXX-XXXX`, generated with a uniqueness retry loop. |
| `FR-10.9` | `[PROPOSED]` Validation endpoint accepts either a business JWT or a business API key (`BusinessProfile.apiKey`, `x-api-key` header — same pattern as `IntegrationController`). |
| `FR-10.10` | `[PROPOSED]` Validation is idempotent per `(voucher, customer)`. A second attempt returns `200` with `status: ALREADY_REDEEMED` and the original timestamp, not an error, so a POS double-tap is harmless. |
| `FR-10.11` | `[PROPOSED]` Every validation attempt — success, rejection, duplicate — is logged with actor, channel and IP for dispute handling. |

---

### FR-11 — Reversals and adjustments

| ID | Requirement |
|---|---|
| `FR-11.1` | `[CONFIRMED]` A refunded or cancelled transaction reverses the related reward. |
| `FR-11.2` | `[PROPOSED]` Reversal policy per rule: `REVERSE_ON_REFUND` (default for purchases), `NO_REVERSAL` (permitted for small fixed rewards), `MANUAL_REVIEW`. |
| `FR-11.3` | `[PROPOSED]` Reversal of a `PENDING` or `AVAILABLE` reward writes a negative `REVERSAL` entry and expires the earning row. |
| `FR-11.4` | `[PROPOSED]` Reversal of an already-**redeemed** reward cannot claw back an issued voucher. Instead: balance may go negative, redemptions are blocked while negative, and an exception row is created for Admin. This is surfaced, never silently absorbed. |
| `FR-11.5` | `[PROPOSED]` Partial reversal creates a proportional entry; the original earning row keeps its units and records `partiallyReversedUnits`. |
| `FR-11.6` | `[CONFIRMED]` Expired rewards cannot be resurrected by a later approval. |

---

### FR-12 — Notifications

| ID | Requirement |
|---|---|
| `FR-12.1` | `[PROPOSED]` Reuse the existing `Notification` model (user-scoped, `type`, `data`). No new notification infrastructure. |
| `FR-12.2` | `[PROPOSED]` Events: affiliate activated, first click, reward pending, reward approved, reward rejected (with reason), reward expiring in 7 days, redemption confirmed, reversal applied. |
| `FR-12.3` | `[CONFIRMED]` Communication must make the approval delay explicit for Awin-style providers. `[PROPOSED]` The pending explanation names the provider and the expected delay window. |

---

### FR-13 — Admin reconciliation and reporting

| ID | Requirement |
|---|---|
| `FR-13.1` | `[CONFIRMED]` Admin manages: unattributed events, failed syncs, provider transactions, commissions, duplicate and unmatched events. |
| `FR-13.2` | `[PROPOSED]` A single reconciliation surface with queues: `unmatched_conversions`, `duplicate_transactions`, `failed_syncs`, `negative_balances`, `over_budget_campaigns`, `stale_providers` (no successful sync in 24 h). |
| `FR-13.3` | `[PROPOSED]` Manual attribution is an explicit action creating an `attribution_method = MANUAL` record with actor, reason and evidence note. |
| `FR-13.4` | `[PROPOSED]` Reconciliation actions are recorded in the existing `AuditLog` (`action`, `adminName`, `targetType`, `targetName`, `details`, `category`) — no new audit table. |

---

### FR-14 — Location and eligibility scoping

| ID | Requirement |
|---|---|
| `FR-14.1` | `[CONFIRMED]` Filters and discovery include location. |
| `FR-14.2` | `[PROPOSED]` Eligibility scope on offer and campaign: `GLOBAL`, `CITY`, `BOROUGH`, `HIGH_STREET`, `LOCAL_MALL`, `MEMBERSHIP_TIER`, `AFFILIATE_STATUS`. Multiple scopes combine as OR; each scope carries its id list. |
| `FR-14.3` | `[PROPOSED]` The affiliate's location is read live from `CustomerProfile` (which already carries `cityId`/`boroughId`/`highStreetId`/`localMallId`). No duplication into the affiliate profile. |
| `FR-14.4` | `[PROPOSED]` A missing location degrades to `GLOBAL` offers only. It never errors. |
| `FR-14.5` | `[OPEN]` Should affiliates see all approved offers or only eligible ones? **Default (and recommendation): only eligible, with a visible "why you can't see more" explanation.** |

---

### FR-15 — Audit, security and abuse

| ID | Requirement |
|---|---|
| `FR-15.1` | `[CONFIRMED]` Credentials never exposed to affiliates; auth failures logged. |
| `FR-15.2` | `[PROPOSED]` Self-referral is blocked: if the attributed buyer's CHS user id equals the affiliate's, the conversion is rejected with `SELF_REFERRAL` and retained for review. |
| `FR-15.3` | `[PROPOSED]` Where the buyer identity is unknown (external Level 1–3), self-referral cannot be detected; the offer must be marked `identityUnverifiable` and Admin sees it in reconciliation. |
| `FR-15.4` | `[OPEN]` May an affiliate promote their own business's offers? **Default: no** (`allowOwnerPromotion = false`), enforced when the offer's business maps to the affiliate's `BusinessProfile`. |
| `FR-15.5` | `[PROPOSED]` `/r/:code` and the public validation endpoint are rate-limited; the redirect gets a dedicated generous `@Throttle` so a widely shared link behind one NAT is not blocked. |
| `FR-15.6` | `[PROPOSED]` Unknown or disabled tracking codes redirect to the offers index with `?link=unavailable`, never to a raw destination and never to a 404. |
| `FR-15.7` | `[PROPOSED]` Click records are retained 400 days then aggregated; conversion and ledger records are retained indefinitely (financial record). |
| `FR-15.8` | `[PROPOSED]` Public affiliate page responses are cached for 60 s and must contain no PII. |

---

## 5. Data model

`[PROPOSED]` unless stated. Conventions follow `.agent/migration-rules.md` and the existing schema: `cuid()` ids, `createdAt`/`updatedAt`, `@map` snake_case, `@@map` plural tables, `@@index` on every filtered sort key, soft delete (`deletedAt`) only where the record is logically removable.

### 5.1 Enums

```
LocalAffiliateStatus        PENDING | ACTIVE | SUSPENDED | CLOSED
LocalAffiliateCardStatus    NOT_LINKED | PENDING | LINKED | FAILED
AffiliateProviderType       INTERNAL_PLATFORM | EXTERNAL_CHECKOUT | AFFILIATE_NETWORK | EXTERNAL_BUSINESS
AffiliateIntegrationLevel   LINK_ONLY | REDEMPTION_CODE | MANUAL_CONFIRMATION | PROVIDER_API | PROVIDER_WEBHOOK
AffiliateProviderStatus     DRAFT | CONNECTED | DEGRADED | DISCONNECTED
AffiliateOfferStatus        DRAFT | PENDING_APPROVAL | ACTIVE | PAUSED | ENDED | ARCHIVED
AffiliateCampaignStatus     DRAFT | SCHEDULED | ACTIVE | PAUSED | ENDED
AffiliateTrackingMethod     INTERNAL_REDIRECT | BUILT_AT_CLICK | STATIC_PROVIDER_LINK
AffiliateQualifyingEvent    LINK_CLICK | QUALIFIED_VISIT | VERIFIED_LEAD | COMPLETED_BOOKING
                            | APPROVED_PURCHASE | VERIFIED_REDEMPTION | CANCELLED_REFUNDED
AffiliateRewardType         POINTS | CREDIT | VOUCHER | DISCOUNT | LOYALTY_STAMP | CAMPAIGN_BENEFIT
AffiliateRewardCalculation  FIXED | PERCENTAGE | TIERED
AffiliateRewardUnit         POINTS | CREDIT
AffiliateApprovalMode       AUTOMATIC | PROVIDER_CONFIRMATION | ADMIN_CONFIRMATION | REDEMPTION_VALIDATION
AffiliateReversalPolicy     REVERSE_ON_REFUND | NO_REVERSAL | MANUAL_REVIEW
AffiliateConversionStatus   RECEIVED | MATCHED | UNMATCHED | ATTRIBUTED | REJECTED | DUPLICATE | EXPIRED_UNATTRIBUTED
AffiliateAttributionMethod  INTERNAL_LAST_CLICK | PROVIDER_LAST_CLICK | PROVIDER_DECISION | MANUAL
AffiliateRewardStatus       PENDING | APPROVED | AVAILABLE | REDEEMED | REJECTED | CANCELLED | REVERSED | EXPIRED
AffiliateLedgerEntryType    CREDIT | DEBIT | EXPIRY | REVERSAL | ADJUSTMENT
AffiliateVoucherStatus      ISSUED | PARTIALLY_REDEEMED | REDEEMED | EXPIRED | REVOKED
AffiliateRedemptionStatus   VALIDATED | REJECTED | REVERSED
AffiliateEligibilityScope   GLOBAL | CITY | BOROUGH | HIGH_STREET | LOCAL_MALL | MEMBERSHIP_TIER | AFFILIATE_STATUS
AffiliateSyncStatus         SUCCESS | PARTIAL | FAILED
```

### 5.2 Tables

**`local_affiliate_profiles`** — the affiliate identity
`id`, `userId @unique` → `User`, `affiliateCode @unique`, `status`, `displayName?`, `termsVersion`, `termsAcceptedAt`, `activatedFrom` (`EXISTING_CHS`|`NEW_CHS`), `acquisitionSource?`, `acquisitionRef?`, `approvedByUserId?`, `approvedAt?`, `suspendedReason?`, `firstClickAt?`, `firstRewardAt?`, `createdAt`, `updatedAt`, `deletedAt?`.
Indexes: `@@index([status])`, `@@index([createdAt desc])`.

**`local_affiliate_cards`**
`id`, `localAffiliateId` → profile, `provider` (`vcard`|`evcard`), `externalCardId?`, `status`, `linkedAt?`, `lastCheckedAt?`, `metadata Json?`. `@@unique([localAffiliateId, provider])`.

**`affiliate_providers`**
`id`, `code @unique` (`mcom_mall`|`thrivecart`|`awin`|`external_*`), `name`, `type`, `integrationLevel`, `status`, `supportedEvents AffiliateQualifyingEvent[]`, `supportedRewardMethods AffiliateRewardType[]`, `requiresManualApproval Boolean`, `featureFlag String?`, `notes Text?`, `lastSuccessfulSyncAt?`, `createdAt`, `updatedAt`.

**`affiliate_provider_accounts`**
`id`, `providerId`, `label`, `externalAccountId`, `credentialsEncrypted Text?`, `config Json?`, `status`, `lastSyncedAt?`, `syncCursor Json?`, `lastSyncError Text?`, `createdAt`, `updatedAt`. `@@unique([providerId, externalAccountId])`.

**`external_businesses`**
`id`, `name`, `website?`, `contactName?`, `contactEmail?`, `contactPhone?`, `address?`, `postcode?`, `country`, `cityId?`/`boroughId?`/`highStreetId?`/`localMallId?` (FK `SetNull`), `category?`, `verificationStatus` (`UNVERIFIED|PENDING|VERIFIED|REJECTED`), `verifiedAt?`, `verifiedByUserId?`, `notes Text?`, timestamps, `deletedAt?`. Indexes on location ids + `verificationStatus`.

**`affiliate_offer_categories`**
`id`, `slug @unique`, `name`, `description?`, `sortOrder`, `isActive`.

**`affiliate_products`**
`id`, `providerId`, `externalProductId`, `businessId?`, `externalBusinessId?`, `title`, `description Text?`, `media String[]`, `priceMinor Int?`, `currency`, `category?`, `subCategory?`, `productType`, `destinationUrl`, `availability Json?`, `sourcePayload Json?`, `isActive`, `lastSyncedAt`, timestamps.
`@@unique([providerId, externalProductId])`, `@@index([providerId, isActive])`, `@@index([businessId])`.

**`affiliate_offers`**
`id`, `slug @unique`, `providerId`, `productId?`, `businessId?`, `externalBusinessId?`, `categoryId?`, `title`, `subtitle?`, `description Text?`, `imageUrl?`, `media String[]`, `destinationUrl`, `integrationLevel`, `trackingMethod`, `eligibilityScope`, `eligibility Json?`, `customerBenefit Json?`, `rewardRuleId?`, `redemptionMethod`, `status`, `startsAt?`, `endsAt?`, `identityUnverifiable Boolean @default(false)`, `allowOwnerPromotion Boolean @default(false)`, `approvedByUserId?`, `approvedAt?`, `createdByUserId`, timestamps, `deletedAt?`.
`@@index([status, startsAt, endsAt])`, `@@index([providerId])`, `@@index([categoryId])`, `@@index([businessId])`.

**`local_affiliate_campaigns`**
`id`, `code @unique` (`CAM-00045`), `name`, `description Text?`, `status`, `startsAt?`, `endsAt?`, `eligibilityScope`, `eligibility Json?`, `rewardCapUnits Decimal?`, `rewardCapUnit AffiliateRewardUnit?`, `budgetUnitsIssued Decimal @default(0)`, `promotionMaterials Json?`, `defaultRewardRuleId?`, `defaultAttributionWindowDays Int?`, `createdByUserId`, timestamps.
`@@index([status, startsAt, endsAt])`.

**`affiliate_campaign_offers`** — `campaignId`, `offerId`, `rewardRuleId?`, `createdAt`. `@@id([campaignId, offerId])`, `@@index([offerId])`.

**`affiliate_reward_rules`**
`id`, `version Int @unique`, `isCurrent Boolean @default(true)`, `name`, `qualifyingEvent`, `rewardType`, `calculation`, `unit`, `fixedUnits Decimal?`, `percentage Decimal? (7,4)`, `pointsPerCurrencyUnit Decimal? (18,6)`, `tiers Json?`, `maxRewardUnits Decimal?`, `minPurchaseMinor Int?`, `approvalMode`, `reversalPolicy`, `expiryDays Int?`, `capPerAffiliateUnits Decimal?`, `capPerCampaignUnits Decimal?`, `effectiveFrom`, `createdByUserId`, `createdAt`.
`@@index([isCurrent])`.

**`affiliate_tracking_links`**
`id`, `code @unique`, `localAffiliateId`, `offerId`, `campaignId?`, `campaignKey String` ( = `campaignId ?? ''` ), `providerId`, `providerLinkUrl?`, `providerClickRef?`, `destinationUrl`, `isActive`, `clickCount Int @default(0)`, `lastClickAt?`, timestamps.
`@@unique([localAffiliateId, offerId, campaignKey])` — **why `campaignKey`:** PostgreSQL treats `NULL`s as distinct, so `@@unique([..., campaignId])` would allow duplicate non-campaign links.
`@@index([localAffiliateId, createdAt desc])`, `@@index([offerId])`.

**`affiliate_clicks`**
`id`, `trackingLinkId`, `occurredAt`, `ipHash?`, `userAgent?`, `referrer?`, `visitorFingerprint?`, `source` (`INTERNAL_REDIRECT`|`PROVIDER_REPORTED`), `convertedAt?`, `metadata Json?`.
`@@index([trackingLinkId, occurredAt desc])`, `@@index([occurredAt])` (for the retention job).

**`affiliate_provider_events`**
`id`, `providerId`, `externalEventId`, `eventType`, `signatureValid Boolean`, `rawBody Json`, `receivedAt`, `processedAt?`, `processingStatus` (`RECEIVED|PROCESSED|IGNORED|FAILED`), `error Text?`.
`@@unique([providerId, externalEventId])`, `@@index([processingStatus, receivedAt])`.

**`affiliate_provider_transactions`**
`id`, `providerAccountId`, `providerId`, `providerTransactionId`, `providerOrderRef?`, `status` (`PENDING|APPROVED|DECLINED|DELETED|REFUNDED|AMENDED`), `amountMinor Int?`, `currency`, `commissionAmountMinor Int?`, `commissionGroups Json?`, `clickRef?`, `validationDate?`, `transactionDate`, `firstSeenAt`, `lastSyncedAt`, `raw Json?`.
`@@unique([providerAccountId, providerTransactionId])`, `@@index([providerId, status, transactionDate])`, `@@index([clickRef])`.

**`affiliate_conversions`**
`id`, `providerId`, `trackingLinkId?`, `localAffiliateId?`, `offerId?`, `campaignId?`, `providerTransactionId?`, `providerOrderRef?`, `eventType`, `amountMinor Int?`, `currency`, `occurredAt`, `status`, `attributionMethod?`, `attributionWindowDays?`, `customerUserId?`, `customerEmailHash?`, `rawEventId?`, `rejectionReason?`, `explanationText?`, timestamps.
`@@unique([providerId, providerTransactionId, eventType])`, `@@index([localAffiliateId, occurredAt desc])`, `@@index([status, occurredAt])`, `@@index([offerId])`.

**`affiliate_attributions`**
`id`, `conversionId @unique`, `trackingLinkId`, `localAffiliateId`, `attributionMethod`, `windowDays`, `clickedAt?`, `convertedAt`, `confidence` (`HIGH|MEDIUM|LOW`), `reason`, `decidedAt`, `decidedByUserId?`, `supersededByAttributionId?`.
`@@index([localAffiliateId, decidedAt desc])`.

**`affiliate_reward_ledger`**
`id`, `localAffiliateId`, `conversionId?`, `rewardRuleId?`, `rewardRuleVersion Int?`, `campaignId?`, `offerId?`, `entryType`, `unit`, `units Decimal (18,4)`, `status`, `idempotencyKey @unique`, `description`, `explanationCode?`, `explanationText?`, `metadata Json?`, `expiresAt?`, `approvedAt?`, `availableAt?`, `closedAt?`, `reversesLedgerId?`, `createdAt`, `updatedAt`.
`@@index([localAffiliateId, status])`, `@@index([status, expiresAt])`, `@@index([conversionId])`, `@@index([campaignId, status])`.

**`affiliate_ledger_events`** — append-only transition log
`id`, `ledgerId`, `fromStatus?`, `toStatus`, `actorType` (`SYSTEM|ADMIN|PROVIDER`), `actorUserId?`, `reason?`, `createdAt`. `@@index([ledgerId, createdAt])`.

**`affiliate_reward_redemptions`**
`id`, `localAffiliateId`, `rewardType`, `unit`, `unitsSpent Decimal`, `status` (`PENDING|FULFILLED|FAILED|CANCELLED`), `voucherId?`, `walletTransactionId?`, `allocation Json?`, `createdAt`, `fulfilledAt?`.

**`affiliate_vouchers`**
`id`, `code @unique`, `offerId?`, `campaignId?`, `issuedToUserId?`, `benefit Json`, `maxUses Int @default(1)`, `usedCount Int @default(0)`, `maxUsesPerCustomer Int @default(1)`, `status`, `expiresAt?`, `issuedAt`, `revokedAt?`, `revokeReason?`, `createdAt`.
`@@index([status, expiresAt])`, `@@index([offerId])`.

**`affiliate_redemptions`**
`id`, `voucherId`, `customerUserId?`, `customerKey String`, `status`, `channel` (`ONLINE|POS|MANUAL|API`), `validatedAt`, `validatedByUserId?`, `validatedByBusinessId?`, `amountMinor Int?`, `posReference?`, `ipHash?`, `rejectionReason?`, `reversedAt?`.
`@@unique([voucherId, customerKey])`, `@@index([voucherId, status])`, `@@index([validatedAt])`.

**`affiliate_sync_logs`**
`id`, `providerAccountId`, `syncType`, `windowStart?`, `windowEnd?`, `fetched Int`, `created Int`, `updated Int`, `skipped Int`, `errored Int`, `durationMs Int`, `status`, `error Text?`, `startedAt`, `finishedAt?`. `@@index([providerAccountId, startedAt desc])`.

### 5.3 Relationship to existing models

| Existing | Relationship |
|---|---|
| `User` | one-to-one `LocalAffiliateProfile`; one-to-many ledger/conversions via `localAffiliateId` |
| `CustomerProfile` | read for location + `loyaltyPoints` (untouched) |
| `Wallet` | **not** used in Phase 1–2; used only for `CREDIT` materialisation |
| `BusinessProfile` | owns MCOM offers; `apiKey` authenticates redemption validation |
| `City/Borough/HighStreet/LocalMall` | eligibility scoping |
| `Notification` | reward and status notifications |
| `AuditLog` | admin reconciliation actions |
| `ProcessedWebhookEvent` | reused as-is for provider *webhook* dedupe where it fits; `affiliate_provider_events` is preferred because it must retain the raw body |

### 5.4 Balance derivation (authoritative)

```sql
pending   = SUM(units) WHERE entryType='CREDIT' AND status='PENDING'
approved  = SUM(units) WHERE entryType='CREDIT' AND status='APPROVED'
available = SUM(units) WHERE entryType='CREDIT' AND status='AVAILABLE'
          - SUM(units) WHERE entryType IN ('DEBIT','EXPIRY','REVERSAL') AND status IN ('AVAILABLE','REDEEMED')
redeemed  = SUM(units) WHERE entryType='DEBIT' AND status='REDEEMED'
expired   = SUM(units) WHERE entryType='EXPIRY'
reversed  = SUM(units) WHERE entryType='REVERSAL'
```
`available` may be negative after a post-redemption reversal. The UI must show this honestly and block redemptions while negative (`FR-11.4`).

---

## 6. API contracts

`[PROPOSED]` All endpoints: prefix `/api/v1`, envelope per `.agent/api-conventions.md`, pagination `page/limit/sort/order/search` with `total/page/limit/totalPages`, `@ApiOperation` + response decorators on every route, DTO validation at the controller boundary.

### 6.1 Consumer

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/local-affiliate/activate` | JWT | Scenario A. `201` created / `200` already active. |
| `POST` | `/local-affiliate/register` | none (throttled 5/min/IP) | Scenario B. `201`. `409 EMAIL_ALREADY_REGISTERED`. |
| `GET` | `/local-affiliate/me` | JWT | Profile, code, link, status, card status, verification state. |
| `GET` | `/local-affiliate/link` | JWT | `{ affiliateCode, personalPageUrl, qrPayload }`. |
| `PATCH` | `/local-affiliate/me` | JWT | `displayName`, `marketingOptIn` only. |
| `GET` | `/local-affiliate/activity/summary` | JWT | Counters: clicks, visits, leads, bookings, purchases, approved, rejected, refunded. |
| `GET` | `/local-affiliate/activity` | JWT | Paginated events; filters `type`, `from`, `to`. |
| `GET` | `/local-affiliate/rewards/summary` | JWT | All seven balances from §5.4. |
| `GET` | `/local-affiliate/rewards/ledger` | JWT | Paginated; filters `status`, `unit`, `from`, `to`. |
| `POST` | `/local-affiliate/rewards/redeem` | JWT | `{ rewardType, units }` → redemption; voucher redemption returns the code. |
| `GET` | `/local-affiliate/rewards/redemptions` | JWT | Paginated history. |

**`POST /local-affiliate/activate`**
```json
// request
{ "termsVersion": "2026-11-01", "acceptTerms": true }
// 201
{ "success": true,
  "data": { "affiliateCode": "LAF-000125", "status": "ACTIVE",
            "affiliateLink": "https://…/a/LAF-000125",
            "cardStatus": "NOT_LINKED", "alreadyActive": false },
  "message": "Local Affiliate profile activated" }
```
Errors: `403 AFFILIATE_NOT_ELIGIBLE`, `409 TERMS_VERSION_OUTDATED`, `422 EMAIL_NOT_VERIFIED` (only when verification is enforced for activation — see `FR-1.2.5`).

**`POST /local-affiliate/register`**
```json
{ "email": "...", "password": "...", "firstName": "...", "lastName": "...",
  "phone": "+44...", "postcode": "SW1A 1AA", "termsVersion": "2026-11-01",
  "acceptTerms": true, "inviteCode": "optional" }
```
`201` returns the same shape as `activate` plus `emailVerified: false`. Whole flow is one DB transaction.

### 6.2 Marketplace

| Method | Path | Auth | Notes |
|---|---|---|---|
| `GET` | `/affiliate-offers` | optional auth | Eligible offers only when authenticated as an affiliate. Filters: `category`, `providerType`, `locationScope`, `rewardType`, `activeOn`, `search`, `page`, `limit`, `sort`, `order`. |
| `GET` | `/affiliate-offers/:slug` | optional auth | Detail + `canPromote` + reason when `false`. |
| `POST` | `/affiliate-offers/:offerId/link` | JWT affiliate | Creates or returns the tracking link. `{ campaignId? }` optional. |
| `GET` | `/affiliate-campaigns` | optional auth | Active campaigns. |
| `GET` | `/affiliate-campaigns/:code` | optional auth | Campaign detail + offers. |

`POST …/link` response:
```json
{ "success": true,
  "data": { "trackingCode": "k7Qm2xR9pA", "trackingUrl": "https://…/r/k7Qm2xR9pA",
            "destinationUrl": "https://mall…/product/abc?laf=k7Qm2xR9pA",
            "qrPayload": "https://…/r/k7Qm2xR9pA" } }
```

### 6.3 Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/public/affiliate/:affiliateCode` | Public page payload. No PII. Cached 60 s. `404` if inactive. |
| `GET` | `/r/:trackingCode` | **Raw 302, not enveloped.** Records click, appends provider params, sets `mcom_laf` cookie. Never 500s. |
| `POST` | `/public/affiliate/vouchers/:code/check` | Optional, rate-limited, returns validity only (no consumption) — for a "is this still good?" UI. |

### 6.4 Redemption (provider-facing)

| Method | Path | Auth | Notes |
|---|---|---|---|
| `POST` | `/affiliate-redemptions/validate` | Business JWT **or** `x-api-key` | Body `{ code, customerRef?, amountMinor?, channel?, posReference? }`. |
| `POST` | `/affiliate-redemptions/:id/reverse` | Business JWT | Within the reversal window. |
| `GET` | `/affiliate-redemptions` | Business JWT | Own offers only. |

Validation responses: `200 VALIDATED`, `200 ALREADY_REDEEMED` (idempotent, includes original time), `404 VOUCHER_NOT_FOUND`, `410 VOUCHER_EXPIRED`, `409 VOUCHER_REVOKED`, `403 NOT_YOUR_OFFER`, `429` throttled.

### 6.5 Partner (service mesh)

| Method | Path | Guard | Notes |
|---|---|---|---|
| `GET` | `/partner/affiliate/attribution/:trackingCode` | `ServiceAuthGuard`, `central:read` | Pre-checkout validation. Returns `{ valid, affiliateId, offerId, campaignId }` — **no PII**. |
| `POST` | `/partner/affiliate/conversions` | `ServiceAuthGuard`, `central:issue`, `PartnerFeatureGuard` | Order/conversion push. Idempotent. |
| `POST` | `/partner/affiliate/events` | same | Generic provider event ingest. |

```json
// POST /partner/affiliate/conversions
{ "provider": "mcom_mall",
  "providerOrderId": "ord_123",
  "eventType": "APPROVED_PURCHASE",
  "trackingCode": "k7Qm2xR9pA",
  "amountMinor": 5000, "currency": "GBP",
  "occurredAt": "2026-11-17T10:00:00Z",
  "customerRef": "central-user-uuid",
  "idempotencyKey": "mall:ord_123:APPROVED_PURCHASE" }
// 202 (new or duplicate)
{ "success": true, "data": { "conversionId": "…", "status": "MATCHED", "duplicate": false } }
```

### 6.6 Admin

```
GET|POST|PATCH      /admin/local-affiliates[/:id]
POST                /admin/local-affiliates/:id/suspend | /reinstate
GET|POST|PATCH      /admin/affiliate-providers[/:id]
POST                /admin/affiliate-providers/:id/test
POST                /admin/affiliate-providers/:id/sync
GET|POST|PATCH|DELETE /admin/affiliate-provider-accounts[/:id]
GET|POST|PATCH      /admin/external-businesses[/:id]
POST                /admin/external-businesses/:id/verify
GET|POST|PATCH      /admin/affiliate-offers[/:id]
POST                /admin/affiliate-offers/:id/approve | /pause | /end
GET|POST|PATCH      /admin/affiliate-campaigns[/:id]
GET|POST|PATCH      /admin/affiliate-reward-rules[/:id]     (POST publishes a new version)
GET                 /admin/affiliate-conversions[/:id]
POST                /admin/affiliate-conversions/:id/approve | /reject | /reverse | /attribute
GET                 /admin/affiliate-ledger
GET|POST            /admin/affiliate-vouchers[/:id] (issue/revoke)
GET                 /admin/affiliate-redemptions
GET                 /admin/affiliate-reconciliation?queue=
GET                 /admin/affiliate-reports/{overview,by-provider,by-offer,by-campaign}
```

`[PROPOSED]` No admin endpoint accepts a raw balance. Adjustments are `ADJUSTMENT` ledger entries requiring a reason and producing an `AuditLog` row.

### 6.7 Error codes

| HTTP | Code | When |
|---|---|---|
| 400 | `REWARD_EVENT_NOT_VERIFIABLE` | Rule references an event the integration level cannot verify |
| 400 | `INVALID_DESTINATION_URL` | Offer destination fails URL validation |
| 403 | `AFFILIATE_NOT_ELIGIBLE` | Admin, suspended or deleted user |
| 403 | `NOT_YOUR_OFFER` | Business validating another business's voucher |
| 409 | `EMAIL_ALREADY_REGISTERED` | Scenario B with an existing email |
| 409 | `TERMS_VERSION_OUTDATED` | Stale terms version |
| 409 | `INSUFFICIENT_REWARD_BALANCE` | Redeem more than available |
| 410 | `VOUCHER_EXPIRED` | Past `expiresAt` |
| 422 | `REWARD_CAP_REACHED` | Campaign/affiliate cap |
| 422 | `SELF_REFERRAL` | Buyer is the affiliate |
| 503 | `FEATURE_DISABLED` | Provider flag off (existing `PartnerFeatureGuard` behaviour) |

---

## 7. State machines

### 7.1 Offer
```
DRAFT ──submit──► PENDING_APPROVAL ──approve──► ACTIVE ──pause──► PAUSED ──resume──► ACTIVE
                        │                          │                                    │
                        └──reject──► DRAFT         └──end──► ENDED ◄────────────────────┘
                                                              └──archive──► ARCHIVED
```
Guards: `activate` requires `assertRewardVerifiable()`, a valid destination URL, and (if `startsAt` future) `SCHEDULED` on the campaign.

### 7.2 Conversion
```
RECEIVED ──matcher finds link──► MATCHED ──attribution committed──► ATTRIBUTED ──rule applied──► (ledger PENDING)
    │                                  │
    └──no match in window──► UNMATCHED ──retry──► MATCHED
                                        └──window expired──► EXPIRED_UNATTRIBUTED
Any state ──provider duplicate──► DUPLICATE (retained, no reward)
Any state ──policy violation──► REJECTED
```

### 7.3 Reward (ledger row)
```
PENDING ──approve──► APPROVED ──release──► AVAILABLE ──redeem──► REDEEMED
   │                    │                    │
   ├──reject──► REJECTED│                    └──expire──► EXPIRED
   ├──cancel──► CANCELLED                    └──reverse──► REVERSED
   └──reverse──► REVERSED
```
Every transition: a row in `affiliate_ledger_events`; `units` never change.

### 7.4 Voucher
```
ISSUED ──partial use──► PARTIALLY_REDEEMED ──limit reached──► REDEEMED
   │                            │
   ├──expire──► EXPIRED         └──expire──► EXPIRED
   └──revoke──► REVOKED
```

### 7.5 Affiliate
```
PENDING ──email verified + terms──► ACTIVE ──suspend──► SUSPENDED ──reinstate──► ACTIVE
   │                                   └──close──► CLOSED
   └──abandon──► (purged after 30 days if no verification)
```
Suspended: cannot create links or redeem; existing links redirect to the offers index; historical rewards remain.

---

## 8. Tracking flows

### 8.1 Internal redirect (all providers)

```
Affiliate UI  ──share──►  https://…/r/k7Qm2xR9pA
                              │
Client        ──GET──►  /r/:code
                              │ 1. resolve link → offer → provider (server-side)
                              │ 2. insert affiliate_clicks (hashed IP); failure is logged, not fatal
                              │ 3. Set-Cookie mcom_laf=<code>; Path=/; Max-Age=2592000; SameSite=Lax
                              │ 4. build provider destination per §8.2–8.5
                              └──302──► provider destination
```
Rules: destination is never client-supplied; unknown/disabled code → `/offers?link=unavailable`; no auth required; throttled generously.

### 8.2 MCOM Mall

```
Mall product page  (?laf=<code>)
   → carried into cart and checkout (Mall change)
   → checkout/initiate persists order_attribution { clickRef, trackingLinkId, … }
   → order paid  → affiliate_conversion_outbox row
   → sweep → POST /api/v1/partner/affiliate/conversions (mesh, central:issue)
   → Central: dedupe → match → attribution → ledger PENDING
   → Mall confirms (same call is the confirmation; Mall is authoritative for "paid")
   → Central: APPROVED → AVAILABLE
Refund → Mall emits REFUNDED → Central REVERSAL entry
```
`[PROPOSED]` Central **validates** the tracking code server-side (`GET /partner/affiliate/attribution/:code`) at checkout start; a client-supplied affiliate id is never trusted on its own.
`[OPEN]` Approval timing: does Mall approval equal payment, or is there a returns window? **Default: approve on payment confirmation; use a 14-day hold for physical goods before `AVAILABLE`.** Configurable per offer (`holdDays`).

### 8.3 ThriveCart (passthrough path — default)

```
/r/:code → https://<vendor>.thrivecart.com/<product>/?passthrough[la_tracking_id]=<code>
   → order.success webhook (verify thrivecart_secret)
   → affiliate_provider_events (dedupe on webhook_id… see note)
   → conversion (APPROVED_PURCHASE) → match by passthrough[la_tracking_id]
   → ledger PENDING → approval per rule → AVAILABLE
order_refund_product → conversion (CANCELLED_REFUNDED) → REVERSAL
```
Note: the payload carries `event_id` (internal) and `webhook_id` (stable across retries). `[PROPOSED]` Use `webhook_id` as `externalEventId` for delivery dedupe, and `(providerOrderId, eventType)` for conversion dedupe.

### 8.4 ThriveCart (native affiliate path — opt-in only)

Enabled per offer only when the business insists. `[PROPOSED]` Create one ThriveCart affiliate per Local Affiliate (or nest under a CHS `parent_affiliate`), consume `affiliate_commission_earned`. Constraint recorded in `FR-*`: this path emits no events in test mode, so it cannot be exercised in staging — a reason it is not the default.

### 8.5 Awin (pull reconciliation) `[PROPOSED]`

```
Link Builder  → tracking link with clickref=<code>
  (created at link time; batchable up to 100)

Scheduled job (every 6 h):
  for each provider account:
    for each trailing window (≤31 days, overlapping by 2 days):
      for dateType in [transaction, validation, amendment]:
        GET /publishers/{id}/transactions/?startDate&endDate&dateType&accessToken
        upsert affiliate_provider_transactions (unique provider txn id)
        create/update conversions, mapping status:
          pending   → conversion RECEIVED/MATCHED, ledger stays PENDING
          approved  → conversion ATTRIBUTED, ledger APPROVED → AVAILABLE
          declined  → conversion REJECTED, ledger REJECTED
          deleted   → conversion REJECTED, ledger REVERSED
          amended   → new conversion row with delta
    resolve clickref → tracking link; unmatched → UNMATCHED queue
    write affiliate_sync_logs
```
`[CONFIRMED]` Do not promise per-consumer Awin rewards until Awin confirms Subnetwork status, attribution and payout treatment in writing. `[PROPOSED]` Until then the Awin provider ships **disabled** (`AFFILIATE_PROVIDER_AWIN_ENABLED=false`).

### 8.6 External business, level by level

| Level | Flow |
|---|---|
| `LINK_ONLY` | `/r/:code` → append `laf=<code>` where tolerated → record click. **No reward possible.** |
| `REDEMPTION_CODE` | Affiliate shares → visitor claims voucher → `affiliate_vouchers` code issued → provider validates via API/portal → `affiliate_redemptions` → conversion `VERIFIED_REDEMPTION` → reward. |
| `MANUAL_CONFIRMATION` | Business reports a booking/sale (admin or business endpoint) → conversion created with evidence → `ADMIN_CONFIRMATION` approval → reward. |
| `PROVIDER_API` | Provider calls `POST /partner/affiliate/events` with a signed service token → automated. |
| `PROVIDER_WEBHOOK` | Provider posts a signed webhook → `affiliate_provider_events` → automated. |

---

## 9. Reward calculation

### 9.1 Evaluation algorithm `[PROPOSED]`

```
applyRule(conversion):
  1. assert conversion.status == ATTRIBUTED
  2. rule = version of rewardRuleId current at conversion.occurredAt
  3. assertQualifyingEventMatches(rule.qualifyingEvent, conversion.eventType)
  4. assertRewardVerifiable(offer.integrationLevel, rule.qualifyingEvent)      // FR-6.6
  5. assertNotSelfReferral(affiliate, conversion)                              // FR-15.2
  6. assertMinPurchase(rule, conversion.amountMinor)
  7. units = calculate(rule, conversion)
  8. units = min(units, rule.maxRewardUnits ?? ∞)
  9. units = applyCaps(rule, affiliate, campaign)                              // FR-4.4 / FR-8
 10. if units <= 0 → write SKIPPED ledger row (retained, not discarded)
 11. write ledger CREDIT, status PENDING, idempotencyKey = <conversion>:<ruleVersion>
 12. if rule.approvalMode == AUTOMATIC → transition to APPROVED → AVAILABLE
```

### 9.2 Calculation

| `calculation` | Formula |
|---|---|
| `FIXED` | `units = rule.fixedUnits` |
| `PERCENTAGE` | `base = conversion.amountMinor / 100` (GBP) · `units = base × rule.percentage/100` when `unit = CREDIT`; `units = base × rule.pointsPerCurrencyUnit × (rule.percentage/100)` when `unit = POINTS` |
| `TIERED` | select the tier where `minMinor ≤ amountMinor < maxMinor`; apply that tier's `percentage`, `fixedUnits` or `pointsPerCurrencyUnit` |

Rounding: `[PROPOSED]` half-up to 2 dp for `CREDIT`, whole units for `POINTS`; rounding is applied **before** caps and recorded in `metadata.rounding`.

### 9.3 Worked examples (these become acceptance tests)

| # | Scenario | Rule | Conversion | Result |
|---|---|---|---|---|
| E1 | Mall haircut, verified redemption | FIXED 100 POINTS, `VERIFIED_REDEMPTION`, approval `REDEMPTION_VALIDATION` | £30 booking | `PENDING` → on redemption validation `AVAILABLE` 100 pts |
| E2 | Mall purchase, percentage points | PERCENTAGE 5%, `pointsPerCurrencyUnit = 10`, `APPROVED_PURCHASE` | £50 | 50 × 10 × 0.05 = **25 pts** |
| E3 | Awin fashion sale, percentage credit (disabled in Phase 1) | PERCENTAGE 2%, unit CREDIT | £120 | 2.40 credits (flag off → rule cannot be created) |
| E4 | Tiered | tiers `0–2000 → 100pts`, `2000–10000 → 250pts`, `10000+ → 500pts` | £75 | 250 pts |
| E5 | Cap | `maxRewardUnits = 500`, computed 900 | — | 500 pts, `metadata.capped = true` |
| E6 | Below minimum | `minPurchaseMinor = 2000`, purchase 1500 | — | SKIPPED ledger row, reason `BELOW_MIN_PURCHASE` |
| E7 | Refund after approval | E2 then refund | — | `REVERSAL` −25 pts; available returns to prior |
| E8 | Refund after redemption | E1 redeemed, then refund | — | balance −100; redemptions blocked; Admin exception row |
| E9 | Duplicate provider push | E2 sent twice | — | second call `202 duplicate:true`, no new row, no second credit |
| E10 | Self-referral | buyer `customerRef` == affiliate user id | — | conversion `REJECTED / SELF_REFERRAL`, no ledger row |
| E11 | Link-only offer | provider `LINK_ONLY`, rule `APPROVED_PURCHASE` | — | rejected at save: `REWARD_EVENT_NOT_VERIFIABLE` |
| E12 | Expiry | 180-day expiry, unspent | — | `EXPIRY` row, no longer in `available`, still visible in history |
| E13 | Campaign budget | cap 10,000 pts, already 9,950 | 100 pts | 50 pts paid, campaign auto-pauses, Admin notified |
| E14 | Unmatched then late match | click day 1, conversion day 20, match day 21 | — | `INTERNAL_LAST_CLICK`, within 30-day window, rewarded |
| E15 | Outside window | click day 1, conversion day 45 | — | `EXPIRED_UNATTRIBUTED`, no reward, visible in reconciliation |

---

## 10. Redemption logic

### 10.1 Two-beneficiary rule `[CONFIRMED]`

One event can produce two independent effects, configured separately:

| | Customer | Affiliate |
|---|---|---|
| Record | `affiliate_vouchers.benefit` | `affiliate_reward_rules` |
| Trigger | valid voucher presentation | the rule's qualifying event |
| Limit | `maxUsesPerCustomer` | `capPerAffiliate` / `capPerCampaign` |
| Dedupe | `affiliate_redemptions @@unique([voucherId, customerKey])` | ledger `idempotencyKey` |

`[PROPOSED]` Guard: one `affiliate_redemptions` row can produce at most one conversion, enforced by `affiliate_conversions @@unique([providerId, providerTransactionId, eventType])` with `providerTransactionId = redemption:<id>`.

### 10.2 Voucher lifecycle

1. Admin (or rule) issues: `affiliate_vouchers` with `benefit`, `maxUses`, `maxUsesPerCustomer`, `expiresAt`.
2. Affiliate shares it (or the visitor claims it from the offer page).
3. Visitor presents the code to the provider.
4. Provider validates via `POST /affiliate-redemptions/validate` (business JWT or `x-api-key`, own offers only).
5. Server: status check → per-customer check → atomic `usedCount` increment inside a transaction with the redemption insert → conversion → reward.
6. Any failure leaves no side effect (single transaction).

### 10.3 Anti-abuse

- One voucher per customer, enforced in the database (`customerKey`).
- Validation throttled per business and per IP.
- Duplicate presentation returns the original result, not a second redemption.
- Codes are crypto-random, not sequential (a guessable code is a free discount).
- Reversal of a redemption allowed only within `reversalWindowDays` and only by the issuing business or Admin.
- Every attempt logged, including rejections.

### 10.4 Reward redemption (affiliate spending)

| Reward type | Phase 1 behaviour |
|---|---|
| `POINTS` | Converted to a voucher or a benefit at a configured rate; creates `affiliate_reward_redemptions` + `DEBIT` ledger row. |
| `VOUCHER` | Issued directly; no points involved. |
| `CREDIT` | Disabled until settlement exists. When enabled: `walletService.creditWallet(MCOM_CENTRAL_PARTNER, { category: REWARD }, 'local-affiliate:<ledgerId>')` — the `ReferralCommission` pattern. |

`[PROPOSED]` Redemption requires `available ≥ units` and a non-negative post-redemption balance; enforced with a row lock on the affiliate's ledger aggregate to prevent double-spend under concurrency.

---

## 11. Admin screens

`[PROPOSED]` New `NAV_GROUPS` group **"Local Affiliates"**. Registration is the five documented points: `AdminTab` union, `NAV_GROUPS` (`AdminLayout.tsx`), `ADMIN_TABS`, `getTabInfo`, `renderPanel` (`AdminDashboard.tsx`).

| Tab | Screen | Key content |
|---|---|---|
| `local-affiliates` | Affiliates list | code, name, CHS status, affiliate status, location, clicks, rewards, last activity. Filters + search. Row → detail. |
| | Affiliate detail | Identity + link, card, status actions (suspend/reinstate), activity timeline, reward ledger, redemptions, admin notes. |
| `affiliate-providers` | Providers | table with type, level, status, last sync; create/edit; **Test connection**; **Sync now** |
| | Provider detail | accounts, credentials (masked, write-only), supported events, sync history, feature-flag state |
| `affiliate-offers` | Offers | table with provider, category, status, dates, reward rule; create/edit (source, destination, tracking method, eligibility, customer benefit, reward rule, redemption method); approve/pause/end |
| `affiliate-campaigns` | Campaigns | list + editor: dates, eligibility, offers, default rule, cap/budget, materials. Shows paid-to-date vs cap. |
| `affiliate-reward-rules` | Rules | versioned list; "Publish new version" flow; live preview calculator using the §9.2 formulas; verifiability warning when the qualifier exceeds the offer's level |
| `affiliate-conversions` | Conversions | table with status, source, affiliate, offer, amount, rule result; row actions approve / reject / reverse / attribute; raw payload viewer |
| `affiliate-redemptions` | Redemptions | voucher list, statuses, attempts log, reverse action |
| `affiliate-reconciliation` | Reconciliation | queues from `FR-13.2`, each with a count badge; resolve actions |
| `affiliate-reports` | Reports | by provider, offer, campaign, affiliate; click→conversion funnel; pending ageing; reward liability |

Interaction rules: every destructive or financial action requires a reason; all write to `AuditLog`; no balance edit control anywhere.

---

## 12. Local Affiliate screens

`[PROPOSED]` Extend `CustomerDashboard.tsx` `NAV_ITEMS` — **do not** build a second portal. Items appear only when a `LocalAffiliateProfile` exists.

| Screen | Route | Content |
|---|---|---|
| **Overview** | `/customer` (existing) + affiliate summary card | Available points, pending points, clicks, approved purchases, personal link with copy + QR |
| **My Affiliate** | `/customer/affiliate` | Status, code, link, QR, card status, terms, "become an affiliate" CTA when not active |
| **Offers to Share** | `/customer/offers` | Marketplace grid with filters (category, location, reward type, date); each card shows source, customer benefit, affiliate reward, share button |
| **Offer detail** | `/customer/offers/:slug` | Full detail, terms, eligibility explanation, share link, QR, "why can't I promote this" when blocked |
| **My Activity** | `/customer/activity` | Clicks / visits / leads / bookings / purchases; per-event reason when not rewarded |
| **My Rewards** | `/customer/rewards` | Seven balances; ledger with status chips and plain-English explanation per row |
| **Redeem Rewards** | `/customer/rewards/redeem` | Available redemption options; balance guard; confirmation |
| **How It Works** | `/customer/how-it-works` | Attribution explanation, why rewards are pending, provider delays, what is not covered |

Public routes (outside the auth shell): `/a/:affiliateCode`, `/a/:affiliateCode/o/:offerSlug`, `/offers`, `/offers/:slug`.

Status copy requirements: `[CONFIRMED]` every pending/rejected/reversed reward must state why. `[PROPOSED]` Copy comes from `explanationCode` → a translation map, never a raw enum.

Empty/edge states: no affiliate profile; profile `PENDING` (verification); no eligible offers; zero activity; negative balance after reversal; provider temporarily unavailable.

---

## 13. Seed and demo data

`[PROPOSED]` `prisma/seed-local-affiliate.ts`, deterministic ids, every row marked `isDemo: true` in `metadata`, refuses to run when `NODE_ENV=production`.

| Group | Contents |
|---|---|
| Affiliates (4) | 2 existing-CHS (`LAF-000125` John, `LAF-000127` Peter `PENDING`), 2 new-CHS (`LAF-000126` Mary, `LAF-000128` Sarah) |
| Providers (6) | Mall (internal), 247GBS Rewards (internal), ThriveCart, Awin (**disabled**), Tamina (external, `REDEMPTION_CODE`), Local Restaurant (external, `MANUAL_CONFIRMATION`) |
| Products (8) | haircut, restaurant meal, digital course, fashion item, birthday special, cleaning service + 2 level-1/level-4 samples |
| Offers (6) | one per integration level minimum, mixed categories, one location-scoped, one global |
| Campaigns (5) | Black Friday, Birthday, Local Business, Christmas, New Customer — with different qualifying events |
| Conversions | every status incl. `UNMATCHED`, `REJECTED`, `DUPLICATE`, `EXPIRED_UNATTRIBUTED` |
| Ledger | every status incl. `REVERSED`, `EXPIRED`, and one negative balance case |
| Vouchers | valid, expired, revoked, partially used |
| Awin fixtures | one txn `pending` then `approved` on a later sync; one `amended`; one `declined` |
| Activity counters | clicks 250, visits 160, leads 30, purchases 15, approved 12, rejected/refunded 3 (illustrative only) |

---

## 14. Non-functional requirements

| Area | Requirement |
|---|---|
| `NFR-1` Latency | `GET /r/:code` p95 < 150 ms server time; redirect must not perform joins beyond one indexed lookup + one insert. |
| `NFR-2` Availability | Reward writes are transactional; conversion ingest is at-least-once and idempotent. A failure never produces a double credit or a lost credit. |
| `NFR-3` Idempotency | Every mutating integration path carries a unique key (`idempotencyKey`, `(providerAccountId, providerTransactionId)`, `(providerId, externalEventId)`). |
| `NFR-4` Immutability | Ledger units and attribution decisions are never updated in place. |
| `NFR-5` Security | Provider credentials AES-256-GCM at rest, never returned; public endpoints PII-free; open-redirect prevented; self-referral blocked. |
| `NFR-6` Privacy | IPs hashed, never stored raw; click retention 400 days; PII minimisation in logs (`.agent/error-handling-logging.md`). |
| `NFR-7` Observability | Structured logs with `x-request-id`; metrics: click→conversion per offer, unmatched conversion count, sync lag per provider, pending reward age, negative balances. |
| `NFR-8` Throttling | Public redirect and validation endpoints get explicit `@Throttle` overrides; auth endpoints keep the existing stricter limits. |
| `NFR-9` Testing | Unit tests for every calculation and state transition; e2e for activate, register, share→click→convert→reward, voucher validate→reverse, duplicate push. |
| `NFR-10` Migrations | Single migration per phase step, descriptive name, reviewed SQL, `prisma migrate deploy` in production. No `db push`. |
| `NFR-11` Backwards compatibility | Existing `Referral` program, agency `Affiliate` module, wallet and coupons are untouched. `isAffiliate` semantics unchanged. |
| `NFR-12` Accessibility | New screens keyboard-navigable, AA contrast, status never conveyed by colour alone. |
| `NFR-13` Localisation-ready | All status/explanation strings from a map, not inline literals. |

### 14.6 Known accepted cost
`[PROPOSED]` The frontend has no shared UI kit (`components/common/` holds only `FieldTooltip`). Tables/modals are duplicated per feature. This PRD accepts duplicating a minimal table/modal/badge set into `components/admin/local-affiliate/` for Phase 1 rather than introducing a design-system layer mid-project. Recorded as technical debt.

---

## 15. Phasing and dependency gates

| Phase | Scope | Gate to start | Gate to close |
|---|---|---|---|
| **1 — Foundation** | FR-1, FR-2, FR-3, FR-4, FR-8 (points+voucher), FR-9, FR-10, FR-11, FR-13 (core), FR-15, screens §11–§12, seed §13 | None | All Phase 1 acceptance tests pass with seeded data only. Zero external dependency. |
| **2 — MCOM Mall** | FR-5 (full), FR-6 (internal provider), FR-7 (Mall), attribution through checkout | **Mall ships `order_attribution` + outbox** (§16 dependency D1) | Round-trip on a real Mall test purchase; duplicate push produces no second reward |
| **3 — ThriveCart** | ThriveCart passthrough provider, event subscriptions, refund reversals | Live ThriveCart account with ≥1 product; affiliate feature status known | Purchase, refund and duplicate webhook all correct |
| **4 — Awin** | Awin provider, programme/offer import, Link Builder, scheduled reconciliation | **Written Awin confirmation of Subnetwork status, attribution and payout treatment** (D2) | Reconciliation window, validation pass and amendment pass all produce correct ledger outcomes; flag can be enabled |
| **5 — External businesses** | `ExternalBusiness` onboarding, L1–L4 tracking, manual confirmation, redemption codes, business-facing validation UI | Phase 1 redemption engine stable | Each level end-to-end, with `assertRewardVerifiable` blocking the impossible combinations |

**Ordering rationale `[CONFIRMED]`:** Phase 2 precedes 3 and 4 because internal product and order data gives a controlled environment — and because Mall is the only provider where we control both sides of the attribution contract.

---

## 16. Acceptance tests

Format: Given / When / Then. Each maps to a requirement.

### Registration and identity (FR-1)

| ID | Test | Maps to |
|---|---|---|
| `AT-01` | **G** existing CHS customer, **W** activates, **T** one `users` row (unchanged), one profile, code `LAF-#####`, dashboard reachable | FR-1.1 |
| `AT-02` | **G** already-active affiliate, **W** calls activate again, **T** `200 alreadyActive:true`, no second profile | FR-1.1.3 |
| `AT-03` | **G** new user, **W** registers, **T** user+wallet+customerProfile+profile created atomically; `registrationSource='local-affiliate'`; role is `CUSTOMER` | FR-1.2.1/2 |
| `AT-04` | **G** email already exists, **W** registers, **T** `409 EMAIL_ALREADY_REGISTERED`, no rows created | FR-1.2.4 |
| `AT-05` | **G** profile creation fails mid-transaction, **W** retries register, **T** no orphan user; retry succeeds | FR-1.2.1 |
| `AT-06` | **G** admin identity, **W** activates, **T** `403 AFFILIATE_NOT_ELIGIBLE` | FR-1.3.2 |
| `AT-07` | **G** unverified profile, **W** opens share page, **T** blocked with verification reason; **W** verifies; **T** allowed | FR-1.2.5/6 |
| `AT-08` | **G** two affiliates activating concurrently, **W** both complete, **T** distinct non-colliding codes | FR-1.4.2 |
| `AT-09` | **G** activation with no card, **W** completes, **T** `cardStatus=NOT_LINKED`, activation still `ACTIVE` | FR-1.5.3 |
| `AT-10` | **G** identity registered as agency role, **W** activates local affiliate, **T** role unchanged, agency module unaffected | FR-1.1.6 |

### Sharing and tracking (FR-2, FR-5)

| ID | Test | Maps to |
|---|---|---|
| `AT-11` | **G** affiliate, **W** requests link for offer, **T** tracking code is 10 chars, contains no affiliate code or offer id | FR-1.4.4 |
| `AT-12` | **G** same affiliate/offer, **W** requests link twice, **T** same link returned | FR-3.5 |
| `AT-13` | **G** same affiliate/offer with two campaigns, **W** requests both, **T** two distinct links (no false unique collision) | §5.2 `campaignKey` |
| `AT-14` | **G** valid code, **W** `GET /r/:code`, **T** `302` to the offer destination, one click row, correct provider param | FR-5.2 |
| `AT-15` | **G** click insert throws, **W** redirect executes, **T** still `302`, error logged | FR-5.8 |
| `AT-16` | **G** request with `?redirect=https://evil.com`, **W** redirect, **T** destination still the offer's own URL | FR-5.9 |
| `AT-17` | **G** unknown code, **W** redirect, **T** `302` to `/offers?link=unavailable` | FR-15.6 |
| `AT-18` | **G** suspended affiliate's link, **W** visit, **T** no click attributed, redirect to index | §7.5 |
| `AT-19` | **G** click 20 days before purchase, **W** ingest, **T** attributed, `attributionWindowDays=30` snapshotted | FR-5.6 |
| `AT-20` | **G** click 45 days before purchase, **W** ingest, **T** `EXPIRED_UNATTRIBUTED`, no reward | E15 |
| `AT-21` | **G** two affiliates' clicks then purchase, **W** ingest, **T** last eligible click wins, `method=INTERNAL_LAST_CLICK` | FR-5.5 |
| `AT-22` | **G** provider returns its own attribution to a different affiliate, **W** ingest, **T** provider decision wins, `method=PROVIDER_DECISION` | FR-5.5 |
| `AT-23` | **G** public affiliate page, **W** fetch, **T** no email/phone/postcode/balance in payload | FR-2.7 |

### Offers and verifiability (FR-3, FR-6)

| ID | Test | Maps to |
|---|---|---|
| `AT-24` | **G** `LINK_ONLY` provider, **W** create offer with `APPROVED_PURCHASE` reward, **T** `400 REWARD_EVENT_NOT_VERIFIABLE` | FR-6.7 |
| `AT-25` | **G** `LINK_ONLY` offer with no reward, **W** publish, **T** allowed; marketplace shows it with no reward claim | FR-6.8 |
| `AT-26` | **G** active offer, **W** an affiliate browses, **T** offer appears; source label visible, integration mechanics not exposed | FR-3.3 |
| `AT-27` | **G** location-scoped offer for another city, **W** affiliate in London browses, **T** not listed, with an eligibility hint | FR-14.2/5 |
| `AT-28` | **G** disabled provider, **W** link creation, **T** `503 FEATURE_DISABLED` | FR-6.10 |
| `AT-29` | **G** provider credentials saved, **W** any read endpoint, **T** credentials never returned; DB value is ciphertext | FR-6.3 |

### Rewards (FR-8, FR-9)

| ID | Test | Maps to |
|---|---|---|
| `AT-30` | **G** E1 rule, **W** verified redemption, **T** 100 pts pending, then available on validation | E1 |
| `AT-31` | **G** E2 rule, **W** £50 purchase, **T** 25 pts | E2 |
| `AT-32` | **G** E4 tiers, **W** £75 purchase, **T** 250 pts | E4 |
| `AT-33` | **G** `maxRewardUnits=500`, **W** computed 900, **T** 500 pts, `capped` recorded | E5 |
| `AT-34` | **G** `minPurchaseMinor=2000`, **W** £15 purchase, **T** skipped row retained with reason | E6 |
| `AT-35` | **G** approved reward, **W** refund, **T** reversal row; available decreases by the same units; original row unmodified | E7 |
| `AT-36` | **G** redeemed reward, **W** refund, **T** negative balance, redemption blocked, admin exception created | E8 |
| `AT-37` | **G** duplicate push with same idempotency key, **W** retry, **T** `202 duplicate:true`, one ledger row | E9 / NFR-3 |
| `AT-38` | **G** buyer id equals affiliate id, **W** ingest, **T** `REJECTED/SELF_REFERRAL`, no ledger row | E10 |
| `AT-39` | **G** rule version 2 published after conversion, **W** evaluate, **T** version at `occurredAt` used; historical ledger unchanged | FR-8.3 |
| `AT-40` | **G** reward past expiry, **W** daily job, **T** `EXPIRY` row; excluded from available, still in history | E12 |
| `AT-41` | **G** campaign 50 pts from cap, **W** 100 pt reward, **T** 50 paid, campaign auto-paused, notification sent | E13 |
| `AT-42` | **G** dashboard, **W** load, **T** seven distinct balances match the SQL in §5.4 | FR-9.6 |

### Redemption (FR-10, FR-11)

| ID | Test | Maps to |
|---|---|---|
| `AT-43` | **G** single-use voucher, **W** validate then validate again, **T** first `VALIDATED`, second `ALREADY_REDEEMED` with original timestamp | FR-10.10 |
| `AT-44` | **G** `maxUsesPerCustomer=1`, **W** same customer validates twice, **T** second rejected | FR-10.5 |
| `AT-45` | **G** multi-use campaign (`maxUses=5`), **W** five uses then sixth, **T** six is rejected | FR-10.3 |
| `AT-46` | **G** business validating another business's voucher, **W** validate, **T** `403 NOT_YOUR_OFFER` | §6.7 |
| `AT-47` | **G** expired voucher, **W** validate, **T** `410 VOUCHER_EXPIRED`, attempt logged | FR-10.11 |
| `AT-48` | **G** one redemption triggering both benefits, **W** complete, **T** customer benefit applied once and exactly one affiliate conversion created | FR-10.4 |
| `AT-49` | **G** same redemption replayed, **W** ingest, **T** one conversion, one reward | FR-10.4 |
| `AT-50` | **G** 3 concurrent validations, **W** all fire, **T** exactly one succeeds; others `ALREADY_REDEEMED` | §10.2 |

### Providers and reconciliation (FR-7, FR-13)

| ID | Test | Maps to |
|---|---|---|
| `AT-51` | **G** Awin txn `pending`, **W** sync, **T** conversion matched, reward `PENDING` | §8.5 |
| `AT-52` | **G** same txn `approved` next sync, **W** sync, **T** reward `APPROVED`→`AVAILABLE`, no duplicate conversion | §8.5 |
| `AT-53` | **G** txn `declined`, **W** sync, **T** reward `REJECTED` with reason | §8.5 |
| `AT-54` | **G** txn `amended` to a lower value, **W** sync, **T** delta reversal row, original untouched | FR-7.8 |
| `AT-55` | **G** sync fails 3 times, **W** Admin opens reconciliation, **T** `failed_syncs` queue shows it with the error | FR-13.2 |
| `AT-56` | **G** unmatched conversion, **W** 15 min matcher runs after a matching click appears, **T** conversion becomes matched | FR-7.5 |
| `AT-57` | **G** 3 Awin windows needing >31 days, **W** job runs, **T** multiple ≤31-day windows issued and logged | §8.5 |
| `AT-58` | **G** provider webhook replayed, **W** ingest twice, **T** one `affiliate_provider_events` row, one conversion | FR-7.2 |
| `AT-59` | **G** admin manually attributes an unmatched conversion, **W** confirm, **T** attribution `MANUAL`, AuditLog row, reward computed | FR-13.3/4 |

### Security and integrity (FR-15, NFR)

| ID | Test | Maps to |
|---|---|---|
| `AT-60` | **G** any endpoint, **W** pass another affiliate's id, **T** ignored; only the caller's own data returned | §2 |
| `AT-61` | **G** stored click, **W** inspect DB, **T** `ipHash` only, no raw IP anywhere | FR-5.10 |
| `AT-62` | **G** seeded demo data, **W** `NODE_ENV=production` seed, **T** refuses to run | §13 |
| `AT-63` | **G** voucher code generation, **W** 10,000 generations, **T** no collisions, no ambiguous characters | FR-10.8 |
| `AT-64` | **G** ledger row, **W** attempt an update to `units`, **T** no code path exists; only status transitions are possible | NFR-4 |

### Regression (must not break)

| ID | Test |
|---|---|
| `AT-65` | Agency affiliate login, tasks, settlements and business acquisition still function |
| `AT-66` | Referral programme codes, links and commissions unchanged |
| `AT-67` | Member/customer registration, login, SSO and wallet flows unchanged |
| `AT-68` | Admin nav renders all existing groups; the new group does not break routing |

---

## 17. Open decisions, risks and assumptions

### 17.1 The five business questions (from the source model §18)

| # | Question | Default assumed for build | Status |
|---|---|---|---|
| Q1 | Commission share, fixed reward, or either? | Either, per campaign; fixed is the default | `[OPEN]` |
| Q2 | Who funds the consumer reward? | Configurable (`BUSINESS_WALLET` / `PROVIDER_COMMISSION` / `PLATFORM`); Phase 1 operational funding only | `[OPEN]` |
| Q3 | Are points and vouchers enough for release 1? | Yes; cashback deferred behind a flag | `[OPEN]` |
| Q4 | Promote every offer, or location/eligibility-scoped only? | Eligible only, with an explanation when blocked | `[OPEN]` |
| Q5 | Personal page, individual links, or both? | Both | `[OPEN]` |

### 17.2 Additional decisions surfaced by the codebase

| # | Decision | Default | Status |
|---|---|---|---|
| Q6 | Domain naming | `LocalAffiliate*` models, `local_affiliate_*` tables, `registrationSource='local-affiliate'` | `[PROPOSED]` — requires sign-off because it changes public copy |
| Q7 | Awin attribution carrier | `clickRef` only | `[PROPOSED]` |
| Q8 | ThriveCart path | Passthrough default; native affiliate opt-in per offer | `[PROPOSED]` |
| Q9 | Mall attribution | First-party `order_attribution` + outbox; server-side validation | Requires Mall team agreement (D1) |
| Q10 | Pending rewards in wallet? | No — separate ledger | `[PROPOSED]` |
| Q11 | Promotion of own business | Disallowed by default | `[OPEN]` |
| Q12 | Mall approval timing | Approve on payment; configurable hold for physical goods | `[OPEN]` |

### 17.3 External dependencies

| ID | Dependency | Owner | Blocks |
|---|---|---|---|
| `D1` | Mall `order_attribution` + `affiliate_conversion_outbox` + sweep | Mall team | Phase 2 |
| `D2` | Awin written confirmation: Subnetwork status, permitted attribution, payout treatment | Business + Awin | Phase 4 go-live |
| `D3` | ThriveCart account with affiliate feature status known | Business | Phase 3 |
| `D4` | MCOM VCard API for card linking/provisioning | vCard platform | Only FR-1.5 beyond status display |
| `D5` | Cash settlement mechanism for consumer payouts | Business/finance | Enabling `CREDIT` |

### 17.4 Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Awin refuses subnetwork treatment | No individual Awin rewards | Ship capability disabled; offer Awin visibility-only offers |
| Mall change slips | Phase 2 blocked | Phase 1 is fully independent; Mall offers can run at Level 2 (redemption) in the interim |
| Fraud via self-referral on external offers | Reward leakage | `identityUnverifiable` flag, reconciliation queue, caps, manual review |
| Provider API changes | Broken adapters | One adapter interface; raw payload retention; per-provider kill switch |
| Double-credit bug | Financial loss | Three independent unique keys; ledger idempotency; NFR-3 tests |
| Consumers misunderstand pending rewards | Support load | `explanationCode` copy, "How It Works" screen, provider delay named |
| Duplicate CHS identity created | Data integrity | `@@unique(userId)` on the profile + `409` + "sign in instead" path |

### 17.5 Assumptions

1. CHS remains the only identity authority; Mall's `User.centralUserId` is populated for shoppers.
2. Mall can be changed by the same organisation within Phase 2's timeframe.
3. Phase 1 has no need for real money movement.
4. A single ThriveCart account and a single Awin publisher account are sufficient for launch.
5. `CONSOLE_ENCRYPTION_KEY` is available in every environment where provider credentials are stored.

---

## 18. Traceability to the source model

| Source section | Covered by |
|---|---|
| §1 Registration (A/B) | FR-1, AT-01…AT-10 |
| §2 What can be promoted | FR-3, FR-6, AT-24…AT-29 |
| §3 Marketplace | FR-3.8–3.10, FR-14, §12 |
| §4 Sharing & tracking journey | FR-2, FR-5, §8, AT-11…AT-23 |
| §5 Reward model | FR-8, §9, AT-30…AT-42 |
| §6 Redemption (A/B/C) | FR-10, §8.2–8.5, §10, AT-43…AT-50 |
| §7 ThriveCart | FR-6, §8.3–8.4, Q8 |
| §8 Awin | FR-6, §8.5, D2, AT-51…AT-54 |
| §9 Admin structure | §11 |
| §10 Mock data | §13 |
| §11 Affiliate dashboard | §12 |
| §12 Database structure | §5 |
| §13 Attribution policy | FR-5.4–5.7, §7.2 |
| §14 Multiple providers | §5.2 (`affiliate_tracking_links`), AT-13 |
| §15 Two beneficiaries | FR-10, §10.1, AT-48 |
| §16 Integration levels | FR-6.4–6.8, §8.6 |
| §17 Delivery phases | §15 |
| §18 Decisions | §17 |
| §19 Architectural principle | §3.2, FR-9.3 |

---

## 19. Definition of done (Phase 1)

1. Both registration scenarios work end-to-end against the real database, with no duplicate identity possible.
2. An affiliate can create a link, share it, generate a click, and see that click in their activity.
3. An offer can be created for an external business at Level 2, a voucher issued, validated by the business, and the affiliate reward moves pending → available — with the customer benefit applied exactly once.
4. A refund reverses the reward; a post-redemption reversal produces a visible negative balance and an admin exception.
5. Every reward row in the dashboard states why it is in its current state.
6. Provider credentials are encrypted and never returned by any endpoint.
7. The full seed set loads deterministically and refuses to run in production.
8. `AT-01`…`AT-50`, `AT-60`…`AT-68` pass.
9. No change to the agency affiliate module, referral programme, wallet, coupons or SSO behaviour (`AT-65`…`AT-68`).
10. One migration, reviewed, with `migrate deploy` verified on a clean database.

---

*Every `[OPEN]` item above must be closed by the business before the phase that depends on it ships. Every `[PROPOSED]` item is engineering's to change, provided the change is recorded here and the corresponding acceptance test is updated.*
