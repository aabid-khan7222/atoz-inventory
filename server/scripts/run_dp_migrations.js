// Run DP migrations
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigrations() {
  try {
    console.log('Starting DP migrations...');
    
    // Read and run first migration
    const migration1 = fs.readFileSync(
      path.join(__dirname, '../migrations/add_dp_to_products.sql'),
      'utf8'
    );
    console.log('Running: add_dp_to_products.sql');
    await db.query(migration1);
    console.log('✓ Products table updated with DP column');
    
    // Read and run second migration
    const migration2 = fs.readFileSync(
      path.join(__dirname, '../migrations/add_dp_to_purchases.sql'),
      'utf8'
    );
    console.log('Running: add_dp_to_purchases.sql');
    await db.query(migration2);
    console.log('✓ Purchases table updated with DP, purchase_value, discount columns');
    
    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigrations();

