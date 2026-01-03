// Script to run add amount column to service_requests table migration
// Usage: node server/scripts/run_add_amount_to_service_requests_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/add_amount_to_service_requests.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: add_amount_to_service_requests.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Amount column has been added to service_requests table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

