# Cross-Platform Real-Time Messaging (WebSockets) — Implementation Plan

> Status: proposal
> Scope: Central Hub (`central-hub-solution`) ↔ 247GBS Affiliates (`247gbsaffiliates`)
> Goal: businesses on Central Hub and affiliates on the 247GBS dashboard can message each
> other in real time — fast, efficient and safe.

---

## 0. Short answer

**Yes, it is possible — and most of the hard work already exists.**

Central Hub already has a production-grade chat subsystem:

- A Socket.IO gateway on namespace `/chat` (`apps/backend/src/chat/chat.gateway.ts`)
- REST fallback, cursor pagination, idempotent sends, read receipts, typing, presence
- Message requests, blocking, push notifications, a durable outbox table
- A working web client (`apps/frontend/src/services/chat/*`, `ChatWidget`, `ChatToastNotifications`)

247GBS already has the identity link we need: every user provisioned through SSO carries
`mcomUserId` (`247gbsaffiliates/apps/api/src/users/entities/user.entity.ts`), and 247GBS stores the
user's Central tokens server-side (encrypted). Its current `messaging` module is a simple polling
implementation (5s/10s) and `ChatOverlay.tsx` is still a UI mock.

**The missing pieces are:**

1. Cross-instance scale (no Redis Socket.IO adapter — presence/typing are in-memory maps).
2. A trust bridge so 247GBS can open a socket *as* a Central user without exposing long-lived tokens.
3. A real 247GBS chat client (socket.io-client + UI) and a server-side proxy to Central chat.
4. Security hardening of the existing gateway (CORS is currently `origin: () => true`, tokens
   accepted from the query string, presence broadcast globally).

**Deployment:** the backend runs on a VPS (Ubuntu) as a persistent Node process, which is exactly
what Socket.IO needs. The former Vercel serverless entrypoint (`apps/backend/api/index.ts`) and
`apps/backend/vercel.json` have been removed. For production, make sure Nginx/Cloudflare forwards the
WebSocket `Upgrade`/`Connection` headers and that Redis is reachable by the API process.

**Implementation status (this plan is now partly built):** see §17 for what is already implemented
and verified end-to-end.

---

## 1. Current state (verified in code)

### Central Hub

| Area | File | Observation |
|---|---|---|
| Gateway | `apps/backend/src/chat/chat.gateway.ts` | Socket.IO `/chat`, JWT handshake, rooms `user:{id}` and `conversation:{id}`, events `send_message`, `mark_read`, `typing_*`, `join/leave_conversation`, `viewing_conversation` |
| Auth | same, `afterInit()` | Verifies `JWT_SECRET`, loads user, checks `payload.tv === user.tokenVersion` ✅ |
| CORS | same, `@WebSocketGateway({ cors: { origin: (o, cb) => cb(null, true) } })` | ⚠️ wide open |
| Token source | `extractToken()` | ⚠️ accepts `?token=` query param (leaks into logs/referrers) |
| Presence | `services/presence.service.ts` | ⚠️ in-memory `Map`; `isUserOnline()` never reads Redis → wrong across instances |
| Typing | `services/typing.service.ts` | ⚠️ in-memory only |
| Presence broadcast | `handleConnection/Disconnect` | ⚠️ `server.emit('presence_update')` to **all** users (privacy + scale) |
| Broadcast fan-out | `broadcastNewMessage()` | DB query for participants on **every** message |
| Conversation list | `chat.service.getConversations()` | ✅ one grouped unread query + one batched presence lookup |
| Typing membership check | `handleTypingStart()` | ⚠️ DB `count()` on every keystroke (debounced client-side only) |
| Outbox | `chat.service.sendMessage()` writes `ChatOutbox` | ✅ consumed by `ChatOutboxProcessor` with retries + sweeper |
| REST | `chat.controller.ts` | Guarded by `JwtAuthGuard` (`JWT_SECRET`, `tv`, revoked jti) |
| Redis | `redis/redis.service.ts` | Available, with in-memory fallback and fail-closed `setNx` |
| Adapter | — | ⚠️ no `@socket.io/redis-adapter` |
| Frontend | `apps/frontend/src/services/chat/connection.ts` | Reconnect/backoff, BroadcastChannel multi-tab, idle suspension — good base to port |

Relevant Prisma models already exist (`prisma/schema.prisma`):
`Conversation`, `ConversationParticipant`, `Message`, `MessageReadReceipt`, `ChatOutbox`,
`ChatMessageRequest`, `ChatBlock`, `PushSubscription`.

### 247GBS Affiliates

