const express = require('express');
const db = require('../db');
const { requireAuth, requireShopId, requireSuperAdminOrAdmin } = require('../middleware/auth');

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

// Get all purchases with filtering, search, sorting, and date range
router.get('/', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { 
      category, 
      dateFrom, 
      dateTo, 
      supplier, 
      search,
      sortBy = 'purchase_date',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    let query = `
      SELECT 
        id,
        product_type_id,
        purchase_date,
        purchase_number,
        product_series,
        product_sku,
        serial_number,
        supplier_name,
        dp,
        purchase_value,
        discount_amount,
        discount_percent,
        created_at
      FROM purchases
      WHERE shop_id = $1
    `;
    const params = [req.shop_id];
    let paramCount = 1;

    if (productTypeId) {
      paramCount++;
      query += ` AND product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND purchase_date >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND purchase_date <= $${paramCount}`;
      params.push(dateTo);
    }

    if (supplier) {
      paramCount++;
      query += ` AND LOWER(supplier_name) LIKE LOWER($${paramCount})`;
      params.push(`%${supplier}%`);
    }

    if (search) {
      paramCount++;
      query += ` AND (
        LOWER(product_sku) LIKE LOWER($${paramCount}) OR
        LOWER(serial_number) LIKE LOWER($${paramCount}) OR
        LOWER(product_series) LIKE LOWER($${paramCount}) OR
        LOWER(purchase_number) LIKE LOWER($${paramCount}) OR
        LOWER(supplier_name) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${search}%`);
    }

    // Validate sortBy and sortOrder
    const allowedSortFields = ['purchase_date', 'purchase_number', 'product_sku', 'serial_number', 'supplier_name', 'purchase_value', 'created_at'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'purchase_date';
    const validSortOrder = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    query += ` ORDER BY ${validSortBy} ${validSortOrder}`;
    
    // Add pagination
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const { rows } = await db.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM purchases WHERE shop_id = $1`;
    const countParams = [req.shop_id];
    let countParamCount = 1;

    if (productTypeId) {
      countParamCount++;
      countQuery += ` AND product_type_id = $${countParamCount}`;
      countParams.push(productTypeId);
    }

    if (dateFrom) {
      countParamCount++;
      countQuery += ` AND purchase_date >= $${countParamCount}`;
      countParams.push(dateFrom);
    }

    if (dateTo) {
      countParamCount++;
      countQuery += ` AND purchase_date <= $${countParamCount}`;
      countParams.push(dateTo);
    }

    if (supplier) {
      countParamCount++;
      countQuery += ` AND LOWER(supplier_name) LIKE LOWER($${countParamCount})`;
      countParams.push(`%${supplier}%`);
    }

    if (search) {
      countParamCount++;
      countQuery += ` AND (
        LOWER(product_sku) LIKE LOWER($${countParamCount}) OR
        LOWER(serial_number) LIKE LOWER($${countParamCount}) OR
        LOWER(product_series) LIKE LOWER($${countParamCount}) OR
        LOWER(purchase_number) LIKE LOWER($${countParamCount}) OR
        LOWER(supplier_name) LIKE LOWER($${countParamCount})
      )`;
      countParams.push(`%${search}%`);
    }

    // Use query timeout to prevent hanging
    const countStartTime = Date.now();
    const { rows: countRows } = await db.query(countQuery, countParams);
    const countTime = Date.now() - countStartTime;
    if (countTime > 5000) {
      console.warn(`[PERF] Slow COUNT query took ${countTime}ms`);
    }
    const total = parseInt(countRows[0]?.total || 0);

    res.json({
      purchases: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('GET /purchases error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get purchase statistics
router.get('/stats', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, category } = req.query;
    const productTypeId = category && category !== 'all' ? getProductTypeId(category) : null;

    let query = `
      SELECT 
        COUNT(*) as total_purchases,
        COUNT(DISTINCT purchase_number) as unique_purchase_orders,
        COUNT(DISTINCT product_sku) as unique_products,
        COUNT(DISTINCT supplier_name) as unique_suppliers,
        SUM(purchase_value) as total_amount,
        MIN(purchase_date) as first_purchase_date,
        MAX(purchase_date) as last_purchase_date
      FROM purchases
      WHERE shop_id = $1
    `;
    const params = [req.shop_id];
    let paramCount = 1;

    if (productTypeId) {
      paramCount++;
      query += ` AND product_type_id = $${paramCount}`;
      params.push(productTypeId);
    }

    if (dateFrom) {
      paramCount++;
      query += ` AND purchase_date >= $${paramCount}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      paramCount++;
      query += ` AND purchase_date <= $${paramCount}`;
      params.push(dateTo);
    }

    const { rows } = await db.query(query, params);

    res.json(rows[0] || {
      total_purchases: 0,
      unique_purchase_orders: 0,
      unique_products: 0,
      unique_suppliers: 0,
      total_amount: 0,
      first_purchase_date: null,
      last_purchase_date: null
    });
  } catch (err) {
    console.error('GET /purchases/stats error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Update a purchase row (metadata / pricing only — shop-scoped, admin only)
router.patch('/:id', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  const purchaseId = parseInt(req.params.id, 10);
  if (!Number.isFinite(purchaseId) || purchaseId < 1) {
    return res.status(400).json({ error: 'Invalid purchase id' });
  }

  const b = req.body || {};
  const updates = [];
  const values = [];
  let n = 1;
  const push = (col, val) => {
    updates.push(`${col} = $${n++}`);
    values.push(val);
  };

  if (b.supplier_name !== undefined) push('supplier_name', b.supplier_name ? String(b.supplier_name).trim() : null);
  if (b.purchase_date !== undefined) {
    const d = b.purchase_date ? new Date(b.purchase_date) : null;
    if (!d || Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid purchase_date' });
    push('purchase_date', d.toISOString().split('T')[0]);
  }
  if (b.dp !== undefined) {
    const v = parseFloat(b.dp);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Invalid dp' });
    push('dp', v);
  }
  if (b.purchase_value !== undefined) {
    const v = parseFloat(b.purchase_value);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Invalid purchase_value' });
    push('purchase_value', v);
  }
  if (b.discount_amount !== undefined) {
    const v = parseFloat(b.discount_amount);
    if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Invalid discount_amount' });
    push('discount_amount', v);
  }
  if (b.discount_percent !== undefined) {
    const v = parseFloat(b.discount_percent);
    if (!Number.isFinite(v) || v < 0 || v > 100) return res.status(400).json({ error: 'Invalid discount_percent' });
    push('discount_percent', v);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(purchaseId, req.shop_id);

  try {
    const q = `UPDATE purchases SET ${updates.join(', ')} WHERE id = $${n++} AND shop_id = $${n++} RETURNING *`;
    const { rows } = await db.query(q, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Purchase not found' });
    res.json({ success: true, purchase: rows[0] });
  } catch (err) {
    console.error('PATCH /purchases/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Remove a mistaken purchase: only when the unit is still in available stock (or water qty only)
router.delete('/:id', requireAuth, requireShopId, requireSuperAdminOrAdmin, async (req, res) => {
  const purchaseId = parseInt(req.params.id, 10);
  if (!Number.isFinite(purchaseId) || purchaseId < 1) {
    return res.status(400).json({ error: 'Invalid purchase id' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const purRes = await client.query(
      `SELECT * FROM purchases WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [purchaseId, req.shop_id]
    );
    if (purRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }
    const pur = purRes.rows[0];
    const qty = Math.max(1, parseInt(pur.quantity ?? 1, 10) || 1);
    const productTypeId = pur.product_type_id;

    const prodRes = await client.query(
      `SELECT id, qty FROM products WHERE sku = $1 AND shop_id = $2 AND product_type_id = $3 LIMIT 1`,
      [pur.product_sku, req.shop_id, productTypeId]
    );
    if (prodRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Product not found for this purchase; cannot adjust inventory.' });
    }
    const product = prodRes.rows[0];

    if (productTypeId === 4) {
      await client.query(
        `UPDATE products SET qty = GREATEST(0, COALESCE(qty, 0) - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND shop_id = $3`,
        [qty, product.id, req.shop_id]
      );
      await client.query(`DELETE FROM purchases WHERE id = $1 AND shop_id = $2`, [purchaseId, req.shop_id]);
      await client.query('COMMIT');
      return res.json({ success: true, message: 'Purchase removed; product quantity reduced.' });
    }

    const stockRes = await client.query(
      `SELECT s.id FROM stock s
       WHERE s.product_id = $1 AND s.serial_number = $2 AND s.shop_id = $3 AND s.status = 'available'
       LIMIT 1`,
      [product.id, pur.serial_number, req.shop_id]
    );

    if (stockRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error:
          'This item is not in available stock (may already be sold). Remove the sale first or correct data manually.',
      });
    }

    await client.query(`DELETE FROM stock WHERE id = $1`, [stockRes.rows[0].id]);
    await client.query(
      `UPDATE products SET qty = GREATEST(0, COALESCE(qty, 0) - $1), updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND shop_id = $3`,
      [qty, product.id, req.shop_id]
    );
    await client.query(`DELETE FROM purchases WHERE id = $1 AND shop_id = $2`, [purchaseId, req.shop_id]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Purchase and stock line removed; product quantity reduced.' });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      /* ignore */
    }
    console.error('DELETE /purchases/:id error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

