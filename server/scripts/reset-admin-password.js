// Script to reset admin user password
// This script will reset the password for the admin user "aabid khan"

require('dotenv').config();
const db = require('../db');
const bcrypt = require('bcrypt');

async function resetAdminPassword() {
  try {
    console.log('Finding admin user "aabid khan"...');
    
    // Find the admin user
    const adminUser = await db.query(`
      SELECT id, full_name, email, role_id
      FROM users
      WHERE role_id = 2 AND LOWER(full_name) LIKE '%aabid%'
      LIMIT 1
    `);
    
    if (adminUser.rows.length === 0) {
      console.log('Admin user "aabid khan" not found.');
      return;
    }
    
    const user = adminUser.rows[0];
    console.log(`Found admin user:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.full_name}`);
    console.log(`  Email: ${user.email}`);
    
    // Set a temporary password
    const tempPassword = 'admin123'; // You can change this to any password you want
    console.log(`\nResetting password to: ${tempPassword}`);
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);
    
    // Update the password in database
    await db.query(`
      UPDATE users 
      SET password = $1 
      WHERE id = $2
    `, [hashedPassword, user.id]);
    
    console.log('\n✓ Password reset successfully!');
    console.log(`\nLogin credentials:`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Password: ${tempPassword}`);
    console.log(`\n⚠️  IMPORTANT: Please change this password after logging in for security!`);
    
  } catch (err) {
    console.error('Error resetting password:', err);
    throw err;
  } finally {
    await db.pool.end();
  }
}

// Run the script
resetAdminPassword()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });

