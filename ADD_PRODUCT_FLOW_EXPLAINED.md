# Add Product Flow (atoz-inventory) — Sirf Flow

Admin ya Super Admin **Products** section mein jaake **Add Product** se naya product add karte waqt ye flow chalta hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User **Admin / Super Admin** dashboard → **Products** section → **ProductManagement**. **Add Product** button dabata hai → **Add Product** modal open. Form bharke **Create Product** / submit dabata hai → **`handleAddProduct`** run hota hai |
| **Frontend kise call karta hai** | **`ProductManagement.jsx`** → **`api.createProduct(productData)`** (api.js) |
| **Frontend mein kya call hota hai** | **`handleAddProduct`** — validate (admin/super-admin role, token, SKU, name, MRP). **productData** banata hai: sku, name, series, category, dp, mrp, B2C/B2B selling price & discount, ah_va, warranty, qty, purchase_date, purchased_from, serial_numbers, purchase_value, etc. **`api.createProduct(productData)`** call karta hai |

**Flow:** Dashboard → Products → Add Product button → modal → form submit → handleAddProduct → api.createProduct

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **ProductManagement** ka **handleAddProduct** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`createProduct`** → **`request("/products", { method: "POST", body: JSON.stringify(product) })`** → **`fetch`** **POST /api/products** → **Backend** |
| **API mein kya call hota hai** | **`request("/products", { method: "POST", body: JSON.stringify(product) })`** — Bearer token ke sath **POST /api/products**, body mein product object |

**Flow:** ProductManagement → createProduct → request → fetch POST /api/products → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/products** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/products.js`** → **`router.post('/', requireAuth, requireAdmin, ...)`** → **DB** (`db.query`) |
| **Backend mein kya call hota hai** | **POST /api/products** handler: validate (SKU, name, qty, ah_va, warranty, series). **product_type_id** category se. **order_index** = max+1. **products** table mein **INSERT**. Agar **qty > 0** aur purchase info hai to har unit ke liye **stock** **INSERT**, **purchases** **INSERT** (ON CONFLICT DO UPDATE). **201** + created product return |

**Flow:** Request → auth + requireAdmin → validate → products INSERT → (qty > 0 → stock + purchases INSERT) → 201 response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**products.js** POST /) DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last. Backend **`db.query`** se queries chalaata hai |
| **DB mein kya call hota hai** | **`products`**: **SELECT** (max order_index), phir **INSERT** (sku, series, category, name, qty, dp, mrp_price, selling_price, discount, discount_percent, b2b_*, ah_va, warranty, guarantee_period_months, order_index, product_type_id). **Agar qty > 0**: **`stock`** **INSERT** (har unit — purchase_date, sku, series, category, name, product_id, serial_number, status 'available'). **`purchases`** **INSERT** (har unit — product_type_id, purchase_number, product_sku, serial_number, supplier, dp, purchase_value, discount) **ON CONFLICT** (product_sku, serial_number) **DO UPDATE** |

**Flow:** Backend → products SELECT (order_index) + INSERT → (qty > 0) stock INSERT, purchases INSERT

---

## Ek line flow

```
Admin/Super Admin (Products → Add Product → form submit)
  → Frontend (ProductManagement handleAddProduct → api.createProduct)
    → API (request → fetch POST /api/products)
      → Backend (products.js POST /)
        → DB (products INSERT → stock, purchases INSERT if qty > 0)
      ← Backend (201 + product)
    ← API (response)
  ← Frontend (modal close, form reset, fetchProducts, success message)
```

---

*Sirf Add Product flow. Admin/Super Admin → Products → Add Product.*
