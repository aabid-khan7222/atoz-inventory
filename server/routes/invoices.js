const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const invoiceService = require('../services/invoiceService');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Get invoice data by invoice number
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params; // invoice number
    const invoice = await invoiceService.getInvoiceByNumber(id);

    // Check permissions
    // If customer, only allow access to their own invoices
    if (req.user.role_id >= 3) {
      // Customer role - need to check if invoice belongs to them
      const saleCheck = await require('../db').query(
        `SELECT customer_id FROM sales_item WHERE invoice_number = $1 LIMIT 1`,
        [id]
      );
      if (saleCheck.rows.length > 0 && saleCheck.rows[0].customer_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(error.message === 'Invoice not found' ? 404 : 500).json({
      error: error.message || 'Failed to fetch invoice'
    });
  }
});

// Generate PDF for invoice
router.get('/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { id } = req.params; // invoice number
    const invoice = await invoiceService.getInvoiceByNumber(id);

    // Check permissions (same as above)
    if (req.user.role_id >= 3) {
      const saleCheck = await require('../db').query(
        `SELECT customer_id FROM sales_item WHERE invoice_number = $1 LIMIT 1`,
        [id]
      );
      if (saleCheck.rows.length > 0 && saleCheck.rows[0].customer_id !== req.user.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Read logo file and convert to base64
    let logoBase64 = '';
    try {
      // Try public folder first
      let logoPath = path.join(__dirname, '../../client/public/exide-care.png');
      if (!fs.existsSync(logoPath)) {
        // Fallback to assets folder
        logoPath = path.join(__dirname, '../../client/src/assets/exide-care.png');
      }
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        logoBase64 = logoBuffer.toString('base64');
      } else {
        console.warn('Logo file not found at expected paths');
      }
    } catch (error) {
      console.error('Error reading logo file:', error);
      // Continue without logo if file can't be read
    }

    // Generate HTML for invoice
    const html = generateInvoiceHTML(invoice, logoBase64);

    // Generate PDF using Puppeteer
    // Set cache directory for Render.com BEFORE any Puppeteer calls
    const cacheDir = process.env.PUPPETEER_CACHE_DIR || (process.env.HOME ? `${process.env.HOME}/.cache/puppeteer` : '/opt/render/.cache/puppeteer');
    if (cacheDir && !process.env.PUPPETEER_CACHE_DIR) {
      process.env.PUPPETEER_CACHE_DIR = cacheDir;
    }
    
    // Ensure cache directory exists
    if (cacheDir && !fs.existsSync(cacheDir)) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        console.log('✓ Created Puppeteer cache directory:', cacheDir);
      } catch (mkdirError) {
        console.warn('⚠ Could not create cache directory:', mkdirError.message);
      }
    }

    // Configure Puppeteer - let it auto-detect Chrome (simplest and most reliable)
    const puppeteerOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    };

    // Try to find Chrome, but don't fail if not found - let Puppeteer handle it
    try {
      // First, try Puppeteer's built-in method
      try {
        const executablePath = puppeteer.executablePath();
        if (executablePath && fs.existsSync(executablePath)) {
          puppeteerOptions.executablePath = executablePath;
          console.log('✓ Using Puppeteer Chrome at:', executablePath);
        }
      } catch (execPathError) {
        // Chrome not found via executablePath - that's okay, Puppeteer will download it
        console.log('ℹ Chrome not found via executablePath(), Puppeteer will auto-detect or download');
      }

      // If still not found, try to install Chrome
      if (!puppeteerOptions.executablePath) {
        console.log('ℹ Attempting to ensure Chrome is installed...');
        try {
          const { execSync } = require('child_process');
          execSync('npx puppeteer browsers install chrome', { 
            stdio: 'pipe', 
            timeout: 180000,
            env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir }
          });
          console.log('✓ Chrome installation command completed');
          
          // Try executablePath again after installation
          try {
            const newPath = puppeteer.executablePath();
            if (newPath && fs.existsSync(newPath)) {
              puppeteerOptions.executablePath = newPath;
              console.log('✓ Using installed Chrome at:', newPath);
            }
          } catch (e) {
            // Still not found - that's okay, Puppeteer will handle it
            console.log('ℹ Chrome installed but path not detected, Puppeteer will auto-detect');
          }
        } catch (installError) {
          console.warn('⚠ Chrome installation attempt failed:', installError.message);
          console.log('ℹ Continuing anyway - Puppeteer may download Chrome on first launch');
        }
      }
    } catch (configError) {
      console.warn('⚠ Configuration check failed:', configError.message);
      // Continue - Puppeteer will handle Chrome detection/download
    }

    // Launch browser - Puppeteer will download Chrome automatically if needed
    console.log('🚀 Launching Puppeteer browser...');
    const browser = await puppeteer.launch(puppeteerOptions);

    const page = await browser.newPage();
    
    // Set longer timeout for page content (60 seconds instead of default 30)
    page.setDefaultNavigationTimeout(60000);
    
    // Use 'load' instead of 'networkidle0' - faster and more reliable for self-contained HTML
    // 'load' waits for page load event, which is sufficient for static HTML with base64 images
    // 'networkidle0' waits for network to be idle, which can timeout unnecessarily
    await page.setContent(html, { 
      waitUntil: 'load',
      timeout: 60000 
    });
    
    // Small delay to ensure all rendering is complete
    await page.waitForTimeout(500);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      },
      printBackground: true,
      timeout: 60000 // 60 second timeout for PDF generation
    });

    await browser.close();

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Failed to generate PDF';
    
    if (errorMessage.includes('Could not find Chrome') || errorMessage.includes('Browser not found')) {
      errorMessage = `PDF generation failed: Chrome browser not found. Please ensure Chrome/Chromium is installed. ${errorMessage}`;
    }
    
    res.status(error.message === 'Invoice not found' ? 404 : 500).json({
      error: errorMessage
    });
  }
});

