// server/routes/admin.js

const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../db");
const { requireAuth, requireAdmin, requireRole, requireShop, requireSuperAdminOrAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/admin/customers
 */
router.get("/customers", requireAuth, requireShop, requireSuperAdminOrAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Check if company_address column exists
    let hasCompanyAddressCol = false;
    try {
      const columnCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'company_address'
      `);
      hasCompanyAddressCol = columnCheck.rows.length > 0;
    } catch (err) {
      console.warn('Could not check for company_address column:', err.message);
    }
    
    let listQuery = `
      SELECT
        cp.user_id AS id,
        cp.full_name AS name,
        CASE 
          WHEN u.email IS NULL OR u.email = '' THEN NULL
          WHEN u.email LIKE '%@customer.local' THEN NULL
          ELSE u.email
        END AS email,
        COALESCE(cp.phone, u.phone) AS phone,
        cp.state,
        cp.city,
        cp.pincode AS pincode,
        cp.address,
        COALESCE(
          cp.is_business_customer,
          CASE 
            WHEN LOWER(u.user_type) IN ('b2b') THEN TRUE
            ELSE FALSE
          END
        ) AS is_b2b,
        cp.company_name AS company,
        cp.gst_number,
        ${hasCompanyAddressCol ? 'cp.company_address' : 'NULL'} AS company_address,
        u.user_type
      FROM customer_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE u.role_id >= 3 AND u.shop_id = $1
    `;

    const params = [req.shop_id];

    if (search) {
      params.push(`%${search}%`);
      listQuery += `
        AND
          (cp.full_name ILIKE $2
           OR cp.phone ILIKE $2
           OR cp.company_name ILIKE $2
           OR cp.gst_number ILIKE $2
           OR u.email ILIKE $2)
      `;
    }

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    listQuery += `
      ORDER BY cp.user_id DESC
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    params.push(limit, offset);

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM customer_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE u.role_id >= 3 AND u.shop_id = $1
    `;
    const countParams = [req.shop_id];

    if (search) {
      countParams.push(`%${search}%`);
      countQuery += `
        AND
          (cp.full_name ILIKE $2
           OR cp.phone ILIKE $2
           OR cp.company_name ILIKE $2
           OR cp.gst_number ILIKE $2
           OR u.email ILIKE $2)
      `;
    }

    const [listResult, countResult] = await Promise.all([
      db.query(listQuery, params),
      db.query(countQuery, countParams),
    ]);

    const items = listResult.rows;
    const totalItems = parseInt(countResult.rows[0]?.total || "0", 10);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return res.json({
      items,
      total_pages: totalPages,
      total_items: totalItems,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /api/admin/customers error:", err);
    return res.status(500).json({ error: "Failed to fetch customers" });
  }
});

/**
 * GET /api/admin/customers/:id
 * Return a single customer profile (with GST/company info)
 */
router.get(
  "/customers/:id",
  requireAuth,
  requireShop,
  requireSuperAdminOrAdmin,
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id, 10);
      if (!customerId || Number.isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // Check if optional columns exist
      let hasCompanyAddressCol = false;
      let userHasPincodeCol = false;
      let profileHasPincodeCol = false;

      try {
        const colChecks = await Promise.all([
          db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'customer_profiles' AND column_name = 'company_address'
        `),
          db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'pincode'
        `),
          db.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'customer_profiles' AND column_name = 'pincode'
        `),
        ]);

        hasCompanyAddressCol = colChecks[0].rows.length > 0;
        userHasPincodeCol = colChecks[1].rows.length > 0;
        profileHasPincodeCol = colChecks[2].rows.length > 0;
      } catch (err) {
        console.warn('Could not check for optional columns:', err.message);
      }
      
      const pincodeSelect = (profileHasPincodeCol && userHasPincodeCol) 
        ? 'COALESCE(cp.pincode, u.pincode) AS pincode'
        : profileHasPincodeCol ? 'cp.pincode AS pincode'
        : userHasPincodeCol ? 'u.pincode AS pincode'
        : 'NULL AS pincode';

      const query = `
        SELECT
          cp.user_id AS id,
          cp.full_name AS name,
          CASE 
            WHEN u.email IS NULL OR u.email = '' THEN cp.email
            WHEN u.email LIKE '%@customer.local' THEN cp.email
            ELSE u.email
          END AS email,
          COALESCE(cp.phone, u.phone) AS phone,
          cp.state,
          cp.city,
          ${pincodeSelect},
          cp.address,
          COALESCE(
            cp.is_business_customer,
            CASE 
          WHEN LOWER(u.user_type) IN ('b2b') THEN TRUE
          ELSE FALSE
        END
      ) AS is_b2b,
      cp.company_name AS company,
      cp.gst_number,
      ${hasCompanyAddressCol ? 'cp.company_address' : 'NULL'} AS company_address,
      u.user_type
        FROM customer_profiles cp
        LEFT JOIN users u ON cp.user_id = u.id
        WHERE cp.user_id = $1 AND u.role_id >= 3
        LIMIT 1
      `;
      
      const { rows } = await db.query(query, [customerId]);
  
      if (!rows.length) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const customerData = rows[0];
      console.log(`[GET /customers/:id] Returning customer data:`, {
        id: customerData.id,
        name: customerData.name,
        pincode: customerData.pincode,
        pincodeType: typeof customerData.pincode,
        pincodeIsNull: customerData.pincode === null,
        pincodeIsUndefined: customerData.pincode === undefined,
        is_b2b: customerData.is_b2b,
        company: customerData.company,
        gst_number: customerData.gst_number,
        company_address: customerData.company_address,
      });

      return res.json(customerData);
    } catch (err) {
      console.error("GET /api/admin/customers/:id error:", err);
      return res.status(500).json({ error: "Failed to fetch customer" });
    }
  }
);

