// GET /api/shop/me — returns shop_id + shop_name for frontend (header, invoice, reports).
// NEVER trust shop_id from frontend — always from JWT via verifyJWT → requireShop.
const express = require("express");
const router = express.Router();
const { verifyJWT, requireShop } = require("../middleware/auth");

router.get("/me", verifyJWT, requireShop, async (req, res) => {
  try {
    res.json({
      shop_id: 1,
      shop_name: "A To Z Battery",
    });
  } catch (err) {
    console.error("GET /api/shop/me error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
