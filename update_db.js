const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const sql = neon(process.env.DATABASE_URL);
  await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN DEFAULT false;`;
  console.log("Column added");
}
run();
