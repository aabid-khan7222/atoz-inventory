// Script to run the migration to remove sales_id table
const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('Starting migration to remove sales_id table...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/remove_sales_id_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('✅ sales_id table has been removed');
    console.log('✅ All data has been migrated to sales_item table');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    console.error('Error details:', err.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });

