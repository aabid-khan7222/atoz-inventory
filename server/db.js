// db.js
// .env file se variables load karo
require('dotenv').config();

// pg se Pool class lo
const { Pool } = require('pg');

// PostgreSQL se connection banao
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// helper: db.query(sql, params) use karenge
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};