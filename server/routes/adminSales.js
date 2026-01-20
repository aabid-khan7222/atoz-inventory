const express = require('express');
const db = require('../db');
const bcrypt = require('bcrypt');
const { requireAuth, requireSuperAdminOrAdmin } = require('../middleware/auth');

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

// Generate invoice number
async function generateInvoiceNumber() {
  try {
    const result = await db.query('SELECT generate_invoice_number() as invoice_number');
    return result.rows[0].invoice_number;
  } catch (err) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now();
    return `INV-${dateStr}-${timestamp.toString().slice(-4)}`;
  }
}

// Find or create customer account
async function findOrCreateCustomer(email, mobileNumber, customerName, salesType, client, customerBusinessName, customerGstNumber, customerBusinessAddress) {
  try {
    console.log('[findOrCreateCustomer] Starting with:', { email, mobileNumber, customerName, salesType });
    
    // Validate inputs
    if (!email || !email.trim()) {
      throw new Error('Email is required to create customer account');
    }
    if (!mobileNumber || !mobileNumber.trim()) {
      throw new Error('Mobile number is required to create customer account');
    }
    if (!customerName || !customerName.trim()) {
      throw new Error('Customer name is required to create customer account');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedMobile = mobileNumber.trim();

    // Try to find by email (only customers, role_id >= 3)
    let customerResult = await client.query(
      `SELECT id, email, phone, user_type FROM users WHERE LOWER(email) = $1 AND role_id >= 3 LIMIT 1`,
      [normalizedEmail]
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
    customer.was_auto_created = false;
      console.log('[findOrCreateCustomer] Found existing customer by email:', customer.id);
      
      // Check if company_address column exists
      let hasCompanyAddressCol = false;
      try {
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'customer_profiles' 
          AND column_name = 'company_address'
        `);
        hasCompanyAddressCol = columnCheck.rows.length > 0;
      } catch (err) {
        console.warn('Could not check for company_address column:', err.message);
      }
      
      // For existing customers, preserve their user_type - don't change it based on GST
      // Use existing user_type to determine is_business_customer, not GST presence
      const isBusinessCustomer = isBusinessCustomerType(customer.user_type);
      console.log('[findOrCreateCustomer] Upserting customer_profiles for existing user (email match):', customer.id);
      console.log('[findOrCreateCustomer] Preserving existing user_type:', customer.user_type, 'is_business_customer:', isBusinessCustomer);
      
      if (hasCompanyAddressCol) {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, is_business_customer, company_name, gst_number, company_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number),
            company_address = COALESCE(NULLIF(EXCLUDED.company_address, ''), customer_profiles.company_address)`,
          [
            customer.id,
            customerName,
            customer.email || normalizedEmail,
            customer.phone || normalizedMobile,
            isBusinessCustomer,
            customerBusinessName || null,
            customerGstNumber || null,
            customerBusinessAddress || null
          ]
        );
      } else {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, is_business_customer, company_name, gst_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            is_business_customer = COALESCE(EXCLUDED.is_business_customer, customer_profiles.is_business_customer),
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number)`,
          [
            customer.id,
            customerName,
            customer.email || normalizedEmail,
            customer.phone || normalizedMobile,
            isBusinessCustomer,
            customerBusinessName || null,
            customerGstNumber || null
          ]
        );
      }
      return customer;
    }

    // Try to find by mobile number (only customers, role_id >= 3)
    customerResult = await client.query(
      `SELECT id, email, phone, user_type FROM users WHERE phone = $1 AND role_id >= 3 LIMIT 1`,
      [normalizedMobile]
    );

    if (customerResult.rows.length > 0) {
      const customer = customerResult.rows[0];
    customer.was_auto_created = false;
      console.log('[findOrCreateCustomer] Found existing customer by phone:', customer.id);
      
      // Check if company_address column exists
      let hasCompanyAddressCol = false;
      try {
        const columnCheck = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'customer_profiles' 
          AND column_name = 'company_address'
        `);
        hasCompanyAddressCol = columnCheck.rows.length > 0;
      } catch (err) {
        console.warn('Could not check for company_address column:', err.message);
      }
      
      // For existing customers, preserve their user_type - don't change it based on GST
      // Use existing user_type to determine is_business_customer, not GST presence
      const isBusinessCustomer = isBusinessCustomerType(customer.user_type);
      console.log('[findOrCreateCustomer] Upserting customer_profiles for existing user (phone match):', customer.id);
      console.log('[findOrCreateCustomer] Preserving existing user_type:', customer.user_type, 'is_business_customer:', isBusinessCustomer);
      
      if (hasCompanyAddressCol) {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, is_business_customer, company_name, gst_number, company_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number),
            company_address = COALESCE(NULLIF(EXCLUDED.company_address, ''), customer_profiles.company_address)`,
          [
            customer.id,
            customerName,
            customer.email || normalizedEmail,
            customer.phone || normalizedMobile,
            isBusinessCustomer,
            customerBusinessName || null,
            customerGstNumber || null,
            customerBusinessAddress || null
          ]
        );
      } else {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, is_business_customer, company_name, gst_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number)`,
          [
            customer.id,
            customerName,
            customer.email || normalizedEmail,
            customer.phone || normalizedMobile,
            isBusinessCustomer,
            customerBusinessName || null,
            customerGstNumber || null
          ]
        );
      }
      return customer;
    }

    // Create new customer account
    console.log('[findOrCreateCustomer] Creating new customer account...');
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );

    if (!roleResult.rows.length) {
      throw new Error('Customer role not found in database');
    }

    const customerRoleId = roleResult.rows[0].id;
    // Set user_type based on salesType (wholesale = B2B, retail = B2C)
    // This should NOT change when GST is added later
    const userType = salesType === 'wholesale' ? 'b2b' : 'b2c';
    console.log('[findOrCreateCustomer] User type:', userType, 'Role ID:', customerRoleId);

    // Password = mobile number
    const hashedPassword = await bcrypt.hash(normalizedMobile, 10);

    // Insert user - password column is required (NOT NULL constraint)
    const insertResult = await client.query(
      `INSERT INTO users (
        full_name, email, phone, password, role_id, user_type, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, email, phone, user_type`,
      [customerName.trim(), normalizedEmail, normalizedMobile, hashedPassword, customerRoleId, userType, true]
    );

    if (!insertResult.rows || insertResult.rows.length === 0) {
      throw new Error('Failed to create user - no data returned');
    }

    const newUser = insertResult.rows[0];
    newUser.was_auto_created = true;
    console.log('[findOrCreateCustomer] Auto-created customer user:', { id: newUser.id, email: newUser.email, phone: newUser.phone });
    console.log('[findOrCreateCustomer] Created new user:', newUser.id, newUser.email);

    // Also create entry in customer_profiles table
    // Check if company_address column exists
    let hasCompanyAddressCol = false;
    try {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'company_address'
      `);
      hasCompanyAddressCol = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('Could not check for company_address column:', err.message);
    }
    
    // Set is_business_customer based on user_type (from salesType), NOT GST presence
    // This ensures user type remains as selected during sale, regardless of GST
    const isBusinessCustomer = isBusinessCustomerType(userType);
    let profileInsertResult;
    
    if (hasCompanyAddressCol) {
      profileInsertResult = await client.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer, company_name, gst_number, company_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          is_business_customer = customer_profiles.is_business_customer,
          company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
          gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number),
          company_address = COALESCE(NULLIF(EXCLUDED.company_address, ''), customer_profiles.company_address)
        RETURNING *`,
        [
          newUser.id,
          customerName.trim(),
          normalizedEmail,
          normalizedMobile,
          isBusinessCustomer,
          customerBusinessName || null,
          customerGstNumber || null,
          customerBusinessAddress || null
        ]
      );
    } else {
      profileInsertResult = await client.query(
        `INSERT INTO customer_profiles (
          user_id, full_name, email, phone, is_business_customer, company_name, gst_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (user_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          is_business_customer = customer_profiles.is_business_customer,
          company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
          gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number)
        RETURNING *`,
        [
          newUser.id,
          customerName.trim(),
          normalizedEmail,
          normalizedMobile,
          isBusinessCustomer,
          customerBusinessName || null,
          customerGstNumber || null
        ]
      );
    }

    console.log('[findOrCreateCustomer] Created customer_profiles entry:', profileInsertResult.rows[0]?.user_id);
    console.log('[findOrCreateCustomer] Successfully created customer:', { id: newUser.id, email: newUser.email, type: userType });

    return newUser;
  } catch (error) {
    console.error('[findOrCreateCustomer] Error:', error);
    throw error;
  }
}

// Get oldest available serial numbers (FIFO)
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

// Calculate GST breakdown
function calculateGSTBreakdown(mrp, quantity) {
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

// Find or create commission agent
async function findOrCreateCommissionAgent(agentName, agentMobile, client) {
  if (!agentName || !agentMobile) {
    return null;
  }

  // Check if commission_agents table exists
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'commission_agents'
    )
  `);
  
  if (!tableCheck.rows[0]?.exists) {
    console.warn('[findOrCreateCommissionAgent] commission_agents table does not exist');
    return null;
  }

  // Check which schema version exists
  const columnCheck = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'commission_agents'
    AND column_name IN ('name', 'full_name', 'mobile_number', 'phone')
  `);
  
  const columns = columnCheck.rows.map(r => r.column_name);
  const hasNewSchema = columns.includes('name') && columns.includes('mobile_number');
  const hasOldSchema = columns.includes('full_name') && columns.includes('phone');
  
  if (!hasNewSchema && !hasOldSchema) {
    console.warn('[findOrCreateCommissionAgent] commission_agents table has unexpected schema');
    return null;
  }

  const cleanMobile = agentMobile.trim().replace(/\D/g, '');
  if (cleanMobile.length !== 10) {
    throw new Error('Invalid mobile number for commission agent');
  }

  const nameColumn = hasNewSchema ? 'name' : 'full_name';
  const mobileColumn = hasNewSchema ? 'mobile_number' : 'phone';

  // Try to find existing agent by mobile number
  const existingResult = await client.query(
    `SELECT id FROM commission_agents WHERE ${mobileColumn} = $1 LIMIT 1`,
    [cleanMobile]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].id;
  }

  // Create new agent
  const insertResult = await client.query(
    `INSERT INTO commission_agents (${nameColumn}, ${mobileColumn})
     VALUES ($1, $2)
     RETURNING id`,
    [agentName.trim(), cleanMobile]
  );

  return insertResult.rows[0].id;
}

