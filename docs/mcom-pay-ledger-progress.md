# Central Ledger — implementation progress

Tracks what is actually built against `docs/mcom-pay-ledger-implementation-plan.md`.

**Do not run `prisma migrate dev` on this repository** — it reports
`20261021000000_add_coupons` as modified and offers a reset. Migrations here are
written by hand and applied with `migrate deploy` (see `docs/app-payments-hardening.md`).

---

## Phase 0 — Retire MCOM credits ✅ (applied)

### What changed

**Currency is GBP everywhere. There is no conversion layer.**

| Area | Change |
|---|---|
| `prisma/schema.prisma` | `Wallet.currency`, `WalletTransaction.currency` default `GBP`; `WalletTopUpRequest.walletCurrency` default `GBP`; `AffiliateTaskSettlement.fxQuote` default `GBP` |
| Wallet creation | `wallet.service.ts`, `auth.service.ts` (×3), `business.service.ts`, `local-affiliate.service.ts` create `currency: 'GBP'` |
| FX helpers deleted | `WalletService.getGbpToMcomRate`, `WalletService.convertGbpToCredits`, `WalletTopUpService.getExchangeRate`, `AccessService.getGbptoMcomRate`, `AppPaymentsService` FX lookup |
| Top-ups | GBP-only; non-GBP providers rejected with `400` instead of silently converting 1:1 |
| Referral commissions | `commissionCredits = commissionAmountGbp`; no FX lookup |
| Delegation | `fxRate` pinned to `1`, `fxQuote` `GBP` |
| User-facing strings | wallet balance, error messages and settlement messages now say `£`/GBP |

### Migration

`prisma/migrations/20261120120000_retire_mcom_currency/migration.sql`

- **Preflight `DO` block aborts the migration** if any `GBP→MCOM` `FxRate` is not
  1, or any top-up request was converted at a non-1 rate. No silent 1:1 rewrite
  of money bought at another rate.
- Converts currency labels and pins `exchange_rate`/`fx_rate` to `1`.
- No balance values are rescaled.

Verified: 325 wallet/app-payments/referral/affiliate/access tests took the new
semantics (tests that encoded ×2 MCOM conversion were updated to ×1), and the
full backend suite is green (1031 tests).

---

## Phase 1 — Ledger core ✅ (applied)

### Schema

`prisma/migrations/20261120121000_central_ledger_core/migration.sql`

| Model | Purpose |
|---|---|
| `GlAccount` | Account instance (`wallet:<id>`, `platform:wallet:GBP`, `gateway:stripe:GBP`, `payable:app:<clientId>`…), materialised `balanceMinor` |
| `GlTransfer` | One business event: `intent`, `platformId`, `reference`, unique `idempotencyKey` |
| `GlTransaction` | One balanced step (a transfer may have several: gateway → platform → seller) |
| `GlEntry` | One debit or credit, with provenance links |
| `GlDailyRollup` | Derived daily aggregates (rebuildable) |

Additive columns on `WalletTransaction`: `intent`, `transfer_id`,
`counterparty_wallet_id`, `ledger_entry_id`.

Two hardening details beyond the plan:

1. **Deferred constraint trigger** `gl_entries_balanced` — the database itself
   rejects an unbalanced transaction at commit. Not just a unit test.
2. **The platform wallet is seeded by the migration** (`platform:wallet:GBP`,
   deterministic id `glacct_platform_wallet_gbp`), so it exists before the first
   posting.

### Code

```
apps/backend/src/ledger/
├── account-code.ts              # code → account spec; unknown codes throw
├── gl-posting.plan.ts           # pure validation + per-account movements
├── chart-of-accounts.service.ts  # resolve/create accounts inside the caller's tx
├── gl-posting.service.ts         # the only writer of money
├── ledger.module.ts
└── *.spec.ts
```

Design choices worth knowing:

- **Account identity is derived from the code.** Adding an account kind means
  adding a parser branch; a typo fails loudly instead of creating a stray account.
