# Sell Stock Flow (atoz-inventory) — Sirf Flow

Admin / Super Admin **Inventory** → **Sell Stock** se customer ko product bechte waqt ye flow chalta hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User **Inventory** kholta hai → **Sell Stock** section pe click → **SellStock** component. Cart mein item add karke **Submit Sale** dabata hai → **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`SellStock.jsx`** → **`api.request('/admin-sales/sell-stock', { method: 'POST', body: JSON.stringify(saleData) })`** |
| **Frontend mein kya call hota hai** | **`handleSubmit`** cart ko **items** array banata hai (productId, category, quantity, serialNumber, vehicleNumbers, mrp, discountAmount, finalAmount). **saleData** mein: items, purchaseDate, customerName, customerMobileNumber, customerEmail, salesType (retail/wholesale), paymentMethod, paymentStatus, GST/B2B fields, commission fields. Ye **POST** body mein bhejta hai |

**Flow:** Inventory → Sell Stock → cart fill → Submit Sale → handleSubmit → api.request('/admin-sales/sell-stock', POST, saleData)

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **SellStock** ka **handleSubmit** **api.request** ko call karta hai (admin-sales sell-stock ke liye directly) |
| **API kise call karta hai** | **`api.request`** → **`fetch`** **POST /api/admin-sales/sell-stock** (Authorization: Bearer token) → **Backend** |
| **API mein kya call hota hai** | **`request('/admin-sales/sell-stock', { method: 'POST', body: JSON.stringify(saleData) })`** — `api.sellStock` / `api.adminSellStock` use nahi hota; SellStock **request** directly call karta hai |

**Flow:** SellStock → request → fetch POST /api/admin-sales/sell-stock → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/admin-sales/sell-stock** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/adminSales.js`** → **`router.post('/sell-stock', requireAuth, requireSuperAdminOrAdmin, ...)`** → **DB** (`client.query` transaction ke andar) |
| **Backend mein kya call hota hai** | **sell-stock** handler: validate (customer name/mobile, items). **findOrCreateCustomer** → **findOrCreateCommissionAgent** (agar commission) → **generateInvoiceNumber**. Har item ke liye: product fetch, serials resolve, **stock** se sold entries **DELETE**, **products** qty **UPDATE**, **sales_item** **INSERT**. Commission ho to **commission_agents** **UPDATE**. Transaction **COMMIT** → **`{ success, sale: { invoice_number, ... } }`** return |

**Flow:** Request → auth check → transaction BEGIN → customer/agent resolve → invoice number → per-item: stock delete, product qty update, sales_item insert → commission update → COMMIT → JSON response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**adminSales.js** sell-stock handler) **transaction** ke andar DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last hai. Backend **`client.query`** se queries chalaata hai |
| **DB mein kya call hota hai** | **`users`** / **`customer_profiles`**: find or create customer. **`commission_agents`**: find or create agent (agar commission), baad mein **UPDATE** total_commission_paid. **`products`**: **SELECT** (product detail), **UPDATE** (qty kam). **`stock`**: **SELECT** (oldest serials, getOldestSerialNumbers), **DELETE** (sold serial, status = 'available'). **`sales_item`**: **INSERT** (har unit ke liye — customer_id, invoice_number, product, serial, mrp, discount, tax, final_amount, payment, etc.). **`information_schema`**: sales_item columns check |

**Flow:** Backend transaction → users/customer_profiles → commission_agents (optional) → products SELECT/UPDATE → stock SELECT/DELETE → sales_item INSERT → commission_agents UPDATE (optional)

---

## Ek line flow

```
User (Inventory → Sell Stock → cart → Submit Sale)
  → Frontend (SellStock handleSubmit → api.request POST /admin-sales/sell-stock)
    → API (request → fetch with Bearer token)
      → Backend (adminSales.js sell-stock)
        → DB (users, customer_profiles, commission_agents, products, stock, sales_item)
      ← Backend (success + invoice_number)
    ← API (response)
  ← Frontend (success, form reset, invoice link)
```

---

*Sirf Sell Stock flow. Admin/Super Admin Inventory → Sell Stock section se.*
