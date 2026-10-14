/**
 * Ecosystem service peer-policy semantics.
 *
 * Directed access control between registered app backends:
 *  - `allowedAudiences` (egress) — who an app may call.
 *  - `allowedCallers`   (ingress) — who may call an app.
 *
 * Policy is DENY BY DEFAULT:
 *  - empty / missing list  → no peers allowed
 *  - contains `*`          → any registered peer allowed (wildcard)
 *  - otherwise             → only the listed clientIds
 */

export const SERVICE_PEER_WILDCARD = '*';

/** Normalize a peer list: trim, drop blanks, de-duplicate. */
export function normalizePeerList(list?: string[] | null): string[] {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map((v) => (v ?? '').trim()).filter(Boolean))];
}

/**
 * True when `peer` is permitted by `list` under deny-by-default semantics.
 * `peer` is a canonical app clientId (or platformSlug).
 */
export function isPeerAllowed(
  list: string[] | null | undefined,
  peer: string | null | undefined,
): boolean {
  const peers = normalizePeerList(list);
  if (peers.length === 0) return false;
  if (peers.includes(SERVICE_PEER_WILDCARD)) return true;
  if (!peer) return false;
  return peers.includes(peer);
}
