// Data migration endpoint - Import data from localhost to production
// This endpoint allows you to migrate your localhost data to production
const express = require("express");
const db = require("../db");

const router = express.Router();

// POST /api/migrate-data
// Body: { data: { products: [...], stock: [...], sales: [...], etc. } }
router.post("/migrate-data", async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    const { data } = req.body;
    
    if (!data) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: "No data provided. Please send data object with tables."
      });
    }
    
    console.log("🚀 Starting data migration...");
    console.log("📊 Data received:", {
      products: data.products?.length || 0,
      sales: data.sales_item?.length || 0,
      purchases: data.purchases?.length || 0,
      users: data.users?.length || 0
    });
    
    const results = {};
    
    // Migrate Products
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      console.log(`📦 Migrating ${data.products.length} products...`);
      let inserted = 0;
      let skipped = 0;
      
      for (const product of data.products) {
        try {
          // Convert string numbers to actual numbers
          const result = await client.query(`
            INSERT INTO products (
              sku, series, category, name, qty,
              mrp_price, selling_price, discount, discount_percent,
              b2b_selling_price, b2b_discount, b2b_discount_percent,
              b2b_mrp, dp, ah_va, warranty, guarantee_period_months,
              order_index, product_type_id, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
            ON CONFLICT (sku) DO UPDATE SET
              series = EXCLUDED.series,
              category = EXCLUDED.category,
              name = EXCLUDED.name,
              qty = EXCLUDED.qty,
              mrp_price = EXCLUDED.mrp_price,
              selling_price = EXCLUDED.selling_price,
              discount = EXCLUDED.discount,
              discount_percent = EXCLUDED.discount_percent,
              b2b_selling_price = EXCLUDED.b2b_selling_price,
              b2b_discount = EXCLUDED.b2b_discount,
              b2b_discount_percent = EXCLUDED.b2b_discount_percent,
              b2b_mrp = EXCLUDED.b2b_mrp,
              dp = EXCLUDED.dp,
              ah_va = EXCLUDED.ah_va,
              warranty = EXCLUDED.warranty,
              guarantee_period_months = EXCLUDED.guarantee_period_months,
              order_index = EXCLUDED.order_index,
              product_type_id = EXCLUDED.product_type_id,
              updated_at = CURRENT_TIMESTAMP
          `, [
            product.sku || null, 
            product.series || null, 
            product.category || null, 
            product.name || null, 
            parseInt(product.qty) || 0,
            parseFloat(product.mrp_price) || 0, 
            parseFloat(product.selling_price) || 0, 
            parseFloat(product.discount) || 0, 
            parseFloat(product.discount_percent) || 0,
            product.b2b_selling_price ? parseFloat(product.b2b_selling_price) : null, 
            product.b2b_discount ? parseFloat(product.b2b_discount) : 0, 
            product.b2b_discount_percent ? parseFloat(product.b2b_discount_percent) : 0,
            product.b2b_mrp ? parseFloat(product.b2b_mrp) : null, 
            product.dp ? parseFloat(product.dp) : null, 
            product.ah_va || null, 
            product.warranty || null, 
            parseInt(product.guarantee_period_months) || 0,
            product.order_index ? parseInt(product.order_index) : null, 
            parseInt(product.product_type_id) || 1,
            product.created_at ? new Date(product.created_at) : new Date(), 
            product.updated_at ? new Date(product.updated_at) : new Date()
          ]);
          
          // Check row count
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`❌ Error inserting product ${product.sku || 'unknown'}:`, err.message);
          console.error('Product data:', JSON.stringify(product, null, 2));
          skipped++;
        }
      }
      results.products = { inserted, skipped, total: data.products.length };
      console.log(`✅ Products: ${inserted} inserted, ${skipped} skipped`);
    }
    
    // Migrate Stock
    if (data.stock && Array.isArray(data.stock) && data.stock.length > 0) {
      console.log(`📦 Migrating ${data.stock.length} stock items...`);
      let inserted = 0;
      let skipped = 0;
      
      for (const item of data.stock) {
        try {
          await client.query(`
            INSERT INTO stock (
              purchase_date, sku, series, category, name, ah_va,
              quantity, purchased_from, warranty, product_type_id,
              product_id, serial_number, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT DO NOTHING
          `, [
            item.purchase_date, item.sku, item.series, item.category, item.name, item.ah_va,
            item.quantity || 1, item.purchased_from, item.warranty, item.product_type_id,
            item.product_id, item.serial_number, item.status || 'available',
            item.created_at || new Date(), item.updated_at || new Date()
          ]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting stock item:`, err.message);
          skipped++;
        }
      }
      results.stock = { inserted, skipped, total: data.stock.length };
      console.log(`✅ Stock: ${inserted} inserted, ${skipped} skipped`);
    }
    
    // Migrate Sales
    if (data.sales_item && Array.isArray(data.sales_item) && data.sales_item.length > 0) {
      console.log(`💰 Migrating ${data.sales_item.length} sales items...`);
      let inserted = 0;
      let skipped = 0;
      const errors = [];
      
      for (const sale of data.sales_item) {
        try {
          // First, ensure sales_id exists (create if not exists)
          let salesIdValue = sale.sales_id;
          if (sale.invoice_number && sale.sales_id) {
            // Check if sales_id record exists
            const salesIdCheck = await client.query(
              'SELECT id FROM sales_id WHERE id = $1 OR invoice_number = $2',
              [sale.sales_id, sale.invoice_number]
            );
            
            if (salesIdCheck.rows.length === 0 && sale.invoice_number) {
              // Create sales_id record
              const salesIdResult = await client.query(`
                INSERT INTO sales_id (
                  invoice_number, customer_id, customer_name, customer_mobile_number,
                  customer_vehicle_number, sales_type, sales_type_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (invoice_number) DO UPDATE SET id = sales_id.id
                RETURNING id
              `, [
                sale.invoice_number, sale.customer_id || null, sale.customer_name, sale.customer_mobile_number,
                sale.customer_vehicle_number || null, sale.sales_type || 'retail', sale.sales_type_id || 1,
                sale.created_at || new Date(), sale.updated_at || new Date()
              ]);
              salesIdValue = salesIdResult.rows[0]?.id || sale.sales_id;
            } else if (salesIdCheck.rows.length > 0) {
              salesIdValue = salesIdCheck.rows[0].id;
            }
          }
          
          // Find product_id by SKU if product_id is missing (handle both uppercase and lowercase)
          let productIdValue = sale.product_id;
          const skuValue = sale.SKU || sale.sku;
          if (!productIdValue && skuValue) {
            const productCheck = await client.query('SELECT id FROM products WHERE sku = $1', [skuValue]);
            if (productCheck.rows.length > 0) {
              productIdValue = productCheck.rows[0].id;
            }
          }
          
          // Handle both uppercase and lowercase field names from export
          const sku = sale.SKU || sale.sku;
          const series = sale.SERIES || sale.series;
          const category = sale.CATEGORY || sale.category;
          const name = sale.NAME || sale.name;
          const ahVa = sale.AH_VA || sale.ah_va;
          const quantity = sale.QUANTITY || sale.quantity;
          const warranty = sale.WARRANTY || sale.warranty;
          const serialNumber = sale.SERIAL_NUMBER || sale.serial_number;
          const mrp = sale.MRP || sale.mrp;
          
          const result = await client.query(`
            INSERT INTO sales_item (
              customer_id, invoice_number, customer_name, customer_mobile_number,
              customer_vehicle_number, sales_type, sales_type_id, sales_id,
              purchase_date, SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY,
              WARRANTY, SERIAL_NUMBER, MRP, discount_amount, tax, final_amount,
              payment_method, payment_status, product_id, old_battery_trade_in,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
          `, [
            sale.customer_id || null, sale.invoice_number, sale.customer_name, sale.customer_mobile_number || null,
            sale.customer_vehicle_number || null, sale.sales_type || 'retail', sale.sales_type_id || 1, salesIdValue || null,
            sale.purchase_date || new Date(), sku, series || null, category || null, name, ahVa || null, parseInt(quantity) || 1,
            warranty || null, serialNumber || `SN-${Date.now()}-${Math.random()}`, parseFloat(mrp) || 0, parseFloat(sale.discount_amount) || 0, parseFloat(sale.tax) || 0, parseFloat(sale.final_amount) || 0,
            sale.payment_method || 'cash', sale.payment_status || 'paid', productIdValue || null, sale.old_battery_trade_in || false,
            sale.created_at || new Date(), sale.updated_at || new Date()
          ]);
          
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err) {
          console.error(`Error inserting sale ${sale.invoice_number || sale.SKU}:`, err.message);
          errors.push(`${sale.invoice_number || sale.SKU}: ${err.message}`);
          skipped++;
        }
      }
      results.sales_item = { inserted, skipped, total: data.sales_item.length, errors: errors.slice(0, 5) };
      console.log(`✅ Sales: ${inserted} inserted, ${skipped} skipped`);
      if (errors.length > 0) {
        console.log(`⚠️  First 5 errors:`, errors.slice(0, 5));
      }
    }
    
    // Migrate Purchases
    if (data.purchases && Array.isArray(data.purchases) && data.purchases.length > 0) {
      console.log(`🛒 Migrating ${data.purchases.length} purchases...`);
      let inserted = 0;
      let skipped = 0;
      const errors = [];
      
      for (const purchase of data.purchases) {
        // Use SAVEPOINT to handle errors per record without aborting entire transaction
        const savepointName = `sp_purchase_${inserted + skipped}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          
          // Default product_type_id to 1 if missing
          const productTypeId = purchase.product_type_id || 1;
          
          const result = await client.query(`
            INSERT INTO purchases (
              purchase_date, product_type_id, sku, series, name,
              quantity, purchase_price, total_amount, supplier_name,
              invoice_number, notes, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [
            purchase.purchase_date || new Date(), productTypeId, purchase.sku, purchase.series || null, purchase.name,
            parseInt(purchase.quantity) || 1, parseFloat(purchase.purchase_price) || 0, parseFloat(purchase.total_amount) || 0, purchase.supplier_name || null,
            purchase.invoice_number || null, purchase.notes || null, purchase.created_by || null,
            purchase.created_at || new Date(), purchase.updated_at || new Date()
          ]);
          
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          console.error(`Error inserting purchase ${purchase.sku || purchase.invoice_number || 'unknown'}:`, err.message);
          errors.push(`${purchase.sku || purchase.invoice_number || 'unknown'}: ${err.message}`);
          skipped++;
        }
      }
      results.purchases = { inserted, skipped, total: data.purchases.length, errors: errors.slice(0, 5) };
      console.log(`✅ Purchases: ${inserted} inserted, ${skipped} skipped`);
      if (errors.length > 0) {
        console.log(`⚠️  First 5 errors:`, errors.slice(0, 5));
      }
    }
    
    // Migrate Users/Customers
    if (data.users && Array.isArray(data.users) && data.users.length > 0) {
      console.log(`👥 Migrating ${data.users.length} users...`);
      let inserted = 0;
      let skipped = 0;
      const errors = [];
      
      // Build role_id mapping first
      const roleMap = {};
      const roleResult = await client.query('SELECT id FROM roles');
      const validRoleIds = roleResult.rows.map(r => r.id);
      console.log(`✅ Valid role IDs: ${validRoleIds.join(', ')}`);
      
      for (const user of data.users) {
        // Skip admin user
        if (user.email === 'admin@atozinventory.com' || user.email === 'admin@atozinventory.com') {
          skipped++;
          continue;
        }
        
        // Use SAVEPOINT to handle errors per record without aborting entire transaction
        const savepointName = `sp_user_${inserted + skipped}`;
        try {
          await client.query(`SAVEPOINT ${savepointName}`);
          
          // Default role_id to 3 (customer) if missing or invalid
          let roleId = user.role_id || 3;
          
          // Validate role_id exists
          if (!validRoleIds.includes(roleId)) {
            roleId = 3; // Default to customer role
          }
          
          const result = await client.query(`
            INSERT INTO users (
              full_name, email, phone, password, role_id, is_active,
              state, city, address, gst_number, company_name, company_address,
              user_type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (email) DO UPDATE SET
              full_name = EXCLUDED.full_name,
              phone = EXCLUDED.phone,
              state = EXCLUDED.state,
              city = EXCLUDED.city,
              address = EXCLUDED.address,
              gst_number = EXCLUDED.gst_number,
              company_name = EXCLUDED.company_name,
              company_address = EXCLUDED.company_address,
              user_type = EXCLUDED.user_type,
              updated_at = CURRENT_TIMESTAMP
          `, [
            user.full_name || 'Customer', user.email, user.phone || null, user.password || '$2b$10$dummy', roleId, user.is_active !== false,
            user.state || null, user.city || null, user.address || null, user.gst_number || null,
            user.company_name || null, user.company_address || null, user.user_type || 'customer',
            user.created_at || new Date(), user.updated_at || new Date()
          ]);
          
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          
          if (result.rowCount > 0) {
            inserted++;
          } else {
            skipped++;
          }
        } catch (err) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
          console.error(`Error inserting user ${user.email}:`, err.message);
          errors.push(`${user.email}: ${err.message}`);
          skipped++;
        }
      }
      results.users = { inserted, skipped, total: data.users.length, errors: errors.slice(0, 5) };
      console.log(`✅ Users: ${inserted} inserted, ${skipped} skipped`);
      if (errors.length > 0) {
        console.log(`⚠️  First 5 errors:`, errors.slice(0, 5));
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    // Log detailed results
    console.log("📊 Migration Summary:", JSON.stringify(results, null, 2));
    
    const totalInserted = Object.values(results).reduce((sum, r) => sum + (r.inserted || 0), 0);
    const totalSkipped = Object.values(results).reduce((sum, r) => sum + (r.skipped || 0), 0);
    
    res.json({
      success: true,
      message: `Data migration completed! ${totalInserted} records inserted, ${totalSkipped} skipped.`,
      results,
      summary: {
        totalTables: Object.keys(results).length,
        totalInserted,
        totalSkipped,
        totalRecords: Object.values(results).reduce((sum, r) => sum + (r.total || 0), 0)
      }
    });
    
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK').catch(rollbackErr => {
      console.error('Rollback error:', rollbackErr);
    });
    
    console.error("❌ Migration failed:", error);
    console.error("Error stack:", error.stack);
    
    res.status(500).json({
      success: false,
      error: "Data migration failed",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    });
  } finally {
    client.release();
  }
});

module.exports = router;

