import React, { useState } from 'react';

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
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              {showAddForm ? 'Cancel' : '+ Add Property'}
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Enter property details manually to calculate replacement cost using FIRIS standards
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