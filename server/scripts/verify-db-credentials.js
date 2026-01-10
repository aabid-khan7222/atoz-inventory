// Verify that local and Render database credentials are different
// This ensures we won't accidentally modify the local database

require('dotenv').config();

const LOCAL_DB_URL = process.env.DATABASE_URL || 'postgres://postgres:007222@localhost:5432/inventory_db';
const RENDER_DB_URL = process.env.DATABASE_URL_PROD || 'postgresql://atoz_inventory_user:5onz8uUNT7j5UicfQyVEztDXK4lwOSgz@dpg-d5eekfvgi27c73av6nh0-a:5432/atoz_inventory';

console.log('🔍 Verifying Database Credentials...\n');

// Extract database info from connection strings
function parseDbUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      host: urlObj.hostname,
      port: urlObj.port || '5432',
      database: urlObj.pathname.replace('/', ''),
      user: urlObj.username,
      password: urlObj.password ? '***' + urlObj.password.slice(-4) : 'none'
    };
  } catch (e) {
    return null;
  }
}

const localDb = parseDbUrl(LOCAL_DB_URL);
const renderDb = parseDbUrl(RENDER_DB_URL);

console.log('📊 Local Database:');
console.log(`   Host: ${localDb?.host || 'N/A'}`);
console.log(`   Port: ${localDb?.port || 'N/A'}`);
console.log(`   Database: ${localDb?.database || 'N/A'}`);
console.log(`   User: ${localDb?.user || 'N/A'}`);
console.log(`   Password: ${localDb?.password || 'N/A'}\n`);

console.log('📊 Render Database:');
console.log(`   Host: ${renderDb?.host || 'N/A'}`);
console.log(`   Port: ${renderDb?.port || 'N/A'}`);
console.log(`   Database: ${renderDb?.database || 'N/A'}`);
console.log(`   User: ${renderDb?.user || 'N/A'}`);
console.log(`   Password: ${renderDb?.password || 'N/A'}\n`);

// Verify they are different
const areDifferent = 
  localDb?.host !== renderDb?.host ||
  localDb?.database !== renderDb?.database ||
  localDb?.user !== renderDb?.user;

if (areDifferent) {
  console.log('✅ VERIFICATION PASSED: Databases are DIFFERENT');
  console.log('   ✓ Local database will NOT be modified');
  console.log('   ✓ Safe to proceed with migration\n');
  process.exit(0);
} else {
  console.log('❌ VERIFICATION FAILED: Databases appear to be the SAME!');
  console.log('   ⚠️  DO NOT PROCEED - This could modify your local database!');
  console.log('   ⚠️  Please check your .env file and ensure DATABASE_URL_PROD is set correctly\n');
  process.exit(1);
}

