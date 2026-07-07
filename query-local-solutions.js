const { Client } = require('pg');

const localConfig = {
  host: 'localhost',
  port: 5433,
  user: 'postgres',
  password: 'Nov52002#',
  database: 'McomSolutions',
};

const email = 'hoyit6840@timewebx.com';

async function main() {
  console.log("Checking local McomSolutions database...");
  const client = new Client(localConfig);
  try {
    await client.connect();
    console.log("Connected successfully.");
    
    // Check user table
    const res = await client.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (res.rows.length > 0) {
      console.log("✅ User found in local DB:");
      console.log(JSON.stringify(res.rows[0], null, 2));
    } else {
      console.log("❌ User not found in local DB.");
      
      const allUsers = await client.query('SELECT email, role, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 5');
      console.log("Last 5 local users:", allUsers.rows);
    }
  } catch (err) {
    console.error("❌ Connection failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
