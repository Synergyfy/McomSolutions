# MCOM Solutions — Phased Remediation Plan

> Source: Verified Codebase Audit (static re-trace + safe probes). No code changed during audit.
> Baseline: frontend `tsc --noEmit` PASS, backend `tsc --noEmit` PASS, 31 backend spec files listed (suite not executed), builds/live verification BLOCKED.
> Verdict: **NEEDS MAJOR FIXES** — do not take production traffic until Phase 1 + Phase 2 are closed and re-verified live.
> Working rule: complete phases **in order**. Do not skip ahead — later phases depend on earlier trust boundaries.

---

## How to use this document

* Each phase has: **Goal → Files → Steps → Acceptance criteria → Verify commands**.
* Check every box before moving to the next phase.
* Re-run the `Verify` commands after every phase and record the outcome.
* Runtime notes: anything marked `BLOCKED` in the audit (live servers, DB, payments, browser) must be verified in a staging environment with test credentials — never in production.

---

## Phase 0 — Baseline & Safety (do first, ~1–2 hours)

**Goal:** know exactly what tree you are fixing and be able to roll back.

### Steps

- [ ] Record current commit and dirty files:
  ```bash
  git status --short
  git log --oneline -5
  git diff --stat
  ```
  Known dirty at audit time: `apps/backend/prisma/schema.prisma`, `apps/backend/src/admin/admin-catalog.*`, `apps/backend/src/business/catalog.controller.ts`, `apps/frontend/src/components/admin/SectorsCategoriesPanel.tsx`, `apps/frontend/src/services/admin/*`, untracked `apps/frontend/src/components/admin/CatalogImagePicker.tsx`.
- [ ] Decide: commit or stash the working tree before remediation (recommended: separate commit per phase below).
- [ ] Confirm ignored secrets are not tracked:
  ```bash
  git ls-files apps/frontend/.env apps/backend/.env apps/backend/.env.staging apps/backend/.env.test
  git check-ignore -v apps/frontend/.env apps/backend/.env
  ```
  Expected: first command empty; second shows `.gitignore:20:.env*`. (Verified during audit.)
- [ ] Re-run static baseline and save output:
  ```bash
  npx tsc --noEmit -p apps/frontend/tsconfig.json
  npx tsc --noEmit -p apps/backend/tsconfig.json
  npx jest --listTests --prefix apps/backend
  ```
  Expected: both typechecks exit 0; ~31 spec files listed.
- [ ] Back up staging database before any migration or seed change.
- [ ] Create a staging-only test tenant (business + customer + admin) for IDOR/replay tests later.

**Acceptance:** clean baseline recorded; rollback path exists; no prod data at risk.

---

## Phase 1 — CRITICAL Security Ship-Blockers (do not ship without this)

### 1A. Hardcoded SSO / HMAC / webhook / API secrets in git

**Files:** `apps/backend/src/prisma/prisma.service.ts:22-81`

**Why first:** every SSO login, partner HMAC call, and webhook acceptance trusts these literals (`cs_6a5084…`, `ak_d6df04…`, `hm_4b5dc7…`, `wh_5a3cc7…`, `gbs_secret_123`). Anyone with repo history can forge them.

**Steps:**

- [ ] Delete all `rawSecret` / `apiKey` / `rawHmacSecret` / `rawWebhookSecret` literals from `prisma.service.ts`.
- [ ] Source defaults from vault/env only; fail closed when missing in production.
- [ ] Change `seedDefaultSsoClients()` to insert-only with random generated values (or remove auto-seed entirely; use console rotation flow).
- [ ] Rotate live credentials for `mcom-mall`, `247gbs`, `247gbs-affiliate` (client secret, apiKey, HMAC, webhook secret).
- [ ] Add a secret-scan gate (e.g. `gitleaks` or GitHub secret scanning) to CI.

**Acceptance:** `grep -rn "cs_6a5084\|ak_d6df04\|hm_4b5dc7\|wh_5a3cc7\|gbs_secret_123" apps/backend/src` returns nothing; staging SSO login still works with rotated values.

### 1B. Business read/delete IDOR + user-delete cascade + password-hash leak

**Files:**
`apps/backend/src/business/business.controller.ts:347-367`
`apps/backend/src/business/business.service.ts:948-1006` (esp. `findOne:980-993`, `deleteBusiness:995-1006`)

**Steps:**

- [ ] `GET /business/:id`: require owner (`where:{id,userId:req.user.userId}`) or `ADMIN`; replace `user:true` include with explicit `select` excluding `password`.
- [ ] `DELETE /business/:id`: require owner or `ADMIN`; remove `prisma.user.delete` cascade (soft-delete the profile instead — see Phase 5).
- [ ] `GET /business` list: minimize PII for non-admin callers (or restrict to admin/support roles).
- [ ] Add e2e: non-owner `GET`/`DELETE` → 403; response never contains `password`; owner flow still works.

**Acceptance:** customer token cannot read/delete another business; hash absent from all responses (assert on serialized JSON, not just Prisma type).

### 1C. Anonymous file upload → SVG XSS + public hosting + disk-fill

**Files:** `apps/backend/src/business/business.controller.ts:27-95`; `apps/backend/src/main.ts:48`

**Steps:**