// Admin/Super Admin Sell Stock - New route for new sales system
// Supports both single product (backward compatible) and multiple products (items array)
router.post('/sell-stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if this is a multi-item sale (new format) or single item (old format)
    const isMultiItemSale = req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0;

    // Common customer fields (same for both formats)
    const {
      purchaseDate,
      customerName,
      customerMobileNumber,
      customerEmail,
      salesType, // 'retail' or 'wholesale'
      paymentMethod,
      paymentStatus = 'paid',
      customerBusinessName,
      customerGstNumber,
      customerBusinessAddress,
      // Commission fields
      hasCommission,
      commissionAgentId,
      commissionAgentName,
      commissionAgentMobile,
      commissionAmount
    } = req.body;

    // Log received data for debugging
    console.log('Received sale data:', JSON.stringify(req.body, null, 2));

    // Validation - Customer info required for both formats
    if (!customerName || !customerMobileNumber) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Customer name and mobile number are required',
        received: { customerName, customerMobileNumber }
      });
    }

    // If email not provided, generate one from phone number
    const finalCustomerEmail = customerEmail || `${customerMobileNumber}@customer.local`;

    // Find or create customer (same for both formats)
    const customer = await findOrCreateCustomer(
      finalCustomerEmail,
      customerMobileNumber,
      customerName,
      salesType || 'retail',
      client,
      customerBusinessName,
      customerGstNumber,
      customerBusinessAddress
    );

    // Handle commission agent (if commission is applicable)
    let finalCommissionAgentId = null;
    let finalCommissionAmount = 0;
    
    if (hasCommission) {
      if (commissionAgentId) {
        // Use existing agent
        finalCommissionAgentId = parseInt(commissionAgentId, 10);
        
        // Verify agent exists
        const agentCheck = await client.query(
          `SELECT id FROM commission_agents WHERE id = $1`,
          [finalCommissionAgentId]
        );
        
        if (agentCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Commission agent not found' });
        }
      } else if (commissionAgentName && commissionAgentMobile) {
        // Find or create new agent
        try {
          finalCommissionAgentId = await findOrCreateCommissionAgent(
            commissionAgentName,
            commissionAgentMobile,
            client
          );
        } catch (agentErr) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: 'Failed to create commission agent',
            details: agentErr.message 
          });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Commission agent details are required when commission is applicable' 
        });
      }
      
      // Validate commission amount
      const parsedCommissionAmount = parseFloat(commissionAmount || 0);
      if (isNaN(parsedCommissionAmount) || parsedCommissionAmount < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Valid commission amount is required' 
        });
      }
      finalCommissionAmount = parsedCommissionAmount;
    }

    // Generate invoice number (same for all items in the sale)
    const invoiceNumber = await generateInvoiceNumber();
    const finalSalesType = salesType || 'retail';
    const salesTypeId = finalSalesType === 'wholesale' ? 2 : 1;

    // Process items - either from items array (new) or single product (old)
    let itemsToProcess = [];
    
    if (isMultiItemSale) {
      // New format: multiple items
      itemsToProcess = req.body.items;
      
      // Validate items array
      if (!Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Items array is required and must contain at least one item',
          received: { items: itemsToProcess }
        });
      }
    } else {
      // Old format: single product (backward compatibility)
      const {
        productId,
        category,
        quantity,
        serialNumber,
        customerVehicleNumber,
        vehicleNumbers,
        mrp,
        discountAmount,
        finalAmount
      } = req.body;

      // Validation for old format
      if (!productId || !category || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Product ID, category, and valid quantity are required',
          received: { productId, category, quantity }
        });
      }

      if (!mrp || parseFloat(mrp) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Valid MRP is required',
          received: { mrp }
        });
      }

      if (!finalAmount || parseFloat(finalAmount) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Valid final amount is required',
          received: { finalAmount }
        });
      }

      // Convert old format to new format for processing
      itemsToProcess = [{
        productId,
        category,
        quantity,
        serialNumber,
        customerVehicleNumber,
        vehicleNumbers,
        mrp,
        discountAmount: discountAmount || 0,
        finalAmount
      }];
    }

    // Process all items
    const salesItems = [];
    const processedProductStocks = {}; // Track stock updates per product

    for (const item of itemsToProcess) {
      const {
        productId,
        category,
        quantity,
        serialNumber,
        customerVehicleNumber,
        vehicleNumbers,
        mrp,
        discountAmount = 0,
        finalAmount
      } = item;

      // Validate item
      if (!productId || !category || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Each item must have product ID, category, and valid quantity',
          received: { productId, category, quantity }
        });
      }

      if (!mrp || parseFloat(mrp) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Each item must have valid MRP',
          received: { mrp, productId }
        });
      }

      if (!finalAmount || parseFloat(finalAmount) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ 
          error: 'Each item must have valid final amount',
          received: { finalAmount, productId }
        });
      }

      const productTypeId = getProductTypeId(category);
      if (!productTypeId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid category for product ${productId}: ${category}` });
      }

      // Get product details
      const productResult = await client.query(
        `SELECT id, sku, name, qty, mrp_price, selling_price, ah_va, warranty, series, product_type_id, category
         FROM products 
         WHERE id = $1 AND product_type_id = $2`,
        [productId, productTypeId]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${productId} not found in category ${category}` });
      }

      const product = productResult.rows[0];
      
      // Track stock per product (for multiple items of same product)
      if (!processedProductStocks[productId]) {
        processedProductStocks[productId] = parseInt(product.qty || 0);
      }
      const currentStock = processedProductStocks[productId];

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

      // Get serial numbers - Skip for water products (they don't have serial numbers)
      let serialNumbers = [];
      if (isWaterProduct) {
        // Water products don't have serial numbers - use placeholder 'N/A' instead of null
        // This prevents NOT NULL constraint violation in sales_item table
        serialNumbers = Array(quantity).fill('N/A');
      } else {
        // For non-water products, get serial numbers as usual
        if (serialNumber !== undefined && serialNumber !== null) {
          // If serial numbers are provided (admin selected them)
          if (Array.isArray(serialNumber)) {
            if (serialNumber.length === 0) {
              // Empty array - auto-assign oldest
              try {
                serialNumbers = await getOldestSerialNumbers(productId, quantity, client);
              } catch (stockErr) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                  error: stockErr.message || 'Failed to get serial numbers. Please select serial numbers manually.',
                  received: { productId, quantity, serialNumber }
                });
              }
            } else {
              serialNumbers = serialNumber.filter(s => s && s.trim()); // Filter out empty strings
            }
          } else if (typeof serialNumber === 'string' && serialNumber.trim()) {
            // Single serial provided, use it for all quantities
            serialNumbers = Array(quantity).fill(serialNumber.trim());
          } else {
            // Invalid format - try auto-assign
            try {
              serialNumbers = await getOldestSerialNumbers(productId, quantity, client);
            } catch (stockErr) {
              await client.query('ROLLBACK');
              return res.status(400).json({ 
                error: 'Invalid serial number format. Please select serial numbers manually.',
                received: { serialNumber, quantity }
              });
            }
          }
        } else {
          // If no serials provided, auto-assign oldest (fallback)
          try {
            serialNumbers = await getOldestSerialNumbers(productId, quantity, client);
          } catch (stockErr) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: stockErr.message || 'Failed to get serial numbers',
              received: { productId, quantity }
            });
          }
        }

        if (serialNumbers.length !== quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({ 
            error: `Serial numbers count (${serialNumbers.length}) must match quantity (${quantity}) for product ${product.name}`,
            received: { serialNumber, quantity, serialNumbersCount: serialNumbers.length, serialNumbers, productId }
          });
        }
      }

      // Process vehicle numbers - Skip validation for water products
      let vehicleNumbersArray = [];
      if (isWaterProduct) {
        // Water products don't need vehicle numbers - set all to null
        vehicleNumbersArray = Array(quantity).fill(null);
      } else {
        // For non-water products, process vehicle numbers as usual
        if (quantity > 1 && vehicleNumbers && Array.isArray(vehicleNumbers)) {
          // Multiple quantities with vehicle numbers array
          if (vehicleNumbers.length !== quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
              error: `Vehicle numbers count (${vehicleNumbers.length}) must match quantity (${quantity}) for product ${product.name}`,
              received: { vehicleNumbers, quantity, productId }
            });
          }
          vehicleNumbersArray = vehicleNumbers.map(vn => (vn && vn.trim()) || null);
        } else if (quantity === 1) {
          // Single quantity - use customerVehicleNumber
          vehicleNumbersArray = [customerVehicleNumber ? customerVehicleNumber.trim() : null];
        } else {
          // Multiple quantities but no vehicle numbers array - use single vehicle number for all
          vehicleNumbersArray = Array(quantity).fill(customerVehicleNumber ? customerVehicleNumber.trim() : null);
        }
      }

      // Vehicle numbers are always optional for all customers and all product types
      // No validation needed - vehicle numbers can be null/empty

      // Calculate per-unit amounts
      const perUnitMRP = parseFloat(mrp);
      const perUnitDiscount = (parseFloat(discountAmount || 0)) / quantity;
      const perUnitFinal = parseFloat(finalAmount) / quantity;
      
      // GST is always 18% (included in MRP, fixed and non-editable)
      // GST = MRP * 0.18 / 1.18 (since MRP includes GST)
      const perUnitTax = (perUnitMRP * 0.18) / 1.18;

      // Check which columns exist in sales_item table (check ONCE before loop)
      const salesItemColumnsCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_item'
        AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address', 'has_commission', 'commission_agent_id', 'commission_amount')
      `);
      const salesItemColumns = salesItemColumnsCheck.rows.map(r => r.column_name);
      const hasCreatedBy = salesItemColumns.includes('created_by');
      const hasBusinessFields = salesItemColumns.includes('customer_business_name') && 
                                salesItemColumns.includes('customer_gst_number') && 
                                salesItemColumns.includes('customer_business_address');
      const hasCommissionFields = salesItemColumns.includes('has_commission') && 
                                  salesItemColumns.includes('commission_agent_id') && 
                                  salesItemColumns.includes('commission_amount');

      // Calculate commission per item (distribute evenly if multiple items)
      const totalItems = itemsToProcess.reduce((sum, item) => sum + item.quantity, 0);
      const commissionPerItem = finalCommissionAmount > 0 && totalItems > 0 
        ? finalCommissionAmount / totalItems 
        : 0;

      // Create one sales_item row per battery (no sales_id needed)
      for (let i = 0; i < quantity; i++) {
        const serial = serialNumbers[i];
        const vehicleNumber = vehicleNumbersArray[i] || null; // Get corresponding vehicle number
        
        // Remove from stock - Skip for water products (they don't have serial numbers in stock table)
        if (!isWaterProduct && serial) {
          await client.query(
            `DELETE FROM stock 
             WHERE product_id = $1 AND serial_number = $2 AND status = 'available'`,
            [productId, serial]
          );
        }

        // Update product quantity (track per product)
        processedProductStocks[productId] -= 1;
        const newStock = processedProductStocks[productId];
        await client.query(
          `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [newStock, productId]
        );
        
        // Build INSERT query dynamically based on available columns
        let insertColumns = `customer_id, invoice_number, customer_name, customer_mobile_number,
            customer_vehicle_number, sales_type, sales_type_id`;
        let insertValues = `$1, $2, $3, $4, $5, $6, $7`;
        let insertParams = [
          customer.id,
          invoiceNumber,
          customerName.trim(),
          customerMobileNumber.trim(),
          vehicleNumber,
          finalSalesType,
          salesTypeId
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
          purchaseDate ? new Date(purchaseDate) : new Date(),
          product.sku,
          product.series || null,
          normalizedCategory,
          product.name,
          product.ah_va || null,
          1,
          product.warranty || null,
          serial,
          perUnitMRP,
          perUnitDiscount,
          perUnitTax,
          perUnitFinal,
          paymentMethod || 'cash',
          paymentStatus,
          product.id
        );
        paramIndex += 16;
        
        // Add business fields if they exist
        if (hasBusinessFields) {
          insertColumns += `, customer_business_name, customer_gst_number, customer_business_address`;
          insertValues += `, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}`;
          insertParams.push(
            customerBusinessName ? customerBusinessName.trim() : null,
            customerGstNumber ? customerGstNumber.trim() : null,
            customerBusinessAddress ? customerBusinessAddress.trim() : null
          );
          paramIndex += 3;
        }
        
        // Add commission fields if they exist
        if (hasCommissionFields) {
          insertColumns += `, has_commission, commission_agent_id, commission_amount`;
          insertValues += `, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}`;
          insertParams.push(
            hasCommission || false,
            finalCommissionAgentId,
            commissionPerItem
          );
        }
        
        // Debug: Verify column and param counts match
        const columnCount = insertColumns.split(',').length;
        const paramCount = insertParams.length;
        if (columnCount !== paramCount) {
          console.error(`[ADD STOCK] MISMATCH: Columns: ${columnCount}, Params: ${paramCount}`);
          console.error(`[ADD STOCK] Columns: ${insertColumns}`);
          console.error(`[ADD STOCK] Values: ${insertValues}`);
          throw new Error(`Column count (${columnCount}) does not match parameter count (${paramCount})`);
        }
        
        // Insert sales_item with corresponding vehicle number
        const itemResult = await client.query(
          `INSERT INTO sales_item (
            ${insertColumns}
          ) VALUES (${insertValues})
          RETURNING *`,
          insertParams
        );

        salesItems.push(itemResult.rows[0]);
      }
    }

    // Update commission agent's total commission paid (if column exists)
    if (finalCommissionAgentId && finalCommissionAmount > 0) {
      try {
        // Check if total_commission_paid column exists
        const columnCheck = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'commission_agents'
            AND column_name = 'total_commission_paid'
          )
        `);
        
        if (columnCheck.rows[0]?.exists) {
          await client.query(
            `UPDATE commission_agents 
             SET total_commission_paid = total_commission_paid + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [finalCommissionAmount, finalCommissionAgentId]
          );
        }
      } catch (updateErr) {
        console.warn('[sell-stock] Could not update commission agent total:', updateErr.message);
        // Don't fail the transaction if commission update fails
      }
    }

    await client.query('COMMIT');

    // Check which columns exist for the SELECT query
    const selectColumnsCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address')
    `);
    const selectColumns = selectColumnsCheck.rows.map(r => r.column_name);
    const hasCreatedByInSelect = selectColumns.includes('created_by');
    const hasBusinessFieldsInSelect = selectColumns.includes('customer_business_name') && 
                                      selectColumns.includes('customer_gst_number') && 
                                      selectColumns.includes('customer_business_address');
    
    // Build SELECT query dynamically
    let selectQuery = `SELECT 
        invoice_number as id,
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id`;
    
    if (hasCreatedByInSelect) {
      selectQuery += `, created_by`;
    }
    
    if (hasBusinessFieldsInSelect) {
      selectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    selectQuery += `,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number,
               customer_vehicle_number, sales_type, sales_type_id`;
    
    if (hasCreatedByInSelect) {
      selectQuery += `, created_by`;
    }
    
    if (hasBusinessFieldsInSelect) {
      selectQuery += `, customer_business_name, customer_gst_number, customer_business_address`;
    }
    
    selectQuery += ` LIMIT 1`;
    
    const saleResult = await client.query(selectQuery, [invoiceNumber]);

    res.status(201).json({
      success: true,
      sale: {
        ...saleResult.rows[0],
        items: salesItems,
      },
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        user_type: customer.user_type
      },
      autoCreatedCustomerUser: customer?.was_auto_created === true,
      message: customer?.was_auto_created === true
        ? 'Customer user auto-created (email as username, mobile as password)'
        : undefined,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error in admin sell stock:', err);
    console.error('Error stack:', err.stack);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ 
      error: 'Failed to process sale', 
      message: err.message || 'Unknown error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  } finally {
    client.release();
  }
});

// Get all sales items (for admin/super admin to view sold items)
router.get('/sales-items', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { 
      category, 
      salesType, 
      dateFrom, 
      dateTo, 
      search,
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    // Check which columns exist in sales_item table
    const salesItemColumnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('created_by', 'customer_business_name', 'customer_gst_number', 'customer_business_address', 'has_commission', 'commission_agent_id', 'commission_amount')
    `);
    const salesItemColumns = salesItemColumnsCheck.rows.map(r => r.column_name);
    const hasCreatedBy = salesItemColumns.includes('created_by');
    const hasBusinessFields = salesItemColumns.includes('customer_business_name') && 
                              salesItemColumns.includes('customer_gst_number') && 
                              salesItemColumns.includes('customer_business_address');
    const hasCommissionFields = salesItemColumns.includes('has_commission') && 
                                salesItemColumns.includes('commission_agent_id') && 
                                salesItemColumns.includes('commission_amount');
    
    // Check if commission_agents table exists
    let hasCommissionAgents = false;
    try {
      const tableCheck = await db.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'commission_agents'
        )
      `);
      hasCommissionAgents = tableCheck.rows[0]?.exists && hasCommissionFields;
    } catch (checkErr) {
      console.warn('Could not check commission_agents table:', checkErr.message);
    }

    // Build SELECT query explicitly listing columns (don't use si.*)
    let query = `
      SELECT 
        si.id,
        si.customer_id,
        si.invoice_number,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_vehicle_number,
        si.sales_type,
        si.sales_type_id,
        si.purchase_date,
        si.SKU,
        si.SERIES,
        si.CATEGORY,
        si.NAME,
        si.AH_VA,
        si.QUANTITY,
        si.WARRANTY,
        si.SERIAL_NUMBER,
        si.MRP,
        si.discount_amount,
        si.tax,
        si.final_amount,
        si.payment_method,
        si.payment_status,
        si.product_id,
        si.created_at,
        si.updated_at`;
    
    // Add optional columns if they exist
    if (hasCreatedBy) {
      query += `, si.created_by`;
    }
    
    if (hasBusinessFields) {
      query += `, si.customer_business_name, si.customer_gst_number, si.customer_business_address`;
    }
    
    if (hasCommissionFields) {
      query += `, si.has_commission, si.commission_agent_id, si.commission_amount`;
    }
    
    // Add product and commission agent fields
    query += `,
        p.product_type_id,
        p.name as product_name_from_products,
        p.series as product_series,
        COALESCE(si.NAME, p.name) as display_name,
        COALESCE(si.SKU, p.sku) as display_sku`;
    
    // Only include commission agent fields if table exists
    if (hasCommissionAgents) {
      query += `,
        ca.name as commission_agent_name,
        ca.mobile_number as commission_agent_mobile`;
    } else {
      query += `,
        NULL as commission_agent_name,
        NULL as commission_agent_mobile`;
    }
    
    query += `
      FROM sales_item si
      LEFT JOIN products p ON si.product_id = p.id
    `;
    
    if (hasCommissionAgents) {
      query += `LEFT JOIN commission_agents ca ON si.commission_agent_id = ca.id`;
    }
    
    query += ` WHERE 1=1`;
    const params = [];
    let paramCount = 1;

    if (productTypeId) {
      query += ` AND p.product_type_id = $${paramCount}`;
      params.push(productTypeId);
      paramCount++;
    }

    if (salesType && salesType !== 'all') {
      query += ` AND si.sales_type = $${paramCount}`;
      params.push(salesType);
      paramCount++;
    }

    if (dateFrom) {
      query += ` AND si.purchase_date >= $${paramCount}`;
      params.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      query += ` AND si.purchase_date <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
      paramCount++;
    }

    if (search) {
      query += ` AND (
        si.NAME ILIKE $${paramCount} OR
        si.SKU ILIKE $${paramCount} OR
        si.SERIAL_NUMBER ILIKE $${paramCount} OR
        si.customer_name ILIKE $${paramCount} OR
        si.customer_mobile_number ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
      paramCount++;
    }

    query += ` ORDER BY si.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    console.log('📊 Executing sales items query');
    console.log('Query:', query);
    console.log('Params:', params);
    console.log('Has commission_agents:', hasCommissionAgents);
    
    try {
      const result = await db.query(query, params);
      console.log(`✅ Fetched ${result.rows.length} sales items`);
      res.json(result.rows);
    } catch (queryErr) {
      console.error('❌ Query execution failed:', queryErr);
      console.error('Query:', query);
      console.error('Params:', params);
      throw queryErr; // Re-throw to be caught by outer catch
    }
  } catch (err) {
    console.error('❌ Error fetching sales items:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      hint: err.hint,
      position: err.position,
      internalPosition: err.internalPosition,
      internalQuery: err.internalQuery,
      where: err.where,
      schema: err.schema,
      table: err.table,
      column: err.column,
      dataType: err.dataType,
      constraint: err.constraint,
      file: err.file,
      line: err.line,
      routine: err.routine
    });
    res.status(500).json({ 
      error: 'Failed to fetch sales items',
      details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
  }
});

module.exports = router;

