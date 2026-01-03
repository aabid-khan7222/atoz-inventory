require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPurchasesTable() {
  try {
    // Check table columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'purchases' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n=== Purchases Table Structure ===\n');
    columnsResult.rows.forEach(row => {
      console.log(`${row.column_name.padEnd(25)} | ${row.data_type.padEnd(20)} | Nullable: ${row.is_nullable} | Default: ${row.column_default || 'none'}`);
    });
    
    // Check if there are any records with amount
    const sampleResult = await pool.query(`
      SELECT COUNT(*) as total, 
             COUNT(amount) as with_amount,
             MIN(amount) as min_amount,
             MAX(amount) as max_amount,
             AVG(amount) as avg_amount
      FROM purchases
    `);
    
    console.log('\n=== Purchases Data Summary ===\n');
    const stats = sampleResult.rows[0];
    console.log(`Total records: ${stats.total}`);
    console.log(`Records with amount: ${stats.with_amount}`);
    if (stats.with_amount > 0) {
      console.log(`Min amount: ₹${stats.min_amount}`);
      console.log(`Max amount: ₹${stats.max_amount}`);
      console.log(`Avg amount: ₹${parseFloat(stats.avg_amount).toFixed(2)}`);
    }
    
    // Show sample records
    const sampleRecords = await pool.query(`
      SELECT id, purchase_date, purchase_number, product_sku, serial_number, supplier_name, amount
      FROM purchases
      ORDER BY id DESC
      LIMIT 5
    `);
    
    if (sampleRecords.rows.length > 0) {
      console.log('\n=== Sample Purchase Records (Latest 5) ===\n');
      sampleRecords.rows.forEach(row => {
        console.log(`ID: ${row.id} | Date: ${row.purchase_date} | PO: ${row.purchase_number}`);
        console.log(`  SKU: ${row.product_sku} | Serial: ${row.serial_number}`);
        console.log(`  Supplier: ${row.supplier_name || 'N/A'} | Amount: ₹${row.amount || 0}`);
        console.log('');
      });
    } else {
      console.log('\n=== No purchase records found ===\n');
    }
    
  } catch (error) {
    console.error('Error checking purchases table:', error.message);
  } finally {
    await pool.end();
  }
}

checkPurchasesTable();

