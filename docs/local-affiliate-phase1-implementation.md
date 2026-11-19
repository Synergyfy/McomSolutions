# Local Affiliate — Phase 1 Implementation Notes

**Date:** 17 November 2026
**Scope:** CHS only (Central Hub Solution). **No MCOM Mall changes were made.**
**Spec:** `docs/local-affiliate-prd.md` · **Analysis:** `docs/local-affiliate-system-analysis.md`

---

## 1. What was built

Phase 1 (Foundation) is implemented end-to-end: schema, backend module, admin UI, consumer UI, demo seed, and tests. Everything below runs without MCOM Mall, ThriveCart or Awin being connected.

| Area | Delivered |
|---|---|
| Identity | Scenario A (activate on existing CHS identity) and Scenario B (new identity + profile in one transaction), plus email verification |
| Affiliate | Permanent `LAF-000125` code, personal page, per-offer tracking links |
| Catalogue | Offers, categories, eligibility scoping, campaigns |
| Tracking | Public `/r/:code` redirect, click capture, attribution with window policy |
| Rewards | Versioned rules, append-only ledger, balances, expiry sweep |
| Redemption | Voucher issue/validate/reverse, one-per-customer, reward spending |
| Providers | Records, encrypted credentials, integration levels, verifiability gate |
| Admin | 4 panels: affiliates, offers & campaigns, rewards & redemptions, reconciliation |
| Consumer | `/affiliate-hub` with overview, offers, activity, rewards, how-it-works |
| Public | `/offers`, `/offers/:slug`, `/a/:code`, `/join-affiliate` |
| Demo data | `prisma/seed-local-affiliate.ts` |

---

## 2. How to run

```bash
# from apps/backend
npx prisma migrate deploy          # applies the two new migrations
npm run seed:local-affiliate       # demo data (refuses in NODE_ENV=production)
npm run start:dev

# from apps/frontend
npm run dev
```

Demo logins (password `Password123!`):

| Affiliate | Code | Status | Notes |
|---|---|---|---|
| john.smith@example.com | LAF-000125 | ACTIVE | 900 available / 500 pending points |
| mary.jones@example.com | LAF-000126 | ACTIVE | — |
| peter.james@example.com | LAF-000127 | PENDING | verification not completed |
| sarah.brown@example.com | LAF-000128 | ACTIVE | mixed ledger history |

Demo vouchers: `DEMO-2345` (valid), `DEMO-6789` (expired), `DEMO-3456` (revoked).

---

## 3. Files added

**Schema & data**
- `prisma/schema.prisma` — 23 models, 24 enums appended
- `prisma/migrations/20261117000000_local_affiliate_foundation/`
- `prisma/migrations/20261117010000_affiliate_voucher_owner/`
- `prisma/seed-local-affiliate.ts` (+ `seed:local-affiliate` script)

**Backend — `src/local-affiliate/`**
- `local-affiliate.module.ts`, `local-affiliate.jobs.ts`
- `local-affiliate.constants.ts`, `local-affiliate.util.ts`
- `local-affiliate.service.ts` — profile lifecycle, verification, activity
- `affiliate-catalogue.service.ts` — marketplace, eligibility, link building
- `affiliate-tracking.service.ts` — redirect, clicks, code validation
- `affiliate-conversion.service.ts` — ingest, attribution, admin actions
- `affiliate-reward.service.ts` — calculation, ledger, balances, reversal, expiry
- `affiliate-redemption.service.ts` — vouchers, validation, spending
- `affiliate-admin.service.ts` — providers, offers, campaigns, rules, reconciliation
- 6 controllers, 6 DTO files, 1 guard file
- 8 spec files (162 tests)

**Frontend**
- `src/services/local-affiliate/{index.ts,hooks.ts}`
- `src/components/local-affiliate/ui.tsx`
- `src/pages/local-affiliate/{LocalAffiliateDashboard,PublicOffersPage,PublicAffiliatePage,JoinAffiliatePage}.tsx`
- `src/components/admin/local-affiliate/LocalAffiliateAdminPanel.tsx`

