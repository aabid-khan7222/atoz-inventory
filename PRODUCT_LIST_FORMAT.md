# Product List Format Guide

## How to Provide Your Product List

You can provide your product list in any of these formats:

### Option 1: Simple Text/List Format
Just list your products like this:
```
SKU: EPIQ-001
Name: EPIQ Battery 12V 100Ah
Series: EXIDE EPIQ
Category: car-truck-tractor
Stock: 10
MRP: 10000
Selling Price: 9000
Ah/VA: 100Ah
Warranty: 2 Years

SKU: XPLORE-001
Name: XPLORE Battery 12V 7Ah
Series: EXIDE XPLORE
Category: bike
Stock: 15
MRP: 2800
Selling Price: 2500
Ah/VA: 7Ah
Warranty: 1 Year
```

### Option 2: Table Format
Provide as a table:
| SKU | Name | Series | Category | Stock | MRP | Selling Price | Ah/VA | Warranty |
|-----|------|--------|----------|-------|-----|---------------|--------|----------|
| EPIQ-001 | EPIQ Battery 12V 100Ah | EXIDE EPIQ | car-truck-tractor | 10 | 10000 | 9000 | 100Ah | 2 Years |
| XPLORE-001 | XPLORE Battery 12V 7Ah | EXIDE XPLORE | bike | 15 | 2800 | 2500 | 7Ah | 1 Year |

### Option 3: Excel/CSV Format
If you have an Excel file or CSV, just share it and I'll convert it.

### Option 4: Simple List
Just list them one by one:
- EPIQ-001, EPIQ Battery 12V 100Ah, EXIDE EPIQ, car-truck-tractor, 10, 10000, 9000, 100Ah, 2 Years
- XPLORE-001, XPLORE Battery 12V 7Ah, EXIDE XPLORE, bike, 15, 2800, 2500, 7Ah, 1 Year

## Required Fields

- **SKU**: Unique product code (required)
- **Name**: Product name (required)
- **Category**: One of:
  - `car-truck-tractor` (for Car/Truck/Tractor batteries)
  - `bike` (for Bike batteries)
  - `ups-inverter` or `hups-inverter` (for HUPS/Inverter batteries)
- **Selling Price**: Selling price (required)
- **MRP Price**: Maximum Retail Price (required)

## Optional Fields

- **Series**: Product series name (e.g., "EXIDE EPIQ")
- **Stock/Qty**: Initial stock quantity (default: 0)
- **Ah/VA**: Battery capacity (e.g., "100Ah", "7Ah")
- **Warranty**: Warranty period (e.g., "2 Years", "1 Year")
- **Order Index**: Display order (auto-assigned if not provided)

## Notes

- Products will be automatically ordered by:
  1. Category (Car/Truck/Tractor → Bike → HUPS/Inverter)
  2. Order Index (within each category)
- Discount will be auto-calculated as: MRP - Selling Price
- If you don't provide Order Index, products will be auto-numbered within each category

## Example Categories

- **car-truck-tractor**: For car, truck, and tractor batteries
- **bike**: For bike/motorcycle batteries
- **ups-inverter** or **hups-inverter**: For UPS and inverter batteries

Just provide your list in any format you prefer, and I'll add all the products to the database!

