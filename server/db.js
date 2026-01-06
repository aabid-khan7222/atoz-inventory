// server/db.js
// env file se variables load karo
require("dotenv").config();

// pg se Pool class lo
const { Pool } = require("pg");

// Base config
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
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
