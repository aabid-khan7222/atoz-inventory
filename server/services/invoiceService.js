const db = require('../db');

// Convert number to words (Indian numbering system)
function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const scales = ['', 'Thousand', 'Lakh', 'Crore'];

  function convertHundreds(num) {
    let result = '';
    if (num >= 100) {
      result += ones[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num >= 20) {
      result += tens[Math.floor(num / 10)] + ' ';
      num %= 10;
    }
    if (num > 0) {
      result += ones[num] + ' ';
    }
    return result.trim();
  }

  if (amount === 0) return 'Zero';
  
  const integerPart = Math.floor(amount);
  const decimalPart = Math.round((amount - integerPart) * 100);

  let words = '';
  let num = integerPart;
  
  if (num >= 10000000) {
    words += convertHundreds(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    words += convertHundreds(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    words += convertHundreds(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  if (num > 0) {
    words += convertHundreds(num);
  }

  words = words.trim();
  
  if (!words) words = 'Zero';
  
  return words + ' Only';
}

// Calculate GST breakdown (18% GST included in MRP)
function calculateGSTBreakdown(mrp, discountAmount, quantity) {
  // MRP includes 18% GST
  // Base Price = MRP / 1.18
  // GST Amount = MRP - Base Price
  const basePrice = mrp / 1.18;
  const gstAmount = mrp - basePrice;
  
  // Calculate after discount
  const totalMRP = mrp * quantity;
  const totalDiscount = discountAmount;
  const subtotalBeforeGST = (basePrice * quantity) - totalDiscount;
  
  // Recalculate GST on discounted amount
  // If discount is applied, GST should be calculated on the discounted base price
  const discountedPricePerUnit = (mrp * quantity - totalDiscount) / quantity;
  const discountedBasePrice = discountedPricePerUnit / 1.18;
  const discountedGSTPerUnit = discountedPricePerUnit - discountedBasePrice;
  
  const subtotal = discountedBasePrice * quantity;
  const sgst = (discountedGSTPerUnit * quantity) / 2;
  const cgst = (discountedGSTPerUnit * quantity) / 2;
  const grandTotal = subtotal + sgst + cgst;
  
  // Round off to nearest rupee
  const roundedTotal = Math.round(grandTotal);
  const roundOff = roundedTotal - grandTotal;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    roundOff: parseFloat(roundOff.toFixed(2)),
    grandTotal: roundedTotal
  };
}

// Format date to DD-MMM-YYYY
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Get invoice by invoice number
async function getInvoiceByNumber(invoiceNumber) {
  try {
    // Get sale header info
    const saleResult = await db.query(
      `SELECT 
        invoice_number,
        customer_id,
        customer_name,
        customer_mobile_number,
        customer_vehicle_number,
        sales_type,
        sales_type_id,
        created_by,
        customer_business_name,
        customer_gst_number,
        customer_business_address,
        MIN(created_at) as created_at,
        MAX(updated_at) as updated_at
      FROM sales_item 
      WHERE invoice_number = $1
      GROUP BY invoice_number, customer_id, customer_name, customer_mobile_number, 
               customer_vehicle_number, sales_type, sales_type_id, created_by,
               customer_business_name, customer_gst_number, customer_business_address
      LIMIT 1`,
      [invoiceNumber]
    );

    if (saleResult.rows.length === 0) {
      throw new Error('Invoice not found');
    }

    const sale = saleResult.rows[0];

    // Get all items
    // PostgreSQL converts unquoted identifiers to lowercase
    // Since columns are created/inserted without quotes, they're stored as lowercase
    // Use lowercase in SELECT and access as lowercase in JavaScript
    const itemsResult = await db.query(
      `SELECT 
        id,
        product_id,
        sku,
        series,
        category,
        name,
        ah_va,
        quantity,
        warranty,
        serial_number,
        mrp,
        discount_amount,
        tax,
        final_amount,
        customer_vehicle_number
      FROM sales_item 
      WHERE invoice_number = $1 
      ORDER BY id`,
      [invoiceNumber]
    );

    const items = itemsResult.rows;

    // Calculate totals from actual sales data
    let totalFinalAmount = 0;
    let totalDiscount = 0;
    let totalQuantity = 0;
    let totalMRP = 0;
    
    // Group items by product (combine same products)
    // Use product_id if available, otherwise use SKU+NAME combination
    // IMPORTANT: Preserve serial-to-vehicle mapping for invoice display
    const groupedItems = {};
    items.forEach(item => {
      // Create a unique key for grouping - use product_id if available, otherwise sku+name, or id as fallback
      const key = item.product_id ? `product_${item.product_id}` : 
                  (item.sku || item.name) ? `${item.sku || ''}-${item.name || ''}` : 
                  `item_${item.id}`;
      
      if (!groupedItems[key]) {
        groupedItems[key] = {
          sku: item.sku || null,
          series: item.series || null,
          category: item.category || null,
          name: item.name || null,
          ah_va: item.ah_va || null,
          warranty: item.warranty || null,
          quantity: 0,
          serialNumbers: [], // Keep for backward compatibility
          serialVehicleMapping: [], // Array of {serial, vehicle} objects to preserve mapping
          rateInclTax: parseFloat(item.mrp || 0),
          rate: (parseFloat(item.mrp || 0) / 1.18).toFixed(2),
          taxPercent: 18,
          discountPercent: 0,
          mrp: parseFloat(item.mrp || 0),
          discountAmount: 0,
          amount: 0
        };
      }
      const itemQuantity = parseInt(item.quantity || 1, 10); // Default to 1 if quantity is missing
      groupedItems[key].quantity += itemQuantity;
      
      // Preserve serial-to-vehicle mapping
      const serialNumber = item.serial_number && String(item.serial_number).trim() ? item.serial_number : null;
      const vehicleNumber = item.customer_vehicle_number && String(item.customer_vehicle_number).trim() ? item.customer_vehicle_number : null;
      
      if (serialNumber) {
        groupedItems[key].serialNumbers.push(serialNumber); // Keep for backward compatibility
        groupedItems[key].serialVehicleMapping.push({
          serial: serialNumber,
          vehicle: vehicleNumber
        });
      }
      
      groupedItems[key].discountAmount += parseFloat(item.discount_amount || 0);
      groupedItems[key].amount += parseFloat(item.final_amount || 0);
      
      totalMRP += parseFloat(item.mrp || 0) * itemQuantity;
      totalDiscount += parseFloat(item.discount_amount || 0);
      totalFinalAmount += parseFloat(item.final_amount || 0);
      totalQuantity += itemQuantity;
    });

    // Calculate discount percentage for each item
    Object.keys(groupedItems).forEach(key => {
      const item = groupedItems[key];
      const itemTotalMRP = item.mrp * item.quantity;
      item.discountPercent = itemTotalMRP > 0 ? ((item.discountAmount / itemTotalMRP) * 100).toFixed(2) : 0;
    });

    // GST is already included in final_amount
    // User wants to show SGST 9% and CGST 9% labels but without detailed calculation breakdown
    // Extract GST for informational display: base = final_amount / 1.18, GST = final_amount - base
    // But Grand Total should just be the final_amount (GST inclusive)
    const baseAmount = totalFinalAmount / 1.18;
    const totalGST = totalFinalAmount - baseAmount;
    const sgst = totalGST / 2;
    const cgst = totalGST / 2;
    
    // Round off to nearest rupee
    const roundedTotal = Math.round(totalFinalAmount);
    const roundOff = roundedTotal - totalFinalAmount;
    
    const invoice = {
      invoiceNumber: sale.invoice_number,
      date: formatDate(sale.created_at),
      referenceNumber: sale.invoice_number,
      referenceDate: formatDate(sale.created_at),
      customer: {
        name: sale.customer_name,
        mobile: sale.customer_mobile_number,
        vehicleNumber: sale.customer_vehicle_number || '',
        salesType: sale.sales_type === 'retail' ? 'Retail' : sale.sales_type === 'wholesale' ? 'Wholesale' : 'B2B',
        businessName: sale.customer_business_name || '',
        gstNumber: sale.customer_gst_number || '',
        businessAddress: sale.customer_business_address || ''
      },
      items: Object.values(groupedItems),
      totals: {
        subtotal: parseFloat(baseAmount.toFixed(2)),
        sgst: parseFloat(sgst.toFixed(2)),
        cgst: parseFloat(cgst.toFixed(2)),
        roundOff: parseFloat(roundOff.toFixed(2)),
        quantity: totalQuantity,
        grandTotal: roundedTotal,
        amountInWords: `INR ${numberToWords(roundedTotal)}`
      },
      createdAt: sale.created_at
    };

    return invoice;
  } catch (error) {
    console.error('Error getting invoice:', error);
    throw error;
  }
}

module.exports = {
  getInvoiceByNumber,
  formatDate,
  numberToWords
};

