import { useState, useEffect, useRef } from 'react';
import { 
  getCompanyReturns, 
  createCompanyReturn, 
  updateCompanyReturn,
  fetchProducts,
  getStock,
  getSoldSerialNumbers,
  getSaleBySerialNumber,
} from '../../api';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';

const STORAGE_KEY = 'companyReturnsState';

const CompanyReturns = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(() => savedState?.showForm || false);
  const [editingId, setEditingId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState(() => savedState?.formData || {
    returnedSerialNumber: '',
    returnedProductId: '',
    returnedDate: new Date().toISOString().split('T')[0],
    receivedSerialNumber: '',
    receivedProductId: '',
    receivedDate: '',
    addToStock: false,
    customerName: '',
    customerVehicleNumber: '',
    customerMobileNumber: '',
    reason: '',
    notes: '',
    status: 'pending'
  });

  // Edit form state (for received battery)
  const [editFormData, setEditFormData] = useState({
    receivedSerialNumber: '',
    receivedProductId: '',
    receivedDate: new Date().toISOString().split('T')[0],
    addToStock: false,
    status: 'pending'
  });

  // Filters
  const [filters, setFilters] = useState(() => savedState?.filters || {
    status: 'all',
    search: '',
    dateFrom: '',
    dateTo: ''
  });

  const [products, setProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  
  // Serial number search state
  const [serialSearchTerm, setSerialSearchTerm] = useState(() => savedState?.serialSearchTerm || '');
  const [soldSerialNumbers, setSoldSerialNumbers] = useState([]);
  const [showSerialDropdown, setShowSerialDropdown] = useState(false);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const dropdownRef = useRef(null);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      showForm,
      formData,
      filters,
      serialSearchTerm
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [showForm, formData, filters, serialSearchTerm, isInitialMount]);

  useEffect(() => {
    loadReturns();
    loadProducts();
  }, [filters]);
  
  // Debug: Monitor returnedSerialNumber changes
  useEffect(() => {
    console.log('formData.returnedSerialNumber changed to:', formData.returnedSerialNumber);
  }, [formData.returnedSerialNumber]);

  const loadReturns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getCompanyReturns(filters);
      setReturns(data || []);
    } catch (err) {
      console.error('Failed to load company returns:', err);
      setError(err.message || 'Failed to load company returns');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const prods = await fetchProducts();
      setProducts(prods || []);
      setAvailableProducts(prods || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        // Update existing return
        await updateCompanyReturn(editingId, editFormData);
        setEditingId(null);
        setEditFormData({
          receivedSerialNumber: '',
          receivedProductId: '',
          receivedDate: new Date().toISOString().split('T')[0],
          addToStock: false,
          status: 'pending'
        });
      } else {
        // Create new return
        console.log('Submitting form data:', formData);
        await createCompanyReturn(formData);
        setShowForm(false);
        setFormData({
          returnedSerialNumber: '',
          returnedProductId: '',
          returnedDate: new Date().toISOString().split('T')[0],
          receivedSerialNumber: '',
          receivedProductId: '',
          receivedDate: '',
          addToStock: false,
          customerName: '',
          customerVehicleNumber: '',
          customerMobileNumber: '',
          reason: '',
          notes: '',
          status: 'pending'
        });
      }
      await loadReturns();
    } catch (err) {
      console.error('Error saving company return:', err);
      // Try to extract error message from response
      const errorMessage = err.message || 
                          (err.response?.data?.error || err.response?.data?.details) || 
                          'Failed to save company return';
      setError(errorMessage);
    }
  };

  const handleEdit = (returnItem) => {
    setEditingId(returnItem.id);
    // Check if the received battery is already in stock
    const isInStock = returnItem.received_serial_number ? true : false; // We'll check this from the API if needed
    setEditFormData({
      receivedSerialNumber: returnItem.received_serial_number || '',
      receivedProductId: returnItem.received_product_id || '',
      receivedDate: returnItem.received_date ? returnItem.received_date.split('T')[0] : new Date().toISOString().split('T')[0],
      addToStock: false, // Default to false, user can check if they want to add
      status: returnItem.status
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      returnedSerialNumber: '',
      returnedProductId: '',
      returnedDate: new Date().toISOString().split('T')[0],
      receivedSerialNumber: '',
      receivedProductId: '',
      receivedDate: '',
      addToStock: false,
      customerName: '',
      customerVehicleNumber: '',
      customerMobileNumber: '',
      reason: '',
      notes: '',
      status: 'pending'
    });
    setEditFormData({
      receivedSerialNumber: '',
      receivedProductId: '',
      receivedDate: new Date().toISOString().split('T')[0],
      addToStock: false,
      status: 'pending'
    });
    setSerialSearchTerm('');
    setSoldSerialNumbers([]);
    setShowSerialDropdown(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', className: 'status-badge-pending' },
      returned: { label: 'Returned', className: 'status-badge-returned' },
      received: { label: 'Received', className: 'status-badge-received' },
      completed: { label: 'Completed', className: 'status-badge-completed' }
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`status-badge-base ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const filteredReturns = returns.filter((item) => {
    if (filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      const searchFields = [
        item.returned_serial_number,
        item.received_serial_number,
        item.customer_name,
        item.customer_vehicle_number,
        item.customer_mobile_number,
        item.returned_product_name,
        item.returned_product_sku,
        item.received_product_name,
        item.received_product_sku,
        item.reason,
        item.notes
      ].filter(Boolean).map(f => String(f).toLowerCase());
      if (!searchFields.some(field => field.includes(searchTerm))) {
        return false;
      }
    }
    if (filters.dateFrom && item.returned_date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && item.returned_date > filters.dateTo) {
      return false;
    }
    return true;
  });

  return (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Company Returns (Exide)</h2>
        <p>Track batteries returned to Exide company and replacements received</p>
      </div>

      {error && (
        <div className="error-message" style={{ 
          marginBottom: '20px', 
          padding: '12px', 
          background: '#fee', 
          color: '#c33', 
          borderRadius: '8px' 
        }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Filters</h3>
        {/* Desktop: Grid layout */}
        <div className="company-returns-filters-desktop" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="returned">Returned</option>
              <option value="received">Received</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search serial, product, customer..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
        </div>

        {/* Mobile/Tablet: Two rows */}
        <div className="company-returns-filters-mobile">
          {/* First Row: Search and Status */}
          <div className="company-returns-filters-row-1">
            <div className="company-returns-search-wrapper">
              <label className="company-returns-filter-label">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search serial, product, customer..."
                className="company-returns-search-input"
              />
            </div>
            <div className="company-returns-status-wrapper">
              <label className="company-returns-filter-label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="company-returns-status-select"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="returned">Returned</option>
                <option value="received">Received</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Second Row: Date Fields */}
          <div className="company-returns-filters-row-2">
            <div className="company-returns-date-wrapper">
              <label className="company-returns-date-label">From Date</label>
              <div className="company-returns-date-container">
                <svg className="company-returns-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="company-returns-date-input"
                />
              </div>
            </div>

            <div className="company-returns-date-wrapper">
              <label className="company-returns-date-label">To Date</label>
              <div className="company-returns-date-container">
                <svg className="company-returns-date-calendar-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="company-returns-date-input"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Return Button */}
      <div className="company-returns-header-actions" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Company Returns</h3>
        <button
          onClick={() => {
            if (showForm) {
              // Closing form - reset everything
              handleCancel();
            } else {
              // Opening form - just reset editing and show form
              setEditingId(null);
              setShowForm(true);
            }
          }}
          className="primary-btn company-returns-create-btn"
          style={{
            padding: '10px 20px',
            background: '#1e3a8a',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showForm ? 'Cancel' : 'Create Return'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>{editingId ? 'Update Return - Add Received Battery' : 'Add New Return to Exide'}</h3>
          <form onSubmit={handleSubmit}>
            {editingId ? (
              // Edit form - for adding received battery details
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Received Serial Number <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={editFormData.receivedSerialNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, receivedSerialNumber: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Received Product <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={editFormData.receivedProductId}
                      onChange={(e) => setEditFormData({ ...editFormData, receivedProductId: e.target.value })}
                      required
                      className="form-input"
                    >
                      <option value="">Select product...</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Received Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={editFormData.receivedDate}
                      onChange={(e) => setEditFormData({ ...editFormData, receivedDate: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                </div>
                <div style={{ marginTop: '15px', padding: '12px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #86efac' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={editFormData.addToStock}
                      onChange={(e) => setEditFormData({ ...editFormData, addToStock: e.target.checked })}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span style={{ fontWeight: '600', color: '#166534' }}>
                      Add this battery to shop stock
                    </span>
                  </label>
                  <small style={{ display: 'block', marginTop: '6px', color: '#6b7280', fontSize: '0.875rem', marginLeft: '28px' }}>
                    If checked, the replacement battery will be added to your stock and will be visible in admin/super admin stock views and customer product list.
                  </small>
                </div>
                <div style={{ marginTop: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Status <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      required
                      className="form-input"
                    >
                      <option value="pending">Pending</option>
                      <option value="returned">Returned</option>
                      <option value="received">Received</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </>
            ) : (
              // New return form
              <>
                <div className="quick-fill-section">
                  <h4 className="quick-fill-title">Quick Fill: Select Sold Battery Serial Number</h4>
                  <div style={{ position: 'relative' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Search Sold Serial Number
                    </label>
                    <input
                      type="text"
                      value={serialSearchTerm}
                      onChange={async (e) => {
                        const term = e.target.value;
                        setSerialSearchTerm(term);
                        setShowSerialDropdown(term.length > 0);
                        
                        if (term.length > 0) {
                          setLoadingSerials(true);
                          try {
                            const serials = await getSoldSerialNumbers(term);
                            setSoldSerialNumbers(serials || []);
                          } catch (err) {
                            console.error('Failed to fetch serial numbers:', err);
                            setSoldSerialNumbers([]);
                          } finally {
                            setLoadingSerials(false);
                          }
                        } else {
                          setSoldSerialNumbers([]);
                        }
                      }}
                      onFocus={() => {
                        if (serialSearchTerm.length > 0) {
                          setShowSerialDropdown(true);
                        }
                      }}
                      onBlur={(e) => {
                        // Check if the blur is because we're clicking inside the dropdown
                        // Use setTimeout to check after the click event has a chance to fire
                        setTimeout(() => {
                          // If dropdown ref exists and contains the related target, don't hide
                          if (dropdownRef.current && dropdownRef.current.contains(document.activeElement)) {
                            return;
                          }
                          setShowSerialDropdown(false);
                        }, 200);
                      }}
                      placeholder="Type to search sold battery serial numbers..."
                      className="quick-fill-input"
                    />
                    {showSerialDropdown && (
                      <div 
                        ref={dropdownRef}
                        className="quick-fill-dropdown"
                      >
                        {loadingSerials ? (
                          <div className="quick-fill-dropdown-item">Loading...</div>
                        ) : soldSerialNumbers.length === 0 ? (
                          <div className="quick-fill-dropdown-item">No serial numbers found</div>
                        ) : (
                          soldSerialNumbers.map((item, index) => {
                            // Extract serial number - try all possible field names
                            const serialNumber = item.serial_number || item.SERIAL_NUMBER || '';
                            
                            return (
                            <div
                              key={serialNumber || `item-${index}`}
                              onMouseDown={(e) => {
                                // onMouseDown fires BEFORE onBlur, so this will work
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Get serial number from item
                                const serialToSet = (item.serial_number || item.SERIAL_NUMBER || '').toString().trim();
                                
                                // Get all other fields from item - ensure productId is a valid number
                                const productId = item.product_id ? (typeof item.product_id === 'number' ? item.product_id : parseInt(item.product_id, 10)) : null;
                                const productIdStr = productId && !isNaN(productId) ? String(productId) : '';
                                const customerName = (item.customer_name || '').toString().trim();
                                const customerMobile = (item.customer_mobile_number || '').toString().trim();
                                const customerVehicle = (item.customer_vehicle_number || '').toString().trim();
                                
                                console.log('🖱️ MouseDown - Selected item:', { serialToSet, productId, productIdStr, customerName, customerMobile, customerVehicle });
                                
                                // Set ALL fields immediately from the item
                                setFormData(prev => {
                                  const newData = {
                                    ...prev,
                                    returnedSerialNumber: serialToSet,
                                    returnedProductId: productIdStr || prev.returnedProductId || '',
                                    customerName: customerName || prev.customerName,
                                    customerMobileNumber: customerMobile || prev.customerMobileNumber,
                                    customerVehicleNumber: customerVehicle || prev.customerVehicleNumber,
                                  };
                                  console.log('✅ FormData updated:', newData);
                                  return newData;
                                });
                                
                                setSerialSearchTerm(serialToSet);
                                setShowSerialDropdown(false);
                                
                                // Fetch detailed info to ensure we have complete data
                                if (serialToSet) {
                                  getSaleBySerialNumber(serialToSet)
                                    .then(saleDetails => {
                                    if (saleDetails) {
                                      const detailedSerial = (saleDetails.serial_number || saleDetails.SERIAL_NUMBER || serialToSet).toString().trim();
                                      const detailedProductId = saleDetails.product_id ? (typeof saleDetails.product_id === 'number' ? saleDetails.product_id : parseInt(saleDetails.product_id, 10)) : null;
                                      const detailedProductIdStr = detailedProductId && !isNaN(detailedProductId) ? String(detailedProductId) : '';
                                      console.log('📦 Fetched detailed sale info:', saleDetails);
                                      setFormData(prev => ({
                                        ...prev,
                                        returnedSerialNumber: detailedSerial,
                                        returnedProductId: detailedProductIdStr || prev.returnedProductId || '',
                                        customerName: (saleDetails.customer_name || prev.customerName || '').toString().trim(),
                                        customerMobileNumber: (saleDetails.customer_mobile_number || prev.customerMobileNumber || '').toString().trim(),
                                        customerVehicleNumber: (saleDetails.customer_vehicle_number || prev.customerVehicleNumber || '').toString().trim(),
                                      }));
                                    }
                                    })
                                    .catch(err => {
                                      console.error('Failed to fetch sale details:', err);
                                      // Fields are already set from item, so continue
                                    });
                                }
                              }}
                              className="quick-fill-dropdown-option"
                            >
                              <div className="quick-fill-serial-number">
                                🔢 Serial: {serialNumber || 'N/A'}
                              </div>
                              <div className="quick-fill-product-info">
                                <strong>Product:</strong> {item.product_name || 'N/A'} ({item.product_sku || 'N/A'})
                              </div>
                              <div className="quick-fill-customer-info">
                                <strong>Customer:</strong> {item.customer_name || 'N/A'} • {item.customer_mobile_number || 'N/A'}
                                {item.customer_vehicle_number && ` • Vehicle: ${item.customer_vehicle_number}`}
                              </div>
                            </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                  <small className="quick-fill-hint">
                    Search and select a sold battery serial number to auto-fill all details
                  </small>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Returned Serial Number
                    </label>
                    <input
                      type="text"
                      value={formData.returnedSerialNumber || ''}
                      onChange={(e) => {
                        console.log('Manual input changed returnedSerialNumber to:', e.target.value);
                        setFormData(prev => ({ ...prev, returnedSerialNumber: e.target.value }));
                      }}
                      placeholder="Enter serial number of battery returned (optional)"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Returned Product <span style={{ color: 'red' }}>*</span>
                    </label>
                    <select
                      value={formData.returnedProductId}
                      onChange={(e) => setFormData({ ...formData, returnedProductId: e.target.value })}
                      required
                      className="form-input"
                    >
                      <option value="">Select product...</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Returned Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.returnedDate}
                      onChange={(e) => setFormData({ ...formData, returnedDate: e.target.value })}
                      required
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="Customer name (optional)"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Customer Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={formData.customerVehicleNumber}
                      onChange={(e) => setFormData({ ...formData, customerVehicleNumber: e.target.value })}
                      placeholder="Vehicle number (optional)"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                      Customer Mobile Number
                    </label>
                    <input
                      type="text"
                      value={formData.customerMobileNumber}
                      onChange={(e) => setFormData({ ...formData, customerMobileNumber: e.target.value })}
                      placeholder="Mobile number (optional)"
                      className="form-input"
                    />
                  </div>
                </div>
                
                {/* Received Battery Section */}
                <div className="replacement-battery-section">
                  <h4 className="replacement-battery-title">Replacement Battery Received from Exide (Optional)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                        Received Serial Number
                      </label>
                      <input
                        type="text"
                        value={formData.receivedSerialNumber}
                        onChange={(e) => setFormData({ ...formData, receivedSerialNumber: e.target.value })}
                        placeholder="Enter new replacement battery serial number"
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                        Replacement Product
                      </label>
                      <select
                        value={formData.receivedProductId}
                        onChange={(e) => setFormData({ ...formData, receivedProductId: e.target.value })}
                        className="form-input"
                      >
                        <option value="">Select replacement product...</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                        Received Date
                      </label>
                      <input
                        type="date"
                        value={formData.receivedDate}
                        onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div className="add-to-stock-info">
                    <label className="add-to-stock-label">
                      <input
                        type="checkbox"
                        checked={formData.addToStock}
                        onChange={(e) => setFormData({ ...formData, addToStock: e.target.checked })}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span className="add-to-stock-text">
                        Add this battery to shop stock
                      </span>
                    </label>
                    <small className="add-to-stock-hint">
                      If checked, the replacement battery will be added to your stock and will be visible in admin/super admin stock views and customer product list.
                    </small>
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Reason for Return
                  </label>
                  <textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Reason for returning battery to Exide (e.g., faulty, under guarantee, etc.)"
                    rows={3}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd', resize: 'vertical' }}
                  />
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={2}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="submit"
                className="returns-submit-button"
              >
                {editingId ? 'Update Return' : 'Create Return'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="returns-cancel-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Returns Table */}
      <div className="card">
        <h3>Returns History</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : filteredReturns.length === 0 ? (
          <div className="returns-empty-state">
            No company returns found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="returns-table">
              <thead>
                <tr className="returns-table-header">
                  <th>Returned Date</th>
                  <th>Status</th>
                  <th>Returned Serial</th>
                  <th>Returned Product</th>
                  <th>Customer Name</th>
                  <th>Vehicle Number</th>
                  <th>Mobile Number</th>
                  <th>Received Date</th>
                  <th>Received Serial</th>
                  <th>Received Product</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((item) => (
                  <tr key={item.id} className="returns-table-row">
                    <td>{formatDate(item.returned_date)}</td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td className="returns-serial-number">{item.returned_serial_number || 'N/A'}</td>
                    <td>
                      {item.returned_product_name || 'N/A'}
                      {item.returned_product_sku && <span className="returns-sku"> ({item.returned_product_sku})</span>}
                    </td>
                    <td>{item.customer_name || 'N/A'}</td>
                    <td>{item.customer_vehicle_number || 'N/A'}</td>
                    <td>{item.customer_mobile_number || 'N/A'}</td>
                    <td>{formatDate(item.received_date)}</td>
                    <td className="returns-serial-number">
                      {item.received_serial_number || (
                        <span className="returns-not-received">Not received</span>
                      )}
                    </td>
                    <td>
                      {item.received_product_name ? (
                        <>
                          {item.received_product_name}
                          {item.received_product_sku && <span className="returns-sku"> ({item.received_product_sku})</span>}
                        </>
                      ) : (
                        <span className="returns-not-received">Not received</span>
                      )}
                    </td>
                    <td className="returns-reason">{item.reason || 'N/A'}</td>
                    <td>
                      {item.status !== 'completed' && (
                        <button
                          onClick={() => handleEdit(item)}
                          className="returns-action-button"
                        >
                          {item.received_serial_number ? 'Update' : 'Add Received'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyReturns;

