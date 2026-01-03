// Test script to check profit calculation
const db = require('../db');

async function testProfit() {
  try {
    // Check today's sales
    const todaySales = await db.query(`
      SELECT 
        si.SERIAL_NUMBER, 
        si.SKU, 
        si.final_amount,
        (SELECT COUNT(*) FROM purchases WHERE TRIM(serial_number) = TRIM(si.SERIAL_NUMBER)) as purchase_count,
        (SELECT amount FROM purchases WHERE TRIM(serial_number) = TRIM(si.SERIAL_NUMBER) ORDER BY purchase_date DESC LIMIT 1) as purchase_amount
      FROM sales_item si 
      WHERE DATE(si.created_at) = CURRENT_DATE 
      LIMIT 10
    `);
    
    console.log('Today\'s Sales:');
    console.log('Total items:', todaySales.rows.length);
    
    for (const row of todaySales.rows) {
      console.log(`\nSerial: ${row.serial_number || 'N/A'}`);
      console.log(`SKU: ${row.sku || 'N/A'}`);
      console.log(`Revenue: ${row.final_amount}`);
      console.log(`Purchase Records Found: ${row.purchase_count}`);
      console.log(`Purchase Amount: ${row.purchase_amount || 'N/A'}`);
      
      if (row.sku) {
        const avgPrice = await db.query(
          `SELECT AVG(amount) as avg_amount 
           FROM purchases 
           WHERE TRIM(product_sku) = TRIM($1) 
           AND amount > 0
           AND supplier_name != 'replace'`,
          [row.sku]
        );
        console.log(`Average SKU Price: ${avgPrice.rows[0]?.avg_amount || 'N/A'}`);
      }
    }
    
    // Check total purchases count
    const purchaseCount = await db.query(
      `SELECT COUNT(*) as count FROM purchases WHERE serial_number IS NOT NULL AND TRIM(serial_number) != ''`
    );
    console.log(`\nTotal purchases with serial numbers: ${purchaseCount.rows[0].count}`);
    
    // Check purchases by supplier
    const supplierCount = await db.query(
      `SELECT supplier_name, COUNT(*) as count FROM purchases WHERE serial_number IS NOT NULL GROUP BY supplier_name`
    );
    console.log('\nPurchases by supplier:');
    supplierCount.rows.forEach(row => {
      console.log(`  ${row.supplier_name || 'NULL'}: ${row.count}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

testProfit();

