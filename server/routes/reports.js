const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, requireSuperAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper function to check if commission columns exist
let commissionColumnsCache = null;
async function hasCommissionColumns() {
  if (commissionColumnsCache !== null) return commissionColumnsCache;
  try {
    const columnCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item' 
      AND column_name IN ('has_commission', 'commission_amount', 'commission_agent_id')
    `);
    commissionColumnsCache = columnCheck.rows.length >= 2; // At least has_commission and commission_amount
    return commissionColumnsCache;
  } catch (err) {
    console.warn('Could not check commission columns:', err.message);
    commissionColumnsCache = false;
    return false;
  }
}

// Helper function to build commission SELECT clause
async function buildCommissionSelect() {
  const hasColumns = await hasCommissionColumns();
  if (hasColumns) {
    return 'COALESCE(SUM(si.commission_amount), 0) as total_commission';
  }
  return '0 as total_commission';
}

// Helper function to get product_type_id from category
function getProductTypeId(category) {
  const typeMap = {
    'car-truck-tractor': 1,
    'bike': 2,
    'ups-inverter': 3,
    'hups-inverter': 3,
    'water': 4,
  };
  return typeMap[category] || null;
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

// Helper function to calculate date range from period
function getDateRangeFromPeriod(period) {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case 'last_month':
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case 'last_3_months':
      startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case 'last_year':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'today':
      // For today, both start and end should be today's date
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      startDate = todayStart;
      // endDate is the same as startDate for today (DATE comparison, no time needed)
      break;
    default:
      // All time
      startDate = new Date(0);
  }

  // For 'today' period, endDate should be the same as startDate (both are today)
  const endDateObj = period === 'today' ? startDate : now;
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDateObj.toISOString().split('T')[0]
  };
}

// Helper function to build date filter for sales_item queries
function buildSalesDateFilter(dateFrom, dateTo, period) {
  let dateFilter = '';
  const params = [];
  let paramCount = 1;

  if (dateFrom && dateTo) {
    // For DATE columns, compare directly with DATE type (no time component needed)
    dateFilter = ` AND si.purchase_date >= $${paramCount}::DATE AND si.purchase_date <= $${paramCount + 1}::DATE`;
    params.push(dateFrom, dateTo);
    paramCount += 2;
  } else if (period && period !== 'all') {
    // For "today" period, use DATE comparison like dashboard does for consistency
    if (period === 'today') {
      dateFilter = ` AND DATE(si.purchase_date) = CURRENT_DATE`;
      // No params needed for CURRENT_DATE
    } else {
      const dateRange = getDateRangeFromPeriod(period);
      // For DATE columns, compare directly with DATE type (no time component needed)
      dateFilter = ` AND si.purchase_date >= $${paramCount}::DATE AND si.purchase_date <= $${paramCount + 1}::DATE`;
      params.push(dateRange.startDate, dateRange.endDate);
      paramCount += 2;
    }
  }

  return { dateFilter, params, nextParamIndex: paramCount };
}

// Helper function to build date filter for charging_services queries
function buildChargingDateFilter(dateFrom, dateTo, period) {
  let dateFilter = '';
  const params = [];
  let paramCount = 1;

  if (dateFrom && dateTo) {
    dateFilter = ` AND cs.created_at >= $${paramCount} AND cs.created_at <= $${paramCount + 1}`;
    params.push(dateFrom, dateTo + ' 23:59:59');
    paramCount += 2;
  } else if (period && period !== 'all') {
    const dateRange = getDateRangeFromPeriod(period);
    dateFilter = ` AND cs.created_at >= $${paramCount} AND cs.created_at <= $${paramCount + 1}`;
    params.push(dateRange.startDate, dateRange.endDate + ' 23:59:59');
    paramCount += 2;
  }

  return { dateFilter, params, nextParamIndex: paramCount };
}

// Helper function to build date filter for service_requests queries
function buildServiceRequestDateFilter(dateFrom, dateTo, period) {
  let dateFilter = '';
  const params = [];
  let paramCount = 1;

  if (dateFrom && dateTo) {
    dateFilter = ` AND sr.created_at >= $${paramCount} AND sr.created_at <= $${paramCount + 1}`;
    params.push(dateFrom, dateTo + ' 23:59:59');
    paramCount += 2;
  } else if (period && period !== 'all') {
    const dateRange = getDateRangeFromPeriod(period);
    dateFilter = ` AND sr.created_at >= $${paramCount} AND sr.created_at <= $${paramCount + 1}`;
    params.push(dateRange.startDate, dateRange.endDate + ' 23:59:59');
    paramCount += 2;
  }

  return { dateFilter, params, nextParamIndex: paramCount };
}

// Get purchase price for a serial number (for profit calculation)
async function getPurchasePrice(serialNumber, productSku) {
  try {
    // Try to find purchase by serial number first (if serial number exists and is not empty)
    if (serialNumber && serialNumber.trim() !== '') {
      const purchaseResult = await db.query(
        `SELECT purchase_value FROM purchases 
         WHERE TRIM(serial_number) = TRIM($1) 
         ORDER BY purchase_date DESC 
         LIMIT 1`,
        [serialNumber.trim()]
      );

      if (purchaseResult.rows.length > 0 && purchaseResult.rows[0].purchase_value) {
        const price = parseFloat(purchaseResult.rows[0].purchase_value || 0);
        if (price > 0) {
          return price;
        }
      }
    }

    // If not found by serial number, try to get average purchase price for the SKU
    if (productSku && productSku.trim() !== '') {
      const avgPurchaseResult = await db.query(
        `SELECT AVG(amount) as avg_amount 
         FROM purchases 
         WHERE TRIM(product_sku) = TRIM($1) 
         AND amount > 0
         AND supplier_name != 'replace'`,
        [productSku.trim()]
      );

      if (avgPurchaseResult.rows.length > 0 && avgPurchaseResult.rows[0].avg_amount) {
        const avgPrice = parseFloat(avgPurchaseResult.rows[0].avg_amount || 0);
        if (avgPrice > 0) {
          return avgPrice;
        }
      }
    }

    return 0;
  } catch (err) {
    console.error('Error getting purchase price:', err);
    return 0;
  }
}

// ============================================
// SALES REPORTS
// ============================================

// Category-wise Sales Report
router.get('/sales/category', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    const query = `
      SELECT 
        si.CATEGORY,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.customer_id) as unique_customers,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_item' AND column_name = 'commission_amount') THEN si.commission_amount ELSE 0 END), 0) as total_commission,
        SUM(si.tax) as total_tax,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE 1=1 ${dateFilter}
      GROUP BY si.CATEGORY
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, params);
    
    // Calculate profit for each category
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let categoryProfit = 0;
      try {
        // Get sample items from this category to calculate profit
        const categoryItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.CATEGORY = $1 ${dateFilter}
          LIMIT 200
        `;
        const categoryParams = [row.category, ...params];
        const categoryItemsResult = await db.query(categoryItemsQuery, categoryParams);
        
        for (const item of categoryItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            const profit = revenue - purchasePrice;
            categoryProfit += profit;
          } else {
            // If no serial or SKU, assume 0 purchase cost (profit = revenue)
            categoryProfit += revenue;
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.CATEGORY = $1 ${dateFilter}`,
          categoryParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || categoryItemsResult.rows.length);
        if (totalCount > categoryItemsResult.rows.length && categoryItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / categoryItemsResult.rows.length;
          categoryProfit = categoryProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for category ${row.category}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(categoryProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching category-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Product-wise Sales Report
router.get('/sales/product', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all', category, series } = req.query;
    const { dateFilter, params, nextParamIndex } = buildSalesDateFilter(dateFrom, dateTo, period);

    let query = `
      SELECT 
        si.NAME,
        si.SKU,
        si.CATEGORY,
        si.SERIES,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.customer_id) as unique_customers,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(si.commission_amount), 0) as total_commission,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE 1=1 ${dateFilter}
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (category && category !== 'all') {
      query += ` AND si.CATEGORY = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (series && series !== 'all') {
      query += ` AND si.SERIES = $${paramIndex}`;
      queryParams.push(series);
      paramIndex++;
    }

    query += `
      GROUP BY si.NAME, si.SKU, si.CATEGORY, si.SERIES
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate profit for each product
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let productProfit = 0;
      try {
        const productItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.NAME = $1 AND si.SKU = $2 ${dateFilter}
          LIMIT 200
        `;
        const productParams = [row.name, row.sku, ...params];
        const productItemsResult = await db.query(productItemsQuery, productParams);
        
        for (const item of productItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            productProfit += (revenue - purchasePrice);
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.NAME = $1 AND si.SKU = $2 ${dateFilter}`,
          productParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || productItemsResult.rows.length);
        if (totalCount > productItemsResult.rows.length && productItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / productItemsResult.rows.length;
          productProfit = productProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for product ${row.name}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(productProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching product-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Series-wise Sales Report
router.get('/sales/series', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all', category } = req.query;
    const { dateFilter, params, nextParamIndex } = buildSalesDateFilter(dateFrom, dateTo, period);

    let query = `
      SELECT 
        si.SERIES,
        si.CATEGORY,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.customer_id) as unique_customers,
        COUNT(DISTINCT si.SKU) as unique_products,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(si.commission_amount), 0) as total_commission,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE si.SERIES IS NOT NULL ${dateFilter}
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (category && category !== 'all') {
      query += ` AND si.CATEGORY = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    query += `
      GROUP BY si.SERIES, si.CATEGORY
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate profit for each series
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let seriesProfit = 0;
      try {
        const seriesItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.SERIES = $1 AND si.CATEGORY = $2 ${dateFilter}
          LIMIT 200
        `;
        const seriesParams = [row.series, row.category, ...params];
        const seriesItemsResult = await db.query(seriesItemsQuery, seriesParams);
        
        for (const item of seriesItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            seriesProfit += (revenue - purchasePrice);
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.SERIES = $1 AND si.CATEGORY = $2 ${dateFilter}`,
          seriesParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || seriesItemsResult.rows.length);
        if (totalCount > seriesItemsResult.rows.length && seriesItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / seriesItemsResult.rows.length;
          seriesProfit = seriesProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for series ${row.series}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(seriesProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching series-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer-wise Sales Report (with advance details)
router.get('/sales/customer', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all', customerType } = req.query;
    const { dateFilter, params, nextParamIndex } = buildSalesDateFilter(dateFrom, dateTo, period);

    let query = `
      SELECT 
        si.customer_id,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.sales_type,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(si.commission_amount), 0) as total_commission,
        MIN(si.purchase_date) as first_purchase_date,
        MAX(si.purchase_date) as last_purchase_date
      FROM sales_item si
      WHERE 1=1 ${dateFilter}
    `;
    let queryParams = [...params];

    if (customerType === 'b2b') {
      query += ` AND si.sales_type = 'wholesale'`;
    } else if (customerType === 'b2c') {
      query += ` AND si.sales_type = 'retail'`;
    }

    query += `
      GROUP BY si.customer_id, si.customer_name, si.customer_mobile_number, 
               si.customer_business_name, si.customer_gst_number, si.sales_type
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate profit for each customer
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let customerProfit = 0;
      try {
        const customerItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.customer_id = $1 ${dateFilter}
          LIMIT 200
        `;
        const customerParams = [row.customer_id, ...params];
        const customerItemsResult = await db.query(customerItemsQuery, customerParams);
        
        for (const item of customerItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            customerProfit += (revenue - purchasePrice);
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.customer_id = $1 ${dateFilter}`,
          customerParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || customerItemsResult.rows.length);
        if (totalCount > customerItemsResult.rows.length && customerItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / customerItemsResult.rows.length;
          customerProfit = customerProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for customer ${row.customer_id}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(customerProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching customer-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// B2B Customer-wise Sales Report
router.get('/sales/customer/b2b', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    const query = `
      SELECT 
        si.customer_id,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_business_name,
        si.customer_gst_number,
        si.customer_business_address,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(si.commission_amount), 0) as total_commission,
        MIN(si.purchase_date) as first_purchase_date,
        MAX(si.purchase_date) as last_purchase_date
      FROM sales_item si
      WHERE si.sales_type = 'wholesale' ${dateFilter}
      GROUP BY si.customer_id, si.customer_name, si.customer_mobile_number, 
               si.customer_business_name, si.customer_gst_number, si.customer_business_address
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, params);
    
    // Calculate profit for each B2B customer
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let customerProfit = 0;
      try {
        const customerItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.customer_id = $1 AND si.sales_type = 'wholesale' ${dateFilter}
          LIMIT 200
        `;
        const customerParams = [row.customer_id, ...params];
        const customerItemsResult = await db.query(customerItemsQuery, customerParams);
        
        for (const item of customerItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            customerProfit += (revenue - purchasePrice);
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.customer_id = $1 AND si.sales_type = 'wholesale' ${dateFilter}`,
          customerParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || customerItemsResult.rows.length);
        if (totalCount > customerItemsResult.rows.length && customerItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / customerItemsResult.rows.length;
          customerProfit = customerProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for B2B customer ${row.customer_id}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(customerProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching B2B customer sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// B2C Customer-wise Sales Report
router.get('/sales/customer/b2c', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    const query = `
      SELECT 
        si.customer_id,
        si.customer_name,
        si.customer_mobile_number,
        si.customer_vehicle_number,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        COALESCE(SUM(si.commission_amount), 0) as total_commission,
        MIN(si.purchase_date) as first_purchase_date,
        MAX(si.purchase_date) as last_purchase_date
      FROM sales_item si
      WHERE si.sales_type = 'retail' ${dateFilter}
      GROUP BY si.customer_id, si.customer_name, si.customer_mobile_number, si.customer_vehicle_number
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, params);
    
    // Calculate profit for each B2C customer
    const rowsWithProfit = await Promise.all(rows.map(async (row) => {
      let customerProfit = 0;
      try {
        const customerItemsQuery = `
          SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount
          FROM sales_item si
          WHERE si.customer_id = $1 AND si.sales_type = 'retail' ${dateFilter}
          LIMIT 200
        `;
        const customerParams = [row.customer_id, ...params];
        const customerItemsResult = await db.query(customerItemsQuery, customerParams);
        
        for (const item of customerItemsResult.rows) {
          const revenue = parseFloat(item.final_amount || 0);
          const serialNum = item.serial_number || item.SERIAL_NUMBER;
          const sku = item.sku || item.SKU;
          if (serialNum || sku) {
            const purchasePrice = await getPurchasePrice(serialNum, sku);
            customerProfit += (revenue - purchasePrice);
          }
        }
        
        // Scale profit if we limited results
        const totalCountResult = await db.query(
          `SELECT COUNT(*) as total FROM sales_item si WHERE si.customer_id = $1 AND si.sales_type = 'retail' ${dateFilter}`,
          customerParams
        );
        const totalCount = parseInt(totalCountResult.rows[0]?.total || customerItemsResult.rows.length);
        if (totalCount > customerItemsResult.rows.length && customerItemsResult.rows.length > 0) {
          const scaleFactor = totalCount / customerItemsResult.rows.length;
          customerProfit = customerProfit * scaleFactor;
        }
      } catch (err) {
        console.error(`Error calculating profit for B2C customer ${row.customer_id}:`, err);
      }
      
      return {
        ...row,
        total_profit: parseFloat(customerProfit.toFixed(2))
      };
    }));
    
    // Calculate totals
    const totals = {
      total_revenue: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_profit: rowsWithProfit.reduce((sum, row) => sum + parseFloat(row.total_profit || 0), 0)
    };
    
    res.json({ data: rowsWithProfit, totals });
  } catch (err) {
    console.error('Error fetching B2C customer sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// PROFIT REPORTS
// ============================================

// Overall Profit Report
router.get('/profit/overall', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    // Get sales data with purchase prices (sample for performance)
    const salesQuery = `
      SELECT 
        si.SERIAL_NUMBER,
        si.SKU,
        si.final_amount,
        si.CATEGORY,
        si.SERIES,
        si.NAME
      FROM sales_item si
      WHERE 1=1 ${dateFilter}
      LIMIT 500
    `;

    const { rows } = await db.query(salesQuery, params);

    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    const categoryProfit = {};
    const seriesProfit = {};
    const productProfit = {};

    for (const item of rows) {
      const revenue = parseFloat(item.final_amount || 0);
      const purchasePrice = await getPurchasePrice(item.serial_number, item.sku);
      const profit = revenue - purchasePrice;

      totalRevenue += revenue;
      totalPurchaseCost += purchasePrice;

      // Category profit
      const category = item.category || 'unknown';
      if (!categoryProfit[category]) {
        categoryProfit[category] = { revenue: 0, cost: 0, profit: 0, count: 0 };
      }
      categoryProfit[category].revenue += revenue;
      categoryProfit[category].cost += purchasePrice;
      categoryProfit[category].profit += profit;
      categoryProfit[category].count += 1;

      // Series profit
      if (item.series) {
        const series = item.series;
        if (!seriesProfit[series]) {
          seriesProfit[series] = { revenue: 0, cost: 0, profit: 0, count: 0 };
        }
        seriesProfit[series].revenue += revenue;
        seriesProfit[series].cost += purchasePrice;
        seriesProfit[series].profit += profit;
        seriesProfit[series].count += 1;
      }

      // Product profit
      const productKey = `${item.name}|${item.sku}`;
      if (!productProfit[productKey]) {
        productProfit[productKey] = {
          name: item.name,
          sku: item.sku,
          category: item.category,
          series: item.series,
          revenue: 0,
          cost: 0,
          profit: 0,
          count: 0
        };
      }
      productProfit[productKey].revenue += revenue;
      productProfit[productKey].cost += purchasePrice;
      productProfit[productKey].profit += profit;
      productProfit[productKey].count += 1;
    }

    // Get total count for scaling
    const totalCountResult = await db.query(
      `SELECT COUNT(*) as total FROM sales_item si WHERE 1=1 ${dateFilter}`,
      params
    );
    const totalCount = parseInt(totalCountResult.rows[0]?.total || rows.length);
    const scaleFactor = totalCount > rows.length ? totalCount / rows.length : 1;

    // Add service requests (customer service bookings) profit
    let serviceRequestsRevenue = 0;
    let serviceRequestsProfit = 0;
    try {
      // Build date filter for service_requests
      let serviceRequestsDateFilter = '';
      let serviceRequestsParams = [];
      if (dateFilter) {
        // Convert sales_item date filter to service_requests date filter
        // service_requests uses updated_at for completed services
        if (dateFilter.includes('DATE(si.purchase_date)')) {
          serviceRequestsDateFilter = ' AND DATE(sr.updated_at) = CURRENT_DATE';
        } else if (dateFilter.includes('>=') && dateFilter.includes('<=')) {
          // Extract dates from params
          const dateFrom = params[0];
          const dateTo = params[1];
          serviceRequestsDateFilter = ' AND DATE(sr.updated_at) >= $1::DATE AND DATE(sr.updated_at) <= $2::DATE';
          serviceRequestsParams = [dateFrom, dateTo];
        }
      }

      const serviceRequestsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests sr
        WHERE status = 'completed' AND amount IS NOT NULL ${serviceRequestsDateFilter}
      `;
      const serviceRequestsResult = await db.query(serviceRequestsQuery, serviceRequestsParams.length > 0 ? serviceRequestsParams : []);
      serviceRequestsRevenue = parseFloat(serviceRequestsResult.rows[0]?.total || 0);
      // Service requests amount is pure profit (100% profit as it's service charge)
      serviceRequestsProfit = serviceRequestsRevenue;
    } catch (err) {
      console.error('Error fetching service requests for profit:', err);
    }

    const scaledRevenue = (totalRevenue * scaleFactor) + serviceRequestsRevenue;
    const scaledPurchaseCost = totalPurchaseCost * scaleFactor;
    const scaledProfit = ((totalRevenue - totalPurchaseCost) * scaleFactor) + serviceRequestsProfit;

    res.json({
      overall: {
        total_revenue: parseFloat(scaledRevenue.toFixed(2)),
        total_purchase_cost: parseFloat(scaledPurchaseCost.toFixed(2)),
        total_profit: parseFloat(scaledProfit.toFixed(2)),
        profit_margin_percent: scaledRevenue > 0 
          ? parseFloat((scaledProfit / scaledRevenue * 100).toFixed(2))
          : 0
      },
      by_category: Object.entries(categoryProfit).map(([category, data]) => ({
        category,
        revenue: parseFloat(data.revenue.toFixed(2)),
        purchase_cost: parseFloat(data.cost.toFixed(2)),
        trade_in_value: parseFloat((data.tradeInValue || 0).toFixed(2)),
        profit: parseFloat(data.profit.toFixed(2)),
        profit_margin_percent: data.revenue > 0
          ? parseFloat((data.profit / data.revenue * 100).toFixed(2))
          : 0
      })),
      by_series: Object.entries(seriesProfit).map(([series, data]) => ({
        series,
        revenue: parseFloat(data.revenue.toFixed(2)),
        purchase_cost: parseFloat(data.cost.toFixed(2)),
        profit: parseFloat(data.profit.toFixed(2)),
        profit_margin_percent: data.revenue > 0
          ? parseFloat((data.profit / data.revenue * 100).toFixed(2))
          : 0
      })),
      by_product: Object.values(productProfit).map(data => ({
        ...data,
        revenue: parseFloat(data.revenue.toFixed(2)),
        purchase_cost: parseFloat(data.cost.toFixed(2)),
        profit: parseFloat(data.profit.toFixed(2)),
        profit_margin_percent: data.revenue > 0
          ? parseFloat((data.profit / data.revenue * 100).toFixed(2))
          : 0
      })).sort((a, b) => b.profit - a.profit)
    });
  } catch (err) {
    console.error('Error fetching profit report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// COMMISSION REPORTS
// ============================================

// Agent-wise Commission Report
router.get('/commission/agent', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all', agentId } = req.query;
    const { dateFilter, params, nextParamIndex } = buildSalesDateFilter(dateFrom, dateTo, period);

    let query = `
      SELECT 
        ca.id as agent_id,
        ca.name as agent_name,
        ca.mobile_number as agent_mobile,
        ca.email as agent_email,
        COUNT(*) FILTER (WHERE si.has_commission = true) as total_commission_sales,
        COALESCE(SUM(si.commission_amount), 0) as total_commission_paid,
        COALESCE(SUM(si.final_amount) FILTER (WHERE si.has_commission = true), 0) as total_sales_amount,
        MIN(si.purchase_date) FILTER (WHERE si.has_commission = true) as first_commission_date,
        MAX(si.purchase_date) FILTER (WHERE si.has_commission = true) as last_commission_date
      FROM commission_agents ca
      LEFT JOIN sales_item si ON ca.id = si.commission_agent_id 
        AND si.has_commission = true ${dateFilter}
      WHERE 1=1
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (agentId && agentId !== 'all') {
      query += ` AND ca.id = $${paramIndex}`;
      queryParams.push(agentId);
      paramIndex++;
    }

    query += `
      GROUP BY ca.id, ca.name, ca.mobile_number, ca.email
      HAVING COUNT(*) FILTER (WHERE si.has_commission = true) > 0
      ORDER BY total_commission_paid DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.total_sales_amount || 0), 0),
      total_quantity: 0, // Not applicable for commission reports
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.total_sales_amount || 0), 0),
      total_commission_paid: rows.reduce((sum, row) => sum + parseFloat(row.total_commission_paid || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching agent commission report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Commission Details Report
router.get('/commission/details', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all', agentId } = req.query;
    const { dateFilter, params, nextParamIndex } = buildSalesDateFilter(dateFrom, dateTo, period);

    let query = `
      SELECT 
        si.id,
        si.invoice_number,
        si.customer_name,
        si.customer_mobile_number,
        si.NAME as product_name,
        si.SKU,
        si.SERIAL_NUMBER,
        si.final_amount as sale_amount,
        si.commission_amount,
        si.purchase_date,
        ca.id as agent_id,
        ca.name as agent_name,
        ca.mobile_number as agent_mobile
      FROM sales_item si
      INNER JOIN commission_agents ca ON si.commission_agent_id = ca.id
      WHERE si.has_commission = true ${dateFilter}
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (agentId && agentId !== 'all') {
      query += ` AND ca.id = $${paramIndex}`;
      queryParams.push(agentId);
      paramIndex++;
    }

    query += ` ORDER BY si.purchase_date DESC, si.created_at DESC`;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.sale_amount || 0), 0),
      total_quantity: 0, // Not applicable for commission details
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.sale_amount || 0), 0),
      total_commission_paid: rows.reduce((sum, row) => sum + parseFloat(row.commission_amount || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching commission details report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CHARGING SERVICES REPORTS
// ============================================

// Charging Services Revenue and Profit Report
router.get('/charging/services', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildChargingDateFilter(dateFrom, dateTo, period);

    const query = `
      SELECT 
        COUNT(*) as total_services,
        COUNT(*) FILTER (WHERE cs.status = 'completed') as completed_services,
        COUNT(*) FILTER (WHERE cs.status = 'collected') as collected_services,
        COALESCE(SUM(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as total_revenue,
        COALESCE(AVG(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as avg_service_price,
        MIN(cs.created_at) as first_service_date,
        MAX(cs.created_at) as last_service_date
      FROM charging_services cs
      WHERE 1=1 ${dateFilter}
    `;

    const { rows } = await db.query(query, params);

    // Estimate profit (assuming 70% profit margin on charging services)
    const totalRevenue = parseFloat(rows[0]?.total_revenue || 0);
    const estimatedCost = totalRevenue * 0.3; // 30% cost estimate
    const estimatedProfit = totalRevenue - estimatedCost;

    res.json({
      ...rows[0],
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      estimated_cost: parseFloat(estimatedCost.toFixed(2)),
      estimated_profit: parseFloat(estimatedProfit.toFixed(2)),
      profit_margin_percent: totalRevenue > 0
        ? parseFloat((estimatedProfit / totalRevenue * 100).toFixed(2))
        : 0
    });
  } catch (err) {
    console.error('Error fetching charging services report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Charging Services by Customer Report
router.get('/charging/customer', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildChargingDateFilter(dateFrom, dateTo, period);

    const query = `
      SELECT 
        cs.customer_name,
        cs.customer_mobile_number,
        cs.customer_email,
        COUNT(*) as total_services,
        COALESCE(SUM(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as total_spent,
        MIN(cs.created_at) as first_service_date,
        MAX(cs.created_at) as last_service_date
      FROM charging_services cs
      WHERE 1=1 ${dateFilter}
      GROUP BY cs.customer_name, cs.customer_mobile_number, cs.customer_email
      ORDER BY total_spent DESC
    `;

    const { rows } = await db.query(query, params);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.total_spent || 0), 0),
      total_quantity: rows.reduce((sum, row) => sum + parseFloat(row.total_services || 0), 0),
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.total_spent || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching charging services by customer report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// SUMMARY REPORT
// ============================================

// Get comprehensive summary report
router.get('/summary', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter: salesDateFilter, params: salesParams } = buildSalesDateFilter(dateFrom, dateTo, period);
    const { dateFilter: chargingDateFilter, params: chargingParams } = buildChargingDateFilter(dateFrom, dateTo, period);

    // Sales summary
    const salesSummary = await db.query(`
      SELECT 
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.customer_id) as unique_customers,
        COUNT(DISTINCT si.invoice_number) as total_invoices,
        COALESCE(SUM(si.final_amount), 0) as total_revenue,
        COALESCE(SUM(si.MRP), 0) as total_mrp,
        COALESCE(SUM(si.discount_amount), 0) as total_discount,
        COALESCE(SUM(si.tax), 0) as total_tax,
        COALESCE(SUM(si.QUANTITY), 0) as total_quantity_sold
      FROM sales_item si
      WHERE 1=1 ${salesDateFilter}
    `, salesParams);

        // Commission summary - check if commission columns exist
        let commissionSummary;
        try {
          // Check if commission columns exist
          const columnCheck = await db.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'sales_item' 
            AND column_name IN ('has_commission', 'commission_amount', 'commission_agent_id')
          `);
          const hasCommissionColumns = columnCheck.rows.length >= 2; // At least has_commission and commission_amount
          
          if (hasCommissionColumns) {
            commissionSummary = await db.query(`
              SELECT 
                COUNT(*) FILTER (WHERE si.has_commission = true) as total_commission_sales,
                COALESCE(SUM(si.commission_amount), 0) as total_commission_paid,
                COUNT(DISTINCT si.commission_agent_id) FILTER (WHERE si.has_commission = true) as unique_agents
              FROM sales_item si
              WHERE si.has_commission = true ${salesDateFilter}
            `, salesParams);
          } else {
            // Return empty commission summary if columns don't exist
            commissionSummary = { rows: [{ total_commission_sales: 0, total_commission_paid: 0, unique_agents: 0 }] };
          }
        } catch (commissionErr) {
          console.warn('Commission columns not available, returning empty summary:', commissionErr.message);
          commissionSummary = { rows: [{ total_commission_sales: 0, total_commission_paid: 0, unique_agents: 0 }] };
        }
    
        // Charging services summary (SAFE: handles missing service_price column)
        let chargingSummary;
        try {
          // Check which price column exists in production DB
          const chargingColumnCheck = await db.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'charging_services'
            AND column_name IN ('service_price', 'price', 'amount', 'service_charge', 'total_amount')
          `);
    
          const availableColumns = chargingColumnCheck.rows.map(r => r.column_name);
    
          // Choose the best matching column
          const priceColumn =
            availableColumns.includes('service_price') ? 'service_price' :
            availableColumns.includes('price') ? 'price' :
            availableColumns.includes('amount') ? 'amount' :
            availableColumns.includes('service_charge') ? 'service_charge' :
            availableColumns.includes('total_amount') ? 'total_amount' :
            null;
    
          if (!priceColumn) {
            // If no price column exists, return safe zero summary (no crash)
            chargingSummary = { rows: [{ total_services: 0, total_revenue: 0 }] };
          } else {
            chargingSummary = await db.query(`
              SELECT 
                COUNT(*) as total_services,
                COALESCE(SUM(cs.${priceColumn}) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as total_revenue
              FROM charging_services cs
              WHERE 1=1 ${chargingDateFilter}
            `, chargingParams);
          }
        } catch (chargingErr) {
          console.warn('Charging services summary failed, returning zero:', chargingErr.message);
          chargingSummary = { rows: [{ total_services: 0, total_revenue: 0 }] };
        }
    
        // Calculate total profit from sales (revenue - purchase cost)
        let totalSalesProfit = 0;
        try {
          const salesItemsQuery = `
            SELECT 
              si.SERIAL_NUMBER as serial_number,
              si.SKU as sku,
              si.final_amount
            FROM sales_item si
            WHERE 1=1 ${salesDateFilter}
            LIMIT 1000
          `;
          const salesItemsResult = await db.query(salesItemsQuery, salesParams);
          
          for (const item of salesItemsResult.rows) {
            const revenue = parseFloat(item.final_amount || 0);
            const serialNum = item.serial_number || item.SERIAL_NUMBER;
            const sku = item.sku || item.SKU;
            if (serialNum || sku) {
              const purchasePrice = await getPurchasePrice(serialNum, sku);
              totalSalesProfit += (revenue - purchasePrice);
            }
          }
          
          // Scale profit if we limited results
          const totalCountResult = await db.query(
            `SELECT COUNT(*) as total FROM sales_item si WHERE 1=1 ${salesDateFilter}`,
            salesParams
          );
          const totalCount = parseInt(totalCountResult.rows[0]?.total || salesItemsResult.rows.length);
          if (totalCount > salesItemsResult.rows.length && salesItemsResult.rows.length > 0) {
            const scaleFactor = totalCount / salesItemsResult.rows.length;
            totalSalesProfit = totalSalesProfit * scaleFactor;
          }
        } catch (err) {
          console.error('Error calculating sales profit:', err);
          totalSalesProfit = 0;
        }
    
        // Calculate charging services profit (assuming 70% profit margin)
        const chargingRevenue = parseFloat(chargingSummary.rows[0]?.total_revenue || 0);
        const chargingProfit = chargingRevenue * 0.7; // 70% profit margin
    
    // Calculate services profit (service_requests - 100% profit as it's service charge)
    let servicesProfit = 0;
    try {
      // Build date filter for service_requests
      let serviceRequestsDateFilter = '';
      let serviceRequestsParams = [];
      
      if (dateFrom && dateTo) {
        serviceRequestsDateFilter = ' AND DATE(sr.updated_at) >= $1::DATE AND DATE(sr.updated_at) <= $2::DATE';
        serviceRequestsParams = [dateFrom, dateTo];
      } else if (period && period !== 'all') {
        if (period === 'today') {
          serviceRequestsDateFilter = ' AND DATE(sr.updated_at) = CURRENT_DATE';
        } else {
          const dateRange = getDateRangeFromPeriod(period);
          serviceRequestsDateFilter = ' AND DATE(sr.updated_at) >= $1::DATE AND DATE(sr.updated_at) <= $2::DATE';
          serviceRequestsParams = [dateRange.startDate, dateRange.endDate];
        }
      }

      const serviceRequestsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests sr
        WHERE status = 'completed' AND amount IS NOT NULL ${serviceRequestsDateFilter}
      `;
      const serviceRequestsResult = await db.query(serviceRequestsQuery, serviceRequestsParams);
      const servicesRevenue = parseFloat(serviceRequestsResult.rows[0]?.total || 0);
      // Service requests amount is pure profit (100% profit as it's service charge)
      servicesProfit = servicesRevenue;
    } catch (err) {
      console.error('Error calculating services profit:', err);
      servicesProfit = 0;
    }

    // Total profit (sales + charging services + services)
    const totalProfit = totalSalesProfit + chargingProfit + servicesProfit;

    res.json({
      sales: salesSummary.rows[0],
      commission: commissionSummary.rows[0],
      charging: chargingSummary.rows[0],
      profit: {
        sales_profit: parseFloat(totalSalesProfit.toFixed(2)),
        charging_profit: parseFloat(chargingProfit.toFixed(2)),
        services_profit: parseFloat(servicesProfit.toFixed(2)),
        total_profit: parseFloat(totalProfit.toFixed(2))
      },
      period: {
        dateFrom: dateFrom || (period !== 'all' ? getDateRangeFromPeriod(period).startDate : null),
        dateTo: dateTo || (period !== 'all' ? getDateRangeFromPeriod(period).endDate : null),
        period
      }
    });
  } catch (err) {
    console.error('Error fetching summary report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// CUSTOMER REPORTS (Customer-specific, filtered by customer_id)
// ============================================

// Helper function to build customer date filter
function buildCustomerSalesDateFilter(dateFrom, dateTo, period, customerId, paramCount = 1) {
  let dateFilter = '';
  const params = [customerId]; // First param is always customer_id
  
  if (dateFrom && dateTo) {
    dateFilter = ` AND si.purchase_date >= $${paramCount + 1}::DATE AND si.purchase_date <= $${paramCount + 2}::DATE`;
    params.push(dateFrom, dateTo);
    paramCount += 2;
  } else if (period && period !== 'all') {
    const dateRange = getDateRangeFromPeriod(period);
    dateFilter = ` AND si.purchase_date >= $${paramCount + 1}::DATE AND si.purchase_date <= $${paramCount + 2}::DATE`;
    params.push(dateRange.startDate, dateRange.endDate);
    paramCount += 2;
  }

  return { dateFilter, params, nextParamIndex: paramCount + 1 };
}

// Customer Category-wise Sales Report
router.get('/customer/sales/category', requireAuth, async (req, res) => {
  try {
    // Only allow customers (role_id >= 3) to access their own data
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildCustomerSalesDateFilter(dateFrom, dateTo, period, customerId);

    const query = `
      SELECT 
        si.CATEGORY,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        SUM(si.tax) as total_tax,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE si.customer_id = $1 ${dateFilter}
      GROUP BY si.CATEGORY
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, params);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rows.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching customer category-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Product-wise Sales Report
router.get('/customer/sales/product', requireAuth, async (req, res) => {
  try {
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all', category, series } = req.query;
    const { dateFilter, params, nextParamIndex } = buildCustomerSalesDateFilter(dateFrom, dateTo, period, customerId);

    let query = `
      SELECT 
        si.NAME,
        si.SKU,
        si.CATEGORY,
        si.SERIES,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE si.customer_id = $1 ${dateFilter}
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (category && category !== 'all') {
      query += ` AND si.CATEGORY = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (series && series !== 'all') {
      query += ` AND si.SERIES = $${paramIndex}`;
      queryParams.push(series);
      paramIndex++;
    }

    query += `
      GROUP BY si.NAME, si.SKU, si.CATEGORY, si.SERIES
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rows.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching customer product-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Series-wise Sales Report
router.get('/customer/sales/series', requireAuth, async (req, res) => {
  try {
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all', category } = req.query;
    const { dateFilter, params, nextParamIndex } = buildCustomerSalesDateFilter(dateFrom, dateTo, period, customerId);

    let query = `
      SELECT 
        si.SERIES,
        si.CATEGORY,
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.SKU) as unique_products,
        SUM(si.QUANTITY) as total_quantity,
        SUM(si.final_amount) as total_revenue,
        SUM(si.MRP) as total_mrp,
        SUM(si.discount_amount) as total_discount,
        AVG(si.final_amount) as avg_sale_amount
      FROM sales_item si
      WHERE si.customer_id = $1 AND si.SERIES IS NOT NULL ${dateFilter}
    `;
    let queryParams = [...params];
    let paramIndex = nextParamIndex;

    if (category && category !== 'all') {
      query += ` AND si.CATEGORY = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    query += `
      GROUP BY si.SERIES, si.CATEGORY
      ORDER BY total_revenue DESC
    `;

    const { rows } = await db.query(query, queryParams);
    
    // Calculate totals
    const totals = {
      total_revenue: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0),
      total_quantity: rows.reduce((sum, row) => sum + parseFloat(row.total_quantity || 0), 0),
      total_sales_amount: rows.reduce((sum, row) => sum + parseFloat(row.total_revenue || 0), 0)
    };
    
    res.json({ data: rows, totals });
  } catch (err) {
    console.error('Error fetching customer series-wise sales report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Charging Services Report
router.get('/customer/charging/services', requireAuth, async (req, res) => {
  try {
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all' } = req.query;

    // First, get the customer's phone number from customer_profiles
    const customerResult = await db.query(
      `SELECT phone FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [customerId]
    );

    if (customerResult.rows.length === 0 || !customerResult.rows[0].phone) {
      return res.json({
        total_services: 0,
        completed_services: 0,
        collected_services: 0,
        total_revenue: 0,
        avg_service_price: 0
      });
    }

    const customerMobile = customerResult.rows[0].phone;

    // Build date filter with customer mobile as first param
    let chargingDateFilter = '';
    const chargingParams = [customerMobile];
    let paramIndex = 2;

    if (dateFrom && dateTo) {
      chargingDateFilter = ` AND cs.created_at >= $${paramIndex} AND cs.created_at <= $${paramIndex + 1}`;
      chargingParams.push(dateFrom, dateTo + ' 23:59:59');
    } else if (period && period !== 'all') {
      const dateRange = getDateRangeFromPeriod(period);
      chargingDateFilter = ` AND cs.created_at >= $${paramIndex} AND cs.created_at <= $${paramIndex + 1}`;
      chargingParams.push(dateRange.startDate, dateRange.endDate + ' 23:59:59');
    }

    const query = `
      SELECT 
        COUNT(*) as total_services,
        COUNT(*) FILTER (WHERE cs.status = 'completed') as completed_services,
        COUNT(*) FILTER (WHERE cs.status = 'collected') as collected_services,
        COALESCE(SUM(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as total_revenue,
        COALESCE(AVG(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as avg_service_price,
        MIN(cs.created_at) as first_service_date,
        MAX(cs.created_at) as last_service_date
      FROM charging_services cs
      WHERE cs.customer_mobile_number = $1 ${chargingDateFilter}
    `;

    const { rows } = await db.query(query, chargingParams);
    res.json(rows[0] || {
      total_services: 0,
      completed_services: 0,
      collected_services: 0,
      total_revenue: 0,
      avg_service_price: 0
    });
  } catch (err) {
    console.error('Error fetching customer charging services report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Summary Report
router.get('/customer/summary', requireAuth, async (req, res) => {
  try {
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter: salesDateFilter, params: salesParams } = buildCustomerSalesDateFilter(dateFrom, dateTo, period, customerId);
    
    // Get customer phone number for charging services
    const customerResult = await db.query(
      `SELECT phone FROM customer_profiles WHERE user_id = $1 LIMIT 1`,
      [customerId]
    );
    const customerMobile = customerResult.rows.length > 0 ? customerResult.rows[0].phone : null;

    // Sales summary
    const salesSummary = await db.query(`
      SELECT 
        COUNT(DISTINCT si.invoice_number) as total_sales,
        COUNT(DISTINCT si.invoice_number) as total_invoices,
        COALESCE(SUM(si.final_amount), 0) as total_revenue,
        COALESCE(SUM(si.MRP), 0) as total_mrp,
        COALESCE(SUM(si.discount_amount), 0) as total_discount,
        COALESCE(SUM(si.tax), 0) as total_tax,
        COALESCE(SUM(si.QUANTITY), 0) as total_quantity_sold
      FROM sales_item si
      WHERE si.customer_id = $1 ${salesDateFilter}
    `, salesParams);

    // Charging services summary
    let chargingSummary = { total_services: 0, total_revenue: 0 };
    if (customerMobile) {
      let chargingDateFilter = '';
      const chargingParams = [customerMobile];
      let paramIndex = 2;

      if (dateFrom && dateTo) {
        chargingDateFilter = ` AND cs.created_at >= $${paramIndex} AND cs.created_at <= $${paramIndex + 1}`;
        chargingParams.push(dateFrom, dateTo + ' 23:59:59');
      } else if (period && period !== 'all') {
        const dateRange = getDateRangeFromPeriod(period);
        chargingDateFilter = ` AND cs.created_at >= $${paramIndex} AND cs.created_at <= $${paramIndex + 1}`;
        chargingParams.push(dateRange.startDate, dateRange.endDate + ' 23:59:59');
      }

      const chargingResult = await db.query(`
        SELECT 
          COUNT(*) as total_services,
          COALESCE(SUM(cs.service_price) FILTER (WHERE cs.status IN ('completed', 'collected')), 0) as total_revenue
        FROM charging_services cs
        WHERE cs.customer_mobile_number = $1 ${chargingDateFilter}
      `, chargingParams);
      chargingSummary = chargingResult.rows[0] || chargingSummary;
    }

    res.json({
      sales: salesSummary.rows[0],
      charging: chargingSummary,
      period: {
        dateFrom: dateFrom || (period !== 'all' ? getDateRangeFromPeriod(period).startDate : null),
        dateTo: dateTo || (period !== 'all' ? getDateRangeFromPeriod(period).endDate : null),
        period
      }
    });
  } catch (err) {
    console.error('Error fetching customer summary report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Customer Service Requests Report
router.get('/customer/services', requireAuth, async (req, res) => {
  try {
    if (req.user.role_id < 3) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const customerId = req.user.id;
    const { dateFrom, dateTo, period = 'all', serviceType } = req.query;

    // Build date filter
    let dateFilter = '';
    const params = [customerId];
    let paramIndex = 2;

    if (dateFrom && dateTo) {
      dateFilter = ` AND sr.created_at >= $${paramIndex} AND sr.created_at <= $${paramIndex + 1}`;
      params.push(dateFrom, dateTo + ' 23:59:59');
      paramIndex += 2;
    } else if (period && period !== 'all') {
      const dateRange = getDateRangeFromPeriod(period);
      dateFilter = ` AND sr.created_at >= $${paramIndex} AND sr.created_at <= $${paramIndex + 1}`;
      params.push(dateRange.startDate, dateRange.endDate + ' 23:59:59');
      paramIndex += 2;
    }

    // Filter by service type if provided
    if (serviceType && serviceType !== 'all') {
      dateFilter += ` AND sr.service_type = $${paramIndex}`;
      params.push(serviceType);
      paramIndex++;
    }

    // Get service requests summary grouped by service type
    const summaryQuery = `
      SELECT 
        sr.service_type,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE sr.status = 'completed') as completed_requests,
        COUNT(*) FILTER (WHERE sr.status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE sr.status = 'in_progress') as in_progress_requests,
        COUNT(*) FILTER (WHERE sr.status = 'cancelled') as cancelled_requests,
        MIN(sr.created_at) as first_request_date,
        MAX(sr.created_at) as last_request_date
      FROM service_requests sr
      WHERE sr.user_id = $1 ${dateFilter}
      GROUP BY sr.service_type
      ORDER BY total_requests DESC
    `;

    const { rows: summaryRows } = await db.query(summaryQuery, params);

    // Get detailed service requests
    const detailsQuery = `
      SELECT 
        sr.id,
        sr.service_type,
        sr.vehicle_name,
        sr.fuel_type,
        sr.vehicle_number,
        sr.inverter_va,
        sr.inverter_voltage,
        sr.battery_ampere_rating,
        sr.notes,
        sr.status,
        sr.created_at,
        sr.updated_at
      FROM service_requests sr
      WHERE sr.user_id = $1 ${dateFilter}
      ORDER BY sr.created_at DESC
    `;

    const { rows: detailsRows } = await db.query(detailsQuery, params);

    res.json({
      summary: summaryRows,
      details: detailsRows
    });
  } catch (err) {
    console.error('Error fetching customer service requests report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Service Type Report - Shows breakdown by service type
router.get('/services/type', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildServiceRequestDateFilter(dateFrom, dateTo, period);

    // Service type labels mapping
    const SERVICE_TYPES = {
      battery_testing: 'Battery Testing Service',
      jump_start: 'Jump Start Service',
      inverter_repair: 'Inverter Repairing Service',
      inverter_battery: 'Inverter Battery Service'
    };

    const query = `
      SELECT 
        sr.service_type,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE sr.status = 'completed') as completed_requests,
        COUNT(*) FILTER (WHERE sr.status = 'pending') as pending_requests,
        COUNT(*) FILTER (WHERE sr.status = 'in_progress') as in_progress_requests,
        COUNT(*) FILTER (WHERE sr.status = 'cancelled') as cancelled_requests,
        COUNT(DISTINCT sr.user_id) as unique_customers,
        COALESCE(SUM(sr.amount) FILTER (WHERE sr.status = 'completed' AND sr.amount IS NOT NULL), 0) as total_revenue,
        COALESCE(AVG(sr.amount) FILTER (WHERE sr.status = 'completed' AND sr.amount IS NOT NULL), 0) as avg_service_amount,
        MIN(sr.created_at) as first_request_date,
        MAX(sr.created_at) as last_request_date
      FROM service_requests sr
      WHERE 1=1 ${dateFilter}
      GROUP BY sr.service_type
      ORDER BY total_requests DESC
    `;

    const { rows } = await db.query(query, params);

    // Format the response with service type labels
    const formattedRows = rows.map(row => ({
      ...row,
      service_type_label: SERVICE_TYPES[row.service_type] || row.service_type,
      total_requests: parseInt(row.total_requests),
      completed_requests: parseInt(row.completed_requests),
      pending_requests: parseInt(row.pending_requests),
      in_progress_requests: parseInt(row.in_progress_requests),
      cancelled_requests: parseInt(row.cancelled_requests),
      unique_customers: parseInt(row.unique_customers),
      total_revenue: parseFloat(row.total_revenue || 0),
      avg_service_amount: parseFloat(row.avg_service_amount || 0)
    }));

    // Calculate totals
    const totals = {
      total_quantity: formattedRows.reduce((sum, row) => sum + row.total_requests, 0),
      total_revenue: formattedRows.reduce((sum, row) => sum + row.total_revenue, 0),
      total_completed: formattedRows.reduce((sum, row) => sum + row.completed_requests, 0),
      total_pending: formattedRows.reduce((sum, row) => sum + row.pending_requests, 0),
      total_in_progress: formattedRows.reduce((sum, row) => sum + row.in_progress_requests, 0),
      total_cancelled: formattedRows.reduce((sum, row) => sum + row.cancelled_requests, 0),
      unique_customers: new Set(formattedRows.flatMap(row => [])).size // This will be calculated properly if needed
    };

    res.json({ data: formattedRows, totals });
  } catch (err) {
    console.error('Error fetching service type report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Employee-wise Report - Shows all employee details and their performance
router.get('/employees', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    // Get all employees
    const employeesResult = await db.query(`
      SELECT id, full_name, email, phone, address, designation, joining_date, salary, is_active, created_at
      FROM employees
      ORDER BY full_name
    `);

    const employees = employeesResult.rows;

    // For each employee, get their sales performance (if they are users)
    const employeeReports = await Promise.all(employees.map(async (employee) => {
      // Try to find matching user by email or phone
      let userId = null;
      if (employee.email) {
        const userByEmail = await db.query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [employee.email]
        );
        if (userByEmail.rows.length > 0) {
          userId = userByEmail.rows[0].id;
        }
      }
      
      if (!userId && employee.phone) {
        const userByPhone = await db.query(
          `SELECT u.id FROM users u 
           JOIN customer_profiles cp ON u.id = cp.user_id 
           WHERE cp.phone = $1 LIMIT 1`,
          [employee.phone]
        );
        if (userByPhone.rows.length > 0) {
          userId = userByPhone.rows[0].id;
        }
      }

      // Get sales performance if user found
      let salesData = {
        total_sales: 0,
        total_invoices: 0,
        total_revenue: 0,
        total_quantity: 0,
        avg_sale_amount: 0,
        first_sale_date: null,
        last_sale_date: null
      };

      if (userId) {
        const salesParams = [...params];
        let salesDateFilter = dateFilter;
        if (salesDateFilter) {
          salesDateFilter = `${salesDateFilter} AND si.created_by = $${salesParams.length + 1}`;
          salesParams.push(userId);
        } else {
          salesDateFilter = ` AND si.created_by = $${salesParams.length + 1}`;
          salesParams.push(userId);
        }

        const salesQuery = `
          SELECT 
            COUNT(*) as total_sales,
            COUNT(DISTINCT si.invoice_number) as total_invoices,
            COALESCE(SUM(si.final_amount), 0) as total_revenue,
            COALESCE(SUM(si.QUANTITY), 0) as total_quantity,
            COALESCE(AVG(si.final_amount), 0) as avg_sale_amount,
            MIN(si.purchase_date) as first_sale_date,
            MAX(si.purchase_date) as last_sale_date
          FROM sales_item si
          WHERE 1=1 ${salesDateFilter}
        `;

        const salesResult = await db.query(salesQuery, salesParams);
        if (salesResult.rows.length > 0) {
          const row = salesResult.rows[0];
          salesData = {
            total_sales: parseInt(row.total_sales) || 0,
            total_invoices: parseInt(row.total_invoices) || 0,
            total_revenue: parseFloat(row.total_revenue) || 0,
            total_quantity: parseInt(row.total_quantity) || 0,
            avg_sale_amount: parseFloat(row.avg_sale_amount) || 0,
            first_sale_date: row.first_sale_date,
            last_sale_date: row.last_sale_date
          };
        }
      }

      // Get attendance summary
      const attendanceResult = await db.query(`
        SELECT 
          COUNT(*) as total_months,
          SUM(present_days) as total_present_days,
          SUM(absent_days) as total_absent_days,
          SUM(leave_days) as total_leave_days
        FROM employee_attendance
        WHERE employee_id = $1
      `, [employee.id]);

      const attendance = attendanceResult.rows[0] || {
        total_months: 0,
        total_present_days: 0,
        total_absent_days: 0,
        total_leave_days: 0
      };

      // Get payment summary
      const paymentResult = await db.query(`
        SELECT 
          COUNT(*) as total_payments,
          COALESCE(SUM(amount), 0) as total_paid,
          MIN(payment_date) as first_payment_date,
          MAX(payment_date) as last_payment_date
        FROM employee_payments
        WHERE employee_id = $1
      `, [employee.id]);

      const payments = paymentResult.rows[0] || {
        total_payments: 0,
        total_paid: 0,
        first_payment_date: null,
        last_payment_date: null
      };

      return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        email: employee.email,
        phone: employee.phone,
        address: employee.address,
        designation: employee.designation,
        joining_date: employee.joining_date,
        salary: employee.salary ? parseFloat(employee.salary) : null,
        is_active: employee.is_active,
        created_at: employee.created_at,
        sales: salesData,
        attendance: {
          total_months: parseInt(attendance.total_months) || 0,
          total_present_days: parseInt(attendance.total_present_days) || 0,
          total_absent_days: parseInt(attendance.total_absent_days) || 0,
          total_leave_days: parseInt(attendance.total_leave_days) || 0
        },
        payments: {
          total_payments: parseInt(payments.total_payments) || 0,
          total_paid: parseFloat(payments.total_paid) || 0,
          first_payment_date: payments.first_payment_date,
          last_payment_date: payments.last_payment_date
        }
      };
    }));

    // Calculate totals
    const totals = {
      total_employees: employeeReports.length,
      active_employees: employeeReports.filter(e => e.is_active).length,
      total_sales: employeeReports.reduce((sum, e) => sum + e.sales.total_sales, 0),
      total_revenue: employeeReports.reduce((sum, e) => sum + e.sales.total_revenue, 0),
      total_quantity: employeeReports.reduce((sum, e) => sum + e.sales.total_quantity, 0),
      total_paid: employeeReports.reduce((sum, e) => sum + e.payments.total_paid, 0)
    };

    res.json({ data: employeeReports, totals });
  } catch (err) {
    console.error('Error fetching employee report:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// WATER WISE REPORT (Distilled Water & Battery Acid)
// ============================================

router.get('/water', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { dateFrom, dateTo, period = 'all' } = req.query;
    const { dateFilter, params } = buildSalesDateFilter(dateFrom, dateTo, period);

    // Get water products (product_type_id = 4)
    const waterProductsQuery = `
      SELECT 
        si.SERIAL_NUMBER,
        si.SKU,
        si.NAME,
        si.SERIES,
        si.CATEGORY,
        si.final_amount,
        si.MRP,
        si.discount_amount,
        si.discount_percent,
        si.QUANTITY,
        si.purchase_date,
        si.invoice_number,
        si.customer_type,
        p.selling_price as b2c_price,
        p.b2b_selling_price as b2b_price,
        p.mrp_price
      FROM sales_item si
      JOIN products p ON si.SKU = p.sku
      WHERE p.product_type_id = 4 ${dateFilter}
      ORDER BY si.purchase_date DESC, si.NAME ASC
    `;

    const { rows } = await db.query(waterProductsQuery, params);

    // Group by product
    const productReport = {};
    let totalRevenue = 0;
    let totalPurchaseCost = 0;
    let totalQuantity = 0;
    let totalDiscount = 0;
    let totalMrp = 0;

    for (const item of rows) {
      const sku = item.sku || item.SKU;
      const name = item.name || item.NAME;
      const series = item.series || item.SERIES || 'GENERIC';
      
      if (!productReport[sku]) {
        productReport[sku] = {
          sku: sku,
          name: name,
          series: series,
          quantity: 0,
          total_revenue: 0,
          total_mrp: 0,
          total_discount: 0,
          total_purchase_cost: 0,
          total_profit: 0,
          b2b_quantity: 0,
          b2b_revenue: 0,
          b2c_quantity: 0,
          b2c_revenue: 0,
          avg_selling_price: 0,
          avg_discount: 0
        };
      }

      const revenue = parseFloat(item.final_amount || 0);
      const mrp = parseFloat(item.mrp_price || item.MRP || 0);
      const discount = parseFloat(item.discount_amount || 0);
      const quantity = parseFloat(item.QUANTITY || 1);
      const customerType = (item.customer_type || '').toLowerCase();
      
      // Get purchase price
      const purchasePrice = await getPurchasePrice(item.SERIAL_NUMBER, sku);
      // If no purchase price found, use product's purchase price from purchases table average
      let finalPurchasePrice = purchasePrice;
      if (finalPurchasePrice === 0) {
        // Try to get average purchase price for this SKU
        const avgPurchaseResult = await db.query(
          `SELECT AVG(amount) as avg_amount 
           FROM purchases 
           WHERE TRIM(product_sku) = TRIM($1) 
           AND amount > 0
           AND supplier_name != 'replace'`,
          [sku]
        );
        if (avgPurchaseResult.rows.length > 0 && avgPurchaseResult.rows[0].avg_amount) {
          finalPurchasePrice = parseFloat(avgPurchaseResult.rows[0].avg_amount || 0);
        }
      }

      const profit = revenue - (finalPurchasePrice * quantity);

      productReport[sku].quantity += quantity;
      productReport[sku].total_revenue += revenue;
      productReport[sku].total_mrp += (mrp * quantity);
      productReport[sku].total_discount += discount;
      productReport[sku].total_purchase_cost += (finalPurchasePrice * quantity);
      productReport[sku].total_profit += profit;

      if (customerType === 'b2b' || customerType === 'business') {
        productReport[sku].b2b_quantity += quantity;
        productReport[sku].b2b_revenue += revenue;
      } else {
        productReport[sku].b2c_quantity += quantity;
        productReport[sku].b2c_revenue += revenue;
      }

      totalRevenue += revenue;
      totalPurchaseCost += (finalPurchasePrice * quantity);
      totalQuantity += quantity;
      totalDiscount += discount;
      totalMrp += (mrp * quantity);
    }

    // Calculate averages and format
    const productData = Object.values(productReport).map(product => {
      const avgSellingPrice = product.quantity > 0 ? product.total_revenue / product.quantity : 0;
      const avgDiscount = product.quantity > 0 ? product.total_discount / product.quantity : 0;
      
      return {
        ...product,
        avg_selling_price: parseFloat(avgSellingPrice.toFixed(2)),
        avg_discount: parseFloat(avgDiscount.toFixed(2)),
        total_revenue: parseFloat(product.total_revenue.toFixed(2)),
        total_mrp: parseFloat(product.total_mrp.toFixed(2)),
        total_discount: parseFloat(product.total_discount.toFixed(2)),
        total_purchase_cost: parseFloat(product.total_purchase_cost.toFixed(2)),
        total_profit: parseFloat(product.total_profit.toFixed(2)),
        profit_margin_percent: product.total_revenue > 0
          ? parseFloat((product.total_profit / product.total_revenue * 100).toFixed(2))
          : 0
      };
    });

    const totals = {
      total_quantity: totalQuantity,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      total_mrp: parseFloat(totalMrp.toFixed(2)),
      total_discount: parseFloat(totalDiscount.toFixed(2)),
      total_purchase_cost: parseFloat(totalPurchaseCost.toFixed(2)),
      total_profit: parseFloat((totalRevenue - totalPurchaseCost).toFixed(2)),
      profit_margin_percent: totalRevenue > 0
        ? parseFloat(((totalRevenue - totalPurchaseCost) / totalRevenue * 100).toFixed(2))
        : 0
    };

    res.json({
      products: productData,
      totals
    });
  } catch (err) {
    console.error('GET /reports/water error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
