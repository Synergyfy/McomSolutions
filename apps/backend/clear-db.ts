import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  await prisma.$transaction([
    prisma.ssoAuthCode.deleteMany(),
    prisma.ssoSession.deleteMany(),
    prisma.passwordResetCode.deleteMany(),
    prisma.billingTransaction.deleteMany(),
    prisma.platformPackage.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.businessProfile.deleteMany(),
    prisma.ssoClient.deleteMany(),
    prisma.user.deleteMany(),
  ])
  console.log('Cleared.')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
