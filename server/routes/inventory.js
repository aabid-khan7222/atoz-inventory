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

// Helper: generate invoice number for admin/super-admin sales
async function generateInvoiceNumber() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  try {
    const result = await db.query(
      `SELECT invoice_number FROM sales 
       WHERE invoice_number LIKE $1 
       ORDER BY invoice_number DESC 
       LIMIT 1`,
      [`INV-${dateStr}-%`]
    );

    if (result.rows.length === 0) {
      return `INV-${dateStr}-0001`;
    }

    const lastNumber = result.rows[0].invoice_number.split('-')[2];
    const nextNumber = String(parseInt(lastNumber, 10) + 1).padStart(4, '0');
    return `INV-${dateStr}-${nextNumber}`;
  } catch (err) {
    // Fallback if query fails
    const timestamp = Date.now();
    return `INV-${dateStr}-${timestamp.toString().slice(-4)}`;
  }
}
// Helper: ensure purchases tables exist (idempotent, safe on startup)
async function ensurePurchaseSchema() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id SERIAL PRIMARY KEY,
        purchase_number VARCHAR(50) UNIQUE NOT NULL,
        supplier_name VARCHAR(255),
        supplier_contact VARCHAR(100),
        total_amount NUMERIC(12,2) DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'paid',
        purchase_date DATE NOT NULL,
        delivery_date DATE,
        receiving_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id SERIAL PRIMARY KEY,
        purchase_id INTEGER REFERENCES purchases(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
        product_type_id INTEGER,
        sku VARCHAR(100),
        name VARCHAR(255),
        serial_number VARCHAR(255),
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_cost NUMERIC(12,2),
        total_cost NUMERIC(12,2),
        purchase_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);


    // Link stock rows back to purchase if the column is missing
    await db.query(`
      ALTER TABLE stock
      ADD COLUMN IF NOT EXISTS purchase_id INTEGER REFERENCES purchases(id);
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_stock_purchase_id ON stock(purchase_id);`);
  } catch (schemaErr) {
    console.warn('Could not ensure purchase schema:', schemaErr.message);
  }
}

// Helper: purchase number generator (PO-YYYYMMDD-XXXX)
async function generatePurchaseNumber(purchaseDate) {
  const dateObj = purchaseDate ? new Date(purchaseDate) : new Date();
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  try {
    // Check new purchases table for purchase numbers
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
    // If table doesn't exist yet or error, use timestamp fallback
    const fallback = Date.now().toString().slice(-4);
    return `PO-${dateStr}-${fallback}`;
  }
}

// Helper: persist purchase header + items + link stock rows (best effort)
async function recordPurchase({ purchaseDate, purchasedFrom, product, serialNumbers }) {
  try {
    await ensurePurchaseSchema();

    const purchase_number = await generatePurchaseNumber(purchaseDate);
    let purchaseId;

    try {
      const insertResult = await db.query(
        `
          INSERT INTO purchases (
            purchase_number, supplier_name, purchase_date, total_amount, payment_status, created_at, updated_at
          ) VALUES ($1, $2, $3, 0, 'paid', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id
        `,
        [purchase_number, purchasedFrom || null, purchaseDate || new Date()]
      );
      purchaseId = insertResult.rows[0]?.id;
    } catch (insertErr) {
      // If unique constraint hit, reuse existing header
      if (insertErr.code === '23505') {
        const existing = await db.query(
          `SELECT id FROM purchases WHERE purchase_number = $1 LIMIT 1`,
          [purchase_number]
        );
        purchaseId = existing.rows[0]?.id;
      } else {
        throw insertErr;
      }
    }

    if (purchaseId) {
      for (const serialNumber of serialNumbers) {
        try {
          await db.query(
            `
              INSERT INTO purchase_items (
                purchase_id, product_id, product_type_id, sku, name, serial_number, quantity, purchase_date
              ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7)
            `,
            [
              purchaseId,
              product?.id || null,
              product?.product_type_id || null,
              product?.sku || null,
              product?.name || null,
              serialNumber || null,
              purchaseDate || new Date()
            ]
          );
        } catch (itemErr) {
          console.warn('Could not insert purchase item:', itemErr.message);
        }
      }

      // Back-fill purchase_id onto stock rows if column exists
      try {
        await db.query(
          `
            UPDATE stock
            SET purchase_id = $1
            WHERE product_id = $2
              AND serial_number = ANY($3::text[])
          `,
          [purchaseId, product?.id || null, serialNumbers]
        );
      } catch (linkErr) {
        console.warn('Could not link stock rows to purchase:', linkErr.message);
      }
    }

    return { purchaseId, purchase_number };
  } catch (err) {
    console.warn('recordPurchase fallback (non-blocking):', err.message);
    return { purchaseId: null, purchase_number: null };
  }
}

