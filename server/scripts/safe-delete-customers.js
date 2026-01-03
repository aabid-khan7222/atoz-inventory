/**
 * Safe Customer Deletion Script
 * 
 * This script:
 * 1. Creates a full database backup
 * 2. Previews what will be deleted
 * 3. Waits for explicit CONFIRM_DELETE before proceeding
 * 
 * Usage:
 *   DATABASE_URL=... node server/scripts/safe-delete-customers.js
 */

require('dotenv').config();
const db = require('../db');
const fs = require('fs');
const path = require('path');

// Get timestamp for backup filename
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}`;
}

// Extract database connection details from DATABASE_URL
function parseDatabaseUrl(url) {
  // Format: postgres://user:password@host:port/database or postgresql://user:password@host:port/database
  const match = url.match(/postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format. Expected: postgres://user:password@host:port/database or postgresql://user:password@host:port/database');
  }
  return {
    user: match[2],
    password: match[3],
    host: match[4],
    port: match[5],
    database: match[6]
  };
}

async function createBackup() {
  console.log('\n=== STEP 1: Creating Database Backup ===\n');
  
  // Try to load .env from server directory
  const serverEnvPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(serverEnvPath)) {
    require('dotenv').config({ path: serverEnvPath });
  }
  
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('\n❌ DATABASE_URL not found!');
    console.error('Please set DATABASE_URL in one of these ways:');
    console.error('  1. Create a .env file in the server/ directory with: DATABASE_URL=postgres://...');
    console.error('  2. Set it as an environment variable before running the script');
    console.error('  3. Pass it as: DATABASE_URL=... node server/scripts/safe-delete-customers.js\n');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const timestamp = getTimestamp();
  const backupFilename = `backup_before_delete_${timestamp}.sql`;
  const backupPath = path.join(__dirname, '..', '..', backupFilename);

  console.log(`Creating backup to: ${backupPath}`);
  console.log('This may take a moment...\n');
  
  const client = await db.pool.connect();
  const backupLines = [];
  
  try {
    // Add header
    backupLines.push('-- Database Backup');
    backupLines.push(`-- Created: ${new Date().toISOString()}`);
    backupLines.push(`-- Database: ${parseDatabaseUrl(dbUrl).database}`);
    backupLines.push('');
    backupLines.push('BEGIN;');
    backupLines.push('');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`  Backing up table: ${tableName}`);
      
      // Get table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      // Get all data
      const dataResult = await client.query(`SELECT * FROM ${tableName}`);
      
      if (dataResult.rows.length > 0) {
        backupLines.push(`-- Table: ${tableName}`);
        backupLines.push(`-- ${dataResult.rows.length} rows`);
        
        const columns = columnsResult.rows.map(c => c.column_name);
        
        for (const row of dataResult.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') {
              return `'${val.replace(/'/g, "''")}'`;
            }
            if (val instanceof Date) {
              return `'${val.toISOString()}'`;
            }
            return String(val);
          });
          
          backupLines.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
        }
        backupLines.push('');
      }
    }

    backupLines.push('COMMIT;');
    
    // Write backup file
    fs.writeFileSync(backupPath, backupLines.join('\n'));
    
    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`✓ Backup created successfully!`);
    console.log(`  File: ${backupPath}`);
    console.log(`  Size: ${fileSizeMB} MB\n`);
    
    return { backupPath, fileSizeMB };
  } catch (error) {
    throw new Error(`Backup failed: ${error.message}`);
  } finally {
    client.release();
  }
}

