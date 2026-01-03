// Script to verify user_type column and values
require('dotenv').config();
const db = require('../db');

async function verify() {
  try {
    console.log('Verifying user_type column...\n');
    
    // Check if user_type column exists
    const colCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_type'
    `);
    
    if (colCheck.rows.length === 0) {
      console.log('❌ user_type column does not exist!');
      process.exit(1);
    }
    
    console.log('✅ user_type column exists\n');
    
    // Check distribution
    const distribution = await db.query(`
      SELECT role_id, user_type, COUNT(*) as count 
      FROM users 
      GROUP BY role_id, user_type 
      ORDER BY role_id, user_type
    `);
    
    console.log('Current user_type distribution:');
    distribution.rows.forEach(row => {
      console.log(`  role_id=${row.role_id}, user_type='${row.user_type}': ${row.count} users`);
    });
    
    // Check for any invalid values
    const invalid = await db.query(`
      SELECT id, role_id, user_type 
      FROM users 
      WHERE user_type NOT IN ('admin', 'super admin', 'b2b', 'b2c')
    `);
    
    if (invalid.rows.length > 0) {
      console.log('\n⚠️  Found invalid user_type values:');
      invalid.rows.forEach(row => {
        console.log(`  User ID ${row.id}: role_id=${row.role_id}, user_type='${row.user_type}'`);
      });
    } else {
      console.log('\n✅ All user_type values are valid');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verify();

