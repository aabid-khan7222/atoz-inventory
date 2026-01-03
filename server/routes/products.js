const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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
  return typeMap[category] || 1; // Default to car-truck-tractor
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

router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    
    let query;
    let params = [];

    if (category) {
      // Get products by category (using product_type_id)
      const productTypeId = getProductTypeId(category);
      query = `
        SELECT 
          p.*,
          pt.name as product_type_name
        FROM products p
        JOIN product_type pt ON p.product_type_id = pt.id
        WHERE p.product_type_id = $1
        ORDER BY 
          CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
      `;
      params = [productTypeId];
    } else {
      // Get all products, ordered by product_type_id then order_index
      query = `
        SELECT 
          p.*,
          pt.name as product_type_name
        FROM products p
        JOIN product_type pt ON p.product_type_id = pt.id
        ORDER BY 
          p.product_type_id ASC,
          CASE WHEN p.order_index IS NOT NULL THEN p.order_index ELSE p.id END ASC
      `;
    }

    const { rows } = await db.query(query, params);
    
    // Transform response to include category for backward compatibility
    const transformedRows = rows.map(row => ({
      ...row,
      category: getCategoryFromTypeId(row.product_type_id),
      price: row.selling_price, // For backward compatibility (regular customer price)
      mrp: row.mrp_price,
      dp: row.dp || row.mrp_price, // DP (Dealer Price)
      b2b_price: row.b2b_selling_price || row.selling_price, // B2B customer price
    }));

    res.json(transformedRows);
  } catch (err) {
    console.error('GET /products error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  // Validate ID is numeric
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const { rows } = await db.query(`
      SELECT 
        p.*,
        pt.name as product_type_name
      FROM products p
      JOIN product_type pt ON p.product_type_id = pt.id
      WHERE p.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = rows[0];
    
    // Transform response for backward compatibility
    const transformedProduct = {
      ...product,
      category: getCategoryFromTypeId(product.product_type_id),
      price: product.selling_price, // Regular customer price
      mrp: product.mrp_price,
      dp: product.dp || product.mrp_price, // DP (Dealer Price)
      b2b_price: product.b2b_selling_price || product.selling_price, // B2B customer price
    };

    res.json(transformedProduct);
  } catch (err) {
    console.error(`GET /products/${id} error`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper: purchase number generator (PO-YYYYMMDD-XXXX)
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
    // Fallback if query fails
    const timestamp = Date.now();
    return `PO-${dateStr}-${timestamp.toString().slice(-4)}`;
  }
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { 
    sku, 
    name, 
    qty, 
    price, 
    category, 
    ah_va, 
    warranty, 
    // DP (Dealer Price)
    dp,
    // B2C Pricing
    mrp, 
    selling_price,
    discount_percent,
    discount,
    // B2B Pricing
    b2b_selling_price,
    b2b_discount_percent,
    b2b_discount,
    series,
    purchase_date,
    purchased_from,
    serial_numbers,
    // Purchase fields
    purchase_value,
    discount_amount,
    discount_percent: purchase_discount_percent
  } = req.body;

  // Validation
  if (!sku || !sku.trim() || !name || !name.trim()) {
    return res.status(400).json({ error: 'SKU and name are required' });
  }

  // Validate SKU and name length
  if (sku.trim().length < 1 || sku.trim().length > 100) {
    return res.status(400).json({ error: 'SKU must be between 1 and 100 characters' });
  }

  if (name.trim().length < 1 || name.trim().length > 255) {
    return res.status(400).json({ error: 'Name must be between 1 and 255 characters' });
  }

  if (qty !== undefined && (isNaN(qty) || qty < 0)) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }

  // Validate optional string field lengths
  if (ah_va && ah_va.trim().length > 20) {
    return res.status(400).json({ error: 'Ah/VA must not exceed 20 characters' });
  }

  if (warranty && warranty.trim().length > 50) {
    return res.status(400).json({ error: 'Warranty must not exceed 50 characters' });
  }

  if (series && series.trim().length > 100) {
    return res.status(400).json({ error: 'Series must not exceed 100 characters' });
  }

  try {
    // Get product_type_id from category
    const productTypeId = getProductTypeId(category || 'car-truck-tractor');

    // Single MRP for both B2C and B2B
    const finalMrp = mrp || price || 0;
    
    // B2C Pricing calculations - use discount amount if provided, otherwise calculate from percentage
    const b2cDiscountAmount = discount !== undefined ? parseFloat(discount) : 0;
    const b2cDiscountPercent = discount_percent !== undefined ? parseFloat(discount_percent) : 0;
    
    // If discount amount is provided, use it; otherwise calculate from percentage
    const finalB2cDiscountAmount = b2cDiscountAmount > 0 
      ? Math.min(b2cDiscountAmount, finalMrp) // Ensure discount doesn't exceed MRP
      : (finalMrp > 0 ? Math.round((finalMrp * b2cDiscountPercent / 100) * 100) / 100 : 0);
    const finalB2cDiscountPercent = finalMrp > 0 && finalB2cDiscountAmount > 0
      ? Math.round((finalB2cDiscountAmount / finalMrp) * 10000) / 100
      : (b2cDiscountPercent > 0 ? b2cDiscountPercent : 0);
    const b2cSellingPrice = Math.round((finalMrp - finalB2cDiscountAmount) * 100) / 100;

    // B2B Pricing calculations - use discount amount if provided, otherwise calculate from percentage
    const b2bDiscountAmount = b2b_discount !== undefined ? parseFloat(b2b_discount) : 0;
    const b2bDiscountPercent = b2b_discount_percent !== undefined ? parseFloat(b2b_discount_percent) : 0;
    
    // If discount amount is provided, use it; otherwise calculate from percentage
    const finalB2bDiscountAmount = b2bDiscountAmount > 0 
      ? Math.min(b2bDiscountAmount, finalMrp) // Ensure discount doesn't exceed MRP
      : (finalMrp > 0 ? Math.round((finalMrp * b2bDiscountPercent / 100) * 100) / 100 : 0);
    const finalB2bDiscountPercent = finalMrp > 0 && finalB2bDiscountAmount > 0
      ? Math.round((finalB2bDiscountAmount / finalMrp) * 10000) / 100
      : (b2bDiscountPercent > 0 ? b2bDiscountPercent : 0);
    const b2bSellingPrice = Math.round((finalMrp - finalB2bDiscountAmount) * 100) / 100;
    
    // Get max order_index for this product_type to set new product order
    const orderResult = await db.query(`
      SELECT MAX(order_index) as max_order 
      FROM products 
      WHERE product_type_id = $1
    `, [productTypeId]);
    const maxOrder = (orderResult.rows[0]?.max_order || 0) + 1;

    // Extract guarantee_period_months from warranty field
    // Examples: "24F+24P" -> 24, "12" -> 12, "24F" -> 24
    let guaranteePeriodMonths = 0;
    if (warranty && warranty.trim()) {
      const warrantyStr = warranty.trim();
      // Try to extract first number from warranty string
      const match = warrantyStr.match(/^(\d+)/);
      if (match) {
        guaranteePeriodMonths = parseInt(match[1], 10) || 0;
      }
    }

    // Get DP (Dealer Price) - default to MRP if not provided
    const finalDp = dp !== undefined && dp !== null ? parseFloat(dp) : finalMrp;
    
    // Insert product with single MRP and B2C/B2B pricing
    // Note: We use single MRP (mrp_price) for both B2C and B2B customers
    const { rows } = await db.query(`
      INSERT INTO products (
        sku, series, category, name, qty, 
        dp, mrp_price, selling_price, discount, discount_percent,
        b2b_selling_price, b2b_discount, b2b_discount_percent,
        ah_va, warranty, guarantee_period_months, order_index, product_type_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) 
      RETURNING *
    `, [
      sku.trim(),
      series ? series.trim().slice(0, 100) : null,
      category || getCategoryFromTypeId(productTypeId),
      name.trim(),
      qty || 0,
      finalDp, // DP (Dealer Price)
      finalMrp, // Single MRP for both B2C and B2B
      b2cSellingPrice,
      finalB2cDiscountAmount,
      finalB2cDiscountPercent,
      b2bSellingPrice,
      finalB2bDiscountAmount,
      finalB2bDiscountPercent,
      ah_va ? ah_va.trim().slice(0, 20) : null,
      warranty ? warranty.trim().slice(0, 50) : null,
      guaranteePeriodMonths,
      maxOrder,
      productTypeId
    ]);

    const product = rows[0];
    
    // If quantity > 0 and we have purchase info, create stock entries and purchase entries
    const productQty = qty || 0;
    if (productQty > 0) {
      const purchaseDate = purchase_date ? new Date(purchase_date) : new Date();
      const purchasedFrom = purchased_from || null;
      const serials = serial_numbers && Array.isArray(serial_numbers) ? serial_numbers : [];
      
      // Get purchase details
      const purchaseDp = finalDp || product.dp || product.mrp_price || 0;
      const finalPurchaseValue = purchase_value !== undefined && purchase_value !== null 
        ? parseFloat(purchase_value) 
        : purchaseDp;
      const finalDiscountAmount = discount_amount !== undefined && discount_amount !== null
        ? parseFloat(discount_amount)
        : Math.max(0, purchaseDp - finalPurchaseValue);
      const finalDiscountPercent = purchase_discount_percent !== undefined && purchase_discount_percent !== null
        ? parseFloat(purchase_discount_percent)
        : (purchaseDp > 0 ? Math.round((finalDiscountAmount / purchaseDp) * 10000) / 100 : 0);
      
      // Generate purchase number
      const purchaseNumber = await generatePurchaseNumber(purchaseDate);
      const purchaseDateStr = purchaseDate.toISOString().split('T')[0];
      
      // Create stock entries and purchase entries - one row per item
      // If serial numbers provided, use them; otherwise generate placeholder serials
      for (let i = 0; i < productQty; i++) {
        const serialNumber = serials[i] || `AUTO-${product.id}-${Date.now()}-${i + 1}`;
        
        try {
          // Create stock entry
          await db.query(`
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
          
          // Create purchase entry
          await db.query(`
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
            product.product_type_id,
            purchaseDateStr,
            purchaseNumber,
            product.series || null,
            product.sku,
            serialNumber,
            purchasedFrom,
            purchaseDp,
            finalPurchaseValue,
            finalDiscountAmount,
            finalDiscountPercent
          ]);
        } catch (stockErr) {
          // Log error but don't fail the product creation
          console.warn('Failed to create stock/purchase entry:', stockErr.message);
        }
      }
    }
    
    // Transform response for backward compatibility
    const transformedProduct = {
      ...product,
      category: getCategoryFromTypeId(product.product_type_id),
      price: product.selling_price, // Regular customer price
      mrp: product.mrp_price,
      b2b_price: product.b2b_selling_price || product.selling_price, // B2B customer price
    };

    res.status(201).json(transformedProduct);
  } catch (err) {
    // Handle duplicate SKU error
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }
    
    console.error('POST /products error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Validate ID is numeric
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  const { 
    sku, 
    name, 
    qty, 
    price,
    category,
    ah_va,
    warranty,
    dp,
    mrp,
    selling_price,
    discount_percent,
    discount,
    // B2B Pricing
    b2b_selling_price,
    b2b_discount_percent,
    b2b_discount,
    series,
    order_index,
    product_type_id
  } = req.body;

  // Validation
  if (!sku || !sku.trim() || !name || !name.trim()) {
    return res.status(400).json({ error: 'SKU and name are required' });
  }

  // Validate SKU and name length
  if (sku.trim().length < 1 || sku.trim().length > 100) {
    return res.status(400).json({ error: 'SKU must be between 1 and 100 characters' });
  }

  if (name.trim().length < 1 || name.trim().length > 255) {
    return res.status(400).json({ error: 'Name must be between 1 and 255 characters' });
  }

  if (price !== undefined && (isNaN(price) || price <= 0)) {
    return res.status(400).json({ error: 'Valid price is required' });
  }

  if (mrp !== undefined && (isNaN(mrp) || mrp <= 0)) {
    return res.status(400).json({ error: 'Valid MRP is required' });
  }

  if (qty !== undefined && (isNaN(qty) || qty < 0)) {
    return res.status(400).json({ error: 'Quantity must be a non-negative number' });
  }

  // Validate optional string field lengths
  if (ah_va !== undefined && ah_va && ah_va.trim().length > 20) {
    return res.status(400).json({ error: 'Ah/VA must not exceed 20 characters' });
  }

  if (warranty !== undefined && warranty && warranty.trim().length > 50) {
    return res.status(400).json({ error: 'Warranty must not exceed 50 characters' });
  }

  if (series !== undefined && series && series.trim().length > 100) {
    return res.status(400).json({ error: 'Series must not exceed 100 characters' });
  }

  try {
    // Get existing product
    const existingResult = await db.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const existingProduct = existingResult.rows[0];

    // Determine product_type_id (use provided, or category, or keep existing)
    let finalProductTypeId = product_type_id;
    if (!finalProductTypeId && category) {
      finalProductTypeId = getProductTypeId(category);
    }
    if (!finalProductTypeId) {
      finalProductTypeId = existingProduct.product_type_id;
    }

    // Calculate B2C prices
    const finalMrp = mrp !== undefined ? mrp : (existingProduct.mrp_price || existingProduct.selling_price || 0);
    const finalSellingPrice = selling_price !== undefined 
      ? selling_price 
      : (price !== undefined 
        ? price 
        : (existingProduct.selling_price || Math.round(finalMrp * 0.9)));
    
    // B2C Pricing calculations - use discount amount if provided, otherwise calculate from percentage
    const b2cDiscountAmount = discount !== undefined ? parseFloat(discount) : 0;
    const b2cDiscountPercent = discount_percent !== undefined ? parseFloat(discount_percent) : 0;
    
    // If discount amount is provided, use it; otherwise calculate from percentage
    const finalB2cDiscountAmount = b2cDiscountAmount > 0 
      ? Math.min(b2cDiscountAmount, finalMrp) // Ensure discount doesn't exceed MRP
      : (finalMrp > 0 ? Math.round((finalMrp * b2cDiscountPercent / 100) * 100) / 100 : 0);
    const finalB2cDiscountPercent = finalMrp > 0 && finalB2cDiscountAmount > 0
      ? Math.round((finalB2cDiscountAmount / finalMrp) * 10000) / 100
      : (b2cDiscountPercent > 0 ? b2cDiscountPercent : (finalMrp > finalSellingPrice ? Math.round(((finalMrp - finalSellingPrice) / finalMrp) * 10000) / 100 : 0));
    const b2cSellingPrice = Math.round((finalMrp - finalB2cDiscountAmount) * 100) / 100;

    // B2B Pricing calculations - use discount amount if provided, otherwise calculate from percentage
    // If B2B fields are not provided, recalculate based on MRP (default 18% discount for B2B)
    const b2bDiscountAmount = b2b_discount !== undefined ? parseFloat(b2b_discount) : undefined;
    const b2bDiscountPercent = b2b_discount_percent !== undefined ? parseFloat(b2b_discount_percent) : undefined;
    
    // If B2B values are not provided, use existing values or calculate default (18% discount)
    let finalB2bDiscountAmount;
    let finalB2bDiscountPercent;
    let b2bSellingPrice;
    
    if (b2bDiscountAmount !== undefined || b2bDiscountPercent !== undefined || b2b_selling_price !== undefined) {
      // B2B values are being explicitly set
      if (b2bDiscountAmount !== undefined) {
        finalB2bDiscountAmount = Math.min(b2bDiscountAmount, finalMrp);
      } else if (b2bDiscountPercent !== undefined) {
        finalB2bDiscountAmount = finalMrp > 0 ? Math.round((finalMrp * b2bDiscountPercent / 100) * 100) / 100 : 0;
      } else {
        // Calculate from selling price
        finalB2bDiscountAmount = finalMrp > b2b_selling_price ? finalMrp - b2b_selling_price : 0;
      }
      
      finalB2bDiscountPercent = finalMrp > 0 && finalB2bDiscountAmount > 0
        ? Math.round((finalB2bDiscountAmount / finalMrp) * 10000) / 100
        : (b2bDiscountPercent || 0);
      
      b2bSellingPrice = b2b_selling_price !== undefined 
        ? parseFloat(b2b_selling_price)
        : Math.round((finalMrp - finalB2bDiscountAmount) * 100) / 100;
    } else {
      // Keep existing B2B values or calculate default if they don't exist
      if (existingProduct.b2b_discount !== null && existingProduct.b2b_discount !== undefined) {
        finalB2bDiscountAmount = existingProduct.b2b_discount;
        finalB2bDiscountPercent = existingProduct.b2b_discount_percent || 0;
        b2bSellingPrice = existingProduct.b2b_selling_price || Math.round((finalMrp - finalB2bDiscountAmount) * 100) / 100;
      } else {
        // Default: 18% discount for B2B
        finalB2bDiscountAmount = finalMrp > 0 ? Math.round((finalMrp * 0.18) * 100) / 100 : 0;
        finalB2bDiscountPercent = 18.00;
        b2bSellingPrice = Math.round((finalMrp - finalB2bDiscountAmount) * 100) / 100;
      }
    }

    // Get DP (Dealer Price) - use provided value or keep existing
    const finalDp = dp !== undefined ? parseFloat(dp) : existingProduct.dp || finalMrp;
    
    // Update product
    const { rows } = await db.query(`
      UPDATE products SET
        sku = $2,
        series = $3,
        category = $4,
        name = $5,
        qty = $6,
        dp = $7,
        selling_price = $8,
        mrp_price = $9,
        discount = $10,
        discount_percent = $11,
        b2b_selling_price = $12,
        b2b_discount = $13,
        b2b_discount_percent = $14,
        ah_va = $15,
        warranty = $16,
        order_index = COALESCE($17, order_index),
        product_type_id = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id,
      sku.trim(),
      series !== undefined ? (series ? series.trim().slice(0, 100) : null) : existingProduct.series,
      category || existingProduct.category,
      name.trim(),
      qty !== undefined ? qty : existingProduct.qty,
      finalDp, // DP (Dealer Price)
      b2cSellingPrice,
      finalMrp,
      finalB2cDiscountAmount,
      finalB2cDiscountPercent,
      b2bSellingPrice,
      finalB2bDiscountAmount,
      finalB2bDiscountPercent,
      ah_va !== undefined ? (ah_va ? ah_va.trim().slice(0, 20) : null) : existingProduct.ah_va,
      warranty !== undefined ? (warranty ? warranty.trim().slice(0, 50) : null) : existingProduct.warranty,
      order_index !== undefined ? order_index : null,
      finalProductTypeId
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = rows[0];
    
    // Transform response for backward compatibility
    const transformedProduct = {
      ...product,
      category: getCategoryFromTypeId(product.product_type_id),
      price: product.selling_price, // Regular customer price
      mrp: product.mrp_price,
      dp: product.dp || product.mrp_price, // DP (Dealer Price)
      b2b_price: product.b2b_selling_price || product.selling_price, // B2B customer price
    };

    res.json(transformedProduct);
  } catch (err) {
    // Handle duplicate SKU error
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }
    
    console.error(`PUT /products/${id} error`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Validate ID is numeric
  if (!id || isNaN(parseInt(id, 10))) {
    return res.status(400).json({ error: 'Invalid product ID' });
  }

  try {
    const result = await db.query('DELETE FROM products WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(`DELETE /products/${id} error`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
