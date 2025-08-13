import React, { useState } from 'react';
import ZillowService from '../services/zillowService';
import AddressAutocomplete from './AddressAutocomplete';

const NeighborLookup = ({ onNeighborsFound }) => {
  const [address, setAddress] = useState('');
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [selectedNeighbors, setSelectedNeighbors] = useState([]);
  const [searchOptions, setSearchOptions] = useState({
    radius: 50,
    includeAcrossStreet: true,
    maxResults: 15  // Default to 15 for more results
  });

  const zillowService = new ZillowService();

  const handleAddressSelect = (suggestion) => {
    setSelectedAddress(suggestion);
    setAddress(suggestion.address);
    setError('');
  };

  const handleSearch = async () => {
    if (!selectedAddress) {
      setError('Please select an address from the autocomplete dropdown first');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setSelectedNeighbors([]);

    try {
      let neighborData;
      
      // Use the selected address to find neighbors
      if (selectedAddress && selectedAddress.zpid) {
        console.log(`Searching neighbors for: ${selectedAddress.address} (zpid: ${selectedAddress.zpid})`);
        
        // Use Zillow service to find neighbors using the property object
        neighborData = await zillowService.getNeighborsByAddress(selectedAddress, {
          ...searchOptions
        });
      } else {
        throw new Error('Please select an address from the autocomplete suggestions first');
      }
      
      setResults(neighborData);
      
      if (neighborData.neighbors.length === 0) {
        setError('No neighboring properties found');
      }
    } catch (err) {
      setError(err.message || 'Failed to find neighboring properties');
      console.error('Neighbor lookup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNeighborSelect = (neighbor) => {
    setSelectedNeighbors(prev => {
      const isSelected = prev.some(n => n.zpid === neighbor.zpid);
      if (isSelected) {
        return prev.filter(n => n.zpid !== neighbor.zpid);
      }
      return [...prev, neighbor];
    });
  };

  const handleAddSelectedNeighbors = () => {
    if (onNeighborsFound && selectedNeighbors.length > 0) {
      onNeighborsFound(selectedNeighbors);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      target: 'Target Property',
      immediate: 'Immediate Neighbor',
      across: 'Across the Street',
      adjacent: 'Adjacent',
      nearby: 'Nearby',
      area: 'In Area'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      target: 'bg-red-100 text-red-800',
      immediate: 'bg-green-100 text-green-800',
      across: 'bg-blue-100 text-blue-800',
      adjacent: 'bg-yellow-100 text-yellow-800',
      nearby: 'bg-purple-100 text-purple-800',
      area: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4">Find Neighboring Properties</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter Property Address
          </label>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={handleAddressSelect}
            placeholder="Start typing an address (e.g., 12436 Oberlin Dr, Dallas, TX...)"
            className=""
          />
          <p className="text-xs text-gray-500 mt-1">
            Type at least 3 characters to see suggestions
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Radius (meters)
            </label>
            <select
              value={searchOptions.radius}
              onChange={(e) => setSearchOptions({...searchOptions, radius: parseInt(e.target.value)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30">30m - Next door only</option>
              <option value="50">50m - Immediate neighbors</option>
              <option value="100">100m - Include across street</option>
              <option value="200">200m - Broader area</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Results
            </label>
            <input
              type="number"
              value={searchOptions.maxResults}
              onChange={(e) => setSearchOptions({...searchOptions, maxResults: parseInt(e.target.value)})}
              min="5"
              max="50"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={searchOptions.includeAcrossStreet}
                onChange={(e) => setSearchOptions({...searchOptions, includeAcrossStreet: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">Include across street</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={loading || !selectedAddress}
          className={`w-full py-2 px-4 rounded-md transition-colors ${
            loading || !selectedAddress
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {loading ? 'Searching...' : selectedAddress ? 'Find Neighbors' : 'Select Address First'}
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {results && (
          <div className="mt-6">
            <div className="mb-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">Target Property:</h4>
                  <p className="text-gray-700">{results.targetAddress}</p>
                </div>
                <button
                  onClick={() => {
                    if (results.targetProperty) {
                      // Create a neighbor-like object for the target property
                      const targetAsNeighbor = {
                        address: results.targetAddress,
                        zpid: results.targetProperty.zpid,
                        latitude: results.targetProperty.latitude,
                        longitude: results.targetProperty.longitude,
                        distance: 0,
                        direction: 'Target',
                        category: 'target',
                        bedrooms: results.targetProperty.bedrooms || null,
                        bathrooms: results.targetProperty.bathrooms || null,
                        livingArea: results.targetProperty.livingArea || results.targetProperty.livingAreaValue || null,
                        lotSize: results.targetProperty.lotSize || null,
                        yearBuilt: results.targetProperty.yearBuilt || null,
                        homeType: results.targetProperty.homeType || null,
                        price: results.targetProperty.price || null,
                        zestimate: results.targetProperty.zestimate || null,
                        homeStatus: results.targetProperty.homeStatus || null,
                        fields: {
                          ll_uuid: results.targetProperty.zpid,
                          bedrooms: results.targetProperty.bedrooms,
                          bathrooms: results.targetProperty.bathrooms,
                          living_area: results.targetProperty.livingArea || results.targetProperty.livingAreaValue,
                          lot_size: results.targetProperty.lotSize,
                          year_built: results.targetProperty.yearBuilt,
                          home_type: results.targetProperty.homeType,
                          price: results.targetProperty.price,
                          zestimate: results.targetProperty.zestimate,
                          home_status: results.targetProperty.homeStatus
                        }
                      };
                      
                      setSelectedNeighbors(prev => {
                        const isSelected = prev.some(n => n.zpid === results.targetProperty.zpid);
                        if (isSelected) {
                          return prev.filter(n => n.zpid !== results.targetProperty.zpid);
                        }
                        return [...prev, targetAsNeighbor];
                      });
                    }
                  }}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    selectedNeighbors.some(n => n.zpid === results.targetProperty?.zpid)
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {selectedNeighbors.some(n => n.zpid === results.targetProperty?.zpid) ? 'Added' : 'Add Target'}
                </button>
              </div>
            </div>

            {results.neighbors.length > 0 && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-semibold text-lg">
                    Found {results.neighbors.length} Neighboring Properties
                  </h4>
                  {selectedNeighbors.length > 0 && (
                    <button
                      onClick={handleAddSelectedNeighbors}
                      className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition-colors"
                    >
                      Add {selectedNeighbors.length} Selected Properties
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {results.neighbors.map((neighbor, index) => (
                    <div
                      key={neighbor.zpid || index}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedNeighbors.some(n => n.zpid === neighbor.zpid)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => handleNeighborSelect(neighbor)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <input
                              type="checkbox"
                              checked={selectedNeighbors.some(n => n.zpid === neighbor.zpid)}
                              onChange={() => {}}
                              className="mr-2"
                            />
                            <p className="font-medium">{neighbor.address}</p>
                          </div>
                          
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className={`px-2 py-1 rounded-full ${getCategoryColor(neighbor.category)}`}>
                              {getCategoryLabel(neighbor.category)}
                            </span>
                            <span className="text-gray-600">
                              {neighbor.distance}m {neighbor.direction}
                            </span>
                            {neighbor.price && (
                              <span className="text-green-600 font-medium">
                                ${neighbor.price.toLocaleString()}
                              </span>
                            )}
                            {neighbor.bedrooms && neighbor.bathrooms && (
                              <span className="text-gray-600">
                                {neighbor.bedrooms}bd {neighbor.bathrooms}ba
                              </span>
                            )}
                            {neighbor.livingArea && (
                              <span className="text-gray-600">
                                {neighbor.livingArea} sqft
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {results.categorized && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-semibold mb-2">Summary by Category:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {Object.entries(results.categorized).map(([category, neighbors]) => (
                        neighbors.length > 0 && (
                          <div key={category} className="text-center">
                            <div className={`px-2 py-1 rounded ${getCategoryColor(category)}`}>
                              {getCategoryLabel(category)}
                            </div>
                            <div className="mt-1 font-semibold">{neighbors.length}</div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NeighborLookup;