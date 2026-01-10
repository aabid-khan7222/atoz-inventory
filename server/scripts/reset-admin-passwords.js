// Script to reset passwords for admin and super admin users
// This script generates new secure passwords and updates them in the database

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

async function resetAdminPasswords() {
  const client = await pool.connect();
  
  try {
    const env = process.env.NODE_ENV || "development";
    console.log(`🔐 Admin aur Super Admin ke passwords reset kar rahe hain...`);
    console.log(`📍 Environment: ${env}\n`);
    
    // Find admin and super admin users - try with JOIN first, fallback if roles table doesn't exist
    let result;
    let users;
    
    try {
      const query = `
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role_id,
          r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.role_id IN (1, 2)
        ORDER BY u.role_id ASC, u.id ASC
      `;
      result = await client.query(query);
      users = result.rows;
    } catch (dbError) {
      // If JOIN fails (roles table might not exist), try without JOIN
      console.warn("⚠️  Roles table JOIN failed, trying without JOIN:", dbError.message);
      try {
        const simpleQuery = `
          SELECT 
            id,
            full_name,
            email,
            role_id
          FROM users
          WHERE role_id IN (1, 2)
          ORDER BY role_id ASC, id ASC
        `;
        result = await client.query(simpleQuery);
        users = result.rows.map(user => ({
          ...user,
          role_name: user.role_id === 1 ? 'Super Admin' : user.role_id === 2 ? 'Admin' : 'Unknown'
        }));
      } catch (simpleError) {
        console.error("❌ Database query failed:", simpleError);
        throw simpleError;
      }
    }
    
    if (users.length === 0) {
      console.log("⚠️  Koi admin ya super admin user nahi mila!");
      console.log("   Database me role_id = 1 (Super Admin) ya role_id = 2 (Admin) wale users check karein.");
      return;
    }
    
    console.log(`✅ ${users.length} admin/super admin user(s) mil gaye:\n`);
    
    const passwordUpdates = [];
    
    for (const user of users) {
      // Generate new password
      const newPassword = generateSecurePassword(12);
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      // Update password in database
      await client.query(
        "UPDATE users SET password = $1 WHERE id = $2",
        [hashedPassword, user.id]
      );
      
      passwordUpdates.push({
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        roleName: user.role_name,
        roleId: user.role_id,
        password: newPassword,
      });
      
      console.log(`✅ ${user.role_name} (${user.email}) ka password update ho gaya`);
    }
    
    console.log("\n" + "=".repeat(70));
    console.log("📋 NEW PASSWORDS (Yeh passwords save kar lein!):");
    console.log("=".repeat(70) + "\n");
    
    for (const update of passwordUpdates) {
      console.log(`👤 ${update.roleName.toUpperCase()}`);
      console.log(`   Email/Username: ${update.email}`);
      console.log(`   Full Name: ${update.fullName}`);
      console.log(`   🔑 New Password: ${update.password}`);
      console.log("");
    }
    
    console.log("=".repeat(70));
    console.log("⚠️  IMPORTANT: Yeh passwords safely save kar lein!");
    console.log("   Agar aap inhe bhool jayenge to phir se script run karna hoga.");
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
resetAdminPasswords()
  .then(() => {
    console.log("\n🎉 Password reset completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Password reset failed:", error);
    process.exit(1);
  });

