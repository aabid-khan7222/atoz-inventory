// Script to create stock table
require('dotenv').config();
const db = require('../db');
const fs = require('fs');
const path = require('path');

async function createStockTable() {
  const client = await db.pool.connect();
  
  try {
    console.log('Creating stock table...\n');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../migrations/create_stock_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query('BEGIN');

    // Execute the SQL
    await client.query(sql);

    await client.query('COMMIT');
    console.log('✅ Stock table created successfully!');
    console.log('   Table: stock');
    console.log('   Fields: id, purchase_date, sku, series, category, name, ah_va, quantity, purchased_from, warranty, product_type_id, product_id, serial_number, status, created_at, updated_at');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Failed to create stock table:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

createStockTable().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

