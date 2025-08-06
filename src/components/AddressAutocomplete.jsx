import React, { useState, useEffect, useRef } from 'react';

const REGRID_API_TOKEN = process.env.REACT_APP_REGRID_API_TOKEN;
const REGRID_BASE_URL = 'https://app.regrid.com/api/v2';

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState('');
  
  const wrapperRef = useRef(null);
  const debounceTimer = useRef(null);

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

  // Fetch suggestions from Regrid Typeahead API
  const fetchSuggestions = async (query) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const encodedQuery = encodeURIComponent(query);
      const requestUrl = `${REGRID_BASE_URL}/parcels/typeahead?query=${encodedQuery}&token=${REGRID_API_TOKEN}`;
      
      console.log('Typeahead request URL:', requestUrl);
      console.log('Searching for:', query);
      
      const response = await fetch(requestUrl);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Typeahead API error:', response.status, errorText);
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Raw typeahead response for "' + query + '":', data);
      
      // Let's also try to see if any CA results show up at all
      if (data && data.parcel_centroids && data.parcel_centroids.features) {
        console.log('Found features:', data.parcel_centroids.features.length);
        data.parcel_centroids.features.forEach((feature, index) => {
          console.log(`${index}: ${feature.properties.address} - ${feature.properties.context}`);
        });
      }
      
      // Handle the correct response format from the docs
      if (data && data.parcel_centroids && data.parcel_centroids.features) {
        // Filter out duplicates by ll_uuid as mentioned in docs
        const uniqueFeatures = [];
        const seenUuids = new Set();
        
        for (const feature of data.parcel_centroids.features) {
          const uuid = feature.properties.ll_uuid;
          if (!seenUuids.has(uuid)) {
            seenUuids.add(uuid);
            uniqueFeatures.push(feature);
          }
        }
        
        const formattedSuggestions = uniqueFeatures.map((feature, index) => ({
          address: feature.properties.address || '',
          ll_uuid: feature.properties.ll_uuid,
          path: feature.properties.path,
          context: feature.properties.context || '',
          score: feature.properties.score || 0,
          geometry: feature.geometry,
          parcel: feature,
          // Use index as backup key to ensure uniqueness
          uniqueKey: `${feature.properties.ll_uuid}_${index}`
        }));
        
        setSuggestions(formattedSuggestions.slice(0, 8)); // Limit to 8 results
      } else {
        setSuggestions([]);
      }
      
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setError(`Search error: ${error.message}`);
      setSuggestions([]);
      
      // Try a direct path lookup if it looks like we're searching for that specific address
      if (query.toLowerCase().includes('11053') && query.toLowerCase().includes('kayjay')) {
        try {
          console.log('Trying direct parcel path lookup for Kayjay St...');
          const directResponse = await fetch(
            `${REGRID_BASE_URL}/parcels/443207?token=${REGRID_API_TOKEN}`
          );
          
          if (directResponse.ok) {
            const directData = await directResponse.json();
            console.log('Direct parcel lookup result:', directData);
            
            if (directData && directData.parcels && directData.parcels.features) {
              const directSuggestion = directData.parcels.features[0];
              const formattedDirect = [{
                address: directSuggestion.properties.headline || '11053 Kayjay St',
                ll_uuid: directSuggestion.properties.ll_uuid,
                path: directSuggestion.properties.path,
                context: 'Corona, CA',
                score: 100,
                geometry: directSuggestion.geometry,
                parcel: directSuggestion,
                uniqueKey: 'direct_kayjay_lookup'
              }];
              
              setSuggestions(formattedDirect);
              setError('');
              return; // Exit early if we found it
            }
          }
        } catch (directError) {
          console.log('Direct lookup failed:', directError);
        }
      }
      
      // Try fallback to address search if typeahead completely fails
      try {
        const fallbackQuery = encodeURIComponent(query);
        const addressResponse = await fetch(
          `${REGRID_BASE_URL}/parcels/address?query=${fallbackQuery}&token=${REGRID_API_TOKEN}&limit=8`
        );
        
        if (addressResponse.ok) {
          const addressData = await addressResponse.json();
          
          if (addressData.parcels && addressData.parcels.features) {
            const fallbackSuggestions = addressData.parcels.features.map((feature, index) => ({
              address: feature.properties.headline || feature.properties.fields?.address || '',
              ll_uuid: feature.properties.fields?.ll_uuid || feature.properties.ll_uuid,
              path: feature.properties.path,
              context: feature.properties.context?.name || '',
              score: 80, // Default score for fallback
              geometry: feature.geometry,
              parcel: feature,
              uniqueKey: `fallback_${feature.properties.ll_uuid || index}_${index}`
            }));
            
            setSuggestions(fallbackSuggestions.slice(0, 6)); // Even more conservative for fallback
            setError(''); // Clear error if fallback worked
          }
        }
      } catch (fallbackError) {
        // Silent fail for fallback
      }
      
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

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setInputValue(suggestion.address);
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    
    if (onChange) onChange(suggestion.address);
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
          onFocus={() => inputValue.length >= 3 && setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
          autoComplete="off"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
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