# Customer dashboard: backend integration handoff

## Purpose

The customer workspace screens in this frontend are the approved product design and remain the rendered customer experience in every environment. The current data is explicitly a local/demo fixture. It must be replaced with authenticated customer data when the backend contract is ready; do not replace these screens with the business dashboard or another customer layout.

This document records the data the frontend needs and the API routes found in the repository. “Implemented in source” means a controller/client route exists in this checkout; it does not certify the endpoint is deployed or operational. Backend should confirm response envelopes, role access, and missing fields before integration.

## Authentication and account scope

- Keep the existing customer authentication and route guard. Every customer endpoint below must derive the customer identity from the authenticated session/JWT, not from a caller-supplied user ID.
- The dashboard must not use a development auth bypass in production.
- Customer and business account responses must be scoped by the authenticated account type. The frontend needs a reliable customer role/type in the current-user response.
- Use the existing API client's session/token behavior and normal error handling. Do not embed demo credentials or demo balances in production responses.

## Screens and data needed

| Screen | Data needed by the approved UI | Frontend interactions |
|---|---|---|
| Overview | Customer display name; wallet balance and currency; connected/available app counts; unread message count; product highlights; latest wallet transactions | Open wallet, ecosystem, or inbox; fund wallet |
| MCOM Ecosystem | App ID, name, slug, description, category, logo/icon or brand asset, availability/connection state, status/detail, launch URL, version if applicable | Search, category filter, connected-only filter, sort, launch/connect/manage app |
| My Wallet | Balance, available balance, currency, wallet status; rewards/points if supported; transactions with ID/reference, timestamp, service/source, description, method/channel, signed amount, currency, status, receipt URL/details; pagination/filter totals | Select amount/provider, start top-up, follow provider flow, confirm result, filter/search transactions, open receipt, export statement if supported |
| Messages | Conversations with ID/type/title/avatar, participants, online/mute state, last message/time, unread count; messages with sender, content/type/metadata, timestamp and delivery/read state; support and merchant labels | Search/select conversation, send message, mark read, create chat, mute, attachments/quick replies if supported |
| Notifications | ID, title, body, category/type, created time, read state, action/deep link; unread count and paging | Filter, mark all read, dismiss/delete, follow action, load older |
| Profile | Customer name, email, phone, job title, country/region, preferred currency, avatar, member-since date, verification state, tier and benefits, referral URL/code and counts | Edit supported profile fields, upload avatar if supported, copy/share referral link, view tier benefits |
| Settings & Security | Editable name/job title, currency, 2FA status, email/SMS/push preferences, connected SSO providers and connection state, active sessions, password/security timestamps | Save preferences, request password reset, toggle notification/2FA settings, connect/disconnect SSO, revoke sessions, account deletion flow |

## Existing routes found in this checkout

All routes below are protected by `JwtAuthGuard` in the corresponding backend controller unless stated otherwise. Confirm customer-role authorization explicitly.

### Identity and settings

- `GET /auth/me` — returns current user profile. Current controller includes user fields, `name`, `businessId`, and `isOnboarded`; confirm customer-specific fields and role discriminator.
- `PUT /auth/settings` — currently whitelists `firstName`, `lastName`, `jobTitle`, `twoFactorEnabled`, `emailNotifications`, and `smsNotifications` in `UpdateSettingsDto`. Preferred currency, push preferences, avatar/profile location, SSO management, sessions, and deletion are not represented by this DTO and need confirmation/new endpoints if required.

### Wallet

- `GET /wallet` — current wallet, balance, available balance, status, currency.
- `GET /wallet/transactions` — paginated/filterable transaction list.
- `GET /wallet/transactions/:id` — transaction receipt/details. Verify ownership is enforced in the service.
- `POST /wallet/topup/initiate` — starts a top-up; current frontend client sends `{ amount, returnUrl, cancelUrl, provider }` (default provider is `stripe`). Confirm supported providers and provider-specific behavior. The approved mock UI shows several gateways; do not present unsupported methods as functional.
- `POST /wallet/topup/confirm` — confirms a Stripe payment using `{ topUpRequestId, paymentIntentId }`.
- `GET /wallet/topup/history?page=&limit=` — top-up history.
- `GET /wallet/holds` — active holds.
- `GET /wallet/summary?period=30d|90d|1y` — wallet spending summary.

