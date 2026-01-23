import React, { useState, useEffect } from 'react';
import api from '../../../api';
import './EmployeeDetails.css';

const EmployeeDetails = ({ employeeId, onBack }) => {
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [dailyAttendance, setDailyAttendance] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('attendance');
  const [attendanceView, setAttendanceView] = useState('monthly'); // 'monthly' or 'daily'
  const [showAttendanceForm, setShowAttendanceForm] = useState(false);
  const [showDailyAttendanceForm, setShowDailyAttendanceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendanceForm, setAttendanceForm] = useState({
    attendance_month: '',
    total_days: '',
    present_days: '',
    absent_days: '',
    leave_days: '',
    notes: ''
  });
  const [dailyAttendanceForm, setDailyAttendanceForm] = useState({
    attendance_date: new Date().toISOString().split('T')[0],
    status: 'present',
    check_in_time: '',
    check_out_time: '',
    notes: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    payment_month: '',
    amount: '',
    payment_date: '',
    payment_method: 'cash',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, [employeeId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [empData, attData, dailyAttData, payData] = await Promise.all([
        api.getEmployeeById(employeeId),
        api.getEmployeeAttendance(employeeId),
        api.getDailyAttendance(employeeId, null, selectedMonth, selectedYear),
        api.getEmployeePayments(employeeId)
      ]);
      setEmployee(empData);
      setAttendance(attData);
      setDailyAttendance(dailyAttData);
      setPayments(payData);
    } catch (err) {
      setError(err.message || 'Failed to load employee data');
      console.error('Failed to fetch employee data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId && attendanceView === 'daily') {
      fetchDailyAttendance();
    }
  }, [employeeId, selectedMonth, selectedYear, attendanceView]);

  const fetchDailyAttendance = async () => {
    try {
      const data = await api.getDailyAttendance(employeeId, null, selectedMonth, selectedYear);
      setDailyAttendance(data);
    } catch (err) {
      console.error('Failed to fetch daily attendance:', err);
    }
  };

  const handleAttendanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addEmployeeAttendance(employeeId, attendanceForm);
      setShowAttendanceForm(false);
      setAttendanceForm({
        attendance_month: '',
        total_days: '',
        present_days: '',
        absent_days: '',
        leave_days: '',
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save attendance');
    }
  };

  const handleDailyAttendanceSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.markDailyAttendance(employeeId, dailyAttendanceForm);
      setShowDailyAttendanceForm(false);
      setDailyAttendanceForm({
        attendance_date: new Date().toISOString().split('T')[0],
        status: 'present',
        check_in_time: '',
        check_out_time: '',
        notes: ''
      });
      fetchDailyAttendance();
      fetchData(); // Refresh monthly summary too
    } catch (err) {
      setError(err.message || 'Failed to mark daily attendance');
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addEmployeePayment(employeeId, paymentForm);
      setShowPaymentForm(false);
      setPaymentForm({
        payment_month: '',
        amount: '',
        payment_date: '',
        payment_method: 'cash',
        notes: ''
      });
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to save payment');
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

  if (loading) {
    return <div className="loading-message">Loading employee details...</div>;
  }

  if (!employee) {
    return <div className="error-message">Employee not found</div>;
  }

  return (
    <div className="employee-details">
      <div className="employee-details-header">
        <button onClick={onBack} className="back-button">← Back</button>
        <h3>{employee.full_name}</h3>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="employee-info-card">
        <div className="info-row">
          <span className="info-label">Phone:</span>
          <span className="info-value">{employee.phone || 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Email:</span>
          <span className="info-value">{employee.email || 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Designation:</span>
          <span className="info-value">{employee.designation || 'N/A'}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Joining Date:</span>
          <span className="info-value">{formatDate(employee.joining_date)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Salary:</span>
          <span className="info-value">{formatCurrency(employee.salary)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Status:</span>
          <span className={`status-badge ${employee.is_active ? 'active' : 'inactive'}`}>
            {employee.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="employee-tabs">
        <button
          className={activeTab === 'attendance' ? 'active' : ''}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance
        </button>
        <button
          className={activeTab === 'payments' ? 'active' : ''}
          onClick={() => setActiveTab('payments')}
        >
          Payments
        </button>
      </div>

      {activeTab === 'attendance' && (
        <div className="attendance-section">
          <div className="section-header">
            <h4>Attendance Records</h4>
            <div className="attendance-controls">
              <div className="view-toggle">
                <button
                  type="button"
                  className={attendanceView === 'monthly' ? 'active' : ''}
                  onClick={() => setAttendanceView('monthly')}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={attendanceView === 'daily' ? 'active' : ''}
                  onClick={() => setAttendanceView('daily')}
                >
                  Daily
                </button>
              </div>
              {attendanceView === 'monthly' ? (
                <button onClick={() => setShowAttendanceForm(true)} className="add-button">
                  + Add Monthly Attendance
                </button>
              ) : (
                <button onClick={() => setShowDailyAttendanceForm(true)} className="add-button">
                  + Mark Daily Attendance
                </button>
              )}
            </div>
          </div>

          {attendanceView === 'daily' && (
            <div className="month-filter" style={{ marginBottom: '15px' }}>
              <label style={{ marginRight: '10px' }}>Select Month:</label>
              <input
                type="month"
                value={`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  setSelectedYear(year);
                  setSelectedMonth(month);
                }}
              />
            </div>
          )}

          {showDailyAttendanceForm && (
            <div className="form-modal">
              <div className="form-content">
                <div className="form-header">
                  <h4>Mark Daily Attendance</h4>
                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setShowDailyAttendanceForm(false)}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleDailyAttendanceSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date *</label>
                      <input
                        type="date"
                        value={dailyAttendanceForm.attendance_date}
                        onChange={(e) => setDailyAttendanceForm({ ...dailyAttendanceForm, attendance_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Status *</label>
                      <select
                        value={dailyAttendanceForm.status}
                        onChange={(e) => setDailyAttendanceForm({ ...dailyAttendanceForm, status: e.target.value })}
                        required
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Leave</option>
                        <option value="half_day">Half Day</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Check In Time</label>
                      <input
                        type="time"
                        value={dailyAttendanceForm.check_in_time}
                        onChange={(e) => setDailyAttendanceForm({ ...dailyAttendanceForm, check_in_time: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Check Out Time</label>
                      <input
                        type="time"
                        value={dailyAttendanceForm.check_out_time}
                        onChange={(e) => setDailyAttendanceForm({ ...dailyAttendanceForm, check_out_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={dailyAttendanceForm.notes}
                      onChange={(e) => setDailyAttendanceForm({ ...dailyAttendanceForm, notes: e.target.value })}
                      rows="3"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="submit-button">Mark Attendance</button>
                    <button type="button" onClick={() => setShowDailyAttendanceForm(false)} className="cancel-button">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {attendanceView === 'monthly' && showAttendanceForm && (
            <div className="form-modal">
              <div className="form-content">
                <div className="form-header">
                  <h4>Add Monthly Attendance</h4>
                  <button
                    type="button"
                    className="close-button"
                    onClick={() => setShowAttendanceForm(false)}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M15 5L5 15M5 5L15 15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <form onSubmit={handleAttendanceSubmit}>
                  <div className="form-group">
                    <label>Month *</label>
                    <input
                      type="month"
                      value={attendanceForm.attendance_month}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, attendance_month: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Present Days</label>
                      <input
                        type="number"
                        value={attendanceForm.present_days}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, present_days: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Absent Days</label>
                      <input
                        type="number"
                        value={attendanceForm.absent_days}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, absent_days: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Leave Days</label>
                      <input
                        type="number"
                        value={attendanceForm.leave_days}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, leave_days: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={attendanceForm.notes}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                      rows="3"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="submit-button">Save</button>
                    <button type="button" onClick={() => setShowAttendanceForm(false)} className="cancel-button">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {attendanceView === 'monthly' ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Total Days</th>
                  <th>Present</th>
                  <th>Half Day</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="no-data">No attendance records</td>
                  </tr>
                ) : (
                  attendance.map((att) => (
                    <tr key={att.id}>
                      <td>{formatDate(att.attendance_month)}</td>
                      <td>{att.total_days || 0}</td>
                      <td>{att.present_days || 0}</td>
                      <td>{att.half_days || 0}</td>
                      <td>{att.absent_days || 0}</td>
                      <td>{att.leave_days || 0}</td>
                      <td>{att.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {dailyAttendance.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">No daily attendance records</td>
                  </tr>
                ) : (
                  dailyAttendance.map((att) => (
                    <tr key={att.id}>
                      <td>{formatDate(att.attendance_date)}</td>
                      <td>
                        <span className={`status-badge status-${att.status}`}>
                          {att.status === 'present' ? 'Present' : 
                           att.status === 'absent' ? 'Absent' :
                           att.status === 'leave' ? 'Leave' : 'Half Day'}
                        </span>
                      </td>
                      <td>{att.check_in_time || '-'}</td>
                      <td>{att.check_out_time || '-'}</td>
                      <td>{att.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="payments-section">
          <div className="section-header">
            <h4>Payment Records</h4>
            <button onClick={() => setShowPaymentForm(true)} className="add-button">
              + Add Payment
            </button>
          </div>

          {showPaymentForm && (
            <div className="form-modal">
              <div className="form-content">
                <h4>Add Payment</h4>
                <form onSubmit={handlePaymentSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Payment Month *</label>
                      <input
                        type="month"
                        value={paymentForm.payment_month}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_month: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Payment Date *</label>
                      <input
                        type="date"
                        value={paymentForm.payment_date}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Amount *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Payment Method</label>
                      <select
                        value={paymentForm.payment_method}
                        onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                      >
                        <option value="cash">Cash</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="upi">UPI</option>
                        <option value="cheque">Cheque</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Notes</label>
                    <textarea
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      rows="3"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="submit-button">Save</button>
                    <button type="button" onClick={() => setShowPaymentForm(false)} className="cancel-button">
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <table className="data-table">
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
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">No payment records</td>
                </tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.payment_month)}</td>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>{formatCurrency(payment.amount)}</td>
                    <td>{payment.payment_method || 'cash'}</td>
                    <td>{payment.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeDetails;

