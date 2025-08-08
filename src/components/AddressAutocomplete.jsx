import React, { useState, useEffect, useRef } from 'react';
import ZillowService from '../services/zillowService';

const AddressAutocomplete = ({ 
  value, 
  onChange, 
  onSelect,
  placeholder = "Start typing an address...",
  className = "",
  required = false 
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');
  
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);
  const lastQuery = useRef('');
  const lastResults = useRef({});
  const zillowService = new ZillowService();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Fetch suggestions from Zillow API
  const fetchSuggestions = async (query) => {
    // Require at least 3 characters to reduce unnecessary calls
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    // Check cache first
    if (lastResults.current[query]) {
      console.log('Using cached results for:', query);
      setSuggestions(lastResults.current[query].suggestions);
      setError(lastResults.current[query].error || '');
      return;
    }

    // Avoid duplicate searches
    if (query === lastQuery.current) {
      return;
    }
    
    lastQuery.current = query;
    setIsLoading(true);
    setError('');

    try {
      console.log('Searching for:', query);
      
      const suggestions = await zillowService.getAddressSuggestions(query);
      console.log('Zillow suggestions:', suggestions);
      
      let formattedSuggestions = [];
      let errorMessage = '';
      
      if (suggestions && suggestions.length > 0) {
        formattedSuggestions = suggestions.map((suggestion, index) => ({
          address: suggestion.address,
          zpid: suggestion.zpid,
          ll_uuid: suggestion.zpid, // Use zpid as unique identifier for compatibility
          context: `${suggestion.city}, ${suggestion.state}`,
          latitude: suggestion.latitude,
          longitude: suggestion.longitude,
          geometry: suggestion.geometry,
          properties: suggestion.properties,
          uniqueKey: `${suggestion.zpid}_${index}`
        }));
        
        setSuggestions(formattedSuggestions);
      } else {
        setSuggestions([]);
      }

      // Cache the results
      lastResults.current[query] = {
        suggestions: formattedSuggestions,
        error: errorMessage
      };
      
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      let errorMessage = '';
      if (error.message && error.message.includes('Rate limit')) {
        errorMessage = 'Rate limit reached. Please wait a moment before searching again.';
      } else {
        errorMessage = `Search error: ${error.message}`;
      }
      setError(errorMessage);
      setSuggestions([]);

      // Cache the error result too
      lastResults.current[query] = {
        suggestions: [],
        error: errorMessage
      };
    } finally {
      setIsLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange && onChange(newValue);
    setShowSuggestions(true);
    setSelectedIndex(-1);

    // Show typing indicator for immediate feedback
    if (newValue.length >= 3) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      setIsTyping(false); // Hide typing indicator
      fetchSuggestions(newValue);
    }, 600); // 600ms for better UX while still reducing API calls
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    const fullAddress = suggestion.address;
    setInputValue(fullAddress);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    // Cache the selected address so it shows up when user focuses back
    lastResults.current[fullAddress] = {
      suggestions: [suggestion], // Keep the selected suggestion available
      error: ''
    };
    
    // Keep the suggestion in the suggestions state for immediate display
    setSuggestions([suggestion]);
    
    if (onChange) onChange(fullAddress);
    if (onSelect) onSelect(suggestion);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        // Let other keys pass through
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (inputValue.length >= 3) {
              setShowSuggestions(true);
              // Restore cached results if available
              if (lastResults.current[inputValue]) {
                setSuggestions(lastResults.current[inputValue].suggestions);
                setError(lastResults.current[inputValue].error || '');
              } else {
                // If no cache exists, trigger a search for the current input
                fetchSuggestions(inputValue);
              }
            }
          }}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          autoComplete="off"
        />
        
        {(isLoading || isTyping) && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="flex items-center space-x-1">
              <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs text-blue-500 font-medium">
                {isLoading ? 'Searching...' : 'Typing...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.uniqueKey || suggestion.ll_uuid || index}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="font-medium">
                {suggestion.address}
              </div>
              {suggestion.context && (
                <div className="text-sm text-gray-500">
                  {suggestion.context}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSuggestions && !isLoading && inputValue.length >= 3 && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg p-3">
          <p className="text-sm text-gray-500">No addresses found. Try a different search.</p>
        </div>
      )}

      {error && (
        <div className="mt-1 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;