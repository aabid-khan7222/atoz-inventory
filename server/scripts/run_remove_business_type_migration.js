// Script to run the migration to remove business_type column from customer_profiles
const db = require('../db');
const fs = require('fs');
const path = require('path');

(async () => {
  let client;
  try {
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/remove_business_types_from_customer_profiles.sql'),
      'utf8'
    );
    
    console.log('Running migration to remove business_type column...');
    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('\n---\n');
    
    client = await db.pool.connect();
    await client.query('BEGIN');
    
    // Run the migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
    // Verify the column is removed
    const checkResult = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' 
      AND column_name = 'business_type'
    `);
    
    if (checkResult.rows.length === 0) {
      console.log('✅ Verified: business_type column has been removed from customer_profiles table');
    } else {
      console.log('⚠️  Warning: business_type column still exists');
    }
    
  } catch (e) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('❌ ERROR running migration:', e.message);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    process.exit();
  }
})();

