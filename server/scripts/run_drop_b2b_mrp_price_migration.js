// Script to drop b2b_mrp_price column from products table
// Usage: node server/scripts/run_drop_b2b_mrp_price_migration.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  try {
    console.log('Checking if b2b_mrp_price column exists...');
    
    // Check if column exists
    const checkResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'products' AND column_name = 'b2b_mrp_price'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('✅ Column b2b_mrp_price does not exist. Nothing to drop.');
      process.exit(0);
    }
    
    console.log('Dropping b2b_mrp_price column...');
    
    // Drop the column
    await db.query(`
      ALTER TABLE products DROP COLUMN b2b_mrp_price
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('Column b2b_mrp_price has been dropped from products table.');
    console.log('Note: Single MRP (mrp_price) is now used for both B2C and B2B customers.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