- **`post()` runs inside the caller's transaction.** If the caller rolls back,
  no money moved.
- **Accounts are locked in code order** (`ORDER BY code … FOR UPDATE`) so
  multi-leg transfers cannot deadlock.
- **Balance sign convention is explicit** (`normalSide`): a user wallet grows on
  credits, a gateway clearing account grows on debits. `balanceDelta` is the
  single place that encodes it.
- **Guard rails:** a user wallet cannot go negative (`INSUFFICIENT_BALANCE`);
  the platform wallet cannot go negative (`INSUFFICIENT_PLATFORM_BALANCE`) unless
  a code is explicitly whitelisted (backfill only); payables and suspense may go
  negative because that represents money owed *to* us.
- **Idempotency:** a replay returns the existing transfer (`replayed: true`);
  a concurrent duplicate loses on the unique key and adopts the winner.

### Tests

`src/ledger/gl-posting.plan.spec.ts` — 13 tests: code parsing, unknown codes,
balance rules, zero/negative/non-integer amounts, non-GBP accounts, duplicate
account netting, multi-step transfers, sign convention.

`src/ledger/gl-posting.service.spec.ts` — 9 tests: happy-path 3-leg posting,
unbalanced rejection (no writes), idempotent replay, concurrent-key race,
wallet overdraft, platform-wallet guard, whitelisted negative, frozen account,
multi-step netting.

---

## Verification run

```
cd apps/backend
npx tsc --noEmit -p tsconfig.json      # only the pre-existing affiliate spec error
npx jest --runInBand                   # 95 suites, 1031 tests — all pass
npm run build                          # succeeds
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
                                       # hand-written DDL matches the schema exactly

cd apps/frontend
npx tsc --noEmit                       # clean
npx vitest run                         # 142/143; 1 pre-existing unrelated failure
                                       # (BusinessCategorySelectors.test.tsx)
```

---

## Phase 2 — Backfill & reconciliation ✅ (applied to the local database)

### Migrations applied

```
npx prisma migrate deploy
  ✓ 20261120120000_retire_mcom_currency
  ✓ 20261120121000_central_ledger_core
```

Verified after applying:

```
wallet currencies: [ { currency: 'GBP', n: 48 } ]
platform wallet:   { id: 'glacct_platform_wallet_gbp', type: 'PLATFORM_WALLET', balanceMinor: '0' }
unbalanced insert rejected by trigger: true
  -> ERROR: gl_transaction … is unbalanced: debit 100, credit 0
balanced insert accepted by trigger: true (rolled back probe)
probe rows left behind: 0
```

### Backfill

`apps/backend/src/ledger/backfill.rules.ts` (pure inference) +
`ledger-backfill.service.ts` (writer) + `scripts/ledger-backfill.ts` (CLI).

Inference order — most certain first, unknown last:

| Historical shape | Reconstructed as |
|---|---|
| `TOP_UP` (provider from metadata or top-up request) | credit wallet / debit `gateway:<provider>` |
| wallet-paid app charge (matched by `appcharge:<id>:wallet`) | debit wallet / credit `payable:app:<client>` net / credit `platform:wallet` fee |
| `SUBSCRIPTION`/`PURCHASE` on `mcom-central` | debit wallet / credit `platform:wallet` |
| partner app movement | wallet / `payable:app:<client>` |
| anything unattributable | **`equity:opening`**, `metadata.inferredCounterparty = true` |

Settlements are rebuilt as **one** 4-leg transfer; the two historical wallet rows are
excluded from the wallet pass so nothing is double counted. Gateway charges, their
succeeded refunds, and card `BillingTransaction`s are replayed from their own source
tables. Every write is keyed `backfill:<source>:<id>`.

Delegation and referral history keeps its real shape: platform-funded payout →
`debit platform:wallet`; business-funded → `debit business / credit affiliate /
credit platform (retention)`.

