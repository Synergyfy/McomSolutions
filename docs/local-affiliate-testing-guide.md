# Local Affiliate — Manual Testing Guide

Everything below assumes a fresh clone of the changes and a local Postgres.

---

## 0. Start it up

```bash
cd apps/backend
npx prisma migrate deploy
npm run seed:local-affiliate        # prints the demo logins
npm run start:dev                   # API on :3010

# second terminal
cd apps/frontend
npm run dev -- --port 3000          # run on 3000 to match FRONTEND_URL
```

> **Why port 3000?** `apps/backend/.env` has `FRONTEND_URL="http://localhost:3000"`.
> That value is baked into the affiliate links the API returns
> (`http://localhost:3000/a/LAF-000125`). If you serve the frontend on another
> port, either use `--port 3000` or change `FRONTEND_URL` — otherwise copied
> links will point at a port nothing is listening on.

Demo accounts (password for all: `Password123!`):

| Email | Code | Status |
|---|---|---|
| john.smith@example.com | LAF-000125 | ACTIVE, 900 available / 500 pending points |
| mary.jones@example.com | LAF-000126 | ACTIVE |
| peter.james@example.com | LAF-000127 | PENDING (unverified) |
| sarah.brown@example.com | LAF-000128 | ACTIVE, mixed ledger |

Demo vouchers: `DEMO-2345` valid · `DEMO-6789` expired · `DEMO-3456` revoked.

---

## 1. Public pages — no login needed

| Open | Expect |
|---|---|
| `http://localhost:3000/offers` | 5 offers. The "External Link — Traffic Only" card says *"Traffic only — this offer does not carry a reward yet."* |
| `http://localhost:3000/offers/tobys-barber-premium-cut` | Detail: source = MCOM Mall, customer gets 15% off, you earn 100 points. "Get my share link" button **does not** appear — you are not signed in. |
| `http://localhost:3000/a/LAF-000125` | "Offers shared by John Smith", offer grid. |
| `http://localhost:3000/a/LAF-000127` | "This affiliate page is not available" — Peter is PENDING. |
| `http://localhost:3000/join-affiliate` | Two-column page; right panel is the **register** form because you are signed out. |

**Privacy check:** view-source on `/a/LAF-000125` and search for `@` / `email` / `phone` / `postcode`. There should be no PII.

---

## 2. Existing customer becomes an affiliate (Scenario A)

1. Sign in at `/login` as `john.smith@example.com` / `Password123!`.
2. Open `http://localhost:3000/affiliate-hub`.
3. Expect: "Local Affiliate" header, `LAF-000125`, **active**, *vCard linked*, your link `http://localhost:3000/a/LAF-000125`, and four tiles — Available 900, Pending 500, Clicks 2, Rewarded events 0.
4. Go to `http://localhost:3000/join-affiliate` while signed in.
5. Expect: "Activate on your account" (not the register form) and a button.
6. Click **Activate my affiliate profile**.
7. Expect: you land back on `/affiliate-hub` and nothing duplicates.

**Prove no second identity was created:**

```bash
psql "postgresql://postgres:..." -d mcom_solutions -c \
"select count(*) from \"User\" where email='john.smith@example.com';"
-- must be 1
```

---

## 3. New customer (Scenario B)

1. Sign out.
2. `/join-affiliate` → fill the form (any unused email, password ≥ 8 chars), tick the terms box, submit.
3. Expect: **"Verify your email"** step, not the dashboard. (The profile is `PENDING`.)
4. The code is emailed. With `MOCK_OTP=true` in the backend env no email is sent — get the code from the API response instead:
   ```bash
   curl -s -X POST http://localhost:3010/api/v1/auth/send-otp \
     -H 'Content-Type: application/json' \
     -d '{"email":"YOU@example.com"}'
   # { "success": true, "code": "123456", "mode": "mock" }
   ```
5. Enter the code → **Verify and continue**.
6. Expect: dashboard, status **active**, a brand-new `LAF-0001xx`.

**Negative paths:**

