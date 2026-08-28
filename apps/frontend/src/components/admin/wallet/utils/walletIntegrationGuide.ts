/**
 * Written MCOM Wallet partner-integration guide (human-authored, not AI).
 * Rendered in the admin Wallet panel and copied to the clipboard verbatim.
 */

const baseUrl = (import.meta.env.VITE_API_URL?.replace(/\/api\/v1\/?$/, '') || 'https://api.mcomsolutions.com').replace(/\/$/, '');

export function generateWalletIntegrationGuide(): string {
  return `# MCOM Wallet — Partner Integration Guide

Integrate MCOM Wallet payments into your registered MCOM application (MCOM Mall, MCOM Rewards, MCOM Spin, VemTap, 247GBS, or any Console-registered app).

- Base URL: \`${baseUrl}\`
- API prefix: \`/api/v1/wallet/partner\`
- Wallet currency: **MCOM credits** (displayed to 2 dp; stored to 4 dp server-side)
- Every user on McomSolutions already has one wallet — you never create one. You only debit, credit, or hold it.

---

## 1. How It Works

1. A user registers on McomSolutions → a wallet is **auto-created** (balance 0).
2. The user tops up via MCOM Wallet (Stripe) → wallet credited.
3. Your app backend calls the partner API (HMAC-signed) to **debit**, **credit**, or **hold** funds.
4. McomSolutions atomically writes a ledger entry + updates the balance, under a distributed lock.
5. Retries are safe: same idempotency key → same result, never a double charge.

McomSolutions is the **single source of truth** for balances. Your app never stores wallet balances.

---

## 2. Prerequisites & Credentials

1. Your app must be **registered in the MCOM Console** (Admin → MCOM Console). This gives you:
   - \`clientId\` (e.g. \`mcom-mall\`) — public identifier
   - \`hmacSecret\` (prefixed \`hm_\`) — shown **once** at registration; rotate it anytime from the Console (Admin → MCOM Console → your app → Rotate HMAC Secret)
2. If your app was seeded before per-app secrets existed, the backend falls back to \`MCOM_<CLIENT_ID>_SECRET\` or the shared \`SSO_API_SECRET\`. For production, issue a **per-app HMAC secret** via the Console so each platform uses its own.

---

## 3. Environment Variables

\`\`\`env
# MCOM Solutions central API
MCOM_SOLUTIONS_URL="${baseUrl}"

# Your app identity (from MCOM Console)
MCOM_CLIENT_ID=<YOUR_CLIENT_ID>        # e.g. mcom-mall
MCOM_HMAC_SECRET=<YOUR_HMAC_SECRET>    # shown once in the Console

# Feature flag
MCOM_WALLET_ENABLED=true
\`\`\`

---

## 4. Authentication (HMAC)

Every request requires three headers:

| Header | Value |
|---|---|
| \`X-Mcom-Client-ID\` | your \`clientId\` |
| \`X-Mcom-Signature\` | \`sha256=<hex>\` — HMAC-SHA256 of the request body with your \`hmacSecret\` |
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

---

## 5. Endpoints

All under \`${baseUrl}/api/v1/wallet/partner\`. HMAC + \`X-Mcom-Client-ID\` required on all.

| Method | Path | Purpose | Idempotency-Key |
|---|---|---|---|
| POST | \`/debit\` | Debit a wallet (subscription, purchase, fee) | **Required** |
| POST | \`/credit\` | Credit a wallet (reward, refund, cashback) | **Required** |
| POST | \`/hold/place\` | Reserve funds before confirming | Optional |
| POST | \`/hold/capture\` | Convert a hold into a real debit | Optional |
| POST | \`/hold/release\` | Release a hold back to balance | — |
| GET | \`/balance/:userId\` | Check a user's balance (cached 30s) | — |
| GET | \`/transactions/:userId\` | Transactions **your platform** originated for this user | — |
| GET | \`/transaction/:id\` | Look up one of your transactions (by \`id\` or \`?by=idempotencyKey\`) | — |

### 5.1 Debit a wallet

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

Success (201):

\`\`\`json
{
  "success": true,
  "transactionId": "clx8p2qr10000x4vj3k5m7n9p",
  "type": "DEBIT",
  "amount": 50,
  "balanceBefore": 150,
  "balanceAfter": 100,
  "currency": "MCOM",
  "reference": "sub_inv_0042",
  "idempotencyKey": "mcom-mall-sub-inv_0042_aug2026",
  "processedAt": "2026-08-26T11:15:00.000Z"
}
\`\`\`

### 5.2 Check balance

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
  "currency": "MCOM"
}
\`\`\`

\`availableBalance\` = balance minus active holds. Check it before charging.

### 5.3 Holds (pre-authorization)

1. \`POST /hold/place\` → reserves funds, returns \`holdId\` + \`expiresAt\`.
2. \`POST /hold/capture\` → converts the hold into a real debit (\`HOLD_CAPTURE\`).
3. \`POST /hold/release\` → releases funds back to available balance.
4. Uncaptured holds auto-expire after \`WALLET_HOLD_DEFAULT_TTL_HOURS\` (default 24h) — the system releases them; you don't need to.

---

## 6. Idempotency — Prevent Double Charges

Use a **deterministic** key derived from your internal record:

\`\`\`ts
const key = \`\${CLIENT_ID}-sub-\${invoiceId}\`;       // subscriptions
const key = \`\${CLIENT_ID}-purchase-\${orderId}\`;    // purchases
const key = \`\${CLIENT_ID}-refund-\${originalTxnId}\`; // refunds
const key = \`\${CLIENT_ID}-reward-\${campaignId}-\${userId}-\${date}\`;
\`\`\`

Rules:
- Max 255 chars, ASCII only.
- Unique per **business event**, never per HTTP retry.
- **Never reuse** a key for a different amount or operation.
- Same key + same body on retry → you get the original receipt back, no second charge.
- Keys are scoped to your platform — another platform's key never collides with yours.

---

## 7. Error Codes & Handling

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

Handling \`INSUFFICIENT_BALANCE\`:

\`\`\`ts
try {
  const receipt = await mcomWallet.debit(userId, amount, opts);
} catch (err) {
  if (err.code === 'INSUFFICIENT_BALANCE') {
    // Return a top-up prompt to your frontend:
    return res.status(402).json({
      error: 'WALLET_INSUFFICIENT_FUNDS',
      message: 'Top up your MCOM Wallet to continue.',
      topUpUrl: '${baseUrl}/dashboard/wallet',
    });
  }
  throw err;
}
\`\`\`

**Retry with backoff** — permanent errors (400/401/403/404/422) should NOT be retried; transient ones (409/429/500/503) should, with the **same idempotency key**:

\`\`\`ts
async function debitWithRetry(payload, idempKey, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await fetch(\`\${MCOM_URL}/api/v1/wallet/partner/debit\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mcom-Client-ID': CLIENT_ID,
        'X-Mcom-Signature': sign(payload, HMAC_SECRET),
        'X-Idempotency-Key': idempKey, // SAME KEY every retry
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return res.json();
    if (![409, 429, 500, 503].includes(res.status)) throw await res.json(); // permanent
    if (attempt === maxRetries) throw await res.json();
    await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
  }
}
\`\`\`

---

## 8. Drop-In Client (TypeScript / NestJS)

\`\`\`ts
import * as crypto from 'crypto';

export class McomWalletError extends Error {
  constructor(public code: string, message: string, public httpStatus: number) {
    super(message);
    this.name = 'McomWalletError';
  }
}

@Injectable()
export class McomWalletService {
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

  async getBalance(userId: string) {
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/balance/\${userId}\`, {
      headers: this.headers(''), // GET → sign empty string
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async debit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/debit\`, {
      method: 'POST',
      headers: this.headers(body, opts.idempotencyKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new McomWalletError(err.error || 'ERROR', err.message, res.status);
    }
    return res.json();
  }

  async credit(userId: string, amount: number, opts: {
    category: string; description: string; reference?: string;
    metadata?: object; idempotencyKey: string;
  }) {
    const body = { userId, amount, ...opts };
    const res = await fetch(\`\${this.base}/api/v1/wallet/partner/credit\`, {
      method: 'POST',
      headers: this.headers(body, opts.idempotencyKey),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new McomWalletError(err.error || 'ERROR', err.message, res.status);
    }
    return res.json();
  }
}
\`\`\`

---

## 9. Go-Live Checklist

- [ ] App registered in MCOM Console with a per-app \`hmacSecret\`
- [ ] \`MCOM_SOLUTIONS_URL\`, \`MCOM_CLIENT_ID\`, \`MCOM_HMAC_SECRET\` in env
- [ ] \`getBalance\` returns \`ACTIVE\` before charging
- [ ] Every debit/credit uses a deterministic idempotency key
- [ ] \`INSUFFICIENT_BALANCE\` handled (top-up prompt)
- [ ] 409/429/5xx retried with backoff, same key
- [ ] Captured holds are captured or released; rely on 24h auto-expiry as backstop
- [ ] Test with the MCOM Wallet smoke script or a real account before launch

Questions? Support: MCOM Console → Wallet Management → Wallet Admin.
`;
}

/** Short labelled copy for the quick "copy env" button. */
export function walletEnvBlock(): string {
  return `MCOM_SOLUTIONS_URL="${baseUrl}"
MCOM_CLIENT_ID=<YOUR_CLIENT_ID>
MCOM_HMAC_SECRET=<YOUR_HMAC_SECRET>
MCOM_WALLET_ENABLED=true`;
}