/**
 * GET /api/admin/customers/:id/history
 * Aggregated history for a single customer:
 *  - Basic profile
 *  - Sales (purchases made by the customer)
 *  - Charging services
 *  - Guarantee & warranty replacements
 */
router.get(
  "/customers/:id/history",
  requireAuth,
  requireShop,
  requireSuperAdminOrAdmin,
  async (req, res) => {
    try {
      const customerId = parseInt(req.params.id, 10);

      if (!customerId || Number.isNaN(customerId)) {
        return res.status(400).json({ error: "Invalid customer ID" });
      }

      // 1) Fetch base customer profile
      const customer = await fetchCustomerProfileById(customerId);

      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      // 2) Fetch detailed history from multiple tables in parallel
      // Check which columns exist
      const columnsCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'sales_item'
        AND column_name IN ('customer_business_name', 'customer_gst_number', 'customer_business_address')
      `);
      const existingColumns = columnsCheck.rows.map(r => r.column_name);
      const hasBusinessFields = existingColumns.includes('customer_business_name') && 
                                existingColumns.includes('customer_gst_number') && 
                                existingColumns.includes('customer_business_address');
      
      let salesItemsSelect = `id,
               invoice_number,
               customer_id,
               customer_name,
               customer_mobile_number,
               customer_vehicle_number,
               sales_type,
               sales_type_id,
               purchase_date,
               "SKU" AS sku,
               "SERIES" AS series,
               "CATEGORY" AS category,
               "NAME" AS product_name,
               "AH_VA" AS ah_va,
               "QUANTITY" AS quantity,
               "WARRANTY" AS warranty,
               "SERIAL_NUMBER" AS serial_number,
               "MRP" AS mrp,
               discount_amount,
               tax,
               final_amount,
               payment_method,
               payment_status,
               product_id,
               created_at,
               updated_at`;
      
      if (hasBusinessFields) {
        salesItemsSelect += `, customer_business_name, customer_gst_number, customer_business_address`;
      }
      
      const [salesItemsResult, replacementsResult, chargingServicesResult] =
        await Promise.all([
          // All individual sale line items for this customer
          db.query(
            `SELECT ${salesItemsSelect}
             FROM sales_item
             WHERE customer_id = $1
             ORDER BY purchase_date DESC, id DESC`,
            [customerId]
          ),
          // Guarantee & warranty replacement history (same shape as /guarantee-warranty/history/:customerId)
          db.query(
            `SELECT 
               br.id,
               br.original_serial_number,
               br.original_purchase_date,
               br.original_invoice_number,
               br.replacement_type,
               br.replacement_date,
               br.new_serial_number,
               br.new_invoice_number,
               br.discount_percentage,
               br.notes,
               br.created_at,
               p.name as product_name,
               p.sku as product_sku,
               ws.slab_name as warranty_slab_name,
               u_created.full_name as created_by_name,
               u_customer.full_name as customer_name,
               u_customer.phone as customer_phone,
               u_customer.email as customer_email,
               si.customer_name as sale_customer_name,
               si.customer_mobile_number as sale_customer_phone,
               si.customer_vehicle_number,
               si.customer_business_name,
               si.customer_gst_number,
               si.customer_business_address,
               cp.address as customer_address,
               cp.city,
               cp.state,
               cp.pincode
             FROM battery_replacements br
             LEFT JOIN products p ON br.product_id = p.id
             LEFT JOIN warranty_slabs ws ON br.warranty_slab_id = ws.id
             LEFT JOIN users u_created ON br.created_by = u_created.id
             LEFT JOIN users u_customer ON br.customer_id = u_customer.id
             LEFT JOIN sales_item si ON br.original_sale_item_id = si.id
             LEFT JOIN customer_profiles cp ON u_customer.id = cp.user_id
             WHERE br.customer_id = $1
             ORDER BY br.replacement_date DESC, br.created_at DESC`,
            [customerId]
          ),
          // Charging services linked to this customer (by email/phone)
          (async () => {
            const email =
              customer.email && customer.email.includes("@customer.local")
                ? null
                : customer.email;
            const phone = customer.phone || null;

            if (!email && !phone) {
              return { rows: [] };
            }

            return db.query(
              `SELECT 
                 cs.*,
                 u.full_name as created_by_name
               FROM charging_services cs
               LEFT JOIN users u ON cs.created_by = u.id
               WHERE 
                 (
                   ($1 IS NOT NULL AND LOWER(cs.customer_email) = LOWER($1))
                   OR
                   ($2 IS NOT NULL AND cs.customer_mobile_number = $2)
                 )
               ORDER BY cs.created_at DESC`,
              [email, phone]
            );
          })(),
        ]);

      const salesItems = salesItemsResult.rows;
      const replacements = replacementsResult.rows;
      const chargingServices = chargingServicesResult.rows;

      // 3) Build grouped invoice view from sales items
      const invoicesMap = new Map();
      let totalAmount = 0;
      let totalBatteries = 0;
      let firstPurchaseDate = null;
      let lastPurchaseDate = null;

      for (const item of salesItems) {
        const invoice = item.invoice_number;
        const purchaseDate = item.purchase_date || item.created_at;
        const amount = Number(item.final_amount || 0);

        totalAmount += amount;
        totalBatteries += Number(item.quantity || 1);

        const dateObj = purchaseDate ? new Date(purchaseDate) : null;
        if (dateObj && !Number.isNaN(dateObj.getTime())) {
          if (!firstPurchaseDate || dateObj < firstPurchaseDate) {
            firstPurchaseDate = dateObj;
          }
          if (!lastPurchaseDate || dateObj > lastPurchaseDate) {
            lastPurchaseDate = dateObj;
          }
        }

        if (!invoicesMap.has(invoice)) {
          invoicesMap.set(invoice, {
            invoice_number: invoice,
            customer_id: item.customer_id,
            customer_name: item.customer_name,
            customer_mobile_number: item.customer_mobile_number,
            sales_type: item.sales_type,
            sales_type_id: item.sales_type_id,
            first_purchase_date: purchaseDate,
            last_purchase_date: purchaseDate,
            total_amount: amount,
            item_count: 1,
          });
        } else {
          const inv = invoicesMap.get(invoice);
          inv.total_amount += amount;
          inv.item_count += 1;
          if (purchaseDate && purchaseDate < inv.first_purchase_date) {
            inv.first_purchase_date = purchaseDate;
          }
          if (purchaseDate && purchaseDate > inv.last_purchase_date) {
            inv.last_purchase_date = purchaseDate;
          }
        }
      }

      const salesInvoices = Array.from(invoicesMap.values()).sort((a, b) => {
        const d1 = new Date(a.first_purchase_date || a.last_purchase_date || 0);
        const d2 = new Date(b.first_purchase_date || b.last_purchase_date || 0);
        return d2 - d1;
      });

      // 4) High-level customer metrics
      const metrics = {
        total_orders: salesInvoices.length,
        total_batteries: totalBatteries,
        total_charging_services: chargingServices.length,
        total_replacements: replacements.length,
        total_amount_spent: Number(totalAmount.toFixed(2)),
        first_purchase_date: firstPurchaseDate
          ? firstPurchaseDate.toISOString()
          : null,
        last_purchase_date: lastPurchaseDate
          ? lastPurchaseDate.toISOString()
          : null,
      };

      return res.json({
        customer,
        metrics,
        sales: {
          invoices: salesInvoices,
          items: salesItems,
        },
        chargingServices,
        replacements,
      });
    } catch (err) {
      console.error("GET /api/admin/customers/:id/history error:", err);
      return res
        .status(500)
        .json({ error: "Failed to fetch customer history" });
    }
  }
);

/**
 * POST /api/admin/customers
 */
router.post("/customers", requireAuth, requireShop, requireSuperAdminOrAdmin, async (req, res) => {
  let {
    name,
    email,
    phone,
    state,
    city,
    pincode,
    company,
    is_b2b,
    gst_number,
    password,
    address,
    company_address,
  } = req.body || {};

  // clean / trim
  name = (name || "").trim();
  email = email ? email.trim() : null;
  phone = (phone || "").trim();
  state = state ? state.trim() : null;
  city = city ? city.trim() : null;
  // Handle pincode: handle all cases explicitly
  let processedPincode = null;
  if (pincode !== null && pincode !== undefined) {
    // Convert to string if it's a number
    const pincodeStr = String(pincode).trim();
    if (pincodeStr.length > 0) {
      processedPincode = pincodeStr;
    }
  }
  pincode = processedPincode; // Use processed value
  company = company ? company.trim() : null;
  gst_number = gst_number ? gst_number.trim() : null;
  password = password ? password.trim() : null;
  address = address ? address.trim() : null;
  company_address = company_address ? company_address.trim() : null;
  
  console.log('[POST /customers] Received pincode:', { 
    raw: req.body.pincode, 
    rawType: typeof req.body.pincode,
    processed: pincode,
    processedType: typeof pincode
  });

  const parseIsB2B = (val) => {
    if (val === true || val === "true" || val === 1 || val === "1") return true;
    if (val === false || val === "false" || val === 0 || val === "0") return false;
    return null;
  };

  const isBusiness = parseIsB2B(is_b2b);
  const finalIsBusiness = isBusiness === null ? false : isBusiness;

  if (!name || !phone) {
    return res.status(400).json({ error: "Name and phone are required" });
  }

  if (!/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: "Phone must be 10 digits" });
  }

  if (!password) {
    return res.status(400).json({ error: "Password is required" });
  }

  // If provided, pincode must be exactly 6 digits
  if (pincode && !/^\d{6}$/.test(pincode)) {
    return res.status(400).json({ error: "Pincode must be 6 digits" });
  }

  // If either GST or company is provided, require both fields (but do NOT force B2B)
  const hasAnyGstField = (gst_number && gst_number.trim()) || (company && company.trim());
  if (hasAnyGstField) {
    if (!gst_number || !gst_number.trim()) {
      return res.status(400).json({ error: "GST number is required when company name is provided" });
    }
    if (!company || !company.trim()) {
      return res.status(400).json({ error: "Company name is required when GST number is provided" });
    }
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query("BEGIN");

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // ----- customer role -----
    const roleResult = await client.query(
      `SELECT id FROM roles WHERE LOWER(role_name) = 'customer' LIMIT 1`
    );

    if (!roleResult.rows.length) {
      throw new Error("Customer role not found");
    }

    const customerRoleId = roleResult.rows[0].id;

    // ----- Detect optional columns -----
    const usersHasUserType = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_type' 
      LIMIT 1
    `)).rows.length > 0;

    // ----- INSERT users -----
    let userInsertQuery = `
      INSERT INTO users (
        full_name,
        email,
        phone,
        state,
        city,
        address,
        password,
        role_id,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, full_name, email, phone, state, city, address, role_id, is_active;
    `;

    let userValues = [
      name,
      email,
      phone,
      state,
      city,
      address,
      hashedPassword,
      customerRoleId,
      true,
    ];

    if (usersHasUserType) {
      userInsertQuery = `
        INSERT INTO users (
          full_name,
          email,
          phone,
          state,
          city,
          address,
          password,
          role_id,
          user_type,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING id, full_name, email, phone, state, city, address, role_id, user_type, is_active;
      `;
      userValues = [
        name,
        email,
        phone,
        state,
        city,
        address,
        hashedPassword,
        customerRoleId,
        finalIsBusiness ? 'b2b' : 'b2c',
        true,
      ];
    }

    const userResult = await client.query(userInsertQuery, userValues);
    const newUser = userResult.rows[0];

    // ----- INSERT customer_profiles (passwords stored only in users table for security) -----
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
    
    let customerInsertQuery;
    let customerValues;
    
    if (hasCompanyAddressCol) {
      customerInsertQuery = `
        INSERT INTO customer_profiles (
          user_id,
          full_name,
          email,
          phone,
          state,
          city,
          pincode,
          address,
          is_business_customer,
          company_name,
          gst_number,
          company_address
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *;
      `;
      customerValues = [
        newUser.id,
        name,
        email,
        phone,
        state,
        city,
        pincode,
        address,
        isBusiness,
        company,
        gst_number,
        company_address || null,
      ];
      
      console.log('[POST /customers] Inserting customer_profiles with pincode:', {
        user_id: newUser.id,
        pincode: pincode,
        pincodeType: typeof pincode,
        pincodeIndex: 6 // pincode is at index 6 in customerValues
      });
    } else {
      customerInsertQuery = `
        INSERT INTO customer_profiles (
          user_id,
          full_name,
          email,
          phone,
          state,
          city,
          pincode,
          address,
          is_business_customer,
          company_name,
          gst_number
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *;
      `;
      customerValues = [
        newUser.id,
        name,
        email,
        phone,
        state,
        city,
        pincode,
        address,
        isBusiness,
        company,
        gst_number,
      ];
      
      console.log('[POST /customers] Inserting customer_profiles (no company_address) with pincode:', {
        user_id: newUser.id,
        pincode: pincode,
        pincodeType: typeof pincode,
        pincodeIndex: 6 // pincode is at index 6 in customerValues
      });
    }

    const customerResult = await client.query(
      customerInsertQuery,
      customerValues
    );

    await client.query("COMMIT");

    // Verify pincode was saved
    const verifyResult = await client.query(
      `SELECT pincode FROM customer_profiles WHERE user_id = $1`,
      [newUser.id]
    );
    if (verifyResult.rows.length > 0) {
      const savedPincode = verifyResult.rows[0].pincode;
      console.log(`[POST /customers] Verified pincode in DB after insert:`, {
        user_id: newUser.id,
        value: savedPincode,
        type: typeof savedPincode,
        isNull: savedPincode === null,
        isEmpty: savedPincode === '',
        expected: pincode
      });
      if (savedPincode !== pincode) {
        console.error(`[POST /customers] Pincode mismatch! Expected: ${pincode}, Got: ${savedPincode}`);
      }
    }

    const { password: _p, ...customer } = customerResult.rows[0] || {};

    return res.status(201).json({
      success: true,
      customer,
      user: newUser,
    });
  } catch (err) {
    try {
      if (client) {
        await client.query("ROLLBACK");
      }
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }

    console.error("Error creating customer:", err);

    // agar duplicate key hua to yahan se 400 + clear message
    if (err.code === "23505") {
      let msg = "Customer already exists";
      if (err.constraint?.includes("users_phone")) {
        msg = "Phone number already in use";
      } else if (err.constraint?.includes("users_email")) {
        msg = "Email already in use";
      }
      return res.status(400).json({ error: msg });
    }

    // dev mode: exact SQL / error message bhej do
    return res.status(500).json({
      error: err.message || "Internal server error while creating customer",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * PUT /api/admin/customers/:id
 * Update a customer's details (username, password, email, phone, address, etc.)
 */
router.put("/customers/:id", requireAuth, requireShop, requireSuperAdminOrAdmin, async (req, res) => {
  let client;
  
  try {
    const customerId = parseInt(req.params.id, 10);
    
    if (!customerId || isNaN(customerId)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid customer ID" 
      });
    }

    // Log the raw request body first
    console.log(`[PUT /customers/:id] Raw request body:`, JSON.stringify(req.body, null, 2));
    console.log(`[PUT /customers/:id] Request body keys:`, Object.keys(req.body || {}));
    console.log(`[PUT /customers/:id] Pincode in body:`, {
      value: req.body.pincode,
      type: typeof req.body.pincode,
      isNull: req.body.pincode === null,
      isUndefined: req.body.pincode === undefined,
      isEmpty: req.body.pincode === ''
    });

    const {
      name,
      email,
      phone,
      state,
      city,
      pincode,
      address,
      is_b2b,
      company,
      gst_number,
      company_address,
      password, // Optional - only update if provided
    } = req.body;

    // Process pincode: Check if property exists in request body
    // We'll determine the final value after fetching existing pincode from DB
    const pincodePropertyExists = req.body.hasOwnProperty("pincode");
    
    console.log(`[PUT /customers/:id] Processing pincode:`, {
      received: pincode,
      receivedType: typeof pincode,
      propertyExists: pincodePropertyExists,
      isNull: pincode === null,
      isUndefined: pincode === undefined,
      isEmpty: pincode === ''
    });
    
    // Log the incoming request
    console.log(`[PUT /customers/:id] Updating customer ${customerId} with data:`, {
      name,
      email,
      phone,
      state,
      city,
      pincode: {
        raw: pincode,
        rawType: typeof pincode,
        propertyExists: pincodePropertyExists
      },
      address,
      is_b2b,
      company,
      gst_number,
      company_address,
      hasPassword: !!password
    });

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Name is required" 
      });
    }

    if (!phone || !phone.trim()) {
      return res.status(400).json({ 
        success: false,
        error: "Phone number is required" 
      });
    }

    if (!/^\d{10}$/.test(phone.trim())) {
      return res.status(400).json({ 
        success: false,
        error: "Phone number must be 10 digits" 
      });
    }

    client = await db.pool.connect();
    await client.query("BEGIN");

    // Check if customer exists and get existing pincode and user_type
    const checkCustomerQuery = `
      SELECT cp.user_id, cp.full_name, cp.is_business_customer, cp.pincode, u.user_type
      FROM customer_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = $1
    `;
    const checkResult = await client.query(checkCustomerQuery, [customerId]);
    
    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ 
        success: false,
        error: "Customer not found" 
      });
    }
    
    // Get existing pincode and user_type from database
    const existingPincode = checkResult.rows[0].pincode;
    const existingUserType = checkResult.rows[0].user_type;
    console.log(`[PUT /customers/:id] Existing pincode in DB:`, {
      value: existingPincode,
      type: typeof existingPincode
    });
    
    // Determine final pincode value based on whether property was sent
    // Logic: If property exists in req.body, use it (empty string becomes null)
    //        If property does NOT exist, preserve existing value from DB
    let finalPincode;
    if (pincodePropertyExists) {
      // Property was sent - use the value (empty string becomes null)
      if (pincode === null || pincode === undefined || pincode === '') {
        finalPincode = null;
      } else {
        const trimmed = String(pincode).trim();
        finalPincode = trimmed.length > 0 ? trimmed : null;
      }
      console.log(`[PUT /customers/:id] Pincode property was sent, using value:`, finalPincode);
    } else {
      // Property was NOT sent - preserve existing value from database
      finalPincode = existingPincode;
      console.log(`[PUT /customers/:id] Pincode property NOT sent, preserving existing:`, finalPincode);
    }

    // User type should be preserved as set during the initial sale
    // Don't change user_type based on GST - it should remain B2B or B2C as originally set
    const parseIsB2B = (val) => {
      if (val === true || val === "true" || val === 1 || val === "1") return true;
      if (val === false || val === "false" || val === 0 || val === "0") return false;
      return null;
    };

    const hasGstDetails = (gst_number && gst_number.trim()) || (company && company.trim());
    
    // Determine is_business_customer from existing user_type (preserve user type, don't change based on GST)
    // User type should remain as set during the initial sale - GST details should NOT change it
    // If user_type is b2b, then is_business_customer should be true
    const isBusinessCustomerFromType = existingUserType && existingUserType.toLowerCase() === 'b2b';
    
    // If is_b2b is explicitly provided in the request, allow changing user type (admin/super admin override)
    // Otherwise, preserve existing user_type
    const incomingIsB2B = parseIsB2B(is_b2b);
    const finalIsB2B = incomingIsB2B !== null ? incomingIsB2B : isBusinessCustomerFromType;
    
    // Determine new user_type if explicitly changed
    let newUserType = existingUserType;
    if (incomingIsB2B !== null) {
      // Admin explicitly changed the user type
      newUserType = incomingIsB2B ? 'b2b' : 'b2c';
    }

    // If either GST or company is provided, require both fields (but do NOT auto-set B2B)
    if (hasGstDetails) {
      if (!gst_number || !gst_number.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          success: false,
          error: "GST number is required when company name is provided" 
        });
      }
      if (!company || !company.trim()) {
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          success: false,
          error: "Company name is required when GST number is provided" 
        });
      }
    }

    // Check if email or phone already exists for another user
    if (email && email.trim()) {
      const emailCheck = await client.query(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2`,
        [email.trim(), customerId]
      );
      if (emailCheck.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          success: false,
          error: "Email already in use by another customer" 
        });
      }
    }

    const phoneCheck = await client.query(
      `SELECT id FROM users WHERE phone = $1 AND id != $2`,
      [phone.trim(), customerId]
    );
    if (phoneCheck.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        success: false,
        error: "Phone number already in use by another customer" 
      });
    }

    const usersHasUserType = (await client.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'user_type' 
      LIMIT 1
    `)).rows.length > 0;

    // Update users table
    // Note: pincode is stored in customer_profiles, not users table
    let userUpdateQuery = `
      UPDATE users 
      SET 
        full_name = $1,
        email = $2,
        phone = $3,
        state = $4,
        city = $5,
        address = $6,
        updated_at = CURRENT_TIMESTAMP
    `;
    const userParams = [
      name.trim(), 
      email?.trim() || null, 
      phone.trim(),
      state?.trim() || null,
      city?.trim() || null,
      address?.trim() || null
    ];

    // Update user_type if explicitly changed via is_b2b flag
    // This allows admin/super admin to toggle between B2C and B2B
    if (incomingIsB2B !== null && newUserType !== existingUserType) {
      userUpdateQuery += `, user_type = $${userParams.length + 1}`;
      userParams.push(newUserType);
    }

    // Update password if provided
    if (password && password.trim()) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password.trim(), saltRounds);
      userUpdateQuery += `, password = $${userParams.length + 1}`;
      userParams.push(hashedPassword);
    }

    userUpdateQuery += ` WHERE id = $${userParams.length + 1}`;
    userParams.push(customerId);

    await client.query(userUpdateQuery, userParams);

    // Update customer_profiles table
    // Check if pincode column exists
    let hasPincodeCol = true;
    try {
      const pincodeColCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customer_profiles' 
        AND column_name = 'pincode'
      `);
      hasPincodeCol = pincodeColCheck.rows.length > 0;
      console.log(`[PUT /customers/:id] Pincode column exists: ${hasPincodeCol}`);
      if (!hasPincodeCol) {
        console.error(`[PUT /customers/:id] CRITICAL: pincode column does not exist in customer_profiles table!`);
      }
    } catch (colErr) {
      console.error(`[PUT /customers/:id] Error checking for pincode column:`, colErr);
    }
    
    // Ensure company_address column exists (it should, but handle gracefully)
    let profileUpdateQuery;
    let profileParams;
    
    try {
      // Try with company_address first
      profileUpdateQuery = `
        UPDATE customer_profiles 
        SET 
          full_name = $1,
          email = $2,
          phone = $3,
          state = $4,
          city = $5,
          pincode = $6,
          address = $7,
          is_business_customer = $8,
          company_name = $9,
          gst_number = $10,
          company_address = $11
        WHERE user_id = $12
      `;
      profileParams = [
        name.trim(),
        email?.trim() || null,
        phone.trim(),
        state?.trim() || null,
        city?.trim() || null,
        finalPincode,
        address?.trim() || null,
        finalIsB2B,
        company?.trim() || null,  // Allow company name regardless of customer type
        gst_number?.trim() || null,  // Allow GST number regardless of customer type
        company_address?.trim() || null,  // Allow company address regardless of customer type
        customerId
      ];
      
      console.log(`[PUT /customers/:id] About to execute UPDATE with params:`, {
        pincodeAtPosition6: profileParams[5],
        pincodeType: typeof profileParams[5],
        pincodeIsNull: profileParams[5] === null,
        allParams: profileParams.map((p, i) => ({ index: i + 1, value: p, type: typeof p }))
      });
      console.log(`[PUT /customers/:id] UPDATE query:`, profileUpdateQuery);
      
      const updateResult = await client.query(profileUpdateQuery, profileParams);
      
      console.log(`[PUT /customers/:id] UPDATE result:`, {
        rowCount: updateResult.rowCount,
        command: updateResult.command,
        oid: updateResult.oid
      });
      
      // Verify the update actually happened
      if (updateResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ 
          success: false,
          error: "Customer profile not found or update failed" 
        });
      }
      
      console.log(`[PUT /customers/:id] Successfully updated customer ${customerId}, rows affected: ${updateResult.rowCount}`);
      console.log(`[PUT /customers/:id] Updated customer_profiles values:`, {
        pincode: finalPincode,
        state: state?.trim() || null,
        city: city?.trim() || null,
        company_name: company?.trim() || null,
        gst_number: gst_number?.trim() || null,
        company_address: company_address?.trim() || null
      });
      
      // Verify pincode was saved
      const verifyResult = await client.query(
        `SELECT pincode FROM customer_profiles WHERE user_id = $1`,
        [customerId]
      );
      if (verifyResult.rows.length > 0) {
        const savedPincode = verifyResult.rows[0].pincode;
        console.log(`[PUT /customers/:id] Verified pincode in DB:`, {
          value: savedPincode,
          type: typeof savedPincode,
          isNull: savedPincode === null,
          isEmpty: savedPincode === ''
        });
        if (savedPincode !== finalPincode) {
          console.error(`[PUT /customers/:id] Pincode mismatch! Expected: ${finalPincode}, Got: ${savedPincode}`);
        }
      }
    } catch (updateErr) {
      // If company_address or pincode column doesn't exist, try without it
      if (updateErr.code === '42703' && (updateErr.message.includes('company_address') || updateErr.message.includes('pincode'))) {
        console.warn('[PUT /customers/:id] company_address column not found, updating without it');
        profileUpdateQuery = `
          UPDATE customer_profiles 
          SET 
            full_name = $1,
            email = $2,
            phone = $3,
            state = $4,
            city = $5,
            pincode = $6,
            address = $7,
            is_business_customer = $8,
            company_name = $9,
            gst_number = $10
          WHERE user_id = $11
        `;
        profileParams = [
          name.trim(),
          email?.trim() || null,
          phone.trim(),
          state?.trim() || null,
          city?.trim() || null,
          processedPincode,
          address?.trim() || null,
          finalIsB2B,
          company?.trim() || null,  // Allow company name regardless of customer type
          gst_number?.trim() || null,  // Allow GST number regardless of customer type
          customerId
        ];
        
        console.log(`[PUT /customers/:id] Fallback profile params - pincode:`, profileParams[5]);
        
        const updateResult = await client.query(profileUpdateQuery, profileParams);
        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ 
            success: false,
            error: "Customer profile not found or update failed" 
          });
        }
      } else {
        throw updateErr;
      }
    }

    await client.query("COMMIT");
    // client will be released in finally
    
    console.log(`[PUT /customers/:id] Transaction committed successfully for customer ${customerId}`);
    console.log(`[PUT /customers/:id] Final values that were saved:`, {
      pincode: finalPincode,
      is_b2b: finalIsB2B,
      company: company?.trim() || null,
      gst_number: gst_number?.trim() || null,
      company_address: company_address?.trim() || null
    });
    
    // Verify pincode was actually persisted after commit (using a new connection)
    try {
      const finalVerifyResult = await db.query(
        `SELECT pincode FROM customer_profiles WHERE user_id = $1`,
        [customerId]
      );
      if (finalVerifyResult.rows.length > 0) {
        const savedPincodeValue = finalVerifyResult.rows[0].pincode;
        console.log(`[PUT /customers/:id] Final verification after commit - pincode:`, {
          value: savedPincodeValue,
          type: typeof savedPincodeValue,
          isNull: savedPincodeValue === null,
          isEmpty: savedPincodeValue === '',
          expected: finalPincode,
          matches: savedPincodeValue === finalPincode
        });
        if (savedPincodeValue !== finalPincode) {
          console.error(`[PUT /customers/:id] CRITICAL: Pincode mismatch after commit! Expected: ${finalPincode}, Got: ${savedPincodeValue}`);
        }
      }
    } catch (verifyErr) {
      console.error(`[PUT /customers/:id] Error verifying pincode after commit:`, verifyErr);
    }

    // Fetch updated customer using a fresh query to verify the data was saved
    const updatedCustomer = await db.query(
      `SELECT 
        user_id AS id,
        full_name AS name,
        email,
        phone,
        state,
        city,
        pincode,
        address,
        is_business_customer AS is_b2b,
        company_name AS company,
        gst_number,
        company_address
      FROM customer_profiles 
      WHERE user_id = $1`,
      [customerId]
    );

    if (!updatedCustomer.rows || updatedCustomer.rows.length === 0) {
      console.error(`[PUT /customers/:id] ERROR: Could not fetch updated customer ${customerId} after commit!`);
      return res.status(500).json({ 
        success: false,
        error: "Customer was updated but could not be retrieved. Please refresh and check." 
      });
    }

    const responseData = {
      success: true,
      customer: updatedCustomer.rows[0],
    };

    console.log(`[PUT /customers/:id] Returning response for customer ${customerId}:`, {
      company: responseData.customer.company,
      gst_number: responseData.customer.gst_number,
      company_address: responseData.customer.company_address,
      is_b2b: responseData.customer.is_b2b
    });

    return res.json(responseData);
  } catch (err) {
    try {
      if (client) {
        await client.query("ROLLBACK");
      }
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }

    console.error("Error updating customer:", err);

    if (err.code === "23505") {
      let msg = "Update failed: duplicate entry";
      if (err.constraint?.includes("users_phone")) {
        msg = "Phone number already in use";
      } else if (err.constraint?.includes("users_email")) {
        msg = "Email already in use";
      }
      return res.status(400).json({ 
        success: false,
        error: msg 
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error while updating customer",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * DELETE /api/admin/customers/:id
 * Delete a customer permanently from both customer_profiles and users tables
 */
router.delete("/customers/:id", requireAuth, requireSuperAdminOrAdmin, async (req, res) => {
  let client;
  
  try {
    const customerId = parseInt(req.params.id, 10);
    
    if (!customerId || isNaN(customerId)) {
      return res.status(400).json({ 
        success: false,
        error: "Invalid customer ID" 
      });
    }

    client = await db.pool.connect();
    await client.query("BEGIN");

    // Check if customer exists
    const checkCustomerQuery = `
      SELECT user_id, full_name 
      FROM customer_profiles 
      WHERE user_id = $1
    `;
    const checkResult = await client.query(checkCustomerQuery, [customerId]);
    
    if (checkResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ 
        success: false,
        error: "Customer not found" 
      });
    }

    const customerName = checkResult.rows[0].full_name;

    // Detect optional tables safely
    const salesTableExists = (await client.query(`SELECT to_regclass('public.sales') IS NOT NULL AS exists`)).rows[0]?.exists;
    const saleItemsTableExists = (await client.query(`SELECT to_regclass('public.sale_items') IS NOT NULL AS exists`)).rows[0]?.exists;
    const serviceRequestsTableExists = (await client.query(`SELECT to_regclass('public.service_requests') IS NOT NULL AS exists`)).rows[0]?.exists;

    // Check if customer has any sales
    let salesCount = 0;
    if (salesTableExists) {
      const checkSalesQuery = `SELECT COUNT(*) as count FROM sales WHERE customer_id = $1`;
      const salesResult = await client.query(checkSalesQuery, [customerId]);
      salesCount = parseInt(salesResult.rows[0]?.count || 0);
    } else {
      console.warn("Sales table unavailable, skipping sales delete");
    }

    // Check service requests count only if table exists
    let serviceRequestsCount = 0;
    if (serviceRequestsTableExists) {
      const checkServiceRequestsQuery = `SELECT COUNT(*) as count FROM service_requests WHERE user_id = $1`;
      const serviceRequestsResult = await client.query(checkServiceRequestsQuery, [customerId]);
      serviceRequestsCount = parseInt(serviceRequestsResult.rows[0]?.count || 0);
    } else {
      console.warn("Service requests table unavailable, skipping service requests delete");
    }

    // If customer has sales or service requests, we need to handle them
    // Option 1: Delete related records (CASCADE)
    // Option 2: Set customer_id/user_id to NULL
    // We'll delete related records to maintain data integrity
    
    if (salesCount > 0 && salesTableExists) {
      // Delete sale_items first (due to foreign key constraint)
      if (saleItemsTableExists) {
        await client.query(`DELETE FROM sale_items WHERE sale_id IN (SELECT id FROM sales WHERE customer_id = $1)`, [customerId]);
      } else {
        console.warn("sale_items table unavailable, skipping sale_items delete");
      }
      // Then delete sales
      await client.query(`DELETE FROM sales WHERE customer_id = $1`, [customerId]);
    }

    if (serviceRequestsCount > 0 && serviceRequestsTableExists) {
      await client.query(`DELETE FROM service_requests WHERE user_id = $1`, [customerId]);
    }

    // Delete from customer_profiles first
    await client.query(`DELETE FROM customer_profiles WHERE user_id = $1`, [customerId]);

    // Then delete from users table
    await client.query(`DELETE FROM users WHERE id = $1`, [customerId]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: `Customer "${customerName}" deleted successfully`,
      deleted: {
        customer: true,
        sales: salesCount,
        serviceRequests: serviceRequestsCount
      }
    });
  } catch (err) {
    try {
      if (client) {
        await client.query("ROLLBACK");
      }
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }

    console.error("Error deleting customer:", err);

    // Handle foreign key constraint errors
    if (err.code === "23503") {
      return res.status(400).json({ 
        success: false,
        error: "Cannot delete customer: Customer has related records that cannot be deleted automatically" 
      });
    }

    return res.status(500).json({
      success: false,
      error: err.message || "Internal server error while deleting customer",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * GET /api/admin/staff-users
 * List all users with id, full_name, email, role_id (Super Admin only - for role management).
 */
router.get("/staff-users", requireAuth, requireShop, requireRole(1), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.full_name, u.email, u.phone, u.role_id, r.role_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.role_id ASC, u.full_name ASC`
    );
    res.json(result.rows.map((row) => ({
      id: row.id,
      full_name: row.full_name || "",
      email: row.email || "",
      phone: row.phone || "",
      role_id: row.role_id,
      role_name: row.role_name || (row.role_id === 1 ? "Super Admin" : row.role_id === 2 ? "Admin" : "Customer")
    })));
  } catch (err) {
    console.error("Error listing staff users:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
});