| Do | Expect |
|---|---|
| Register with `john.smith@example.com` | `409` and the message "An account with this email already exists. Sign in first…" |
| Enter a wrong verification code | "That code is not valid or has expired." |
| Open `/affiliate-hub` as a brand-new (unverified) user before step 5 | Profile shows **PENDING**; banner says *"Verify your email address to start sharing offers."* |

---

## 4. The core loop — share, click, attribute

1. As John, open `/affiliate-hub/offers`.
2. On **Toby's Barber**, click **Share**.
3. Expect: a link appears — `http://localhost:3000/r/<10-char code>` — and the browser share sheet may open.
4. Copy that `/r/...` URL and paste it into a new tab.
5. Expect: a `302` to `https://mall.example.com/product/barber-premium-cut?laf=<code>` (the seeded demo destination).

**What that proved:** the click was recorded and the destination was built server-side.

**Security checks:**

| Try | Expect |
|---|---|
| `http://localhost:3010/api/v1/r/doesnotexist` | `302` → `http://localhost:3000/offers?link=unavailable` (never a 404, never a raw URL) |
| Append `&url=https://evil.com` to a `/r/...` link | Destination is still the offer's own URL — a caller-supplied URL is ignored |

---

## 5. Rewards

1. `/affiliate-hub/rewards` as John.
2. Expect six tiles: Available 900 · Pending 500 · Redeemed 300 · Expired 0 · Reversed 0 · Total 1,700.
3. Enter `100` and click **Redeem**.
4. Expect: `Voucher QHJK-XXXX issued. Remaining balance: 800 points.`
5. Enter `99999` and redeem.
6. Expect: "You do not have enough available points for that amount." (`422 INSUFFICIENT_REWARD_BALANCE` underneath.)
7. Look at **Reward history**: each row states its status, and pending rows explain themselves ("Waiting for…"/"Available once the voucher has been validated"). An `APPROVED` row says *"Confirmed and available to redeem."*

---

## 6. A business validates a voucher

The validation endpoint accepts a business JWT **or** an `x-api-key`. The quickest path is an API key:

```bash
# 1. pick any business and give it a test key
psql "postgresql://postgres:..." -d mcom_solutions -c \
"update \"BusinessProfile\" set \"apiKey\"='test-key' where id=(select id from \"BusinessProfile\" limit 1);"

# 2. first use
curl -s -X POST http://localhost:3010/api/v1/affiliate-redemptions/validate \
  -H 'x-api-key: test-key' -H 'Content-Type: application/json' \
  -d '{"code":"DEMO-2345","customerRef":"customer-1"}'
# 200 VALIDATED, remainingUses: 0

# 3. same customer again — must be idempotent, not an error
curl -s -X POST http://localhost:3010/api/v1/affiliate-redemptions/validate \
  -H 'x-api-key: test-key' -H 'Content-Type: application/json' \
  -d '{"code":"DEMO-2345","customerRef":"customer-1"}'
# 200 ALREADY_REDEEMED with the ORIGINAL timestamp

# 4. a different customer on a single-use voucher
curl -s -X POST http://localhost:3010/api/v1/affiliate-redemptions/validate \
  -H 'x-api-key: test-key' -H 'Content-Type: application/json' \
  -d '{"code":"DEMO-2345","customerRef":"customer-2"}'
# 409 VOUCHER_USE_LIMIT_REACHED

# 5. expired / revoked / unknown
#    DEMO-6789 → 410 VOUCHER_EXPIRED
#    DEMO-3456 → 409 VOUCHER_REVOKED
#    NOPE-0000 → 404 VOUCHER_NOT_FOUND
```

Then check the affiliate actually got the reward (John owns `DEMO-2345`):

```bash
psql "postgresql://postgres:..." -d mcom_solutions -c \
"select p.affiliate_code, l.status, l.units, l.explanation_code
 from affiliate_reward_ledger l
 join local_affiliate_profiles p on p.id=l.local_affiliate_id
 where l.idempotency_key like 'conversion:%';"
```

Expect `LAF-000125 | AVAILABLE | 100 | APPROVED` — a `REDEMPTION_VALIDATION` rule auto-approves, so it never sits in pending.

