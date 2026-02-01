# Add Stock Flow (atoz-inventory) — Sirf Flow

Inventory → **Add Stock** karte waqt ye flow chalta hai.

---

## Frontend

| | |
|---|---|
| **Frontend kaha call hota hai** | User **Inventory** kholta hai → **Add Stock** section pe click → **AddStock** component render. Form bharke **Add Stock** button dabata hai → **`handleSubmit`** run hota hai |
| **Frontend kise call karta hai** | **`AddStock.jsx`** → **`api.addStockWithSerials(...)`** (api.js) |
| **Frontend mein kya call hota hai** | **`api.addStockWithSerials(selectedCategory, selectedProduct.id, quantity, serialNumbers, purchaseDateTime, purchasedFrom, amount, dp, purchaseValue, discountAmount, discountPercent)`** — form se ye saari values jati hain |

**Flow:** Inventory → Add Stock section → AddStock form → handleSubmit → api.addStockWithSerials

---

## API (api.js)

| | |
|---|---|
| **API kaha call hota hai** | **AddStock** ka **handleSubmit** API ko call karta hai |
| **API kise call karta hai** | **`api.js`** ka **`addStockWithSerials`** → **`request(\`/inventory/${category}/add-stock-with-serials\`, { method: 'POST', body: JSON.stringify({...}) })`** → **`fetch`** se **Backend** |
| **API mein kya call hota hai** | **`POST /api/inventory/:category/add-stock-with-serials`** — body: `productId`, `quantity`, `serialNumbers`, `purchase_date`, `purchased_from`, `amount`, `dp`, `purchase_value`, `discount_amount`, `discount_percent` |

**Flow:** AddStock → addStockWithSerials → request → fetch (Authorization: Bearer token) → Backend

---

## Backend

| | |
|---|---|
| **Backend kaha call hota hai** | **Frontend** ka **fetch** **POST /api/inventory/:category/add-stock-with-serials** hit karta hai |
| **Backend kise call karta hai** | **`server/routes/inventory.js`** → **`router.post('/:category/add-stock-with-serials', requireAuth, requireSuperAdminOrAdmin, ...)`** → **DB** (`db.pool`, `client.query`) |
| **Backend mein kya call hota hai** | **add-stock-with-serials** handler — validate (productId, quantity, serials, category), product fetch, transaction: **products** UPDATE (qty), **stock** INSERT, **purchases** INSERT, **stock_history** INSERT (optional). Commit → success response |

**Flow:** Request aata hai → auth check → validate → transaction → DB queries → commit → JSON response

---

## DB

| | |
|---|---|
| **DB kaha call hota hai** | **Backend** (**inventory.js** add-stock-with-serials handler) DB ko **transaction** ke andar call karta hai |
| **DB kise call karta hai** | Koi nahi — DB last hai. Backend **`client.query`** (transaction client) se DB mein queries chalaata hai |
| **DB mein kya call hota hai** | **`products`**: SELECT (product by id + category), phir UPDATE (qty badha ke). **`stock`**: INSERT (naye serials, product_id, serial_number, etc.). **`purchases`**: INSERT (har serial ke liye purchase record). **`stock_history`** (agar table hai): INSERT (add transaction). **`information_schema`**: purchases columns / constraints check |

**Flow:** Backend transaction → products SELECT/UPDATE → stock INSERT → purchases INSERT → stock_history INSERT (optional)

---

## Ek line flow

```
User (Inventory → Add Stock → form submit)
  → Frontend (AddStock handleSubmit → api.addStockWithSerials)
    → API (request → fetch POST /api/inventory/:category/add-stock-with-serials)
      → Backend (inventory.js add-stock-with-serials)
        → DB (products, stock, purchases, stock_history)
      ← Backend (success JSON)
    ← API (response)
  ← Frontend (success message, form clear, products refresh)
```

---

*Sirf Add Stock flow. Inventory ke andar Add Stock section se.*
