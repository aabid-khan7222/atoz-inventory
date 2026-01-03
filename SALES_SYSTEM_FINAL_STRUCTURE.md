# Sales System - Final Structure ✅

## Database Tables

### 1. `sales_types` (Lookup Table)
**Purpose:** Defines the two sales type IDs
- **ID 1** = Retail customers
- **ID 2** = Wholesale/B2B customers

### 2. `sales_id` (Invoice Headers)
**Purpose:** One row per invoice/sale transaction
- Stores invoice-level information
- Customer details (name, mobile, vehicle)
- Invoice number
- Sales type and sales_type_id
- Created by (admin/user who made the sale)

### 3. `sales_item` (Individual Batteries)
**Purpose:** One row per battery sold
- Links to `sales_id` via `sales_id` column
- Stores each battery's details (serial number, product info, price)
- Also has customer info (for easy querying)
- Sales type and sales_type_id

---

## How They Work Together

### Example: Admin sells 3 batteries to "ABC Company"

**Step 1:** Create entry in `sales_id`
```sql
INSERT INTO sales_id (
  invoice_number, customer_name, customer_mobile_number,
  sales_type, sales_type_id
) VALUES (
  'INV-20241204-0001', 'ABC Company', '9876543210',
  'wholesale', 2
);
-- Returns: id = 1
```

**Step 2:** Create 3 entries in `sales_item` (one per battery)
```sql
INSERT INTO sales_item (
  sales_id, invoice_number, customer_name, SERIAL_NUMBER,
  NAME, MRP, final_amount, sales_type_id
) VALUES
  (1, 'INV-20241204-0001', 'ABC Company', 'SN001', 'EXIDE EPIQ 60Ah', 5000, 4500, 2),
  (1, 'INV-20241204-0001', 'ABC Company', 'SN002', 'EXIDE EPIQ 60Ah', 5000, 4500, 2),
  (1, 'INV-20241204-0001', 'ABC Company', 'SN003', 'EXIDE EPIQ 60Ah', 5000, 4500, 2);
```

**Result:**
- `sales_id` table: **1 row** (invoice header)
- `sales_item` table: **3 rows** (one per battery)
- All linked via `sales_id` column

---

## Benefits of This Design

✅ **Efficient Storage** - Customer info stored once per invoice  
✅ **Easy Grouping** - Get all items for an invoice: `WHERE sales_id = 1`  
✅ **Invoice Totals** - Stored in `sales_id` or calculated from `sales_item`  
✅ **Standard Design** - Follows database normalization best practices  
✅ **Flexible** - Easy to add invoice-level features (discounts, taxes, etc.)

---

## Query Examples

### Get all items for an invoice
```sql
SELECT * FROM sales_item WHERE sales_id = 1;
```

### Get invoice with all items
```sql
SELECT 
  si.*,
  s.invoice_number,
  s.customer_name,
  s.sales_type
FROM sales_id s
JOIN sales_item si ON s.id = si.sales_id
WHERE s.id = 1;
```

### Get all retail sales
```sql
SELECT * FROM sales_item WHERE sales_type_id = 1;
```

### Get all wholesale sales
```sql
SELECT * FROM sales_item WHERE sales_type_id = 2;
```

---

## Current Status

✅ **sales_types** - Has 2 rows (ID 1 and 2)  
⏳ **sales_id** - Empty (will populate when sales are made)  
⏳ **sales_item** - Empty (will populate when batteries are sold)

**Everything is ready!** The system will work perfectly when you start making sales.