**Files modified**
- `src/app.module.ts` (module registration)
- `src/mesh-inbound/service-mesh.constants.ts` (`PartnerFeature.AFFILIATE`)
- `App.tsx` (5 routes + `PageWrapper`)
- `components/AdminLayout.tsx` (`AdminTab`, `NAV_GROUPS`)
- `pages/AdminDashboard.tsx` (`ADMIN_TABS`, `getTabInfo`, `renderPanel`)
- `pages/CustomerDashboard.tsx` (one sidebar entry)

---

## 4. Invariants that are enforced in code

| Rule | Where |
|---|---|
| One affiliate per CHS user | `local_affiliate_profiles.user_id` UNIQUE + idempotent activate |
| Never a second identity | Activation creates a profile only; registration branches on email existence |
| No `isAffiliate` / `Role.AGENT` contamination | Distinct `registrationSource='local-affiliate'`; no role change anywhere |
| One opaque token leaves the platform | `AffiliateTrackingLink.code` only; no affiliate/offer/campaign ids in URLs |
| Server-resolved destination | `/r/:code` never honours a caller-supplied URL (open-redirect closed) |
| A provider cannot promise what it cannot verify | `assertVerifiable()` at rule save, offer create, offer approve **and** reward write |
| Units are never mutated | Append-only ledger; spend/expiry/reversal are separate rows |
| Pending ≠ available | Balances derived; pending never enters the wallet |
| Duplicate provider events cannot double-credit | Three unique keys: provider txn, conversion, ledger idempotency |
| Voucher single-use by default | `maxUses`/`maxUsesPerCustomer` + `(voucher, customerKey)` unique |
| The voucher owner is authoritative | Code re-resolved from `(owner, offer)` at validation, not from the stored pointer |
| Self-referral blocked | Buyer id compared to the affiliate's user id |
| Credentials never readable | AES-256-GCM at rest; `select` never includes them; refuse to store without a key |
| No balance edit endpoint | Admin adjustments are `ADJUSTMENT` ledger rows + `AuditLog` |

---

## 5. Deviations from the PRD (deliberate, all recorded)

| # | PRD | Implemented | Why |
|---|---|---|---|
| 1 | §11 lists 8 admin tabs | **4 tabs** (affiliates · offers & campaigns · rewards & redemptions · reconciliation) | Pairs naturally-related screens; same 5-point registration; splitting later is additive |
| 2 | §12 extend `CustomerDashboard` nav | Affiliate UI is a **separate route tree** `/affiliate-hub/*`, with one entry added to the customer sidebar | `CustomerDashboard.tsx` is 827 lines with a preview-mode branch; a second route tree is lower-risk and keeps share URLs outside `/customer` |
| 3 | §5.4 implies credit-row status transitions for expiry | Expiry/spend/reversal are **separate `EXPIRY`/`DEBIT`/`REVERSAL` rows** | Single mechanism for full and partial reductions; a credit row never changes value. The `EXPIRED`/`REVERSED`/`REDEEMED` enum values remain for reporting |
| 4 | FR-2.6 QR generated client-side | **Not implemented** — copy link + native share instead | No QR dependency exists in the frontend; adding one was out of scope. QR is provisioned with the vCard in Phase 2 |
| 5 | §11 promised a vouchers/redemptions screen | Vouchers appear inside the rewards tab | Same data, fewer navigation hops |
| 6 | FR-1.2.5 verification required | Implemented as: profile `PENDING` → emailed OTP → `POST /local-affiliate/verify-email` → `ACTIVE` | Needed to avoid a dead end for Scenario B; reuses `AuthService` OTP rather than inventing a second mechanism |
| 7 | NFR-13 localisation-ready | Explanation strings live in one map (`REWARD_STATUS_EXPLANATIONS` / `EXPLANATION_MESSAGES`), not inline | backend + frontend both read from a map, so swapping in i18n is mechanical |