### Two real bugs the live run caught

1. A reward-funded charge has `netMinor = 0`. The planner emitted a zero-amount
   leg, which the posting layer correctly rejected. Fixed: zero legs are never
   planned, and a charge whose stored split does not reconcile falls back to a
   whole-`app_payable` credit and is flagged.
2. `GlEntry.walletTransactionId` is unique, but provenance was applied to every
   leg — so a wallet receipt claimed both sides. Fixed: the receipt id is attached
   only when the transfer has exactly one wallet leg (and only to that leg).

Both are covered by tests now; the dry run caught them before any data was written.

### Applied result

```
mode                  APPLIED
wallet transactions   120
settlements           2
app charges           33
app refunds           9
billing transactions  8
skipped               2
failed                0

accounts checked      57
assets                £44,147.98
liabilities           £17,833.44
equity                £26,314.54
identity holds        yes
account drift         0
wallet drift          0
wallets w/o account   0

HEALTHY: yes
```

A second `--apply` is a **perfect no-op** (all counters zero, report still healthy),
which is the acceptance criterion for Phase 2.

`--rebuild` recomputes every `balanceMinor` from entries without touching entries.

### Resulting balance sheet (local database)

```
ASSET   gateway:stripe:GBP          £44,147.98
LIAB    wallet:<48 users>            £4,097.13
LIAB    payable:app:fundordonate     £7,115.89
LIAB    payable:app:mcom-vcards      £6,573.03
LIAB    payable:app:mcom-mall          £450.01
LIAB    payable:app:mcom-group          £47.38
LIAB    payable:app:mcom-admin        −£250.00
LIAB    payable:app:task-engine       −£200.00
EQUITY  platform:wallet:GBP         £28,618.54
EQUITY  equity:opening:GBP          −£2,304.00
        ─────────────────────────────────────
        assets £44,147.98 = liabilities £17,833.44 + equity £26,314.54  ✓
```

Two things the backfill immediately surfaced that nobody could see before:

- **£13,736.31 is owed to partner apps.** The old model had one global
  `app_payable` account, so no per-app balance existed. Two of them are negative
  (`mcom-admin −£250`, `task-engine −£200`) — those apps owe *us*.
- **`equity:opening` is −£2,304.** More wallet value was credited without an
  identifiable funding source than debited. That is historical referral/reward
  money that used to be minted from nothing; it is now visible and flagged.

---

## Verification run

```
cd apps/backend
npx tsc --noEmit -p tsconfig.json      # only the pre-existing affiliate spec error
npx jest --runInBand                   # 97 suites, 1057 tests — all pass
npm run build                          # succeeds (exit 0)
npx prisma migrate deploy              # both migrations applied
npm run ledger:backfill -- --apply     # 0 failures, healthy, re-run is a no-op
```

---

## Phase 3 — Ledger becomes the writer ✅

Every live money path now posts through `GlPostingService` in the same database
transaction that moves the money.

| Path | Posting |
|---|---|
| `WalletService.debitWallet` | `debit wallet` / `credit payable:app:<partner>` (platform-internal → `platform:wallet`) |
| `WalletService.creditWallet` | mirror of the above |
| `WalletService.captureHold` | `debit wallet` / `credit payable` (or platform) |
| Wallet top-up confirm | `debit gateway:<provider>` / `credit wallet`, `TOP_UP` |
| Referral payout | `debit platform:wallet` / `credit referrer`, `REFERRAL_COMMISSION` |
| MCOM Pay card charge | `gateway → platform` (gross), then `platform → payable` (net) |
| MCOM Pay wallet charge | payer debit already credited the platform; settlement posts `platform → payable` |
| MCOM Pay refund (card) | `payable (net) + platform (fee) → gateway (gross)` |
| MCOM Pay refund (wallet) | payer credit already moved payable → wallet; the fee share is returned to the app |
| Membership / plan / access pass / verification fee | `PlatformSalesService.recordSale`: `gateway → platform:wallet` |

