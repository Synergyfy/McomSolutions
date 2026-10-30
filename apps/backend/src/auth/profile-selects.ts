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
      hasPaidVerificationFee: true,
      verificationFeePaidAt: true,
      trialAccessDays: true,
      trialAccessExpiresAt: true,
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
 * Select used by the SSO profile surfaces (`POST /auth/sso/token`,
 * `GET /auth/sso/userinfo`, `GET /auth/sso/entitlement` and the dashboard
 * handshake token). It carries the full identity + contact + business
 * information a partner app needs to provision a local account, for every
 * role (BUSINESS, CUSTOMER, AGENT, CONSULTANT, ACCOUNT_MANAGER, PARTNER).
 *
 * Deliberately excluded: `password`, `tokenVersion`, `deletedAt`,
 * `BusinessProfile.apiKey`, `stripeCustomerId`, `paypalPayerId` and any
 * client secret. Those never leave the central hub.
 */
export const ssoUserInfoSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  jobTitle: true,
  registrationSource: true,
  createdAt: true,
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
      hasPaidVerificationFee: true,
      verificationFeePaidAt: true,
      trialAccessDays: true,
      trialAccessExpiresAt: true,
      localMallName: true,
      localMallId: true,
      proximityTier: true,
      createdAt: true,
      updatedAt: true,
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
  customerProfile: {
    select: {
      id: true,
      phone: true,
      loyaltyPoints: true,
      platformUsage: true,
      membershipStatus: true,
      status: true,
      createdAt: true,
    },
  },
  agentProfile: {
    select: {
      id: true,
      phone: true,
      permissions: true,
      status: true,
      createdAt: true,
    },
  },
  consultantProfile: {
    select: {
      id: true,
      phone: true,
      specialisation: true,
      status: true,
      createdAt: true,
    },
  },
  accountManagerProfile: {
    select: {
      id: true,
      phone: true,
      assignedBusinesses: true,
      status: true,
      createdAt: true,
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
