// Script to remove duplicate admin user
// This script will keep the first admin user (lowest ID) and remove the duplicate

require('dotenv').config();
const db = require('../db');

async function removeDuplicateAdmin() {
  try {
    console.log('Checking for admin users...');
    
    // Get all admin users (role_id = 2)
    const adminUsers = await db.query(`
      SELECT id, full_name, email, created_at
      FROM users
      WHERE role_id = 2
      ORDER BY id ASC
    `);
    
    if (adminUsers.rows.length === 0) {
      console.log('No admin users found.');
      return;
    }
    
    console.log(`Found ${adminUsers.rows.length} admin user(s):`);
    adminUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}, Name: ${user.full_name}, Email: ${user.email}, Created: ${user.created_at}`);
    });
    
    if (adminUsers.rows.length === 1) {
      console.log('Only one admin user exists. No duplicates to remove.');
      return;
    }
    
    // Keep the first admin (lowest ID) and remove the rest
    const adminToKeep = adminUsers.rows[0];
    const adminsToRemove = adminUsers.rows.slice(1);
    
    console.log(`\nKeeping admin user: ID ${adminToKeep.id} (${adminToKeep.full_name})`);
    console.log(`Removing ${adminsToRemove.length} duplicate admin user(s)...`);
    
    for (const admin of adminsToRemove) {
      console.log(`\nRemoving admin user: ID ${admin.id} (${admin.full_name})...`);
      
      // Check if this admin has any related records
      const salesCheck = await db.query(`
        SELECT COUNT(*) as count FROM sales_item WHERE customer_id = $1
      `, [admin.id]);
      
      const salesCount = parseInt(salesCheck.rows[0]?.count || 0);
      
      if (salesCount > 0) {
        console.log(`  Warning: Admin user has ${salesCount} sales records. These will be deleted.`);
      }
      
      // Delete the admin user
      // Note: This will cascade delete related records if foreign keys are set up
      await db.query(`DELETE FROM users WHERE id = $1`, [admin.id]);
      
      console.log(`  ✓ Successfully removed admin user ID ${admin.id}`);
    }
    
    console.log('\n✓ Duplicate admin user(s) removed successfully!');
    console.log(`✓ Remaining admin user: ID ${adminToKeep.id} (${adminToKeep.full_name})`);
    
  } catch (err) {
    console.error('Error removing duplicate admin:', err);
    throw err;
  } finally {
    await db.pool.end();
  }
}

// Run the script
removeDuplicateAdmin()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });

