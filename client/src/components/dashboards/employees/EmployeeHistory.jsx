import React, { useState, useEffect } from 'react';
import api from '../../../api';
import SearchableDropdown from '../../common/SearchableDropdown';
import './EmployeeHistory.css';

const EmployeeHistory = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeHistory(selectedEmployee.value);
    } else {
      setHistory(null);
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getEmployees(true);
      const employeeOptions = data.map(emp => ({
        value: emp.id,
        label: emp.full_name || 'Unknown Employee',
        subLabel: `${emp.phone || 'No phone'}${emp.designation ? ` • ${emp.designation}` : ''}`
      }));
      setEmployees(employeeOptions);
    } catch (err) {
      setError(err.message || 'Failed to load employees');
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeHistory = async (employeeId) => {
    setLoadingHistory(true);
    setError('');
    try {
      const data = await api.getEmployeeHistoryById(employeeId);
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Failed to load employee history');
      console.error('Failed to fetch employee history:', err);
      setHistory(null);
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="employee-history">
      <h3>Employee History</h3>
      <p className="section-description">View complete history for any employee</p>

      <div className="employee-history-controls">
        <div className="employee-selector">
          <label>Select Employee:</label>
          <SearchableDropdown
            options={employees}
            value={selectedEmployee}
            onChange={setSelectedEmployee}
            placeholder="Search and select an employee..."
            isLoading={loading}
          />
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loadingHistory && (
        <div className="loading-message">Loading employee history...</div>
      )}

      {history && !loadingHistory && (
        <div className="employee-history-content">
          <div className="history-section">
            <h4>Employee Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Name:</span>
                <span className="info-value">{history.employee.full_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone:</span>
                <span className="info-value">{history.employee.phone || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Email:</span>
                <span className="info-value">{history.employee.email || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Designation:</span>
                <span className="info-value">{history.employee.designation || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Joining Date:</span>
                <span className="info-value">{formatDate(history.employee.joining_date)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Salary:</span>
                <span className="info-value">{formatCurrency(history.employee.salary)}</span>
              </div>
            </div>
          </div>

          <div className="history-section">
            <h4>Summary</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Total Payments:</span>
                <span className="summary-value">{formatCurrency(history.summary.total_payments)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Payment Records:</span>
                <span className="summary-value">{history.summary.total_payment_records}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Attendance Months:</span>
                <span className="summary-value">{history.summary.total_attendance_months}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Present Days:</span>
                <span className="summary-value">{history.summary.total_present_days}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Absent Days:</span>
                <span className="summary-value">{history.summary.total_absent_days}</span>
              </div>
            </div>
          </div>

          {history.payments && history.payments.length > 0 && (
            <div className="history-section">
              <h4>Payment History</h4>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Payment Month</th>
                    <th>Payment Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.payment_month)}</td>
                      <td>{formatDate(payment.payment_date)}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td>{payment.payment_method || 'cash'}</td>
                      <td>{payment.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.attendance && history.attendance.length > 0 && (
            <div className="history-section">
              <h4>Attendance History</h4>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Days</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Leave</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {history.attendance.map((att) => (
                    <tr key={att.id}>
                      <td>{formatDate(att.attendance_month)}</td>
                      <td>{att.total_days || 0}</td>
                      <td>{att.present_days || 0}</td>
                      <td>{att.absent_days || 0}</td>
                      <td>{att.leave_days || 0}</td>
                      <td>{att.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {history.history && history.history.length > 0 && (
            <div className="history-section">
              <h4>Activity History</h4>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.history.map((item) => (
                    <tr key={item.id}>
                      <td>{formatDate(item.created_at)}</td>
                      <td>{item.history_type}</td>
                      <td>{item.description}</td>
                      <td>{item.amount ? formatCurrency(item.amount) : '-'}</td>
                      <td>{item.created_by_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedEmployee && !loadingHistory && (
        <div className="no-selection">
          <p>Select an employee from the dropdown above to view their complete history</p>
        </div>
      )}
    </div>
  );
};

export default EmployeeHistory;

