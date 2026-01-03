const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireSuperAdminOrAdmin } = require('../middleware/auth');
const { createNotification } = require('./notifications');

const router = express.Router();

// Helper function to get category from product_type_id
function getCategoryFromTypeId(typeId) {
  const categoryMap = {
    1: 'car-truck-tractor',
    2: 'bike',
    3: 'ups-inverter',
  };
  return categoryMap[typeId] || 'car-truck-tractor';
}

// Helper function to parse warranty string (e.g., "24F+24P", "30F+30P", "24F+18P")
// Returns { guaranteeMonths: number, warrantyMonths: number, totalMonths: number }
function parseWarrantyString(warrantyString) {
  if (!warrantyString || typeof warrantyString !== 'string') {
    return { guaranteeMonths: 0, warrantyMonths: 0, totalMonths: 0 };
  }

  // Remove any extra text like "48M (24F+24P)" and extract just the warranty part
  const warrantyMatch = warrantyString.match(/(\d+)F(?:\+(\d+)P)?/);
  
  if (!warrantyMatch) {
    // Try to extract just a number if format is different (e.g., "24F" only)
    const singleMatch = warrantyString.match(/(\d+)F/);
    if (singleMatch) {
      const guaranteeMonths = parseInt(singleMatch[1], 10) || 0;
      return { guaranteeMonths, warrantyMonths: 0, totalMonths: guaranteeMonths };
    }
    return { guaranteeMonths: 0, warrantyMonths: 0, totalMonths: 0 };
  }

  const guaranteeMonths = parseInt(warrantyMatch[1], 10) || 0;
  const warrantyMonths = warrantyMatch[2] ? (parseInt(warrantyMatch[2], 10) || 0) : 0;
  const totalMonths = guaranteeMonths + warrantyMonths;

  return { guaranteeMonths, warrantyMonths, totalMonths };
}

// Helper function to check if battery is under guarantee
function isUnderGuarantee(purchaseDate, guaranteeMonths) {
  if (!guaranteeMonths || guaranteeMonths === 0) return false;
  
  const purchase = new Date(purchaseDate);
  const today = new Date();
  
  // Calculate months difference more accurately
  const monthsDiff = (today.getFullYear() - purchase.getFullYear()) * 12 + 
                     (today.getMonth() - purchase.getMonth());
  
  // Also consider days - if we're in the same month but past the day, count it
  if (today.getDate() < purchase.getDate()) {
    // If today's date is before purchase date in the same month, don't count this month
    // This is already handled by the month difference calculation
  }
  
  return monthsDiff <= guaranteeMonths; // Use <= so the last month of guarantee period is still covered
}

// Helper function to calculate months after guarantee
function getMonthsAfterGuarantee(purchaseDate, guaranteeMonths) {
  const purchase = new Date(purchaseDate);
  const today = new Date();
  const totalMonths = (today.getFullYear() - purchase.getFullYear()) * 12 + 
                      (today.getMonth() - purchase.getMonth());
  
  const guaranteeEndMonths = guaranteeMonths || 0;
  return Math.max(0, totalMonths - guaranteeEndMonths);
}