Design details worth knowing:

- `WalletLedgerOptions` (`intent`, `counterparty`, `skipLedger`) lets a flow
  state its business purpose without changing the wallet API for everyone else.
  Defaults are safe: partner movement → that app's payable; internal → platform.
- The ledger write is **inside** the wallet row lock/transaction, so a failed
  posting rolls the balance back. A receipt is only linked once its entry exists.
- `PlatformSalesService` ignores non-gateway providers (`wallet`, `manual`), so a
  wallet-funded purchase is never double counted — the wallet layer already
  posted it.
- Referral commission the platform wallet cannot cover stays **PENDING** with a
  reason instead of failing: no minting, no negative platform balance.
- A wallet receipt (`walletTransactionId`) is attached to exactly one entry — the
  wallet leg — so multi-leg transfers never claim both sides.

### Deviation from the plan (deliberate)

Delegation is **two transfers**, not one four-leg transfer:
`debit business → credit platform`, then `debit platform → credit affiliate`.
Both wallet operations stay atomic with their own posting, and the net result is
identical (business −charge, affiliate +payout, platform +retention). The pair is
linked by the settlement reference. Backfilled history uses the single four-leg
form, so the admin transfer view shows one row for old settlements and two for
new ones.

### Shadow comparison (live database)

```
paid charges          75
with journal entries  75
missing journal       0
app payable mismatch  3      (informational — see below)
wallet drift          0
identity holds        yes
HEALTHY: yes
```

`app payable mismatch` is reported but deliberately **not** part of `healthy`:
the payable account also receives partner wallet-API movements, so a charge-only
expectation cannot match by construction. Running the check still caught a real
gap — wallet-charge refunds debited the app's payable at **gross** instead of
net, leaving the refunded fee with the app. `backfillWalletRefundFees` now
returns that fee share (17 adjustments) and `mcom-vcards` went to a perfect
match. The remaining three are partner movements (`task-engine −£200`,
`mcom-admin −£250`, `mcom-mall` direct wallet activity).

### Modules

`LedgerModule` is imported by `WalletModule`, `AppPaymentsModule`,
`PaymentModule`, `PricingModule`, `AccessModule` and `RecurringModule`. The full
Nest DI graph was booted in a throwaway context to prove every dependency
resolves (`DI graph resolved: OK`).

---

## Verification run

```
cd apps/backend
npx tsc --noEmit -p tsconfig.json      # only the pre-existing affiliate spec error
npx jest --runInBand                   # 97 suites, 1061 tests — all pass
npm run build                          # succeeds (exit 0)
npm run ledger:backfill -- --apply     # idempotent; 17 refund-fee adjustments
npm run ledger:backfill -- --shadow    # 75/75 charges booked, 0 drift, healthy
```

---

## Phase 4 — Payee splits, payables and payouts ✅

A charge can now say **where its money goes**, which is the whole point of the
wallet-to-wallet model.

### Request

```jsonc
POST /api/v1/app-payments/charges
{
  "amountMinor": "9000",
  "method": "wallet",
  "intent": "ORDER",
  "reference": "order_12345",
  "mcomUserId": "buyer_1",
  "splits": [
    { "payeeType": "mcom_user", "payeeUserId": "seller_1", "amountMinor": "9000" }
  ]
}
```

- `Σ splits.amountMinor` must equal `amountMinor` — validated before any provider
  call, so a split that does not reconcile cannot take a payment.
- The fee is apportioned by weight with **largest remainder**, so the parts sum to
  exactly `feeMinor`. 10 unit tests cover the awkward cases (100 split 3 ways,
  £90 across 60/30, legacy empty splits).
- Omitting `splits` keeps the old behaviour: the net accrues to the app payable.

### Settlement

`settleCharge()` runs after the payment transaction commits:

