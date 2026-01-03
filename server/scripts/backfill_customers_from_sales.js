// server/scripts/backfill_customers_from_sales.js
// Script to backfill customers from sales_item table into users and customer_profiles tables

const db = require('../db');
const bcrypt = require('bcrypt');

async function backfillCustomers() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting customer backfill from sales_item table...');
    
    // Get unique customers from sales_item table
    const uniqueCustomers = await client.query(`
      SELECT DISTINCT 
        customer_name,
        customer_mobile_number,
        sales_type
      FROM sales_item
      WHERE customer_name IS NOT NULL 
        AND customer_mobile_number IS NOT NULL
        AND customer_mobile_number != ''
      ORDER BY customer_mobile_number
    `);
    
    console.log(`Found ${uniqueCustomers.rows.length} unique customers in sales_item table`);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;
    
    // Get customer role_id
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );
    
    if (!roleResult.rows.length) {
      throw new Error('Customer role not found');
    }
    
    const customerRoleId = roleResult.rows[0].id;
    
    for (const customer of uniqueCustomers.rows) {
      const customerName = customer.customer_name.trim();
      const customerPhone = customer.customer_mobile_number.trim();
      const salesType = customer.sales_type || 'retail';
      const userType = salesType === 'wholesale' ? 'b2b' : 'b2c';
      const customerEmail = `${customerPhone}@customer.local`; // Generate email from phone
      const isBusinessCustomer = userType === 'b2b';
      
      // Check if user already exists by phone
      const existingUser = await client.query(
        `SELECT id FROM users WHERE phone = $1 LIMIT 1`,
        [customerPhone]
      );
      
      if (existingUser.rows.length > 0) {
        const userId = existingUser.rows[0].id;
        
        // Check if customer_profiles entry exists
        const existingProfile = await client.query(
          `SELECT user_id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        
        if (!existingProfile.rows.length) {
          // Create customer_profiles entry
          await client.query(
            `INSERT INTO customer_profiles (
              user_id, full_name, email, phone, is_business_customer
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO NOTHING`,
            [userId, customerName, customerEmail, customerPhone, isBusinessCustomer]
          );
          updated++;
          console.log(`Created customer_profiles for existing user: ${customerName} (${customerPhone})`);
        } else {
          skipped++;
        }
        continue;
      }
      
      // Create new user
      const hashedPassword = await bcrypt.hash(customerPhone, 10);
      
      const userResult = await client.query(
        `INSERT INTO users (
          full_name, email, phone, password, role_id, user_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [customerName, customerEmail, customerPhone, hashedPassword, customerRoleId, userType, true]
      );
      
      const newUserId = userResult.rows[0].id;
      
      // Create customer_profiles entry
      await client.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO NOTHING`,
        [newUserId, customerName, customerEmail, customerPhone, isBusinessCustomer]
      );
      
      created++;
      console.log(`Created new customer: ${customerName} (${customerPhone}) - User ID: ${newUserId}`);
    }
    
    await client.query('COMMIT');
    
    console.log('\n=== Backfill Summary ===');
    console.log(`Total unique customers found: ${uniqueCustomers.rows.length}`);
    console.log(`New customers created: ${created}`);
    console.log(`Customer profiles added for existing users: ${updated}`);
    console.log(`Skipped (already exists): ${skipped}`);
    console.log('\nBackfill completed successfully!');
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during backfill:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Run the backfill
backfillCustomers()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });

