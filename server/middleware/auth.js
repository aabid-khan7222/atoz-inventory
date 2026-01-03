// server/middleware/auth.js
const jwt = require("jsonwebtoken");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Create JWT from a user row
function signAuthToken(user) {
  const payload = {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    // force number so role checks are reliable
    role_id: Number(user.role_id) || 3,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Try to attach user if a token is present. Does not block unauthenticated requests.
function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (bearerToken) {
      const decoded = jwt.verify(bearerToken, JWT_SECRET);
      req.user = decoded;
    } else if (req.cookies && req.cookies.token) {
      const decoded = jwt.verify(req.cookies.token, JWT_SECRET);
      req.user = decoded;
    }
  } catch (err) {
    // Swallow errors here so optional auth does not block the request path.
    console.warn("[optionalAuth] Token present but invalid:", err.message);
  }

  next();
}

// Require logged-in user
function requireAuth(req, res, next) {
  try {
    let token = null;

    // Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // optional: cookie token
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      console.log('[requireAuth] No token found in request headers');
      return res.status(401).json({ error: "Authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('[requireAuth] Token decoded successfully, user role_id:', decoded.role_id);
    } catch (err) {
      console.log('[requireAuth] Token verification failed:', err.message);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // basic shape check
    if (!decoded || !decoded.id || typeof decoded.role_id === "undefined") {
      console.log('[requireAuth] Invalid token structure:', decoded);
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = decoded;
    next();
  } catch (err) {
    console.error("[requireAuth] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
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
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin,
  // requireSuperAdmin, // Currently unused - commented out but kept for potential future use
  requireSuperAdminOrAdmin,
};
