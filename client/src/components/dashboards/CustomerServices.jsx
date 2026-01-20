import { useEffect, useMemo, useState } from 'react';
import { createServiceRequest, getMyServiceRequests, cancelPendingServiceRequest } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { getFormState, saveFormState, markFormSubmitted } from '../../utils/formStateManager';
import Swal from 'sweetalert2';
import './DashboardContent.css';

const SERVICE_TYPES = [
  { value: 'battery_testing', label: 'Battery Testing Service' },
  { value: 'jump_start', label: 'Jump Start Service' },
  { value: 'inverter_repair', label: 'Inverter Repairing Service' },
  { value: 'inverter_battery', label: 'Inverter Battery Service' }
];

const FUEL_TYPES = ['petrol', 'diesel', 'gas', 'electric'];

const statusLabels = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const statusBadge = {
  pending: 'status-pending',
  in_progress: 'status-in-progress',
  completed: 'status-completed',
  cancelled: 'status-paid'
};

const STORAGE_KEY = 'customerServicesState';

export default function CustomerServices() {
  // Load saved state using utility (automatically handles refresh detection)
  const savedState = getFormState(STORAGE_KEY);
  const { user } = useAuth();
  const [form, setForm] = useState(() => savedState?.form || {
    serviceType: 'battery_testing',
    vehicleName: '',
    fuelType: 'petrol',
    vehicleNumber: '',
    inverterVa: '',
    inverterVoltage: '',
    batteryAmpereRating: '',
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(() => savedState?.statusFilter || 'all');
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      form,
      statusFilter
    };
    saveFormState(STORAGE_KEY, stateToSave);
  }, [form, statusFilter, isInitialMount]);

  const customerMeta = useMemo(() => {
    return {
      name: user?.full_name || user?.name || 'Customer',
      phone: user?.phone || user?.customer_mobile_number || 'Not set',
      email: user?.email || 'Not set'
    };
  }, [user]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await getMyServiceRequests({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        serviceType: undefined,
        limit: 50
      });
      setHistory(data.items || []);
    } catch (err) {
      setHistoryError(err.message || 'Unable to load service history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [statusFilter]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    setSubmitMessage(null);

    try {
      const payload = {
        serviceType: form.serviceType,
        vehicleName: ['battery_testing', 'jump_start'].includes(form.serviceType) ? form.vehicleName : undefined,
        fuelType: ['battery_testing', 'jump_start'].includes(form.serviceType) ? form.fuelType : undefined,
        vehicleNumber: ['battery_testing', 'jump_start'].includes(form.serviceType) ? form.vehicleNumber : undefined,
        inverterVa: form.serviceType === 'inverter_repair' ? form.inverterVa : undefined,
        inverterVoltage: form.serviceType === 'inverter_repair' ? form.inverterVoltage : undefined,
        batteryAmpereRating: form.serviceType === 'inverter_battery' ? form.batteryAmpereRating : undefined,
        notes: form.notes || undefined
      };

      await createServiceRequest(payload);
      setSubmitMessage('Service booked successfully. Our team will contact you soon.');
      // Mark form as submitted (will clear on next mount)
      markFormSubmitted(STORAGE_KEY);
      setForm((prev) => ({
        ...prev,
        vehicleName: '',
        vehicleNumber: '',
        inverterVa: '',
        inverterVoltage: '',
        batteryAmpereRating: '',
        notes: ''
      }));
      loadHistory();
    } catch (err) {
      setSubmitError(err.message || 'Failed to book service');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = async (serviceId, service) => {
    try {
      // Check if this is a pending request (can be cancelled)
      const isPending = service.status === 'requested';
      
      if (!isPending) {
        await Swal.fire('Error!', 'Only pending service requests can be cancelled.', 'error');
        return;
      }

      const result = await Swal.fire({
        title: 'Cancel Service Request?',
        html: `
          <div style="text-align: left; padding: 1rem 0;">
            <p style="margin-bottom: 0.75rem;"><strong>Service ID:</strong> #${serviceId}</p>
            <p style="margin-bottom: 0.75rem;"><strong>Service Type:</strong> ${SERVICE_TYPES.find((s) => s.value === service.service_type)?.label || service.service_type}</p>
            ${service.vehicle_name ? `<p style="margin-bottom: 0.75rem;"><strong>Vehicle:</strong> ${service.vehicle_name}</p>` : ''}
            ${service.vehicle_number ? `<p style="margin-bottom: 0.75rem;"><strong>Vehicle Number:</strong> ${service.vehicle_number}</p>` : ''}
            <p style="margin-bottom: 0; color: #dc2626;"><strong>Are you sure you want to cancel this service request?</strong></p>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, Cancel',
        cancelButtonText: 'No, Keep It',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
      });

      if (result.isConfirmed) {
        await cancelPendingServiceRequest(serviceId);
        await Swal.fire('Cancelled!', 'Your service request has been cancelled successfully.', 'success');
        // Remove from local state immediately
        setHistory(prevHistory => prevHistory.filter(s => s.id !== serviceId));
        loadHistory();
      }
    } catch (err) {
      console.error('Failed to cancel service request:', err);
      await Swal.fire('Error!', `Failed to cancel service request: ${err.message}`, 'error');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dashboard-content">
      <div className="content-header">
        <h2>Services</h2>
        <p>Book a service and track your history</p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Book a Service</h3>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-group">
            <label>Service Type</label>
            <select value={form.serviceType} onChange={handleChange('serviceType')}>
              {SERVICE_TYPES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Your Name</label>
            <input type="text" value={customerMeta.name} readOnly />
          </div>
          <div className="form-group">
            <label>Mobile Number</label>
            <input type="text" value={customerMeta.phone} readOnly />
          </div>

          {['battery_testing', 'jump_start'].includes(form.serviceType) && (
            <>
              <div className="form-group">
                <label>Vehicle Name</label>
                <input
                  type="text"
                  value={form.vehicleName}
                  onChange={handleChange('vehicleName')}
                  placeholder="e.g., Maruti Baleno"
                  required
                />
              </div>
              <div className="form-group">
                <label>Fuel Type</label>
                <select value={form.fuelType} onChange={handleChange('fuelType')} required>
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>{f.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Vehicle Number</label>
                <input
                  type="text"
                  value={form.vehicleNumber}
                  onChange={handleChange('vehicleNumber')}
                  placeholder="e.g., MH12AB1234"
                  required
                />
              </div>
            </>
          )}

          {form.serviceType === 'inverter_repair' && (
            <>
              <div className="form-group">
                <label>Inverter VA</label>
                <input
                  type="text"
                  value={form.inverterVa}
                  onChange={handleChange('inverterVa')}
                  placeholder="e.g., 900VA"
                  required
                />
              </div>
              <div className="form-group">
                <label>Inverter Voltage</label>
                <input
                  type="text"
                  value={form.inverterVoltage}
                  onChange={handleChange('inverterVoltage')}
                  placeholder="e.g., 12V / 24V"
                  required
                />
              </div>
            </>
          )}

          {form.serviceType === 'inverter_battery' && (
            <div className="form-group">
              <label>Battery Ampere Rating</label>
              <input
                type="text"
                value={form.batteryAmpereRating}
                onChange={handleChange('batteryAmpereRating')}
                placeholder="e.g., 150Ah"
                required
              />
            </div>
          )}

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label>Additional Details (optional)</label>
            <textarea
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Any extra info to help us serve you better"
              rows={3}
            />
          </div>

          {submitError && (
            <div className="error-message" style={{ gridColumn: '1 / -1' }}>
              {submitError}
            </div>
          )}
          {submitMessage && (
            <div className="success-message" style={{ gridColumn: '1 / -1' }}>
              {submitMessage}
            </div>
          )}

          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="primary-btn" disabled={submitting}>
              {submitting ? 'Booking...' : 'Book Service'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Service History</h3>
            <p style={{ margin: 0, color: '#64748b' }}>All services you have booked</p>
          </div>
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {historyError && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            {historyError}
          </div>
        )}

        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '1.5rem' }}>Loading...</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
            No service requests yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="transaction-table" style={{ minWidth: '1200px', width: '100%' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>{SERVICE_TYPES.find((s) => s.value === item.service_type)?.label || item.service_type}</td>
                    <td>
                      {item.service_type === 'battery_testing' || item.service_type === 'jump_start' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span>Vehicle: {item.vehicle_name || 'N/A'}</span>
                          <span>Fuel: {item.fuel_type ? item.fuel_type.toUpperCase() : 'N/A'}</span>
                          <span>Number: {item.vehicle_number || 'N/A'}</span>
                        </div>
                      ) : item.service_type === 'inverter_repair' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span>VA: {item.inverter_va || 'N/A'}</span>
                          <span>Voltage: {item.inverter_voltage || 'N/A'}</span>
                        </div>
                      ) : item.service_type === 'inverter_battery' ? (
                        <div>Battery Ampere: {item.battery_ampere_rating || 'N/A'}</div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${statusBadge[item.status === 'requested' ? 'pending' : item.status] || 'status-pending'}`}>
                        {item.status === 'requested' 
                          ? 'Pending' 
                          : statusLabels[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      {item.amount ? (
                        <span style={{ fontWeight: '600', color: '#059669' }}>
                          ₹{parseFloat(item.amount).toFixed(2)}
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>-</span>
                      )}
                    </td>
                    <td>{item.notes || '-'}</td>
                    <td style={{ minWidth: '120px', textAlign: 'center' }}>
                      {(item.status === 'requested' || item.status?.toLowerCase() === 'requested') ? (
                        <button
                          onClick={() => handleCancelRequest(item.id, item)}
                          style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderRadius: '6px',
                            background: '#dc2626',
                            color: '#ffffff',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            fontWeight: '500',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.2s',
                            display: 'inline-block',
                            minWidth: '80px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#b91c1c';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = '#dc2626';
                          }}
                        >
                          Cancel
                        </button>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.875rem' }}>-</span>
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
}

