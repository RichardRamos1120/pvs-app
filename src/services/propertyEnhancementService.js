import RealtorService from './realtorService';

class PropertyEnhancementService {
  constructor() {
    this.realtorService = new RealtorService();
  }

  // Enhance property data with Realtor.com when Zillow data is incomplete
  async enhancePropertyData(property) {
    // Check if we have incomplete data from Zillow
    const missingYearBuilt = !property.yearBuilt || property.yearBuilt === null;
    const missingSquareFootage = !property.squareFootage && !property.livingArea;
    
    if (!missingYearBuilt && !missingSquareFootage) {
      // Zillow data is complete, no enhancement needed
      return {
        ...property,
        dataSource: property.dataSource || 'zillow',
        dataSourceDetails: {
          zillow: {
            yearBuilt: !!property.yearBuilt,
            squareFootage: !!(property.livingArea || property.squareFootage),
            marketValue: !!(property.price || property.zestimate)
          }
        }
      };
    }

    console.log(`[PropertyEnhancement] Missing data for ${property.address}:`, {
      missingYearBuilt,
      missingSquareFootage
    });

    // Try to enhance with Realtor.com data
    try {
      // Note: We would need a way to get property_id from address
      // For now, we'll simulate this enhancement
      const realtorData = await this.tryGetRealtorData(property);
      
      if (realtorData) {
        const enhanced = this.mergePropertyData(property, realtorData);
        console.log(`[PropertyEnhancement] Enhanced ${property.address} with Realtor data`);
        return enhanced;
      }
    } catch (error) {
      console.warn(`[PropertyEnhancement] Failed to enhance ${property.address} with Realtor:`, error.message);
    }

    // Return original property with transparency flags
    return {
      ...property,
      dataSource: property.dataSource || 'zillow',
      missingData: true,
      missingFields: [
        ...(missingYearBuilt ? ['yearBuilt'] : []),
        ...(missingSquareFootage ? ['squareFootage'] : [])
      ],
      dataSourceDetails: {
        zillow: {
          yearBuilt: !!property.yearBuilt,
          squareFootage: !!(property.livingArea || property.squareFootage),
          marketValue: !!(property.price || property.zestimate)
        },
        realtor: {
          attempted: true,
          successful: false
        }
      }
    };
  }

  // Try to get Realtor data using address search
  async tryGetRealtorData(property) {
    try {
      console.log(`[PropertyEnhancement] Attempting Realtor search for: ${property.address}`);
      
      // First, search for properties near this address to get property_id
      const searchResults = await this.realtorService.searchPropertiesByAddress(property.address);
      
      if (!searchResults || searchResults.length === 0) {
        console.log(`[PropertyEnhancement] No Realtor search results for: ${property.address}`);
        return null;
      }
      
      console.log(`[PropertyEnhancement] Found ${searchResults.length} potential matches in Realtor`);
      
      // Check if any search results actually match our target address
      const addressMatches = searchResults.filter(result => {
        const resultAddress = (result.address || '').toLowerCase();
        const targetAddress = property.address.toLowerCase();
        
        // Extract street number and name for comparison
        const targetParts = targetAddress.match(/(\d+)\s+(.+?)\s+(ave|avenue|st|street|rd|road|dr|drive|ln|lane|way|ct|court)/i);
        const resultParts = resultAddress.match(/(\d+)\s+(.+?)\s+(ave|avenue|st|street|rd|road|dr|drive|ln|lane|way|ct|court)/i);
        
        if (targetParts && resultParts) {
          const targetNumber = targetParts[1];
          const targetStreet = targetParts[2].trim();
          const resultNumber = resultParts[1];
          const resultStreet = resultParts[2].trim();
          
          // Match if same house number and street name contains key words
          return targetNumber === resultNumber && 
                 (targetStreet.includes(resultStreet) || resultStreet.includes(targetStreet));
        }
        
        return false;
      });
      
      console.log(`[PropertyEnhancement] Found ${addressMatches.length} potential address matches out of ${searchResults.length} search results`);
      
      if (addressMatches.length === 0) {
        console.log(`[PropertyEnhancement] No address matches found for "${property.address}" - skipping Realtor enhancement to avoid wrong data`);
        return null;
      }
      
      // Try to get details for the address matches only
      for (const searchResult of addressMatches.slice(0, 2)) { // Try top 2 address matches
        try {
          if (searchResult.property_id) {
            console.log(`[PropertyEnhancement] Getting details for matching property_id: ${searchResult.property_id} (${searchResult.address})`);
            const propertyDetails = await this.realtorService.getPropertyDetails(searchResult.property_id);
            
            if (propertyDetails && (propertyDetails.yearBuilt || propertyDetails.squareFootage)) {
              console.log(`[PropertyEnhancement] Found property data from Realtor:`, {
                yearBuilt: propertyDetails.yearBuilt,
                squareFootage: propertyDetails.squareFootage,
                address: propertyDetails.address,
                property_id: searchResult.property_id,
                original_target: property.address
              });
              console.log(`[PropertyEnhancement] Full Realtor property details:`, propertyDetails);
              return propertyDetails;
            }
          }
        } catch (detailError) {
          console.log(`[PropertyEnhancement] Failed to get details for property_id ${searchResult.property_id}:`, detailError.message);
          continue;
        }
      }
      
      console.log(`[PropertyEnhancement] No detailed property data found in Realtor for: ${property.address}`);
      return null;
      
    } catch (error) {
      console.error(`[PropertyEnhancement] Realtor search failed for ${property.address}:`, error.message);
      return null;
    }
  }

