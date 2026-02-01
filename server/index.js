// index.js
require("dotenv").config();

// Verify Puppeteer Chrome installation on startup (non-blocking)
(async () => {
  try {
    const puppeteer = require('puppeteer');
    const fs = require('fs');
    
    // Set cache directory for Render.com
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || (process.env.HOME ? `${process.env.HOME}/.cache/puppeteer` : '/opt/render/.cache/puppeteer');
    if (cacheDir && !process.env.PUPPETEER_CACHE_DIR) {
      process.env.PUPPETEER_CACHE_DIR = cacheDir;
    }
    
    // Check if Chrome exists
    let chromeFound = false;
    try {
      const executablePath = puppeteer.executablePath();
      if (executablePath && fs.existsSync(executablePath)) {
        chromeFound = true;
        console.log('✓ Puppeteer Chrome found at:', executablePath);
      }
    } catch (e) {
      // Chrome not found via executablePath
    }
    
    if (!chromeFound) {
      console.warn('⚠ Puppeteer Chrome not found. Attempting installation...');
      try {
        const { execSync } = require('child_process');
        execSync('npx puppeteer browsers install chrome', { stdio: 'inherit', timeout: 180000 });
        console.log('✓ Chrome installation completed');
      } catch (installError) {
        console.warn('⚠ Chrome installation failed:', installError.message);
        console.warn('   PDF generation will attempt to download Chrome on first request.');
      }
    }
  } catch (error) {
    console.warn('⚠ Puppeteer verification skipped:', error.message);
  }
})();

// Check email configuration on startup
console.log('\n📧 Email Configuration Check:');
const emailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
const emailPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.replace(/\s/g, '').trim();
const isProduction = process.env.NODE_ENV === 'production';

if (emailUser && emailPassword) {
  console.log('✅ Gmail SMTP configuration found:');
  console.log('   User:', emailUser);
  console.log('   Password length:', emailPassword.length, 'characters');
  if (emailPassword.length !== 16) {
    console.warn('⚠️  Warning: Gmail App Password should be 16 characters. Current length:', emailPassword.length);
    console.warn('   Make sure there are NO SPACES in GMAIL_APP_PASSWORD');
  }
  if (isProduction) {
    console.warn('⚠️  NOTE: Render free tier blocks SMTP ports (25, 465, 587)');
    console.warn('   Gmail SMTP may timeout on Render free tier. Consider:');
    console.warn('   - Upgrading to Render paid plan, OR');
    console.warn('   - Using a VPS (DigitalOcean, AWS EC2, etc.)');
  }
} else {
  console.error('❌ Gmail SMTP configuration missing:');
  console.error('   GMAIL_USER:', emailUser ? 'SET' : 'NOT SET');
  console.error('   GMAIL_APP_PASSWORD:', emailPassword ? 'SET' : 'NOT SET');
  console.error('   Please set GMAIL_USER and GMAIL_APP_PASSWORD in environment variables');
  console.error('   Get App Password from: https://myaccount.google.com/apppasswords');
}
console.log('');

const express = require("express");
const cors = require("cors");
const compression = require("compression");

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
const shopSettingsRouter = require("./routes/shopSettings");
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
const cleanBadPurchasesRouter = require("./routes/clean-bad-purchases");
const dbCheckRouter = require("./routes/db-check");

const app = express();

// Gzip responses to reduce payload size (helps when many users load at once)
app.use(compression());

// Increase body size limit for large migrations (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ================== CORS CONFIGURATION ==================

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : [];

// Default allowed origins (for development and common production URLs)
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://atoz-frontend.onrender.com',
  'https://atoz-inventory-frontend.onrender.com'
];

// Combine environment and default origins
const allAllowedOrigins = [...new Set([...defaultAllowedOrigins, ...allowedOrigins])];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow server-to-server / Postman requests (no origin)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allAllowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In production, be strict; in development, allow localhost
      const isProduction = process.env.NODE_ENV === 'production';
      if (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      console.warn(`[CORS] Blocked origin: ${origin}`);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);


/* ================== ROOT ROUTES (Must be first) ================== */
app.get("/", (req, res) => {
  res.send("A TO Z Inventory Backend is running 🚀");
});

