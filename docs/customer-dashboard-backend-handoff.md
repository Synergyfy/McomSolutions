# Customer Dashboard Backend Handoff

**Audience:** frontend developer integrating the approved customer dashboard.

**Branch:** `feat/customer-backend-integration`
**Commit:** `548b3fb`
**Base URL:** all paths below are relative to `/api/v1`.

This document covers only what is implemented in the backend. The existing customer dashboard layout/design is unchanged. No frontend files were modified as part of this backend work.

---

## 1. Authentication and identity

Authentication is unchanged. Customers use the same login/logout/refresh flow as business users; only the role differs (`CUSTOMER`).

Use the existing API client and send the access token on every protected request:

```http
Authorization: Bearer <accessToken>
```

### Existing endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/auth/register` | Register. Send `role: "CUSTOMER"` for a customer account. |
| `POST` | `/auth/login` | Login with email/password. |
| `POST` | `/auth/refresh` | Rotate refresh token. |
| `POST` | `/auth/logout` | Revoke session(s) and clear cookies. No body = revoke all sessions. |
| `GET` | `/auth/me` | Current user identity. |
| `PUT` | `/auth/settings` | Update name, job title, email notification flag, 2FA flag. |
| `POST` | `/auth/forgot-password` | Send password-reset code to email. |
| `POST` | `/auth/reset-password` | Reset password using the emailed code. |

### `GET /auth/me` response (customer)

`businessProfile` is `null` for customers. `role` is `"CUSTOMER"`.

```json
{
  "id": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
  "email": "customer@example.com",
  "role": "CUSTOMER",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "jobTitle": "Engineer",
  "twoFactorEnabled": false,
  "emailNotifications": true,
  "smsNotifications": false,
  "registrationSource": "direct",
  "adminRole": null,
  "referralCode": "ABC123",
  "createdAt": "2026-01-05T00:00:00.000Z",
  "updatedAt": "2026-10-21T10:00:00.000Z",
  "businessProfile": null
}
```

`GET /auth/me` does **not** include `customerProfile` (phone, loyalty points, status). Use `GET /customer/profile` for those fields.

### `PUT /auth/settings`

Use this for identity fields that already existed before this change.

