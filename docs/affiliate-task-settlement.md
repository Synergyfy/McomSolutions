# Affiliate task escrow & settlement

Delegated affiliate tasks are paid from a **business wallet hold**, not from a
post-hoc transfer. Central Hub is the single source of truth for balances;
247GBS Affiliates only displays the affiliate's MCOM wallet.

## Money flow

1. **Assign + price** (`POST /admin/affiliate-tasks/:id/assign`)
   - `compensationAmount` = what the affiliate is paid (GBP).
   - `businessChargeAmount` = what the business is charged (GBP).
   - `platformFeePercent` = optional per-task fee (defaults to
     `AFFILIATE_TASK_FEE_PERCENT`, or the `affiliate_task_fee_percent`
     `ProgrammeSetting`).
   - Central converts both amounts to MCOM at the current GBP→MCOM FX rate and
     stores the rate on the settlement.

2. **Escrow**
   - Trial / Access Pass business: the business charge is **held** on the
     business MCOM wallet (`WalletHold`, reference
     `affiliate-task:<taskId>:hold`). If the wallet cannot cover it, assignment
     is blocked with `422 TASK_ESCROW_FAILED`.
   - Active paid membership: the business wallet is **never** touched. The
     platform funds the affiliate payout (`fundingSource = PLATFORM`).

3. **Approval** (AM → business/admin review chain)
   - The hold is captured (business debit, `HOLD_CAPTURE`).
   - The affiliate payout is credited to the affiliate's central MCOM wallet
     (`TRANSFER_IN`).
   - The explicit fee and the charge-minus-payout margin are recorded on the
     settlement; platform retention is booked as `RevenueRecord`.
   - Platform-funded payouts book a negative `RevenueRecord` (the platform
     absorbs the cost).

4. **Release**
   - Cancellations, charge declines, and overdue tasks release the hold back to
     the business wallet. Nothing is captured until approval.

## Accounting identity

For every business-funded settlement:

```
businessChargeCredits = affiliatePayoutCredits
                      + platformFeeCredits
                      + platformMarginCredits
```

Every leg carries an idempotency key:

- business debit: `affiliate-task:<taskId>:settle:business:debit`
- affiliate credit: `affiliate-task:<taskId>:settle:affiliate:credit`

A retry can never pay the same task twice.

## Free delegated-task allowance

Membership plans and access passes define:

- `freeDelegatedTasks` — how many delegated tasks are included before charging
- `unlimitedFreeDelegatedTasks` — when true, the business is never charged for
  delegated tasks under that plan

The allowance is evaluated **when a task is assigned**:

- within the allowance → platform-funded payout, no business wallet hold
- beyond the allowance → the task is chargeable; the admin must set a business
  charge, and the normal escrow flow runs
- no active plan (trial / bare account) → every task is chargeable

Usage counts non-cancelled **assigned** tasks created inside the current
entitlement period (membership period from `ecosystem_subscriptions`, or the
active `access_purchases` term). Reassigning a declined task never consumes a
second slot; cancelling a task frees its slot again. The task stores a snapshot
(`freeDelegation`, `delegationQuota*`) so a later plan change cannot rewrite
history.

## Admin surfaces

- `GET  /api/v1/admin/affiliate-settlements`
- `GET  /api/v1/admin/affiliate-settlements/summary`
- `GET  /api/v1/admin/affiliate-tasks/:id/settlement`
- `POST /api/v1/admin/affiliate-settlements/:taskId/retry`
- `POST /api/v1/admin/affiliate-settlements/:taskId/release`

UI: **Admin → Affiliate Task Delegation → Settlement ledger**.

Business and affiliate wallet ledgers still show the matching
`WalletTransaction` rows under the `mcom-central` platform.

## 247GBS integration

- `GET /api/v1/wallet/mcom` (247GBS, JWT) proxies the affiliate's central MCOM
  wallet via `GET /api/v1/affiliate/wallets/:userId` on Central, authenticated
  with the shared internal API key.
- The earnings screens and dashboard balance read this endpoint.

## Failure handling

- `FAILED` / `SETTLING` settlements are retried every 10 minutes.
- A hold that expires before approval is flagged and the task moves to
  `paymentStatus = ON_HOLD`; re-assign (or re-price) to reserve funds again.
- Admins can retry or release any non-settled settlement from the ledger.

## Deployment

1. Apply the migration in Central:
   `npx prisma migrate deploy` (or `migrate dev` locally).
2. Set `AFFILIATE_TASK_FEE_PERCENT` (default `10`) or the programme setting.
3. Ensure Central `AFFILIATE_INTERNAL_API_KEY` matches the 247GBS
   `INTERNAL_API_KEY` (already used for the task callbacks).
