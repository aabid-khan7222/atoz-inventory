// Helper script to run database migrations
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Run migrations in alphabetical order

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    
    try {
      console.log(`Running migration: ${file}...`);
      await pool.query(sql);
      console.log(`✅ Successfully ran: ${file}`);
    } catch (error) {
      console.error(`❌ Error running ${file}:`, error.message);
      // Continue with other migrations even if one fails
    }
  }

  await pool.end();
  console.log('\n🎉 Migration process completed!');
}

runMigrations().catch(console.error);

