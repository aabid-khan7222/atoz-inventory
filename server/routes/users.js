const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { requireAdmin, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ------------------------------------------------------
// POST /api/users
//  - Create a new customer user in the `users` table
//  - Admin / Super Admin only (protected by requireAdmin)
// ------------------------------------------------------
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      full_name,
      phone,
      state,
      city,
      address,
      password,
      has_gst,
      gst_number,
      company_name,
      company_address,
    } = req.body || {};

    // Basic required field validation
    if (
      !full_name ||
      !phone ||
      !state ||
      !city ||
      !address ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        error: 'full_name, phone, state, city, address and password are required',
      });
    }

    // Normalize has_gst to boolean (in case frontend sends "true"/"false" strings)
    const hasGstBool = has_gst === true || has_gst === 'true';

    // Conditional validation when GST is present
    if (hasGstBool) {
      if (!gst_number || !company_name || !company_address) {
        return res.status(400).json({
          success: false,
          error:
            'gst_number, company_name and company_address are required when has_gst is true',
        });
      }
    }

    // Find role_id for customer role (do not hardcode magic numbers)
    const roleResult = await db.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );

    if (!roleResult.rows.length) {
      console.error('Customer role not found in roles table');
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }

    const customerRoleId = roleResult.rows[0].id;

    // Hash password using bcrypt
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO users (
        full_name,
        phone,
        state,
        city,
        address,
        password,
        role_id,
        gst_number,
        company_name,
        company_address,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        full_name,
        phone,
        state,
        city,
        address,
        gst_number,
        company_name,
        company_address,
        role_id;
    `;

    const values = [
      full_name.trim(),
      phone.trim(),
      state.trim(),
      city.trim(),
      address.trim(),
      hashedPassword,
      customerRoleId,
      hasGstBool ? gst_number : null,
      hasGstBool ? company_name : null,
      hasGstBool ? company_address : null,
      true, // is_active
    ];

    const result = await db.query(insertQuery, values);
    const row = result.rows[0];

    return res.status(201).json({
      success: true,
      customer: {
        id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        state: row.state,
        city: row.city,
        address: row.address,
        gst_number: row.gst_number,
        company_name: row.company_name,
        company_address: row.company_address,
        role_id: row.role_id,
      },
    });
  } catch (err) {
    console.error('Error creating customer user:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ------------------------------------------------------
// PUT /api/users/profile
//  - Update the current user's own profile
//  - Updates both users table and customer_profiles table
//  - Requires authentication (user can only update their own profile)
// ------------------------------------------------------
router.put('/profile', requireAuth, async (req, res) => {
  let client;
  
  try {
    // Get user ID from the decoded token (set by requireAuth middleware)
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    const {
      full_name,
      email,
      phone,
      state,
      city,
      address,
    pincode,
      gst_number,
      company_name,
      company_address,
      gstDetails, // Support both formats
      avatar_url, // Profile photo (base64 or URL)
    } = req.body;

    // Extract GST details from either format
    // Only use values if they're actually provided and non-empty
    // If field is not in request body, it means user doesn't want to change it
    // If field is empty string, it means user wants to clear it
    const finalGstNumber = (gst_number !== undefined && gst_number !== null && gst_number.trim()) 
      ? gst_number.trim() 
      : (gstDetails?.gstNumber && gstDetails.gstNumber.trim()) 
        ? gstDetails.gstNumber.trim() 
        : null;
    const finalCompanyName = (company_name !== undefined && company_name !== null && company_name.trim())
      ? company_name.trim()
      : (gstDetails?.companyName && gstDetails.companyName.trim())
        ? gstDetails.companyName.trim()
        : null;
    const finalCompanyAddress = (company_address !== undefined && company_address !== null && company_address.trim())
      ? company_address.trim()
      : (gstDetails?.companyAddress && gstDetails.companyAddress.trim())
        ? gstDetails.companyAddress.trim()
        : null;

    // Log received data for debugging
    console.log('[PUT /users/profile] Received data:', {
      userId,
      full_name,
      email,
      phone,
      state,
      city,
    pincode,
      address,
      gst_number: finalGstNumber,
      company_name: finalCompanyName,
      company_address: finalCompanyAddress
    });

    // Validation
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Full name is required'
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Validate and normalize phone number format (10 digits)
    const normalizedPhone = phone.trim().replace(/\D/g, '');
    if (normalizedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be 10 digits'
      });
    }

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
    }

    // Normalize incoming GST values
    // Empty string or null means "clear this field" (set to null in DB)
    // Non-empty string means "set to this value"
    // undefined means "don't change" (preserve existing)
    const incomingGstNumber = (gst_number !== undefined || gstDetails?.gstNumber !== undefined)
      ? ((finalGstNumber && finalGstNumber.trim()) ? finalGstNumber.trim() : null)
      : undefined; // undefined means "don't change"
    const incomingCompanyName = (company_name !== undefined || gstDetails?.companyName !== undefined)
      ? ((finalCompanyName && finalCompanyName.trim()) ? finalCompanyName.trim() : null)
      : undefined;
    const incomingCompanyAddress = (company_address !== undefined || gstDetails?.companyAddress !== undefined)
      ? ((finalCompanyAddress && finalCompanyAddress.trim()) ? finalCompanyAddress.trim() : null)
      : undefined;

    client = await db.pool.connect();
    await client.query('BEGIN');

    // Check if user exists and get existing GST details and user_type
    const userCheck = await client.query(`
      SELECT u.id, u.email, u.user_type, cp.company_name, cp.gst_number, cp.company_address
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.id = $1
    `, [userId]);
    if (userCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const existingCompanyName = userCheck.rows[0].company_name;
    const existingGstNumber = userCheck.rows[0].gst_number;
    const existingCompanyAddress = userCheck.rows[0].company_address;
    const existingUserType = userCheck.rows[0].user_type;
    
    // Only validate GST requirements if user is actively providing NEW GST details (non-empty values)
    // Don't validate if user is clearing GST (null) or not changing GST (undefined)
    if (incomingGstNumber !== undefined || incomingCompanyName !== undefined || incomingCompanyAddress !== undefined) {
      // Check if user is providing any non-empty GST data
      const hasNonEmptyGst = (incomingGstNumber !== null && incomingGstNumber !== undefined && incomingGstNumber.trim()) ||
                             (incomingCompanyName !== null && incomingCompanyName !== undefined && incomingCompanyName.trim()) ||
                             (incomingCompanyAddress !== null && incomingCompanyAddress !== undefined && incomingCompanyAddress.trim());
      
      if (hasNonEmptyGst) {
        // If GST number is being provided, company name is required
        if (incomingGstNumber && incomingGstNumber.trim() && (!incomingCompanyName || !incomingCompanyName.trim())) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: 'Company name is required when GST number is provided'
          });
        }
        // If company name is being provided, GST number is required
        if (incomingCompanyName && incomingCompanyName.trim() && (!incomingGstNumber || !incomingGstNumber.trim())) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: 'GST number is required when company name is provided'
          });
        }
      }
    }
    
    // Determine final GST values
    // If user provided incoming values (undefined means "don't change", null means "clear", string means "set to this")
    // If undefined, preserve existing values
    // If null, clear the field
    // If string, use the new value
    const finalGstNumberValue = incomingGstNumber !== undefined ? incomingGstNumber : existingGstNumber;
    const finalCompanyNameValue = incomingCompanyName !== undefined ? incomingCompanyName : existingCompanyName;
    const finalCompanyAddressValue = incomingCompanyAddress !== undefined ? incomingCompanyAddress : existingCompanyAddress;
    
    // Use existing user_type to preserve it (don't change based on GST)
    // User type should remain as set during the initial sale
    const isBusinessCustomerFromType = existingUserType && existingUserType.toLowerCase() === 'b2b';
    
    // Preserve existing user_type - don't change it when GST is added/updated
    // is_business_customer should match user_type, not be inferred from GST
    const isBusinessCustomer = isBusinessCustomerFromType;

    // Check if email already exists for another user (if email is being changed)
    if (email && email.trim()) {
      const existingEmail = userCheck.rows[0].email;
      // Only check if email is different from current email
      if (existingEmail !== email.trim()) {
        const emailCheck = await client.query(
          `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
          [email.trim(), userId]
        );
        if (emailCheck.rows.length > 0) {
          await client.query('ROLLBACK');
          client.release();
          return res.status(400).json({
            success: false,
            error: 'Email already in use by another user'
          });
        }
      }
    }

    // Check if phone already exists for another user (if phone is being changed)
    const existingPhone = userCheck.rows[0]?.phone;
    const existingPhoneDigits = existingPhone ? existingPhone.replace(/\D/g, '') : '';
    
    // Only check if phone is different from current phone
    if (existingPhoneDigits !== normalizedPhone) {
      const duplicatePhoneCheck = await client.query(
        `SELECT id FROM users WHERE phone = $1 AND id != $2`,
        [normalizedPhone, userId]
      );
      if (duplicatePhoneCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({
          success: false,
          error: 'Phone number already in use by another user'
        });
      }
    }

    // Update users table
    // Detect optional columns up front to avoid aborted transactions
    const userHasPincodeCol = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'pincode' LIMIT 1
    `)).rows.length > 0;

    const userHasAvatarUrlCol = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'avatar_url' LIMIT 1
    `)).rows.length > 0;

    const profileHasPincodeCol = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'customer_profiles' AND column_name = 'pincode' LIMIT 1
    `)).rows.length > 0;

    const usersHasUserTypeCol = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_type' LIMIT 1
    `)).rows.length > 0;

    // Update users table
    // Handle avatar_url update (only if column exists and value is provided)
    // If avatar_url is undefined, don't update it (preserve existing value)
    // If avatar_url is null or empty string, clear it
    const shouldUpdateAvatar = avatar_url !== undefined;
    const avatarUrlValue = shouldUpdateAvatar 
      ? ((avatar_url !== null && avatar_url.trim()) ? avatar_url.trim() : null)
      : undefined; // undefined means "don't update"

    if (userHasPincodeCol && userHasAvatarUrlCol) {
      if (shouldUpdateAvatar) {
        await client.query(`
          UPDATE users 
          SET 
            full_name = $1,
            email = $2,
            phone = $3,
            state = $4,
            city = $5,
            address = $6,
            pincode = $7,
            avatar_url = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
        `, [
          full_name.trim(),
          email?.trim() || null,
          normalizedPhone,
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          pincode?.trim() || null,
          avatarUrlValue,
          userId
        ]);
      } else {
        await client.query(`
          UPDATE users 
          SET 
            full_name = $1,
            email = $2,
            phone = $3,
            state = $4,
            city = $5,
            address = $6,
            pincode = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
        `, [
          full_name.trim(),
          email?.trim() || null,
          normalizedPhone,
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          pincode?.trim() || null,
          userId
        ]);
      }
      await client.query(`
        UPDATE users 
        SET 
          full_name = $1,
          email = $2,
          phone = $3,
          state = $4,
          city = $5,
          address = $6,
          pincode = $7,
          avatar_url = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
      `, [
        full_name.trim(),
        email?.trim() || null,
        normalizedPhone,
        state?.trim() || null,
        city?.trim() || null,
        address?.trim() || null,
        pincode?.trim() || null,
        avatarUrlValue,
        userId
      ]);
    } else if (userHasPincodeCol) {
      await client.query(`
        UPDATE users 
        SET 
          full_name = $1,
          email = $2,
          phone = $3,
          state = $4,
          city = $5,
          address = $6,
          pincode = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $8
      `, [
        full_name.trim(),
        email?.trim() || null,
        normalizedPhone,
        state?.trim() || null,
        city?.trim() || null,
        address?.trim() || null,
        pincode?.trim() || null,
        userId
      ]);
    } else if (userHasAvatarUrlCol) {
      if (shouldUpdateAvatar) {
        await client.query(`
          UPDATE users 
          SET 
            full_name = $1,
            email = $2,
            phone = $3,
            state = $4,
            city = $5,
            address = $6,
            avatar_url = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8
        `, [
          full_name.trim(),
          email?.trim() || null,
          normalizedPhone,
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          avatarUrlValue,
          userId
        ]);
      } else {
        await client.query(`
          UPDATE users 
          SET 
            full_name = $1,
            email = $2,
            phone = $3,
            state = $4,
            city = $5,
            address = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7
        `, [
          full_name.trim(),
          email?.trim() || null,
          normalizedPhone,
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          userId
        ]);
      }
    } else {
      await client.query(`
        UPDATE users 
        SET 
          full_name = $1,
          email = $2,
          phone = $3,
          state = $4,
          city = $5,
          address = $6,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
      `, [
        full_name.trim(),
        email?.trim() || null,
        normalizedPhone,
        state?.trim() || null,
        city?.trim() || null,
        address?.trim() || null,
        userId
      ]);
    }


    // Don't update user_type - preserve it as set during the initial sale
    // User type should NOT change when GST details are added/updated
    // This ensures B2C customers remain B2C even if they add GST details later

    // Check if company_address column exists
    let hasCompanyAddressCol = false;
    try {
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'company_address'
      `);
      hasCompanyAddressCol = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('Could not check for company_address column:', err.message);
    }

    // Log values before query
    console.log('[PUT /users/profile] Values for INSERT:', {
      userId,
      full_name: full_name.trim(),
      email: email?.trim() || null,
      phone: phone.trim(),
      state: state?.trim() || null,
      city: city?.trim() || null,
      address: address?.trim() || null,
      isBusinessCustomer: Boolean(isBusinessCustomer),
      companyName: finalCompanyNameValue,
      gstNumber: finalGstNumberValue,
      companyAddress: finalCompanyAddressValue
    });

    // Update or insert customer_profiles (attempt with pincode first; fall back if missing)
    // Update or insert customer_profiles using detected pincode capability
    if (hasCompanyAddressCol) {
      if (profileHasPincodeCol) {
        await client.query(`
          INSERT INTO customer_profiles (
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
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number),
            company_address = COALESCE(NULLIF(EXCLUDED.company_address, ''), customer_profiles.company_address)
        `, [
          userId,
          full_name.trim(),
          email?.trim() || null,
          phone.trim(),
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          pincode?.trim() || null,
          Boolean(isBusinessCustomer),
          finalCompanyNameValue,
          finalGstNumberValue,
          finalCompanyAddressValue
        ]);
      } else {
        await client.query(`
          INSERT INTO customer_profiles (
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
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number),
            company_address = COALESCE(NULLIF(EXCLUDED.company_address, ''), customer_profiles.company_address)
        `, [
          userId,
          full_name.trim(),
          email?.trim() || null,
          phone.trim(),
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          Boolean(isBusinessCustomer),
          finalCompanyNameValue,
          finalGstNumberValue,
          finalCompanyAddressValue
        ]);
      }
    } else {
      if (profileHasPincodeCol) {
        await client.query(`
          INSERT INTO customer_profiles (
            user_id, full_name, email, phone, state, city, address, pincode,
            is_business_customer, company_name, gst_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            state = EXCLUDED.state,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            pincode = EXCLUDED.pincode,
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number)
        `, [
          userId,
          full_name.trim(),
          email?.trim() || null,
          phone.trim(),
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          pincode?.trim() || null,
          Boolean(isBusinessCustomer),
          finalCompanyNameValue,
          finalGstNumberValue
        ]);
      } else {
        await client.query(`
          INSERT INTO customer_profiles (
            user_id, full_name, email, phone, state, city, address,
            is_business_customer, company_name, gst_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (user_id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            state = EXCLUDED.state,
            city = EXCLUDED.city,
            address = EXCLUDED.address,
            is_business_customer = customer_profiles.is_business_customer,
            company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), customer_profiles.company_name),
            gst_number = COALESCE(NULLIF(EXCLUDED.gst_number, ''), customer_profiles.gst_number)
        `, [
          userId,
          full_name.trim(),
          email?.trim() || null,
          phone.trim(),
          state?.trim() || null,
          city?.trim() || null,
          address?.trim() || null,
          Boolean(isBusinessCustomer),
          finalCompanyNameValue,
          finalGstNumberValue
        ]);
      }
    }

    // Ensure pincode is persisted to customer_profiles when column exists
    if (profileHasPincodeCol) {
      try {
        await client.query(
          `UPDATE customer_profiles SET pincode = $1 WHERE user_id = $2`,
          [pincode?.trim() || null, userId]
        );
      } catch (pinErr) {
        console.warn('[PUT /users/profile] Unable to update customer_profiles.pincode:', pinErr.message);
      }
    }

    await client.query('COMMIT');
    client.release();

    console.log(`[PUT /users/profile] Transaction committed successfully for user ${userId}`);

    // Fetch updated user data using a fresh connection to ensure we get the latest data
    const updatedUser = await db.query(`
      SELECT 
        u.id,
        u.full_name,
        COALESCE(cp.email, u.email) AS email,
        COALESCE(cp.phone, u.phone) AS phone,
        COALESCE(cp.state, u.state) AS state,
        COALESCE(cp.city, u.city) AS city,
        COALESCE(cp.address, u.address) AS address,
        ${profileHasPincodeCol && userHasPincodeCol ? 'COALESCE(cp.pincode, u.pincode) AS pincode,' : profileHasPincodeCol ? 'cp.pincode AS pincode,' : userHasPincodeCol ? 'u.pincode AS pincode,' : 'NULL AS pincode,'}
        ${userHasAvatarUrlCol ? 'u.avatar_url,' : 'NULL AS avatar_url,'}
        cp.is_business_customer,
        cp.company_name,
        cp.gst_number,
        ${hasCompanyAddressCol ? 'cp.company_address' : 'NULL'} AS company_address
      FROM users u
      LEFT JOIN customer_profiles cp ON u.id = cp.user_id
      WHERE u.id = $1
    `, [userId]);

    if (!updatedUser.rows || updatedUser.rows.length === 0) {
      console.error(`[PUT /users/profile] ERROR: Could not fetch updated user ${userId} after commit!`);
      return res.status(500).json({
        success: false,
        error: 'Profile was updated but could not be retrieved. Please refresh and check.'
      });
    }

    const userData = updatedUser.rows[0];
    console.log(`[PUT /users/profile] Returning updated user data:`, {
      id: userData.id,
      full_name: userData.full_name,
      email: userData.email,
      phone: userData.phone,
      company_name: userData.company_name,
      gst_number: userData.gst_number,
      company_address: userData.company_address
    });

    return res.json({
      success: true,
      user: userData
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }
    console.error('Error updating user profile:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;