- [ ] Add `JwtAuthGuard` to `POST /upload` and `POST /business/upload`.
- [ ] Add `limits:{fileSize:5*1024*1024}` + mimetype + magic-byte check; deny `.svg` (or sanitize server-side and serve with `Content-Security-Policy: sandbox` + `Content-Disposition: attachment`).
- [ ] Replace `Date.now()-Math.random` names with `crypto.randomUUID()`.
- [ ] Serve `/uploads` via signed URLs or auth middleware — not open `express.static`.
- [ ] Add tests: anonymous POST → 401; `.svg` → 400; 6 MB → 413; uploaded file not executable as script.

**Acceptance:** all four negative tests pass; legitimate logo upload still returns `secure_url`.

---

## Phase 2 — Payments Hardening (money paths)

**Files:** `apps/backend/src/payment/payment.controller.ts:114-187`; `apps/backend/src/payment/payment.service.ts:130-304,484+`; `apps/backend/src/pricing/pricing.service.ts:151-260`

### Steps

- [ ] Guard `POST /payment/paypal/capture` and `POST /payment/platform/paypal/capture` with `JwtAuthGuard` + verify `custom_id.businessId` belongs to the caller.
- [ ] Add DB-unique provider references (`paymentIntentId` / PayPal `orderId`) — not Redis-only (`paypal:captured:{orderId}` is lost on flush).
- [ ] Wrap local activation writes in `prisma.$transaction`; on PayPal-success/DB-fail, reconcile (do not silently drop).
- [ ] Return idempotent-200 on replay instead of 400 (after verifying same business/amount).
- [ ] Add inbound Stripe webhook for memberships/platform (`constructEvent` with `STRIPE_WEBHOOK_SECRET`, keyed by `paymentIntentId`); keep frontend `confirm` as fallback. Today only the wallet top-up webhook exists.
- [ ] Derive trial eligibility server-side (do not trust client `isTrial` boolean); re-validate PayPal captured amount against plan price.
- [ ] Ensure every activation writes a `BillingTransaction` (or equivalent) row — the traced `subscribeMembership` path updates `BusinessProfile` membership fields with no visible payment-record write in lines 151–250 (confirm across full function).

**Acceptance:** replay same `orderId`/`paymentIntentId` 5× → exactly one activation + one ledger row; close-tab-after-charge reconciles via webhook; non-owner capture → 403.

---

## Phase 3 — Auth / Session Correctness

**Files:** `apps/backend/src/auth/auth.service.ts:328-404`; `apps/backend/src/auth/auth.module.ts:24`; `apps/backend/src/auth/auth.controller.ts:40-125`; `apps/backend/src/auth/strategies/jwt.strategy.ts:17-52`; `apps/backend/src/admin/admin-auth.controller.ts:7-22`

### Steps

- [ ] Implement `POST /auth/refresh` (hashed refresh store, rotation, reuse detection) **or** stop issuing `refreshToken`. Today `login`/`register` issue a 7 d refresh that nothing validates (only `sso/token/refresh` exists).
- [ ] Shorten regular access TTL toward spec (`auth.module.ts:24` is `1d`; spec says 15 m) and align `mcom_session` cookie `maxAge` (currently 7 d holding a 1 d token).
- [ ] Add revocation: logout + role-change + ban/deactivate must invalidate outstanding access (DB session version or denylist — `JwtStrategy.validate` currently does no DB lookup).
- [ ] Separate `JWT_SECRET` vs `SSO_JWT_SECRET` audiences strictly (remove dual-secret fallback for regular API).
- [ ] `bcrypt.genSalt(12)` everywhere (`auth.service.ts`, `admin.service.ts`, `business.service.ts`, `prisma.service.ts` — all currently default 10).
- [ ] Throttle + validate `GET /auth/check-email` (currently public, unthrottled → enumeration); use DTO `@IsEmail` on OTP/forgot bodies (currently raw strings).
- [ ] Replace admin-login in-memory `Map` 5/min (returns 401, lost on restart/multi-instance) with `Throttler` + Redis store returning 429.
- [ ] Replace `body:any` on `PUT /auth/settings` and `POST /auth/reset-password` with validated DTOs.

**Acceptance:** refresh rotation e2e passes; expired/revoked/deleted-user tokens rejected; brute-force probes throttled with 429.

---

## Phase 4 — Broken Contracts & Role Scoping

**Files:** `apps/backend/src/business/business.controller.ts:357-391`; `apps/backend/src/business/business.service.ts:1008-1024`; `apps/backend/src/notification/notification.controller.ts`; `apps/backend/src/integration/integration.controller.ts:8-15`

### Steps

- [ ] Fix route shadowing: declare `GET /business/support-tickets` **before** `GET /business/:id` (today `:id` at line 358 swallows `support-tickets` at 370 → `DashboardSupport` always 404s).
- [ ] Add `businessId` FK to `SupportTicket`; replace `fromName` string matching with scoped `where:{businessId}`.
- [ ] Scope notifications by `userId` (fallback to `businessId`) — today `req.user.businessId`-only breaks customers/agents.
- [ ] `GET /integration/business`: header-only API key (drop `?apiKey`), constant-time compare.
- [ ] Add shared DTOs/types for `settings`, payment initiates (`level/tier/billing`), support-ticket create, `claim/start`; add Query DTOs with `@Type(()=>Number)` for `page/limit`.

**Acceptance:** support-ticket GET returns 200 with real rows; customer notifications work; contract types shared FE/BE.

---

## Phase 5 — Data Integrity & Lifecycle

### Steps

