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
      const data = await api.getPendingOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load pending orders');
      setOrders([]);
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
      calculatedDiscountPercent = numDiscount;
      finalAmount = basePrice - calculatedDiscountAmount;
    } else {
      // Discount amount: subtract from base price
      if (numDiscount > basePrice) return; // Can't discount more than base price
      calculatedDiscountAmount = numDiscount;
      calculatedDiscountPercent = basePrice > 0 ? (numDiscount / basePrice) * 100 : 0;
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
        <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 2fr' : '1fr', gap: '1.5rem' }}>
          {/* Orders List */}
          <div style={{ background: 'var(--corp-bg-card, #ffffff)', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: 'var(--corp-shadow, 0 1px 3px rgba(0,0,0,0.1))' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--corp-text-primary, #0f172a)' }}>Pending Orders ({orders.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {orders.map((order) => (
                <div
                  key={order.invoice_number || order.id}
                  onClick={() => loadOrderDetails(order.invoice_number || order.id)}
                  style={{
                    padding: '1rem',
                    border: selectedOrder?.invoice_number === order.invoice_number
                      ? '2px solid #2563eb'
                      : '1px solid var(--corp-border, #e2e8f0)',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    backgroundColor: selectedOrder?.invoice_number === order.invoice_number
                      ? 'var(--corp-bg-hover, #f8fafc)'
                      : 'transparent',
                    color: 'var(--corp-text-primary, #0f172a)',
                    transition: 'all 0.2s',
                  }}
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
              ))}
            </div>
          </div>

          {/* Order Details & Assignment */}
          {selectedOrder && (
            <div style={{ background: 'var(--corp-bg-card, #ffffff)', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: 'var(--corp-shadow, 0 1px 3px rgba(0,0,0,0.1))' }}>
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
                          const existingDiscountPercent = basePrice > 0 ? ((existingDiscount / basePrice) * 100).toFixed(2) : 0;
                          
                          // Calculate current discount (if modified)
                          const currentDiscount = basePrice - currentAmount;
                          const currentDiscountPercent = basePrice > 0 ? ((currentDiscount / basePrice) * 100).toFixed(2) : 0;
                          
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
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                      Discount Percentage (%)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max="100"
                                      placeholder={existingDiscount > 0 ? `Current: ${existingDiscountPercent}%` : "Enter %"}
                                      value={discountInput ? (discountInput.type === 'percent' ? discountInput.value : (discountInput.calculatedPercent || '')) : (existingDiscount > 0 ? existingDiscountPercent : '')}
                                      onChange={(e) => handleDiscountChange(item.id, 'percent', e.target.value, basePrice)}
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
                                  <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--corp-text-secondary, #475569)' }}>
                                      Discount Amount (₹)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={basePrice}
                                      placeholder={existingDiscount > 0 ? `Current: ₹${existingDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Enter amount"}
                                      value={discountInput ? (discountInput.type === 'amount' ? discountInput.value : (discountInput.calculatedAmount || '')) : (existingDiscount > 0 ? existingDiscount : '')}
                                      onChange={(e) => handleDiscountChange(item.id, 'amount', e.target.value, basePrice)}
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
                                      (Total: ₹{currentDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {currentDiscountPercent}%)
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

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
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
                  }}
                >
                  Cancel
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
                  }}
                >
                  {assigning ? 'Assigning...' : 'Assign Serial Numbers'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PendingOrders;

