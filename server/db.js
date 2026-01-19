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

// Create PostgreSQL pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }   // ✅ REQUIRED for Render
    : false                           // ❌ Localhost does NOT use SSL
});

// Log once when connected
pool.on("connect", () => {
  console.log(
    `✅ PostgreSQL connected (${isProduction ? "PRODUCTION" : "LOCAL"})`
  );
});

// Handle unexpected errors
pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error:", err);
  process.exit(1);
});

// Export helper
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
