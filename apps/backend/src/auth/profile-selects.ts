import { Prisma } from '@prisma/client';

/**
 * Phase 6: minimal hot-path selects. `GET /auth/me` previously used
 * `include: { businessProfile: { include: { packages: true } } }`, which
 * fetched every column — including the bcrypt hash (stripped in JS, not SQL).
 * This select preserves the exact response shape minus `password`,
 * `tokenVersion`, and `deletedAt` (all internal; no frontend usage — verified).
 */
export const userProfileSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  twoFactorEnabled: true,
  emailNotifications: true,
  smsNotifications: true,
  registrationSource: true,
  adminRole: true,
  referralCode: true,
  createdAt: true,
  updatedAt: true,
  businessProfile: {
    select: {
      id: true,
      userId: true,
      businessName: true,
      businessType: true,
      country: true,
      phone: true,
      email: true,
      isOnGoogle: true,
      googlePlaceId: true,
      address: true,
      postcode: true,
      industry: true,
      category: true,
      subCategory: true,
      description: true,
      website: true,
      logoUrl: true,
      openingHours: true,
      socialMedia: true,
      membershipLevel: true,
      membershipTier: true,
      membershipStatus: true,
      membershipPlanName: true,
      membershipExpiresAt: true,
      apiKey: true,
      localMallName: true,
      localMallId: true,
      proximityTier: true,
      createdAt: true,
      updatedAt: true,
      packages: true,
    },
  },
} satisfies Prisma.UserSelect;

/**
 * Minimal select for SSO `userinfo` — only what `resolveEntitlements` and the
 * response builder read. Client secrets are never selected (see the
 * `ssoSession` lookup, which selects `clientId` and reuses the cached safe
 * client instead of `include: { client: true }`).
 */
export const ssoUserInfoSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  businessProfile: {
    select: {
      id: true,
      businessName: true,
      phone: true,
      address: true,
      postcode: true,
      membershipLevel: true,
      membershipTier: true,
      membershipStatus: true,
      membershipPlanName: true,
      packages: {
        select: {
          id: true,
          platform: true,
          packageName: true,
          status: true,
          externalPlanId: true,
          planName: true,
          planType: true,
          limits: true,
          expiresAt: true,
          billingCycle: true,
          amount: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

/** Safe client fields for entitlement resolution — no secrets, ever. */
export const ssoEntitlementClientSelect = {
  id: true,
  clientId: true,
  platformSlug: true,
  name: true,
} satisfies Prisma.SsoClientSelect;