async function previewDeletions() {
  console.log('\n=== STEP 2: Previewing Data to be Deleted ===\n');

  const client = await db.pool.connect();
  try {
    // Get admin role IDs from roles table
    // Also include role_id = 1 (typically Super Admin) and role_id = 2 (typically Admin) as safety
    const rolesResult = await client.query(`
      SELECT id, role_name 
      FROM roles 
      WHERE LOWER(role_name) IN ('super admin', 'admin', 'superadmin')
         OR id IN (1, 2)
      ORDER BY id;
    `);
    
    // Always include role_id 1 and 2 as admin roles (standard convention)
    const adminRoleIds = [1, 2];
    rolesResult.rows.forEach(r => {
      if (!adminRoleIds.includes(r.id)) {
        adminRoleIds.push(r.id);
      }
    });
    adminRoleIds.sort((a, b) => a - b);
    
    if (adminRoleIds.length === 0) {
      throw new Error('No admin roles found in roles table. Cannot proceed safely.');
    }
    
    console.log('Admin role IDs to preserve:', adminRoleIds);
    console.log('Admin roles:', rolesResult.rows.map(r => `${r.role_name} (id: ${r.id})`).join(', '));
    console.log('');

    // Preview customer_profiles
    console.log('--- Customer Profiles Preview ---');
    const customerProfilesCount = await client.query('SELECT COUNT(*) as count FROM customer_profiles');
    console.log(`Total customer_profiles: ${customerProfilesCount.rows[0].count}`);
    
    const customerProfilesSample = await client.query(`
      SELECT user_id as id, full_name as name, email, phone
      FROM customer_profiles
      ORDER BY user_id
      LIMIT 50
    `);
    console.log(`Sample customer_profiles (showing up to 50):`);
    if (customerProfilesSample.rows.length > 0) {
      customerProfilesSample.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ID: ${row.id}, Name: ${row.name || 'N/A'}, Email: ${row.email || 'N/A'}, Phone: ${row.phone || 'N/A'}`);
      });
    } else {
      console.log('  (No customer profiles found)');
    }
    console.log('');

    // Preview users (non-admin)
    console.log('--- Users Preview (Non-Admin) ---');
    const usersCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id NOT IN (${adminRoleIds.join(',')})
    `);
    console.log(`Total non-admin users: ${usersCount.rows[0].count}`);
    
    const usersSample = await client.query(`
      SELECT u.id, u.email, u.full_name, u.role_id, r.role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.role_id NOT IN (${adminRoleIds.join(',')})
      ORDER BY u.id
      LIMIT 50
    `);
    console.log(`Sample users to be deleted (showing up to 50):`);
    if (usersSample.rows.length > 0) {
      usersSample.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ID: ${row.id}, Email: ${row.email || 'N/A'}, Name: ${row.full_name || 'N/A'}, Role: ${row.role_name || `role_id: ${row.role_id}`}`);
      });
    } else {
      console.log('  (No non-admin users found)');
    }
    console.log('');

    // Check for admin users (should NOT be deleted)
    const adminUsersCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id IN (${adminRoleIds.join(',')})
    `);
    console.log(`✓ Admin/Super Admin users to preserve: ${adminUsersCount.rows[0].count}`);
    
    const adminUsersSample = await client.query(`
      SELECT u.id, u.email, u.full_name, r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.role_id IN (${adminRoleIds.join(',')})
      ORDER BY u.id
      LIMIT 10
    `);
    if (adminUsersSample.rows.length > 0) {
      console.log('Sample admin users (will be preserved):');
      adminUsersSample.rows.forEach((row, idx) => {
        console.log(`  ${idx + 1}. ID: ${row.id}, Email: ${row.email || 'N/A'}, Name: ${row.full_name || 'N/A'}, Role: ${row.role_name}`);
      });
    }
    console.log('');

    // Check for related tables that might reference customers
    console.log('--- Checking Related Tables ---');
    const relatedTables = ['sales', 'sale_items', 'services', 'orders'];
    for (const tableName of relatedTables) {
      try {
        const tableCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )
        `, [tableName]);
        
        if (tableCheck.rows[0].exists) {
          // Check if table has customer_id or user_id column
          const columnCheck = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1
            AND column_name IN ('customer_id', 'user_id')
          `, [tableName]);
          
          if (columnCheck.rows.length > 0) {
            const customerRefCount = await client.query(`
              SELECT COUNT(*) as count 
              FROM ${tableName} 
              WHERE ${columnCheck.rows[0].column_name} IN (
                SELECT id FROM users WHERE role_id NOT IN (${adminRoleIds.join(',')})
              )
            `);
            console.log(`  ${tableName}: ${customerRefCount.rows[0].count} records reference customers (will need handling)`);
          }
        }
      } catch (err) {
        // Table doesn't exist or error checking - skip
      }
    }
    console.log('');

    return {
      customerProfilesCount: parseInt(customerProfilesCount.rows[0].count),
      usersCount: parseInt(usersCount.rows[0].count),
      adminUsersCount: parseInt(adminUsersCount.rows[0].count),
      adminRoleIds,
      customerProfilesSample: customerProfilesSample.rows,
      usersSample: usersSample.rows,
      adminUsersSample: adminUsersSample.rows
    };
  } finally {
    client.release();
  }
}

