import React, { useState, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import api, { API_BASE } from '../../api';
import Swal from 'sweetalert2';
import './PaymentModal.css';

const PaymentModal = ({ product, category, onClose, onSuccess }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [notes, setNotes] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleNumbers, setVehicleNumbers] = useState([]); // Array for multiple vehicle numbers
  const [useSameVehicleForAll, setUseSameVehicleForAll] = useState(true); // Option to use same vehicle for all
  const [invoiceNumber, setInvoiceNumber] = useState(null); // Track invoice number after successful purchase

  const mrp = parseFloat(product.mrp || product.mrp_price || product.price || 0);
  // Use the actual selling_price from database, don't recalculate
  const sellingPrice = parseFloat(product.selling_price || product.price || 0);
  // Calculate discount based on actual selling price vs MRP
  const discountAmount = mrp > sellingPrice ? mrp - sellingPrice : 0;
  const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 100) : 0;

  const subtotal = sellingPrice * quantity;
  const savings = discountAmount * quantity;
  const total = subtotal;

  // Use useLayoutEffect to ensure modal is visible immediately
  useLayoutEffect(() => {
    // Store original body styles
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    
    // Get current scroll position
    const scrollY = window.scrollY;
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    
    // Prevent scroll on overlay
    const preventScroll = (e) => {
      // Allow scrolling inside modal content
      const modalContent = e.target.closest('.payment-modal');
      if (!modalContent) {
        e.preventDefault();
      }
    };
    
    // Prevent touchmove on overlay (mobile)
    const preventTouchMove = (e) => {
      const modalContent = e.target.closest('.payment-modal');
      if (!modalContent) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('wheel', preventScroll, { passive: false });
    document.addEventListener('touchmove', preventTouchMove, { passive: false });
    
    return () => {
      // Restore original body styles
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      
      // Restore scroll position
      window.scrollTo(0, scrollY);
      
      // Remove event listeners
      document.removeEventListener('wheel', preventScroll);
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

  useEffect(() => {
    // Handle Escape key to close modal
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handlePurchase = async (e) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim() || !customerPhone.trim()) {
      setError('Customer name and phone are required');
      return;
    }

    if (!/^\d{10}$/.test(customerPhone.trim())) {
      setError('Phone number must be 10 digits');
      return;
    }

    if (quantity <= 0) {
      setError('Quantity must be at least 1');
      return;
    }

    // Vehicle number is always optional - prepare vehicle numbers array
    let finalVehicleNumbers = [];
    if (quantity > 1) {
      if (useSameVehicleForAll) {
        // Use same vehicle number for all (or null if empty)
        finalVehicleNumbers = Array(quantity).fill(vehicleNumber.trim() || null);
      } else {
        // Use individual vehicle numbers (or null if empty)
        finalVehicleNumbers = vehicleNumbers.map(vn => (vn && vn.trim()) || null);
      }
    } else {
      // Single quantity
      finalVehicleNumbers = [vehicleNumber.trim() || null];
    }

    setLoading(true);

    try {
      // Prepare items with vehicle numbers
      const items = [];
      if (quantity > 1) {
        // Multiple quantities - send one item with quantity and vehicle_numbers array
        items.push({
          product_id: product.id,
          category: category,
          quantity: quantity,
          unit_price: sellingPrice,
          vehicle_number: finalVehicleNumbers[0] || null, // First vehicle number (for backward compatibility)
          vehicle_numbers: finalVehicleNumbers, // Array of vehicle numbers
        });
      } else {
        // Single quantity
        items.push({
          product_id: product.id,
          category: category,
          quantity: 1,
          unit_price: sellingPrice,
          vehicle_number: finalVehicleNumbers[0] || null,
        });
      }

      const saleData = {
        customer_id: user?.id || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items: items,
        sale_type: 'retail',
        discount: discountAmount * quantity, // Total discount for all items
        tax: 0, // Tax removed
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'credit' ? 'pending' : 'paid',
        notes: notes.trim() || null
      };

      const result = await api.createSale(saleData);

      console.log('Full API response:', result);
      
      // Check if result has success property
      if (result && result.success) {
        // Capture invoice number from sale object - try multiple possible locations
        let invoiceNum = null;
        
        // Try all possible locations for invoice_number
        if (result.sale && result.sale.invoice_number) {
          invoiceNum = result.sale.invoice_number;
        } else if (result.sale && result.sale.invoiceNumber) {
          invoiceNum = result.sale.invoiceNumber;
        } else if (result.invoice_number) {
          invoiceNum = result.invoice_number;
        } else if (result.invoiceNumber) {
          invoiceNum = result.invoiceNumber;
        }
        
        console.log('🔍 Invoice number search result:', invoiceNum);
        
        if (invoiceNum) {
          // Set invoice number and show invoice options instead of closing modal
          setInvoiceNumber(invoiceNum);
          setError(''); // Clear any errors
          
          // Show success alert
          await Swal.fire({
            icon: 'success',
            title: 'Thank You!',
            html: `
              <div style="text-align: center; padding: 10px;">
                <p style="font-size: 16px; margin-bottom: 10px; color: #333;">
                  Thank you for your response!
                </p>
                <p style="font-size: 14px; color: #666;">
                  Our team will contact you shortly.
                </p>
                <p style="font-size: 12px; color: #888; margin-top: 15px;">
                  Invoice Number: <strong>${invoiceNum}</strong>
                </p>
              </div>
            `,
            confirmButtonText: 'OK',
            confirmButtonColor: '#10b981',
            timer: 5000,
            timerProgressBar: true,
            showClass: {
              popup: 'animate__animated animate__fadeInDown'
            },
            hideClass: {
              popup: 'animate__animated animate__fadeOutUp'
            }
          });
          
          // Call onSuccess callback if provided (for refreshing product list, etc.)
          if (onSuccess) {
            onSuccess(result.sale || result);
          }
          
          // Don't close modal - show invoice options instead
        } else {
          // Invoice number not found - still show success but log warning
          console.warn('⚠️ Invoice number not found in response, but sale was successful');
          setError('Order created successfully, but invoice number not found. Please check your orders.');
          
          // Still call onSuccess and close modal as fallback
          if (onSuccess) {
            onSuccess(result.sale || result);
          }
          // Don't close immediately - let user see the message
        }
        } else {
          // Check if result itself is the sale object (some APIs return directly)
          if (result && result.invoice_number) {
            setInvoiceNumber(result.invoice_number);
            setError(''); // Clear any errors
            
            // Show success alert
            await Swal.fire({
              icon: 'success',
              title: 'Thank You!',
              html: `
                <div style="text-align: center; padding: 10px;">
                  <p style="font-size: 16px; margin-bottom: 10px; color: #333;">
                    Thank you for your response!
                  </p>
                  <p style="font-size: 14px; color: #666;">
                    Our team will contact you shortly.
                  </p>
                  <p style="font-size: 12px; color: #888; margin-top: 15px;">
                    Invoice Number: <strong>${result.invoice_number}</strong>
                  </p>
                </div>
              `,
              confirmButtonText: 'OK',
              confirmButtonColor: '#10b981',
              timer: 5000,
              timerProgressBar: true,
              showClass: {
                popup: 'animate__animated animate__fadeInDown'
              },
              hideClass: {
                popup: 'animate__animated animate__fadeOutUp'
              }
            });
            
            if (onSuccess) {
              onSuccess(result);
            }
            // Don't close modal - show invoice options instead
        } else {
          console.error('Unexpected response structure:', result);
          setError(result?.error || result?.message || 'Failed to place order');
        }
      }
    } catch (err) {
      console.error('Error creating sale:', err);
      setError(err.message || 'Failed to complete purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (newQty) => {
    const qty = newQty < 1 ? 1 : newQty;
    setQuantity(qty);
    // Adjust vehicle numbers array
    if (vehicleNumbers.length > qty) {
      setVehicleNumbers(vehicleNumbers.slice(0, qty));
    } else if (vehicleNumbers.length < qty) {
      // Fill with empty strings or copy from single vehicle number if using same for all
      const newVehicleNumbers = [...vehicleNumbers];
      while (newVehicleNumbers.length < qty) {
        newVehicleNumbers.push(useSameVehicleForAll ? vehicleNumber : '');
      }
      setVehicleNumbers(newVehicleNumbers);
    }
  };


  // Ensure modal is visible immediately
  if (!product) {
    return null;
  }

  const modalContent = (
    <div 
      className="payment-modal-overlay" 
      onClick={onClose}
      onWheel={(e) => {
        // Prevent scroll on overlay, allow on modal content
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      onTouchMove={(e) => {
        // Prevent touch scroll on overlay, allow on modal content
        if (e.target === e.currentTarget) {
          e.preventDefault();
        }
      }}
      data-theme={theme}
    >
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h2>Complete Purchase</h2>
          <button 
            className="payment-modal-close" 
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="payment-modal-content">
          <>
          {/* Product Summary */}
          <div className="payment-product-summary">
            <div className="product-info-card">
              <h3>{product.name || 'Product'}</h3>
              <div className="product-details-row">
                <span className="detail-label">SKU:</span>
                <span className="detail-value">{product.sku || 'N/A'}</span>
              </div>
              {product.ah_va && (
                <div className="product-details-row">
                  <span className="detail-label">Ah/VA:</span>
                  <span className="detail-value">{product.ah_va}</span>
                </div>
              )}
              {product.warranty && (
                <div className="product-details-row">
                  <span className="detail-label">Warranty:</span>
                  <span className="detail-value">{product.warranty}</span>
                </div>
              )}
            </div>

            <div className="quantity-selector">
              <label htmlFor="quantity">Quantity</label>
              <div className="quantity-controls">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                />
                <button
                  type="button"
                  onClick={() => handleQuantityChange(quantity + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Customer Information Form */}
          <form onSubmit={handlePurchase} className="payment-form">
            <div className="form-section">
              <h3>Customer Information</h3>
              
              <div className="form-group">
                <label htmlFor="customerName">Full Name *</label>
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="customerPhone">Phone Number *</label>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setCustomerPhone(value);
                  }}
                  required
                  placeholder="10 digit phone number"
                  maxLength={10}
                />
              </div>

              {/* Vehicle Number Field(s) */}
              {quantity === 1 ? (
                <div className="form-group">
                  <label htmlFor="vehicleNumber">
                    Vehicle Number (optional)
                  </label>
                  <input
                    id="vehicleNumber"
                    type="text"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="Enter vehicle number (optional)"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>
                    Vehicle Number(s) (optional)
                  </label>
                  
                  {/* Option to use same vehicle for all */}
                  <label 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem', 
                      cursor: 'pointer', 
                      fontSize: '0.875rem',
                      color: 'var(--azb-text-muted, #475569)',
                      marginBottom: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      transition: 'background-color 0.2s',
                      width: 'fit-content'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--azb-bg-hover, #f1f5f9)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={useSameVehicleForAll}
                      onChange={(e) => {
                        setUseSameVehicleForAll(e.target.checked);
                        if (e.target.checked) {
                          // Fill all with the same vehicle number
                          setVehicleNumbers(Array(quantity).fill(vehicleNumber));
                        } else {
                          // Initialize with current vehicle number or empty
                          const newVehicleNumbers = Array(quantity).fill('').map((_, idx) => 
                            vehicleNumbers[idx] || vehicleNumber || ''
                          );
                          setVehicleNumbers(newVehicleNumbers);
                        }
                      }}
                      style={{ 
                        cursor: 'pointer',
                        margin: 0,
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--azb-accent, #3b82f6)'
                      }}
                    />
                    <span style={{ userSelect: 'none' }}>Use same vehicle number for all {quantity} batteries</span>
                  </label>
                  
                  {useSameVehicleForAll ? (
                    <input
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => {
                        setVehicleNumber(e.target.value);
                        // Update all vehicle numbers in array
                        setVehicleNumbers(Array(quantity).fill(e.target.value));
                      }}
                      placeholder={`Enter vehicle number (optional, will be used for all ${quantity} batteries)`}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {Array.from({ length: quantity }).map((_, index) => {
                        // Ensure vehicleNumbers array has enough elements
                        const currentVehicleNumbers = vehicleNumbers.length >= quantity 
                          ? vehicleNumbers 
                          : [...vehicleNumbers, ...Array(quantity - vehicleNumbers.length).fill('')];
                        
                        return (
                          <div key={index}>
                            <label style={{ fontSize: '0.875rem', color: 'var(--azb-text-muted, #64748b)', marginBottom: '0.25rem', display: 'block' }}>
                              Battery {index + 1} (optional)
                            </label>
                            <input
                              type="text"
                              value={currentVehicleNumbers[index] || ''}
                              onChange={(e) => {
                                const newVehicleNumbers = [...currentVehicleNumbers];
                                newVehicleNumbers[index] = e.target.value;
                                setVehicleNumbers(newVehicleNumbers);
                              }}
                              placeholder={`Enter vehicle number for battery ${index + 1} (optional)`}
                              style={{ 
                                width: '100%', 
                                padding: '0.5rem', 
                                border: '1px solid var(--azb-border-subtle, #e2e8f0)', 
                                borderRadius: '0.25rem',
                                background: 'var(--azb-bg-input, white)',
                                color: 'var(--azb-text-main, #333)'
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                    Vehicle numbers are optional for all customers. Each battery can be assigned to a different vehicle. If all batteries are for the same vehicle, use the checkbox above.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="paymentMethod">Payment Method *</label>
                <select
                  id="paymentMethod"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notes (Optional)</label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={3}
                />
              </div>

            </div>

            {/* Order Summary - All fields non-editable for customers */}
            <div className="payment-summary">
              <h3>Order Summary</h3>
              
              <div className="summary-row">
                <span>MRP (per unit)</span>
                <span style={{ fontWeight: '600' }}>₹{mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="summary-row">
                <span>Discount (%)</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>{discountPercent}%</span>
              </div>
              
              <div className="summary-row">
                <span>Discount Amount</span>
                <span style={{ fontWeight: '600', color: '#10b981' }}>- ₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="summary-row">
                <span>Selling Price (per unit)</span>
                <span style={{ fontWeight: '600' }}>₹{sellingPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="summary-row" style={{ fontSize: '0.85rem', color: 'var(--azb-text-muted, #64748b)', fontStyle: 'italic' }}>
                <span>Note:</span>
                <span>Price includes 18% GST</span>
              </div>
              
              <div className="summary-row">
                <span>Quantity</span>
                <span>{quantity}</span>
              </div>
              
              {savings > 0 && (
                <div className="summary-row savings">
                  <span>Total Savings</span>
                  <span>- ₹{savings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              
              <div className="summary-divider"></div>
              <div className="summary-row total">
                <span>Total Amount</span>
                <span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {paymentMethod === 'credit' && (
                <div className="payment-notice">
                  ⚠️ Payment will be collected later
                </div>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {!invoiceNumber && (
              <div className="payment-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-confirm"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Confirm Purchase'}
                </button>
              </div>
            )}
          </form>

          {/* Invoice Section - Show after successful purchase */}
          {invoiceNumber && (
            <div className="payment-modal-invoice-section" style={{
              padding: '20px',
              backgroundColor: '#f0f9ff',
              border: '1px solid #0ea5e9',
              borderRadius: '8px',
              marginTop: '20px'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#0369a1', fontSize: '1.25rem' }}>
                ✅ Purchase Successful! Invoice: {invoiceNumber}
              </h3>
              <p style={{ marginBottom: '15px', color: '#64748b', fontSize: '0.95rem' }}>
                Your order has been placed successfully. You can now download, print, or preview your invoice.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => navigate(`/invoice/${invoiceNumber}`)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                >
                  Preview Invoice
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('auth_token');
                      const response = await fetch(`${API_BASE}/invoices/${invoiceNumber}/pdf`, {
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      if (!response.ok) throw new Error('Failed to generate PDF');
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
                      await Swal.fire('Error!', 'Failed to download PDF: ' + err.message, 'error');
                    }
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#047857'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#059669'}
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/invoice/${invoiceNumber}`);
                    // Small delay to ensure navigation happens, then trigger print
                    setTimeout(() => {
                      window.print();
                    }, 500);
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#7c3aed',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#6d28d9'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#7c3aed'}
                >
                  Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceNumber(null);
                    setError('');
                    // Reset form for new purchase
                    setQuantity(1);
                    setCustomerName(user?.full_name || '');
                    setCustomerPhone(user?.phone || '');
                    setNotes('');
                    setVehicleNumber('');
                    setVehicleNumbers([]);
                    setPaymentMethod('cash');
                    // Call onSuccess to refresh product list if needed
                    if (onSuccess) {
                      onSuccess({ invoice_number: invoiceNumber });
                    }
                    // Close modal
                    onClose();
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          )}
          </>
        </div>
      </div>
    </div>
  );

  // Render modal using portal to ensure it's always visible and on top
  return createPortal(modalContent, document.body);
};

export default PaymentModal;