- [ ] Add soft deletes (`deletedAt` + query middleware) per `migration-rules.md`; migrate `deleteBusiness`/admin deletes off hard deletes.
- [ ] Make `seed.ts` idempotent: replace `deleteMany()+createMany()` for boroughs/highStreets/malls with `upsert`; never destructive-seed against prod.
- [ ] Seed missing domains the code depends on (`Tier/Plan/PlanVariant/Subscription`, `FxRate`, `Wallet`) or remove the dependency.
- [ ] Add `businessId` FK + indexes for tickets; verify `EcosystemSubscription/AdminPayment/BusinessProgramme/AppWebhookLog` denormalized `businessId/clientId` strings get relations or documented justification.

**Acceptance:** re-seed twice → same row counts; delete flows leave audit trail; no prod wipe possible.

---

## Phase 6 — Performance & Database

### Steps

- [ ] Wallet cron `expireStaleHolds`: add `orderBy expiresAt`, cursor pagination beyond `take:100`, batch `updateMany` + single audit insert where semantics allow (`wallet-reconciliation.service.ts:34-47`).
- [ ] Add the 9 missing-index groups from the audit: `Notification(businessId,read,createdAt)`, `BillingTransaction(businessId,status,providerPaymentId,createdAt)`, `BusinessProfile(search/expiry/localMallId)`, `Subscription(businessId,status,endDate)`, `EcosystemSubscription(status,endDate)`, `AdminPayment(status,date)`, `SupportTicket/AuditLog/BroadcastNotification/RevenueRecord(status/createdAt/date)`, `MembershipPlan/PackageTemplate(archived/platform/isActive)`, `User(role)`.
- [ ] Minimize hot-path selects: `GET /auth/me`, SSO `userinfo`, `login` package fetch → `select` minimal fields (never `user:true`); parallelize the two sequential login queries.
- [ ] Enable Prisma query logging in dev + >100 ms slow-query warn in prod (`query-optimization.md`).
- [ ] Add `helmet`, global `AllExceptionsFilter` envelope, ValidationPipe `exceptionFactory` + `enableImplicitConversion:false`; move Swagger to `api/docs` per spec (currently `docs`).

**Acceptance:** `EXPLAIN` shows index use on the newly indexed filters; p95 on `me`/login improves or is documented; slow-query log active.

---

## Phase 7 — Tests, Docs & Final Regression

### Tests to add (backend e2e + frontend smoke)

- [ ] IDOR: non-owner `GET/DELETE /business/:id` → 403.
- [ ] Hash-leak: `GET /business/:id` response contains no `password` key.
- [ ] Upload: anon → 401; `.svg` → 400; oversize → 413.
- [ ] Payments: double-capture (same order/intent 5×) → single activation; Redis-down path; webhook replay; close-tab reconciliation.
- [ ] Auth: refresh rotation + reuse detection; logout invalidation; deleted/banned token rejection; OTP single-use + expiry.
- [ ] Cron: overlapping instances (Redis lock), backlog >100 holds all eventually release.
- [ ] Frontend: login/register validation, dashboard empty/error states, checkout failure banners.

### Docs & config

- [ ] Document `CLOUDINARY_*`, `MCOM_GBP_RATE`, `JWT_EXPIRES`/refresh vars missing from `.env.example`; remove stale root `.env.example` (Gemini-era) or mark deprecated.
- [ ] Keep `apps/frontend/.env` and `apps/backend/.env*` untracked (verified ignored) — never commit; restrict Google Maps key by referrer.
- [x] Duplicate migration names investigated (`20260712162426` vs `20260712163406`): not a true
  duplicate — `…2426` creates PascalCase SSO/reset tables, `…3406` renames them to snake_case via
  drop/recreate. Chain deploys in order (proven on scratch DB). Remaining risk is data loss, not
  naming: run the `SsoClient` row-count guard in D3 before staging deploy.

### Final regression

```bash
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
npm run test:unit --workspace=apps/backend
npm run test:e2e --workspace=apps/backend
npm run build --workspace=apps/backend
npm run build --workspace=apps/frontend
```

**Acceptance:** all green in staging + live sandbox payments (Stripe test `4242…`, PayPal sandbox) + upload attack suite + IDOR suite.

---

## Appendix A — Finding disposition (32 prior findings)

* CONFIRMED statically (fix as above): C1–C3; H1–H8 (hash leak, route shadow, dead refresh, public captures, no membership webhook, Redis-only idempotency, stateless JWT, name-keyed tickets); MEDIUM: `?apiKey`, `body:any`, `check-email`, admin throttle, missing helmet/filter, notifications scoping, hard deletes, destructive seed, test gaps.
* PARTIALLY CONFIRMED / downgraded: `sso/userinfo` manual parse (works → LOW); wallet-cron N+1 (bounded → LOW); login sequential/heavy includes (INFO, needs query log).
* FALSE POSITIVES: frontend `.env` "committed" (not tracked — LOW hygiene only); loop-query alarmism on seed (INFO); static-catalog/`Math.random`/toast/`Coming soon` as mocks (INFO, not bugs).
* BLOCKED (needs live): exact query counts/`EXPLAIN`, CORS DB-origin failover, `wallet/transactions/:id` ownership edge, PayPal amount re-validation, browser/UX runtime.

---

## Appendix B — What to fix first (top 5)

