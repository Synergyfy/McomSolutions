# MCOM Pay — concurrency, idempotency & reconciliation

Hardening pass over the partner-facing payment APIs (`/api/v1/app-payments/*`)
and the wallet that backs wallet charges. Everything here is about one promise:
**a retry, a webhook redelivery, or two concurrent requests can never move money
twice, and when we cannot be sure, the row says so instead of guessing.**

## Guarantees

| Path | Mechanism |
| --- | --- |
| Create charge | `(appClientId, idempotencyKey)` unique. Replay returns the original charge; same key + different payload → `409`. |
| Confirm / settle charge | Compare-and-set `pending → paid`. The loser gets the winner's row, posts no ledger rows and emits no webhook. |
| Refund | `AppRefund` row is the idempotency record, inserted before any provider call. Charge is claimed with `paid\|partially_refunded → refunding` guarded by a `refundedMinor` snapshot. |
| Refund at provider | Deterministic provider idempotency key derived from the refund id (`apprefund:<id>`, `PayPal-Request-Id`, wallet key). A re-drive can never refund twice. |
| Wallet debit/credit/hold | Redis lock (contention control) + `SELECT … FOR UPDATE` in the transaction (correctness) + relative `increment`/`decrement` writes. |
| Inbound webhooks | `processed_webhook_events` unique on `(provider, eventId)`. A duplicate delivery is acknowledged with `200` and not re-processed. A processing failure releases the claim so the provider retry is not lost. |
| Partner webhooks | Durable outbox row written before delivery; the reconciler retries anything still `PENDING`. |
| Lost updates | Every state transition is a `updateMany` with a status predicate and `count === 1` check — never read-modify-write of status or balance. |

## Failure policy

- Provider succeeded, local settlement failed → refund stays `pending`, outbox
  row `refund_provider:<refundId>`, `charge.reconciliationNeeded = true`, and the
  API returns `200` with the pending refund (never `500`, which would invite a
  duplicate retry).
- Provider rejected → refund `failed`, charge restored to `paid` /
  `partially_refunded`, provider idempotency key stays burned.
- External refunds created in the Stripe/PayPal dashboard are recorded from
  `charge.refunded` / `PAYMENT.CAPTURE.REFUNDED` so the ledger matches the
  gateway.

## Operational notes

- Two cron jobs, both safe to run on every instance (Redis lock + row claims):
  - every minute — drain `app_payment_outbox` (8 attempts, exponential backoff,
    then `FAILED`).
  - every 10 minutes — re-check charges with `reconciliationNeeded = true`
    against the provider (max 20 attempts, then it logs an error for a human).
- Disable both with `APP_PAYMENTS_RECONCILE_ENABLED=false`.

Queries worth alerting on:

```sql
-- money moved at the provider but the books did not follow
SELECT id, status, provider, provider_ref, failure_reason
FROM app_charges WHERE reconciliation_needed = true;

-- side effects that exhausted their retries
SELECT id, kind, event, attempts, last_error
FROM app_payment_outbox WHERE status = 'FAILED';

-- refunds parked mid-flight
SELECT id, charge_id, status, failure_reason FROM app_refunds WHERE status = 'pending';
```

## Breaking changes

1. `POST /app-payments/charges/:id/refund` now **requires** `X-Idempotency-Key`
   (missing → `400`).
2. Charge idempotency keys are scoped **per app**. A key that collided across
   apps previously returned `409`; it now succeeds as an independent charge.
3. `payment.refunded` still carries `amountMinor` = refunded amount, and adds
   `chargeAmountMinor`, `refundId`, `refundAmountMinor`, `totalRefundedMinor`.

## Deploying

```bash
npx prisma migrate deploy   # never `migrate dev` — it demands a full reset here
```

The migration (`20261028000000_app_payments_concurrency_hardening`) and the
Prisma client that ships with it must be released together: the idempotency
unique index changed shape, so an old client will query for a unique field that
no longer exists.

> Note: on this repository `prisma migrate dev` reports that
> `20261021000000_add_coupons` was modified after it was applied. Do **not**
> accept the offered reset on a database with data — write the migration by hand
> and apply it with `migrate deploy`.

## Testing

- `apps/backend: npm test`
- Unit coverage for these paths lives in `app-payments.service.spec.ts`,
  `app-payments-reconciliation.service.spec.ts`, `wallet.service.spec.ts` and
  `wallet/utils/wallet-lock.util.spec.ts`.
- Wallet end-to-end behaviour: `test/wallet.e2e-spec.ts`.
