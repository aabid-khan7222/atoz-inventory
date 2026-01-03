// Script to remove all repair services from the database
require('dotenv').config();
const db = require('../db');

async function removeRepairServices() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Removing all repair service records...');
    
    // Step 1: Delete all repair service records
    const deleteResult = await client.query(
      `DELETE FROM services WHERE service_type = 'repair'`
    );
    console.log(`✓ Deleted ${deleteResult.rowCount} repair service record(s)`);
    
    // Step 2: Drop the existing constraint
    console.log('Updating service_type constraint...');
    await client.query(`
      ALTER TABLE services DROP CONSTRAINT IF EXISTS services_service_type_check
    `);
    
    // Step 3: Add new constraint without 'repair'
    await client.query(`
      ALTER TABLE services ADD CONSTRAINT services_service_type_check 
      CHECK (service_type IN ('charging', 'testing'))
    `);
    console.log('✓ Updated service_type constraint (removed repair)');
    
    await client.query('COMMIT');
    
    // Verification query
    const verifyResult = await client.query(`
      SELECT service_type, COUNT(*) as count 
      FROM services 
      GROUP BY service_type
    `);
    
    console.log('\nRemaining services by type:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.service_type}: ${row.count}`);
    });
    
    console.log('\n✅ Repair services removal completed successfully!');
    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error removing repair services:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

// Check if services table exists first
async function checkTableExists() {
  try {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'services'
      ) AS table_exists
    `);
    
    if (!result.rows[0]?.table_exists) {
      console.log('⚠️  Services table does not exist. Nothing to clean up.');
      process.exit(0);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking for services table:', error.message);
    process.exit(1);
  }
}

async function main() {
  const tableExists = await checkTableExists();
  if (tableExists) {
    await removeRepairServices();
  }
}

main();

