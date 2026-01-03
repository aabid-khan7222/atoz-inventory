// Script to remove invoice number fields from company_returns table
// Usage: node server/scripts/run_remove_invoice_numbers_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/remove_invoice_numbers_from_company_returns.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: remove_invoice_numbers_from_company_returns.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Invoice number fields (returned_invoice_number and received_invoice_number) have been removed from company_returns table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42703') {
      console.log('ℹ️  Column does not exist. Migration may have already been run.');
    }
    process.exit(1);
  }
}

runMigration();

