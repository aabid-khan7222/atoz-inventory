require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkPurchasesTable() {
  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'purchases'
      );
    `);
    
    console.log('Purchases table exists:', tableCheck.rows[0].exists);
    
    if (!tableCheck.rows[0].exists) {
      console.log('ERROR: Purchases table does not exist!');
      console.log('Please run the migration: server/migrations/create_purchase_tables.sql');
      process.exit(1);
    }
    
    // Check columns
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'purchases' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nPurchases table columns:');
    columns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check recent purchases
    const recent = await pool.query(`
      SELECT id, purchase_date, purchase_number, product_sku, serial_number, supplier_name, amount
      FROM purchases
      ORDER BY id DESC
      LIMIT 5
    `);
    
    console.log(`\nRecent purchases (last 5): ${recent.rows.length}`);
    recent.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Date: ${row.purchase_date}, SKU: ${row.product_sku}, Serial: ${row.serial_number}, Amount: ₹${row.amount}`);
    });
    
  } catch (error) {
    console.error('Error checking purchases table:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkPurchasesTable();

