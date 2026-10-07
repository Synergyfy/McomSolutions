import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

import { encrypt } from '../console/crypto.util';

interface SsoSeedDescriptor {
  clientId: string;
  name: string;
  platformSlug: string;
  redirectUris: string[];
  scopes: string[];
  appUrl: string | null;
  billingApiUrl: string | null;
  corsOrigins: string[];
  /** Env var holding the client secret (required to create). */
  secretEnv: string;
  /** Env var holding the public API key (optional — generated if absent outside prod). */
  apiKeyEnv: string;
  /** Env vars for HMAC / webhook secrets (optional — stored null if absent). */
  hmacEnv?: string;
  webhookEnv?: string;
}

const SSO_SEED_CLIENTS: SsoSeedDescriptor[] = [
  // NOTE: '247gbs' seed retired — do not re-add; it is deleted from staging
  // and must not be recreated on boot. Re-register via Console if ever needed.
  {
    clientId: 'mcom-mall',
    name: 'MCOM Mall',
    platformSlug: 'mall',
    redirectUris: [
      'http://localhost:3003/auth/callback',
      'https://mcommall.vercel.app/auth/callback',
      'http://localhost:3000/auth/callback',
      'http://localhost:3001/auth/callback',
      'http://localhost:3002/auth/callback',
      'http://localhost:5173/auth/callback',
    ],
    scopes: ['profile', 'email', 'business', 'membership', 'packages'],
    appUrl: 'http://localhost:3003',
    billingApiUrl: 'http://localhost:3006',
    corsOrigins: ['http://localhost:3003', 'http://localhost:3006', 'https://mcommall.vercel.app'],
    secretEnv: 'SSO_SEED_MALL_CLIENT_SECRET',
    apiKeyEnv: 'SSO_SEED_MALL_API_KEY',
    hmacEnv: 'SSO_SEED_MALL_HMAC_SECRET',
    webhookEnv: 'SSO_SEED_MALL_WEBHOOK_SECRET',
  },
  {
    clientId: '247gbs-affiliate',
    name: '247GBS Affiliates',
    platformSlug: '247gbs_affiliate',
    redirectUris: [
      'http://localhost:7088/api/v1/auth/sso/callback',
      'http://localhost:7089/auth/callback',
      'https://247gbsaffiliates.com/auth/callback',
    ],
    scopes: ['profile', 'email', 'business', 'membership'],
    appUrl: 'http://localhost:7089',
    billingApiUrl: null,
    corsOrigins: ['http://localhost:7088'],
    secretEnv: 'SSO_SEED_247GBS_AFFILIATE_CLIENT_SECRET',
    apiKeyEnv: 'SSO_SEED_247GBS_AFFILIATE_API_KEY',
  },
];

function randomHex(bytes: number): string {
  return crypto.randomBytes(bytes).toString('hex');
}

// ─── Phase 5: soft-delete query extension ──────────────────────────────
// `$use` middleware was removed in Prisma 6 — this client extension is its
// replacement. Applies to the eight models carrying `deletedAt` (User,
// BusinessProfile, the four affiliate profile tables, plus G5 catalogue /
// programme tables: MembershipPlan, BusinessProgramme):
// - findFirst / findMany / findFirstOrThrow / count (and deleteMany): inject
//   `deletedAt: null` unless the caller set deletedAt explicitly (so a future
//   trash-view can pass `deletedAt: { not: null }` to opt out).
// - findUnique / findUniqueOrThrow: Prisma rejects non-unique filters here, so
//   qualifying reads are re-dispatched to findFirst / findFirstOrThrow.
// Writes (create/update/upsert/delete) are deliberately unfiltered — delete
// flows stamp deletedAt explicitly, and restores must reach trashed rows.
// NOTE: delegates are copied onto the service instance (see constructor), so
// interactive `$transaction` callbacks (`tx.*`) use the BASE client.
// Transaction bodies must therefore keep their own explicit `deletedAt` checks
// where it matters (delete flows re-verify outside the tx first).
type SoftDeleteModel =
  | 'user'
  | 'businessProfile'
  | 'customerProfile'
  | 'agentProfile'
  | 'consultantProfile'
  | 'accountManagerProfile'
  | 'membershipPlan'
  | 'businessProgramme';

function callerSetDeletedAt(where: unknown): boolean {
  return !!where && typeof where === 'object' && 'deletedAt' in (where as Record<string, unknown>);
}

function withDeletedAt<T extends { where?: unknown }>(args: T): T {
  if (!args) return { ...(args as object), where: { deletedAt: null } } as T;
  if (callerSetDeletedAt((args as { where?: unknown }).where)) return args;
  return { ...args, where: { ...(args.where as object), deletedAt: null } };
}

