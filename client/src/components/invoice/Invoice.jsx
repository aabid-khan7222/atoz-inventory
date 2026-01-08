import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api, { API_BASE } from '../../api';
import Swal from 'sweetalert2';
import logo from '../../assets/exide-care.png';
import './Invoice.css';

const Invoice = () => {
  const { invoiceNumber } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInvoice();
  }, [invoiceNumber]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getInvoiceById(invoiceNumber);
      setInvoice(data);
    } catch (err) {
      console.error('Error fetching invoice:', err);
      setError(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    // If opened in a new window/tab, try to close it
    // Otherwise navigate back or to home
    try {
      if (window.opener && !window.opener.closed) {
        // This window was opened by another window, so close it
        window.close();
        return;
      }
    } catch (e) {
      // Cross-origin or other security restrictions, ignore
    }
    
    // Check if we have a returnTo parameter
    const returnTo = searchParams.get('returnTo');
    
    if (returnTo === 'sold-batteries' || returnTo === 'sell-stock') {
      // Navigate back to dashboard inventory with the appropriate section active
      // We'll use sessionStorage to pass the section info
      sessionStorage.setItem('inventoryActiveSection', returnTo);
      // Determine the correct dashboard route based on user role
      let dashboardPath = '/dashboard';
      if (user?.role_id === 1) {
        dashboardPath = '/super-admin/inventory';
      } else if (user?.role_id === 2) {
        dashboardPath = '/admin/inventory';
      } else if (user?.role_id >= 3) {
        // Customers may not have inventory route, go to main dashboard
        dashboardPath = '/customer';
      }
      navigate(dashboardPath);
      return;
    }
    
    // Try to navigate back if there's history
    // For new tabs, this will typically go to home
    try {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        // If no history, navigate to dashboard/home
        navigate('/dashboard');
      }
    } catch (e) {
      // Fallback: just navigate to home
      window.location.href = '/';
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE}/invoices/${invoiceNumber}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      await Swal.fire('Error!', 'Failed to download PDF: ' + err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="invoice-container">
        <div className="loading">Loading invoice...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoice-container">
        <div className="error">{error}</div>
        <button onClick={handleBack} className="btn-secondary">Go Back</button>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="invoice-container">
        <div className="error">Invoice not found</div>
        <button onClick={handleBack} className="btn-secondary">Go Back</button>
      </div>
    );
  }

  return (
    <div className="invoice-container">
      <div className="invoice-actions">
        <button onClick={handlePrint} className="btn-primary">Print</button>
        <button onClick={handleDownloadPDF} className="btn-primary">Download PDF</button>
        <button onClick={handleBack} className="btn-secondary">Back</button>
      </div>

      <div className="invoice-page">
        <div className="invoice-title">GST INVOICE</div>

        {/* Seller and Invoice Details */}
        <div className="seller-buyer-section">
          <div className="seller-box">
            <img src={logo} alt="Logo" className="company-logo" />
            <div className="section-title">A TO Z BATTERIES & ELECTRICAL PARTS</div>
            <div className="seller-info">
              Near Ajanta Chawfully,<br />
              Front of HP Petrol Pump,<br />
              Taiba Washing,<br />
              Jalgaon – 425001<br /><br />
              <strong>State:</strong> Maharashtra<br />
              <strong>State Code:</strong> 27<br />
              <strong>Phone:</strong> 9890412516<br />
              <strong>Email:</strong> atozbatteries7222@gmail.com<br />
              <strong>GSTIN:</strong> 27CHVPP1094F1ZT
            </div>
          </div>
          <div className="invoice-details-box">
            <div className="section-title">Invoice Details</div>
            <div className="seller-info">
              <strong>Invoice No:</strong> {invoice.invoiceNumber}<br />
              <strong>Date:</strong> {invoice.date}<br />
              <strong>Reference No & Date:</strong><br />
              {invoice.referenceNumber} / {invoice.referenceDate}
            </div>
          </div>
        </div>

        {/* Buyer Details */}
        <div className="buyer-section">
          <div className="section-title">Buyer Details</div>
          <div className="buyer-info-row">
            <div className="buyer-label">Buyer Name:</div>
            <div className="buyer-value">{invoice.customer.name}</div>
          </div>
          <div className="buyer-info-row">
            <div className="buyer-label">Mobile No:</div>
            <div className="buyer-value">{invoice.customer.mobile}</div>
          </div>
          {invoice.customer.businessName && (
            <div className="buyer-info-row">
              <div className="buyer-label">Business Name:</div>
              <div className="buyer-value">{invoice.customer.businessName}</div>
            </div>
          )}
          {invoice.customer.gstNumber && (
            <div className="buyer-info-row">
              <div className="buyer-label">GSTIN:</div>
              <div className="buyer-value">{invoice.customer.gstNumber}</div>
            </div>
          )}
          {invoice.customer.businessAddress && (
            <div className="buyer-info-row">
              <div className="buyer-label">Business Address:</div>
              <div className="buyer-value">{invoice.customer.businessAddress}</div>
            </div>
          )}
          <div className="buyer-info-row">
            <div className="buyer-label">Sales Type:</div>
            <div className="buyer-value">{invoice.customer.salesType}</div>
          </div>
        </div>

        {/* Items Table */}
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>SL NO</th>
              <th>Description of Goods</th>
              <th style={{ width: '60px' }}>Quantity</th>
              <th style={{ width: '80px' }}>Rate (Incl. Tax)</th>
              <th style={{ width: '70px' }}>Rate</th>
              <th style={{ width: '60px' }}>Tax %</th>
              <th style={{ width: '60px' }}>Disc %</th>
              <th style={{ width: '80px' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => {
              // Build description: First line = SKU + Warranty, Second line = Serial Number(s) with Vehicle Number(s)
              const firstLineParts = [];
              if (item.sku && item.sku.trim()) firstLineParts.push(item.sku);
              if (item.warranty && item.warranty.toString().trim()) firstLineParts.push(`Warranty: ${item.warranty}`);
              
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
                const validSerials = (item.serialNumbers || []).filter(s => s && s.toString().trim());
                serialLines = validSerials.length > 0 ? [`Serial: ${validSerials.join(', ')}`] : [];
              }
              
              // Combine first line with spacing between SKU and Warranty
              const firstLine = firstLineParts.join('    '); // 4 spaces between SKU and Warranty
              
              // Add old battery trade-in information if present
              let oldBatteryLines = [];
              if (item.oldBatteries && item.oldBatteries.length > 0) {
                item.oldBatteries.forEach((oldBattery, idx) => {
                  if (oldBattery.tradeInValue > 0) {
                    let oldBatteryInfo = `Old Battery: ${oldBattery.brand || 'N/A'}`;
                    if (oldBattery.name) oldBatteryInfo += ` ${oldBattery.name}`;
                    if (oldBattery.serialNumber) oldBatteryInfo += ` (SN: ${oldBattery.serialNumber})`;
                    if (oldBattery.ahVa) oldBatteryInfo += ` [${oldBattery.ahVa}]`;
                    oldBatteryInfo += ` - Trade-in: ₹${oldBattery.tradeInValue.toFixed(2)}`;
                    oldBatteryLines.push(oldBatteryInfo);
                  }
                });
              }
              
              // Combine first line and serial/vehicle lines with line breaks
              let description = firstLineParts.length > 0 
                ? (serialLines.length > 0 ? `${firstLine}\n${serialLines.join('\n')}` : firstLine)
                : 'Product Details Not Available';
              
              // Add old battery lines if present
              if (oldBatteryLines.length > 0) {
                description += `\n${oldBatteryLines.join('\n')}`;
              }
              
              // Use the actual amount from database (final_amount sum)
              const amount = parseFloat(item.amount || 0);
              const quantity = parseInt(item.quantity || 1, 10); // Default to 1 if missing
              
              return (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td className="description-cell" style={{ whiteSpace: 'pre-line' }}>{description}</td>
                  <td>{quantity}</td>
                  <td>₹{parseFloat(item.rateInclTax || 0).toFixed(2)}</td>
                  <td>₹{parseFloat(item.rate || 0).toFixed(2)}</td>
                  <td>{item.taxPercent || 18}%</td>
                  <td>{parseFloat(item.discountPercent || 0).toFixed(2)}%</td>
                  <td>₹{amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <table className="totals-table">
          <tbody>
            <tr>
              <td className="label-cell">Subtotal</td>
              <td>₹{invoice.totals.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="label-cell">SGST 9%</td>
              <td>₹{invoice.totals.sgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="label-cell">CGST 9%</td>
              <td>₹{invoice.totals.cgst.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="label-cell">Round Off</td>
              <td>₹{invoice.totals.roundOff.toFixed(2)}</td>
            </tr>
            <tr>
              <td className="label-cell">Qty</td>
              <td>{invoice.totals.quantity}</td>
            </tr>
            <tr>
              <td className="label-cell grand-total">Grand Total (₹)</td>
              <td className="grand-total">₹{invoice.totals.grandTotal}</td>
            </tr>
          </tbody>
        </table>

        {/* Amount in Words */}
        <div className="amount-in-words">
          {invoice.totals.amountInWords}
        </div>

        {/* Bank Details */}
        <div className="bank-details">
          <strong>Bank Name:</strong> HDFC BANK<br />
          <strong>Branch:</strong> TARSODA FATA<br />
          <strong>IFSC Code:</strong> HDFC0003480
        </div>

        {/* Footer */}
        <div className="invoice-footer">
          <div className="footer-line">Subject to Jalgaon Jurisdiction</div>
          <div className="footer-line">This is a Computer Generated Invoice</div>
          <div className="authorized-signatory">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;