1. **Secrets in git** — forgeable SSO/HMAC/webhooks; rotate + vault.
2. **Business IDOR + user-delete cascade + hash leak** — data loss + cracking foothold.
3. **Anonymous SVG upload** — stored XSS + malware + disk-fill.
4. **Public captures + no membership webhook** — money/ledger divergence.
5. **Dead refresh + 1 d stateless JWT** — broken sessions + lingering access.

---

## Appendix C — Verification checklist (copy per phase)

* [ ] Static re-trace done (file:line quoted)
* [ ] Safe probes run (`tsc`, `git ls-files`, targeted grep)
* [ ] Live negative cases run in staging (anon/owner/replay/expired/overlap)
* [ ] Response bodies + status codes recorded
* [ ] Severity re-confirmed or downgraded with reason
* [ ] Unknowns explicitly listed (no silent assumptions)

---

## Appendix D — Staging TODOs (Phase 1 closure)

> Context: Phase 1 code is implemented and locally verified (backend `tsc` clean,
> 34 unit suites / 374 tests green, live boot smoke: anon `POST /api/v1/upload` → 401,
> anon `GET /uploads/*` → 401). The items below could not be closed locally and
> **must** be completed in staging before Phase 1 counts as closed. Never run these
> against production. Record every response body + status code per Appendix C.

### D1. Rotate live SSO credentials (Phase 1A follow-up)
- **Why:** the old hardcoded secrets were removed from `apps/backend/src/prisma/prisma.service.ts`,
  but they still exist in git history — anyone with a clone can read them until rotated.
- **Rotate (staging + production) for all three clients:** `mcom-mall`, `247gbs`, `247gbs-affiliate`
  — client secret, apiKey, and (mall) HMAC + webhook secrets.
- **Provision the new values as env vars** (insert-only seeder reads these; production fails closed if missing):
  `SSO_SEED_MALL_CLIENT_SECRET`, `SSO_SEED_MALL_API_KEY`, `SSO_SEED_MALL_HMAC_SECRET`,
  `SSO_SEED_MALL_WEBHOOK_SECRET`, `SSO_SEED_247GBS_CLIENT_SECRET`, `SSO_SEED_247GBS_API_KEY`,
  `SSO_SEED_247GBS_AFFILIATE_CLIENT_SECRET`, `SSO_SEED_247GBS_AFFILIATE_API_KEY`
  (see `apps/backend/.env.example`). Generate with `openssl rand -hex 32`.
- **Acceptance:** staging SSO login works with rotated values; old secrets rejected;
  `grep -rn "cs_6a5084\|ak_d6df04\|hm_4b5dc7\|wh_5a3cc7\|gbs_secret_123" apps/backend/src` empty.
- [ ] Rotated in staging; SSO login re-verified live; old values confirmed dead.

### D2. Secret-scan gate in CI (Phase 1A follow-up)
- **Why:** prevents hardcoded secrets from re-entering the repo.
- Add `gitleaks` (or GitHub secret scanning) blocking `cs_*` / `ak_*` / `hm_*` / `wh_*`
  patterns and generic high-entropy secrets on every PR.
- [ ] Gate active; verified it blocks a test commit containing a dummy secret.

### D3. Migration deploy dry-run (Phase 1B follow-up)
- **Why:** local DB had pre-existing drift (direct DDL / `db push` bypassed history: `plans`,
  `tiers`, `image_url` columns, etc.), so migration `20261003000000_phase1_soft_delete_business_user`
  (adds `deleted_at` + indexes to `"User"` / `"BusinessProfile"`) was applied locally via
  `prisma db execute`, not `migrate dev`. Staging/prod are assumed in sync with history — confirm it.
- Run `npx prisma migrate status` in staging; resolve the 4 pending migrations
  (`…_relational_plans…`, `…_webhook_retry…`, `…_task_engine`, `…_task_submission_data`)
  and the duplicate-name pair (`20260712162426` vs `20260712163406`) before deploying.
- **Back up the staging database first.** Then `npx prisma migrate deploy` (never `db push`).
- **Migration-hardening update (verified 2026-10-04):** the full chain (now 25 migrations)
  was deployed to a fresh scratch DB — `migrate deploy` exit 0 — and
  `migrate diff --from-migrations --to-schema` reports **zero drift**. Fixes applied to the
  (never-deployed, untracked) files: Phase 1 now uses `TIMESTAMP(3)` (was `TIMESTAMPTZ`, drifted
  from `schema.prisma`) with canonical snake_case index names (`User_deleted_at_idx`,
  `BusinessProfile_deleted_at_idx`); Phase 1/2/3 files hardened with `IF NOT EXISTS`.
  The `2026071216…` pair is not a true duplicate (`…2426` creates PascalCase SSO/reset tables,
  `…3406` renames them to snake_case via drop/recreate) — but `…3406` **drops tables**: before
  staging deploy, check `SELECT COUNT(*) FROM "SsoClient"` — if the PascalCase table exists with
  rows, copy them into `sso_clients` first or the SSO clients are wiped. Local dev DB was realigned
  to the corrected DDL via `db execute`.
- [ ] Staging `migrate deploy` clean; `deleted_at` columns + indexes present on both tables.

### D4. Staging test tenant (supports D5–D6)
- Create one staging-only tenant: a business owner account (+ its `BusinessProfile`),
  a second unrelated customer account (the "intruder"), and an admin account.
  Never use production data.
- [ ] Tenant created; tokens for all three roles captured for probing.