  // Merge Zillow and Realtor data with source tracking
  mergePropertyData(zillowProperty, realtorProperty) {
    const enhanced = { ...zillowProperty };
    const sources = {
      zillow: {},
      realtor: {}
    };

    // Track what came from where and fill gaps
    if (!enhanced.yearBuilt && realtorProperty.yearBuilt) {
      enhanced.yearBuilt = realtorProperty.yearBuilt;
      sources.realtor.yearBuilt = true;
    } else {
      sources.zillow.yearBuilt = !!enhanced.yearBuilt;
    }

    if ((!enhanced.livingArea && !enhanced.squareFootage) && realtorProperty.squareFootage) {
      enhanced.squareFootage = realtorProperty.squareFootage;
      enhanced.livingArea = realtorProperty.squareFootage;
      sources.realtor.squareFootage = true;
    } else {
      sources.zillow.squareFootage = !!(enhanced.livingArea || enhanced.squareFootage);
    }

    // Realtor estimates as additional market data
    if (realtorProperty.currentValue && !enhanced.realtorEstimate) {
      enhanced.realtorEstimate = realtorProperty.currentValue;
      sources.realtor.marketValue = true;
    }

    sources.zillow.marketValue = !!(enhanced.price || enhanced.zestimate);

    return {
      ...enhanced,
      dataSource: 'zillow-realtor', // Mixed sources
      dataSourceDetails: sources,
      realtorData: realtorProperty // Keep raw Realtor data for transparency
    };
  }

  // Get data source display info for transparency
  getDataSourceInfo(property) {
    const info = {
      primary: 'Zillow',
      sources: [],
      hasMultipleSources: false,
      marketValueSources: []
    };

    if (!property.dataSourceDetails) {
      info.sources.push('Zillow');
      if (property.price || property.zestimate) {
        info.marketValueSources.push('Zillow');
      }
      return info;
    }

    const details = property.dataSourceDetails;
    
    // Check what data came from where
    if (details.zillow) {
      if (details.zillow.yearBuilt || details.zillow.squareFootage || details.zillow.marketValue) {
        info.sources.push('Zillow');
      }
      if (details.zillow.marketValue) {
        info.marketValueSources.push('Zillow');
      }
    }

    if (details.realtor) {
      if (details.realtor.yearBuilt || details.realtor.squareFootage || details.realtor.marketValue) {
        info.sources.push('Realtor.com');
        info.hasMultipleSources = true;
        info.primary = 'Zillow + Realtor.com';
      }
      if (details.realtor.marketValue) {
        info.marketValueSources.push('Realtor.com');
      }
    }

    return info;
  }

  // Format data source attribution for display
  formatDataSourceAttribution(property) {
    const info = this.getDataSourceInfo(property);
    
    if (!info.hasMultipleSources) {
      return {
        text: 'Data source: Zillow',
        sources: info.sources,
        className: 'text-xs text-gray-500'
      };
    }

    return {
      text: `Data sources: ${info.sources.join(', ')}`,
      sources: info.sources,
      className: 'text-xs text-blue-600 font-medium'
    };
  }
}

export default PropertyEnhancementService;