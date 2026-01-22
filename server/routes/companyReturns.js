const express = require('express');
const db = require('../db');
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

// Helper function to generate purchase number
async function generatePurchaseNumber(purchaseDate) {
  const dateObj = purchaseDate ? new Date(purchaseDate) : new Date();
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const result = await db.query(
      `SELECT purchase_number FROM purchases 
       WHERE purchase_number LIKE $1 
       ORDER BY purchase_number DESC 
       LIMIT 1`,
      [`PO-${dateStr}-%`]
    );

    if (result.rows.length === 0) {
      return `PO-${dateStr}-0001`;
    }

    const lastNumber = result.rows[0].purchase_number.split('-')[2];
    const nextNumber = String(parseInt(lastNumber, 10) + 1).padStart(4, '0');
    return `PO-${dateStr}-${nextNumber}`;
  } catch (err) {
    const fallback = Date.now().toString().slice(-4);
    return `PO-${dateStr}-${fallback}`;
  }
}

// Helper function to get average purchase price for a SKU
async function getAveragePurchasePrice(productSku) {
  try {
    const result = await db.query(
      `SELECT AVG(amount) as avg_amount 
       FROM purchases 
       WHERE product_sku = $1 
       AND amount > 0
       AND supplier_name != 'replace'`,
      [productSku]
    );

    if (result.rows.length > 0 && result.rows[0].avg_amount) {
      return parseFloat(result.rows[0].avg_amount || 0);
    }

    return 0;
  } catch (err) {
    console.error('Error getting average purchase price:', err);
    return 0;
  }
}

// Get all sold serial numbers with customer and product details (for dropdown)
router.get('/sold-serial-numbers', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { search } = req.query;
    
    let query = `
      SELECT DISTINCT
        si.SERIAL_NUMBER as serial_number,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_vehicle_number,
        si.product_id,
        si.purchase_date,
        si.invoice_number,
        p.name as product_name,
        p.sku as product_sku
      FROM sales_item si
      JOIN products p ON si.product_id = p.id
      WHERE si.SERIAL_NUMBER IS NOT NULL 
        AND TRIM(si.SERIAL_NUMBER) != ''
    `;
    
    const params = [];
    if (search && search.trim()) {
      query += ` AND (
        si.SERIAL_NUMBER ILIKE $1 OR
        si.customer_name ILIKE $1 OR
        si.customer_mobile_number ILIKE $1 OR
        si.customer_vehicle_number ILIKE $1 OR
        p.name ILIKE $1 OR
        p.sku ILIKE $1
      )`;
      params.push(`%${search.trim()}%`);
    }
    
    query += ` ORDER BY si.purchase_date DESC, serial_number ASC LIMIT 1000`;
    
    const { rows } = await db.query(query, params);
    
    res.json(rows);
  } catch (err) {
    console.error('Error fetching sold serial numbers:', err);
    res.status(500).json({ error: 'Failed to fetch sold serial numbers', details: err.message });
  }
});

// Get sale details by serial number (for auto-fill)
router.get('/sale-by-serial/:serialNumber', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { serialNumber } = req.params;
    
    if (!serialNumber || !serialNumber.trim()) {
      return res.status(400).json({ error: 'Serial number is required' });
    }
    
    const result = await db.query(
      `SELECT 
        si.SERIAL_NUMBER as serial_number,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_vehicle_number,
        si.product_id,
        si.purchase_date,
        si.invoice_number,
        p.name as product_name,
        p.sku as product_sku
      FROM sales_item si
      JOIN products p ON si.product_id = p.id
      WHERE TRIM(si.SERIAL_NUMBER) = $1
      ORDER BY si.purchase_date DESC
      LIMIT 1`,
      [serialNumber.trim()]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Serial number not found in sales records' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching sale by serial number:', err);
    res.status(500).json({ error: 'Failed to fetch sale details', details: err.message });
  }
});

