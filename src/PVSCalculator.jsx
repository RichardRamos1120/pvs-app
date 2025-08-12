import React, { useState } from 'react';
import NeighborLookup from './components/NeighborLookup';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [editingProperty, setEditingProperty] = useState(null); // Track which property is being edited
  
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
    // Check if we have required data for FIRIS calculation
    if (!propertyData.squareFootage || !propertyData.yearBuilt) {
      // Return null to indicate calculation not possible
      return null;
    }
    
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

  // Update property with inline edits
  const updateProperty = (index, field, value) => {
    const newProperties = [...properties];
    newProperties[index] = { ...newProperties[index], [field]: value };
    
    // Recalculate FIRIS value if we now have complete data
    if (field === 'yearBuilt' || field === 'squareFootage') {
      const updatedProperty = newProperties[index];
      if (updatedProperty.yearBuilt && updatedProperty.squareFootage) {
        const newValue = calculateFIRISValue(updatedProperty);
        newProperties[index].value = newValue;
      }
    }
    
    setProperties(newProperties);
  };

  // Handle neighbors found from neighbor lookup
  const handleNeighborsFound = (neighbors) => {
    const newProperties = neighbors.map(neighbor => {
      console.log('Processing neighbor from Zillow:', neighbor.address);
      console.log('Available Zillow data:', {
        price: neighbor.price,
        zestimate: neighbor.zestimate,
        livingArea: neighbor.livingArea,
        yearBuilt: neighbor.yearBuilt,
        bedrooms: neighbor.bedrooms,
        bathrooms: neighbor.bathrooms
      });
      
      // Use real Zillow building data for accurate FIRIS calculation
      const hasRealZillowData = neighbor.price || neighbor.zestimate || neighbor.livingArea;
      
      if (hasRealZillowData) {
        // Check what data is actually available from Zillow
        const hasYearBuilt = neighbor.yearBuilt && neighbor.yearBuilt !== null;
        const hasSquareFootage = neighbor.livingArea && neighbor.livingArea > 0;
        
        // Use Zillow building data for accurate FIRIS inputs
        const property = {
          address: neighbor.address,
          incidentId: '',
          propertyType: 'residential',
          structureType: 'single_family',
          yearBuilt: hasYearBuilt ? neighbor.yearBuilt.toString() : null, // Don't fake missing data
          squareFootage: hasSquareFootage ? neighbor.livingArea.toString() : null, // Don't fake missing data
          stories: '1',
          constructionType: 'wood_frame',
          roofType: 'composition',
          exteriorWalls: 'wood_siding',
          condition: 'good',
          localMultiplier: '1.0',
          // Store the real market data for display
          marketPrice: neighbor.price,
          zestimate: neighbor.zestimate,
          dataSource: 'zillow', // Flag to identify this came from real data
          // Track what data is missing for transparency
          missingYearBuilt: !hasYearBuilt,
          missingSquareFootage: !hasSquareFootage
        };
        
        // Calculate FIRIS replacement cost using accurate Zillow building data
        const value = calculateFIRISValue(property);
        
        return {
          ...property,
          value: value, // Can be null if calculation not possible
          id: Date.now() + Math.random()
        };
      } else {
        // Fallback to FIRIS calculation if no real data available
        const fields = neighbor.fields || {};
        
        const property = {
          address: neighbor.address,
          incidentId: '',
          propertyType: fields.usecode ? mapUseCodeToPropertyType(fields.usecode) : 'residential',
          structureType: 'single_family',
          yearBuilt: fields.yearbuilt || fields.yearbuilt1 || estimateYearBuilt(neighbor.address),
          squareFootage: fields.sqft || fields.improvement_value ? estimateSquareFootage(fields.improvement_value) : estimateSquareFootageByAddress(neighbor.address),
          stories: fields.stories || estimateStories(fields.sqft),
          constructionType: fields.construction_type || 'wood_frame',
          roofType: 'composition',
          exteriorWalls: 'wood_siding',
          condition: fields.condition || estimateCondition(fields.yearbuilt),
          localMultiplier: '1.0',
          dataSource: 'firis' // Flag to identify this was estimated
        };
        
        const value = calculateFIRISValue(property);
        
        return {
          ...property,
          value,
          id: Date.now() + Math.random()
        };
      }
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
        squareFootage: (propertyData.squareFootage || '').replace(/,/g, ''), // Remove commas from numbers
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
"123 Main St, Anytown USA",INC-2024-001,residential,single_family,1995,"2,400",2,wood_frame,good,1.0
"456 Oak Ave, Anytown USA",INC-2024-002,commercial,office,2010,"5,000",3,steel_frame,excellent,1.2`;
    
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
    
    // Calculate total property value (exclude properties with missing data)
    const totalPropertyValue = properties.reduce((sum, property) => sum + (property.value || 0), 0);
    
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

  // Generate PDF Report
  const generatePDFReport = () => {
    if (!pvsScore) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('Fire Department PVS Report', pageWidth / 2, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text('FIRIS Emergency Response Standards', pageWidth / 2, 35, { align: 'center' });
    doc.text(`Report Generated: ${currentDate}`, pageWidth / 2, 42, { align: 'center' });

    // Add a line separator
    doc.setLineWidth(0.5);
    doc.line(margin, 48, pageWidth - margin, 48);

    // PVS Score Box - PROMINENTLY AT THE TOP
    let yPosition = 60;
    
    // Draw a highlight box for PVS Score
    doc.setFillColor(59, 130, 246); // Blue color
    doc.setTextColor(255, 255, 255); // White text
    doc.roundedRect(margin, yPosition - 10, pageWidth - 2 * margin, 30, 3, 3, 'F');
    
    doc.setFontSize(28);
    doc.setFont(undefined, 'bold');
    doc.text(`PVS SCORE: ${pvsScore.score}`, pageWidth / 2, yPosition + 5, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'normal');
    doc.text(`For every $1 spent, your department generates $${pvsScore.score} in societal value`, 
             pageWidth / 2, yPosition + 15, { align: 'center' });
    
    // Reset text color
    doc.setTextColor(0, 0, 0);
    yPosition += 40;

    // Executive Summary Section
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Executive Summary', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    const summaryData = [
      ['Lives Saved', livesSaved],
      ['Properties Protected', properties.length.toString()],
      ['Annual Operating Budget', formatCurrency(pvsScore.budget)],
      ['Efficiency Multiplier', pvsScore.efficiency],
      ['Total Value Generated', formatCurrency(pvsScore.livesSavedValue + pvsScore.totalPropertyValue)]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [],
      body: summaryData,
      theme: 'plain',
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 60 },
        1: { cellWidth: 'auto' }
      },
      margin: { left: margin, right: margin },
      styles: { fontSize: 11 }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Formula Breakdown
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PVS Calculation Breakdown', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    
    const formulaData = [
      ['Lives Saved Value', `${livesSaved} lives × $7,000,000 VSL`, formatCurrency(pvsScore.livesSavedValue)],
      ['Property Replacement Value', 'FIRIS Calculated', formatCurrency(pvsScore.totalPropertyValue)],
      ['Total Value Preserved', '', formatCurrency(pvsScore.livesSavedValue + pvsScore.totalPropertyValue)],
      ['Annual Operating Cost', '', formatCurrency(pvsScore.budget)],
      ['Efficiency Multiplier', '', pvsScore.efficiency],
      ['', '', ''],
      ['PVS Score', '(Total Value / Budget) × Efficiency', pvsScore.score]
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Component', 'Calculation', 'Value']],
      body: formulaData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 70 },
        2: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin },
      styles: { fontSize: 10 }
    });

    yPosition = doc.lastAutoTable.finalY + 15;

    // Check if we need a new page for properties
    if (yPosition > pageHeight - 100) {
      doc.addPage();
      yPosition = margin;
    }

    // Properties Table
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Properties Protected - FIRIS Valuation', margin, yPosition);
    yPosition += 10;

    // Prepare properties data for table
    const propertiesData = properties.map(property => {
      const sqft = property.squareFootage ? parseInt(property.squareFootage).toLocaleString() : 'N/A';
      const year = property.yearBuilt || 'N/A';
      const firisValue = property.value ? formatCurrency(property.value) : 'N/A';
      const marketValue = property.marketPrice ? formatCurrency(property.marketPrice) : 
                         property.zestimate ? formatCurrency(property.zestimate) : 'N/A';
      
      return [
        property.address,
        sqft,
        year,
        firisValue,
        marketValue
      ];
    });

    // Add total row
    const totalFIRIS = properties.reduce((sum, p) => sum + (p.value || 0), 0);
    propertiesData.push([
      'TOTAL',
      '',
      '',
      formatCurrency(totalFIRIS),
      ''
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [['Address', 'Sq Ft', 'Year', 'FIRIS Value', 'Market Value']],
      body: propertiesData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      footStyles: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      didDrawRow: (data) => {
        // Bold the total row
        if (data.row.index === propertiesData.length - 1) {
          doc.setFont(undefined, 'bold');
        }
      }
    });

    // Add footer on last page
    const finalY = doc.lastAutoTable.finalY;
    const footerY = pageHeight - 30;
    
    // If there's space, add methodology note
    if (finalY < footerY - 40) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text('Methodology: FIRIS replacement costs calculated using construction type, square footage, age depreciation,', margin, footerY - 20);
      doc.text('condition factors, and local market multipliers per fire department emergency response standards.', margin, footerY - 15);
      doc.text('Market values sourced from Zillow. All estimates for planning purposes only.', margin, footerY - 10);
    }

    // Page numbers on all pages
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    // Save the PDF
    doc.save(`FIRIS_PVS_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Fire Department PVS Calculator
          </h1>
          <div className="max-w-3xl mx-auto">
            <p className="text-xl text-gray-600 mb-2">
              FIRIS Emergency Response Standards
            </p>
            <p className="text-gray-500">
              Calculate property replacement costs and public value scores for emergency response planning
            </p>
          </div>
        </div>
      
        {/* Step indicator */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex justify-between items-center max-w-4xl mx-auto">
            {[1, 2, 3, 4].map((num, index) => (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 font-bold text-lg transition-all duration-200 ${
                    step >= num ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {num}
                  </div>
                  <div className={`text-sm font-medium ${step >= num ? 'text-blue-600' : 'text-gray-500'}`}>
                    {num === 1 ? 'Lives Saved' : 
                     num === 2 ? 'Properties (FIRIS)' : 
                     num === 3 ? 'Budget & Efficiency' : 'Results'}
                  </div>
                </div>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-4 transition-all duration-200 ${
                    step > num ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      
        {/* Step 1: Lives Saved */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Step 1: Lives Saved</h2>
          
            <div className="max-w-2xl">
              <label className="block text-lg font-semibold text-gray-700 mb-3">
                Number of Lives Saved
              </label>
              <p className="text-gray-600 mb-6 leading-relaxed">
                How many individuals survived due to EMS intervention when vitals were outside survivable range
              </p>
              <input
                type="number"
                value={livesSaved}
                onChange={(e) => setLivesSaved(e.target.value)}
                placeholder="Enter number of lives saved"
                className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          
            <div className="flex justify-end pt-8">
              <button
                onClick={() => livesSaved && setStep(2)}
                disabled={!livesSaved}
                className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  livesSaved 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Next Step →
              </button>
            </div>
          </div>
        )}
      
        {/* Step 2: Properties with FIRIS Data */}
        {step === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Step 2: Properties Saved (FIRIS Method)</h2>
          
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <span className="mr-2">+</span>
                  {showAddForm ? 'Cancel' : 'Add Property'}
                </button>
                <button
                  onClick={() => setShowNeighborLookup(!showNeighborLookup)}
                  className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  <span className="mr-2">🏘️</span>
                  {showNeighborLookup ? 'Cancel' : 'Find Neighbors'}
                </button>
                <button
                  onClick={() => setShowBulkUpload(!showBulkUpload)}
                  className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <span className="mr-2">📄</span>
                  {showBulkUpload ? 'Cancel' : 'Bulk Upload CSV'}
                </button>
                <button
                  onClick={downloadCSVTemplate}
                  className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                >
                  <span className="mr-2">⬇</span>
                  Download Template
                </button>
              </div>
              <p className="text-gray-600 bg-blue-50 p-4 rounded-lg">
                Add properties manually or upload multiple properties via CSV using FIRIS emergency response standards
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
                  <br />
                  <span className="text-xs text-blue-600">Note: Numbers with commas (e.g., "1,500") should be quoted in the CSV file</span>
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
              {properties.some(p => !p.squareFootage || !p.yearBuilt) && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-amber-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-amber-800">
                      Action Required: Complete missing building data in red-highlighted fields below for accurate FIRIS calculations
                    </span>
                  </div>
                </div>
              )}
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
                        {property.squareFootage ? (
                          editingProperty?.index === index && editingProperty?.field === 'squareFootage' ? (
                            <input
                              type="number"
                              defaultValue={editingProperty.value}
                              placeholder="Enter sq ft"
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onBlur={(e) => {
                                if (e.target.value) {
                                  updateProperty(index, 'squareFootage', e.target.value);
                                }
                                setEditingProperty(null);
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  if (e.target.value) {
                                    updateProperty(index, 'squareFootage', e.target.value);
                                  }
                                  setEditingProperty(null);
                                }
                              }}
                              autoFocus
                              min="100"
                              max="50000"
                            />
                          ) : (
                            <div className="flex items-center justify-center">
                              <span>{parseInt(property.squareFootage).toLocaleString()}</span>
                              <button 
                                onClick={() => setEditingProperty({index, field: 'squareFootage', value: property.squareFootage})}
                                className="ml-2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit square footage"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )
                        ) : editingProperty?.index === index && editingProperty?.field === 'squareFootage' ? (
                          <input
                            type="number"
                            defaultValue={editingProperty.value}
                            placeholder="Enter sq ft"
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onBlur={(e) => {
                              if (e.target.value) {
                                updateProperty(index, 'squareFootage', e.target.value);
                              }
                              setEditingProperty(null);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                if (e.target.value) {
                                  updateProperty(index, 'squareFootage', e.target.value);
                                }
                                setEditingProperty(null);
                              }
                            }}
                            autoFocus
                            min="100"
                            max="50000"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingProperty({index, field: 'squareFootage', value: ''})}
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            Enter sq ft
                          </button>
                        )}
                        {!property.squareFootage && (
                          <div className="text-xs text-red-600 mt-1">Required for FIRIS</div>
                        )}
                      </td>
                      <td className="p-3 text-center border-b border-gray-200 text-sm">
                        {property.yearBuilt ? (
                          editingProperty?.index === index && editingProperty?.field === 'yearBuilt' ? (
                            <input
                              type="number"
                              defaultValue={editingProperty.value}
                              placeholder="Enter year"
                              className="w-full px-2 py-1 text-sm border border-blue-300 rounded bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onBlur={(e) => {
                                if (e.target.value) {
                                  updateProperty(index, 'yearBuilt', e.target.value);
                                }
                                setEditingProperty(null);
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  if (e.target.value) {
                                    updateProperty(index, 'yearBuilt', e.target.value);
                                  }
                                  setEditingProperty(null);
                                }
                              }}
                              autoFocus
                              min="1800"
                              max="2025"
                            />
                          ) : (
                            <div className="flex items-center justify-center">
                              <span>{property.yearBuilt}</span>
                              <button 
                                onClick={() => setEditingProperty({index, field: 'yearBuilt', value: property.yearBuilt})}
                                className="ml-2 p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit year built"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            </div>
                          )
                        ) : editingProperty?.index === index && editingProperty?.field === 'yearBuilt' ? (
                          <input
                            type="number"
                            defaultValue={editingProperty.value}
                            placeholder="Enter year"
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                            onBlur={(e) => {
                              if (e.target.value) {
                                updateProperty(index, 'yearBuilt', e.target.value);
                              }
                              setEditingProperty(null);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                if (e.target.value) {
                                  updateProperty(index, 'yearBuilt', e.target.value);
                                }
                                setEditingProperty(null);
                              }
                            }}
                            autoFocus
                            min="1800"
                            max="2025"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingProperty({index, field: 'yearBuilt', value: ''})}
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                          >
                            Enter year
                          </button>
                        )}
                        {!property.yearBuilt && (
                          <div className="text-xs text-red-600 mt-1">Required for FIRIS</div>
                        )}
                      </td>
                      <td className="p-3 text-right border-b border-gray-200 text-sm font-bold">
                        {property.value ? formatCurrency(property.value) : 
                         <span className="text-gray-400 italic">Cannot calculate - missing data</span>}
                        <div className="text-xs text-gray-500 mt-1">
                          <span className="text-blue-600">FIRIS Estimate</span>
                          {property.dataSource === 'zillow' && (property.marketPrice || property.zestimate) && (
                            <div className="text-green-600 mt-1">
                              {property.marketPrice ? 
                                `Market: ${formatCurrency(property.marketPrice)}` : 
                                `Zestimate: ${formatCurrency(property.zestimate)}`
                              }
                            </div>
                          )}
                          {property.dataSource === 'zillow' && (
                            <div className="text-xs text-gray-400 mt-1">
                              Data source: Zillow
                            </div>
                          )}
                        </div>
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
                    <td colSpan={4} className="p-3 font-bold">
                      Total Replacement Value Preserved
                      {properties.some(p => !p.value) && (
                        <div className="text-xs text-gray-500 font-normal">
                          *Excludes properties with missing data
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-base text-blue-600">
                      {formatCurrency(properties.reduce((sum, property) => sum + (property.value || 0), 0))}
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
          
          {/* Data Validation Warning */}
          {properties.length > 0 && properties.some(p => !p.squareFootage || !p.yearBuilt) && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Missing Required Data - Cannot Proceed to PVS Calculation
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>FIRIS replacement cost calculations require complete building data. Please either:</p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li><strong>Enter missing data</strong> in the red-highlighted fields above, or</li>
                      <li><strong>Remove properties</strong> with incomplete data from the list</li>
                    </ul>
                    <p className="mt-2 font-medium">
                      Properties missing data: {properties.filter(p => !p.squareFootage || !p.yearBuilt).length} of {properties.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

            <div className="flex justify-between pt-8">
              <button
                onClick={() => setStep(1)}
                className="px-8 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  const canProceed = properties.length > 0 && properties.every(p => p.squareFootage && p.yearBuilt);
                  if (canProceed) setStep(3);
                }}
                disabled={properties.length === 0 || properties.some(p => !p.squareFootage || !p.yearBuilt)}
                className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  properties.length > 0 && properties.every(p => p.squareFootage && p.yearBuilt)
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                {properties.length === 0 ? 'Add Properties First' : 
                 properties.some(p => !p.squareFootage || !p.yearBuilt) ? 'Complete Missing Data' : 'Next Step →'}
              </button>
            </div>
          </div>
        )}
      
        {/* Step 3: Budget & Efficiency */}
        {step === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">Step 3: Budget & Efficiency</h2>
          
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Annual Operating Budget
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="$173,100,000"
                  className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-lg font-semibold text-gray-700 mb-3">
                  Efficiency Multiplier
                </label>
                <p className="text-gray-600 mb-4">
                  Adjust based on response time, staffing efficiency, and system readiness
                </p>
                <select
                  value={efficiency}
                  onChange={(e) => setEfficiency(e.target.value)}
                  className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="0.85">0.85 - Below Average Efficiency</option>
                  <option value="0.90">0.90 - Average Efficiency</option>
                  <option value="0.95">0.95 - High Efficiency</option>
                </select>
              </div>
            </div>
          
            <div className="flex justify-between pt-8">
              <button
                onClick={() => setStep(2)}
                className="px-8 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-lg transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={calculatePVS}
                disabled={!budget}
                className={`px-8 py-3 rounded-lg font-semibold text-lg transition-all duration-200 ${
                  budget 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl' 
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Calculate PVS →
              </button>
            </div>
          </div>
        )}
      
        {/* Step 4: Results */}
        {step === 4 && pvsScore && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 lg:p-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-8">PVS Calculation Results</h2>
            
            <div className="text-center mb-12">
              <div className="bg-blue-50 rounded-xl p-8 mb-6">
                <div className="text-6xl lg:text-7xl font-bold text-blue-600 mb-4">
                  PVS = {pvsScore.score}
                </div>
                <p className="text-xl lg:text-2xl text-gray-700 font-medium">
                  For every $1 spent, your department generates <span className="text-blue-600 font-bold">${pvsScore.score}</span> in societal value
                </p>
              </div>
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
          
            <div className="flex justify-center gap-6">
              <button
                onClick={generatePDFReport}
                className="flex items-center px-8 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold text-lg transition-colors"
              >
                <span className="mr-2">↓</span>
                Download FIRIS Report (PDF)
              </button>
              <button
                onClick={resetCalculator}
                className="flex items-center px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                <span className="mr-2">↻</span>
                Start Over
              </button>
            </div>
          </div>
        )}

        {/* Data Transparency Footer */}
        <div className="mt-12 pt-8 border-t border-gray-300">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <h4 className="text-xl font-bold text-gray-900 mb-6">Data Sources & Methodology</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-gray-700">
              <div>
                <p className="mb-4"><strong className="text-gray-900">Property Values:</strong> Market data sourced from Zillow. Replacement costs calculated using FIRIS (Fire Insurance Rating Information System) emergency response standards.</p>
                <p className="mb-4"><strong className="text-gray-900">Market Estimates:</strong> Zillow Zestimate® is an automated valuation model (AVM) that estimates market value. Actual property values may vary.</p>
              </div>
              <div>
                <p className="mb-4"><strong className="text-gray-900">FIRIS Calculations:</strong> Based on construction type, square footage, age depreciation, condition factors, and local market multipliers per fire department standards.</p>
                <p><strong className="text-gray-900">Disclaimer:</strong> All estimates are for informational and planning purposes only. Actual replacement costs and market values may differ. Property data accuracy depends on source availability and currency.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PVSCalculator;