// Get battery status (guarantee/warranty eligibility)
router.get('/battery-status/:serialNumber', requireAuth, async (req, res) => {
  try {
    const { serialNumber } = req.params;

    // Find the original sale item by serial number
    const saleItemResult = await db.query(
      `SELECT 
        si.id,
        si.customer_id,
        si.purchase_date,
        si.SERIAL_NUMBER,
        si.invoice_number,
        si.product_id,
        si.WARRANTY as sales_item_warranty,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_vehicle_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.customer_business_address,
        p.guarantee_period_months,
        p.warranty as product_warranty,
        p.name as product_name,
        p.sku,
        u.full_name as user_full_name,
        u.email as user_email,
        u.phone as user_phone,
        cp.address as customer_address,
        cp.city,
        cp.state,
        cp.pincode
      FROM sales_item si
      JOIN products p ON si.product_id = p.id
      JOIN users u ON si.customer_id = u.id
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE si.SERIAL_NUMBER = $1
      ORDER BY si.purchase_date DESC
      LIMIT 1`,
      [serialNumber]
    );

    if (saleItemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Battery with this serial number not found' });
    }

    const saleItem = saleItemResult.rows[0];

    // Check if customer (role_id >= 3) is trying to access another customer's serial number
    if (req.user.role_id >= 3 && saleItem.customer_id !== req.user.id) {
      return res.status(403).json({ error: 'This serial number does not belong to your account' });
    }

    // Allow all authenticated users to check battery status (informational only)
    // Replacements are restricted to admins only (handled in the /replace endpoint)
    // Customers can only check their own serial numbers (checked above)

    // Check if already replaced
    const replacementCheck = await db.query(
      `SELECT 
        br.id,
        br.replacement_type,
        br.replacement_date,
        br.new_serial_number,
        br.new_invoice_number
      FROM battery_replacements br
      WHERE br.original_serial_number = $1
      ORDER BY br.replacement_date DESC
      LIMIT 1`,
      [serialNumber]
    );

    const isReplaced = replacementCheck.rows.length > 0;
    const latestReplacement = isReplaced ? replacementCheck.rows[0] : null;

    // Parse warranty string to get guarantee months
    // Priority: sales_item.WARRANTY > products.warranty > guarantee_period_months
    const warrantyString = saleItem.sales_item_warranty || saleItem.product_warranty || '';
    const warrantyInfo = parseWarrantyString(warrantyString);
    
    // Use parsed guarantee months, fallback to guarantee_period_months if warranty string is not available
    const guaranteeMonths = warrantyInfo.guaranteeMonths > 0 
      ? warrantyInfo.guaranteeMonths 
      : (saleItem.guarantee_period_months || 0);
    
    const warrantyMonths = warrantyInfo.warrantyMonths;
    const totalWarrantyMonths = warrantyInfo.totalMonths > 0 ? warrantyInfo.totalMonths : (guaranteeMonths + warrantyMonths);

    // Calculate status
    const underGuarantee = isUnderGuarantee(saleItem.purchase_date, guaranteeMonths);
    const monthsAfterGuarantee = getMonthsAfterGuarantee(saleItem.purchase_date, guaranteeMonths);

    // Check if still within total warranty period (guarantee + warranty)
    const withinWarrantyPeriod = totalWarrantyMonths > 0 && 
      (monthsAfterGuarantee >= 0 && monthsAfterGuarantee <= warrantyMonths);

    // Get warranty slab if applicable (only if within warranty period, not guarantee)
    let warrantySlab = null;
    if (!underGuarantee && withinWarrantyPeriod && monthsAfterGuarantee >= 0) {
      const slabResult = await db.query(
        `SELECT 
          ws.id,
          ws.slab_name,
          ws.discount_percentage,
          ws.min_months,
          ws.max_months
        FROM warranty_slabs ws
        WHERE ws.is_active = true
          AND $1 >= ws.min_months
          AND (ws.max_months IS NULL OR $1 <= ws.max_months)
        ORDER BY ws.discount_percentage DESC
        LIMIT 1`,
        [monthsAfterGuarantee]
      );

      if (slabResult.rows.length > 0) {
        warrantySlab = slabResult.rows[0];
      }
    }

    res.json({
      serialNumber: saleItem.SERIAL_NUMBER,
      saleItemId: saleItem.id,
      customer: {
        id: saleItem.customer_id,
        name: saleItem.customer_name || saleItem.user_full_name,
        phone: saleItem.customer_mobile_number || saleItem.user_phone,
        email: saleItem.user_email,
        vehicleNumber: saleItem.customer_vehicle_number,
        businessName: saleItem.customer_business_name,
        gstNumber: saleItem.customer_gst_number,
        businessAddress: saleItem.customer_business_address,
        address: saleItem.customer_address,
        city: saleItem.city,
        state: saleItem.state,
        pincode: saleItem.pincode
      },
      product: {
        id: saleItem.product_id,
        name: saleItem.product_name,
        sku: saleItem.sku
      },
      purchaseDate: saleItem.purchase_date,
      invoiceNumber: saleItem.invoice_number,
      guaranteePeriodMonths: guaranteeMonths,
      warrantyPeriodMonths: warrantyMonths,
      totalWarrantyMonths: totalWarrantyMonths,
      warrantyString: warrantyString,
      status: {
        isReplaced,
        underGuarantee,
        withinWarrantyPeriod,
        monthsAfterGuarantee,
        // For guarantee: always eligible while under guarantee.
        // For warranty: eligible for replacement for the whole warranty period,
        // even if no automatic slab is matched (slab will be chosen manually in UI).
        eligibleForReplacement: underGuarantee || withinWarrantyPeriod,
        replacementType: underGuarantee ? 'guarantee' : (withinWarrantyPeriod ? 'warranty' : null),
        outOfWarranty: !underGuarantee && !withinWarrantyPeriod
      },
      warrantySlab,
      latestReplacement: latestReplacement ? {
        type: latestReplacement.replacement_type,
        date: latestReplacement.replacement_date,
        newSerialNumber: latestReplacement.new_serial_number,
        newInvoiceNumber: latestReplacement.new_invoice_number
      } : null
    });
  } catch (err) {
    console.error('Error checking battery status:', err);
    res.status(500).json({ error: 'Failed to check battery status' });
  }
});

