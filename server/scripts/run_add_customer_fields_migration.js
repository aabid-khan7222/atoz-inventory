// Script to add customer fields to company_returns table
// Usage: node server/scripts/run_add_customer_fields_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/add_customer_fields_to_company_returns.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: add_customer_fields_to_company_returns.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Customer fields (name, vehicle_number, mobile_number) have been added to company_returns table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code === '42701') {
      console.log('ℹ️  Column already exists. Migration may have already been run.');
    }
    process.exit(1);
  }
}

runMigration();

