// Script to run add B2B MRP and discount columns to products table migration
// Usage: node server/scripts/run_add_b2b_mrp_and_discount_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const migrationFile = path.join(__dirname, '../migrations/add_b2b_mrp_and_discount_columns.sql');
  
  try {
    console.log('Reading migration file...');
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('Running migration: add_b2b_mrp_and_discount_columns.sql');
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('B2B MRP and discount columns have been added to products table.');
    console.log('Added columns:');
    console.log('  - b2b_mrp_price (NUMERIC)');
    console.log('  - b2b_discount (NUMERIC)');
    console.log('  - b2b_discount_percent (NUMERIC)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

