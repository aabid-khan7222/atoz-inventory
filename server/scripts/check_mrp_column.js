// Script to check MRP column in sales_item table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkMRPColumn() {
  try {
    // Check column names
    const columnCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item' 
      AND column_name LIKE '%MRP%' OR column_name LIKE '%mrp%' OR column_name LIKE '%price%'
      ORDER BY column_name
    `);
    
    console.log('Columns related to MRP/Price:');
    columnCheck.rows.forEach(row => {
      console.log(`  ${row.column_name} (${row.data_type})`);
    });
    
    // Check actual data
    const dataCheck = await pool.query(`
      SELECT 
        id,
        invoice_number,
        "MRP" as mrp_uppercase,
        "mrp" as mrp_lowercase,
        final_amount,
        discount_amount
      FROM sales_item
      WHERE invoice_number IN ('INV-20260103-0002', 'INV-20260103-0001', 'INV-20260102-0004')
      LIMIT 5
    `);
    
    console.log('\nSample data:');
    dataCheck.rows.forEach(row => {
      console.log(`ID: ${row.id}, Invoice: ${row.invoice_number}`);
      console.log(`  MRP (uppercase): ${row.mrp_uppercase}`);
      console.log(`  MRP (lowercase): ${row.mrp_lowercase}`);
      console.log(`  Final Amount: ${row.final_amount}`);
      console.log(`  Discount Amount: ${row.discount_amount}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkMRPColumn();