| Area | File | Observation |
|---|---|---|
| Messaging API | `apps/api/src/messaging/*` | TypeORM `conversations`/`messages`, polling, no websockets |
| Auth | `apps/api/src/auth/auth-cookie.util.ts` | Own httpOnly cookie `auth_token` (JWT_ACCESS_SECRET) |
| Identity | `users/entities/user.entity.ts` | `mcomUserId` set by SSO JIT; role `agent/account_manager/consultant/admin` |
| Central tokens | `apps/api/src/mcom/mcom.service.ts` | Central access/refresh tokens stored **server-side, encrypted** |
| SSO | `apps/api/src/mcom/sso.controller.ts` | Code exchange, refresh, JIT provisioning, encrypted token storage |
| Back-to-back | `apps/api/src/users/internal-directory.controller.ts` | `GET /internal/affiliates` secured by `x-api-key` |
| Web | `apps/web/hooks/useMessaging.ts` | React Query polling (10s list / 5s messages) |
| Web chat UI | `apps/web/components/ChatOverlay.tsx` | Static mock — no backend wiring |
| Deps | `apps/web/package.json` | No `socket.io-client` |

---

## 2. Decision: one messaging backbone, not two

Three options were considered.

| Option | How | Verdict |
|---|---|---|
| **A. Central Hub is the single chat backbone** | Central owns conversations/messages; 247GBS is a trusted client | ✅ **Recommended** |
| B. Federated stores + webhook sync | Each platform owns its own messages, sync events | ❌ Eventual consistency, ordering, duplicate/conflict handling, two sources of truth |
| C. Embed Central chat widget in an iframe | SSO cookie inside iframe | ❌ `SameSite`/third-party-cookie fragility, poor UX, harder mobile support |

**Option A** reuses the mature Central implementation (idempotency, receipts, requests, blocking,
push) and keeps one source of truth. 247GBS does **not** duplicate messages; it becomes a scoped
OAuth-style client of Central chat. Existing local `conversations`/`messages` tables are kept only
as a migration bridge, then frozen.

### Why not let 247GBS own the messages?
Two stores inevitably diverge (ordering, edits, deletes, read state). The business already lives in
Central; the affiliate is a Central `User` with an `AgentProfile` / `AccountManagerProfile` /
`ConsultantProfile`. Central is the natural owner.

---

## 3. Target architecture

```
┌──────────────────────────┐            ┌──────────────────────────────┐
│  Central Hub Web         │            │  247GBS Web (Next.js)        │
│  (existing chat client)  │            │  (new chat client)           │
└───────────┬──────────────┘            └───────┬──────────────┬───────┘
            │ Bearer (15m)                       │ httpOnly     │ WSS (90s token)
            │                                    │ cookie       │
            ▼                                    ▼              ▼
┌──────────────────────────┐        ┌────────────────────┐  ┌─────────────────────────┐
│  Central Hub API         │◄───────│  247GBS API        │  │  Central Hub Chat GW    │
│  /chat/* (REST)          │ server │  /messaging/*      │  │  /chat (Socket.IO)      │
│  /chat/session (mint)    │  to    │  proxy + token mint│  │  Redis adapter          │
└───────────┬──────────────┘ server └────────┬───────────┘  └───────────┬─────────────┘
            │                                │                          │
            │                                │ /chat/session            │
            └──────────────┬─────────────────┘                          │
                           ▼                                            │
                  ┌─────────────────┐        ┌──────────────────────┐   │
                  │  PostgreSQL     │◄───────│  Redis (pub/sub,     │───┘
                  │  (chat is truth)│        │  presence, limits)   │
                  └─────────────────┘        └──────────────────────┘
```

**Data path:**

- **History / conversation list / send fallback:** browser → 247GBS API → Central REST.
  247GBS keeps the Central token server-side; the browser never sees it.
- **Live stream (messages, typing, presence, receipts):** browser → Central WS **directly**, using a
  short-lived, single-purpose socket token minted on demand by 247GBS.
- **Offline / not on page:** Central writes a notification + (optionally) dispatches a signed
  webhook to 247GBS (`chat.message.created`) so it can badge/notify locally.

This keeps the hot path (typing/messages) at one network hop and confines tokens.

---

## 4. Identity model

Central `User` is the canonical identity for cross-platform messaging.

| Central | 247GBS | Link |
|---|---|---|
| `User.id` | `User.mcomUserId` | Set by SSO JIT (`mcom.service.jitProvision`) |
| `User.email` (unique) | `User.email` (unique) | Secondary join key, **verified email only** |
| `AGENT` / `ACCOUNT_MANAGER` / `CONSULTANT` roles + profile tables | `agent` / `account_manager` / `consultant` | Role mapping already exists (`normalizeAffiliateRole`) |
| `BusinessProfile` | — | Business participants are displayed from Central data |

