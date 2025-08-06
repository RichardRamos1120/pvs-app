import React, { useState } from 'react';
import NeighborLookup from './components/NeighborLookup';

const PVSCalculator = () => {
  // State for the wizard steps
  const [step, setStep] = useState(1);
  
  // Form data state
  const [livesSaved, setLivesSaved] = useState('');
  const [properties, setProperties] = useState([]);
  const [budget, setBudget] = useState('');
  const [efficiency, setEfficiency] = useState('0.90');
  
  // Result state
  const [pvsScore, setPvsScore] = useState(null);
  
  // Property form state
  const [propertyForm, setPropertyForm] = useState({
    address: '',
    incidentId: '',
    propertyType: 'residential',
    structureType: 'single_family',
    yearBuilt: '',
    squareFootage: '',
    stories: '1',
    constructionType: 'wood_frame',
    roofType: 'composition',
    exteriorWalls: 'wood_siding',
    condition: 'good',
    localMultiplier: '1.0'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);
  const [showNeighborLookup, setShowNeighborLookup] = useState(false);
  
  // Constants
  const VSL = 7000000; // Value of Statistical Life: $7 million
  
  // FIRIS Property Value Calculation Tables
  const baseCostPerSqFt = {
    residential: {
      single_family: 120,
      townhouse: 110,
      condo: 100,
      duplex: 115,
      manufactured: 70
    },
    commercial: {
      office: 150,
      retail: 130,
      warehouse: 80,
      restaurant: 180,
      hotel: 200
    },
    industrial: {
      manufacturing: 90,
      warehouse: 75,
      processing: 110
    },
    other: {
      garage: 60,
      shed: 45,
      barn: 55
    }
  };
  
  const constructionMultipliers = {
    wood_frame: 1.0,
    steel_frame: 1.3,
    concrete: 1.4,
    masonry: 1.2,
    mixed: 1.1
  };
  
  const conditionMultipliers = {
    excellent: 1.2,
    good: 1.0,
    fair: 0.8,
    poor: 0.6
  };
  
  const ageDepreciationFactors = {
    0: 1.0,   // New
    5: 0.95,  // 0-5 years
    10: 0.90, // 6-10 years
    15: 0.85, // 11-15 years
    20: 0.80, // 16-20 years
    30: 0.75, // 21-30 years
    40: 0.70, // 31-40 years
    50: 0.65, // 41-50 years
    999: 0.60 // 50+ years
  };
  
  // Calculate FIRIS property value
  const calculateFIRISValue = (propertyData) => {
    const currentYear = new Date().getFullYear();
    const age = currentYear - parseInt(propertyData.yearBuilt);
    
    // Get base cost per square foot
    let baseCost = baseCostPerSqFt[propertyData.propertyType]?.[propertyData.structureType] || 100;
    
    // Apply construction type multiplier
    const constructionMultiplier = constructionMultipliers[propertyData.constructionType] || 1.0;
    
    // Apply condition multiplier
    const conditionMultiplier = conditionMultipliers[propertyData.condition] || 1.0;
    
    // Apply age depreciation
    let depreciationFactor = 1.0;
    for (const ageThreshold of Object.keys(ageDepreciationFactors).sort((a, b) => a - b)) {
      if (age <= parseInt(ageThreshold)) {
        depreciationFactor = ageDepreciationFactors[ageThreshold];
        break;
      }
    }
    
    // Apply local market multiplier
    const localMultiplier = parseFloat(propertyData.localMultiplier) || 1.0;
    
    // Calculate base value
    const baseValue = parseInt(propertyData.squareFootage) * baseCost;
    
    // Apply all multipliers
    const finalValue = baseValue * constructionMultiplier * conditionMultiplier * depreciationFactor * localMultiplier;
    
    return Math.round(finalValue);
  };
  
  // Add a property using FIRIS calculation
  const addProperty = () => {
    if (!propertyForm.address || !propertyForm.squareFootage || !propertyForm.yearBuilt) {
      alert('Please fill in required fields: Address, Square Footage, and Year Built');
      return;
    }
    
    const propertyValue = calculateFIRISValue(propertyForm);
    
    setProperties([
      ...properties,
      {
        ...propertyForm,
        value: propertyValue,
        id: Date.now() // Simple ID for tracking
      }
    ]);
    
    // Reset form
    setPropertyForm({
      address: '',
      incidentId: '',
      propertyType: 'residential',
      structureType: 'single_family',
      yearBuilt: '',
      squareFootage: '',
      stories: '1',
      constructionType: 'wood_frame',
      roofType: 'composition',
      exteriorWalls: 'wood_siding',
      condition: 'good',
      localMultiplier: '1.0'
    });
    setShowAddForm(false);
  };
  
  // Remove a property
  const removeProperty = (index) => {
    const newProperties = [...properties];
    newProperties.splice(index, 1);
    setProperties(newProperties);
  };

  // Handle neighbors found from neighbor lookup
  const handleNeighborsFound = (neighbors) => {
    const newProperties = neighbors.map(neighbor => {
      // Extract real property data from Regrid fields
      const fields = neighbor.fields || {};
      
      // Log the available data for debugging - expand full object
      console.log('Full neighbor data for:', neighbor.address);
      console.log('All fields:', JSON.stringify(fields, null, 2));
      
      // Use real data when available, fallback to reasonable defaults
      const property = {
        address: neighbor.address,
        incidentId: '',
        propertyType: fields.usecode ? mapUseCodeToPropertyType(fields.usecode) : 'residential',
        structureType: 'single_family', // Default, could be enhanced with more mapping
        yearBuilt: fields.yearbuilt || fields.yearbuilt1 || estimateYearBuilt(neighbor.address),
        squareFootage: fields.sqft || fields.improvement_value ? estimateSquareFootage(fields.improvement_value) : estimateSquareFootageByAddress(neighbor.address),
        stories: fields.stories || estimateStories(fields.sqft),
        constructionType: fields.construction_type || 'wood_frame',
        roofType: 'composition', // Default
        exteriorWalls: 'wood_siding', // Default  
        condition: fields.condition || estimateCondition(fields.yearbuilt),
        localMultiplier: '1.0'
      };
      
      const value = calculateFIRISValue(property);
      
      return {
        ...property,
        value,
        id: Date.now() + Math.random()
      };
    });
    
    setProperties([...properties, ...newProperties]);
    setShowNeighborLookup(false);
  };

  // Helper functions to intelligently estimate missing data
  const mapUseCodeToPropertyType = (usecode) => {
    if (!usecode) return 'residential';
    const code = usecode.toString().toLowerCase();
    if (code.includes('res') || code.includes('single') || code.includes('1')) return 'residential';
    if (code.includes('comm') || code.includes('retail') || code.includes('office')) return 'commercial';
    if (code.includes('ind') || code.includes('warehouse')) return 'industrial';
    return 'residential'; // Default
  };

  const estimateYearBuilt = (address) => {
    // Try to estimate based on area development patterns
    // This is a rough estimate - could be improved with more data
    const currentYear = new Date().getFullYear();
    return Math.floor(currentYear - Math.random() * 30).toString(); // Rough estimate: built in last 30 years
  };

  const estimateSquareFootage = (improvementValue) => {
    if (!improvementValue) return Math.floor(1800 + Math.random() * 1200).toString(); // 1800-3000 sq ft
    
    // Rough estimate: $100-150 per sq ft
    const costPerSqFt = 125;
    const estimated = Math.floor(improvementValue / costPerSqFt);
    return Math.max(800, Math.min(4000, estimated)).toString(); // Cap between 800-4000 sq ft
  };

  const estimateSquareFootageByAddress = (address) => {
    // Different neighborhoods might have different typical sizes
    // This is a rough estimate based on common patterns
    if (address && address.toLowerCase().includes('dr')) {
      return Math.floor(2000 + Math.random() * 800).toString(); // 2000-2800 sq ft for drives
    }
    return Math.floor(1600 + Math.random() * 1000).toString(); // 1600-2600 sq ft general
  };

  const estimateStories = (sqft) => {
    if (!sqft) return '1';
    const footage = parseInt(sqft);
    if (footage > 2500) return '2'; // Larger homes more likely to be 2-story
    if (footage > 3500) return Math.random() > 0.3 ? '2' : '3'; // Very large homes might be 3-story
    return '1';
  };

  const estimateCondition = (yearBuilt) => {
    if (!yearBuilt) return 'good';
    const year = parseInt(yearBuilt);
    const age = new Date().getFullYear() - year;
    
    if (age < 10) return 'excellent';
    if (age < 25) return 'good';
    if (age < 40) return 'fair';
    return 'poor';
  };

  // Parse CSV content with proper quoted field handling
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { error: 'CSV must have at least a header row and one data row' };

    // Parse CSV line with proper handling of quoted fields
    const parseCsvLine = (line) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCsvLine(lines[0]);
    const requiredFields = ['address', 'squareFootage', 'yearBuilt'];
    
    const missingRequired = requiredFields.filter(field => !headers.includes(field));
    if (missingRequired.length > 0) {
      return { error: `Missing required columns: ${missingRequired.join(', ')}` };
    }

    const properties = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      
      if (values.length !== headers.length) {
        errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${values.length})`);
        continue;
      }

      const propertyData = {};
      headers.forEach((header, index) => {
        propertyData[header] = values[index];
      });

      // Set defaults for missing optional fields
      const property = {
        address: propertyData.address || '',
        incidentId: propertyData.incidentId || '',
        propertyType: propertyData.propertyType || 'residential',
        structureType: propertyData.structureType || 'single_family',
        yearBuilt: propertyData.yearBuilt || '',
        squareFootage: propertyData.squareFootage || '',
        stories: propertyData.stories || '1',
        constructionType: propertyData.constructionType || 'wood_frame',
        roofType: propertyData.roofType || 'composition',
        exteriorWalls: propertyData.exteriorWalls || 'wood_siding',
        condition: propertyData.condition || 'good',
        localMultiplier: propertyData.localMultiplier || '1.0'
      };

      // Validate required fields
      if (!property.address || !property.squareFootage || !property.yearBuilt) {
        errors.push(`Row ${i + 1}: Missing required data (address, squareFootage, or yearBuilt)`);
        continue;
      }

      // Validate numeric fields
      if (isNaN(parseInt(property.squareFootage)) || parseInt(property.squareFootage) <= 0) {
        errors.push(`Row ${i + 1}: Invalid square footage`);
        continue;
      }

      const year = parseInt(property.yearBuilt);
      if (isNaN(year) || year < 1800 || year > 2025) {
        errors.push(`Row ${i + 1}: Invalid year built (must be 1800-2025)`);
        continue;
      }

      const multiplier = parseFloat(property.localMultiplier);
      if (isNaN(multiplier) || multiplier < 0.1 || multiplier > 3.0) {
        errors.push(`Row ${i + 1}: Invalid local multiplier (must be 0.1-3.0)`);
        continue;
      }

      try {
        const value = calculateFIRISValue(property);
        const newProperty = {
          ...property,
          value,
          id: Date.now() + i
        };
        properties.push(newProperty);
      } catch (error) {
        errors.push(`Row ${i + 1}: Error calculating FIRIS value - ${error.message}`);
      }
    }
    return { properties, errors };
  };

  // Handle bulk upload
  const handleBulkUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const csvText = e.target.result;
      const result = parseCSV(csvText);
      
      if (result.error) {
        alert(`CSV parsing error: ${result.error}`);
        return;
      }

      setBulkUploadResults(result);
    };
    reader.readAsText(file);
  };

  // Apply bulk upload results
  const applyBulkUpload = () => {
    if (!bulkUploadResults || !bulkUploadResults.properties) return;
    
    setProperties([...properties, ...bulkUploadResults.properties]);
    setBulkUploadResults(null);
    setShowBulkUpload(false);
    
    // Reset file input
    const fileInput = document.getElementById('bulk-upload-input');
    if (fileInput) fileInput.value = '';
  };

  // Download CSV template
  const downloadCSVTemplate = () => {
    const csvContent = `address,incidentId,propertyType,structureType,yearBuilt,squareFootage,stories,constructionType,condition,localMultiplier
"123 Main St, Anytown USA",INC-2024-001,residential,single_family,1995,2400,2,wood_frame,good,1.0
"456 Oak Ave, Anytown USA",INC-2024-002,commercial,office,2010,5000,3,steel_frame,excellent,1.2`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firis_bulk_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
  
  
  // Calculate PVS
  const calculatePVS = () => {
    if (!livesSaved || !budget || properties.length === 0) return;
    
    // Calculate total property value
    const totalPropertyValue = properties.reduce((sum, property) => sum + property.value, 0);
    
    // Calculate lives saved value
    const livesSavedValue = parseInt(livesSaved) * VSL;
    
    // Calculate total value
    const totalValue = livesSavedValue + totalPropertyValue;
    
    // Parse budget (remove non-numeric characters)
    const parsedBudget = parseFloat(budget.replace(/[^0-9.]/g, ''));
    
    // Calculate PVS
    const pvsValue = (totalValue / parsedBudget) * parseFloat(efficiency);
    
    setPvsScore({
      score: pvsValue.toFixed(1),
      livesSavedValue,
      totalPropertyValue,
      budget: parsedBudget,
      efficiency
    });
    
    setStep(4);
  };
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  };
  
  // Reset calculator
  const resetCalculator = () => {
    setStep(1);
    setLivesSaved('');
    setProperties([]);
    setBudget('');
    setEfficiency('0.90');
    setPvsScore(null);
  };
  
  return (
    <div className="max-w-4xl mx-auto p-5">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Fire Department PVS Calculator - FIRIS Method
        </h1>
        <p className="text-gray-600">
          Calculate property replacement costs using FIRIS emergency response standards
        </p>
      </div>
      
      {/* Step indicator */}
      <div className="flex justify-between mb-8">
        {[1, 2, 3, 4].map((num) => (
          <div key={num} className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center mb-2 font-bold ${
              step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {num}
            </div>
            <div className={`text-sm ${step >= num ? 'text-blue-600' : 'text-gray-500'}`}>
              {num === 1 ? 'Lives Saved' : 
               num === 2 ? 'Properties (FIRIS)' : 
               num === 3 ? 'Budget & Efficiency' : 'Results'}
            </div>
          </div>
        ))}
      </div>
      
      {/* Step 1: Lives Saved */}
      {step === 1 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-5">Step 1: Lives Saved</h2>
          
          <div className="mb-5">
            <label className="block font-bold mb-2">
              Number of Lives Saved
            </label>
            <p className="text-sm text-gray-500 mb-2">
              How many individuals survived due to EMS intervention when vitals were outside survivable range
            </p>
            <input
              type="number"
              value={livesSaved}
              onChange={(e) => setLivesSaved(e.target.value)}
              placeholder="Enter number"
              className="w-full p-2.5 border border-gray-300 rounded text-base"
            />
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={() => livesSaved && setStep(2)}
              disabled={!livesSaved}
              className={`px-5 py-2.5 rounded font-bold ${
                livesSaved 
                  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      {/* Step 2: Properties with FIRIS Data */}
      {step === 2 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-5">Step 2: Properties Saved (FIRIS Method)</h2>
          
          <div className="mb-5">
            <div className="flex gap-3 mb-3">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {showAddForm ? 'Cancel' : '+ Add Property'}
              </button>
              <button
                onClick={() => setShowNeighborLookup(!showNeighborLookup)}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                {showNeighborLookup ? 'Cancel' : '🏘️ Find Neighbors'}
              </button>
              <button
                onClick={() => setShowBulkUpload(!showBulkUpload)}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                {showBulkUpload ? 'Cancel' : '📄 Bulk Upload CSV'}
              </button>
              <button
                onClick={downloadCSVTemplate}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                ⬇ Download CSV Template
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Add properties manually or upload multiple properties via CSV using FIRIS standards
            </p>
          </div>
          
          {showAddForm && (
            <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-gray-50">
              <h3 className="text-lg font-bold mb-5">Add Property - Calculate FIRIS Replacement Cost</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-1 font-bold">
                    Property Address *
                  </label>
                  <input
                    value={propertyForm.address}
                    onChange={(e) => setPropertyForm({...propertyForm, address: e.target.value})}
                    placeholder="Enter full address"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Incident ID
                  </label>
                  <input
                    value={propertyForm.incidentId}
                    onChange={(e) => setPropertyForm({...propertyForm, incidentId: e.target.value})}
                    placeholder="Enter incident ID"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block mb-1 font-bold">
                    Property Type *
                  </label>
                  <select
                    value={propertyForm.propertyType}
                    onChange={(e) => setPropertyForm({...propertyForm, propertyType: e.target.value, structureType: 'single_family'})}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Structure Type *
                  </label>
                  <select
                    value={propertyForm.structureType}
                    onChange={(e) => setPropertyForm({...propertyForm, structureType: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {propertyForm.propertyType === 'residential' && (
                      <>
                        <option value="single_family">Single Family</option>
                        <option value="townhouse">Townhouse</option>
                        <option value="condo">Condominium</option>
                        <option value="duplex">Duplex</option>
                        <option value="manufactured">Manufactured Home</option>
                      </>
                    )}
                    {propertyForm.propertyType === 'commercial' && (
                      <>
                        <option value="office">Office Building</option>
                        <option value="retail">Retail</option>
                        <option value="warehouse">Warehouse</option>
                        <option value="restaurant">Restaurant</option>
                        <option value="hotel">Hotel/Motel</option>
                      </>
                    )}
                    {propertyForm.propertyType === 'industrial' && (
                      <>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="warehouse">Warehouse</option>
                        <option value="processing">Processing Plant</option>
                      </>
                    )}
                    {propertyForm.propertyType === 'other' && (
                      <>
                        <option value="garage">Garage</option>
                        <option value="shed">Shed</option>
                        <option value="barn">Barn</option>
                      </>
                    )}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Year Built *
                  </label>
                  <input
                    type="number"
                    value={propertyForm.yearBuilt}
                    onChange={(e) => setPropertyForm({...propertyForm, yearBuilt: e.target.value})}
                    placeholder="e.g., 1995"
                    min="1800"
                    max="2025"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block mb-1 font-bold">
                    Square Footage *
                  </label>
                  <input
                    type="number"
                    value={propertyForm.squareFootage}
                    onChange={(e) => setPropertyForm({...propertyForm, squareFootage: e.target.value})}
                    placeholder="e.g., 2400"
                    min="0"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Number of Stories
                  </label>
                  <select
                    value={propertyForm.stories}
                    onChange={(e) => setPropertyForm({...propertyForm, stories: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="1">1 Story</option>
                    <option value="2">2 Stories</option>
                    <option value="3">3 Stories</option>
                    <option value="4+">4+ Stories</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Construction Type
                  </label>
                  <select
                    value={propertyForm.constructionType}
                    onChange={(e) => setPropertyForm({...propertyForm, constructionType: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="wood_frame">Wood Frame</option>
                    <option value="steel_frame">Steel Frame</option>
                    <option value="concrete">Concrete</option>
                    <option value="masonry">Masonry</option>
                    <option value="mixed">Mixed Construction</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block mb-1 font-bold">
                    Overall Condition
                  </label>
                  <select
                    value={propertyForm.condition}
                    onChange={(e) => setPropertyForm({...propertyForm, condition: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                
                <div>
                  <label className="block mb-1 font-bold">
                    Local Market Multiplier
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={propertyForm.localMultiplier}
                    onChange={(e) => setPropertyForm({...propertyForm, localMultiplier: e.target.value})}
                    placeholder="1.0"
                    min="0.1"
                    max="3.0"
                    className="w-full p-2 border border-gray-300 rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Adjust for local market conditions (0.5-2.0 typical range)
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <div className="bg-yellow-100 px-3 py-2 rounded text-sm">
                  <strong>Estimated Replacement Cost: </strong>
                  {propertyForm.squareFootage && propertyForm.yearBuilt ? 
                    formatCurrency(calculateFIRISValue(propertyForm)) : 
                    'Fill required fields to see estimate'
                  }
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addProperty}
                    disabled={!propertyForm.address || !propertyForm.squareFootage || !propertyForm.yearBuilt}
                    className={`px-4 py-2 rounded ${
                      (propertyForm.address && propertyForm.squareFootage && propertyForm.yearBuilt) 
                        ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' 
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Add Property
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {showNeighborLookup && (
            <div className="mb-5">
              <NeighborLookup onNeighborsFound={handleNeighborsFound} />
            </div>
          )}
          
          {showBulkUpload && (
            <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-green-50">
              <h3 className="text-lg font-bold mb-5">Bulk Upload Properties - CSV Import</h3>
              
              <div className="mb-4">
                <label className="block mb-2 font-bold">
                  Select CSV File
                </label>
                <input
                  id="bulk-upload-input"
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  className="w-full p-2 border border-gray-300 rounded"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Required columns: address, squareFootage, yearBuilt. 
                  Optional: incidentId, propertyType, structureType, stories, constructionType, condition, localMultiplier
                </p>
              </div>
              
              {bulkUploadResults && (
                <div className="mt-4 p-4 border border-gray-300 rounded bg-white">
                  <h4 className="font-bold mb-3">Upload Preview</h4>
                  
                  {bulkUploadResults.errors && bulkUploadResults.errors.length > 0 && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded">
                      <h5 className="font-bold text-red-700 mb-2">Errors Found:</h5>
                      <ul className="text-sm text-red-600">
                        {bulkUploadResults.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {bulkUploadResults.properties && bulkUploadResults.properties.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-bold text-green-700 mb-2">
                        {bulkUploadResults.properties.length} Properties Ready to Import:
                      </h5>
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-2 text-left border">Address</th>
                              <th className="p-2 text-center border">Type</th>
                              <th className="p-2 text-center border">Sq Ft</th>
                              <th className="p-2 text-center border">Year</th>
                              <th className="p-2 text-right border">FIRIS Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkUploadResults.properties.map((property, index) => (
                              <tr key={index} className="border-b">
                                <td className="p-2 border">{property.address}</td>
                                <td className="p-2 text-center border">{property.propertyType}/{property.structureType}</td>
                                <td className="p-2 text-center border">{parseInt(property.squareFootage).toLocaleString()}</td>
                                <td className="p-2 text-center border">{property.yearBuilt}</td>
                                <td className="p-2 text-right border font-bold">{formatCurrency(property.value)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="mt-3 p-2 bg-blue-100 rounded">
                        <strong>Total Value: {formatCurrency(bulkUploadResults.properties.reduce((sum, p) => sum + p.value, 0))}</strong>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => setBulkUploadResults(null)}
                      className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    {bulkUploadResults.properties && bulkUploadResults.properties.length > 0 && (
                      <button
                        onClick={applyBulkUpload}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                      >
                        Import {bulkUploadResults.properties.length} Properties
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Property list */}
          {properties.length > 0 ? (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left border-b border-gray-200 text-sm">Address</th>
                    <th className="p-3 text-left border-b border-gray-200 text-sm">Type</th>
                    <th className="p-3 text-center border-b border-gray-200 text-sm">Sq Ft</th>
                    <th className="p-3 text-center border-b border-gray-200 text-sm">Year</th>
                    <th className="p-3 text-right border-b border-gray-200 text-sm">Replacement Cost</th>
                    <th className="p-3 text-center border-b border-gray-200 text-sm w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((property, index) => (
                    <tr key={property.id}>
                      <td className="p-3 border-b border-gray-200 text-sm">
                        {property.address}
                        {property.incidentId && <div className="text-xs text-gray-500">ID: {property.incidentId}</div>}
                      </td>
                      <td className="p-3 border-b border-gray-200 text-sm">
                        {property.propertyType} / {property.structureType.replace('_', ' ')}
                      </td>
                      <td className="p-3 text-center border-b border-gray-200 text-sm">
                        {parseInt(property.squareFootage).toLocaleString()}
                      </td>
                      <td className="p-3 text-center border-b border-gray-200 text-sm">
                        {property.yearBuilt}
                      </td>
                      <td className="p-3 text-right border-b border-gray-200 text-sm font-bold">
                        {formatCurrency(property.value)}
                      </td>
                      <td className="p-3 text-center border-b border-gray-200">
                        <button
                          onClick={() => removeProperty(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100">
                    <td colSpan={4} className="p-3 font-bold">Total Replacement Value Preserved</td>
                    <td className="p-3 text-right font-bold text-base text-blue-600">
                      {formatCurrency(properties.reduce((sum, property) => sum + property.value, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center p-10 bg-gray-50 border border-gray-200 rounded-lg mb-5">
              <p className="text-gray-500 mb-2">No properties added yet.</p>
              <p className="text-gray-500 text-sm">
                Click "Add Property" to enter property details and calculate FIRIS replacement cost
              </p>
            </div>
          )}
          
          <div className="flex justify-between">
            <button
              onClick={() => setStep(1)}
              className="bg-white border border-gray-300 px-5 py-2.5 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={() => properties.length > 0 && setStep(3)}
              disabled={properties.length === 0}
              className={`px-5 py-2.5 rounded ${
                properties.length > 0 
                  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              Next
            </button>
          </div>
        </div>
      )}
      
      {/* Step 3: Budget & Efficiency */}
      {step === 3 && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-5">Step 3: Budget & Efficiency</h2>
          
          <div className="mb-5">
            <label className="block font-bold mb-2">
              Annual Operating Budget
            </label>
            <input
              type="text"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="$173,100,000"
              className="w-full p-2.5 border border-gray-300 rounded text-base"
            />
          </div>
          
          <div className="mb-5">
            <label className="block font-bold mb-2">
              Efficiency Multiplier
            </label>
            <p className="text-sm text-gray-500 mb-2">
              Adjust based on response time, staffing efficiency, and system readiness
            </p>
            <select
              value={efficiency}
              onChange={(e) => setEfficiency(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded text-base"
            >
              <option value="0.85">0.85 - Below Average Efficiency</option>
              <option value="0.90">0.90 - Average Efficiency</option>
              <option value="0.95">0.95 - High Efficiency</option>
            </select>
          </div>
          
          <div className="flex justify-between">
            <button
              onClick={() => setStep(2)}
              className="bg-white border border-gray-300 px-5 py-2.5 rounded hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={calculatePVS}
              disabled={!budget}
              className={`px-5 py-2.5 rounded ${
                budget 
                  ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-700' 
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              Calculate PVS
            </button>
          </div>
        </div>
      )}
      
      {/* Step 4: Results */}
      {step === 4 && pvsScore && (
        <div className="border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-5">Results</h2>
          
          <div className="text-center mb-8">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              PVS = {pvsScore.score}
            </div>
            <p className="text-lg">
              For every $1 spent, your department generates ${pvsScore.score} in societal value.
            </p>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 mb-8">
            <h3 className="text-lg font-bold mb-4">Formula Breakdown (FIRIS Method)</h3>
            
            <div className="flex justify-between mb-2.5">
              <span>Lives Saved × Value of Statistical Life:</span>
              <span className="font-bold">{formatCurrency(pvsScore.livesSavedValue)}</span>
            </div>
            
            <div className="flex justify-between mb-2.5">
              <span>Property Replacement Value Preserved (FIRIS):</span>
              <span className="font-bold">{formatCurrency(pvsScore.totalPropertyValue)}</span>
            </div>
            
            <div className="flex justify-between mb-2.5">
              <span>Annual Operating Cost:</span>
              <span className="font-bold">{formatCurrency(pvsScore.budget)}</span>
            </div>
            
            <div className="flex justify-between mb-2.5">
              <span>Efficiency Multiplier:</span>
              <span className="font-bold">{pvsScore.efficiency}</span>
            </div>
            
            <div className="border-t border-gray-200 pt-2.5 mt-2.5">
              <div className="font-bold mb-2">
                Formula: ((Lives Saved Value + Property Value) / Budget) × Efficiency
              </div>
              <div className="text-sm text-gray-500">
                Property values calculated using FIRIS standard methodology including building dimensions, 
                construction type, age depreciation, condition factors, and local market adjustments.
              </div>
            </div>
          </div>
          
          <div className="flex justify-center gap-4">
            <button
              className="bg-white border border-gray-300 px-5 py-2.5 rounded flex items-center hover:bg-gray-50"
            >
              <span className="mr-2">↓</span>
              Download FIRIS Report (PDF)
            </button>
            <button
              onClick={resetCalculator}
              className="bg-blue-600 text-white px-5 py-2.5 rounded flex items-center hover:bg-blue-700"
            >
              <span className="mr-2">↻</span>
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PVSCalculator;