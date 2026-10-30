# MCOM Central — Partner (Rewards) API Runbook

Companion to [`partner-rewards-api.openapi.yaml`](./partner-rewards-api.openapi.yaml).

## 1. What Central exposes

| Surface | Endpoint | Scope | Flag |
|:--|:--|:--|:--|
| Membership catalogue | `GET /api/v1/partner/catalog/memberships[/:id]` | `central:read` | `CENTRAL_PARTNER_API_ENABLED` |
| Access catalogue | `GET /api/v1/partner/catalog/access-plans[/:id]` | `central:read` | `CENTRAL_PARTNER_API_ENABLED` |
| Recipient resolution | `GET /api/v1/partner/users/resolve` | `central:read` | `CENTRAL_PARTNER_API_ENABLED` |
| Membership grant | `POST /api/v1/partner/grants/membership` | `central:issue` | `+ CENTRAL_PARTNER_GRANTS_ENABLED` |
| Access-pass code | `POST /api/v1/partner/access-pass-codes` | `central:issue` | `+ CENTRAL_PARTNER_GRANTS_ENABLED` |
| Grant revocation | `POST /api/v1/partner/grants/:id/revoke` | `central:issue` | `+ CENTRAL_PARTNER_GRANTS_ENABLED` |
| Coupon create/inspect/revoke | `/api/v1/partner/coupons…` | `central:issue` / `central:read` | `+ CENTRAL_PARTNER_COUPONS_ENABLED` |
| Admin views | `/api/v1/admin/partner/{grants,access-codes,audit-logs}` | JWT ADMIN | n/a |

Disabled flags return **503 `FEATURE_DISABLED`**, never 404.

## 2. Inbound authentication model

- Central verifies RS256 tokens **offline** with its own public key
  (`ServiceKeyService.getPublicKey()`), the same key published at
  `/.well-known/jwks.json`. No self-HTTP call, so tests and local/staging work.
- Required claims: `iss = mcom-solutions` (`SERVICE_JWT_ISSUER`) and
  `aud = mcom-central` (`SERVICE_JWT_AUDIENCE`).
- Caller identity: `act.sub` when delegated (RFC 8693), otherwise `sub`.
  Headers such as `X-Caller-Id` are ignored.
- Ingress is deny-by-default. The caller must be an active, `serviceEnabled`
  `SsoClient`, and must appear in Central's `allowedCallers` registry list.
  `*` is a wildcard; an empty registry list denies everyone. `MCOM_ALLOWED_CALLERS`
  is used only when the `mcom-central` registry row is absent (bootstrap).
- Failure modes: missing/malformed/expired/wrong issuer/audience → **401**;
  unknown caller or caller not in `allowedCallers` → **403**; missing scope →
  **403**.

### Registry rows

| clientId | serviceScopes | allowedCallers | Notes |
|:--|:--|:--|:--|
| `mcom-central` | `central:read`, `central:issue` | `mcom-rewards` | system peer (seeded by migration) |
| `mcom-rewards` | `rewards:read`, `rewards:issue`, `central:read`, `central:issue` | — | `allowedAudiences` includes `mcom-central` |

Admins can change `allowedCallers` / scopes in **Admin → Console → Service Mesh
Policy** without a deploy. The registry cache refreshes within 60 seconds.

## 3. Idempotency

| Operation | Key | Guarantee |
|:--|:--|:--|
| Membership grant | `PartnerGrant (sourceApp='mcom-rewards', issuanceId)` + `BillingTransaction.providerPaymentId='rewards:<issuanceId>'` | Replay returns the same grant; exactly one ledger row and one membership activation. |
| Access-pass code | `AccessPassCode (sourceApp='mcom-rewards', externalRef=issuanceId)` | Replay returns the same code. |
| Coupon | `Coupon.code` + `(sourceApp, externalRef)` | Same code + same issuance → `replayed: true`; code owned by another source → `409 CODE_ALREADY_EXISTS`. |
| Events | `(issuanceId, event)` / `eventId` in payload | Consumer dedupes; delivery is at-least-once. |

Financial invariant: partner grants always write
`BillingTransaction.provider = 'mcom-rewards'`, `amount = 0`, and list price in
`metadata`. The unique `providerPaymentId` is the final defence against a
double activation under concurrency.

## 4. Event catalogue

Transport: the existing webhook dispatcher to `mcom-rewards` (signed with
`X-Mcom-Webhook-Signature: sha256=…`, retried with exponential backoff, every
attempt logged in `AppWebhookLog`). Asynchronous — the HTTP response never waits
for delivery.

| Event | Core payload | Trigger |
|:--|:--|:--|
| `central.membership.granted` | `issuanceId`, `businessId`, `planId`, `tier`, `startsAt`, `expiresAt` | after grant |
| `central.membership.expired` | `issuanceId`, `businessId`, `expiredAt` | hourly expiry sweep |
| `central.access_pass.code_created` | `issuanceId`, `code`, `accessPlanId` | after code creation |
| `central.access_pass.redeemed` | `issuanceId`, `code`, `businessId`, `redeemedAt` | after redemption |
| `central.coupon.created` | `issuanceId`, `code`, `lockedToUserId` | after create |
| `central.coupon.redeemed` | `issuanceId`, `code`, `businessId`, `userId`, `redeemedAt`, `discountAmount` | after redemption |
| `central.coupon.expired` | `issuanceId`, `code`, `expiredAt` | hourly sweep |
| `central.coupon.revoked` | `issuanceId`, `code`, `revokedAt` | after revoke/deactivate |
| `central.grant.revoked` | `grantId`, `issuanceId`, `kind`, `revokedAt` | after revoke |