// Prisma 6.19 only honors the OBJECT form of `$extends` (callback-form
// extensions produce a client with undefined delegates — verified at runtime).
// `findUnique` redispatch therefore goes through a module-level ref to the
// extended client, assigned in the constructor (PrismaService is a singleton).
let extendedClientRef: Record<string, any> | null = null;

function softDeleteModelHooks(model: SoftDeleteModel): Record<string, any> {
  const needsFilter = (args: any) => !callerSetDeletedAt(args?.where);
  // NOTE: params are typed `any` so the hooks stay assignable to Prisma's
  // per-operation QueryOptions shapes (which also carry model/operation).
  return {
    async findUnique({ args, query }: any) {
      if (needsFilter(args) && extendedClientRef) {
        return extendedClientRef[model].findFirst(withDeletedAt(args ?? {}));
      }
      return query(args);
    },
    async findUniqueOrThrow({ args, query }: any) {
      if (needsFilter(args) && extendedClientRef) {
        return extendedClientRef[model].findFirstOrThrow(withDeletedAt(args ?? {}));
      }
      return query(args);
    },
    async findFirst({ args, query }: any) {
      return query(withDeletedAt(args ?? {}));
    },
    async findFirstOrThrow({ args, query }: any) {
      return query(withDeletedAt(args ?? {}));
    },
    async findMany({ args, query }: any) {
      return query(withDeletedAt(args ?? {}));
    },
    async count({ args, query }: any) {
      return query(withDeletedAt(args ?? {}));
    },
  };
}

// Explicit `any` typing: Prisma 6's defineExtension inference rejects
// dynamically-built hook maps, and the runtime behavior is what matters here.
// Call-site types are unaffected (the service keeps its PrismaClient type).
const softDeleteExtension: any = {
  query: {
    user: softDeleteModelHooks('user'),
    businessProfile: softDeleteModelHooks('businessProfile'),
    customerProfile: softDeleteModelHooks('customerProfile'),
    agentProfile: softDeleteModelHooks('agentProfile'),
    consultantProfile: softDeleteModelHooks('consultantProfile'),
    accountManagerProfile: softDeleteModelHooks('accountManagerProfile'),
    membershipPlan: softDeleteModelHooks('membershipPlan'),
    businessProgramme: softDeleteModelHooks('businessProgramme'),
  },
};

// ─── Phase 6: slow-query logging ─────────────────────────────────────────
// Warns on operations slower than SLOW_QUERY_MS (default 100, fail-safe on
// garbage input). Logs model + operation + duration ONLY — never args/data,
// which may contain passwords, tokens, or PII.
const slowQueryLogger = new Logger('Prisma');