---

## 7. Admin

Sign in at `/admin/login` with your own ADMIN account, then:

| Page | Expect |
|---|---|
| `/admin/local-affiliates` | 4 rows. **View** opens a panel with code, status, balances and recent ledger. **Suspend** flips the status. |
| `/admin/affiliate-offers` | Create form + offers table + campaigns. Approve/Pause work per row. |
| `/admin/affiliate-rewards` | Rule publisher, rule versions (with "current" badge), conversions table, vouchers. |
| `/admin/affiliate-reconciliation` | Totals, provider split, reward-by-status, and 7 queues. |

**The most important admin test — the verifiability gate:**

1. `/admin/affiliate-rewards` → publish a rule: *Qualifying event = approved purchase*, fixed 50 points.
2. `/admin/affiliate-offers` → provider **Tamina (REDEMPTION_CODE)**, title "Gate test", destination `https://tamina.example.com/x`, pick that rule → **Create offer**.
3. Expect: **"This provider cannot verify the event this reward rule pays on. A link-only provider can never promise a sale reward."**

That is the rule from the source model §16, enforced in code — a provider can never promise what it cannot confirm.

**Other admin checks:**

- Create an offer with destination `javascript:alert(1)` → rejected as an invalid URL.
- Conversion row → **Approve** → the ledger row moves `PENDING → AVAILABLE`.
- Conversion row → **Reverse** → `reversedUnits` in the response and the affiliate's Available drops by that amount.
- Reconciliation → **Negative balances** should be `0`; after reversing an already-spent reward it becomes `1` (this is the deliberate "surface it, don't hide it" behaviour).

---

## 8. Guard rails worth breaking on purpose

| Attempt | Expected |
|---|---|
| `/api/v1/admin/local-affiliates` with no token | `401` |
| `/api/v1/partner/affiliate/attribution/<code>` with no mesh token | `401` |
| `/api/v1/affiliate-redemptions/validate` with no key | `401` |
| Admin user tries `/affiliate-hub` → activate | `403 AFFILIATE_NOT_ELIGIBLE` |
| PENDING user (Peter) tries to create a link | `403 AFFILIATE_NOT_ACTIVE` |
| Old terms version | `409 TERMS_VERSION_OUTDATED` |
| Voucher from another business's offer | `403 NOT_YOUR_OFFER` |

---

## 9. Automated tests

```bash
cd apps/backend
npx jest src/local-affiliate      # 162 feature tests
npx jest                          # 986 total — must be 0 failures
npx tsc --noEmit                  # must be clean

cd apps/frontend
npx tsc --noEmit
npx vite build
```

---

## 10. Reset between runs

```bash
cd apps/backend && npm run seed:local-affiliate
```

The seed is idempotent (upserts by fixed id) so re-running restores the demo
state without duplicating rows. To also clear reward activity created while
testing:

```bash
psql "postgresql://postgres:..." -d mcom_solutions <<'SQL'
delete from affiliate_ledger_events where ledger_id in
  (select id from affiliate_reward_ledger
    where idempotency_key like 'conversion:%' or idempotency_key like 'redeem:%');
delete from affiliate_reward_ledger
  where idempotency_key like 'conversion:%' or idempotency_key like 'redeem:%'
     or idempotency_key like 'reversal:%';
delete from affiliate_redemptions;
delete from affiliate_conversions where provider_transaction_id like 'redemption:%';
delete from affiliate_reward_redemptions;
update affiliate_vouchers set used_count=0, status='ISSUED' where code='DEMO-2345';
SQL
```

---

## 11. What is *not* testable yet (and why)

| Not available | Reason |
|---|---|
| Real Mall purchases being attributed | Phase 2 — Mall has no `order_attribution` or outbox yet |
| ThriveCart checkout round-trip | Phase 3 |
| Awin offers | Phase 4, and blocked on Awin's written subnetwork confirmation |
| QR codes | No QR dependency in the frontend; ships with the vCard in Phase 2 |
| Cashback in the MCOM wallet | Gated behind `AFFILIATE_CASHBACK_ENABLED` |
