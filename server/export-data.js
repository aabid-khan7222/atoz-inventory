// Script to export data from localhost database
// Run this from server directory: node export-data.js

require('dotenv').config();
const db = require('./db');
const fs = require('fs');
const path = require('path');

async function exportData() {
  const client = await db.pool.connect();
  
  try {
    console.log('📤 Exporting data from localhost database...');
    
    const data = {};
    
    // Export Products
    console.log('📦 Exporting products...');
    const productsResult = await client.query('SELECT * FROM products ORDER BY id');
    data.products = productsResult.rows;
    console.log(`✅ Exported ${data.products.length} products`);
    
    // Export Stock
    console.log('📦 Exporting stock...');
    const stockResult = await client.query('SELECT * FROM stock ORDER BY id');
    data.stock = stockResult.rows;
    console.log(`✅ Exported ${data.stock.length} stock items`);
    
    // Export Sales
    console.log('💰 Exporting sales...');
    const salesResult = await client.query('SELECT * FROM sales_item ORDER BY id');
    data.sales_item = salesResult.rows;
    console.log(`✅ Exported ${data.sales_item.length} sales items`);
    
    // Export Sales Headers (if table exists)
    try {
      console.log('💰 Exporting sales headers...');
      const salesIdResult = await client.query('SELECT * FROM sales_id ORDER BY id');
      data.sales_id = salesIdResult.rows;
      console.log(`✅ Exported ${data.sales_id.length} sales headers`);
    } catch (err) {
      console.log('ℹ️  sales_id table does not exist, skipping...');
      data.sales_id = [];
    }
    
    // Export Purchases
    console.log('🛒 Exporting purchases...');
    const purchasesResult = await client.query('SELECT * FROM purchases ORDER BY id');
    data.purchases = purchasesResult.rows;
    console.log(`✅ Exported ${data.purchases.length} purchases`);
    
    // Export Users (excluding admin)
    console.log('👥 Exporting users...');
    const usersResult = await client.query(`
      SELECT * FROM users 
      WHERE email != 'admin@atozinventory.com'
      ORDER BY id
    `);
    data.users = usersResult.rows;
    console.log(`✅ Exported ${data.users.length} users`);
    
    // Export Customer Profiles (if table exists)
    try {
      console.log('👥 Exporting customer profiles...');
      const profilesResult = await client.query('SELECT * FROM customer_profiles ORDER BY user_id');
      data.customer_profiles = profilesResult.rows;
      console.log(`✅ Exported ${data.customer_profiles.length} customer profiles`);
    } catch (err) {
      console.log('ℹ️  customer_profiles table does not exist, skipping...');
      data.customer_profiles = [];
    }
    
    // Export Notifications (if table exists)
    try {
      console.log('🔔 Exporting notifications...');
      const notificationsResult = await client.query('SELECT * FROM notifications ORDER BY id');
      data.notifications = notificationsResult.rows;
      console.log(`✅ Exported ${data.notifications.length} notifications`);
    } catch (err) {
      console.log('ℹ️  notifications table does not exist, skipping...');
      data.notifications = [];
    }
    
    // Export Charging Services (if table exists)
    try {
      console.log('🔌 Exporting charging services...');
      const chargingResult = await client.query('SELECT * FROM charging_services ORDER BY id');
      data.charging_services = chargingResult.rows;
      console.log(`✅ Exported ${data.charging_services.length} charging services`);
    } catch (err) {
      console.log('ℹ️  charging_services table does not exist, skipping...');
      data.charging_services = [];
    }
    
    // Export Service Requests (if table exists)
    try {
      console.log('🛠️ Exporting service requests...');
      const serviceResult = await client.query('SELECT * FROM service_requests ORDER BY id');
      data.service_requests = serviceResult.rows;
      console.log(`✅ Exported ${data.service_requests.length} service requests`);
    } catch (err) {
      console.log('ℹ️  service_requests table does not exist, skipping...');
      data.service_requests = [];
    }
    
    // Export Company Returns (if table exists)
    try {
      console.log('↩️ Exporting company returns...');
      const returnsResult = await client.query('SELECT * FROM company_returns ORDER BY id');
      data.company_returns = returnsResult.rows;
      console.log(`✅ Exported ${data.company_returns.length} company returns`);
    } catch (err) {
      console.log('ℹ️  company_returns table does not exist, skipping...');
      data.company_returns = [];
    }
    
    // Save to JSON file (in parent directory)
    const outputFile = path.join(__dirname, '..', 'localhost-data-export.json');
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Data exported successfully to ${outputFile}`);
    console.log('\n📊 Summary:');
    console.log(`   Products: ${data.products.length}`);
    console.log(`   Stock: ${data.stock.length}`);
    console.log(`   Sales: ${data.sales_item.length}`);
    console.log(`   Purchases: ${data.purchases.length}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Notifications: ${data.notifications.length}`);
    console.log(`\n📤 Next step: Use migrate-data.html to import this data to production`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await db.pool.end();
  }
}

exportData();

