const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// Helper function to get product_type_id from category
function getProductTypeId(category) {
  const typeMap = {
    'car-truck-tractor': 1,
    'bike': 2,
    'ups-inverter': 3,
    'hups-inverter': 3,
    'water': 4,
  };
  return typeMap[category] || 1;
}

// Helper function to get category from product_type_id
function getCategoryFromTypeId(typeId) {
  const categoryMap = {
    1: 'car-truck-tractor',
    2: 'bike',
    3: 'ups-inverter',
    4: 'water',
  };
  return categoryMap[typeId] || 'car-truck-tractor';
}

function isBusinessCustomerType(userType) {
  return (userType || '').toLowerCase() === 'b2b';
}

// Generate invoice number using the database function
async function generateInvoiceNumber() {
  try {
    const result = await db.query('SELECT generate_invoice_number() as invoice_number');
    return result.rows[0].invoice_number;
  } catch (err) {
    // Fallback if function doesn't exist
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now();
    return `INV-${dateStr}-${timestamp.toString().slice(-4)}`;
  }
}

// Helper: Find or create customer account
async function findOrCreateCustomer(email, mobileNumber, customerName, salesType, client) {
  // First, try to find by email (only customers, role_id >= 3)
  let customerResult = await client.query(
    `SELECT id, email, phone, user_type FROM users WHERE LOWER(email) = $1 AND role_id >= 3 LIMIT 1`,
    [email.toLowerCase()]
  );

  if (customerResult.rows.length > 0) {
    const customer = customerResult.rows[0];
    customer.was_auto_created = false;
    // Ensure customer_profiles entry exists
    const profileCheck = await client.query(
      `SELECT user_id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [customer.id]
    );
    
    if (!profileCheck.rows.length) {
      const isBusinessCustomer = isBusinessCustomerType(customer.user_type);
      await client.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO NOTHING`,
        [customer.id, customerName, customer.email || email.toLowerCase(), customer.phone || mobileNumber, isBusinessCustomer]
      );
    }
    return customer;
  }

  // Try to find by mobile number (only customers, role_id >= 3)
  customerResult = await client.query(
    `SELECT id, email, phone, user_type FROM users WHERE phone = $1 AND role_id >= 3 LIMIT 1`,
    [mobileNumber]
  );

  if (customerResult.rows.length > 0) {
    const customer = customerResult.rows[0];
    customer.was_auto_created = false;
    // Ensure customer_profiles entry exists
    const profileCheck = await client.query(
      `SELECT user_id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [customer.id]
    );
    
    if (!profileCheck.rows.length) {
      const isBusinessCustomer = isBusinessCustomerType(customer.user_type);
      await client.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id) DO NOTHING`,
        [customer.id, customerName, customer.email || email.toLowerCase(), customer.phone || mobileNumber, isBusinessCustomer]
      );
    }
    return customer;
  }

  // Customer doesn't exist - create new account
  // Get customer role_id
  const roleResult = await client.query(
    `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
  );

  if (!roleResult.rows.length) {
    throw new Error('Customer role not found');
  }

  const customerRoleId = roleResult.rows[0].id;
  const userType = salesType === 'wholesale' ? 'b2b' : 'b2c';

  // Password = mobile number
  const hashedPassword = await bcrypt.hash(mobileNumber, 10);

  // Insert user - password column is required (NOT NULL constraint)
  const insertResult = await client.query(
    `INSERT INTO users (
      full_name, email, phone, password, role_id, user_type, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id, email, phone, user_type`,
    [customerName, email.toLowerCase(), mobileNumber, hashedPassword, customerRoleId, userType, true]
  );

  const newUser = insertResult.rows[0];
  newUser.was_auto_created = true;
  console.log('[findOrCreateCustomer] Auto-created customer user:', { id: newUser.id, email: newUser.email, phone: newUser.phone });

  // Also create entry in customer_profiles table
  const isBusinessCustomer = isBusinessCustomerType(userType);
  await client.query(
    `INSERT INTO customer_profiles (
      user_id, full_name, email, phone, is_business_customer
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (user_id) DO NOTHING`,
    [newUser.id, customerName, email.toLowerCase(), mobileNumber, isBusinessCustomer]
  );

  return newUser;
}

// UNUSED FUNCTION - Commented out but kept for reference
// This function is defined but never called in this file.
// Customer orders use 'PENDING' placeholder for serial numbers (admin assigns later).
// This function IS used in adminSales.js for admin sales.
// If you need auto-assignment for customer orders in future, uncomment this function.
/*
async function getOldestSerialNumbers(productId, quantity, client) {
  const result = await client.query(
    `SELECT serial_number, created_at
     FROM stock
     WHERE product_id = $1 AND status = 'available' AND serial_number IS NOT NULL
     ORDER BY created_at ASC, purchase_date ASC
     LIMIT $2`,
    [productId, quantity]
  );

  if (result.rows.length < quantity) {
    throw new Error(`Insufficient stock. Only ${result.rows.length} units available.`);
  }

  return result.rows.map(row => row.serial_number);
}
*/

// Calculate GST breakdown (18% GST is included in MRP)
function calculateGSTBreakdown(mrp, quantity) {
  // GST is 18%, so if MRP includes GST:
  // MRP = Base Price + GST
  // MRP = Base Price * 1.18
  // Base Price = MRP / 1.18
  // GST Amount = MRP - Base Price
  
  const basePrice = mrp / 1.18;
  const gstAmount = mrp - basePrice;
  const totalBase = basePrice * quantity;
  const totalGST = gstAmount * quantity;
  const totalMRP = mrp * quantity;

  return {
    basePrice: parseFloat(basePrice.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    totalBase: parseFloat(totalBase.toFixed(2)),
    totalGST: parseFloat(totalGST.toFixed(2)),
    totalMRP: parseFloat(totalMRP.toFixed(2))
  };
}

// Create a new sale (Customer purchase from UI)
router.post('/', requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      customer_id,
      customer_name,
      customer_phone,
      vehicle_number,
      items, // Array of { product_id, category, quantity, unit_price }
      sale_type = 'retail',
      discount = 0,
      tax = 0,
      payment_method = 'cash',
      payment_status = 'paid',
      notes,
      customer_business_name,
      customer_gst_number,
      customer_business_address,
    } = req.body;

    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sale must have at least one item' });
    }

    if (!customer_name || !customer_phone) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Customer name and phone are required' });
    }

    // Find or create customer account (username = email, password = mobile number)
    let finalCustomerId;
    let customer;
    
    // If customer_id is provided and user is logged in, use that
    if (customer_id && req.user && req.user.id === customer_id) {
      // Logged-in customer - ensure they exist in customer_profiles
      finalCustomerId = customer_id;
      
      // Check if customer_profiles entry exists
      const profileCheck = await client.query(
        `SELECT user_id FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
        [finalCustomerId]
      );
      
      if (!profileCheck.rows.length) {
        // Get user details
        const userResult = await client.query(
          `SELECT id, full_name, email, phone, user_type FROM users WHERE id = $1 LIMIT 1`,
          [finalCustomerId]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          const isBusinessCustomer = (user.user_type || '').toLowerCase() === 'b2b';
          
          // Create customer_profiles entry
          await client.query(
            `INSERT INTO customer_profiles (
              user_id, full_name, email, phone, is_business_customer
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) DO NOTHING`,
            [user.id, user.full_name, user.email, user.phone, isBusinessCustomer]
          );
        }
      }
    } else {
      // New customer or admin selling to someone - find or create
      const customerEmail = req.body.customer_email || `${customer_phone}@customer.local`;
      customer = await findOrCreateCustomer(
        customerEmail,
        customer_phone.trim(),
        customer_name.trim(),
        sale_type,
        client
      );
      finalCustomerId = customer.id;
    }

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber();

    // Get vehicle_number from the first item if not provided at sale level
    const finalVehicleNumber = vehicle_number || (items && items.length > 0 && items[0].vehicle_number ? items[0].vehicle_number : null);

    // Validate items and get serial numbers (oldest first)
    const salesItems = [];
    let totalFinalAmount = 0;

    for (const item of items) {
      const { 
        product_id, 
        category, 
        quantity, 
        unit_price, 
        vehicle_number: itemVehicleNumber, 
        vehicle_numbers: itemVehicleNumbers
      } = item;

      if (!product_id || !category || !quantity || quantity <= 0 || !unit_price) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Invalid item: ${JSON.stringify(item)}` 
        });
      }

      // Check product exists
      const productTypeId = getProductTypeId(category);
      if (!productTypeId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid category: ${category}` });
      }

      const productResult = await client.query(
        `SELECT id, sku, name, qty, mrp_price, selling_price, ah_va, warranty, series, product_type_id, category
         FROM products 
         WHERE id = $1 AND product_type_id = $2`,
        [product_id, productTypeId]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${product_id} not found in category ${category}` });
      }

      const product = productResult.rows[0];
      const currentStock = parseInt(product.qty || 0);

      if (currentStock < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${quantity}` 
        });
      }

      // Normalize category from product_type_id (safeguard)
      const normalizedCategory = getCategoryFromTypeId(product.product_type_id) || category;

      // Check if this is a water product (product_type_id = 4)
      const isWaterProduct = product.product_type_id === 4;

      // Don't auto-assign serial numbers - admin will assign them later
      // Use 'PENDING' placeholder for customer orders (since SERIAL_NUMBER is NOT NULL)
      // Admin will replace 'PENDING' with actual serial number when approving order
      let serialNumbers = [];
      if (isWaterProduct) {
        // Water products don't have serial numbers - use 'N/A'
        serialNumbers = Array(quantity).fill('N/A');
      } else {
        // For non-water products, use 'PENDING' placeholder (admin will assign later)
        serialNumbers = Array(quantity).fill('PENDING');
      }

      // Process vehicle numbers for this item - Skip validation for water products
      let vehicleNumbersArray = [];
      if (isWaterProduct) {
        // Water products don't need vehicle numbers - set all to null
        vehicleNumbersArray = Array(quantity).fill(null);
      } else {
        // For non-water products, process vehicle numbers as usual
        if (quantity > 1 && itemVehicleNumbers && Array.isArray(itemVehicleNumbers)) {
          // Multiple quantities with vehicle numbers array
          if (itemVehicleNumbers.length !== quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: `Vehicle numbers count (${itemVehicleNumbers.length}) must match quantity (${quantity}) for item`,
              received: { itemVehicleNumbers, quantity, product_id }
            });
          }
          vehicleNumbersArray = itemVehicleNumbers.map(vn => (vn && vn.trim()) || null);
        } else if (quantity === 1) {
          // Single quantity - use itemVehicleNumber
          vehicleNumbersArray = [itemVehicleNumber ? itemVehicleNumber.trim() : null];
        } else {
          // Multiple quantities but no vehicle numbers array - use single vehicle number for all
          vehicleNumbersArray = Array(quantity).fill(itemVehicleNumber ? itemVehicleNumber.trim() : (finalVehicleNumber || null));
        }
      }

      // Calculate GST breakdown
      const mrp = parseFloat(product.mrp_price || 0);
      const gstBreakdown = calculateGSTBreakdown(mrp, 1); // Per unit

      // Get sales_type_id (1 for retail, 2 for wholesale)
      const salesTypeId = sale_type === 'wholesale' ? 2 : 1;

      // GST is always 18% (included in MRP, fixed and non-editable)
      // GST = MRP * 0.18 / 1.18 (since MRP includes GST)
      const perUnitGST = (mrp * 0.18) / 1.18;
      
      // Create one sales_item row per battery (one per serial number)
      for (let i = 0; i < quantity; i++) {
        const serialNumber = serialNumbers[i];
        const vehicleNumber = vehicleNumbersArray[i] || null; // Get corresponding vehicle number
        const itemDiscount = discount / quantity; // Distribute discount evenly
        const itemTax = perUnitGST; // Always 18% GST (fixed)
        const itemFinalAmount = unit_price; // Final amount

        salesItems.push({
          customer_id: finalCustomerId,
          invoice_number: invoiceNumber,
          customer_name: customer_name.trim(),
          customer_mobile_number: customer_phone.trim(),
          customer_vehicle_number: vehicleNumber, // Use the corresponding vehicle number for this battery
          sales_type: sale_type,
          sales_type_id: salesTypeId,
          purchase_date: new Date(),
          SKU: product.sku,
          SERIES: product.series || null,
          CATEGORY: normalizedCategory,
          NAME: product.name,
          AH_VA: product.ah_va || null,
          QUANTITY: 1, // Always 1 per row
          WARRANTY: product.warranty || null,
          SERIAL_NUMBER: serialNumber,
          MRP: mrp,
          discount_amount: itemDiscount,
          tax: itemTax,
          final_amount: itemFinalAmount,
          payment_method: payment_method,
          payment_status: payment_status,
          product_id: product.id,
          customer_business_name: customer_business_name ? customer_business_name.trim() : null,
          customer_gst_number: customer_gst_number ? customer_gst_number.trim() : null,
          customer_business_address: customer_business_address ? customer_business_address.trim() : null,
        });

        totalFinalAmount += itemFinalAmount;

        // Don't remove from stock or update product quantity yet
        // Stock will be removed and quantity updated when admin assigns serial numbers
        // This allows admin to review the order before assigning serial numbers
      }
    }

    // Get sales_type_id (1 for retail, 2 for wholesale)
    const salesTypeId = sale_type === 'wholesale' ? 2 : 1;

    // Check which columns exist in sales_item table (check once before loop)
    const salesItemColumnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const salesItemColumns = salesItemColumnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = salesItemColumns.includes('created_by');
    const hasBusinessFields = salesItemColumns.includes('customer_business_name') && 
                              salesItemColumns.includes('customer_gst_number') && 
                              salesItemColumns.includes('customer_business_address');

    // Insert all sales_item records (no sales_id needed)
    for (const item of salesItems) {
      // Build INSERT query dynamically based on available columns
      let insertColumns = `customer_id, invoice_number, customer_name, customer_mobile_number,
          customer_vehicle_number, sales_type, sales_type_id`;
      let insertValues = `$1, $2, $3, $4, $5, $6, $7`;
      let insertParams = [
        item.customer_id,
        item.invoice_number,
        item.customer_name,
        item.customer_mobile_number,
        item.customer_vehicle_number,
        item.sales_type,
        item.sales_type_id
      ];
      let paramIndex = 8;
      
      // Add created_by if column exists
      if (hasCreatedBy) {
        insertColumns += `, created_by`;
        insertValues += `, $${paramIndex}`;
        insertParams.push(req.user.id);
        paramIndex++;
      }
      
      // Add purchase_date and product fields (16 fields total)
      insertColumns += `, purchase_date, SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY, WARRANTY, SERIAL_NUMBER,
          MRP, discount_amount, tax, final_amount, payment_method, payment_status, product_id`;
      insertValues += `, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8}, $${paramIndex + 9}, $${paramIndex + 10}, $${paramIndex + 11}, $${paramIndex + 12}, $${paramIndex + 13}, $${paramIndex + 14}, $${paramIndex + 15}`;
      insertParams.push(
        item.purchase_date,
        item.SKU,
        item.SERIES,
        item.CATEGORY,
        item.NAME,
        item.AH_VA,
        item.QUANTITY,
        item.WARRANTY,
        item.SERIAL_NUMBER,
        item.MRP,
        item.discount_amount,
        item.tax,
        item.final_amount,
        item.payment_method,
        item.payment_status,
        item.product_id
      );
      paramIndex += 16;
      
      // Add business fields if they exist
      if (hasBusinessFields) {
        insertColumns += `, customer_business_name, customer_gst_number, customer_business_address`;
        insertValues += `, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}`;
        insertParams.push(
          item.customer_business_name,
          item.customer_gst_number,
          item.customer_business_address
        );
      }
      
      await client.query(
        `INSERT INTO sales_item (
          ${insertColumns}
        ) VALUES (${insertValues})`,
        insertParams
      );
    }

    await client.query('COMMIT');

    // Fetch the complete sale record grouped by invoice_number (use same column check)
    let selectQuery = `SELECT 
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedBy) {
      selectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      selectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    selectQuery += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number, 
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedBy) {
      selectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      selectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    selectQuery += ` LIMIT 1`;
    
    const saleResult = await client.query(selectQuery, [invoiceNumber]);

    // Use same column check from earlier in the function
    let itemsSelectCols = `id, customer_id, invoice_number, customer_name, customer_mobile_number,
        customer_vehicle_number, sales_type, sales_type_id, purchase_date,
        SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY, WARRANTY, SERIAL_NUMBER,
        MRP, discount_amount, tax, final_amount, payment_method, payment_status, product_id,
        created_at, updated_at`;
    
    if (hasCreatedBy) {
      itemsSelectCols += `, created_by`;
    }
    
    if (hasBusinessFields) {
      itemsSelectCols += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    const itemsResult = await client.query(
      `SELECT ${itemsSelectCols} FROM sales_item WHERE invoice_number = $1 ORDER BY id`,
      [invoiceNumber]
    );

    // Create notifications for admin and super admin
    try {
      const adminUsers = await db.query(
        `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true`
      );
      
      const adminUserIds = adminUsers.rows.map(u => u.id);
      const sale = saleResult.rows[0];
      
      if (adminUserIds.length > 0 && sale) {
        await createNotification(
          adminUserIds,
          'New Customer Order - Serial Number Assignment Required',
          `Customer ${sale.customer_name} (${sale.customer_mobile_number}) placed an order. Invoice: ${sale.invoice_number}. Please assign serial numbers to complete the order.`,
          'warning',
          null // No sales_id anymore, use null or invoice_number if needed
        );
      }

      // Create notification for customer if they are logged in
      // Note: Order is NOT confirmed yet - it's pending admin approval
      if (finalCustomerId && sale) {
        const totalItems = itemsResult.rows.length;
        const itemNames = itemsResult.rows.slice(0, 2).map(item => item.NAME || 'Product').join(', ');
        const moreItems = totalItems > 2 ? ` and ${totalItems - 2} more item${totalItems - 2 > 1 ? 's' : ''}` : '';
        const totalAmount = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.final_amount || 0), 0);
        
        await createNotification(
          finalCustomerId,
          'Order Received - Pending Confirmation',
          `Your order has been received! Invoice: ${sale.invoice_number}. Items: ${itemNames}${moreItems}. Total: ₹${totalAmount.toLocaleString('en-IN')}. Your order is pending admin confirmation and serial number assignment. You will be notified once it's confirmed.`,
          'info',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to create notification:', notifErr);
      // Don't fail the sale if notification fails
    }

    res.status(201).json({
      success: true,
      sale: {
        ...saleResult.rows[0],
        items: itemsResult.rows,
      },
      autoCreatedCustomerUser: customer?.was_auto_created === true,
      message: customer?.was_auto_created === true
        ? 'Customer user auto-created (email as username, mobile as password)'
        : undefined,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    console.error('Error creating sale:', err);
    console.error('Error stack:', err.stack);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ 
      error: 'Failed to create sale', 
      message: err.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  } finally {
    client.release();
  }
});

// Get sales for current user (customer) or all sales (admin)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, customer_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Check which columns exist
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = existingColumns.includes('created_by');
    const hasBusinessFields = existingColumns.includes('customer_business_name') && 
                              existingColumns.includes('customer_gst_number') && 
                              existingColumns.includes('customer_business_address');

    let query = `
      SELECT DISTINCT
        invoice_number as id,
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedBy) {
      query += `, created_by`;
    }
    
    if (hasBusinessFields) {
      query += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    query += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at,
        COUNT(*) as item_count`;
    
    // For customers: Add pending_items_count to help frontend determine order status
    if (req.user.role_id >= 3) {
      query += `,
        COUNT(CASE WHEN SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING' THEN 1 END) as pending_items_count`;
    }
    
    query += `
      FROM sales_item
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // If customer role, only show their sales (both pending and confirmed)
    if (req.user.role_id >= 3) {
      query += ` AND customer_id = $${paramCount}`;
      params.push(req.user.id);
      paramCount++;
    } else if (customer_id) {
      // Admin/Super Admin can filter by customer
      query += ` AND customer_id = $${paramCount}`;
      params.push(customer_id);
      paramCount++;
    }

    query += ` 
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number,
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedBy) {
      query += `, created_by`;
    }
    
    if (hasBusinessFields) {
      query += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    query += `
      ORDER BY MIN(created_at) DESC 
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching sales:', err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// Get single sale with items (by invoice_number or id)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    // The id parameter can be either an invoice_number or a legacy sales_id
    // After migration, it will always be an invoice_number
    const invoiceNumber = id;

    // Check which columns exist before selecting
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = existingColumns.includes('created_by');
    const hasBusinessFields = existingColumns.includes('customer_business_name') && 
                              existingColumns.includes('customer_gst_number') && 
                              existingColumns.includes('customer_business_address');
    
    // Build SELECT query dynamically for sale header
    let saleSelectQuery = `SELECT 
        invoice_number as id,
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedBy) {
      saleSelectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      saleSelectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    saleSelectQuery += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number, 
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedBy) {
      saleSelectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      saleSelectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    saleSelectQuery += ` LIMIT 1`;
    
    const saleResult = await db.query(saleSelectQuery, [invoiceNumber]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const sale = saleResult.rows[0];

    // Check permissions
    if (req.user.role_id >= 3 && sale.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    // Build SELECT query dynamically for items
    let selectCols = `id, customer_id, invoice_number, customer_name, customer_mobile_number,
        customer_vehicle_number, sales_type, sales_type_id, purchase_date,
        SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY, WARRANTY, SERIAL_NUMBER,
        MRP, discount_amount, tax, final_amount, payment_method, payment_status, product_id,
        created_at, updated_at`;
    
    if (hasCreatedBy) {
      selectCols += `, created_by`;
    }
    
    if (hasBusinessFields) {
      selectCols += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    // Show all items (both pending and confirmed) for customers and admin
    let itemsWhereClause = `invoice_number = $1`;
    
    // Exclude commission data from customer-facing response
    const itemsResult = await db.query(
      `SELECT ${selectCols}
      FROM sales_item WHERE ${itemsWhereClause} ORDER BY id`,
      [invoiceNumber]
    );

    res.json({
      ...sale,
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching sale:', err);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// Get pending orders (orders without serial numbers assigned) - Admin/Super Admin only
router.get('/pending/orders', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Check which columns exist
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = existingColumns.includes('created_by');
    const hasBusinessFields = existingColumns.includes('customer_business_name') && 
                              existingColumns.includes('customer_gst_number') && 
                              existingColumns.includes('customer_business_address');
    
    let query = `SELECT DISTINCT
        invoice_number as id,
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedBy) {
      query += `, created_by`;
    }
    
    if (hasBusinessFields) {
      query += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    query += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at,
        COUNT(*) as item_count,
        COUNT(CASE WHEN SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING' THEN 1 END) as pending_items_count
      FROM sales_item
      WHERE SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING'
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number,
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedBy) {
      query += `, created_by`;
    }
    
    if (hasBusinessFields) {
      query += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    query += `
      HAVING COUNT(CASE WHEN SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING' THEN 1 END) > 0
      ORDER BY MIN(created_at) DESC`;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pending orders:', err);
    res.status(500).json({ error: 'Failed to fetch pending orders' });
  }
});

// Get pending order details with items - Admin/Super Admin only
router.get('/pending/orders/:invoiceNumber', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { invoiceNumber } = req.params;

    // Check which columns exist
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const existingColumns = columnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = existingColumns.includes('created_by');
    const hasBusinessFields = existingColumns.includes('customer_business_name') && 
                              existingColumns.includes('customer_gst_number') && 
                              existingColumns.includes('customer_business_address');
    
    let saleSelectQuery = `SELECT DISTINCT
        invoice_number as id,
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedBy) {
      saleSelectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      saleSelectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    saleSelectQuery += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number, 
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedBy) {
      saleSelectQuery += `, created_by`;
    }
    
    if (hasBusinessFields) {
      saleSelectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    saleSelectQuery += ` LIMIT 1`;
    
    const saleResult = await db.query(saleSelectQuery, [invoiceNumber]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Build SELECT query for items (use same column check)
    let itemsSelectCols = `id, customer_id, invoice_number, customer_name, customer_mobile_number,
        customer_vehicle_number, sales_type, sales_type_id, purchase_date,
        SKU, SERIES, CATEGORY, NAME, AH_VA, QUANTITY, WARRANTY, SERIAL_NUMBER,
        MRP, discount_amount, tax, final_amount, payment_method, payment_status, product_id,
        created_at, updated_at`;
    
    if (hasCreatedBy) {
      itemsSelectCols += `, created_by`;
    }
    
    if (hasBusinessFields) {
      itemsSelectCols += `, customer_business_name, customer_gst_number, customer_business_address`;
    }

    // Only return items that need serial number assignment (PENDING or NULL)
    const itemsResult = await db.query(
      `SELECT ${itemsSelectCols}
      FROM sales_item 
      WHERE invoice_number = $1 
        AND (SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING')
      ORDER BY id`,
      [invoiceNumber]
    );

    res.json({
      ...saleResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    console.error('Error fetching pending order:', err);
    res.status(500).json({ error: 'Failed to fetch pending order' });
  }
});

// Assign serial numbers to order items - Admin/Super Admin only
router.put('/pending/orders/:invoiceNumber/assign-serial', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { invoiceNumber } = req.params;
    const { assignments } = req.body; // Array of { sales_item_id, serial_number }

    if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Assignments array is required' });
    }

    // Validate that the order exists and has pending items
    // Check for both NULL and 'PENDING' placeholder values
    const orderCheck = await client.query(
      `SELECT id, invoice_number, product_id, SERIAL_NUMBER, NAME, SKU
       FROM sales_item 
       WHERE invoice_number = $1 AND (SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING')`,
      [invoiceNumber]
    );

    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No pending items found for this order' });
    }

    // Process each assignment
    for (const assignment of assignments) {
      const { sales_item_id, serial_number, final_amount } = assignment;

      if (!sales_item_id || !serial_number) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'sales_item_id and serial_number are required for each assignment' });
      }

      // Verify the sales_item belongs to this invoice and doesn't have a serial number yet
      // Check for both NULL and 'PENDING' placeholder values
      const itemCheck = await client.query(
        `SELECT id, product_id, SERIAL_NUMBER, invoice_number, final_amount, mrp as MRP
         FROM sales_item 
         WHERE id = $1 AND invoice_number = $2 AND (SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING')`,
        [sales_item_id, invoiceNumber]
      );

      if (itemCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Sales item ${sales_item_id} not found or already has a serial number` 
        });
      }

      const item = itemCheck.rows[0];
      const productId = item.product_id;

      // Verify serial number exists in stock and is available
      const stockCheck = await client.query(
        `SELECT serial_number, product_id, status
         FROM stock
         WHERE product_id = $1 AND serial_number = $2 AND status = 'available'`,
        [productId, serial_number.trim()]
      );

      if (stockCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Serial number ${serial_number} is not available in stock for this product` 
        });
      }

      // Check if serial number is already assigned to another order
      const existingAssignment = await client.query(
        `SELECT id, invoice_number 
         FROM sales_item 
         WHERE SERIAL_NUMBER = $1 AND id != $2`,
        [serial_number.trim(), sales_item_id]
      );

      if (existingAssignment.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: `Serial number ${serial_number} is already assigned to invoice ${existingAssignment.rows[0].invoice_number}` 
        });
      }

      // Update sales_item with serial number and optionally final_amount
      const updateFields = ['SERIAL_NUMBER = $1', 'updated_at = CURRENT_TIMESTAMP'];
      const updateValues = [serial_number.trim()];
      let paramIndex = 2;
      
      // Get MRP first (needed for discount calculation)
      // PostgreSQL column is lowercase 'mrp', but we check both cases for compatibility
      const mrp = parseFloat(itemCheck.rows[0].MRP || itemCheck.rows[0].mrp || 0);
      const currentFinalAmount = parseFloat(itemCheck.rows[0].final_amount || 0);
      
      // If final_amount is provided, update it and recalculate discount_amount
      if (final_amount !== undefined && final_amount !== null) {
        const newAmount = parseFloat(final_amount);
        if (!isNaN(newAmount) && newAmount >= 0) {
          // Always update final_amount if provided
          updateFields.push(`final_amount = $${paramIndex}`);
          updateValues.push(newAmount);
          paramIndex++;
          
          // Always recalculate discount_amount based on MRP and new final_amount
          // This ensures discount_amount is always in sync with final_amount
          if (mrp > 0) {
            const newDiscountAmount = mrp > newAmount ? mrp - newAmount : 0;
            updateFields.push(`discount_amount = $${paramIndex}`);
            updateValues.push(newDiscountAmount);
            paramIndex++;
            
            console.log(`[ASSIGN SERIAL] Updating item ${sales_item_id}: MRP=${mrp}, Current Final=${currentFinalAmount}, New Final=${newAmount}, New Discount Amount=${newDiscountAmount}, Discount %=${((newDiscountAmount / mrp) * 100).toFixed(2)}%`);
          } else {
            // If MRP is 0, set discount_amount to 0
            updateFields.push(`discount_amount = $${paramIndex}`);
            updateValues.push(0);
            paramIndex++;
            console.log(`[ASSIGN SERIAL] Warning: MRP is 0 or missing for item ${sales_item_id}, setting discount_amount to 0`);
          }
        } else {
          console.log(`[ASSIGN SERIAL] Warning: Invalid final_amount for item ${sales_item_id}, value=${final_amount}`);
        }
      } else {
        // Even if final_amount is not provided, we should still recalculate discount_amount
        // based on existing final_amount to ensure consistency
        if (mrp > 0 && currentFinalAmount > 0) {
          const currentDiscountAmount = mrp > currentFinalAmount ? mrp - currentFinalAmount : 0;
          updateFields.push(`discount_amount = $${paramIndex}`);
          updateValues.push(currentDiscountAmount);
          paramIndex++;
          console.log(`[ASSIGN SERIAL] Recalculating discount_amount for item ${sales_item_id}: MRP=${mrp}, Final=${currentFinalAmount}, Discount=${currentDiscountAmount}`);
        }
        console.log(`[ASSIGN SERIAL] No final_amount provided for item ${sales_item_id}, using existing final_amount`);
      }
      
      // Add WHERE clause parameter
      updateValues.push(sales_item_id);
      const whereParamIndex = paramIndex;
      
      const updateQuery = `UPDATE sales_item 
         SET ${updateFields.join(', ')}
         WHERE id = $${whereParamIndex}`;
      
      console.log(`[ASSIGN SERIAL] Executing query: ${updateQuery}`);
      console.log(`[ASSIGN SERIAL] Values:`, updateValues);
      console.log(`[ASSIGN SERIAL] Update fields count: ${updateFields.length}, Values count: ${updateValues.length}`);
      
      const updateResult = await client.query(updateQuery, updateValues);
      console.log(`[ASSIGN SERIAL] Update result for item ${sales_item_id}:`, updateResult.rowCount, 'rows affected');
      
      // Verify the update by reading back the values
      if (updateResult.rowCount > 0) {
        const verifyResult = await client.query(
          `SELECT final_amount, discount_amount, mrp as MRP FROM sales_item WHERE id = $1`,
          [sales_item_id]
        );
        if (verifyResult.rows.length > 0) {
          const updated = verifyResult.rows[0];
          console.log(`[ASSIGN SERIAL] Verified update for item ${sales_item_id}: final_amount=${updated.final_amount}, discount_amount=${updated.discount_amount}, MRP=${updated.MRP}`);
        }
      }

      // Remove from stock table (mark as sold)
      await client.query(
        `DELETE FROM stock 
         WHERE product_id = $1 AND serial_number = $2 AND status = 'available'`,
        [productId, serial_number.trim()]
      );

      // Update product quantity
      const productResult = await client.query(
        `SELECT qty FROM products WHERE id = $1`,
        [productId]
      );

      if (productResult.rows.length > 0) {
        const currentStock = parseInt(productResult.rows[0].qty || 0);
        const newStock = Math.max(0, currentStock - 1);
        await client.query(
          `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newStock, productId]
        );
      }
    }

    await client.query('COMMIT');

    // Check if all items in the order now have serial numbers
    const remainingPending = await db.query(
      `SELECT COUNT(*) as count
       FROM sales_item
       WHERE invoice_number = $1 AND (SERIAL_NUMBER IS NULL OR SERIAL_NUMBER = 'PENDING')`,
      [invoiceNumber]
    );

    const allAssigned = parseInt(remainingPending.rows[0].count) === 0;

    // Create notification for customer if all serial numbers are assigned
    if (allAssigned) {
      // Get order total with updated amounts
      const orderTotalResult = await db.query(
        `SELECT 
          DISTINCT customer_id, customer_name, customer_mobile_number,
          SUM(final_amount) as total_amount
         FROM sales_item
         WHERE invoice_number = $1
         GROUP BY customer_id, customer_name, customer_mobile_number
         LIMIT 1`,
        [invoiceNumber]
      );

      if (orderTotalResult.rows.length > 0) {
        const order = orderTotalResult.rows[0];
        if (order.customer_id) {
          const totalAmount = parseFloat(order.total_amount || 0);
          try {
            await createNotification(
              order.customer_id,
              'Order Completed',
              `Your order (Invoice: ${invoiceNumber}) has been processed and serial numbers have been assigned. Total Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. You can now view your order details and download the invoice.`,
              'success',
              null
            );
          } catch (notifErr) {
            console.warn('Failed to create customer notification:', notifErr);
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Serial numbers assigned successfully. ${allAssigned ? 'Order is now complete.' : 'Some items still pending.'}`,
      allAssigned,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error assigning serial numbers:', err);
    res.status(500).json({ 
      error: 'Failed to assign serial numbers', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  } finally {
    client.release();
  }
});

// Get available serial numbers for a product - Admin/Super Admin only
router.get('/pending/available-serials/:productId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.params;

    const result = await db.query(
      `SELECT serial_number, created_at, purchase_date
       FROM stock
       WHERE product_id = $1 AND status = 'available' AND serial_number IS NOT NULL
       ORDER BY created_at ASC, purchase_date ASC
       LIMIT 100`,
      [productId]
    );

    res.json(result.rows.map(row => row.serial_number));
  } catch (err) {
    console.error('Error fetching available serial numbers:', err);
    res.status(500).json({ error: 'Failed to fetch available serial numbers' });
  }
});