// Get replacement history for a customer (with customerId parameter)
router.get('/history/:customerId', requireAuth, async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId, 10);

    if (isNaN(customerId)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    // Check permissions
    if (req.user.role_id >= 3 && customerId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await db.query(
      `SELECT 
        br.id,
        br.original_serial_number,
        br.original_purchase_date,
        br.original_invoice_number,
        br.replacement_type,
        br.replacement_date,
        br.new_serial_number,
        br.new_invoice_number,
        br.discount_percentage,
        br.notes,
        br.created_at,
        p.name as product_name,
        p.sku as product_sku,
        ws.slab_name as warranty_slab_name,
        u_created.full_name as created_by_name,
        u_customer.full_name as customer_name,
        u_customer.phone as customer_phone,
        u_customer.email as customer_email,
        si.customer_name as sale_customer_name,
        si.customer_mobile_number as sale_customer_phone,
        si.customer_vehicle_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.customer_business_address,
        cp.address as customer_address,
        cp.city,
        cp.state,
        cp.pincode
      FROM battery_replacements br
      LEFT JOIN products p ON br.product_id = p.id
      LEFT JOIN warranty_slabs ws ON br.warranty_slab_id = ws.id
      LEFT JOIN users u_created ON br.created_by = u_created.id
      LEFT JOIN users u_customer ON br.customer_id = u_customer.id
      LEFT JOIN sales_item si ON br.original_sale_item_id = si.id
      LEFT JOIN customer_profiles cp ON u_customer.id = cp.user_id
      WHERE br.customer_id = $1
      ORDER BY br.replacement_date DESC, br.created_at DESC`,
      [customerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching replacement history:', err);
    res.status(500).json({ error: 'Failed to fetch replacement history' });
  }
});

// Get replacement history for all customers (admin / super-admin view)
router.get('/history-all', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        br.id,
        br.original_serial_number,
        br.original_purchase_date,
        br.original_invoice_number,
        br.replacement_type,
        br.replacement_date,
        br.new_serial_number,
        br.new_invoice_number,
        br.discount_percentage,
        br.notes,
        br.created_at,
        p.name as product_name,
        p.sku as product_sku,
        ws.slab_name as warranty_slab_name,
        u_customer.full_name as customer_name,
        u_customer.phone as customer_phone,
        u_customer.email as customer_email,
        u_created.full_name as created_by_name,
        si.customer_name as sale_customer_name,
        si.customer_mobile_number as sale_customer_phone,
        si.customer_vehicle_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.customer_business_address,
        cp.address as customer_address,
        cp.city,
        cp.state,
        cp.pincode
      FROM battery_replacements br
      LEFT JOIN products p ON br.product_id = p.id
      LEFT JOIN warranty_slabs ws ON br.warranty_slab_id = ws.id
      LEFT JOIN users u_customer ON br.customer_id = u_customer.id
      LEFT JOIN users u_created ON br.created_by = u_created.id
      LEFT JOIN sales_item si ON br.original_sale_item_id = si.id
      LEFT JOIN customer_profiles cp ON u_customer.id = cp.user_id
      ORDER BY br.replacement_date DESC, br.created_at DESC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching all replacement history:', err);
    res.status(500).json({ error: 'Failed to fetch replacement history' });
  }
});

