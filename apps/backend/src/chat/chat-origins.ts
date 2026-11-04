/**
 * WebSocket origin allowlist.
 *
 * HTTP CORS is refreshed from the database (`SsoClient.corsOrigins`) in
 * `main.ts` every 60s. Socket.IO's `@WebSocketGateway` decorator is evaluated
 * at class-definition time, so it cannot read the DB asynchronously. Instead we
 * keep a mutable module-level set that `main.ts` refreshes alongside the HTTP
 * allowlist; the gateway consults it on every handshake.
 *
 * `CHAT_ALLOWED_ORIGINS` (comma-separated) is merged in as an escape hatch for
 * new partner frontends before their Console record is updated.
 */
const DEFAULT_ORIGINS = [
  // Central Hub web (Vite)
  'http://localhost:5173',
  'http://localhost:3000',
  // Central Hub production domain(s)
  'https://centralhubsolution.com',
  'https://www.centralhubsolution.com',
  // 247GBS Affiliates web (Next.js)
  'http://localhost:7089',
  'http://127.0.0.1:7089',
  'https://247gbsaffiliates.com',
  'https://www.247gbsaffiliates.com',
];

let allowedOrigins = new Set<string>(DEFAULT_ORIGINS);

/** Replace the runtime allowlist. Called at boot and on every CORS refresh. */
export function setChatAllowedOrigins(origins: Iterable<string>): void {
  const next = new Set<string>(DEFAULT_ORIGINS);
  for (const origin of origins) {
    if (origin && typeof origin === 'string') next.add(origin.trim());
  }
  allowedOrigins = next;
}

/** Current allowlist (for diagnostics/tests). */
export function getChatAllowedOrigins(): string[] {
  return Array.from(allowedOrigins);
}

/**
 * A missing Origin header (native apps, server-to-server clients, tests) is
 * allowed — CORS is a browser boundary, and token auth is the real gate.
 * Every browser origin must be explicitly allowlisted.
 */
export function isChatOriginAllowed(origin?: string | null): boolean {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  const envExtra = (process.env.CHAT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return envExtra.includes(origin);
}
