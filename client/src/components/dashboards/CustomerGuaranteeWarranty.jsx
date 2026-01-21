import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getReplacementHistory, getBatteryStatus } from '../../api';
import Swal from 'sweetalert2';
import { getFormState, saveFormState } from '../../utils/formStateManager';
import './DashboardContent.css';
import './GuaranteeWarrantyTable.css';

const STORAGE_KEY = 'customerGuaranteeWarrantyState';

const CustomerGuaranteeWarranty = () => {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serialNumber, setSerialNumber] = useState(() => savedState?.serialNumber || '');
  const [batteryStatus, setBatteryStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
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
      historySearch,
      historyTypeFilter,
      historyDateFrom,
      historyDateTo
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [serialNumber, historySearch, historyTypeFilter, historyDateFrom, historyDateTo, isInitialMount]);

  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getReplacementHistory(user.id);
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load replacement history');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!serialNumber.trim()) {
      setError('Please enter a serial number');
      return;
    }

    setCheckingStatus(true);
    setError(null);
    setBatteryStatus(null);

    try {
      const status = await getBatteryStatus(serialNumber.trim());
      setBatteryStatus(status);
    } catch (err) {
      // Check if it's a 403 error (serial number doesn't belong to customer)
      if (err.message && (err.message.includes('does not belong') || err.message.includes('403'))) {
        setBatteryStatus(null);
        setError(null);
        // Show stylish SweetAlert popup
        Swal.fire({
          icon: 'error',
          title: 'Serial Number Not Available',
          html: `
            <div style="text-align: center; padding: 10px;">
              <p style="font-size: 16px; color: #666; margin-bottom: 15px;">
                This serial number does not belong to your account.
              </p>
              <p style="font-size: 14px; color: #999;">
                You can only check the status of products you have purchased.
              </p>
            </div>
          `,
          confirmButtonText: 'OK',
          confirmButtonColor: '#1e3a8a',
          width: '500px',
          customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            confirmButton: 'swal-custom-button'
          },
          buttonsStyling: true,
          showClass: {
            popup: 'animate__animated animate__fadeInDown'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
          }
        });
      } else if (err.message && err.message.includes('not found')) {
        setBatteryStatus(null);
        setError(null);
        // Show error for serial number not found
        Swal.fire({
          icon: 'error',
          title: 'Serial Number Not Found',
          html: `
            <div style="text-align: center; padding: 10px;">
              <p style="font-size: 16px; color: #666; margin-bottom: 15px;">
                No battery found with this serial number.
              </p>
              <p style="font-size: 14px; color: #999;">
                Please check the serial number and try again.
              </p>
            </div>
          `,
          confirmButtonText: 'OK',
          confirmButtonColor: '#1e3a8a',
          width: '500px',
          customClass: {
            popup: 'swal-custom-popup',
            title: 'swal-custom-title',
            confirmButton: 'swal-custom-button'
          },
          buttonsStyling: true,
          showClass: {
            popup: 'animate__animated animate__fadeInDown'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
          }
        });
      } else {
        setError(err.message || 'Failed to check battery status');
        setBatteryStatus(null);
      }
    } finally {
      setCheckingStatus(false);
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
  const filteredHistory = history.filter((replacement) => {
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
        <h2>Guarantee & Warranty</h2>
        <p>View your battery replacement history and check battery status</p>
      </div>

      {/* Check Battery Status Section */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3>Check Battery Status</h3>
        <div className="form-group">
          <label>Enter Serial Number</label>
          <div className="serial-check-container" style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter battery serial number"
              onKeyPress={(e) => e.key === 'Enter' && handleCheckStatus()}
              className="serial-number-input"
              style={{ flex: 1 }}
            />
            <button 
              onClick={handleCheckStatus} 
              disabled={checkingStatus}
              className="primary-btn check-status-btn"
            >
              {checkingStatus ? 'Checking...' : 'Check'}
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message" style={{ marginTop: '10px', padding: '10px', background: '#fee', color: '#c33', borderRadius: '4px' }}>
            {error}
          </div>
        )}

        {batteryStatus && (
          <div className="battery-status">
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
            <div className="customer-details-section">
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

            <div className={`status-section ${batteryStatus.status.underGuarantee ? 'guarantee' : 'warranty'}`}>
              <h4>Status</h4>
              <div>
                <strong>Type:</strong> {batteryStatus.status.underGuarantee ? 'Under Guarantee' : 'Under Warranty'}
              </div>
              {batteryStatus.status.underGuarantee ? (
                <div className="status-message guarantee-message" style={{ marginTop: '5px' }}>
                  ✓ Your battery is eligible for free replacement under guarantee
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
                <div className="replacement-info">
                  <strong>Already Replaced:</strong> {formatDate(batteryStatus.latestReplacement.date)}
                  <br />
                  <strong>New Serial:</strong> {batteryStatus.latestReplacement.newSerialNumber}
                  <br />
                  <strong>Type:</strong> {batteryStatus.latestReplacement.type}
                  {batteryStatus.latestReplacement.newInvoiceNumber && (
                    <>
                      <br />
                      <strong>New Invoice:</strong> {batteryStatus.latestReplacement.newInvoiceNumber}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Replacement History Section */}
      <div className="card">
        <h3>Replacement History</h3>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No replacement history found
          </div>
        ) : (
          <>
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
                  {filteredHistory.length === 0 ? (
                    <tr className="replacement-history-empty">
                      <td colSpan="10">No matching records found</td>
                    </tr>
                  ) : (
                    filteredHistory.map((replacement) => {
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
                              color: replacement.replacement_type === 'guarantee' ? '#155724' : '#856404',
                              textTransform: 'capitalize'
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerGuaranteeWarranty;

