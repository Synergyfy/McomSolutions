import { PrismaClient, Role } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true },
  })
  const adminIds = admins.map(u => u.id)

  const whereNonAdmin = adminIds.length > 0
    ? { userId: { notIn: adminIds } }
    : {}

  await prisma.$transaction([
    prisma.ssoAuthCode.deleteMany({ where: whereNonAdmin }),
    prisma.ssoSession.deleteMany({ where: whereNonAdmin }),
    prisma.passwordResetCode.deleteMany({ where: whereNonAdmin }),
    prisma.billingTransaction.deleteMany({
      where: {
        business: { userId: adminIds.length > 0 ? { notIn: adminIds } : undefined },
      },
    }),
    prisma.platformPackage.deleteMany({
      where: {
        business: { userId: adminIds.length > 0 ? { notIn: adminIds } : undefined },
      },
    }),
    prisma.notification.deleteMany({
      where: {
        business: { userId: adminIds.length > 0 ? { notIn: adminIds } : undefined },
      },
    }),
    prisma.businessProfile.deleteMany({
      where: { userId: adminIds.length > 0 ? { notIn: adminIds } : undefined },
    }),
    prisma.user.deleteMany({ where: { role: { not: 'ADMIN' } } }),
  ])
  console.log(`Cleared non-admin data (${admins.length} admin(s) preserved).`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
