// Script to clean only stock and sales (NOT products)
require('dotenv').config();
const db = require('../db');

async function cleanOnlyStockAndSales() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting cleanup of stock and sales only (keeping products)...');
    
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
    
    // Set all product quantities to 0 (but keep products)
    const productsUpdateResult = await client.query('UPDATE products SET qty = 0');
    console.log(`Updated ${productsUpdateResult.rowCount} products - set qty to 0`);
    
    await client.query('COMMIT');
    
    console.log('✅ Cleanup completed successfully!');
    console.log('Summary:');
    console.log(`- Stock History: ${stockHistoryResult.rowCount} rows deleted`);
    console.log(`- Stock: ${stockResult.rowCount} rows deleted`);
    console.log(`- Sales Items: ${salesItemResult.rowCount} rows deleted`);
    console.log(`- Sales IDs: ${salesIdResult.rowCount} rows deleted`);
    console.log(`- Products: ${productsUpdateResult.rowCount} products updated (qty set to 0, but products kept)`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

cleanOnlyStockAndSales();

