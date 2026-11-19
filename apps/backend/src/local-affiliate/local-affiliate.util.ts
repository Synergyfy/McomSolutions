import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { formatAffiliateCode } from './local-affiliate.constants';

/** Minimal Prisma surface needed for code allocation (client or tx). */
export interface RawQueryClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Promise<T>;
}

/**
 * Allocates the next permanent affiliate code inside the caller's transaction.
 * Uses a dedicated Postgres sequence so concurrent activations cannot collide.
 */
export async function nextAffiliateCode(
  client: RawQueryClient,
): Promise<string> {
  const rows = await client.$queryRawUnsafe<
    Array<{ nextval: bigint | number | string }>
  >(`SELECT nextval('local_affiliate_code_seq') AS nextval`);
  const raw = rows?.[0]?.nextval;
  const sequence = Number(raw);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    throw new Error('Could not allocate an affiliate code sequence value');
  }
  return formatAffiliateCode(sequence);
}

/** base62 — URL-safe and case-sensitive. */
const BASE62 =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Opaque tracking-link token. Deliberately contains no affiliate code, offer id
 * or campaign id: exactly one opaque value crosses an external boundary, and
 * everything else is resolved server-side.
 */
export function generateTrackingCode(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE62[bytes[i] % BASE62.length];
  }
  return out;
}

/** No 0/O/1/I/L — these get misread over the phone and on printed vouchers. */
const VOUCHER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateVoucherCode(): string {
  const bytes = crypto.randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += VOUCHER_ALPHABET[bytes[i] % VOUCHER_ALPHABET.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function slugify(input: string, fallback = 'offer'): string {
  const base = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || fallback;
}

/**
 * Appends a short random suffix so slugs stay stable-ish but unique without a
 * second round-trip.
 */
export function uniqueSlug(input: string, fallback = 'offer'): string {
  return `${slugify(input, fallback)}-${crypto.randomBytes(3).toString('hex')}`;
}

/** IPs are hashed, never stored raw (privacy requirement). */
export function hashIp(ip?: string | null): string | null {
  const value = (ip ?? '').trim();
  if (!value) return null;
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 32);
}

/** Stable per-customer dedupe key for voucher redemptions. */
export function identityKey(value?: string | null): string {
  const trimmed = (value ?? '').trim().toLowerCase();
  if (!trimmed) return `anon:${crypto.randomBytes(8).toString('hex')}`;
  return crypto.createHash('sha256').update(trimmed).digest('hex').slice(0, 40);
}

export function toDecimal(
  value: Prisma.Decimal | number | string | null | undefined,
): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
}

const ROUND_HALF_UP = Prisma.Decimal.ROUND_HALF_UP;

/** Reward units are whole for POINTS and 2dp for CREDIT. */
export function roundUnits(
  value: Prisma.Decimal,
  unit: 'POINTS' | 'CREDIT',
): Prisma.Decimal {
  return value.toDecimalPlaces(unit === 'POINTS' ? 0 : 2, ROUND_HALF_UP);
}

/** Minor units (pence) → major units as a Decimal. */
export function minorToMajor(minor: number | null | undefined): Prisma.Decimal {
  if (minor === null || minor === undefined) return new Prisma.Decimal(0);
  return new Prisma.Decimal(minor).dividedBy(100);
}

/** Appends a query param without breaking existing ones. */
export function appendQueryParam(url: string, key: string, value: string): string {
  const encoded = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  const hashIndex = url.indexOf('#');
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
  const base = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${encoded}${hash}`;
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
