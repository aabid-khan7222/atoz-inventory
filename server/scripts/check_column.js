// Check all columns in sales_item table
require('dotenv').config();
const db = require('../db');

async function checkColumns() {
  const client = await db.pool.connect();
  
  try {
    console.log('🔍 Checking columns in sales_item table...');
    
    const result = await client.query(`
      SELECT 
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      ORDER BY ordinal_position
    `);
    
    console.log(`\nFound ${result.rows.length} columns:\n`);
    
    result.rows.forEach((col, index) => {
      const serialMatch = col.column_name.toLowerCase().includes('serial');
      const marker = serialMatch ? ' ⭐' : '';
      console.log(`${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}${marker}`);
    });
    
    // Check specifically for serial_number
    const serialCol = result.rows.find(col => col.column_name.toLowerCase() === 'serial_number');
    if (serialCol) {
      console.log(`\n✅ Found SERIAL_NUMBER column:`);
      console.log(`   Is Nullable: ${serialCol.is_nullable}`);
      if (serialCol.is_nullable === 'YES') {
        console.log('   ✅ Migration successful - column is nullable!');
      } else {
        console.log('   ⚠️  Column is still NOT NULL');
      }
    } else {
      // Try uppercase
      const serialColUpper = result.rows.find(col => col.column_name === 'SERIAL_NUMBER');
      if (serialColUpper) {
        console.log(`\n✅ Found SERIAL_NUMBER column (uppercase):`);
        console.log(`   Is Nullable: ${serialColUpper.is_nullable}`);
        if (serialColUpper.is_nullable === 'YES') {
          console.log('   ✅ Migration successful - column is nullable!');
        } else {
          console.log('   ⚠️  Column is still NOT NULL');
        }
      } else {
        console.log('\n❌ SERIAL_NUMBER column not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    client.release();
    await db.pool.end();
  }
}

checkColumns();

