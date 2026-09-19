# Asset detail review — 19 September 2026

The best first update is to fix existing details that are hidden, then improve vehicle silhouettes and industrial building roofs. Keep the current procedural Three.js models for this pass. Blender is not needed for these changes.

This is a review; gameplay and shipped assets have not been modified.

## Evidence

Opened the local game in Chrome, deployed Mission 1, and inspected its default camera view. Also rendered twelve comparison panels directly from the shipped model factories, using the game's lighting colours/intensities and camera inclination. Panel framing is enlarged per asset, so these panels show construction details rather than equal gameplay scale.

- [Gameplay capture](../output/playwright/asset-review-game.png)
- [Asset comparison sheet](../output/playwright/asset-review-sheet.png)
- [Model measurements](../output/playwright/asset-review-metrics.json)
- [Reproduction script](../output/playwright/asset-review.cjs)

These local evidence files are in the existing ignored `output/playwright/` directory. The game page emitted no JavaScript errors during this check. Simulation, mobile and resource regression suites were not run because no shipped code changed. This review does not establish an FPS budget or validate all missions.

## Recommended order

### 1. Make the harvester's cargo visible

`js/entities/unit_models.js:503–512`, with fill updates in `js/entities/units.js:1084`.

Empty and full harvesters render identically. The solid hopper extends from local Y 0.8 to 1.7. At maximum fill the ore reaches only Y 1.65, and its X/Z bounds are also enclosed by the hopper. Its changing scale is therefore hidden inside an opaque box.

Replace that box with a floor and side walls, and anchor visible ore above the floor as it fills. Add a readable cab windscreen and a small faction marker: the harvester currently calculates faction colours but does not use them. Preserve `userData.oreCargo`, `drill`, and wheel references, and the existing cargo rules.

Accept when empty, half and full cargo are distinct at the normal camera distance for both factions.

### 2. Restore readable HQ and radar dishes

`js/entities/building_models.js:85` and `:367`.

The dishes mostly disappear at the game camera inclination; the mast/feed horn remains visible. Both dish meshes are open-ended, flared cylinders with default front-facing materials. Viewed into the opening, the inward-facing surface is culled.

Give the bowl a visible inner surface or thickness, a contrasting rim, and sufficient clearance above the roof. Verify the silhouette through a full rotation, retaining `userData.rotatingPart` and the radar's existing power behaviour.

### 3. Expose useful vehicle detail

`js/entities/unit_models.js:284–290`, `:407–413`, and `:475–481`.

The six road wheels on each light tracked vehicle, tank and harvester are enclosed by their solid track blocks. For example, tank wheels are 0.4 wide inside a 0.65-wide track; their height and length also fit entirely inside it. The extra meshes do not contribute visible running gear.

Rework the track profile or wheel placement without increasing the gameplay footprint. Add sloped hull fronts, a clearer turret profile and broad engine-deck vents. Use restrained faction panels on neutral armour. Preserve turret pivots, muzzle anchors and wheel animation references.

### 4. Develop production-building roofs and materials

`js/entities/building_models.js:108`, `:192`, and `:297`.

The factory is five meshes and 88 triangles: its large roof reads as a plain blue slab with one bar and a vent. The refinery and power plant similarly rely on saturated cylinders. The existing HQ's neutral body with coloured trim provides a useful palette reference.

Prioritize factory roof bays and vents; refinery pipe connections and a clearly marked unloading apron; and visible cooling-tower mouths, rims and an equipment deck for the power plant. Keep faction markings readable from above. Avoid small bolts and thin rails that disappear at gameplay scale.

### 5. Ground units and defer microdetail

The sampled unit models contain no shadow-casting meshes. Consider selective hull/body shadows on desktop, then profile an army-sized scene. Mobile explicitly disables renderer shadows; any mobile contact-shadow treatment would need separate verification.

Infantry already have useful shoulder/helmet markings and the rocket unit has a clear weapon silhouette. Further infantry microdetail is lower priority. Ground texture sharpness and tree variation can follow the vehicle/building pass; they are separate from the confirmed occlusion fixes.

## Baseline model complexity

Counts exclude selection rings, health bars, scaffolds and rendering passes.

| Model | Meshes | Triangles |
| --- | ---: | ---: |
| Battle tank | 14 | 348 |
| Harvester | 13 | 312 |
| Light tracks | 12 | 324 |
| Power plant | 6 | 664 |
| Refinery | 6 | 184 |
| War factory | 5 | 88 |
| HQ | 11 | 164 |
| Radar | 5 | 314 |

These counts favour spending geometry on visible shapes while limiting extra mesh/material submissions. Repeated static detail should be combined within each model where practical. Preserve the current resource-ownership/disposal contract rather than casually sharing materials between independently destroyed models.

## Blender decision and implementation scope

The first pass can stay in `unit_models.js` and `building_models.js`, with a small cargo-visual adjustment in `units.js` if needed. No loader, bundler, module conversion, balance changes or new asset pipeline is required.

Blender becomes more useful for a later aircraft/body-shape pass, custom UV work, or baked surface detail. If used, bring its actual window to the foreground before modelling so development is visible, as requested.

For an implementation pass, compare both factions at default and close zoom; empty/half/full cargo; moving tracks and turrets; radar rotation and loss of power; construction/placement previews; and mobile rendering. Run the existing simulation, script-load, resource and mobile checks after changes, and inspect draw calls in a representative populated scene before shipping.
