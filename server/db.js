// db.js
// .env file se variables load karo
require('dotenv').config();

// pg se Pool class lo
const { Pool } = require('pg');

// PostgreSQL se connection banao
// Render PostgreSQL requires SSL connections in production
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

// Enable SSL for production (Render, Railway, etc.)
// In development, SSL is optional
if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com') || process.env.DATABASE_URL?.includes('railway.app')) {
  poolConfig.ssl = {
    rejectUnauthorized: false // Required for Render/Railway PostgreSQL
  };
}

const pool = new Pool(poolConfig);

// helper: db.query(sql, params) use karenge
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};