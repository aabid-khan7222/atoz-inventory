import React, { useState, useEffect } from 'react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState, markFormSubmitted } from '../../utils/formStateManager';
import './Checkout.css';

const STORAGE_KEY = 'checkoutState';

const Checkout = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cartItems, getCartTotal, getTotalSavings, clearCart, updateQuantity, removeFromCart } = useCart();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(() => savedState?.paymentMethod || 'cash');
  const [customerPhone, setCustomerPhone] = useState(() => savedState?.customerPhone || user?.phone || '');
  const [customerName, setCustomerName] = useState(() => savedState?.customerName || user?.full_name || '');
  const [notes, setNotes] = useState(() => savedState?.notes || '');
  const [serialNumbers, setSerialNumbers] = useState(() => savedState?.serialNumbers || {});
  const [oldBatteries, setOldBatteries] = useState(() => savedState?.oldBatteries || {});
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      paymentMethod,
      customerPhone,
      customerName,
      notes,
      serialNumbers,
      oldBatteries
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [paymentMethod, customerPhone, customerName, notes, serialNumbers, oldBatteries, isInitialMount]);

  // Debug: Track invoiceNumber state changes
  useEffect(() => {
    console.log('🔍 invoiceNumber state changed:', invoiceNumber);
  }, [invoiceNumber]);

  const handleCheckout = async (e) => {
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

    if (cartItems.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setLoading(true);

    try {
      // Prepare sale items
      const items = cartItems.map(item => {
        const key = `${item.id}-${item.category}`;
        const serial = serialNumbers[key] || null;
        const oldBattery = oldBatteries[key] || {};
        return {
          product_id: item.id,
          category: item.category,
          quantity: item.quantity,
          unit_price: item.price,
          serial_number: serial,
          // Old battery trade-in fields
          old_battery_brand: oldBattery.brand || null,
          old_battery_name: oldBattery.name || null,
          old_battery_serial_number: oldBattery.serial_number || null,
          old_battery_ah_va: oldBattery.ah_va || null,
          old_battery_trade_in_value: parseFloat(oldBattery.trade_in_value || 0),
        };
      });

      const saleData = {
        customer_id: user?.id || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items,
        sale_type: 'retail',
        discount: 0,
        tax: 0,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'credit' ? 'pending' : 'paid',
        notes: notes.trim() || null,
      };

      const result = await api.createSale(saleData);
      
      console.log('=== CHECKOUT API RESPONSE ===');
      console.log('Full result:', result);
      console.log('result.success:', result?.success);
      console.log('result.sale:', result?.sale);
      console.log('result.sale?.invoice_number:', result?.sale?.invoice_number);
      console.log('==============================');

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
        console.log('🔍 result.sale:', result.sale);
        console.log('🔍 result.sale?.invoice_number:', result.sale?.invoice_number);
        
        if (invoiceNum) {
          // IMPORTANT: Set invoice number first BEFORE clearing cart
          // This ensures the invoiceNumber state is set before any re-renders
          console.log('✅ Setting invoice number to state:', invoiceNum);
          setInvoiceNumber(invoiceNum);
          setSuccess(`Order placed successfully! Invoice generated: ${invoiceNum}`);
          
          // Debug: Show alert to confirm invoice number was found
          // Remove this after confirming it works
          console.log('🚨 INVOICE NUMBER FOUND AND WILL BE SET:', invoiceNum);
          
          // Mark form as submitted (will clear on next mount)
          markFormSubmitted(STORAGE_KEY);
          
          // Don't clear cart immediately - let user see invoice options first
          // Cart will be cleared when they click "Continue Shopping"
        } else {
          // Fallback: try to get from result directly or show error
          const errorMsg = 'Order created but invoice number not found. Please check your orders.';
          setError(errorMsg);
          console.error('❌ Invoice number not found in response.');
          console.error('❌ Full result structure:', JSON.stringify(result, null, 2));
          console.error('❌ result.sale keys:', result.sale ? Object.keys(result.sale) : 'result.sale is null/undefined');
        }
      } else {
        const errorMsg = result?.error || 'Failed to create order';
        setError(errorMsg);
        console.error('❌ Sale failed. Result:', result);
      }
    } catch (err) {
      setError(err.message || 'Failed to complete checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (item, newQuantity) => {
    updateQuantity(item.id, item.category, parseInt(newQuantity));
  };

  const handleRemoveItem = async (item) => {
    const result = await Swal.fire({
      title: 'Remove item?',
      text: `Remove ${item.name} from cart?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Cancel'
    });

    if (result.isConfirmed) {
      removeFromCart(item.id, item.category);
    }
  };

  const subtotal = getCartTotal();
  const savings = getTotalSavings();
  const total = subtotal;

  // Only show empty cart message if cart is empty AND no invoice was generated
  // If invoice was generated, show invoice options even if cart is empty
  if (cartItems.length === 0 && !invoiceNumber) {
    return (
      <div className="checkout-container">
        <div className="checkout-empty">
          <div className="empty-cart-icon">🛒</div>
          <h2>Your cart is empty</h2>
          <p>Add some products to your cart to checkout</p>
          <button 
            className="btn-primary" 
            onClick={() => navigate('/customer/products')}
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h2>Checkout</h2>
        <button 
          className="back-button" 
          onClick={() => navigate('/customer/products')}
        >
          ← Continue Shopping
        </button>
      </div>

      <div className="checkout-content">
        <div className="checkout-left">
          {/* Show Order Summary only if cart has items OR if invoice was just generated */}
          {(cartItems.length > 0 || invoiceNumber) && (
          <div className="checkout-section">
            <h3>Order Summary</h3>
            <div className="cart-items">
              {cartItems.length > 0 ? cartItems.map((item) => (
                <div key={`${item.id}-${item.category}`} className="cart-item">
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p className="cart-item-details">
                      SKU: {item.sku} | {item.ah_va && `${item.ah_va}Ah`} {item.ah_va && item.warranty && '|'} {item.warranty && `Warranty: ${item.warranty}`}
                    </p>
                    {/* Serial Number Field - Hidden for water products */}
                    {item.category !== 'water' && (
                      <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label style={{ fontSize: '0.85rem' }}>Serial Number (optional)</label>
                        <input
                          type="text"
                          value={serialNumbers[`${item.id}-${item.category}`] || ''}
                          onChange={(e) => {
                            const key = `${item.id}-${item.category}`;
                            setSerialNumbers(prev => ({
                              ...prev,
                              [key]: e.target.value,
                            }));
                          }}
                          placeholder="Enter product serial number"
                          style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                      </div>
                    )}

                    {/* Old Battery Trade-in Section */}
                    <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>
                        Old Battery Trade-in (Optional)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={oldBatteries[`${item.id}-${item.category}`]?.brand || ''}
                          onChange={(e) => {
                            const key = `${item.id}-${item.category}`;
                            setOldBatteries(prev => ({
                              ...prev,
                              [key]: { ...prev[key], brand: e.target.value }
                            }));
                          }}
                          placeholder="Brand (e.g., Exide)"
                          style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                        <input
                          type="text"
                          value={oldBatteries[`${item.id}-${item.category}`]?.name || ''}
                          onChange={(e) => {
                            const key = `${item.id}-${item.category}`;
                            setOldBatteries(prev => ({
                              ...prev,
                              [key]: { ...prev[key], name: e.target.value }
                            }));
                          }}
                          placeholder="Model/Name"
                          style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <input
                          type="text"
                          value={oldBatteries[`${item.id}-${item.category}`]?.serial_number || ''}
                          onChange={(e) => {
                            const key = `${item.id}-${item.category}`;
                            setOldBatteries(prev => ({
                              ...prev,
                              [key]: { ...prev[key], serial_number: e.target.value }
                            }));
                          }}
                          placeholder="Serial Number"
                          style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                        <input
                          type="text"
                          value={oldBatteries[`${item.id}-${item.category}`]?.ah_va || ''}
                          onChange={(e) => {
                            const key = `${item.id}-${item.category}`;
                            setOldBatteries(prev => ({
                              ...prev,
                              [key]: { ...prev[key], ah_va: e.target.value }
                            }));
                          }}
                          placeholder="Ah/VA (e.g., 60Ah)"
                          style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                        />
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={oldBatteries[`${item.id}-${item.category}`]?.trade_in_value || ''}
                        onChange={(e) => {
                          const key = `${item.id}-${item.category}`;
                          setOldBatteries(prev => ({
                            ...prev,
                            [key]: { ...prev[key], trade_in_value: e.target.value }
                          }));
                        }}
                        placeholder="Trade-in Value (₹)"
                        style={{ width: '100%', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      />
                      {oldBatteries[`${item.id}-${item.category}`]?.trade_in_value && (
                        <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
                          Trade-in: ₹{parseFloat(oldBatteries[`${item.id}-${item.category}`].trade_in_value || 0).toLocaleString('en-IN')} will be deducted
                        </div>
                      )}
                    </div>
                    <div className="cart-item-pricing">
                      {item.mrp > item.price && (
                        <span className="original-price">₹{item.mrp.toLocaleString('en-IN')}</span>
                      )}
                      <span className="item-price">₹{item.price.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                  <div className="cart-item-actions">
                    <div className="quantity-controls">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.availableStock}
                        value={item.quantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          handleQuantityChange(item, qty);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, item.quantity + 1)}
                        disabled={item.quantity >= item.availableStock}
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item-total">
                      ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                    </div>
                    <button
                      type="button"
                      className="remove-item-btn"
                      onClick={() => handleRemoveItem(item)}
                      title="Remove item"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                  Order completed successfully!
                </div>
              )}
            </div>
          </div>
          )}

          <div className="checkout-section">
            <h3>Customer Information</h3>
            <form onSubmit={handleCheckout}>
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

              {error && <div className="error-message">{error}</div>}
              {success && <div className="success-message">{success}</div>}

              {/* Debug info - always visible for troubleshooting */}
              <div style={{ fontSize: '12px', color: '#666', marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                <strong>Debug Info:</strong><br/>
                invoiceNumber state: {invoiceNumber ? `"${invoiceNumber}"` : 'null/undefined'}<br/>
                typeof invoiceNumber: {typeof invoiceNumber}<br/>
                Will render invoice section: {invoiceNumber ? 'YES ✓' : 'NO ✗'}
                {invoiceNumber && <span style={{ color: 'green', fontWeight: 'bold' }}> - Invoice section SHOULD be visible!</span>}
              </div>

              {/* Invoice Actions section removed from here - moved outside form below */}

              {!invoiceNumber && (
                <button
                  type="submit"
                  className="checkout-button"
                  disabled={loading || cartItems.length === 0}
                >
                  {loading ? 'Processing...' : 'Place Order'}
                </button>
              )}
            </form>
          </div>

          {/* Invoice Section - OUTSIDE form to avoid any form submission issues */}
          {invoiceNumber && (
            <div className="checkout-section">
              <div style={{
                padding: '15px',
                backgroundColor: '#f0f9ff',
                border: '1px solid #0ea5e9',
                borderRadius: '8px'
              }}>
                <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#0369a1' }}>
                  Invoice Generated: {invoiceNumber}
                </h3>
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
                      fontWeight: '500'
                    }}
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
                      fontWeight: '500'
                    }}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigate(`/invoice/${invoiceNumber}`);
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Print Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceNumber(null);
                      setSuccess('');
                      clearCart();
                      navigate('/customer/products');
                    }}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Continue Shopping
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="checkout-right">
          <div className="order-summary-card">
            <h3>Order Summary</h3>
            
            <div className="summary-row">
              <span>Items ({cartItems.reduce((sum, item) => sum + item.quantity, 0)})</span>
              <span>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            {savings > 0 && (
              <div className="summary-row savings">
                <span>Total Savings</span>
                <span>- ₹{savings.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="summary-divider"></div>

            <div className="summary-row total">
              <span>Total Amount</span>
              <span>₹{total.toLocaleString('en-IN')}</span>
            </div>

            {paymentMethod === 'credit' && (
              <div className="payment-notice">
                ⚠️ Payment will be collected later
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;