### D5. IDOR + hash-leak e2e (Phase 1B acceptance, live)
- With the D4 tokens, in staging:
  1. Intruder `GET /api/v1/business/<owner-id>` → expect **403** (or 404 per convention — assert consistently).
  2. Intruder `DELETE /api/v1/business/<owner-id>` → expect **403**; profile still present.
  3. Owner `GET` → **200**; assert serialized JSON contains **no `password` key**
     (assert on the raw body string, not the Prisma type).
  4. Admin `GET`/`DELETE` → **200**; deleted profile then returns **404** and disappears from `GET /api/v1/business`.
  5. Non-admin `GET /api/v1/business?search=<email>` → results contain **no email/phone** fields.
- [ ] All five probes recorded with bodies + status codes; no hash, no cross-tenant access.

### D6. Upload attack suite (Phase 1C acceptance, live)
- With an authenticated staging token:
  1. No token `POST /api/v1/upload` and `/api/v1/business/upload` → **401** (smoke-verified locally; re-confirm in staging).
  2. `.svg` file → **400**.
  3. 6 MB file → **413**.
  4. `.html`/script bytes renamed to `.png` (magic-byte mismatch) → **400**; temp file cleaned up.
  5. Legitimate PNG → **200** with `secure_url`.
  6. No token `GET /uploads/<file>` → **401** (smoke-verified locally; re-confirm in staging).
- [ ] All six probes recorded with bodies + status codes; legitimate upload path intact.

---

## Appendix E — Staging TODOs (Phase 2 closure)

> Context: Phase 2 code is implemented and locally verified (backend `tsc` clean,
> 34 unit suites / 386 tests green, live boot smoke: anon `POST /payment/paypal/capture`
> and `/payment/platform/paypal/capture` → 401, unsigned `POST /payment/stripe/webhook` → 400).
> Decisions applied: trials removed entirely (everyone pays), conflicting replays → 409.
> Complete the items below in staging (PayPal sandbox + Stripe test mode) before Phase 2
> counts as closed. Never run these against production/live credentials.

### E1. Migration deploy with duplicate check (Phase 2 follow-up)
- Migration `20261003010000_phase2_payment_idempotency` adds
  `UNIQUE ("providerPaymentId")` + `INDEX (businessId, status)` on `"BillingTransaction"`.
- **Pre-deploy check (staging):** dedupe first —
  `SELECT "providerPaymentId", COUNT(*) FROM "BillingTransaction"`
  `WHERE "providerPaymentId" IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;`
  (Local dev had exactly this: one `pi_…` double-capture row; the older dup was removed
  before applying. Any staging rows returned must be reconciled to a single `paid` row first.)
- Then `npx prisma migrate deploy` (back up staging DB first; never `db push`).
- File hardened with `IF NOT EXISTS` (tolerates drifted DDL) — the dedupe check below is still
  **required** (`IF NOT EXISTS` does not save duplicate data from the unique index).
- [ ] Staging deploy clean; unique index present; no duplicate references remain.

### E2. Double-capture + replay suite (Phase 2 acceptance, live sandbox)
- With a staging business token, using Stripe test card `4242 4242 4242 4242` and PayPal sandbox:
  1. Same `orderId` / `paymentIntentId` captured 5× → exactly **one** activation + **one** ledger row;
     replays return 200 with `replayed: true`.
  2. Same reference replayed from a **different** business token → **409** + security log line.
  3. Non-owner capture (valid order, wrong business) → **403**; order never captured upstream
     (verify via read-before-capture: no capture call for foreign orders).
  4. Tampered amount (approved ≠ plan price) → **400**, no activation, no ledger row.
  5. Legacy 5-segment trial `custom_id` → **400** ("trials discontinued").
- [ ] All five probes recorded with bodies + status codes; ledger shows exactly one row per reference.

### E3. Webhook reconciliation suite (Phase 2 acceptance, live sandbox)
- Stripe test webhook (`STRIPE_WEBHOOK_SECRET` staging value):
  1. Valid `payment_intent.succeeded` for a membership intent → activated + ledger row (no frontend confirm call made).
  2. Same event delivered twice → second is idempotent 200 (`replayed`), still one ledger row.
  3. Forged signature → **400**, nothing activated.
  4. Close-tab flow: frontend confirms **after** the webhook already activated → confirm returns idempotent 200, one ledger row.
  5. Wallet top-up webhook still works (regression — untouched, but shares Stripe secrets/config).
- [ ] All five probes recorded; close-tab-after-charge reconciles via webhook alone.

### E4. Trial-removal + free-activation regression (Phase 2 acceptance)
- Backend now rejects trials everywhere; `POST /pricing/subscribe` is ADMIN-only manual grant.
- Known frontend fallout (flagged, not yet fixed):
  1. `PricingPage` → checkout links carry `isTrial=true`; `CheckoutPage` passes it through —
     backend ignores/rejects it, so trial buttons fail closed, but the UI still advertises trials.
  2. `DashboardMemberships` upgrade button calls free `POST /pricing/subscribe` directly —
     now **403** for non-admins by design; the flow must route through paid checkout.
  3. `BusinessOnboarding` TRIAL plan handling assumes free activation.
- [ ] Product decision recorded (remove trial UI vs. re-price); dashboard upgrade re-routed to checkout;
  no UI path grants unpaid membership.

---

## Appendix F — Staging TODOs (Phase 3 closure)

