require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to database successfully");

    const checkRes = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='Nomination' and column_name='votes';
    `);

    if (checkRes.rows.length === 0) {
      console.log("Adding votes column to Nomination table...");
      await client.query(`ALTER TABLE "Nomination" ADD COLUMN "votes" INTEGER NOT NULL DEFAULT 1;`);
      console.log("Column added successfully!");
    } else {
      console.log("Column votes already exists.");
    }
  } catch (error) {
    console.error("Database connection or query failed:", error);
  } finally {
    await client.end();
  }
}

main();