function slowQueryThresholdMs(): number {
  const parsed = parseInt(process.env.SLOW_QUERY_MS ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return 100;
}

// Same `any` rationale as softDeleteExtension above (Prisma 6 inference
// rejects dynamically-built hook maps; runtime behavior is what matters).
const slowQueryExtension: any = {
  query: {
    async $allOperations({ model, operation, args, query }: any) {
      const threshold = slowQueryThresholdMs();
      const start = Date.now();
      try {
        return await query(args);
      } finally {
        const duration = Date.now() - start;
        if (duration > threshold) {
          slowQueryLogger.warn(`Slow query (${duration}ms > ${threshold}ms): ${model}.${operation}`);
        }
      }
    },
  },
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Phase 6: full query log in dev; warn/error only elsewhere (prod
      // slowness is covered by slowQueryExtension above).
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn'] : ['warn', 'error'],
    });
    // Apply the soft-delete extension to the two identity delegates.
    // (Copied per-delegate rather than reassigning the whole client so the
    // service keeps its exact PrismaClient type for all call sites.)
    const extended = (this as PrismaClient)
      .$extends(softDeleteExtension)
      .$extends(slowQueryExtension);
    extendedClientRef = extended as unknown as Record<string, any>;
    for (const delegate of [
      'user',
      'businessProfile',
      'customerProfile',
      'agentProfile',
      'consultantProfile',
      'accountManagerProfile',
      'membershipPlan',
      'businessProgramme',
    ] as const) {
      (this as any)[delegate] = (extended as any)[delegate];
    }
  }

  // NOTE (Phase 5): soft-delete filtering is enforced by the client extension
  // above for User/BusinessProfile reads through this service. Explicit
  // `deletedAt` conditions at call sites are preserved (opt-out for trash views).
  async onModuleInit() {
    await this.$connect();
    // Skip seeding in test environments — it runs bcrypt + DB queries on every
    // module bootstrap which saturates CPU when Jest spins up multiple workers.
    if (process.env.NODE_ENV !== 'test') {
      await this.seedDefaultSsoClients();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Insert-only SSO client seeder (Phase 1A remediation).
   *
   * - No secrets live in git. All secret material comes from `SSO_SEED_*` env vars.
   * - Existing rows are never re-seeded: only non-secret metadata
   *   (redirect URIs, CORS origins, app URLs) is merged.
   * - Production fails closed: a missing secret for a not-yet-provisioned client
   *   throws instead of creating a weak/guessable credential.
   */
  private async seedDefaultSsoClients() {
    try {
      const isProd = process.env.NODE_ENV === 'production';
      const encryptionKey = process.env.CONSOLE_ENCRYPTION_KEY;

      for (const client of SSO_SEED_CLIENTS) {
        const existing = await this.ssoClient.findUnique({
          where: { clientId: client.clientId },
        });

        if (existing) {
          // Preserve custom URIs and fields added directly to DB, only append missing defaults if any.
          // Never touch secret material on existing rows — rotation happens via the console flow.
          const mergedUris = Array.from(new Set([...existing.redirectUris, ...client.redirectUris]));
          const mergedCors = Array.from(new Set([...(existing.corsOrigins || []), ...(client.corsOrigins || [])]));
          const updates: Record<string, unknown> = {};
          if (mergedUris.length !== existing.redirectUris.length) {
            updates.redirectUris = mergedUris;
          }
          if (mergedCors.length !== (existing.corsOrigins || []).length) {
            updates.corsOrigins = mergedCors;
          }
          if (client.platformSlug && existing.platformSlug !== client.platformSlug) {
            updates.platformSlug = client.platformSlug;
          }
          if (client.billingApiUrl && !existing.billingApiUrl) {
            updates.billingApiUrl = client.billingApiUrl;
          }
          if (client.appUrl && !existing.appUrl) {
            updates.appUrl = client.appUrl;
          }
          if (Object.keys(updates).length > 0) {
            await this.ssoClient.update({
              where: { clientId: client.clientId },
              data: updates,
            });
          }
          continue;
        }

        const rawSecret = (process.env[client.secretEnv] || '').trim();
        if (!rawSecret) {
          if (isProd) {
            throw new Error(
              `[Seed] Missing required ${client.secretEnv} for SSO client "${client.clientId}" — refusing to create a weak credential in production.`,
            );
          }
          // Non-production convenience: skip instead of inventing a committed secret.
          // Operators can set SSO_SEED_* env vars or provision via the console rotation flow.
          console.warn(
            `[Seed] Skipping SSO client "${client.clientId}" — ${client.secretEnv} is not set.`,
          );
          continue;
        }

        let apiKey = (process.env[client.apiKeyEnv] || '').trim();
        if (!apiKey) {
          if (isProd) {
            throw new Error(
              `[Seed] Missing required ${client.apiKeyEnv} for SSO client "${client.clientId}" in production.`,
            );
          }
          apiKey = `ak_${randomHex(24)}`;
        }

        const rawHmacSecret = client.hmacEnv ? (process.env[client.hmacEnv] || '').trim() : '';
        const rawWebhookSecret = client.webhookEnv ? (process.env[client.webhookEnv] || '').trim() : '';
        if (!encryptionKey && (rawHmacSecret || rawWebhookSecret)) {
          console.warn(
            `[Seed] CONSOLE_ENCRYPTION_KEY is not set — storing null HMAC/webhook secrets for "${client.clientId}".`,
          );
        }
        const hmacSecret =
          rawHmacSecret && encryptionKey ? encrypt(rawHmacSecret, encryptionKey) : null;
        const webhookSecret =
          rawWebhookSecret && encryptionKey ? encrypt(rawWebhookSecret, encryptionKey) : null;

        const salt = await bcrypt.genSalt(12);
        const clientSecret = await bcrypt.hash(rawSecret, salt);

        await this.ssoClient.create({
          data: {
            clientId: client.clientId,
            clientSecret,
            name: client.name,
            redirectUris: client.redirectUris,
            scopes: client.scopes,
            apiKey,
            platformSlug: client.platformSlug ?? null,
            appUrl: client.appUrl ?? null,
            billingApiUrl: client.billingApiUrl ?? null,
            corsOrigins: client.corsOrigins ?? [],
            hmacSecret: hmacSecret ?? null,
            webhookSecret: webhookSecret ?? null,
            isActive: true,
          },
        });
        console.log(`[Seed] Created default SSO client: ${client.clientId}`);
      }
    } catch (err) {
      console.error('[Seed] Error seeding default SSO clients:', err);
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
    }
  }
}