// Get all purchases (new purchase system)
router.get('/purchases-all', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    // Redirect to purchases route
    const purchasesRouter = require('./purchases');
    return purchasesRouter._router.handle(req, res);
  } catch (err) {
    console.error('GET /inventory/purchases-all error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get all inventory summary (must be before /:category route)
router.get('/', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const categories = ['car-truck-tractor', 'bike', 'ups-inverter'];
    const inventorySummary = {};

    for (const category of categories) {
      const productTypeId = getProductTypeId(category);

      try {
        const { rows } = await db.query(`
          SELECT 
            p.id, 
            p.sku, 
            p.name, 
            COALESCE(stock_counts.available_qty, 0) as qty,
            p.selling_price as price, 
            p.category, 
            p.ah_va, 
            p.warranty, 
            p.dp,
            p.mrp_price as mrp, 
            p.selling_price, 
            p.b2b_selling_price,
            p.discount, 
            p.discount_percent,
            p.b2b_discount,
            p.b2b_discount_percent,
            p.series, 
            p.order_index
          FROM products p
          LEFT JOIN (
            SELECT 
              product_id,
              COUNT(*) as available_qty
            FROM stock
            WHERE status = 'available'
            GROUP BY product_id
          ) stock_counts ON p.id = stock_counts.product_id
          WHERE p.product_type_id = $1
          ORDER BY 
            CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
        `, [productTypeId]);

        // Group by series
        const groupedBySeries = {};
        let totalStock = 0;

        rows.forEach(product => {
          const series = product.series || 'Uncategorized';
          if (!groupedBySeries[series]) {
            groupedBySeries[series] = {
              seriesName: series,
              products: [],
              totalStock: 0
            };
          }
          groupedBySeries[series].products.push(product);
          groupedBySeries[series].totalStock += parseInt(product.qty || 0);
          totalStock += parseInt(product.qty || 0);
        });

        inventorySummary[category] = {
          category,
          totalStock,
          series: Object.values(groupedBySeries)
        };
      } catch (err) {
        console.error(`Error fetching inventory for ${category}:`, err.message);
        inventorySummary[category] = {
          category,
          totalStock: 0,
          series: []
        };
      }
    }

    res.json(inventorySummary);
  } catch (err) {
    console.error('GET /inventory error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get all sold batteries (from stock_history where transaction_type = 'sell')
// NOTE: This route must be defined BEFORE '/:category' to avoid being captured by that param route
router.get('/sold-batteries', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category, search, dateFrom, dateTo } = req.query;
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    // Check if stock_history table exists and has vehicle_number column
    let hasVehicleNumber = false;
    try {
      const checkColumn = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'stock_history' AND column_name = 'vehicle_number'
      `);
      hasVehicleNumber = checkColumn.rows.length > 0;
    } catch (checkErr) {
      console.warn('Could not check for vehicle_number column:', checkErr.message);
    }

    // Build query - conditionally include vehicle_number if column exists
    let query = `
      SELECT 
        sh.id,
        sh.product_id,
        sh.serial_number,
        sh.customer_name,
        sh.customer_phone,
        ${hasVehicleNumber ? 'sh.vehicle_number,' : 'NULL as vehicle_number,'}
        sh.amount,
        sh.created_at as sold_date,
        p.name as product_name,
        p.sku,
        p.category,
        p.series,
        p.ah_va,
        p.warranty
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      WHERE sh.transaction_type = 'sell'
    `;
    const params = [];
    let paramCount = 0;

    if (productTypeId) {
      paramCount++;
      query += ` AND p.product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    if (search) {
      paramCount++;
      const searchConditions = [
        'p.name ILIKE $' + paramCount,
        'p.sku ILIKE $' + paramCount,
        'sh.serial_number ILIKE $' + paramCount,
        'sh.customer_name ILIKE $' + paramCount,
        'sh.customer_phone ILIKE $' + paramCount
      ];
      if (hasVehicleNumber) {
        searchConditions.push('sh.vehicle_number ILIKE $' + paramCount);
      }
      query += ` AND (${searchConditions.join(' OR ')})`;
      params.push(`%${search}%`);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND sh.created_at >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND sh.created_at <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
    }

    query += ` ORDER BY sh.created_at DESC LIMIT 1000`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/sold-batteries error:', err);
    // If table doesn't exist, return empty array instead of error
    if (err.code === '42P01' || err.message.includes('does not exist')) {
      console.warn('stock_history table does not exist, returning empty array');
      return res.json([]);
    }
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get inventory by category (must be after / route)
// OLD purchases route - now redirects to new purchase system
router.get('/purchases', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    // Return empty array - use new purchases API instead
    res.json([]);
  } catch (err) {
    console.error('GET /inventory/purchases error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get detailed purchase data for a specific purchase
router.get('/purchases/detail', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { purchase_date, purchased_from, category } = req.query;
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    if (!purchase_date) {
      return res.status(400).json({ error: 'purchase_date is required' });
    }

    let query = `
      SELECT 
        s.*,
        p.selling_price,
        p.mrp_price
      FROM stock s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE DATE(s.purchase_date) = $1
    `;
    const params = [purchase_date];
    let paramCount = 1;

    if (purchased_from) {
      paramCount++;
      query += ` AND s.purchased_from = $${paramCount}`;
      params.push(purchased_from);
    }

    if (productTypeId) {
      paramCount++;
      query += ` AND s.product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    query += ` ORDER BY s.created_at DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/purchases/detail error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Special route for AddStock to fetch products (hidden from normal UI)
router.get('/:category/products-for-stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const productTypeId = getProductTypeId(category);
    
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get products for AddStock component (internal use only)
    const { rows } = await db.query(`
      SELECT 
        p.id, 
        p.sku, 
        p.name, 
        COALESCE(stock_counts.available_qty, 0) as qty,
        p.selling_price as price, 
        p.category, 
        p.ah_va, 
        p.warranty, 
        p.dp,
        p.mrp_price as mrp, 
        p.selling_price, 
        p.b2b_selling_price,
        p.discount, 
        p.discount_percent,
        p.b2b_discount,
        p.b2b_discount_percent,
        p.series, 
        p.order_index
      FROM products p
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*) as available_qty
        FROM stock
        WHERE status = 'available'
        GROUP BY product_id
      ) stock_counts ON p.id = stock_counts.product_id
      WHERE p.product_type_id = $1
      ORDER BY 
        CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
    `, [productTypeId]);

    // Group by series
    const groupedBySeries = {};
    let totalStock = 0;

    rows.forEach(product => {
      const series = product.series || 'Uncategorized';
      if (!groupedBySeries[series]) {
        groupedBySeries[series] = {
          seriesName: series,
          products: [],
          totalStock: 0
        };
      }
      groupedBySeries[series].products.push(product);
      groupedBySeries[series].totalStock += parseInt(product.qty || 0);
      totalStock += parseInt(product.qty || 0);
    });

    res.json({
      category,
      totalStock,
      series: Object.values(groupedBySeries)
    });
  } catch (err) {
    console.error('GET /inventory/:category/products-for-stock error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

router.get('/:category', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const productTypeId = getProductTypeId(category);
    
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get all products from the category, grouped by series
    // For water products (product_type_id = 4), use products.qty directly
    // For other products, calculate actual stock from stock table (count of available items)
    const isWaterProduct = productTypeId === 4;
    
    let query;
    if (isWaterProduct) {
      // For water products, use qty directly from products table
      query = `
        SELECT 
          p.id, 
          p.sku, 
          p.name, 
          COALESCE(p.qty, 0) as qty,
          p.selling_price as price, 
          p.category, 
          p.ah_va, 
          p.warranty, 
          p.dp,
          p.mrp_price as mrp, 
          p.selling_price, 
          p.b2b_selling_price,
          p.discount, 
          p.discount_percent,
          p.b2b_discount,
          p.b2b_discount_percent,
          p.series, 
          p.order_index
        FROM products p
        WHERE p.product_type_id = $1
        ORDER BY 
          CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
      `;
    } else {
      // For non-water products, count from stock table
      query = `
        SELECT 
          p.id, 
          p.sku, 
          p.name, 
          COALESCE(stock_counts.available_qty, 0) as qty,
          p.selling_price as price, 
          p.category, 
          p.ah_va, 
          p.warranty, 
          p.dp,
          p.mrp_price as mrp, 
          p.selling_price, 
          p.b2b_selling_price,
          p.discount, 
          p.discount_percent,
          p.b2b_discount,
          p.b2b_discount_percent,
          p.series, 
          p.order_index
        FROM products p
        LEFT JOIN (
          SELECT 
            product_id,
            COUNT(*) as available_qty
          FROM stock
          WHERE status = 'available'
          GROUP BY product_id
        ) stock_counts ON p.id = stock_counts.product_id
        WHERE p.product_type_id = $1
        ORDER BY 
          CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
      `;
    }
    
    const { rows } = await db.query(query, [productTypeId]);

    // Group by series
    const groupedBySeries = {};
    let totalStock = 0;

    rows.forEach(product => {
      const series = product.series || 'Uncategorized';
      if (!groupedBySeries[series]) {
        groupedBySeries[series] = {
          seriesName: series,
          products: [],
          totalStock: 0
        };
      }
      groupedBySeries[series].products.push(product);
      groupedBySeries[series].totalStock += parseInt(product.qty || 0);
      totalStock += parseInt(product.qty || 0);
    });

    res.json({
      category,
      totalStock,
      series: Object.values(groupedBySeries)
    });
  } catch (err) {
    console.error('GET /inventory/:category error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Add stock to a product
router.post('/:category/add-stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const { productId, quantity } = req.body;

    if (!productId || isNaN(parseInt(productId, 10))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity (greater than 0) is required' });
    }

    const productTypeId = getProductTypeId(category);
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get current quantity
    const { rows: currentRows } = await db.query(
      `SELECT qty, product_type_id FROM products WHERE id = $1 AND product_type_id = $2`,
      [productId, productTypeId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    const currentQty = parseInt(currentRows[0].qty || 0);
    const newQty = currentQty + parseInt(quantity);

    // Update quantity
    const { rows } = await db.query(
      `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newQty, productId]
    );

    res.json({
      success: true,
      product: rows[0],
      previousQuantity: currentQty,
      addedQuantity: parseInt(quantity),
      newQuantity: newQty
    });
  } catch (err) {
    console.error('POST /inventory/:category/add-stock error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Reduce stock from a product
router.post('/:category/reduce-stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const { productId, quantity } = req.body;

    if (!productId || isNaN(parseInt(productId, 10))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity (greater than 0) is required' });
    }

    const productTypeId = getProductTypeId(category);
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get current quantity
    const { rows: currentRows } = await db.query(
      `SELECT qty, product_type_id FROM products WHERE id = $1 AND product_type_id = $2`,
      [productId, productTypeId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    const currentQty = parseInt(currentRows[0].qty || 0);
    const reduceQty = parseInt(quantity);

    if (reduceQty > currentQty) {
      return res.status(400).json({ 
        error: `Cannot reduce ${reduceQty} units. Only ${currentQty} units available.` 
      });
    }

    const newQty = currentQty - reduceQty;

    // Update quantity
    const { rows } = await db.query(
      `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [newQty, productId]
    );

    res.json({
      success: true,
      product: rows[0],
      previousQuantity: currentQty,
      reducedQuantity: reduceQty,
      newQuantity: newQty
    });
  } catch (err) {
    console.error('POST /inventory/:category/reduce-stock error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Update pricing (MRP, selling price, discount value) for a product
// Supports both B2B and B2C pricing via customer_type parameter ('b2b' or 'b2c')
router.put('/:category/:productId/pricing', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category, productId } = req.params;
    const { 
      mrp_price, 
      selling_price, 
      discount, 
      discount_percent,
      dp, // DP (Dealer Price)
      customer_type = 'b2c' // Default to B2C for backward compatibility
    } = req.body;

    if (!productId || isNaN(parseInt(productId, 10))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    // Validate customer_type
    const normalizedCustomerType = (customer_type || 'b2c').toLowerCase();
    if (normalizedCustomerType !== 'b2b' && normalizedCustomerType !== 'b2c') {
      return res.status(400).json({ error: 'customer_type must be either "b2b" or "b2c"' });
    }

    const numericMrp = parseFloat(mrp_price);
    const numericSelling = parseFloat(selling_price);
    const numericDiscount = parseFloat(discount);
    const numericDiscountPercent = parseFloat(discount_percent);

    if (isNaN(numericMrp) || numericMrp <= 0) {
      return res.status(400).json({ error: 'Valid MRP is required' });
    }

    if (isNaN(numericSelling) || numericSelling <= 0) {
      return res.status(400).json({ error: 'Valid selling price is required' });
    }

    // Discount value is optional in body – if missing, derive from MRP and selling price
    const finalDiscount = !isNaN(numericDiscount)
      ? numericDiscount
      : Math.max(0, numericMrp - numericSelling);

    // Discount percent is optional too – if missing, derive from discount + MRP
    const finalDiscountPercent = !isNaN(numericDiscountPercent)
      ? numericDiscountPercent
      : (numericMrp > 0 ? Math.round((finalDiscount / numericMrp) * 10000) / 100 : 0);

    // DP (Dealer Price) is optional - if not provided, keep existing value
    const numericDp = dp !== undefined && dp !== null ? parseFloat(dp) : null;
    const finalDp = !isNaN(numericDp) && numericDp > 0 ? numericDp : null;

    const productTypeId = getProductTypeId(category);
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Ensure product belongs to this category type and get current DP
    const { rows: existingRows } = await db.query(
      `SELECT id, dp FROM products WHERE id = $1 AND product_type_id = $2`,
      [productId, productTypeId]
    );

    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    // Use provided DP or keep existing DP
    const dpToUpdate = finalDp !== null ? finalDp : existingRows[0].dp;

    // Update pricing based on customer type
    let updateQuery;
    let queryParams;

    if (normalizedCustomerType === 'b2b') {
      // Update B2B pricing
      updateQuery = `
        UPDATE products
        SET mrp_price = $1,
            b2b_selling_price = $2,
            b2b_discount = $3,
            b2b_discount_percent = $4,
            dp = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, sku, name, qty, selling_price as price, category,
                  ah_va, warranty, mrp_price as mrp, dp,
                  selling_price, discount, discount_percent,
                  b2b_selling_price, b2b_discount, b2b_discount_percent,
                  series, order_index
      `;
      queryParams = [numericMrp, numericSelling, finalDiscount, finalDiscountPercent, dpToUpdate, productId];
    } else {
      // Update B2C pricing (default)
      updateQuery = `
        UPDATE products
        SET mrp_price = $1,
            selling_price = $2,
            discount = $3,
            discount_percent = $4,
            dp = $5,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING id, sku, name, qty, selling_price as price, category,
                  ah_va, warranty, mrp_price as mrp, dp,
                  selling_price, discount, discount_percent,
                  b2b_selling_price, b2b_discount, b2b_discount_percent,
                  series, order_index
      `;
      queryParams = [numericMrp, numericSelling, finalDiscount, finalDiscountPercent, dpToUpdate, productId];
    }

    const { rows } = await db.query(updateQuery, queryParams);

    res.json({
      success: true,
      customer_type: normalizedCustomerType,
      product: rows[0]
    });
  } catch (err) {
    console.error('PUT /inventory/:category/:productId/pricing error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Update discount % for all products in a category
// Only updates discount %, not MRP. Discount amount is calculated automatically from discount % and each product's MRP
router.put('/:category/bulk-discount', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const { 
      discount_percent,
      customer_type = 'b2c' // 'b2b' or 'b2c'
    } = req.body;

    if (discount_percent === undefined || discount_percent === null) {
      return res.status(400).json({ error: 'discount_percent is required' });
    }

    const numericDiscountPercent = parseFloat(discount_percent);
    if (isNaN(numericDiscountPercent) || numericDiscountPercent < 0 || numericDiscountPercent > 100) {
      return res.status(400).json({ error: 'discount_percent must be a number between 0 and 100' });
    }

    // Validate customer_type
    const normalizedCustomerType = (customer_type || 'b2c').toLowerCase();
    if (normalizedCustomerType !== 'b2b' && normalizedCustomerType !== 'b2c') {
      return res.status(400).json({ error: 'customer_type must be either "b2b" or "b2c"' });
    }

    const productTypeId = getProductTypeId(category);
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get all products in this category
    const { rows: products } = await db.query(
      `SELECT id, mrp_price FROM products WHERE product_type_id = $1`,
      [productTypeId]
    );

    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found in this category' });
    }

    // Update each product's discount based on customer type
    const updatedProducts = [];
    
    for (const product of products) {
      const mrp = parseFloat(product.mrp_price) || 0;
      
      if (mrp <= 0) {
        // Skip products with invalid MRP
        continue;
      }

      // Calculate discount amount from discount %
      const discountAmount = Math.round((mrp * numericDiscountPercent / 100) * 100) / 100;
      
      // Calculate selling price
      const sellingPrice = Math.round((mrp - discountAmount) * 100) / 100;

      let updateQuery;
      let queryParams;

      if (normalizedCustomerType === 'b2b') {
        // Update B2B pricing - only discount %, discount amount, and selling price
        // MRP remains unchanged
        updateQuery = `
          UPDATE products
          SET b2b_discount_percent = $1,
              b2b_discount = $2,
              b2b_selling_price = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING id, sku, name, mrp_price, 
                    selling_price, discount, discount_percent,
                    b2b_selling_price, b2b_discount, b2b_discount_percent
        `;
        queryParams = [numericDiscountPercent, discountAmount, sellingPrice, product.id];
      } else {
        // Update B2C pricing - only discount %, discount amount, and selling price
        // MRP remains unchanged
        updateQuery = `
          UPDATE products
          SET discount_percent = $1,
              discount = $2,
              selling_price = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          RETURNING id, sku, name, mrp_price, 
                    selling_price, discount, discount_percent,
                    b2b_selling_price, b2b_discount, b2b_discount_percent
        `;
        queryParams = [numericDiscountPercent, discountAmount, sellingPrice, product.id];
      }

      try {
        const { rows } = await db.query(updateQuery, queryParams);
        if (rows.length > 0) {
          updatedProducts.push(rows[0]);
        }
      } catch (updateErr) {
        console.error(`Failed to update product ${product.id}:`, updateErr.message);
        // Continue with other products even if one fails
      }
    }

    res.json({
      success: true,
      customer_type: normalizedCustomerType,
      discount_percent: numericDiscountPercent,
      updated_count: updatedProducts.length,
      total_products: products.length,
      products: updatedProducts
    });
  } catch (err) {
    console.error('PUT /inventory/:category/bulk-discount error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Add stock with serial numbers
router.post('/:category/add-stock-with-serials', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const { productId, quantity, serialNumbers, purchase_date, purchased_from, amount, dp, purchase_value, discount_amount, discount_percent } = req.body;
    const userId = req.user?.id;

    if (!productId || isNaN(parseInt(productId, 10))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity (greater than 0) is required' });
    }

    const productTypeId = getProductTypeId(category);
    
    // Check if this is a water product (product_type_id = 4)
    const isWaterProduct = productTypeId === 4;

    // Serial number validation - skip for water products
    if (!isWaterProduct) {
      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({ error: 'At least one serial number is required' });
      }

      if (serialNumbers.length !== quantity) {
        return res.status(400).json({ error: 'Number of serial numbers must match quantity' });
      }
    } else {
      // For water products, ensure serialNumbers is an empty array
      if (!serialNumbers || !Array.isArray(serialNumbers)) {
        serialNumbers = [];
      }
    }
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get current quantity and product info (or allow creating on the fly)
    let product;
    try {
      const { rows: currentRows } = await db.query(
        `SELECT id, qty, product_type_id, name, sku, series, category, ah_va, warranty, selling_price, mrp_price, dp FROM products WHERE id = $1 AND product_type_id = $2`,
        [productId, productTypeId]
      );

      if (currentRows.length === 0) {
        return res.status(404).json({ error: 'Product not found in this category. Please create the product first.' });
      }

      product = currentRows[0];
    } catch (err) {
      return res.status(404).json({ error: 'Product not found. Please create the product first.' });
    }
    const currentQty = parseInt(product.qty || 0);
    const newQty = currentQty + parseInt(quantity);

    // Use provided purchase_date or default to today
    // Ensure date is in YYYY-MM-DD format for PostgreSQL DATE type
    let purchaseDate;
    if (purchase_date) {
      const dateObj = new Date(purchase_date);
      purchaseDate = dateObj.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    } else {
      purchaseDate = new Date().toISOString().split('T')[0];
    }
    const purchasedFrom = purchased_from || null;

    // Get DP (Dealer Price) from request or product DP or MRP
    const productDp = parseFloat(product.dp || product.mrp_price || 0);
    const finalDp = dp !== undefined && dp !== null ? parseFloat(dp) : productDp;
    
    // Get purchase value and discount
    let finalPurchaseValue, finalDiscountAmount, finalDiscountPercent;
    
    if (purchase_value !== undefined && purchase_value !== null) {
      // Purchase value is provided directly
      finalPurchaseValue = parseFloat(purchase_value);
      finalDiscountAmount = Math.max(0, finalDp - finalPurchaseValue);
      finalDiscountPercent = finalDp > 0 ? Math.round((finalDiscountAmount / finalDp) * 10000) / 100 : 0;
    } else if (discount_amount !== undefined && discount_amount !== null) {
      // Discount amount is provided
      finalDiscountAmount = Math.min(finalDp, Math.max(0, parseFloat(discount_amount)));
      finalPurchaseValue = Math.max(0, finalDp - finalDiscountAmount);
      finalDiscountPercent = finalDp > 0 ? Math.round((finalDiscountAmount / finalDp) * 10000) / 100 : 0;
    } else if (discount_percent !== undefined && discount_percent !== null) {
      // Discount percent is provided
      finalDiscountPercent = Math.min(100, Math.max(0, parseFloat(discount_percent)));
      finalDiscountAmount = finalDp > 0 ? Math.round((finalDp * finalDiscountPercent / 100) * 100) / 100 : 0;
      finalPurchaseValue = Math.max(0, finalDp - finalDiscountAmount);
    } else {
      // Use amount as purchase value (backward compatibility)
      const purchaseAmount = amount !== undefined && amount !== null 
        ? parseFloat(amount) 
        : parseFloat(product.selling_price || product.mrp_price || 0);
      
      if (!purchaseAmount || purchaseAmount <= 0 || isNaN(purchaseAmount)) {
        return res.status(400).json({ 
          error: `Purchase amount is required and must be greater than 0. Received: ${amount}, Parsed: ${purchaseAmount}` 
        });
      }
      
      finalPurchaseValue = purchaseAmount;
      finalDiscountAmount = Math.max(0, finalDp - finalPurchaseValue);
      finalDiscountPercent = finalDp > 0 ? Math.round((finalDiscountAmount / finalDp) * 10000) / 100 : 0;
    }
    
    // Validate purchase value
    if (!finalPurchaseValue || finalPurchaseValue <= 0 || isNaN(finalPurchaseValue)) {
      return res.status(400).json({ 
        error: `Purchase value must be greater than 0. Received: ${purchase_value}, Parsed: ${finalPurchaseValue}` 
      });
    }
    
    // Use purchase_value as amount for backward compatibility
    const purchaseAmount = finalPurchaseValue;

    // CRITICAL: Use a single client for the entire transaction
    // PostgreSQL transactions must use the same connection
    const client = await db.pool.connect();
    
    console.log('[ADD STOCK] Starting transaction for:', {
      productId,
      quantity,
      serialNumbers,
      purchaseDate,
      purchasedFrom,
      amount: purchaseAmount
    });

    try {
      // Start transaction
      await client.query('BEGIN');

      // First, verify purchases table has all required columns
      const columnsCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'purchases'
        AND column_name IN ('product_sku', 'product_series', 'serial_number', 'purchase_number', 'dp', 'purchase_value', 'discount_amount', 'discount_percent', 'product_type_id')
      `);
      const requiredColumns = ['product_sku', 'product_series', 'serial_number', 'purchase_number', 'dp', 'purchase_value', 'discount_amount', 'discount_percent', 'product_type_id'];
      const existingColumns = columnsCheck.rows.map(r => r.column_name);
      const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns in purchases table: ${missingColumns.join(', ')}. Please run /api/init to add them.`);
      }
      
      // Verify unique constraint exists for ON CONFLICT clause
      const constraintCheck = await client.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'purchases' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%product_sku%serial_number%'
      `);
      
      if (constraintCheck.rows.length === 0) {
        console.warn('[ADD STOCK] Unique constraint on (product_sku, serial_number) not found. Creating it...');
        try {
          await client.query(`
            ALTER TABLE purchases 
            ADD CONSTRAINT purchases_product_sku_serial_number_unique 
            UNIQUE (product_sku, serial_number)
          `);
          console.log('[ADD STOCK] Unique constraint created');
        } catch (constraintErr) {
          console.warn('[ADD STOCK] Could not create unique constraint:', constraintErr.message);
          // Continue anyway - ON CONFLICT will fail gracefully
        }
      }

      // Update product quantity
      console.log('[ADD STOCK] Updating product quantity from', currentQty, 'to', newQty);
      const updateResult = await client.query(
        `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newQty, productId]
      );
      console.log('[ADD STOCK] Product quantity updated:', updateResult.rowCount, 'rows affected');

      // Save to new purchases table - generate purchase number first
      const purchaseNumber = await generatePurchaseNumber(purchaseDate);
      const purchaseProductTypeId = getProductTypeId(category);
      
      console.log('[ADD STOCK] Generated purchase number:', purchaseNumber);
      console.log('[ADD STOCK] Product type ID:', purchaseProductTypeId);
      console.log('[ADD STOCK] Purchase amount:', purchaseAmount);
      
      // Skip stock_history and stock table operations for water products
      if (!isWaterProduct) {
        // Insert serial numbers into stock_history table (optional - use SAVEPOINT)
        for (const serialNumber of serialNumbers) {
          const savepointName = `sp_stock_history_${serialNumber}`;
          try {
            await client.query(`SAVEPOINT ${savepointName}`);
            await client.query(`
              INSERT INTO stock_history 
              (product_id, transaction_type, quantity, serial_number, user_id, created_at)
              VALUES ($1, 'add', 1, $2, $3, CURRENT_TIMESTAMP)
            `, [productId, serialNumber, userId || null]);
            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          } catch (err) {
            // Rollback to savepoint to continue transaction
            try {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            } catch (rollbackErr) {
              // If savepoint doesn't exist, transaction might be aborted
              console.error('[ADD STOCK] Could not rollback to savepoint:', rollbackErr.message);
            }
            // If table doesn't exist or other error, log but continue
            console.warn('[ADD STOCK] Could not insert into stock_history:', err.message);
          }
        }

        // Create stock table entries - one row per serial number (optional - use SAVEPOINT)
        console.log('[ADD STOCK] Inserting into stock table...');
        for (const serialNumber of serialNumbers) {
          const savepointName = `sp_stock_${serialNumber}`;
          try {
            await client.query(`SAVEPOINT ${savepointName}`);
            
            // Check if stock entry already exists
            const existingStock = await client.query(`
              SELECT id FROM stock 
              WHERE product_id = $1 AND serial_number = $2 AND status = 'available'
            `, [product.id, serialNumber]);

            if (existingStock.rows.length === 0) {
              // Insert new stock entry
              console.log('[ADD STOCK] Inserting new stock entry for serial:', serialNumber);
              const stockResult = await client.query(`
                INSERT INTO stock (
                  purchase_date, sku, series, category, name, ah_va, quantity,
                  purchased_from, warranty, product_type_id, product_id, serial_number, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'available')
              `, [
                purchaseDate,
                product.sku,
                product.series,
                product.category,
                product.name,
                product.ah_va,
                1, // Always 1 per row
                purchasedFrom,
                product.warranty,
                product.product_type_id,
                product.id,
                serialNumber
              ]);
              console.log('[ADD STOCK] Stock entry inserted:', stockResult.rowCount, 'rows');
            } else {
              // Update existing stock entry
              console.log('[ADD STOCK] Updating existing stock entry for serial:', serialNumber);
              const updateStockResult = await client.query(`
                UPDATE stock SET
                  purchase_date = $1,
                  purchased_from = $2,
                  updated_at = CURRENT_TIMESTAMP
                WHERE product_id = $3 AND serial_number = $4 AND status = 'available'
              `, [
                purchaseDate,
                purchasedFrom,
                product.id,
                serialNumber
              ]);
              console.log('[ADD STOCK] Stock entry updated:', updateStockResult.rowCount, 'rows');
            }
            
            await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          } catch (stockErr) {
            // Rollback to savepoint to continue transaction
            try {
              await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
            } catch (rollbackErr) {
              console.error('[ADD STOCK] Could not rollback to savepoint:', rollbackErr.message);
              // If we can't rollback, transaction is already aborted
              throw new Error(`Stock table error: ${stockErr.message}${stockErr.detail ? ` (${stockErr.detail})` : ''}`);
            }
            console.warn('[ADD STOCK] Stock table operation failed, continuing:', stockErr.message);
          }
        }

        // For non-water products, create one row per serial number (one row per unit)
        console.log('[ADD STOCK] Inserting into purchases table...');
        for (const serialNumber of serialNumbers) {
          console.log('[ADD STOCK] Inserting purchase for serial:', serialNumber);
          console.log('[ADD STOCK] Values:', {
            product_type_id: purchaseProductTypeId,
            purchase_date: purchaseDate,
            purchase_number: purchaseNumber,
            product_series: product.series || null,
            product_sku: product.sku,
            serial_number: serialNumber,
            supplier_name: purchasedFrom || null,
            dp: finalDp,
            purchase_value: finalPurchaseValue,
            discount_amount: finalDiscountAmount,
            discount_percent: finalDiscountPercent
          });
          
          try {
            const purchaseResult = await client.query(`
              INSERT INTO purchases (
                product_type_id, purchase_date, purchase_number, product_series,
                product_sku, serial_number, supplier_name,
                dp, purchase_value, discount_amount, discount_percent
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (product_sku, serial_number) DO UPDATE SET
                purchase_date = EXCLUDED.purchase_date,
                purchase_number = EXCLUDED.purchase_number,
                supplier_name = EXCLUDED.supplier_name,
                dp = EXCLUDED.dp,
                purchase_value = EXCLUDED.purchase_value,
                discount_amount = EXCLUDED.discount_amount,
                discount_percent = EXCLUDED.discount_percent,
                updated_at = CURRENT_TIMESTAMP
            `, [
              purchaseProductTypeId,
              purchaseDate,
              purchaseNumber,
              product.series || null,
              product.sku,
              serialNumber,
              purchasedFrom || null,
              finalDp,
              finalPurchaseValue,
              finalDiscountAmount,
              finalDiscountPercent
            ]);
            console.log('[ADD STOCK] Purchase inserted:', purchaseResult.rowCount, 'rows for serial', serialNumber);
          } catch (insertErr) {
            console.error('[ADD STOCK] Error inserting purchase:', insertErr.message);
            console.error('[ADD STOCK] Error code:', insertErr.code);
            console.error('[ADD STOCK] Error detail:', insertErr.detail);
            throw new Error(`Failed to insert purchase: ${insertErr.message}${insertErr.detail ? ` (${insertErr.detail})` : ''}`);
          }
        }
      } else {
        // For water products, generate unique serial numbers using purchase_number + index
        console.log('[ADD STOCK] Inserting into purchases table for water product...');
        for (let i = 0; i < quantity; i++) {
          // Generate unique serial number: purchase_number-{index}
          const waterSerialNumber = `${purchaseNumber}-${i + 1}`;
          console.log('[ADD STOCK] Inserting purchase for water product unit:', waterSerialNumber);
          const purchaseResult = await client.query(`
            INSERT INTO purchases (
              product_type_id, purchase_date, purchase_number, product_series,
              product_sku, serial_number, supplier_name,
              dp, purchase_value, discount_amount, discount_percent
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (product_sku, serial_number) DO UPDATE SET
              purchase_date = EXCLUDED.purchase_date,
              purchase_number = EXCLUDED.purchase_number,
              supplier_name = EXCLUDED.supplier_name,
              dp = EXCLUDED.dp,
              purchase_value = EXCLUDED.purchase_value,
              discount_amount = EXCLUDED.discount_amount,
              discount_percent = EXCLUDED.discount_percent,
              updated_at = CURRENT_TIMESTAMP
          `, [
            purchaseProductTypeId,
            purchaseDate,
            purchaseNumber,
            product.series || null,
            product.sku,
            waterSerialNumber,
            purchasedFrom || null,
            finalDp,
            finalPurchaseValue,
            finalDiscountAmount,
            finalDiscountPercent
          ]);
          console.log('[ADD STOCK] Purchase inserted:', purchaseResult.rowCount, 'rows for water unit', waterSerialNumber);
        }
      }

      // Commit transaction
      console.log('[ADD STOCK] Committing transaction...');
      await client.query('COMMIT');
      console.log('[ADD STOCK] Transaction committed successfully!');

      res.json({
        success: true,
        product: product,
        previousQuantity: currentQty,
        addedQuantity: parseInt(quantity),
        newQuantity: newQty,
        serialNumbers
      });
    } catch (err) {
      console.error('[ADD STOCK] ERROR in transaction:', err.message);
      console.error('[ADD STOCK] Error stack:', err.stack);
      console.error('[ADD STOCK] Error code:', err.code);
      console.error('[ADD STOCK] Error detail:', err.detail);
      console.error('[ADD STOCK] Error constraint:', err.constraint);
      console.error('[ADD STOCK] Error table:', err.table);
      console.error('[ADD STOCK] Error column:', err.column);
      try {
        await client.query('ROLLBACK');
        console.error('[ADD STOCK] Transaction rolled back');
      } catch (rollbackErr) {
        console.error('[ADD STOCK] Rollback error:', rollbackErr.message);
      }
      // Return more detailed error message
      const errorMessage = err.detail 
        ? `${err.message}. ${err.detail}`
        : err.message;
      throw new Error(errorMessage);
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  } catch (err) {
    console.error('POST /inventory/:category/add-stock-with-serials error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get available serial numbers for a product (only from stock table with status='available')
router.get('/:category/:productId/available-serials', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category, productId } = req.params;
    const productTypeId = getProductTypeId(category);

    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get all serial numbers for this product that are available in stock table
    // Only show items that are still in stock (status='available')
    let rows = [];
    try {
      const stockResult = await db.query(`
        SELECT DISTINCT TRIM(serial_number) as serial_number
        FROM stock
        WHERE product_id = $1 AND status = 'available' AND serial_number IS NOT NULL
        ORDER BY TRIM(serial_number)
      `, [productId]);
      rows = stockResult.rows;
    } catch (err) {
      // If stock table doesn't exist, return empty array
      console.warn('Stock table not found:', err.message);
      rows = [];
    }

    const serials = rows.map(row => row.serial_number).filter(Boolean);
    res.json(serials);
  } catch (err) {
    console.error('GET /inventory/:category/:productId/available-serials error', err);
    res.json([]);
  }
});

// Sell stock with serial numbers
router.post('/:category/sell-stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category } = req.params;
    const { productId, quantity, serialNumbers, customerName, customerPhone, vehicleNumber, sellingPrice } = req.body;
    const userId = req.user?.id;

    if (!productId || isNaN(parseInt(productId, 10))) {
      return res.status(400).json({ error: 'Valid product ID is required' });
    }

    if (!quantity || isNaN(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity (greater than 0) is required' });
    }

    if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length !== quantity) {
      return res.status(400).json({ error: 'Serial numbers array must match quantity' });
    }

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    if (!sellingPrice || isNaN(sellingPrice) || sellingPrice <= 0) {
      return res.status(400).json({ error: 'Valid selling price is required' });
    }

    const productTypeId = getProductTypeId(category);
    if (!productTypeId) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Get product info and check available stock from stock table
    const { rows: currentRows } = await db.query(
      `SELECT id, qty, product_type_id, name, sku FROM products WHERE id = $1 AND product_type_id = $2`,
      [productId, productTypeId]
    );

    if (currentRows.length === 0) {
      return res.status(404).json({ error: 'Product not found in this category' });
    }

    // Count actual available stock from stock table
    let availableStock = 0;
    try {
      const stockCountResult = await db.query(`
        SELECT COUNT(*) as count
        FROM stock
        WHERE product_id = $1 AND status = 'available'
      `, [productId]);
      availableStock = parseInt(stockCountResult.rows[0]?.count || 0);
    } catch (stockErr) {
      // If stock table doesn't exist, fall back to products.qty
      console.warn('Could not check stock table, using products.qty:', stockErr.message);
      availableStock = parseInt(currentRows[0].qty || 0);
    }

    if (quantity > availableStock) {
      return res.status(400).json({ 
        error: `Cannot sell ${quantity} units. Only ${availableStock} units available.` 
      });
    }

    // Update products.qty (for backward compatibility)
    const currentQty = parseInt(currentRows[0].qty || 0);
    const newQty = Math.max(0, currentQty - quantity);

    // Start transaction
    await db.query('BEGIN');

    try {
      // Update product quantity
      await db.query(
        `UPDATE products SET qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newQty, productId]
      );

      // Record sale in stock_history and DELETE from stock table
      for (const serialNumber of serialNumbers) {
        // Insert into stock_history - check if vehicle_number column exists
        try {
          // Try with vehicle_number first
          await db.query(`
            INSERT INTO stock_history 
            (product_id, transaction_type, quantity, serial_number, customer_name, customer_phone, vehicle_number, amount, user_id, created_at)
            VALUES ($1, 'sell', 1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
          `, [
            productId, 
            serialNumber, 
            customerName.trim(), 
            customerPhone || null, 
            vehicleNumber || null,
            sellingPrice, 
            userId || null
          ]);
        } catch (historyErr) {
          // If vehicle_number column doesn't exist, insert without it
          if (historyErr.message.includes('vehicle_number') || historyErr.code === '42703') {
            await db.query(`
              INSERT INTO stock_history 
              (product_id, transaction_type, quantity, serial_number, customer_name, customer_phone, amount, user_id, created_at)
              VALUES ($1, 'sell', 1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            `, [
              productId, 
              serialNumber, 
              customerName.trim(), 
              customerPhone || null,
              sellingPrice, 
              userId || null
            ]);
          } else {
            throw historyErr;
          }
        }

        // DELETE from stock table (not just update status) - battery is sold, remove from stock
        try {
          await db.query(`
            DELETE FROM stock 
            WHERE product_id = $1 AND serial_number = $2 AND status = 'available'
          `, [productId, serialNumber]);
        } catch (stockErr) {
          // Log error but don't fail the transaction
          console.warn('Failed to delete from stock table:', stockErr.message);
        }
      }

      // Create a sale record in sales table so that dashboard & reports can see this admin sale
      try {
        const invoiceNumber = await generateInvoiceNumber();
        const totalAmount = sellingPrice * quantity;

        const saleResult = await db.query(
          `INSERT INTO sales (
             invoice_number, customer_id, customer_name, customer_phone, vehicle_number,
             sale_type, total_amount, discount, tax, final_amount,
             payment_method, payment_status, created_by, notes
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            invoiceNumber,
            null, // customer_id unknown for walk-in customers
            customerName.trim(),
            customerPhone || null,
            vehicleNumber || null,
            'retail',
            totalAmount,
            0,              // discount
            0,              // tax
            totalAmount,    // final_amount
            'cash',         // payment_method
            'paid',         // payment_status
            userId || null, // created_by (admin/super admin)
            'Admin inventory sale',
          ]
        );

        const saleId = saleResult.rows[0].id;

        // Create one sale_items row per serial number (quantity = 1 each)
        for (const serialNumber of serialNumbers) {
          await db.query(
            `INSERT INTO sale_items (
               sale_id, product_category, product_id, product_sku, product_name,
               product_serial_number, quantity, unit_price, total_price
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              saleId,
              category,
              currentRows[0].id,
              currentRows[0].sku,
              currentRows[0].name,
              serialNumber || null,
              1,
              sellingPrice,
              sellingPrice,
            ]
          );
        }
      } catch (saleErr) {
        console.error('Failed to create sales record for admin sale:', saleErr);
        // If sales table is missing, we still complete stock update; but dashboard won't see this sale
      }

      await db.query('COMMIT');

      res.json({
        success: true,
        product: currentRows[0],
        previousQuantity: currentQty,
        soldQuantity: quantity,
        newQuantity: newQty,
        serialNumbers,
        totalAmount: sellingPrice * quantity
      });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('POST /inventory/:category/sell-stock error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get all stock entries (only available items - sold items are removed from stock)
router.get('/stock', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category, status, search } = req.query;
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    let query = `
      SELECT 
        s.*,
        p.selling_price,
        p.mrp_price
      FROM stock s
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.status = 'available'
    `;
    const params = [];
    let paramCount = 0;

    if (productTypeId) {
      paramCount++;
      query += ` AND s.product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    if (status && status !== 'all' && status !== 'available') {
      // Only show available items in stock - sold items are in sells section
      paramCount++;
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        s.name ILIKE $${paramCount} OR
        s.sku ILIKE $${paramCount} OR
        s.serial_number ILIKE $${paramCount} OR
        s.purchased_from ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY s.purchase_date DESC, s.created_at DESC LIMIT 1000`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /inventory/stock error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get stock history ledger
router.get('/history/ledger', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { category, type, dateFrom, dateTo } = req.query;
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    let query = `
      SELECT 
        sh.id,
        sh.product_id,
        sh.transaction_type,
        sh.quantity,
        sh.serial_number,
        sh.customer_name,
        sh.customer_phone,
        sh.vehicle_number,
        sh.amount,
        sh.user_id,
        sh.created_at,
        p.name as product_name,
        p.sku,
        p.category
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (productTypeId) {
      paramCount++;
      query += ` AND p.product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    if (type && type !== 'all') {
      paramCount++;
      query += ` AND sh.transaction_type = $${paramCount}`;
      params.push(type);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND sh.created_at >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND sh.created_at <= $${paramCount}`;
      params.push(dateTo + ' 23:59:59');
    }

    query += ` ORDER BY sh.created_at DESC LIMIT 1000`;

    const { rows } = await db.query(query, params);

    // Group by transaction and aggregate serial numbers
    // For sell transactions, group by vehicle_number as well to keep them separate
    const grouped = {};
    rows.forEach(row => {
      // For sell transactions, include vehicle_number in the key to keep different vehicles separate
      // For add transactions, use the standard grouping
      const vehicleKey = row.transaction_type === 'sell' && row.vehicle_number 
        ? `-${row.vehicle_number}` 
        : '';
      const key = `${row.product_id}-${row.transaction_type}-${row.created_at.toISOString().split('T')[0]}${vehicleKey}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          id: row.id,
          product_id: row.product_id,
          product_name: row.product_name,
          sku: row.sku,
          category: row.category,
          transaction_type: row.transaction_type,
          quantity: 0,
          serial_numbers: [],
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          vehicle_number: row.vehicle_number,
          amount: 0,
          user_id: row.user_id,
          created_at: row.created_at
        };
      }
      grouped[key].quantity += row.quantity;
      if (row.serial_number) {
        grouped[key].serial_numbers.push(row.serial_number);
      }
      grouped[key].amount += parseFloat(row.amount || 0);
    });

    const result = Object.values(grouped).map(record => ({
      ...record,
      user_name: 'System' // Can be joined with users table if needed
    }));

    res.json(result);
  } catch (err) {
    console.error('GET /inventory/history/ledger error', err);
    // If table doesn't exist, return empty array
    res.json([]);
  }
});

// Get customer history (sales, invoices, warranty services, charging services)
router.get('/customer-history/:customerId', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { customerId } = req.params;
    const customerIdInt = parseInt(customerId, 10);

    if (!customerIdInt || isNaN(customerIdInt)) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    // Get customer info
    const customerResult = await db.query(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        u.phone,
        cp.address,
        cp.city,
        cp.state,
        cp.pincode,
        cp.company_name,
        cp.gst_number,
        cp.company_address
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.id = $1`,
      [customerIdInt]
    );

    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer = customerResult.rows[0];

    // Get all sales/purchases for this customer with product information
    const salesResult = await db.query(
      `SELECT DISTINCT
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        customer_business_name,
        customer_gst_number,
        customer_business_address,
        MIN(created_at) as purchase_date,
        SUM(final_amount) as total_amount,
        COUNT(*) as item_count,
        ARRAY_AGG(DISTINCT product_id) FILTER (WHERE product_id IS NOT NULL) as product_ids,
        ARRAY_AGG(DISTINCT SERIES) FILTER (WHERE SERIES IS NOT NULL) as series_list,
        ARRAY_AGG(DISTINCT NAME) FILTER (WHERE NAME IS NOT NULL) as product_names
      FROM sales_item
      WHERE customer_id = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number,
               customer_vehicle_number, sales_type, customer_business_name,
               customer_gst_number, customer_business_address
      ORDER BY MIN(created_at) DESC`,
      [customerIdInt]
    );

    // Get warranty/guarantee replacements
    // Handle case where battery_replacements table might not exist yet
    let replacementsResult = { rows: [] };
    try {
      replacementsResult = await db.query(
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
          p.name as product_name,
          p.sku as product_sku,
          ws.slab_name as warranty_slab_name
        FROM battery_replacements br
        LEFT JOIN products p ON br.product_id = p.id
        LEFT JOIN warranty_slabs ws ON br.warranty_slab_id = ws.id
        WHERE br.customer_id = $1
        ORDER BY br.replacement_date DESC, br.created_at DESC`,
        [customerIdInt]
      );
    } catch (replacementsError) {
      // If table doesn't exist, just return empty array
      // Error code 42P01 is PostgreSQL's "undefined_table" error
      if (replacementsError.code !== '42P01') {
        // Re-throw if it's a different error
        throw replacementsError;
      }
      // Otherwise, continue with empty replacements array
      console.warn('battery_replacements table does not exist. Run migration: server/migrations/create_guarantee_warranty_tables.sql');
    }

    // Get charging services - match by email or phone
    const customerEmail = customer.email ? customer.email.toLowerCase() : null;
    const customerPhone = customer.phone || null;
    
    let chargingServicesResult = { rows: [] };
    
    if (customerEmail || customerPhone) {
      let chargingServicesQuery = `
        SELECT 
          cs.*,
          u.full_name as created_by_name
        FROM charging_services cs
        LEFT JOIN users u ON cs.created_by = u.id
        WHERE 
      `;
      const chargingParams = [];
      const conditions = [];
      
      if (customerEmail) {
        chargingParams.push(customerEmail);
        conditions.push(`LOWER(cs.customer_email) = $${chargingParams.length}`);
      }
      if (customerPhone) {
        chargingParams.push(customerPhone);
        conditions.push(`cs.customer_mobile_number = $${chargingParams.length}`);
      }
      
      if (conditions.length > 0) {
        chargingServicesQuery += conditions.join(' OR ');
        chargingServicesQuery += ` ORDER BY cs.created_at DESC`;
        chargingServicesResult = await db.query(chargingServicesQuery, chargingParams);
      }
    }

    // Get service requests (non-charging services)
    const serviceRequestsResult = await db.query(
      `SELECT 
        sr.*,
        u.full_name as created_by_name
      FROM service_requests sr
      LEFT JOIN users u ON sr.user_id = u.id
      WHERE sr.user_id = $1
      ORDER BY sr.created_at DESC`,
      [customerIdInt]
    );

    res.json({
      customer,
      sales: salesResult.rows,
      replacements: replacementsResult.rows,
      chargingServices: chargingServicesResult.rows,
      serviceRequests: serviceRequestsResult.rows
    });
  } catch (err) {
    console.error('GET /inventory/customer-history/:customerId error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get employee history (payments, attendance, updates)
router.get('/employee-history/:employeeId', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employeeIdInt = parseInt(employeeId, 10);

    if (!employeeIdInt || isNaN(employeeIdInt)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }

    // Get employee info
    const employeeResult = await db.query(
      `SELECT * FROM employees WHERE id = $1`,
      [employeeIdInt]
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const employee = employeeResult.rows[0];

    // Get all payments
    const paymentsResult = await db.query(
      `SELECT ep.*, u.full_name as created_by_name
       FROM employee_payments ep
       LEFT JOIN users u ON ep.created_by = u.id
       WHERE ep.employee_id = $1
       ORDER BY ep.payment_date DESC`,
      [employeeIdInt]
    );

    // Get all attendance records
    const attendanceResult = await db.query(
      `SELECT * FROM employee_attendance
       WHERE employee_id = $1
       ORDER BY attendance_month DESC`,
      [employeeIdInt]
    );

    // Get all history records
    const historyResult = await db.query(
      `SELECT eh.*, u.full_name as created_by_name
       FROM employee_history eh
       LEFT JOIN users u ON eh.created_by = u.id
       WHERE eh.employee_id = $1
       ORDER BY eh.created_at DESC`,
      [employeeIdInt]
    );

    // Calculate summary statistics
    const totalPayments = paymentsResult.rows.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    const totalAttendanceMonths = attendanceResult.rows.length;
    const totalPresentDays = attendanceResult.rows.reduce((sum, a) => sum + parseInt(a.present_days || 0), 0);
    const totalAbsentDays = attendanceResult.rows.reduce((sum, a) => sum + parseInt(a.absent_days || 0), 0);

    res.json({
      employee,
      payments: paymentsResult.rows,
      attendance: attendanceResult.rows,
      history: historyResult.rows,
      summary: {
        total_payments: totalPayments,
        total_payment_records: paymentsResult.rows.length,
        total_attendance_months: totalAttendanceMonths,
        total_present_days: totalPresentDays,
        total_absent_days: totalAbsentDays
      }
    });
  } catch (err) {
    console.error('GET /inventory/employee-history/:employeeId error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;
