// server/scripts/check_and_delete_customers.js
// Check all users and delete any that are not admin or super admin

require('dotenv').config();
const db = require('../db');

async function checkAndDeleteCustomers() {
  let client;
  
  try {
    console.log('Checking all users in the database...');
    
    client = await db.pool.connect();
    await client.query('BEGIN');

    // Get all users with their roles
    const allUsersResult = await client.query(`
      SELECT u.id, u.full_name, u.email, u.role_id, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ORDER BY u.id
    `);

    console.log(`\nTotal users found: ${allUsersResult.rows.length}`);
    console.log('\nAll users:');
    allUsersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email || 'N/A'}, Role: ${user.role_name} (role_id: ${user.role_id})`);
    });

    // Find customer users (role_id != 1 and role_id != 2)
    const customerUsers = allUsersResult.rows.filter(user => user.role_id !== 1 && user.role_id !== 2);
    
    if (customerUsers.length === 0) {
      console.log('\n✅ No customer users found. Only admin and super admin users exist.');
      
      // Also check for orphan customer_profiles
      const orphanProfiles = await client.query(`
        SELECT cp.* 
        FROM customer_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE u.id IS NULL
      `);
      
      if (orphanProfiles.rows.length > 0) {
        console.log(`\nFound ${orphanProfiles.rows.length} orphan customer_profiles, deleting...`);
        await client.query(`DELETE FROM customer_profiles WHERE user_id NOT IN (SELECT id FROM users)`);
        console.log(`Deleted ${orphanProfiles.rows.length} orphan profiles`);
      }
      
      await client.query('COMMIT');
      client.release();
      return;
    }

    const customerIds = customerUsers.map(user => user.id);
    console.log(`\n⚠️  Found ${customerUsers.length} customer users to delete:`);
    customerUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email || 'N/A'}, Role: ${user.role_name}`);
    });

    // Delete related records
    console.log('\nDeleting related records...');

    // Delete sale_items (if exists)
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sale_items'
        )
      `);
      if (tableCheck.rows[0].exists) {
        await client.query(`
          DELETE FROM sale_items 
          WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = ANY($1::int[]))
        `, [customerIds]);
      }
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Delete sales (if exists)
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales'
        )
      `);
      if (tableCheck.rows[0].exists) {
        await client.query(`DELETE FROM sales WHERE customer_id = ANY($1::int[])`, [customerIds]);
      }
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Delete services (if exists)
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'services'
        )
      `);
      if (tableCheck.rows[0].exists) {
        await client.query(`DELETE FROM services WHERE customer_id = ANY($1::int[])`, [customerIds]);
      }
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Delete notifications (if exists)
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'notifications'
        )
      `);
      if (tableCheck.rows[0].exists) {
        await client.query(`DELETE FROM notifications WHERE user_id = ANY($1::int[])`, [customerIds]);
      }
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Delete stock_history (if exists)
    try {
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'stock_history'
        )
      `);
      if (tableCheck.rows[0].exists) {
        await client.query(`DELETE FROM stock_history WHERE user_id = ANY($1::int[])`, [customerIds]);
      }
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Delete customer_profiles
    await client.query(`DELETE FROM customer_profiles WHERE user_id = ANY($1::int[])`, [customerIds]);
    console.log(`Deleted customer_profiles for ${customerIds.length} users`);

    // Delete users
    await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [customerIds]);
    console.log(`Deleted ${customerIds.length} customer users`);

    // Also delete any orphan customer_profiles
    const orphanProfiles = await client.query(`
      SELECT COUNT(*) as count
      FROM customer_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE u.id IS NULL
    `);
    
    if (parseInt(orphanProfiles.rows[0].count) > 0) {
      await client.query(`DELETE FROM customer_profiles WHERE user_id NOT IN (SELECT id FROM users)`);
      console.log(`Deleted ${orphanProfiles.rows[0].count} orphan customer_profiles`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Successfully deleted all customer users!');

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
    console.error('Error:', err);
    throw err;
  }
}

// Run the script
checkAndDeleteCustomers()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Script failed:', err);
    process.exit(1);
  });

