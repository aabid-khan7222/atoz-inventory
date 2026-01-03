// Script to check discount_amount in sales_item table
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkDiscountAmount() {
  try {
    console.log('Checking sales_item table for discount_amount issues...\n');
    
    // Get recent sales items with their MRP, final_amount, and discount_amount
    const result = await pool.query(`
      SELECT 
        id,
        invoice_number,
        NAME,
        MRP,
        final_amount,
        discount_amount,
        SERIAL_NUMBER,
        created_at,
        updated_at,
        CASE 
          WHEN MRP > 0 AND final_amount > 0 THEN ROUND(((MRP - final_amount) / MRP) * 100, 2)
          ELSE 0
        END as calculated_discount_percent,
        CASE 
          WHEN MRP > 0 AND final_amount > 0 THEN MRP - final_amount
          ELSE 0
        END as calculated_discount_amount
      FROM sales_item
      WHERE MRP > 0
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 20
    `);
    
    console.log(`Found ${result.rows.length} recent sales items:\n`);
    console.log('='.repeat(120));
    console.log(
      'ID'.padEnd(8) +
      'Invoice'.padEnd(15) +
      'Product'.padEnd(25) +
      'MRP'.padEnd(12) +
      'Final Amt'.padEnd(12) +
      'DB Discount'.padEnd(15) +
      'Calc Discount'.padEnd(15) +
      'DB %'.padEnd(10) +
      'Calc %'.padEnd(10) +
      'Serial'.padEnd(15)
    );
    console.log('='.repeat(120));
    
    let issuesFound = 0;
    
    result.rows.forEach((row) => {
      const dbDiscount = parseFloat(row.discount_amount || 0);
      const calcDiscount = parseFloat(row.calculated_discount_amount || 0);
      const dbPercent = dbDiscount > 0 && row.MRP > 0 ? ((dbDiscount / row.MRP) * 100).toFixed(2) : '0.00';
      const calcPercent = row.calculated_discount_percent || '0.00';
      
      const hasIssue = Math.abs(dbDiscount - calcDiscount) > 0.01; // Allow small floating point differences
      
      if (hasIssue) {
        issuesFound++;
        console.log(
          String(row.id).padEnd(8) +
          (row.invoice_number || 'N/A').padEnd(15) +
          (row.NAME || 'N/A').substring(0, 24).padEnd(25) +
          `₹${parseFloat(row.MRP || 0).toFixed(2)}`.padEnd(12) +
          `₹${parseFloat(row.final_amount || 0).toFixed(2)}`.padEnd(12) +
          `₹${dbDiscount.toFixed(2)}`.padEnd(15) +
          `₹${calcDiscount.toFixed(2)}`.padEnd(15) +
          `${dbPercent}%`.padEnd(10) +
          `${calcPercent}%`.padEnd(10) +
          (row.SERIAL_NUMBER || 'Pending').padEnd(15) +
          ' ⚠️ MISMATCH'
        );
      } else {
        console.log(
          String(row.id).padEnd(8) +
          (row.invoice_number || 'N/A').padEnd(15) +
          (row.NAME || 'N/A').substring(0, 24).padEnd(25) +
          `₹${parseFloat(row.MRP || 0).toFixed(2)}`.padEnd(12) +
          `₹${parseFloat(row.final_amount || 0).toFixed(2)}`.padEnd(12) +
          `₹${dbDiscount.toFixed(2)}`.padEnd(15) +
          `₹${calcDiscount.toFixed(2)}`.padEnd(15) +
          `${dbPercent}%`.padEnd(10) +
          `${calcPercent}%`.padEnd(10) +
          (row.SERIAL_NUMBER || 'Pending').padEnd(15) +
          ' ✓'
        );
      }
    });
    
    console.log('='.repeat(120));
    console.log(`\nTotal items checked: ${result.rows.length}`);
    console.log(`Issues found: ${issuesFound}`);
    
    if (issuesFound > 0) {
      console.log('\n⚠️  Some items have mismatched discount_amount values!');
      console.log('These need to be fixed by updating discount_amount = MRP - final_amount\n');
      
      // Show SQL to fix the issues
      console.log('SQL to fix issues:');
      console.log('UPDATE sales_item');
      console.log('SET discount_amount = CASE WHEN MRP > 0 AND final_amount > 0 THEN MRP - final_amount ELSE 0 END');
      console.log('WHERE MRP > 0 AND ABS(discount_amount - (MRP - final_amount)) > 0.01;');
    } else {
      console.log('\n✓ All discount_amount values are correct!');
    }
    
  } catch (error) {
    console.error('Error checking discount_amount:', error);
  } finally {
    await pool.end();
  }
}

checkDiscountAmount();

