// client/src/api.js

// Get API base URL - use function to avoid initialization issues
function getApiBase() {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
}

export const API_BASE = getApiBase();

// Module-level token storage
let currentToken = null;

// Export function to set auth token
export function setAuthToken(token) {
  currentToken = token || null;
}

// Function to clear auth when token is invalid (401 errors)
function clearInvalidAuth() {
  // Clear module-level token
  currentToken = null;
  
  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }
  
  // Dispatch event to notify AuthContext to clear state
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('azb-auth-invalid'));
  }
}

// Generic request helper
export async function request(path, options = {}) {
  const url = `${getApiBase()}${path}`;

  // Ensure headers object exists
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // Add Authorization header if token exists
  // Also check localStorage as fallback
  const tokenToUse = currentToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);
  if (tokenToUse) {
    headers.Authorization = `Bearer ${tokenToUse}`;
  } else {
    console.warn('[API] No auth token available for request to:', path);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Parse JSON safely
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
      console.log('[API] Response parsed as JSON:', {
        path,
        status: response.status,
        hasData: !!data,
        dataType: typeof data,
        dataKeys: data && typeof data === 'object' ? Object.keys(data) : []
      });
    } else {
      data = await response.text();
      console.log('[API] Response parsed as text:', { path, status: response.status, dataLength: data?.length });
    }

    if (!response.ok) {
      // Handle 401 Unauthorized - token is invalid or expired
      if (response.status === 401) {
        // Don't clear auth for login endpoint (avoid clearing on login failure)
        if (!path.includes('/auth/login')) {
          console.warn('[API] 401 Unauthorized - clearing invalid token');
          clearInvalidAuth();
        }
      }
      
      // data agar object hai to data.error le sakte hai,
      // warna generic message
      const errorMessage =
        (data && data.error) || (data && data.message) || "Request failed";
      const errorDetails = data && data.details ? `: ${data.details}` : '';
      const fullError = new Error(errorMessage + errorDetails);
      fullError.response = { data, status: response.status };
      throw fullError;
    }

    return data;
  } catch (error) {
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      throw error;
    }
    // Otherwise wrap in Error
    throw new Error(error.message || "Request failed");
  }
}

// Authentication API functions
export async function login(email, password) {
  try {
    console.log('[API] Login request starting for:', email);
    const result = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    console.log('[API] Login response received:', {
      hasResult: !!result,
      resultType: typeof result,
      resultKeys: result ? Object.keys(result) : [],
      hasUser: !!result?.user,
      hasToken: !!result?.token,
      tokenLength: result?.token ? result.token.length : 0
    });
    return result;
  } catch (error) {
    console.error('[API] Login request failed:', error);
    throw error;
  }
}

export async function getCurrentUser() {
  return request("/auth/me", {
    method: "GET",
  });
}

