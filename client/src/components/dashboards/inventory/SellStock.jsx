import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE } from '../../../api';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import SearchableDropdown from '../../common/SearchableDropdown';
import MultiSelectSearchableDropdown from '../../common/MultiSelectSearchableDropdown';
import Swal from 'sweetalert2';
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

const STORAGE_KEY = 'sellStockFormState';

const SellStock = ({ onBack }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const roleClass = user?.role_id === 1 ? 'super-admin' : user?.role_id === 2 ? 'admin' : '';
  const DEFAULT_DISCOUNT_RETAIL = 12;
  const DEFAULT_DISCOUNT_B2B = 18;

  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const [activeTab, setActiveTab] = useState(() => savedState?.activeTab || 'customer');
  const [selectedCategory, setSelectedCategory] = useState(() => savedState?.selectedCategory || 'car-truck-tractor');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState(() => savedState?.selectedSerials || []);
  const [quantity, setQuantity] = useState(() => savedState?.quantity || 1);
  
  // Form fields
  const [purchaseDate, setPurchaseDate] = useState(() => savedState?.purchaseDate || getCurrentDateISO());
  const [purchaseTime, setPurchaseTime] = useState(() => savedState?.purchaseTime || getCurrentTimeHHMM());
  const [customerName, setCustomerName] = useState(() => savedState?.customerName || '');
  const [customerMobileNumber, setCustomerMobileNumber] = useState(() => savedState?.customerMobileNumber || '');
  const [customerEmail, setCustomerEmail] = useState(() => savedState?.customerEmail || '');
  const [customerVehicleNumber, setCustomerVehicleNumber] = useState(() => savedState?.customerVehicleNumber || '');
  const [vehicleNumbers, setVehicleNumbers] = useState(() => savedState?.vehicleNumbers || []);
  const [useSameVehicleForAll, setUseSameVehicleForAll] = useState(() => savedState?.useSameVehicleForAll !== undefined ? savedState.useSameVehicleForAll : true);
  const [paymentMethod, setPaymentMethod] = useState(() => savedState?.paymentMethod || 'cash');
  const [mrp, setMrp] = useState(() => savedState?.mrp || '');
  const [discountPercent, setDiscountPercent] = useState(() => savedState?.discountPercent || DEFAULT_DISCOUNT_RETAIL);
  const [discountAmount, setDiscountAmount] = useState(() => savedState?.discountAmount || '0');
  const [finalAmount, setFinalAmount] = useState(() => savedState?.finalAmount || '');
  const [lastEditedDiscountField, setLastEditedDiscountField] = useState(() => savedState?.lastEditedDiscountField || 'percentage');
  
  // GST / B2B fields
  const [hasGST, setHasGST] = useState(() => savedState?.hasGST || false);
  const [customerBusinessName, setCustomerBusinessName] = useState(() => savedState?.customerBusinessName || '');
  const [customerGSTNumber, setCustomerGSTNumber] = useState(() => savedState?.customerGSTNumber || '');
  const [customerBusinessAddress, setCustomerBusinessAddress] = useState(() => savedState?.customerBusinessAddress || '');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersError, setCustomersError] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => savedState?.selectedCustomerId || null);
  const [isB2BCustomer, setIsB2BCustomer] = useState(() => savedState?.isB2BCustomer || false);
  const [showExistingCustomerDropdown, setShowExistingCustomerDropdown] = useState(false);

  // Commission fields
  const [hasCommission, setHasCommission] = useState(() => savedState?.hasCommission || false);
  const [commissionAgents, setCommissionAgents] = useState([]);
  const [commissionAgentsLoading, setCommissionAgentsLoading] = useState(false);
  const [selectedCommissionAgentId, setSelectedCommissionAgentId] = useState(() => savedState?.selectedCommissionAgentId || null);
  const [commissionAgentName, setCommissionAgentName] = useState(() => savedState?.commissionAgentName || '');
  const [commissionAgentMobile, setCommissionAgentMobile] = useState(() => savedState?.commissionAgentMobile || '');
  const [commissionAmount, setCommissionAmount] = useState(() => savedState?.commissionAmount || '');

  // Cart state for multiple products
  const [cart, setCart] = useState(() => savedState?.cart || []);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save form state to sessionStorage whenever it changes
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const formState = {
      activeTab,
      selectedCategory,
      selectedProductId: selectedProduct?.id || null,
      selectedSerials,
      quantity,
      purchaseDate,
      purchaseTime,
      customerName,
      customerMobileNumber,
      customerEmail,
      customerVehicleNumber,
      vehicleNumbers,
      useSameVehicleForAll,
      paymentMethod,
      mrp,
      discountPercent,
      discountAmount,
      finalAmount,
      lastEditedDiscountField,
      hasGST,
      customerBusinessName,
      customerGSTNumber,
      customerBusinessAddress,
      selectedCustomerId,
      isB2BCustomer,
      hasCommission,
      selectedCommissionAgentId,
      commissionAgentName,
      commissionAgentMobile,
      commissionAmount,
      cart
    };
    saveFormState(STORAGE_KEY, formState);
  }, [activeTab, selectedCategory, selectedProduct, selectedSerials, quantity, purchaseDate, purchaseTime, customerName, customerMobileNumber, customerEmail, customerVehicleNumber, vehicleNumbers, useSameVehicleForAll, paymentMethod, mrp, discountPercent, discountAmount, finalAmount, lastEditedDiscountField, hasGST, customerBusinessName, customerGSTNumber, customerBusinessAddress, selectedCustomerId, isB2BCustomer, hasCommission, selectedCommissionAgentId, commissionAgentName, commissionAgentMobile, commissionAmount, cart, isInitialMount]);

  const categories = [
    { id: 'car-truck-tractor', name: 'Automotive', icon: '🚗' },
    { id: 'bike', name: 'Bike Batteries', icon: '🏍️' },
    { id: 'ups-inverter', name: 'UPS Batteries', icon: '⚡' }
  ];

  // Restore selected product when products are loaded
  useEffect(() => {
    if (savedState?.selectedProductId && products.length > 0 && !selectedProduct) {
      const restoredProduct = products.find(p => p.id === savedState.selectedProductId);
      if (restoredProduct) {
        setSelectedProduct(restoredProduct);
      }
    }
  }, [products, savedState, selectedProduct]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);
  
  useEffect(() => {
    loadCustomers();
    loadCommissionAgents();
  }, []);

  // Ensure customer selection UI resets when switching between customer/B2B tabs
  useEffect(() => {
    clearSelectedCustomer();
    setShowExistingCustomerDropdown(false);
    const isWholesale = activeTab === 'wholesale';
    setIsB2BCustomer(isWholesale);

    // Set default discount for tab (18% for B2B, 12% for retail) and recalc amounts
    const defaultDiscount = isWholesale ? DEFAULT_DISCOUNT_B2B : DEFAULT_DISCOUNT_RETAIL;
    setLastEditedDiscountField('percentage');
    setDiscountPercent(defaultDiscount);
    if (mrp) {
      calculateFromPercentage(parseFloat(mrp), defaultDiscount);
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedProduct) {
      fetchAvailableSerials();
      // Always set MRP when product is selected (even if 0)
      const productMrp = parseFloat(selectedProduct.mrp_price || selectedProduct.mrp || 0);
      setMrp(productMrp > 0 ? productMrp.toFixed(2) : '0.00');
      // Use product's actual discount from database, not hardcoded defaults
      if (productMrp > 0) {
        let actualDiscount = 0;
        
        if (activeTab === 'wholesale') {
          // For B2B customers: calculate discount from b2b_selling_price
          const b2bPrice = parseFloat(selectedProduct.b2b_selling_price || selectedProduct.b2b_price || selectedProduct.selling_price || 0);
          if (b2bPrice > 0 && productMrp > b2bPrice) {
            actualDiscount = Math.round(((productMrp - b2bPrice) / productMrp) * 10000) / 100;
          } else {
            // Fallback to default if b2b price not available
            actualDiscount = DEFAULT_DISCOUNT_B2B;
          }
        } else {
          // For B2C customers: use discount_percent from product
          actualDiscount = parseFloat(selectedProduct.discount_percent || selectedProduct.discount_percent || 0);
          if (actualDiscount === 0 || isNaN(actualDiscount)) {
            // Fallback: calculate from selling_price if discount_percent not available
            const sellingPrice = parseFloat(selectedProduct.selling_price || selectedProduct.price || 0);
            if (sellingPrice > 0 && productMrp > sellingPrice) {
              actualDiscount = Math.round(((productMrp - sellingPrice) / productMrp) * 10000) / 100;
            } else {
              // Final fallback to default
              actualDiscount = DEFAULT_DISCOUNT_RETAIL;
            }
          }
        }
        
        setLastEditedDiscountField('percentage');
        setDiscountPercent(actualDiscount);
        calculateFromPercentage(productMrp, actualDiscount);
      }
    } else {
      // Clear MRP when no product is selected
      setMrp('');
    }
  }, [selectedProduct, activeTab]);

  // Calculate amounts when MRP, quantity, discount, or trade-in value changes
  useEffect(() => {
    if (mrp && quantity > 0) {
      if (lastEditedDiscountField === 'percentage') {
        calculateFromPercentage(parseFloat(mrp), discountPercent);
      } else if (lastEditedDiscountField === 'amount') {
        calculateFromAmount(parseFloat(mrp), parseFloat(discountAmount) || 0);
      }
    }
    // Note: calculateFromPercentage and calculateFromAmount are stable functions that use current state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mrp, quantity, discountPercent, discountAmount, lastEditedDiscountField]);

  const calculateFromPercentage = (mrpValue, discountPercentValue) => {
    const totalMrp = mrpValue * quantity;
    const calculatedDiscountAmount = (totalMrp * discountPercentValue) / 100;
    const calculatedFinalAmount = totalMrp - calculatedDiscountAmount;
    
    setDiscountAmount(calculatedDiscountAmount.toFixed(2));
    setFinalAmount(calculatedFinalAmount.toFixed(2));
  };

  const calculateFromAmount = (mrpValue, discountAmountValue) => {
    const totalMrp = mrpValue * quantity;
    // Ensure discount amount doesn't exceed total MRP
    const validDiscountAmount = Math.max(0, Math.min(discountAmountValue, totalMrp));
    const calculatedDiscountPercent = totalMrp > 0 ? (validDiscountAmount / totalMrp) * 100 : 0;
    const calculatedFinalAmount = totalMrp - validDiscountAmount;
    
    // Use functional updates to avoid dependency issues
    setDiscountPercent(prev => {
      const newPercent = parseFloat(calculatedDiscountPercent.toFixed(2));
      return prev !== newPercent ? newPercent : prev;
    });
    setDiscountAmount(validDiscountAmount.toFixed(2));
    setFinalAmount(calculatedFinalAmount.toFixed(2));
  };

  const fetchProducts = async () => {
    try {
      const data = await api.getInventory(selectedCategory);
      const allProducts = [];
      if (data.series && Array.isArray(data.series)) {
        data.series.forEach((series) => {
          if (series.products && Array.isArray(series.products)) {
            allProducts.push(...series.products);
          }
        });
      }
      // Filter to only show products with available stock (qty > 0)
      const availableProducts = allProducts.filter((product) => {
        const qty = parseInt(product.qty || 0);
        return qty > 0;
      });
      setProducts(availableProducts);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    }
  };

  const loadCustomers = async () => {
    setCustomersLoading(true);
    setCustomersError('');
    try {
      const response = await api.getCustomers({ limit: 500, page: 1 });
      setCustomers(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      console.error('Failed to load customers:', err);
      setCustomersError(err.message || 'Failed to load customers');
    } finally {
      setCustomersLoading(false);
    }
  };

  const loadCommissionAgents = async () => {
    setCommissionAgentsLoading(true);
    try {
      const agents = await api.getCommissionAgents();
      setCommissionAgents(Array.isArray(agents) ? agents : []);
    } catch (err) {
      console.error('Failed to load commission agents:', err);
    } finally {
      setCommissionAgentsLoading(false);
    }
  };

  const handleExistingCustomerSelect = async (customerId) => {
    setSelectedCustomerId(customerId);
    const customerFromList = customers.find((c) => c.id === customerId);

    let customer = customerFromList;
    // Fetch latest customer details (includes GST) in case list is stale or missing fields
    try {
      const latest = await api.getCustomerById(customerId);
      if (latest) customer = latest;
    } catch (err) {
      console.warn('Failed to fetch customer details by id, using list data instead', err);
    }

    if (!customer) return;

    const sanitizedPhone = (customer.phone || '').replace(/\D/g, '').slice(0, 10);
    setCustomerName(customer.name || '');
    setCustomerMobileNumber(sanitizedPhone);
    setCustomerEmail(customer.email || (sanitizedPhone ? `${sanitizedPhone}@customer.local` : ''));

    // Use explicit user type (is_b2b or user_type) - don't infer from GST
    // User type is set during the initial sale and should not change based on GST presence
    const customerIsB2B = !!(customer.is_b2b || 
                            (customer.user_type && customer.user_type.toLowerCase() === 'b2b'));
    setIsB2BCustomer(customerIsB2B);

    const hasGstFromProfile = !!(customer.gst_number || customer.company || customer.company_address);
    setHasGST(hasGstFromProfile);
    setCustomerBusinessName(hasGstFromProfile ? (customer.company || '') : '');
    setCustomerGSTNumber(hasGstFromProfile ? (customer.gst_number || '') : '');
    setCustomerBusinessAddress(hasGstFromProfile ? (customer.company_address || '') : '');
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomerId(null);
    setIsB2BCustomer(false);
    setHasGST(false);
    setCustomerBusinessName('');
    setCustomerGSTNumber('');
    setCustomerBusinessAddress('');
  };

  const fetchAvailableSerials = async () => {
    if (!selectedProduct) return;
    // Skip fetching serials for water products
    if (selectedCategory === 'water') {
      setAvailableSerials([]);
      setSelectedSerials([]);
      return;
    }
    try {
      const serials = await api.getAvailableSerials(selectedCategory, selectedProduct.id);
      setAvailableSerials(serials);
      setSelectedSerials([]);
    } catch (err) {
      setError(err.message || 'Failed to load serial numbers');
    }
  };

  const handleQuantityChange = (newQty) => {
    // For water products, use product qty; for others, use available serials
    const maxQty = selectedCategory === 'water' 
      ? (selectedProduct?.qty || 0) 
      : availableSerials.length;
    const qty = Math.max(1, Math.min(newQty, maxQty));
    setQuantity(qty);
    // Adjust selected serials if quantity decreased (skip for water products)
    if (selectedCategory !== 'water' && selectedSerials.length > qty) {
      setSelectedSerials(selectedSerials.slice(0, qty));
    }
    // Adjust vehicle numbers array (skip for water products)
    if (selectedCategory !== 'water') {
      if (vehicleNumbers.length > qty) {
        setVehicleNumbers(vehicleNumbers.slice(0, qty));
      } else if (vehicleNumbers.length < qty) {
        // Fill with empty strings or copy from single vehicle number if using same for all
        const newVehicleNumbers = [...vehicleNumbers];
        while (newVehicleNumbers.length < qty) {
          newVehicleNumbers.push(useSameVehicleForAll ? customerVehicleNumber : '');
        }
        setVehicleNumbers(newVehicleNumbers);
      }
    }
  };

  // Add item to cart
  const handleAddToCart = () => {
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError('Please select a product');
      return;
    }

    const maxAvailableQty = selectedCategory === 'water' ? (selectedProduct?.qty || 0) : availableSerials.length;
    if (quantity <= 0 || quantity > maxAvailableQty) {
      setError(`Please enter a valid quantity. Available: ${maxAvailableQty} units`);
      return;
    }

    // Skip serial number validation for water products
    if (selectedCategory !== 'water') {
      if (selectedSerials.length !== quantity) {
        setError(`Please select exactly ${quantity} serial number(s). Currently selected: ${selectedSerials.length}`);
        return;
      }

      if (selectedSerials.length === 0) {
        setError('Please select at least one serial number');
        return;
      }
    }

    if (!mrp || parseFloat(mrp) <= 0) {
      setError('MRP is required');
      return;
    }

    // Prepare vehicle numbers array (always optional)
    let finalVehicleNumbers = [];
    if (quantity > 1) {
      if (useSameVehicleForAll) {
        finalVehicleNumbers = Array(quantity).fill(customerVehicleNumber.trim() || null);
      } else {
        finalVehicleNumbers = vehicleNumbers.map(vn => vn.trim() || null);
      }
    } else {
      finalVehicleNumbers = [customerVehicleNumber.trim() || null];
    }

    // Create cart item
    const cartItem = {
      id: Date.now(), // Unique ID for cart item
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      category: selectedCategory,
      quantity: quantity,
      serialNumber: selectedCategory === 'water' ? [] : [...selectedSerials], // Empty array for water products
      vehicleNumbers: selectedCategory === 'water' ? [] : [...finalVehicleNumbers], // Empty array for water products
      mrp: parseFloat(mrp),
      discountAmount: parseFloat(discountAmount) || 0,
      finalAmount: parseFloat(finalAmount),
      discountPercent: discountPercent,
      sku: selectedProduct.sku,
      series: selectedProduct.series,
      warranty: selectedProduct.warranty,
      ah_va: selectedProduct.ah_va
    };

    // Add to cart
    setCart([...cart, cartItem]);
    setSuccess(`Added ${quantity} unit(s) of ${selectedProduct.name} to cart`);

    // Reset product selection (keep customer info)
    setSelectedProduct(null);
    setQuantity(1);
    setSelectedSerials([]);
    setCustomerVehicleNumber('');
    setVehicleNumbers([]);
    setUseSameVehicleForAll(true);
    setMrp('');
    setDiscountPercent(activeTab === 'wholesale' ? DEFAULT_DISCOUNT_B2B : DEFAULT_DISCOUNT_RETAIL);
    setDiscountAmount('0');
    setFinalAmount('');
    setLastEditedDiscountField('percentage');

    setTimeout(() => {
      setSuccess('');
    }, 2000);
  };

  // Remove item from cart
  const handleRemoveFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  // Clear cart
  const handleClearCart = () => {
    setCart([]);
  };

  // Submit all items in cart
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (cart.length === 0) {
      setError('Please add at least one product to the cart');
      return;
    }

    if (!customerName.trim()) {
      setError('Please enter customer name');
      return;
    }

    if (!customerMobileNumber.trim() || !/^\d{10}$/.test(customerMobileNumber.trim())) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    // GST validations
    if (hasGST) {
      if (!customerGSTNumber.trim()) {
        setError('GST number is required when "Has GST" is checked');
        return;
      }
      if (!customerBusinessName.trim()) {
        setError('Business / company name is required when "Has GST" is checked');
        return;
      }
      if (!customerBusinessAddress.trim()) {
        setError('Business address is required when "Has GST" is checked');
        return;
      }
    }

    // Commission validations
    if (hasCommission) {
      if (!selectedCommissionAgentId && (!commissionAgentName.trim() || !commissionAgentMobile.trim())) {
        setError('Please select an existing commission agent or provide agent name and mobile number');
        return;
      }
      if (!commissionAmount || parseFloat(commissionAmount) <= 0) {
        setError('Valid commission amount is required');
        return;
      }
      if (commissionAgentMobile.trim() && !/^\d{10}$/.test(commissionAgentMobile.trim().replace(/\D/g, ''))) {
        setError('Commission agent mobile number must be 10 digits');
        return;
      }
    }

    setLoading(true);
    try {
      const salesType = activeTab === 'wholesale' ? 'wholesale' : 'retail';
      
      const purchaseDateTime = purchaseDate
        ? `${purchaseDate}${purchaseTime ? `T${purchaseTime}` : ''}`
        : null;

      // Convert cart items to API format
      const items = cart.map(item => ({
        productId: item.productId,
        category: item.category,
        quantity: item.quantity,
        serialNumber: item.serialNumber,
        customerVehicleNumber: item.quantity === 1 ? (item.vehicleNumbers[0] || null) : null,
        vehicleNumbers: item.quantity > 1 ? item.vehicleNumbers : null,
        mrp: item.mrp,
        discountAmount: item.discountAmount,
        finalAmount: item.finalAmount
      }));

      const saleData = {
        items: items, // Array of items
        purchaseDate: purchaseDateTime,
        customerName: customerName.trim(),
        customerMobileNumber: customerMobileNumber.trim(),
        customerEmail: customerEmail.trim(),
        salesType: salesType,
        paymentMethod: paymentMethod,
        paymentStatus: paymentMethod === 'credit' ? 'pending' : 'paid',
        // GST / B2B details
        customerBusinessName: hasGST ? customerBusinessName.trim() : null,
        customerGstNumber: hasGST ? customerGSTNumber.trim() : null,
        customerBusinessAddress: hasGST ? customerBusinessAddress.trim() : null,
        // Commission details
        hasCommission: hasCommission || false,
        commissionAgentId: selectedCommissionAgentId || null,
        commissionAgentName: hasCommission && !selectedCommissionAgentId ? commissionAgentName.trim() : null,
        commissionAgentMobile: hasCommission && !selectedCommissionAgentId ? commissionAgentMobile.trim().replace(/\D/g, '') : null,
        commissionAmount: hasCommission ? parseFloat(commissionAmount) : 0,
      };

      console.log('Sending sale data with multiple items:', saleData);

      const result = await api.request('/admin-sales/sell-stock', {
        method: 'POST',
        body: JSON.stringify(saleData),
      }).catch(err => {
        console.error('Sale error:', err);
        const errorMessage = err.message || 'Failed to sell stock';
        throw new Error(errorMessage);
      });

      if (result.success) {
        const invoiceNum = result.sale?.invoice_number;
        setInvoiceNumber(invoiceNum);
        setSuccess(`Successfully sold ${cart.length} product(s) with total of ${cart.reduce((sum, item) => sum + item.quantity, 0)} unit(s)`);
        
        // Reset form after successful sale
        setCart([]);
        setSelectedProduct(null);
        setQuantity(1);
        setSelectedSerials([]);
        setCustomerName('');
        setCustomerMobileNumber('');
        setCustomerEmail('');
        setCustomerVehicleNumber('');
        setVehicleNumbers([]);
        setUseSameVehicleForAll(true);
        setMrp('');
        setDiscountPercent(activeTab === 'wholesale' ? DEFAULT_DISCOUNT_B2B : DEFAULT_DISCOUNT_RETAIL);
        setDiscountAmount('0');
        setFinalAmount('');
        setLastEditedDiscountField('percentage');
        setSelectedCustomerId(null);
        setIsB2BCustomer(false);
        setHasGST(false);
        setCustomerBusinessName('');
        setCustomerGSTNumber('');
        setCustomerBusinessAddress('');
        setShowExistingCustomerDropdown(false);
        setHasCommission(false);
        setSelectedCommissionAgentId(null);
        setCommissionAgentName('');
        setCommissionAgentMobile('');
        setCommissionAmount('');
        setPurchaseDate(getCurrentDateISO());
        setPurchaseTime(getCurrentTimeHHMM());
        
        // Mark form as submitted (will clear on next mount)
        markFormSubmitted(STORAGE_KEY);
        
        setTimeout(() => {
          setSuccess('');
          fetchProducts();
        }, 3000);
      } else {
        setError(result.error || 'Failed to sell stock');
      }
    } catch (err) {
      console.error('Sale submission error:', err);
      const errorMessage = err.message || err.error || 'Failed to sell stock';
      setError(errorMessage);
      setTimeout(() => {
        setError('');
      }, 10000);
    } finally {
      setLoading(false);
    }
  };


  // Filter customers based on active tab (retail vs wholesale/B2B)
  // Use explicit user type - don't infer from GST presence
  const filteredCustomers = customers.filter((cust) => {
    const isB2B = !!(cust.is_b2b || 
                    (cust.user_type && cust.user_type.toLowerCase() === 'b2b'));
    return activeTab === 'wholesale' ? isB2B : !isB2B;
  });

  // Vehicle number requirement helper: 
  // - Always optional for all customers and all product types
  // - But always available/visible for all customers
  const isVehicleOptional = true; // Always optional for all customers
  const needsVehicleNumber = false; // Never required

  return (
    <div className="inventory-section">
      <div className="section-header">
        <h2>Sell Stock</h2>
        <p>Record sales to customers or wholesale/B2B clients</p>
      </div>

      {/* Tabs for Customer vs Wholesale */}
      <div className="sell-stock-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0' }}>
        <button
          type="button"
          className={`sell-tab ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => setActiveTab('customer')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'customer' ? '#3b82f6' : 'transparent',
            color: activeTab === 'customer' ? 'white' : '#64748b',
            cursor: 'pointer',
            borderBottom: activeTab === 'customer' ? '3px solid #3b82f6' : '3px solid transparent',
            fontWeight: activeTab === 'customer' ? '600' : '400'
          }}
        >
          Sell to Customer
        </button>
        <button
          type="button"
          className={`sell-tab ${activeTab === 'wholesale' ? 'active' : ''}`}
          onClick={() => setActiveTab('wholesale')}
          style={{
            padding: '0.75rem 1.5rem',
            border: 'none',
            background: activeTab === 'wholesale' ? '#3b82f6' : 'transparent',
            color: activeTab === 'wholesale' ? 'white' : '#64748b',
            cursor: 'pointer',
            borderBottom: activeTab === 'wholesale' ? '3px solid #3b82f6' : '3px solid transparent',
            fontWeight: activeTab === 'wholesale' ? '600' : '400'
          }}
        >
          Sell to Wholesale/B2B
        </button>
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
                ⚡  INVERTER & BATTERY
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
              label="Product Name *"
              options={products.map((product) => ({
                value: product.id,
                label: product.name || 'Untitled',
                subLabel: `${product.sku || 'No SKU'} • Available: ${product.qty || 0}`,
              }))}
              value={selectedProduct?.id || null}
              onChange={(opt) => {
                const product = products.find((p) => p.id === opt.value);
                setSelectedProduct(product || null);
                setQuantity(1);
                setSelectedSerials([]);
              }}
              placeholder="Select a product"
              searchPlaceholder="Search by name or SKU..."
            />
          </div>

          {/* Quantity */}
          {selectedProduct && (
            <div className="form-group">
              <label>Quantity *</label>
              <input
                type="number"
                min="1"
                max={selectedCategory === 'water' ? (selectedProduct.qty || 0) : availableSerials.length}
                value={quantity}
                onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                required
                className="form-input"
                placeholder="Enter quantity"
              />
              {selectedProduct && (
                selectedCategory !== 'water' ? (
                  <small>Available: {availableSerials.length} units</small>
                ) : (
                  <small>Available: {selectedProduct.qty || 0} units</small>
                )
              )}
            </div>
          )}

          {/* Serial Number Selection (Admin can choose manually) - Hidden for water products */}
          {selectedProduct && availableSerials.length > 0 && selectedCategory !== 'water' && (
            <div className="form-group">
              <MultiSelectSearchableDropdown
                label={`Select Serial Numbers * (${selectedSerials.length} of ${quantity} selected)`}
                options={availableSerials.map((serial) => ({
                  value: serial,
                  label: serial,
                }))}
                selectedValues={selectedSerials}
                onChange={(newSelectedSerials) => {
                  // Ensure we don't exceed quantity limit
                  if (newSelectedSerials.length <= quantity) {
                    setSelectedSerials(newSelectedSerials);
                  }
                }}
                placeholder="Search and select serial numbers..."
                searchPlaceholder="Search serial numbers..."
                noOptionsText="No serial numbers found"
                maxSelections={quantity}
                showSelectedCount={true}
              />
              <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                Select {quantity} serial number(s) from {availableSerials.length} available. Use search to find specific serial numbers.
              </small>
            </div>
          )}

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

          {/* Customer Details */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={showExistingCustomerDropdown}
                onChange={(e) => {
                  setShowExistingCustomerDropdown(e.target.checked);
                  if (!e.target.checked) {
                    clearSelectedCustomer();
                  }
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>
                {activeTab === 'wholesale' ? 'Select from existing B2B customers' : 'Select from existing customers'}
              </span>
            </label>

            {showExistingCustomerDropdown && (
              <>
                <SearchableDropdown
                  label={activeTab === 'wholesale' ? 'Existing B2B Customer' : 'Existing Customer'}
                  options={filteredCustomers.map((cust) => {
                    const customerName = cust.name || 'Unnamed customer';
                    // Use explicit user type - don't infer from GST
                    const isB2B = !!(cust.is_b2b || 
                                    (cust.user_type && cust.user_type.toLowerCase() === 'b2b'));
                    const displayName = isB2B ? `${customerName} (B2B)` : customerName;
                    return {
                      value: cust.id,
                      label: displayName,
                      subLabel: `${cust.phone || 'No phone'}${cust.email ? ` • ${cust.email}` : ''}`,
                    };
                  })}
                  value={selectedCustomerId}
                  onChange={(opt) => handleExistingCustomerSelect(opt?.value || null)}
                  placeholder={customersLoading ? 'Loading customers...' : 'Search or select customer'}
                  searchPlaceholder="Search by name, phone, email..."
                  noOptionsText={customersLoading ? 'Loading...' : 'No customers found'}
                  disabled={customersLoading}
                />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={loadCustomers}
                    disabled={customersLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}
                  >
                    {customersLoading ? 'Refreshing...' : 'Refresh list'}
                  </button>
                  {selectedCustomerId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        clearSelectedCustomer();
                      }}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}
                    >
                      Clear selection
                    </button>
                  )}
                  <span style={{ fontSize: '0.9rem', color: '#475569' }}>
                    Selecting a customer will auto-fill their details below. Only {activeTab === 'wholesale' ? 'B2B' : 'regular'} customers are shown here.
                  </span>
                </div>
                {customersError && <small className="error-message">{customersError}</small>}
              </>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="form-input"
                placeholder="Enter customer name"
              />
            </div>
            <div className="form-group">
              <label className="form-label-mobile">Customer Mobile *</label>
              <input
                type="tel"
                value={customerMobileNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setCustomerMobileNumber(value);
                }}
                required
                className="form-input"
                placeholder="10 digit mobile"
                maxLength={10}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email ID *</label>
              <input
                type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
                required
                className="form-input"
                placeholder="Enter email address"
              />
            </div>

            {/* Vehicle Number Field(s) - Hidden for water products */}
            {selectedCategory !== 'water' && (
              quantity === 1 ? (
                <div className="form-group">
                  <label className="form-label-vehicle">
                    Vehicle Number <span className="optional-text">(opt)</span>
                  </label>
                  <input
                    type="text"
                    value={customerVehicleNumber}
                    onChange={(e) => setCustomerVehicleNumber(e.target.value)}
                    required={false}
                    className="form-input"
                    placeholder="Enter vehicle number"
                  />
                </div>
              ) : (
                <div className="form-group">
                <label className="form-label-vehicle">
                  Vehicle Number(s) <span className="optional-text">(opt)</span>
                </label>
                
                {/* Option to use same vehicle for all */}
                {(() => {
                  return (
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        cursor: 'pointer', 
                        fontSize: '0.875rem',
                        color: '#475569',
                        marginBottom: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: '0.375rem',
                        transition: 'background-color 0.2s',
                        width: 'fit-content'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={useSameVehicleForAll}
                        onChange={(e) => {
                          setUseSameVehicleForAll(e.target.checked);
                          if (e.target.checked) {
                            // Fill all with the same vehicle number
                            setVehicleNumbers(Array(quantity).fill(customerVehicleNumber));
                          } else {
                            // Initialize with current vehicle number or empty
                            const newVehicleNumbers = Array(quantity).fill('').map((_, idx) => 
                              vehicleNumbers[idx] || customerVehicleNumber || ''
                            );
                            setVehicleNumbers(newVehicleNumbers);
                          }
                        }}
                        style={{ 
                          cursor: 'pointer',
                          margin: 0,
                          width: '16px',
                          height: '16px',
                          accentColor: '#3b82f6'
                        }}
                      />
                      <span style={{ userSelect: 'none' }}>
                        {quantity === 2 ? 'Use 1 vehicle number (both batteries for same vehicle)' : `Use same vehicle number for all ${quantity} batteries`}
                      </span>
                    </label>
                  );
                })()}
                
                {useSameVehicleForAll ? (
                  <input
                    type="text"
                    value={customerVehicleNumber}
                    onChange={(e) => {
                      setCustomerVehicleNumber(e.target.value);
                      // Update all vehicle numbers in array
                      setVehicleNumbers(Array(quantity).fill(e.target.value));
                    }}
                    required={false}
                    className="form-input"
                    placeholder={`Enter vehicle number (optional, will be used for all ${quantity} batteries)`}
                  />
                ) : (
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem', fontWeight: '500' }}>
                      {quantity === 2 ? 'Use 2 vehicle numbers (batteries for different vehicles)' : `Enter individual vehicle number for each battery`}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {Array.from({ length: quantity }).map((_, index) => {
                        const needsVehicleNumber = !isVehicleOptional;
                        
                        // Ensure vehicleNumbers array has enough elements
                        const currentVehicleNumbers = vehicleNumbers.length >= quantity 
                          ? vehicleNumbers 
                          : [...vehicleNumbers, ...Array(quantity - vehicleNumbers.length).fill('')];
                        
                        return (
                          <div key={index}>
                            <label style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem', display: 'block' }}>
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
                              required={false}
                              className="form-input"
                              placeholder={`Enter vehicle number for battery ${index + 1} (optional)`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                  Vehicle numbers are optional but available for all customers. Each battery can be assigned to a different vehicle. If all batteries are for the same vehicle, use the checkbox above.
                </small>
              </div>
              )
            )}
          </div>

          {/* GST / B2B Details */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={hasGST}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setHasGST(checked);
                  // Don't change customer type based on GST checkbox
                  // Customer type is determined by the active tab (wholesale = B2B, customer = B2C)
                  // GST checkbox is only for invoice purposes, not for customer classification
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Has GST (Customer wants GST invoice)</span>
            </label>

            {hasGST && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Business / Company Name *</label>
                  <input
                    type="text"
                    value={customerBusinessName}
                    onChange={(e) => setCustomerBusinessName(e.target.value)}
                    className="form-input"
                    placeholder="Enter registered company name"
                    required={hasGST}
                  />
                </div>
                <div className="form-group">
                  <label>GST Number *</label>
                  <input
                    type="text"
                    value={customerGSTNumber}
                    onChange={(e) => setCustomerGSTNumber(e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    required={hasGST}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Business Address *</label>
                  <textarea
                    value={customerBusinessAddress}
                    onChange={(e) => setCustomerBusinessAddress(e.target.value)}
                    className="form-input"
                    rows={2}
                    placeholder="Full registered business address"
                    required={hasGST}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Commission Agent Section */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={hasCommission}
                onChange={(e) => {
                  setHasCommission(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedCommissionAgentId(null);
                    setCommissionAgentName('');
                    setCommissionAgentMobile('');
                    setCommissionAmount('');
                  }
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span>Commission Applicable</span>
            </label>

            {hasCommission && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
                <SearchableDropdown
                  label="Select Commission Agent (or create new)"
                  options={commissionAgents.map((agent) => ({
                    value: agent.id,
                    label: agent.name,
                    subLabel: `${agent.mobile_number}${agent.total_commission_paid ? ` • Total Paid: ₹${parseFloat(agent.total_commission_paid).toLocaleString('en-IN')}` : ''}`,
                  }))}
                  value={selectedCommissionAgentId}
                  onChange={(opt) => {
                    const agentId = opt?.value || null;
                    setSelectedCommissionAgentId(agentId);
                    if (agentId) {
                      const agent = commissionAgents.find(a => a.id === agentId);
                      if (agent) {
                        setCommissionAgentName(agent.name);
                        setCommissionAgentMobile(agent.mobile_number);
                      }
                    } else {
                      setCommissionAgentName('');
                      setCommissionAgentMobile('');
                    }
                  }}
                  placeholder={commissionAgentsLoading ? 'Loading agents...' : 'Search or select commission agent'}
                  searchPlaceholder="Search by name or mobile..."
                  noOptionsText={commissionAgentsLoading ? 'Loading...' : 'No agents found. Create new below.'}
                  disabled={commissionAgentsLoading}
                />
                
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={loadCommissionAgents}
                    disabled={commissionAgentsLoading}
                    style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}
                  >
                    {commissionAgentsLoading ? 'Refreshing...' : 'Refresh list'}
                  </button>
                  {selectedCommissionAgentId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedCommissionAgentId(null);
                        setCommissionAgentName('');
                        setCommissionAgentMobile('');
                      }}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}
                    >
                      Clear selection
                    </button>
                  )}
                </div>

                {!selectedCommissionAgentId && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
                    <div className="form-group">
                      <label>Commission Agent Name *</label>
                      <input
                        type="text"
                        value={commissionAgentName}
                        onChange={(e) => setCommissionAgentName(e.target.value)}
                        className="form-input"
                        placeholder="Enter agent name"
                        required={hasCommission && !selectedCommissionAgentId}
                      />
                    </div>
                    <div className="form-group">
                      <label>Commission Agent Mobile *</label>
                      <input
                        type="tel"
                        value={commissionAgentMobile}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setCommissionAgentMobile(value);
                        }}
                        className="form-input"
                        placeholder="10 digit mobile number"
                        maxLength={10}
                        required={hasCommission && !selectedCommissionAgentId}
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label>Commission Amount (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={commissionAmount}
                    onChange={(e) => setCommissionAmount(e.target.value)}
                    className="form-input"
                    placeholder="Enter commission amount"
                    required={hasCommission}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.5rem', display: 'block' }}>
                    Total commission amount to be paid for this sale
                  </small>
                </div>
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div className="form-group">
            <label>Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              required
              className="form-input"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
              <option value="credit">Credit</option>
            </select>
          </div>

          {/* Amount Section */}
          <div className="form-section">
            <h3>Amount Details</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label className="form-label-mrp">MRP (per unit) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={mrp || ''}
                  readOnly
                  className="form-input"
                  placeholder={selectedProduct ? "Select product to see MRP" : "Select product to see MRP"}
                />
                <small>
                </small>
              </div>
              <div className="form-group">
                <label className="form-label-discount">Discount (%) *</label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={discountPercent}
                    onChange={(e) => {
                      const percent = parseFloat(e.target.value) || 0;
                      const validPercent = Math.max(0, Math.min(100, percent));
                      setLastEditedDiscountField('percentage');
                      setDiscountPercent(validPercent);
                      // Calculate immediately when percentage changes
                      if (mrp && quantity > 0) {
                        calculateFromPercentage(parseFloat(mrp), validPercent);
                      }
                    }}
                    className="form-input"
                    style={{ width: '80px' }}
                    placeholder="12"
                  />
                  <span className="discount-percent-symbol">%</span>
                </div>
                <small>
                  Default: 12%
                </small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label-discount-amount">
                  <span className="label-text-full">Discount Amount (₹)</span>
                  <span className="label-text-short">Discount (₹)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    setLastEditedDiscountField('amount');
                    
                    // Allow empty input while typing
                    if (inputValue === '' || inputValue === '.') {
                      setDiscountAmount(inputValue);
                      // Don't calculate if input is empty
                      return;
                    }
                    
                    const amount = parseFloat(inputValue);
                    if (isNaN(amount) || amount < 0) {
                      // Invalid input, keep previous value
                      return;
                    }
                    
                    // Calculate immediately when amount changes
                    if (mrp && quantity > 0) {
                      calculateFromAmount(parseFloat(mrp), amount);
                    } else {
                      // No MRP yet, just update the amount
                      setDiscountAmount(amount.toFixed(2));
                    }
                  }}
                  className="form-input"
                  placeholder="Enter discount amount"
                />
                <small>
                  Enter discount amount or use discount % above
                </small>
              </div>
              <div className="form-group">
                <label className="form-label-final-amount">
                  <span className="label-text-full">Final Amount (₹) *</span>
                  <span className="label-text-short">Final (₹) *</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={finalAmount}
                  readOnly
                  className="form-input final-amount"
                  placeholder="Auto-calculated"
                />
                <small className="total-amount-text">
                  Total: ₹{parseFloat(finalAmount || 0).toLocaleString('en-IN')}
                </small>
              </div>
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          {/* Cart Display */}
          {cart.length > 0 && (
            <div style={{
              marginTop: '2rem',
              padding: '1.5rem',
              backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc',
              border: `2px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}>
                  Cart ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                </h3>
                <button
                  type="button"
                  onClick={handleClearCart}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  Clear Cart
                </button>
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                {cart.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      backgroundColor: theme === 'dark' ? '#334155' : 'white',
                      border: `1px solid ${theme === 'dark' ? '#475569' : '#e2e8f0'}`,
                      borderRadius: '4px',
                      marginBottom: '0.5rem'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: theme === 'dark' ? '#f1f5f9' : '#1e293b', marginBottom: '0.25rem' }}>
                        {index + 1}. {item.productName}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: theme === 'dark' ? '#cbd5e1' : '#64748b' }}>
                        SKU: {item.sku} | Qty: {item.quantity} | MRP: ₹{item.mrp.toFixed(2)} | 
                        Discount: {item.discountPercent.toFixed(2)}% | 
                        Amount: ₹{item.finalAmount.toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        marginLeft: '1rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              <div style={{
                padding: '1rem',
                backgroundColor: theme === 'dark' ? '#1e293b' : '#3b82f6',
                color: 'white',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>Total Items: {cart.reduce((sum, item) => sum + item.quantity, 0)}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', marginTop: '0.25rem' }}>
                    Grand Total: ₹{cart.reduce((sum, item) => sum + (item.finalAmount || 0), 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice Actions */}
          {invoiceNumber && (
            <div style={{
              marginTop: '20px',
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
                  onClick={() => navigate(`/invoice/${invoiceNumber}?returnTo=sell-stock`)}
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
                    navigate(`/invoice/${invoiceNumber}?returnTo=sell-stock`);
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
                  onClick={() => setInvoiceNumber(null)}
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
                  Close
                </button>
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onBack}>
              Cancel
            </button>
            {selectedProduct && (
              <button
                type="button"
                className="btn-primary"
                onClick={handleAddToCart}
                disabled={loading || !selectedProduct || !mrp || parseFloat(finalAmount) <= 0}
                style={{ marginRight: '0.5rem' }}
              >
                Add to Cart
              </button>
            )}
            {cart.length > 0 && (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Processing...' : `Submit Sale (${cart.length} ${cart.length === 1 ? 'item' : 'items'})`}
              </button>
            )}
            {!selectedProduct && cart.length === 0 && (
              <button type="button" className="btn-primary btn-select-product" disabled>
                <span className="btn-text-full">Select a product to add to cart</span>
                <span className="btn-text-short">Select Product</span>
              </button>
            )}
          </div>

        </form>
      </div>
    </div>
  );
};

export default SellStock;