async function deleteCustomers(previewData) {
  console.log('\n=== STEP 3: Deleting Customers ===\n');
  
  const client = await db.pool.connect();
  const timestamp = getTimestamp();
  const logPath = path.join(__dirname, '..', '..', `delete_customers_log_${timestamp}.txt`);
  
  const log = [];
  log.push(`Customer Deletion Log - ${new Date().toISOString()}`);
  log.push('='.repeat(50));
  log.push(`Before deletion:`);
  log.push(`  Customer profiles: ${previewData.customerProfilesCount}`);
  log.push(`  Non-admin users: ${previewData.usersCount}`);
  log.push(`  Admin users (preserved): ${previewData.adminUsersCount}`);
  log.push('');

  try {
    await client.query('BEGIN');

    // Delete related records first (if they exist and have customer_id references)
    console.log('Deleting related records...');
    
    // Check and delete from services (if exists and has customer_id column)
    const servicesCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'services'
      ) AS table_exists,
      EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name = 'customer_id'
      ) AS has_customer_id
    `);
    
    if (servicesCheck.rows[0].table_exists && servicesCheck.rows[0].has_customer_id) {
      const servicesResult = await client.query(`
        DELETE FROM services 
        WHERE customer_id IN (
          SELECT id FROM users WHERE role_id NOT IN (${previewData.adminRoleIds.join(',')})
        )
      `);
      if (servicesResult.rowCount > 0) {
        console.log(`  Deleted ${servicesResult.rowCount} services records`);
        log.push(`Deleted ${servicesResult.rowCount} services records`);
      }
    }

    // Delete customer_profiles
    console.log('Deleting customer_profiles...');
    const customerProfilesResult = await client.query(`
      DELETE FROM customer_profiles
      WHERE user_id IN (
        SELECT id FROM users WHERE role_id NOT IN (${previewData.adminRoleIds.join(',')})
      )
    `);
    console.log(`  Deleted ${customerProfilesResult.rowCount} customer_profiles records`);
    log.push(`Deleted ${customerProfilesResult.rowCount} customer_profiles records`);

    // Delete non-admin users
    console.log('Deleting non-admin users...');
    const usersResult = await client.query(`
      DELETE FROM users
      WHERE role_id NOT IN (${previewData.adminRoleIds.join(',')})
      RETURNING id, email, full_name, role_id
    `);
    console.log(`  Deleted ${usersResult.rowCount} user records`);
    log.push(`Deleted ${usersResult.rowCount} user records`);
    log.push('');

    // Get after counts
    const afterCustomerProfiles = await client.query('SELECT COUNT(*) as count FROM customer_profiles');
    const afterUsers = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id NOT IN (${previewData.adminRoleIds.join(',')})
    `);
    const afterAdminUsers = await client.query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE role_id IN (${previewData.adminRoleIds.join(',')})
    `);

    log.push(`After deletion:`);
    log.push(`  Customer profiles: ${afterCustomerProfiles.rows[0].count}`);
    log.push(`  Non-admin users: ${afterUsers.rows[0].count}`);
    log.push(`  Admin users (preserved): ${afterAdminUsers.rows[0].count}`);
    log.push('');
    log.push('Deletion completed successfully!');

    await client.query('COMMIT');
    
    // Write log file
    fs.writeFileSync(logPath, log.join('\n'));
    console.log(`\n✓ Deletion completed successfully!`);
    console.log(`  Log file: ${logPath}\n`);

    return {
      deletedCustomerProfiles: customerProfilesResult.rowCount,
      deletedUsers: usersResult.rowCount,
      logPath
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log('='.repeat(60));
    console.log('SAFE CUSTOMER DELETION SCRIPT');
    console.log('='.repeat(60));
    console.log('\nThis script will:');
    console.log('1. Create a full database backup');
    console.log('2. Show you a preview of what will be deleted');
    console.log('3. Wait for your explicit CONFIRM_DELETE');
    console.log('4. Only then delete customer data\n');

    // Step 1: Create backup
    const backup = await createBackup();

    // Step 2: Preview deletions
    const previewData = await previewDeletions();

    // Summary
    console.log('=== DELETION SUMMARY ===');
    console.log(`Will delete:`);
    console.log(`  - ${previewData.customerProfilesCount} customer_profiles records`);
    console.log(`  - ${previewData.usersCount} non-admin user records`);
    console.log(`Will preserve:`);
    console.log(`  - ${previewData.adminUsersCount} admin/super-admin user records`);
    console.log(`Backup saved to: ${backup.backupPath}`);
    console.log('');

    // Wait for confirmation
    console.log('='.repeat(60));
    console.log('⚠️  PREVIEW COMPLETE - WAITING FOR CONFIRMATION');
    console.log('='.repeat(60));
    console.log('\nTo proceed with deletion, you must explicitly reply with:');
    console.log('  CONFIRM_DELETE');
    console.log('\nThe script will now exit. Run it again with CONFIRM_DELETE as an argument to proceed.');
    console.log('Example: node server/scripts/safe-delete-customers.js CONFIRM_DELETE\n');

    // Check if CONFIRM_DELETE was passed
    const args = process.argv.slice(2);
    if (args.includes('CONFIRM_DELETE')) {
      console.log('✓ CONFIRM_DELETE received. Proceeding with deletion...\n');
      const result = await deleteCustomers(previewData);
      console.log('='.repeat(60));
      console.log('DELETION COMPLETE');
      console.log('='.repeat(60));
      console.log(`Deleted ${result.deletedCustomerProfiles} customer profiles`);
      console.log(`Deleted ${result.deletedUsers} users`);
      console.log(`Log file: ${result.logPath}`);
      console.log('\n✓ All done! Customer system is ready for future use.\n');
    } else {
      console.log('No CONFIRM_DELETE provided. Exiting safely.\n');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

main();

