// Script to completely clean all products and sales from the database
require('dotenv').config();
const db = require('../db');

async function cleanAllProductsAndSales() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting database cleanup...');
    
    // Delete all stock_history entries
    const stockHistoryResult = await client.query('DELETE FROM stock_history');
    console.log(`Deleted ${stockHistoryResult.rowCount} rows from stock_history`);
    
    // Delete all stock entries
    const stockResult = await client.query('DELETE FROM stock');
    console.log(`Deleted ${stockResult.rowCount} rows from stock`);
    
    // Delete all sales_item entries
    const salesItemResult = await client.query('DELETE FROM sales_item');
    console.log(`Deleted ${salesItemResult.rowCount} rows from sales_item`);
    
    // Delete all sales_id entries
    const salesIdResult = await client.query('DELETE FROM sales_id');
    console.log(`Deleted ${salesIdResult.rowCount} rows from sales_id`);
    
    // Delete all products
    const productsResult = await client.query('DELETE FROM products');
    console.log(`Deleted ${productsResult.rowCount} rows from products`);
    
    await client.query('COMMIT');
    
    console.log('✅ Database cleanup completed successfully!');
    console.log('Summary:');
    console.log(`- Stock History: ${stockHistoryResult.rowCount} rows deleted`);
    console.log(`- Stock: ${stockResult.rowCount} rows deleted`);
    console.log(`- Sales Items: ${salesItemResult.rowCount} rows deleted`);
    console.log(`- Sales IDs: ${salesIdResult.rowCount} rows deleted`);
    console.log(`- Products: ${productsResult.rowCount} rows deleted`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

cleanAllProductsAndSales();

