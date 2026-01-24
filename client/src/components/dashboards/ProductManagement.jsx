import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import api, { setAuthToken } from '../../api';
import SearchableDropdown from '../common/SearchableDropdown';
import QRScanner from '../common/QRScanner';
import { useAuth } from '../../contexts/AuthContext';
import { getFormState, saveFormState, markFormSubmitted } from '../../utils/formStateManager';
import './InventoryManagement.css';

const STORAGE_KEY = 'productManagementState';

const ProductManagement = () => {
  const { user, token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('car-truck-tractor');
  const [inventoryData, setInventoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedSeries, setExpandedSeries] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [seriesFilter, setSeriesFilter] = useState('all'); // 'all' or specific series name
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [editingProduct, setEditingProduct] = useState(null); // { productId: { customerType: 'b2b'|'b2c', mrp, sellingPrice, discountPercent, discountValue } }
  const [savingProduct, setSavingProduct] = useState(null); // productId that is currently being saved
  const [applyToAllProducts, setApplyToAllProducts] = useState(false); // Checkbox state for bulk update
  
  // Load saved state using utility (automatically handles refresh detection)
  const initialSavedState = React.useMemo(() => getFormState(STORAGE_KEY), []);
  const [showAddProductModal, setShowAddProductModal] = useState(initialSavedState?.showAddProductModal || false);
  
  // Ensure token is set in api.js whenever it changes
  useEffect(() => {
    if (token) {
      setAuthToken(token);
    } else {
      // Try to get from localStorage as fallback
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        setAuthToken(storedToken);
      }
    }
  }, [token]);
  
  const [newProduct, setNewProduct] = useState(initialSavedState?.newProduct || {
    sku: '',
    name: '',
    series: '',
    // Single MRP for both B2C and B2B
    mrp: '',
    // B2C Pricing
    b2c_sellingPrice: '',
    b2c_discountPercent: '0',
    b2c_discountAmount: '0',
    // B2B Pricing
    b2b_sellingPrice: '',
    b2b_discountPercent: '0',
    b2b_discountAmount: '0',
    ah_va: '',
    warranty: '',
    qty: '0',
    purchase_date: new Date().toISOString().split('T')[0],
    purchased_from: '',
    serial_numbers: []
  });
  const [creatingProduct, setCreatingProduct] = useState(false);

  // QR Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanningIndex, setScanningIndex] = useState(null);
  const serialInputRefs = useRef({});

  // Determine role class for styling
  const roleClass = user?.role_id === 1 ? 'super-admin' : user?.role_id === 2 ? 'admin' : '';

  const categories = [
    {
      id: 'car-truck-tractor',
      name: 'Automotive',
      color: '#1e293b'
    },
    {
      id: 'bike',
      name: 'two wheeler',
      color: '#1e293b'
    },
    {
      id: 'ups-inverter',
      name: 'inverter & battery',
      color: '#1e293b'
    },
    {
      id: 'water',
      name: 'Water Products',
      color: '#1e293b'
    }
  ];

  useEffect(() => {
    fetchProducts();
    setSeriesFilter('all'); // Reset series filter when category changes
  }, [selectedCategory]);

  // Prevent body scroll when modal is open
  useLayoutEffect(() => {
    if (showAddProductModal) {
      // Store original body styles and scroll position
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      const scrollY = window.scrollY;
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore original body styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [showAddProductModal]);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch products from inventory endpoint (products are now visible again)
      const data = await api.getInventory(selectedCategory);
      setInventoryData(data);

      // Auto-expand first series
      if (data.series && data.series.length > 0) {
        setExpandedSeries({ [data.series[0].seriesName]: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to load products');
      setInventoryData(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeries = (seriesName) => {
    setExpandedSeries(prev => ({
      ...prev,
      [seriesName]: !prev[seriesName]
    }));
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortProducts = (products) => {
    if (!sortConfig.key) return products;

    return [...products].sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'sku':
          aVal = (a.sku || '').toLowerCase();
          bVal = (b.sku || '').toLowerCase();
          break;
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'mrp':
          aVal = parseFloat(a.mrp_price || a.mrp || 0);
          bVal = parseFloat(b.mrp_price || b.mrp || 0);
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filterProducts = (products) => {
    let filtered = products;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name?.toLowerCase().includes(term) ||
        p.sku?.toLowerCase().includes(term) ||
        p.series?.toLowerCase().includes(term) ||
        p.ah_va?.toLowerCase().includes(term)
      );
    }

    // Sort
    return sortProducts(filtered);
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Handle pricing field changes
  const handlePricingChange = (productId, field, value, customerType = 'b2c') => {
    setEditingProduct(prev => {
      const current = prev?.[productId] || {};
      const product = inventoryData?.series
        ?.flatMap(s => s.products)
        .find(p => p.id === productId);
      
      if (!product) return prev;

      // Get current values based on customer type
      const isB2B = customerType === 'b2b';
      const currentMrp = parseFloat(current.mrp ?? product.mrp_price ?? product.mrp ?? 0);
      const currentDiscountPercent = parseFloat(
        isB2B 
          ? (current.b2b_discountPercent ?? product.b2b_discount_percent ?? 0)
          : (current.discountPercent ?? product.discount_percent ?? 0)
      );
      const currentDiscountValue = parseFloat(
        isB2B
          ? (current.b2b_discountValue ?? product.b2b_discount ?? 0)
          : (current.discountValue ?? product.discount ?? 0)
      );
      const currentSellingPrice = parseFloat(
        isB2B
          ? (current.b2b_sellingPrice ?? product.b2b_selling_price ?? product.selling_price ?? 0)
          : (current.sellingPrice ?? product.selling_price ?? product.price ?? 0)
      );

      let newMrp = currentMrp;
      let newSellingPrice = currentSellingPrice;
      let newDiscountPercent = currentDiscountPercent;
      let newDiscountValue = currentDiscountValue;

      const numValue = parseFloat(value) || 0;

      if (field === 'mrp') {
        newMrp = numValue;
        // Recalculate selling price and discount based on existing discount %
        if (newDiscountPercent > 0) {
          newSellingPrice = Math.round(newMrp * (1 - newDiscountPercent / 100) * 100) / 100;
          newDiscountValue = Math.round((newMrp - newSellingPrice) * 100) / 100;
        } else {
          // If no discount, selling price = MRP
          newSellingPrice = newMrp;
          newDiscountValue = 0;
        }
      } else if (field === 'discountPercent') {
        // User changed discount percentage
        newDiscountPercent = Math.min(100, Math.max(0, numValue)); // Clamp between 0-100
        // Recalculate selling price and discount value from percentage
        newSellingPrice = Math.round(newMrp * (1 - newDiscountPercent / 100) * 100) / 100;
        newDiscountValue = Math.round((newMrp - newSellingPrice) * 100) / 100;
      } else if (field === 'discountValue') {
        // User changed discount amount
        newDiscountValue = Math.min(newMrp, Math.max(0, numValue)); // Clamp between 0 and MRP
        // Recalculate discount percentage and selling price from discount amount
        newDiscountPercent = newMrp > 0 ? Math.round((newDiscountValue / newMrp) * 10000) / 100 : 0;
        newSellingPrice = Math.round((newMrp - newDiscountValue) * 100) / 100;
      }

      // Update the appropriate fields based on customer type
      if (isB2B) {
        return {
          ...prev,
          [productId]: {
            ...current,
            customerType: 'b2b',
            mrp: newMrp,
            b2b_sellingPrice: newSellingPrice,
            b2b_discountPercent: newDiscountPercent,
            b2b_discountValue: newDiscountValue
          }
        };
      } else {
        return {
          ...prev,
          [productId]: {
            ...current,
            customerType: 'b2c',
            mrp: newMrp,
            sellingPrice: newSellingPrice,
            discountPercent: newDiscountPercent,
            discountValue: newDiscountValue
          }
        };
      }
    });
  };

  // Save pricing changes to database
  const handleSavePricing = async (productId) => {
    const edited = editingProduct?.[productId];
    if (!edited) return;

    const customerType = edited.customerType || 'b2c';
    const isB2B = customerType === 'b2b';

    setSavingProduct(productId);
    try {
      // If "Apply to all products" is checked, use bulk update endpoint
      if (applyToAllProducts) {
        const discountPercent = isB2B ? edited.b2b_discountPercent : edited.discountPercent;
        
        if (discountPercent === undefined || discountPercent === null) {
          setError('Discount percentage is required for bulk update');
          setTimeout(() => setError(''), 5000);
          setSavingProduct(null);
          return;
        }

        const result = await api.updateCategoryDiscount(selectedCategory, discountPercent, customerType);
        
        setSuccess(`Successfully updated discount for ${result.updated_count} products in this category`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        // Single product update
        await api.updateProductPricing(selectedCategory, productId, {
          mrp_price: edited.mrp,
          selling_price: isB2B ? edited.b2b_sellingPrice : edited.sellingPrice,
          discount_percent: isB2B ? edited.b2b_discountPercent : edited.discountPercent,
          discount: isB2B ? edited.b2b_discountValue : edited.discountValue,
          dp: edited.dp !== undefined ? edited.dp : undefined, // Include DP if edited
          customer_type: customerType
        });
      }

      // Refresh products to get updated data
      await fetchProducts();
      setEditingProduct(prev => {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      });
      setApplyToAllProducts(false); // Reset checkbox
    } catch (err) {
      setError(err.message || 'Failed to save pricing changes');
      setTimeout(() => setError(''), 5000);
    } finally {
      setSavingProduct(null);
    }
  };

  // Cancel editing
  const handleCancelEditing = (productId) => {
    setEditingProduct(prev => {
      const updated = { ...prev };
      delete updated[productId];
      return updated;
    });
    setApplyToAllProducts(false); // Reset checkbox when canceling
  };

  // Handle add product form submission
  const handleAddProduct = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Check if user has admin/super-admin role
    if (!user || (user.role_id !== 1 && user.role_id !== 2)) {
      setError('You do not have permission to create products. Admin or Super Admin access required.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    // Ensure token is set before making API call
    const authToken = token || localStorage.getItem('auth_token');
    if (!authToken) {
      setError('Authentication required. Please log in again.');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    // Set token in api.js
    setAuthToken(authToken);
    
    // Validate required fields
    if (!newProduct.sku || !newProduct.sku.trim()) {
      setError('SKU is required');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (!newProduct.name || !newProduct.name.trim()) {
      setError('Product Name is required');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    if (!newProduct.mrp || parseFloat(newProduct.mrp) <= 0) {
      setError('MRP is required and must be greater than 0');
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    setCreatingProduct(true);
    setError('');

    try {
      // Single MRP for both B2C and B2B
      const mrp = parseFloat(newProduct.mrp) || 0;

      // B2C Pricing - prioritize selling price if provided, otherwise calculate from discount
      const b2cSellingPriceInput = parseFloat(newProduct.b2c_sellingPrice) || 0;
      const b2cDiscountAmount = parseFloat(newProduct.b2c_discountAmount) || 0;
      const b2cDiscountPercent = parseFloat(newProduct.b2c_discountPercent) || 0;
      
      let finalB2cSellingPrice, finalB2cDiscountAmount, finalB2cDiscountPercent;
      
      if (b2cSellingPriceInput > 0 && mrp > 0) {
        // Selling price is provided - calculate discount from it
        finalB2cSellingPrice = Math.min(b2cSellingPriceInput, mrp); // Ensure selling price doesn't exceed MRP
        finalB2cDiscountAmount = Math.round((mrp - finalB2cSellingPrice) * 100) / 100;
        finalB2cDiscountPercent = mrp > 0 ? Math.round((finalB2cDiscountAmount / mrp) * 10000) / 100 : 0;
      } else {
        // Use discount to calculate selling price
        finalB2cDiscountAmount = b2cDiscountAmount > 0 
          ? Math.min(b2cDiscountAmount, mrp) // Ensure discount doesn't exceed MRP
          : (mrp * b2cDiscountPercent / 100);
        finalB2cDiscountPercent = mrp > 0 
          ? Math.round((finalB2cDiscountAmount / mrp) * 10000) / 100 
          : b2cDiscountPercent;
        finalB2cSellingPrice = Math.round((mrp - finalB2cDiscountAmount) * 100) / 100;
      }

      // B2B Pricing - prioritize selling price if provided, otherwise calculate from discount
      const b2bSellingPriceInput = parseFloat(newProduct.b2b_sellingPrice) || 0;
      const b2bDiscountAmount = parseFloat(newProduct.b2b_discountAmount) || 0;
      const b2bDiscountPercent = parseFloat(newProduct.b2b_discountPercent) || 0;
      
      let finalB2bSellingPrice, finalB2bDiscountAmount, finalB2bDiscountPercent;
      
      if (b2bSellingPriceInput > 0 && mrp > 0) {
        // Selling price is provided - calculate discount from it
        finalB2bSellingPrice = Math.min(b2bSellingPriceInput, mrp); // Ensure selling price doesn't exceed MRP
        finalB2bDiscountAmount = Math.round((mrp - finalB2bSellingPrice) * 100) / 100;
        finalB2bDiscountPercent = mrp > 0 ? Math.round((finalB2bDiscountAmount / mrp) * 10000) / 100 : 0;
      } else {
        // Use discount to calculate selling price
        finalB2bDiscountAmount = b2bDiscountAmount > 0 
          ? Math.min(b2bDiscountAmount, mrp) // Ensure discount doesn't exceed MRP
          : (mrp * b2bDiscountPercent / 100);
        finalB2bDiscountPercent = mrp > 0 
          ? Math.round((finalB2bDiscountAmount / mrp) * 10000) / 100 
          : b2bDiscountPercent;
        finalB2bSellingPrice = Math.round((mrp - finalB2bDiscountAmount) * 100) / 100;
      }

      const qty = parseInt(newProduct.qty) || 0;

      // Get DP (Dealer Price)
      const dp = parseFloat(newProduct.dp) || mrp;
      
      // Get purchase value and discount (for when adding stock)
      const purchaseValue = qty > 0 && newProduct.purchase_value 
        ? parseFloat(newProduct.purchase_value) 
        : dp;
      const purchaseDiscountAmount = qty > 0 && newProduct.purchase_discount_amount
        ? parseFloat(newProduct.purchase_discount_amount)
        : 0;
      const purchaseDiscountPercent = qty > 0 && newProduct.purchase_discount_percent
        ? parseFloat(newProduct.purchase_discount_percent)
        : 0;

      const productData = {
        sku: newProduct.sku.trim(),
        name: newProduct.name.trim(),
        series: newProduct.series.trim() || null,
        category: selectedCategory,
        // DP (Dealer Price)
        dp: dp,
        // Single MRP
        mrp: mrp,
        // B2C Pricing
        selling_price: finalB2cSellingPrice,
        discount_percent: finalB2cDiscountPercent,
        discount: finalB2cDiscountAmount,
        // B2B Pricing
        b2b_selling_price: finalB2bSellingPrice,
        b2b_discount_percent: finalB2bDiscountPercent,
        b2b_discount: finalB2bDiscountAmount,
        ah_va: newProduct.ah_va.trim() || null,
        warranty: newProduct.warranty.trim() || null,
        qty: qty,
        purchase_date: qty > 0 ? newProduct.purchase_date : null,
        purchased_from: qty > 0 ? (newProduct.purchased_from.trim() || null) : null,
        serial_numbers: qty > 0 && Array.isArray(newProduct.serial_numbers) && newProduct.serial_numbers.length === qty 
          ? newProduct.serial_numbers.filter(sn => sn.trim() !== '')
          : [],
        // Purchase fields (for stock creation)
        purchase_value: qty > 0 ? purchaseValue : null,
        purchase_discount_amount: qty > 0 ? purchaseDiscountAmount : null,
        purchase_discount_percent: qty > 0 ? purchaseDiscountPercent : null
      };

console.log('Creating product with data:', productData);
console.log('User role:', user?.role_id, 'Token exists:', !!authToken);

await api.createProduct(productData);

// Close modal first
setShowAddProductModal(false);

// Mark form as submitted (will clear on next mount)
markFormSubmitted(STORAGE_KEY);

// Reset form
setNewProduct({
  sku: '',
  name: '',
  series: '',
  mrp: '',
  b2c_sellingPrice: '',
  b2c_discountPercent: '0',
  b2c_discountAmount: '0',
  b2b_sellingPrice: '',
  b2b_discountPercent: '0',
  b2b_discountAmount: '0',
  ah_va: '',
  warranty: '',
  qty: '0',
  purchase_date: new Date().toISOString().split('T')[0],
  purchased_from: '',
  serial_numbers: []
});

// Refresh products list
await fetchProducts();

      
      // Show success message
      setError('');
      setSuccess('Product created successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating product:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data
      });
      
      // Provide more specific error messages
      if (err.response?.status === 403) {
        setError('Access denied. You need Admin or Super Admin privileges to create products. Please check your account permissions or log in again.');
      } else if (err.response?.status === 401) {
        setError('Authentication failed. Please log out and log in again.');
      } else {
        setError(err.message || 'Failed to create product. Please try again.');
      }
      setTimeout(() => setError(''), 8000);
    } finally {
      setCreatingProduct(false);
    }
  };

  // Find first empty field index
  const findFirstEmptyField = () => {
    const serials = newProduct.serial_numbers || [];
    for (let i = 0; i < serials.length; i++) {
      if (!serials[i] || serials[i].trim() === '') {
        return i;
      }
    }
    return null; // All fields filled
  };

  const handleScanClick = () => {
    // Find first empty field or start from beginning
    const firstEmpty = findFirstEmptyField();
    if (firstEmpty !== null) {
      setScanningIndex(firstEmpty);
      setIsScannerOpen(true);
    } else {
      // All filled, start from first field
      setScanningIndex(0);
      setIsScannerOpen(true);
    }
  };

  const handleScanSuccess = (scannedText) => {
    if (scanningIndex !== null && newProduct.serial_numbers && scanningIndex < newProduct.serial_numbers.length) {
      // Update the serial number at the current scanning index
      const updated = [...(newProduct.serial_numbers || [])];
      updated[scanningIndex] = scannedText.trim();
      setNewProduct({ ...newProduct, serial_numbers: updated });
      
      // Find next empty field based on UPDATED array
      let nextIndex = scanningIndex + 1;
      
      // Skip filled fields and find next empty one
      while (nextIndex < updated.length && updated[nextIndex] && updated[nextIndex].trim() !== '') {
        nextIndex++;
      }
      
      // Update scanningIndex to next field
      if (nextIndex < updated.length) {
        setScanningIndex(nextIndex);
        
        // Focus and scroll to the next input field (important for mobile)
        setTimeout(() => {
          const nextInput = serialInputRefs.current[nextIndex];
          if (nextInput) {
            // Scroll into view first (important for mobile)
            nextInput.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
            
            // Then focus after a small delay
            setTimeout(() => {
              nextInput.focus();
              // For mobile, also try click to ensure focus
              if (nextInput.click) {
                nextInput.click();
              }
            }, 300);
          }
        }, 200);
      } else {
        // All fields filled, close scanner
        setTimeout(() => {
          setIsScannerOpen(false);
          setScanningIndex(null);
        }, 500);
      }
    }
  };

  const handleNextField = () => {
    // This callback is called by QRScanner after scan success
    // The actual logic is handled in handleScanSuccess above
  };

  const handleScanClose = () => {
    setIsScannerOpen(false);
    setScanningIndex(null);
  };

  return (
    <div className="inventory-management">
      <div className="inventory-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Product Management</h2>
          <p className="inventory-subtitle">View all products and their details</p>
        </div>
        <button
          onClick={() => setShowAddProductModal(true)}
          className="add-product-btn"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#059669';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#10b981';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
          }}
        >
          <span>➕</span>
          <span>Add Product</span>
        </button>
      </div>

      {/* Category Tabs */}
      <div className={`product-category-switch ${roleClass}`}>
        <button
          className={`product-category-btn automotive ${selectedCategory === 'car-truck-tractor' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('car-truck-tractor')}
        >
          🚗 Automotive
        </button>
        <button
          className={`product-category-btn two-wheeler ${selectedCategory === 'bike' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('bike')}
        >
          🏍️ Two Wheeler
        </button>
        <button
          className={`product-category-btn inverter ${selectedCategory === 'ups-inverter' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('ups-inverter')}
        >
          🔋 Inverter & Battery
        </button>
        <button
          className={`product-category-btn water ${selectedCategory === 'water' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('water')}
        >
          💧 Water Products
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="inventory-loading">
          <div className="loading-spinner"></div>
          <p>Loading products...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="inventory-error">
          <p>{error}</p>
          <button onClick={fetchProducts} className="retry-button">Retry</button>
        </div>
      )}

      {/* Success State */}
      {success && (
        <div style={{
          padding: '1rem',
          background: '#d1fae5',
          border: '1px solid #10b981',
          borderRadius: '0.5rem',
          color: '#065f46',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <p style={{ margin: 0, fontWeight: 500 }}>{success}</p>
          <button
            onClick={() => setSuccess('')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#065f46',
              cursor: 'pointer',
              fontSize: '1.25rem',
              padding: '0 0.5rem'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Products Content */}
      {!loading && !error && inventoryData && (
        <div className="inventory-content">
          {/* Metrics strip (Products only - no stock info) */}
          <div className="metric-grid">
            <div className="metric-card">
              <div>
                <p className="metric-label">Series Count</p>
                <p className="metric-value">{inventoryData.series?.length || 0} series</p>
              </div>
            </div>
            <div className="metric-card">
              <div>
                <p className="metric-label">Total Products</p>
                <p className="metric-value">
                  {inventoryData.series?.reduce((sum, s) => sum + (s.products?.length || 0), 0) || 0} products
                </p>
              </div>
            </div>
          </div>

          {/* Series Sections */}
          {inventoryData.series && inventoryData.series.length > 0 ? (
            <div className="series-sections">
              {/* Search and Filter Controls - Right before tables */}
              <div className="product-search-filter-container" style={{ 
                marginBottom: '1.5rem', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                background: 'transparent',
                border: 'none',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '1rem',
                flexWrap: 'nowrap',
                width: '100%',
                overflow: 'hidden'
              }}>
                <input
                  type="text"
                  placeholder="Search products by name, SKU, series, or Ah/VA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="product-search-input"
                />
                <select
                  value={seriesFilter}
                  onChange={(e) => setSeriesFilter(e.target.value)}
                  className="product-filter-select"
                >
                  <option value="all">All Series</option>
                  {inventoryData.series && inventoryData.series.map((series) => (
                    <option key={series.seriesName} value={series.seriesName}>
                      {series.seriesName}
                    </option>
                  ))}
                </select>
              </div>

              {inventoryData.series
                .filter((series) => seriesFilter === 'all' || series.seriesName === seriesFilter)
                .map((series) => {
                // Filter products for this series
                const filteredSeriesProducts = filterProducts(series.products);
                if (filteredSeriesProducts.length === 0 && (searchTerm || seriesFilter !== 'all')) {
                  return null; // Don't show series with no matching products
                }

                return (
                  <div key={series.seriesName} className="series-section">
                    <div 
                      className="series-header"
                      onClick={() => toggleSeries(series.seriesName)}
                    >
                      <div className="series-header-left">
                        <button className="series-toggle">
                          {expandedSeries[series.seriesName] ? '▼' : '▶'}
                        </button>
                        <h3 className="series-title">{series.seriesName}</h3>
                        <span className="series-badge">
                          {filteredSeriesProducts.length} {filteredSeriesProducts.length === 1 ? 'product' : 'products'}
                          {filteredSeriesProducts.length !== series.products.length && (
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                              (of {series.products.length} total)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {expandedSeries[series.seriesName] && (
                      <div className="products-table-container">
                        <table className="products-table" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '250px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '120px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '130px' }} />
                          <col style={{ width: '220px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="sortable" onClick={() => handleSort('sku')}>
                              SKU
                            </th>
                            <th className="sortable" onClick={() => handleSort('name')}>
                              NAME
                            </th>
                            <th>Ah/VA</th>
                            <th>Warranty</th>
                            <th className="sortable" onClick={() => handleSort('mrp')}>
                              MRP
                            </th>
                            <th className="sortable" onClick={() => handleSort('dp')}>
                              DP
                            </th>
                            <th>B2C Selling</th>
                            <th>B2C Discount</th>
                            <th>B2B Selling</th>
                            <th>B2B Discount</th>
                            <th>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSeriesProducts.map((product) => {
                            const isEditing = editingProduct?.[product.id];
                            const isSaving = savingProduct === product.id;
                            const editingCustomerType = isEditing ? (editingProduct[product.id].customerType || 'b2c') : 'b2c';
                            
                            // Get current values (edited or original)
                            const mrp = isEditing 
                              ? (editingProduct[product.id].mrp || 0)
                              : (parseFloat(product.mrp_price || product.mrp || 0) || 0);
                            
                            // Get DP (Dealer Price) - use edited value if editing
                            const dp = isEditing && editingProduct[product.id].dp !== undefined
                              ? (editingProduct[product.id].dp || 0)
                              : (parseFloat(product.dp || product.mrp_price || product.mrp || 0) || 0);
                            
                            // B2C Pricing
                            const b2cSellingPrice = isEditing && editingCustomerType === 'b2c'
                              ? (editingProduct[product.id].sellingPrice || 0)
                              : (parseFloat(product.selling_price || product.price || 0) || 0);
                            const b2cDiscountPercent = isEditing && editingCustomerType === 'b2c'
                              ? (editingProduct[product.id].discountPercent || 0)
                              : (product.discount_percent !== undefined && product.discount_percent !== null
                                  ? parseFloat(product.discount_percent) || 0
                                  : (mrp > 0 ? ((parseFloat(product.discount || 0) || 0) / mrp) * 100 : 0));
                            const b2cDiscountValue = isEditing && editingCustomerType === 'b2c'
                              ? (editingProduct[product.id].discountValue || 0)
                              : (parseFloat(product.discount || 0) || 0);
                            
                            // B2B Pricing
                            const b2bSellingPrice = isEditing && editingCustomerType === 'b2b'
                              ? (editingProduct[product.id].b2b_sellingPrice || 0)
                              : (parseFloat(product.b2b_selling_price || product.selling_price || 0) || 0);
                            
                            // Calculate B2B discount - ALWAYS calculate from b2b_selling_price, IGNORE stored discount values
                            // This ensures B2B discount is always calculated separately from B2C
                            let b2bDiscountPercent, b2bDiscountValue;
                            if (isEditing && editingCustomerType === 'b2b') {
                              b2bDiscountPercent = editingProduct[product.id].b2b_discountPercent || 0;
                              b2bDiscountValue = editingProduct[product.id].b2b_discountValue || 0;
                            } else {
                              // Get B2B selling price - MUST use b2b_selling_price if it exists
                              // Only fallback to selling_price if b2b_selling_price is truly null/undefined
                              const actualB2bSellingPrice = (product.b2b_selling_price !== undefined && product.b2b_selling_price !== null)
                                ? parseFloat(product.b2b_selling_price) || 0
                                : (parseFloat(product.selling_price) || 0);
                              
                              // ALWAYS calculate B2B discount from MRP and actual B2B selling price
                              // This ensures B2B discount reflects the actual B2B selling price, not stored discount values
                              b2bDiscountValue = mrp > 0 ? Math.max(0, Math.round((mrp - actualB2bSellingPrice) * 100) / 100) : 0;
                              b2bDiscountPercent = mrp > 0 ? Math.round((b2bDiscountValue / mrp) * 10000) / 100 : 0;
                              
                              // Debug: Log calculation for first product only
                              if (product.id === inventoryData?.series?.[0]?.products?.[0]?.id) {
                                console.log('B2B Discount Calculation:', {
                                  productId: product.id,
                                  productName: product.name,
                                  mrp,
                                  b2cSellingPrice: parseFloat(product.selling_price || 0),
                                  b2bSellingPrice: actualB2bSellingPrice,
                                  b2cDiscountValue,
                                  b2bDiscountValue,
                                  b2cDiscountPercent,
                                  b2bDiscountPercent,
                                  storedB2bDiscount: product.b2b_discount,
                                  storedB2bDiscountPercent: product.b2b_discount_percent
                                });
                              }
                              
                              // DO NOT use stored b2b_discount or b2b_discount_percent values
                              // Always calculate from b2b_selling_price to ensure accuracy
                            }

                            return (
                              <React.Fragment key={product.id}>
                                <tr>
                                  <td className="sku-cell">{product.sku || 'N/A'}</td>
                                  <td className="name-cell">{product.name || 'N/A'}</td>
                                  <td className="text-cell">{product.ah_va || 'N/A'}</td>
                                  <td className="text-cell">{product.warranty || 'N/A'}</td>
                                  <td className="price-cell">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span style={{ fontWeight: 600, color: '#059669' }}>
                                        ₹{mrp.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </span>
                                      <small style={{ fontSize: '0.65rem', color: '#64748b' }}>MRP</small>
                                    </div>
                                  </td>
                                  {/* DP (Dealer Price) */}
                                  <td className="price-cell">
                                    {isEditing ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--azb-text-muted, #64748b)', fontWeight: 500 }}>DP</label>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={dp}
                                          onChange={(e) => {
                                            const newDp = parseFloat(e.target.value) || 0;
                                            setEditingProduct(prev => ({
                                              ...prev,
                                              [product.id]: {
                                                ...prev[product.id],
                                                dp: newDp
                                              }
                                            }));
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '0.375rem',
                                            border: '1px solid #3b82f6',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.875rem',
                                            fontWeight: 600,
                                            color: '#3b82f6'
                                          }}
                                          disabled={isSaving}
                                          placeholder="Enter DP"
                                        />
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                                          ₹{dp.toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                          })}
                                        </span>
                                        <small style={{ fontSize: '0.65rem', color: '#64748b' }}>DP</small>
                                      </div>
                                    )}
                                  </td>
                                  {/* B2C Selling Price */}
                                  <td className="price-cell">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span style={{ fontWeight: 600, color: '#059669' }}>
                                        ₹{b2cSellingPrice.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </span>
                                      <small style={{ fontSize: '0.65rem', color: '#64748b' }}>B2C</small>
                                    </div>
                                  </td>
                                  {/* B2C Discount */}
                                  <td className="discount-cell">
                                    <div className="discount-edit-group">
                                      <div className="discount-value">
                                        {b2cDiscountValue > 0 ? (
                                          <span className="discount-value-amount">
                                            ₹{b2cDiscountValue.toLocaleString('en-IN', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2
                                            })}
                                          </span>
                                        ) : (
                                          <span className="discount-value-amount discount-value-muted">
                                            ₹0.00
                                          </span>
                                        )}
                                      </div>
                                      <div className="discount-percent">
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                          {Number.isFinite(b2cDiscountPercent) ? b2cDiscountPercent.toFixed(2) : '0.00'}%
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  {/* B2B Selling Price */}
                                  <td className="price-cell">
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                      <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                                        ₹{b2bSellingPrice.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </span>
                                      <small style={{ fontSize: '0.65rem', color: '#64748b' }}>B2B</small>
                                    </div>
                                  </td>
                                  {/* B2B Discount */}
                                  <td className="discount-cell">
                                    <div className="discount-edit-group">
                                      <div className="discount-value">
                                        {b2bDiscountValue > 0 ? (
                                          <span className="discount-value-amount" style={{ background: '#fef3c7' }}>
                                            ₹{b2bDiscountValue.toLocaleString('en-IN', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2
                                            })}
                                          </span>
                                        ) : (
                                          <span className="discount-value-amount discount-value-muted">
                                            ₹0.00
                                          </span>
                                        )}
                                      </div>
                                      <div className="discount-percent">
                                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                          {Number.isFinite(b2bDiscountPercent) ? b2bDiscountPercent.toFixed(2) : '0.00'}%
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  {/* Edit Column */}
                                  <td className="price-cell">
                                    {isEditing ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '200px' }}>
                                        {/* Customer Type Selector */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--azb-text-muted, #64748b)', fontWeight: 500 }}>Edit For</label>
                                          <select
                                            value={editingCustomerType}
                                            onChange={(e) => {
                                              const newType = e.target.value;
                                              
                                              if (newType === 'b2b') {
                                                setEditingProduct(prev => ({
                                                  ...prev,
                                                  [product.id]: {
                                                    ...prev[product.id],
                                                    customerType: 'b2b',
                                                    mrp: mrp,
                                                    b2b_sellingPrice: b2bSellingPrice,
                                                    b2b_discountPercent: b2bDiscountPercent,
                                                    b2b_discountValue: b2bDiscountValue
                                                  }
                                                }));
                                              } else {
                                                setEditingProduct(prev => ({
                                                  ...prev,
                                                  [product.id]: {
                                                    ...prev[product.id],
                                                    customerType: 'b2c',
                                                    mrp: mrp,
                                                    sellingPrice: b2cSellingPrice,
                                                    discountPercent: b2cDiscountPercent,
                                                    discountValue: b2cDiscountValue
                                                  }
                                                }));
                                              }
                                            }}
                                            style={{
                                              width: '100%',
                                              padding: '0.375rem',
                                              border: '1px solid var(--azb-accent, #3b82f6)',
                                              borderRadius: '0.25rem',
                                              fontSize: '0.875rem',
                                              fontWeight: 600
                                            }}
                                            disabled={isSaving}
                                          >
                                            <option value="b2c">B2C (Regular Customers)</option>
                                            <option value="b2b">B2B (Wholesale Customers)</option>
                                          </select>
                                        </div>
                                        
                                        {/* MRP Field */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--azb-text-muted, #64748b)', fontWeight: 500 }}>MRP</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={mrp}
                                            onChange={(e) => handlePricingChange(product.id, 'mrp', e.target.value, editingCustomerType)}
                                            style={{
                                              width: '100%',
                                              padding: '0.375rem',
                                              border: '1px solid var(--azb-accent, #3b82f6)',
                                              borderRadius: '0.25rem',
                                              fontSize: '0.875rem',
                                              fontWeight: 600,
                                              opacity: applyToAllProducts ? 0.6 : 1,
                                              cursor: applyToAllProducts ? 'not-allowed' : 'text'
                                            }}
                                            disabled={isSaving || applyToAllProducts}
                                            placeholder="Enter MRP"
                                          />
                                          {applyToAllProducts && (
                                            <small style={{ fontSize: '0.7rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                              MRP will not be changed when applying to all products
                                            </small>
                                          )}
                                        </div>
                                        
                                        {/* Discount Fields */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--azb-text-muted, #64748b)', fontWeight: 500 }}>Discount %</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={editingCustomerType === 'b2b' ? b2bDiscountPercent : b2cDiscountPercent}
                                            onChange={(e) => handlePricingChange(product.id, 'discountPercent', e.target.value, editingCustomerType)}
                                            placeholder="Enter discount %"
                                            style={{
                                              width: '100%',
                                              padding: '0.375rem',
                                              border: '1px solid #f59e0b',
                                              borderRadius: '0.25rem',
                                              fontSize: '0.875rem',
                                              fontWeight: 600
                                            }}
                                            disabled={isSaving}
                                          />
                                          {/* Apply to all products checkbox */}
                                          <label style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '0.5rem', 
                                            fontSize: '0.75rem', 
                                            color: 'var(--azb-text-muted)', 
                                            cursor: 'pointer',
                                            marginTop: '0.25rem'
                                          }}>
                                            <input
                                              type="checkbox"
                                              checked={applyToAllProducts}
                                              onChange={(e) => setApplyToAllProducts(e.target.checked)}
                                              disabled={isSaving}
                                              style={{
                                                cursor: 'pointer',
                                                width: '16px',
                                                height: '16px'
                                              }}
                                            />
                                            <span>Apply discount % to all products in this category</span>
                                          </label>
                                          {applyToAllProducts && (
                                            <small style={{ 
                                              fontSize: '0.7rem', 
                                              color: '#f59e0b', 
                                              fontStyle: 'italic',
                                              marginTop: '-0.25rem'
                                            }}>
                                              Note: Only discount % will be updated. MRP will remain unchanged for each product.
                                            </small>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                          <label style={{ fontSize: '0.75rem', color: 'var(--azb-text-muted, #64748b)', fontWeight: 500 }}>Discount Amount (₹)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={mrp}
                                            value={editingCustomerType === 'b2b' ? b2bDiscountValue : b2cDiscountValue}
                                            onChange={(e) => handlePricingChange(product.id, 'discountValue', e.target.value, editingCustomerType)}
                                            placeholder="Enter discount amount"
                                            style={{
                                              width: '100%',
                                              padding: '0.375rem',
                                              border: '1px solid #f59e0b',
                                              borderRadius: '0.25rem',
                                              fontSize: '0.875rem',
                                              fontWeight: 600,
                                              opacity: applyToAllProducts ? 0.6 : 1,
                                              cursor: applyToAllProducts ? 'not-allowed' : 'text'
                                            }}
                                            disabled={isSaving || applyToAllProducts}
                                          />
                                          {applyToAllProducts && (
                                            <small style={{ fontSize: '0.7rem', color: '#f59e0b', fontStyle: 'italic' }}>
                                              Discount amount will be calculated automatically for each product based on its MRP
                                            </small>
                                          )}
                                        </div>
                                        
                                        {/* Action Buttons */}
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                          <button
                                            onClick={() => handleSavePricing(product.id)}
                                            disabled={isSaving}
                                            className="product-edit-btn product-edit-btn-save"
                                            style={{ flex: 1 }}
                                          >
                                            {isSaving ? 'Saving...' : '✓ Save'}
                                          </button>
                                          <button
                                            onClick={() => handleCancelEditing(product.id)}
                                            disabled={isSaving}
                                            className="product-edit-btn product-edit-btn-cancel"
                                            style={{ flex: 1 }}
                                          >
                                            ✕ Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <button
                                          onClick={() => setEditingProduct(prev => ({
                                            ...prev,
                                            [product.id]: {
                                              customerType: 'b2c',
                                              mrp: mrp,
                                              dp: dp,
                                              sellingPrice: b2cSellingPrice,
                                              discountPercent: b2cDiscountPercent,
                                              discountValue: b2cDiscountValue
                                            }
                                          }))}
                                          className="product-edit-btn product-edit-btn-edit"
                                          style={{ fontSize: '0.75rem', padding: '0.5rem' }}
                                        >
                                          Edit B2C
                                        </button>
                                        <button
                                          onClick={() => setEditingProduct(prev => ({
                                            ...prev,
                                            [product.id]: {
                                              customerType: 'b2b',
                                              mrp: mrp,
                                              dp: dp,
                                              b2b_sellingPrice: b2bSellingPrice,
                                              b2b_discountPercent: b2bDiscountPercent,
                                              b2b_discountValue: b2bDiscountValue
                                            }
                                          }))}
                                          className="product-edit-btn product-edit-btn-edit"
                                          style={{ fontSize: '0.75rem', padding: '0.5rem', background: '#f59e0b', color: 'white' }}
                                        >
                                          Edit B2B
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-inventory">
              <h3>No Products Found</h3>
              <p>No products found in this category.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Product Modal */}
      {showAddProductModal && (
        <div 
          style={{
            position: 'fixed',
            top: '80px', // Start below navbar
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            padding: '1rem',
            overflow: 'auto'
          }}
          onClick={(e) => {
            // Close modal when clicking outside (keep form state)
            if (e.target === e.currentTarget) {
              setShowAddProductModal(false);
            }
          }}
        >
          <div 
            style={{
              background: 'var(--azb-bg-card, #ffffff)',
              borderRadius: '0.75rem',
              width: '100%',
              maxWidth: '600px',
              maxHeight: 'calc(100vh - 100px)', // Account for navbar (80px) + padding (20px)
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--azb-border-subtle, #e2e8f0)',
              color: 'var(--azb-text-main)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div style={{ 
              padding: '1.5rem 2rem',
              borderBottom: '1px solid var(--azb-border-subtle, #e2e8f0)',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--azb-text-main)', margin: 0 }}>Add New Product</h3>
              <button
                onClick={() => {
                  setShowAddProductModal(false);
                  // Don't clear form state on cancel - keep it for when user comes back
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--azb-text-muted)',
                  padding: '0.25rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div style={{
              padding: '2rem',
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: 1,
              minHeight: 0
            }}>
              <form onSubmit={handleAddProduct}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                      color: 'var(--azb-text-main)'
                    }}
                    placeholder="Enter SKU"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                      color: 'var(--azb-text-main)'
                    }}
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                    Series
                  </label>
                  <input
                    type="text"
                    value={newProduct.series}
                    onChange={(e) => setNewProduct({ ...newProduct, series: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                      color: 'var(--azb-text-main)'
                    }}
                    placeholder="Enter series (optional)"
                  />
                </div>

                {/* DP (Dealer Price) Field */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                    DP (Dealer Price) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.dp}
                    onChange={(e) => {
                      const dp = e.target.value;
                      const dpNum = parseFloat(dp) || 0;
                      
                      // If purchase_value is not set, default it to DP
                      if (!newProduct.purchase_value || newProduct.purchase_value === '') {
                        setNewProduct({ 
                          ...newProduct, 
                          dp,
                          purchase_value: dp
                        });
                      } else {
                        setNewProduct({ ...newProduct, dp });
                      }
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                      color: 'var(--azb-text-main)'
                    }}
                    placeholder="Enter DP (Dealer Price)"
                  />
                  <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    The price at which you purchase the product from the dealer
                  </small>
                </div>

                {/* Single MRP Field */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                    MRP (Maximum Retail Price) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.mrp}
                    onChange={(e) => {
                      const mrp = e.target.value;
                      const mrpNum = parseFloat(mrp) || 0;
                      
                      // Recalculate discount amounts based on percentages when MRP changes
                      const b2cDiscountPercent = parseFloat(newProduct.b2c_discountPercent) || 0;
                      const b2cDiscountAmount = mrpNum > 0 ? Math.round((mrpNum * b2cDiscountPercent / 100) * 100) / 100 : 0;
                      
                      const b2bDiscountPercent = parseFloat(newProduct.b2b_discountPercent) || 0;
                      const b2bDiscountAmount = mrpNum > 0 ? Math.round((mrpNum * b2bDiscountPercent / 100) * 100) / 100 : 0;
                      
                      setNewProduct({ 
                        ...newProduct, 
                        mrp,
                        b2c_discountAmount: b2cDiscountAmount.toString(),
                        b2b_discountAmount: b2bDiscountAmount.toString()
                      });
                    }}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                      borderRadius: '0.375rem',
                      fontSize: '0.875rem',
                      background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                      color: 'var(--azb-text-main)'
                    }}
                    placeholder="Enter MRP"
                  />
                  <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    This MRP applies to both B2C and B2B customers
                  </small>
                </div>

                {/* B2C Pricing Section */}
                <div className="b2c-pricing-section" style={{ 
                  padding: '1rem', 
                  background: 'var(--azb-bg-hover, #f8fafc)', 
                  borderRadius: '0.5rem',
                  border: '1px solid var(--azb-border-subtle, #e2e8f0)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 1rem 0', 
                    fontSize: '1rem', 
                    fontWeight: 600, 
                    color: 'var(--azb-text-main)' 
                  }}>
                    B2C Pricing (Regular Customers)
                  </h4>
                  
                  {/* B2C Selling Price Field */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      B2C Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={newProduct.mrp || 999999}
                      value={newProduct.b2c_sellingPrice}
                      onChange={(e) => {
                        const mrp = parseFloat(newProduct.mrp) || 0;
                        const sellingPrice = parseFloat(e.target.value) || 0;
                        const discountAmount = Math.max(0, Math.min(mrp - sellingPrice, mrp));
                        const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 10000) / 100 : 0;
                        setNewProduct({ 
                          ...newProduct, 
                          b2c_sellingPrice: e.target.value,
                          b2c_discountAmount: discountAmount.toString(),
                          b2c_discountPercent: discountPercent.toString()
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                      placeholder="Enter B2C selling price"
                    />
                    <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Set selling price directly - discount will be calculated automatically
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                        B2C Discount %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newProduct.b2c_discountPercent}
                        onChange={(e) => {
                          const mrp = parseFloat(newProduct.mrp) || 0;
                          const discountPercent = parseFloat(e.target.value) || 0;
                          const discountAmount = mrp > 0 ? Math.round((mrp * discountPercent / 100) * 100) / 100 : 0;
                          const sellingPrice = Math.max(0, mrp - discountAmount);
                          setNewProduct({ 
                            ...newProduct, 
                            b2c_discountPercent: e.target.value,
                            b2c_discountAmount: discountAmount.toString(),
                            b2c_sellingPrice: sellingPrice.toString()
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: 'var(--azb-bg-card, #ffffff)',
                          color: 'var(--azb-text-main)'
                        }}
                        placeholder="Enter B2C discount %"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                        B2C Discount Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={newProduct.mrp || 999999}
                        value={newProduct.b2c_discountAmount}
                        onChange={(e) => {
                          const mrp = parseFloat(newProduct.mrp) || 0;
                          const discountAmount = parseFloat(e.target.value) || 0;
                          const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 10000) / 100 : 0;
                          const sellingPrice = Math.max(0, mrp - discountAmount);
                          setNewProduct({ 
                            ...newProduct, 
                            b2c_discountAmount: e.target.value,
                            b2c_discountPercent: discountPercent.toString(),
                            b2c_sellingPrice: sellingPrice.toString()
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: 'var(--azb-bg-card, #ffffff)',
                          color: 'var(--azb-text-main)'
                        }}
                        placeholder="Enter B2C discount amount"
                      />
                    </div>
                  </div>
                  {newProduct.mrp && (
                    <div className="pricing-summary-box" style={{ 
                      marginTop: '0.75rem', 
                      padding: '0.5rem', 
                      background: 'var(--azb-bg-hover, #ecfdf5)', 
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      color: 'var(--azb-text-main)',
                      border: '1px solid var(--azb-border-subtle, rgba(6, 95, 70, 0.2))'
                    }}>
                      <strong>B2C Selling Price:</strong> ₹{(
                        parseFloat(newProduct.b2c_sellingPrice || (parseFloat(newProduct.mrp || 0) - parseFloat(newProduct.b2c_discountAmount || 0)))
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                {/* B2B Pricing Section */}
                <div className="b2b-pricing-section" style={{ 
                  padding: '1rem', 
                  background: 'var(--azb-bg-hover, #fef3c7)', 
                  borderRadius: '0.5rem',
                  border: '1px solid var(--azb-border-subtle, #fde68a)'
                }}>
                  <h4 style={{ 
                    margin: '0 0 1rem 0', 
                    fontSize: '1rem', 
                    fontWeight: 600, 
                    color: 'var(--azb-text-main)' 
                  }}>
                    B2B Pricing (Wholesale Customers)
                  </h4>
                  
                  {/* B2B Selling Price Field */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      B2B Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={newProduct.mrp || 999999}
                      value={newProduct.b2b_sellingPrice}
                      onChange={(e) => {
                        const mrp = parseFloat(newProduct.mrp) || 0;
                        const sellingPrice = parseFloat(e.target.value) || 0;
                        const discountAmount = Math.max(0, Math.min(mrp - sellingPrice, mrp));
                        const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 10000) / 100 : 0;
                        setNewProduct({ 
                          ...newProduct, 
                          b2b_sellingPrice: e.target.value,
                          b2b_discountAmount: discountAmount.toString(),
                          b2b_discountPercent: discountPercent.toString()
                        });
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                      placeholder="Enter B2B selling price"
                    />
                    <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      Set selling price directly - discount will be calculated automatically
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                        B2B Discount %
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newProduct.b2b_discountPercent}
                        onChange={(e) => {
                          const mrp = parseFloat(newProduct.mrp) || 0;
                          const discountPercent = parseFloat(e.target.value) || 0;
                          const discountAmount = mrp > 0 ? Math.round((mrp * discountPercent / 100) * 100) / 100 : 0;
                          const sellingPrice = Math.max(0, mrp - discountAmount);
                          setNewProduct({ 
                            ...newProduct, 
                            b2b_discountPercent: e.target.value,
                            b2b_discountAmount: discountAmount.toString(),
                            b2b_sellingPrice: sellingPrice.toString()
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: 'var(--azb-bg-card, #ffffff)',
                          color: 'var(--azb-text-main)'
                        }}
                        placeholder="Enter B2B discount %"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                        B2B Discount Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={newProduct.mrp || 999999}
                        value={newProduct.b2b_discountAmount}
                        onChange={(e) => {
                          const mrp = parseFloat(newProduct.mrp) || 0;
                          const discountAmount = parseFloat(e.target.value) || 0;
                          const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 10000) / 100 : 0;
                          const sellingPrice = Math.max(0, mrp - discountAmount);
                          setNewProduct({ 
                            ...newProduct, 
                            b2b_discountAmount: e.target.value,
                            b2b_discountPercent: discountPercent.toString(),
                            b2b_sellingPrice: sellingPrice.toString()
                          });
                        }}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: 'var(--azb-bg-card, #ffffff)',
                          color: 'var(--azb-text-main)'
                        }}
                        placeholder="Enter B2B discount amount"
                      />
                    </div>
                  </div>
                  {newProduct.mrp && (
                    <div className="pricing-summary-box" style={{ 
                      marginTop: '0.75rem', 
                      padding: '0.5rem', 
                      background: 'var(--azb-bg-hover, #ecfdf5)', 
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem',
                      color: 'var(--azb-text-main)',
                      border: '1px solid var(--azb-border-subtle, rgba(6, 95, 70, 0.2))'
                    }}>
                      <strong>B2B Selling Price:</strong> ₹{(
                        parseFloat(newProduct.b2b_sellingPrice || newProduct.mrp || 0)
                      ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      Ah/VA
                    </label>
                    <input
                      type="text"
                      value={newProduct.ah_va}
                      onChange={(e) => setNewProduct({ ...newProduct, ah_va: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                      placeholder="e.g., 2.5Ah"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      Warranty
                    </label>
                    <input
                      type="text"
                      value={newProduct.warranty}
                      onChange={(e) => setNewProduct({ ...newProduct, warranty: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                      placeholder="e.g., 24F+24P"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      Initial Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newProduct.qty}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        const currentSerials = newProduct.serial_numbers || [];
                        // Auto-adjust serial numbers array
                        let serials = [...currentSerials];
                        if (qty > currentSerials.length) {
                          serials = [...serials, ...Array(qty - currentSerials.length).fill('')];
                        } else if (qty < currentSerials.length) {
                          serials = serials.slice(0, qty);
                        }
                        setNewProduct({ ...newProduct, qty: e.target.value, serial_numbers: serials });
                      }}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                      placeholder="Enter initial quantity (0 if none)"
                    />
                    <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                      If quantity &gt; 0, stock entries will be created
                    </small>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                      Purchase Date
                    </label>
                    <input
                      type="date"
                      value={newProduct.purchase_date}
                      onChange={(e) => setNewProduct({ ...newProduct, purchase_date: e.target.value })}
                      disabled={parseInt(newProduct.qty) <= 0}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        opacity: parseInt(newProduct.qty) <= 0 ? 0.5 : 1,
                        background: 'var(--azb-bg-card, #ffffff)',
                        color: 'var(--azb-text-main)'
                      }}
                    />
                  </div>
                </div>

                {parseInt(newProduct.qty) > 0 && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                        Purchased From (Supplier/Vendor)
                      </label>
                      <input
                        type="text"
                        value={newProduct.purchased_from}
                        onChange={(e) => setNewProduct({ ...newProduct, purchased_from: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--azb-border-subtle, #cbd5e1)',
                          borderRadius: '0.375rem',
                          fontSize: '0.875rem',
                          background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                          color: 'var(--azb-text-main)'
                        }}
                        placeholder="Enter supplier or vendor name (optional)"
                      />
                    </div>

                    {parseInt(newProduct.qty) > 0 && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <label style={{ margin: 0, fontWeight: 500, color: 'var(--azb-text-secondary, #475569)' }}>
                            Serial Numbers ({newProduct.serial_numbers?.filter(sn => sn.trim() !== '').length || 0} of {newProduct.qty})
                          </label>
                          <button
                            type="button"
                            className="qr-scan-button"
                            onClick={handleScanClick}
                            title="Start Scanning QR Codes"
                            aria-label="Start Scanning QR Codes"
                            style={{ 
                              minWidth: 'auto',
                              padding: '0.5rem 1rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              height: 'auto'
                            }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M3 7V5C3 3.89543 3.89543 3 5 3H7M21 7V5C21 3.89543 20.1046 3 19 3H17M17 21H19C20.1046 21 21 20.1046 21 19V17M7 21H5C3.89543 21 3 20.1046 3 19V17M9 9H15V15H9V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <span>Start Scanning</span>
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', border: '1px solid var(--azb-border-subtle, #cbd5e1)', borderRadius: '0.375rem', background: 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))' }}>
                          {(newProduct.serial_numbers || []).map((serial, index) => (
                            <div 
                              key={index} 
                              style={{ 
                                display: 'flex', 
                                gap: '0.5rem', 
                                alignItems: 'center',
                                position: 'relative'
                              }}
                            >
                              {scanningIndex === index && (
                                <span style={{
                                  position: 'absolute',
                                  top: '-1.5rem',
                                  left: 0,
                                  fontSize: '0.75rem',
                                  color: '#3b82f6',
                                  fontWeight: 600,
                                  background: 'white',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  zIndex: 10,
                                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                                }}>
                                  📷 Scanning...
                                </span>
                              )}
                              <input
                                ref={(el) => (serialInputRefs.current[index] = el)}
                                type="text"
                                value={serial}
                                onChange={(e) => {
                                  const updated = [...(newProduct.serial_numbers || [])];
                                  updated[index] = e.target.value;
                                  setNewProduct({ ...newProduct, serial_numbers: updated });
                                }}
                                style={{
                                  flex: 1,
                                  padding: '0.5rem',
                                  border: scanningIndex === index 
                                    ? '2px solid #3b82f6' 
                                    : '1px solid var(--azb-border-subtle, #cbd5e1)',
                                  borderRadius: '0.25rem',
                                  fontSize: '0.875rem',
                                  background: scanningIndex === index 
                                    ? '#eff6ff' 
                                    : 'var(--azb-bg-input, var(--azb-bg-card, #ffffff))',
                                  color: 'var(--azb-text-main)',
                                  boxShadow: scanningIndex === index 
                                    ? '0 0 0 3px rgba(59, 130, 246, 0.1)' 
                                    : 'none',
                                  transition: 'border-color 0.3s, box-shadow 0.3s, background-color 0.3s'
                                }}
                                placeholder={`Serial Number ${index + 1}${parseInt(newProduct.qty) > 0 ? ' *' : ''}`}
                                readOnly={scanningIndex === index}
                              />
                            </div>
                          ))}
                        </div>
                        <small style={{ color: 'var(--azb-text-muted, #64748b)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                          {parseInt(newProduct.qty) > 0 ? (
                            (newProduct.serial_numbers?.filter(sn => sn.trim() !== '').length || 0) === parseInt(newProduct.qty) ? (
                              <span style={{ color: '#10b981' }}>✓ All serial numbers entered</span>
                            ) : (
                              <span style={{ color: '#ef4444' }}>
                                ⚠ Enter {parseInt(newProduct.qty) - (newProduct.serial_numbers?.filter(sn => sn.trim() !== '').length || 0)} more serial number(s)
                              </span>
                            )
                          ) : (
                            'Enter quantity first to add serial numbers'
                          )}
                        </small>
                      </div>
                    )}
                  </>
                )}

                <div style={{ 
                  padding: '0.75rem', 
                  background: 'var(--azb-bg-hover, #f1f5f9)', 
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  color: 'var(--azb-text-secondary)',
                  border: '1px solid var(--azb-border-subtle, rgba(148, 163, 184, 0.2))'
                }}>
                  <strong style={{ color: 'var(--azb-text-main)' }}>Category:</strong> <span style={{ color: 'var(--azb-text-secondary)' }}>{categories.find(c => c.id === selectedCategory)?.name || selectedCategory}</span>
                  <br />
                  <small style={{ color: 'var(--azb-text-muted)' }}>Product will be added to the currently selected category</small>
                </div>

              </div>
            </form>
            </div>
            
            {/* Fixed Footer with Buttons */}
            <div style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid var(--azb-border-subtle, #e2e8f0)',
              flexShrink: 0,
              display: 'flex',
              gap: '1rem',
              background: 'var(--azb-bg-card, #ffffff)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setShowAddProductModal(false);
                  // Keep form state when canceling
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'var(--azb-bg-hover, #f1f5f9)',
                  color: 'var(--azb-text-secondary)',
                  border: '1px solid var(--azb-border-subtle, #e2e8f0)',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Find the form element
                  const form = document.querySelector('form');
                  if (form) {
                    // Check form validity
                    const isValid = form.checkValidity();
                    if (!isValid) {
                      form.reportValidity();
                      return;
                    }
                  }
                  
                  // Call handleAddProduct - it's async and will handle everything
                  handleAddProduct(e).catch(err => {
                    console.error('Error in handleAddProduct:', err);
                  });
                }}
                disabled={creatingProduct}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: creatingProduct ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: creatingProduct ? 'not-allowed' : 'pointer'
                }}
              >
                {creatingProduct ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={isScannerOpen}
        onClose={handleScanClose}
        onScan={handleScanSuccess}
        onNextField={handleNextField}
        continuousMode={true}
        currentFieldIndex={scanningIndex}
        totalFields={newProduct.qty || newProduct.serial_numbers?.length || 0}
        onError={(err) => {
          setError(err.message || 'Failed to scan QR code');
          setTimeout(() => setError(''), 5000);
        }}
      />
    </div>
  );
};

export default ProductManagement;
