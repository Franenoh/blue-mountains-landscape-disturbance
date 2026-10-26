// 1.1 DEFINE AREAS
var l3 = ee.FeatureCollection('EPA/Ecoregions/2013/L3'); 
var aoiEcoregion = l3.filter(ee.Filter.eq('na_l3name', 'Blue Mountains')); 
var aoi = ee.Geometry.Rectangle([-119.8, 43.8, -116.5, 46.2]); //
Map.centerObject(aoi, 7);
Map.addLayer(aoiEcoregion, {color: 'grey'}, 'Blue Mountains Ecoregion', true);
Map.addLayer(aoi, {color: 'red'}, 'Processing Box (Rectangle)', false);

// 1.2 LT PARAMETERS (From original code)
var startYear = 2000;
var endYear = 2020;
var startDay = '06-20'; 
var endDay = '09-20'; 
var index = 'NBR'; 
var maskThese = ['cloud', 'shadow', 'snow', 'water'];

var runParams = { 
  maxSegments:            6,
  spikeThreshold:         0.9,
  vertexCountOvershoot:   3,
  preventOneYearRecovery: true,
  recoveryThreshold:      0.25,
  pvalThreshold:          0.05,
  bestModelProportion:    0.75,
  minObservationsNeeded:  6
};

var changeParams = {
  delta:  'loss',
  sort:   'greatest',
  year:   {checked: true, start: 2001, end: 2019},
  mag:    {checked: true, value: 100,  operator: '>'}, 
  dur:    {checked: true, value: 10,   operator: '<'}, 
  preval: {checked: true, value: 200,  operator: '>'}, 
  mmu:    {checked: true, value: 11},                  
};

// 1.3 PROCESSING
var ltgee = require('users/emaprlab/public:Modules/LandTrendr.js'); 
changeParams.index = index;

// Run LT inside the Box
var lt = ltgee.runLT(startYear, endYear, startDay, endDay, aoi, index, [], runParams, maskThese);

// Get the change map and CLIP it to the Ecoregion for display
var changeImg = ltgee.getChangeMap(lt, changeParams).clip(aoiEcoregion);

