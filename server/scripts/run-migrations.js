// Helper script to run database migrations
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Determine which database URL to use based on environment
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    // Production environment - prefer DATABASE_URL_PROD, fallback to DATABASE_URL
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  } else {
    // Development environment - use DATABASE_URL
    return process.env.DATABASE_URL;
  }
};

const pool = new Pool({
  connectionString: getDatabaseUrl(),
  ...(process.env.NODE_ENV === "production" && {
    ssl: {
      rejectUnauthorized: false,
    },
  }),
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

