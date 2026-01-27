// server/db.js

// Load environment variables
require("dotenv").config();

const { Pool } = require("pg");

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

// STRICT environment-based database selection
// DO NOT use DATABASE_URL directly - always use environment-specific variables
// This ensures local development uses local DB and production uses production DB
let DATABASE_URL;

if (isProduction) {
  // Production: Use DATABASE_URL_PROD (for Render) or DATABASE_URL (if explicitly set on Render)
  // On Render, DATABASE_URL is set by the platform, so we check that first
  DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_URL_PROD;
  
  if (!DATABASE_URL) {
    console.error("❌ Production mode: DATABASE_URL or DATABASE_URL_PROD must be set");
    process.exit(1);
  }
  console.log("🔵 Using PRODUCTION database connection");
} else {
  // Development: ALWAYS use DATABASE_URL_LOCAL (ignore DATABASE_URL if set)
  // This prevents accidental connection to production database during development
  DATABASE_URL = process.env.DATABASE_URL_LOCAL;
  
  if (!DATABASE_URL) {
    console.error("❌ Development mode: DATABASE_URL_LOCAL must be set in .env file");
    console.error("Example: DATABASE_URL_LOCAL=postgres://postgres:007222@localhost:5432/inventory_db");
    process.exit(1);
  }
  console.log("🟢 Using LOCAL database connection");
  
  // Warn if DATABASE_URL is set in development (might cause confusion)
  if (process.env.DATABASE_URL) {
    console.warn("⚠️  WARNING: DATABASE_URL is set in development mode but will be ignored.");
    console.warn("⚠️  Using DATABASE_URL_LOCAL instead to ensure local database is used.");
  }
}

// Safety check
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

// Create PostgreSQL pool with optimized settings for production stability
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }   // ✅ REQUIRED for Render
    : false,                          // ❌ Localhost does NOT use SSL
  max: 20,                            // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,          // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000,     // Return error after 10 seconds if connection cannot be established
  statement_timeout: 30000,          // Query timeout: 30 seconds (prevents hanging queries)
  query_timeout: 30000,              // Alternative query timeout
  // Additional settings for better connection management
  allowExitOnIdle: false,            // Don't exit when pool is idle (important for Render)
  keepAlive: true,                    // Keep connections alive
  keepAliveInitialDelayMillis: 10000  // Start keepalive after 10 seconds
});

// Track connection state
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = 5;

// Log once when connected
pool.on("connect", (client) => {
  if (!isConnected) {
    console.log(
      `✅ PostgreSQL connected (${isProduction ? "PRODUCTION" : "LOCAL"})`
    );
    isConnected = true;
    connectionRetries = 0;
  }
});

// Handle unexpected errors - don't exit, just log and try to recover
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err.message);
  isConnected = false;
  
  // Don't exit on connection errors - let the pool handle reconnection
  // Only exit on critical errors that can't be recovered
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    connectionRetries++;
    console.warn(`⚠️  Database connection error (attempt ${connectionRetries}/${MAX_RETRIES}). Pool will attempt to reconnect.`);
    
    if (connectionRetries >= MAX_RETRIES) {
      console.error("❌ Max connection retries reached. Server will continue but database operations may fail.");
      // Don't exit - let the application continue and retry on next request
    }
  } else {
    // For other errors, log but don't exit
    console.error("❌ PostgreSQL error details:", {
      code: err.code,
      message: err.message,
      stack: isProduction ? undefined : err.stack
    });
  }
});

// Test connection on startup (non-blocking)
(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log(`✅ Database connection test successful: ${result.rows[0].now}`);
    isConnected = true;
  } catch (error) {
    console.warn(`⚠️  Initial database connection test failed: ${error.message}`);
    console.warn('   The pool will attempt to connect on first query.');
    isConnected = false;
  }
})();

// Enhanced query function with automatic retry on connection errors
const queryWithRetry = async (text, params, retries = 2) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    // Check if it's a connection error that might be recoverable
    const isConnectionError = 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === '57P01' || // Admin shutdown
      error.code === '57P02' || // Crash shutdown
      error.code === '57P03' || // Cannot connect now
      error.message?.includes('Connection terminated') ||
      error.message?.includes('Connection lost');
    
    // Retry connection errors
    if (isConnectionError && retries > 0) {
      console.warn(`⚠️  Database connection error, retrying... (${retries} attempts left)`);
      // Wait a bit before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retries)));
      return queryWithRetry(text, params, retries - 1);
    }
    
    // Re-throw if not a connection error or retries exhausted
    throw error;
  }
};

// Export helper
module.exports = {
  query: queryWithRetry,
  pool,
  // Export direct pool query for cases where retry is not desired
  queryDirect: (text, params) => pool.query(text, params),
};
