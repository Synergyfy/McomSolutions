import * as crypto from 'crypto';

/**
 * Referral codes are short 8-char uppercase alphanumeric values that are easy
 * to read out or share. Uniqueness is enforced by the DB `@unique` constraint;
 * the retry loop only absorbs the rare collision.
 *
 * Admin accounts are deliberately excluded from the referral programme.
 */
export const REFERRAL_EXCLUDED_ROLES = ['ADMIN'] as const;

/**
 * Minimal shape of the Prisma client / transaction used for code lookups.
 * Kept intentionally loose so both `PrismaService` and `$transaction(tx)`
 * callbacks can be passed without generic gymnastics.
 */
export interface ReferralCodeLookup {
  user: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique(args: any): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(args: any): Promise<any>;
  };
}

export function isReferralEligibleRole(role?: string | null): boolean {
  if (!role) return false;
  return !(REFERRAL_EXCLUDED_ROLES as readonly string[]).includes(role.toUpperCase());
}

export function generateReferralCodeCandidate(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/** Builds the shareable `?ref=` registration link for a code. */
export function buildReferralLink(
  frontendUrl: string | null | undefined,
  code: string,
): string {
  const baseUrl = frontendUrl ?? process.env.FRONTEND_URL ?? '';
  return `${baseUrl.replace(/\/$/, '')}/register?ref=${code}`;
}

/**
 * Generates a referral code that does not already exist, retrying on
 * collisions and falling back to 12 hex chars (48 bits) if the 8-char space
 * is unusually congested.
 */
export async function generateUniqueReferralCode(
  lookup: ReferralCodeLookup,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateReferralCodeCandidate();
    const existing = await lookup.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = crypto.randomBytes(6).toString('hex').toUpperCase();
    const existing = await lookup.user.findUnique({
      where: { referralCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Could not generate a unique referral code');
}

/**
 * Lazy backfill used by profile/SSO reads so an existing non-admin account
 * never shows "no referral code" while a bulk backfill is pending.
 *
 * Returns the code (existing or newly assigned), or `null` for admin accounts.
 */
export async function ensureUserReferralCode(
  client: ReferralCodeLookup,
  user: { id: string; role?: string | null; referralCode?: string | null },
): Promise<string | null> {
  if (!isReferralEligibleRole(user.role)) return null;
  if (user.referralCode) return user.referralCode;

  const code = await generateUniqueReferralCode(client);
  try {
    await client.user.update({ where: { id: user.id }, data: { referralCode: code } });
    return code;
  } catch {
    // A concurrent request may have won the race — use the persisted value.
    const fresh = await client.user.findUnique({
      where: { id: user.id },
      select: { referralCode: true },
    });
    return fresh?.referralCode ?? null;
  }
}
