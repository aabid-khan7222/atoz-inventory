// client/src/components/dashboards/UserManagement.jsx

import React, { useEffect, useState, useLayoutEffect } from "react";
import api from "../../api";
import Swal from 'sweetalert2';
import "./UserManagement.css";

const UserManagement = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const initialCustomerState = {
    full_name: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    pincode: "",
    address: "",
    password: "",
    has_gst: false,
    gst_number: "",
    company_name: "",
    company_address: "",
  };

  const [newCustomer, setNewCustomer] = useState(initialCustomerState);
  const [editCustomer, setEditCustomer] = useState(initialCustomerState);
  const [formError, setFormError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [editFormError, setEditFormError] = useState("");
  const [editFormErrors, setEditFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [customers, setCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]); // Store all customers for client-side filtering
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [filterType, setFilterType] = useState('all'); // 'all', 'b2b', 'b2c'

  // Prevent body scroll when modals are open
  useLayoutEffect(() => {
    if (showAddModal || showEditModal) {
      // Store original body styles
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const originalWidth = document.body.style.width;
      
      // Get current scroll position
      const scrollY = window.scrollY;
      
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      // Prevent scroll on overlay
      const preventScroll = (e) => {
        // Allow scrolling inside modal content
        const modalContent = e.target.closest('.user-modal');
        if (!modalContent) {
          e.preventDefault();
        }
      };
      
      // Prevent touchmove on overlay (mobile)
      const preventTouchMove = (e) => {
        const modalContent = e.target.closest('.user-modal');
        if (!modalContent) {
          e.preventDefault();
        }
      };
      
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchmove', preventTouchMove, { passive: false });
      
      return () => {
        // Restore original body styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = originalWidth;
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
        
        // Remove event listeners
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchmove', preventTouchMove);
      };
    }
  }, [showAddModal, showEditModal]);

  // Keep editCustomer in-sync if editingCustomer changes
  useEffect(() => {
    if (!editingCustomer) return;
    // Ensure pincode is string (never null/undefined)
    const processedPincode = editingCustomer.pincode != null ? String(editingCustomer.pincode).trim() : "";
    // Use the actual customer type (is_b2b) to determine if customer is B2B or B2C
    // GST details can exist for both B2B and B2C customers
    const isB2B = !!editingCustomer.is_b2b;
    setEditCustomer((prev) => ({
      full_name: editingCustomer.name || prev.full_name || "",
      phone: editingCustomer.phone || prev.phone || "",
      email: editingCustomer.email || prev.email || "",
      state: editingCustomer.state || prev.state || "",
      city: editingCustomer.city || prev.city || "",
      pincode: processedPincode,
      address: editingCustomer.address || prev.address || "",
      has_gst: isB2B, // Set based on actual customer type (B2B/B2C)
      // Preserve GST fields even for B2C customers (they can have GST details)
      gst_number: editingCustomer.gst_number || "",
      company_name: editingCustomer.company || "",
      company_address: editingCustomer.company_address || "",
    }));
    // Clear previous edit form errors when loading new customer
    setEditFormError("");
    setEditFormErrors({});
  }, [editingCustomer]);

  // ---------- CREATE CUSTOMER ----------
  const handleCreateCustomer = async (e) => {
    e.preventDefault();

    setFormError("");
    setFormErrors({});

    const errors = {};
    const trimmedName = (newCustomer.full_name || "").trim();
    const trimmedPhone = (newCustomer.phone || "").trim();
    const trimmedPincode = (newCustomer.pincode || "").trim();

    if (!trimmedName) errors.full_name = "Full name is required";

    if (!trimmedPhone) {
      errors.phone = "Mobile number is required";
    } else if (!/^\d{10}$/.test(trimmedPhone)) {
      errors.phone = "Mobile number must be 10 digits";
    }

    // pincode optional but if present, must be 6 digits
    if (trimmedPincode && !/^\d{6}$/.test(trimmedPincode)) {
      errors.pincode = "Pincode must be 6 digits";
    }

    if (!newCustomer.password) {
      errors.password = "Password is required";
    }

    // If GST checked, require gst_number and company_name and company_address
    if (newCustomer.has_gst) {
      if (!newCustomer.gst_number || !newCustomer.gst_number.trim()) {
        errors.gst_number = "GST number is required for B2B customers";
      }
      if (!newCustomer.company_name || !newCustomer.company_name.trim()) {
        errors.company_name = "Company name is required for B2B customers";
      }
      if (!newCustomer.company_address || !newCustomer.company_address.trim()) {
        errors.company_address = "Company address is required for B2B customers";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setFormError("Fix errors first");
      return;
    }

    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      email: newCustomer.email?.trim() || null,
      state: newCustomer.state?.trim() || null,
      city: newCustomer.city?.trim() || null,
      pincode: trimmedPincode && trimmedPincode.length > 0 ? trimmedPincode : null,
      address: newCustomer.address?.trim() || null,
      is_b2b: !!newCustomer.has_gst,
      company: newCustomer.company_name?.trim() || null,
      gst_number: newCustomer.gst_number?.trim() || null,
      company_address: newCustomer.company_address?.trim() || null,
      password: newCustomer.password,
    };

    try {
      setSaving(true);

      const response = await api.request("/admin/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        setFormError(response.error || "Failed to create customer");
        return;
      }

      setShowAddModal(false);
      setNewCustomer(initialCustomerState);
      fetchCustomers();
    } catch (err) {
      setFormError(err.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  // ---------- FETCH CUSTOMERS ----------
  const fetchCustomers = async () => {
    setLoading(true);
    setError("");

    try {
      const q = searchTerm.trim();
      // Fetch all customers with a very large limit to get all records
      const query = `?page=1&limit=10000&search=${encodeURIComponent(q)}`;

      const data = await api.request(`/admin/customers${query}`, {
        method: "GET",
      });

      const items = data.items || [];
      setAllCustomers(items);
      setCustomers(items);
    } catch (err) {
      setError(err.message || "Failed to fetch customers.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch customers on component mount
  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also fetch when searchTerm changes (after user stops typing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCustomers();
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleSearchSubmit = () => {
    fetchCustomers();
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    applyFiltersAndSort();
  };

  const applyFiltersAndSort = () => {
    let filtered = [...allCustomers];

    // Apply type filter
    if (filterType === 'b2b') {
      filtered = filtered.filter(c => !!c.is_b2b);
    } else if (filterType === 'b2c') {
      filtered = filtered.filter(c => !c.is_b2b);
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal, bVal;

        switch (sortConfig.key) {
          case 'name':
            aVal = (a.name || '').toLowerCase();
            bVal = (b.name || '').toLowerCase();
            break;
          case 'email':
            aVal = (a.email || '').toLowerCase();
            bVal = (b.email || '').toLowerCase();
            break;
          case 'phone':
            aVal = (a.phone || '').toLowerCase();
            bVal = (b.phone || '').toLowerCase();
            break;
          case 'city':
            aVal = (a.city || '').toLowerCase();
            bVal = (b.city || '').toLowerCase();
            break;
          case 'company':
            aVal = (a.company || '').toLowerCase();
            bVal = (b.company || '').toLowerCase();
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setCustomers(filtered);
  };

  useEffect(() => {
    applyFiltersAndSort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, sortConfig]);

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) return '↕️';
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  // ---------- EDIT CUSTOMER ----------
  const handleEditCustomer = async (customer) => {
    try {
      // Fetch the full customer record to ensure we have the latest data including pincode
      const fullCustomer = await api.request(`/admin/customers/${customer.id}`, {
        method: "GET",
      });
      
      // store raw fetched record also in editingCustomer so update uses correct id and we keep original DB snapshot
      setEditingCustomer(fullCustomer);

      // setShowEditModal will be triggered by the editingCustomer useEffect which synchronizes editCustomer
      setShowEditModal(true);
      setEditFormError("");
      setEditFormErrors({});
    } catch (err) {
      // Fallback: open edit modal with the list item data
      setEditingCustomer(customer);
      setShowEditModal(true);
      setEditFormError("Failed to load full customer data, using available data.");
      setEditFormErrors({});
    }
  };

  const formatDateTime = (value) => {
    if (!value) return "";
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      return date.toLocaleString();
    } catch {
      return "";
    }
  };

  const formatCurrency = (value) => {
    if (value == null) return "-";
    const num = Number(value);
    if (Number.isNaN(num)) return "-";
    return `₹${num.toLocaleString("en-IN")}`;
  };

  const handleUpdateCustomer = async (e) => {
    e.preventDefault();

    setEditFormError("");
    setEditFormErrors({});

    const errors = {};
    const trimmedName = (editCustomer.full_name || "").trim();
    const trimmedPhone = (editCustomer.phone || "").trim();
    const trimmedPincode = (editCustomer.pincode || "").trim();

    if (!trimmedName) errors.full_name = "Full name is required";

    if (!trimmedPhone) {
      errors.phone = "Mobile number is required";
    } else if (!/^\d{10}$/.test(trimmedPhone)) {
      errors.phone = "Mobile number must be 10 digits";
    }

    // pincode optional but if present, must be 6 digits
    if (trimmedPincode && !/^\d{6}$/.test(trimmedPincode)) {
      errors.pincode = "Pincode must be 6 digits";
    }

    // GST fields are optional - no validation required based on customer type
    // Customer type (B2B/B2C) and GST details are independent

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      setEditFormError("Fix errors first");
      return;
    }

    // Respect the checkbox state for GST/B2B flag
    const finalIsB2B = !!editCustomer.has_gst;
    
    // Decide final pincode to send:
    // - If user typed a valid pincode (trimmedPincode length > 0) -> send it.
    // - If user left pincode blank in the edit form, preserve the existing DB pincode (from editingCustomer).
    // - If no existing DB pincode and blank -> send null.
    let finalPincode = null;
    if (trimmedPincode.length > 0) {
      finalPincode = trimmedPincode;
    } else if (editingCustomer && editingCustomer.pincode != null && String(editingCustomer.pincode).trim().length > 0) {
      finalPincode = String(editingCustomer.pincode).trim();
    } else {
      finalPincode = null;
    }
    
    // Build payload with pincode included (using finalPincode)
    // GST fields are preserved regardless of customer type (B2C can have GST too)
    const payload = {
      name: trimmedName,
      phone: trimmedPhone,
      email: editCustomer.email?.trim() || null,
      state: editCustomer.state?.trim() || null,
      city: editCustomer.city?.trim() || null,
      pincode: finalPincode,
      address: editCustomer.address?.trim() || null,
      is_b2b: finalIsB2B,  // This will change user_type in backend
      company: editCustomer.company_name?.trim() || null,
      gst_number: editCustomer.gst_number?.trim() || null,
      company_address: editCustomer.company_address?.trim() || null,
    };

    try {
      setUpdating(true);

      const response = await api.request(`/admin/customers/${editingCustomer?.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (!response.success) {
        console.error('[UserManagement] Update failed:', response.error);
        setEditFormError(response.error || "Failed to update customer");
        return;
      }

      console.log('[UserManagement] Update successful, customer data:', response.customer);
      
      setShowEditModal(false);
      setEditingCustomer(null);
      setEditCustomer(initialCustomerState);
      
      // Refresh the customer list to show updated data
      await fetchCustomers();
      
      // Show success message
      setEditFormError("");
    } catch (err) {
      console.error('[UserManagement] Update error:', err);
      setEditFormError(err.message || "Failed to update customer");
    } finally {
      setUpdating(false);
    }
  };

  // ---------- DELETE CUSTOMER ----------
  const handleDeleteCustomer = async (customerId, customerName) => {
    // Confirm deletion
    const result = await Swal.fire({
      title: 'Are you sure?',
      html: `Do you want to permanently delete customer <strong>"${customerName}"</strong>?<br><br>This will also delete all related sales and services records.<br><br><strong>This action cannot be undone!</strong>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) {
      return;
    }

    setDeletingId(customerId);
    setError("");

    try {
      const response = await api.request(`/admin/customers/${customerId}`, {
        method: "DELETE",
      });

      if (!response.success) {
        await Swal.fire('Error!', response.error || "Failed to delete customer", 'error');
        setError(response.error || "Failed to delete customer");
        return;
      }

      await Swal.fire('Deleted!', `Customer "${customerName}" has been permanently deleted.`, 'success');
      // Refresh the customer list
      fetchCustomers();
    } catch (err) {
      await Swal.fire('Error!', err.message || "Failed to delete customer", 'error');
      setError(err.message || "Failed to delete customer");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="dashboard-content user-management-root">
      <div className="user-management-header">
        <h2>User Management</h2>
        <button
          type="button"
          className="add-customer-btn"
          onClick={() => {
            setNewCustomer(initialCustomerState);
            setShowAddModal(true);
            setFormError("");
            setFormErrors({});
          }}
        >
          + Add Customer
        </button>
      </div>

      {/* SEARCH AND FILTER */}
      <div className="user-management-controls">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="user-management-search-row"
          autoComplete="off"
        >
          <input
            type="text"
            placeholder="Search by name, email, phone, city, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearchSubmit();
              }
            }}
          />
          <button type="button" onClick={handleSearchSubmit}>
            Search
          </button>
        </form>
        <div className="user-management-filter">
          <label>Filter:</label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Customers</option>
            <option value="b2b">B2B </option>
            <option value="b2c">B2C </option>
          </select>
        </div>
      </div>

      {error && <p className="user-management-error">{error}</p>}
      {loading && <p className="user-management-loading">Loading...</p>}

      {/* TABLE */}
      {!loading && customers.length > 0 && (
        <div className="user-table-wrapper">
          <table className="user-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="sortable" onClick={() => handleSort('name')}>
                  Name
                </th>
                <th>Type</th>
                <th className="sortable" onClick={() => handleSort('email')}>
                  Email
                </th>
                <th className="sortable" onClick={() => handleSort('phone')}>
                  Phone
                </th>
                <th className="sortable" onClick={() => handleSort('city')}>
                  City
                </th>
                <th className="sortable" onClick={() => handleSort('company')}>
                  Company
                </th>
                <th>GST</th>
                <th className="actions-column-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((cust, index) => {
                const isB2B = !!cust.is_b2b;
                return (
                  <tr key={cust.id}>
                    <td>{index + 1}</td>
                    <td>{cust.name}</td>
                    <td>
                      {isB2B ? (
                        <span className="customer-type-badge customer-type-b2b">
                          B2B
                        </span>
                      ) : (
                        <span className="customer-type-badge customer-type-normal">
                          B2C
                        </span>
                      )}
                    </td>
                    <td>{cust.email && !cust.email.includes('@customer.local') ? cust.email : "-"}</td>
                    <td>{cust.phone}</td>
                    <td>{cust.city || "-"}</td>
                    <td>{cust.company || "-"}</td>
                    <td>{cust.gst_number || "-"}</td>
                    <td className="actions-column-cell">
                      <div className="action-buttons-group">
                        <button
                          type="button"
                          className="edit-customer-btn"
                          onClick={() => handleEditCustomer(cust)}
                          title="Edit customer details"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="delete-customer-btn"
                          onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                          disabled={deletingId === cust.id}
                          title="Delete customer permanently"
                        >
                          {deletingId === cust.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && customers.length === 0 && (
        <p className="user-management-empty">No customers found</p>
      )}

      {/* MODAL */}
      {showAddModal && (
        <div 
          className="user-modal-overlay"
          onWheel={(e) => {
            // Prevent scroll on overlay, allow on modal content
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // Prevent touch scroll on overlay, allow on modal content
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div className="user-modal">
            <div className="user-modal-header">
              <h3>Add New Customer</h3>
              <button
                type="button"
                className="user-modal-close"
                onClick={() => {
                  setShowAddModal(false);
                  setNewCustomer(initialCustomerState);
                  setFormError("");
                  setFormErrors({});
                }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="user-modal-form-error-general">{formError}</div>
            )}

            <form onSubmit={handleCreateCustomer} className="user-modal-form">
              <div className="user-modal-form-group">
                <label htmlFor="full_name">
                  Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={newCustomer.full_name}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      full_name: e.target.value,
                    })
                  }
                />
                {formErrors.full_name && (
                  <div className="user-modal-form-error">
                    {formErrors.full_name}
                  </div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="phone">
                  Mobile Number <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  value={newCustomer.phone}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                />
                {formErrors.phone && (
                  <div className="user-modal-form-error">{formErrors.phone}</div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="off"
                  value={newCustomer.email}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, email: e.target.value })
                  }
                />
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="state">State</label>
                <input
                  id="state"
                  type="text"
                  value={newCustomer.state}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, state: e.target.value })
                  }
                />
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  type="text"
                  value={newCustomer.city}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, city: e.target.value })
                  }
                />
              </div>

              {/* New Pincode field under City */}
              <div className="user-modal-form-group">
                <label htmlFor="pincode">Pincode</label>
                <input
                  id="pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={newCustomer.pincode}
                  onChange={(e) =>
                    setNewCustomer({
                      ...newCustomer,
                      pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                />
                {formErrors.pincode && (
                  <div className="user-modal-form-error">{formErrors.pincode}</div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  type="text"
                  value={newCustomer.address}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, address: e.target.value })
                  }
                />
              </div>

              {/* Has GST checkbox */}
              <div className="user-modal-form-group-checkbox">
                <input
                  id="has_gst"
                  type="checkbox"
                  checked={newCustomer.has_gst}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setNewCustomer({
                      ...newCustomer,
                      has_gst: checked,
                      ...(checked
                        ? {}
                        : {
                            gst_number: "",
                            company_name: "",
                            company_address: "",
                          }),
                    });
                    if (!checked) {
                      setFormErrors((prev) => {
                        const {
                          gst_number,
                          company_name,
                          company_address,
                          ...rest
                        } = prev;
                        return rest;
                      });
                    }
                  }}
                />
                <label htmlFor="has_gst">Has GST</label>
              </div>

              {/* Company fields only shown when has_gst true */}
              {newCustomer.has_gst && (
                <>
                  <div className="user-modal-form-group">
                    <label htmlFor="company_name">Company Name</label>
                    <input
                      id="company_name"
                      type="text"
                      value={newCustomer.company_name}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          company_name: e.target.value,
                        })
                      }
                    />
                    {formErrors.company_name && (
                      <div className="user-modal-form-error">
                        {formErrors.company_name}
                      </div>
                    )}
                  </div>

                  <div className="user-modal-form-group">
                    <label htmlFor="gst_number">GST Number</label>
                    <input
                      id="gst_number"
                      type="text"
                      value={newCustomer.gst_number}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          gst_number: e.target.value,
                        })
                      }
                    />
                    {formErrors.gst_number && (
                      <div className="user-modal-form-error">
                        {formErrors.gst_number}
                      </div>
                    )}
                  </div>

                  <div className="user-modal-form-group">
                    <label htmlFor="company_address">Company Address</label>
                    <input
                      id="company_address"
                      type="text"
                      value={newCustomer.company_address}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          company_address: e.target.value,
                        })
                      }
                    />
                    {formErrors.company_address && (
                      <div className="user-modal-form-error">
                        {formErrors.company_address}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="user-modal-form-group">
                <label htmlFor="password">
                  Password <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  value={newCustomer.password}
                  onChange={(e) =>
                    setNewCustomer({ ...newCustomer, password: e.target.value })
                  }
                />
                {formErrors.password && (
                  <div className="user-modal-form-error">{formErrors.password}</div>
                )}
              </div>

              <div className="user-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewCustomer(initialCustomerState);
                    setFormError("");
                    setFormErrors({});
                  }}
                >
                  Cancel
                </button>

                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Create Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingCustomer && (
        <div 
          className="user-modal-overlay"
          onWheel={(e) => {
            // Prevent scroll on overlay, allow on modal content
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
          onTouchMove={(e) => {
            // Prevent touch scroll on overlay, allow on modal content
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div className="user-modal">
            <div className="user-modal-header">
              <h3>Edit Customer</h3>
              <button
                type="button"
                className="user-modal-close"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCustomer(null);
                  setEditCustomer(initialCustomerState);
                  setEditFormError("");
                  setEditFormErrors({});
                }}
              >
                ✕
              </button>
            </div>

            {editFormError && (
              <div className="user-modal-form-error-general">{editFormError}</div>
            )}

            <form onSubmit={handleUpdateCustomer} className="user-modal-form">
              <div className="user-modal-form-group">
                <label htmlFor="edit_full_name">
                  Full Name (Username) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit_full_name"
                  type="text"
                  value={editCustomer.full_name}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      full_name: e.target.value,
                    })
                  }
                />
                {editFormErrors.full_name && (
                  <div className="user-modal-form-error">
                    {editFormErrors.full_name}
                  </div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_phone">
                  Mobile Number <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="edit_phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  value={editCustomer.phone}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                />
                {editFormErrors.phone && (
                  <div className="user-modal-form-error">{editFormErrors.phone}</div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_email">Email</label>
                <input
                  id="edit_email"
                  type="email"
                  autoComplete="off"
                  value={editCustomer.email}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, email: e.target.value })
                  }
                />
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_state">State</label>
                <input
                  id="edit_state"
                  type="text"
                  value={editCustomer.state}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, state: e.target.value })
                  }
                />
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_city">City</label>
                <input
                  id="edit_city"
                  type="text"
                  value={editCustomer.city}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, city: e.target.value })
                  }
                />
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_pincode">Pincode</label>
                <input
                  id="edit_pincode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={editCustomer.pincode || ""}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                />
                {editFormErrors.pincode && (
                  <div className="user-modal-form-error">{editFormErrors.pincode}</div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_address">Address</label>
                <input
                  id="edit_address"
                  type="text"
                  value={editCustomer.address}
                  onChange={(e) =>
                    setEditCustomer({ ...editCustomer, address: e.target.value })
                  }
                />
              </div>

              {/* B2B / B2C Toggle Buttons */}
              <div className="user-modal-form-group">
                <label style={{ marginBottom: '8px', color: '#374151', fontSize: '0.875rem', fontWeight: '500' }}>
                  Customer Type <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div className="b2b-b2c-toggle-group">
                  <button
                    type="button"
                    className={`b2b-b2c-toggle-btn ${editCustomer.has_gst ? 'active' : ''}`}
                    onClick={() => {
                      setEditCustomer({
                        ...editCustomer,
                        has_gst: true,
                      });
                      // Clear any errors when switching to B2B
                      setEditFormErrors((prev) => {
                        const {
                          gst_number,
                          company_name,
                          company_address,
                          ...rest
                        } = prev;
                        return rest;
                      });
                    }}
                  >
                    B2B
                  </button>
                  <button
                    type="button"
                    className={`b2b-b2c-toggle-btn ${!editCustomer.has_gst ? 'active' : ''}`}
                    onClick={() => {
                      setEditCustomer({
                        ...editCustomer,
                        has_gst: false,
                        // Keep GST fields but don't require them for B2C
                        // Only clear if user explicitly wants to remove them
                      });
                      // Clear GST-related errors when switching to B2C (they're no longer required)
                      setEditFormErrors((prev) => {
                        const {
                          gst_number,
                          company_name,
                          company_address,
                          ...rest
                        } = prev;
                        return rest;
                      });
                    }}
                  >
                    B2C
                  </button>
                </div>
              </div>

              {/* GST fields - always visible regardless of customer type */}
              <div className="user-modal-form-group">
                <label htmlFor="edit_company_name">Company Name</label>
                <input
                  id="edit_company_name"
                  type="text"
                  value={editCustomer.company_name}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      company_name: e.target.value,
                    })
                  }
                />
                {editFormErrors.company_name && (
                  <div className="user-modal-form-error">
                    {editFormErrors.company_name}
                  </div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_gst_number">GST Number</label>
                <input
                  id="edit_gst_number"
                  type="text"
                  value={editCustomer.gst_number}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      gst_number: e.target.value,
                    })
                  }
                />
                {editFormErrors.gst_number && (
                  <div className="user-modal-form-error">
                    {editFormErrors.gst_number}
                  </div>
                )}
              </div>

              <div className="user-modal-form-group">
                <label htmlFor="edit_company_address">Company Address</label>
                <input
                  id="edit_company_address"
                  type="text"
                  value={editCustomer.company_address}
                  onChange={(e) =>
                    setEditCustomer({
                      ...editCustomer,
                      company_address: e.target.value,
                    })
                  }
                />
              </div>

              <div className="user-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCustomer(null);
                    setEditCustomer(initialCustomerState);
                    setEditFormError("");
                    setEditFormErrors({});
                  }}
                >
                  Cancel
                </button>

                <button type="submit" disabled={updating}>
                  {updating ? "Updating..." : "Update Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default UserManagement;
