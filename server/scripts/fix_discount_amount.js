// Script to fix discount_amount in sales_item table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function fixDiscountAmount() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Fixing discount_amount for all sales_item records...\n');
    
    // First, let's check items with MRP = 0
    const zeroMrpCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM sales_item
      WHERE MRP = 0 OR MRP IS NULL
    `);
    
    console.log(`Items with MRP = 0 or NULL: ${zeroMrpCheck.rows[0].count}`);
    
    // Fix discount_amount for items where MRP > 0
    const updateResult = await client.query(`
      UPDATE sales_item
      SET discount_amount = CASE 
        WHEN MRP > 0 AND final_amount > 0 THEN ROUND(MRP - final_amount, 2)
        ELSE 0
      END,
      updated_at = CURRENT_TIMESTAMP
      WHERE MRP > 0 
        AND ABS(COALESCE(discount_amount, 0) - (MRP - final_amount)) > 0.01
    `);
    
    console.log(`\nUpdated ${updateResult.rowCount} records with incorrect discount_amount`);
    
    // Verify the fix
    const verifyResult = await client.query(`
      SELECT COUNT(*) as count
      FROM sales_item
      WHERE MRP > 0 
        AND ABS(COALESCE(discount_amount, 0) - (MRP - final_amount)) > 0.01
    `);
    
    console.log(`Remaining mismatches: ${verifyResult.rows[0].count}`);
    
    // Show some examples of fixed items
    const examples = await client.query(`
      SELECT 
        id,
        invoice_number,
        NAME,
        MRP,
        final_amount,
        discount_amount,
        ROUND((MRP - final_amount), 2) as calculated_discount
      FROM sales_item
      WHERE MRP > 0
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 10
    `);
    
    console.log('\nSample of recent items:');
    console.log('='.repeat(100));
    examples.rows.forEach(row => {
      console.log(`ID: ${row.id}, Invoice: ${row.invoice_number}, MRP: ₹${row.MRP}, Final: ₹${row.final_amount}, Discount: ₹${row.discount_amount}, Calculated: ₹${row.calculated_discount}`);
    });
    
    await client.query('COMMIT');
    console.log('\n✓ Fix completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error fixing discount_amount:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixDiscountAmount().catch(console.error);

