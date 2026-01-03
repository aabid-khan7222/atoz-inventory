import React, { useState, useEffect } from 'react';
import api from '../../../api';
import { useAuth } from '../../../contexts/AuthContext';
import SearchableDropdown from '../../common/SearchableDropdown';
import './InventorySection.css';
import '../InventoryManagement.css';

const CurrentStock = ({ onBack }) => {
  const { user } = useAuth();
  
  // Load saved state from sessionStorage
  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem('currentStockState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved CurrentStock state:', e);
    }
    return null;
  };
  
  const savedState = getSavedState();
  const [selectedCategory, setSelectedCategory] = useState(() => savedState?.selectedCategory || 'car-truck-tractor');
  const [inventoryData, setInventoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedSeries, setExpandedSeries] = useState(() => savedState?.expandedSeries || {});
  const [sortConfig, setSortConfig] = useState(() => savedState?.sortConfig || { field: 'name', direction: 'asc' });
  const [searchQuery, setSearchQuery] = useState(() => savedState?.searchQuery || '');
  const [stockFilter, setStockFilter] = useState(() => savedState?.stockFilter || 'all');
  const [productSerialNumbers, setProductSerialNumbers] = useState({}); // { productId: [serials] }
  const [openSerialForProduct, setOpenSerialForProduct] = useState({});
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      selectedCategory,
      expandedSeries,
      sortConfig,
      searchQuery,
      stockFilter
    };
    sessionStorage.setItem('currentStockState', JSON.stringify(stateToSave));
  }, [selectedCategory, expandedSeries, sortConfig, searchQuery, stockFilter, isInitialMount]);

  // Determine role class for styling
  const roleClass = user?.role_id === 1 ? 'super-admin' : user?.role_id === 2 ? 'admin' : '';

  useEffect(() => {
    fetchInventory();
    // Reset search and filter when category changes
    setSearchQuery('');
    setStockFilter('all');
  }, [selectedCategory]);

  const fetchInventory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getInventory(selectedCategory);
      setInventoryData(data);

      // Preload available serial numbers for products that currently have stock (skip for water products)
      const serialsMap = {};
      if (selectedCategory !== 'water' && data.series && Array.isArray(data.series)) {
        const allProducts = [];
        data.series.forEach((series) => {
          if (series.products && Array.isArray(series.products)) {
            allProducts.push(...series.products);
          }
        });

        const productsWithStock = allProducts.filter((p) => parseQuantity(p.qty) > 0);

        if (productsWithStock.length > 0) {
          const serialPromises = productsWithStock.map(async (product) => {
            try {
              const serials = await api.getAvailableSerials(selectedCategory, product.id);
              return { productId: product.id, serials: Array.isArray(serials) ? serials : [] };
            } catch (err) {
              console.warn(`Failed to fetch serials for product ${product.id}:`, err);
              return { productId: product.id, serials: [] };
            }
          });

          const serialResults = await Promise.all(serialPromises);
          serialResults.forEach(({ productId, serials }) => {
            serialsMap[productId] = serials;
          });
        }
      }
      setProductSerialNumbers(serialsMap);
      // Auto-expand first series
      if (data.series && data.series.length > 0) {
        setExpandedSeries({ [data.series[0].seriesName]: true });
      }
    } catch (err) {
      setError(err.message || 'Failed to load inventory');
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

  // Helper function to parse quantity from various formats
  const parseQuantity = (qty) => {
    if (qty === null || qty === undefined) return 0;
    if (typeof qty === 'number') {
      return isNaN(qty) ? 0 : Math.max(0, Math.floor(qty));
    }
    if (typeof qty === 'string') {
      const parsed = parseInt(qty, 10);
      return isNaN(parsed) ? 0 : Math.max(0, parsed);
    }
    const num = Number(qty);
    return isNaN(num) ? 0 : Math.max(0, Math.floor(num));
  };

  const getStockStatus = (qty) => {
    const quantity = parseQuantity(qty);
    
    // Stock status thresholds:
    // - Out of Stock: quantity === 0
    // - Low Stock: 0 < quantity < 5 (warning level, but still in stock)
    // - In Stock: quantity >= 5 (good stock level)
    if (quantity === 0) return { label: 'Out of Stock', class: 'out-of-stock', type: 'out-of-stock' };
    if (quantity < 5) return { label: 'Low Stock', class: 'low-stock', type: 'low-stock' };
    return { label: 'In Stock', class: 'in-stock', type: 'in-stock' };
  };

  const filterProducts = (products) => {
    return products.filter((product) => {
      // Apply search filter
      const matchesSearch = searchQuery === '' || 
        (product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.ah_va || '').toLowerCase().includes(searchQuery.toLowerCase());

      // Apply stock filter
      const quantity = parseQuantity(product.qty);
      const stockStatus = getStockStatus(quantity);
      
      let matchesStock = false;
      if (stockFilter === 'all') {
        matchesStock = true;
      } else if (stockFilter === 'in-stock') {
        // "In Stock" means any product with quantity > 0 (has stock available)
        matchesStock = quantity > 0;
      } else if (stockFilter === 'low-stock') {
        // "Low Stock" means 0 < quantity < 5
        matchesStock = quantity > 0 && quantity < 5;
      } else if (stockFilter === 'out-of-stock') {
        // "Out of Stock" means quantity === 0
        matchesStock = quantity === 0;
      }

      return matchesSearch && matchesStock;
    });
  };

  const sortProducts = (products) => {
    const sorted = [...products];
    sorted.sort((a, b) => {
      const dir = sortConfig.direction === 'asc' ? 1 : -1;
      switch (sortConfig.field) {
        case 'sku':
          return (a.sku || '').localeCompare(b.sku || '') * dir;
        case 'name':
          return (a.name || '').localeCompare(b.name || '') * dir;
        case 'stock':
          return ((a.qty || 0) - (b.qty || 0)) * dir;
        case 'mrp': {
          const mrpA = parseFloat(a.mrp_price || a.mrp || 0) || 0;
          const mrpB = parseFloat(b.mrp_price || b.mrp || 0) || 0;
          return (mrpA - mrpB) * dir;
        }
        default:
          return 0;
      }
    });

    return sorted;
  };

  const handleSort = (field) => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  };

  return (
    <div className="inventory-section">
      <div className="section-header">
        <h2>Current Stock</h2>
        <p>View current inventory levels</p>
      </div>

      <div className="section-content">
        {inventoryData && (
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-icon">📦</div>
              <div>
                <p className="metric-label">Total Stock</p>
                <p className="metric-value">{inventoryData.totalStock || 0} units</p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">📊</div>
              <div>
                <p className="metric-label">Series Count</p>
                <p className="metric-value">{inventoryData.series?.length || 0} series</p>
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-icon">🔋</div>
              <div>
                <p className="metric-label">Total Products</p>
                <p className="metric-value">
                  {inventoryData.series?.reduce((sum, s) => sum + (s.products?.length || 0), 0) || 0} products
                </p>
              </div>
            </div>
          </div>
        )}

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
            🏍️ Bike Batteries
          </button>
          <button
            className={`product-category-btn inverter ${selectedCategory === 'ups-inverter' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('ups-inverter')}
          >
            🔋 UPS Batteries
          </button>
          <button
            className={`product-category-btn water ${selectedCategory === 'water' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('water')}
          >
            💧 Water Products
          </button>
        </div>

        {/* Search and Filter Bar */}
        {!loading && !error && inventoryData && (
          <div className="search-filter-bar">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name, SKU, or Ah/VA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="stock-filter-select"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Stock</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading inventory...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={fetchInventory} className="retry-button">Retry</button>
          </div>
        )}

        {/* Inventory Content */}
        {!loading && !error && inventoryData && (
          <div className="current-stock-content">
            {/* Summary Cards */}
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-icon">📦</div>
                <div className="summary-info">
                  <h3>Total Stock</h3>
                  <p className="summary-value">{inventoryData.totalStock || 0} units</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">📊</div>
                <div className="summary-info">
                  <h3>Series Count</h3>
                  <p className="summary-value">{inventoryData.series?.length || 0} series</p>
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-icon">🔋</div>
                <div className="summary-info">
                  <h3>Total Products</h3>
                  <p className="summary-value">
                    {inventoryData.series?.reduce((sum, s) => sum + s.products.length, 0) || 0} products
                  </p>
                </div>
              </div>
            </div>

            {/* Series Sections */}
            {inventoryData.series && inventoryData.series.length > 0 ? (
              <div className="series-sections">
                {inventoryData.series.map((series) => {
                  const filteredProducts = filterProducts(series.products);
                  const sortedProducts = sortProducts(filteredProducts);
                  
                  // Don't show series if no products match the filter
                  if (sortedProducts.length === 0) return null;

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
                            {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
                          </span>
                        </div>
                        <div className="series-stock">
                          <span className="series-stock-label">Total Stock:</span>
                          <span className="series-stock-value">{series.totalStock} units</span>
                        </div>
                      </div>

                      {expandedSeries[series.seriesName] && (
                        <div className="products-table-container">
                          <table className="products-table">
                            <thead>
                              <tr>
                                <th onClick={() => handleSort('sku')} className="sortable">
                                  SKU
                                </th>
                                <th onClick={() => handleSort('name')} className="sortable">
                                  Name
                                </th>
                                <th>Ah/VA</th>
                                <th>Warranty</th>
                                <th onClick={() => handleSort('mrp')} className="sortable">
                                  MRP
                                </th>
                                <th>Selling Price</th>
                                <th onClick={() => handleSort('stock')} className="sortable">
                                  Stock
                                </th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedProducts.map((product) => {
                                const quantity = parseQuantity(product.qty);
                                const stockStatus = getStockStatus(quantity);
                                const mrp = parseFloat(product.mrp_price || product.mrp || 0) || 0;
                                const sellingPrice = parseFloat(product.selling_price || product.price || 0) || 0;

                                return (
                                  <React.Fragment key={product.id}>
                                    <tr>
                                      <td className="sku-cell">
                                        <span className="sku-text">{product.sku || 'N/A'}</span>
                                        {quantity > 0 &&
                                          (productSerialNumbers[product.id] || []).length > 0 && (
                                            <button
                                              type="button"
                                              className="sku-serial-toggle"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenSerialForProduct((prev) => ({
                                                  ...prev,
                                                  [product.id]: !prev[product.id],
                                                }));
                                              }}
                                              aria-label="Toggle serial numbers"
                                            >
                                              ▾
                                            </button>
                                          )}
                                      </td>
                                      <td className="name-cell">{product.name || 'N/A'}</td>
                                      <td>{product.ah_va || 'N/A'}</td>
                                      <td>{product.warranty || 'N/A'}</td>
                                      <td className="price-cell">
                                        ₹{mrp.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                      <td className="price-cell">
                                        ₹{sellingPrice.toLocaleString('en-IN', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2
                                        })}
                                      </td>
                                      <td className="stock-cell">
                                        <span className={`stock-value ${stockStatus.class}`}>
                                          {quantity}
                                        </span>
                                      </td>
                                      <td>
                                        <span className={`misc-chip ${stockStatus.class}`}>
                                          {stockStatus.label}
                                        </span>
                                      </td>
                                    </tr>
                                    {quantity > 0 &&
                                      (productSerialNumbers[product.id] || []).length > 0 &&
                                      openSerialForProduct[product.id] && (
                                    <div
                                      className="products-serial-row"
                                      style={{
                                        padding: '0.5rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        flexWrap: 'nowrap',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: '0.8rem',
                                          fontWeight: 500,
                                          color: 'var(--azb-text-secondary, #475569)',
                                          minWidth: '110px',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        Serial Numbers:
                                      </span>
                                      <div style={{ flex: 1, minWidth: 0, maxWidth: '360px' }}>
                                        <SearchableDropdown
                                          options={(productSerialNumbers[product.id] || []).map((serial) => ({
                                            value: serial,
                                            label: serial,
                                          }))}
                                          value=""
                                          onChange={(value) => {
                                            console.log('Serial selected for product', product.id, value);
                                          }}
                                          placeholder="Serial Number"
                                          isOpen={openSerialForProduct[product.id]}
                                          onOpenChange={(next) =>
                                            setOpenSerialForProduct((prev) => ({
                                              ...prev,
                                              [product.id]: next,
                                            }))
                                          }
                                        />
                                      </div>
                                    </div>
                                    )}
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
              <div className="no-data">
                <div className="no-data-icon">📭</div>
                <h3>No Inventory Found</h3>
                <p>No products found in this category.</p>
              </div>
            )}

            {/* No Results Message for Filters */}
            {!loading && !error && inventoryData && inventoryData.series && 
             inventoryData.series.length > 0 && 
             inventoryData.series.every(series => filterProducts(series.products).length === 0) && (
              <div className="no-data">
                <div className="no-data-icon">🔍</div>
                <h3>No Products Match Your Search</h3>
                <p>Try adjusting your search query or filter criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CurrentStock;