// VISUALIZATION
var palette = ['#9400D3', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000'];
Map.addLayer(changeImg.select(['mag']), {min: 100, max: 800, palette: palette}, 'LT Magnitude (Ecoregion Clip)', false);
// 1.4 VISUALIZE YEAR OF DETECTION
// Using a palette that goes from purple (older) to red (newer)
var yodPalette = ['#9400D3', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00', '#FF0000'];
Map.addLayer(changeImg.select(['yod']), {
  min: 2001, 
  max: 2019, 
  palette: yodPalette
}, 'Year of Detection (Ecoregion Clip)', false);
// // 1.5 CREATE ON-SCREEN LEGEND FOR YOD
// var legend = ui.Panel({
//   style: {
//     position: 'bottom-right',
//     padding: '8px 15px'
//   }
// });

// var legendTitle = ui.Label({
//   value: 'Year of Detection',
//   style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0', textAlign: 'center'}
// });
// legend.add(legendTitle);

// var makeRow = function(color, name) {
//   var colorBox = ui.Label({
//     style: {backgroundColor: color, padding: '8px', margin: '0 0 4px 0'}
//   });
//   var description = ui.Label({
//     value: name,
//     style: {margin: '0 0 4px 6px'}
//   });
//   return ui.Panel({
//     widgets: [colorBox, description],
//     layout: ui.Panel.Layout.Flow('horizontal')
//   });
// };

// // Add color rows (matching your yodPalette)
// legend.add(makeRow('#9400D3', '2001-2003 (Oldest)'));
// legend.add(makeRow('#0000FF', '2004-2007'));
// legend.add(makeRow('#00FF00', '2008-2011'));
// legend.add(makeRow('#FFFF00', '2012-2015'));
// legend.add(makeRow('#FF0000', '2016-2019 (Newest)'));

// Map.add(legend);
// 2.1 MTBS BURN MASKING FUNCTION
// This function looks for "Severity" classes 2 through 5 (Low to High severity)
function getBurnMask(startYear, endYear) {
  var mtbsCol = ee.ImageCollection("USFS/GTAC/MTBS/annual_burn_severity_mosaics/v1")
    .filterBounds(aoiEcoregion) // We can use the ecoregion here as MTBS is pre-computed
    .filterDate(startYear + '-01-01', endYear + '-12-31')
    .map(function(img) {
      // Standardize band name to 'severity'
      return img.select([0], ['severity']); 
    });
  
  // Create a single 'Maximum' image of all fires during the period
  return mtbsCol.map(function(img) {
    return img.gte(2).and(img.lte(5)); // Boolean: 1 if fire, 0 if not
  }).max().unmask(0).clip(aoiEcoregion); 
}

// 2.2 EXECUTE MASK
var burnMask = getBurnMask(2001, 2019);

// 2.3 VISUALIZE FIRES
// use black with some transparency so as to see the LT Magnitude underneath
Map.addLayer(burnMask.selfMask(), {palette: ['#000000'], opacity: 0.4}, 'MTBS Fires (2001-2019)', false);

// 3.1 IMPORT NLCD DATA
var nlcd = ee.ImageCollection('USGS/NLCD_RELEASES/2019_REL/NLCD');
var lc2001 = nlcd.filter(ee.Filter.eq('system:index', '2001')).first().select('landcover').clip(aoiEcoregion);
var lc2019 = nlcd.filter(ee.Filter.eq('system:index', '2019')).first().select('landcover').clip(aoiEcoregion);

// 3.2 CALCULATE CLEAN TRANSITIONS (The "Socio-Economic" Story)
// 1. Identify pixels where NLCD class 2001 != NLCD class 2019
var anyClassChange = lc2001.neq(lc2019);

// 2. Identify where LandTrendr saw a spectral disturbance
var ltHit = changeImg.select('yod').gt(0);

// 3. Combine them and MASK OUT the fires
// This leaves only pixels with a class change, a disturbance, and NO fire.
var cleanTransition = lc2001.multiply(100).add(lc2019)
  .updateMask(anyClassChange)
  .updateMask(ltHit)
  .updateMask(burnMask.not());

// 3.3 GROUPED TRANSITION DICTIONARY
var transitionDict = {
  // --- DEVELOPED (Aggregated 21, 22, 23, 24) ---
  'urban': {name: "Expansion of Developed Land", color: "#FF0000"}, // Red

  // --- AGRICULTURAL & RANGE SHIFTS ---
  8182: {name: "Pasture → Crops (Ag Intensification)", color: "#4169E1"},// Royal Blue
  7182: {name: "Grassland → Crops (Ag Expansion)", color: "#0000FF"},    // Blue
  5271: {name: "Shrub → Grassland (Range Improvement)", color: "#F0E68C"}, // Khaki

  // --- FOREST & SHRUBLAND DYNAMICS ---
  4271: {name: "Forest → Grassland (Clearing)", color: "#FFFF00"},      // Yellow
  4252: {name: "Forest → Shrub (Regrowth)", color: "#8B4513"},           // Brown
  5242: {name: "Shrub → Forest (Encroachment)", color: "#228B22"}        // Forest Green
};

// 3.4 MAP THE TRANSITIONS
// 1. First create a special mask for ANY transition to Developed (codes ending in 21-24)
var toDeveloped = cleanTransition.mod(100); // Gets the last two digits (e.g., 8221 becomes 21)
var urbanMask = toDeveloped.gte(21).and(toDeveloped.lte(24));
Map.addLayer(urbanMask.selfMask(), {palette: [transitionDict.urban.color]}, 'Class: ' + transitionDict.urban.name, false);

// 2. Then map the rest of the specific dictionary items
Object.keys(transitionDict).forEach(function(code) {
  if (code !== 'urban') {
    var mask = cleanTransition.eq(parseInt(code));
    Map.addLayer(mask.selfMask(), {palette: [transitionDict[code].color]}, 'Class: ' + transitionDict[code].name, false);
  }
});
// 3.5 CREATE TRANSITION LEGEND
var transLegend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }
});

var transTitle = ui.Label({
  value: 'Transitions',
  style: {fontWeight: 'bold', fontSize: '16px', margin: '0 0 4px 0'}
});
transLegend.add(transTitle);

// Use the same makeRow function logic
var makeTransRow = function(color, name) {
  var colorBox = ui.Label({
    style: {backgroundColor: color, padding: '8px', margin: '0 0 4px 0'}
  });
  var description = ui.Label({
    value: name,
    style: {margin: '0 0 4px 6px', fontSize: '12px'}
  });
  return ui.Panel({
    widgets: [colorBox, description],
    layout: ui.Panel.Layout.Flow('horizontal')
  });
};
// Add rows from your dictionary
Object.keys(transitionDict).forEach(function(key) {
  var item = transitionDict[key];
  transLegend.add(makeTransRow(item.color, item.name));
});

Map.add(transLegend);

// 4.1 PREPARE COMBINED TRANSITION IMAGE FOR EXPORT
// start with an empty image and paint the transitions on it
var exportImage = ee.Image(0).mask(0).visualize({palette:['ffffff']});

