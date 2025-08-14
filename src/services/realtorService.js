class RealtorService {
  constructor() {
    this.apiKey = process.env.REACT_APP_REALTOR_API_KEY;
    this.apiHost = process.env.REACT_APP_REALTOR_API_HOST;
    this.baseUrl = `https://${this.apiHost}`;
    this.lastRequestTime = 0;
    this.minRequestInterval = 3000; // 3 seconds between requests to avoid rate limiting
  }

  // Rate limiting helper
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  // Get property details by property_id
  async getPropertyDetails(propertyId) {
    try {
      await this.waitForRateLimit();
      
      const response = await fetch(`${this.baseUrl}/property/details?property_id=${propertyId}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait a moment before trying again.`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract the key property data
      if (data.data) {
        const property = data.data;
        const description = property.description || {};
        
        return {
          property_id: propertyId,
          address: property.location?.address,
          yearBuilt: description.year_built,
          squareFootage: description.sqft,
          bedrooms: description.beds,
          bathrooms: description.baths,
          lotSize: description.lot_sqft,
          propertyType: description.type,
          stories: description.stories,
          location: property.location,
          raw_data: property // Keep raw data for debugging
        };
      }

      return null;
    } catch (error) {
      console.error('Realtor property details error:', error);
      throw error;
    }
  }

  // Get property estimates by property_id
  async getPropertyEstimates(propertyId) {
    try {
      await this.waitForRateLimit();
      
      const response = await fetch(`${this.baseUrl}/property/estimates?property_id=${propertyId}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait a moment before trying again.`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.home?.estimates?.current_values) {
        // Get the best estimate (usually CoreLogic)
        const bestEstimate = data.home.estimates.current_values.find(est => est.isbest_homevalue) 
                          || data.home.estimates.current_values[0];
        
        return {
          currentValue: bestEstimate?.estimate,
          estimateHigh: bestEstimate?.estimate_high,
          estimateLow: bestEstimate?.estimate_low,
          source: bestEstimate?.source?.name,
          date: bestEstimate?.date,
          raw_estimates: data.home.estimates
        };
      }

      return null;
    } catch (error) {
      console.error('Realtor property estimates error:', error);
      throw error;
    }
  }

  // Try to get property by constructing Realtor.com URL
  async getPropertyByDirectURL(address) {
    try {
      await this.waitForRateLimit();
      
      console.log(`[Realtor] Trying direct URL lookup for: ${address}`);
      
      // Format address for URL: "65 Summit Ave, Mill Valley, CA 94941" -> "65-Summit-Ave_Mill-Valley_CA_94941"
      const addressParts = address.split(',').map(part => part.trim());
      const street = addressParts[0]?.replace(/\s+/g, '-');
      const city = addressParts[1]?.replace(/\s+/g, '-');
      const stateZip = addressParts[2]?.split(' ');
      const state = stateZip?.[0];
      const zip = stateZip?.[1];
      
      // Try multiple URL formats that Realtor.com uses
      const urlFormats = [
        `https://www.realtor.com/realestateandhomes-detail/${street}_${city}_${state}_${zip}`,
        `https://www.realtor.com/realestateandhomes-detail/${street.replace(/-/g, '')}_${city}_${state}_${zip}`,  
        `https://www.realtor.com/realestateandhomes-detail/${street}--${city}--${state}--${zip}`,
        `https://www.realtor.com/realestateandhomes-search/${city}_${state}/address-${street.toLowerCase()}`
      ];
      
      for (const realtorUrl of urlFormats) {
        console.log(`[Realtor] Trying URL format: ${realtorUrl}`);
        
        try {
          // Use search_by_url endpoint
          const encodedUrl = encodeURIComponent(realtorUrl);
          const response = await fetch(`${this.baseUrl}/search_by_url?url=${encodedUrl}`, {
            method: 'GET',
            headers: {
              'x-rapidapi-key': this.apiKey,
              'x-rapidapi-host': this.apiHost
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log(`[Realtor] Direct URL lookup result for ${realtorUrl}:`, data);
            
            // Check if we found actual property data (not an error)
            if (data && data.data && !data.error && data.data.length > 0) {
              const property = Array.isArray(data.data) ? data.data[0] : data.data;
              if (property && property.property_id) {
                console.log(`[Realtor] SUCCESS - Found property via URL: ${realtorUrl}`);
                return {
                  property_id: property.property_id || property.id,
                  address: address,
                  yearBuilt: property.description?.year_built || property.year_built,
                  squareFootage: property.description?.sqft || property.sqft || property.living_area,
                  bedrooms: property.description?.beds || property.beds,
                  bathrooms: property.description?.baths || property.baths,
                  propertyType: property.description?.type || property.property_type,
                  lotSize: property.description?.lot_sqft || property.lot_size,
                  lastSoldPrice: property.description?.sold_price,
                  lastSoldDate: property.description?.sold_date,
                  zestimate: property.estimate?.estimate,
                  dataSource: 'realtor_direct',
                  raw_data: property
                };
              }
            }
          } else {
            console.log(`[Realtor] URL ${realtorUrl} failed with status: ${response.status}`);
          }
          
          // Add delay between URL attempts to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (urlError) {
          console.log(`[Realtor] URL ${realtorUrl} threw error:`, urlError.message);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Realtor] Direct URL lookup error:', error);
      return null;
    }
  }
  
  // Search properties by address (for address validation and getting property_id)
  async searchPropertiesByAddress(address) {
    try {
      // First try direct URL lookup for exact address
      const directResult = await this.getPropertyByDirectURL(address);
      if (directResult) {
        console.log(`[Realtor] Found property via direct URL lookup`);
        return [directResult]; // Return as array for consistency
      }
      
      await this.waitForRateLimit();
      
      console.log(`[Realtor] Falling back to area search for: ${address}`);
      
      // Extract city/state from address for search
      const addressParts = this.parseAddress(address);
      console.log(`[Realtor] Parsed address:`, addressParts);
      
      // Try the actual available search endpoints
      const searchEndpoints = [
        { 
          path: '/search/forsale',
          params: this.buildSearchParams(addressParts),
          type: 'for_sale'
        },
        { 
          path: '/search/forsold',
          params: this.buildSearchParams(addressParts),
          type: 'sold'
        },
        { 
          path: '/search/forrent',
          params: this.buildSearchParams(addressParts),
          type: 'for_rent'
        }
      ];
      
      // Try only the forsale endpoint first (most likely to have recent data)
      try {
        console.log(`[Realtor] Trying search endpoint: /search/forsale`);
        
        const url = `${this.baseUrl}/search/forsale?${searchEndpoints[0].params}`;
        console.log(`[Realtor] Search URL: ${url}`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'x-rapidapi-key': this.apiKey,
            'x-rapidapi-host': this.apiHost
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[Realtor] Search results for "${address}":`, data);
          
          // Process search results and find properties near the target address
          const nearbyProperties = this.findNearbyProperties(data, address, addressParts);
          if (nearbyProperties && nearbyProperties.length > 0) {
            console.log(`[Realtor] Found ${nearbyProperties.length} properties in area`);
            return nearbyProperties;
          }
        } else {
          console.log(`[Realtor] API returned status: ${response.status}`);
        }
      } catch (endpointError) {
        console.log(`[Realtor] API call failed:`, endpointError.message);
      }
      
      console.log(`[Realtor] No properties found in area for: ${address}`);
      return null;
      
    } catch (error) {
      console.error('Realtor address search error:', error);
      throw error;
    }
  }

  // Parse address into components
  parseAddress(fullAddress) {
    console.log(`[Realtor] Parsing address: ${fullAddress}`);
    
    // Try to extract: "140 Linden Lane, Mill Valley, CA 94941"
    const parts = fullAddress.split(',').map(part => part.trim());
    
    let street = '';
    let city = '';
    let state = '';
    let zipcode = '';
    
    if (parts.length >= 3) {
      street = parts[0];
      city = parts[1];
      
      // Last part might be "CA 94941" or just "CA"
      const stateZip = parts[parts.length - 1].split(' ');
      if (stateZip.length >= 1) {
        state = stateZip[0];
        if (stateZip.length >= 2) {
          zipcode = stateZip[1];
        }
      }
    }
    
    return {
      street,
      city,
      state,
      zipcode,
      fullAddress
    };
  }

  // Build search parameters for Realtor API
  buildSearchParams(addressParts) {
    const params = new URLSearchParams();
    
    // Common parameters that search endpoints might accept
    if (addressParts.city) {
      params.append('city', addressParts.city);
    }
    if (addressParts.state) {
      params.append('state_code', addressParts.state);
    }
    if (addressParts.zipcode) {
      params.append('postal_code', addressParts.zipcode);
    }
    
    // Also try location-based search
    if (addressParts.city && addressParts.state) {
      params.append('location', `${addressParts.city}, ${addressParts.state}`);
    }
    
    // Limit results
    params.append('limit', '10');
    
    return params.toString();
  }

  // Find properties near the target address
  findNearbyProperties(searchData, targetAddress, addressParts) {
    console.log(`[Realtor] Processing search results for nearby properties`);
    
    // Handle different response formats
    let properties = [];
    if (searchData.data && searchData.data.home_search && searchData.data.home_search.results) {
      properties = searchData.data.home_search.results;
    } else if (searchData.data && Array.isArray(searchData.data)) {
      properties = searchData.data;
    } else if (searchData.results) {
      properties = searchData.results;
    } else if (searchData.properties) {
      properties = searchData.properties;
    } else if (Array.isArray(searchData)) {
      properties = searchData;
    }
    
    console.log(`[Realtor] Found ${properties.length} properties in search results`);
    
    if (properties.length === 0) {
      return null;
    }
    
    // Convert to standardized format and find closest matches
    const processedProperties = properties.slice(0, 5).map(property => {
      const location = property.location || {};
      const address = location.address || {};
      const fullAddress = `${address.line || ''} ${address.city || ''} ${address.state_code || ''} ${address.postal_code || ''}`.trim();
      
      console.log(`[Realtor] Processing search result:`, {
        property_id: property.property_id || property.id,
        address: fullAddress,
        street: address.line,
        target_address: targetAddress
      });
      
      return {
        property_id: property.property_id || property.id || `realtor_${Date.now()}_${Math.random()}`,
        address: fullAddress,
        street: address.line || addressParts.street,
        city: address.city || addressParts.city,
        state: address.state_code || addressParts.state,
        zipcode: address.postal_code || addressParts.zipcode,
        latitude: location.coordinate?.lat,
        longitude: location.coordinate?.lon,
        source: 'realtor_search',
        searchType: property.status || 'unknown'
      };
    });
    
    // First try to find exact street address matches
    const exactMatches = processedProperties.filter(prop => {
      const propStreet = (prop.street || '').toLowerCase();
      const targetStreet = addressParts.street.toLowerCase();
      return propStreet.includes(targetStreet.split(' ')[0]) || targetStreet.includes(propStreet.split(' ')[0]);
    });
    
    console.log(`[Realtor] Found ${exactMatches.length} potential street matches`);
    if (exactMatches.length > 0) {
      exactMatches.forEach(match => {
        console.log(`[Realtor] Street match: "${match.address}" vs target "${targetAddress}"`);
      });
      return exactMatches;
    }
    
    // Fallback to city matches if no street matches
    const nearbyProperties = processedProperties.filter(prop => {
      return prop.city && prop.city.toLowerCase() === addressParts.city.toLowerCase();
    });
    
    console.log(`[Realtor] Found ${nearbyProperties.length} properties in target city`);
    return nearbyProperties.length > 0 ? nearbyProperties : processedProperties;
  }

  // Simulate getting property data when we have minimal info
  async getPropertyDataFromAddress(address, csvData = {}) {
    try {
      await this.waitForRateLimit();
      
      console.log(`[Realtor] Attempting to get property data for: ${address}`);
      console.log(`[Realtor] Available CSV data:`, csvData);
      
      // In a real scenario, we'd search by address first to get property_id
      // then get details. For now, we'll return null since we need the search endpoint
      
      return null;
    } catch (error) {
      console.error('Realtor property data error:', error);
      throw error;
    }
  }

  // Helper method to extract property data for NFIRS calculation
  extractPropertyDataForNFIRS(realtorProperty) {
    if (!realtorProperty) return null;

    return {
      address: this.formatAddress(realtorProperty.address),
      yearBuilt: realtorProperty.yearBuilt ? realtorProperty.yearBuilt.toString() : null,
      squareFootage: realtorProperty.squareFootage ? realtorProperty.squareFootage.toString() : null,
      bedrooms: realtorProperty.bedrooms,
      bathrooms: realtorProperty.bathrooms,
      lotSize: realtorProperty.lotSize,
      propertyType: this.mapPropertyType(realtorProperty.propertyType),
      stories: realtorProperty.stories ? realtorProperty.stories.toString() : '1',
      dataSource: 'realtor',
      hasCompleteData: !!(realtorProperty.yearBuilt && realtorProperty.squareFootage)
    };
  }

  // Format address from Realtor API response
  formatAddress(addressObj) {
    if (!addressObj) return 'Unknown Address';
    
    if (typeof addressObj === 'string') return addressObj;
    
    const parts = [];
    if (addressObj.line) parts.push(addressObj.line);
    if (addressObj.city) parts.push(addressObj.city);
    if (addressObj.state_code) parts.push(addressObj.state_code);
    if (addressObj.postal_code) parts.push(addressObj.postal_code);
    
    return parts.join(', ');
  }

  // Map Realtor property types to our standard types
  mapPropertyType(realtorType) {
    if (!realtorType) return 'residential';
    
    const type = realtorType.toLowerCase();
    if (type.includes('single') || type.includes('house')) return 'residential';
    if (type.includes('condo') || type.includes('apartment')) return 'residential';
    if (type.includes('townhouse') || type.includes('town')) return 'residential';
    if (type.includes('commercial') || type.includes('office')) return 'commercial';
    if (type.includes('industrial')) return 'industrial';
    
    return 'residential'; // Default
  }
}

export default RealtorService;