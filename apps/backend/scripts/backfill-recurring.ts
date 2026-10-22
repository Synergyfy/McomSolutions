/* eslint-disable no-console */
/**
 * Backfill recurring-subscription mirrors for existing memberships/packages.
 *
 * Usage:
 *   npx ts-node scripts/backfill-recurring.ts
 *
 * Safety: every backfilled row is created with autoRenew = false, so this
 * script can never charge anyone. It only makes existing subscriptions visible
 * in the recurring-billing admin views.
 */
import { PrismaClient, RecurringProvider, RecurringScope, RecurringStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillMemberships() {
  const businesses = await prisma.businessProfile.findMany({
    where: {
      deletedAt: null,
      membershipPlanName: { not: null },
      membershipExpiresAt: { not: null },
    },
    select: {
      id: true,
      userId: true,
      membershipPlanName: true,
      membershipTier: true,
      membershipLevel: true,
      membershipExpiresAt: true,
    },
  });

  console.log(`Backfilling ${businesses.length} membership mandates (non-charging)...`);
  let created = 0;
  for (const business of businesses) {
    const scopeKey = `membership:${business.id}`;
    const existing = await prisma.recurringSubscription.findUnique({ where: { scopeKey } });
    if (existing) continue;
    await prisma.recurringSubscription.create({
      data: {
        scopeKey,
        scope: RecurringScope.MEMBERSHIP,
        businessId: business.id,
        userId: business.userId,
        membershipPlanName: business.membershipPlanName,
        membershipTier: business.membershipTier || 'Standard',
        level: business.membershipLevel,
        provider: RecurringProvider.wallet,
        planName: business.membershipPlanName || 'Membership',
        billingCycle: 'legacy',
        intervalUnit: 'day',
        intervalCount: 1,
        amount: 0,
        status: RecurringStatus.ACTIVE,
        autoRenew: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: business.membershipExpiresAt,
        nextChargeAt: business.membershipExpiresAt,
        metadata: { backfilled: true, nonCharging: true },
      },
    });
    created += 1;
    process.stdout.write('.');
  }
  console.log(`\nMembership mandates created: ${created}`);
}

async function backfillPackages() {
  const packages = await prisma.platformPackage.findMany({
    where: { status: 'active', expiresAt: { not: null } },
  });

  console.log(`Backfilling ${packages.length} platform mandates (non-charging)...`);
  let created = 0;
  for (const pkg of packages) {
    const scopeKey = `platform:${pkg.businessId}:${pkg.platform}`;
    const existing = await prisma.recurringSubscription.findUnique({ where: { scopeKey } });
    if (existing) {
      await prisma.platformPackage.update({
        where: { id: pkg.id },
        data: { nextChargeAt: pkg.expiresAt, autoRenew: existing.autoRenew },
      });
      continue;
    }
    await prisma.recurringSubscription.create({
      data: {
        scopeKey,
        scope: RecurringScope.PLATFORM,
        businessId: pkg.businessId,
        platform: pkg.platform,
        externalPlanId: pkg.externalPlanId,
        provider: RecurringProvider.wallet,
        planName: pkg.planName || pkg.packageName,
        billingCycle: pkg.billingCycle || 'monthly',
        intervalUnit: 'month',
        intervalCount: 1,
        amount: pkg.amount || 0,
        status: RecurringStatus.ACTIVE,
        autoRenew: false,
        currentPeriodStart: pkg.createdAt,
        currentPeriodEnd: pkg.expiresAt,
        nextChargeAt: pkg.expiresAt,
        metadata: { backfilled: true, nonCharging: true },
      },
    });
    await prisma.platformPackage.update({
      where: { id: pkg.id },
      data: { nextChargeAt: pkg.expiresAt, autoRenew: false },
    });
    created += 1;
    process.stdout.write('.');
  }
  console.log(`\nPlatform mandates created: ${created}`);
}

async function main() {
  await backfillMemberships();
  await backfillPackages();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
