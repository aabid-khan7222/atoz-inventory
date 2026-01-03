// Script to test pincode update
const db = require('../db');

(async () => {
  try {
    console.log('🔍 Testing Pincode Update\n');
    
    // Check current pincode values
    const current = await db.query(`
      SELECT user_id, full_name, email, pincode 
      FROM customer_profiles 
      WHERE user_id IN (4, 16, 17, 18) 
      ORDER BY user_id
    `);
    
    console.log('Current pincode values:');
    current.rows.forEach(r => {
      console.log(`  User ${r.user_id} (${r.email || r.full_name}): pincode = ${r.pincode || 'NULL'}`);
    });
    
    // Check if pincode column exists in users table
    const usersColCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'pincode'
    `);
    
    console.log(`\nusers.pincode column exists: ${usersColCheck.rows.length > 0}`);
    
    // Check if pincode column exists in customer_profiles table
    const profilesColCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' 
      AND column_name = 'pincode'
    `);
    
    console.log(`customer_profiles.pincode column exists: ${profilesColCheck.rows.length > 0}`);
    
    if (usersColCheck.rows.length > 0) {
      console.log('\n⚠️  WARNING: users table has pincode column - this might cause issues');
    } else {
      console.log('\n✅ users table does NOT have pincode column (correct - pincode should only be in customer_profiles)');
    }
    
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();