Payload envelope (dispatcher): `{ event, platform, timestamp, data }`, where
`data` includes `issuanceId` and `eventId = "<issuanceId>:<event>"`.

**Replay a failed event:** Admin → Console → Webhooks → DLQ → Replay. The DLQ
job contains the original `platformIdentifier`, `event`, and `data`. You can also
re-run a specific lifecycle event by calling the internal service method
`EcosystemEventsService.emit(...)` from a one-off script.

## 5. Debugging playbooks

### Failed membership grant

1. Check the error `code` and HTTP status:
   - `404 RECIPIENT_NOT_FOUND` — user id/email wrong or soft-deleted.
   - `422 RECIPIENT_NOT_A_BUSINESS` — consumer has no `BusinessProfile`.
   - `422 PLAN_NOT_AVAILABLE` — plan archived/deleted or wrong id.
   - `422 TIER_NOT_AVAILABLE` — tier row missing for that plan.
   - `422 INVALID_DURATION` — `durationDays <= 0`.
   - `409 MEMBERSHIP_CONFLICT` — recipient has a different active plan/tier;
     resend with `replaceExisting: true` only with product approval.
2. Inspect `partner_grants` and `partner_audit_logs` by `issuance_id`.
3. Inspect `BillingTransaction` where `provider_payment_id = 'rewards:<issuanceId>'`.
4. If the reward was already applied, replay is safe: same `issuanceId` returns
   `replayed: true` and does not duplicate data.
5. If a grant exists but Central membership looks wrong, check
   `BusinessProfile.membership_*`, `EcosystemSubscription`, and `PlatformPackage`
   rows for the business.

### Revoke a coupon or access code

- Coupon: `POST /partner/coupons/:code/revoke` (partner) or Admin → Coupons →
  deactivate. Deactivating a partner coupon emits `central.coupon.revoked`.
  If a completed redemption exists → `409 COUPON_ALREADY_REDEEMED`; do not
  force-revoke, escalate to product/finance.
- Access code: `POST /partner/grants/:id/revoke` where `id` is the
  `PartnerGrant.id`. Only `UNUSED` codes are revocable; `REDEEMED` → `409
  GRANT_NOT_REVOCABLE`.
- Membership: revocable only when the ledger row is zero-amount
  `mcom-rewards` **and** there is no recurring mandate/instalment. Otherwise the
  API returns `409 GRANT_NOT_REVOCABLE`; cancel the subscription through the
  normal billing flow instead.

### Consumer recipient / business-only access passes

Memberships and access-pass **redemption** are business-scoped. A consumer can
receive an access-pass code, but redemption fails until they have a
`BusinessProfile`. Resolution returns `businessId: null` for consumers; grants
return `422 RECIPIENT_NOT_A_BUSINESS`. Do not create “shadow” business profiles
for rewards recipients — ask the recipient to complete business onboarding.

### Membership conflict

The recipient already has an active different plan/tier. Options:
- Stack same plan/tier with `extendExisting: true`.
- Replace with `replaceExisting: true` (starts from now; old term is discarded).
- Wait for the current term to end.

### Feature disabled

`503 FEATURE_DISABLED` means the relevant env flag is off:
`CENTRAL_PARTNER_API_ENABLED`, `CENTRAL_PARTNER_GRANTS_ENABLED`,
`CENTRAL_PARTNER_COUPONS_ENABLED`, or `CENTRAL_PARTNER_EVENTS_ENABLED`.

## 6. Rollout sequence

1. Deploy the inbound guard + migration (registers `mcom-central`, extends
   `mcom-rewards` with `central:*` scopes and `mcom-central` audience).
2. Verify `GET /api/v1/ecosystem/services/mcom-central` and that Rewards can mint
   `aud=mcom-central`, `scope=central:read`.
3. Enable `CENTRAL_PARTNER_API_ENABLED=true` in staging. Exercise catalogue and
   recipient resolution.
4. Enable grants for a pilot recipient.
5. Enable access-pass code issuance for a pilot.
6. Enable partner coupons for a pilot.
7. Enable events (`CENTRAL_PARTNER_EVENTS_ENABLED=true`) and confirm Rewards
   webhook delivery in `AppWebhookLog`.
8. GA + monitoring.

## 7. Migrations & rollback

Migration: `20261029000000_partner_rewards_api`.

Adds:
- `partner_grants`, `partner_audit_logs`, enums.
- `access_pass_codes.purchaser_business_id` nullable + `source_app` / `external_ref`.
- `coupons.source_app` / `external_ref` / `expiry_event_sent_at`.
- `BillingTransaction.metadata`.
- Seeds `mcom-central` and extends `mcom-rewards` registry fields.

All changes are additive/non-destructive; existing coupons and access codes keep
`source_app = NULL` and current `purchaser_business_id`. Rolling back requires a
new forward migration; the reverse SQL is documented at the bottom of the
migration file. Do not drop `partner_grants` while Rewards still references
issuance ids.

## 8. Rate limits & payload limits

- Catalogue / recipient reads: 120 and 60 requests per minute per caller.
- Grants / coupons / revocation: 30 requests per minute per caller.
- Plan-id arrays are capped at 50 entries by DTO validation
  (`@ArrayMaxSize`); oversized payloads are rejected by the global pipe.

## 9. Observability

- `partner_audit_logs` — every mutation with caller, scope, action, target,
  issuance id, outcome, status/error code.
- `ServiceTokenAudit` — every issued token (unchanged).
- `AppWebhookLog` — every event delivery attempt.
- Logs include `issuanceId`, `grantId`, `couponCode`, and caller; never tokens or
  passwords.
