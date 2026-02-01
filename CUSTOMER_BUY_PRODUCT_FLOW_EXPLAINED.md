# Customer Buy Product Flow (atoz-inventory) — Sirf Flow

Customer **Browse Products** se product dekh ke **Buy** karta hai, phir **PaymentModal** mein order place karta hai. Alternative: **Cart** bharke **Checkout** → **Place Order**. Dono **POST /sales** pe jate hain.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | Customer **Dashboard** → **Browse Products** → **CustomerProductListing**. Category choose → products load. Product pe **Buy** click → **PaymentModal** open. User name, phone, payment bharke **Place Order** dabata hai → **handlePurchase** run. (Ya **Checkout** pe jaake cart se **Place Order** → **handleCheckout**) |
| **Frontend kise call karta hai** | **PaymentModal** → **`api.createSale(saleData)`** (Buy flow). **Checkout** → **`api.createSale(saleData)`** (cart flow). Dono **api.js** use karte hain |
| **Frontend mein kya call hota hai** | **`api.createSale(saleData)`** — saleData: `customer_id`, `customer_name`, `customer_phone`, `items` (product_id, category, quantity, unit_price, vehicle_number / vehicle_numbers), `sale_type`, `payment_method`, `payment_status`, `notes`. Products **CustomerProductListing** mein **GET /products?category=...** se aate hain |

**Flow:** Browse Products → Buy → PaymentModal (ya Cart → Checkout) → handlePurchase / handleCheckout → api.createSale

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **PaymentModal** (**handlePurchase**) ya **Checkout** (**handleCheckout**) API ko call karte hain |
| **API kise call karta hai** | **`api.js`** ka **`createSale`** → **`request('/sales', { method: 'POST', body: JSON.stringify(saleData) })`** → **`fetch`** **POST /api/sales** → **Backend** |
| **API mein kya call hota hai** | **`request('/sales', { method: 'POST', body: JSON.stringify(saleData) })`** — Bearer token ke sath **POST /api/sales** |

**Flow:** PaymentModal / Checkout → createSale → request → fetch POST /api/sales → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/sales** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/sales.js`** → **`router.post('/', requireAuth, ...)`** → **DB** (`client.query` transaction ke andar) |
| **Backend mein kya call hota hai** | **POST /api/sales** handler: validate (items, customer name/phone). **findOrCreateCustomer** (ya logged-in `customer_id` use). **generateInvoiceNumber**. Har item: product fetch, serial **'PENDING'** (water ke liye **'N/A'**). **sales_item** **INSERT** (customer order). Stock **nahi** ghataate — admin baad mein serial assign karke stock update karta hai. **createNotification** (new customer order). **COMMIT** → **`{ success, sale: { invoice_number, ... } }`** |

**Flow:** Request → auth → transaction → customer resolve → invoice → sales_item INSERT (PENDING) → notification → COMMIT → response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**sales.js** POST /) **transaction** ke andar DB ko call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last. Backend **`client.query`** se queries chalaata hai |
| **DB mein kya call hota hai** | **`users`** / **`customer_profiles`**: find or create customer (email/mobile). **`products`**: **SELECT** (product by id + category). **`sales_item`**: **INSERT** (har unit ke liye — customer_id, invoice_number, product, **SERIAL_NUMBER = 'PENDING'** ya **'N/A'**, vehicle, MRP, discount, tax, final_amount, payment, etc.). **`notifications`**: INSERT (new customer order). Stock / **`stock`** table **update nahi** hoti — sirf sales_item insert |

**Flow:** Backend transaction → users/customer_profiles → products SELECT → sales_item INSERT (PENDING) → notifications INSERT

---

## Ek line flow

```
Customer (Browse Products → Buy → PaymentModal → Place Order)
  → Frontend (PaymentModal handlePurchase → api.createSale)
    → API (request → fetch POST /api/sales)
      → Backend (sales.js POST /)
        → DB (users, customer_profiles, products, sales_item, notifications)
      ← Backend (success + invoice_number)
    ← API (response)
  ← Frontend (invoice dikhao, modal close / success)
```

**Checkout flow:** Cart → Checkout → Place Order → **same** api.createSale → same backend → same DB.

---

*Sirf customer buy flow. Browse Products → Buy (PaymentModal) ya Cart → Checkout → Place Order. Dono **POST /api/sales**.*
