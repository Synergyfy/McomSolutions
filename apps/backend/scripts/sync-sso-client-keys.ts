/* eslint-disable no-console */
/**
 * Sync the MCOM Loyalty SSO client API key with the shared key the Rewards
 * backend validates (`x-mcom-solution-api-key`). The McomSolutions connector
 * proxies to the Rewards backend using this key, so it must match the Rewards
 * backend's MCOM_SOLUTION_API_KEY.
 *
 * Usage:
 *   npx ts-node scripts/sync-sso-client-keys.ts
 *
 * Safe to run repeatedly — conditional update only.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LOYALTY_SHARED_KEY =
  process.env.MCOM_REWARDS_API_KEY || 'mcom-solutions-dev-key-change-in-prod';

async function main() {
  const client = await prisma.ssoClient.findUnique({
    where: { clientId: 'mcom-loyalty' },
    select: { clientId: true, name: true, apiKey: true },
  });

  if (!client) {
    console.log('MCOM Loyalty SSO client not found — nothing to sync.');
    return;
  }

  if (client.apiKey === LOYALTY_SHARED_KEY) {
    console.log(`MCOM Loyalty API key already in sync: ${client.apiKey}`);
    return;
  }

  await prisma.ssoClient.update({
    where: { clientId: 'mcom-loyalty' },
    data: { apiKey: LOYALTY_SHARED_KEY },
  });

  console.log(`Synced MCOM Loyalty API key -> ${LOYALTY_SHARED_KEY}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());