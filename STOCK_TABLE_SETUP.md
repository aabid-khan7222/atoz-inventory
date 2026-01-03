# Stock Table Setup Guide

This guide explains how to set up the stock table in your database.

## Overview

The stock table tracks individual stock items purchased, with one row per serial number. This allows for detailed tracking of:
- Purchase dates
- Suppliers/vendors
- Individual serial numbers
- Stock status (available, sold, damaged, returned)

## Database Migration

### Step 1: Create the Stock Table

Run the migration script to create the stock table:

```bash
cd server
node scripts/createStockTable.js
```

This will create the `stock` table with the following fields:
- `id` - Primary key
- `purchase_date` - Date when the item was purchased
- `sku` - Product SKU
- `series` - Product series
- `category` - Product category
- `name` - Product name
- `ah_va` - Ah/VA specification
- `quantity` - Always 1 (one row per item)
- `purchased_from` - Supplier/vendor name
- `warranty` - Warranty information
- `product_type_id` - Reference to product_type table
- `product_id` - Reference to products table
- `serial_number` - Serial number of the item
- `status` - Status: available, sold, damaged, or returned
- `created_at` - Timestamp when record was created
- `updated_at` - Timestamp when record was last updated

## How It Works

### Adding Products

When you add a product through **Inventory → Add Product**:
- If quantity > 0, stock table entries are automatically created
- One row is created per item (based on quantity)
- If serial numbers are provided, they are used; otherwise auto-generated

### Adding Stock

When you add stock through **Inventory → Add Stock**:
- You must provide purchase date and supplier (optional)
- You must provide serial numbers (one per quantity)
- One stock table row is created per serial number

### Stock Display

Stock data appears in:
- **Current Stock** - Shows available stock items
- **Stock History Ledger** - Shows all stock transactions
- **Purchase Section** - Shows purchase records grouped by date and supplier

## API Endpoints

### Get Stock
```
GET /api/inventory/stock?category=all&status=available&search=term
```

### Get Purchases (Grouped)
```
GET /api/inventory/purchases?category=all&dateFrom=2024-01-01&dateTo=2024-12-31&supplier=name
```

### Get Purchase Details
```
GET /api/inventory/purchases/detail?purchase_date=2024-01-15&purchased_from=Supplier&category=all
```

## Notes

- Each stock entry represents one physical item
- Serial numbers must be unique per product
- When items are sold, their status should be updated to 'sold'
- The stock table is linked to the products table via `product_id`

