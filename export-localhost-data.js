// Script to export data from localhost database
// Run this on your local machine: node export-localhost-data.js
// This will create a JSON file with all your data that you can import to production

require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');
const fs = require('fs');

// Localhost database connection
const localPool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/atoz_inventory',
});

async function exportData() {
  const client = await localPool.connect();
  
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
    
    // Export Sales Headers
    console.log('💰 Exporting sales headers...');
    const salesIdResult = await client.query('SELECT * FROM sales_id ORDER BY id');
    data.sales_id = salesIdResult.rows;
    console.log(`✅ Exported ${data.sales_id.length} sales headers`);
    
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
    
    // Export Customer Profiles
    console.log('👥 Exporting customer profiles...');
    const profilesResult = await client.query('SELECT * FROM customer_profiles ORDER BY user_id');
    data.customer_profiles = profilesResult.rows;
    console.log(`✅ Exported ${data.customer_profiles.length} customer profiles`);
    
    // Export Notifications
    console.log('🔔 Exporting notifications...');
    const notificationsResult = await client.query('SELECT * FROM notifications ORDER BY id');
    data.notifications = notificationsResult.rows;
    console.log(`✅ Exported ${data.notifications.length} notifications`);
    
    // Export Charging Services
    console.log('🔌 Exporting charging services...');
    const chargingResult = await client.query('SELECT * FROM charging_services ORDER BY id');
    data.charging_services = chargingResult.rows;
    console.log(`✅ Exported ${data.charging_services.length} charging services`);
    
    // Export Service Requests
    console.log('🛠️ Exporting service requests...');
    const serviceResult = await client.query('SELECT * FROM service_requests ORDER BY id');
    data.service_requests = serviceResult.rows;
    console.log(`✅ Exported ${data.service_requests.length} service requests`);
    
    // Export Company Returns
    console.log('↩️ Exporting company returns...');
    const returnsResult = await client.query('SELECT * FROM company_returns ORDER BY id');
    data.company_returns = returnsResult.rows;
    console.log(`✅ Exported ${data.company_returns.length} company returns`);
    
    // Save to JSON file
    const outputFile = 'localhost-data-export.json';
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    
    console.log(`\n✅ Data exported successfully to ${outputFile}`);
    console.log('\n📊 Summary:');
    console.log(`   Products: ${data.products.length}`);
    console.log(`   Stock: ${data.stock.length}`);
    console.log(`   Sales: ${data.sales_item.length}`);
    console.log(`   Purchases: ${data.purchases.length}`);
    console.log(`   Users: ${data.users.length}`);
    console.log(`   Notifications: ${data.notifications.length}`);
    console.log(`\n📤 Next step: Use the migrate-data.html file to import this data to production`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await localPool.end();
  }
}

exportData();

