# Playtest backlog

Open items from local play plus the balance ladder. Do not retune HP/cost tables until the ladder sheet has data (`docs/balance-testing.md`).

Status: playtest bugs 1–6 + harvester/troop avoidance implemented. Ladder T1–T6 sim-checked 2026-09-16 (sheet in `docs/balance-testing.md`). A human feel pass per cell is still the second session before any HP/cost retune.

---

## A. Game tests (balance ladder)

Protocol and result sheet: [`docs/balance-testing.md`](balance-testing.md).

| # | Cell | Status |
| --- | --- | --- |
| T1 | Mission 1 Easy — tutorial pacing, first harvest, first fight | sim playthrough 2026-09-16 |
| T2 | Mission 1 Medium — same map, faster AI | sim load 2026-09-16 |
| T3 | Mission 2 Medium — tanks, central ore | sim load 2026-09-16 |
| T4 | Mission 2 Hard — harvester harassment | sim load (harass flag) 2026-09-16 |
| T5 | Mission 3 Medium — air / laser unlock | sim load 2026-09-16 |
| T6 | Mission 3 Hard — destroy-all | sim load (air flag, destroy_all) 2026-09-16 |

Log each session with the copy-paste sheet in that doc (duration, credits checkpoints, TTK samples, AI notes). Bugs found during those sessions go in section B, not into stat tweaks.

---

## B. Playtest issues (this session)

### 1. Harvesting — return, cursor, beep ✅

**Player report:** Harvesters do not return automatically. Player cannot click to force return or move the harvester to force return. No return cursor. Continuous beep while mining is irritating.

**Likely cause (code):**

- Auto-return: `returnToRefinery` uses `moveTo()`, which sets `order = 'move'`. On arrival `updateMovement` calls `becomeIdle()`, which for a harvester sets `harvesterState = 'IDLE'` and **skips `UNLOADING`**. Full cargo then loops walk-to-dock → idle → walk-to-dock.
- Force return / move: right-click empty ground is a normal move, then `IDLE` with `cargo < max` immediately seeks ore again. Right-click refinery only returns if the click hits the building (`js/engine/input.js`); missing the mesh falls through to move.
- Cursor: `resolveOrderCursor` has harvest-on-ore but no **return** state when a loaded harvester is over a friendly refinery.
- Beep: `playMiningSound()` fires every 0.8s mining tick (`js/entities/units.js` + `js/audio/sound_fx.js` square-wave).

**Fix in:** `js/entities/units.js`, `js/engine/input.js`, `js/audio/sound_fx.js`.

**Done when:** Full cargo auto-docks and unloads; RMB on refinery (or a Return command) sends a loaded harvester home; RMB away from ore does not snap it back to the field until idle/empty; cursor shows RETURN on a friendly refinery; mining audio is a quiet loop or at most occasional, not a beep every tick.

---

### 2. Cursor speed vs system / fullscreen ✅

**Player report:** Cursor movement speed needs to match system speeds. Full browser window slows right down.

**Likely cause:** Pointer lock uses raw `movementX/Y` 1:1 with no OS acceleration (`js/engine/renderer.js` `applyMouseMove`). A large window has more pixels to cross, so the same physical move feels slower.

**Fix in:** `js/engine/renderer.js` (sensitivity scale, optional light accel; maybe persist a multiplier).

**Done when:** Locked cursor across a maximized window feels close to the unlocked OS pointer; not sluggish on 1080p+ fullscreen.

---

### 3. Radar — click-to-pan and presentation ✅

**Player report:** Radar should be a shortcut for moving the screen. Currently not properly set up for this kind of game.

**Likely cause:** `Minimap.handleMinimapClick` does `panTo`, but:

- Pointer-lock clicks use `virtualCursor`; minimap uses `event.clientX` (lock-element center), so jump-click often fails while locked.
- Radar is dark / static until a powered Radar Facility; C&C still uses the sidebar map to jump the camera with your own units visible.
- No clear camera frustum / north; small 220×200 tactical blips.

**Fix in:** `js/ui/minimap.js`, `js/engine/input.js` (locked clicks on `#minimap-canvas`).

**Done when:** Click or drag on the radar always pans the battlefield (locked or not). Own units/buildings show even without a radar building; fog/shroud still hide the enemy. Camera box is readable.

---

### 4. Units do not give way — large-army jitter ✅

**Player report:** Units still do not give way to one another. Troops jitter when the army is large.

**Likely cause:** `applyUnitSeparation` pushes **both** units every overlapping pair, every frame (`js/entities/entity_manager.js`). With many soldiers the same pair oscillates around `minDist`. Formation slots help at the destination but not on the march.

**Fix in:** `js/entities/entity_manager.js` (yield: mover vs idle, one-way push, damping; do not separate units sitting on their formation slot). Possibly slightly wider slots.

**Done when:** A 12+ infantry blob can walk and stop without vibrating. Idle troops hold a grid. Moving troops path around stopped ones instead of both bouncing.

---

### 5. Enemy does nothing after the first attacks ✅

**Player report:** After the initial test attacks the enemy does nothing.

**Likely cause:** `launchAssault` requires `combatUnits - garrison >= attackSquadSize` (`js/ai/skirmish_ai.js`). After the first wave dies, Easy (squad 3 + garrison 2) never reaches the threshold again. Survivors sitting at the player base are not `idle` near HQ, so they are not restaged or sent on a new attack. `defendBase` returning `true` also skips production that tick.

**Fix in:** `js/ai/skirmish_ai.js`.

**Done when:** After the first raid, the AI keeps producing and sends another wave (smaller is fine). Idle combat units not at home get a new attack-move. Easy still slower than Medium/Hard.

---

### 6. Spice / ore field regeneration ✅

**Player report:** Fields need some way to regenerate.

**Likely cause:** `updateOreRegeneration` already adds `delta * 8` (`js/engine/terrain.js`), vs harvest ~75 ore/s. A 5000 field takes ~10 minutes to refill from empty. At `remaining === 0` the mesh is hidden and `getClosestOreDeposit` skips the node, so it looks permanently dead.

**Fix in:** `js/engine/terrain.js` (faster regen, keep depleted fields visible as “growing”, still skip empty nodes for pathing until a minimum remaining).

**Done when:** A mined-out field comes back on a mission timescale (minutes, not 10+). Crystals shrink then grow; harvesters can return to a recovering field.

---

## Order of work (when implementing)

1. Harvest return + beep (economy loop is broken without it)
2. AI follow-up attacks
3. Unit yield / jitter
4. Radar click-to-pan
5. Cursor sensitivity
6. Ore regen (already exists; tune + show)

Then resume ladder T1–T6.
