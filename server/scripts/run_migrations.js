// Run database migrations
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

// Determine which database URL to use based on environment
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    // Production environment - prefer DATABASE_URL_PROD, fallback to DATABASE_URL
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  } else {
    // Development environment - use DATABASE_URL
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

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migrations...');
    
    // Read and execute base tables migration
    const baseTablesPath = path.join(__dirname, '../migrations/001_create_base_tables.sql');
    const baseTablesSQL = fs.readFileSync(baseTablesPath, 'utf8');
    
    console.log('📋 Creating base tables (roles, users, customer_profiles)...');
    await client.query(baseTablesSQL);
    console.log('✅ Base tables created successfully');
    
    // Check if admin user exists
    const adminCheck = await client.query(
      "SELECT id FROM users WHERE email = 'admin@atozinventory.com' LIMIT 1"
    );
    
    if (adminCheck.rows.length === 0) {
      console.log('👤 Creating default admin user...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await client.query(
        `INSERT INTO users (full_name, email, password, role_id, is_active)
         VALUES ($1, $2, $3, $4, $5)`,
        ['Super Admin', 'admin@atozinventory.com', hashedPassword, 1, true]
      );
      console.log('✅ Default admin user created');
      console.log('   Email: admin@atozinventory.com');
      console.log('   Password: admin123');
      console.log('   ⚠️  Please change password after first login!');
    } else {
      console.log('ℹ️  Admin user already exists, skipping...');
    }
    
    console.log('✅ All migrations completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations()
  .then(() => {
    console.log('🎉 Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });

