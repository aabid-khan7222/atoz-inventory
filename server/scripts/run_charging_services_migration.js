// Script to run charging services table migration
// Usage: node server/scripts/run_charging_services_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/create_charging_services_table.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: create_charging_services_table.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Charging services table has been created.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