// Cancel order by Admin/Super Admin - Can cancel any pending order
router.delete('/pending/orders/:invoiceNumber/cancel', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { invoiceNumber } = req.params;

    // Verify the order exists
    const orderCheck = await client.query(
      `SELECT 
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        COUNT(*) as item_count,
        COUNT(CASE WHEN SERIAL_NUMBER IS NOT NULL AND SERIAL_NUMBER != 'PENDING' AND SERIAL_NUMBER != 'N/A' THEN 1 END) as confirmed_items_count
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number`,
      [invoiceNumber]
    );

    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderCheck.rows[0];
    
    // Check if order is already confirmed (has serial numbers assigned)
    if (parseInt(order.confirmed_items_count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot cancel order. Order has already been confirmed and serial numbers have been assigned.' 
      });
    }

    // Delete all sales_item records for this invoice
    await client.query(
      `DELETE FROM sales_item WHERE invoice_number = $1`,
      [invoiceNumber]
    );

    await client.query('COMMIT');

    // Create notification for customer about cancelled order
    try {
      if (order.customer_id) {
        await createNotification(
          order.customer_id,
          'Order Cancelled',
          `Your order (Invoice: ${invoiceNumber}) has been cancelled by admin.`,
          'warning',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to create cancellation notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order:', err);
    res.status(500).json({ 
      error: 'Failed to cancel order', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  } finally {
    client.release();
  }
});

// Cancel order - Customer can cancel pending orders (orders without serial numbers)
router.delete('/cancel/:invoiceNumber', requireAuth, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { invoiceNumber } = req.params;
    const customerId = req.user.id;

    // Verify the order exists and belongs to the customer
    const orderCheck = await client.query(
      `SELECT 
        invoice_number,
        customer_id,
        COUNT(*) as item_count,
        COUNT(CASE WHEN SERIAL_NUMBER IS NOT NULL THEN 1 END) as confirmed_items_count
      FROM sales_item 
      WHERE invoice_number = $1 AND customer_id = $2
      GROUP BY invoice_number, customer_id`,
      [invoiceNumber, customerId]
    );

    if (orderCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found or you do not have permission to cancel this order' });
    }

    const order = orderCheck.rows[0];
    
    // Check if order is already confirmed (has serial numbers assigned)
    if (parseInt(order.confirmed_items_count) > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot cancel order. Order has already been confirmed and serial numbers have been assigned.' 
      });
    }

    // Get all items for this order to restore stock
    const itemsResult = await client.query(
      `SELECT product_id, QUANTITY 
       FROM sales_item 
       WHERE invoice_number = $1`,
      [invoiceNumber]
    );

    // Restore stock for each product (if needed - since we didn't remove stock initially)
    // Actually, we don't need to restore stock because we didn't remove it when order was created
    // But we should still delete the order items

    // Delete all sales_item records for this invoice
    await client.query(
      `DELETE FROM sales_item WHERE invoice_number = $1`,
      [invoiceNumber]
    );

    await client.query('COMMIT');

    // Create notification for admin about cancelled order
    try {
      const adminUsers = await db.query(
        `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true`
      );
      
      const adminUserIds = adminUsers.rows.map(u => u.id);
      const customerResult = await db.query(
        `SELECT full_name, phone FROM users WHERE id = $1`,
        [customerId]
      );
      
      if (adminUserIds.length > 0 && customerResult.rows.length > 0) {
        const customer = customerResult.rows[0];
        await createNotification(
          adminUserIds,
          'Order Cancelled',
          `Customer ${customer.full_name} (${customer.phone}) cancelled order. Invoice: ${invoiceNumber}`,
          'warning',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to create cancellation notification:', notifErr);
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error cancelling order:', err);
    res.status(500).json({ 
      error: 'Failed to cancel order', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