> Context: Phase 3 code is implemented and locally verified (backend `tsc` clean,
> frontend `tsc` clean, 36 unit suites / 416 tests green, new `test/auth-refresh.e2e-spec.ts`
> 7/7 green, backend build exit 0, live boot smoke on local dev DB: register → `me` → refresh
> rotation → replay-old → 401, `check-email` 429 after limit, weak `reset-password` → 400).
> Decisions applied: `RefreshSession` table with rotation + reuse-revokes-all; phased access TTL
> (**1h now**, flip `JWT_ACCESS_TTL` to `15m` after F3 passes); frontend single-flight
> 401→refresh→retry interceptor shipped in the same phase; global `ThrottlerGuard` with default
> in-memory store (Redis-backed store is a follow-up if staging runs multi-instance).
> Complete the items below in staging (test tenants only, never production) before Phase 3
> counts as closed. Record every response body + status code per Appendix C.

### F1. Migration deploy (Phase 3 follow-up)
- Migration `20261003020000_phase3_auth_refresh_sessions` adds `refresh_sessions` table
  (`jti`/`hashed_token` UNIQUE, `access_jti` index) + `User.token_version` (default 0).
- Migration `20261003030000_phase3_catalog_image_url` captures the `image_url` columns on
  `sectors`/`categories`/`sub_categories` that reached `schema.prisma` via direct `db push`
  with no migration file — without it, staging queries selecting `imageUrl` fail.
- Local note: dev DB applied via `prisma db execute` (same precedent as Phase 1); test DB
  (`mcom_mall_test`) was `db push`ed because it had no migration history — staging/prod must use
  `migrate deploy`, never `db push`. Back up staging DB first.
- **Proven 2026-10-04:** full 25-migration chain `migrate deploy` exit 0 on a fresh scratch DB,
  and `migrate diff --from-migrations --to-schema` is empty (zero drift). Staging `migrate status`
  must also be clean on the pre-existing pendings from D3/E1
  (relational-plans, webhook-retry, task-engine, task-submission-data, duplicate-name pair,
  Phase 1 + Phase 2 migrations) before deploying. Read-only drift pre-check is possible without
  touching staging data:
  `prisma migrate diff --from-url $STAGING_URL --to-migrations ./prisma/migrations --shadow-database-url $SHADOW_URL --script`
  (any output beyond the pending migrations = drift to reconcile first).
- [ ] Staging `migrate deploy` clean; `refresh_sessions` table + `token_version` column present.

### F2. Refresh rotation + reuse suite (Phase 3 acceptance, live)
- With a staging business token:
  1. `POST /auth/refresh` with R0 → 200/201 new pair, `refreshToken` value differs.
  2. Chain R1 → R2 works (proves rotation, not one-shot).
  3. Replay R0 → **401**; the newest token from the chain is now dead too (reuse protection) → **401**.
  4. Forged string and access-token-as-refresh → **401**, no session side effects.
  5. `POST /auth/logout` with refresh → session dead; bound access on `GET /auth/me` → **401**
     (revoked `accessJti`); logout with no body → all sessions revoked (logout everywhere).
  6. Deleted-user refresh → **401**; post-`reset-password` old refresh → **401** (`tokenVersion` bump).
- [ ] All six probes recorded with bodies + status codes; exactly one live session per rotation.

### F3. TTL cutover 1h → 15m + interceptor regression (phased decision)
- Pre-cutover (ships as-is): decode access JWT `exp` ≈ 1h; `mcom_session` cookie expiry ≈ 1h;
  `mcom_refresh` cookie `httpOnly`, 7d.
- Exercise the frontend single-flight interceptor: expire/shorten a token (or wait out 1h),
  confirm concurrent 401s trigger exactly **one** `POST /auth/refresh` and the retried calls succeed
  with no user-visible logout. Check login/register/Google-callback/affiliate paths persist
  `refresh_token` (all funnel through `setSharedAuthCookies`).
- Only after the above passes: set `JWT_ACCESS_TTL=15m` in staging, restart, re-run F2 +
  the interceptor check, then close Phase 3.
- [ ] Interceptor verified at 1h; cutover to 15m done; F2 re-green at 15m.

### F4. Secret separation + env (Phase 3 acceptance)
- Set `SSO_JWT_SECRET` (new, `openssl rand -hex 32`) and `JWT_ACCESS_TTL`/`JWT_REFRESH_TTL` in
  staging/prod env (see `apps/backend/.env.example`). Production boot fails closed without
  `SSO_JWT_SECRET` (see `app.module.ts` `validateEnv`).
- Probes: SSO access token on `GET /auth/me` → **401**; regular access on `sso/userinfo` → **401**;
  staging SSO login still works (regression on D1-rotated secrets).
- [ ] Cross-audience tokens rejected both ways; SSO login intact.

### F5. Throttle + enumeration (Phase 3 acceptance)
- 6 rapid `GET /auth/check-email` → five 200s then **429**; malformed email → **400**.
- 6 rapid `POST /auth/login` / `POST /admin/auth/login` → **429** (not 401 — brute force is now
  distinguishable from bad credentials).
- If staging runs multi-instance: confirm 429 still fires cross-instance; if not, prioritize the
  Redis-backed throttler store follow-up (currently in-memory, per-instance budgets).
- [ ] 429s recorded; enumeration throttled; multi-instance behavior documented.

### F6. Known pre-existing gaps (not Phase 3, do not gate on these)
- `test/app.e2e-spec.ts` Pricing Flow (`GET /pricing/plans` expects ≥4 plans) fails on an unseeded
  DB, and the two Google Places e2e fail with the stub API key — both environmental, untouched by Phase 3.
