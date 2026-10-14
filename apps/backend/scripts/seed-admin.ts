import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding admin user: admin@centralhubsolution.com ...');
  const email = 'admin@centralhubsolution.com';
  const plainPassword = 'AdminPass2026!';

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(plainPassword, salt);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: passwordHash,
      role: Role.ADMIN,
      adminRole: 'Super Admin',
      deletedAt: null,
    },
    create: {
      email,
      password: passwordHash,
      role: Role.ADMIN,
      adminRole: 'Super Admin',
      firstName: 'Central',
      lastName: 'Admin',
      jobTitle: 'System Administrator',
    },
  });

  console.log('Admin user upserted successfully:');
  console.log({
    id: user.id,
    email: user.email,
    role: user.role,
    adminRole: user.adminRole,
    firstName: user.firstName,
    lastName: user.lastName,
    deletedAt: user.deletedAt,
  });

  // Verify password match
  const isMatch = await bcrypt.compare(plainPassword, user.password);
  console.log(`Password verification test: ${isMatch ? 'PASSED ✅' : 'FAILED ❌'}`);
}

main()
  .catch((e) => {
    console.error('Error seeding admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
