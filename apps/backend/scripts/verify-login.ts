import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function verify() {
  const email = 'admin@centralhubsolution.com';
  const password = 'AdminPass2026!';

  console.log(`Checking user record for ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  if (!user) {
    throw new Error('User not found in database!');
  }

  console.log('User found:', {
    id: user.id,
    email: user.email,
    role: user.role,
    adminRole: user.adminRole,
    deletedAt: user.deletedAt,
  });

  const isPasswordMatch = await bcrypt.compare(password, user.password);
  console.log(`Password match test: ${isPasswordMatch ? 'SUCCESS ✅' : 'FAILED ❌'}`);

  const isAdminRole = user.role === Role.ADMIN;
  console.log(`Admin role check: ${isAdminRole ? 'SUCCESS (Role is ADMIN) ✅' : 'FAILED ❌'}`);

  const notDeleted = user.deletedAt === null;
  console.log(`Soft delete check: ${notDeleted ? 'ACTIVE (deletedAt is null) ✅' : 'SOFT DELETED ❌'}`);

  if (isPasswordMatch && isAdminRole && notDeleted) {
    console.log('\n🎉 ALL ADMIN LOGIN CHECKS PASSED SUCCESSFULLY!');
  } else {
    throw new Error('Some login checks failed');
  }
}

verify()
  .catch((err) => {
    console.error('Verification failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
