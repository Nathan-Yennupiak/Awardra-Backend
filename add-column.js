const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to database successfully");

    // Check if the column exists
    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Nomination' and column_name='nominatorEmail';
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding nominatorEmail column to Nomination table...");
      await client.query(`ALTER TABLE "Nomination" ADD COLUMN "nominatorEmail" TEXT;`);
      console.log("Column added successfully!");
    } else {
      console.log("Column nominatorEmail already exists.");
    }
  } catch (error) {
    console.error("Database connection or query failed:", error);
  } finally {
    await client.end();
  }
}

main();
