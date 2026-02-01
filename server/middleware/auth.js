// server/middleware/auth.js
// Multi-shop: ALL protected routes MUST use verifyJWT → requireShop.
// shop_id is ALWAYS from JWT (never from frontend). Data isolation is enforced by
// filtering every query with WHERE shop_id = req.shop_id.
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Create JWT from a user row. Payload MUST include user_id, shop_id, role_id, user_type.
function signAuthToken(user) {
  if (!JWT_SECRET || JWT_SECRET === "dev-secret-change-me") {
    console.warn("WARNING: JWT_SECRET is using default value. Set JWT_SECRET in environment variables for production!");
  }

  const payload = {
    user_id: Number(user.id),
    shop_id: user.shop_id != null ? Number(user.shop_id) : 1,
    role_id: Number(user.role_id) || 3,
    user_type: user.user_type || (Number(user.role_id) <= 2 ? "admin" : "b2c"),
    // Keep for backward compatibility
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    ...(user.role_name && { role_name: user.role_name }),
  };

  try {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  } catch (error) {
    console.error("signAuthToken error:", error);
    throw new Error("Failed to generate authentication token");
  }
}

// Try to attach user if a token is present. Does not block unauthenticated requests.
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (bearerToken || (req.cookies && req.cookies.token)) {
      const token = bearerToken || req.cookies.token;
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      req.user_id = Number(decoded.user_id ?? decoded.id);
      req.shop_id = decoded.shop_id != null ? Number(decoded.shop_id) : null;
      req.role_id = Number(decoded.role_id) || 0;
      req.user_type = decoded.user_type || "b2c";
    }
  } catch (err) {
    // Swallow errors here so optional auth does not block the request path.
    console.warn("[optionalAuth] Token present but invalid:", err.message);
  }

  next();
}

// verifyJWT: Verifies token, extracts shop_id, attaches req.user_id, req.shop_id, req.role_id, req.user_type.
// NEVER trust shop_id from frontend — always from JWT.
function verifyJWT(req, res, next) {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    if (!decoded || (decoded.user_id == null && decoded.id == null) || typeof decoded.role_id === "undefined") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = decoded;
    req.user_id = Number(decoded.user_id ?? decoded.id);
    req.shop_id = decoded.shop_id != null ? Number(decoded.shop_id) : null;
    req.role_id = Number(decoded.role_id) || 0;
    req.user_type = decoded.user_type || "b2c";

    if (process.env.NODE_ENV !== "production") {
      console.log("[verifyJWT] shop_id:", req.shop_id, "user_id:", req.user_id);
    }
    next();
  } catch (err) {
    console.error("[verifyJWT] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// requireAuth: alias for verifyJWT (backward compatibility)
const requireAuth = verifyJWT;

// requireShop: MUST run after verifyJWT. Rejects if shop_id missing (401).
// No API should work without shop context — prevents cross-shop data access.
function requireShop(req, res, next) {
  if (req.shop_id == null || req.shop_id === undefined) {
    return res.status(401).json({
      error: "Shop context required",
      details: "Your session does not have shop context. Please log in again.",
    });
  }
  next();
}

// Role helper
const requireRole = (minRoleId) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('[requireRole] No user in request');
      return res.status(401).json({ error: "Authentication required" });
    }

    const roleId = Number(req.user.role_id) || 0;
    console.log(`[requireRole] User role_id: ${roleId}, required: ${minRoleId}, user:`, req.user.email || req.user.id);

    if (roleId < minRoleId) {
      console.log(`[requireRole] Access denied: role_id ${roleId} < ${minRoleId}`);
      return res.status(403).json({ error: "Forbidden", details: `Role ID ${roleId} is less than required ${minRoleId}` });
    }

    next();
  };
};

// requireAdmin: Allow Super Admin (role_id = 1) OR Admin (role_id = 2)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    console.log('[requireAdmin] No user in request');
    return res.status(401).json({ error: "Authentication required" });
  }

  const roleId = Number(req.user.role_id) || 0;
  console.log(`[requireAdmin] User role_id: ${roleId}, user:`, req.user.email || req.user.id);

  // Allow Super Admin (role_id = 1) or Admin (role_id = 2)
  if (roleId !== 1 && roleId !== 2) {
    console.log(`[requireAdmin] Access denied: role_id ${roleId} is not 1 (Super Admin) or 2 (Admin)`);
    return res.status(403).json({ error: "Forbidden", details: `Role ID ${roleId} is not authorized. Admin or Super Admin access required.` });
  }

  next();
};

// TODO: Currently unused - may be useful in future for routes requiring ONLY Super Admin (not Admin)
// const requireSuperAdmin = requireRole(1);

// requireShopId: alias for requireShop (backward compatibility)
const requireShopId = requireShop;

// requireSuperAdmin: ONLY role_id = 1
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  if (Number(req.role_id) !== 1) return res.status(403).json({ error: "Forbidden" });
  next();
};

// Allow Super Admin (role_id = 1) OR Admin (role_id >= 2)
const requireSuperAdminOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const roleId = Number(req.user.role_id) || 0;

  // Allow Super Admin (role_id = 1) or Admin and above (role_id >= 2)
  if (roleId !== 1 && roleId < 2) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};

module.exports = {
  signAuthToken,
  verifyJWT,
  requireAuth,
  optionalAuth,
  requireShop,
  requireShopId,
  requireRole,
  requireAdmin,
  requireSuperAdmin,
  requireSuperAdminOrAdmin,
};