app.get("/health", async (req, res) => {
  try {
    // Quick database health check (non-blocking, with timeout)
    let dbStatus = "unknown";
    try {
      const db = require('./db');
      const healthCheckPromise = db.query('SELECT NOW()');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
      );
      
      await Promise.race([healthCheckPromise, timeoutPromise]);
      dbStatus = "connected";
    } catch (dbError) {
      dbStatus = "disconnected";
      console.warn('[Health Check] Database check failed:', dbError.message);
    }
    
    res.status(200).json({
      status: "OK",
      service: "A TO Z Inventory Backend",
      database: dbStatus,
      time: new Date().toISOString()
    });
  } catch (error) {
    // Even if health check fails, return 200 to indicate server is running
    res.status(200).json({
      status: "OK",
      service: "A TO Z Inventory Backend",
      database: "unknown",
      time: new Date().toISOString(),
      warning: "Health check incomplete"
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    // Quick database health check (non-blocking, with timeout)
    let dbStatus = "unknown";
    try {
      const db = require('./db');
      const healthCheckPromise = db.query('SELECT NOW()');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 3000)
      );
      
      await Promise.race([healthCheckPromise, timeoutPromise]);
      dbStatus = "connected";
    } catch (dbError) {
      dbStatus = "disconnected";
      console.warn('[Health Check] Database check failed:', dbError.message);
    }
    
    res.json({ 
      ok: true, 
      status: "OK", 
      service: "A TO Z Inventory Backend",
      database: dbStatus
    });
  } catch (error) {
    // Even if health check fails, return 200 to indicate server is running
    res.json({
      ok: true,
      status: "OK",
      service: "A TO Z Inventory Backend",
      database: "unknown",
      warning: "Health check incomplete"
    });
  }
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
app.use("/api/shop-settings", shopSettingsRouter);
app.use("/api/guarantee-warranty", guaranteeWarrantyRouter);
app.use("/api/charging-services", chargingServicesRouter);
app.use("/api/service-requests", serviceRequestsRouter);
app.use("/api/company-returns", companyReturnsRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/commission-agents", commissionAgentsRouter);
app.use("/api/employees", employeesRouter);

/* ================== MAINTENANCE/UTILITY ROUTES ================== */
/* 
 * These routes are maintenance utilities and are NOT called from the frontend.
 * They are kept active for:
 * - Database initialization and migrations
 * - Data repair and cleanup operations
 * - Database health checks and debugging
 * 
 * If you need to disable them, comment out the routes below.
 * They pose no security risk as they're not exposed to frontend users.
 */
app.use("/api", initRouter); // Database initialization endpoint (GET/POST /api/init)
app.use("/api", migrateDataRouter); // Data migration endpoint (POST /api/migrate-data)
app.use("/api", migrateDataBatchRouter); // Batch migration endpoint (POST /api/migrate-data-batch)
app.use("/api", fixPurchasesDataRouter); // Fix purchases data endpoint (POST /api/fix-purchases-data)
app.use("/api", cleanBadPurchasesRouter); // Clean bad purchases endpoint (POST /api/clean-bad-purchases)
app.use("/api", dbCheckRouter); // Database check endpoint (GET /api/db-check)







// Scheduled task to check for expiring guarantees daily (optimized: no N+1, limited scan)
const checkExpiringGuaranteesDaily = async () => {
  try {
    const db = require('./db');
    const { createNotification } = require('./routes/notifications');

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
      return { guaranteeMonths, warrantyMonths, totalMonths: guaranteeMonths + warrantyMonths };
    }

    const daysAhead = 7;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    // Limit scan: only items purchased in last 3 years (typical max warranty)
    const cutoffDate = new Date(now);
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 3);

    const salesItemsResult = await db.query(
      `SELECT si.id, si.customer_id, si.customer_name, si.customer_mobile_number,
              si.SERIAL_NUMBER, si.invoice_number, si.purchase_date,
              si.WARRANTY as sales_item_warranty, p.name as product_name,
              p.warranty as product_warranty, p.guarantee_period_months
       FROM sales_item si
       JOIN products p ON si.product_id = p.id
       WHERE si.purchase_date IS NOT NULL AND si.purchase_date >= $1
       ORDER BY si.purchase_date DESC`,
      [cutoffDate]
    );

    const expiringSerials = [];
    const expiringMap = new Map();
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

      if (daysUntilExpiration >= 0 && daysUntilExpiration <= daysAhead && item.SERIAL_NUMBER) {
        expiringSerials.push(item.SERIAL_NUMBER);
        expiringMap.set(item.SERIAL_NUMBER, { ...item, daysUntilExpiration, guaranteeEndDate });
      }
    }

    if (expiringSerials.length === 0) return;

    // Batch: which serials are already replaced
    const replaced = new Set();
    const repRes = await db.query(
      `SELECT original_serial_number FROM battery_replacements WHERE original_serial_number = ANY($1)`,
      [expiringSerials]
    );
    repRes.rows.forEach((r) => replaced.add(r.original_serial_number));

    // Batch: which serials we already notified today
    const notifiedToday = new Set();
    const notifRes = await db.query(
      `SELECT message FROM notifications
       WHERE title = 'Guarantee Expiring Soon' AND created_at >= $1`,
      [todayStart]
    );
    for (const r of notifRes.rows) {
      const m = r.message || '';
      for (const sn of expiringSerials) {
        if (m.includes(sn)) notifiedToday.add(sn);
      }
    }

    const adminUsers = await db.query(
      `SELECT id FROM users WHERE role_id IN (1, 2) AND is_active = true`
    );
    const adminUserIds = adminUsers.rows.map((u) => u.id);
    if (adminUserIds.length === 0) return;

    const toNotify = [];
    const seen = new Set();
    for (const sn of expiringSerials) {
      if (replaced.has(sn) || notifiedToday.has(sn) || seen.has(sn)) continue;
      seen.add(sn);
      const item = expiringMap.get(sn);
      if (!item) continue;
      toNotify.push(item);
    }

    for (const item of toNotify) {
      const daysText = item.daysUntilExpiration === 0 ? 'today'
        : item.daysUntilExpiration === 1 ? 'in 1 day'
        : `in ${item.daysUntilExpiration} days`;
      const expirationDateStr = item.guaranteeEndDate.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
      await createNotification(
        adminUserIds,
        'Guarantee Expiring Soon',
        `Customer ${item.customer_name} (${item.customer_mobile_number}) - Battery ${item.SERIAL_NUMBER} (${item.product_name}) guarantee expires ${daysText} (${expirationDateStr}). Invoice: ${item.invoice_number}`,
        'warning',
        null
      );
    }

    if (toNotify.length > 0) {
      console.log(`[Scheduled Task] Expiring guarantees: ${toNotify.length} notified`);
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
// Defer scheduled task initialization to avoid blocking server startup
const DAILY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

// Start scheduled task after server is listening (non-blocking)
setTimeout(() => {
  setInterval(checkExpiringGuaranteesDaily, DAILY_INTERVAL);
  console.log("Scheduled task: Checking for expiring guarantees daily");
}, 5000); // Start 5 seconds after server starts

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

// Start server immediately - don't wait for database or other operations
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Health check available at http://localhost:${PORT}/health`);
});

// Handle server errors gracefully
server.on('error', (err) => {
  console.error('❌ Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