- No ban/suspend user feature exists in the codebase, so `tokenVersion` revocation currently wires
  password-reset + logout + delete paths only; hook role-change/ban endpoints into
  `AuthService.revokeUserSessions()` if/when such admin actions are added.
- Legacy access tokens issued before Phase 3 carry no `tv` claim and are accepted until they expire
  (backwards-compat path in `JwtStrategy`); they age out within the old 1d window.

---

## Appendix G — Staging TODOs (Phase 4 closure)

> Context: Phase 4 code is implemented and locally verified (backend `tsc` clean,
> frontend `tsc` + build clean, 36 unit suites / 424 tests green, new
> `test/business-contracts.e2e-spec.ts` 15/15 green, backend build exit 0, 27-migration
> chain `migrate deploy` exit 0 on a fresh scratch DB with `migrate diff` empty).
> Decisions applied: `?apiKey` query param **removed outright** (tree-wide sweep of
> `C:\Users\Azeem\Documents\github\Mcom` found zero callers — fundordonate, 247gbs,
> mall, and rewards all use SSO/userinfo, `/tasks`, `/wallet/partner`, `/payment/*`);
> notifications scoped `userId → businessId → broadcasts`. Complete the items below in
> staging (test tenants only, never production) before Phase 4 counts as closed.
> Record every response body + status code per Appendix C.

### G1. Migration deploy (Phase 4 follow-up)
- Migrations `20261004000000_phase4_support_ticket_business` (nullable `business_id` +
  FK + backfill `fromName → BusinessProfile` + indexes) and
  `20261004010000_phase4_notification_user` (nullable `user_id` + indexes).
- Canonical constraint/index names were aligned via `migrate diff` on scratch
  (`support_tickets_business_id_fkey`, `support_tickets_business_id_idx`,
  `support_tickets_status_idx`, `Notification_user_id_idx`; the composite
  `Notification_businessId_read_createdAt_idx` is Prisma-canonical as-is).
- Local note: dev DB applied via `db execute` + rename alignment; test DB `db push`ed
  (no history). Staging must use `migrate deploy` (back up first; never `db push`).
- Backfill check after deploy:
  `SELECT COUNT(*) FROM "support_tickets" WHERE "business_id" IS NULL;`
  (unmatched legacy rows stay readable by admins; a later migration enforces NOT NULL
  once staging confirms zero NULLs).
- [ ] Staging `migrate deploy` clean; backfill NULL count recorded (target: 0, else triaged).

### G2. Contract regression suite (Phase 4 acceptance, live)
- With a staging business token (+ customer + intruder from the D4 tenant):
  1. `GET /business/support-tickets` → **200** with rows (was 404-by-shadowing before).
  2. `POST /business/support-tickets` → **201** with `businessId` stamped; invalid body → **400**.
  3. `GET /business/<real-id>` → **200** (shadow fix did not break `:id`).
  4. Customer `GET /notifications` → own user rows + broadcasts, no business rows.
  5. Intruder `DELETE /notifications/<another-user's-id>` → **404**, row intact.
  6. `GET /integration/business` with `x-api-key` → **200**; with `?apiKey=` → **401**;
     missing/wrong key → identical **401** bodies.
  7. `POST /payment/stripe/initiate` with `billing: weekly` → **400**; valid body → normal flow.
- [ ] All seven probes recorded with bodies + status codes.

### G3. Behavior-change sign-off (Phase 4 acceptance)
- Non-admin `DELETE /notifications/:id` on global broadcasts now returns **404**
  (previously deletable by anyone) — confirm no staging workflow depends on that.
- Trial UI still advertises trials while the backend ignores `isTrial` (known E4 fallout,
  unchanged by Phase 4) — re-confirm the product decision is still pending, not regressed.
- [ ] Sign-off recorded; no staging workflow broken by broadcast-delete lockdown.

---

## Appendix H — Staging TODOs (Phase 5 closure)

> Context: Phase 5 code is implemented and locally verified (backend `tsc` clean,
> 36 unit suites green, new `test/soft-delete.e2e-spec.ts` 4/4 green, full e2e 73 passed
> with only the 3 known environmental failures (pricing seed, Google stub key), backend
> build exit 0, 28-migration chain `migrate deploy` exit 0 on a fresh scratch DB with
> `migrate diff` empty, seed proven idempotent by double-run with identical row counts).
> Decisions applied: soft-delete extension covers User/BusinessProfile + 4 affiliate
> profiles (Prisma 6 removed `$use` middleware — extensions only, object form only);
> admin user removal stamps `deletedAt` (rows + audit preserved); seed refuses production
> without `ALLOW_SEED_PROD=true`; denormalized finance/programme/webhook keys stay FK-free
> by documented justification. Complete the items below in staging (test tenants only,
> never production) before Phase 5 counts as closed. Record every response body +
> status code per Appendix C.

### H1. Migration deploy (Phase 5 follow-up)
- Migration `20261004020000_phase5_profile_soft_delete` adds nullable `deleted_at` +
  indexes to `customer_profiles` / `agent_profiles` / `consultant_profiles` /
  `account_manager_profiles` (no backfill — existing rows read as live).
- Local note: dev DB applied via `db execute`; test DB `db push`ed (no history).
  Staging must use `migrate deploy` (back up first; never `db push`).
- [ ] Staging `migrate deploy` clean; four `deleted_at` columns + indexes present.