### Two bugs found by testing and fixed before hand-off

1. **Voucher replay ordering.** A second presentation by the same customer returned `409 VOUCHER_USE_LIMIT_REACHED` instead of `ALREADY_REDEEMED`, because the overall usage guard ran before the per-customer lookup. Reordered; regression test added.
2. **Wrong-affiliate crediting.** A voucher whose stored tracking code pointed at a different affiliate would credit that other affiliate. The code is now re-resolved from the voucher *owner* at validation time; a warning is logged if no link exists.
3. (UX) An approved reward kept the "awaiting redemption" explanation. Cleared on approval; `APPROVED` is now the explanation for available rewards.

---

## 6. Test coverage

| Suite | Tests |
|---|---|
| `local-affiliate.util.spec.ts` | 22 — codes, tokens, hashing, URL building, slugs |
| `affiliate-reward.service.spec.ts` | 37 — verifiability matrix, E1–E5 calculations, transitions, balances, reversal, spending guards |
| `local-affiliate.service.spec.ts` | 22 — both scenarios, eligibility, terms, verification |
| `affiliate-catalogue.service.spec.ts` | 12 — provider URLs, eligibility, link idempotency, owner promotion |
| `affiliate-tracking.service.spec.ts` | 13 — redirect resilience, click capture, privacy |
| `affiliate-conversion.service.spec.ts` | 14 — ingest dedupe, self-referral, window, redemption conversions |
| `affiliate-redemption.service.spec.ts` | 17 — all validation guards, idempotency, owner authority, reversal |
| `affiliate-admin.service.spec.ts` | 24 — verifiability gate, rule versioning, encryption, reconciliation, reports |
| **Total for this feature** | **162** |
| Whole backend suite | **982 passing, 90 suites, 0 failures** |

Manual verification performed against a running server + browser:

- anonymous marketplace, personal page, voucher check
- Scenario B registration → `PENDING` → OTP → `ACTIVE`
- duplicate email → `409 EMAIL_ALREADY_REGISTERED`
- activation idempotency, stale terms → `409`
- link creation → redirect → `302` with provider param; unknown code → offers index
- redeem points → voucher; over-spend → `422`; balances after spend
- admin: conversion approve / reverse, reconciliation counts, reports
- admin UI: all four tabs render with live data; affiliate detail opens
- auth guards: admin/partner/redemption/me all `401` without credentials

---

## 7. Known gaps / next steps

| Gap | Phase |
|---|---|
| Mall product import + `order_attribution` + conversion push | 2 (needs Mall work) |
| ThriveCart adapter (`passthrough[la_tracking_id]`) | 3 |
| Awin pull reconciliation (`clickRef`, 31-day windows, validation/amendment passes) | 4 (needs Awin written confirmation) |
| vCard/EV Card linking + QR issuance | 2 |
| Locale-based eligibility (`MEMBERSHIP_TIER`) resolves to `true` today | 2 |
| Cashback materialisation to the wallet | gated behind `AFFILIATE_CASHBACK_ENABLED` |
| Shared UI kit | accepted debt (see PRD §14.6) |
| `Member`-tier eligibility and manual affiliate grouping | later |

---

## 8. Operations notes

- **Feature flag:** partner ingest is gated by `CENTRAL_AFFILIATE_API_ENABLED`; disabled routes return `503 FEATURE_DISABLED`.
- **Providers ship disabled where required:** Awin is seeded as `DRAFT` with a note that it must not be enabled before Awin confirms subnetwork treatment in writing.
- **Cron jobs:** reward expiry (hourly), voucher expiry (hourly), unmatched conversion ageing (03:00 daily).
- **Retention:** clicks are intended to be aggregated after 400 days (job not yet scheduled); ledger and conversion rows are retained indefinitely.
- **Migration safety:** both migrations were generated against the live schema, reviewed, and had three pre-existing drift statements (unrelated `referral_*` timestamp changes and a `BusinessProfile` FK that the data violates) removed rather than applied.