// Generate invoice HTML
function generateInvoiceHTML(invoice, logoBase64 = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GST Invoice - ${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: A4;
      margin: 5mm 5mm 3mm 5mm;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #000;
    }

    .invoice-page {
      width: 210mm;
      height: 238mm;
      min-height: 238mm;
      max-height: 238mm;
      position: relative;
      overflow: visible;
      padding: 0;
      margin: 0;
    }

    .invoice-title {
      text-align: center;
      font-size: 22px;
      font-weight: bold;
      margin-bottom: 12px;
      padding-top: 5px;
      color: #000;
    }

    .seller-buyer-section {
      display: table;
      width: 100%;
      margin-bottom: 10px;
    }

    .seller-box {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 8px;
      border: 1px solid #000;
      padding: 8px;
      box-sizing: border-box;
    }

    .company-logo {
      max-width: 60px;
      max-height: 50px;
      width: auto;
      height: auto;
      object-fit: contain;
      display: block;
      margin-bottom: 4px;
    }

    .invoice-details-box {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-left: 8px;
      border: 1px solid #000;
      padding: 8px;
      box-sizing: border-box;
    }

    .section-title {
      font-weight: bold;
      margin-bottom: 5px;
      font-size: 13px;
      color: #000;
    }

    .seller-info {
      font-size: 10px;
      line-height: 1.3;
      color: #000;
    }

    .buyer-section {
      width: 100%;
      border: 1px solid #000;
      padding: 8px;
      margin-bottom: 10px;
      box-sizing: border-box;
    }

    .buyer-info-row {
      display: table;
      width: 100%;
      margin-bottom: 2px;
    }

    .buyer-label {
      display: table-cell;
      width: 120px;
      font-weight: bold;
      color: #000;
    }

    .buyer-value {
      display: table-cell;
      color: #000;
    }

    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      page-break-inside: avoid;
    }

    .items-table th,
    .items-table td {
      border: 1px solid #000;
      padding: 3px;
      text-align: left;
      font-size: 8px;
    }

    .items-table th {
      background-color: transparent;
      font-weight: bold;
      text-align: center;
      color: #000;
    }

    .items-table td {
      text-align: center;
      color: #000;
      background-color: transparent;
    }

    .items-table .description-cell {
      text-align: left;
      color: #000;
      background-color: transparent;
    }

    .totals-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6px;
      background-color: transparent;
    }

    .totals-table tr {
      color: #000;
      background-color: transparent;
    }

    .totals-table tr td {
      color: #000;
      background-color: transparent;
    }

    .totals-table td {
      border: 1px solid #000;
      padding: 3px;
      text-align: right;
      font-size: 9px;
      color: #000;
      background-color: transparent;
    }

    .totals-table .label-cell {
      text-align: left;
      font-weight: bold;
      width: 150px;
      color: #000;
      background-color: transparent;
    }

    .totals-table .grand-total {
      font-weight: bold;
      font-size: 10px;
      color: #000;
      background-color: transparent;
    }

    .amount-in-words {
      border: 1px solid #000;
      padding: 3px;
      margin-bottom: 3px;
      font-size: 9px;
      font-weight: bold;
      color: #000;
      background-color: transparent;
    }

    .bank-details {
      border: 1px solid #000;
      padding: 3px;
      margin-bottom: 3px;
      font-size: 9px;
      color: #000;
      background-color: transparent;
    }

    .bank-details strong {
      display: inline-block;
      width: 120px;
      color: #000;
    }

    .invoice-footer {
      width: 100%;
      text-align: center;
      font-size: 8px;
      padding-top: 3px;
      margin-top: 4px;
      border-top: 1px solid #000;
      color: #000;
    }

    .footer-line {
      margin: 1px 0;
      color: #000;
    }

    .authorized-signatory {
      text-align: right;
      margin-top: 6px;
      font-weight: bold;
      color: #000;
    }

    table, tr, td {
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="invoice-page">
    <div class="invoice-title">GST INVOICE</div>

    <!-- Seller and Invoice Details -->
    <div class="seller-buyer-section">
      <div class="seller-box">
        ${logoBase64 ? `<img src="data:image/png;base64,${logoBase64}" alt="Logo" class="company-logo" />` : ''}
        <div class="section-title">A TO Z BATTERIES & ELECTRICAL PARTS</div>
        <div class="seller-info">
          Near Ajanta Chawfully,<br>
          Front of HP Petrol Pump,<br>
          Taiba Washing,<br>
          Jalgaon – 425001<br><br>
          <strong>State:</strong> Maharashtra<br>
          <strong>State Code:</strong> 27<br>
          <strong>Phone:</strong> 9890412516<br>
          <strong>Email:</strong> atozbatteries7222@gmail.com<br>
          <strong>GSTIN:</strong> 27CHVPP1094F1ZT
        </div>
      </div>
      <div class="invoice-details-box">
        <div class="section-title">Invoice Details</div>
        <div class="seller-info">
          <strong>Invoice No:</strong> ${invoice.invoiceNumber}<br>
          <strong>Date:</strong> ${invoice.date}<br>
          <strong>Reference No & Date:</strong><br>
          ${invoice.referenceNumber} / ${invoice.referenceDate}
        </div>
      </div>
    </div>

    <!-- Buyer Details -->
    <div class="buyer-section">
      <div class="section-title">Buyer Details</div>
      <div class="buyer-info-row">
        <div class="buyer-label">Buyer Name:</div>
        <div class="buyer-value">${invoice.customer.name}</div>
      </div>
      <div class="buyer-info-row">
        <div class="buyer-label">Mobile No:</div>
        <div class="buyer-value">${invoice.customer.mobile}</div>
      </div>
      ${invoice.customer.businessName ? `
      <div class="buyer-info-row">
        <div class="buyer-label">Business Name:</div>
        <div class="buyer-value">${invoice.customer.businessName}</div>
      </div>
      ` : ''}
      ${invoice.customer.gstNumber ? `
      <div class="buyer-info-row">
        <div class="buyer-label">GSTIN:</div>
        <div class="buyer-value">${invoice.customer.gstNumber}</div>
      </div>
      ` : ''}
      ${invoice.customer.businessAddress ? `
      <div class="buyer-info-row">
        <div class="buyer-label">Business Address:</div>
        <div class="buyer-value">${invoice.customer.businessAddress}</div>
      </div>
      ` : ''}
      <div class="buyer-info-row">
        <div class="buyer-label">Sales Type:</div>
        <div class="buyer-value">${invoice.customer.salesType}</div>
      </div>
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 40px;">SL NO</th>
          <th>Description of Goods</th>
          <th style="width: 60px;">Quantity</th>
          <th style="width: 80px;">Rate (Incl. Tax)</th>
          <th style="width: 70px;">Rate</th>
          <th style="width: 60px;">Tax %</th>
          <th style="width: 60px;">Disc %</th>
          <th style="width: 80px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map((item, index) => {
          // Build description: First line = SKU + Warranty, Second line(s) = Serial Number(s) with Vehicle Number(s)
          const firstLineParts = [];
          if (item.sku && String(item.sku).trim()) firstLineParts.push(item.sku);
          if (item.warranty && String(item.warranty).trim()) firstLineParts.push(`Warranty: ${item.warranty}`);
          
          // Use serialVehicleMapping if available, otherwise fall back to serialNumbers
          let serialLines = [];
          if (item.serialVehicleMapping && item.serialVehicleMapping.length > 0) {
            // Show serial number with corresponding vehicle number
            serialLines = item.serialVehicleMapping.map(mapping => {
              const serialPart = `Serial: ${mapping.serial}`;
              const vehiclePart = mapping.vehicle ? `  Vehicle: ${mapping.vehicle}` : '';
              return serialPart + vehiclePart;
            });
          } else {
            // Fallback: use serialNumbers array
            const validSerials = (item.serialNumbers || []).filter(s => s && String(s).trim());
            serialLines = validSerials.length > 0 ? [`Serial: ${validSerials.join(', ')}`] : [];
          }
          
          // Combine first line with spacing between SKU and Warranty
          const firstLine = firstLineParts.join('    '); // 4 spaces between SKU and Warranty
          
          // Combine first line and serial/vehicle lines with <br>
          let description = firstLineParts.length > 0 
            ? (serialLines.length > 0 ? `${firstLine}<br>${serialLines.join('<br>')}` : firstLine)
            : 'Product Details Not Available';
          
          // Escape HTML to prevent XSS, but preserve <br> tags
          const escapeHtmlExceptBr = (text) => {
            if (!text) return '';
            // First escape all HTML, then restore <br> tags
            let escaped = String(text)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
            // Restore <br> tags
            escaped = escaped.replace(/&lt;br&gt;/g, '<br>');
            return escaped;
          };
          
          // Use the actual amount from database (final_amount sum)
          const amount = parseFloat(item.amount || 0);
          const quantity = parseInt(item.quantity || 1, 10); // Default to 1 if missing
          
          return `
          <tr>
            <td>${index + 1}</td>
            <td class="description-cell">${escapeHtmlExceptBr(description)}</td>
            <td>${quantity}</td>
            <td>₹${parseFloat(item.rateInclTax || 0).toFixed(2)}</td>
            <td>₹${parseFloat(item.rate || 0).toFixed(2)}</td>
            <td>${item.taxPercent || 18}%</td>
            <td>${parseFloat(item.discountPercent || 0).toFixed(2)}%</td>
            <td>₹${amount.toFixed(2)}</td>
          </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Totals -->
    <table class="totals-table">
      <tr>
        <td class="label-cell">Subtotal</td>
        <td>₹${invoice.totals.subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label-cell">SGST 9%</td>
        <td>₹${invoice.totals.sgst.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label-cell">CGST 9%</td>
        <td>₹${invoice.totals.cgst.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label-cell">Round Off</td>
        <td>₹${invoice.totals.roundOff.toFixed(2)}</td>
      </tr>
      <tr>
        <td class="label-cell">Qty</td>
        <td>${invoice.totals.quantity}</td>
      </tr>
      <tr>
        <td class="label-cell grand-total">Grand Total (₹)</td>
        <td class="grand-total">₹${invoice.totals.grandTotal}</td>
      </tr>
    </table>

    <!-- Amount in Words -->
    <div class="amount-in-words">
      ${invoice.totals.amountInWords}
    </div>

    <!-- Bank Details -->
    <div class="bank-details">
      <strong>Bank Name:</strong> HDFC BANK<br>
      <strong>Branch:</strong> TARSODA FATA<br>
      <strong>IFSC Code:</strong> HDFC0003480
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-line">Subject to Jalgaon Jurisdiction</div>
      <div class="footer-line">This is a Computer Generated Invoice</div>
      <div class="authorized-signatory">Authorised Signatory</div>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = router;