/**
 * PUT /api/admin/users/:id/role
 * Update a user's role (Super Admin only). Body: { role_id: 1|2|3 }.
 */
router.put("/users/:id/role", requireAuth, requireShop, requireRole(1), async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role_id } = req.body;
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const newRoleId = parseInt(role_id, 10);
    if (![1, 2, 3].includes(newRoleId)) {
      return res.status(400).json({ error: "role_id must be 1 (Super Admin), 2 (Admin), or 3 (Customer)" });
    }

    const userCheck = await db.query(
      "SELECT id, role_id FROM users WHERE id = $1",
      [userId]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userTypeMap = { 1: "super admin", 2: "admin", 3: "b2c" };
    const newUserType = userTypeMap[newRoleId] || "b2c";

    await db.query(
      `UPDATE users SET role_id = $1, updated_at = CURRENT_TIMESTAMP, user_type = $3 WHERE id = $2`,
      [newRoleId, userId, newUserType]
    );

    const updated = await db.query(
      "SELECT id, full_name, email, role_id FROM users WHERE id = $1",
      [userId]
    );
    const row = updated.rows[0];
    res.json({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      role_id: row.role_id
    });
  } catch (err) {
    console.error("Error updating user role:", err);
    res.status(500).json({ error: "Failed to update role" });
  }
});

module.exports = router;
