# Mobile validation

Implemented for landscape phones and tablets without changing the classic-script runtime or RTS balance.

## Automated checks

- `npm test`: 45 simulation cases pass, including the existing compressed tutorial scenario.
- `npm run test:scripts`: classic script loading, keyboard controls, virtual cursor, pointer lock, radar prerequisites pass.
- `npm run test:resources`: scene-resource lifecycle checks pass.
- `npm run test:mobile`: real managers with simulated pointer gestures verify selection, orders, pan/pinch cancellation, fog, nearest targeting, explicit attack-move over ore, group shortcuts, placement, pause guards, uniform simulation speed, backgrounding and rotation.

## Browser checks

Chrome with emulated touch was exercised at 750 x 342 (landscape phone), 390 x 844 (portrait), and 1024 x 768 (tablet layout). Actual browser touch events exercised selection, movement, panning, pinch zoom, build information, preview/Place, native drawer scrolling, minimap, group assignment/recall, stances, pause/speed, rotation and menu resume. Touch construction completed a Power Plant, Ore Refinery and Barracks, granted the harvester, trained soldiers, and cancelled a queued unit. The tutorial reached its assault step. Desktop mouse selection, pointer lock, right-click movement and pause also passed.

## Outstanding acceptance checks

- The browser tutorial assault ended in defeat; a successful full touch-only Mission 1 playthrough is not signed off. The existing simulation tutorial test uses a compressed assault fixture, so it is not evidence of a natural-play victory.
- No physical iPhone, Android phone or tablet was available. Safari behavior, thermal/battery behavior and sustained 30 FPS during representative battles require real-device testing.
- Browser termination recovery is outside this release: a discarded page loses the mission.

Mobile quality defaults to pixel ratio 1, no dynamic shadows, and minimap updates approximately every 150 ms. These reduce rendering cost but are not a measured device-performance guarantee.
