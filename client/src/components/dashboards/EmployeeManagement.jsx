import React, { useState, useEffect } from 'react';
import api from '../../api';
import EmployeeList from './employees/EmployeeList';
import EmployeeDetails from './employees/EmployeeDetails';
import EmployeeHistory from './employees/EmployeeHistory';
import './EmployeeManagement.css';

const EmployeeManagement = ({ onBack }) => {
  // Load saved state from sessionStorage
  const getSavedState = () => {
    try {
      const saved = sessionStorage.getItem('employeeManagementState');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load saved EmployeeManagement state:', e);
    }
    return null;
  };
  
  const savedState = getSavedState();
  const [activeTab, setActiveTab] = useState(() => savedState?.activeTab || 'list');
  const [selectedEmployee, setSelectedEmployee] = useState(() => savedState?.selectedEmployeeId ? { id: savedState.selectedEmployeeId } : null);
  
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Save state to sessionStorage
  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false);
      return;
    }
    
    const stateToSave = {
      activeTab,
      selectedEmployeeId: selectedEmployee?.id || null
    };
    sessionStorage.setItem('employeeManagementState', JSON.stringify(stateToSave));
  }, [activeTab, selectedEmployee, isInitialMount]);

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);
    setActiveTab('details');
  };

  const handleBackToList = () => {
    setSelectedEmployee(null);
    setActiveTab('list');
  };

  return (
    <div className="employee-management">
      <div className="employee-management-header">
        <h2>Employee Management</h2>
        {onBack && (
          <button onClick={onBack} className="back-button">
            ← Back
          </button>
        )}
      </div>

      <div className="employee-management-tabs">
        <button
          className={activeTab === 'list' ? 'active' : ''}
          onClick={() => {
            setActiveTab('list');
            setSelectedEmployee(null);
          }}
        >
          Employee List
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          Employee History
        </button>
      </div>

      <div className="employee-management-content">
        {activeTab === 'list' && (
          <EmployeeList
            onEmployeeSelect={handleEmployeeSelect}
            selectedEmployee={selectedEmployee}
          />
        )}
        {activeTab === 'details' && selectedEmployee && (
          <EmployeeDetails
            employeeId={selectedEmployee.id}
            onBack={handleBackToList}
          />
        )}
        {activeTab === 'history' && (
          <EmployeeHistory />
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;