| Payee | Posting |
|---|---|
| `mcom_user` | `debit platform:wallet` / `credit wallet:<seller>` (`debitWallet`-grade atomicity) |
| `external` | `debit platform:wallet` / `credit payable:payee:<app>:<ref>` |
| none (legacy) | `debit platform:wallet` / `credit payable:app:<client>` |

Each split is settled **independently**, so one frozen seller wallet cannot
block another payee's money — it lands in `status = failed` with a reason and the
charge shows `settlementState = FAILED`. A settlement failure never fails the
payment; the money is already taken.

Money-in and allocation are separate steps on purpose: the funding leg
(`gateway → platform`, key `appcharge:<id>:funding`) is inside the payment
transaction, while each payee credit is its own wallet operation with its own
idempotency key (`appcharge:<id>:split:<splitId>`).

### Payouts

`app_payouts` + `AppPayoutsService`:

- `POST /api/v1/admin/app-payments/payouts` — request (idempotent)
- `POST /api/v1/admin/app-payments/payouts/:id/approve` — pays: `debit payable:app` / `credit bank:GBP`
- `POST /api/v1/admin/app-payments/payouts/:id/reject`
- `GET  /api/v1/admin/app-payments/payouts` and `/payables`
- `GET  /api/v1/app-payments/balance` — the app's own payable balance
- `GET  /api/v1/app-payments/charges/:id/splits`

Two safeguards beyond the plan:

1. **`nonNegative` posting option.** The payable account is normally allowed to
   go negative (that means the app owes *us*), so the payout explicitly forces it
   non-negative. The check runs **inside** the locked transaction, so two
   concurrent approvals cannot overdraw.
2. **Claim-then-pay.** The payout row is claimed `pending → approved` with a
   compare-and-set before any money moves; a second approver loses. If the
   payable is short, the row is reverted to `pending` with
   `INSUFFICIENT_PAYABLE` and nothing moved.

### Verified

```
100 test suites, 1085 tests — all pass
build → exit 0
DI graph → resolved
migration 20261120130000_app_charge_splits_and_payouts applied
app_charges columns: intent, payee_type, payee_ref, transfer_id, settlement_state
tables: app_charge_splits, app_payouts
```

Legacy charges keep `settlementState = NA` (their money already accrued to
payables through the backfill); new charges start at `PENDING` and become
`SETTLED` once every payee is credited.

---

## Phase 5 — Retries, delegation trail and the admin read surface ✅

### Retry jobs

| Job | Where | Behaviour |
|---|---|---|
| Charge settlement | `AppPaymentsReconciliationService` (`EVERY_10_MINUTES`) | Re-drives `paid` charges in `PENDING`/`FAILED`, max 10 attempts, skipping anything touched in the last 2 minutes so it never races the request that created it |
| Referral payout | `ReferralCommissionService` (`EVERY_10_MINUTES`) | Re-pays `PENDING` commissions the platform could not fund, oldest first |

Both are safe to run concurrently on every instance:

- Charge settlement is idempotent per split (`appcharge:<id>:split:<splitId>`).
- Referral payout uses the fixed key `referral-payout:<commissionId>`, so a
  duplicate attempt returns the original receipt instead of paying twice.
- A commission still short of funds stays `PENDING` with a reason (never minted,
  never negative); a genuine failure becomes `FAILED`.

### Delegation reads as one trail

A delegation posts as two transfers (business → platform, platform → affiliate).
They share a `reference` (`affiliate-task:<taskId>:settle`), and
`GET /admin/mcom-pay/transfers/:id` returns the other legs as `siblings`, so the
admin sees one movement with both halves. No schema change was needed.

### Admin read surface

Read-only, `ADMIN` role required, no mutation routes:

```
GET /admin/mcom-pay/overview
GET /admin/mcom-pay/platform-wallet
GET /admin/mcom-pay/platform-wallet/transactions
GET /admin/mcom-pay/accounts
GET /admin/mcom-pay/accounts/:code/entries
GET /admin/mcom-pay/transfers
GET /admin/mcom-pay/transfers/:id
GET /admin/mcom-pay/reconciliation
GET /admin/mcom-pay/reconciliation/shadow
```

