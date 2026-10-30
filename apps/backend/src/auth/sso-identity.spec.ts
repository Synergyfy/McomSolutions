import { buildSsoIdentity, SsoUserRecord } from './sso-identity';

function buildUser(overrides: Partial<SsoUserRecord>): SsoUserRecord {
  return {
    id: 'usr_1',
    email: 'user@example.com',
    role: 'CUSTOMER',
    firstName: 'Jane',
    lastName: 'Doe',
    jobTitle: 'Managing Director',
    registrationSource: 'direct',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    businessProfile: null,
    customerProfile: null,
    agentProfile: null,
    consultantProfile: null,
    accountManagerProfile: null,
    ...overrides,
  } as SsoUserRecord;
}

describe('buildSsoIdentity', () => {
  it('returns complete identity + business information for a BUSINESS user', () => {
    const user = buildUser({
      role: 'BUSINESS',
      businessProfile: {
        id: 'biz_1',
        userId: 'usr_1',
        businessName: 'Acme Coffee',
        businessType: 'Limited Company',
        country: 'United Kingdom',
        phone: '+44 20 1234 5678',
        email: 'hello@acme.co.uk',
        isOnGoogle: true,
        googlePlaceId: 'place_1',
        address: '1 High Street, London',
        postcode: 'EC1A 1BB',
        industry: 'Retail',
        category: 'Coffee',
        subCategory: 'Cafe',
        description: 'Great coffee',
        website: 'https://acme.co.uk',
        logoUrl: 'https://acme.co.uk/logo.png',
        openingHours: '9-5',
        socialMedia: '{}',
        membershipLevel: 'Gold',
        membershipTier: 'Pro',
        membershipStatus: 'active',
        membershipPlanName: 'Gold Plan',
        membershipExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
        hasPaidVerificationFee: true,
        verificationFeePaidAt: new Date('2026-02-01T00:00:00.000Z'),
        trialAccessDays: 14,
        trialAccessExpiresAt: new Date('2026-03-01T00:00:00.000Z'),
        localMallName: 'Camden Mall',
        localMallId: 'mall_1',
        proximityTier: 'national',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        packages: [],
      } as unknown as SsoUserRecord['businessProfile'],
    });

    const identity = buildSsoIdentity(user);

    expect(identity).toMatchObject({
      id: 'usr_1',
      sub: 'usr_1',
      email: 'user@example.com',
      role: 'BUSINESS',
      profileType: 'BUSINESS',
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      name: 'Acme Coffee',
      phone: '+44 20 1234 5678',
      address: '1 High Street, London',
      postcode: 'EC1A 1BB',
      country: 'United Kingdom',
      businessId: 'biz_1',
      businessName: 'Acme Coffee',
      avatarUrl: 'https://acme.co.uk/logo.png',
      membershipLevel: 'Gold',
      membershipPlanName: 'Gold Plan',
      hasPaidVerificationFee: true,
    });
    expect(identity.businessProfile?.description).toBe('Great coffee');
    expect(identity.businessProfile?.website).toBe('https://acme.co.uk');
    expect(identity.agentProfile).toBeNull();
  });

  it('returns person details and the agent phone for an AFFILIATE (AGENT) user', () => {
    const user = buildUser({
      role: 'AGENT',
      registrationSource: 'affiliate-portal',
      agentProfile: {
        id: 'agent_1',
        phone: '+44 7700 900123',
        permissions: ['view_tasks'],
        status: 'Active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const identity = buildSsoIdentity(user);

    expect(identity).toMatchObject({
      profileType: 'AGENT',
      isAffiliate: true,
      firstName: 'Jane',
      lastName: 'Doe',
      fullName: 'Jane Doe',
      name: 'Jane Doe',
      email: 'user@example.com',
      phone: '+44 7700 900123',
      address: null,
      postcode: null,
      country: null,
      businessId: null,
      businessName: null,
      membershipLevel: null,
    });
    expect(identity.agentProfile?.permissions).toEqual(['view_tasks']);
    expect(identity.businessProfile).toBeNull();
  });

  it('falls back to the customer profile phone and the email local part for the display name', () => {
    const user = buildUser({
      role: 'CUSTOMER',
      firstName: null,
      lastName: null,
      customerProfile: {
        id: 'cust_1',
        phone: '+44 7700 900999',
        loyaltyPoints: 10,
        platformUsage: ['mall'],
        membershipStatus: 'None',
        status: 'Active',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const identity = buildSsoIdentity(user);

    expect(identity.fullName).toBe('');
    expect(identity.name).toBe('user');
    expect(identity.phone).toBe('+44 7700 900999');
    expect(identity.profileType).toBe('CUSTOMER');
    expect(identity.customerProfile?.loyaltyPoints).toBe(10);
  });
});
