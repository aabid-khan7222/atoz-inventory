import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../api';
import Swal from 'sweetalert2';
import SearchableSelect from '../common/SearchableSelect';
import './DashboardContent.css';

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  } catch {
    return '';
  }
};

const PendingOrders = () => {
  const { t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const [availableSerials, setAvailableSerials] = useState({}); // { productId: [serial1, serial2, ...] }
  const [selectedSerials, setSelectedSerials] = useState({}); // { itemId: serialNumber }
  const [adjustedAmounts, setAdjustedAmounts] = useState({}); // { itemId: amount }
  const [discountInputs, setDiscountInputs] = useState({}); // { itemId: { type: 'percent'|'amount', value: number } }

  useEffect(() => {
    loadPendingOrders();
  }, []);

  const loadPendingOrders = async () => {
    setLoading(true);
    setError('');
    try {
      // Force fresh fetch from server
      const data = await api.getPendingOrders();
      // Filter out any invalid orders
      const validOrders = Array.isArray(data) ? data.filter(order => order && (order.invoice_number || order.id)) : [];
      setOrders(validOrders);
      
      // If selected order was cancelled/deleted, clear it
      if (selectedOrder) {
        const stillExists = validOrders.some(order => 
          (order.invoice_number || order.id) === (selectedOrder.invoice_number || selectedOrder.id)
        );
        if (!stillExists) {
          setSelectedOrder(null);
          setSelectedSerials({});
          setAdjustedAmounts({});
          setDiscountInputs({});
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load pending orders');
      setOrders([]);
      // Clear selected order on error
      setSelectedOrder(null);
      setSelectedSerials({});
      setAdjustedAmounts({});
      setDiscountInputs({});
    } finally {
      setLoading(false);
    }
  };

  const loadOrderDetails = async (invoiceNumber) => {
    try {
      const order = await api.getPendingOrderByInvoice(invoiceNumber);
      setSelectedOrder(order);
      setSelectedSerials({}); // Reset selected serials when loading new order
      
      // Initialize adjusted amounts and discount inputs with existing values
      const initialAmounts = {};
      const initialDiscountInputs = {};
      
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.id) {
            const mrp = parseFloat(item.MRP || item.mrp || 0);
            const finalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
            const existingDiscountAmount = parseFloat(item.discount_amount || item.DISCOUNT_AMOUNT || 0);
            
            // Use existing final_amount
            initialAmounts[item.id] = finalAmount;
            
            // Calculate and pre-fill existing discount
            if (mrp > 0 && existingDiscountAmount > 0) {
              // Pre-fill with discount amount (more common use case)
              const calculatedPercent = (existingDiscountAmount / mrp) * 100;
              initialDiscountInputs[item.id] = {
                type: 'amount',
                value: existingDiscountAmount,
                calculatedAmount: existingDiscountAmount,
                calculatedPercent: calculatedPercent
              };
            } else if (mrp > 0 && finalAmount < mrp) {
              // Calculate discount from MRP vs final_amount
              const calculatedDiscount = mrp - finalAmount;
              if (calculatedDiscount > 0.01) {
                const calculatedPercent = (calculatedDiscount / mrp) * 100;
                initialDiscountInputs[item.id] = {
                  type: 'amount',
                  value: calculatedDiscount,
                  calculatedAmount: calculatedDiscount,
                  calculatedPercent: calculatedPercent
                };
              }
            }
          }
        });
      }
      
      setAdjustedAmounts(initialAmounts);
      setDiscountInputs(initialDiscountInputs);
      
      // Load available serials for each product
      const productIds = [...new Set(order.items.map(item => item.product_id).filter(Boolean))];
      const serialsMap = {};
      
      for (const productId of productIds) {
        try {
          const serials = await api.getAvailableSerialsForProduct(productId);
          serialsMap[productId] = Array.isArray(serials) ? serials : [];
        } catch (err) {
          console.warn(`Failed to load serials for product ${productId}:`, err);
          serialsMap[productId] = [];
        }
      }
      
      setAvailableSerials(serialsMap);
    } catch (err) {
      await Swal.fire('Error', err.message || 'Failed to load order details', 'error');
    }
  };

  const handleCancelOrder = async (invoiceNumber, order) => {
    const orderInfo = order || selectedOrder;
    const invoice = invoiceNumber || (orderInfo?.invoice_number || orderInfo?.id);
    
    if (!invoice) return;

    const result = await Swal.fire({
      title: 'Cancel Order?',
      html: `
        <div style="text-align: left; padding: 1rem 0;">
          <p style="margin-bottom: 1rem; font-size: 1rem; color: #0f172a;">
            Are you sure you want to cancel this order?
          </p>
          <div style="background: #f8fafc; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem;">
            <p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Invoice:</strong> ${invoice}</p>
            ${orderInfo?.customer_name ? `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Customer:</strong> ${orderInfo.customer_name}</p>` : ''}
            ${orderInfo?.customer_mobile_number ? `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Phone:</strong> ${orderInfo.customer_mobile_number}</p>` : ''}
            ${orderInfo?.item_count ? `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Items:</strong> ${orderInfo.item_count}</p>` : ''}
          </div>
          <p style="margin: 0; font-size: 0.875rem; color: #dc2626; font-weight: 600;">
            ⚠️ This action cannot be undone.
          </p>
        </div>
      `,
      icon: 'warning',
      iconColor: '#dc2626',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-times-circle"></i> Yes, Cancel Order',
      cancelButtonText: '<i class="fas fa-arrow-left"></i> No, Keep Order',
      reverseButtons: true,
      customClass: {
        popup: 'swal2-popup-custom',
        confirmButton: 'swal2-confirm-custom',
        cancelButton: 'swal2-cancel-custom'
      }
    });

    if (!result.isConfirmed) return;

    try {
      const response = await api.cancelOrderByAdmin(invoice);
      
      if (response.success) {
        await Swal.fire({
          title: 'Order Cancelled',
          html: `
            <div style="text-align: center; padding: 1rem 0;">
              <div style="font-size: 3rem; color: #059669; margin-bottom: 1rem;">✓</div>
              <p style="font-size: 1rem; color: #0f172a; margin: 0;">
                Order <strong>${invoice}</strong> has been cancelled successfully.
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#059669',
          confirmButtonText: 'OK'
        });
        
        // Clear selected order if it was the cancelled one
        if (selectedOrder?.invoice_number === invoice || selectedOrder?.id === invoice) {
          setSelectedOrder(null);
          setSelectedSerials({});
          setAdjustedAmounts({});
          setDiscountInputs({});
        }
        
        // Remove cancelled order from local state immediately
        setOrders(prevOrders => prevOrders.filter(order => 
          (order.invoice_number || order.id) !== invoice
        ));
        
        // Reload pending orders to ensure fresh data from server
        await loadPendingOrders();
      } else {
        throw new Error(response.error || 'Failed to cancel order');
      }
    } catch (err) {
      await Swal.fire({
        title: 'Error',
        html: `
          <div style="text-align: center; padding: 1rem 0;">
            <div style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem;">✕</div>
            <p style="font-size: 1rem; color: #0f172a; margin: 0;">
              ${err.message || 'Failed to cancel order'}
            </p>
          </div>
        `,
        icon: 'error',
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'OK'
      });
    }
  };

  const handleAssignSerials = async () => {
    if (!selectedOrder) return;

    // Collect assignments
    const assignments = [];
    const items = Array.isArray(selectedOrder.items) ? selectedOrder.items : [];
    
    for (const item of items) {
      // Skip water products (they don't need serial numbers)
      const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
      if (isWaterProduct) continue;
      
      // Skip items that already have serial numbers assigned (but not PENDING or N/A)
      const serialNum = item.SERIAL_NUMBER || item.serial_number;
      if (serialNum && serialNum !== 'PENDING' && serialNum !== 'N/A') continue;
      
      // Get serial number from state
      const serialNumber = selectedSerials[item.id];
      if (!serialNumber || !serialNumber.trim()) {
        await Swal.fire('Error', `Please assign a serial number for ${item.NAME || item.name || 'item'}`, 'error');
        return;
      }
      
      // Get adjusted amount (use adjusted if changed, otherwise use original)
      const originalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
      const adjustedAmount = adjustedAmounts[item.id];
      // Always use adjusted amount if it exists in state (even if same), otherwise use original
      const finalAmount = adjustedAmount !== undefined ? parseFloat(adjustedAmount) : originalAmount;
      
      console.log(`Item ${item.id}: Original=${originalAmount}, Adjusted=${adjustedAmount}, Final=${finalAmount}`);
      
      assignments.push({
        sales_item_id: item.id,
        serial_number: serialNumber.trim(),
        final_amount: parseFloat(finalAmount.toFixed(2)), // Ensure it's a number with 2 decimal places
      });
    }

    if (assignments.length === 0) {
      await Swal.fire('Info', 'No items need serial number assignment', 'info');
      return;
    }

    const result = await Swal.fire({
      title: 'Confirm Assignment',
      text: `Assign serial numbers to ${assignments.length} item(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, assign',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) return;

    setAssigning(true);
    try {
      console.log('Sending assignments:', JSON.stringify(assignments, null, 2));
      const response = await api.assignSerialNumbers(selectedOrder.invoice_number, assignments);
      console.log('Response:', response);
      
      if (response.success) {
        await Swal.fire('Success', response.message || 'Serial numbers assigned successfully!', 'success');
        setSelectedOrder(null);
        setSelectedSerials({});
        setAdjustedAmounts({});
        setDiscountInputs({});
        loadPendingOrders();
      } else {
        throw new Error(response.error || 'Failed to assign serial numbers');
      }
    } catch (err) {
      await Swal.fire('Error', err.message || 'Failed to assign serial numbers', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleSerialChange = (itemId, serialNumber) => {
    setSelectedSerials(prev => ({
      ...prev,
      [itemId]: serialNumber
    }));
  };

  const handleAmountChange = (itemId, amount) => {
    // Handle empty string or invalid input
    if (amount === '' || amount === null || amount === undefined) {
      setAdjustedAmounts(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      setDiscountInputs(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      return;
    }
    
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && numAmount >= 0) {
      setAdjustedAmounts(prev => ({
        ...prev,
        [itemId]: numAmount
      }));
      // Clear discount input when manually entering amount
      setDiscountInputs(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
    }
  };

  const handleDiscountChange = (itemId, discountType, discountValue, basePrice) => {
    if (discountValue === '' || discountValue === null || discountValue === undefined) {
      setDiscountInputs(prev => {
        const newState = { ...prev };
        delete newState[itemId];
        return newState;
      });
      // Reset to original final_amount when discount is cleared
      const item = selectedOrder?.items?.find(i => i.id === itemId);
      if (item) {
        const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
        setAdjustedAmounts(prev => ({
          ...prev,
          [itemId]: originalFinalAmount
        }));
      }
      return;
    }

    const numDiscount = parseFloat(discountValue);
    if (isNaN(numDiscount) || numDiscount < 0) return;

    let finalAmount = basePrice;
    let calculatedDiscountAmount = 0;
    let calculatedDiscountPercent = 0;
    
    if (discountType === 'percent') {
      // Discount percentage: calculate final amount from base price
      if (numDiscount > 100) return; // Can't discount more than 100%
      calculatedDiscountAmount = (basePrice * numDiscount) / 100;
      calculatedDiscountPercent = parseFloat(numDiscount.toFixed(3));
      finalAmount = basePrice - calculatedDiscountAmount;
    } else {
      // Discount amount: subtract from base price
      if (numDiscount > basePrice) return; // Can't discount more than base price
      calculatedDiscountAmount = numDiscount;
      calculatedDiscountPercent = basePrice > 0 ? parseFloat(((numDiscount / basePrice) * 100).toFixed(3)) : 0;
      finalAmount = basePrice - calculatedDiscountAmount;
    }

    // Update both discount inputs to show synced values
    setDiscountInputs(prev => ({
      ...prev,
      [itemId]: { 
        type: discountType, 
        value: numDiscount,
        // Also store the calculated values for the other field
        calculatedAmount: calculatedDiscountAmount,
        calculatedPercent: calculatedDiscountPercent
      }
    }));

    setAdjustedAmounts(prev => ({
      ...prev,
      [itemId]: Math.max(0, finalAmount)
    }));
  };

  return (
    <div className="dashboard-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ color: 'var(--corp-text-primary, #0f172a)' }}>Pending Orders - Serial Number Assignment</h2>
        <button
          onClick={loadPendingOrders}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {loading && (
        <div className="loading-message">Loading pending orders...</div>
      )}

      {error && !loading && (
        <div className="error-message">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>No Pending Orders</h3>
          <p>All orders have serial numbers assigned.</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="pending-orders-container">
          {/* Orders List */}
          <div className="pending-orders-list" style={{ background: 'var(--corp-bg-card, #ffffff)', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: 'var(--corp-shadow, 0 1px 3px rgba(0,0,0,0.1))' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>Pending Orders ({orders.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map((order) => (
                <div
                  key={order.invoice_number || order.id}
                  style={{
                    padding: '1rem',
                    border: selectedOrder?.invoice_number === order.invoice_number
                      ? '2px solid #2563eb'
                      : '1px solid var(--corp-border, #e2e8f0)',
                    borderRadius: '0.375rem',
                    backgroundColor: selectedOrder?.invoice_number === order.invoice_number
                      ? 'var(--corp-bg-hover, #f8fafc)'
                      : 'transparent',
                    color: 'var(--corp-text-primary, #0f172a)',
                    transition: 'all 0.2s',
                  }}
                >
                  <div 
                    onClick={() => loadOrderDetails(order.invoice_number || order.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                      Invoice: {order.invoice_number || order.id}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)', marginBottom: '0.25rem' }}>
                      Customer: {order.customer_name || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)', marginBottom: '0.25rem' }}>
                      Phone: {order.customer_mobile_number || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)', marginBottom: '0.25rem' }}>
                      Items: {order.item_count || 0} ({order.pending_items_count || 0} pending)
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--corp-text-muted, #64748b)' }}>
                      {formatDateTime(order.created_at)}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelOrder(order.invoice_number || order.id, order);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = '#b91c1c';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = '#dc2626';
                      }}
                    >
                      Cancel Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Details & Assignment - Desktop Side-by-Side */}
          {selectedOrder && (
            <div className="pending-order-details-desktop" style={{ background: 'var(--corp-bg-card, #ffffff)', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: 'var(--corp-shadow, 0 1px 3px rgba(0,0,0,0.1))' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                Assign Serial Numbers - {selectedOrder.invoice_number}
              </h3>

              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--corp-bg-secondary, #f8fafc)', borderRadius: '0.375rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                <div><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                <div><strong>Phone:</strong> {selectedOrder.customer_mobile_number}</div>
                <div><strong>Date:</strong> {formatDateTime(selectedOrder.created_at)}</div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>Order Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item) => {
                    const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
                    const serialNum = item.SERIAL_NUMBER || item.serial_number;
                    // Only consider it has serial if it's not PENDING or N/A
                    const hasSerial = !!(serialNum && serialNum !== 'PENDING' && serialNum !== 'N/A');
                    const productId = item.product_id;
                    const serials = availableSerials[productId] || [];

                    if (hasSerial) {
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '1rem',
                            border: '1px solid var(--corp-accent, #10b981)',
                            borderRadius: '0.375rem',
                            background: 'var(--corp-bg-secondary, #f8fafc)',
                            color: 'var(--corp-text-primary, #0f172a)',
                          }}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                            {item.NAME || item.name || 'Product'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)', marginBottom: '0.25rem' }}>
                            ✓ Serial Number: {item.SERIAL_NUMBER || item.serial_number}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>
                            Amount: ₹{parseFloat(item.final_amount || item.FINAL_AMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      );
                    }

                    if (isWaterProduct) {
                      return (
                        <div
                          key={item.id}
                          style={{
                            padding: '1rem',
                            border: '1px solid var(--corp-border, #e2e8f0)',
                            borderRadius: '0.375rem',
                            background: 'var(--corp-bg-secondary, #f8fafc)',
                            color: 'var(--corp-text-primary, #0f172a)',
                          }}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                            {item.NAME || item.name || 'Product'}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>
                            Water product - No serial number required
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid var(--corp-warning, #fbbf24)',
                          borderRadius: '0.375rem',
                          background: 'var(--corp-bg-secondary, #f8fafc)',
                          color: 'var(--corp-text-primary, #0f172a)',
                        }}
                      >
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                          {item.NAME || item.name || 'Product'}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)', marginBottom: '0.75rem' }}>
                          SKU: {item.SKU || item.sku || 'N/A'} | Category: {item.CATEGORY || item.category || 'N/A'}
                        </div>
                        {(() => {
                          const mrp = parseFloat(item.MRP || item.mrp || 0);
                          const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                          const existingDiscountAmount = parseFloat(item.discount_amount || item.DISCOUNT_AMOUNT || 0);
                          
                          // Use MRP as base price, or final_amount if MRP not available
                          const basePrice = mrp > 0 ? mrp : originalFinalAmount;
                          
                          const currentAmount = adjustedAmounts[item.id] !== undefined ? adjustedAmounts[item.id] : originalFinalAmount;
                          const discountInput = discountInputs[item.id];
                          
                          // Calculate existing discount from database
                          const existingDiscount = existingDiscountAmount > 0 ? existingDiscountAmount : (basePrice > originalFinalAmount ? basePrice - originalFinalAmount : 0);
                          const existingDiscountPercent = basePrice > 0 ? parseFloat(((existingDiscount / basePrice) * 100).toFixed(3)) : 0;
                          
                          // Calculate current discount (if modified)
                          const currentDiscount = basePrice - currentAmount;
                          const currentDiscountPercent = basePrice > 0 ? parseFloat(((currentDiscount / basePrice) * 100).toFixed(3)) : 0;
                          
                          return (
                            <>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    {mrp > 0 ? 'MRP / Base Price' : 'Current Amount'}
                                  </label>
                                  <div style={{
                                    padding: '0.5rem',
                                    border: '1px solid var(--corp-border, #e2e8f0)',
                                    borderRadius: '0.375rem',
                                    background: 'var(--corp-bg-tertiary, #f1f5f9)',
                                    fontSize: '0.875rem',
                                    color: 'var(--corp-text-secondary, #475569)'
                                  }}>
                                    ₹{basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div>
                                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                                    Final Amount
                                  </label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Enter final amount"
                                    value={currentAmount}
                                    onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '0.5rem',
                                      border: '1px solid var(--corp-border, #e2e8f0)',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.875rem',
                                      background: 'var(--corp-bg-card, #ffffff)',
                                      color: 'var(--corp-text-primary, #0f172a)',
                                    }}
                                  />
                                </div>
                              </div>
                              
                              {/* Extra Discount Section */}
                              <div style={{ 
                                marginBottom: '0.75rem', 
                                padding: '0.75rem', 
                                background: 'var(--corp-bg-tertiary, #f1f5f9)', 
                                border: '1px solid var(--corp-info, #3b82f6)', 
                                borderRadius: '0.375rem',
                                color: 'var(--corp-text-primary, #0f172a)'
                              }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--corp-info, #3b82f6)' }}>
                                  Adjust Discount (Increase/Decrease)
                                </label>
                                <div className="discount-inputs-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                  <div>
                                    <label className="discount-label-mobile" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                      <span className="label-text-full">Discount Percentage (%)</span>
                                      <span className="label-text-short">Disc %</span>
                                    </label>
                                    <input
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      max="100"
                                      placeholder={existingDiscount > 0 ? `Current: ${existingDiscountPercent.toFixed(3)}%` : "Enter %"}
                                      value={discountInput ? (discountInput.type === 'percent' ? discountInput.value : (discountInput.calculatedPercent ? parseFloat(discountInput.calculatedPercent).toFixed(3) : '')) : (existingDiscount > 0 ? existingDiscountPercent.toFixed(3) : '')}
                                      onChange={(e) => handleDiscountChange(item.id, 'percent', e.target.value, basePrice)}
                                      className="discount-input"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid var(--corp-border, #e2e8f0)',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        background: 'var(--corp-bg-card, #ffffff)',
                                        color: 'var(--corp-text-primary, #0f172a)',
                                        height: '100%',
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="discount-label-mobile" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                      <span className="label-text-full">Discount Amount (₹)</span>
                                      <span className="label-text-short">Disc Amt</span>
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={basePrice}
                                      placeholder={existingDiscount > 0 ? `Current: ₹${existingDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Enter amount"}
                                      value={discountInput ? (discountInput.type === 'amount' ? discountInput.value : (discountInput.calculatedAmount || '')) : (existingDiscount > 0 ? existingDiscount : '')}
                                      onChange={(e) => handleDiscountChange(item.id, 'amount', e.target.value, basePrice)}
                                      className="discount-input"
                                      style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        border: '1px solid var(--corp-border, #e2e8f0)',
                                        borderRadius: '0.375rem',
                                        fontSize: '0.875rem',
                                        background: 'var(--corp-bg-card, #ffffff)',
                                        color: 'var(--corp-text-primary, #0f172a)',
                                        height: '100%',
                                      }}
                                    />
                                  </div>
                                </div>
                                
                                {/* Show updated discount if changed */}
                                {Math.abs(currentDiscount - existingDiscount) > 0.01 && (
                                  <div style={{ 
                                    fontSize: '0.75rem', 
                                    color: currentDiscount > existingDiscount ? '#059669' : '#dc2626', 
                                    marginTop: '0.5rem', 
                                    display: 'flex', 
                                    gap: '0.5rem', 
                                    alignItems: 'center', 
                                    flexWrap: 'wrap',
                                    padding: '0.5rem',
                                    background: currentDiscount > existingDiscount ? '#f0fdf4' : '#fef2f2',
                                    borderRadius: '0.25rem'
                                  }}>
                                    <span style={{ fontWeight: '600' }}>
                                      {currentDiscount > existingDiscount ? 'Additional Discount:' : 'Reduced Discount:'}
                                    </span>
                                    <span style={{ fontWeight: '700' }}>
                                      ₹{Math.abs(currentDiscount - existingDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span style={{ color: 'var(--corp-text-secondary, #475569)' }}>
                                      (Total: ₹{currentDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {parseFloat(currentDiscountPercent).toFixed(3)}%)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          );
                        })()}
                        <div style={{ position: 'relative' }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                            Serial Number *
                          </label>
                          {serials.length > 0 ? (
                            <div style={{ position: 'relative' }}>
                              <SearchableSelect
                                value={selectedSerials[item.id] || ''}
                                onChange={(value) => handleSerialChange(item.id, value)}
                                options={serials.map(serial => ({
                                  value: serial,
                                  label: serial
                                }))}
                                placeholder="Search and select serial number..."
                                displayKey="label"
                                valueKey="value"
                              />
                            </div>
                          ) : (
                            <input
                              type="text"
                              placeholder="Enter serial number manually"
                              value={selectedSerials[item.id] || ''}
                              onChange={(e) => handleSerialChange(item.id, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.5rem',
                                border: '1px solid var(--corp-border, #e2e8f0)',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                background: 'var(--corp-bg-card, #ffffff)',
                                color: 'var(--corp-text-primary, #0f172a)',
                              }}
                            />
                          )}
                          {serials.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--corp-text-secondary, #475569)', marginTop: '0.5rem' }}>
                              {serials.length} serial number{serials.length !== 1 ? 's' : ''} available
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Total Amount Summary */}
                {selectedOrder && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    background: 'var(--corp-bg-tertiary, #f1f5f9)',
                    border: '1px solid var(--corp-info, #3b82f6)',
                    borderRadius: '0.375rem',
                    color: 'var(--corp-text-primary, #0f172a)'
                  }}>
                    {(() => {
                      // Calculate totals
                      const baseTotal = selectedOrder.items.reduce((sum, item) => {
                        const mrp = parseFloat(item.MRP || item.mrp || 0);
                        const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                        return sum + (mrp > 0 ? mrp : originalFinalAmount);
                      }, 0);
                      
                      const existingDiscountTotal = selectedOrder.items.reduce((sum, item) => {
                        const mrp = parseFloat(item.MRP || item.mrp || 0);
                        const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                        const existingDiscountAmount = parseFloat(item.discount_amount || item.DISCOUNT_AMOUNT || 0);
                        const basePrice = mrp > 0 ? mrp : originalFinalAmount;
                        const existingDiscount = existingDiscountAmount > 0 ? existingDiscountAmount : (basePrice > originalFinalAmount ? basePrice - originalFinalAmount : 0);
                        return sum + existingDiscount;
                      }, 0);
                      
                      const finalTotal = selectedOrder.items.reduce((sum, item) => {
                        const originalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                        const adjustedAmount = adjustedAmounts[item.id];
                        const finalAmount = (adjustedAmount !== undefined) ? adjustedAmount : originalAmount;
                        return sum + finalAmount;
                      }, 0);
                      
                      const totalDiscount = baseTotal - finalTotal;
                      const totalDiscountPercent = baseTotal > 0 ? ((totalDiscount / baseTotal) * 100).toFixed(2) : 0;
                      
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>Base Total (MRP):</span>
                            <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                              ₹{baseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {existingDiscountTotal > 0.01 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Existing Discount:</span>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)' }}>
                                -₹{existingDiscountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {totalDiscount > existingDiscountTotal + 0.01 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Additional Discount:</span>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)' }}>
                                -₹{(totalDiscount - existingDiscountTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          {totalDiscount < existingDiscountTotal - 0.01 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Discount Reduced:</span>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-danger, #dc2626)' }}>
                                +₹{(existingDiscountTotal - totalDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--corp-border, #e2e8f0)' }}>
                            <span style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>Final Total:</span>
                            <span style={{ fontWeight: '700', fontSize: '1.125rem', color: '#059669' }}>
                              ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          {totalDiscount > 0.01 && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: '600' }}>Total Discount:</span>
                              <span style={{ fontWeight: '700' }}>₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span style={{ color: 'var(--corp-text-secondary, #475569)' }}>({totalDiscountPercent}%)</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    setSelectedSerials({});
                    setAdjustedAmounts({});
                    setDiscountInputs({});
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => handleCancelOrder(selectedOrder?.invoice_number || selectedOrder?.id, selectedOrder)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Cancel Order
                </button>
                <button
                  onClick={handleAssignSerials}
                  disabled={assigning}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: assigning ? '#94a3b8' : '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: assigning ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                  }}
                >
                  {assigning ? 'Assigning...' : 'Assign Serial Numbers'}
                </button>
              </div>
            </div>
          )}

          {/* Order Details & Assignment - Mobile/Tablet Modal */}
          {selectedOrder && (
            <>
              <div 
                className="pending-order-modal-overlay"
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedSerials({});
                  setAdjustedAmounts({});
                  setDiscountInputs({});
                }}
              />
              <div className="pending-order-modal">
                <div className="pending-order-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      className="pending-order-modal-back"
                      onClick={() => {
                        setSelectedOrder(null);
                        setSelectedSerials({});
                        setAdjustedAmounts({});
                        setDiscountInputs({});
                      }}
                      title="Back to Pending Orders"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span style={{ display: 'inline-block', lineHeight: '1' }}>←</span>
                    </button>
                    <h3 style={{ margin: 0, color: 'var(--corp-text-primary, #0f172a)' }}>
                      Assign Serial Numbers - {selectedOrder.invoice_number}
                    </h3>
                  </div>
                  <button
                    className="pending-order-modal-close"
                    onClick={() => {
                      setSelectedOrder(null);
                      setSelectedSerials({});
                      setAdjustedAmounts({});
                      setDiscountInputs({});
                    }}
                  >
                    ×
                  </button>
                </div>
                <div className="pending-order-modal-body">
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--corp-bg-secondary, #f8fafc)', borderRadius: '0.375rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                    <div><strong>Customer:</strong> {selectedOrder.customer_name}</div>
                    <div><strong>Phone:</strong> {selectedOrder.customer_mobile_number}</div>
                    <div><strong>Date:</strong> {formatDateTime(selectedOrder.created_at)}</div>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.75rem', color: 'var(--corp-text-primary, #0f172a)' }}>Order Items</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {Array.isArray(selectedOrder.items) && selectedOrder.items.map((item) => {
                        const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
                        const serialNum = item.SERIAL_NUMBER || item.serial_number;
                        const hasSerial = !!(serialNum && serialNum !== 'PENDING' && serialNum !== 'N/A');
                        const productId = item.product_id;
                        const serials = availableSerials[productId] || [];

                        if (hasSerial) {
                          return (
                            <div
                              key={item.id}
                              style={{
                                padding: '1rem',
                                border: '1px solid var(--corp-accent, #10b981)',
                                borderRadius: '0.375rem',
                                background: 'var(--corp-bg-secondary, #f8fafc)',
                                color: 'var(--corp-text-primary, #0f172a)',
                              }}
                            >
                              <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                                {item.NAME || item.name || 'Product'}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)', marginBottom: '0.25rem' }}>
                                ✓ Serial Number: {item.SERIAL_NUMBER || item.serial_number}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                Amount: ₹{parseFloat(item.final_amount || item.FINAL_AMOUNT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          );
                        }

                        if (isWaterProduct) {
                          return (
                            <div
                              key={item.id}
                              style={{
                                padding: '1rem',
                                border: '1px solid var(--corp-border, #e2e8f0)',
                                borderRadius: '0.375rem',
                                background: 'var(--corp-bg-secondary, #f8fafc)',
                                color: 'var(--corp-text-primary, #0f172a)',
                              }}
                            >
                              <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                                {item.NAME || item.name || 'Product'}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                Water product - No serial number required
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: '1rem',
                              border: '1px solid var(--corp-warning, #fbbf24)',
                              borderRadius: '0.375rem',
                              background: 'var(--corp-bg-secondary, #f8fafc)',
                              color: 'var(--corp-text-primary, #0f172a)',
                            }}
                          >
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                              {item.NAME || item.name || 'Product'}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)', marginBottom: '0.75rem' }}>
                              SKU: {item.SKU || item.sku || 'N/A'} | Category: {item.CATEGORY || item.category || 'N/A'}
                            </div>
                            {(() => {
                              const mrp = parseFloat(item.MRP || item.mrp || 0);
                              const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                              const existingDiscountAmount = parseFloat(item.discount_amount || item.DISCOUNT_AMOUNT || 0);
                              const basePrice = mrp > 0 ? mrp : originalFinalAmount;
                              const currentAmount = adjustedAmounts[item.id] !== undefined ? adjustedAmounts[item.id] : originalFinalAmount;
                              const discountInput = discountInputs[item.id];
                              const existingDiscount = existingDiscountAmount > 0 ? existingDiscountAmount : (basePrice > originalFinalAmount ? basePrice - originalFinalAmount : 0);
                              const existingDiscountPercent = basePrice > 0 ? parseFloat(((existingDiscount / basePrice) * 100).toFixed(3)) : 0;
                              const currentDiscount = basePrice - currentAmount;
                              const currentDiscountPercent = basePrice > 0 ? parseFloat(((currentDiscount / basePrice) * 100).toFixed(3)) : 0;
                              
                              return (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                                        {mrp > 0 ? 'MRP / Base Price' : 'Current Amount'}
                                      </label>
                                      <div style={{
                                        padding: '0.5rem',
                                        border: '1px solid var(--corp-border, #e2e8f0)',
                                        borderRadius: '0.375rem',
                                        background: 'var(--corp-bg-tertiary, #f1f5f9)',
                                        fontSize: '0.875rem',
                                        color: 'var(--corp-text-secondary, #475569)'
                                      }}>
                                        ₹{basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                    </div>
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                                        Final Amount
                                      </label>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="Enter final amount"
                                        value={currentAmount}
                                        onChange={(e) => handleAmountChange(item.id, e.target.value)}
                                        style={{
                                          width: '100%',
                                          padding: '0.5rem',
                                          border: '1px solid var(--corp-border, #e2e8f0)',
                                          borderRadius: '0.375rem',
                                          fontSize: '0.875rem',
                                          background: 'var(--corp-bg-card, #ffffff)',
                                          color: 'var(--corp-text-primary, #0f172a)',
                                        }}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div style={{ 
                                    marginBottom: '0.75rem', 
                                    padding: '0.75rem', 
                                    background: 'var(--corp-bg-tertiary, #f1f5f9)', 
                                    border: '1px solid var(--corp-info, #3b82f6)', 
                                    borderRadius: '0.375rem',
                                    color: 'var(--corp-text-primary, #0f172a)'
                                  }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--corp-info, #3b82f6)' }}>
                                      Adjust Discount (Increase/Decrease)
                                    </label>
                                    <div className="discount-inputs-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                      <div>
                                        <label className="discount-label-mobile" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                          <span className="label-text-full">Discount Percentage (%)</span>
                                          <span className="label-text-short">Disc %</span>
                                        </label>
                                        <input
                                          type="number"
                                          step="0.001"
                                          min="0"
                                          max="100"
                                          placeholder={existingDiscount > 0 ? `Current: ${existingDiscountPercent.toFixed(3)}%` : "Enter %"}
                                          value={discountInput ? (discountInput.type === 'percent' ? discountInput.value : (discountInput.calculatedPercent ? parseFloat(discountInput.calculatedPercent).toFixed(3) : '')) : (existingDiscount > 0 ? existingDiscountPercent.toFixed(3) : '')}
                                          onChange={(e) => handleDiscountChange(item.id, 'percent', e.target.value, basePrice)}
                                          className="discount-input"
                                          style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid var(--corp-border, #e2e8f0)',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            background: 'var(--corp-bg-card, #ffffff)',
                                            color: 'var(--corp-text-primary, #0f172a)',
                                            height: '100%',
                                          }}
                                        />
                                      </div>
                                      <div>
                                        <label className="discount-label-mobile" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                          <span className="label-text-full">Discount Amount (₹)</span>
                                          <span className="label-text-short">Disc Amt</span>
                                        </label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          max={basePrice}
                                          placeholder={existingDiscount > 0 ? `Current: ₹${existingDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Enter amount"}
                                          value={discountInput ? (discountInput.type === 'amount' ? discountInput.value : (discountInput.calculatedAmount || '')) : (existingDiscount > 0 ? existingDiscount : '')}
                                          onChange={(e) => handleDiscountChange(item.id, 'amount', e.target.value, basePrice)}
                                          className="discount-input"
                                          style={{
                                            width: '100%',
                                            padding: '0.5rem',
                                            border: '1px solid var(--corp-border, #e2e8f0)',
                                            borderRadius: '0.375rem',
                                            fontSize: '0.875rem',
                                            background: 'var(--corp-bg-card, #ffffff)',
                                            color: 'var(--corp-text-primary, #0f172a)',
                                            height: '100%',
                                          }}
                                        />
                                      </div>
                                    </div>
                                    
                                    {Math.abs(currentDiscount - existingDiscount) > 0.01 && (
                                      <div style={{ 
                                        fontSize: '0.75rem', 
                                        color: currentDiscount > existingDiscount ? '#059669' : '#dc2626', 
                                        marginTop: '0.5rem', 
                                        display: 'flex', 
                                        gap: '0.5rem', 
                                        alignItems: 'center', 
                                        flexWrap: 'wrap',
                                        padding: '0.5rem',
                                        background: currentDiscount > existingDiscount ? '#f0fdf4' : '#fef2f2',
                                        borderRadius: '0.25rem'
                                      }}>
                                        <span style={{ fontWeight: '600' }}>
                                          {currentDiscount > existingDiscount ? 'Additional Discount:' : 'Reduced Discount:'}
                                        </span>
                                        <span style={{ fontWeight: '700' }}>
                                          ₹{Math.abs(currentDiscount - existingDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </span>
                                        <span style={{ color: 'var(--corp-text-secondary, #475569)' }}>
                                          (Total: ₹{currentDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {parseFloat(currentDiscountPercent).toFixed(3)}%)
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                            <div style={{ position: 'relative' }}>
                              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: '500', color: 'var(--corp-text-primary, #0f172a)' }}>
                                Serial Number *
                              </label>
                              {serials.length > 0 ? (
                                <div style={{ position: 'relative' }}>
                                  <SearchableSelect
                                    value={selectedSerials[item.id] || ''}
                                    onChange={(value) => handleSerialChange(item.id, value)}
                                    options={serials.map(serial => ({
                                      value: serial,
                                      label: serial
                                    }))}
                                    placeholder="Search and select serial number..."
                                    displayKey="label"
                                    valueKey="value"
                                  />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Enter serial number manually"
                                  value={selectedSerials[item.id] || ''}
                                  onChange={(e) => handleSerialChange(item.id, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid var(--corp-border, #e2e8f0)',
                                    borderRadius: '0.375rem',
                                    fontSize: '0.875rem',
                                    background: 'var(--corp-bg-card, #ffffff)',
                                    color: 'var(--corp-text-primary, #0f172a)',
                                  }}
                                />
                              )}
                              {serials.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--corp-text-secondary, #475569)', marginTop: '0.5rem' }}>
                                  {serials.length} serial number{serials.length !== 1 ? 's' : ''} available
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {selectedOrder && Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                    <div style={{
                      marginTop: '1.5rem',
                      padding: '1rem',
                      background: 'var(--corp-bg-tertiary, #f1f5f9)',
                      border: '1px solid var(--corp-info, #3b82f6)',
                      borderRadius: '0.375rem',
                      color: 'var(--corp-text-primary, #0f172a)'
                    }}>
                      {(() => {
                        const baseTotal = selectedOrder.items.reduce((sum, item) => {
                          const mrp = parseFloat(item.MRP || item.mrp || 0);
                          const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                          return sum + (mrp > 0 ? mrp : originalFinalAmount);
                        }, 0);
                        const existingDiscountTotal = selectedOrder.items.reduce((sum, item) => {
                          const mrp = parseFloat(item.MRP || item.mrp || 0);
                          const originalFinalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                          const existingDiscountAmount = parseFloat(item.discount_amount || item.DISCOUNT_AMOUNT || 0);
                          const basePrice = mrp > 0 ? mrp : originalFinalAmount;
                          const existingDiscount = existingDiscountAmount > 0 ? existingDiscountAmount : (basePrice > originalFinalAmount ? basePrice - originalFinalAmount : 0);
                          return sum + existingDiscount;
                        }, 0);
                        const finalTotal = selectedOrder.items.reduce((sum, item) => {
                          const originalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || 0);
                          const adjustedAmount = adjustedAmounts[item.id];
                          const finalAmount = (adjustedAmount !== undefined) ? adjustedAmount : originalAmount;
                          return sum + finalAmount;
                        }, 0);
                        const totalDiscount = baseTotal - finalTotal;
                        const totalDiscountPercent = baseTotal > 0 ? ((totalDiscount / baseTotal) * 100).toFixed(2) : 0;
                        
                        return (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>Base Total (MRP):</span>
                              <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-text-primary, #0f172a)' }}>
                                ₹{baseTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {existingDiscountTotal > 0.01 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Existing Discount:</span>
                                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)' }}>
                                  -₹{existingDiscountTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            {totalDiscount > existingDiscountTotal + 0.01 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Additional Discount:</span>
                                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)' }}>
                                  -₹{(totalDiscount - existingDiscountTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            {totalDiscount < existingDiscountTotal - 0.01 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--corp-text-secondary, #475569)' }}>Discount Reduced:</span>
                                <span style={{ fontWeight: '600', fontSize: '0.875rem', color: 'var(--corp-danger, #dc2626)' }}>
                                  +₹{(existingDiscountTotal - totalDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--corp-border, #e2e8f0)' }}>
                              <span style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>Final Total:</span>
                              <span style={{ fontWeight: '700', fontSize: '1.125rem', color: '#059669' }}>
                                ₹{finalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            {totalDiscount > 0.01 && (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--corp-accent-dark, #059669)', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '600' }}>Total Discount:</span>
                                <span style={{ fontWeight: '700' }}>₹{totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span style={{ color: 'var(--corp-text-secondary, #475569)' }}>({totalDiscountPercent}%)</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                    <button
                      onClick={() => {
                        setSelectedOrder(null);
                        setSelectedSerials({});
                        setAdjustedAmounts({});
                        setDiscountInputs({});
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      Close
                    </button>
                    <button
                      onClick={() => handleCancelOrder(selectedOrder?.invoice_number || selectedOrder?.id, selectedOrder)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      Cancel Order
                    </button>
                    <button
                      onClick={handleAssignSerials}
                      disabled={assigning}
                      style={{
                        padding: '0.75rem 1.5rem',
                        backgroundColor: assigning ? '#94a3b8' : '#059669',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: assigning ? 'not-allowed' : 'pointer',
                        fontWeight: '500',
                      }}
                    >
                      {assigning ? 'Assigning...' : 'Assign Serial Numbers'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default PendingOrders;

