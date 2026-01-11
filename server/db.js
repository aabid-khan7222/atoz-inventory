// server/db.js
// env file se variables load karo
require("dotenv").config();

// pg se Pool class lo
const { Pool } = require("pg");

// Determine which database URL to use based on environment
// Production: Use DATABASE_URL (standard for deployment platforms like Render/Railway)
// Development: Use DATABASE_URL
const getDatabaseUrl = () => {
  // Use DATABASE_URL in both development and production
  // Most deployment platforms (Render, Railway, etc.) set DATABASE_URL directly
  // If DATABASE_URL_PROD is explicitly set, use it (for backward compatibility)
  const dbUrl = process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not set!");
    throw new Error("DATABASE_URL environment variable is required");
  }
  
  return dbUrl;
};

// Base config
const poolConfig = {
  connectionString: getDatabaseUrl(),
};

// ✅ Render / Railway / Production PostgreSQL requires SSL
if (process.env.NODE_ENV === "production") {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

// Create pool
const pool = new Pool(poolConfig);

// Optional: test connection once (helps debugging)
pool.on("connect", () => {
  console.log("✅ PostgreSQL connected successfully");
});

pool.on("error", (err) => {
  console.error("❌ PostgreSQL pool error", err);
  process.exit(1);
});

// helper: db.query(sql, params)
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