### H2. Delete-flow suite (Phase 5 acceptance, live)
- With staging admin + business owner + customer tokens:
  1. Admin `DELETE /admin/users/customers/:id` → **204**; repeat → **404** (not a crash).
  2. Deleted user login → **401**; deleted profile absent from admin lists; direct
     `GET /business/:id` with the victim owner token → **401** (JWT rejects trashed user).
  3. `audit_logs` retains the `Customer Deleted` row (audit trail preserved).
  4. Re-register the deleted email → **409** (reserved, not 500). Note: this also means
     a deleted business cannot self-serve re-register with the same email — currently by
     design; record a product decision if re-registration must be supported (would need
     an admin restore/re-issue flow, which does not exist yet).
- [ ] All four probes recorded with bodies + status codes.

### H3. Seed safety (Phase 5 acceptance)
- Run `npx prisma db seed` twice against a staging-clone (never production): identical
  row counts on boroughs/high-streets/malls/api-keys/demo tables (proven locally).
- Confirm `NODE_ENV=production` without `ALLOW_SEED_PROD=true` refuses (proven locally).
- [ ] Double-seed verified; prod guard verified.

---

## Appendix I — Staging TODOs (Phase 6 closure)

> Context: Phase 6 code is implemented and locally verified (backend `tsc` clean,
> `nest build` clean, 38 unit suites / 436 tests green, 29-migration chain
> `migrate deploy` exit 0 on a fresh scratch DB with `migrate diff` empty,
> live boot smoke: helmet headers present, `/api/docs` 200, `/docs` 404,
> standard envelope on 401/400/404 incl. flattened validation `errors`,
> OTP send→verify round-trip green). Decisions applied: trigram index kept OUT
> of the migration (proven installable locally, but the 7-row dev table
> seq-scans regardless — needs staging volume to justify); `SLOW_QUERY_MS`
> env (default 100, fail-safe); Swagger cut to `api/docs` now. Complete the
> items below in staging (test tenants only, never production) before Phase 6
> counts as closed. Record every response body + status code per Appendix C.

### I1. Migration deploy (6A follow-up)
- Migration `20261005000000_phase6_perf_indexes` adds 23 plain indexes, no new
  UNIQUE constraints — no pre-deploy dedupe needed (unlike E1).
- **Back up the staging database first.** Then `npx prisma migrate deploy`
  (never `db push`). Confirm `migrate status` is clean on all pre-existing
  pendings (D3/E1/F1/G1/H1) before deploying.
- pg_trgm (only if the staging role permits `CREATE EXTENSION` — verify once,
  document for prod):
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`
  `CREATE INDEX IF NOT EXISTS "BusinessProfile_businessName_trgm_idx"`
  `ON "BusinessProfile" USING GIN ("businessName" gin_trgm_ops);`
  then `EXPLAIN` the `ILIKE '%…%'` search. If the role lacks privilege, or
  `EXPLAIN` still shows Seq Scan at staging volume, the documented skip stands
  (btree is not a substitute — do not add one).
- [ ] Staging `migrate deploy` clean; new indexes present; trigram
  attempt-or-skip recorded with `EXPLAIN` evidence.

### I2. Index-use + p95 suite (6A/6C acceptance, live)
- With staging data of realistic volume (seeded bulk rows, not 5-row tables):
  1. `EXPLAIN (ANALYZE, BUFFERS)` each newly indexed filter (hold-expiry scan,
     subscription-expiry scan, admin payment/date lists, ticket/support lists,
     role-filtered user lists) → record Index Scan / Bitmap Heap Scan (no Seq Scan).
  2. `GET /auth/me` p95 before vs after (e.g. 50 sequential calls with a staging
     token, compare medians) → improvement recorded, or documented no-op with
     query-log evidence. Same spot-check for SSO `userinfo` + `login`.
- [ ] EXPLAIN outputs recorded; p95 comparison recorded.

### I3. Cron + slow-query suite (6B/6D acceptance, live)
- Seed >100 stale holds in staging (e.g. 250 with past `expiresAt`):
  1. Consecutive cron ticks drain the **entire** backlog (tail rows released, not
     just the first page); a concurrently-CAPTURED hold is untouched; no hold
     released twice.
  2. Slow-query proof: under staging load (or by temporarily lowering
     `SLOW_QUERY_MS`), confirm a `Slow query (>Nms)` warn line appears with
     model + operation + duration and **no** args/data; grep the log for
     `password|token|secret` → zero hits. (No slow-query lines were observable
     locally — dev DB is tiny and everything is fast.)
- [ ] Full drain proven; slow-query line observed; log-redaction grep clean.

### I4. Hardening regression (6E acceptance, live)
- 1. Response headers include `content-security-policy`, `x-frame-options`,
     `strict-transport-security` (helmet) on `GET /auth/me` and one public
     route (smoke-verified locally; re-confirm in staging).
- 2. Trigger 400 (bad body), 401 (no token), 404 (unknown id) → all match the
     standard envelope (`success:false,statusCode,message,timestamp,path`;
     400 carries the flattened `errors` array).
- 3. Swagger UI loads at `/api/docs`; old `/docs` returns 404 (expected —
     no frontend `/docs` links exist; only the logging-middleware exclusion,
     already updated). Confirm no staging runbook/bookmark depended on `/docs`.
- [ ] Headers, envelope shapes, and Swagger cutover re-confirmed in staging;
  sign-off logged.
