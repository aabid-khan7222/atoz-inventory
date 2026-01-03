// server/routes/auth.js

const express = require("express");
const router = express.Router();

const db = require("../db");
const bcrypt = require("bcrypt");
const { signAuthToken, requireAuth, optionalAuth } = require("../middleware/auth");

/*
Auth/storage notes (per current schema and routes):
- `users` rows include personal/contact fields (`full_name`, `email`, `phone`, `state`,
  `city`, `address`), auth fields (`password` legacy column plus newer `password_hash`),
  status (`is_active`), GST/company metadata, and a foreign-key `role_id` that joins to `roles.role_name`.
- Passwords are hashed anywhere we write them today with `bcrypt.hash(password, 10)`
  (see `server/routes/users.js` customer creation and the change-password handler below); login
  still supports legacy plain-text values by checking whether the stored value starts with `$2`.
- Roles live in a separate `roles` table; `users.role_id` drives access control where
  1 = Super Admin, 2 = Admin, and other role ids (e.g. customer looked up dynamically)
  identify non-admin users inserted via `server/routes/users.js`.
*/

// ------------------------------------------------------
// POST /api/auth/login
// ------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const trimmedEmail = (email || "").trim().toLowerCase();

    // NOTE: yaha roles join kiya hai taaki role_name bhi mil jaye
    const query = `
      SELECT 
        u.id,
        u.full_name,
        u.email,
        u.password,
        u.role_id,
        u.is_active,
        r.role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE LOWER(u.email) = $1
      LIMIT 1;
    `;
    const result = await db.query(query, [trimmedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    const storedPassword = (user.password || "").trim();
    let isMatch = false;

    // plain + bcrypt dono support
    if (storedPassword.startsWith("$2")) {
      isMatch = await bcrypt.compare(password, storedPassword);
    } else {
      isMatch = storedPassword === password;
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.is_active === false) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    // Fetch customer profile data if it exists (include pincode when available)
    let customerProfile = null;
    try {
      customerProfile = await (async () => {
        try {
          const profileResult = await db.query(`
            SELECT 
              phone,
              state,
              city,
              address,
              pincode,
              is_business_customer,
              company_name,
              gst_number,
              company_address
            FROM customer_profiles
            WHERE user_id = $1
            LIMIT 1
          `, [user.id]);
          return profileResult.rows[0] || null;
        } catch (colErr) {
          if (colErr.code === '42703') {
            console.warn('customer_profiles.pincode not found, retrying without pincode');
            const profileResult = await db.query(`
              SELECT 
                phone,
                state,
                city,
                address,
                is_business_customer,
                company_name,
                gst_number,
                company_address
              FROM customer_profiles
              WHERE user_id = $1
              LIMIT 1
            `, [user.id]);
            return profileResult.rows[0] || null;
          }
          throw colErr;
        }
      })();
    } catch (profileErr) {
      console.warn('Could not fetch customer profile:', profileErr.message);
    }

    const payload = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name, // <-- yaha se frontend ko exact role milega
      // Include profile data if available
      ...(customerProfile ? {
        phone: customerProfile.phone,
        state: customerProfile.state,
        city: customerProfile.city,
        address: customerProfile.address,
        pincode: customerProfile.pincode,
        is_business_customer: customerProfile.is_business_customer,
        company_name: customerProfile.company_name,
        gst_number: customerProfile.gst_number,
        company_address: customerProfile.company_address,
        company: customerProfile.company_name, // For backward compatibility
      } : {}),
    };

    const token = signAuthToken(payload);

    // safeUser me password nahi bhej rahe
    const safeUser = payload;

    return res.status(200).json({
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------------------------------------
// POST /api/auth/change-password
//  - Authenticated users only (Bearer token)
//  - Frontend se body: { currentPassword, newPassword }
// ------------------------------------------------------
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated." });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current and new password are required.",
      });
    }

    // user ka current password lao
    const result = await db.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );

    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "User not found." });
    }

    const user = result.rows[0];
    const storedPassword = user.password || "";
    let isMatch = false;

    // Support plain + bcrypt
    if (storedPassword.startsWith("$2")) {
      isMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
      isMatch = storedPassword === currentPassword;
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect.",
      });
    }

    // Ab naya password bcrypt se hash karke store karte hain
    const saltRounds = 10;
    const hashed = await bcrypt.hash(newPassword, saltRounds);

    await db.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashed,
      userId,
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error while changing password.",
    });
  }
});

// ------------------------------------------------------
// POST /api/auth/change-username
//  - Changes the user's full_name (username)
//  - Requires current password for verification
// ------------------------------------------------------
router.post("/change-username", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated." });
    }

    const { currentPassword, newUsername } = req.body;

    if (!currentPassword || !newUsername) {
      return res.status(400).json({
        success: false,
        error: "Current password and new username are required.",
      });
    }

    if (!newUsername.trim()) {
      return res.status(400).json({
        success: false,
        error: "Username cannot be empty.",
      });
    }

    // Verify current password
    const result = await db.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );

    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "User not found." });
    }

    const user = result.rows[0];
    const storedPassword = user.password || "";
    let isMatch = false;

    // Support plain + bcrypt
    if (storedPassword.startsWith("$2")) {
      isMatch = await bcrypt.compare(currentPassword, storedPassword);
    } else {
      isMatch = storedPassword === currentPassword;
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Current password is incorrect.",
      });
    }

    // Check if username already exists (case-insensitive)
    const existingUser = await db.query(
      "SELECT id FROM users WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1)) AND id != $2",
      [newUsername, userId]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Username already exists. Please choose a different username.",
      });
    }

    // Update username
    await db.query("UPDATE users SET full_name = $1 WHERE id = $2", [
      newUsername.trim(),
      userId,
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error("Change username error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error while changing username.",
    });
  }
});

// ------------------------------------------------------
// POST /api/auth/logout-all
//  - Abhi ke liye sirf success return kar raha hai
//  - Baad me refresh_tokens / sessions table add karke
//    waha se saare sessions clear kar sakte ho
// ------------------------------------------------------
router.post("/logout-all", requireAuth, async (req, res) => {
  try {
    // Future: yaha DB se tokens delete karna hoga

    return res.json({ success: true });
  } catch (err) {
    console.error("Logout all error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error while logging out.",
    });
  }
});

// ------------------------------------------------------
// GET /api/auth/me
//  - Returns current user based on Bearer token
// ------------------------------------------------------
router.get("/me", optionalAuth, async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { rows } = await db.query(
      `SELECT 
          u.id,
          u.full_name,
          u.email,
          u.role_id,
          u.is_active,
          r.role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    // Fetch customer profile data if it exists
    let customerProfile = null;
    try {
      const profileResult = await db.query(`
        SELECT 
          phone, state, city, address,
          is_business_customer, company_name, gst_number,
          company_address
        FROM customer_profiles
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
      
      if (profileResult.rows.length > 0) {
        customerProfile = profileResult.rows[0];
      }
    } catch (profileErr) {
      console.warn('Could not fetch customer profile:', profileErr.message);
    }

    // Merge profile data with user data
    const userWithProfile = {
      ...user,
      ...(customerProfile ? {
        phone: customerProfile.phone,
        state: customerProfile.state,
        city: customerProfile.city,
        address: customerProfile.address,
        is_business_customer: customerProfile.is_business_customer,
        company_name: customerProfile.company_name,
        gst_number: customerProfile.gst_number,
        company_address: customerProfile.company_address,
        company: customerProfile.company_name, // For backward compatibility
      } : {}),
    };

    return res.json({ user: userWithProfile });
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
