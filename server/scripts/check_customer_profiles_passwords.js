// Script to check password storage in customer_profiles table
const db = require('../db');

(async () => {
  try {
    console.log('🔍 Checking customer_profiles table for password column...\n');
    
    // Check if password column exists
    const columnCheck = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' 
      AND column_name = 'password'
    `);
    
    if (columnCheck.rows.length === 0) {
      console.log('ℹ️  No password column found in customer_profiles table.');
      console.log('✅ This is correct - passwords should only be in users table.');
      return;
    }
    
    console.log('⚠️  Password column exists in customer_profiles table.');
    console.log('Checking password values...\n');
    
    // Get all customer profiles with passwords
    const profilesResult = await db.query(`
      SELECT cp.user_id, cp.full_name, cp.email, cp.password,
             u.id as user_id_check, u.password as user_password
      FROM customer_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE cp.password IS NOT NULL
      ORDER BY cp.user_id
    `);
    
    console.log(`Found ${profilesResult.rows.length} customer profiles with passwords\n`);
    
    if (profilesResult.rows.length === 0) {
      console.log('✅ All customer_profiles.password values are NULL (correct).');
      console.log('✅ Passwords are only stored in users table (correct).');
      return;
    }
    
    // Analyze passwords
    let hashedCount = 0;
    let plainTextCount = 0;
    
    for (const profile of profilesResult.rows) {
      const password = (profile.password || '').trim();
      const isHashed = password.startsWith('$2');
      
      if (isHashed) {
        hashedCount++;
        console.log(`✅ Profile ${profile.user_id} (${profile.full_name || profile.email}): Hashed`);
      } else if (password) {
        plainTextCount++;
        console.log(`⚠️  Profile ${profile.user_id} (${profile.full_name || profile.email}): Plain text`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total with passwords: ${profilesResult.rows.length}`);
    console.log(`   Hashed: ${hashedCount}`);
    console.log(`   Plain text: ${plainTextCount}`);
    
  } catch (e) {
    console.error('❌ ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
})();

