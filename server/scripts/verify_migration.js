// Verify that SERIAL_NUMBER is now nullable
require('dotenv').config();
const db = require('../db');

async function verifyMigration() {
  const client = await db.pool.connect();
  
  try {
    console.log('🔍 Verifying migration...');
    
    const result = await client.query(`
      SELECT 
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns 
      WHERE table_name = 'sales_item' 
      AND column_name = 'SERIAL_NUMBER'
    `);
    
    if (result.rows.length > 0) {
      const column = result.rows[0];
      console.log('✅ Column found:');
      console.log(`   Column Name: ${column.column_name}`);
      console.log(`   Is Nullable: ${column.is_nullable}`);
      console.log(`   Data Type: ${column.data_type}`);
      
      if (column.is_nullable === 'YES') {
        console.log('\n✅ SUCCESS: SERIAL_NUMBER column is now nullable!');
        console.log('   Orders can now be created without serial numbers.');
      } else {
        console.log('\n⚠️  WARNING: Column is still NOT NULL');
      }
    } else {
      console.log('❌ Column SERIAL_NUMBER not found in sales_item table');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    client.release();
    await db.pool.end();
  }
}

verifyMigration();

