/**
 * Inbound ecosystem service-mesh constants.
 *
 * Central is a *callee* as well as an issuer. Partner backends present the
 * RS256 service tokens minted by the MCOM control plane; we verify them offline
 * against our own public key (no self-HTTP call) and enforce deny-by-default
 * ingress.
 */

/** Issuer claim every ecosystem service token must carry. */
export const SERVICE_MESH_ISSUER = 'mcom-solutions';

/** Audience Central accepts. Tokens for other apps are rejected. */
export const SERVICE_MESH_AUDIENCE = 'mcom-central';

/** Catalogue reads, recipient resolution, status reads. */
export const SERVICE_SCOPE_CENTRAL_READ = 'central:read';

/** Grants, access-pass codes, coupon create/revoke. */
export const SERVICE_SCOPE_CENTRAL_ISSUE = 'central:issue';

export const SERVICE_MESH_SCOPES = [
  SERVICE_SCOPE_CENTRAL_READ,
  SERVICE_SCOPE_CENTRAL_ISSUE,
] as const;

/** Registry clientId used for Central itself + the Rewards peer. */
export const MCOM_CENTRAL_CLIENT_ID = 'mcom-central';
export const MCOM_REWARDS_CLIENT_ID = 'mcom-rewards';

/** The app that receives Central lifecycle events. */
export const PARTNER_EVENT_TARGET = MCOM_REWARDS_CLIENT_ID;

export const SERVICE_MESH_CONFIG = {
  issuer: 'SERVICE_JWT_ISSUER',
  audience: 'SERVICE_JWT_AUDIENCE',
  allowedCallers: 'MCOM_ALLOWED_CALLERS',
} as const;

/** Feature flags — disabled endpoints return 503 FEATURE_DISABLED. */
export enum PartnerFeature {
  /** Master switch for the whole /partner surface. */
  API = 'CENTRAL_PARTNER_API_ENABLED',
  GRANTS = 'CENTRAL_PARTNER_GRANTS_ENABLED',
  COUPONS = 'CENTRAL_PARTNER_COUPONS_ENABLED',
  EVENTS = 'CENTRAL_PARTNER_EVENTS_ENABLED',
}

/** Error code returned when a feature flag is off. */
export const FEATURE_DISABLED_CODE = 'FEATURE_DISABLED';

/**
 * Colon-separated service scopes accepted from a token. The `scope` claim is
 * space-delimited (RFC 6749); some issuers send an array instead.
 */
export function parseScopes(payload: Record<string, unknown>): string[] {
  const raw = payload['scope'] ?? payload['scopes'];
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/\s+/)
      : [];
  return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
}
