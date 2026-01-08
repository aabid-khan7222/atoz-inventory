// index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const productsRouter = require("./routes/products");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/admin");
const usersRouter = require("./routes/users");
const inventoryRouter = require("./routes/inventory");
const dashboardRouter = require("./routes/dashboard");
const salesRouter = require("./routes/sales");
const adminSalesRouter = require("./routes/adminSales");
const notificationsRouter = require("./routes/notifications");
const salesTypesRouter = require("./routes/salesTypes");
const purchasesRouter = require("./routes/purchases");
const invoicesRouter = require("./routes/invoices");
const guaranteeWarrantyRouter = require("./routes/guaranteeWarranty");
const chargingServicesRouter = require("./routes/chargingServices");
const serviceRequestsRouter = require("./routes/serviceRequests");
const companyReturnsRouter = require("./routes/companyReturns");
const reportsRouter = require("./routes/reports");
const commissionAgentsRouter = require("./routes/commissionAgents");
const employeesRouter = require("./routes/employees");
const initRouter = require("./routes/init");
const migrateDataRouter = require("./routes/migrate-data");
const migrateDataBatchRouter = require("./routes/migrate-data-batch");
const fixPurchasesDataRouter = require("./routes/fix-purchases-data");

const app = express();

// Increase body size limit for large migrations (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS configuration - supports both localhost and production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

// Add frontend production URL to allowed origins
if (process.env.NODE_ENV === 'production') {
  allowedOrigins.push('https://atoz-frontend.onrender.com');
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, check against allowed origins
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } 
    // Allow localhost origins for data migration (temporary)
    else if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('file://')) {
      console.log(`Allowing migration from: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

/* ================== ROOT ROUTES (Must be first) ================== */
app.get("/", (req, res) => {
  res.send("A TO Z Inventory Backend is running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    service: "A TO Z Inventory Backend",
    time: new Date().toISOString()
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "OK", service: "A TO Z Inventory Backend" });
});

/* ================== API ROUTES ================== */
app.use("/api/products", productsRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/sales", salesRouter);
app.use("/api/admin-sales", adminSalesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/sales-types", salesTypesRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/invoices", invoicesRouter);
app.use("/api/guarantee-warranty", guaranteeWarrantyRouter);
app.use("/api/charging-services", chargingServicesRouter);
app.use("/api/service-requests", serviceRequestsRouter);
app.use("/api/company-returns", companyReturnsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/commission-agents", commissionAgentsRouter);
app.use("/api/employees", employeesRouter);
app.use("/api", initRouter);
app.use("/api", migrateDataRouter);
app.use("/api", migrateDataBatchRouter);
app.use("/api", fixPurchasesDataRouter);







// Scheduled task to check for expiring guarantees daily
// This runs every 24 hours (86400000 ms)
const checkExpiringGuaranteesDaily = async () => {
  try {
    const db = require('./db');
    const { createNotification } = require('./routes/notifications');
    
    // Helper function to parse warranty string (same as in guaranteeWarranty.js)
    function parseWarrantyString(warrantyString) {
      if (!warrantyString || typeof warrantyString !== 'string') {
        return { guaranteeMonths: 0, warrantyMonths: 0, totalMonths: 0 };
      }
      const warrantyMatch = warrantyString.match(/(\d+)F(?:\+(\d+)P)?/);
      if (!warrantyMatch) {
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

    const daysAhead = 7; // Check for guarantees expiring in the next 7 days
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
    const notifiedSerialNumbers = new Set();

    for (const item of salesItemsResult.rows) {
      const warrantyString = item.sales_item_warranty || item.product_warranty || '';
      const warrantyInfo = parseWarrantyString(warrantyString);
      const guaranteeMonths = warrantyInfo.guaranteeMonths > 0 
        ? warrantyInfo.guaranteeMonths 
        : (item.guarantee_period_months || 0);

      if (guaranteeMonths === 0) continue;

      const purchaseDate = new Date(item.purchase_date);
      const guaranteeEndDate = new Date(purchaseDate);
      guaranteeEndDate.setMonth(guaranteeEndDate.getMonth() + guaranteeMonths);

      const daysUntilExpiration = Math.ceil((guaranteeEndDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiration >= 0 && daysUntilExpiration <= daysAhead) {
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

    // Create notifications for expiring guarantees (only if not already notified today)
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

      // Check if we already notified about this today (avoid duplicate notifications)
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const existingNotification = await db.query(
        `SELECT id FROM notifications 
         WHERE user_id = ANY($1) 
         AND title = 'Guarantee Expiring Soon'
         AND message LIKE $2
         AND created_at >= $3
         LIMIT 1`,
        [
          adminUserIds,
          `%${item.SERIAL_NUMBER}%`,
          todayStart
        ]
      );

      if (existingNotification.rows.length === 0 && adminUserIds.length > 0) {
        await createNotification(
          adminUserIds,
          'Guarantee Expiring Soon',
          `Customer ${item.customer_name} (${item.customer_mobile_number}) - Battery ${item.SERIAL_NUMBER} (${item.product_name}) guarantee expires ${daysText} (${expirationDateStr}). Invoice: ${item.invoice_number}`,
          'warning',
          null
        );
      }
    }

    if (expiringItems.length > 0) {
      console.log(`[Scheduled Task] Checked expiring guarantees: ${expiringItems.length} guarantees expiring within ${daysAhead} days`);
    }
  } catch (error) {
    console.error('[Scheduled Task] Error checking expiring guarantees:', error);
  }
};

// Run the check immediately on server start (optional, can be removed if desired)
// Currently commented out because the scheduled task (setInterval below) handles this automatically
// Uncomment this line if you want to run the check immediately on server startup in addition to the scheduled runs
// checkExpiringGuaranteesDaily();

// Schedule the check to run daily at midnight (or adjust interval as needed)
// For testing, you can use a shorter interval like 60000 (1 minute)
const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

setInterval(checkExpiringGuaranteesDaily, DAILY_INTERVAL);
console.log("Scheduled task: Checking for expiring guarantees daily");

/* ================== 404 HANDLER ================== */
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      "GET /",
      "GET /health",
      "GET /api/health",
      "GET /api/products",
      "POST /api/auth/login",
      "GET /api/dashboard/overview"
    ]
  });
});

/* ================== ERROR HANDLER ================== */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
