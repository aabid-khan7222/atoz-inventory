// Script to restore serial number fields to company_returns table
// Usage: node server/scripts/run_restore_serial_numbers_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/restore_serial_numbers_to_company_returns.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: restore_serial_numbers_to_company_returns.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Serial number fields (returned_serial_number and received_serial_number) have been restored to company_returns table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

