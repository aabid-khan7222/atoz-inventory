import React, { useState, useMemo, useRef, useEffect } from 'react';
import './SearchableDropdown.css';

const SearchableDropdown = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  noOptionsText = 'No options found',
  disabled = false,
  isOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term)),
    );
  }, [options, search]);

  const controlled = typeof isOpen === 'boolean';
  const open = controlled ? isOpen : internalOpen;

  const setOpenState = (next) => {
    if (controlled) {
      onOpenChange && onOpenChange(next);
    } else {
      setInternalOpen(next);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenState(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (option) => {
    onChange(option);
    setOpenState(false);
  };

  return (
    <div className="sd-wrapper" ref={containerRef}>
      {label && <label className="sd-label">{label}</label>}
      <button
        type="button"
        className={`sd-control ${disabled ? 'sd-control-disabled' : ''}`}
        onClick={() => !disabled && setOpenState(!open)}
      >
        <span className={`sd-value ${!selectedOption ? 'sd-placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="sd-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && !disabled && (
        <div className="sd-menu">
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
          <div className="sd-options">
            {filteredOptions.length === 0 ? (
              <div className="sd-no-options">{noOptionsText}</div>
            ) : (
              filteredOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`sd-option ${
                    selectedOption && selectedOption.value === opt.value ? 'sd-option-selected' : ''
                  }`}
                  onClick={() => handleSelect(opt)}
                >
                  <div className="sd-option-label">{opt.label}</div>
                  {opt.subLabel && <div className="sd-option-sublabel">{opt.subLabel}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;