// Add each transition to the export image
Object.keys(transitionDict).forEach(function(code) {
  if (code === 'urban') {
    exportImage = exportImage.blend(urbanMask.selfMask().visualize({palette: [transitionDict.urban.color]}));
  } else {
    var mask = cleanTransition.eq(parseInt(code));
    exportImage = exportImage.blend(mask.selfMask().visualize({palette: [transitionDict[code].color]}));
  }
});

// 4.2 EXPORT TRANSITION MAP
Export.image.toDrive({
  image: exportImage,
  description: 'Blue_Mountains_Clean_Transitions',
  scale: 30,
  region: aoiEcoregion,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// 4.3 EXPORT FIRE MASK (For "Natural Disturbance" slide)
Export.image.toDrive({
  image: burnMask.selfMask().visualize({palette: ['#000000']}),
  description: 'Blue_Mountains_Fire_Mask',
  scale: 30,
  region: aoiEcoregion,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
// 4.1 AREA CALCULATION FUNCTION
print('--- AREA CALCULATIONS (HECTARES) ---');

var calculateArea = function(image, name) {
  var areaImage = image.multiply(ee.Image.pixelArea());
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoiEcoregion,
    scale: 100, // Balanced scale for ecoregion-wide math
    maxPixels: 1e13,
    tileScale: 4
  });
  var hectares = ee.Number(stats.values().get(0)).divide(10000);
  print(name + ':', hectares);
};

// 4.2 RUN FOR ALL CATEGORIES
// Fire Area
calculateArea(burnMask.selfMask(), 'TOTAL FIRE IMPACT');

// Urban Area
calculateArea(urbanMask.selfMask(), 'TOTAL URBAN EXPANSION');

// Dictionary Transitions
Object.keys(transitionDict).forEach(function(key) {
  if (key !== 'urban') {
    var mask = cleanTransition.eq(parseInt(key)).selfMask();
    calculateArea(mask, transitionDict[key].name);
  }
});
// 5.1 IMPORT NEW UGB ASSET (path updated to my GEE username)
var ugb = ee.FeatureCollection("projects/ee-francien/assets/UGB_Cities1");

// 5.2 CREATE POLICY MASK USING 'Policy' FIELD : this field was created on ArcGIS Pro
// This turns the polygons into a 1/0 raster
var ugbMask = ee.Image().paint(ugb, 'Policy'); 

// 5.3 SPATIAL OVERLAY: THE "CLEAN" HUMAN SIGNAL

// We take the 'urbanMask' (which already has fires removed via MTBS)
// and split it by the UGB line.
// Growth INSIDE the UGB (Planned)
var plannedGrowth = urbanMask.updateMask(ugbMask);

// Growth OUTSIDE the UGB (Potential Sprawl)

// .unmask(0).not() finds everywhere the UGB is NOT present
var ruralSprawl = urbanMask.updateMask(ugbMask.unmask(0).not());

// 5.4 VISUALIZE THE STORY
Map.centerObject(ugb, 12); // Focuses on La Grande / Baker City / Island City
Map.addLayer(ugb, {color: 'FFD700', fillOpacity: 0.1}, 'Urban Growth Boundary (Policy)');
// --- 5.5 REFINED MUNICIPAL ANALYSIS (ONLY FOR BAKER, LA GRANDE, ISLAND CITY) ---
// 1. Create a 1km search zone around the 3 cities to capture the "Urban Fringe"
var cityZones = ugb.map(function(f) { return f.buffer(1000); }); 
var cityGeometry = cityZones.geometry(); 

// 2. Define the new focused area function
var calculateCityArea = function(image, name) {
  var areaImage = image.multiply(ee.Image.pixelArea());
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: cityGeometry, // This limits the math ONLY to the 3 cities + 1km buffer
    scale: 30,
    maxPixels: 1e13,
    tileScale: 4
  });
  
  var hectares = ee.Number(stats.values().get(0)).divide(10000);
  print(name + ' (Hectares):', hectares);
};

// 3. Run specific results for my slide
print('--- CORRIDOR RESULTS: BAKER, LA GRANDE, ISLAND CITY ---');
calculateCityArea(plannedGrowth.selfMask(), 'Planned Development (Within UGB)');
calculateCityArea(ruralSprawl.selfMask(), 'Sprawl (Within 1km of UGB)');

// --- 6.0 CASE STUDY: WHITMAN MANAGEMENT ---

// 1. Import and Filter
var managers = ee.FeatureCollection("projects/ee-francien/assets/Managers"); 

var studyForests = managers.filter(ee.Filter.or(
  ee.Filter.eq('Unit_Nm', 'Whitman National Forest')
));

