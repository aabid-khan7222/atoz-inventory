import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import api, { API_BASE } from '../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';
import './Filters.css';

const STORAGE_KEY = 'customerOrdersState';

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

const StatusBadge = ({ status }) => {
  if (!status) return null;
  const normalized = String(status).toLowerCase();

  let className = 'status-badge status-default';
  if (normalized === 'paid') className = 'status-badge status-paid';
  else if (normalized === 'pending') className = 'status-badge status-pending';
  else if (normalized === 'partial') className = 'status-badge status-partial';

  return <span className={className}>{normalized}</span>;
};

const CustomerOrders = ({ title, description }) => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(() => savedState?.searchTerm || '');
  const [statusFilter, setStatusFilter] = useState(() => savedState?.statusFilter || 'all');
  const [sortConfig, setSortConfig] = useState(() => savedState?.sortConfig || { field: 'date', direction: 'desc' });
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      searchTerm,
      statusFilter,
      sortConfig
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [searchTerm, statusFilter, sortConfig, isInitialMount]);

  const fetchOrdersWithDetails = async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError('');
    try {
      // 1. Get list of sales for the current customer
      const customerId = user?.id || user?._id || null;
      const data = await api.getSales(1, 50, customerId);
      const baseOrders = Array.isArray(data) ? data : [];

      if (baseOrders.length === 0) {
        setOrders([]);
        if (showLoading) {
          setLoading(false);
        }
        return;
      }

      // 2. Fetch full details (including items, serial numbers, etc.) for each sale
      const detailResults = await Promise.all(
        baseOrders.map((order) =>
          api
            .getSaleById(order.id)
            .then((detail) => detail)
            .catch(() => null)
        )
      );

      const enrichedOrders = baseOrders.map((order, index) => {
        const detail = detailResults[index];
        if (detail && detail.id === order.id) {
          // Merge base order and detailed order (which includes items)
          return {
            ...order,
            ...detail,
            items: Array.isArray(detail.items) ? detail.items : [],
          };
        }
        return {
          ...order,
          items: [],
        };
      });

      // Show all orders immediately - don't filter by serial number assignment
      // Orders will show with status (Pending/Confirmed) based on serial number assignment
      const allOrders = enrichedOrders.filter((order) => {
        const items = Array.isArray(order.items) ? order.items : [];
        return items.length > 0; // Only filter out orders with no items
      });

      setOrders(allOrders);
    } catch (err) {
      setError(err.message || t('dashboard.orders.failedToLoad'));
      setOrders([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let refreshInterval;

    const loadOrders = async () => {
      if (isMounted) {
        await fetchOrdersWithDetails(true); // Show loading on initial load
      }
    };

    // Load orders immediately
    loadOrders();

    // Auto-refresh every 10 seconds to get latest updates (amount changes, serial number assignments)
    refreshInterval = setInterval(() => {
      if (isMounted) {
        fetchOrdersWithDetails(false); // Don't show loading on refresh
      }
    }, 10000); // Refresh every 10 seconds for faster updates

    // Listen for storage events (when order is updated from another tab/window)
    const handleStorageChange = (e) => {
      if (e.key === 'orderUpdated' && isMounted) {
        fetchOrdersWithDetails(false); // Don't show loading on storage update
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom event for order updates
    const handleOrderUpdate = () => {
      if (isMounted) {
        fetchOrdersWithDetails(false); // Don't show loading on custom event update
      }
    };
    window.addEventListener('orderUpdated', handleOrderUpdate);

    return () => {
      isMounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('orderUpdated', handleOrderUpdate);
    };
  }, [t, user]);

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  const getFilteredOrders = () => {
    let data = orders;

    // Search filter across order + item level fields
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter((order) => {
        const baseMatch =
          (order.invoice_number || `${order.id}` || '').toLowerCase().includes(term) ||
          (order.customer_name || user?.full_name || '').toLowerCase().includes(term) ||
          (order.customer_mobile_number || order.customer_phone || '').toLowerCase().includes(term) ||
          (order.payment_method || '').toLowerCase().includes(term) ||
          (order.payment_status || '').toLowerCase().includes(term);

        const items = Array.isArray(order.items) ? order.items : [];
        const itemMatch = items.some((item) => {
          return (
            (item.NAME || item.name || item.product_name || '').toLowerCase().includes(term) ||
            (item.SKU || item.sku || item.product_sku || '').toLowerCase().includes(term) ||
            (item.SERIAL_NUMBER || item.serial_number || '').toLowerCase().includes(term) ||
            (item.CATEGORY || item.category || '').toLowerCase().includes(term)
          );
        });

        return baseMatch || itemMatch;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      data = data.filter((order) => {
        // Order-level status
        const orderStatus = (order.payment_status || order.status || '').toLowerCase().trim();
        if (orderStatus === statusFilter) return true;

        // Item-level status (in case status is stored per item)
        const items = Array.isArray(order.items) ? order.items : [];
        return items.some((item) => {
          const itemStatus = (item.payment_status || '').toLowerCase().trim();
          return itemStatus === statusFilter;
        });
      });
    }

    // Sorting
    const sorted = [...data];
    sorted.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      const itemsA = Array.isArray(a.items) ? a.items : [];
      const itemsB = Array.isArray(b.items) ? b.items : [];
      const firstItemA = itemsA[0] || {};
      const firstItemB = itemsB[0] || {};

      switch (sortConfig.field) {
        case 'invoice':
          return ((a.invoice_number || a.id || '') || '').localeCompare((b.invoice_number || b.id || '') || '') * dir;
        case 'date':
          return (new Date(a.created_at) - new Date(b.created_at)) * dir;
        case 'product':
          return (firstItemA.NAME || firstItemA.name || firstItemA.product_name || '')
            .localeCompare(firstItemB.NAME || firstItemB.name || firstItemB.product_name || '') * dir;
        case 'amount': {
          const totalA = Number(a.final_amount || a.total_amount || 0);
          const totalB = Number(b.final_amount || b.total_amount || 0);
          return (totalA - totalB) * dir;
        }
        case 'status':
          return (a.payment_status || '').localeCompare(b.payment_status || '') * dir;
        default:
          return 0;
      }
    });

    return sorted;
  };

  const handleDownloadPDF = async (invoiceNumber) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      // Show loading
      Swal.fire({
        title: 'Generating PDF...',
        text: 'Please wait',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const response = await fetch(`${API_BASE}/invoices/${invoiceNumber}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        }
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to generate PDF';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('pdf')) {
        // If not PDF, might be JSON error
        const text = await response.text();
        try {
          const errorJson = JSON.parse(text);
          throw new Error(errorJson.error || errorJson.message || 'Invalid response format');
        } catch {
          throw new Error('Invalid response format. Expected PDF but got: ' + contentType);
        }
      }

      const blob = await response.blob();
      
      // Verify blob is not empty
      if (blob.size === 0) {
        throw new Error('PDF file is empty');
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceNumber}.pdf`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 100);

      // Close loading and show success
      Swal.close();
      await Swal.fire('Success!', 'PDF downloaded successfully', 'success');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      Swal.close();
      await Swal.fire('Error!', 'Failed to download PDF: ' + (err.message || 'Unknown error'), 'error');
    }
  };

  const handlePrintInvoice = (invoiceNumber) => {
    // Navigate to invoice page for printing
    navigate(`/invoice/${invoiceNumber}`);
  };

  // Check if order is confirmed (all items have serial numbers assigned, not PENDING)
  const isOrderConfirmed = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return false;
    
    return items.every((item) => {
      const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
      const serialNum = item.SERIAL_NUMBER || item.serial_number;
      // Water products don't need serial numbers
      if (isWaterProduct) return true;
      // For non-water products, must have serial number and it must not be PENDING
      return !!(serialNum && serialNum !== 'PENDING' && serialNum !== 'N/A');
    });
  };
  
  // Check if order is pending (has items with PENDING serial numbers)
  const isOrderPending = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return false;
    
    return items.some((item) => {
      const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
      if (isWaterProduct) return false; // Water products are always confirmed
      const serialNum = item.SERIAL_NUMBER || item.serial_number;
      // Check if serial number is PENDING or NULL
      return !serialNum || serialNum === 'PENDING';
    });
  };

  const handleCancelOrder = async (invoiceNumber, order) => {
    const result = await Swal.fire({
      title: 'Cancel Order?',
      html: `
        <div style="text-align: left; padding: 1rem 0;">
          <p style="margin-bottom: 1rem; font-size: 1rem; color: #0f172a;">
            Are you sure you want to cancel this order?
          </p>
          <div style="background: #f8fafc; padding: 1rem; border-radius: 0.375rem; margin-bottom: 1rem;">
            <p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Invoice:</strong> ${invoiceNumber}</p>
            ${order?.customer_name ? `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Customer:</strong> ${order.customer_name}</p>` : ''}
            ${order?.items?.length ? `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Items:</strong> ${order.items.length}</p>` : ''}
            ${order?.items?.reduce((sum, item) => sum + parseFloat(item.final_amount || item.FINAL_AMOUNT || 0), 0) ? 
              `<p style="margin: 0.25rem 0; font-size: 0.875rem;"><strong>Total Amount:</strong> ₹${order.items.reduce((sum, item) => sum + parseFloat(item.final_amount || item.FINAL_AMOUNT || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>` : ''}
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
      // Check if order is already confirmed (has serial numbers assigned, not PENDING)
      // Use isOrderPending to check - if order is NOT pending, it means it's confirmed
      const items = Array.isArray(order.items) ? order.items : [];
      if (items.length === 0) {
        await Swal.fire('Error', 'Order details not available. Please refresh and try again.', 'error');
        return;
      }
      
      // Check if order has any pending items - if not, it's confirmed and can't be cancelled
      const hasPendingItems = items.some((item) => {
        const isWaterProduct = (item.CATEGORY || item.category || '').toLowerCase() === 'water';
        if (isWaterProduct) return false; // Water products don't need serial numbers
        const serialNum = item.SERIAL_NUMBER || item.serial_number;
        // Check if serial number is PENDING or NULL
        return !serialNum || serialNum === 'PENDING' || serialNum === 'N/A';
      });
      
      if (!hasPendingItems) {
        await Swal.fire({
          title: 'Error',
          html: `
            <div style="text-align: center; padding: 1rem 0;">
              <div style="font-size: 3rem; color: #dc2626; margin-bottom: 1rem;">✕</div>
              <p style="font-size: 1rem; color: #0f172a; margin: 0;">
                Cannot cancel order. Order has already been confirmed and serial numbers have been assigned.
              </p>
            </div>
          `,
          icon: 'error',
          confirmButtonColor: '#dc2626',
          confirmButtonText: 'OK'
        });
        return;
      }

      // Call cancel order API
      const response = await api.cancelOrder(invoiceNumber);
      
      if (response.success) {
        await Swal.fire({
          title: 'Order Cancelled',
          html: `
            <div style="text-align: center; padding: 1rem 0;">
              <div style="font-size: 3rem; color: #059669; margin-bottom: 1rem;">✓</div>
              <p style="font-size: 1rem; color: #0f172a; margin: 0;">
                Order <strong>${invoiceNumber}</strong> has been cancelled successfully.
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonColor: '#059669',
          confirmButtonText: 'OK'
        });
        // Remove cancelled order from local state immediately
        setOrders(prevOrders => prevOrders.filter(order => 
          (order.invoice_number || order.id) !== invoiceNumber
        ));
        
        // Reload orders from server
        await fetchOrdersWithDetails(false);
      } else {
        throw new Error(response.error || 'Failed to cancel order');
      }
    } catch (err) {
      await Swal.fire('Error', err.message || 'Failed to cancel order', 'error');
    }
  };

  return (
    <div className="dashboard-content">
      <h2>{title || t('dashboard.myOrders')}</h2>
      <p>{description || t('dashboard.viewOrderHistory')}</p>

      {/* Search / Filter controls */}
      <div className="filters-bar">
        <input
          className="filter-input"
          type="text"
          placeholder="Search by invoice, product, SKU, serial, customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="filter-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
        </select>
      </div>

      {loading && (
        <div className="loading-message">
          {t('dashboard.orders.loading')}
        </div>
      )}

      {error && !loading && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <h3>{t('dashboard.orders.emptyTitle')}</h3>
          <p>{t('dashboard.orders.emptyDescription')}</p>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('invoice')} className="sortable">
                  Invoice
                </th>
                <th onClick={() => handleSort('date')} className="sortable">
                  Date
                </th>
                <th onClick={() => handleSort('product')} className="sortable">
                  Product
                </th>
                <th>Serial No.</th>
                <th>Payment</th>
                <th>Qty</th>
                <th>MRP</th>
                <th>Discount Amount</th>
                <th>Discount %</th>
                <th>Final Amount</th>
                <th onClick={() => handleSort('status')} className="sortable">
                  Status
                </th>
                <th>Order Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {getFilteredOrders().flatMap((order) => {
                const items = Array.isArray(order.items) ? order.items : [];
                if (items.length === 0) {
                  // Show at least one row with summary even if no items (fallback)
                  return [
                    <tr key={`order-${order.id}-summary`}>
                      <td>{order.invoice_number || order.id}</td>
                      <td>{formatDateTime(order.created_at)}</td>
                      <td colSpan={4}>
                        {t('dashboard.orders.noItems') || 'No product details available'}
                      </td>
                      <td>
                        ₹{Number(order.final_amount || order.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td>
                        <StatusBadge status={order.payment_status} />
                      </td>
                      <td>
                        {isOrderConfirmed(order) ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: '#d1fae5',
                            color: '#065f46'
                          }}>
                            ✓ Confirmed
                          </span>
                        ) : (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: '#fef3c7',
                            color: '#92400e'
                          }}>
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {isOrderConfirmed(order) ? (
                            <>
                              <button
                                onClick={() => handlePrintInvoice(order.invoice_number || order.id)}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  fontSize: '0.875rem',
                                  backgroundColor: '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Print Invoice
                              </button>
                              <button
                                onClick={() => handleDownloadPDF(order.invoice_number || order.id)}
                                style={{
                                  padding: '0.4rem 0.8rem',
                                  fontSize: '0.875rem',
                                  backgroundColor: '#059669',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '0.375rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Download Invoice
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleCancelOrder(order.invoice_number || order.id, order)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.875rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.375rem',
                                cursor: 'pointer'
                              }}
                            >
                              Cancel Order
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>,
                  ];
                }

                return items.map((item, index) => {
                  // New sales_item structure uses SERIAL_NUMBER, NAME, SKU, etc.
                  // Handle different casing from database (PostgreSQL returns uppercase, but check all variations)
                  const serial = item.SERIAL_NUMBER || item.serial_number || item.product_serial_number || null;
                  const productName = item.NAME || item.name || item.product_name || '-';
                  // Handle SKU - check all possible field names and handle empty strings
                  const productSku = (item.SKU && item.SKU.trim()) || 
                                     (item.sku && item.sku.trim()) || 
                                     (item.product_sku && item.product_sku.trim()) || 
                                     (item.PRODUCT_SKU && item.PRODUCT_SKU.trim()) ||
                                     '-';
                  const productCategory = item.CATEGORY || item.category || item.product_category || null;
                  const quantity = item.QUANTITY || item.quantity || 1;
                  
                  // Check if item is confirmed (has serial number assigned, not PENDING)
                  const isItemConfirmed = serial !== null && serial.trim() !== '' && serial.trim() !== 'PENDING' && serial.trim() !== 'N/A';
                  
                  const mrp = parseFloat(item.MRP || item.mrp || 0);
                  const finalAmount = parseFloat(item.final_amount || item.FINAL_AMOUNT || item.finalAmount || 0);
                  
                  // Always calculate discount from MRP and final_amount (source of truth)
                  // This ensures we show the correct discount even after admin updates final_amount
                  let discountAmount = 0;
                  let discountPercent = 0;
                  if (isItemConfirmed && mrp > 0 && finalAmount > 0) {
                    // Calculate discount amount from MRP and final_amount
                    discountAmount = mrp > finalAmount ? mrp - finalAmount : 0;
                    discountPercent = discountAmount > 0 ? (discountAmount / mrp) * 100 : 0;
                  }
                  
                  // Unit price should show MRP
                  const unitPrice = mrp > 0 ? mrp : finalAmount;
                  const totalPrice = finalAmount;

                  return (
                    <tr key={`order-${order.id}-item-${item.id || index}`}>
                      {/* Invoice & date only on first row of each order for compact view */}
                      {index === 0 ? (
                        <>
                          <td rowSpan={items.length}>
                            {order.invoice_number || order.id}
                            <div className="orders-table-sub">
                              {order.customer_name || user?.full_name || '-'}
                              <br />
                              {order.customer_mobile_number || order.customer_phone || '-'}
                            </div>
                          </td>
                          <td rowSpan={items.length}>
                            {formatDateTime(order.created_at)}
                          </td>
                        </>
                      ) : null}

                      <td>
                        <div className="orders-product-name">
                          {productName}
                        </div>
                        <div className="orders-product-meta">
                          SKU: {productSku !== '-' ? productSku : (item.sku || item.SKU || 'N/A')}
                          {productCategory && (
                            <span> · {productCategory}</span>
                          )}
                          {(item.AH_VA || item.ah_va) && (
                            <span> · {item.AH_VA || item.ah_va}Ah</span>
                          )}
                          {(item.WARRANTY || item.warranty) && (
                            <span> · Warranty: {item.WARRANTY || item.warranty}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {serial ? serial : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending assignment</span>
                        )}
                      </td>
                      <td>
                        {index === 0 && (
                          <div className="orders-payment">
                            {order.payment_method || item.payment_method
                              ? String(order.payment_method || item.payment_method).toUpperCase()
                              : '-'}
                            <div className="orders-payment-notes">
                              <StatusBadge status={order.payment_status || item.payment_status} />
                              <div className="orders-total">
                                {isOrderConfirmed(order) ? (
                                  <>
                                    ₹
                                    {Number(
                                      order.items?.reduce((sum, itm) => {
                                        const itmSerial = itm.SERIAL_NUMBER || itm.serial_number || null;
                                        const itmConfirmed = itmSerial !== null && itmSerial.trim() !== '';
                                        return sum + (itmConfirmed ? parseFloat(itm.final_amount || itm.FINAL_AMOUNT || 0) : 0);
                                      }, 0) ||
                                      order.final_amount ||
                                      item.final_amount ||
                                      0
                                    ).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>{Number(quantity)}</td>
                      <td>
                        {isItemConfirmed ? (
                          <>
                            ₹{mrp > 0 ? mrp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {isItemConfirmed ? (
                          discountAmount > 0 ? (
                            <>
                              ₹{discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </>
                          ) : discountPercent > 0 ? (
                            <>
                              ₹{((mrp * discountPercent) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </>
                          ) : (
                            '-'
                          )
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {isItemConfirmed ? (
                          discountPercent > 0 ? (
                            <>
                              {discountPercent.toFixed(2)}%
                            </>
                          ) : (
                            '-'
                          )
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {isItemConfirmed ? (
                          <>
                            ₹{finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pending</span>
                        )}
                      </td>
                      <td>
                        {index !== 0 && (
                          <StatusBadge status={order.payment_status || item.payment_status} />
                        )}
                      </td>
                      {index === 0 && (
                        <>
                          <td rowSpan={items.length}>
                            {isOrderConfirmed(order) ? (
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: '#d1fae5',
                                color: '#065f46'
                              }}>
                                ✓ Confirmed
                              </span>
                            ) : (
                              <span style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.75rem',
                                fontWeight: '600',
                                backgroundColor: '#fef3c7',
                                color: '#92400e'
                              }}>
                                ⏳ Pending
                              </span>
                            )}
                          </td>
                          <td rowSpan={items.length}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {isOrderConfirmed(order) ? (
                                <>
                                  <button
                                    onClick={() => handlePrintInvoice(order.invoice_number || order.id)}
                                    style={{
                                      padding: '0.4rem 0.8rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: '#2563eb',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Print Invoice
                                  </button>
                                  <button
                                    onClick={() => handleDownloadPDF(order.invoice_number || order.id)}
                                    style={{
                                      padding: '0.4rem 0.8rem',
                                      fontSize: '0.875rem',
                                      backgroundColor: '#059669',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '0.375rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Download Invoice
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleCancelOrder(order.invoice_number || order.id, order)}
                                  style={{
                                    padding: '0.4rem 0.8rem',
                                    fontSize: '0.875rem',
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.375rem',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel Order
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CustomerOrders;

