import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Checking McomSolutions DB via Prisma ===');

  const membershipPlans = await prisma.membershipPlan.findMany();
  console.log('\n[MembershipPlan] count:', membershipPlans.length);
  console.log(JSON.stringify(membershipPlans, null, 2));

  const externalPlans = await prisma.externalPlan.findMany();
  console.log('\n[ExternalPlan] count:', externalPlans.length);
  console.log(JSON.stringify(externalPlans, null, 2));

  const packageTemplates = await prisma.packageTemplate.findMany();
  console.log('\n[PackageTemplate] count:', packageTemplates.length);
  console.log(JSON.stringify(packageTemplates, null, 2));

  const ssoClients = await prisma.ssoClient.findMany({
    select: { id: true, clientId: true, name: true, platformSlug: true, billingApiUrl: true }
  });
  console.log('\n[SsoClient / Apps] count:', ssoClients.length);
  console.log(JSON.stringify(ssoClients, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
