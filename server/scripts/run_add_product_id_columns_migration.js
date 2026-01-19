// Script to run the migration that adds product_id columns to company_returns table

const fs = require('fs');
const path = require('path');
const db = require('../db');

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('🔄 Starting migration: Add product_id columns to company_returns...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../migrations/add_product_id_columns_to_company_returns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Execute migration
    await client.query(migrationSQL);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully: Product ID columns added to company_returns');
    
    // Verify the columns exist
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'company_returns' 
      AND column_name IN ('returned_product_id', 'received_product_id', 'returned_serial_number', 'received_serial_number', 'returned_date', 'received_date', 'status')
      ORDER BY column_name
    `);
    
    console.log('📋 Verified columns in company_returns:');
    checkResult.rows.forEach(row => {
      console.log(`   ✓ ${row.column_name}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };

