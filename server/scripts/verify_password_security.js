// Script to verify all passwords are properly hashed and stored securely
const db = require('../db');
const bcrypt = require('bcrypt');

(async () => {
  try {
    console.log('🔐 Verifying Password Security\n');
    console.log('='.repeat(50));
    
    // 1. Check users table passwords
    console.log('\n1️⃣  Checking users table:');
    const usersResult = await db.query(`
      SELECT id, email, full_name, password
      FROM users 
      WHERE password IS NOT NULL 
      AND password != ''
      ORDER BY id
    `);
    
    let usersHashed = 0;
    let usersPlainText = 0;
    
    for (const user of usersResult.rows) {
      const password = (user.password || '').trim();
      const isHashed = password.startsWith('$2');
      
      if (isHashed) {
        usersHashed++;
      } else if (password) {
        usersPlainText++;
        console.log(`   ⚠️  User ${user.id} (${user.email || user.full_name}): Plain text password!`);
      }
      
    }
    
    console.log(`   ✅ Total users with passwords: ${usersResult.rows.length}`);
    console.log(`   ✅ Hashed passwords: ${usersHashed}`);
    console.log(`   ⚠️  Plain text passwords: ${usersPlainText}`);
    console.log(`   ✅ Users with password_hash column: (column removed)`);
    
    // 2. Check customer_profiles table
    console.log('\n2️⃣  Checking customer_profiles table:');
    const profilesResult = await db.query(`
      SELECT user_id, full_name, email, password
      FROM customer_profiles 
      WHERE password IS NOT NULL 
      AND password != ''
      ORDER BY user_id
    `);
    
    if (profilesResult.rows.length === 0) {
      console.log(`   ✅ No passwords stored in customer_profiles (correct - passwords should only be in users table)`);
    } else {
      console.log(`   ⚠️  Found ${profilesResult.rows.length} customer profiles with passwords stored`);
      console.log(`   ⚠️  WARNING: Passwords should NOT be stored in customer_profiles table!`);
    }
    
    // 3. Verify login functionality
    console.log('\n3️⃣  Testing password verification:');
    if (usersResult.rows.length > 0) {
      const testUser = usersResult.rows[0];
      const testPassword = 'test_password_123'; // This won't work, but we can check the format
      
      if (testUser.password.startsWith('$2')) {
        console.log(`   ✅ User ${testUser.id} password is in bcrypt format (starts with $2)`);
        console.log(`   ✅ Login system will use bcrypt.compare() for this user`);
      } else {
        console.log(`   ⚠️  User ${testUser.id} password is plain text`);
        console.log(`   ⚠️  Login system will use plain text comparison (less secure)`);
      }
    }
    
    // 4. Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 SECURITY SUMMARY:\n');
    
    if (usersPlainText === 0 && profilesResult.rows.length === 0) {
      console.log('✅ EXCELLENT: All passwords are properly secured!');
      console.log('   - All passwords in users table are hashed');
      console.log('   - No passwords stored in customer_profiles table');
      console.log('   - Login system will use secure bcrypt comparison');
    } else {
      console.log('⚠️  ISSUES FOUND:');
      if (usersPlainText > 0) {
        console.log(`   - ${usersPlainText} users have plain text passwords (need to be hashed)`);
      }
      if (profilesResult.rows.length > 0) {
        console.log(`   - ${profilesResult.rows.length} customer profiles have passwords (should be removed)`);
      }
    }
    
    console.log('\n✅ Verification complete!\n');
    
  } catch (e) {
    console.error('\n❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();

