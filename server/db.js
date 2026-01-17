// server/db.js

// Load environment variables
require("dotenv").config();

const { Pool } = require("pg");

// Detect environment
const isProduction = process.env.NODE_ENV === "production";

// Decide database URL
// Priority: DATABASE_URL > DATABASE_URL_PROD (production) / DATABASE_URL_LOCAL (development)
const DATABASE_URL = process.env.DATABASE_URL 
  || (isProduction 
    ? process.env.DATABASE_URL_PROD   // Production fallback
    : process.env.DATABASE_URL_LOCAL); // Development fallback

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
