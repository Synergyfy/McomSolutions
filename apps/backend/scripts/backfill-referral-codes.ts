/* eslint-disable no-console */
/**
 * Backfill referral codes for existing users that don't have one.
 *
 * Usage:
 *   npx ts-node scripts/backfill-referral-codes.ts
 *
 * Safe to run repeatedly — only touches users with a null referralCode.
 */
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

function candidate(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  const users = await prisma.user.findMany({
    where: { referralCode: null },
    select: { id: true, email: true },
  });
  console.log(`Backfilling referral codes for ${users.length} users...`);

  let assigned = 0;
  for (const user of users) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = candidate();
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: code },
        });
        assigned++;
        process.stdout.write('.');
        break;
      } catch (err: any) {
        // P2002 = code collision (or concurrent run) — retry with a new code.
        if (err?.code !== 'P2002') throw err;
      }
    }
  }
  console.log(`\nAssigned ${assigned}/${users.length} referral codes.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