The wallet UI also displays rewards/loyalty points, tier, and pending cashback. Confirm a customer endpoint/source and currency semantics for those fields. The mock balance is illustrative only.

### Ecosystem apps

- `GET /apps` — frontend business service currently calls this to load the app catalog. Confirm it returns customer-visible MCOM apps and document fields for category, state/connection, logo, launch URL, and action permissions. No customer-specific app connection/launch API has been confirmed from the inspected UI.
- `GET /ecosystem/services` exists in the service-identity controller and may be a platform registry rather than a customer marketplace; confirm intended use before wiring it to this screen.

### Notifications

- `GET /notifications` — list notifications for caller; backend describes user-first identity, business fallback, plus broadcasts.
- `POST /notifications/read-all` — mark caller's own notifications read.
- `DELETE /notifications/:id` — delete one caller-owned notification.

The current client has no single-notification read endpoint or pagination/filter parameters. Add/confirm those if per-item read, category filters, or “load older” must persist server-side. Define a stable response schema with `id`, `title`, `body/description`, `category`, `createdAt`, `readAt`/`isRead`, and optional action metadata.

### Messages and support

The authenticated `ChatController` under `/chat` provides:

- `GET /chat/conversations`
- `POST /chat/conversations/direct` with `{ targetUserId }`
- `POST /chat/conversations/group` with `{ title, participantIds, avatarUrl? }`
- `GET /chat/conversations/:id`
- `GET /chat/conversations/:id/messages?cursor=&limit=` (default 50, max 100 per controller docs)
- `POST /chat/conversations/:id/messages`
- `POST /chat/conversations/:id/read` with optional `{ messageIds }`
- `GET /chat/messages/:messageId/receipts`
- `POST /chat/conversations/:id/participants` and `DELETE /chat/conversations/:id/participants/:targetUserId`
- `POST /chat/conversations/:id/mute` with `{ isMuted }`
- `GET /chat/users?q=`
- Push subscription routes under `/chat/push/*`
- Message request/blocking routes under `/chat/requests`, `/chat/block`, and `/chat/blocked`.

The frontend already has typed conversation/message models in `services/chat`. Confirm which routes and fields customer accounts may use, how the CHS Concierge/support desk conversation is provisioned, socket event names/authentication, and attachment support. Do not use fixture messages to imply a real support response.

## Contract work to confirm or add

1. Publish the authoritative OpenAPI schemas and examples for the routes above, including pagination, error responses, enums, timestamps, and numeric precision/currency rules.
2. Confirm customer role access and response shape for `GET /auth/me`, `/apps`, wallet, chat, and notifications.
3. Define app catalog/connection/launch contract, including app branding assets and safe launch/SSO URL behavior.
4. Confirm payment provider availability, fees, minimum/maximum amounts, initiation/confirmation lifecycle, failed/cancelled/pending states, and receipt retrieval. Only show a gateway as actionable when supported.
5. Confirm loyalty balance, cashback, tier/benefits, local offers, and referral data sources/endpoints. These are currently represented by fixtures and are not established by the customer dashboard API wiring.
6. Define profile/avatar, preferred currency, notification preference, connected-account/SSO, active-session, password reset, and account deletion contracts. Extend existing settings only with backend-approved fields.
7. For notifications, define unread counts and pagination/filtering; add per-notification read if required by product behavior.
8. Confirm support conversation bootstrap and real-time transport contract for customer accounts.

## Fixture inventory and integration boundary

The layout fixtures are in `apps/frontend/src/data/customerDashboardMock.ts` (`CUSTOMER_PREVIEW`, `CUSTOMER_NOTIFICATIONS`, `CUSTOMER_PRODUCTS`, `CUSTOMER_TRANSACTIONS`, and `CUSTOMER_CONVERSATIONS`). They exist to render and review the approved design. They are not customer records and must not be treated as actual balances, account status, transactions, message history, identity verification, referrals, or notifications.

During integration, preserve the page structure and responsive design while replacing fixture reads/actions with typed API hooks. Keep payment, account deletion, password/security, and messaging actions inert or clearly unavailable until the backend contract and end-to-end behavior are confirmed.
