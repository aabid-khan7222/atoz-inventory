// Script to clear ALL sales data from PRODUCTION database
// This will delete all sales_item and sales_id records
// Use with caution - this action cannot be undone!
// 
// Usage:
//   NODE_ENV=production node server/scripts/clear_all_sales_production.js
//   OR on Render: Set NODE_ENV=production and run this script

require('dotenv').config();
const db = require('../db');

async function clearAllSalesProduction() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const isProduction = process.env.NODE_ENV === 'production';
    const dbType = isProduction ? 'PRODUCTION' : 'LOCAL';
    
    console.log('🚀 Starting to clear all sales data...');
    console.log(`📊 Database: ${dbType}`);
    console.log('⚠️  WARNING: This will delete ALL sales records!');
    
    // Delete all sales_item entries (individual batteries sold)
    const salesItemResult = await client.query('DELETE FROM sales_item');
    console.log(`✅ Deleted ${salesItemResult.rowCount} rows from sales_item`);
    
    // Delete all sales_id entries (invoice headers) - check if table exists first
    let salesIdResult = { rowCount: 0 };
    try {
      const salesIdTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales_id'
        )
      `);
      
      if (salesIdTableCheck.rows[0].exists) {
        salesIdResult = await client.query('DELETE FROM sales_id');
        console.log(`✅ Deleted ${salesIdResult.rowCount} rows from sales_id`);
      } else {
        console.log('ℹ️  sales_id table does not exist, skipping...');
      }
    } catch (err) {
      console.log('ℹ️  sales_id table does not exist, skipping...');
    }
    
    // Check and delete from legacy 'sales' table if it exists
    try {
      const salesTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales'
        )
      `);
      
      if (salesTableCheck.rows[0].exists) {
        const salesResult = await client.query('DELETE FROM sales');
        console.log(`✅ Deleted ${salesResult.rowCount} rows from sales (legacy table)`);
      }
    } catch (err) {
      console.log('ℹ️  sales table does not exist, skipping...');
    }
    
    // Check and delete from legacy 'sale_items' table if it exists
    try {
      const saleItemsTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sale_items'
        )
      `);
      
      if (saleItemsTableCheck.rows[0].exists) {
        const saleItemsResult = await client.query('DELETE FROM sale_items');
        console.log(`✅ Deleted ${saleItemsResult.rowCount} rows from sale_items (legacy table)`);
      }
    } catch (err) {
      console.log('ℹ️  sale_items table does not exist, skipping...');
    }
    
    await client.query('COMMIT');
    
    // Verify deletion
    const verifySalesItem = await client.query('SELECT COUNT(*) as count FROM sales_item');
    const salesItemCount = parseInt(verifySalesItem.rows[0].count);
    
    let salesIdCount = 0;
    try {
      const verifySalesId = await client.query('SELECT COUNT(*) as count FROM sales_id');
      salesIdCount = parseInt(verifySalesId.rows[0].count);
    } catch (err) {
      // sales_id table doesn't exist, which is fine
      salesIdCount = 0;
    }
    
    console.log('\n📊 Verification:');
    console.log(`- sales_item records remaining: ${salesItemCount}`);
    if (salesIdCount !== undefined) {
      console.log(`- sales_id records remaining: ${salesIdCount}`);
    }
    
    if (salesItemCount === 0) {
      console.log('\n✅ SUCCESS! All sales data has been cleared from ' + dbType + ' database!');
      console.log('   - Inventory/Sold Batteries section will show no data');
      console.log('   - Sales section will show no data');
      console.log('   - Dashboard will show zero sales');
      console.log('   - Reports will show zero values');
      console.log('\n🔄 Next steps:');
      console.log('   1. Clear browser cache (Ctrl+Shift+Delete)');
      console.log('   2. Hard refresh the page (Ctrl+Shift+R)');
      console.log('   3. Restart the server if needed');
    } else {
      console.log('\n⚠️  WARNING: Some sales data may still exist!');
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

clearAllSalesProduction();

