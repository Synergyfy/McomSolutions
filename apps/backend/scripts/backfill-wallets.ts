/* eslint-disable no-console */
/**
 * Backfill wallets for existing users and platformSlug for seeded SsoClients.
 *
 * Usage:
 *   npx ts-node scripts/backfill-wallets.ts
 *
 * Safe to run repeatedly — uses upsert / conditional updates only.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillWallets() {
  const users = await prisma.user.findMany({ where: { wallet: null } });
  console.log(`Backfilling wallets for ${users.length} users...`);

  for (const user of users) {
    await prisma.wallet.upsert({
      where: { userId: user.id },
      create: { userId: user.id, balance: 0, currency: 'MCOM', status: 'ACTIVE' },
      update: {},
    });
    process.stdout.write('.');
  }
  console.log('\nWallets backfilled.');
}

async function backfillPlatformSlugs() {
  const slugMap: Record<string, string> = {
    'mcom-mall': 'mall',
    'mcom-loyalty': 'rewards',
    'mcom-spin': 'spin',
    'mcom-rewards': 'rewards',
    'vemtap': 'vemtap',
    '247gbs': 'audit',
    '247gbs-audit': 'audit',
    'mcom-audit': 'audit',
    'mcom-expo': 'expo',
  };

  const clients = await prisma.ssoClient.findMany({
    where: { platformSlug: null },
  });

  for (const client of clients) {
    const slug = slugMap[client.clientId] || client.clientId.replace(/^mcom-/, '').replace(/-/g, '');
    await prisma.ssoClient.update({
      where: { id: client.id },
      data: { platformSlug: slug },
    });
    console.log(`  Set platformSlug="${slug}" for ${client.clientId}`);
  }
  console.log('platformSlug backfill complete.');
}

async function main() {
  await backfillWallets();
  await backfillPlatformSlugs();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});