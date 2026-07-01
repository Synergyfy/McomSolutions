const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Wd8plALl75WOVcqC@db.oyvjdbekepvurmfsmomm.supabase.co:5432/postgres'
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
