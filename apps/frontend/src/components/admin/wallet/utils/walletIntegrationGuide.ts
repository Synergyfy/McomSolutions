/**
 * Written MCOM Payments partner-integration guide (human-authored, not AI).
 * Covers both MCOM Wallet (prepaid balance) and MCOM Pay (charge customers).
 * Rendered in the admin Wallet panel and copied to the clipboard verbatim.
 */

const baseUrl = (import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com').replace(/\/$/, '');

export function generateWalletIntegrationGuide(): string {
  return `# MCOM Payments — Partner Integration Guide

### Wallet (prepaid balance) + MCOM Pay (charge customers) + Recurring billing

Integrate MCOM into your registered MCOM application (MCOM Mall, MCOM Rewards, MCOM Spin, VemTap, 247GBS, or any Console-registered app). MCOM exposes **two complementary payment capabilities**, both authenticated with the same app credentials and the same HMAC scheme:

| Capability | What it is | Use it when |
|---|---|---|
| **MCOM Wallet** | One central prepaid balance (GBP) per user, spendable across every MCOM platform. | The user already has a balance and you want to move credits (debit/credit/hold). |
| **Payee splits** | Part of MCOM Pay: state *who receives the money*. One call debits the buyer and credits the seller's wallet (or parks it on a payee payable). | A customer buys a product or books a service **from another user or business**. |
| **MCOM Pay** | A generic payment gateway — you charge the customer an arbitrary amount and MCOM processes it via **Stripe**, **PayPal**, or the **MCOM Wallet**, then records it in an immutable ledger. | You sell something on your app and want MCOM to collect the money. |

- Base URL: \`${baseUrl}\`
- API prefixes: \`/api/v1/wallet/partner\` and \`/api/v1/app-payments\`
- Shared auth: HMAC via \`X-Mcom-Client-ID\` + \`X-Mcom-Signature\` (same \`hmacSecret\` for both)
- Wallet currency: **GBP** (displayed 2 dp, stored 4 dp)
- MCOM Pay money: **minor units** (pence) stored as exact integers — never floats
- Recurring: MCOM auto-renews **MCOM's own memberships/platform plans**. Partner apps remain responsible for their own renewal charges — see **Part C**.

---

# Part 0 — Which capability do I need?

| Scenario | Use | Endpoint family |
|---|---|---|
| User has an MCOM wallet balance and you charge them from it | **MCOM Pay (method = \`wallet\`)** *or* Wallet \`/debit\` | \`/app-payments/charges\` or \`/wallet/partner/debit\` |
| A customer buys from **another user/business** (marketplace, booking, service) | **MCOM Pay with \`splits\`** | \`/app-payments/charges\` (see **Part G**) |
| You sell something yourself and keep the money | **MCOM Pay** (no splits) | \`/app-payments/charges\` |
| You want your accumulated balance paid to your bank | **Payout** (approved by MCOM) | \`/app-payments/balance\` + admin payout |
| Customer pays by card / PayPal for anything you sell | **MCOM Pay** | \`/app-payments/charges\` |
| You reward, refund, or cashback credits into a user's wallet | **MCOM Wallet** | \`/wallet/partner/credit\` |
| Reserve funds before confirming an order (pre-auth) | **MCOM Wallet** | \`/wallet/partner/hold/*\` |
| Charge the same user every month/year (your subscription) | **Your scheduler + MCOM Wallet or MCOM Pay** | \`/wallet/partner/debit\` or \`/app-payments/charges\` |
| Auto-renew an MCOM membership/platform plan | **MCOM handles it** | Not a partner API — see Part C |
| You want an immutable, auditable money ledger in pence with MCOM fees/net | **MCOM Pay** | \`/app-payments/*\` |

> Rule of thumb: **MCOM Wallet moves existing GBP balances. MCOM Pay collects real money (or spends the wallet) and keeps the books.** MCOM's recurring engine renews **MCOM-owned plans**; it does **not** store mandates for partner subscriptions.

---

# Part A — MCOM Wallet (prepaid balance)

## A1. How It Works

1. A user registers on McomSolutions → a wallet is **auto-created** (balance 0).
2. The user tops up via MCOM Wallet (Stripe) → wallet credited.
3. Your app backend calls the partner API (HMAC-signed) to **debit**, **credit**, or **hold** funds.
4. McomSolutions atomically writes a ledger entry + updates the balance, under a distributed lock.
5. Retries are safe: same idempotency key → same result, never a double charge.

McomSolutions is the **single source of truth** for balances. Your app never stores wallet balances.

## A2. Prerequisites & Credentials

1. Your app must be **registered in the MCOM Console** (Admin → MCOM Console). This gives you:
   - \`clientId\` (e.g. \`mcom-mall\`) — public identifier
   - \`hmacSecret\` (prefixed \`hm_\`) — shown **once** at registration; rotate it anytime from the Console (Admin → MCOM Console → your app → Rotate HMAC Secret)
2. If your app was seeded before per-app secrets existed, the backend falls back to \`MCOM_<CLIENT_ID>_SECRET\` or the shared \`SSO_API_SECRET\`. For production, issue a **per-app HMAC secret** via the Console so each platform uses its own.

## A3. Environment Variables

\`\`\`env
# MCOM Solutions central API
MCOM_SOLUTIONS_URL="${baseUrl}"

# Your app identity (from MCOM Console)
MCOM_CLIENT_ID=<YOUR_CLIENT_ID>        # e.g. mcom-mall
MCOM_HMAC_SECRET=<YOUR_HMAC_SECRET>    # shown once in the Console

# Feature flags
MCOM_WALLET_ENABLED=true
MCOM_PAY_ENABLED=true
\`\`\`

## A4. Authentication (HMAC)

Every request requires these headers:

| Header | Value |
|---|---|
| \`X-Mcom-Client-ID\` | your \`clientId\` |
| \`X-Mcom-Signature\` | \`sha256=<hex>\` — HMAC-SHA256 of the raw request body with your \`hmacSecret\` |
| \`X-Idempotency-Key\` | unique-per-business-event string (**required on every write**) |
| \`Content-Type\` | \`application/json\` |

**Signing rules:**
- **POST/PATCH**: sign the exact JSON body you send: \`HMAC-SHA256(JSON.stringify(body), hmacSecret)\`
- **GET**: there is no body — sign the **empty string** \`""\`

JavaScript/TypeScript:

\`\`\`ts
import * as crypto from 'crypto';

function sign(body: unknown, hmacSecret: string): string {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  return 'sha256=' + crypto.createHmac('sha256', hmacSecret).update(raw).digest('hex');
}

// POST — sign the body
const headers = {
  'Content-Type': 'application/json',
  'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
  'X-Mcom-Signature': sign(payload, process.env.MCOM_HMAC_SECRET),
  'X-Idempotency-Key': 'mcom-mall-purchase-ORDER_123',
};

// GET — sign the empty string
const getHeaders = {
  'X-Mcom-Client-ID': process.env.MCOM_CLIENT_ID,
  'X-Mcom-Signature': sign('', process.env.MCOM_HMAC_SECRET),
};
\`\`\`

## A5. Wallet Endpoints

All under \`${baseUrl}/api/v1/wallet/partner\`. HMAC + \`X-Mcom-Client-ID\` required on all.

| Method | Path | Purpose | Idempotency-Key |
|---|---|---|---|
| POST | \`/debit\` | Debit a wallet (subscription renewal, purchase, fee) | **Required** |
| POST | \`/credit\` | Credit a wallet (reward, refund, cashback) | **Required** |
| POST | \`/hold/place\` | Reserve funds before confirming | Optional |
| POST | \`/hold/capture\` | Convert a hold into a real debit | Optional |
| POST | \`/hold/release\` | Release a hold back to balance | — |
| GET | \`/balance/:userId\` | Check a user's balance (cached 30s) | — |
| GET | \`/transactions/:userId\` | Transactions **your platform** originated for this user | — |
| GET | \`/transaction/:id\` | Look up one of your transactions (by \`id\` or \`?by=idempotencyKey\`) | — |

### A5.1 Debit a wallet

\`\`\`http
POST ${baseUrl}/api/v1/wallet/partner/debit
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<...>
X-Idempotency-Key: mcom-mall-sub-inv_0042_aug2026
Content-Type: application/json

{
  "userId": "user_abc123",
  "amount": 50,
  "category": "SUBSCRIPTION",
  "description": "MCOM Mall Gold Package - August 2026",
  "reference": "sub_inv_0042",
  "metadata": { "packageId": "gold-monthly" }
}
\`\`\`

**Categories:** \`SUBSCRIPTION\`, \`PURCHASE\`, \`SERVICE_FEE\` (debits); \`REWARD\`, \`REFUND\`, \`ADMIN_CREDIT\`, \`TRANSFER_IN\` (credits).

> **Subscriptions:** MCOM does not auto-debit partner subscriptions. Your backend schedules each renewal and calls \`/debit\` with a **new idempotency key per billing period**. See **Part C — Recurring Billing**.

Success (201):

\`\`\`json
{
  "success": true,
  "transactionId": "clx8p2qr10000x4vj3k5m7n9p",
  "type": "DEBIT",
  "amount": 50,
  "balanceBefore": 150,
  "balanceAfter": 100,
  "currency": "GBP",
  "reference": "sub_inv_0042",
  "idempotencyKey": "mcom-mall-sub-inv_0042_aug2026",
  "processedAt": "2026-08-26T11:15:00.000Z"
}
\`\`\`

### A5.2 Check balance

\`\`\`http
GET ${baseUrl}/api/v1/wallet/partner/balance/user_abc123
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<sign empty string>
\`\`\`

\`\`\`json
{
  "success": true,
  "balance": 100,
  "availableBalance": 50,
  "status": "ACTIVE",
  "currency": "GBP"
}
\`\`\`

\`availableBalance\` = balance minus active holds. Check it before charging.

### A5.3 Holds (pre-authorization)

1. \`POST /hold/place\` → reserves funds, returns \`holdId\` + \`expiresAt\`.
2. \`POST /hold/capture\` → converts the hold into a real debit (\`HOLD_CAPTURE\`).
3. \`POST /hold/release\` → releases funds back to available balance.
4. Uncaptured holds auto-expire after \`WALLET_HOLD_DEFAULT_TTL_HOURS\` (default 24h) — the system releases them; you don't need to.

## A6. Wallet Error Codes & Handling

| HTTP | error | Meaning | What to do |
|---|---|---|---|
| 400 | \`VALIDATION_ERROR\` | Bad request body | Fix request — don't retry |
| 400 | (idempotency missing) | \`X-Idempotency-Key\` absent on a write | Add the header |
| 401 | \`INVALID_SIGNATURE\` | Bad HMAC / unknown client | Check \`hmacSecret\`; rotate in Console |
| 403 | \`WALLET_FROZEN\` | Wallet frozen (fraud) | Notify user to contact support |
| 403 | \`WALLET_SUSPENDED\` | Wallet temporarily suspended | Same |
| 403 | \`WALLET_CLOSED\` | Wallet closed | Same |
| 404 | \`WALLET_NOT_FOUND\` | No wallet for user | Contact MCOM |
| 409 | \`WALLET_LOCKED\` | Concurrent op in progress | **Retry after 1–2s (same key)** |
| 409 | idempotency collision | Key belongs to another platform | Use a platform-scoped key |
| 422 | \`INSUFFICIENT_BALANCE\` | Not enough available balance | Show top-up prompt |
| 422 | \`DAILY_LIMIT_EXCEEDED\` / \`MONTHLY_LIMIT_EXCEEDED\` | User limit hit | Notify user |
| 422 | \`AMOUNT_LIMIT_EXCEEDED\` | Above \`WALLET_MAX_SINGLE_TXN\` | Split or reject |
| 429 | \`RATE_LIMITED\` | Too many requests | Exponential backoff |
| 500 | \`INTERNAL_ERROR\` | Server error | Retry with backoff |
| 503 | \`SERVICE_UNAVAILABLE\` | DB/Redis down | Retry with backoff |

---

# Part B — MCOM Pay (charge customers through MCOM)

## B1. How It Works

MCOM Pay turns any Console-registered app into a merchant. Your **backend** (never the browser) creates a charge with an exact amount; MCOM collects it and keeps an immutable ledger.

1. Your app backend calls \`POST /app-payments/charges\` (HMAC-signed) with the amount in **minor units** and the payment method.
2. MCOM creates the charge and returns a provider handle:
   - \`stripe\` → \`clientSecret\` for Stripe Elements / Payment Element
   - \`paypal\` → \`approvalUrl\` to redirect the customer
   - \`wallet\` → settles immediately by debiting the payer's MCOM wallet
3. Your frontend completes the payment, then your backend calls \`POST /app-payments/charges/:id/confirm\`.
4. On success MCOM marks the charge **paid**, posts a **double-entry ledger** entry, and fires a \`payment.succeeded\` webhook to your app.
5. Refunds post the exact reverse ledger entries.

**Trust model:** the amount always comes from your authenticated backend — the customer's browser can never set or alter it.

> **Recurring:** MCOM Pay charges are **one-time**. For a subscription, your backend creates a **new charge each billing period** with a new idempotency key. MCOM does not store a partner card/PayPal mandate. See **Part C — Recurring Billing**.

## B1.1 Sandbox vs Production & Client-Side Handling (Critical)

> ⚠️ **CRITICAL: DO NOT build custom dummy card forms or mock PayPal login dialogs!**
> "Sandbox" does **NOT** mean partner platforms should write simulated HTML forms with fake card inputs or \`setTimeout()\` mock timers.

### What "Sandbox" Means in MCOM Pay:
- **Official Gateway Test Environments:** In development and staging, Central Hub connects directly to the **real Stripe Test Mode API** (\`sk_test_...\`) and **real PayPal Sandbox API** (\`https://api-m.sandbox.paypal.com\`).
- **Authentic Test Credentials:** MCOM returns genuine, cryptographically valid Stripe \`clientSecret\` (PaymentIntent) and genuine PayPal Sandbox \`approvalUrl\` (Orders API).

### How Partner Clients MUST Handle Each Method:

#### 1. Stripe (\`method: "stripe"\`)
- **Backend:** Calls \`POST /app-payments/charges\` with \`method: "stripe"\`. Receives \`{ charge, clientSecret }\`. Sends \`clientSecret\` to frontend.
- **Frontend:** Mounts the official **Stripe Elements** SDK (\`@stripe/react-stripe-js\` and \`@stripe/stripe-js\`).
  \`\`\`tsx
  import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
  import { loadStripe } from '@stripe/stripe-js';

  const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

  export function StripeCheckout({ clientSecret, onDone }) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <StripeForm onDone={onDone} />
      </Elements>
    );
  }

  function StripeForm({ onDone }) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setSubmitting(true);
      const { paymentIntent, error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        alert(error.message);
        setSubmitting(false);
      } else {
        onDone(paymentIntent.id);
      }
    };

    return (
      <form onSubmit={handleSubmit}>
        <PaymentElement />
        <button disabled={submitting || !stripe}>Pay Now</button>
      </form>
    );
  }
  \`\`\`
  - In Sandbox mode, Stripe's official PCI-compliant iframe accepts standard test cards (e.g. \`4242 4242 4242 4242\`, any future expiry date, any 3-digit CVC).
- **Confirm:** On payment success, frontend notifies your backend, which calls \`POST /app-payments/charges/:id/confirm\` with \`{ "paymentIntentId": paymentIntent.id }\`.

#### 2. PayPal (\`method: "paypal"\`)
- **Backend:** Calls \`POST /app-payments/charges\` with \`method: "paypal"\`. Receives \`{ charge, approvalUrl }\`.
- **Frontend:** Redirect the customer directly to the official PayPal sandbox portal:
  \`\`\`ts
  // Redirect directly to PayPal Sandbox checkout
  window.location.href = approvalUrl;
  \`\`\`
  *(Or mount the official \`@paypal/react-paypal-js\` Button component using the order token).*
  - The customer logs in using their PayPal Sandbox buyer test account on the real PayPal domain.
- **Confirm:** When PayPal redirects back to your \`returnUrl\` with \`?token=...\`, your backend calls \`POST /app-payments/charges/:id/confirm\` with \`{ "orderId": token }\`.

#### 3. MCOM Wallet (\`method: "wallet"\`)
- **No Third-Party Gateway:** Handled entirely within the MCOM ecosystem.
- **Frontend:** Displays the user's available MCOM Credit balance (\`1 MCOM = £1.00 GBP\`).
- **Backend:** Calls \`POST /app-payments/charges\` with \`method: "wallet"\` and \`mcomUserId\`.
- **Insufficient Funds (422):** If balance is lower than \`amountMinor\`, MCOM returns \`422 INSUFFICIENT_BALANCE\`. Display a top-up button linking the user to Central Hub's wallet top-up page (\`${baseUrl}/dashboard/wallet\`).


## B2. Amounts — Minor Units (Pence)

- Send \`amountMinor\` as a **positive integer string** in the smallest currency unit.
- \`"10270"\` = **£102.70** (\`"1"\` = £0.01). No decimals, no floats.
- Every amount in responses and the ledger is also a minor-unit string (\`amountMinor\`, \`feeMinor\`, \`netMinor\`).
- Format for display: \`(Number(minor) / 100).toFixed(2)\`.

## B3. Fees, Net, and the Ledger

- Each app has a **fee config** (set in the Console; platform default **2.9% + 20p**):
  - \`feePercent\` (e.g. \`0.029\` = 2.9%)
  - \`feeFixedMinor\` (e.g. \`20\` = £0.20)
- \`feeMinor = round(amountMinor × feePercent) + feeFixedMinor\`, clamped to \`[0, amountMinor]\`.
- \`netMinor = amountMinor − feeMinor\` — what MCOM records as owed to your app.
- Every paid charge posts **balanced, append-only** journal entries. MCOM's ledger uses named accounts
  (your app payable, the platform wallet, gateway clearing, each user's wallet) rather than one global
  revenue account:
  \`\`\`
  Card:    debit  gateway:<provider>   amountMinor    (money in)
           credit platform:wallet      amountMinor

  Then the money is allocated to whoever it belongs to:
           debit  platform:wallet      netMinor
           credit <payee account>      netMinor        (app payable, or the seller's wallet with splits)

  Wallet:  the payer's wallet debit already funded the platform, so only the allocation posts.
  \`\`\`
  The fee is simply what stays in the platform wallet. A refund posts the exact reverse. Entries are
  **never edited or deleted** — corrections are reversing transfers.

- **Who pays the fee is a commercial decision.** By default the fee is taken from the gross, so a
  payee receives \`netMinor\`. If your sellers must receive the full amount, set your app's
  \`feePercent\`/\`feeFixedMinor\` to \`0\` in the Console (and be billed separately), or ask MCOM for a
  fee-bearer option. See **G7**.

## B4. MCOM Pay Endpoints

All under \`${baseUrl}/api/v1/app-payments\`. HMAC + \`X-Mcom-Client-ID\` required on all; app identity always comes from the header.

| Method | Path | Purpose | Idempotency-Key |
|---|---|---|---|
| POST | \`/charges\` | Create a charge (\`stripe\` \\| \`paypal\` \\| \`wallet\`) | **Required** |
| POST | \`/charges/:id/confirm\` | Confirm after the customer pays | — (idempotent by status) |
| POST | \`/charges/:id/refund\` | Refund a paid charge (full or partial) | — |
| GET | \`/charges\` | List charges this app created | — |
| GET | \`/charges/:id\` | Fetch a single charge | — |
| GET | \`/charges/:id/splits\` | Payee splits and their settlement status | — |
| GET | \`/balance\` | Your payable balance and pending payouts | — |

### B4.1 Create a charge

\`\`\`http
POST ${baseUrl}/api/v1/app-payments/charges
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<...>
X-Idempotency-Key: mcom-mall-order-ORDER_123
Content-Type: application/json

{
  "amountMinor": "10270",          // £102.70 — required, integer string, minor units
  "currency": "GBP",               // optional, default GBP
  "method": "stripe",              // "stripe" | "paypal" | "wallet"
  "reference": "ORDER_123",        // your order/invoice id — required
  "description": "Pro plan renewal",
  "mcomUserId": "user_abc123",     // required only for method = "wallet"
  "externalCustomerId": "cust_987",// your own customer id (optional)
  "metadata": { "cartId": "c_1" }
}
\`\`\`

Response (201):

\`\`\`json
{
  "charge": {
    "id": "clx8p2qr10000x4vj3k5m7n9p",
    "appClientId": "mcom-mall",
    "amountMinor": "10270",
    "currency": "GBP",
    "feeMinor": "318",
    "netMinor": "9952",
    "method": "stripe",
    "status": "pending",
    "reference": "ORDER_123",
    "provider": "stripe",
    "providerRef": "pi_3Pabc...",
    "createdAt": "2026-10-11T10:00:00.000Z"
  },
  "clientSecret": "pi_3Pabc..._secret_xyz"   // stripe only
  // paypal returns: "approvalUrl": "https://www.paypal.com/checkoutnow?token=5O1..."
}
\`\`\`

**Method-specific notes:**
- \`stripe\` → use \`clientSecret\` with Stripe.js. \`paypal\` → redirect the customer to \`approvalUrl\`.
- \`wallet\` → no \`clientSecret\`/\`approvalUrl\`; the charge settles immediately (status \`paid\`) by debiting the payer's MCOM wallet. If the wallet has insufficient funds you get **422 \`INSUFFICIENT_BALANCE\`**.

### B4.1a Who paid? (\`mcomUserId\`) — Central Hub Solution identity

- \`mcomUserId\` is the **Central Hub Solution** user id (the one issued by SSO). It is the
  only payer identity the ledger can name.
- \`method: "wallet"\` — **required**: the wallet belongs to a CHS user.
- Card / PayPal — **optional**. A buyer can pay on your platform without ever registering on
  Central Hub. If you omit it, the ledger records a **guest buyer** and says so; it does not
  invent an identity.
- \`externalCustomerId\` is **your own** customer reference. It is stored for support, is never
  treated as a CHS identity, and is never displayed as the payer.
- If you have a CHS user id for the buyer (you get it from the SSO callback), always send it.
  Without it, nobody — including support — can tie a card payment to a person.

### B4.2 Confirm a charge

After the customer completes payment, confirm server-side:

\`\`\`http
POST ${baseUrl}/api/v1/app-payments/charges/clx8p2qr.../confirm
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<...>
Content-Type: application/json

{ "paymentIntentId": "pi_3Pabc..." }   // stripe — or { "orderId": "5O1..." } for paypal
\`\`\`

Returns the charge with \`status: "paid"\`. Confirm is **idempotent** — confirming an already-paid charge returns it unchanged. MCOM also settles charges from provider webhooks as a backstop (close-tab-after-charge), so you never lose a paid charge.

### B4.3 Refund a charge

\`\`\`http
POST ${baseUrl}/api/v1/app-payments/charges/clx8p2qr.../refund
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<...>
Content-Type: application/json

{ "amountMinor": "10270", "reason": "Customer requested refund" }
\`\`\`

- \`amountMinor\` is optional — omit for a full refund. Fee is prorated for partial refunds.
- A full refund flips the charge to \`refunded\`; a partial refund leaves it \`paid\` and records the refund in metadata.
- Wallet-method refunds credit the payer's MCOM wallet back.

### B4.4 List / fetch charges

\`\`\`http
GET ${baseUrl}/api/v1/app-payments/charges?status=paid&dateFrom=2026-10-01&dateTo=2026-10-31&page=1&limit=20
GET ${baseUrl}/api/v1/app-payments/charges/clx8p2qr...
\`\`\`

Filters: \`status\`, \`mcomUserId\`, \`reference\`, \`dateFrom\`, \`dateTo\`, \`page\`, \`limit\`. You can only read charges your own app created.

## B5. Webhooks (server-to-server notifications)

MCOM POSTs lifecycle events to your app's **Webhook URL** (set in the Console), signed with your **Webhook Secret**:

| Header | Value |
|---|---|
| \`X-Mcom-Webhook-Signature\` | \`sha256=HMAC-SHA256(rawBody, webhookSecret)\` |

Events:
- \`payment.succeeded\` — a charge was paid.
- \`payment.refunded\` — a charge was refunded.

Payload:

\`\`\`json
{
  "event": "payment.succeeded",
  "platform": "mcom-mall",
  "timestamp": "2026-10-11T10:00:05.000Z",
  "data": {
    "chargeId": "clx8p2qr10000x4vj3k5m7n9p",
    "amountMinor": "10270",
    "feeMinor": "318",
    "netMinor": "9952",
    "currency": "GBP",
    "method": "stripe",
    "status": "paid",
    "reference": "ORDER_123",
    "mcomUserId": "user_abc123",
    "externalCustomerId": "cust_987",
    "provider": "stripe",
    "providerRef": "pi_3Pabc...",
    "paidAt": "2026-10-11T10:00:05.000Z"
  }
}
\`\`\`

Verify the signature before trusting the payload, and treat webhooks as **at-least-once** (idempotent handling keyed on \`chargeId\`).

## B6. MCOM Pay Error Codes

| HTTP | error | Meaning | What to do |
|---|---|---|---|
| 400 | \`VALIDATION_ERROR\` | Bad body / bad \`amountMinor\` | Fix request — don't retry |
| 400 | (idempotency missing) | \`X-Idempotency-Key\` absent on create | Add the header |
| 400 | amount mismatch | Confirmed/paid amount ≠ charge amount | Do not activate; investigate |
| 401 | \`INVALID_SIGNATURE\` | Bad HMAC / unknown client | Check \`hmacSecret\`; rotate in Console |
| 403 | forbidden | Charge belongs to another app | Only read/confirm your own charges |
| 404 | not found | Unknown charge id | Check the id |
| 409 | conflict | Idempotency key reused by another app | Use a platform-scoped key |
| 409 | conflict | Charge not in a refundable/confirmable state | Re-read the charge |
| 422 | \`INSUFFICIENT_BALANCE\` | Wallet method — not enough balance | Show top-up prompt / offer card |
| 429 | \`RATE_LIMITED\` | Too many requests | Exponential backoff |
| 500 / 503 | server | Transient failure | Retry with backoff, same idempotency key |

---

# Part C — Recurring Billing (Subscriptions)

> **Who charges at renewal?** MCOM's recurring engine renews **MCOM-owned memberships and platform plans**. Partner apps remain responsible for their own subscription renewals: MCOM does not store a card or wallet mandate for partner charges.

| Your plan | How renewal works |
|---|---|
| MCOM membership / platform plan | MCOM charges the saved provider mandate (or wallet) and extends access. You do not call partner APIs for this. |
| Your app's subscription paid from MCOM Wallet | **Your backend** runs a scheduler and calls \`POST /wallet/partner/debit\` each period. |
| Your app's subscription paid by card / PayPal | **Your backend** creates a new \`POST /app-payments/charges\` each period. MCOM Pay charges are one-time; for unattended card recurring you need a provider mandate on your side. |

## C1. Renewal loop (your backend)

Store \`nextChargeAt\` in UTC on your subscription row. A daily cron is enough:

1. Find subscriptions where \`nextChargeAt <= now\`.
2. Build a deterministic key for **this billing period** (never per retry):
   \`\`\`ts
   const period = sub.currentPeriodStart.toISOString().slice(0, 10);
   const idempotencyKey = \`\${CLIENT_ID}-sub-\${sub.id}-\${period}\`;
   \`\`\`
3. Charge from your backend:

   \`\`\`http
   POST ${baseUrl}/api/v1/wallet/partner/debit
   X-Mcom-Client-ID: mcom-mall
   X-Mcom-Signature: sha256=<...>
   X-Idempotency-Key: mcom-mall-sub-sub_42-2026-11-01
   Content-Type: application/json

   {
     "userId": "user_abc123",
     "amount": 50,
     "category": "SUBSCRIPTION",
     "description": "MCOM Mall Gold - November 2026",
     "reference": "sub_42_2026_11",
     "metadata": { "subscriptionId": "sub_42", "period": "2026-11" }
   }
   \`\`\`

   For card / PayPal renewals, call \`POST /app-payments/charges\` with the same per-period key instead.
4. On success, extend \`currentPeriodEnd\`, advance \`nextChargeAt\`, write your invoice, and send a receipt.
5. On \`422 INSUFFICIENT_BALANCE\` or a provider failure, move the subscription to \`past_due\` and retry on your dunning schedule.
6. After the final retry, set \`canceled\` and revoke access.

\`\`\`ts
@Cron('0 2 * * *') // daily 02:00 UTC
async renewDueSubscriptions() {
  const due = await db.subscription.findMany({
    where: { status: 'active', nextChargeAt: { lte: new Date() } },
  });

  for (const sub of due) {
    const period = sub.currentPeriodStart.toISOString().slice(0, 10);
    const idempotencyKey = \`\${CLIENT_ID}-sub-\${sub.id}-\${period}\`;
    try {
      await mcom.debit(sub.userId, sub.amount, {
        category: 'SUBSCRIPTION',
        description: \`\${sub.planName} renewal\`,
        reference: sub.invoiceId,
        idempotencyKey,
      });
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          currentPeriodStart: sub.currentPeriodEnd,
          currentPeriodEnd: addInterval(sub.currentPeriodEnd, sub.interval),
          nextChargeAt: sub.currentPeriodEnd,
        },
      });
    } catch (err) {
      await markPastDue(sub, err); // retries + notification
    }
  }
}
\`\`\`

## C2. Dunning (recommended)

| Attempt | When | Action |
|---|---|---|
| 1 | Period end | Charge. On failure, notify the user and keep access for the grace period. |
| 2 | +1 day | Retry with the **same** idempotency key (safe retry, not a new charge). |
| 3 | +3 days | Retry; send a second reminder. |
| 4 | +7 days | Final retry; then set \`canceled\` and revoke access. |

Use the **same** key for retries of the same period, and a **new** key when the period changes.

## C3. Important rules

- **Never run renewals from the browser** — the scheduler and HMAC signing live in your backend.
- **One key per billing period.** Reusing last month's key returns last month's receipt instead of charging.
- **Store amounts server-side.** Never accept a renewal amount from the client.
- **Time zones:** store and compare \`nextChargeAt\` in UTC; render local dates in the UI.
- **Webhooks:** a successful renewal produces the normal \`payment.succeeded\` event. There is no separate renewal event.
- **Cancellation:** stop scheduling; MCOM has no partner-side cancel endpoint for your own subscription. (MCOM's \`/recurring\` endpoints manage MCOM-owned plans and are not available to partner apps.)
- **Hosted partner mandates:** not available yet. If you need MCOM to store and charge a mandate for your app, contact MCOM support.

---

# Part D — Idempotency — Prevent Double Charges

Use a **deterministic** key derived from your internal record:

\`\`\`ts
const key = \`\${CLIENT_ID}-sub-\${subscriptionId}-\${period}\`; // one per renewal cycle
const key = \`\${CLIENT_ID}-purchase-\${orderId}\`;     // wallet purchase
const key = \`\${CLIENT_ID}-refund-\${originalTxnId}\`;  // wallet refund
const key = \`\${CLIENT_ID}-reward-\${campaignId}-\${userId}-\${date}\`;

const key = \`\${CLIENT_ID}-pay-\${orderId}\`;           // MCOM Pay charge
\`\`\`

Rules:
- Max 255 chars, ASCII only.
- Unique per **business event**, never per HTTP retry.
- **Renewals:** a new key per billing period; the **same** key for retries within that period.
- **Never reuse** a key for a different amount or operation.
- Same key + same body on retry → you get the original result back, no second charge.
- Keys are scoped to your platform — another platform's key never collides with yours.

---

# Part E — Drop-In Client (TypeScript / NestJS)

\`\`\`ts
import * as crypto from 'crypto';

export class McomPaymentsError extends Error {
  constructor(public code: string, message: string, public httpStatus: number) {
    super(message);
    this.name = 'McomPaymentsError';
  }
}

@Injectable()
export class McomPaymentsService {
  private base = process.env.MCOM_SOLUTIONS_URL;
  private clientId = process.env.MCOM_CLIENT_ID;
  private hmacSecret = process.env.MCOM_HMAC_SECRET;

  private sign(body: unknown) {
    return 'sha256=' + crypto.createHmac('sha256', this.hmacSecret)
      .update(typeof body === 'string' ? body : JSON.stringify(body)).digest('hex');
  }

  private headers(body: unknown, idempKey?: string) {
    return {
      'Content-Type': 'application/json',
      'X-Mcom-Client-ID': this.clientId,
      'X-Mcom-Signature': this.sign(body),
      ...(idempKey ? { 'X-Idempotency-Key': idempKey } : {}),
    };
  }

  private async call<T>(path: string, body: unknown, method = 'POST', idempKey?: string): Promise<T> {
    const res = await fetch(\`\${this.base}/api/v1\${path}\`, {
      method,
      headers: this.headers(method === 'GET' ? '' : body, idempKey),
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new McomPaymentsError(json.error || 'ERROR', json.message || res.statusText, res.status);
    return json;
  }

  // ── Wallet ──────────────────────────────────────────────────────────────
  getBalance(userId: string) {
    return this.call(\`/wallet/partner/balance/\${userId}\`, undefined, 'GET');
  }
  debit(userId: string, amount: number, opts: { category: string; description: string; reference?: string; metadata?: object; idempotencyKey: string }) {
    return this.call('/wallet/partner/debit', { userId, amount, ...opts }, 'POST', opts.idempotencyKey);
  }
  credit(userId: string, amount: number, opts: { category: string; description: string; reference?: string; metadata?: object; idempotencyKey: string }) {
    return this.call('/wallet/partner/credit', { userId, amount, ...opts }, 'POST', opts.idempotencyKey);
  }

  // ── MCOM Pay ────────────────────────────────────────────────────────────
  createCharge(input: {
    amountMinor: string; method: 'stripe' | 'paypal' | 'wallet'; reference: string;
    currency?: string; description?: string; mcomUserId?: string; externalCustomerId?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const { idempotencyKey, ...body } = input;
    return this.call('/app-payments/charges', body, 'POST', idempotencyKey);
  }
  confirmCharge(chargeId: string, handle: { paymentIntentId?: string; orderId?: string }) {
    return this.call(\`/app-payments/charges/\${chargeId}/confirm\`, handle, 'POST');
  }
  refundCharge(chargeId: string, amountMinor?: string, reason?: string) {
    return this.call(\`/app-payments/charges/\${chargeId}/refund\`, { amountMinor, reason }, 'POST');
  }
  getCharge(chargeId: string) {
    return this.call(\`/app-payments/charges/\${chargeId}\`, undefined, 'GET');
  }
}
\`\`\`

---

# Part G — Payee Splits: paying another user or business

Use this whenever the money belongs to **someone else** — a seller on your marketplace, a business
taking a booking, a professional delivering a service. Without splits MCOM only knows the *buyer*,
so the money accrues to your app's payable instead of reaching the seller.

## G1. What happens to the money

\`\`\`
Buyer wallet  −£90.00
Seller wallet +£87.19     <- credited atomically
Platform      +£2.81      <- the fee (see G7)
\`\`\`

For a card sale the buyer pays the gateway instead of their wallet, and everything else is identical:

\`\`\`
gateway:<provider>  →  platform:wallet (gross)  →  seller wallet (net)
\`\`\`

The buyer's wallet is never touched in the card case.

## G2. Request — wallet

\`\`\`http
POST /api/v1/app-payments/charges
X-Mcom-Client-ID: mcom-mall
X-Mcom-Signature: sha256=<HMAC of the raw body>
X-Idempotency-Key: order_12345
Content-Type: application/json

{
  "amountMinor": "9000",
  "method": "wallet",
  "intent": "ORDER",
  "reference": "order_12345",
  "mcomUserId": "<buyer MCOM user id>",
  "splits": [
    { "payeeType": "mcom_user", "payeeUserId": "<seller MCOM user id>", "amountMinor": "9000" }
  ]
}
\`\`\`

## G3. Request — card (same body, different method)

\`\`\`json
{
  "amountMinor": "9000",
  "method": "stripe",
  "intent": "ORDER",
  "reference": "order_12345",
  "mcomUserId": "<buyer MCOM user id>",
  "splits": [
    { "payeeType": "mcom_user", "payeeUserId": "<seller MCOM user id>", "amountMinor": "9000" }
  ]
}
\`\`\`

The response contains \`clientSecret\` (Stripe) or \`approvalUrl\` (PayPal). The seller is credited once
the payment settles — for card charges that happens on the provider webhook, not when you create the
charge.

## G4. Rules you must satisfy

| Rule | Why |
|---|---|
| \`sum(splits[].amountMinor) === amountMinor\` | A split that does not reconcile is rejected with **422** before any payment is taken |
| \`payeeType: "mcom_user"\` requires \`payeeUserId\` | The payee must be an existing MCOM user; you get the id from SSO |
| \`payeeType: "external"\` requires \`payeeExternalId\` | For sellers without an MCOM account. The money parks on a payee payable until paid out |
| One split per payee | 50 splits maximum per charge |
| \`intent\` should be \`ORDER\` (product) or \`BOOKING\` (service) | Drives the analytics breakdown and the label in the payer's wallet history |

The fee is apportioned across splits **proportionally, with largest-remainder rounding**, so the parts
always sum to exactly \`feeMinor\` — no penny is created or lost.

## G5. Did the seller actually get paid?

\`\`\`http
GET /api/v1/app-payments/charges/:id/splits
\`\`\`

\`\`\`json
{
  "success": true,
  "data": {
    "chargeId": "ch_...",
    "settlementState": "SETTLED",
    "splits": [
      {
        "id": "sp_...",
        "payeeType": "mcom_user",
        "payeeUserId": "user_seller",
        "amountMinor": "9000",
        "feeMinor": "281",
        "netMinor": "8719",
        "status": "credited",
        "walletTransactionId": "wt_...",
        "failureReason": null
      }
    ]
  }
}
\`\`\`

- \`status: pending\` — not yet credited (card charge awaiting settlement, or a retry is queued).
- \`status: credited\` — the payee has the money.
- \`status: failed\` — read \`failureReason\` (for example a frozen payee wallet). The rest of the splits
  are unaffected; MCOM retries failed splits every 10 minutes, up to 10 attempts.

**One payee failing never blocks another payee's money**, and never fails the payment itself — the
buyer's money was already taken.

## G6. Your balance and payouts

\`\`\`http
GET /api/v1/app-payments/balance
\`\`\`

\`\`\`json
{ "success": true, "data": {
    "currency": "GBP",
    "payableMinor": "1374547",
    "pendingPayoutMinor": "0",
    "availableMinor": "1374547",
    "paidOutMinor": "0"
} }
\`\`\`

- Money with **no split** accrues to your **app payable** (this is also what older integrations that
  only called \`/wallet/partner/debit\` produce).
- Money for an **external payee** accrues to that payee's own payable account.
- Payouts are **admin-approved on the MCOM side** — a partner cannot approve its own payout. Ask MCOM
  to pay out your available balance; the ledger debits your payable and credits the bank.

## G7. Who pays the fee (decide this before launch)

| Choice | Effect | How |
|---|---|---|
| **Payee pays** (default) | Seller receives \`netMinor\` (e.g. £87.19 of £90) | No action |
| **You pay** | Seller receives the full amount; MCOM bills you separately | Set your app's \`feePercent = 0\`, \`feeFixedMinor = 0\` in the Console |
| **Custom** | Negotiated rate | Ask MCOM to set your app's fee config |

The fee never comes from the buyer: \`amountMinor\` is always what the buyer pays.

## G8. Errors specific to splits

| Status | Meaning |
|---|---|
| 400 | Malformed split (missing payee id, non-integer amount, more than 50 splits) |
| 422 | \`splits\` do not sum to \`amountMinor\`, unknown payee, or the payer's wallet cannot cover the charge |
| 409 | \`X-Idempotency-Key\` reused with a different payload (amount, method, reference, intent or splits) |

## G9. Migrating from \`/wallet/partner/debit\`

| Before | After |
|---|---|
| \`POST /wallet/partner/debit\` → buyer charged, **seller never paid**, your app payable grows | \`POST /app-payments/charges\` with \`splits\` → buyer charged **and** seller credited in one call |
| You must call \`/wallet/partner/credit\` afterwards to pay the seller (two calls, not atomic, no fee recorded) | One call, atomic, fee handled |

If you keep the old two-call flow it still works — but the seller is only paid if you remember the
second call, and MCOM records no platform fee. Historical money already sitting on your app payable
does **not** move on its own: request a payout.

---

# Part H — What MCOM records (the central ledger)

You do not need to implement any of this — it is here so the numbers you see in the Console make sense.

- **One transfer per business event.** A transfer contains one or more balanced steps. Every step has
  \`sum(debits) === sum(credits)\`; a database constraint rejects anything else at commit.
- **Named accounts**, not one global pot: each user's wallet, the platform's own wallet, per-app and
  per-payee payables, gateway clearing, bank. That is why "what do we owe this app?" is a real number.
- **Intent** labels each transfer (\`ORDER\`, \`BOOKING\`, \`DELEGATION\`, \`PURCHASE\`, \`SUBSCRIPTION\`,
  \`REFERRAL_COMMISSION\`, \`TOP_UP\`, \`REFUND\`, \`PAYOUT\`, \`TRANSFER\`, \`ADJUSTMENT\`, \`FEE\`). Analytics and
  the payer's wallet history are built from it.
- **Immutable.** Entries are never updated or deleted. A correction is a reversing transfer.
- **Reconciled continuously.** Assets must equal liabilities + equity, and each wallet's balance must
  equal the sum of its entries. A nightly job and an admin screen report any drift.
- **Your users see their own ledger** in their wallet: amount, running balance, intent and the other
  party's name. You never see another user's history through the partner API.

---

# Part F — Go-Live Checklist

**Shared**
- [ ] App registered in MCOM Console with a per-app \`hmacSecret\` (and a Webhook URL for MCOM Pay events)
- [ ] \`MCOM_SOLUTIONS_URL\`, \`MCOM_CLIENT_ID\`, \`MCOM_HMAC_SECRET\` in env (server-side only — never in the browser)

**Wallet**
- [ ] \`getBalance\` returns \`ACTIVE\` before charging
- [ ] Every debit/credit uses a deterministic idempotency key
- [ ] \`INSUFFICIENT_BALANCE\` handled (top-up prompt)
- [ ] Captured holds are captured or released; rely on 24h auto-expiry as backstop

**Recurring (your app's subscriptions)**
- [ ] Renewal scheduler runs in your backend (UTC), never in the browser
- [ ] Each plan stores \`nextChargeAt\`, amount, interval and status (\`active\` / \`past_due\` / \`canceled\`)
- [ ] A new idempotency key is generated **per billing period**; retries reuse it
- [ ] Wallet renewals call \`/wallet/partner/debit\` with \`category: "SUBSCRIPTION"\`
- [ ] Card/PayPal renewals create a new MCOM Pay charge (or use your own provider mandate)
- [ ] Dunning schedule configured (+1d, +3d, +7d) with user notifications and a grace period
- [ ] Failed renewals eventually revoke access; successful ones extend it and send a receipt
- [ ] \`payment.succeeded\` webhooks are idempotent per renewal cycle

**MCOM Pay**
- [ ] Charges are created **server-side** only (amount never comes from the browser)
- [ ] Amounts sent as integer minor-unit strings (pence)
- [ ] **Frontend mounts official Stripe Elements (\`<PaymentElement />\`)** with \`clientSecret\` — no custom dummy card forms
- [ ] **Frontend redirects to official PayPal Sandbox \`approvalUrl\`** (or uses official PayPal Buttons SDK) — no mock login forms
- [ ] \`wallet\` path displays user balance and gracefully handles 422 \`INSUFFICIENT_BALANCE\` with top-up link
- [ ] \`confirm\` called after payment, and the \`payment.succeeded\` webhook verified (signature + idempotent)
- [ ] Refunds go through \`/refund\` (never a manual ledger edit)
- [ ] Fee config reviewed in the Console (default 2.9% + 20p) — see **G7** for who bears it

**Payee splits (marketplace / bookings / services)**
- [ ] \`splits\` sum exactly to \`amountMinor\`, calculated **server-side** (never the browser)
- [ ] Every seller resolves to an MCOM user id, or uses \`payeeType: "external"\` with your own id
- [ ] \`intent\` set to \`ORDER\` (product) or \`BOOKING\` (service) so analytics and the payer's history are meaningful
- [ ] Fee bearer decided: default payee-pays, or set \`feePercent = 0\` for the seller to receive 100%
- [ ] Card orders poll \`GET /charges/:id/splits\` until \`settlementState\` is \`SETTLED\`
- [ ] Any historical balance sitting on your app payable has been requested as a payout
- [ ] Failure handling: a \`failed\` split does not roll back the payment; surface it to operations

**Both**
- [ ] Transient errors (409/429/5xx) retried with backoff, same idempotency key
- [ ] Test with a sandbox Stripe/PayPal account and a real MCOM user before launch (test cards in Stripe Elements; sandbox buyer accounts in PayPal)

Questions? Support: MCOM Console → Wallet Management → Wallet Admin.
`;
}

/** Short labelled copy for the quick "copy env" button. */
export function walletEnvBlock(): string {
  return `MCOM_SOLUTIONS_URL="${baseUrl}"
MCOM_CLIENT_ID=<YOUR_CLIENT_ID>
MCOM_HMAC_SECRET=<YOUR_HMAC_SECRET>
MCOM_WALLET_ENABLED=true
MCOM_PAY_ENABLED=true`;
}