`overview` deliberately keeps four different numbers apart: platform wallet,
user float, owed to partners, and assets/liabilities/equity. Amounts cross the
wire as strings so a 64-bit pence value cannot lose precision.

### Verified against the live database

```
platform wallet        £28,609.38   (inflow 28,696.52 lifetime, outflow 87.14)
user float             £4,097.13
owed to partners       £13,745.47
assets                 £44,147.98 = liabilities £17,842.60 + equity £26,305.38
GMV (30d)              £43,201.91
transfers              189
charges awaiting      0
```

The balance-sheet identity holds to the penny.

```
101 test suites, 1097 tests — all pass
build → exit 0
DI graph → resolved
routes → all 15 new endpoints registered (586 total)
```

---

## Phase 6 — Analytics, admin console and user ledger ✅

### Analytics

- `LedgerAnalyticsService` rebuilds `gl_daily_rollups` daily (yesterday plus a
  7-day window) and refreshes today's partial bucket hourly.
- A rollup row holds the transfer's **value counted once** — the amount of its
  first step. Summing every step of a card sale would double count, because
  gateway → platform → seller moves the same money twice.
- Platform inflow/outflow cannot be derived from that value (a card sale passes
  *through* the platform wallet), so those come from the platform account's
  entries and are merged into the same bucket.

```
GET /admin/mcom-pay/analytics/trend?from&to&groupBy=day|week|month&platformId&intent
GET /admin/mcom-pay/analytics/by-platform?from&to
GET /admin/mcom-pay/analytics/by-intent?from&to
```

Live check against the database (30 days):

```
volume        £49,772.11
platform in   £28,696.52
platform out      £87.14
by intent     PURCHASE 56.1%, ORDER 30.0%, TOP_UP 6.0%, REFERRAL 4.6%, TRANSFER 2.0%
by platform   fundordonate £7,334 · mcom-vcards £6,774 · mcom-mall £1,543
```

Two bugs the tests caught before the UI:

1. Ranking by `"9000" < "40000"` sorted strings, so the smallest platform came
   first. Sorting now happens on the `bigint`.
2. `_count._all` counted rollup rows (days), not transfers. It now sums
   `txnCount`, so a platform with 5 transfers over 3 days reports 5.

### Admin console

`/admin/mcom-pay` is now a console with eight tabs — the previous charge ledger
is preserved unchanged as the **Charges** tab, and `McomPayPanel` was reduced to
`ChargeLedgerPanel` (header/guard moved to the console):

**Overview** · **Transfers** (with the debit/credit drawer and sibling legs) ·
**Platform wallet** · **Accounts** (chart of accounts → entries) ·
**Analytics** · **Charges** · **Wallet activity** · **Reconciliation**

No chart dependency was added: the volume chart is inline flex/SVG. The
transfers drawer shows exactly the pair the ledger exists for — e.g.
`−£90.00 wallet:buyer`, `+£87.19 wallet:seller`, `+£2.81 platform:wallet`.

### User ledger

`GET /wallet/transactions` now returns `intent` and a `counterparty`
(`{ type, displayName }`) for wallet-to-wallet movements, resolved from the
counterparty wallet's user/business profile — name and type only, never their
balance or history. `DashboardWallet` renders an intent badge and
"from/to Acme Retail" instead of an opaque platform id.

### Verified

```
backend  102 suites, 1102 tests — all pass
build    backend exit 0 · frontend built in 10.3s
routes   12 /admin/mcom-pay endpoints registered (589 total)
frontend 142/143 tests; the one failure is the pre-existing
         BusinessCategorySelectors test unrelated to this work
```

---

## Phase 6.1 — One entry per event, with names and full detail ✅

