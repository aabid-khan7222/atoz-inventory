# Sales System Rebuild - Migration Instructions

## Overview
This migration completely rebuilds the sales system with new tables (`sales_id` and `sales_item`) and implements all the requested features.

## Step 1: Run Database Migration

### Option A: Using the Migration Script (Recommended)
```bash
cd server
node scripts/run_rebuild_sales_migration.js
```

### Option B: Manual SQL Execution
1. Connect to your PostgreSQL database
2. Run the SQL file: `server/migrations/rebuild_sales_system.sql`
3. Run the notifications table: `server/migrations/create_notifications_table.sql`

## Step 2: Install Dependencies

The migration doesn't require any new npm packages. All existing dependencies are sufficient.

## Step 3: Verify Migration

After running the migration, verify that:
1. Old `sales` and `sale_items` tables are dropped
2. New `sales_id` and `sales_item` tables are created
3. `notifications` table is created
4. All indexes are created

## What Changed

### Database Changes
- **Deleted**: `sales` and `sale_items` tables (all data cleared)
- **Created**: `sales_id` table (sales transaction headers)
- **Created**: `sales_item` table (one row per battery sold)
- **Created**: `notifications` table (for admin notifications)
- **Updated**: `users` table (added `email` and `customer_type` columns if they don't exist)

### Backend Changes
- **New Route**: `/api/admin-sales/sell-stock` - Admin/Super Admin sell stock
- **New Route**: `/api/admin-sales/sales-items` - Get all sales items
- **New Route**: `/api/notifications` - Notification system
- **Updated**: `/api/sales` - Now uses new `sales_id` and `sales_item` tables
- **Updated**: Auto-serial assignment (oldest first - FIFO)
- **Updated**: Auto-create customer accounts when admin sells

### Frontend Changes
- **Updated**: `SellStock.jsx` - Two sections: "Sale to Customer" and "Sale to Wholesale/B2B"
- **Updated**: `CustomerOrders.jsx` - Shows items from `sales_item` table
- **Updated**: `SoldBatteries.jsx` - Uses new `sales_item` data
- **Updated**: `PaymentModal.jsx` - Auto-serial assignment (oldest first)

## Key Features Implemented

1. ✅ **Two Sales Types**: Retail (normal customers) and Wholesale/B2B
2. ✅ **Auto-Serial Assignment**: Oldest serial numbers assigned first (FIFO)
3. ✅ **Auto-Create Customer**: When admin sells to new customer, account is auto-created
4. ✅ **GST Handling**: GST is shown separately even though included in MRP
5. ✅ **One Row Per Battery**: Each battery sold gets its own row in `sales_item`
6. ✅ **Notifications**: Admin/Super Admin get notified when customers place orders
7. ✅ **Complete Order History**: All purchased products shown in "My Orders"

## Testing Checklist

- [ ] Run migration successfully
- [ ] Test customer purchase from UI (auto-serial assignment)
- [ ] Test admin sell to customer (new form with two sections)
- [ ] Test admin sell to wholesale/B2B
- [ ] Verify auto-creation of customer account
- [ ] Check "My Orders" shows all items
- [ ] Verify notifications appear for admin/super admin
- [ ] Test PDF print/download (when implemented)

## Notes

- All previous sales data has been cleared
- Serial numbers are automatically assigned from oldest to newest
- Customer accounts are auto-created with email as username and mobile as password
- GST breakdown is calculated and shown separately (18% GST included in MRP)

## Troubleshooting

If you encounter errors:
1. Check database connection
2. Verify all migrations ran successfully
3. Check server logs for detailed error messages
4. Ensure all required columns exist in `users` table

