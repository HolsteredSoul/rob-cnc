# Agent boot — Operation Vanguard (Rob CNC)

Read this before exploring. Vanilla-JS Three.js C&C clone. **Fix in place. Do not rewrite, do not add a bundler, do not switch to modules.**

## Where it lives

- Repo: https://github.com/HolsteredSoul/rob-cnc (`main`)
- Play: https://holsteredsoul.github.io/rob-cnc/ (Pages from `/` on `main`)
- Disk: `C:\DEV\Rob CNC`
- Local: `start_game.bat` or `python server.py` → `http://127.0.0.1:8000/index.html`
- Never open `index.html` as `file://`

## Stack (do not change)

- Classic `<script src>` in `index.html` (no ESM, no bare specifiers)
- `lib/three.min.js` r128 global `THREE`
- `server.py` = `ThreadingMixIn` static server (single-thread wedges Chrome)
- Tests: Node `vm` sandbox in `tests/` — no Jest/jsdom required to play

## File map

| Path | Owns |
| --- | --- |
| `js/main.js` | Lobby deploy, game loop, `window.hud` / `window.gameContext` |
| `js/engine/input.js` | Select, RMB orders, placement ghost, pointer-lock click mapping |
| `js/engine/renderer.js` | Camera, edge pan, pointer lock, virtual cursor, WebGL size |
| `js/engine/pathfinding.js` | A*; waypoints **must** be `{x,z}` (not `{wx,wz}`) |
| `js/engine/terrain.js` | Grid, ore, `gridToWorld` returns `{x,z,wx,wz}` |
| `js/entities/units.js` | Move, combat, harvester state machine |
| `js/entities/buildings.js` | Construction tick (`isBuilding`), production, turrets |
| `js/entities/entity_manager.js` | Spawn; refinery grants harvester on **complete** |
| `js/economy/economy.js` | Credits, power, `getProductionSpeed` (1.0 / 0.35) |
| `js/tech/tech_tree.js` | `TechTree.isUnlocked` — incomplete buildings do not count |
| `js/ai/skirmish_ai.js` | Easy/medium/hard cadence |
| `js/levels/mission_levels.js` | 3 missions; `winRule`: `destroy_hq` \| `destroy_all` |
| `js/ui/hud.js` | Sidebar locked vs `unaffordable`, selection HP, tutorial text |
| `tests/run_sim_tests.js` | Harvest, combat, production, power, tech, win/lose |
| `tests/run_script_load.js` | Loads `index.html` scripts with **no** Node `module`/`require` |

## Product bar (keep)

C&C **mechanics**, not a 1:1 Tiberian Dawn port: harvest → refinery credits; power deficit slows production and offlines radar/turrets; sidebar tech gates (power plant → refinery/barracks → war factory/radar); fog; repair/sell; HQ death wins M1/M2 even with leftover buildings; M3 is destroy-all; player HQ gone **and** no army = defeat.

Ease of use: left-select / right-order (not original left-click-only). Mission 1 Easy is the tutorial chain.

## Landmines (already burned)

1. **Pointer lock vs select/move** — Do not lock on Deploy. Seed `virtualCursor` from the real click. Select/move on that click, **then** `requestPlayLock` on mouseup. Ignore the first lock mousemove jump (`_lockWarmup` / |delta| > 80). RMB **mousedown** issues orders; `contextmenu` only `preventDefault` (lock breaks contextmenu coords). When locked, picks use `virtualCursor`, never `event.clientX` (that is the lock-element center).
2. **Pathfinding** — `reconstructPath` must push `{x,z}`. `{wx,wz}` freezes units and breaks harvester return.
3. **Building click** — skip dead buildings with `continue`, never `return` (aborts the rest of the list; kills repair/sell).
4. **Construction** — `isBuilding` starts true unless `{complete:true}`. Tick in `Building.update`; mission/AI starters pass `complete: true`. Power/tech/harvester only when complete.
5. **Meshes** — never `.position` on a Geometry (radar feed horn must be a `Mesh`). No free identifier `spec` in `building_models.js`.
6. **Camera `S`** — `S` is unit-stop. Pan with W/A/D, arrows, edge, minimap.
7. **Canvas size** — `getViewportSize()`; never leave WebGL at default 300×150.
8. **Tests** — `vm` must assign top-level `class`/`const` onto `this` after each script. Cap `requestAnimationFrame` or the game loop hangs Node.

## Commands

```bash
python server.py --no-browser
npm test
npm run test:scripts
```

Push to `origin/main` after playable fixes so Pages updates. Hard-refresh the live site (`Ctrl+F5`).

## Non-goals (do not start)

Full campaign, FMV, multiplayer, sprite-accurate remake, original unit names/damage tables, Tiberium hurt/spread, MCV deploy, adjacent-only building, sidebar “build then place”, unique GDI vs Nod superweapons, extra missions beyond polishing the existing three.

## Next-rev defaults

- Prefer a small patch in the owning file above.
- Drive shipped managers in `tests/run_sim_tests.js` (real entities, full harvest/combat path, no hardcoded HP tables).
- UI changes: verify in the browser (Pages or local server), not a screenshot-only check.
- Token: work solo on focused edits; no fan-out unless the user asks.