Feedback from a live MCOM Mall order: the ledger showed two rows (one debit, one credit),
different amounts, and only a UUID. Fixed.

**One row per money event.** An order posts as two journal transfers (funds in, then
allocation out), which read as two movements. The ledger now groups by `reference` and
*nets every account across the group*, so the platform's pass-through leg collapses and
what remains is the truth:

```
Debited   Test · Axel Atkinsoo   £34.99
Credited  mcom mall              £33.78
          Platform wallet         £1.21   (the fee)
```

The two amounts are gross and net — £1.21 is the fee, not a second charge.

**Names instead of UUIDs.** Accounts resolve to the party behind them: business + person
for users, the registered app name for payables, provider name for gateway clearing.

**Detail is exhaustive** (`GET /admin/mcom-pay/events/:key`): parties with account codes,
the linked charge (gross/fee/net/refunded/method/status/settlement), payee splits, wallet
receipts with before/after balances and the user's name and email, and every underlying
transfer, step, entry and idempotency key.

The database still stores balanced double-entry rows — that is what makes the books
provable — but the ledger *view* is one entry with a debit side and a credit side.

New endpoints:

```
GET /admin/mcom-pay/events        (filters: platform, intent, search, dates, paging)
GET /admin/mcom-pay/events/:key   (reference or transfer id)
```

Also fixed: a wallet charge's funding leg now carries the charge's `intent`, so both
halves of an order read the same. Historical rows keep their original intents.

### Verified

```
103 test suites, 1109 tests — all pass
backend build exit 0 · frontend built in 9.8s
event for the reported order:
  debits  Test · Axel Atkinsoo £34.99
  credits mcom mall £33.78 | Platform wallet £1.21
  charge  gross 3499 fee 121 net 3378 splits 0 state SETTLED
```

That `splits 0` is the remaining gap: Mall's charge had no payee, so £33.78 went to
Mall's payable rather than to the seller. Until Mall sends `splits`, no seller wallet is
credited — see Part G of the partner guide.

---

## Phase 6.2 — Payer identity, fee transparency, platform filter ✅

Three gaps a live £49.99 MCOM Mall order exposed.

### "Who was debited?"

For a card payment the debit is the **gateway**, not a person, and the only place the
payer can be recorded is the charge. The ledger now resolves it:

- **Wallet charges** → the wallet holder's name (always known; `mcomUserId` is required).
- **Card / PayPal charges** → `AppCharge.mcomUserId` — required on every new charge — then
  `metadata.userId`, then `externalCustomerId`, looked up against the user table.

Only a **Central Hub Solution** user is a payer the ledger can name, and new charges must
carry one: `POST /app-payments/charges` rejects a missing/unknown `mcomUserId` (400) before
any provider intent is created. Every `payeeUserId` on a split is validated the same way.
A platform's own customer id is not an identity; it is stored as `appCustomerRef` and shown
in the detail as "the app's own customer reference (not a CHS identity)" — never as the payer.

- CHS user supplied and found → `Ada Lovelace · paid by Stripe` (+ email in the detail).
- CHS user supplied but unknown → `MCOM user <id> · paid by Stripe`, flagged.
- No CHS user → only possible on **historical** charges created before the rule:
  `Unidentified buyer (legacy charge) · Stripe`.

### Payer matching at confirmation

Confirming a charge now re-asserts the payer and the intent:

- `POST /app-payments/charges/:id/confirm` requires `mcomUserId`; it must equal the charge's
  payer or the request is refused with **403**.
- Stripe: the intent's `metadata.mcomUserId`, `metadata.chargeId`, amount and currency must
  all match the charge — both on partner confirm and on the webhook/reconcile path.
- PayPal: the captured order's `custom_id` must be this charge, and amount/currency must match.
- The payer is part of the idempotency fingerprint, so replaying a key with a different
  `mcomUserId` is a **409**, not a charge attributed to someone else.

### Why the app was credited and how the fee is computed

