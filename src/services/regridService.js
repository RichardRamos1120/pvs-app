const REGRID_API_TOKEN = process.env.REACT_APP_REGRID_API_TOKEN;
const REGRID_BASE_URL = 'https://app.regrid.com/api/v2';

class RegridService {
  constructor(apiToken = REGRID_API_TOKEN) {
    this.apiToken = apiToken;
  }

  async geocodeAddress(address) {
    try {
      // Parse address components more carefully
      const addressParts = address.split(',').map(part => part.trim());
      let streetAddress = addressParts[0];
      
      // Remove any apartment/unit numbers for better matching
      streetAddress = streetAddress.replace(/\s+(apt|apartment|unit|suite|ste|#)\s*.*/i, '').trim();
      
      // Try different query formats
      const queries = [
        streetAddress,  // Just street address
        streetAddress.replace(/\s+st\b/i, ' Street')
          .replace(/\s+ave\b/i, ' Avenue')
          .replace(/\s+rd\b/i, ' Road')
          .replace(/\s+dr\b/i, ' Drive')
          .replace(/\s+ln\b/i, ' Lane')
          .replace(/\s+ct\b/i, ' Court')
          .replace(/\s+pl\b/i, ' Place')
          .replace(/\s+blvd\b/i, ' Boulevard'),  // Expanded street names
        streetAddress.split(' ').slice(0, 2).join(' ')  // Just number and street name
      ];
      
      // Determine path from address
      let path = '/us/ca/riverside';  // Default to Riverside, CA based on your example
      if (addressParts.length > 1) {
        const cityState = addressParts.slice(1).join(',').toLowerCase();
        if (cityState.includes('riverside')) {
          path = '/us/ca/riverside';
        }
      }
      
      console.log('Searching with path:', path);
      
      // Try each query format
      for (const query of queries) {
        console.log('Trying query:', query);
        const encodedAddress = encodeURIComponent(query);
        
        const response = await fetch(
          `${REGRID_BASE_URL}/parcels/address?query=${encodedAddress}&path=${path}&token=${this.apiToken}&limit=10`
        );
        
        if (!response.ok) {
          console.warn(`Query failed for: ${query}`);
          continue;
        }
        
        const data = await response.json();
        
        if (data.parcels && data.parcels.features && data.parcels.features.length > 0) {
          // Look for best match
          let bestMatch = null;
          let bestScore = 0;
          
          for (const feature of data.parcels.features) {
            const headline = (feature.properties.headline || '').toLowerCase();
            const searchAddr = streetAddress.toLowerCase();
            
            // Calculate match score
            let score = 0;
            if (headline === searchAddr) {
              score = 100;
            } else if (headline.includes(searchAddr)) {
              score = 80;
            } else {
              // Check if house number matches
              const searchNum = searchAddr.match(/^\d+/);
              const headlineNum = headline.match(/^\d+/);
              if (searchNum && headlineNum && searchNum[0] === headlineNum[0]) {
                score = 60;
                // Check street name similarity
                if (headline.includes(searchAddr.split(' ')[1])) {
                  score = 70;
                }
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = feature;
            }
          }
          
          if (bestMatch) {
            const geometry = bestMatch.geometry;
            const center = this.getPolygonCenter(geometry);
            
            console.log('Found match:', bestMatch.properties.headline, 'Score:', bestScore);
            
            return {
              lat: center.lat,
              lon: center.lon,
              parcel: bestMatch
            };
          }
        }
      }
      
      throw new Error('Address not found - please verify the address and try again');
    } catch (error) {
      console.error('Geocoding error:', error);
      throw error;
    }
  }

  async geocodeWithAlternativeMethod(address) {
    // This is a fallback method using a more flexible search
    try {
      console.log('Using alternative search for:', address);
      
      // Extract house number if present
      const houseNumberMatch = address.match(/^(\d+)/);
      if (!houseNumberMatch) {
        throw new Error('No house number found in address');
      }
      
      const houseNumber = houseNumberMatch[1];
      
      // Try searching with just the house number in Riverside, CA
      const response = await fetch(
        `${REGRID_BASE_URL}/parcels/address?query=${houseNumber}&path=/us/ca/riverside&token=${this.apiToken}&limit=50`
      );
      
      if (!response.ok) {
        throw new Error('Alternative search failed');
      }
      
      const data = await response.json();
      
      if (data.parcels && data.parcels.features && data.parcels.features.length > 0) {
        // Filter results to find closest match
        const streetKeywords = address.toLowerCase().split(/[\s,]+/).filter(word => word.length > 2);
        
        let bestMatch = null;
        let bestMatchCount = 0;
        
        for (const feature of data.parcels.features) {
          const headline = (feature.properties.headline || '').toLowerCase();
          let matchCount = 0;
          
          for (const keyword of streetKeywords) {
            if (headline.includes(keyword)) {
              matchCount++;
            }
          }
          
          if (matchCount > bestMatchCount) {
            bestMatchCount = matchCount;
            bestMatch = feature;
          }
        }
        
        if (bestMatch) {
          const geometry = bestMatch.geometry;
          const center = this.getPolygonCenter(geometry);
          
          console.log('Alternative method found:', bestMatch.properties.headline);
          
          return {
            lat: center.lat,
            lon: center.lon,
            parcel: bestMatch
          };
        }
      }
      
      throw new Error('Could not find address with alternative method');
    } catch (error) {
      console.error('Alternative geocoding error:', error);
      throw new Error('Unable to locate address. Please try a different format or nearby address.');
    }
  }

  async getNeighborsByCoordinates(lat, lon, options = {}) {
    try {
      const {
        radius = 50,
        includeAcrossStreet = true,
        maxResults = 20,
        targetAddress = '',
        targetParcel = null
      } = options;

      const effectiveRadius = includeAcrossStreet ? Math.max(radius, 100) : radius;
      
      // Use direct coordinates from typeahead API to avoid 403 errors on /address endpoint
      
      const response = await fetch(
        `${REGRID_BASE_URL}/parcels/point?lat=${lat}&lon=${lon}&radius=${effectiveRadius}&limit=${maxResults}&token=${this.apiToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Neighbor search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.parcels || !data.parcels.features) {
        return { 
          targetAddress: targetAddress, 
          targetParcel: targetParcel,
          coordinates: { lat, lon },
          neighbors: [] 
        };
      }

      // Filter out the target property itself
      const neighbors = data.parcels.features
        .filter(parcel => {
          const parcelAddress = parcel.properties.headline || parcel.properties.fields?.address || '';
          // Don't include the target address in neighbors
          return parcelAddress !== targetAddress && 
                 (!targetParcel || parcel.properties.ll_uuid !== targetParcel.properties?.ll_uuid);
        })
        .map(parcel => {
          const parcelCenter = this.getPolygonCenter(parcel.geometry);
          const distance = this.calculateDistance(lat, lon, parcelCenter.lat, parcelCenter.lon);
          const direction = this.getDirection(lat, lon, parcelCenter.lat, parcelCenter.lon);
          
          return {
            address: parcel.properties.headline || parcel.properties.fields?.address || 'Unknown Address',
            apn: parcel.properties.fields?.parcelnumb || '',
            owner: parcel.properties.fields?.owner || '',
            ll_uuid: parcel.properties.fields?.ll_uuid || parcel.properties.ll_uuid || '',
            distance: Math.round(distance),
            direction: direction,
            category: this.categorizeNeighbor(distance, direction),
            geometry: parcel.geometry,
            fields: parcel.properties.fields || {}
          };
        })
        .sort((a, b) => a.distance - b.distance);

      const categorizedNeighbors = this.categorizeNeighbors(neighbors);
      
      return {
        targetAddress: targetAddress,
        targetParcel: targetParcel,
        coordinates: { lat, lon },
        neighbors: neighbors,
        categorized: categorizedNeighbors
      };
    } catch (error) {
      console.error('Error finding neighbors by coordinates:', error);
      throw error;
    }
  }

  async getNeighboringParcels(address, options = {}) {
    try {
      const {
        radius = 50,
        includeAcrossStreet = true,
        maxResults = 20,
        useFallbackSearch = true
      } = options;

      let geocoded;
      
      try {
        geocoded = await this.geocodeAddress(address);
      } catch (error) {
        // If address search fails, try alternative approach
        if (useFallbackSearch && error.message.includes('Address not found')) {
          console.log('Trying alternative search method...');
          geocoded = await this.geocodeWithAlternativeMethod(address);
        } else {
          throw error;
        }
      }
      
      const effectiveRadius = includeAcrossStreet ? Math.max(radius, 100) : radius;
      
      const response = await fetch(
        `${REGRID_BASE_URL}/parcels/point?lat=${geocoded.lat}&lon=${geocoded.lon}&radius=${effectiveRadius}&limit=${maxResults}&token=${this.apiToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Neighbor search failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.parcels || !data.parcels.features) {
        return { targetAddress: address, neighbors: [] };
      }

      const targetParcel = geocoded.parcel;
      const targetAddress = targetParcel.properties.headline || address;
      
      const neighbors = data.parcels.features
        .filter(parcel => {
          const parcelAddress = parcel.properties.headline || parcel.properties.fields?.address || '';
          return parcelAddress !== targetAddress && parcelAddress !== address;
        })
        .map(parcel => {
          const parcelCenter = this.getPolygonCenter(parcel.geometry);
          const distance = this.calculateDistance(
            geocoded.lat, 
            geocoded.lon, 
            parcelCenter.lat, 
            parcelCenter.lon
          );
          const direction = this.getDirection(
            geocoded.lat, 
            geocoded.lon, 
            parcelCenter.lat, 
            parcelCenter.lon
          );
          
          return {
            address: parcel.properties.headline || parcel.properties.fields?.address || 'Unknown Address',
            apn: parcel.properties.fields?.parcelnumb || '',
            owner: parcel.properties.fields?.owner || '',
            ll_uuid: parcel.properties.fields?.ll_uuid || '',
            distance: Math.round(distance),
            direction: direction,
            category: this.categorizeNeighbor(distance, direction),
            geometry: parcel.geometry,
            fields: parcel.properties.fields || {}
          };
        })
        .sort((a, b) => a.distance - b.distance);

      const categorizedNeighbors = this.categorizeNeighbors(neighbors);
      
      return {
        targetAddress: targetAddress,
        targetParcel: targetParcel,
        coordinates: { lat: geocoded.lat, lon: geocoded.lon },
        neighbors: neighbors,
        categorized: categorizedNeighbors
      };
    } catch (error) {
      console.error('Error finding neighbors:', error);
      throw error;
    }
  }

  getPolygonCenter(geometry) {
    let coords = [];
    
    if (geometry.type === 'Polygon') {
      coords = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
      coords = geometry.coordinates[0][0];
    }
    
    let sumLat = 0, sumLon = 0;
    for (const coord of coords) {
      sumLon += coord[0];
      sumLat += coord[1];
    }
    
    return {
      lat: sumLat / coords.length,
      lon: sumLon / coords.length
    };
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  getDirection(lat1, lon1, lat2, lon2) {
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    
    const angle = Math.atan2(dLon, dLat) * 180 / Math.PI;
    const normalizedAngle = (angle + 360) % 360;
    
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'North';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'Northeast';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'East';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'Southeast';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'South';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'Southwest';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'West';
    if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'Northwest';
    
    return 'Unknown';
  }

  categorizeNeighbor(distance, direction) {
    if (distance <= 30) {
      return 'immediate';
    } else if (distance <= 80) {
      if (['North', 'South', 'East', 'West'].includes(direction)) {
        return 'across';
      }
      return 'adjacent';
    } else if (distance <= 150) {
      return 'nearby';
    }
    return 'area';
  }

  categorizeNeighbors(neighbors) {
    return {
      immediate: neighbors.filter(n => n.category === 'immediate'),
      across: neighbors.filter(n => n.category === 'across'),
      adjacent: neighbors.filter(n => n.category === 'adjacent'),
      nearby: neighbors.filter(n => n.category === 'nearby'),
      area: neighbors.filter(n => n.category === 'area')
    };
  }

  async getParcelDetails(ll_uuid) {
    try {
      const response = await fetch(
        `${REGRID_BASE_URL}/parcels/${ll_uuid}?token=${this.apiToken}`
      );
      
      if (!response.ok) {
        throw new Error(`Parcel lookup failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.parcels?.features?.[0] || null;
    } catch (error) {
      console.error('Parcel details error:', error);
      throw error;
    }
  }
}

export default RegridService;