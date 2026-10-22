# Recurring billing (auto-renew)

Opt-in auto-renew for MCOM membership plans and platform packages. Nothing is
charged unless the user explicitly enables auto-renew at checkout or from the
dashboard.

## How it works

| Provider | Who charges at renewal | Local role |
|---|---|---|
| Stripe | Stripe Subscriptions | Reconcile + extend entitlement from webhooks |
| PayPal | PayPal Subscriptions API | Reconcile + extend entitlement from webhooks |
| MCOM Wallet | `RenewalSchedulerService` | Debit wallet, extend entitlement, retry on failure |

Every mandate is mirrored in `recurring_subscriptions`; every cycle is recorded
in `recurring_charges`. Entitlement extension is idempotent on
`BillingTransaction.providerPaymentId` and `(subscription_id, period_start)`.

## Opting in

- Membership checkout: send `autoRenew: true` to
  `POST /payment/stripe/initiate` or `POST /payment/paypal/initiate`.
- Platform checkout: same flag on `POST /payment/platform/{stripe|paypal}/initiate`.
- Wallet (existing plan): `POST /recurring/wallet` with
  `{ "scope": "MEMBERSHIP" | "PLATFORM", "billingCycle": "monthly", "platform": "..." }`.
  The renewal amount is resolved server-side from the current plan/pricing — it
  is never taken from the request body.

Auto-renew is limited to **full-term** plans in v1. Coupons and instalment
plans cannot be combined with auto-renew.

## User / admin APIs

```
GET    /recurring                       my mandates + recent charges
GET    /recurring/:id
POST   /recurring/wallet                enable wallet auto-debit
POST   /recurring/:id/cancel            at period end (default) or immediate
POST   /recurring/:id/resume
PATCH  /recurring/:id/auto-renew        { enabled: boolean }

GET    /admin/recurring                 filter by status/provider
GET    /admin/recurring/metrics         active/past_due/MRR
POST   /admin/recurring/:id/retry
POST   /admin/recurring/:id/cancel
```

## Webhooks

Add these to the existing Stripe endpoint (`POST /payment/stripe/webhook`):

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

PayPal uses `POST /payment/paypal/webhook`. Set `PAYPAL_WEBHOOK_ID` and
subscribe to:

- `BILLING.SUBSCRIPTION.ACTIVATED`
- `PAYMENT.SALE.COMPLETED`
- `PAYMENT.SALE.DENIED`
- `BILLING.SUBSCRIPTION.CANCELLED`
- `BILLING.SUBSCRIPTION.EXPIRED`
- `BILLING.SUBSCRIPTION.SUSPENDED`

## Crons

| Schedule | Job |
|---|---|
| every 15 min | Wallet debits + provider reconciliation for due mandates |
| hourly | Expire mandates past `currentPeriodEnd + graceDays` |
| daily 02:00 | Full provider/local reconciliation |

Disable with `RENEWAL_CRON_ENABLED=false`. Master switch:
`RECURRING_PAYMENTS_ENABLED`.

## Migration

1. Apply `prisma/migrations/20261023000000_add_recurring_billing`.
2. Optionally run `npx ts-node scripts/backfill-recurring.ts` to create
   non-charging mirrors for existing subscriptions (`autoRenew = false`).
3. Populate `stripePriceId` / `paypalPlanId` on membership payment options (or
   let the service create ad-hoc prices/plans on first checkout).

## Failure handling

- Wallet debit fails → `PAST_DUE`, notification, retry after 24h.
- Provider reports `past_due` → `PAST_DUE`, user keeps access until
  `currentPeriodEnd` (grace is enforced by the expiry job).
- After `currentPeriodEnd + graceDays` with no successful renewal → `EXPIRED`,
  membership downgraded to `inactive`, `package.expired` dispatched for
  platform packages.
