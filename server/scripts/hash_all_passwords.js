// Script to hash all plain text passwords in the users table
// This ensures all passwords are stored securely as bcrypt hashes
const db = require('../db');
const bcrypt = require('bcrypt');

(async () => {
  let client;
  try {
    console.log('🔐 Starting password hashing process...\n');
    
    client = await db.pool.connect();
    await client.query('BEGIN');
    
    // Get all users with their passwords
    const usersResult = await client.query(`
      SELECT id, email, full_name, password 
      FROM users 
      WHERE password IS NOT NULL 
      AND password != ''
      ORDER BY id
    `);
    
    console.log(`Found ${usersResult.rows.length} users with passwords\n`);
    
    if (usersResult.rows.length === 0) {
      console.log('No users found with passwords. Exiting.');
      await client.query('COMMIT');
      return;
    }
    
    let hashedCount = 0;
    let plainTextCount = 0;
    let alreadyHashedCount = 0;
    let nullCount = 0;
    const updates = [];
    
    // Analyze each password
    for (const user of usersResult.rows) {
      const password = (user.password || '').trim();
      
      if (!password) {
        nullCount++;
        console.log(`⚠️  User ${user.id} (${user.email || user.full_name}): Password is empty/null`);
        continue;
      }
      
      // Check if already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
      if (password.startsWith('$2')) {
        alreadyHashedCount++;
        console.log(`✅ User ${user.id} (${user.email || user.full_name}): Already hashed`);
        continue;
      }
      
      // This is a plain text password - hash it
      plainTextCount++;
      console.log(`🔒 User ${user.id} (${user.email || user.full_name}): Plain text detected, hashing...`);
      
      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        updates.push({
          id: user.id,
          email: user.email || user.full_name,
          oldPassword: password.substring(0, 3) + '***', // Show first 3 chars for verification
          hashedPassword
        });
      } catch (hashError) {
        console.error(`❌ Error hashing password for user ${user.id}:`, hashError.message);
        throw hashError;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total users: ${usersResult.rows.length}`);
    console.log(`   Already hashed: ${alreadyHashedCount}`);
    console.log(`   Plain text (to hash): ${plainTextCount}`);
    console.log(`   Empty/null: ${nullCount}`);
    console.log(`   Will update: ${updates.length}\n`);
    
    if (updates.length === 0) {
      console.log('✅ All passwords are already hashed! No updates needed.');
      await client.query('COMMIT');
      return;
    }
    
    // Update passwords in database
    console.log('🔄 Updating passwords in database...\n');
    
    for (const update of updates) {
      try {
        await client.query(
          `UPDATE users SET password = $1 WHERE id = $2`,
          [update.hashedPassword, update.id]
        );
        console.log(`✅ Updated user ${update.id} (${update.email})`);
      } catch (updateError) {
        console.error(`❌ Error updating user ${update.id}:`, updateError.message);
        throw updateError;
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Successfully hashed and updated ${updates.length} passwords!`);
    console.log('✅ All passwords are now securely stored as bcrypt hashes.');
    console.log('\n⚠️  IMPORTANT: Test login for all updated users to ensure everything works correctly.');
    
  } catch (e) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('\n❌ ERROR:', e.message);
    console.error(e.stack);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    process.exit();
  }
})();

