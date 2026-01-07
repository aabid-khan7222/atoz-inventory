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
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: "No data provided. Please send data object with tables."
      });
    }
    
    console.log("🚀 Starting data migration...");
    const results = {};
    
    // Migrate Products
    if (data.products && Array.isArray(data.products) && data.products.length > 0) {
      console.log(`📦 Migrating ${data.products.length} products...`);
      let inserted = 0;
      let skipped = 0;
      
      for (const product of data.products) {
        try {
          await client.query(`
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
            product.sku, product.series, product.category, product.name, product.qty || 0,
            product.mrp_price, product.selling_price, product.discount || 0, product.discount_percent || 0,
            product.b2b_selling_price, product.b2b_discount || 0, product.b2b_discount_percent || 0,
            product.b2b_mrp, product.dp, product.ah_va, product.warranty, product.guarantee_period_months || 0,
            product.order_index, product.product_type_id,
            product.created_at || new Date(), product.updated_at || new Date()
          ]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting product ${product.sku}:`, err.message);
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
      
      for (const sale of data.sales_item) {
        try {
          await client.query(`
            INSERT INTO sales_item (
              customer_id, invoice_number, customer_name, customer_mobile_number,
              customer_vehicle_number, sales_type, sales_type_id, sales_id,
              purchase_date, SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY,
              WARRANTY, SERIAL_NUMBER, MRP, discount_amount, tax, final_amount,
              payment_method, payment_status, product_id, old_battery_trade_in,
              created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
            ON CONFLICT DO NOTHING
          `, [
            sale.customer_id, sale.invoice_number, sale.customer_name, sale.customer_mobile_number,
            sale.customer_vehicle_number, sale.sales_type, sale.sales_type_id, sale.sales_id,
            sale.purchase_date, sale.SKU, sale.SERIES, sale.CATEGORY, sale.NAME, sale.AH_VA, sale.QUANTITY || 1,
            sale.WARRANTY, sale.SERIAL_NUMBER, sale.MRP, sale.discount_amount || 0, sale.tax || 0, sale.final_amount,
            sale.payment_method, sale.payment_status || 'paid', sale.product_id, sale.old_battery_trade_in || false,
            sale.created_at || new Date(), sale.updated_at || new Date()
          ]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting sale:`, err.message);
          skipped++;
        }
      }
      results.sales_item = { inserted, skipped, total: data.sales_item.length };
      console.log(`✅ Sales: ${inserted} inserted, ${skipped} skipped`);
    }
    
    // Migrate Purchases
    if (data.purchases && Array.isArray(data.purchases) && data.purchases.length > 0) {
      console.log(`🛒 Migrating ${data.purchases.length} purchases...`);
      let inserted = 0;
      let skipped = 0;
      
      for (const purchase of data.purchases) {
        try {
          await client.query(`
            INSERT INTO purchases (
              purchase_date, product_type_id, sku, series, name,
              quantity, purchase_price, total_amount, supplier_name,
              invoice_number, notes, created_by, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT DO NOTHING
          `, [
            purchase.purchase_date, purchase.product_type_id, purchase.sku, purchase.series, purchase.name,
            purchase.quantity, purchase.purchase_price, purchase.total_amount, purchase.supplier_name,
            purchase.invoice_number, purchase.notes, purchase.created_by,
            purchase.created_at || new Date(), purchase.updated_at || new Date()
          ]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting purchase:`, err.message);
          skipped++;
        }
      }
      results.purchases = { inserted, skipped, total: data.purchases.length };
      console.log(`✅ Purchases: ${inserted} inserted, ${skipped} skipped`);
    }
    
    // Migrate Users/Customers
    if (data.users && Array.isArray(data.users) && data.users.length > 0) {
      console.log(`👥 Migrating ${data.users.length} users...`);
      let inserted = 0;
      let skipped = 0;
      
      for (const user of data.users) {
        // Skip admin user
        if (user.email === 'admin@atozinventory.com') {
          skipped++;
          continue;
        }
        
        try {
          await client.query(`
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
            user.full_name, user.email, user.phone, user.password, user.role_id || 3, user.is_active !== false,
            user.state, user.city, user.address, user.gst_number, user.company_name, user.company_address,
            user.user_type, user.created_at || new Date(), user.updated_at || new Date()
          ]);
          inserted++;
        } catch (err) {
          console.error(`Error inserting user ${user.email}:`, err.message);
          skipped++;
        }
      }
      results.users = { inserted, skipped, total: data.users.length };
      console.log(`✅ Users: ${inserted} inserted, ${skipped} skipped`);
    }
    
    // Log detailed results
    console.log("📊 Migration Summary:", JSON.stringify(results, null, 2));
    
    res.json({
      success: true,
      message: "Data migration completed successfully!",
      results,
      summary: {
        totalTables: Object.keys(results).length,
        totalInserted: Object.values(results).reduce((sum, r) => sum + (r.inserted || 0), 0),
        totalSkipped: Object.values(results).reduce((sum, r) => sum + (r.skipped || 0), 0),
        totalRecords: Object.values(results).reduce((sum, r) => sum + (r.total || 0), 0)
      }
    });
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    res.status(500).json({
      success: false,
      error: "Data migration failed",
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;

