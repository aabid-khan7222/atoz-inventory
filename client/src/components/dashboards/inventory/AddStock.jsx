import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { useAuth } from '../../../contexts/AuthContext';
import SearchableDropdown from '../../common/SearchableDropdown';
import { getFormState, saveFormState, markFormSubmitted } from '../../../utils/formStateManager';
import './InventorySection.css';
import '../InventoryManagement.css';

const getCurrentDateISO = () => new Date().toISOString().split('T')[0];
const getCurrentTimeHHMM = () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

const STORAGE_KEY = 'addStockFormState';

const AddStock = ({ onBack }) => {
  const { user } = useAuth();
  const roleClass = user?.role_id === 1 ? 'super-admin' : user?.role_id === 2 ? 'admin' : '';
  
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  
  // Initialize state from saved state if available
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return savedState?.selectedCategory || 'car-truck-tractor';
  });
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(() => {
    return savedState?.quantity || '';
  });
  const [serialNumbers, setSerialNumbers] = useState(() => {
    return savedState?.serialNumbers || [''];
  });
  const [purchaseDate, setPurchaseDate] = useState(() => {
    return savedState?.purchaseDate || getCurrentDateISO();
  });
  const [purchaseTime, setPurchaseTime] = useState(() => {
    return savedState?.purchaseTime || getCurrentTimeHHMM();
  });
  const [purchasedFrom, setPurchasedFrom] = useState(() => {
    return savedState?.purchasedFrom || '';
  });
  const [amount, setAmount] = useState(() => {
    return savedState?.amount || '';
  });
  const [discountPercent, setDiscountPercent] = useState(() => {
    return savedState?.discountPercent || '';
  });
  const [discountAmount, setDiscountAmount] = useState(() => {
    return savedState?.discountAmount || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Track previous quantity to detect user changes (not restoration) - initialize with saved value
  const prevQuantityRef = React.useRef(savedState?.quantity || '');
  
  // Ensure saved state is properly restored on mount (force restore if savedState exists)
  useEffect(() => {
    if (isInitialMount && savedState) {
      // Force restore all fields from saved state
      if (savedState.selectedCategory) {
        setSelectedCategory(savedState.selectedCategory);
      }
      if (savedState.quantity !== undefined && savedState.quantity !== '') {
        setQuantity(savedState.quantity);
        prevQuantityRef.current = savedState.quantity;
      }
      if (savedState.serialNumbers && savedState.serialNumbers.length > 0) {
        setSerialNumbers(savedState.serialNumbers);
      }
      if (savedState.purchaseDate) {
        setPurchaseDate(savedState.purchaseDate);
      }
      if (savedState.purchaseTime) {
        setPurchaseTime(savedState.purchaseTime);
      }
      if (savedState.purchasedFrom !== undefined) {
        setPurchasedFrom(savedState.purchasedFrom);
      }
      if (savedState.amount !== undefined && savedState.amount !== '') {
        setAmount(savedState.amount);
      }
      if (savedState.discountPercent !== undefined && savedState.discountPercent !== '') {
        setDiscountPercent(savedState.discountPercent);
      }
      if (savedState.discountAmount !== undefined && savedState.discountAmount !== '') {
        setDiscountAmount(savedState.discountAmount);
      }
      setIsInitialMount(false);
    } else if (isInitialMount) {
      setIsInitialMount(false);
    }
  }, [isInitialMount, savedState]);
  
  // Save form state to sessionStorage whenever it changes (but not on initial mount)
  useEffect(() => {
    // Skip saving on initial mount to avoid overwriting with empty values
    if (isInitialMount) {
      return;
    }
    
    const formState = {
      selectedCategory,
      selectedProductId: selectedProduct?.id || null,
      quantity,
      serialNumbers,
      purchaseDate,
      purchaseTime,
      purchasedFrom,
      amount,
      discountPercent,
      discountAmount
    };
    saveFormState(STORAGE_KEY, formState);
  }, [selectedCategory, selectedProduct, quantity, serialNumbers, purchaseDate, purchaseTime, purchasedFrom, amount, discountPercent, discountAmount, isInitialMount]);
  
  // Track if we've restored state to prevent auto-sync from overriding saved serial numbers
  const [hasRestoredState, setHasRestoredState] = useState(false);
  const restoreStateRef = React.useRef(false);
  const isRestoringRef = React.useRef(!!savedState);

  // Restore selected product when products are loaded
  useEffect(() => {
    if (savedState?.selectedProductId && products.length > 0 && !selectedProduct) {
      const restoredProduct = products.find(p => p.id === savedState.selectedProductId);
      if (restoredProduct) {
        setSelectedProduct(restoredProduct);
        // Only restore amount from product DP if amount wasn't saved in state
        if (!savedState.amount && restoredProduct.dp) {
          setAmount(parseFloat(restoredProduct.dp || restoredProduct.mrp_price || 0).toString());
        }
      }
    }
    
    // Mark restoration as complete after products are loaded
    if (savedState && isRestoringRef.current) {
      setTimeout(() => {
        isRestoringRef.current = false;
        setHasRestoredState(true);
        // Set prevQuantityRef to match restored quantity so sync doesn't trigger
        prevQuantityRef.current = savedState.quantity || '';
      }, 100);
    } else if (!savedState) {
      // No saved state, mark as ready immediately
      setHasRestoredState(true);
    }
  }, [products, savedState, selectedProduct]);

  // Auto-sync serial numbers with quantity (skip for water products and if we just restored state)
  useEffect(() => {
    // Don't auto-sync if we're still restoring state
    if (isRestoringRef.current || !hasRestoredState) {
      prevQuantityRef.current = quantity;
      return;
    }
    
    // Skip serial number sync for water products
    if (selectedCategory === 'water') {
      if (serialNumbers.length > 0) {
        setSerialNumbers([]);
      }
      return;
    }
    
    // Only sync if quantity actually changed (user input, not restoration)
    const qty = parseInt(quantity) || 0;
    const prevQty = parseInt(prevQuantityRef.current) || 0;
    
    // Update ref for next comparison
    prevQuantityRef.current = quantity;
    
    // Only sync if quantity changed from previous value (user changed it)
    if (qty === prevQty) return;
    
    if (qty > 0) {
      setSerialNumbers(prev => {
        const currentCount = prev.length;
        if (qty !== currentCount) {
          if (qty > currentCount) {
            // Add empty serial number inputs
            return [...prev, ...Array(qty - currentCount).fill('')];
          } else {
            // Remove excess serial number inputs (keep first qty inputs)
            return prev.slice(0, qty);
          }
        }
        return prev;
      });
    } else if (quantity === '') {
      // Reset to single empty input when quantity is cleared (only if user cleared it)
      if (serialNumbers.length > 1 || (serialNumbers.length === 1 && serialNumbers[0] !== '')) {
        setSerialNumbers(['']);
      }
    }
  }, [quantity, selectedCategory, hasRestoredState, serialNumbers]);

  const categories = [
    { id: 'car-truck-tractor', name: 'Automotive', icon: '🚗' },
    { id: 'bike', name: 'Bike Batteries', icon: '🏍️' },
    { id: 'ups-inverter', name: 'UPS Batteries', icon: '⚡' },
    { id: 'water', name: 'Water Products', icon: '💧' }
  ];

  // Restore selected product when products are loaded (duplicate useEffect - keeping for compatibility)
  useEffect(() => {
    if (savedState?.selectedProductId && products.length > 0 && !selectedProduct) {
      const restoredProduct = products.find(p => p.id === savedState.selectedProductId);
      if (restoredProduct) {
        setSelectedProduct(restoredProduct);
        // Only restore amount from product DP if amount wasn't saved in state
        if (!savedState.amount && restoredProduct.dp) {
          setAmount(parseFloat(restoredProduct.dp || restoredProduct.mrp_price || 0).toString());
        }
      }
    }
  }, [products, savedState?.selectedProductId, savedState?.amount, selectedProduct]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    try {
      // Use special endpoint for fetching products for stock management (hidden from normal UI)
      const data = await api.request(`/inventory/${selectedCategory}/products-for-stock`, {
        method: 'GET'
      });
      const allProducts = [];
      if (data && data.series && Array.isArray(data.series)) {
        data.series.forEach((series) => {
          if (series.products && Array.isArray(series.products)) {
            allProducts.push(...series.products);
          }
        });
      }
      setProducts(allProducts);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    }
  };

  const handleAddSerialNumber = () => {
    setSerialNumbers([...serialNumbers, '']);
  };

  const handleSerialNumberChange = (index, value) => {
    const updated = [...serialNumbers];
    updated[index] = value;
    setSerialNumbers(updated);
  };

  const handleRemoveSerialNumber = (index) => {
    if (serialNumbers.length > 1) {
      setSerialNumbers(serialNumbers.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const qty = parseInt(quantity);
    if (!quantity || isNaN(qty) || qty <= 0) {
      setError('Please enter a valid quantity greater than 0');
      return;
    }

    // Skip serial number validation for water products
    const validSerialNumbers = serialNumbers.filter(sn => sn.trim() !== '');
    
    if (selectedCategory !== 'water') {
      // CRITICAL: Quantity must exactly match serial numbers count (only for non-water products)
      if (validSerialNumbers.length === 0) {
        setError('Please add at least one serial number');
        return;
      }

      if (validSerialNumbers.length !== qty) {
        setError(`Quantity (${qty}) must exactly match the number of serial numbers (${validSerialNumbers.length}). Please add or remove serial numbers to match the quantity.`);
        return;
      }

      // Check for duplicate serial numbers
      const uniqueSerials = new Set(validSerialNumbers);
      if (uniqueSerials.size !== validSerialNumbers.length) {
        setError('Duplicate serial numbers are not allowed. Each serial number must be unique.');
        return;
      }
    }

    // Get DP (Dealer Price) from product
    const dp = parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0);
    
    // Calculate discount
    const discountPercentValue = parseFloat(discountPercent) || 0;
    const discountAmountValue = parseFloat(discountAmount) || 0;
    
    // Calculate final discount amount (prefer discount amount if provided, otherwise calculate from %)
    let finalDiscountAmount = 0;
    if (discountAmountValue > 0) {
      finalDiscountAmount = Math.min(discountAmountValue, dp); // Discount can't exceed DP
    } else if (discountPercentValue > 0) {
      finalDiscountAmount = Math.round((dp * discountPercentValue / 100) * 100) / 100;
    }
    
    // Calculate final discount percent
    const finalDiscountPercent = dp > 0 ? Math.round((finalDiscountAmount / dp) * 10000) / 100 : 0;
    
    // Purchase value = DP - Discount
    const purchaseValue = Math.round((dp - finalDiscountAmount) * 100) / 100;
    
    // Use the amount field as purchase value (user can override)
    const purchaseAmount = parseFloat(amount) || purchaseValue;
    
    if (!purchaseAmount || purchaseAmount <= 0) {
      setError('Please enter a valid purchase amount');
      return;
    }
    
    if (purchaseAmount > dp) {
      setError('Purchase amount cannot exceed DP (Dealer Price)');
      return;
    }

    setLoading(true);
    try {
      // Combine date and time for precise purchase timestamp
      const purchaseDateTime = purchaseDate
        ? `${purchaseDate}${purchaseTime ? `T${purchaseTime}` : ''}`
        : null;

      await api.addStockWithSerials(
        selectedCategory, 
        selectedProduct.id, 
        qty, 
        validSerialNumbers,
        purchaseDateTime,
        purchasedFrom.trim() || null,
        purchaseAmount,
        dp, // DP (Dealer Price)
        purchaseAmount, // Purchase value (after discount)
        finalDiscountAmount, // Discount amount
        finalDiscountPercent // Discount percent
      );
      setSuccess(`Successfully added ${qty} units of ${selectedProduct.name}${selectedCategory !== 'water' ? ` with ${validSerialNumbers.length} serial numbers` : ''}`);
      // Clear form and mark as submitted (will clear on next mount)
      setQuantity('');
      setSerialNumbers(['']);
      setPurchaseDate(getCurrentDateISO());
      setPurchaseTime(getCurrentTimeHHMM());
      setPurchasedFrom('');
      setAmount('');
      setDiscountPercent('');
      setDiscountAmount('');
      setSelectedProduct(null);
      setHasRestoredState(false);
      restoreStateRef.current = false;
      isRestoringRef.current = false;
      prevQuantityRef.current = '';
      markFormSubmitted(STORAGE_KEY);
      // Refresh products list to show updated stock
      await fetchProducts();
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-section">
      <div className="section-header">
        <h2>Add Stock</h2>
        <p>Add new inventory items to your stock</p>
      </div>

      <div className="section-content">
        <form onSubmit={handleSubmit} className="stock-form">
          {/* Category Selection */}
          <div className="form-group">
            <label>Category *</label>
            <div className={`product-category-switch ${roleClass}`}>
              <button
                type="button"
                className={`product-category-btn automotive ${selectedCategory === 'car-truck-tractor' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory('car-truck-tractor');
                  setSelectedProduct(null);
                }}
              >
                🚗 Automotive
              </button>
              <button
                type="button"
                className={`product-category-btn two-wheeler ${selectedCategory === 'bike' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory('bike');
                  setSelectedProduct(null);
                }}
              >
                🏍️ Bike Batteries
              </button>
              <button
                type="button"
                className={`product-category-btn inverter ${selectedCategory === 'ups-inverter' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory('ups-inverter');
                  setSelectedProduct(null);
                }}
              >
                ⚡ UPS Batteries
              </button>
              <button
                type="button"
                className={`product-category-btn water ${selectedCategory === 'water' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory('water');
                  setSelectedProduct(null);
                }}
              >
                💧 Water Products
              </button>
            </div>
          </div>

          {/* Product Selection */}
          <div className="form-group">
            <SearchableDropdown
              label="Product *"
              options={products.map((product) => ({
                value: product.id,
                label: product.name || 'Untitled',
                subLabel: `${product.sku || 'No SKU'} • Stock: ${product.qty || 0}`,
              }))}
              value={selectedProduct?.id || null}
              onChange={(opt) => {
                const product = products.find((p) => p.id === opt.value);
                setSelectedProduct(product || null);
                // Auto-fill amount with product DP (Dealer Price)
                if (product) {
                  const dp = parseFloat(product.dp || product.mrp_price || 0);
                  setAmount(dp > 0 ? dp.toString() : '');
                  // Reset discount fields when product changes
                  setDiscountPercent('');
                  setDiscountAmount('');
                } else {
                  setAmount('');
                  setDiscountPercent('');
                  setDiscountAmount('');
                }
              }}
              placeholder="Select a product"
              searchPlaceholder="Search by name or SKU..."
            />
          </div>

          {/* Quantity */}
          <div className="form-group">
            <label>Quantity *</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              className="form-input"
              placeholder="Enter quantity"
            />
            <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
              {selectedCategory === 'water' 
                ? 'Enter the quantity of water products to add.' 
                : 'The number of serial numbers must exactly match the quantity entered.'}
            </small>
          </div>

          {/* Purchase Date & Time */}
          <div className="form-group">
            <label>Purchase Date & Time *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                className="form-input"
              />
              <input
                type="time"
                value={purchaseTime}
                onChange={(e) => setPurchaseTime(e.target.value)}
                required
                className="form-input"
              />
            </div>
          </div>

          {/* Purchased From */}
          <div className="form-group">
            <label>Purchased From (Supplier/Vendor)</label>
            <input
              type="text"
              value={purchasedFrom}
              onChange={(e) => setPurchasedFrom(e.target.value)}
              className="form-input"
              placeholder="Enter supplier or vendor name"
            />
            <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
              Optional: Enter the name of the supplier or vendor from whom you purchased this stock.
            </small>
          </div>

          {/* DP (Dealer Price) Display */}
          {selectedProduct && (
            <div className="form-group">
              <label>DP (Dealer Price)</label>
              <input
                type="number"
                value={parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0).toFixed(2)}
                disabled
                className="form-input"
                style={{ background: '#f1f5f9', cursor: 'not-allowed' }}
              />
              <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                This is the dealer price for this product. Discount will be calculated on this amount.
              </small>
            </div>
          )}

          {/* Discount Fields */}
          {selectedProduct && (
            <>
              <div className="form-group">
                <label>Discount on DP (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={discountPercent}
                  onChange={(e) => {
                    const percent = e.target.value;
                    setDiscountPercent(percent);
                    // Calculate discount amount from percentage
                    if (percent && selectedProduct) {
                      const dp = parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0);
                      const discountAmt = Math.round((dp * parseFloat(percent) / 100) * 100) / 100;
                      setDiscountAmount(discountAmt.toString());
                      // Update purchase amount
                      const purchaseValue = Math.round((dp - discountAmt) * 100) / 100;
                      setAmount(purchaseValue.toString());
                    } else {
                      setDiscountAmount('');
                      const dp = parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0);
                      setAmount(dp.toString());
                    }
                  }}
                  className="form-input"
                  placeholder="Enter discount percentage"
                />
                <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                  Optional: Enter discount percentage you received on DP.
                </small>
              </div>

              <div className="form-group">
                <label>Discount on DP (Amount ₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => {
                    const amt = e.target.value;
                    setDiscountAmount(amt);
                    // Calculate discount percentage from amount
                    if (amt && selectedProduct) {
                      const dp = parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0);
                      const discountPct = dp > 0 ? Math.round((parseFloat(amt) / dp) * 10000) / 100 : 0;
                      setDiscountPercent(discountPct.toString());
                      // Update purchase amount
                      const purchaseValue = Math.round((dp - parseFloat(amt)) * 100) / 100;
                      setAmount(purchaseValue.toString());
                    } else {
                      setDiscountPercent('');
                      const dp = parseFloat(selectedProduct?.dp || selectedProduct?.mrp_price || 0);
                      setAmount(dp.toString());
                    }
                  }}
                  className="form-input"
                  placeholder="Enter discount amount"
                />
                <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                  Optional: Enter discount amount you received on DP. This will auto-calculate the percentage.
                </small>
              </div>
            </>
          )}

          {/* Purchase Amount (Final) */}
          <div className="form-group">
            <label>Purchase Amount (per unit) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="form-input"
              placeholder="Enter purchase amount per unit"
              style={{ fontWeight: 600, color: '#059669' }}
            />
            <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
              {selectedProduct ? (
                <>
                  Final purchase price per unit (DP - Discount). Defaults to DP if no discount is entered.
                  {discountAmount && parseFloat(discountAmount) > 0 && (
                    <span style={{ display: 'block', marginTop: '0.25rem', color: '#10b981', fontWeight: 500 }}>
                      ✓ Discount: ₹{parseFloat(discountAmount).toFixed(2)} ({parseFloat(discountPercent || 0).toFixed(2)}%)
                    </span>
                  )}
                </>
              ) : (
                'Enter the purchase price per unit. Select a product first to auto-fill DP.'
              )}
            </small>
          </div>

          {/* Serial Numbers - Hidden for water products */}
          {selectedCategory !== 'water' && (
            <div className="form-group">
              <label>Serial Numbers * ({serialNumbers.filter(sn => sn.trim() !== '').length} of {quantity || 0})</label>
              <div className="serial-numbers-container">
                {serialNumbers.map((serial, index) => (
                  <div key={index} className="serial-number-input-group">
                    <input
                      type="text"
                      value={serial}
                      onChange={(e) => handleSerialNumberChange(index, e.target.value)}
                      className="form-input"
                      placeholder={`Serial Number ${index + 1} *`}
                      required
                    />
                  </div>
                ))}
              </div>
              <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                {quantity ? (
                  serialNumbers.filter(sn => sn.trim() !== '').length === parseInt(quantity) ? (
                    <span style={{ color: '#10b981' }}>✓ All {quantity} serial numbers entered</span>
                  ) : (
                    <span style={{ color: '#ef4444' }}>
                      ⚠ Enter {parseInt(quantity) - serialNumbers.filter(sn => sn.trim() !== '').length} more serial number(s) to match quantity
                    </span>
                  )
                ) : (
                  'Enter quantity first to add serial number fields'
                )}
              </small>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStock;

