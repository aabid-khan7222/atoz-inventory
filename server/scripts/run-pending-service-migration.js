// Run pending_service_requests table migration
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine which database URL to use based on environment
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  } else {
    return process.env.DATABASE_URL;
  }
};

const poolConfig = {
  connectionString: getDatabaseUrl(),
};

if (process.env.NODE_ENV === "production") {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running pending_service_requests table migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/create_pending_service_requests_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Creating pending_service_requests table...');
    await client.query(migrationSQL);
    console.log('✅ pending_service_requests table created successfully!');
    
  } catch (error) {
    if (error.code === '42P07') {
      console.log('ℹ️  Table already exists, skipping...');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration()
  .then(() => {
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  });

