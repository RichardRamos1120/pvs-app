class ZillowService {
  constructor() {
    this.apiKey = process.env.REACT_APP_ZILLOW_API_KEY;
    this.apiHost = process.env.REACT_APP_ZILLOW_API_HOST;
    this.baseUrl = `https://${this.apiHost}`;
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 2 seconds between requests to avoid rate limiting
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

  async searchProperties(location, options = {}) {
    try {
      await this.waitForRateLimit();
      
      const params = new URLSearchParams({
        location: location,
        status_type: options.status_type || 'ForSale',
        home_type: options.home_type || 'Houses',
        ...options
      });

      const response = await fetch(`${this.baseUrl}/propertyExtendedSearch?${params}`, {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost
        }
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded. Please wait a moment before searching again.`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Zillow search error:', error);
      throw error;
    }
  }

  async getPropertyDetails(zpid) {
    try {
      await this.waitForRateLimit();
      
      const response = await fetch(`${this.baseUrl}/property?zpid=${zpid}`, {
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
      return data;
    } catch (error) {
      console.error('Zillow property details error:', error);
      throw error;
    }
  }

  async getNeighborsByAddress(addressOrProperty, options = {}) {
    try {
      let targetProperty;
      
      // If we received a property object with zpid, use it directly
      if (typeof addressOrProperty === 'object' && addressOrProperty.zpid) {
        targetProperty = addressOrProperty;
      } else {
        // Otherwise search for the address
        const address = typeof addressOrProperty === 'string' ? addressOrProperty : addressOrProperty.address;
        const searchResults = await this.searchProperties(address);
        
        if (!searchResults.props || searchResults.props.length === 0) {
          throw new Error('Address not found');
        }

        // Get the first matching property
        targetProperty = searchResults.props[0];
      }
      
      // Get detailed property info which includes nearby homes
      const propertyDetails = await this.getPropertyDetails(targetProperty.zpid);
      
      // Validate year built data for target property
      let targetYearBuilt = propertyDetails.yearBuilt || targetProperty.yearBuilt;
      if (targetYearBuilt) {
        const currentYear = new Date().getFullYear();
        if (targetYearBuilt > currentYear || targetYearBuilt < 1800) {
          console.warn(`Invalid yearBuilt for target property: ${targetYearBuilt}. Setting to null.`);
          targetYearBuilt = null;
        }
      }

      // Merge detailed property info with target property
      const enrichedTargetProperty = {
        ...targetProperty,
        // Add detailed info from property details API
        zestimate: propertyDetails.zestimate || targetProperty.zestimate,
        price: propertyDetails.price || targetProperty.price,
        bedrooms: propertyDetails.bedrooms || targetProperty.bedrooms,
        bathrooms: propertyDetails.bathrooms || targetProperty.bathrooms,
        livingArea: propertyDetails.livingArea || propertyDetails.livingAreaValue || targetProperty.livingArea || targetProperty.livingAreaValue,
        yearBuilt: targetYearBuilt,
        homeType: propertyDetails.homeType || targetProperty.homeType,
        homeStatus: propertyDetails.homeStatus || targetProperty.homeStatus
      };
      
      if (!propertyDetails.nearbyHomes) {
        return {
          targetAddress: enrichedTargetProperty.address || 'Selected Property',
          targetProperty: enrichedTargetProperty,
          neighbors: [],
          categorized: {
            immediate: [],
            adjacent: [],
            nearby: [],
            area: []
          }
        };
      }

      // Log the number of nearby homes returned by Zillow API
      console.log(`Zillow API returned ${propertyDetails.nearbyHomes.length} nearby homes`);
      
      // Remove any potential duplicates from Zillow API response
      const uniqueHomes = propertyDetails.nearbyHomes.filter((home, index, arr) => 
        arr.findIndex(h => h.zpid === home.zpid) === index
      );
      
      if (uniqueHomes.length < propertyDetails.nearbyHomes.length) {
        console.warn(`Removed ${propertyDetails.nearbyHomes.length - uniqueHomes.length} duplicate neighbors from Zillow API response`);
      }

      // Process unique nearby homes into our expected format
      const neighbors = uniqueHomes.map(home => {
        const distance = this.calculateDistance(
          enrichedTargetProperty.latitude, 
          enrichedTargetProperty.longitude,
          home.latitude, 
          home.longitude
        );

        const direction = this.calculateDirection(
          enrichedTargetProperty.latitude,
          enrichedTargetProperty.longitude,
          home.latitude,
          home.longitude
        );

        // Build address from nested structure or use available string
        let fullAddress = '';
        if (home.address) {
          if (typeof home.address === 'string') {
            fullAddress = home.address;
          } else {
            // Handle nested address structure
            fullAddress = `${home.address.streetAddress || ''}, ${home.address.city || ''}, ${home.address.state || ''} ${home.address.zipcode || ''}`.trim();
          }
        }
        
        // Fallback if address construction failed
        if (!fullAddress || fullAddress === ', ,  ') {
          fullAddress = `Property ${home.zpid}`;
        }

        // Debug: Log all available fields for this neighbor
        console.log(`Debug - Neighbor ${fullAddress} raw data:`, {
          yearBuilt: home.yearBuilt,
          dateBuilt: home.dateBuilt,
          yearBuilt_alt: home.year_built,
          built: home.built,
          construction: home.construction,
          allFields: Object.keys(home)
        });

        // Validate and fix year built data
        let validatedYearBuilt = home.yearBuilt || home.dateBuilt || home.year_built;
        if (validatedYearBuilt) {
          const currentYear = new Date().getFullYear();
          // If year is unrealistic (future or too old), log it and set to null
          if (validatedYearBuilt > currentYear || validatedYearBuilt < 1800) {
            console.warn(`Invalid yearBuilt for ${fullAddress}: ${validatedYearBuilt}. Setting to null.`);
            validatedYearBuilt = null;
          }
        } else {
          console.warn(`No yearBuilt data found for ${fullAddress}`);
        }

        return {
          address: fullAddress,
          zpid: home.zpid,
          latitude: home.latitude,
          longitude: home.longitude,
          distance: Math.round(distance),
          direction: direction,
          category: this.categorizeNeighbor(distance, enrichedTargetProperty.address, fullAddress, direction),
          
          // Property details
          bedrooms: home.bedrooms || null,
          bathrooms: home.bathrooms || null,
          livingArea: home.livingAreaValue || null,
          lotSize: home.lotSize || null,
          yearBuilt: validatedYearBuilt,
          homeType: home.homeType || null,
          price: home.price || null,
          zestimate: home.zestimate || null,
          homeStatus: home.homeStatus || null,
          
          // Additional data
          propertyType: home.homeType,
          owner: null, // Zillow doesn't provide owner info in nearby homes
          fields: {
            ll_uuid: home.zpid, // Use zpid as unique identifier
            bedrooms: home.bedrooms,
            bathrooms: home.bathrooms,
            living_area: home.livingAreaValue,
            lot_size: home.lotSize,
            year_built: home.yearBuilt,
            home_type: home.homeType,
            price: home.price,
            zestimate: home.zestimate,
            home_status: home.homeStatus
          }
        };
      });

      // Filter neighbors within specified radius
      const radius = options.radius || 100; // meters
      let filteredNeighbors = neighbors.filter(neighbor => neighbor.distance <= radius);

      // Filter out "across the street" neighbors if not requested
      if (!options.includeAcrossStreet) {
        filteredNeighbors = filteredNeighbors.filter(neighbor => neighbor.category !== 'across');
      }

      // Limit results
      const maxResults = options.maxResults || 10;
      console.log(`Limiting results from ${filteredNeighbors.length} filtered neighbors to max ${maxResults}`);
      const limitedNeighbors = filteredNeighbors.slice(0, maxResults);

      // Categorize neighbors
      const categorized = {
        immediate: limitedNeighbors.filter(n => n.category === 'immediate'),
        across: limitedNeighbors.filter(n => n.category === 'across'),
        adjacent: limitedNeighbors.filter(n => n.category === 'adjacent'),
        nearby: limitedNeighbors.filter(n => n.category === 'nearby'),
        area: limitedNeighbors.filter(n => n.category === 'area')
      };

      return {
        targetAddress: enrichedTargetProperty.address || 'Selected Property',
        targetProperty: enrichedTargetProperty,
        neighbors: limitedNeighbors,
        categorized: categorized
      };

    } catch (error) {
      console.error('Get neighbors error:', error);
      throw error;
    }
  }

  async getAddressSuggestions(query, options = {}) {
    try {
      // Use property search to get suggestions
      const searchResults = await this.searchProperties(query, {
        ...options,
        // Limit results for autocomplete
        page: 1
      });

      if (!searchResults.props) {
        // Handle the case where Zillow returns a zpid directly for exact matches
        if (searchResults.zpid) {
          // Get property details and format as suggestion
          const propertyDetails = await this.getPropertyDetails(searchResults.zpid);
          return [{
            address: `${propertyDetails.streetAddress}, ${propertyDetails.city}, ${propertyDetails.state} ${propertyDetails.zipcode}`,
            zpid: searchResults.zpid,
            latitude: propertyDetails.latitude,
            longitude: propertyDetails.longitude,
            city: propertyDetails.city,
            state: propertyDetails.state,
            zipcode: propertyDetails.zipcode,
            streetAddress: propertyDetails.streetAddress,
            
            geometry: {
              type: 'Point',
              coordinates: [propertyDetails.longitude, propertyDetails.latitude]
            },
            properties: {
              ll_uuid: searchResults.zpid,
              address: `${propertyDetails.streetAddress}, ${propertyDetails.city}, ${propertyDetails.state} ${propertyDetails.zipcode}`,
              city: propertyDetails.city,
              state: propertyDetails.state,
              zipcode: propertyDetails.zipcode
            }
          }];
        }
        return [];
      }

      return searchResults.props.slice(0, 8).map(prop => {
        // The address is already a full string in the response like "73876 Elizabeth Dr, Thousand Palms, CA 92276"
        const fullAddress = prop.address || `Property ${prop.zpid}`;
        
        // Parse the address to extract components (optional, for context display)
        let city = '';
        let state = '';
        let zipcode = '';
        let streetAddress = '';
        
        if (prop.address && typeof prop.address === 'string') {
          // Try to parse "Street Address, City, State Zipcode" format
          const addressParts = prop.address.split(', ');
          if (addressParts.length >= 3) {
            streetAddress = addressParts[0];
            city = addressParts[1];
            const stateZip = addressParts[2].split(' ');
            if (stateZip.length >= 2) {
              state = stateZip[0];
              zipcode = stateZip[1];
            }
          }
        }
        
        return {
          address: fullAddress,
          zpid: prop.zpid,
          latitude: prop.latitude,
          longitude: prop.longitude,
          city: city,
          state: state,
          zipcode: zipcode,
          streetAddress: streetAddress,
          
          // For compatibility with existing code
          geometry: {
            type: 'Point',
            coordinates: [prop.longitude, prop.latitude] // [lon, lat] format
          },
          properties: {
            ll_uuid: prop.zpid,
            address: fullAddress,
            city: city,
            state: state,
            zipcode: zipcode
          }
        };
      });

    } catch (error) {
      console.error('Address suggestions error:', error);
      // Check if it's a rate limit error
      if (error.message && error.message.includes('429')) {
        console.warn('Rate limit hit. Please wait a moment before searching again.');
      }
      return [];
    }
  }

  // Utility methods
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  calculateDirection(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
    
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;
    
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  }

  categorizeNeighbor(distance, targetAddress, neighborAddress, direction) {
    // Check if it's across the street based on address patterns
    const isAcrossStreet = this.isAcrossStreet(targetAddress, neighborAddress);
    
    console.log(`Categorizing: ${neighborAddress} vs ${targetAddress} - Distance: ${distance}m, Across: ${isAcrossStreet}`);
    
    if (isAcrossStreet && distance <= 100) {
      return 'across';
    }
    
    if (distance <= 30) return 'immediate';
    if (distance <= 60) return 'adjacent';
    if (distance <= 150) return 'nearby';
    return 'area';
  }

  isAcrossStreet(targetAddress, neighborAddress) {
    // Extract house numbers from addresses
    const targetNumber = this.extractHouseNumber(targetAddress);
    const neighborNumber = this.extractHouseNumber(neighborAddress);
    
    if (!targetNumber || !neighborNumber) return false;
    
    // Check if they're on the same street (same street name)
    const targetStreet = this.extractStreetName(targetAddress);
    const neighborStreet = this.extractStreetName(neighborAddress);
    
    if (targetStreet !== neighborStreet) return false;
    
    // Check if house numbers indicate opposite sides of street
    // Even vs Odd typically indicates opposite sides
    const targetEven = targetNumber % 2 === 0;
    const neighborEven = neighborNumber % 2 === 0;
    
    // If one is even and one is odd, they're likely across the street
    return targetEven !== neighborEven;
  }

  extractHouseNumber(address) {
    // Extract the first number from the address
    const match = address.match(/^(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  extractStreetName(address) {
    // Extract street name (everything after house number until comma)
    const match = address.match(/^\d+\s+(.+?),/);
    return match ? match[1].trim().toLowerCase() : '';
  }
}

export default ZillowService;