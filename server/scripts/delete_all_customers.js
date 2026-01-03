// server/scripts/delete_all_customers.js
// Script to delete all customer users except admin and super admin

require('dotenv').config();
const db = require('../db');

async function deleteAllCustomers() {
  let client;
  
  try {
    console.log('Starting deletion of all customer users...');
    
    client = await db.pool.connect();
    await client.query('BEGIN');

    // First, get all customer user IDs (role_id != 1 and role_id != 2)
    const customerUsersResult = await client.query(`
      SELECT id, full_name, email, role_id
      FROM users
      WHERE role_id NOT IN (1, 2)
      ORDER BY id
    `);

    const customerIds = customerUsersResult.rows.map(row => row.id);
    const customerCount = customerIds.length;

    if (customerCount === 0) {
      console.log('No customer users found. Only admin and super admin users exist. Proceeding to clean any orphan profiles...');
    } else {
      console.log(`Found ${customerCount} customer users to delete:`);
      customerUsersResult.rows.forEach(user => {
        console.log(`  - ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email || 'N/A'}, Role ID: ${user.role_id}`);
      });
    }

    // Delete related records in the correct order to handle foreign key constraints

    // 1. Try to delete sale_items for sales belonging to these customers (if table exists)
    let saleItemsResult = { rowCount: 0 };
    try {
      // Check if table exists first
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sale_items'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        saleItemsResult = await client.query(`
          DELETE FROM sale_items 
          WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ANY($1::int[]))
        `, [customerIds]);
        console.log(`Deleted ${saleItemsResult.rowCount} sale_items records`);
      } else {
        console.log('sale_items table does not exist, skipping...');
      }
    } catch (err) {
      console.log('Error checking/deleting from sale_items:', err.message);
      throw err;
    }

    // 2. Delete sales for these customers (if table exists)
    let salesResult = { rowCount: 0 };
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        salesResult = await client.query(`
          DELETE FROM sales WHERE customer_id = ANY($1::int[])
        `, [customerIds]);
        console.log(`Deleted ${salesResult.rowCount} sales records`);
      } else {
        console.log('sales table does not exist, skipping...');
      }
    } catch (err) {
      console.log('Error checking/deleting from sales:', err.message);
      throw err;
    }

    // 3. Delete services for these customers (if table exists)
    let servicesResult = { rowCount: 0 };
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'services'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        servicesResult = await client.query(`
          DELETE FROM services WHERE customer_id = ANY($1::int[])
        `, [customerIds]);
        console.log(`Deleted ${servicesResult.rowCount} services records`);
      } else {
        console.log('services table does not exist, skipping...');
      }
    } catch (err) {
      console.log('Error checking/deleting from services:', err.message);
      throw err;
    }

    // 4. Delete notifications for these users (if table exists)
    let notificationsResult = { rowCount: 0 };
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        notificationsResult = await client.query(`
          DELETE FROM notifications WHERE user_id = ANY($1::int[])
        `, [customerIds]);
        console.log(`Deleted ${notificationsResult.rowCount} notifications records`);
      } else {
        console.log('notifications table does not exist, skipping...');
      }
    } catch (err) {
      console.log('Error checking/deleting from notifications:', err.message);
      throw err;
    }

    // 5. Delete stock_history for these users (if table exists)
    let stockHistoryResult = { rowCount: 0 };
    try {
      // Check if table exists first
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'stock_history'
        )
      `);
      
      if (tableCheck.rows[0].exists) {
        stockHistoryResult = await client.query(`
          DELETE FROM stock_history WHERE user_id = ANY($1::int[])
        `, [customerIds]);
        console.log(`Deleted ${stockHistoryResult.rowCount} stock_history records`);
      } else {
        console.log('stock_history table does not exist, skipping...');
      }
    } catch (err) {
      console.log('Error checking/deleting from stock_history:', err.message);
      throw err;
    }

    // 6. Delete customer_profiles for these users
    const customerProfilesResult = await client.query(`
      DELETE FROM customer_profiles WHERE user_id = ANY($1::int[])
    `, [customerIds]);
    console.log(`Deleted ${customerProfilesResult.rowCount} customer_profiles records`);

    // 6b. Clean up any orphan customer_profiles (no user reference or missing user)
    const orphanProfilesResult = await client.query(`
      DELETE FROM customer_profiles cp
      WHERE cp.user_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id = cp.user_id)
    `);
    if (orphanProfilesResult.rowCount > 0) {
      console.log(`Deleted ${orphanProfilesResult.rowCount} orphan customer_profiles records`);
    }

    // 7. Finally, delete the users themselves
    const usersResult = await client.query(`
      DELETE FROM users WHERE id = ANY($1::int[])
    `, [customerIds]);
    console.log(`Deleted ${usersResult.rowCount} users records`);

    await client.query('COMMIT');
    console.log('\n✅ Successfully deleted all customer users and their related data!');
    console.log(`\nSummary:`);
    console.log(`  - Customer users deleted: ${customerCount}`);
    console.log(`  - Sales deleted: ${salesResult.rowCount || 0}`);
    console.log(`  - Services deleted: ${servicesResult.rowCount || 0}`);
    console.log(`  - Notifications deleted: ${notificationsResult.rowCount || 0}`);
    console.log(`  - Stock history deleted: ${stockHistoryResult.rowCount || 0}`);

    // Verify remaining users
    const remainingUsersResult = await client.query(`
      SELECT u.id, u.full_name, u.email, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `);

    console.log(`\nRemaining users (${remainingUsersResult.rows.length}):`);
    remainingUsersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email || 'N/A'}, Role: ${user.role_name}`);
    });

    client.release();
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
        console.error('Transaction rolled back due to error');
      } catch (rollbackErr) {
        console.error('Error during rollback:', rollbackErr);
      }
      client.release();
    }
    console.error('Error deleting customers:', err);
    throw err;
  }
}

// Run the script
deleteAllCustomers()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });

