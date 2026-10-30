import { Prisma } from '@prisma/client';
import { ssoUserInfoSelect } from './profile-selects';

/**
 * A user record shaped by {@link ssoUserInfoSelect} — the full identity,
 * contact and role-specific profile payload shared by every SSO surface.
 */
export type SsoUserRecord = Prisma.UserGetPayload<{
  select: typeof ssoUserInfoSelect;
}>;

/**
 * Canonical identity returned to partner applications. The same shape is
 * returned by `POST /auth/sso/token`, `GET /auth/sso/userinfo`,
 * `GET /auth/sso/entitlement` and embedded in the dashboard handshake token,
 * so a partner can provision a local account without a second call.
 */
export interface SsoIdentity {
  id: string;
  sub: string;
  email: string;
  role: string;
  /** Explicit discriminator for which profile object is populated. */
  profileType: string;
  /** True when the user signed up through an affiliate/partner portal. */
  isAffiliate: boolean;

  firstName: string | null;
  lastName: string | null;
  /** "First Last" — a person's name, never the business name. */
  fullName: string;
  /** Display name: the business name for businesses, otherwise the person's name. */
  name: string;
  jobTitle: string | null;
  avatarUrl: string | null;

  // ── Contact details (role-agnostic, resolved from whichever profile exists) ─
  phone: string | null;
  address: string | null;
  postcode: string | null;
  country: string | null;

  // ── Business convenience fields (null for non-business roles) ──────────────
  businessId: string | null;
  businessName: string | null;
  membershipLevel: string | null;
  membershipTier: string | null;
  membershipStatus: string | null;
  membershipPlanName: string | null;
  membershipExpiresAt: Date | null;
  hasPaidVerificationFee: boolean | null;
  trialAccessExpiresAt: Date | null;

  // ── Role-specific profiles (exactly one is non-null) ───────────────────────
  businessProfile: SsoUserRecord['businessProfile'];
  customerProfile: SsoUserRecord['customerProfile'];
  agentProfile: SsoUserRecord['agentProfile'];
  consultantProfile: SsoUserRecord['consultantProfile'];
  accountManagerProfile: SsoUserRecord['accountManagerProfile'];
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Builds the unified SSO identity payload from a {@link SsoUserRecord}.
 *
 * Contact details are resolved from the profile that actually owns them so
 * agents / affiliates / consultants / account managers get the same
 * first name, last name, email and phone treatment as businesses.
 */
export function buildSsoIdentity(user: SsoUserRecord): SsoIdentity {
  const business = user.businessProfile;
  const customer = user.customerProfile;
  const agent = user.agentProfile;
  const consultant = user.consultantProfile;
  const accountManager = user.accountManagerProfile;

  const firstName = clean(user.firstName);
  const lastName = clean(user.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  // First profile that carries a phone number wins. A person-level phone is
  // never stored on `User`, so this is the closest available contact number.
  const phone =
    clean(business?.phone) ??
    clean(agent?.phone) ??
    clean(consultant?.phone) ??
    clean(accountManager?.phone) ??
    clean(customer?.phone) ??
    null;

  const profileType = user.role;

  return {
    id: user.id,
    sub: user.id,
    email: user.email,
    role: user.role,
    profileType,
    isAffiliate: user.registrationSource === 'affiliate-portal',

    firstName,
    lastName,
    fullName,
    name: business?.businessName || fullName || user.email.split('@')[0],
    jobTitle: clean(user.jobTitle),
    avatarUrl: business?.logoUrl ?? null,

    phone,
    address: business?.address ?? null,
    postcode: business?.postcode ?? null,
    country: business?.country ?? null,

    businessId: business?.id ?? null,
    businessName: business
      ? business.businessName?.trim() || fullName || user.email.split('@')[0]
      : null,
    membershipLevel: business?.membershipLevel ?? null,
    membershipTier: business?.membershipTier ?? null,
    membershipStatus: business?.membershipStatus ?? null,
    membershipPlanName: business?.membershipPlanName ?? null,
    membershipExpiresAt: business?.membershipExpiresAt ?? null,
    hasPaidVerificationFee: business ? Boolean(business.hasPaidVerificationFee) : null,
    trialAccessExpiresAt: business?.trialAccessExpiresAt ?? null,

    businessProfile: business ?? null,
    customerProfile: customer ?? null,
    agentProfile: agent ?? null,
    consultantProfile: consultant ?? null,
    accountManagerProfile: accountManager ?? null,
  };
}
