// Script to run database migrations
// Usage: node scripts/run-migration.js <migration-file-path>

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function runMigration(migrationPath) {
  const client = await pool.connect();
  
  try {
    console.log(`Reading migration file: ${migrationPath}`);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Get migration file path from command line arguments
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('Usage: node scripts/run-migration.js <migration-file-path>');
  console.error('Example: node scripts/run-migration.js migrations/create_guarantee_warranty_tables.sql');
  process.exit(1);
}

const migrationPath = path.resolve(__dirname, '..', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

runMigration(migrationPath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