- **£48.34 to Mall = £49.99 − £1.65.** That charge had **no `splits`**, so the net
  accrued to Mall's app payable (`payable:app:mcom-mall`) rather than a seller's wallet.
  Events without a payee now carry a **`no payee`** chip, and the drawer explains that
  the money will not reach a seller until the app sends `payeeUserId`.
- **£1.65 = 2.9% × £49.99 (£1.45) + £0.20 fixed**, rounded to the nearest penny.
- New charges **snapshot** the applied rate (`feePercentApplied`,
  `feeFixedMinorApplied`) so an old fee can always be explained. Historical charges
  recorded no rate; the drawer shows their fee against the app's **current** rate and
  labels it as such rather than pretending.

### Platform filter

`GET /admin/mcom-pay/platforms` returns every platform the ledger has seen plus every
Console-registered app; the Transfers tab uses a dropdown instead of a free-text box.

### Verified

```
103 test suites, 1109 tests — all pass
backend build exit 0 · frontend built in 13.7s
live order: debits [Customer 5fcbfbe7… · paid by Stripe £49.99]
            credits [E2E Test Store A · E2E BusinessA £48.34, Platform wallet £1.65]
            payer identified: false (Mall sent no mcomUserId)
            fee 165, snapshot null, current 0.029 / 20p (default)
```

---

## Phase 6.3 — One entry per payment, grouped by charge ✅

A row showed `Test · Axel Atkinsoo £36.20 → mcom mall £33.78 + Platform £2.42` for what
was really two payments. Root causes, both fixed in the data model:

1. **A partner reference is reusable.** Two different charges shared one `reference`
   (`mall-order-…-wallet-34.99`), so grouping by reference merged them.
2. **Wallet legs carried no charge id.** Only the payable leg recorded `appChargeId`,
   so a payment could not be identified from its wallet movements.

### What changed

- `WalletLedgerOptions.appChargeId` — every wallet leg of a charge (funding, payee
  credit, refund) now records the charge id on its ledger entry.
- Migration `20261121010000_backfill_charge_provenance` backfills existing entries from
  `wallet_transactions.metadata.chargeId`.
- Events are grouped by **charge** (`charge:<id>`, with `:refund` for reversals), falling
  back to the reference only for legacy, unlinked transfers.
- Migration `20261121020000_relabel_backfilled_refunds` fixes refunds the backfill had
  labelled `TRANSFER`, which had merged a refund into the sale it reversed.
- Charge lookup for `noPayee`/payer now resolves by **charge id**, not by the shared
  reference (the old lookup borrowed the newest charge's data for an older event).

### Presentation

Within one payment the **platform wallet is netted** (it is a pass-through), and every
other party is shown **gross on its own side** — a debit and a credit are never merged,
even when they involve the same wallet.

```
Debited   Test · Axel Atkinsoo   £34.99
Credited  <payee>                £33.78
          Platform wallet         £1.21
```

If the app names the buyer as the payee, the ledger shows that — because that is who the
app said to pay. If it names no payee, the credit is the app payable and the row carries
`no payee`.

### Verified

```
103 test suites, 1111 tests — all pass · builds green
old charge   debit Axel £34.99 → credit mcom mall £33.78 + Platform £1.21  (no payee)
new charge   debit Axel £34.99 → credit Axel £33.78 + Platform £1.21      (payee = buyer)
membership   sale and refund are now two separate entries
```

---

## Remaining

1. **Payout UI** — approve/reject payouts exists as API only
   (`POST /admin/app-payments/payouts/:id/approve`); it needs a Payables tab.
2. **Delegation single-row view** — the transfers drawer shows siblings, but the
   list still shows two rows for one delegation.
3. **`AppPaymentLedgerEntry` retirement** — the legacy table is still dual-written;
   drop it once nothing reads it (`ledger-shadow` has been clean).
4. **Partitioning** if `gl_entries` passes ~10M rows.