Rules:

1. **Never auto-link on an unverified email.** Require `mcomUserId` (SSO-proven) or a verified
   email on both sides.
2. If a 247GBS user has no Central identity, cross-platform chat is disabled and the UI prompts
   “Connect your Central Hub account” (SSO). Local-only affiliate↔affiliate chat can remain as-is
   until migrated.
3. Add a backfill job + `POST /internal/affiliates/upsert` on Central so active affiliates that
   exist only in 247GBS get a Central `User` (role `AGENT`, no password, `mustResetPassword`), with
   the 247GBS user id stored as an external reference. This makes them addressable from Central.
4. Store the reverse link on 247GBS: `users.mcom_user_id` (exists) + new index.

---

## 5. Auth & token design (the security core)

### 5.1 New Central endpoint: mint a chat session

`POST /api/v1/chat/session`

- Guard: `SsoClientGuard` (HTTP Basic `client_id:client_secret`, exactly like
  `auth/service-token`). Only registered, active apps may call it.
- Body: `{ subject_token: "<user SSO access token>" }` (RFC 8693-style, same idea as
  `service-token/exchange`).
- Central verifies `subject_token` with `SSO_JWT_SECRET` (already how `/auth/sso/*` works), loads the
  user, rejects deleted/banned/`tokenVersion` mismatch, and confirms the calling app is permitted
  for this user (SSO session exists for that client).
- Response:

```json
{
  "accessToken": "…",          // JWT_SECRET, 15m, aud=chat, scope=chat
  "expiresIn": 900,
  "socketToken": "…",          // JWT_SECRET, 90s, aud=chat:ws, single-use jti
  "socketExpiresIn": 90
}
```

`accessToken` claims: `{ sub, email, role, tv, jti, aud: "chat", scope: "chat", act: { sub: clientId } }`.
It passes the existing `JwtStrategy` unchanged, so **no chat controller rewrite** is needed.

`socketToken` claims: `{ sub, tv, aud: "chat:ws", scope: "chat", jti, platform }`. The gateway:
- verifies with `JWT_SECRET`,
- requires `aud === "chat:ws"`,
- atomically consumes `jti` in Redis (`SET NX EX 90`) → replay-proof,
- re-checks `tv` and user status (already implemented).

`socketToken` is single-use, so the client fetches a fresh one on every (re)connect attempt.

### 5.2 247GBS server side

1. New `CentralChatClient` service:
   - reads the stored Central access token (decrypt via `mcom-crypto.util`),
   - if expired/401 → `mcomService.refreshTokens()` and re-encrypt/store,
   - calls `POST /chat/session` with Basic auth + `subject_token`,
   - caches the returned `accessToken` in Redis keyed by 247GBS user id with TTL ≈ 14 min.
2. New proxy endpoints under `/messaging` (guarded by the existing `JwtAuthGuard` cookie):
   - `GET  /messaging/chat-session` → returns **only** `socketToken` + TTL + socket URL
   - `GET  /messaging/conversations` → central `/chat/conversations` (mapped)
   - `POST /messaging/conversations/direct` → central
   - `GET  /messaging/conversations/:id/messages` → central (id = central conversation id)
   - `POST /messaging/conversations/:id/messages` → central (fallback path)
   - `POST /messaging/conversations/:id/read` → central
   - `GET  /messaging/directory?q=` → central `/chat/users`
   - `POST /messaging/push/subscribe` / `DELETE /messaging/push/unsubscribe` → central push
3. Existing local `messaging` tables become a compatibility shim: add
   `conversations.central_conversation_id` (nullable, unique) and map on first contact. Freeze writes
   once the proxy is live.

### 5.3 Token handling rules

- Socket token travels only in `handshake.auth.token` (never URL).
- Remove `client.handshake.query.token` support from the Central gateway.
- 247GBS returns the socket token to the browser over HTTPS; keep it in memory only (no
  `localStorage`).
- Never log tokens; redact in the existing structured logger.

---

## 6. Socket protocol (reuse + small additions)

Existing events stay compatible with the Central web client.

Client → server:

| Event | Payload | Notes |
|---|---|---|
| `join_conversation` | `{ conversationId }` | server verifies membership once and caches it on the socket |
| `leave_conversation` | `{ conversationId }` | |
| `send_message` | `{ conversationId, content, idempotencyKey, type?, metadata? }` | ack `{ success, message, clientTempId }` |
| `mark_read` | `{ conversationId, messageIds? }` | |
| `typing_start` / `typing_stop` | `{ conversationId }` | no DB query; membership from socket cache |
| `viewing_conversation` / `stop_viewing_conversation` | `{ conversationId }` | drives push suppression |
| **`watch_presence`** *(new)* | `{ userIds: string[] }` | server checks a shared conversation, joins `presence:{uid}` rooms |
| **`unwatch_presence`** *(new)* | `{ userIds: string[] }` | |

Server → client: `connected`, `new_message`, `inbox_update`, `chat_notification`,
`messages_read`, `typing_update`, `presence_update`.

Additions for safety/scale:

- Ack every mutating event (already partly done) so clients can retry idempotently.
- Cap `maxHttpBufferSize` (e.g. 100 KB) and message length (`@MaxLength(4000)`).
- Emit `presence_update` only to `presence:{uid}` subscribers, never `server.emit`.

---

## 7. What to change in Central Hub

### Phase A — harden and scale the existing gateway (no product change)

1. **Redis adapter**
   - Add `@socket.io/redis-adapter` (uses `ioredis`, already a dependency).
   - Expose dedicated pub/sub clients from `RedisService` (`createPubSubClients()`), or create them
     from `REDIS_URL` in a `SocketIoAdapter` (`apps/backend/src/chat/chat.adapter.ts`).
   - Register in `main.ts`: `app.useWebSocketAdapter(new RedisIoAdapter(app, redis, config))`.
   - If Redis is unavailable: log loudly and fall back to the in-memory adapter **only** when
     `NODE_ENV !== 'production'`; fail startup in production.
2. **CORS allowlist for WS**
   - Replace `origin: () => true` with a function that consults the same origin set as HTTP CORS
     (`main.ts` `refreshCorsOrigins` + `SsoClient.corsOrigins`) plus a `CHAT_ALLOWED_ORIGINS` env.
   - Reject unknown origins in production.
3. **Presence in Redis**
   - `presence:user:{userId}` → Redis Hash/Set of socket ids with TTL + heartbeat every 30s.
   - Keep a small in-memory hot cache (TTL 5s) for `isUserOnline()` to avoid Redis round-trips in
     list rendering; invalidate on connect/disconnect.
   - Publish presence changes on a `chat:presence` channel; nodes update caches.
   - Scope broadcasts with `watch_presence` rooms.
4. **Typing in Redis**
   - Hash `typing:{conversationId}` with per-user expiring entries; broadcast via the adapter.
   - Remove the DB membership `count()` in `handleTypingStart`; use `socket.data.conversations`.
5. **Membership cache on socket**
   - On `join_conversation`, store `conversationId` in `socket.data.conversations`.
   - On participant add/remove, publish `chat:membership` so all nodes drop stale entries.
6. **Remove per-message participant query**
   - `sendMessage()` already loads `cp.conversation.participants`; pass that list to
     `broadcastNewMessage()` instead of re-querying.
7. **Fix `getConversations` N+1**
   - One `message.groupBy({ by: ['conversationId'], where: { conversationId: { in }, senderId: { not: userId }, createdAt: { gt: … } } })`
     plus participant cursor comparison, or denormalize `unreadCount` on
     `ConversationParticipant` and update it in the send/read transaction.
8. **Outbox processor**
   - Add `ChatOutboxProcessor` (BullMQ) consuming `PENDING` rows: in-app notification, Web Push,
     optional central→247GBS webhook. Retries + `retryCount` + `errorMessage`. Idempotent.
   - Alternatively remove the table if push stays inline — but durable delivery is preferable for
     cross-platform.

### Phase B — cross-platform session endpoint

9. `POST /chat/session` (§5.1) + DTO + Swagger + tests.
10. Extend `ChatController` docs and add a rate limit: `@Throttle({ default: { limit: 30, ttl: 60000 } })`.
11. Add `watch_presence` / `unwatch_presence` handlers and scoped presence emission.
12. Add `ChatGateway.revokeUserSockets(userId)` via Redis pub/sub so logout/password-change/ban
    disconnects sockets on **all** nodes (today it only works on the node that holds the socket).
13. Update the “Ecosystem Access Verification Skill” generator
    (`apps/frontend/src/components/admin/utils/ecosystemAccessSkillGenerator.ts`) with a
    “Real-time messaging” section describing `/chat/session`, the socket namespace, events, token
    TTLs, and security rules — so partner teams get the contract from `/admin/console`.

### Phase C — security & limits

14. Per-user rate limits enforced in Redis (shared across nodes):
    - `send_message`: 20 / 10s
    - `typing_*`: 1 / 2s (server coalesces)
    - `join_conversation`: 10 / min
    - `/chat/session`: 5 / min
    - max sockets per user: 10
15. Input validation: UUID `conversationId`, `content` length + control-char stripping, JSON
    metadata size cap.
16. Ensure `ChatService.sendMessage` blocking/rejection/request rules run for **every** path
    (WS, REST, proxy). They already do — verify no shortcut is added in the proxy.
17. Revocation: bump `tokenVersion` on logout/password reset (exists) + pub/sub disconnect.

### Deployment

18. **Move the backend off Vercel serverless** (or run a dedicated socket service). Required for
    WebSockets. Use WebSocket-only transport to avoid sticky sessions; if polling must stay
    enabled, configure LB sticky sessions (`ip_hash` or cookie affinity).
19. Horizontal scale: N instances + Redis adapter; no shared in-memory state.

---

## 8. What to change in 247GBS Affiliates

### API

1. Add `CentralChatClient` (§5.2) and a `ChatSessionService` for token refresh + Redis cache.
2. Add the `/messaging/*` proxy endpoints; keep response shapes close to the current hook
   (`conversations`, `messages`) so the UI work is small.
3. Add `conversations.central_conversation_id` migration (nullable, unique) for the legacy shim.
4. Add `users.mcom_user_id` index.
5. Add `GET /messaging/health` (central reachable, token mint works) for ops.
6. Add `MCOM_CHAT_ENABLED` feature flag (default off) and `MCOM_CENTRAL_SOCKET_URL`.
7. Optional outbound webhook receiver: extend `mcom/webhook.controller.ts` for
   `chat.message.created` so offline users get a local notification/badge.

### Web

8. Add `socket.io-client`.
9. Port `apps/frontend/src/services/chat/connection.ts` into
   `apps/web/lib/chat/connection.ts`, adapted with:
   - token provider → `GET /messaging/chat-session` (cookie auth),
   - fetch a fresh token on every reconnect,
   - memory-only token, no `localStorage`,
   - reconnect with exponential backoff + jitter,
   - `BroadcastChannel` multi-tab coordination (keep one socket per browser),
   - suspend on hidden/2-min idle, resume on focus/online.
10. `apps/web/hooks/useChat.ts`: React Query for history (via proxy) + socket events for live
    updates; optimistic send with `clientTempId` reconciliation; read receipts.
11. Replace the mock `ChatOverlay.tsx` with:
    - conversation list (title, avatar, last message, unread badge, online dot),
    - message thread (day separators, sender grouping, ticks for read receipts),
    - typing indicator, presence,
    - new-chat picker (directory search via `/messaging/directory`),
    - message-request accept/reject, block/unblock,
    - reconnect banner.
12. Badge + toast at the dashboard shell (port `ChatToastNotifications` logic).
13. Optional Web Push: ask Central for the VAPID key through the proxy, register the 247GBS service
    worker endpoint via `POST /messaging/push/subscribe`.

### Identity

14. Gate cross-platform chat on `user.mcomUserId`; otherwise show “Connect Central Hub” CTA.
15. Backfill active affiliates into Central (job + endpoint) so businesses can find them.

---

## 9. Performance targets & efficiency checklist

Targets (pilot, 1k concurrent sockets):

| Metric | Target |
|---|---|
| Message deliver p95 (same region) | < 150 ms |
| Typing indicator p95 | < 100 ms |
| Reconnect after network blip | < 3 s |
| Socket handshake (cold) | < 300 ms |
| Server RAM per 1k sockets | < 150 MB |
| DB queries per message | ≤ 3 (insert, conversation update, participant cursor) |

Efficiency work:

- [ ] WebSocket-only transport (no long-poll upgrade overhead).
- [ ] One socket per browser via `BroadcastChannel`; one socket per tab otherwise.
- [ ] No DB query on typing.
- [ ] No participant re-query on every message (reuse the send transaction's participants).
- [x] Single aggregate query for unread counts (remove N+1).
- [ ] Redis pub/sub adapter (fan-out without N² instance calls).
- [ ] Presence/typing TTL keys (self-expiring, no cron cleanup).
- [ ] Cursor pagination already bounded (`limit ≤ 100`).
- [ ] Compress large payloads / cap sizes; never send message bodies to users outside the room.
- [ ] Cache the chat access token server-side (247GBS) to avoid minting per request.
- [ ] Lazy-load the chat UI (route-level code split) and keep the socket idle-suspended.

---

## 10. Safety checklist

Authn / authz:

- [ ] WS handshake requires a valid `chat:ws` token (audience + scope + `tv`).
- [ ] `jti` consumed once in Redis (replay-proof) with 90s TTL.
- [ ] Membership re-verified on `join_conversation`; sends still verified in the service.
- [ ] Blocking / rejected-request / admin-exemption rules apply on every send path.
- [ ] Revocation disconnects sockets across all nodes via pub/sub.
- [ ] No token in URLs or `localStorage`.

Transport / origin:

- [ ] WSS only in production.
- [ ] Origin allowlist from `SsoClient.corsOrigins` + env; reject unknown origins.
- [ ] Credentials only where needed (Socket.IO auth payload, not cookies across origins).
- [ ] `maxHttpBufferSize` capped; ping/pong tuned.

Abuse:

- [ ] Redis-backed per-user rate limits (send/typing/join/session).
- [ ] Max sockets per user; optional max per IP.
- [ ] Message length/content validation; metadata size cap.
- [ ] Structured logs redact tokens and message content; include `userId` + `conversationId`.
- [ ] Audit events for block/unblock, request decisions, session mint failures.

Data:

- [ ] No message content in logs or metrics labels.
- [ ] Retention/purge policy for deleted messages (`deletedAt` exists; add a purge job later).
- [ ] Push payload contains no sensitive content beyond a snippet (already truncated).

---

## 11. Testing

Unit:

- `/chat/session` claim shape, audience, `tv`, client permission.
- Gateway handshake: expired token, wrong audience, replayed `jti`, revoked `tv`, deleted user.
- Presence service with mocked Redis (multi-node semantics).
- Typing TTL expiry; rate limiter.
- `getConversations` unread-count aggregation.

Integration (two real socket clients + one HTTP client):

- A sends over WS → B receives `new_message` + `inbox_update`; A gets ack with same id.
- Idempotent retry with the same `idempotencyKey` returns one message.
- Read receipt → `messages_read` to the room.
- Non-participant `join_conversation` → denied.
- Blocked user send → denied with the correct message.
- Reconnect with a fresh token after `tv` bump → rejected.
- Two server instances (docker compose + Redis) → cross-instance delivery.

Load (k6 or Artillery):

- 1k / 5k concurrent sockets, 20 msg/s per 100 users; measure p95, memory, Redis ops.
- Reconnect storm (kill one instance) → clients reconnect and resume without duplicates.

Security:

- Origin mismatch, token replay, oversized payload, event flood, unauthorized room, token in query
  string (must be rejected).

---

## 12. Rollout plan

| Phase | Deliverable | Flag | Exit criteria |
|---|---|---|---|
| 0 | Gateway hardening (adapter, CORS, presence, typing, outbox) | `CHAT_SCALE_V2` | Existing Central chat unaffected; 2-instance test passes |
| 1 | `/chat/session` + presence scoping + skill doc | `CHAT_SESSION_V1` | Security tests pass; partner doc published |
| 2 | 247GBS proxy + token cache + health | `MCOM_CHAT_ENABLED` (247GBS) | Proxy e2e passes for pilot accounts |
| 3 | 247GBS chat UI (list/thread/typing/receipts) | same flag, per-role | Pilot: agents + account managers |
| 4 | Requests, blocking, push, directory | same flag | Full affiliate rollout |
| 5 | Deprecate 247GBS polling messaging | — | No polling traffic for 7 days |

Rollback: turn off `MCOM_CHAT_ENABLED` → 247GBS falls back to local polling messaging. Central chat
is untouched because the new work is additive.

Deployment gate: confirm the reverse proxy (Nginx/Cloudflare) upgrades `/chat` WebSocket traffic and
that `REDIS_URL` is reachable from the API process. The VPS is a persistent host, so no managed
realtime provider is required.

---

## 13. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Reverse proxy strips WebSocket upgrade | WS cannot connect | Enable `Upgrade`/`Connection` forwarding in Nginx/Cloudflare and verify with `wscat` |
| In-memory presence/typing with >1 instance | Wrong online state, missed typing | Redis adapter + Redis presence/typing |
| Wide-open WS CORS | Any site can attempt connections | Origin allowlist; token still required |
| Long-lived token exposure in browser | Account takeover | 90s single-use WS token; REST stays server-side |
| Identity mismatch (same email, different person) | Messages to the wrong person | `mcomUserId` only, or verified email; explicit backfill |
| Local-only affiliates have no Central user | Businesses can't message them | Backfill job + “Connect Central Hub” gate |
| Dual stores (local + central) | Duplicates / drift | Central is sole source; local tables frozen after mapping |
| Fan-out cost in large groups | DB/CPU spikes | Cap group size, batch emits, cache participants |
| Redis outage | No cross-instance fan-out | Fail fast in prod; degrade to single-instance only in dev; health alert |
| Presence privacy | Leaks who is online | Scope to shared conversations via `watch_presence` |

---

## 14. Effort estimate

One senior full-stack dev, including tests:

| Workstream | Estimate |
|---|---|
| Central hardening (adapter, presence, typing, CORS, unread N+1, outbox) | 3–4 days |
| `/chat/session` + security tests + skill doc | 2–3 days |
| 247GBS proxy + token cache + identity/backfill | 3–4 days |
| 247GBS web chat (connection, hooks, UI, notifications) | 5–7 days |
| Load/security testing + observability + rollout | 3–4 days |
| **Total** | **~3–3.5 weeks** |

Pilot (single role, no push, no requests/blocking) can ship in ~1.5 weeks.

---

## 15. Open decisions (need product input)

1. **Hosting:** can the Central backend move to a persistent host, or must we use a managed realtime
   provider?
2. **Scope for v1:** direct 1:1 only, or groups on day one? (Recommend 1:1 + requests first.)
3. **Local-only affiliates:** require SSO for cross-platform chat, or backfill Central users for all
   active affiliates?
4. **247GBS local chat:** freeze it immediately, or keep it for affiliate↔affiliate and only bridge
   business↔affiliate?
5. **Push:** reuse Central Web Push (247GBS registers its SW endpoint) or build 247GBS-native push?
6. **Compliance:** message retention period and whether chat bodies may be stored for audit.

---

## 16. Concrete file map (first PRs)

Central:

```
apps/backend/package.json                                  + @socket.io/redis-adapter
apps/backend/src/main.ts                                   register RedisIoAdapter
apps/backend/src/chat/chat.adapter.ts                      (new) Redis adapter
apps/backend/src/chat/chat.gateway.ts                      CORS allowlist, watch_presence, no query token, no global presence, socket membership cache
apps/backend/src/chat/chat.controller.ts                   POST /chat/session
apps/backend/src/chat/dto/chat.dto.ts                       ChatSessionDto
apps/backend/src/chat/services/presence.service.ts         Redis-backed, TTL, pub/sub
apps/backend/src/chat/services/typing.service.ts           Redis-backed
apps/backend/src/chat/services/chat.service.ts             unread aggregate, pass participants to broadcast
apps/backend/src/chat/chat-outbox.processor.ts             (new) BullMQ processor
apps/backend/src/chat/chat.module.ts                       register queue/processor
apps/backend/src/queue/queue.constants.ts                  CHAT_OUTBOX_QUEUE
apps/frontend/src/components/admin/utils/ecosystemAccessSkillGenerator.ts  messaging section
```

247GBS:

```
apps/api/package.json                                      + socket.io? (not needed server-side)
apps/api/src/messaging/central-chat.client.ts              (new) server→central REST
apps/api/src/messaging/chat-session.service.ts             (new) token mint + Redis cache
apps/api/src/messaging/messaging.controller.ts             proxy endpoints
apps/api/src/messaging/messaging.service.ts                map central ↔ local shapes
apps/api/src/messaging/entities/conversation.entity.ts     + centralConversationId
apps/api/src/mcom/mcom.service.ts                          expose refresh/getStoredAccessToken
apps/web/package.json                                      + socket.io-client
apps/web/lib/chat/connection.ts                            (new) ported manager
apps/web/hooks/useChat.ts                                  (new)
apps/web/components/chat/*                                  (new) list, thread, composer, badges
apps/web/components/ChatOverlay.tsx                        replace mock
```

---

## 17. Implementation status

### Central Hub (done)

- Removed the Vercel serverless entrypoint and config (`apps/backend/api`, `apps/backend/vercel.json`).
- `RedisIoAdapter` (`apps/backend/src/chat/chat.adapter.ts`) — cross-instance Socket.IO fan-out;
  in-memory fallback in dev, fail-fast in production (`DISABLE_REDIS_SOCKET_ADAPTER=true` to opt out).
- WebSocket origin allowlist (`apps/backend/src/chat/chat-origins.ts`), refreshed alongside HTTP CORS;
  query-string tokens are no longer accepted.
- `ChatSessionService` + `POST /api/v1/chat/session` (`chat-session.controller.ts`) — app-to-app token
  minting: 15-minute REST token kept server-side + 90-second single-use socket token.
- `POST /api/v1/chat/socket-token` — lightweight reconnect path that mints only a socket token from a
  valid chat access token, so browser reconnects never re-run bcrypt client-credential checks.
- Presence is Redis-backed (`sAdd`/`sRem`/`sCard`) with a local hot path; presence updates are scoped
  to `presence:{userId}` watchers instead of broadcast globally.
- Typing indicators are mirrored into Redis and no longer query the DB on every keystroke.
- Socket membership is cached on join; `typing_*` never touches the database.
- Per-user socket rate limits (send/typing/join) backed by Redis counters.
- `watch_presence` / `unwatch_presence` only accept users who share a conversation.
- `GET /api/v1/chat/conversations` now uses **one** `groupBy` query for unread counts plus **one**
  batched presence lookup, removing the per-conversation N+1 (verified by a unit test asserting
  `message.count` is never called).
- `ChatOutbox` is now consumed by `ChatOutboxProcessor` (BullMQ). `sendMessage` enqueues the row id;
  the worker claims it atomically, creates the in-app notification, sends Web Push, retries with
  exponential backoff, and a per-minute sweeper re-enqueues rows left by a crashed process. If the
  queue is unavailable it falls back to inline processing. Verified end-to-end: the outbox row reached
  `COMPLETED` and the recipient notification was created by the worker.

### 247GBS Affiliates (done)

- `CentralChatClient` (`apps/api/src/messaging/central-chat.client.ts`) — server-side REST proxy,
  SSO-token refresh, in-memory chat-session cache, and participant/sender mapping to local ids.
- `/messaging/chat-session`, `/messaging/health`, `/messaging/directory`,
  `/messaging/conversations`, `/messaging/conversations/:id/messages`,
  `/messaging/conversations/:id/read` — local messaging remains as a fallback for users without a
  Central identity.
- Fixed `Task.executionUrl` entity typing (`@Column({ type: 'varchar' })`) which previously blocked
  TypeORM from booting.
- Web: `socket.io-client` connection manager (`apps/web/lib/chat/connection.ts`) that fetches a fresh
  single-use token on every reconnect, and a rewritten `useMessaging` hook with optimistic send +
  socket-first delivery + REST fallback.
- Shared `ChatWorkspace` (`apps/web/components/chat/ChatWorkspace.tsx`) with conversation list,
  unread badges, presence, typing, read-on-open, directory search, and new-conversation flow.
- Messaging pages and nav entries for **agent**, **account-manager**, **consultant**, **admin**, and
  **client** dashboards.

### Verification performed

- `tsc --noEmit` — Central API, 247GBS API, 247GBS web (only two pre-existing unrelated errors in
  `ProductSuite.tsx`/`AboutPage.tsx`).
- `jest src/chat` — 36 tests pass, including a real Socket.IO server/client round-trip
  (`chat.gateway.integration.spec.ts`), the session-token bridge
  (`chat-session.service.spec.ts`), the outbox worker (`chat-outbox.service.spec.ts`), and the
  single-query unread aggregation (`chat.service.spec.ts`).
- `jest src/messaging` (247GBS) — 4 tests covering token minting, participant/sender mapping, and the
  no-SSO guard.
- Production builds: Central API (`nest build`), 247GBS API (`nest build`), 247GBS web (`next build`).
- Live end-to-end against local Postgres + Redis:
  1. Central booted with `Redis Socket.IO adapter connected`.
  2. `POST /chat/session` issued a `chat:ws` token; a real socket joined a conversation and
     round-tripped a message; the replay of the same token was rejected; the message persisted.
  3. 247GBS API started, minted a socket token through Central using the stored SSO token, listed and
     mapped the conversation, found the business in the directory, connected the browser-style
     socket, sent a message, and sent a second message through the HTTP fallback. All messages
     persisted in Central.

---

## 18. VPS (Ubuntu) deployment notes

The API runs as a long-lived Node process on the VPS, so Socket.IO works without a managed realtime
provider. Two operational requirements:

1. **Redis must be running** (`REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`). In production the API refuses
   to start with an in-memory adapter, because that would silently drop cross-instance events.
2. **The reverse proxy must upgrade WebSockets.** Example Nginx location for the API:

```nginx
location / {
    proxy_pass         http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}
```

- The browser connects to `wss://<api-domain>/chat` (namespace), not `/api/v1`.
- `CHAT_ALLOWED_ORIGINS` (comma-separated) can add partner frontends without a DB change; registered
  apps' `corsOrigins` are merged automatically.
- If you run more than one API process, the Redis adapter is already in place — no sticky sessions
  are required because the clients use the WebSocket transport only.

Operational checks:

```bash
redis-cli ping                       # PONG
ss -ltnp | grep 3010                 # API listening
curl -i https://<api-domain>/api/v1/chat/socket-token   # 401 without a token (expected)
# browser devtools: WS connection to wss://<api-domain>/chat should be 101 Switching Protocols
```
