# Database Tables Explanation - Sales System

## 📋 Three Main Tables

### 1. `sales_types` Table (Lookup/Reference Table)
**Purpose:** Stores the two types of sales (just 2 rows, never changes)

| id | type_name | description |
|---|---|---|
| **1** | `retail` | Retail customers (normal customers) |
| **2** | `wholesale` | Wholesale/B2B customers |

**This table is like a dictionary - it just defines what "1" and "2" mean.**

---

### 2. `sales_id` Table (Sales Transaction Headers)
**Purpose:** Stores one row per invoice/sale transaction

**Example Data:**
```
id | invoice_number | customer_id | customer_name | customer_mobile_number | sales_type | sales_type_id | created_at
---|----------------|-------------|---------------|----------------------|------------|---------------|------------
1  | INV-20241204-0001 | 5 | John Doe | 9876543210 | retail | 1 | 2024-12-04 10:30:00
2  | INV-20241204-0002 | 6 | ABC Company | 9876543211 | wholesale | 2 | 2024-12-04 11:15:00
3  | INV-20241204-0003 | 7 | Jane Smith | 9876543212 | retail | 1 | 2024-12-04 12:00:00
```

**What goes here:**
- One row per invoice/sale
- Customer information
- Invoice number
- Sales type (retail or wholesale)
- Sales type ID (1 or 2, references `sales_types` table)

**When it gets data:**
- When a customer buys from the UI
- When admin/super admin sells a battery
- Every time a sale happens

---

### 3. `sales_item` Table (Individual Batteries Sold)
**Purpose:** Stores one row per battery sold (even if customer buys 5 batteries, there are 5 rows)

**Example Data:**
```
id | sales_id | invoice_number | customer_name | SERIAL_NUMBER | NAME | SKU | MRP | final_amount | sales_type_id
---|----------|----------------|---------------|---------------|------|-----|-----|--------------|---------------
1  | 1 | INV-20241204-0001 | John Doe | SN12345 | EXIDE EPIQ 60Ah | EPIQ60 | 5000 | 4500 | 1
2  | 1 | INV-20241204-0001 | John Doe | SN12346 | EXIDE EPIQ 60Ah | EPIQ60 | 5000 | 4500 | 1
3  | 2 | INV-20241204-0002 | ABC Company | SN12347 | EXIDE MATRIX 100Ah | MAT100 | 8000 | 7500 | 2
4  | 2 | INV-20241204-0002 | ABC Company | SN12348 | EXIDE MATRIX 100Ah | MAT100 | 8000 | 7500 | 2
5  | 2 | INV-20241204-0002 | ABC Company | SN12349 | EXIDE MATRIX 100Ah | MAT100 | 8000 | 7500 | 2
6  | 3 | INV-20241204-0003 | Jane Smith | SN12350 | EXIDE RIDE 12Ah | RIDE12 | 2000 | 1800 | 1
```

**What goes here:**
- One row per battery sold
- Product details (name, SKU, serial number, MRP, etc.)
- Links to `sales_id` via `sales_id` column
- Sales type ID (1 or 2)

**When it gets data:**
- Every time a battery is sold
- If customer buys 3 batteries → 3 rows created
- If admin sells 5 batteries → 5 rows created

---

## 🔗 How They Connect

### Example: Customer buys 2 batteries

**Step 1:** Create entry in `sales_id` (1 row)
```
sales_id table:
id=1, invoice_number="INV-20241204-0001", customer_name="John", sales_type="retail", sales_type_id=1
```

**Step 2:** Create entries in `sales_item` (2 rows - one per battery)
```
sales_item table:
Row 1: sales_id=1, SERIAL_NUMBER="SN12345", NAME="EXIDE EPIQ 60Ah", sales_type_id=1
Row 2: sales_id=1, SERIAL_NUMBER="SN12346", NAME="EXIDE EPIQ 60Ah", sales_type_id=1
```

**Relationship:**
- `sales_item.sales_id` → points to `sales_id.id`
- `sales_id.sales_type_id` → points to `sales_types.id` (1 or 2)
- `sales_item.sales_type_id` → points to `sales_types.id` (1 or 2)

---

## 📊 Summary Table

| Table | Purpose | Rows | When Data Appears |
|-------|---------|------|-------------------|
| `sales_types` | Lookup table | 2 rows (fixed) | Created during migration |
| `sales_id` | Invoice headers | 1 row per sale | When any sale happens |
| `sales_item` | Individual batteries | 1 row per battery | When any battery is sold |

---

## 🎯 Real-World Example

**Scenario:** Admin sells 3 batteries to "ABC Company" (wholesale customer)

**What happens:**

1. **`sales_id` gets 1 row:**
   ```
   invoice_number: "INV-20241204-0002"
   customer_name: "ABC Company"
   sales_type: "wholesale"
   sales_type_id: 2  ← References sales_types table (ID 2)
   ```

2. **`sales_item` gets 3 rows:**
   ```
   Row 1: SERIAL_NUMBER="BAT001", sales_id=2, sales_type_id=2
   Row 2: SERIAL_NUMBER="BAT002", sales_id=2, sales_type_id=2
   Row 3: SERIAL_NUMBER="BAT003", sales_id=2, sales_type_id=2
   ```

3. **`sales_types` stays the same (always 2 rows):**
   ```
   ID 1 = retail
   ID 2 = wholesale
   ```

---

## ❓ Common Questions

**Q: Why is `sales_id` empty?**  
A: Because no sales have been made yet. It will fill up when you start making sales.

**Q: What's the difference between `sales_type` and `sales_type_id`?**  
A: 
- `sales_type` = Text value ("retail" or "wholesale")
- `sales_type_id` = Number (1 or 2) that references `sales_types` table

**Q: Why do we need `sales_types` table?**  
A: It's a lookup table. Instead of hardcoding "1" and "2" everywhere, we can reference this table and know:
- 1 = retail
- 2 = wholesale

This makes the database more maintainable and clear.

