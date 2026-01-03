require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testAmountFlow() {
  try {
    console.log('\n=== Testing Purchase Amount Flow ===\n');
    
    // 1. Check if amount column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'purchases' AND column_name = 'amount'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('❌ ERROR: amount column does not exist in purchases table!');
      process.exit(1);
    } else {
      console.log('✅ amount column exists in purchases table');
      console.log(`   Type: ${columnCheck.rows[0].data_type}`);
      console.log(`   Nullable: ${columnCheck.rows[0].is_nullable}`);
      console.log(`   Default: ${columnCheck.rows[0].column_default}`);
    }
    
    // 2. Check recent purchases with amount
    const recentPurchases = await pool.query(`
      SELECT 
        id, 
        purchase_date, 
        purchase_number, 
        product_sku, 
        serial_number, 
        supplier_name, 
        amount,
        CASE 
          WHEN amount = 0 THEN '⚠️ Warning: Amount is 0'
          WHEN amount IS NULL THEN '❌ Error: Amount is NULL'
          ELSE '✅ Amount is set'
        END as status
      FROM purchases
      ORDER BY id DESC
      LIMIT 10
    `);
    
    console.log(`\n📊 Recent Purchase Records (Last 10):\n`);
    if (recentPurchases.rows.length === 0) {
      console.log('   No purchase records found yet.');
      console.log('   The amount field will be saved when you add stock through the UI.\n');
    } else {
      recentPurchases.rows.forEach((row, idx) => {
        console.log(`${idx + 1}. Record ID: ${row.id}`);
        console.log(`   Purchase Date: ${row.purchase_date}`);
        console.log(`   Purchase Number: ${row.purchase_number}`);
        console.log(`   SKU: ${row.product_sku}`);
        console.log(`   Serial: ${row.serial_number}`);
        console.log(`   Supplier: ${row.supplier_name || 'N/A'}`);
        console.log(`   Amount: ₹${row.amount || 0}`);
        console.log(`   Status: ${row.status}`);
        console.log('');
      });
    }
    
    // 3. Summary statistics
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(amount) as records_with_amount,
        SUM(CASE WHEN amount = 0 THEN 1 ELSE 0 END) as records_with_zero_amount,
        SUM(CASE WHEN amount IS NULL THEN 1 ELSE 0 END) as records_with_null_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount,
        AVG(amount) as avg_amount,
        SUM(amount) as total_amount
      FROM purchases
    `);
    
    const s = stats.rows[0];
    console.log('📈 Purchase Amount Statistics:\n');
    console.log(`   Total Records: ${s.total_records}`);
    console.log(`   Records with Amount: ${s.records_with_amount}`);
    if (s.records_with_zero_amount > 0) {
      console.log(`   ⚠️  Records with Zero Amount: ${s.records_with_zero_amount}`);
    }
    if (s.records_with_null_amount > 0) {
      console.log(`   ❌ Records with NULL Amount: ${s.records_with_null_amount}`);
    }
    if (s.total_records > 0) {
      console.log(`   Min Amount: ₹${s.min_amount || 0}`);
      console.log(`   Max Amount: ₹${s.max_amount || 0}`);
      console.log(`   Average Amount: ₹${parseFloat(s.avg_amount || 0).toFixed(2)}`);
      console.log(`   Total Amount: ₹${parseFloat(s.total_amount || 0).toFixed(2)}`);
    }
    
    console.log('\n✅ Amount field is properly configured and ready to use!\n');
    console.log('📝 Next Steps:');
    console.log('   1. Go to Admin/Super Admin Dashboard → Inventory → Add Stock');
    console.log('   2. Select a product and enter quantity');
    console.log('   3. Enter the Purchase Amount (per unit) - this field is now prominently displayed');
    console.log('   4. Fill in other details and add serial numbers');
    console.log('   5. Submit the form');
    console.log('   6. Check the Purchase Section to see the amount displayed\n');
    
  } catch (error) {
    console.error('❌ Error testing amount flow:', error.message);
  } finally {
    await pool.end();
  }
}

testAmountFlow();

