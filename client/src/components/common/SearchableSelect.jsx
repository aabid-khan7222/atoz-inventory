import { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

const SearchableSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Search...', 
  displayKey = 'label',
  valueKey = 'value',
  searchKeys = [],
  style = {},
  onSearch = null, // Optional callback for server-side search
  loading = false // Loading state for server-side search
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const hasLoadedInitial = useRef(false); // Track if initial load has been triggered

  // Update filtered options when options change (for server-side search)
  useEffect(() => {
    if (onSearch) {
      // When using server-side search, show all options returned from server
      // Only update if we have options (don't clear existing options during loading)
      // This prevents blanking when searching
      if (options.length > 0) {
        setFilteredOptions(options);
      }
      // If options.length is 0, keep existing filteredOptions to prevent blanking
    } else {
      // Client-side filtering
      if (!searchTerm.trim()) {
        setFilteredOptions(options);
      } else {
        const term = searchTerm.toLowerCase();
        const filtered = options.filter(option => {
          // Search in display key
          const displayValue = String(option[displayKey] || '').toLowerCase();
          if (displayValue.includes(term)) return true;

          // Search in additional search keys
          if (searchKeys.length > 0) {
            return searchKeys.some(key => {
              const searchValue = String(option[key] || '').toLowerCase();
              return searchValue.includes(term);
            });
          }

          return false;
        });
        setFilteredOptions(filtered);
      }
    }
  }, [options, displayKey, searchKeys, onSearch, searchTerm]);

  // Handle search term changes for server-side search (debounced)
  useEffect(() => {
    if (onSearch && isOpen) {
      // Only trigger search if dropdown is open and user is typing
      const timeoutId = setTimeout(() => {
        if (searchTerm.trim()) {
          onSearch(searchTerm);
        } else if (hasLoadedInitial.current) {
          // Only reload all if we've already done initial load (user cleared search)
          onSearch('');
        }
      }, 300); // Debounce for 300ms
      return () => clearTimeout(timeoutId);
    }
    // Don't do anything if dropdown is closed
  }, [searchTerm, onSearch, isOpen]);

  // Get selected option display value
  const getSelectedLabel = () => {
    if (!value || value === 'all') {
      return placeholder;
    }
    const selected = options.find(opt => String(opt[valueKey]) === String(value));
    return selected ? selected[displayKey] : placeholder;
  };

  // Handle option selection
  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Focus input when dropdown opens and trigger initial load for server-side search
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        // Small delay to ensure dropdown is rendered
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      }
      // If using server-side search, load initial data when dropdown opens (only once)
      if (onSearch && !hasLoadedInitial.current) {
        // Only load if options are empty (initial load)
        if (options.length <= 1) { // Only "All Agents" option
          hasLoadedInitial.current = true;
          onSearch('');
        }
      }
    } else {
      // Reset search term when dropdown closes
      setSearchTerm('');
      // Reset the initial load flag when dropdown closes so it can load again next time
      hasLoadedInitial.current = false;
    }
  }, [isOpen, onSearch]); // Removed options.length to prevent infinite loop

  return (
    <div ref={containerRef} className="searchable-select-container" style={style}>
      <div
        className={`searchable-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '0.5rem',
          border: '1px solid var(--corp-border)',
          borderRadius: 'var(--corp-radius-sm)',
          background: 'var(--corp-bg-primary)',
          color: 'var(--corp-text-primary)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          minHeight: '38px'
        }}
      >
        <span style={{ 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          flex: 1,
          textAlign: 'left'
        }}>
          {getSelectedLabel()}
        </span>
        <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>
          {isOpen ? '▲' : '▼'}
        </span>
      </div>

      {isOpen && (
        <div
          className="searchable-select-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '0.25rem',
            background: 'var(--corp-bg-card)',
            border: '1px solid var(--corp-border)',
            borderRadius: 'var(--corp-radius-sm)',
            boxShadow: 'var(--corp-shadow-md)',
            zIndex: 1000,
            maxHeight: '300px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--corp-border)' }}>
            <input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--corp-border)',
                borderRadius: 'var(--corp-radius-sm)',
                background: 'var(--corp-bg-primary)',
                color: 'var(--corp-text-primary)',
                fontSize: '0.875rem'
              }}
            />
          </div>
          <div
            style={{
              maxHeight: '250px',
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {loading && filteredOptions.length <= 1 ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>
                Loading...
              </div>
            ) : filteredOptions.length === 0 || (filteredOptions.length === 1 && filteredOptions[0]?.value === 'all' && onSearch && !loading) ? (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--corp-text-muted)' }}>
                {onSearch ? 'Type to search for agents...' : 'No options found'}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const optionValue = option[valueKey];
                const isSelected = String(optionValue) === String(value);
                return (
                  <div
                    key={optionValue}
                    onClick={() => handleSelect(optionValue)}
                    style={{
                      padding: '0.75rem 1rem',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--corp-bg-hover)' : 'transparent',
                      color: 'var(--corp-text-primary)',
                      borderBottom: '1px solid var(--corp-border)',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--corp-bg-hover)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {option[displayKey]}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;

