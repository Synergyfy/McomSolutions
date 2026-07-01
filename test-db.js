const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.oyvjdbekepvurmfsmomm:Wd8plALl75WOVcqC@aws-1-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
    }
  }
});

async function main() {
  console.log("Checking connection to Supabase...");
  try {
    await prisma.$connect();
    console.log("✅ Connection Successful! Prisma is connected to your Supabase PostgreSQL database.");
    
    // Check if the tables exist
    try {
      const usersCount = await prisma.user.count();
      console.log(`📊 Schema Check: Active tables found. Total User records: ${usersCount}`);
    } catch (schemaErr) {
      console.log("⚠️  Connection passed, but database tables are out of sync or missing.");
      console.log("👉 Please run: npx prisma db push");
    }
  } catch (err) {
    console.error("❌ Connection Failed! Could not establish connection to the database.");
    console.error("Error details:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
