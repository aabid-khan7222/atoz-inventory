// server/db.js
// env file se variables load karo
require("dotenv").config();

// pg se Pool class lo
const { Pool } = require("pg");

// Determine which database URL to use based on environment
// Production: Use DATABASE_URL_PROD if set, otherwise fall back to DATABASE_URL
// Development: Use DATABASE_URL
const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "production") {
    // Production environment - prefer DATABASE_URL_PROD, fallback to DATABASE_URL
    return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL;
  } else {
    // Development environment - use DATABASE_URL
    return process.env.DATABASE_URL;
  }
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