Request:

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "jobTitle": "Engineer",
  "twoFactorEnabled": false,
  "emailNotifications": true
}
```

Only these keys are accepted:

- `firstName`
- `lastName`
- `jobTitle`
- `twoFactorEnabled`
- `emailNotifications`
- `smsNotifications`

Response:

```json
{
  "id": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
  "email": "customer@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "jobTitle": "Engineer",
  "twoFactorEnabled": false,
  "emailNotifications": true,
  "smsNotifications": false
}
```

> SMS is not implemented. Do not present SMS settings as functional.

---

## 2. Customer profile

New module. These routes require a valid `CUSTOMER` token. A business/admin token gets `403`.

### `GET /customer/profile`

Returns identity plus the existing `CustomerProfile` fields.

```json
{
  "success": true,
  "id": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
  "email": "customer@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "jobTitle": "Engineer",
  "role": "CUSTOMER",
  "emailNotifications": true,
  "twoFactorEnabled": false,
  "referralCode": "ABC123",
  "memberSince": "2026-01-05T00:00:00.000Z",
  "phone": "+447911123456",
  "loyaltyPoints": 1200,
  "status": "Active",
  "customerProfile": {
    "id": "cp_01J8Z9K2Q3",
    "userId": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
    "phone": "+447911123456",
    "loyaltyPoints": 1200,
    "status": "Active",
    "createdAt": "2026-01-05T00:00:00.000Z",
    "updatedAt": "2026-10-21T10:00:00.000Z"
  }
}
```

Fields:

- `memberSince` = user `createdAt`
- `loyaltyPoints` = existing loyalty points balance
- `status` = existing customer status (`Active`, etc.)
- `phone` = existing customer phone

No membership tier, verification state, country, region, preferred currency, or avatar is returned because those are not implemented/persisted in this pass.

### `PATCH /customer/profile`

Currently updates **phone only**.

Request:

```json
{
  "phone": "+447700900123"
}
```

An empty/whitespace phone clears it (`null`).

Response:

```json
{
  "success": true,
  "phone": "+447700900123",
  "loyaltyPoints": 1200,
  "status": "Active",
  "customerProfile": {
    "id": "cp_01J8Z9K2Q3",
    "userId": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
    "phone": "+447700900123",
    "loyaltyPoints": 1200,
    "status": "Active",
    "createdAt": "2026-01-05T00:00:00.000Z",
    "updatedAt": "2026-10-21T10:05:00.000Z"
  }
}
```

Important:

- Unknown body keys are rejected with `400` because the app uses `whitelist + forbidNonWhitelisted`.
- Do **not** send `firstName`, `lastName`, or `jobTitle` here. Use `PUT /auth/settings`.
- Do **not** send country, region, preferred currency, or avatar; they are not stored yet.

---

## 3. Notifications

Existing notification controller extended. Works for customers and businesses; identity comes from the token.

### `GET /notifications`

#### Legacy array response (no query parameters)

Calling `/notifications` with **no query parameters** keeps the historical response shape: an array.

```json
[
  {
    "id": "notif_01",
    "businessId": null,
    "userId": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
    "type": "wallet",
    "title": "Wallet Top-Up Successful",
    "message": "Your wallet has been credited with 50 MCOM.",
    "read": false,
    "data": {
      "topUpRequestId": "topup_01"
    },
    "createdAt": "2026-10-21T10:00:00.000Z",
    "updatedAt": "2026-10-21T10:00:00.000Z",
    "body": "Your wallet has been credited with 50 MCOM.",
    "category": "wallet",
    "isRead": false
  }
]
```

The additive fields are:

- `body` — same value as `message`
- `category` — same value as `type`
- `isRead` — same value as `read`

Existing fields are retained for the current notification centre.

#### Paginated/filtered envelope

If you send **any** of `page`, `limit`, `category`, `unreadOnly`, or `search`, the response becomes:

```json
{
  "success": true,
  "data": [
    {
      "id": "notif_01",
      "businessId": null,
      "userId": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
      "type": "wallet",
      "title": "Wallet Top-Up Successful",
      "message": "Your wallet has been credited with 50 MCOM.",
      "read": false,
      "data": {},
      "createdAt": "2026-10-21T10:00:00.000Z",
      "updatedAt": "2026-10-21T10:00:00.000Z",
      "body": "Your wallet has been credited with 50 MCOM.",
      "category": "wallet",
      "isRead": false
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "totalPages": 2,
  "unreadCount": 7
}
```

Query parameters:

| Param | Type | Notes |
|---|---|---|
| `page` | number | Default `1`. |
| `limit` | number | Default `20`, max `100`. |
| `category` | string | Filters `type` (e.g. `wallet`, `chat_message`, `reward`, `payment`). |
| `unreadOnly` | boolean | `true`/`false`. Excludes global broadcasts. |
| `search` | string | Case-insensitive title/message search. |

`unreadCount` is the caller-owned unread count and excludes global broadcasts.

### `GET /notifications/unread-count`

```json
{
  "success": true,
  "unreadCount": 7
}
```

### `PATCH /notifications/:id/read`

Marks one caller-owned notification as read.

Response: the notification object (same shape as list items), with `read: true` / `isRead: true`.

Returns `404` if the notification does not exist, belongs to another user/business, or is a global broadcast.

### `POST /notifications/read-all`

```json
{
  "success": true
}
```

Marks the caller's own rows as read. Global broadcasts are not mass-marked.

### `DELETE /notifications/:id`

```json
{
  "success": true
}
```

Only caller-owned notifications or business-owned notifications can be deleted. Global broadcasts cannot be deleted by a non-admin.

---

## 4. Wallet

Wallet routes are user-scoped. Customer wallets are created automatically at customer registration and lazily if missing. The wallet currency is `MCOM`.

### `GET /wallet`

```json
{
  "id": "wallet_01",
  "userId": "b3f0c7d2-6e2a-4d1d-9c3f-7a1e2b4c5d6e",
  "balance": 1250.0,
  "availableBalance": 1200.0,
  "currency": "MCOM",
  "status": "ACTIVE",
  "dailyDebitLimit": null,
  "monthlyDebitLimit": null,
  "createdAt": "2026-01-05T00:00:00.000Z",
  "lastTransactionAt": "2026-10-21T10:00:00.000Z"
}
```

`availableBalance` = balance minus active holds.

### `GET /wallet/transactions`

Query parameters (all optional):

| Param | Type |
|---|---|
| `page` | number (default 1) |
| `limit` | number (default 20, max 100) |
| `platformSlug` | string |
| `platformClientId` | string |
| `type` | `CREDIT` or `DEBIT` |
| `category` | `TOP_UP`, `REWARD`, `REFUND`, `ADMIN_CREDIT`, `TRANSFER_IN`, `SUBSCRIPTION`, `PURCHASE`, `SERVICE_FEE`, `ADMIN_DEBIT`, `TRANSFER_OUT`, `HOLD_CAPTURE` |
| `status` | `COMPLETED`, `PENDING`, `FAILED`, `REVERSED` |
| `dateFrom` | ISO date (`2026-10-01`) |
| `dateTo` | ISO date (`2026-10-31`) |
| `search` | matches description/reference |
| `minAmount` | number string |
| `maxAmount` | number string |

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": "txn_01",
      "type": "DEBIT",
      "amount": 12.5,
      "balanceBefore": 100.0,
      "balanceAfter": 87.5,
      "currency": "MCOM",
      "platformClientId": "mcom-mall",
      "platformName": "MCOM Mall",
      "platformSlug": "mall",
      "category": "PURCHASE",
      "reference": "order_123",
      "description": "MCOM Mall order",
      "status": "COMPLETED",
      "initiatedBy": "platform:mcom-mall",
      "createdAt": "2026-10-21T10:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

App purchases appear here as `DEBIT` / `PURCHASE` transactions with `platformName`/`platformSlug` identifying the app.

### `GET /wallet/transactions/:id`

Returns one transaction. **Now scoped to the authenticated user's wallet.** A transaction belonging to another wallet returns `404`.

Response: one transaction object (same shape as list items).

### `POST /wallet/topup/initiate`

Request:

```json
{
  "amount": 50,
  "currency": "GBP",
  "provider": "stripe",
  "returnUrl": "https://app.example.com/customer/wallet?topup=success",
  "cancelUrl": "https://app.example.com/customer/wallet?topup=cancelled"
}
```

- `amount`: min `5`, max `500`
- `currency`: default `GBP`
- `provider`: `stripe` (default) or `paypal`
- `returnUrl` / `cancelUrl`: optional; used by PayPal redirect and Stripe Checkout fallback

#### Stripe response

```json
{
  "provider": "stripe",
  "clientSecret": "pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_abc",
  "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa",
  "topUpRequestId": "topup_01",
  "amount": 50,
  "currency": "GBP",
  "status": "PENDING",
  "sessionId": "cs_test_abc123",
  "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_abc123"
}
```

For Stripe Elements: use `clientSecret`, then send `paymentIntentId` + `topUpRequestId` to confirm.

#### PayPal response

```json
{
  "provider": "paypal",
  "topUpRequestId": "topup_01",
  "orderId": "5O190127TN364715T",
  "approvalUrl": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
  "amount": 50,
  "currency": "GBP",
  "status": "PENDING"
}
```

PayPal flow:

1. Redirect/open `approvalUrl`.
2. PayPal returns to your `returnUrl` with `token` (the order id) and `PayerID`.
3. Call `POST /wallet/topup/confirm` with `orderId` and `topUpRequestId`.

If `returnUrl`/`cancelUrl` are omitted, the backend defaults to:

- `${FRONTEND_URL}/dashboard/wallet?topup=success`
- `${FRONTEND_URL}/dashboard/wallet?topup=cancelled`

For the customer UI, pass the customer wallet URL explicitly if you want the redirect to land on `/customer/wallet`.

### `POST /wallet/topup/confirm`

#### Stripe body

```json
{
  "topUpRequestId": "topup_01",
  "paymentIntentId": "pi_3MtwBwLkdIwHu7ix28a3tqPa"
}
```

#### PayPal body

```json
{
  "topUpRequestId": "topup_01",
  "orderId": "5O190127TN364715T",
  "provider": "paypal"
}
```

`provider` is optional for PayPal if `orderId` is present; the backend infers PayPal. For Stripe, the existing body without `provider` continues to work.

Response:

```json
{
  "success": true,
  "balance": 1300.0
}
```

Notes:

- The top-up request must belong to the authenticated user.
- The call is idempotent: if the request is already completed, the current balance is returned.
- Stripe amount/currency is verified against the stored request.
- Unsupported providers return `400`.

### `GET /wallet/topup/history?page=1&limit=20`

```json
{
  "success": true,
  "data": [
    {
      "id": "topup_01",
      "amount": 50.0,
      "currency": "GBP",
      "walletCurrency": "MCOM",
      "provider": "paypal",
      "status": "COMPLETED",
      "completedAt": "2026-10-21T10:00:00.000Z",
      "createdAt": "2026-10-21T09:58:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

Status values: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`.

### `GET /wallet/holds`

```json
{
  "success": true,
  "data": [
    {
      "id": "hold_01",
      "amount": 25.0,
      "platformClientId": "mcom-mall",
      "platformName": "MCOM Mall",
      "reference": "order_123",
      "status": "ACTIVE",
      "expiresAt": "2026-10-22T10:00:00.000Z"
    }
  ]
}
```

### `GET /wallet/summary?period=30d`

`period` accepts `30d`, `90d`, or `1y`.

```json
{
  "period": "30d",
  "totalSpent": 120.5,
  "totalCredited": 300.0,
  "netFlow": 179.5,
  "spentByPlatform": [
    {
      "platformSlug": "mall",
      "platformName": "MCOM Mall",
      "totalSpent": 80.5,
      "txnCount": 4
    }
  ],
  "topCategories": [
    {
      "category": "PURCHASE",
      "total": 80.5,
      "count": 4
    }
  ]
}
```

### Provider webhooks

These are server-to-server only. Do not call them from the frontend.

- `POST /wallet/webhook/stripe`
- `POST /wallet/webhook/paypal`

PayPal webhook verification requires `PAYPAL_WEBHOOK_ID`. Stripe uses `STRIPE_WEBHOOK_SECRET`.

---

## 5. MCOM Pay / ecosystem payments

Customers are already included in the app-payment system. There is **no customer role guard** on the partner payment routes. A Console-registered app can charge any MCOM user id (`mcomUserId`), including customers.

Supported methods:

- `stripe`
- `paypal`
- `wallet` (debits the customer's MCOM wallet)

When an app charges a customer:

1. The app backend calls `POST /app-payments/charges` with `X-Mcom-Client-ID` + `X-Mcom-Signature` (HMAC), and `mcomUserId` from the customer's SSO `sub`.
2. The customer's wallet is debited for `wallet` payments.
3. `WalletTransaction` and `AppPaymentLedgerEntry` rows are written.
4. The debit appears in `GET /wallet/transactions` with `category: "PURCHASE"` and the app's `platformName`/`platformSlug`.

The frontend does **not** call `/app-payments/*`; that is the partner app's server-to-server API. The customer-facing part is:

- `GET /wallet` for balance
- `GET /wallet/transactions` for purchase history
- `GET /wallet/transactions/:id` for a receipt/detail

The `/payment/*` membership endpoints remain business-only. They are not part of customer app payments.

---

## 6. Messaging

Chat already supports customers; no backend role change was needed. Customers can:

- search businesses, customers, admins, and agents;
- start direct conversations;
- create group conversations;
- receive/send messages;
- use requests, blocking, mute, read receipts, and Web Push.

All routes require `Authorization: Bearer <accessToken>`.

### Conversation endpoints

| Method | Path | Body / query |
|---|---|---|
| `GET` | `/chat/conversations` | — |
| `POST` | `/chat/conversations/direct` | `{ "targetUserId": "..." }` |
| `POST` | `/chat/conversations/group` | `{ "title": "...", "participantIds": ["..."], "avatarUrl": "..." }` |
| `GET` | `/chat/conversations/:id` | — |
| `GET` | `/chat/conversations/:id/messages` | `?cursor=&limit=` (max 100) |
| `POST` | `/chat/conversations/:id/messages` | `{ "content": "...", "type": "TEXT", "idempotencyKey": "...", "metadata": {} }` |
| `POST` | `/chat/conversations/:id/read` | `{ "messageIds": ["..."] }` (optional) |
| `GET` | `/chat/messages/:messageId/receipts` | — |
| `POST` | `/chat/conversations/:id/participants` | `{ "userId": "..." }` |
| `DELETE` | `/chat/conversations/:id/participants/:targetUserId` | — |
| `POST` | `/chat/conversations/:id/mute` | `{ "isMuted": true }` |
| `GET` | `/chat/users?q=` | — |

### Message requests / blocking

| Method | Path |
|---|---|
| `GET` | `/chat/requests` |
| `POST` | `/chat/requests` |
| `POST` | `/chat/requests/:id/respond` |
| `POST` | `/chat/requests/reset/:senderId` |
| `POST` | `/chat/block` |
| `POST` | `/chat/unblock` |
| `GET` | `/chat/blocked` |

### Web Push

| Method | Path |
|---|---|
| `GET` | `/chat/push/vapid-key` |
| `POST` | `/chat/push/subscribe` |
| `DELETE` | `/chat/push/unsubscribe` |

### Conversation list item shape

```json
{
  "id": "conv_01",
  "type": "DIRECT",
  "title": "Metro Arena Rewards",
  "avatarUrl": "https://cdn.example.com/logo.png",
  "directKey": "customer-uuid:business-uuid",
  "isMuted": false,
  "role": "MEMBER",
  "lastMessageAt": "2026-10-21T10:00:00.000Z",
  "lastMessageText": "Your reward has been added.",
  "lastMessageSenderId": "business-uuid",
  "unreadCount": 1,
  "isOnline": true,
  "participantsCount": 2,
  "participants": [
    {
      "userId": "business-uuid",
      "role": "ADMIN",
      "displayName": "Metro Arena Rewards",
      "email": "hello@metro.example",
      "roleTitle": "BUSINESS",
      "isOnline": true,
      "lastReadAt": "2026-10-21T09:50:00.000Z"
    }
  ]
}
```

### Message shape

```json
{
  "id": "msg_01",
  "conversationId": "conv_01",
  "senderId": "business-uuid",
  "senderName": "Metro Arena Rewards",
  "senderRole": "BUSINESS",
  "senderAvatar": "https://cdn.example.com/logo.png",
  "content": "Your reward has been added.",
  "type": "TEXT",
  "metadata": null,
  "idempotencyKey": null,
  "createdAt": "2026-10-21T10:00:00.000Z",
  "isSender": false,
  "readCount": 1,
  "totalRecipients": 1,
  "isReadByMe": false,
  "readReceiptsPreview": []
}
```

### User directory shape (`GET /chat/users?q=`)

```json
[
  {
    "id": "user-uuid",
    "email": "hello@business.example",
    "firstName": "Sam",
    "lastName": "Owner",
    "role": "BUSINESS",
    "businessName": "Metro Arena Rewards",
    "isOnline": true
  }
]
```

The directory is not role-filtered, which is intentional: customers need to find businesses and other customers. The frontend should use `businessName`/`role` to render identity.

---

## 7. Apps / All Products / SSO

The existing app directory and SSO token endpoints already work for customers.

### `GET /apps`

Public. Returns active registered Console apps.

```json
[
  {
    "id": "app_01",
    "clientId": "mcom-mall",
    "name": "MCOM Mall",
    "description": "Multi-vendor marketplace.",
    "platformSlug": "mall",
    "appUrl": "https://mall.example.com",
    "redirectUris": ["https://mall.example.com/auth/callback"],
    "logoUrl": "https://cdn.example.com/mall.png",
    "isSystemApp": true,
    "isActive": true,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-10-01T00:00:00.000Z"
  }
]
```

There is no customer-specific app-connection endpoint. The existing `/apps` list does not return a real `connected` flag; the customer dashboard currently derives its app count from the active catalog.

### `GET /auth/sso/token?target_client_id=<clientId>`

Returns a short-lived SSO token for the authenticated customer.

```json
{
  "ssoToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

The token payload includes `role: "customer"` for customer users. Use the existing all-products launch logic to open the target app.

### SSO authorization code flow

- `POST /auth/sso/authorize` with `{ client_id, redirect_uri, scope, state }` → `{ code }`
- `GET /auth/sso/authorize?...` for browser redirects
- Partner backends exchange the code server-to-server at `POST /auth/sso/token`

No auth/SSO code was changed in this branch.

---

## 8. Referrals

Existing routes; work for customers.

### `GET /referrals/me`

```json
{
  "success": true,
  "referralCode": "ABC123",
  "referralLink": "https://app.example.com/register?ref=ABC123"
}
```

### `GET /referrals/stats`

```json
{
  "success": true,
  "totalReferrals": 14
}
```

### `GET /referrals?page=1&limit=20`

```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "email": "friend@example.com",
      "firstName": "Friend",
      "lastName": "Name",
      "role": "CUSTOMER",
      "createdAt": "2026-09-01T00:00:00.000Z"
    }
  ],
  "total": 14,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

---

## 9. How to build the Overview without a `/customer/overview` route

There is no overview endpoint. Compose it from existing calls:

| UI value | Call |
|---|---|
| Customer name/email/role | `GET /auth/me` |
| Wallet balance/currency/status | `GET /wallet` |
| Latest wallet activity | `GET /wallet/transactions?limit=5` |
| App count / product highlights | `GET /apps` |
| Unread messages | `GET /chat/conversations` → sum `unreadCount` |
| Unread notifications | `GET /notifications/unread-count` |
| Loyalty points/phone/status | `GET /customer/profile` |
| Referral code/count | `GET /referrals/me`, `GET /referrals/stats` |

Example composition:

```ts
const [me, wallet, recent, apps, chats, unread, profile, referral, stats] =
  await Promise.all([
    api.get('/auth/me'),
    api.get('/wallet'),
    api.get('/wallet/transactions', { params: { limit: 5 } }),
    api.get('/apps'),
    api.get('/chat/conversations'),
    api.get('/notifications/unread-count'),
    api.get('/customer/profile'),
    api.get('/referrals/me'),
    api.get('/referrals/stats'),
  ]);
```

---

## 10. Error responses

Standard NestJS error shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Common cases:

| Status | Meaning |
|---|---|
| `400` | Validation error, unsupported provider, missing required field, invalid state. |
| `401` | Missing/invalid/expired access token. |
| `403` | Authenticated but wrong role (e.g. business token calling `/customer/profile`). |
| `404` | Resource not found, wrong owner, or another user's wallet transaction. |
| `409` | Conflict (e.g. duplicate idempotency key). |
| `422` | Insufficient wallet balance / limit exceeded. |
| `502` | PayPal provider error during capture. |

Because the app uses `whitelist + forbidNonWhitelisted`, sending an unknown body field returns `400`. Keep request bodies to the documented keys.

---

## 11. Not available in this pass

Do not build UI that implies these are functional yet:

- Customer membership tiers/benefits
- Phone verification
- Country/region/preferred-currency/avatar persistence
- Customer session listing or “log out other devices” (use `POST /auth/logout` with no body for all-session logout)
- Customer-specific push/marketing notification preferences (email preference is available through `PUT /auth/settings`)
- Real 2FA/TOTP enrollment (the `twoFactorEnabled` flag exists but no enrollment flow)
- SSO identity-provider connect/disconnect (Google/Apple/GitHub)
- Account deletion
- Statement export
- Chat attachment upload (message `type`/`metadata` exist, but there is no upload endpoint)
- Local offers
- SMS

---

## 12. Quick endpoint summary

### New/changed in this branch

- `GET /customer/profile`
- `PATCH /customer/profile`
- `GET /notifications` (extended; legacy array preserved)
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `POST /wallet/topup/initiate` (adds `paypal`)
- `POST /wallet/topup/confirm` (adds `orderId`/`provider`)
- `POST /wallet/webhook/paypal` (server-to-server)
- `GET /wallet/transactions/:id` (now owner-scoped)

### Existing, unchanged, and usable by customers

- Auth: `/auth/*`
- Wallet: `/wallet`, `/wallet/transactions`, `/wallet/topup/history`, `/wallet/holds`, `/wallet/summary`
- Referrals: `/referrals/*`
- Apps/SSO: `/apps`, `/auth/sso/token`, `/auth/sso/authorize`
- Chat: `/chat/*`
- Notifications: `POST /notifications/read-all`, `DELETE /notifications/:id`

No database migration was added. No auth/login/JWT behavior was changed. No frontend files were changed.