// Get all company returns with filtering, search, sorting
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { 
      status, 
      search,
      dateFrom, 
      dateTo, 
      sortBy = 'returned_date',
      sortOrder = 'desc'
    } = req.query;

    let query = `
      SELECT 
        cr.id,
        cr.returned_serial_number,
        cr.returned_product_id,
        cr.returned_date,
        cr.received_serial_number,
        cr.received_product_id,
        cr.received_date,
        cr.status,
        cr.customer_name,
        cr.customer_vehicle_number,
        cr.customer_mobile_number,
        cr.reason,
        cr.notes,
        cr.created_at,
        cr.updated_at,
        p_returned.name as returned_product_name,
        p_returned.sku as returned_product_sku,
        p_received.name as received_product_name,
        p_received.sku as received_product_sku,
        u.full_name as created_by_name
      FROM company_returns cr
      LEFT JOIN products p_returned ON cr.returned_product_id = p_returned.id
      LEFT JOIN products p_received ON cr.received_product_id = p_received.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (status && status !== 'all') {
      paramCount++;
      query += ` AND cr.status = $${paramCount}`;
      params.push(status);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND cr.returned_date >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND cr.returned_date <= $${paramCount}`;
      params.push(dateTo);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        cr.returned_serial_number ILIKE $${paramCount} OR
        cr.received_serial_number ILIKE $${paramCount} OR
        cr.customer_name ILIKE $${paramCount} OR
        cr.customer_vehicle_number ILIKE $${paramCount} OR
        cr.customer_mobile_number ILIKE $${paramCount} OR
        p_returned.name ILIKE $${paramCount} OR
        p_returned.sku ILIKE $${paramCount} OR
        p_received.name ILIKE $${paramCount} OR
        p_received.sku ILIKE $${paramCount} OR
        cr.reason ILIKE $${paramCount} OR
        cr.notes ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    // Validate sortBy and sortOrder
    const allowedSortFields = ['returned_date', 'received_date', 'status', 'returned_serial_number', 'received_serial_number', 'created_at'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'returned_date';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY cr.${validSortBy} ${validSortOrder}`;

    const { rows } = await db.query(query, params);

    res.json(rows);
  } catch (err) {
    console.error('Error fetching company returns:', err);
    res.status(500).json({ error: 'Failed to fetch company returns', details: err.message });
  }
});

// Get a single company return by ID
router.get('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        cr.*,
        p_returned.name as returned_product_name,
        p_returned.sku as returned_product_sku,
        p_received.name as received_product_name,
        p_received.sku as received_product_sku,
        u.full_name as created_by_name
      FROM company_returns cr
      LEFT JOIN products p_returned ON cr.returned_product_id = p_returned.id
      LEFT JOIN products p_received ON cr.received_product_id = p_received.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company return not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching company return:', err);
    res.status(500).json({ error: 'Failed to fetch company return', details: err.message });
  }
});

// Create a new company return
router.post('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      returnedSerialNumber,
      returnedProductId,
      returnedDate,
      receivedSerialNumber,
      receivedProductId,
      receivedDate,
      addToStock,
      customerName,
      customerVehicleNumber,
      customerMobileNumber,
      reason,
      notes,
      status
    } = req.body;

    // Log received data for debugging
    console.log('Received company return data:', {
      returnedSerialNumber,
      returnedProductId,
      returnedDate,
      customerName,
      customerVehicleNumber,
      customerMobileNumber,
      hasUser: !!req.user,
      userId: req.user?.id
    });

    // Validation
    if (!returnedProductId) {
      await client.query('ROLLBACK');
      console.error('Validation failed: returnedProductId is missing');
      return res.status(400).json({ error: 'Returned product ID is required' });
    }

    // Convert returnedProductId to integer if it's a string
    const productId = parseInt(returnedProductId, 10);
    if (isNaN(productId)) {
      await client.query('ROLLBACK');
      console.error('Validation failed: returnedProductId is not a valid number:', returnedProductId);
      return res.status(400).json({ error: 'Returned product ID must be a valid number' });
    }

    // Verify the product exists
    const productCheck = await client.query(
      'SELECT id, name, sku FROM products WHERE id = $1',
      [productId]
    );

    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productCheck.rows[0];

    // Determine initial status - if received serial is provided, status should be 'received' or 'completed'
    let initialStatus = status || 'pending';
    if (receivedSerialNumber && receivedSerialNumber.trim()) {
      initialStatus = status || 'received';
    }

    // Create the return record
    // Note: quantity defaults to 1 for company returns (typically one battery per return)
    const result = await client.query(
      `INSERT INTO company_returns (
        returned_serial_number,
        returned_product_id,
        returned_date,
        received_serial_number,
        received_product_id,
        received_date,
        status,
        customer_name,
        customer_vehicle_number,
        customer_mobile_number,
        reason,
        notes,
        created_by,
        quantity,
        sku,
        product_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        returnedSerialNumber ? returnedSerialNumber.trim() : null,
        productId,
        returnedDate || new Date(),
        receivedSerialNumber ? receivedSerialNumber.trim() : null,
        receivedProductId ? parseInt(receivedProductId, 10) : null,
        receivedDate || null,
        initialStatus,
        customerName ? customerName.trim() : null,
        customerVehicleNumber ? customerVehicleNumber.trim() : null,
        customerMobileNumber ? customerMobileNumber.trim() : null,
        reason ? reason.trim() : null,
        notes ? notes.trim() : null,
        req.user?.id || null,
        1, // quantity - default to 1 for company returns
        product.sku || null, // SKU from product
        product.name || null // Product name from product
      ]
    );

    // If received battery is provided, handle based on addToStock flag
    if (receivedSerialNumber && receivedSerialNumber.trim() && receivedProductId) {
      if (addToStock === true) {
        // Add to stock
        // First, fetch the product details to get required fields for stock table
        const productDetails = await client.query(
          'SELECT id, sku, name, product_type_id, series, category, ah_va, warranty FROM products WHERE id = $1',
          [receivedProductId]
        );

        if (productDetails.rows.length === 0) {
          console.error('Product not found for receivedProductId:', receivedProductId);
          throw new Error('Product not found for received battery');
        }

        const product = productDetails.rows[0];

        // Check if serial already exists in stock
        const existingStock = await client.query(
          'SELECT id FROM stock WHERE TRIM(serial_number) = $1',
          [receivedSerialNumber.trim()]
        );

        if (existingStock.rows.length === 0) {
          // Add to stock with all required fields
          await client.query(
            `INSERT INTO stock (
              purchase_date, sku, series, category, name, ah_va, quantity,
              purchased_from, warranty, product_type_id, product_id, serial_number, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available')
            ON CONFLICT DO NOTHING`,
            [
              receivedDate || new Date(),
              product.sku,
              product.series || null,
              product.category || null,
              product.name,
              product.ah_va || null,
              1, // Always 1 per row
              'Exide Company Return',
              product.warranty || null,
              product.product_type_id,
              product.id,
              receivedSerialNumber.trim()
            ]
          );

          // Update product quantity
          await client.query(
            'UPDATE products SET qty = qty + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [product.id]
          );

          // Add purchase record for replacement battery
          try {
            const purchaseDate = receivedDate || new Date();
            const purchaseDateStr = purchaseDate instanceof Date 
              ? purchaseDate.toISOString().split('T')[0] 
              : new Date(purchaseDate).toISOString().split('T')[0];
            
            const purchaseNumber = await generatePurchaseNumber(purchaseDateStr);
            const productTypeId = product.product_type_id;
            
            // Get average purchase price for this SKU
            const avgPurchasePrice = await getAveragePurchasePrice(product.sku);
            
            // Insert into purchases table
            await client.query(
              `INSERT INTO purchases (
                product_type_id, purchase_date, purchase_number, product_series,
                product_sku, serial_number, supplier_name, purchase_value
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (product_sku, serial_number) DO UPDATE SET
                purchase_date = EXCLUDED.purchase_date,
                purchase_number = EXCLUDED.purchase_number,
                supplier_name = EXCLUDED.supplier_name,
                purchase_value = EXCLUDED.purchase_value,
                updated_at = CURRENT_TIMESTAMP`,
              [
                productTypeId,
                purchaseDateStr,
                purchaseNumber,
                product.series || null,
                product.sku,
                receivedSerialNumber.trim(),
                'replace',
                avgPurchasePrice
              ]
            );
            console.log(`[COMPANY RETURNS CREATE] Added purchase record for replacement battery: ${receivedSerialNumber.trim()}, Price: ${avgPurchasePrice}`);
          } catch (purchaseErr) {
            console.error('[COMPANY RETURNS CREATE] Error adding purchase record:', purchaseErr);
            // Don't fail the transaction if purchase record fails, but log it
          }
        }
      } else {
        // addToStock is false - create warranty/replacement record for customer
        // Find the original sale_item by returned_serial_number to get customer details
        if (returnedSerialNumber && returnedSerialNumber.trim()) {
          const originalSaleResult = await client.query(
            `SELECT 
              id,
              customer_id,
              purchase_date,
              invoice_number,
              product_id
            FROM sales_item 
            WHERE TRIM(SERIAL_NUMBER) = $1
            ORDER BY purchase_date DESC
            LIMIT 1`,
            [returnedSerialNumber.trim()]
          );

          if (originalSaleResult.rows.length > 0) {
            const originalSale = originalSaleResult.rows[0];
            
            // Create battery replacement record
            await client.query(
              `INSERT INTO battery_replacements (
                customer_id,
                original_sale_item_id,
                original_serial_number,
                original_purchase_date,
                original_invoice_number,
                replacement_type,
                replacement_date,
                new_serial_number,
                product_id,
                notes,
                created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                originalSale.customer_id,
                originalSale.id,
                returnedSerialNumber.trim(),
                originalSale.purchase_date,
                originalSale.invoice_number || null,
                'guarantee', // Free replacement from Exide company
                receivedDate || new Date(),
                receivedSerialNumber.trim(),
                receivedProductId,
                reason ? `Company Return: ${reason}` : 'Battery replaced via Exide company return',
                req.user?.id || null
              ]
            );

            console.log('✅ Created battery replacement record for customer:', originalSale.customer_id);
          } else {
            console.warn('⚠️ Original sale not found for serial number:', returnedSerialNumber);
            // Still create replacement record but without customer_id if we can find customer by mobile/name
            if (customerMobileNumber || customerName) {
              // Try to find customer by mobile number
              let customerId = null;
              if (customerMobileNumber) {
                const customerResult = await client.query(
                  `SELECT id FROM users WHERE phone = $1 AND role_id >= 3 LIMIT 1`,
                  [customerMobileNumber.trim()]
                );
                if (customerResult.rows.length > 0) {
                  customerId = customerResult.rows[0].id;
                }
              }

              // Create replacement record with available information
              await client.query(
                `INSERT INTO battery_replacements (
                  customer_id,
                  original_serial_number,
                  original_purchase_date,
                  replacement_type,
                  replacement_date,
                  new_serial_number,
                  product_id,
                  notes,
                  created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  customerId,
                  returnedSerialNumber.trim(),
                  returnedDate || new Date(), // Use returned date as original purchase date estimate
                  'guarantee',
                  receivedDate || new Date(),
                  receivedSerialNumber.trim(),
                  receivedProductId,
                  reason ? `Company Return: ${reason}. Customer: ${customerName || 'N/A'}, Mobile: ${customerMobileNumber || 'N/A'}` : `Battery replaced via Exide company return. Customer: ${customerName || 'N/A'}, Mobile: ${customerMobileNumber || 'N/A'}`,
                  req.user?.id || null
                ]
              );

              console.log('✅ Created battery replacement record (without original sale):', customerId);
            }
          }
        } else {
          console.warn('⚠️ No returned serial number provided, cannot create warranty record');
        }
      }
    }

    await client.query('COMMIT');

    // Fetch the complete record with product details
    const completeResult = await client.query(
      `SELECT 
        cr.*,
        p_returned.name as returned_product_name,
        p_returned.sku as returned_product_sku,
        u.full_name as created_by_name
      FROM company_returns cr
      LEFT JOIN products p_returned ON cr.returned_product_id = p_returned.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(completeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(rollbackErr => {
      console.error('Error during rollback:', rollbackErr);
    });
    console.error('Error creating company return:', err);
    console.error('Error stack:', err.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      error: 'Failed to create company return', 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  } finally {
    client.release();
  }
});

// Update a company return (mark as returned, add received battery, etc.)
router.put('/:id', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const {
      status,
      receivedSerialNumber,
      receivedProductId,
      receivedDate,
      addToStock,
      customerName,
      customerVehicleNumber,
      customerMobileNumber,
      reason,
      notes
    } = req.body;

    // Convert receivedProductId to integer if provided (to avoid PostgreSQL type inference issues)
    // Handle empty strings, null, undefined, and string numbers
    let receivedProductIdInt = null;
    if (receivedProductId !== undefined && receivedProductId !== null && receivedProductId !== '') {
      if (typeof receivedProductId === 'string') {
        const parsed = parseInt(receivedProductId.trim(), 10);
        receivedProductIdInt = isNaN(parsed) ? null : parsed;
      } else if (typeof receivedProductId === 'number') {
        receivedProductIdInt = isNaN(receivedProductId) ? null : receivedProductId;
      } else {
        receivedProductIdInt = null;
      }
    }

    // Debug logging
    console.log('Update company return - received data:', {
      id,
      receivedProductId,
      receivedProductIdInt,
      receivedProductIdType: typeof receivedProductId,
      receivedSerialNumber,
      receivedDate,
      status
    });

    // Get the current record
    const currentResult = await client.query(
      'SELECT * FROM company_returns WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Company return not found' });
    }

    const current = currentResult.rows[0];

    // Build update query dynamically
    const updates = [];
    const params = [];
    let paramCount = 0;

    if (status !== undefined) {
      paramCount++;
      updates.push(`status = $${paramCount}`);
      params.push(status);
    }

    if (receivedSerialNumber !== undefined) {
      paramCount++;
      updates.push(`received_serial_number = $${paramCount}`);
      params.push(receivedSerialNumber.trim() || null);
    }

    // Handle receivedProductId - include in update if it's explicitly provided (even if empty/null)
    // This allows clearing the received_product_id by sending empty string or null
    if (receivedProductId !== undefined) {
      paramCount++;
      // Explicit type cast to help PostgreSQL infer the type even when value is null
      // Using CAST syntax for better compatibility
      updates.push(`received_product_id = CAST($${paramCount} AS INTEGER)`);
      // Use the converted integer value (will be null if invalid/empty/undefined)
      params.push(receivedProductIdInt);
    }

    if (receivedDate !== undefined) {
      paramCount++;
      updates.push(`received_date = $${paramCount}`);
      params.push(receivedDate || null);
    }

    if (reason !== undefined) {
      paramCount++;
      updates.push(`reason = $${paramCount}`);
      params.push(reason || null);
    }

    if (customerName !== undefined) {
      paramCount++;
      updates.push(`customer_name = $${paramCount}`);
      params.push(customerName || null);
    }

    if (customerVehicleNumber !== undefined) {
      paramCount++;
      updates.push(`customer_vehicle_number = $${paramCount}`);
      params.push(customerVehicleNumber || null);
    }

    if (customerMobileNumber !== undefined) {
      paramCount++;
      updates.push(`customer_mobile_number = $${paramCount}`);
      params.push(customerMobileNumber || null);
    }

    if (notes !== undefined) {
      paramCount++;
      updates.push(`notes = $${paramCount}`);
      params.push(notes || null);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Always update updated_at (doesn't need a parameter, so don't increment paramCount)
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Add id parameter for WHERE clause
    paramCount++;
    params.push(id);

    const updateQuery = `
      UPDATE company_returns 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    // Debug: Log the query and parameters
    console.log('Update query:', updateQuery);
    console.log('Update params:', params.map((p, i) => `$${i + 1} = ${p} (${typeof p})`));

    const result = await client.query(updateQuery, params);

    // If received battery is added, handle based on addToStock flag
    if (receivedSerialNumber && receivedProductIdInt && receivedSerialNumber.trim()) {
      if (addToStock === true) {
        // Add to stock
        // Fetch the product details to get required fields for stock table
        const receivedProductCheck = await client.query(
          'SELECT id, sku, name, product_type_id, series, category, ah_va, warranty FROM products WHERE id = $1',
          [receivedProductIdInt]
        );

        if (receivedProductCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Received product not found' });
        }

        const product = receivedProductCheck.rows[0];

        // Check if serial already exists in stock
        const existingStock = await client.query(
          'SELECT id FROM stock WHERE TRIM(serial_number) = $1',
          [receivedSerialNumber.trim()]
        );

        if (existingStock.rows.length === 0) {
          // Add to stock with all required fields
          await client.query(
            `INSERT INTO stock (
              purchase_date, sku, series, category, name, ah_va, quantity,
              purchased_from, warranty, product_type_id, product_id, serial_number, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available')
            ON CONFLICT DO NOTHING`,
            [
              receivedDate || new Date(),
              product.sku,
              product.series || null,
              product.category || null,
              product.name,
              product.ah_va || null,
              1, // Always 1 per row
              'Exide Company Return',
              product.warranty || null,
              product.product_type_id,
              product.id,
              receivedSerialNumber.trim()
            ]
          );

          // Update product quantity
          await client.query(
            'UPDATE products SET qty = qty + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [receivedProductIdInt]
          );

          // Add purchase record for replacement battery
          try {
            const purchaseDate = receivedDate || new Date();
            const purchaseDateStr = purchaseDate instanceof Date 
              ? purchaseDate.toISOString().split('T')[0] 
              : new Date(purchaseDate).toISOString().split('T')[0];
            
            const purchaseNumber = await generatePurchaseNumber(purchaseDateStr);
            const productTypeId = product.product_type_id;
            
            // Get average purchase price for this SKU
            const avgPurchasePrice = await getAveragePurchasePrice(product.sku);
            
            // Insert into purchases table
            await client.query(
              `INSERT INTO purchases (
                product_type_id, purchase_date, purchase_number, product_series,
                product_sku, serial_number, supplier_name, purchase_value
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (product_sku, serial_number) DO UPDATE SET
                purchase_date = EXCLUDED.purchase_date,
                purchase_number = EXCLUDED.purchase_number,
                supplier_name = EXCLUDED.supplier_name,
                purchase_value = EXCLUDED.purchase_value,
                updated_at = CURRENT_TIMESTAMP`,
              [
                productTypeId,
                purchaseDateStr,
                purchaseNumber,
                product.series || null,
                product.sku,
                receivedSerialNumber.trim(),
                'replace',
                avgPurchasePrice
              ]
            );
            console.log(`[COMPANY RETURNS UPDATE] Added purchase record for replacement battery: ${receivedSerialNumber.trim()}, Price: ${avgPurchasePrice}`);
          } catch (purchaseErr) {
            console.error('[COMPANY RETURNS UPDATE] Error adding purchase record:', purchaseErr);
            // Don't fail the transaction if purchase record fails, but log it
          }
        }
      } else {
        // addToStock is false - create warranty/replacement record for customer
        // Get returned_serial_number from current record
        const returnedSerialNumber = current.returned_serial_number;
        const customerName = current.customer_name;
        const customerMobileNumber = current.customer_mobile_number;
        const reason = current.reason;

        // Find the original sale_item by returned_serial_number to get customer details
        if (returnedSerialNumber && returnedSerialNumber.trim()) {
          const originalSaleResult = await client.query(
            `SELECT 
              id,
              customer_id,
              purchase_date,
              invoice_number,
              product_id
            FROM sales_item 
            WHERE TRIM(SERIAL_NUMBER) = $1
            ORDER BY purchase_date DESC
            LIMIT 1`,
            [returnedSerialNumber.trim()]
          );

          if (originalSaleResult.rows.length > 0) {
            const originalSale = originalSaleResult.rows[0];
            
            // Check if replacement record already exists
            const existingReplacement = await client.query(
              `SELECT id FROM battery_replacements 
              WHERE original_serial_number = $1 AND new_serial_number = $2
              LIMIT 1`,
              [returnedSerialNumber.trim(), receivedSerialNumber.trim()]
            );

            if (existingReplacement.rows.length === 0) {
              // Create battery replacement record
              await client.query(
                `INSERT INTO battery_replacements (
                  customer_id,
                  original_sale_item_id,
                  original_serial_number,
                  original_purchase_date,
                  original_invoice_number,
                  replacement_type,
                  replacement_date,
                  new_serial_number,
                  product_id,
                  notes,
                  created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                  originalSale.customer_id,
                  originalSale.id,
                  returnedSerialNumber.trim(),
                  originalSale.purchase_date,
                  originalSale.invoice_number || null,
                  'guarantee', // Free replacement from Exide company
                  receivedDate || new Date(),
                  receivedSerialNumber.trim(),
                  receivedProductIdInt,
                  reason ? `Company Return: ${reason}` : 'Battery replaced via Exide company return',
                  req.user?.id || null
                ]
              );

              console.log('✅ Created battery replacement record for customer:', originalSale.customer_id);
            }
          } else {
            console.warn('⚠️ Original sale not found for serial number:', returnedSerialNumber);
            // Try to find customer by mobile number and create replacement record
            if (customerMobileNumber || customerName) {
              let customerId = null;
              if (customerMobileNumber) {
                const customerResult = await client.query(
                  `SELECT id FROM users WHERE phone = $1 AND role_id >= 3 LIMIT 1`,
                  [customerMobileNumber.trim()]
                );
                if (customerResult.rows.length > 0) {
                  customerId = customerResult.rows[0].id;
                }
              }

              // Check if replacement record already exists
              const existingReplacement = await client.query(
                `SELECT id FROM battery_replacements 
                WHERE original_serial_number = $1 AND new_serial_number = $2
                LIMIT 1`,
                [returnedSerialNumber.trim(), receivedSerialNumber.trim()]
              );

              if (existingReplacement.rows.length === 0) {
                // Create replacement record with available information
                await client.query(
                  `INSERT INTO battery_replacements (
                    customer_id,
                    original_serial_number,
                    original_purchase_date,
                    replacement_type,
                    replacement_date,
                    new_serial_number,
                    product_id,
                    notes,
                    created_by
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                  [
                    customerId,
                    returnedSerialNumber.trim(),
                    current.returned_date || new Date(),
                    'guarantee',
                    receivedDate || new Date(),
                    receivedSerialNumber.trim(),
                    receivedProductIdInt,
                    reason ? `Company Return: ${reason}. Customer: ${customerName || 'N/A'}, Mobile: ${customerMobileNumber || 'N/A'}` : `Battery replaced via Exide company return. Customer: ${customerName || 'N/A'}, Mobile: ${customerMobileNumber || 'N/A'}`,
                    req.user?.id || null
                  ]
                );

                console.log('✅ Created battery replacement record (without original sale):', customerId);
              }
            }
          }
        } else {
          console.warn('⚠️ No returned serial number in record, cannot create warranty record');
        }
      }
    }

    await client.query('COMMIT');

    // Fetch the complete record with product details
    const completeResult = await client.query(
      `SELECT 
        cr.*,
        p_returned.name as returned_product_name,
        p_returned.sku as returned_product_sku,
        p_received.name as received_product_name,
        p_received.sku as received_product_sku,
        u.full_name as created_by_name
      FROM company_returns cr
      LEFT JOIN products p_returned ON cr.returned_product_id = p_returned.id
      LEFT JOIN products p_received ON cr.received_product_id = p_received.id
      LEFT JOIN users u ON cr.created_by = u.id
      WHERE cr.id = $1`,
      [id]
    );

    res.json(completeResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating company return:', err);
    res.status(500).json({ error: 'Failed to update company return', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

