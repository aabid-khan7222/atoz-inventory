// Script to sync customer GST details from sales records to customer_profiles
// This ensures all customer data is properly synced

require('dotenv').config();
const db = require('../db');

async function syncCustomerDataFromSales() {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('Starting customer data sync from sales records...');
    
    // Get all unique customers from sales_item with GST details
    const salesData = await client.query(`
      SELECT DISTINCT ON (customer_id)
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_business_name,
        customer_gst_number,
        customer_business_address
      FROM sales_item
      WHERE customer_id IS NOT NULL
        AND (customer_business_name IS NOT NULL 
          OR customer_gst_number IS NOT NULL 
          OR customer_business_address IS NOT NULL)
      ORDER BY customer_id, created_at DESC
    `);
    
    console.log(`Found ${salesData.rows.length} customers with GST details in sales records`);
    
    let updated = 0;
    let created = 0;
    
    for (const sale of salesData.rows) {
      // Check if customer_profiles entry exists
      const profileCheck = await client.query(
        `SELECT user_id FROM customer_profiles WHERE user_id = $1`,
        [sale.customer_id]
      );
      
      if (profileCheck.rows.length > 0) {
        // Update existing profile with GST details (only if not already set)
        await client.query(
          `UPDATE customer_profiles
           SET 
             company_name = COALESCE(NULLIF(company_name, ''), $1),
             gst_number = COALESCE(NULLIF(gst_number, ''), $2),
             company_address = COALESCE(NULLIF(company_address, ''), $3),
             is_business_customer = CASE 
               WHEN $2 IS NOT NULL OR $1 IS NOT NULL THEN true 
               ELSE is_business_customer 
             END
           WHERE user_id = $4
             AND (company_name IS NULL OR company_name = '')
             AND (gst_number IS NULL OR gst_number = '')
             AND (company_address IS NULL OR company_address = '')`,
          [
            sale.customer_business_name,
            sale.customer_gst_number,
            sale.customer_business_address,
            sale.customer_id
          ]
        );
        updated++;
      } else {
        // Create new profile entry
        const userCheck = await client.query(
          `SELECT id, full_name, email, phone FROM users WHERE id = $1`,
          [sale.customer_id]
        );
        
        if (userCheck.rows.length > 0) {
          const user = userCheck.rows[0];
          await client.query(
            `INSERT INTO customer_profiles (
              user_id, full_name, email, phone, 
              is_business_customer, company_name, gst_number, company_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
              company_name = COALESCE(NULLIF(customer_profiles.company_name, ''), EXCLUDED.company_name),
              gst_number = COALESCE(NULLIF(customer_profiles.gst_number, ''), EXCLUDED.gst_number),
              company_address = COALESCE(NULLIF(customer_profiles.company_address, ''), EXCLUDED.company_address)`,
            [
              sale.customer_id,
              sale.customer_name || user.full_name,
              user.email || null,
              sale.customer_mobile_number || user.phone,
              !!(sale.customer_gst_number || sale.customer_business_name),
              sale.customer_business_name,
              sale.customer_gst_number,
              sale.customer_business_address
            ]
          );
          created++;
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\nSync completed:`);
    console.log(`- Updated: ${updated} existing profiles`);
    console.log(`- Created: ${created} new profiles`);
    console.log(`- Total processed: ${salesData.rows.length} customers`);
    
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error syncing customer data:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

// Run the sync
syncCustomerDataFromSales().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

