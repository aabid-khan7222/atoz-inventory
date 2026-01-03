// Run migration to remove 'amount' column from purchases table
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  try {
    console.log('Starting migration to remove amount column from purchases table...');

    // Read migration file
    const migration = fs.readFileSync(
      path.join(__dirname, '../migrations/remove_amount_from_purchases.sql'),
      'utf8'
    );
    
    console.log('Running migration: remove_amount_from_purchases.sql');
    await db.query(migration);
    console.log('✓ Migration completed successfully!');
    console.log('✓ Amount column removed from purchases table');
    console.log('✓ All purchase_value values have been preserved');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();

