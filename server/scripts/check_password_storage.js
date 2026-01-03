// Script to check where passwords are stored
const db = require('../db');

(async () => {
  try {
    console.log('🔍 Checking Password Storage Locations\n');
    console.log('='.repeat(60));
    
    // Check users table
    console.log('\n1️⃣  USERS TABLE (where passwords SHOULD be stored):');
    const usersResult = await db.query(`
      SELECT id, email, full_name, 
             CASE 
               WHEN password IS NULL THEN 'NULL'
               WHEN password = '' THEN 'EMPTY'
               WHEN password LIKE '$2%' THEN 'HASHED (bcrypt)'
               ELSE 'PLAIN TEXT'
             END as password_status,
             LENGTH(password) as password_length
      FROM users 
      ORDER BY id
      LIMIT 10
    `);
    
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(u => {
      console.log(`   User ${u.id}: ${u.email || u.full_name} - Password: ${u.password_status}`);
    });
    
    // Check customer_profiles table
    console.log('\n2️⃣  CUSTOMER_PROFILES TABLE (passwords should be NULL here):');
    const profilesResult = await db.query(`
      SELECT user_id, email, full_name,
             CASE 
               WHEN password IS NULL THEN 'NULL'
               WHEN password = '' THEN 'EMPTY'
               WHEN password LIKE '$2%' THEN 'HASHED (bcrypt)'
               ELSE 'PLAIN TEXT'
             END as password_status
      FROM customer_profiles 
      ORDER BY user_id
      LIMIT 10
    `);
    
    console.log(`Found ${profilesResult.rows.length} customer profiles:`);
    profilesResult.rows.forEach(p => {
      console.log(`   Profile ${p.user_id}: ${p.email || p.full_name} - Password: ${p.password_status}`);
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY:\n');
    
    const usersWithPasswords = usersResult.rows.filter(u => u.password_status !== 'NULL' && u.password_status !== 'EMPTY').length;
    const profilesWithPasswords = profilesResult.rows.filter(p => p.password_status !== 'NULL' && p.password_status !== 'EMPTY').length;
    
    console.log(`✅ Users table: ${usersWithPasswords} users have passwords stored`);
    console.log(`${profilesWithPasswords === 0 ? '✅' : '⚠️'} Customer profiles: ${profilesWithPasswords} profiles have passwords (should be 0)`);
    
    if (profilesWithPasswords === 0) {
      console.log('\n✅ CORRECT: Passwords are only in users table (secure)');
      console.log('   The NULL values in customer_profiles.password are CORRECT.');
      console.log('   Passwords should NOT be stored in customer_profiles for security.');
    } else {
      console.log('\n⚠️  WARNING: Some passwords found in customer_profiles!');
      console.log('   This is a security risk. Passwords should only be in users table.');
    }
    
    console.log('\n💡 IMPORTANT:');
    console.log('   - Passwords are stored in: users.password (hashed)');
    console.log('   - Passwords should be NULL in: customer_profiles.password');
    console.log('   - Login uses: users.password (not customer_profiles.password)');
    
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();