// Get replacement history for current user (no customerId parameter)
router.get('/history', requireAuth, async (req, res) => {
  try {
    const customerId = req.user.id;

    const result = await db.query(
      `SELECT 
        br.id,
        br.original_serial_number,
        br.original_purchase_date,
        br.original_invoice_number,
        br.replacement_type,
        br.replacement_date,
        br.new_serial_number,
        br.new_invoice_number,
        br.discount_percentage,
        br.notes,
        br.created_at,
        p.name as product_name,
        p.sku as product_sku,
        ws.slab_name as warranty_slab_name,
        u_created.full_name as created_by_name,
        u_customer.full_name as customer_name,
        u_customer.phone as customer_phone,
        u_customer.email as customer_email,
        si.customer_name as sale_customer_name,
        si.customer_mobile_number as sale_customer_phone,
        si.customer_vehicle_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.customer_business_address,
        cp.address as customer_address,
        cp.city,
        cp.state,
        cp.pincode
      FROM battery_replacements br
      LEFT JOIN products p ON br.product_id = p.id
      LEFT JOIN warranty_slabs ws ON br.warranty_slab_id = ws.id
      LEFT JOIN users u_created ON br.created_by = u_created.id
      LEFT JOIN users u_customer ON br.customer_id = u_customer.id
      LEFT JOIN sales_item si ON br.original_sale_item_id = si.id
      LEFT JOIN customer_profiles cp ON u_customer.id = cp.user_id
      WHERE br.customer_id = $1
      ORDER BY br.replacement_date DESC, br.created_at DESC`,
      [customerId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching replacement history:', err);
    res.status(500).json({ error: 'Failed to fetch replacement history' });
  }
});

// Get warranty slabs
router.get('/warranty-slabs', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id,
        slab_name,
        discount_percentage,
        min_months,
        max_months,
        description,
        is_active
      FROM warranty_slabs
      WHERE is_active = true
      ORDER BY min_months ASC`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching warranty slabs:', err);
    res.status(500).json({ error: 'Failed to fetch warranty slabs' });
  }
});

// Create replacement (guarantee or warranty)
// Allow both Super Admin (role_id = 1) and Admin (role_id >= 2)
router.post('/replace', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      originalSerialNumber,
      saleItemId,
      newProductId,
      newSerialNumber,
      replacementType, // 'guarantee' or 'warranty'
      warrantySlabId,
      notes
    } = req.body;

    // Helpful logging for debugging
    console.log('[GuaranteeWarranty] Replacement payload:', {
      originalSerialNumber,
      newProductId,
      newSerialNumber,
      replacementType,
      warrantySlabId,
    });

    // Validation
    if (!saleItemId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Original sale item ID is required' });
    }

    if (!newProductId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Replacement product is required' });
    }

    if (!replacementType || !String(replacementType).trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Replacement type is required' });
    }

    if (!['guarantee', 'warranty'].includes(replacementType)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid replacement type' });
    }

    // Get original sale item (use saleItemId for reliable lookup)
    const originalSaleResult = await client.query(
      `SELECT 
        si.id,
        si.customer_id,
        si.purchase_date,
        si.SERIAL_NUMBER,
        si.invoice_number,
        si.product_id,
        si.customer_name,
        si.customer_mobile_number,
        si.WARRANTY as sales_item_warranty,
        p.guarantee_period_months,
        p.warranty as product_warranty,
        p.name as product_name
      FROM sales_item si
      JOIN products p ON si.product_id = p.id
      WHERE si.id = $1
      LIMIT 1`,
      [saleItemId]
    );

    if (originalSaleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Original battery not found' });
    }

    const originalSale = originalSaleResult.rows[0];

    // Always derive the original serial number from the DB, falling back to body if present
    const originalSerial = (originalSerialNumber || originalSale.serial_number || originalSale.SERIAL_NUMBER || '').trim();

    if (!originalSerial) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Original serial number could not be determined' });
    }

    // Parse warranty string to get guarantee months
    const warrantyString = originalSale.sales_item_warranty || originalSale.product_warranty || '';
    const warrantyInfo = parseWarrantyString(warrantyString);
    const guaranteeMonths = warrantyInfo.guaranteeMonths > 0 
      ? warrantyInfo.guaranteeMonths 
      : (originalSale.guarantee_period_months || 0);

    // Verify replacement type matches status
    const underGuarantee = isUnderGuarantee(originalSale.purchase_date, guaranteeMonths);
    
    if (replacementType === 'guarantee' && !underGuarantee) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Battery is not under guarantee period' });
    }

    if (replacementType === 'warranty' && underGuarantee) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Battery is still under guarantee, use guarantee replacement' });
    }

    // Get warranty slab for warranty replacements
    let warrantySlab = null;
    let discountPercentage = 0;

    if (replacementType === 'warranty') {
      if (!warrantySlabId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Warranty slab ID is required for warranty replacement' });
      }

      const slabResult = await client.query(
        `SELECT id, discount_percentage FROM warranty_slabs WHERE id = $1 AND is_active = true`,
        [warrantySlabId]
      );

      if (slabResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Warranty slab not found' });
      }

      warrantySlab = slabResult.rows[0];
      discountPercentage = parseFloat(warrantySlab.discount_percentage);
    }

    // Get new product details
    const newProductResult = await client.query(
      `SELECT 
        id,
        name,
        sku,
        mrp_price,
        selling_price,
        warranty,
        product_type_id
      FROM products
      WHERE id = $1`,
      [newProductId]
    );

    if (newProductResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'New product not found' });
    }

    const newProduct = newProductResult.rows[0];

    // Validate that requested newSerialNumber exists in stock for this product and is available
    const requestedSerial = (newSerialNumber || '').trim();

    if (!requestedSerial) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'New serial number is required for replacement' });
    }

    const stockCheckResult = await client.query(
      `SELECT serial_number
      FROM stock
      WHERE product_id = $1 
        AND status = 'available' 
        AND serial_number IS NOT NULL
        AND TRIM(serial_number) = $2
      LIMIT 1`,
      [newProductId, requestedSerial]
    );

    if (stockCheckResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Selected serial number is not available in stock for this product' });
    }

    let newSaleItemId = null;
    let newInvoiceNumber = null;

    // For warranty, create a new sale (treated as new purchase)
    if (replacementType === 'warranty') {
      // Generate invoice number
      const invoiceResult = await client.query('SELECT generate_invoice_number() as invoice_number');
      newInvoiceNumber = invoiceResult.rows[0].invoice_number;

      // Calculate price with discount
      const mrp = parseFloat(newProduct.mrp_price);
      const discountedPrice = mrp * (1 - discountPercentage / 100);
      const gstAmount = (discountedPrice * 0.18) / 1.18;
      const finalAmount = discountedPrice;

      // Get sales type from original sale
      const salesTypeResult = await client.query(
        `SELECT sales_type, sales_type_id FROM sales_item WHERE id = $1 LIMIT 1`,
        [originalSale.id]
      );
      const salesType = salesTypeResult.rows.length > 0 ? salesTypeResult.rows[0].sales_type : 'retail';
      const salesTypeId = salesTypeResult.rows.length > 0 ? salesTypeResult.rows[0].sales_type_id : 1;

      // Create sales_item entry
      const insertSaleResult = await client.query(
        `INSERT INTO sales_item (
          customer_id, invoice_number, customer_name, customer_mobile_number,
          sales_type, sales_type_id, created_by, purchase_date,
          SKU, CATEGORY, NAME, QUANTITY, WARRANTY, SERIAL_NUMBER,
          MRP, discount_amount, tax, final_amount, payment_method, payment_status, product_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING id`,
        [
          originalSale.customer_id,
          newInvoiceNumber,
          originalSale.customer_name,
          originalSale.customer_mobile_number,
          salesType,
          salesTypeId,
          req.user.id,
          new Date(),
          newProduct.sku,
          getCategoryFromTypeId(newProduct.product_type_id),
          newProduct.name,
          1,
          newProduct.warranty,
          requestedSerial,
          mrp,
          mrp - discountedPrice, // discount_amount
          gstAmount,
          finalAmount,
          'cash',
          'paid',
          newProductId
        ]
      );

      newSaleItemId = insertSaleResult.rows[0].id;

      // Remove from stock
      await client.query(
        `DELETE FROM stock 
        WHERE product_id = $1 AND TRIM(serial_number) = $2 AND status = 'available'`,
        [newProductId, requestedSerial]
      );

      // Update product quantity
      await client.query(
        `UPDATE products SET qty = qty - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [newProductId]
      );
    } else {
      // For guarantee, just get a new serial number from stock (free replacement)
      // Remove from stock
      await client.query(
        `DELETE FROM stock 
        WHERE product_id = $1 AND TRIM(serial_number) = $2 AND status = 'available'`,
        [newProductId, requestedSerial]
      );

      // Update product quantity
      await client.query(
        `UPDATE products SET qty = qty - 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [newProductId]
      );
    }

    // Create replacement record
    const replacementResult = await client.query(
      `INSERT INTO battery_replacements (
        customer_id,
        original_sale_item_id,
        original_serial_number,
        original_purchase_date,
        original_invoice_number,
        replacement_type,
        replacement_date,
        new_serial_number,
        new_sale_item_id,
        new_invoice_number,
        warranty_slab_id,
        discount_percentage,
        product_id,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        originalSale.customer_id,
        originalSale.id,
        originalSerial,
        originalSale.purchase_date,
        originalSale.invoice_number,
        replacementType,
        new Date(),
        requestedSerial,
        newSaleItemId,
        newInvoiceNumber,
        warrantySlab ? warrantySlab.id : null,
        discountPercentage,
        newProductId,
        notes || null,
        req.user.id
      ]
    );

    await client.query('COMMIT');

    // Create notification for customer
    try {
      if (originalSale.customer_id) {
        const replacement = replacementResult.rows[0];
        const message = replacementType === 'guarantee'
          ? `Your battery (Serial: ${originalSerial}) has been replaced under guarantee (free of charge). New Serial: ${requestedSerial}`
          : `Your battery (Serial: ${originalSerial}) has been replaced under warranty with ${discountPercentage}% discount. New Serial: ${requestedSerial}`;
        
        await createNotification(
          originalSale.customer_id,
          `Battery Replacement - ${replacementType === 'guarantee' ? 'Guarantee' : 'Warranty'}`,
          message,
          'success',
          null
        );
      }
    } catch (notifErr) {
      console.warn('Failed to create customer notification for replacement:', notifErr);
      // Don't fail the replacement if notification fails
    }

    res.status(201).json({
      success: true,
      replacement: replacementResult.rows[0],
      message: replacementType === 'guarantee' 
        ? 'Battery replaced under guarantee (free of charge)'
        : `Battery replaced under warranty with ${discountPercentage}% discount`
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating replacement:', err);
    res.status(500).json({ 
      // Send the real error message so we can see exactly what's wrong
      error: err.message || 'Failed to create replacement'
    });
  } finally {
    client.release();
  }
});

// Check for expiring guarantees and create notifications for admins
// This should be called periodically (e.g., daily via cron job or scheduled task)
router.post('/check-expiring-guarantees', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { daysAhead = 7 } = req.body; // Default to 7 days ahead
    
    // Get all sales items with active guarantees
    const salesItemsResult = await db.query(
      `SELECT 
        si.id,
        si.customer_id,
        si.customer_name,
        si.customer_mobile_number,
        si.SERIAL_NUMBER,
        si.invoice_number,
        si.purchase_date,
        si.WARRANTY as sales_item_warranty,
        p.name as product_name,
        p.warranty as product_warranty,
        p.guarantee_period_months
      FROM sales_item si
      JOIN products p ON si.product_id = p.id
      WHERE si.purchase_date IS NOT NULL
      ORDER BY si.purchase_date DESC`
    );

    const now = new Date();
    const expiringItems = [];
    const notifiedSerialNumbers = new Set(); // Track to avoid duplicate notifications

    for (const item of salesItemsResult.rows) {
      // Parse warranty string to get guarantee months
      const warrantyString = item.sales_item_warranty || item.product_warranty || '';
      const warrantyInfo = parseWarrantyString(warrantyString);
      const guaranteeMonths = warrantyInfo.guaranteeMonths > 0 
        ? warrantyInfo.guaranteeMonths 
        : (item.guarantee_period_months || 0);

      if (guaranteeMonths === 0) continue; // Skip if no guarantee period

      const purchaseDate = new Date(item.purchase_date);
      const guaranteeEndDate = new Date(purchaseDate);
      guaranteeEndDate.setMonth(guaranteeEndDate.getMonth() + guaranteeMonths);

      // Calculate days until expiration
      const daysUntilExpiration = Math.ceil((guaranteeEndDate - now) / (1000 * 60 * 60 * 24));

      // Check if guarantee is expiring within the specified days and hasn't expired yet
      if (daysUntilExpiration >= 0 && daysUntilExpiration <= daysAhead) {
        // Check if this serial number was already replaced (no need to notify for replaced batteries)
        const replacementCheck = await db.query(
          `SELECT id FROM battery_replacements 
           WHERE original_serial_number = $1 
           LIMIT 1`,
          [item.SERIAL_NUMBER]
        );

        if (replacementCheck.rows.length === 0 && !notifiedSerialNumbers.has(item.SERIAL_NUMBER)) {
          expiringItems.push({
            ...item,
            daysUntilExpiration,
            guaranteeEndDate
          });
          notifiedSerialNumbers.add(item.SERIAL_NUMBER);
        }
      }
    }

    // Get admin and super admin user IDs
    const adminUsers = await db.query(
      `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true`
    );
    const adminUserIds = adminUsers.rows.map(u => u.id);

    let notificationsCreated = 0;

    // Create notifications for expiring guarantees
    for (const item of expiringItems) {
      const daysText = item.daysUntilExpiration === 0 
        ? 'today' 
        : item.daysUntilExpiration === 1 
        ? 'in 1 day' 
        : `in ${item.daysUntilExpiration} days`;
      
      const expirationDateStr = item.guaranteeEndDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });

      if (adminUserIds.length > 0) {
        await createNotification(
          adminUserIds,
          `Guarantee Expiring Soon`,
          `Customer ${item.customer_name} (${item.customer_mobile_number}) - Battery ${item.SERIAL_NUMBER} (${item.product_name}) guarantee expires ${daysText} (${expirationDateStr}). Invoice: ${item.invoice_number}`,
          'warning',
          null
        );
        notificationsCreated++;
      }
    }

    res.json({
      success: true,
      checked: salesItemsResult.rows.length,
      expiring: expiringItems.length,
      notificationsCreated: notificationsCreated * adminUserIds.length,
      items: expiringItems.map(item => ({
        serialNumber: item.SERIAL_NUMBER,
        customerName: item.customer_name,
        customerPhone: item.customer_mobile_number,
        productName: item.product_name,
        invoiceNumber: item.invoice_number,
        daysUntilExpiration: item.daysUntilExpiration,
        guaranteeEndDate: item.guaranteeEndDate
      }))
    });
  } catch (err) {
    console.error('Error checking expiring guarantees:', err);
    res.status(500).json({ error: 'Failed to check expiring guarantees' });
  }
});

module.exports = router;

