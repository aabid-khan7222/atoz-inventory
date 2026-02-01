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

module.exports = router;

