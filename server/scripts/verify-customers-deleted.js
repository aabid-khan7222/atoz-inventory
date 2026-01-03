/**
 * Verify that customers have been deleted
 */
require('dotenv').config();
const db = require('../db');

async function verify() {
  try {
    console.log('Verifying customer deletion...\n');
    
    // Check customer_profiles
    const customerProfiles = await db.query('SELECT COUNT(*) as count FROM customer_profiles');
    console.log(`Customer profiles remaining: ${customerProfiles.rows[0].count}`);
    
    // Check non-admin users
    const nonAdminUsers = await db.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id NOT IN (1, 2)
    `);
    console.log(`Non-admin users remaining: ${nonAdminUsers.rows[0].count}`);
    
    // Check admin users
    const adminUsers = await db.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id IN (1, 2)
    `);
    console.log(`Admin/Super Admin users: ${adminUsers.rows[0].count}`);
    
    // List remaining customer_profiles (if any)
    const remainingProfiles = await db.query(`
      SELECT user_id, full_name, email 
      FROM customer_profiles
    `);
    
    if (remainingProfiles.rows.length > 0) {
      console.log('\nRemaining customer_profiles:');
      remainingProfiles.rows.forEach(row => {
        console.log(`  - ID: ${row.user_id}, Name: ${row.full_name}, Email: ${row.email || 'N/A'}`);
      });
    } else {
      console.log('\n✓ No customer_profiles remaining (as expected)');
    }
    
    // List remaining non-admin users (if any)
    const remainingUsers = await db.query(`
      SELECT u.id, u.email, u.full_name, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.role_id NOT IN (1, 2)
    `);
    
    if (remainingUsers.rows.length > 0) {
      console.log('\nRemaining non-admin users:');
      remainingUsers.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Email: ${row.email}, Name: ${row.full_name}, Role: ${row.role_name || 'N/A'}`);
      });
    } else {
      console.log('\n✓ No non-admin users remaining (as expected)');
    }
    
    console.log('\n✓ Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

verify();

