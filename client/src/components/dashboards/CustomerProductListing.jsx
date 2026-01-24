import React, { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useLocation } from 'react-router-dom';
import api from '../../api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import PaymentModal from './PaymentModal';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './CustomerProductListing.css';

const STORAGE_KEY = 'customerProductListingState';

const CustomerProductListing = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState(() => savedState?.selectedCategory || null);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => savedState?.searchQuery || '');
  const [selectedSeries, setSelectedSeries] = useState(() => savedState?.selectedSeries || 'all');
  const [paymentModal, setPaymentModal] = useState(null);
  const [isMobileTablet, setIsMobileTablet] = useState(false);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Check if mobile/tablet
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobileTablet(window.innerWidth <= 1024);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      selectedCategory,
      searchQuery,
      selectedSeries
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [selectedCategory, searchQuery, selectedSeries, isInitialMount]);

  // Read URL params on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const categoryParam = searchParams.get('category');
    const seriesParam = searchParams.get('series');
    
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
    
    if (seriesParam) {
      const decodedSeries = decodeURIComponent(seriesParam);
      setSelectedSeries(decodedSeries);
      // Also set search query to help with filtering
      setSearchQuery('');
    }
  }, [location.search]);

  // Apply series filter after products are loaded
  useEffect(() => {
    if (filteredProducts.length > 0 && selectedSeries !== 'all') {
      // Verify the series exists in the loaded products
      const seriesExists = filteredProducts.some(p => (p.series || '') === selectedSeries);
      if (!seriesExists) {
        // If series doesn't exist, reset to 'all' but keep the category
        const searchParams = new URLSearchParams(location.search);
        if (searchParams.get('series')) {
          // Series was in URL but doesn't exist, reset it
          setSelectedSeries('all');
        }
      }
    }
  }, [filteredProducts, selectedSeries, location.search]);

  // Scroll to series section when URL has series parameter - Fast scroll without visible delay
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const seriesParam = searchParams.get('series');
    
    if (seriesParam && selectedCategory && filteredProducts.length > 0 && selectedSeries !== 'all') {
      const findSeriesElement = () => {
        const seriesName = decodeURIComponent(seriesParam);
        let seriesElement = null;
        
        // Method 1: Find by data-series attribute (exact match)
        seriesElement = document.querySelector(`[data-series="${seriesName}"]`);
        
        // Method 2: Find by series name in the header text (case-insensitive, flexible matching)
        if (!seriesElement) {
          const allSeriesSections = document.querySelectorAll('.product-series-section');
          seriesElement = Array.from(allSeriesSections).find(el => {
            const header = el.querySelector('.series-name');
            if (header) {
              const headerText = header.textContent.trim().toUpperCase();
              const searchText = seriesName.toUpperCase();
              
              // Remove "EXIDE" prefix for matching if present
              const headerTextClean = headerText.replace(/^EXIDE\s+/i, '');
              const searchTextClean = searchText.replace(/^EXIDE\s+/i, '');
              
              // Check for exact match, contains match, or if either contains the other
              return headerText === searchText || 
                     headerText.includes(searchText) || 
                     searchText.includes(headerText) ||
                     headerTextClean === searchTextClean ||
                     headerTextClean.includes(searchTextClean) ||
                     searchTextClean.includes(headerTextClean);
            }
            return false;
          });
        }
        
        // Method 3: Try finding by ID
        if (!seriesElement) {
          const seriesId = seriesName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          seriesElement = document.querySelector(`#${seriesId}`);
        }
        
        return seriesElement;
      };
      
      const scrollToElement = (element) => {
        if (!element) return;
        
        const elementTop = element.getBoundingClientRect().top + window.pageYOffset;
        const offset = 120;
        
        // Scroll immediately
        window.scrollTo({
          top: elementTop - offset,
          behavior: 'smooth'
        });
        
        // Add highlight effect
        requestAnimationFrame(() => {
          element.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          element.style.boxShadow = '0 0 30px rgba(220, 38, 38, 0.6)';
          element.style.borderColor = '#dc2626';
          
          setTimeout(() => {
            element.style.boxShadow = '';
            element.style.borderColor = '';
          }, 3000);
        });
      };
      
      // Try to find and scroll immediately using multiple requestAnimationFrame calls
      // This ensures we catch the element as soon as it's rendered
      let attempts = 0;
      const maxAttempts = 10; // Maximum 10 attempts (about 160ms total)
      
      const tryScroll = () => {
        const element = findSeriesElement();
        if (element) {
          scrollToElement(element);
          return true;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          // Try again on next frame (about 16ms delay)
          requestAnimationFrame(tryScroll);
        }
        return false;
      };
      
      // Start trying immediately
      requestAnimationFrame(tryScroll);
    }
  }, [filteredProducts, selectedCategory, selectedSeries, location.search]);

  // Fetch products function
  const fetchProducts = useCallback(async () => {
    if (!selectedCategory) {
      setFilteredProducts([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Map category IDs to database category values
      const categoryMap = {
        'car-truck-tractor': 'car-truck-tractor',
        'bike': 'bike',
        'ups-inverter': 'ups-inverter',
      };
      
      const dbCategory = categoryMap[selectedCategory] || selectedCategory;
      const data = await api.request(`/products?category=${encodeURIComponent(dbCategory)}`, { 
        method: 'GET' 
      });
      setFilteredProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || t('products.failedToLoad'));
      setFilteredProducts([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, t]);

  // Fetch products when category changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleCategoryClick = (category) => {
    setSelectedCategory(category);
    setSearchQuery(''); // Clear search when switching categories
    setSelectedSeries('all'); // Reset series filter
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setFilteredProducts([]);
    setSearchQuery('');
    setSelectedSeries('all');
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Pricing helper: Use actual selling_price from database, calculate discount from that
  const getPricing = (product) => {
    const mrp = parseFloat(product.mrp_price ?? product.mrp ?? product.price ?? 0) || 0;
    const isB2B =
      user?.user_type === 'b2b' ||
      user?.is_business_customer === true ||
      user?.is_business_customer === 'true';
    
    // Use B2B price if customer is B2B, otherwise use regular B2C price
    const sellingPrice = isB2B 
      ? parseFloat(product.b2b_price ?? product.b2b_selling_price ?? product.selling_price ?? product.price ?? 0) || 0
      : parseFloat(product.selling_price ?? product.price ?? 0) || 0;
    
    // Calculate actual discount percentage from stored values
    const discountAmount = mrp > sellingPrice ? mrp - sellingPrice : 0;
    const discountPercent = mrp > 0 ? Math.round((discountAmount / mrp) * 100) : 0;
    const savings = Math.max(0, discountAmount);
    return { mrp, sellingPrice, savings, discountPercent, isB2B };
  };

  const handleBuyClick = async (product) => {
    // Force immediate re-render using flushSync to ensure modal opens instantly
    flushSync(() => {
      const isB2B =
        user?.customer_type === 'wholesale' ||
        user?.is_business_customer === true ||
        user?.is_business_customer === 'true';
      
      // Use B2B price if customer is B2B, otherwise use regular B2C price
      const sellingPrice = isB2B 
        ? parseFloat(product.b2b_price ?? product.b2b_selling_price ?? product.selling_price ?? product.price ?? 0) || 0
        : parseFloat(product.selling_price ?? product.price ?? 0) || 0;
      
      // Use actual selling_price from database - don't recalculate
      // Ensure mrp_price and selling_price are properly set from product
      setPaymentModal({
        product: { 
          ...product, 
          mrp_price: product.mrp_price || product.mrp || product.price || 0,
          selling_price: sellingPrice
        },
        category: selectedCategory,
      });
    });
  };

  const handlePaymentSuccess = async (sale) => {
    // Refresh products to update stock
    fetchProducts();
    setPaymentModal(null);
  };

  const handlePaymentClose = () => {
    setPaymentModal(null);
  };

  // Category definitions
  const categories = [
    {
      id: 'car-truck-tractor',
      name: t('products.category.carTruckTractor'),
      shortName: 'Car & Truck',
      icon: '🚗',
      image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop',
      description: t('products.category.description.carTruckTractor'),
    },
    {
      id: 'bike',
      name: t('products.category.bike'),
      shortName: 'Bike',
      icon: '🏍️',
      image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&h=600&fit=crop',
      description: t('products.category.description.bike'),
    },
    {
      id: 'ups-inverter',
      name: t('products.category.upsInverter'),
      shortName: 'Inverter & Battery',
      icon: '⚡',
      image: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&h=600&fit=crop',
      description: t('products.category.description.upsInverter'),
    },
  ];

  // If category is selected, show products
  if (selectedCategory) {
    const categoryInfo = categories.find((cat) => cat.id === selectedCategory);
    
    return (
      <div className="customer-product-listing">
        <div className="product-header">
          <div className="product-header-top">
            <button className="back-button" onClick={handleBackToCategories}>
              ← {t('products.backToCategories')}
            </button>
          </div>
          <h2 className="product-header-title">{categoryInfo?.name || t('products.title')}</h2>
        </div>

        {/* Search and Filters Bar - All in one line */}
        <div className="search-filters-container">
          {/* Search Bar */}
          <div className="search-wrapper">
            <div className="search-icon-wrapper">
              <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder={isMobileTablet ? '' : t('products.searchPlaceholder')}
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button className="search-clear-button" onClick={handleClearSearch} aria-label="Clear search">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          {/* Filters Row - Side by side on mobile/tablet */}
          <div className="filters-row">
            {/* Series Filter */}
            <div className="filter-wrapper series-filter-wrapper">
              <select
                id="series-filter"
                className="filter-select series-filter"
                value={selectedSeries}
                onChange={(e) => setSelectedSeries(e.target.value)}
              >
                <option value="all">All Series</option>
                {(() => {
                  // Get unique series from all products (before filtering)
                  const uniqueSeries = [...new Set(filteredProducts.map(p => p.series).filter(Boolean))].sort();
                  return uniqueSeries.map(series => (
                    <option key={series} value={series}>{series}</option>
                  ));
                })()}
              </select>
            </div>

          </div>
        </div>

        {loading && <div className="loading-message">{t('products.loadingProducts')}</div>}
        {error && <div className="error-message">{error}</div>}

        {!loading && !error && filteredProducts.length === 0 && (
          <div className="no-products">
            <p>{t('products.noProducts')}</p>
            <p className="hint">{t('products.loadingProducts')}</p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="products-by-series">
            {(() => {
              // Define series order as per original lists
              const seriesOrder = {
                'car-truck-tractor': [
                  'EXIDE EPIQ',
                  'EXIDE MATRIX',
                  'EXIDE MILEAGE ISS',
                  'EXIDE MILEAGE',
                  'EXIDE EEZY ISS',
                  'EXIDE EEZY',
                  'EXIDE RIDE',
                  'EXIDE XPRESS',
                  'EXIDE JAI KISAN',
                  'EXIDE DRIVE',
                  'EXIDE EKO',
                ],
                'bike': [
                  'EXIDE XPLORE',
                ],
                'ups-inverter': [],
              };

              // Filter products based on search query and series
              const searchLower = searchQuery.toLowerCase().trim();
              let productsToDisplay = filteredProducts;

              // Apply search filter
              if (searchLower) {
                productsToDisplay = productsToDisplay.filter((product) => {
                  const series = (product.series || '').toLowerCase();
                  const name = (product.name || '').toLowerCase();
                  const sku = (product.sku || '').toLowerCase();
                  return series.includes(searchLower) || name.includes(searchLower) || sku.includes(searchLower);
                });
              }

              // Apply series filter
              if (selectedSeries !== 'all') {
                productsToDisplay = productsToDisplay.filter((product) => {
                  return (product.series || '') === selectedSeries;
                });
              }


              // Group products by series while maintaining order
              const seriesMap = new Map();
              const seriesOrderMap = new Map();
              const seriesMatchMap = new Map(); // Track if series matches search
              
              productsToDisplay.forEach((product) => {
                const series = product.series || 'Other';
                if (!seriesMap.has(series)) {
                  seriesMap.set(series, []);
                  // Get order index for series
                  const category = selectedCategory || 'car-truck-tractor';
                  const order = seriesOrder[category]?.indexOf(series) ?? 999;
                  seriesOrderMap.set(series, order);
                  
                  // Check if series matches search
                  const seriesMatches = searchLower ? series.toLowerCase().includes(searchLower) : false;
                  seriesMatchMap.set(series, seriesMatches);
                }
                seriesMap.get(series).push(product);
              });

              // Sort products within each series by order_index (maintain original order)
              // If searching, prioritize products that match the search
              seriesMap.forEach((products, series) => {
                if (searchLower) {
                  products.sort((a, b) => {
                    const aName = (a.name || '').toLowerCase();
                    const bName = (b.name || '').toLowerCase();
                    const aMatches = aName.includes(searchLower);
                    const bMatches = bName.includes(searchLower);
                    
                    // Products matching search come first
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                    
                    // Then sort by order_index
                    const orderA = a.order_index ?? a.id ?? 999;
                    const orderB = b.order_index ?? b.id ?? 999;
                    return orderA - orderB;
                  });
                } else {
                  products.sort((a, b) => {
                    const orderA = a.order_index ?? a.id ?? 999;
                    const orderB = b.order_index ?? b.id ?? 999;
                    return orderA - orderB;
                  });
                }
              });

              // Convert to array and sort by series order
              // If searching, matching series come first
              const sortedSeries = Array.from(seriesMap.entries()).sort((a, b) => {
                const aMatches = seriesMatchMap.get(a[0]) || false;
                const bMatches = seriesMatchMap.get(b[0]) || false;
                
                // Matching series come first
                if (searchLower) {
                  if (aMatches && !bMatches) return -1;
                  if (!aMatches && bMatches) return 1;
                }
                
                // Then sort by series order
                const orderA = seriesOrderMap.get(a[0]) ?? 999;
                const orderB = seriesOrderMap.get(b[0]) ?? 999;
                return orderA - orderB;
              });

              // Show message if no results found
              if (sortedSeries.length === 0 && searchLower) {
                return (
                  <div className="no-search-results">
                    <div className="no-search-icon">🔍</div>
                    <h3>{t('products.noSearchResults')}</h3>
                    <p>{t('products.tryDifferentTerm')}</p>
                  </div>
                );
              }

              return sortedSeries.map(([series, seriesProducts]) => {
                // Products are already sorted by order_index above
                const sortedProducts = seriesProducts;
                
                // Create a unique ID for the series section for scrolling
                const seriesId = series.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

                return (
                  <div key={series} id={seriesId} className="product-series-section" data-series={series}>
                    <div className="series-header">
                      <h3 className="series-name">{series}</h3>
                      <span className="series-count">{sortedProducts.length} {t('products.productsCount')}</span>
                    </div>
                    <div className="products-grid">
                  {sortedProducts.map((product) => {
                  const { mrp, sellingPrice, savings } = getPricing(product);
                      const warranty = product.warranty || 'N/A';
                      const ahVa = product.ah_va || 'N/A';

                      return (
                        <div key={product.id || product.sku} className="product-card">
                          <div className="product-image-placeholder">
                            <span className="product-icon">🔋</span>
                            {ahVa !== 'N/A' && (
                              <div className="ah-badge">{ahVa}Ah</div>
                            )}
                          </div>
                          <div className="product-info">
                            <h3 className="product-name">{product.name || t('products.title')}</h3>
                            <div className="product-details">
                              <div className="detail-row">
                                <span className="detail-label">{t('products.productCode')}</span>
                                <span className="detail-value">{product.sku || 'N/A'}</span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">{t('products.ahVa')}</span>
                                <span className="detail-value">{ahVa}</span>
                              </div>
                              <div className="detail-row">
                                <span className="detail-label">{t('products.warranty')}</span>
                                <span className="detail-value warranty-text">{warranty}</span>
                              </div>
                            </div>
                            <div className="price-section">
                              <div className="mrp-price">
                                <span className="mrp-label">{t('products.mrp')}</span>
                                <span className="mrp-value">₹{mrp.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="selling-price">
                                <span className="selling-label">{t('products.sellingPrice')}</span>
                                <span className="selling-value">₹{Math.round(sellingPrice).toLocaleString('en-IN')}</span>
                              </div>
                              {mrp > sellingPrice && (
                                <div className="discount-badge">
                                  {t('products.saveAmount')} ₹{Math.round(savings).toLocaleString('en-IN')}
                                </div>
                              )}
                            </div>
                            <button
                              className="buy-button"
                              onClick={() => handleBuyClick(product)}
                            >
                              {t('products.buyNow')}
                            </button>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Payment Modal - Render in category view as well so it opens immediately on Buy */}
        {paymentModal && paymentModal.product && (
          <PaymentModal
            key={`modal-${paymentModal.product.id}`}
            product={paymentModal.product}
            category={paymentModal.category}
            onClose={handlePaymentClose}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </div>
    );
  }

  // Show category selection
  return (
    <div className="customer-product-listing">
      {/* Impressive Header Section */}
      <div className="product-hero-section">
        <div className="hero-badge">
          <span className="badge-icon">⭐</span>
          <span className="badge-text">{t('products.hero.badge')}</span>
        </div>
        <h1 className="hero-title">{t('products.hero.title')}</h1>
        <p className="hero-subtitle">
          {t('products.hero.subtitle')}
        </p>
        <p className="hero-description">
          {t('products.hero.description')}
        </p>
      </div>

      {/* Category Buttons */}
      <div className="category-section">
        <h2 className="category-title">{t('products.browseByCategory')}</h2>
        <div className="category-buttons-grid">
          {categories.map((category) => (
            <button
              key={category.id}
              className="category-button"
              onClick={() => handleCategoryClick(category.id)}
            >
              <div className="category-button-bg" style={{ backgroundImage: `url(${category.image})` }}>
                <div className="category-overlay"></div>
              </div>
              <div className="category-content">
                <div className="category-icon">{category.icon}</div>
                <h3 className="category-name">{category.name}</h3>
                <p className="category-description">{category.description}</p>
                <div className="category-arrow">→</div>
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Payment Modal - Always render when state is set */}
      {paymentModal && paymentModal.product && (
        <PaymentModal
          key={`modal-${paymentModal.product.id}`}
          product={paymentModal.product}
          category={paymentModal.category}
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default CustomerProductListing;

