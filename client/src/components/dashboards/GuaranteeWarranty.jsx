import { useState, useEffect } from 'react';
import { 
  getBatteryStatus, 
  getReplacementHistory, 
  getAllReplacementHistory,
  getWarrantySlabs, 
  createReplacement,
  fetchProducts,
  getAvailableSerials,
} from '../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';
import './GuaranteeWarrantyTable.css';

const STORAGE_KEY = 'guaranteeWarrantyState';

const GuaranteeWarranty = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [serialNumber, setSerialNumber] = useState(() => savedState?.serialNumber || '');
  const [batteryStatus, setBatteryStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [replacementHistory, setReplacementHistory] = useState([]);
  const [warrantySlabs, setWarrantySlabs] = useState([]);
  const [products, setProducts] = useState([]);
  const [replacementForm, setReplacementForm] = useState(() => savedState?.replacementForm || {
    newProductId: '',
    newSerialNumber: '',
    warrantySlabId: '',
    notes: ''
  });
  const [replacing, setReplacing] = useState(false);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [historySearch, setHistorySearch] = useState(() => savedState?.historySearch || '');
  const [historyTypeFilter, setHistoryTypeFilter] = useState(() => savedState?.historyTypeFilter || 'all');
  const [historyDateFrom, setHistoryDateFrom] = useState(() => savedState?.historyDateFrom || '');
  const [historyDateTo, setHistoryDateTo] = useState(() => savedState?.historyDateTo || '');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      serialNumber,
      replacementForm,
      historySearch,
      historyTypeFilter,
      historyDateFrom,
      historyDateTo
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [serialNumber, replacementForm, historySearch, historyTypeFilter, historyDateFrom, historyDateTo, isInitialMount]);

  useEffect(() => {
    // On initial load, fetch static data and the full replacement ledger
    loadWarrantySlabs();
    loadProducts();
    loadAllHistory();
  }, []);

  const loadWarrantySlabs = async () => {
    try {
      const slabs = await getWarrantySlabs();
      setWarrantySlabs(slabs);
    } catch (err) {
      console.error('Failed to load warranty slabs:', err);
    }
  };

  const loadProducts = async () => {
    try {
      const prods = await fetchProducts();
      setProducts(prods || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const loadAvailableSerials = async (productId) => {
    if (!productId) {
      setAvailableSerials([]);
      setReplacementForm(prev => ({ ...prev, newSerialNumber: '' }));
      return;
    }

    try {
      setLoadingSerials(true);
      setError(null);

      // Determine category from the selected product in products list
      const selectedProduct = products.find(p => String(p.id) === String(productId));
      const category = selectedProduct?.category || 'car-truck-tractor';

      const serials = await getAvailableSerials(category, productId);
      setAvailableSerials(serials || []);

      // Auto-select first available serial if any
      setReplacementForm(prev => ({
        ...prev,
        newSerialNumber: serials && serials.length > 0 ? serials[0] : '',
      }));
    } catch (err) {
      console.error('Failed to load available serials:', err);
      setError(err.message || 'Failed to load available serial numbers');
      setAvailableSerials([]);
      setReplacementForm(prev => ({ ...prev, newSerialNumber: '' }));
    } finally {
      setLoadingSerials(false);
    }
  };

  const loadReplacementHistory = async (customerId) => {
    try {
      const history = await getReplacementHistory(customerId);
      setReplacementHistory(history);
    } catch (err) {
      console.error('Failed to load replacement history for customer:', err);
    }
  };

  const loadAllHistory = async () => {
    try {
      const history = await getAllReplacementHistory();
      setReplacementHistory(history);
    } catch (err) {
      console.error('Failed to load all replacement history:', err);
    }
  };

  const handleCheckStatus = async () => {
    if (!serialNumber.trim()) {
      setError('Please enter a serial number');
      return;
    }

    setLoading(true);
    setError(null);
    setBatteryStatus(null);

    try {
      const status = await getBatteryStatus(serialNumber.trim());
      setBatteryStatus(status);
      // Pre-select the same product for guarantee replacements, or leave empty for warranty
      setReplacementForm({
        newProductId: status.status.replacementType === 'guarantee' ? (status.product?.id || '') : '',
        newSerialNumber: '',
        warrantySlabId: status.warrantySlab?.id || '',
        notes: ''
      });

      // If under guarantee and product is pre-selected, load serials immediately
      if (status.status.replacementType === 'guarantee' && status.product?.id) {
        loadAvailableSerials(status.product.id);
      } else {
        setAvailableSerials([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to check battery status');
      setBatteryStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const handleReplace = async () => {
    if (!batteryStatus) {
      setError('Please check battery status first');
      return;
    }

    if (!replacementForm.newProductId) {
      setError('Please select a replacement product');
      return;
    }

    if (!replacementForm.newSerialNumber) {
      setError('Please select a new battery serial number');
      return;
    }

    if (batteryStatus.status.replacementType === 'warranty' && !replacementForm.warrantySlabId) {
      setError('Please select a warranty slab');
      return;
    }

    // Confirmation dialog
    const replacementType = batteryStatus.status.replacementType === 'guarantee' ? 'Guarantee' : 'Warranty';
    const selectedProduct = products.find(p => String(p.id) === String(replacementForm.newProductId));
    const confirmMessage = batteryStatus.status.replacementType === 'guarantee'
      ? `Process FREE Guarantee Replacement?\n\nOriginal Serial: ${batteryStatus.serialNumber}\nReplacement Product: ${selectedProduct?.name || 'N/A'}\nNew Serial: ${replacementForm.newSerialNumber}\n\nThis will create a free replacement for the customer.`
      : `Process Warranty Replacement?\n\nOriginal Serial: ${batteryStatus.serialNumber}\nReplacement Product: ${selectedProduct?.name || 'N/A'}\nNew Serial: ${replacementForm.newSerialNumber}\nDiscount: ${batteryStatus.warrantySlab?.discount_percentage || 0}%\n\nThis will create a discounted replacement for the customer.`;

    const result = await Swal.fire({
      title: `Process ${replacementType} Replacement?`,
      html: confirmMessage.replace(/\n/g, '<br>'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: batteryStatus.status.replacementType === 'guarantee' ? '#28a745' : '#ffc107',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, process it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      return; // User cancelled
    }

    setReplacing(true);
    setError(null);

    try {
      const replacementData = {
        originalSerialNumber: batteryStatus.serialNumber,
        saleItemId: batteryStatus.saleItemId,
        newProductId: replacementForm.newProductId,
        newSerialNumber: replacementForm.newSerialNumber,
        replacementType: batteryStatus.status.replacementType,
        warrantySlabId: batteryStatus.status.replacementType === 'warranty' ? replacementForm.warrantySlabId : null,
        notes: replacementForm.notes || null
      };

      const result = await createReplacement(replacementData);
      
      // Show success message with details
      const successMessage = result.message || 'Replacement created successfully';
      const replacementDetails = result.replacement ? 
        `<br><br><strong>New Serial Number:</strong> ${result.replacement.new_serial_number}<br><strong>New Invoice:</strong> ${result.replacement.new_invoice_number || 'N/A'}` : '';
      
      await Swal.fire({
        title: 'Success!',
        html: successMessage + replacementDetails,
        icon: 'success',
        confirmButtonColor: '#28a745'
      });
      
      // Reload battery status to show updated information
      if (batteryStatus.serialNumber) {
        try {
          const updatedStatus = await getBatteryStatus(batteryStatus.serialNumber);
          setBatteryStatus(updatedStatus);
        } catch (err) {
          console.error('Failed to reload battery status:', err);
        }
      }
      
      // Reload full history so the new replacement appears in the ledger
      await loadAllHistory();

      // Reset UI back to initial state while keeping history visible
      setSerialNumber('');
      setBatteryStatus(null);
      setReplacementForm({
        newProductId: '',
        newSerialNumber: '',
        warrantySlabId: '',
        notes: '',
      });
      setAvailableSerials([]);
    } catch (err) {
      setError(err.message || 'Failed to create replacement');
    } finally {
      setReplacing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Derived filtered history based on search and filters
  const filteredHistory = replacementHistory.filter((replacement) => {
    // Type filter
    if (historyTypeFilter !== 'all' && replacement.replacement_type !== historyTypeFilter) {
      return false;
    }

    // Date range filter
    if (historyDateFrom || historyDateTo) {
      const date = replacement.replacement_date ? new Date(replacement.replacement_date) : null;
      if (!date || Number.isNaN(date.getTime())) {
        return false;
      }
      if (historyDateFrom) {
        const from = new Date(historyDateFrom);
        if (date < from) return false;
      }
      if (historyDateTo) {
        const to = new Date(historyDateTo);
        // include the whole end day
        to.setHours(23, 59, 59, 999);
        if (date > to) return false;
      }
    }

    // Text search filter
    const query = historySearch.trim().toLowerCase();
    if (!query) return true;

    const fieldsToSearch = [
      replacement.original_serial_number,
      replacement.new_serial_number,
      replacement.new_invoice_number,
      replacement.product_name,
      replacement.customer_name,
      replacement.sale_customer_name,
      replacement.customer_phone,
      replacement.sale_customer_phone,
      replacement.customer_vehicle_number,
    ]
      .filter(Boolean)
      .map((v) => String(v).toLowerCase());

    return fieldsToSearch.some((field) => field.includes(query));
  });

  return (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Guarantee & Warranty Management</h2>
        <p>Check battery status and process replacements</p>
      </div>

      {/* Check Battery Status Section */}
      <div className="card">
        <h3>Check Battery Status</h3>
        <div className="form-group">
          <label>Serial Number</label>
          <div className="serial-check-container" style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter battery serial number"
              onKeyPress={(e) => e.key === 'Enter' && handleCheckStatus()}
              className="serial-number-input"
              style={{ 
                flex: 1,
                height: '44px',
                padding: '0 15px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                fontSize: '1em',
                fontFamily: 'inherit',
              }}
            />
            <button 
              onClick={handleCheckStatus} 
              disabled={loading}
              className="primary-btn check-status-btn"
              style={{
                height: '44px',
                padding: '0 24px',
                borderRadius: '8px',
                whiteSpace: 'nowrap',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1e3a8a',
                color: '#ffffff',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background-color 0.2s ease, transform 0.1s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#1e40af';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#1e3a8a';
                }
              }}
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ marginTop: '10px', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {batteryStatus && (
          <div className="battery-status" style={{ marginTop: '20px', padding: '15px', borderRadius: '4px' }}>
            <h4>Battery Information</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
              <div>
                <strong>Serial Number:</strong> {batteryStatus.serialNumber}
              </div>
              <div>
                <strong>Product:</strong> {batteryStatus.product?.name} ({batteryStatus.product?.sku})
              </div>
              <div>
                <strong>Purchase Date:</strong> {formatDate(batteryStatus.purchaseDate)}
              </div>
              <div>
                <strong>Invoice Number:</strong> {batteryStatus.invoiceNumber}
              </div>
              <div>
                <strong>Guarantee Period:</strong> {batteryStatus.guaranteePeriodMonths} months
              </div>
              {batteryStatus.warrantyPeriodMonths > 0 && (
                <div>
                  <strong>Warranty Period:</strong> {batteryStatus.warrantyPeriodMonths} months
                </div>
              )}
            </div>

            {/* Customer Details Section */}
            <div className="customer-details-section" style={{ marginTop: '20px', padding: '15px', borderRadius: '4px' }}>
              <h4>Customer Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                <div>
                  <strong>Name:</strong> {batteryStatus.customer?.name || 'N/A'}
                </div>
                <div>
                  <strong>Phone:</strong> {batteryStatus.customer?.phone || 'N/A'}
                </div>
                {batteryStatus.customer?.email && (
                  <div>
                    <strong>Email:</strong> {batteryStatus.customer.email}
                  </div>
                )}
                {batteryStatus.customer?.vehicleNumber && (
                  <div>
                    <strong>Vehicle Number:</strong> {batteryStatus.customer.vehicleNumber}
                  </div>
                )}
                {batteryStatus.customer?.businessName && (
                  <div>
                    <strong>Business Name:</strong> {batteryStatus.customer.businessName}
                  </div>
                )}
                {batteryStatus.customer?.gstNumber && (
                  <div>
                    <strong>GST Number:</strong> {batteryStatus.customer.gstNumber}
                  </div>
                )}
                {batteryStatus.customer?.businessAddress && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Business Address:</strong> {batteryStatus.customer.businessAddress}
                  </div>
                )}
                {(batteryStatus.customer?.address || batteryStatus.customer?.city || batteryStatus.customer?.state || batteryStatus.customer?.pincode) && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Address:</strong>{' '}
                    {[
                      batteryStatus.customer.address,
                      batteryStatus.customer.city,
                      batteryStatus.customer.state,
                      batteryStatus.customer.pincode
                    ].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className={`status-section ${batteryStatus.status.underGuarantee ? 'guarantee' : 'warranty'}`} style={{ marginTop: '15px', padding: '10px', borderRadius: '4px' }}>
              <h4>Status</h4>
              <div>
                <strong>Type:</strong> {batteryStatus.status.underGuarantee ? 'Under Guarantee' : 'Under Warranty'}
              </div>
              {batteryStatus.status.underGuarantee ? (
                <div className="status-message guarantee-message" style={{ marginTop: '5px' }}>
                  ✓ Battery is eligible for free replacement under guarantee
                </div>
              ) : (
                <>
                  <div>
                    <strong>Months After Guarantee:</strong> {batteryStatus.status.monthsAfterGuarantee}
                  </div>
                  {batteryStatus.warrantySlab ? (
                    <div className="status-message warranty-message" style={{ marginTop: '5px' }}>
                      ✓ Eligible for {batteryStatus.warrantySlab.discount_percentage}% discount (Slab: {batteryStatus.warrantySlab.slab_name})
                    </div>
                  ) : (
                    <div className="status-message error-message" style={{ marginTop: '5px' }}>
                      ✗ Not eligible for warranty replacement
                    </div>
                  )}
                </>
              )}

              {batteryStatus.status.isReplaced && batteryStatus.latestReplacement && (
                <div className="replacement-info" style={{ marginTop: '10px', padding: '8px', borderRadius: '4px' }}>
                  <strong>Already Replaced:</strong> {formatDate(batteryStatus.latestReplacement.date)}
                  <br />
                  <strong>New Serial:</strong> {batteryStatus.latestReplacement.newSerialNumber}
                  <br />
                  <strong>Type:</strong> {batteryStatus.latestReplacement.type}
                </div>
              )}
            </div>

            {/* Replacement Form */}
            {batteryStatus.status.eligibleForReplacement && !batteryStatus.status.isReplaced && (
              <div className="replacement-form-container" style={{ 
                marginTop: '20px', 
                padding: '20px', 
                background: batteryStatus.status.replacementType === 'guarantee' ? 'var(--guarantee-bg)' : 'var(--warranty-bg)', 
                borderRadius: '8px',
                border: `2px solid ${batteryStatus.status.replacementType === 'guarantee' ? 'var(--guarantee-border)' : 'var(--warranty-border)'}`
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  marginBottom: '15px' 
                }}>
                  <h4 style={{ margin: 0, color: batteryStatus.status.replacementType === 'guarantee' ? 'var(--guarantee-text)' : 'var(--warranty-text)' }}>
                    {batteryStatus.status.replacementType === 'guarantee' ? '🛡️ Process Guarantee Replacement' : '⚡ Process Warranty Replacement'}
                  </h4>
                </div>
                
                {batteryStatus.status.replacementType === 'guarantee' && (
                  <div className="guarantee-info-banner" style={{ 
                    padding: '10px', 
                    background: 'var(--guarantee-info-bg)', 
                    borderRadius: '4px', 
                    marginBottom: '15px',
                    color: 'var(--guarantee-text)'
                  }}>
                    <strong>Free Replacement:</strong> This battery is under guarantee. The customer will receive a free replacement.
                  </div>
                )}

                {batteryStatus.status.replacementType === 'warranty' && batteryStatus.warrantySlab && (
                  <div className="warranty-info-banner" style={{ 
                    padding: '10px', 
                    background: 'var(--warranty-info-bg)', 
                    borderRadius: '4px', 
                    marginBottom: '15px',
                    color: 'var(--warranty-text)'
                  }}>
                    <strong>Warranty Replacement:</strong> Customer is eligible for {batteryStatus.warrantySlab.discount_percentage}% discount (Slab: {batteryStatus.warrantySlab.slab_name})
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '10px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block', color: 'var(--corp-text-primary)' }}>
                    Replacement Product <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={replacementForm.newProductId}
                    onChange={(e) => {
                      const newProductId = e.target.value;
                      setReplacementForm(prev => ({
                        ...prev,
                        newProductId,
                        newSerialNumber: '',
                      }));
                      setAvailableSerials([]);
                      if (newProductId) {
                        loadAvailableSerials(newProductId);
                      }
                    }}
                    style={{ 
                      width: '100%', 
                      padding: '10px', 
                      fontSize: '14px',
                      border: '1px solid var(--corp-border)',
                      borderRadius: '4px',
                      background: 'var(--corp-bg-input)',
                      color: 'var(--corp-text-primary)'
                    }}
                  >
                    <option value="">Select replacement product...</option>
                    {(() => {
                      // Get product_type_id and category from batteryStatus.product (now includes these fields from API)
                      const originalProductTypeId = batteryStatus.product?.product_type_id;
                      const originalCategory = batteryStatus.product?.category;
                      
                      // Filter products by matching product_type_id (preferred) or category (fallback)
                      const filteredProducts = products.filter(p => {
                        // Must have stock
                        if (!p.qty || p.qty <= 0) return false;
                        
                        // If original product has product_type_id, match by that
                        if (originalProductTypeId !== undefined && originalProductTypeId !== null) {
                          return p.product_type_id === originalProductTypeId;
                        }
                        
                        // Fallback to category matching
                        if (originalCategory) {
                          return p.category === originalCategory;
                        }
                        
                        // If no match found, show all (shouldn't happen, but safety fallback)
                        return true;
                      });
                      
                      return filteredProducts.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku}) - Stock: {product.qty} - ₹{product.mrp_price || product.price || 'N/A'}
                        </option>
                      ));
                    })()}
                  </select>
                  {(() => {
                    // Get product_type_id and category from batteryStatus.product (now includes these fields from API)
                    const originalProductTypeId = batteryStatus.product?.product_type_id;
                    const originalCategory = batteryStatus.product?.category;
                    
                    // Filter products by matching product_type_id (preferred) or category (fallback)
                    const filteredProducts = products.filter(p => {
                      // Must have stock
                      if (!p.qty || p.qty <= 0) return false;
                      
                      // If original product has product_type_id, match by that
                      if (originalProductTypeId !== undefined && originalProductTypeId !== null) {
                        return p.product_type_id === originalProductTypeId;
                      }
                      
                      // Fallback to category matching
                      if (originalCategory) {
                        return p.category === originalCategory;
                      }
                      
                      // If no match found, show all (shouldn't happen, but safety fallback)
                      return true;
                    });
                    
                    return filteredProducts.length === 0 && (
                      <div style={{ color: '#dc3545', marginTop: '5px', fontSize: '12px' }}>
                        ⚠️ No products available in stock for this category
                      </div>
                    );
                  })()}
                </div>

                {/* New Serial Number selection */}
                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block', color: 'var(--corp-text-primary)' }}>
                    New Battery Serial Number <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={replacementForm.newSerialNumber}
                    onChange={(e) =>
                      setReplacementForm(prev => ({
                        ...prev,
                        newSerialNumber: e.target.value,
                      }))
                    }
                    disabled={loadingSerials || !replacementForm.newProductId || availableSerials.length === 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid var(--corp-border)',
                      borderRadius: '4px',
                      backgroundColor: loadingSerials ? 'var(--corp-bg-hover)' : 'var(--corp-bg-input)',
                      color: 'var(--corp-text-primary)'
                    }}
                  >
                    {!replacementForm.newProductId && (
                      <option value="">
                        Select replacement product first...
                      </option>
                    )}
                    {replacementForm.newProductId && loadingSerials && (
                      <option value="">
                        Loading available serial numbers...
                      </option>
                    )}
                    {replacementForm.newProductId && !loadingSerials && availableSerials.length === 0 && (
                      <option value="">
                        No serial numbers available for this product
                      </option>
                    )}
                    {replacementForm.newProductId && !loadingSerials && availableSerials.length > 0 && (
                      <>
                        <option value="">Select serial number...</option>
                        {availableSerials.map(serial => (
                          <option key={serial} value={serial}>
                            {serial}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {replacementForm.newProductId && !loadingSerials && availableSerials.length === 0 && (
                    <div style={{ color: '#dc3545', marginTop: '5px', fontSize: '12px' }}>
                      ⚠️ No available serial numbers found in stock for this product.
                    </div>
                  )}
                </div>

                {batteryStatus.status.replacementType === 'warranty' && (
                  <div className="form-group" style={{ marginTop: '15px' }}>
                    <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block', color: 'var(--corp-text-primary)' }}>
                      Warranty Slab <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={replacementForm.warrantySlabId}
                      onChange={(e) => setReplacementForm({ ...replacementForm, warrantySlabId: e.target.value })}
                      style={{ 
                        width: '100%', 
                        padding: '10px',
                        fontSize: '14px',
                        border: '1px solid var(--corp-border)',
                        borderRadius: '4px',
                        background: 'var(--corp-bg-input)',
                        color: 'var(--corp-text-primary)'
                      }}
                    >
                      <option value="">Select warranty slab...</option>
                      {warrantySlabs.map(slab => (
                        <option key={slab.id} value={slab.id}>
                          {slab.slab_name} - {slab.discount_percentage}% discount
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '15px' }}>
                  <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block', color: 'var(--corp-text-primary)' }}>
                    Notes (Optional)
                  </label>
                  <textarea
                    value={replacementForm.notes}
                    onChange={(e) => setReplacementForm({ ...replacementForm, notes: e.target.value })}
                    placeholder="Add any notes about this replacement (e.g., reason for replacement, condition of battery, etc.)..."
                    rows={3}
                    style={{ 
                      width: '100%', 
                      padding: '10px',
                      fontSize: '14px',
                      border: '1px solid var(--corp-border)',
                      borderRadius: '4px',
                      resize: 'vertical',
                      background: 'var(--corp-bg-input)',
                      color: 'var(--corp-text-primary)'
                    }}
                  />
                </div>

                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={handleReplace}
                    disabled={replacing || !replacementForm.newProductId}
                    className="primary-btn"
                    style={{ 
                      flex: 1,
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      background: batteryStatus.status.replacementType === 'guarantee' ? '#28a745' : '#ffc107',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: replacing || !replacementForm.newProductId ? 'not-allowed' : 'pointer',
                      opacity: replacing || !replacementForm.newProductId ? 0.6 : 1
                    }}
                  >
                    {replacing ? (
                      <>⏳ Processing Replacement...</>
                    ) : (
                      <>✓ Process {batteryStatus.status.replacementType === 'guarantee' ? 'Guarantee' : 'Warranty'} Replacement</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {batteryStatus.status.eligibleForReplacement === false && !batteryStatus.status.isReplaced && (
              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: '#f8d7da', 
                borderRadius: '4px',
                border: '1px solid #f5c6cb',
                color: '#721c24'
              }}>
                <strong>⚠️ Not Eligible:</strong> This battery is not eligible for replacement. 
                {batteryStatus.status.outOfWarranty && ' The warranty period has expired.'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Replacement History Section */}
      {replacementHistory.length > 0 && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3>Replacement History</h3>
          
          {/* History search & filters */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: '10px',
              margin: '12px 0 16px',
              alignItems: 'center',
              overflowX: 'auto',
            }}
          >
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search by serial, invoice, product, or customer..."
              className="replacement-history-search"
              style={{ flex: '2 1 auto', minWidth: '200px' }}
            />

            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              className="replacement-history-filter"
            >
              <option value="all">All Types</option>
              <option value="guarantee">Guarantee</option>
              <option value="warranty">Warranty</option>
            </select>

            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              title="From Date"
              className="replacement-history-date"
            />

            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              title="To Date"
              className="replacement-history-date"
            />

            {(historySearch || historyTypeFilter !== 'all' || historyDateFrom || historyDateTo) && (
              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryTypeFilter('all');
                  setHistoryDateFrom('');
                  setHistoryDateTo('');
                }}
                className="replacement-history-clear-btn"
              >
                Clear Filters
              </button>
            )}
          </div>

          <div className="table-container" style={{ overflowX: 'auto' }}>
            <table 
              className="replacement-history-table"
              style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}
            >
              <thead>
                <tr className="replacement-history-header">
                  <th>Date</th>
                  <th>Type</th>
                  <th>Customer Name</th>
                  <th>Phone</th>
                  <th>Vehicle Number</th>
                  <th>Original Serial</th>
                  <th>New Serial</th>
                  <th>Discount</th>
                  <th>Product</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((replacement) => {
                  const customerName = replacement.sale_customer_name || replacement.customer_name || 'N/A';
                  const customerPhone = replacement.sale_customer_phone || replacement.customer_phone || 'N/A';
                  const vehicleNumber = replacement.customer_vehicle_number || 'N/A';
                  
                  return (
                    <tr key={replacement.id} className="replacement-history-row">
                      <td>{formatDate(replacement.replacement_date)}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: replacement.replacement_type === 'guarantee' ? '#d4edda' : '#fff3cd',
                          color: replacement.replacement_type === 'guarantee' ? '#155724' : '#856404'
                        }}>
                          {replacement.replacement_type}
                        </span>
                      </td>
                      <td>{customerName}</td>
                      <td>{customerPhone}</td>
                      <td>{vehicleNumber}</td>
                      <td>{replacement.original_serial_number}</td>
                      <td>{replacement.new_serial_number}</td>
                      <td>
                        {replacement.discount_percentage > 0 ? `${replacement.discount_percentage}%` : 'Free'}
                      </td>
                      <td>{replacement.product_name || 'N/A'}</td>
                      <td>{replacement.new_invoice_number || 'N/A'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuaranteeWarranty;

