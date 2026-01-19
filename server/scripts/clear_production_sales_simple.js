// Simple script to clear ALL sales data from PRODUCTION database
// Run this on production: NODE_ENV=production node server/scripts/clear_production_sales_simple.js

require('dotenv').config();
const db = require('../db');

(async () => {
  try {
    console.log('🚀 Clearing all sales data from PRODUCTION...');
    
    // Clear sales_item
    const result1 = await db.query('DELETE FROM sales_item');
    console.log(`✅ Deleted ${result1.rowCount} rows from sales_item`);
    
    // Clear sales_id if exists
    try {
      const result2 = await db.query('DELETE FROM sales_id');
      console.log(`✅ Deleted ${result2.rowCount} rows from sales_id`);
    } catch (e) {
      console.log('ℹ️  sales_id table does not exist');
    }
    
    // Verify
    const verify = await db.query('SELECT COUNT(*) as count FROM sales_item');
    const count = parseInt(verify.rows[0].count);
    
    if (count === 0) {
      console.log('✅ SUCCESS! All sales data cleared!');
      console.log('📋 Next: Clear browser cache and hard refresh (Ctrl+Shift+R)');
    } else {
      console.log(`⚠️  Warning: ${count} records still exist`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

