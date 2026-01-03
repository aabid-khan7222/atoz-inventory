import React, { useState, useEffect } from 'react';
import api from '../../../api';
import './EmployeeList.css';

const EmployeeList = ({ onEmployeeSelect, selectedEmployee }) => {
  const [employees, setEmployees] = useState([]);
  const [attendanceSummary, setAttendanceSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    designation: '',
    joining_date: '',
    salary: '',
    is_active: true
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      fetchAttendanceSummary();
    }
  }, [employees]);

  const fetchEmployees = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getEmployees();
      setEmployees(data);
    } catch (err) {
      setError(err.message || 'Failed to load employees');
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceSummary = async () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const summary = {};

    try {
      await Promise.all(
        employees.map(async (emp) => {
          if (!emp.is_active) {
            summary[emp.id] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
            return;
          }

          try {
            const dailyAttendance = await api.getDailyAttendance(emp.id, null, currentMonth, currentYear);
            const present = dailyAttendance.filter(a => a.status === 'present').length;
            const absent = dailyAttendance.filter(a => a.status === 'absent').length;
            const halfDay = dailyAttendance.filter(a => a.status === 'half_day').length;
            const leave = dailyAttendance.filter(a => a.status === 'leave').length;

            summary[emp.id] = { present, absent, halfDay, leave };
          } catch (err) {
            console.error(`Failed to fetch attendance for employee ${emp.id}:`, err);
            summary[emp.id] = { present: 0, absent: 0, halfDay: 0, leave: 0 };
          }
        })
      );
      setAttendanceSummary(summary);
    } catch (err) {
      console.error('Failed to fetch attendance summary:', err);
    }
  };

  const handleAdd = () => {
    setEditingEmployee(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      address: '',
      designation: '',
      joining_date: '',
      salary: '',
      is_active: true
    });
    setShowForm(true);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      full_name: employee.full_name || '',
      email: employee.email || '',
      phone: employee.phone || '',
      address: employee.address || '',
      designation: employee.designation || '',
      joining_date: employee.joining_date || '',
      salary: employee.salary || '',
      is_active: employee.is_active !== false
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, formData);
      } else {
        await api.createEmployee(formData);
      }
      setShowForm(false);
      fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to save employee');
      console.error('Failed to save employee:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this employee?')) {
      return;
    }
    try {
      await api.deleteEmployee(id);
      fetchEmployees();
    } catch (err) {
      setError(err.message || 'Failed to delete employee');
      console.error('Failed to delete employee:', err);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
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
    return <div className="loading-message">Loading employees...</div>;
  }

  return (
    <div className="employee-list">
      <div className="employee-list-header">
        <h3>Employees</h3>
        <button onClick={handleAdd} className="add-button">
          + Add Employee
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="employee-form-modal" onClick={(e) => {
          if (e.target.classList.contains('employee-form-modal')) {
            setShowForm(false);
          }
        }}>
          <div className="employee-form-content">
            <div className="form-header">
              <h3>{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h3>
              <button
                type="button"
                className="close-button"
                onClick={() => setShowForm(false)}
                aria-label="Close"
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
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    value={formData.joining_date}
                    onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Salary</label>
                  <input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="submit-button">
                  {editingEmployee ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="employee-table-container">
        <table className="employee-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Joining Date</th>
              <th>Salary</th>
              <th>Current Month Attendance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan="9" className="no-data">No employees found</td>
              </tr>
            ) : (
              employees.map((employee) => {
                const summary = attendanceSummary[employee.id] || { present: 0, absent: 0, halfDay: 0, leave: 0 };
                return (
                  <tr
                    key={employee.id}
                    className={selectedEmployee?.id === employee.id ? 'selected' : ''}
                    onClick={() => onEmployeeSelect(employee)}
                  >
                    <td>{employee.full_name}</td>
                    <td>{employee.phone || 'N/A'}</td>
                    <td>{employee.email || 'N/A'}</td>
                    <td>{employee.designation || 'N/A'}</td>
                    <td>{formatDate(employee.joining_date)}</td>
                    <td>{formatCurrency(employee.salary)}</td>
                    <td>
                      <div className="attendance-summary">
                        <div className="attendance-summary-row">
                          <span className="attendance-badge present" title="Present Days">
                            P: {summary.present}
                          </span>
                          <span className="attendance-badge absent" title="Absent Days">
                            A: {summary.absent}
                          </span>
                        </div>
                        <div className="attendance-summary-row">
                          <span className="attendance-badge half-day" title="Half Day">
                            HD: {summary.halfDay}
                          </span>
                          <span className="attendance-badge leave" title="Leave Days">
                            L: {summary.leave}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${employee.is_active ? 'active' : 'inactive'}`}>
                        {employee.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEdit(employee)}
                        className="edit-button"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(employee.id)}
                        className="delete-button"
                      >
                        Deactivate
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;

