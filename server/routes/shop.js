// GET /api/shop/me — returns shop_id + shop_name for frontend (header, invoice, reports).
// NEVER trust shop_id from frontend — always from JWT via verifyJWT → requireShop.
const express = require("express");
const router = express.Router();
const db = require("../db");
const { verifyJWT, requireShop } = require("../middleware/auth");

router.get("/me", verifyJWT, requireShop, async (req, res) => {
  try {
    const shopId = req.shop_id;
    const result = await db.query(
      `SELECT id, name FROM shops WHERE id = $1`,
      [shopId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shop not found" });
    }
    res.json({
      shop_id: result.rows[0].id,
      shop_name: result.rows[0].name,
    });
  } catch (err) {
    console.error("GET /api/shop/me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