// 2. Reuse transition logic
var forestToGrass = cleanTransition.eq(4271);

// 3. Spatially Filter
var caseStudyManagement = forestToGrass.updateMask(ee.Image().paint(studyForests, 1));

// 4. Visualize - CHANGED TO RED for high contrast against green
Map.addLayer(studyForests, {color: '228B22', opacity: 0.3}, 'Case Study: Whitman');
Map.addLayer(caseStudyManagement.selfMask(), {palette: ['#FF0000']}, 'Active Management (Red)');

// 5. Optimized Area Calculation
var calculateCaseStudyArea = function(image, name) {
  var areaImage = image.multiply(ee.Image.pixelArea());
  var stats = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: studyForests.geometry(), 
    scale: 60,           // Increased from 30 to 60 to prevent timeout
    maxPixels: 1e13,
    tileScale: 16        // Maximum memory allocation
  });
  
  var hectares = ee.Number(stats.values().get(0)).divide(10000);
  print(name + ':', hectares);
};

print('--- CASE STUDY RESULTS: WHITMAN ---');
calculateCaseStudyArea(caseStudyManagement.selfMask(), 'Hectares of Management');

// 8.0 MARKOV CHAIN: DATA CAPTURE
var managers = ee.FeatureCollection("projects/ee-francien/assets/Managers"); 
var whitman = managers.filter(ee.Filter.eq('Unit_Nm', 'Whitman National Forest'));

var combined = lc2001.rename('T1').addBands(lc2019.rename('T2'));

// 1. Capture Whitman Data
var statsWhitman = combined.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram(),
  geometry: whitman.geometry(), // Now 'whitman' is definitely defined
  scale: 60, 
  maxPixels: 1e13,
  tileScale: 16
});

// 2. Capture UGB Data for the 3 cities
var statsUGB = combined.reduceRegion({
  reducer: ee.Reducer.frequencyHistogram(),
  geometry: ugb.geometry(),
  scale: 30, 
  maxPixels: 1e13
});

// --- 9.0 FINAL 2040 QUANTITATIVE SUMMARY ---

var print2040Projection = function(stats, name, classCode) {
  var t1 = ee.Dictionary(ee.Dictionary(stats).get('T1'));
  var t2 = ee.Dictionary(ee.Dictionary(stats).get('T2'));
  
  var count01 = ee.Number(t1.get(classCode));
  var count19 = ee.Number(t2.get(classCode));
  
  // Annual Change Rate
  var annualRate = count19.subtract(count01).divide(18);
  
  // Project to 2040 (21 years from 2019)
  var projected2040 = count19.add(annualRate.multiply(21));
  
  print('--- ' + name + ' (Class ' + classCode + ') ---');
  print('2001 Hectares:', count01.multiply(0.09)); // Converting pixels to Hectares (30m scale)
  print('2019 Hectares:', count19.multiply(0.09));
  print('PROJECTED 2040 Hectares:', projected2040.multiply(0.09));
};

// RUN THE PROJECTIONS FOR YOUR SLIDES
print2040Projection(statsWhitman, 'Whitman Forest (Evergreen)', '42');
print2040Projection(statsUGB, 'UGB Infill (Med-Intensity)', '23');

// --- 12.0 CASE STUDY LEGENDS (FEDERAL & MUNICIPAL) ---

// 1. Whitman National Forest Legend
var whitmanLegend = ui.Panel({
  style: {
    position: 'bottom-right',
    padding: '8px 15px',
    margin: '0 0 20px 0' // Adds a little gap from the edge
  }
});

whitmanLegend.add(ui.Label({
  value: 'Whitman Case Study',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0'}
}));

whitmanLegend.add(makeTransRow('#228B22', 'Forest Boundary (USFS)'));
whitmanLegend.add(makeTransRow('#FF0000', 'Active Management (42→71)'));

Map.add(whitmanLegend);

// 2. Municipal UGB Legend (The 3 Cities)
var ugbLegend = ui.Panel({
  style: {
    position: 'top-right', // Placed at top-right to avoid overlapping the chart
    padding: '8px 15px'
  }
});

ugbLegend.add(ui.Label({
  value: 'UGB Policy Analysis',
  style: {fontWeight: 'bold', fontSize: '14px', margin: '0 0 4px 0'}
}));

ugbLegend.add(makeTransRow('#FFD700', 'Urban Growth Boundary'));
ugbLegend.add(makeTransRow('#228B22', 'Planned Infill (Inside UGB)'));
ugbLegend.add(makeTransRow('#FF0000', 'Rural Sprawl (Outside UGB)'));

Map.add(ugbLegend);