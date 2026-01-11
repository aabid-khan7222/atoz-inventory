// Script to reset password for specific admin user (pathanaabid5152@gmail.com)
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");

// Determine which database URL to use based on environment
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  } else {
    return process.env.DATABASE_URL;
  }
};

const poolConfig = {
  connectionString: getDatabaseUrl(),
};

if (process.env.NODE_ENV === "production") {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

// Generate a secure random password
function generateSecurePassword(length = 12) {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;
  
  let password = "";
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

async function resetAdminPassword() {
  const client = await pool.connect();
  const adminEmail = "pathanaabid5152@gmail.com";
  
  try {
    const env = process.env.NODE_ENV || "development";
    console.log(`🔐 Admin user ka password reset kar rahe hain...`);
    console.log(`📍 Environment: ${env}`);
    console.log(`📧 Email: ${adminEmail}\n`);
    
    // First, check if user exists
    const checkQuery = `
      SELECT 
        id,
        full_name,
        email,
        role_id,
        password,
        is_active
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `;
    
    const checkResult = await client.query(checkQuery, [adminEmail]);
    
    if (checkResult.rows.length === 0) {
      console.log(`❌ User nahi mila: ${adminEmail}`);
      return;
    }
    
    const user = checkResult.rows[0];
    console.log(`✅ User mil gaya:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.full_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role ID: ${user.role_id}`);
    console.log(`   Is Active: ${user.is_active}`);
    console.log(`   Current Password Hash: ${user.password ? user.password.substring(0, 20) + '...' : 'NULL'}\n`);
    
    // Generate new password
    const newPassword = generateSecurePassword(12);
    console.log(`🔑 New Password Generated: ${newPassword}\n`);
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 Password Hashed Successfully\n`);
    
    // Update password in database
    await client.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, user.id]
    );
    
    console.log(`✅ Password database mein update ho gaya!\n`);
    
    // Verify the update
    const verifyResult = await client.query(
      "SELECT password FROM users WHERE id = $1",
      [user.id]
    );
    
    const updatedPasswordHash = verifyResult.rows[0].password;
    console.log(`✅ Verification:`);
    console.log(`   Updated Password Hash: ${updatedPasswordHash.substring(0, 20)}...`);
    
    // Test password verification
    const isMatch = await bcrypt.compare(newPassword, updatedPasswordHash);
    console.log(`   Password Verification Test: ${isMatch ? '✅ PASSED' : '❌ FAILED'}\n`);
    
    console.log("=".repeat(70));
    console.log("📋 ADMIN PASSWORD:");
    console.log("=".repeat(70));
    console.log(`👤 ADMIN`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Full Name: ${user.full_name}`);
    console.log(`   🔑 New Password: ${newPassword}`);
    console.log("=".repeat(70));
    console.log("⚠️  IMPORTANT: Yeh password safely save kar lein!");
    console.log("=".repeat(70));
    
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
resetAdminPassword()
  .then(() => {
    console.log("\n🎉 Password reset completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Password reset failed:", error);
    process.exit(1);
  });

