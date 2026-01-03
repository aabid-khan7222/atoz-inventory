import React, { useState, useMemo, useRef, useEffect } from 'react';
import './SearchableDropdown.css';

const MultiSelectSearchableDropdown = ({
  label,
  options,
  selectedValues = [],
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  noOptionsText = 'No options found',
  disabled = false,
  maxSelections = null,
  showSelectedCount = true,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        opt.value.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term)),
    );
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Auto-close dropdown when max selections are reached
  useEffect(() => {
    if (maxSelections && selectedValues.length >= maxSelections && open) {
      setOpen(false);
    }
  }, [selectedValues.length, maxSelections, open]);

  const handleToggle = (value) => {
    if (disabled) return;
    
    const isSelected = selectedValues.includes(value);
    
    if (isSelected) {
      // Remove from selection
      onChange(selectedValues.filter(v => v !== value));
    } else {
      // Add to selection if not at max
      if (maxSelections && selectedValues.length >= maxSelections) {
        return; // Can't select more
      }
      onChange([...selectedValues, value]);
    }
  };

  const handleRemove = (value, e) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  const displayText = useMemo(() => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (showSelectedCount && selectedValues.length > 3) {
      return `${selectedValues.length} selected`;
    }
    return selectedValues.slice(0, 3).join(', ') + (selectedValues.length > 3 ? '...' : '');
  }, [selectedValues, placeholder, showSelectedCount]);

  return (
    <div className="sd-wrapper" ref={containerRef}>
      {label && <label className="sd-label">{label}</label>}
      <button
        type="button"
        className={`sd-control ${disabled ? 'sd-control-disabled' : ''}`}
        onClick={() => !disabled && setOpen((prev) => !prev)}
      >
        <div className="sd-multi-value">
          {selectedValues.length > 0 && (
            <div className="sd-selected-tags">
              {selectedValues.slice(0, 3).map((value) => {
                const option = options.find(opt => opt.value === value);
                return (
                  <span key={value} className="sd-tag">
                    {option?.label || value}
                    <span
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRemove(value, e);
                        }
                      }}
                      onClick={(e) => handleRemove(value, e)}
                      className="sd-tag-remove"
                      aria-label={`Remove ${option?.label || value}`}
                    >
                      ×
                    </span>
                  </span>
                );
              })}
              {selectedValues.length > 3 && (
                <span className="sd-tag-count">+{selectedValues.length - 3} more</span>
              )}
            </div>
          )}
          <span className={`sd-value ${selectedValues.length === 0 ? 'sd-placeholder' : ''}`}>
            {selectedValues.length === 0 ? displayText : (selectedValues.length > 3 ? displayText : '')}
          </span>
        </div>
        <span className="sd-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && !disabled && (
        <div className="sd-menu sd-menu-multi">
          <div className="sd-search-row">
            <input
              type="text"
              className="sd-search-input"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="sd-options sd-options-multi">
            {filteredOptions.length === 0 ? (
              <div className="sd-no-options">{noOptionsText}</div>
            ) : (
              <>
                {maxSelections && (
                  <div className="sd-selection-info">
                    {selectedValues.length} of {maxSelections} selected
                  </div>
                )}
                <div className="sd-options-list">
                  {filteredOptions.map((opt) => {
                    const isSelected = selectedValues.includes(opt.value);
                    const isDisabled = maxSelections && !isSelected && selectedValues.length >= maxSelections;
                    
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        className={`sd-option sd-option-multi ${
                          isSelected ? 'sd-option-selected' : ''
                        } ${isDisabled ? 'sd-option-disabled' : ''}`}
                        onClick={() => handleToggle(opt.value)}
                        disabled={isDisabled}
                      >
                        <span className="sd-checkbox">
                          {isSelected ? '✓' : ''}
                        </span>
                        <div className="sd-option-content">
                          <div className="sd-option-label">{opt.label}</div>
                          {opt.subLabel && <div className="sd-option-sublabel">{opt.subLabel}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelectSearchableDropdown;

