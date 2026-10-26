# Landscape Disturbance and Land Cover Change in the Blue Mountains Ecoregion

**Research project | Oregon State University | 2026**  
**Study area:** Blue Mountains Ecoregion, Oregon and Washington, USA  
**Tools:** Google Earth Engine (JavaScript), Landsat/LandTrendr, MTBS, NLCD

## Overview

This project investigates landscape disturbance and land-cover transitions in the Blue Mountains Ecoregion, using satellite time-series analysis and complementary wildfire, land-cover, management, and urban-growth-boundary datasets. The workflow aims to distinguish wildfire-associated disturbance from selected non-fire land-cover transitions and explore the relationship between landscape change and management or urban-development contexts.

## Research workflow

1. **Study area and disturbance:** Load the EPA Level III Blue Mountains Ecoregion. Run the LandTrendr module on Landsat NBR time series (2000–2020; summer seasonal window) in a rectangular processing extent; clip mapped changes to the ecoregion. The detection-year filter is 2001–2019.
2. **Wildfire overlay:** Combine annual MTBS burn-severity mosaics for 2001–2019 into a burn mask using severity values 2–5 as specified in the script.
3. **Land-cover transitions:** Compare NLCD 2001 and 2019 classes; retain pixels with a class change and LandTrendr disturbance detection, excluding the MTBS burn mask. Map selected transitions, including changes to developed land, agricultural/rangeland shifts, and forest/shrub/grassland transitions.
4. **Urban growth boundaries:** Compare detected transitions to developed land inside and outside uploaded urban growth boundary polygons near Baker City, La Grande, and Island City, with a 1 km buffered city study zone for area summaries.
5. **Forest management case study:** Examine forest-to-grassland transition pixels intersecting the uploaded Whitman National Forest management boundary.
6. **Exploratory projection:** Calculate a linear extrapolation of selected NLCD class counts to 2040. This is **not** a validated Markov-chain model or a predictive forecast.

## Repository contents

- [`scripts/blue_mountains_original.js`](scripts/blue_mountains_original.js) — original supplied Earth Engine script, preserved without analytical edits.
- [`results/README.md`](results/README.md) — guidance for adding verified outputs and figures.
- `figures/` — place exported maps or screenshots here (no figures supplied yet).

## Run in Google Earth Engine

1. Sign in to the [Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Open the [shared script](https://code.earthengine.google.com/2fd1ae80d577af36fc7349c9beb07d31) or paste the contents of `scripts/blue_mountains_original.js` into a new script.
3. Ensure you have access to the LandTrendr module `users/emaprlab/public:Modules/LandTrendr.js`, the public Earth Engine datasets, and the custom assets below.
4. Run the script and inspect the map layers, Console output, and Tasks tab. Export tasks must be started manually.

### Required private/user-provided assets

The original script references:

- `projects/ee-francien/assets/UGB_Cities1` — urban growth boundary polygons with a `Policy` property.
- `projects/ee-francien/assets/Managers` — management polygons with a `Unit_Nm` property.

These assets are **not included** in this repository. Users must supply accessible equivalents and update the asset IDs; verify field meanings before interpreting results.

## Important methodological limitations

- The LandTrendr run uses a rectangular processing box, then clips the result to the Blue Mountains Ecoregion. Confirm full ecoregion coverage before drawing region-wide conclusions.
- The MTBS overlay is a selected burn-severity mask, not proof that all remaining disturbance is human-caused. Non-fire transitions should not automatically be attributed to management or development.
- The `urbanMask` includes transitions into developed NLCD classes and does not by itself establish the timing or cause of development.
- The code labels forest-to-grassland pixels within a management boundary as “active management”; this spatial overlap alone does not verify a management action.
- The code's final 2040 calculation uses marginal class-frequency histograms and linear extrapolation, not a transition matrix. It also multiplies counts by 0.09 ha per pixel even for analyses sampled at 60 m; review scale and area estimates before publication.
- Some custom datasets, exported maps, numerical results, and independent validation were not supplied; no numerical findings or accuracy claims are made here.

## Next steps

Validate coverage and area estimates, add reproducible inputs for custom assets where sharing is permitted, export final maps, and document quantitative results and uncertainty.

## Project status

**Portfolio draft — original research script provided; outputs and reproducibility checks pending.**
