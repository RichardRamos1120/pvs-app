# Neighbor Lookup Feature

## Overview
The Neighbor Lookup feature allows users to find all properties adjacent to and across from a target address using the Zillow API.

## Key Features

### 1. Address Autocomplete
- **Smart Search**: As you type, the system searches for real addresses
- **Type-ahead suggestions**: Shows up to 10 matching addresses
- **Prevents typos**: Only allows selection of valid, verified addresses
- **Fast selection**: Click or use arrow keys to select from dropdown

### 2. Neighbor Categorization
Properties are automatically categorized by proximity:
- **Immediate** (≤30m): Next-door neighbors
- **Across** (≤80m): Properties directly across the street
- **Adjacent** (≤80m): Corner/diagonal neighbors  
- **Nearby** (≤150m): Close neighborhood
- **Area** (>150m): Broader area

### 3. Flexible Search Options
- **Adjustable radius**: 30m to 200m
- **Max results control**: Limit number of results (5-50)
- **Include/exclude across street**: Toggle option

### 4. Rich Property Information
For each neighboring property, you get:
- Full address
- Distance in meters
- Direction (N, S, E, W, NE, SE, NW, SW)
- Owner name (when available)
- Parcel number (APN)
- Visual category indicator with color coding

## How to Use

1. **Start typing an address** in the search field
   - Type at least 3 characters
   - Select from the dropdown suggestions

2. **Configure search options**
   - Choose search radius (default: 50m)
   - Set max results (default: 20)
   - Toggle "Include across street" option

3. **Click "Find Neighbors"**
   - System will search for all neighboring parcels
   - Results appear categorized by proximity

4. **Select properties to add**
   - Click on any property to select/deselect
   - Use checkbox for individual selection
   - Click "Add Selected Properties" to add to your list

## Technical Implementation

### Components
- **AddressAutocomplete.jsx**: Handles address search and suggestions
- **NeighborLookup.jsx**: Main UI for neighbor search
- **ZillowService.js**: API integration with Zillow

### API Endpoints Used
- Zillow property search endpoint for address autocomplete
- Zillow property details endpoint for property information
- Zillow nearby homes endpoint for finding neighbors

### Search Strategy
1. User types address → Zillow API returns suggestions
2. User selects address → System gets property details
3. Fetch nearby homes from Zillow API
4. Calculate distances and directions to neighbors
5. Filter and categorize results by distance

## Example Usage

```
Address: 11053 Kayjay St, Riverside, CA 92503
Radius: 100m
Results:
- 11051 Kayjay St (25m East) - Immediate Neighbor
- 11055 Kayjay St (26m West) - Immediate Neighbor  
- 11052 Kayjay St (45m South) - Across the Street
- 11054 Kayjay St (46m South) - Across the Street
```

## Benefits Over Manual Entry

1. **Accuracy**: Only real, verified addresses from county records
2. **Speed**: Find 20+ neighbors in seconds vs manual research
3. **Completeness**: Won't miss any properties in the area
4. **Data Quality**: Includes owner info, parcel numbers automatically
5. **User Experience**: Modern autocomplete interface users expect

## Troubleshooting

### "Address not found"
- Make sure to select from the dropdown suggestions
- Try typing more of the address for better matches
- Check spelling of street names

### No neighbors found
- Increase the search radius
- Check if the area is rural (properties may be far apart)
- Verify the address is residential/commercial (not vacant land)

### Slow performance
- The first search may take longer as the API warms up
- Subsequent searches should be faster
- Consider reducing max results if searching large areas