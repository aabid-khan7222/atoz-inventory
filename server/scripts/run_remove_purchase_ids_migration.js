// Run migration to remove purchase_id columns from company_returns table
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting migration: Remove purchase_id columns from company_returns...');
    
    // Read the migration SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/remove_purchase_ids_from_company_returns.sql'),
      'utf8'
    );
    
    await client.query('BEGIN');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('   - Removed returned_purchase_id column');
    console.log('   - Removed received_purchase_id column');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();

