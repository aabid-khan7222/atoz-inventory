const express = require('express');
const db = require('../db');
const { requireAuth, requireSuperAdminOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper function to get purchase price (same as in reports.js)
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

// Get dashboard overview metrics
router.get('/overview', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { period = 'today' } = req.query; // today, week, month, year
    
    // Calculate date range based on period
    let dateFilter = '';
    let dateParams = [];
    
    if (period === 'today') {
      dateFilter = "DATE(created_at) = CURRENT_DATE";
    } else if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'year') {
      dateFilter = "created_at >= DATE_TRUNC('year', CURRENT_DATE)";
    }

    // Total Inventory Value
    let totalInventoryValue = 0;
    try {
      const { rows } = await db.query(`
        SELECT COALESCE(SUM(qty * COALESCE(selling_price, 0)), 0) as total_value
        FROM products
      `);
      totalInventoryValue = parseFloat(rows[0]?.total_value || 0);
    } catch (err) {
      console.error('Error calculating inventory value:', err.message);
    }

    // Today's Revenue (sales + services)
    let todayRevenue = 0;
    let todayProfit = 0;
    try {
      const todaySalesQuery = `
        SELECT COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        WHERE DATE(si.created_at) = CURRENT_DATE
      `;
      const salesResult = await db.query(todaySalesQuery);
      const todaySalesRevenue = parseFloat(salesResult.rows[0]?.total || 0);
      todayRevenue += todaySalesRevenue;
      
      // Calculate profit for today's sales
      const todayItemsQuery = `
        SELECT si.SERIAL_NUMBER as serial_number, si.SKU as sku, si.final_amount, si.product_id
        FROM sales_item si
        WHERE DATE(si.created_at) = CURRENT_DATE
        LIMIT 500
      `;
      const todayItemsResult = await db.query(todayItemsQuery);
      
      console.log(`[DASHBOARD] Processing ${todayItemsResult.rows.length} items for today's profit calculation`);
      
      let itemsWithPurchasePrice = 0;
      let itemsWithoutPurchasePrice = 0;
      let totalRevenue = 0;
      
      for (const item of todayItemsResult.rows) {
        const revenue = parseFloat(item.final_amount || 0);
        totalRevenue += revenue;
        const serialNum = (item.serial_number || item.SERIAL_NUMBER || '').toString().trim();
        const sku = (item.sku || item.SKU || '').toString().trim();
        
        if (revenue > 0) {
          let purchasePrice = 0;
          
          if (serialNum) {
            purchasePrice = await getPurchasePrice(serialNum, sku);
          }
          
          if (purchasePrice === 0 && sku) {
            purchasePrice = await getPurchasePrice(null, sku);
          }
          
          // If still no purchase price found, try to get from product's selling_price as fallback
          if (purchasePrice === 0 && item.product_id) {
            try {
              const productResult = await db.query(
                `SELECT selling_price, mrp_price FROM products WHERE id = $1`,
                [item.product_id]
              );
              if (productResult.rows.length > 0) {
                // Use 70% of selling price as estimated purchase cost
                const sellingPrice = parseFloat(productResult.rows[0].selling_price || productResult.rows[0].mrp_price || 0);
                if (sellingPrice > 0) {
                  purchasePrice = sellingPrice * 0.7;
                  itemsWithoutPurchasePrice++;
                }
              }
            } catch (err) {
              console.error('Error getting product price:', err);
            }
          } else if (purchasePrice > 0) {
            itemsWithPurchasePrice++;
          }
          
          const profit = revenue - purchasePrice;
          todayProfit += profit;
          
          if (todayItemsResult.rows.length <= 10) {
            console.log(`[DASHBOARD] Item: Serial=${serialNum || 'N/A'}, SKU=${sku || 'N/A'}, Revenue=${revenue}, Purchase=${purchasePrice}, Profit=${profit}`);
          }
        }
      }
      
      console.log(`[DASHBOARD] Total Revenue: ${totalRevenue}, Items with purchase price: ${itemsWithPurchasePrice}, Items without (using fallback): ${itemsWithoutPurchasePrice}, Calculated Profit: ${todayProfit}`);
      
      // Scale profit if we limited results
      const totalCountResult = await db.query(
        `SELECT COUNT(*) as total FROM sales_item si WHERE DATE(si.created_at) = CURRENT_DATE`
      );
      const totalCount = parseInt(totalCountResult.rows[0]?.total || 0);
      const sampleCount = todayItemsResult.rows.length;
      
      if (totalCount > sampleCount && sampleCount > 0 && todayProfit > 0) {
        const scaleFactor = totalCount / sampleCount;
        const scaledProfit = todayProfit * scaleFactor;
        console.log(`[DASHBOARD] Scaling profit: ${todayProfit} * ${scaleFactor.toFixed(2)} = ${scaledProfit.toFixed(2)} (Total items: ${totalCount}, Sample: ${sampleCount})`);
        todayProfit = scaledProfit;
      } else {
        console.log(`[DASHBOARD] No scaling needed. Total items: ${totalCount}, Sample: ${sampleCount}, Profit: ${todayProfit}`);
      }
    } catch (err) {
      if (err.code !== '42P01') { // 42P01 = relation does not exist
        console.error('Error fetching today sales:', err.message);
      }
    }
    
    try {
      const todayServicesQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests
        WHERE DATE(updated_at) = CURRENT_DATE AND status = 'completed' AND amount IS NOT NULL
      `;
      const servicesResult = await db.query(todayServicesQuery);
      const servicesRevenue = parseFloat(servicesResult.rows[0]?.total || 0);
      todayRevenue += servicesRevenue;
      // Service requests amount is pure profit (100% profit as it's service charge)
      todayProfit += servicesRevenue;
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching today service requests:', err.message);
      }
    }

    // Add service requests (customer service bookings) profit
    try {
      const todayServiceRequestsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests
        WHERE DATE(updated_at) = CURRENT_DATE AND status = 'completed' AND amount IS NOT NULL
      `;
      const serviceRequestsResult = await db.query(todayServiceRequestsQuery);
      const serviceRequestsRevenue = parseFloat(serviceRequestsResult.rows[0]?.total || 0);
      todayRevenue += serviceRequestsRevenue;
      // Service requests amount is pure profit (100% profit as it's service charge)
      todayProfit += serviceRequestsRevenue;
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching today service requests:', err.message);
      }
    }

    // Monthly Revenue
    let monthlyRevenue = 0;
    try {
      const monthlySalesQuery = `
        SELECT COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        WHERE si.created_at >= DATE_TRUNC('month', CURRENT_DATE)
      `;
      const monthlySalesResult = await db.query(monthlySalesQuery);
      monthlyRevenue += parseFloat(monthlySalesResult.rows[0]?.total || 0);
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching monthly sales:', err.message);
      }
    }
    
    try {
      const monthlyServicesQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests
        WHERE updated_at >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed' AND amount IS NOT NULL
      `;
      const monthlyServicesResult = await db.query(monthlyServicesQuery);
      monthlyRevenue += parseFloat(monthlyServicesResult.rows[0]?.total || 0);
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching monthly service requests:', err.message);
      }
    }

    // Add service requests (customer service bookings) to monthly revenue
    try {
      const monthlyServiceRequestsQuery = `
        SELECT COALESCE(SUM(amount), 0) as total
        FROM service_requests
        WHERE updated_at >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed' AND amount IS NOT NULL
      `;
      const monthlyServiceRequestsResult = await db.query(monthlyServiceRequestsQuery);
      monthlyRevenue += parseFloat(monthlyServiceRequestsResult.rows[0]?.total || 0);
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching monthly service requests:', err.message);
      }
    }

    // Low Stock Alerts (products with qty < 5)
    let lowStockCount = 0;
    try {
      const { rows } = await db.query(`
        SELECT COUNT(*) as count
        FROM products
        WHERE qty < 5
      `);
      lowStockCount = parseInt(rows[0]?.count || 0);
    } catch (err) {
      console.error('Error checking low stock:', err.message);
    }

    // Pending Services
    let pendingServices = 0;
    try {
      const pendingServicesQuery = `
        SELECT COUNT(*) as count
        FROM service_requests
        WHERE status IN ('pending', 'in_progress')
      `;
      const pendingServicesResult = await db.query(pendingServicesQuery);
      pendingServices = parseInt(pendingServicesResult.rows[0]?.count || 0);
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching pending service requests:', err.message);
      }
    }

    // Total Products Count
    let totalProducts = 0;
    try {
      const { rows } = await db.query(`SELECT COUNT(*) as count FROM products`);
      totalProducts = parseInt(rows[0]?.count || 0);
    } catch (err) {
      console.error('Error counting products:', err.message);
    }

    // Total Customers
    let totalCustomers = 0;
    try {
      const customersQuery = `
        SELECT COUNT(*) as count
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(r.role_name) = 'customer'
      `;
      const customersResult = await db.query(customersQuery);
      totalCustomers = parseInt(customersResult.rows[0]?.count || 0);
    } catch (err) {
      console.error('Error fetching total customers:', err.message);
      // If roles table doesn't exist or join fails, default to 0
      totalCustomers = 0;
    }

    res.json({
      totalInventoryValue: Math.round(totalInventoryValue),
      todayRevenue: Math.round(todayRevenue),
      todayProfit: Math.round(todayProfit),
      monthlyRevenue: Math.round(monthlyRevenue),
      lowStockCount,
      pendingServices,
      totalProducts,
      totalCustomers,
    });
  } catch (err) {
    console.error('GET /dashboard/overview error', err);
    // Return default values instead of crashing
    res.json({
      totalInventoryValue: 0,
      todayRevenue: 0,
      todayProfit: 0,
      monthlyRevenue: 0,
      lowStockCount: 0,
      pendingServices: 0,
      totalProducts: 0,
      totalCustomers: 0,
    });
  }
});

// Get sales analytics
router.get('/sales-analytics', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'year') {
      dateFilter = "created_at >= DATE_TRUNC('year', CURRENT_DATE)";
    }

    // Sales by type (retail vs wholesale)
    let salesByType = [];
    try {
      const salesByTypeQuery = `
        SELECT 
          si.sales_type as sale_type,
          COUNT(DISTINCT si.invoice_number) as count,
          COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
        GROUP BY si.sales_type
      `;
      const salesByTypeResult = await db.query(salesByTypeQuery);
      salesByType = salesByTypeResult.rows.map(row => ({
        type: row.sale_type,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching sales by type:', err.message);
      }
    }

    // Top selling products
    let topProducts = [];
    try {
      const topProductsQuery = `
        SELECT 
          COALESCE(si.NAME, p.name) as product_name,
          si.CATEGORY as product_category,
          SUM(si.QUANTITY) as total_quantity,
          SUM(si.final_amount) as total_revenue
        FROM sales_item si
        LEFT JOIN products p ON si.product_id = p.id
        ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
        GROUP BY COALESCE(si.NAME, p.name), si.CATEGORY
        ORDER BY total_quantity DESC
        LIMIT 10
      `;
      const topProductsResult = await db.query(topProductsQuery);
      topProducts = topProductsResult.rows.map(row => ({
        name: row.product_name,
        category: row.product_category,
        quantity: parseInt(row.total_quantity),
        revenue: parseFloat(row.total_revenue)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching top products:', err.message);
      }
    }

    // Sales trend (daily for last 30 days)
    let salesTrend = [];
    try {
      const salesTrendQuery = `
        SELECT 
          DATE(si.created_at) as date,
          COUNT(DISTINCT si.invoice_number) as count,
          COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        WHERE si.created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(si.created_at)
        ORDER BY date ASC
      `;
      const salesTrendResult = await db.query(salesTrendQuery);
      salesTrend = salesTrendResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching sales trend:', err.message);
      }
    }

    // Category performance
    let categoryPerformance = [];
    try {
      const categoryPerformanceQuery = `
        SELECT 
          si.CATEGORY as product_category,
          SUM(si.QUANTITY) as total_quantity,
          SUM(si.final_amount) as total_revenue
        FROM sales_item si
        ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
        GROUP BY si.CATEGORY
        ORDER BY total_revenue DESC
      `;
      const categoryPerformanceResult = await db.query(categoryPerformanceQuery);
      categoryPerformance = categoryPerformanceResult.rows.map(row => ({
        category: row.product_category,
        quantity: parseInt(row.total_quantity),
        revenue: parseFloat(row.total_revenue)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching category performance:', err.message);
      }
    }

    // Payment methods
    let paymentMethods = [];
    try {
      const paymentMethodsQuery = `
        SELECT 
          si.payment_method,
          COUNT(*) as count,
          COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
        GROUP BY si.payment_method
      `;
      const paymentMethodsResult = await db.query(paymentMethodsQuery);
      paymentMethods = paymentMethodsResult.rows.map(row => ({
        method: row.payment_method || 'unknown',
        count: parseInt(row.count),
        total: parseFloat(row.total)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching payment methods:', err.message);
      }
    }

    res.json({
      salesByType,
      topProducts,
      salesTrend,
      categoryPerformance,
      paymentMethods,
    });
  } catch (err) {
    console.error('GET /dashboard/sales-analytics error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Detailed sales list: per customer, per product, series-wise
router.get('/sales-detail', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { period = 'all' } = req.query;

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "si.purchase_date >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "si.purchase_date >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'year') {
      dateFilter = "si.purchase_date >= DATE_TRUNC('year', CURRENT_DATE)";
    }
    // If period is 'all' or anything else, dateFilter remains empty to show all data

    // Check which columns exist
    const commissionColumnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sales_item'
      AND column_name IN ('has_commission', 'commission_agent_id', 'commission_amount')
    `);
    const commissionColumns = commissionColumnsCheck.rows.map(r => r.column_name);
    const hasCommissionFields = commissionColumns.includes('has_commission') && 
                                commissionColumns.includes('commission_agent_id') && 
                                commissionColumns.includes('commission_amount');
    
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

    // Normalize category server-side to ensure consistent filtering (car-truck-tractor | bike | ups-inverter | other)
    const salesDetailQuery = `
      WITH raw_sales AS (
        SELECT
          si.id AS sale_item_id,
          si.invoice_number,
          si.invoice_number AS sale_id,
          si.customer_name,
          si.customer_mobile_number as customer_phone,
          si.customer_vehicle_number as vehicle_number,
          si.purchase_date as created_at,
          -- capture raw category hints from multiple sources
          LOWER(COALESCE(si.CATEGORY, p.category, pt.name)) as raw_category,
          si.product_id,
          COALESCE(si.SKU, p.sku) as product_sku,
          COALESCE(si.NAME, p.name) as product_name,
          si.SERIAL_NUMBER as product_serial_number,
          COALESCE(si.SERIES, p.series, 'Other') AS series,
          si.QUANTITY as quantity,
          si.MRP as unit_price,
          si.final_amount as total_price,
          ${hasCommissionFields ? `COALESCE(si.has_commission, false) as has_commission,
          COALESCE(si.commission_amount, 0) as commission_amount,` : `false as has_commission,
          0 as commission_amount,`}
          ${hasCommissionAgents ? `ca.name as commission_agent_name,
          ca.mobile_number as commission_agent_mobile` : `NULL as commission_agent_name,
          NULL as commission_agent_mobile`}
        FROM sales_item si
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN product_type pt ON p.product_type_id = pt.id
        ${hasCommissionAgents ? `LEFT JOIN commission_agents ca ON si.commission_agent_id = ca.id` : ''}
        ${dateFilter ? `WHERE ${dateFilter}` : ''}
      )
      SELECT
        sale_item_id,
        invoice_number,
        sale_id,
        customer_name,
        customer_phone,
        vehicle_number,
        created_at,
        CASE
          WHEN raw_category LIKE '%bike%' THEN 'bike'
          WHEN raw_category LIKE '%ups%' OR raw_category LIKE '%inverter%' THEN 'ups-inverter'
          WHEN raw_category LIKE '%car%' OR raw_category LIKE '%truck%' OR raw_category LIKE '%tractor%' THEN 'car-truck-tractor'
          ELSE 'car-truck-tractor' -- default to main category
        END AS product_category,
        product_id,
        product_sku,
        product_name,
        product_serial_number,
        series,
        quantity,
        unit_price,
        total_price,
        has_commission,
        commission_amount,
        commission_agent_name,
        commission_agent_mobile
      FROM raw_sales
      ORDER BY created_at DESC, invoice_number, product_name
    `;

    let items = [];
    try {
      const { rows } = await db.query(salesDetailQuery);
      items = rows.map((row) => ({
        saleId: row.sale_id,
        invoiceNumber: row.invoice_number,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        vehicleNumber: row.vehicle_number || null,
        date: row.created_at,
        category: row.product_category || 'car-truck-tractor',
        productId: row.product_id,
        sku: row.product_sku || 'N/A',
        productName: row.product_name || 'N/A',
        serialNumber: row.product_serial_number || null,
        series: row.series || 'Other',
        quantity: parseInt(row.quantity || 1, 10),
        unitPrice: parseFloat(row.unit_price || 0),
        totalPrice: parseFloat(row.total_price || 0),
        hasCommission: row.has_commission || false,
        commissionAmount: parseFloat(row.commission_amount || 0),
        commissionAgentName: row.commission_agent_name || null,
        commissionAgentMobile: row.commission_agent_mobile || null,
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching detailed sales:', err.message);
      }
    }

    res.json({ items });
  } catch (err) {
    console.error('GET /dashboard/sales-detail error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get inventory insights
router.get('/inventory-insights', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const categories = ['car-truck-tractor', 'bike', 'ups-inverter'];
    const stockByCategory = [];
    const lowStockItems = [];
    let totalStockValue = 0;

    for (const category of categories) {
      const productTypeId = getProductTypeId(category);
      try {
        // Stock by category
        const { rows } = await db.query(`
          SELECT 
            COUNT(*) as product_count,
            COALESCE(SUM(qty), 0) as total_qty,
            COALESCE(SUM(qty * COALESCE(selling_price, 0)), 0) as total_value
          FROM products
          WHERE product_type_id = $1
        `, [productTypeId]);
        
        if (rows[0]) {
          stockByCategory.push({
            category,
            productCount: parseInt(rows[0].product_count),
            totalQty: parseInt(rows[0].total_qty),
            totalValue: parseFloat(rows[0].total_value)
          });
          totalStockValue += parseFloat(rows[0].total_value);
        }

        // Low stock items
        const lowStockRows = await db.query(`
          SELECT id, sku, name, qty, selling_price, category
          FROM products
          WHERE product_type_id = $1 AND qty < 5
          ORDER BY qty ASC
          LIMIT 20
        `, [productTypeId]);
        
        lowStockItems.push(...lowStockRows.rows.map(row => ({
          id: row.id,
          sku: row.sku,
          name: row.name,
          qty: parseInt(row.qty),
          price: parseFloat(row.selling_price || 0),
          category: row.category || category
        })));
      } catch (err) {
        console.error(`Error fetching inventory insights for ${category}:`, err.message);
      }
    }

    res.json({
      stockByCategory,
      lowStockItems,
      totalStockValue: Math.round(totalStockValue),
    });
  } catch (err) {
    console.error('GET /dashboard/inventory-insights error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get service management data
router.get('/services', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    // Service status breakdown
    let statusBreakdown = [];
    try {
      const statusBreakdownQuery = `
        SELECT 
          status,
          COUNT(*) as count
        FROM service_requests
        GROUP BY status
      `;
      const statusBreakdownResult = await db.query(statusBreakdownQuery);
      statusBreakdown = statusBreakdownResult.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching service request status breakdown:', err.message);
      }
    }

    // Services by type
    let servicesByType = [];
    try {
      const servicesByTypeQuery = `
        SELECT 
          service_type,
          COUNT(*) as count,
          COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND amount IS NOT NULL), 0) as total_revenue
        FROM service_requests
        GROUP BY service_type
      `;
      const servicesByTypeResult = await db.query(servicesByTypeQuery);
      servicesByType = servicesByTypeResult.rows.map(row => ({
        type: row.service_type,
        count: parseInt(row.count),
        revenue: parseFloat(row.total_revenue)
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching service requests by type:', err.message);
      }
    }

    // Active services (pending + in_progress)
    let activeServices = [];
    try {
      const activeServicesQuery = `
        SELECT 
          id, customer_name, service_type, 
          status, amount, created_at
        FROM service_requests
        WHERE status IN ('pending', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 20
      `;
      const activeServicesResult = await db.query(activeServicesQuery);
      activeServices = activeServicesResult.rows.map(row => ({
        id: row.id,
        serviceNumber: `SR-${row.id}`,
        customerName: row.customer_name,
        serviceType: row.service_type,
        status: row.status,
        charge: parseFloat(row.amount || 0),
        createdAt: row.created_at
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching active service requests:', err.message);
      }
    }

    // Service revenue (today, week, month)
    let serviceRevenue = { today: { count: 0, revenue: 0 }, week: { count: 0, revenue: 0 }, month: { count: 0, revenue: 0 } };
    try {
      const serviceRevenueQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE DATE(updated_at) = CURRENT_DATE AND status = 'completed' AND amount IS NOT NULL) as today_count,
          COALESCE(SUM(amount) FILTER (WHERE DATE(updated_at) = CURRENT_DATE AND status = 'completed' AND amount IS NOT NULL), 0) as today_revenue,
          COUNT(*) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'completed' AND amount IS NOT NULL) as week_count,
          COALESCE(SUM(amount) FILTER (WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days' AND status = 'completed' AND amount IS NOT NULL), 0) as week_revenue,
          COUNT(*) FILTER (WHERE updated_at >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed' AND amount IS NOT NULL) as month_count,
          COALESCE(SUM(amount) FILTER (WHERE updated_at >= DATE_TRUNC('month', CURRENT_DATE) AND status = 'completed' AND amount IS NOT NULL), 0) as month_revenue
        FROM service_requests
      `;
      const serviceRevenueResult = await db.query(serviceRevenueQuery);
      if (serviceRevenueResult.rows[0]) {
        serviceRevenue = {
          today: {
            count: parseInt(serviceRevenueResult.rows[0].today_count),
            revenue: parseFloat(serviceRevenueResult.rows[0].today_revenue)
          },
          week: {
            count: parseInt(serviceRevenueResult.rows[0].week_count),
            revenue: parseFloat(serviceRevenueResult.rows[0].week_revenue)
          },
          month: {
            count: parseInt(serviceRevenueResult.rows[0].month_count),
            revenue: parseFloat(serviceRevenueResult.rows[0].month_revenue)
          }
        };
      }
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching service request revenue:', err.message);
      }
    }

    res.json({
      statusBreakdown,
      servicesByType,
      activeServices,
      serviceRevenue,
    });
  } catch (err) {
    console.error('GET /dashboard/services error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get recent transactions
router.get('/recent-transactions', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Recent sales - using sales_item table grouped by invoice_number
    let recentSales = [];
    try {
      const recentSalesQuery = `
        SELECT 
          si.invoice_number as id,
          si.invoice_number,
          si.customer_name,
          si.sales_type as sale_type,
          MIN(si.created_at) as created_at,
          COALESCE(SUM(si.final_amount), 0) as final_amount,
          MAX(si.payment_status) as payment_status
        FROM sales_item si
        GROUP BY si.invoice_number, si.customer_name, si.sales_type
        ORDER BY MIN(si.created_at) DESC
        LIMIT $1
      `;
      const recentSalesResult = await db.query(recentSalesQuery, [limit]);
      recentSales = recentSalesResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: row.invoice_number,
        customerName: row.customer_name,
        type: row.sale_type || 'retail',
        amount: parseFloat(row.final_amount || 0),
        paymentStatus: row.payment_status || 'paid',
        createdAt: row.created_at,
        transactionType: 'sale'
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching recent sales:', err.message);
      }
    }

    // Recent services
    let recentServices = [];
    try {
      const recentServicesQuery = `
        SELECT 
          id, customer_name, service_type, 
          amount, status, created_at
        FROM service_requests
        ORDER BY created_at DESC
        LIMIT $1
      `;
      const recentServicesResult = await db.query(recentServicesQuery, [limit]);
      recentServices = recentServicesResult.rows.map(row => ({
        id: row.id,
        invoiceNumber: `SR-${row.id}`,
        customerName: row.customer_name,
        type: row.service_type,
        amount: parseFloat(row.amount || 0),
        paymentStatus: row.status,
        createdAt: row.created_at,
        transactionType: 'service'
      }));
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching recent service requests:', err.message);
      }
    }

    // Combine and sort by date
    const allTransactions = [...recentSales, ...recentServices]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    res.json(allTransactions);
  } catch (err) {
    console.error('GET /dashboard/recent-transactions error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Get financial overview
router.get('/financial', requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    } else if (period === 'year') {
      dateFilter = "created_at >= DATE_TRUNC('year', CURRENT_DATE)";
    }

    // Revenue breakdown
    let revenueBreakdown = { sales: 0, services: 0, total: 0 };
    try {
      let salesRevenue = 0;
      try {
        const salesQuery = `
          SELECT COALESCE(SUM(si.final_amount), 0) as total 
          FROM sales_item si
          ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
        `;
        const salesResult = await db.query(salesQuery);
        salesRevenue = parseFloat(salesResult.rows[0]?.total || 0);
      } catch (err) {
        if (err.code !== '42P01') {
          console.error('Error fetching sales revenue:', err.message);
        }
      }

      let servicesRevenue = 0;
      try {
        const servicesQuery = `SELECT COALESCE(SUM(amount), 0) as total FROM service_requests ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'updated_at')} AND status = 'completed' AND amount IS NOT NULL` : 'WHERE status = \'completed\' AND amount IS NOT NULL'}`;
        const servicesResult = await db.query(servicesQuery);
        servicesRevenue = parseFloat(servicesResult.rows[0]?.total || 0);
      } catch (err) {
        if (err.code !== '42P01') {
          console.error('Error fetching service requests revenue:', err.message);
        }
      }

      revenueBreakdown = {
        sales: salesRevenue,
        services: servicesRevenue,
        total: salesRevenue + servicesRevenue
      };
    } catch (err) {
      console.error('Error calculating revenue breakdown:', err.message);
    }

    // Outstanding receivables
    let outstandingReceivables = 0;
    try {
      const outstandingQuery = `
        SELECT COALESCE(SUM(si.final_amount), 0) as total
        FROM sales_item si
        WHERE si.payment_status IN ('pending', 'partial')
      `;
      const outstandingResult = await db.query(outstandingQuery);
      outstandingReceivables = parseFloat(outstandingResult.rows[0]?.total || 0);
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error fetching outstanding receivables:', err.message);
      }
    }

    // Profit analysis (simplified - would need purchase cost data)
    // For now, we'll calculate based on a rough margin estimate
    let estimatedProfit = 0;
    let revenue = 0;
    try {
      const profitQuery = `
        SELECT 
          COALESCE(SUM(si.final_amount), 0) as revenue
        FROM sales_item si
        ${dateFilter ? `WHERE ${dateFilter.replace('created_at', 'si.created_at')}` : ''}
      `;
      const profitResult = await db.query(profitQuery);
      revenue = parseFloat(profitResult.rows[0]?.revenue || 0);
      // Assuming 20% profit margin (this should be calculated from actual purchase costs)
      estimatedProfit = revenue * 0.2;
    } catch (err) {
      if (err.code !== '42P01') {
        console.error('Error calculating profit:', err.message);
      }
    }

    res.json({
      revenueBreakdown,
      outstandingReceivables: Math.round(outstandingReceivables),
      estimatedProfit: Math.round(estimatedProfit),
      estimatedProfitMargin: 20, // This should be calculated from actual data
    });
  } catch (err) {
    console.error('GET /dashboard/financial error', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

module.exports = router;

