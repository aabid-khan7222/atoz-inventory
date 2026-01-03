// Run migration to make SERIAL_NUMBER nullable
require('dotenv').config();
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('🔄 Starting migration: Make SERIAL_NUMBER nullable...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/make_serial_number_nullable.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query('BEGIN');
    
    // Run the ALTER TABLE command
    await client.query('ALTER TABLE sales_item ALTER COLUMN SERIAL_NUMBER DROP NOT NULL');
    
    // Add comment
    await client.query(`COMMENT ON COLUMN sales_item.SERIAL_NUMBER IS 'Serial number of the individual battery sold. NULL means pending assignment by admin.'`);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    console.log('   SERIAL_NUMBER column is now nullable in sales_item table.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    
    // Check if column is already nullable
    if (error.message.includes('does not exist') || error.message.includes('already')) {
      console.log('ℹ️  Column might already be nullable. Checking current state...');
      try {
        const result = await client.query(`
          SELECT is_nullable 
          FROM information_schema.columns 
          WHERE table_name = 'sales_item' 
          AND column_name = 'SERIAL_NUMBER'
        `);
        if (result.rows.length > 0) {
          console.log(`   Current state: is_nullable = ${result.rows[0].is_nullable}`);
        }
      } catch (checkError) {
        console.error('   Could not check column state:', checkError.message);
      }
    }
    
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

runMigration();
