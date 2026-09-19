# Asset and environment update — 19 September 2026

Implemented the visibility and detail improvements identified in the asset review, retaining procedural Three.js models and classic script loading. Blender was not needed.

## Changes

- Harvesters have an open, dark-floored hopper with visible rising ore, a windscreen and faction markings. The bed empties on delivery.
- Tanks and light tracked vehicles have tapered armour, faction panels and engine vents. Their tracks, and harvester tracks, have open sides, exposed road wheels and tread cleats. Main tracked-vehicle bodies cast shadows on desktop.
- HQ and radar dishes have a visible inner bowl, rim and feed mast. Rotation anchors and power behaviour are retained.
- Power plants have shaped cooling towers with recessed mouths; refineries have roof detail, piping and marked unloading areas; factories have roof bays, panel seams and framed doors.
- Environment assets have clustered, faceted ore, irregular biome-coloured rocks, varied temperate crowns, snow that follows pine branches, cactus arm tips and seeded ground grain.
- Static details are combined into owned geometry. Ore fields use one crystal mesh instead of sixteen; temperate pines use two meshes instead of four, and snow pines use three instead of seven. These are mesh counts, not an FPS claim.
- Increased the local threaded server's connection backlog after repeated browser reloads produced refused script requests.

Unit stats, mission definitions, resource-node coordinates, building footprints and obstacle-blocking rules are unchanged. Environment placement remains procedural; no new resource nodes or collision cells were introduced by decorative detail.

## Validation

- `node tests/run_sim_tests.js`: all 45 passed. The real harvest-cycle test now raycasts from the RTS camera direction to confirm that cargo is not hidden behind the hopper, then checks that unloading clears it.
- `node tests/run_script_load.js`: passed with the added local geometry helper.
- `node tests/run_resource_tests.js`: passed, including ore disposal and building capture/construction cleanup.
- `node tests/run_mobile_tests.js`: passed.
- Chrome: deployed all three missions, including the red faction on Mission 2; exercised tank movement and wheel animation, and radar rotation with power on/off.
- Chrome touch emulation: deployment and WebGL succeeded, with shadows disabled as intended.
- Inspected model and environment renders at the gameplay camera inclination. The final three-map/touch check recorded no browser warnings or errors.

Local evidence (ignored by Git) is under `output/playwright/`: `asset-environments.png`, `asset-mission-1.png` through `asset-mission-3.png`, `asset-mobile.png`, `asset-qa.json`, and the validation logs. No physical mobile-device FPS or army-scale GPU performance guarantee is implied by these checks.
