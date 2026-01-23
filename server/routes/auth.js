// server/routes/auth.js

const express = require("express");
const router = express.Router();

const db = require("../db");
const bcrypt = require("bcrypt");
const { signAuthToken, requireAuth, optionalAuth } = require("../middleware/auth");
const { generateOTP, sendOTPEmail } = require("../utils/emailService");

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
    // Try with JOIN first, fallback to simple query if roles table doesn't exist
    let result;
    let user;
    
    try {
      const query = `
        SELECT 
          u.id,
          u.full_name,
          u.email,
          u.password,
          u.role_id,
          u.is_active,
          u.avatar_url,
          r.role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE LOWER(u.email) = $1
        LIMIT 1;
      `;
      result = await db.query(query, [trimmedEmail]);
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      
      user = result.rows[0];
    } catch (dbError) {
      // If JOIN fails (roles table might not exist), try without JOIN
      console.warn("Login: Roles JOIN failed, trying without JOIN:", dbError.message);
      try {
        const simpleQuery = `
          SELECT 
            id,
            full_name,
            email,
            password,
            role_id,
            is_active,
            avatar_url
          FROM users
          WHERE LOWER(email) = $1
          LIMIT 1;
        `;
        result = await db.query(simpleQuery, [trimmedEmail]);
        
        if (result.rows.length === 0) {
          return res.status(401).json({ error: "Invalid email or password" });
        }
        
        user = result.rows[0];
        // Set default role_name if not available
        user.role_name = user.role_id === 1 ? 'Super Admin' : user.role_id === 2 ? 'Admin' : 'Customer';
      } catch (simpleError) {
        console.error("Login: Database query failed:", simpleError);
        return res.status(500).json({ 
          error: "Database error", 
          details: process.env.NODE_ENV === 'production' ? undefined : simpleError.message 
        });
      }
    }

    const storedPassword = (user.password || "").trim();
    
    if (!storedPassword) {
      console.error("Login: User found but password field is empty for email:", trimmedEmail);
      return res.status(500).json({ error: "Account configuration error" });
    }
    
    let isMatch = false;

    // plain + bcrypt dono support
    if (storedPassword.startsWith("$2")) {
      try {
        isMatch = await bcrypt.compare(password, storedPassword);
      } catch (bcryptError) {
        console.error("Login: bcrypt.compare failed:", bcryptError);
        return res.status(500).json({ 
          error: "Password verification error",
          details: process.env.NODE_ENV === 'production' ? undefined : bcryptError.message
        });
      }
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
      avatar_url: user.avatar_url || null, // Include avatar URL if available
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

    // Verify JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error("Login: JWT_SECRET is not set in environment variables");
      return res.status(500).json({ 
        error: "Server configuration error",
        details: process.env.NODE_ENV === 'production' ? undefined : "JWT_SECRET missing"
      });
    }

    let token;
    try {
      token = signAuthToken(payload);
    } catch (jwtError) {
      console.error("Login: JWT token generation failed:", jwtError);
      return res.status(500).json({ 
        error: "Token generation error",
        details: process.env.NODE_ENV === 'production' ? undefined : jwtError.message
      });
    }

    // safeUser me password nahi bhej rahe
    const safeUser = payload;

    return res.status(200).json({
      user: safeUser,
      token,
    });
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    console.error("Error stack:", err.stack);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      name: err.name
    });
    return res.status(500).json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'production' ? undefined : err.message
    });
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
          u.avatar_url,
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
      avatar_url: user.avatar_url || null, // Include avatar URL
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

// In-memory OTP storage (for production, use Redis or database)
const otpStore = new Map();

