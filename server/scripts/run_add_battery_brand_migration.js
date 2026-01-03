// Script to run add battery_brand column to charging services table migration
// Usage: node server/scripts/run_add_battery_brand_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/add_battery_brand_to_charging_services.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: add_battery_brand_to_charging_services.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('Battery brand column has been added to charging_services table.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

