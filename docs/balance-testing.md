# Game balance testing plan

No code in this pass. This is a playtest protocol so later tuning has numbers instead of vibes. Mechanics stay C&C-like: harvest → credits, power deficit slows production and offlines radar/turrets, HQ death wins M1/M2, M3 is destroy-all.

Record each session in a copy of the sheet at the bottom. One mission + one difficulty per session.

## What we are measuring

| Pillar | Pass feel | Fail feel |
| --- | --- | --- |
| Economy | You can afford the next building without staring at $0 for a minute, but you cannot spam tanks immediately | Starve after one plant, or never feel a money choice |
| Power | A second plant is a real decision; deficit is scary and readable | You never notice power, or one plant covers the whole tech tree |
| Combat TTK | A 4-rifle squad kills an enemy rifle in a couple of seconds, a tank takes a focused volley | Instant melts, or 30s of plinking |
| Difficulty ladder | Easy teaches; Medium pushes; Hard punishes slow eco | Easy steamrolls you, or Hard never leaves its base |
| Mission length | M1 Easy ~8–12 min; M2 Medium ~12–18 min; M3 Hard ~18–25 min | Tutorial over in 3 min, or stalemate at 40 |

Do not retune until you have at least two sessions per cell in the ladder below.

## Ladder (run these)

| # | Mission | Difficulty | Focus |
| --- | --- | --- | --- |
| 1 | 1 Foothold | Easy | Tutorial pacing, first harvest, first fight |
| 2 | 1 Foothold | Medium | Same map, faster AI |
| 3 | 2 Canyon Clash | Medium | Tanks, central ore, desert reads |
| 4 | 2 Canyon Clash | Hard | Harvester harassment, vehicles |
| 5 | 3 Air Superiority | Medium | Air + laser unlock without Hard AI |
| 6 | 3 Air Superiority | Hard | Full tech, destroy-all, snow map |

Optional: M1 Hard and M3 Easy only if a ladder cell feels broken.

## Current shipped numbers (baseline — do not change yet)

Starting credits: M1 3000 · M2 4500 · M3 (check in `js/levels/mission_levels.js`).

AI cadence (`js/ai/skirmish_ai.js`):

| | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Decision tick | 8.0s | 3.5s | 1.8s |
| Attack interval | 110s | 50s | 32s |
| First attack delay | 30s | 0 | 0 |
| Max units | 6 | 16 | 28 |
| Squad size | 3 | 6 | 9 |
| Garrison kept home | 2 | 3 | 4 |
| Vehicles / air / turrets | no / no / no | yes / no / yes | yes / yes / yes |
| Harvester harass | no | no | yes |

Selected unit stats (`UNIT_SPECS`):

| Unit | HP | Dmg | CD | Range | Speed | Cost |
| --- | --- | --- | --- | --- | --- | --- |
| Machine Gunner | 110 | 14 | 0.45 | 13 | 7.5 | 100 |
| Grenadier | 130 | 38 | 1.2 | 15 | 6.8 | 160 |
| Rocket Soldier | 115 | 65 | 1.7 | 19 | 6.2 | 220 |
| 4x4 Gunner | 230 | 26 | 0.45 | 15 | 13 | 350 |
| Light Tracks | 290 | 22 | 0.4 | 14 | 10.5 | 400 |
| Battle Tank | 580 | 95 | 1.6 | 18 | 6.8 | 800 |
| Harvester | 650 | 0 | — | — | 7.2 | 500 |
| Attack Chopper | 280 | 20 | 0.35 | 15 | 11.5 | 750 |
| Laser Colossus | 1350 | 130 | 0.75 | 22 | 5.4 | 1600 |

Structures (cost / power / HP): Power Plant $300 +120MW 850HP · Refinery $1200 1200HP · Barracks $400 · War Factory $1000 · Radar $600 · MG Turret $350 · Rocket Turret $550 · Laser Obelisk $800.

Harvester cargo 500; harvest ticks 60 ore / 0.8s; unload 1.2s. Power deficit production speed 0.35 vs 1.0.

## Session procedure

1. Hard-refresh (`Ctrl+F5`). Note build: local or Pages.
2. Pick the ladder cell. Do not savescum unless the session is a wipe from a bug (record the bug separately).
3. Play for the mission objective only. No debug cheats.
4. After win, lose, or 25 minutes, fill the sheet. Stop; do not immediately retry the same cell.

### Clock checkpoints

Write clock time and credits at:

- First Power Plant complete
- First Refinery complete (harvester out)
- First Barracks / War Factory complete
- First enemy contact (who shot first)
- First building lost (whose)
- HQ kill or destroy-all, or your HQ down

### Combat samples (take 3 if you can)

Time how long it takes:

- 4 player gunners vs 1 enemy gunner (no kiting)
- 1 battle tank vs 4 gunners
- 2 rocket soldiers vs 1 helicopter
- 1 harvester vs 2 gunners (does it escape or die)

TTK = seconds until the loser hits 0 HP. Note if splash (grenades) did most of the work.

## Pass / fail questions (yes/no + one line)

**Economy**

- Did the first refinery pay for itself before the first assault arrived?
- Were you ever stuck with buildings to place but $0 for more than 45s?
- Did a dead harvester feel recoverable (rebuild) or like a wipe?

**Power**

- Did radar or turrets actually go dark when you overbuilt?
- Did production feel slow under deficit (not just the sidebar number)?

**Movement / army**

- Did a box-select + right-click leave a formation, or a pile?
- When they stopped, could you see each soldier?
- Did harvesters still dock after a group move?

**AI**

- Easy: did the first attack wait until you had a barracks (or close)?
- Medium: did the AI contest ore / push HQ, not just idle?
- Hard: did a harvester get hunted? Did a home garrison exist, or did the whole army leave?
- Did the AI rebuild power if you sniped the plant?
- Did the AI respond when you walked into its base, or ignore you?

**Mission**

- M1 Easy: did the tutorial text match what you needed to click next?
- M2: was the central ore worth fighting over?
- M3: destroy-all, not HQ-only — did leftover turrets make the last two minutes a chore?

## Bugs vs balance

If units clip, path into rocks, ignore orders, or the HUD lies, that is a **bug** — log file + repro, do not “fix” it by changing HP tables.

If the numbers above feel wrong but the systems work, that is **balance** — put the proposed delta in the sheet (`gunner dmg 14 → 12`) and wait for a second session before coding.

## Out of scope until this plan has data

- New missions, new units, Tiberium spread, MCV deploy
- Unique GDI vs Nod superweapons
- Multiplayer
- Recosting the whole tree in one pass

## Result sheet (copy per session)

```
Date:
Build: local / Pages
Mission: 1 / 2 / 3
Difficulty: easy / medium / hard
Result: win / lose / timeout
Duration:

Checkpoints (mm:ss, $):
  power:
  refinery:
  factory/barracks:
  first contact:
  first building lost:
  end:

Combat TTK samples:
  4 gunners vs 1 gunner:
  tank vs 4 gunners:
  rockets vs heli:
  harvester vs 2 gunners:

Yes/no notes:
  eco:
  power:
  formation:
  AI first attack:
  AI defend:
  AI harass (hard):

Proposed number changes (if any):
Bugs (repro):
```