// Clean expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (value.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ------------------------------------------------------
// POST /api/auth/signup/send-otp
//  - Send OTP to email for signup verification
// ------------------------------------------------------
router.post("/signup/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user already exists
    const existingUser = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [trimmedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(`signup:${trimmedEmail}`, {
      otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP email
    try {
      await sendOTPEmail(trimmedEmail, otp, "signup");
      return res.json({ success: true, message: "OTP sent to email" });
    } catch (emailError) {
      console.error("Error sending OTP email:", emailError);
      console.error("Email error stack:", emailError.stack);
      otpStore.delete(`signup:${trimmedEmail}`);
      
      // Return the actual error message for better debugging
      const errorMessage = emailError.message || "Failed to send OTP email. Please check email configuration.";
      return res.status(500).json({
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? emailError.stack : undefined,
      });
    }
  } catch (err) {
    console.error("Signup send OTP error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

// ------------------------------------------------------
// POST /api/auth/signup/verify-otp
//  - Verify OTP and create user account
// ------------------------------------------------------
router.post("/signup/verify-otp", async (req, res) => {
  let client;
  try {
    const {
      email,
      otp,
      full_name,
      mobile_number,
      state,
      city,
      city_pincode,
      address,
      has_gst,
      gst_number,
      company_name,
      company_address,
      password,
      confirm_password,
    } = req.body;

    // Validate required fields
    if (
      !email ||
      !otp ||
      !full_name ||
      !mobile_number ||
      !state ||
      !city ||
      !city_pincode ||
      !address ||
      !password ||
      !confirm_password
    ) {
      return res.status(400).json({
        error: "All required fields must be provided",
      });
    }

    // Validate password match
    if (password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    // Validate GST fields if has_gst is true
    const hasGstBool = has_gst === true || has_gst === "true";
    if (hasGstBool) {
      if (!gst_number || !company_name || !company_address) {
        return res.status(400).json({
          error:
            "GST number, company name, and company address are required when GST is enabled",
        });
      }
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify OTP
    const otpKey = `signup:${trimmedEmail}`;
    const storedOtpData = otpStore.get(otpKey);

    if (!storedOtpData) {
      return res.status(400).json({ error: "OTP expired or not found" });
    }

    if (storedOtpData.expiresAt < Date.now()) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: "OTP has expired" });
    }

    if (storedOtpData.attempts >= 5) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        error: "Too many failed attempts. Please request a new OTP",
      });
    }

    if (storedOtpData.otp !== otp) {
      storedOtpData.attempts += 1;
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if user already exists (double check)
    const existingUser = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1",
      [trimmedEmail, mobile_number.trim()]
    );

    if (existingUser.rows.length > 0) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        error: "Email or mobile number already registered",
      });
    }

    // Get customer role_id
    const roleResult = await db.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );

    if (!roleResult.rows.length) {
      return res.status(500).json({ error: "Customer role not found" });
    }

    const customerRoleId = roleResult.rows[0].id;

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Start transaction
    client = await db.pool.connect();
    await client.query("BEGIN");

    // Insert into users table
    const userResult = await client.query(
      `INSERT INTO users (
        full_name, email, phone, password, role_id, is_active,
        state, city, address, gst_number, company_name, company_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, full_name, email, phone, role_id`,
      [
        full_name.trim(),
        trimmedEmail,
        mobile_number.trim(),
        hashedPassword,
        customerRoleId,
        true, // is_active
        state.trim(),
        city.trim(),
        address.trim(),
        hasGstBool ? gst_number.trim() : null,
        hasGstBool ? company_name.trim() : null,
        hasGstBool ? company_address.trim() : null,
      ]
    );

    const userId = userResult.rows[0].id;

    // Insert into customer_profiles table
    try {
      // Check if pincode column exists
      const pincodeCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'pincode'
      `);

      const hasPincodeCol = pincodeCheck.rows.length > 0;

      if (hasPincodeCol) {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, state, city, address, pincode,
            is_business_customer, company_name, gst_number, company_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            state = EXCLUDED.state,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            pincode = EXCLUDED.pincode,
            is_business_customer = EXCLUDED.is_business_customer,
            company_name = EXCLUDED.company_name,
            gst_number = EXCLUDED.gst_number,
            company_address = EXCLUDED.company_address`,
          [
            userId,
            full_name.trim(),
            trimmedEmail,
            mobile_number.trim(),
            state.trim(),
            city.trim(),
            address.trim(),
            city_pincode.trim(),
            hasGstBool,
            hasGstBool ? company_name.trim() : null,
            hasGstBool ? gst_number.trim() : null,
            hasGstBool ? company_address.trim() : null,
          ]
        );
      } else {
        await client.query(
          `INSERT INTO customer_profiles (
            user_id, full_name, email, phone, state, city, address,
            is_business_customer, company_name, gst_number, company_address
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            state = EXCLUDED.state,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            is_business_customer = EXCLUDED.is_business_customer,
            company_name = EXCLUDED.company_name,
            gst_number = EXCLUDED.gst_number,
            company_address = EXCLUDED.company_address`,
          [
            userId,
            full_name.trim(),
            trimmedEmail,
            mobile_number.trim(),
            state.trim(),
            city.trim(),
            address.trim(),
            hasGstBool,
            hasGstBool ? company_name.trim() : null,
            hasGstBool ? gst_number.trim() : null,
            hasGstBool ? company_address.trim() : null,
          ]
        );
      }
    } catch (profileErr) {
      console.error("Error creating customer profile:", profileErr);
      // Continue even if profile creation fails
    }

    // Commit transaction
    await client.query("COMMIT");

    // Delete OTP after successful signup
    otpStore.delete(otpKey);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      user: {
        id: userResult.rows[0].id,
        full_name: userResult.rows[0].full_name,
        email: userResult.rows[0].email,
        role_id: userResult.rows[0].role_id,
      },
    });
  } catch (err) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback error:", rollbackErr);
      }
    }
    console.error("Signup verify OTP error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// ------------------------------------------------------
// POST /api/auth/forgot-password/send-otp
//  - Send OTP to email for password reset
// ------------------------------------------------------
router.post("/forgot-password/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if user exists
    const userResult = await db.query(
      "SELECT id, full_name FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [trimmedEmail]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists or not (security best practice)
      return res.json({
        success: true,
        message: "If email exists, OTP has been sent",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP
    otpStore.set(`forgot-password:${trimmedEmail}`, {
      otp,
      expiresAt,
      attempts: 0,
    });

    // Send OTP email
    try {
      await sendOTPEmail(trimmedEmail, otp, "forgot-password");
      return res.json({
        success: true,
        message: "If email exists, OTP has been sent",
      });
    } catch (emailError) {
      console.error("Error sending OTP email:", emailError);
      otpStore.delete(`forgot-password:${trimmedEmail}`);
      return res.status(500).json({
        error: "Failed to send OTP email. Please check email configuration.",
      });
    }
  } catch (err) {
    console.error("Forgot password send OTP error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

// ------------------------------------------------------
// POST /api/auth/forgot-password/verify-otp
//  - Verify OTP and reset password
// ------------------------------------------------------
router.post("/forgot-password/verify-otp", async (req, res) => {
  try {
    const { email, otp, new_password, confirm_password } = req.body;

    if (!email || !otp || !new_password || !confirm_password) {
      return res.status(400).json({
        error: "Email, OTP, new password, and confirm password are required",
      });
    }

    // Validate password match
    if (new_password !== confirm_password) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    // Validate password strength
    if (new_password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long",
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Verify OTP
    const otpKey = `forgot-password:${trimmedEmail}`;
    const storedOtpData = otpStore.get(otpKey);

    if (!storedOtpData) {
      return res.status(400).json({ error: "OTP expired or not found" });
    }

    if (storedOtpData.expiresAt < Date.now()) {
      otpStore.delete(otpKey);
      return res.status(400).json({ error: "OTP has expired" });
    }

    if (storedOtpData.attempts >= 5) {
      otpStore.delete(otpKey);
      return res.status(400).json({
        error: "Too many failed attempts. Please request a new OTP",
      });
    }

    if (storedOtpData.otp !== otp) {
      storedOtpData.attempts += 1;
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if user exists
    const userResult = await db.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [trimmedEmail]
    );

    if (userResult.rows.length === 0) {
      otpStore.delete(otpKey);
      return res.status(404).json({ error: "User not found" });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await db.query("UPDATE users SET password = $1 WHERE LOWER(email) = $2", [
      hashedPassword,
      trimmedEmail,
    ]);

    // Delete OTP after successful password reset
    otpStore.delete(otpKey);

    return res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (err) {
    console.error("Forgot password verify OTP error:", err);
    return res.status(500).json({
      error: "Internal server error",
      details: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
});

// ------------------------------------------------------
// GET /api/auth/test-email (Development only)
//  - Test email configuration
// ------------------------------------------------------
router.get("/test-email", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ error: "This endpoint is only available in development" });
  }

  try {
    const emailUser = (process.env.GMAIL_USER || process.env.EMAIL_USER)?.trim();
    const emailPassword = (process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASSWORD)?.replace(/\s/g, '').trim();

    return res.json({
      emailConfigured: !!(emailUser && emailPassword),
      emailUser: emailUser || "NOT SET",
      emailPasswordLength: emailPassword ? emailPassword.length : 0,
      emailPasswordSet: !!emailPassword,
      message: emailUser && emailPassword 
        ? "Email configuration found. Try sending an OTP to test." 
        : "Email configuration missing. Please set GMAIL_USER and GMAIL_APP_PASSWORD.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error checking email configuration",
      details: err.message,
    });
  }
});

module.exports = router;