// Signup API functions
export async function sendSignupOTP(email) {
  try {
    return await request("/auth/signup/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.error("Failed to send signup OTP:", error);
    throw error;
  }
}

export async function verifySignupOTP(signupData) {
  try {
    return await request("/auth/signup/verify-otp", {
      method: "POST",
      body: JSON.stringify(signupData),
    });
  } catch (error) {
    console.error("Failed to verify signup OTP:", error);
    throw error;
  }
}

// Forgot Password API functions
export async function sendForgotPasswordOTP(email) {
  try {
    return await request("/auth/forgot-password/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  } catch (error) {
    console.error("Failed to send forgot password OTP:", error);
    throw error;
  }
}

export async function verifyForgotPasswordOTP(forgotPasswordData) {
  try {
    return await request("/auth/forgot-password/verify-otp", {
      method: "POST",
      body: JSON.stringify(forgotPasswordData),
    });
  } catch (error) {
    console.error("Failed to verify forgot password OTP:", error);
    throw error;
  }
}

// Product API functions
export async function fetchProducts() {
  try {
    return await request("/products");
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return null;
  }
}

export async function createProduct(product) {
  try {
    // Ensure token is set before making request
    const tokenToUse = currentToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (tokenToUse && !currentToken) {
      setAuthToken(tokenToUse);
    }
    
    return await request("/products", {
      method: "POST",
      body: JSON.stringify(product),
    });
  } catch (error) {
    console.error("Failed to create product:", error);
    throw error;
  }
}

// Inventory API functions
export async function getInventory(category) {
  try {
    return await request(`/inventory/${category}`);
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    throw error;
  }
}

export async function getAllInventory() {
  try {
    return await request('/inventory');
  } catch (error) {
    console.error('Failed to fetch all inventory:', error);
    throw error;
  }
}

export async function addStock(category, productId, quantity) {
  try {
    return await request(`/inventory/${category}/add-stock`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  } catch (error) {
    console.error('Failed to add stock:', error);
    throw error;
  }
}

export async function reduceStock(category, productId, quantity) {
  try {
    return await request(`/inventory/${category}/reduce-stock`, {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
    });
  } catch (error) {
    console.error('Failed to reduce stock:', error);
    throw error;
  }
}

// Update product pricing (MRP, selling price, discount value) for a product in a category
export async function updateProductPricing(category, productId, pricing) {
  try {
    return await request(`/inventory/${category}/${productId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(pricing),
    });
  } catch (error) {
    console.error('Failed to update product pricing:', error);
    throw error;
  }
}

// Update discount % for all products in a category (bulk update)
export async function updateCategoryDiscount(category, discountPercent, customerType = 'b2c') {
  try {
    return await request(`/inventory/${category}/bulk-discount`, {
      method: 'PUT',
      body: JSON.stringify({
        discount_percent: discountPercent,
        customer_type: customerType
      }),
    });
  } catch (error) {
    console.error('Failed to update category discount:', error);
    throw error;
  }
}

// Dashboard API functions
export async function getDashboardOverview(period = 'today') {
  try {
    return await request(`/dashboard/overview?period=${period}`);
  } catch (error) {
    console.error('Failed to fetch dashboard overview:', error);
    throw error;
  }
}

export async function getSalesAnalytics(period = 'month') {
  try {
    return await request(`/dashboard/sales-analytics?period=${period}`);
  } catch (error) {
    console.error('Failed to fetch sales analytics:', error);
    throw error;
  }
}

export async function getInventoryInsights() {
  try {
    return await request('/dashboard/inventory-insights');
  } catch (error) {
    console.error('Failed to fetch inventory insights:', error);
    throw error;
  }
}

export async function getServiceManagement() {
  try {
    return await request('/dashboard/services');
  } catch (error) {
    console.error('Failed to fetch service management:', error);
    throw error;
  }
}

export async function getRecentTransactions(limit = 10) {
  try {
    return await request(`/dashboard/recent-transactions?limit=${limit}`);
  } catch (error) {
    console.error('Failed to fetch recent transactions:', error);
    throw error;
  }
}

export async function getFinancialOverview(period = 'month') {
  try {
    return await request(`/dashboard/financial?period=${period}`);
  } catch (error) {
    console.error('Failed to fetch financial overview:', error);
    throw error;
  }
}

export async function getSalesDetail(period = 'month') {
  try {
    return await request(`/dashboard/sales-detail?period=${period}`);
  } catch (error) {
    console.error('Failed to fetch detailed sales:', error);
    throw error;
  }
}

// Sales API functions
export async function createSale(saleData) {
  try {
    return await request('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  } catch (error) {
    console.error('Failed to create sale:', error);
    throw error;
  }
}

export async function getSales(page = 1, limit = 20, customerId = null) {
  try {
    let query = `?page=${page}&limit=${limit}`;
    if (customerId) {
      query += `&customer_id=${customerId}`;
    }
    return await request(`/sales${query}`);
  } catch (error) {
    console.error('Failed to fetch sales:', error);
    throw error;
  }
}

export async function getSaleById(saleId) {
  try {
    return await request(`/sales/${saleId}`);
  } catch (error) {
    console.error('Failed to fetch sale:', error);
    throw error;
  }
}

// Pending Orders API functions (Admin/Super Admin only)
export async function getPendingOrders() {
  try {
    return await request('/sales/pending/orders');
  } catch (error) {
    console.error('Failed to fetch pending orders:', error);
    throw error;
  }
}

export async function getPendingOrderByInvoice(invoiceNumber) {
  try {
    return await request(`/sales/pending/orders/${invoiceNumber}`);
  } catch (error) {
    console.error('Failed to fetch pending order:', error);
    throw error;
  }
}

export async function assignSerialNumbers(invoiceNumber, assignments) {
  try {
    return await request(`/sales/pending/orders/${invoiceNumber}/assign-serial`, {
      method: 'PUT',
      body: JSON.stringify({ assignments }),
    });
  } catch (error) {
    console.error('Failed to assign serial numbers:', error);
    throw error;
  }
}

export async function getAvailableSerialsForProduct(productId) {
  try {
    return await request(`/sales/pending/available-serials/${productId}`);
  } catch (error) {
    console.error('Failed to fetch available serials:', error);
    throw error;
  }
}

// Cancel order (Customer only - can only cancel pending orders)
export async function cancelOrder(invoiceNumber) {
  try {
    return await request(`/sales/cancel/${invoiceNumber}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to cancel order:', error);
    throw error;
  }
}

// Cancel order by Admin/Super Admin (can cancel any pending order)
export async function cancelOrderByAdmin(invoiceNumber) {
  try {
    return await request(`/sales/pending/orders/${invoiceNumber}/cancel`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to cancel order:', error);
    throw error;
  }
}

// Stock management API functions
export async function addStockWithSerials(category, productId, quantity, serialNumbers, purchase_date, purchased_from, amount, dp, purchase_value, discount_amount, discount_percent) {
  try {
    return await request(`/inventory/${category}/add-stock-with-serials`, {
      method: 'POST',
      body: JSON.stringify({ 
        productId, 
        quantity, 
        serialNumbers, 
        purchase_date, 
        purchased_from, 
        amount,
        dp,
        purchase_value,
        discount_amount,
        discount_percent
      }),
    });
  } catch (error) {
    console.error('Failed to add stock with serials:', error);
    throw error;
  }
}

export async function getAvailableSerials(category, productId) {
  try {
    return await request(`/inventory/${category}/${productId}/available-serials`);
  } catch (error) {
    console.error('Failed to get available serials:', error);
    throw error;
  }
}

export async function sellStock(category, saleData) {
  try {
    return await request(`/inventory/${category}/sell-stock`, {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  } catch (error) {
    console.error('Failed to sell stock:', error);
    throw error;
  }
}

export async function getStockHistory(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.type) queryParams.append('type', filters.type);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const query = queryParams.toString();
    return await request(`/inventory/history/ledger${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get stock history:', error);
    throw error;
  }
}

// Stock table API functions
export async function getStock(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    
    const query = queryParams.toString();
    return await request(`/inventory/stock${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get stock:', error);
    throw error;
  }
}

// Purchases API functions (new purchase system)
export async function getPurchases(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.supplier) queryParams.append('supplier', filters.supplier);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    
    const query = queryParams.toString();
    return await request(`/purchases${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get purchases:', error);
    throw error;
  }
}

export async function getPurchaseStats(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const query = queryParams.toString();
    return await request(`/purchases/stats${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get purchase stats:', error);
    throw error;
  }
}

export async function getSoldBatteries(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const query = queryParams.toString();
    return await request(`/inventory/sold-batteries${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get sold batteries:', error);
    throw error;
  }
}

// Admin Sales API functions
export async function adminSellStock(saleData) {
  try {
    return await request('/admin-sales/sell-stock', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  } catch (error) {
    console.error('Failed to sell stock (admin):', error);
    throw error;
  }
}

export async function getSalesItems(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.salesType) queryParams.append('salesType', filters.salesType);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);
    
    const query = queryParams.toString();
    return await request(`/admin-sales/sales-items${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get sales items:', error);
    throw error;
  }
}

// Commission Agents API functions
export async function getCommissionAgents(search = '') {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    const query = params.toString();
    return await request(`/commission-agents${query ? `?${query}` : ''}`);
  } catch (error) {
    console.error('Failed to fetch commission agents:', error);
    throw error;
  }
}

export async function getCommissionAgentById(id) {
  try {
    return await request(`/commission-agents/${id}`);
  } catch (error) {
    console.error('Failed to fetch commission agent:', error);
    throw error;
  }
}

export async function createCommissionAgent(agentData) {
  try {
    return await request('/commission-agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  } catch (error) {
    console.error('Failed to create commission agent:', error);
    throw error;
  }
}

export async function updateCommissionAgent(id, agentData) {
  try {
    return await request(`/commission-agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  } catch (error) {
    console.error('Failed to update commission agent:', error);
    throw error;
  }
}

export async function getCommissionAgentHistory(id, filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    const query = params.toString();
    return await request(`/commission-agents/${id}/commission-history${query ? `?${query}` : ''}`);
  } catch (error) {
    console.error('Failed to fetch commission history:', error);
    throw error;
  }
}

// Customer API functions (admin)
export async function getCustomers({ search = '', page = 1, limit = 500 } = {}) {
  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);

    const query = params.toString();
    return await request(`/admin/customers${query ? `?${query}` : ''}`);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    throw error;
  }
}

export async function getCustomerById(id) {
  if (!id) throw new Error('Customer id is required');
  try {
    return await request(`/admin/customers/${id}`);
  } catch (error) {
    console.error('Failed to fetch customer by id:', error);
    throw error;
  }
}

// Invoice API functions
export async function getInvoiceById(invoiceNumber) {
  try {
    return await request(`/invoices/${invoiceNumber}`);
  } catch (error) {
    console.error('Failed to fetch invoice:', error);
    throw error;
  }
}

export async function getInvoicePDF(invoiceNumber) {
  try {
    const response = await fetch(`${getApiBase()}/invoices/${invoiceNumber}/pdf`, {
      headers: {
        'Authorization': `Bearer ${currentToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null)}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch PDF');
    }
    
    return await response.blob();
  } catch (error) {
    console.error('Failed to fetch invoice PDF:', error);
    throw error;
  }
}

// User profile API functions
export async function updateUserProfile(profileData) {
  try {
    return await request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  } catch (error) {
    console.error('Failed to update user profile:', error);
    throw error;
  }
}

// Guarantee & Warranty API functions
export async function getBatteryStatus(serialNumber) {
  try {
    return await request(`/guarantee-warranty/battery-status/${serialNumber}`);
  } catch (error) {
    console.error('Failed to get battery status:', error);
    throw error;
  }
}

export async function getReplacementHistory(customerId = null) {
  try {
    const path = customerId 
      ? `/guarantee-warranty/history/${customerId}`
      : '/guarantee-warranty/history';
    return await request(path);
  } catch (error) {
    console.error('Failed to get replacement history:', error);
    throw error;
  }
}

// Admin / Super Admin: get full guarantee & warranty replacement history
export async function getAllReplacementHistory() {
  try {
    return await request('/guarantee-warranty/history-all');
  } catch (error) {
    console.error('Failed to get all replacement history:', error);
    throw error;
  }
}

export async function getWarrantySlabs() {
  try {
    return await request('/guarantee-warranty/warranty-slabs');
  } catch (error) {
    console.error('Failed to get warranty slabs:', error);
    throw error;
  }
}

export async function createReplacement(replacementData) {
  try {
    return await request('/guarantee-warranty/replace', {
      method: 'POST',
      body: JSON.stringify(replacementData),
    });
  } catch (error) {
    console.error('Failed to create replacement:', error);
    throw error;
  }
}

// Charging Services API functions
export async function getChargingServices(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    
    const query = queryParams.toString();
    return await request(`/charging-services${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get charging services:', error);
    throw error;
  }
}

export async function getMyChargingServices(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    
    const query = queryParams.toString();
    return await request(`/charging-services/my-services${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get my charging services:', error);
    throw error;
  }
}

export async function getChargingServiceById(id) {
  try {
    return await request(`/charging-services/${id}`);
  } catch (error) {
    console.error('Failed to get charging service:', error);
    throw error;
  }
}

export async function createChargingService(serviceData) {
  try {
    return await request('/charging-services', {
      method: 'POST',
      body: JSON.stringify(serviceData),
    });
  } catch (error) {
    console.error('Failed to create charging service:', error);
    throw error;
  }
}

export async function updateChargingServiceStatus(id, status) {
  try {
    return await request(`/charging-services/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  } catch (error) {
    console.error('Failed to update charging service status:', error);
    throw error;
  }
}

export async function updateChargingService(id, serviceData) {
  try {
    return await request(`/charging-services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    });
  } catch (error) {
    console.error('Failed to update charging service:', error);
    throw error;
  }
}

export async function deleteChargingService(id) {
  try {
    return await request(`/charging-services/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete charging service:', error);
    throw error;
  }
}

export async function getChargingServiceStats(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    
    const query = queryParams.toString();
    return await request(`/charging-services/stats/overview${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get charging service stats:', error);
    throw error;
  }
}

// Customer Service Requests (non-charging) API
export async function createServiceRequest(payload) {
  try {
    return await request('/service-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to create service request:', error);
    throw error;
  }
}

export async function getMyServiceRequests(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.serviceType) queryParams.append('serviceType', filters.serviceType);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);

    const query = queryParams.toString();
    return await request(`/service-requests/my${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch my service requests:', error);
    throw error;
  }
}

// Admin/Super Admin: Get all service requests
export async function getAllServiceRequests(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.status && filters.status !== 'all') queryParams.append('status', filters.status);
    if (filters.serviceType) queryParams.append('serviceType', filters.serviceType);
    if (filters.page) queryParams.append('page', filters.page);
    if (filters.limit) queryParams.append('limit', filters.limit);

    const query = queryParams.toString();
    return await request(`/service-requests${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch all service requests:', error);
    throw error;
  }
}

// Admin/Super Admin: Update service request status
export async function updateServiceRequestStatus(id, status, amount = null) {
  try {
    const body = { status };
    if (status === 'completed' && amount !== null && amount !== undefined && amount !== '') {
      body.amount = parseFloat(amount);
    }
    return await request(`/service-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error('Failed to update service request status:', error);
    throw error;
  }
}

// Admin/Super Admin: Confirm pending service request (move to service_requests table)
export async function confirmServiceRequest(id) {
  try {
    return await request(`/service-requests/pending/${id}/confirm`, {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to confirm service request:', error);
    throw error;
  }
}

// Admin/Super Admin: Cancel pending service request
export async function cancelPendingServiceRequestByAdmin(id) {
  try {
    return await request(`/service-requests/pending/${id}/cancel`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to cancel pending service request:', error);
    throw error;
  }
}

// Customer: Cancel own pending service request
export async function cancelPendingServiceRequest(id) {
  try {
    return await request(`/service-requests/my/pending/${id}/cancel`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to cancel pending service request:', error);
    throw error;
  }
}

// Admin/Super Admin: Create service request for customer
export async function createServiceRequestByAdmin(payload) {
  try {
    return await request('/service-requests/admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('Failed to create service request by admin:', error);
    throw error;
  }
}

// Notifications API functions
export async function getNotifications({ unreadOnly = false, limit = 50 } = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (unreadOnly) queryParams.append('unreadOnly', 'true');
    if (limit) queryParams.append('limit', limit);
    
    const query = queryParams.toString();
    return await request(`/notifications${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId) {
  try {
    return await request(`/notifications/${notificationId}/read`, {
      method: 'PUT',
    });
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead() {
  try {
    return await request('/notifications/read-all', {
      method: 'PUT',
    });
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    throw error;
  }
}

export async function getUnreadNotificationCount() {
  try {
    return await request('/notifications/unread-count');
  } catch (error) {
    console.error('Failed to get unread notification count:', error);
    throw error;
  }
}

// Check for expiring guarantees (admin/super admin only)
export async function checkExpiringGuarantees(daysAhead = 7) {
  try {
    return await request('/guarantee-warranty/check-expiring-guarantees', {
      method: 'POST',
      body: JSON.stringify({ daysAhead }),
    });
  } catch (error) {
    console.error('Failed to check expiring guarantees:', error);
    throw error;
  }
}

// Company Returns API functions (for Exide company returns)
export async function getCompanyReturns(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) queryParams.append('sortOrder', filters.sortOrder);
    
    const query = queryParams.toString();
    return await request(`/company-returns${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get company returns:', error);
    throw error;
  }
}

export async function getCompanyReturnById(id) {
  try {
    return await request(`/company-returns/${id}`);
  } catch (error) {
    console.error('Failed to get company return:', error);
    throw error;
  }
}

export async function createCompanyReturn(returnData) {
  try {
    return await request('/company-returns', {
      method: 'POST',
      body: JSON.stringify(returnData),
    });
  } catch (error) {
    console.error('Failed to create company return:', error);
    throw error;
  }
}

export async function updateCompanyReturn(id, returnData) {
  try {
    return await request(`/company-returns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(returnData),
    });
  } catch (error) {
    console.error('Failed to update company return:', error);
    throw error;
  }
}

// Get all sold serial numbers for dropdown
export async function getSoldSerialNumbers(search = '') {
  try {
    const params = new URLSearchParams();
    if (search) {
      params.append('search', search);
    }
    return await request(`/company-returns/sold-serial-numbers?${params.toString()}`);
  } catch (error) {
    console.error("Failed to fetch sold serial numbers:", error);
    throw error;
  }
}

// Customer History API functions
export async function getCustomerHistory(customerId) {
  try {
    return await request(`/inventory/customer-history/${customerId}`);
  } catch (error) {
    console.error('Failed to get customer history:', error);
    throw error;
  }
}

// Employee API functions
export async function getEmployees(isActive = null) {
  try {
    const params = isActive !== null ? `?is_active=${isActive}` : '';
    return await request(`/employees${params}`);
  } catch (error) {
    console.error('Failed to get employees:', error);
    throw error;
  }
}

export async function getEmployeeById(id) {
  try {
    return await request(`/employees/${id}`);
  } catch (error) {
    console.error('Failed to get employee:', error);
    throw error;
  }
}

export async function createEmployee(employeeData) {
  try {
    return await request('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  } catch (error) {
    console.error('Failed to create employee:', error);
    throw error;
  }
}

export async function updateEmployee(id, employeeData) {
  try {
    return await request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  } catch (error) {
    console.error('Failed to update employee:', error);
    throw error;
  }
}

export async function deleteEmployee(id) {
  try {
    return await request(`/employees/${id}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Failed to delete employee:', error);
    throw error;
  }
}

export async function getEmployeeAttendance(id, month = null, year = null) {
  try {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const query = params.toString();
    return await request(`/employees/${id}/attendance${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get employee attendance:', error);
    throw error;
  }
}

export async function addEmployeeAttendance(id, attendanceData) {
  try {
    return await request(`/employees/${id}/attendance`, {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  } catch (error) {
    console.error('Failed to add employee attendance:', error);
    throw error;
  }
}

export async function getDailyAttendance(id, date = null, month = null, year = null) {
  try {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const query = params.toString();
    return await request(`/employees/${id}/daily-attendance${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get daily attendance:', error);
    throw error;
  }
}

export async function markDailyAttendance(id, attendanceData) {
  try {
    return await request(`/employees/${id}/daily-attendance`, {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  } catch (error) {
    console.error('Failed to mark daily attendance:', error);
    throw error;
  }
}

export async function markBulkAttendance(attendanceData) {
  try {
    return await request('/employees/daily-attendance/bulk', {
      method: 'POST',
      body: JSON.stringify(attendanceData),
    });
  } catch (error) {
    console.error('Failed to mark bulk attendance:', error);
    throw error;
  }
}

export async function getEmployeePayments(id, month = null, year = null) {
  try {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const query = params.toString();
    return await request(`/employees/${id}/payments${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to get employee payments:', error);
    throw error;
  }
}

export async function addEmployeePayment(id, paymentData) {
  try {
    return await request(`/employees/${id}/payments`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  } catch (error) {
    console.error('Failed to add employee payment:', error);
    throw error;
  }
}

export async function getEmployeeHistory(id) {
  try {
    return await request(`/employees/${id}/history`);
  } catch (error) {
    console.error('Failed to get employee history:', error);
    throw error;
  }
}

export async function getEmployeeHistoryById(employeeId) {
  try {
    return await request(`/inventory/employee-history/${employeeId}`);
  } catch (error) {
    console.error('Failed to get employee history:', error);
    throw error;
  }
}


// Get sale details by serial number for auto-fill
export async function getSaleBySerialNumber(serialNumber) {
  try {
    return await request(`/company-returns/sale-by-serial/${encodeURIComponent(serialNumber)}`);
  } catch (error) {
    console.error("Failed to fetch sale by serial number:", error);
    throw error;
  }
}

// Reports API functions
export async function getCategorySalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/sales/category${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch category sales report:', error);
    throw error;
  }
}

export async function getProductSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.series) queryParams.append('series', filters.series);
    const query = queryParams.toString();
    return await request(`/reports/sales/product${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch product sales report:', error);
    throw error;
  }
}

export async function getSeriesSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.category) queryParams.append('category', filters.category);
    const query = queryParams.toString();
    return await request(`/reports/sales/series${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch series sales report:', error);
    throw error;
  }
}

export async function getCustomerSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.customerType) queryParams.append('customerType', filters.customerType);
    const query = queryParams.toString();
    return await request(`/reports/sales/customer${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer sales report:', error);
    throw error;
  }
}

export async function getB2BCustomerSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/sales/customer/b2b${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch B2B customer sales report:', error);
    throw error;
  }
}

export async function getB2CCustomerSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/sales/customer/b2c${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch B2C customer sales report:', error);
    throw error;
  }
}

export async function getProfitReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/profit/overall${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch profit report:', error);
    throw error;
  }
}

export async function getAgentCommissionReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.agentId) queryParams.append('agentId', filters.agentId);
    const query = queryParams.toString();
    return await request(`/reports/commission/agent${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch agent commission report:', error);
    throw error;
  }
}

export async function getCommissionDetailsReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.agentId) queryParams.append('agentId', filters.agentId);
    const query = queryParams.toString();
    return await request(`/reports/commission/details${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch commission details report:', error);
    throw error;
  }
}

export async function getChargingServicesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/charging/services${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch charging services report:', error);
    throw error;
  }
}

export async function getChargingCustomerReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/charging/customer${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch charging customer report:', error);
    throw error;
  }
}

export async function getSummaryReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/summary${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch summary report:', error);
    throw error;
  }
}

export async function getServicesTypeReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/services/type${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch services type report:', error);
    throw error;
  }
}

export async function getEmployeeReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/employees${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch employee report:', error);
    throw error;
  }
}

export async function getWaterReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/water${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch water report:', error);
    throw error;
  }
}

// Customer Reports API functions
export async function getCustomerCategorySalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/customer/sales/category${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer category sales report:', error);
    throw error;
  }
}

export async function getCustomerProductSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.category) queryParams.append('category', filters.category);
    if (filters.series) queryParams.append('series', filters.series);
    const query = queryParams.toString();
    return await request(`/reports/customer/sales/product${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer product sales report:', error);
    throw error;
  }
}

export async function getCustomerSeriesSalesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.category) queryParams.append('category', filters.category);
    const query = queryParams.toString();
    return await request(`/reports/customer/sales/series${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer series sales report:', error);
    throw error;
  }
}

export async function getCustomerChargingServicesReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/customer/charging/services${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer charging services report:', error);
    throw error;
  }
}

export async function getCustomerSummaryReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    const query = queryParams.toString();
    return await request(`/reports/customer/summary${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer summary report:', error);
    throw error;
  }
}

export async function getCustomerServiceRequestsReport(filters = {}) {
  try {
    const queryParams = new URLSearchParams();
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);
    if (filters.period) queryParams.append('period', filters.period);
    if (filters.serviceType) queryParams.append('serviceType', filters.serviceType);
    const query = queryParams.toString();
    return await request(`/reports/customer/services${query ? '?' + query : ''}`);
  } catch (error) {
    console.error('Failed to fetch customer service requests report:', error);
    throw error;
  }
}

// Default export object (purane code ke liye)
const api = {
  login,
  getCurrentUser,
  fetchProducts,
  createProduct,
  getInventory,
  getAllInventory,
  addStock,
  reduceStock,
  updateProductPricing,
  updateCategoryDiscount,
  getDashboardOverview,
  getSalesAnalytics,
  getInventoryInsights,
  getServiceManagement,
  getRecentTransactions,
  getFinancialOverview,
  getSalesDetail,
  createSale,
  getSales,
  getSaleById,
  getPendingOrders,
  getPendingOrderByInvoice,
  assignSerialNumbers,
  getAvailableSerialsForProduct,
  cancelOrder,
  cancelOrderByAdmin,
  addStockWithSerials,
  getAvailableSerials,
  sellStock,
  getStockHistory,
  getStock,
  getPurchases,
  getPurchaseStats,
  getSoldBatteries,
  adminSellStock,
  getSalesItems,
  getCustomers,
  getCustomerById,
  getInvoiceById,
  getInvoicePDF,
  getBatteryStatus,
  getReplacementHistory,
  getAllReplacementHistory,
  getWarrantySlabs,
  createReplacement,
  getChargingServices,
  getMyChargingServices,
  getChargingServiceById,
  createChargingService,
  updateChargingServiceStatus,
  updateChargingService,
  deleteChargingService,
  getChargingServiceStats,
  createServiceRequest,
  getMyServiceRequests,
  getAllServiceRequests,
  updateServiceRequestStatus,
  confirmServiceRequest,
  cancelPendingServiceRequestByAdmin,
  cancelPendingServiceRequest,
  createServiceRequestByAdmin,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  checkExpiringGuarantees,
  getCustomerHistory,
  getCommissionAgents,
  getCommissionAgentById,
  createCommissionAgent,
  updateCommissionAgent,
  getCommissionAgentHistory,
  // Employee API functions
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getEmployeeAttendance,
  addEmployeeAttendance,
  getDailyAttendance,
  markDailyAttendance,
  markBulkAttendance,
  getEmployeePayments,
  addEmployeePayment,
  getEmployeeHistory,
  getEmployeeHistoryById,
  request,
  setAuthToken,
};

export default api;
