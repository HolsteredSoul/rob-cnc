# Operation Vanguard

A browser Command & Conquer–style RTS: harvest ore, keep the power grid up, build from the sidebar, and destroy the enemy command center.

**Play now:** [holsteredsoul.github.io/rob-cnc](https://holsteredsoul.github.io/rob-cnc/)

## Local play

Python 3 is enough. Double-click `start_game.bat`, or:

```bash
python server.py
```

Then open `http://127.0.0.1:8000/index.html`. Keep that window open while you play.

## Controls

| Action | Input |
| --- | --- |
| Select | Left-click or drag a box |
| Move / attack | Right-click |
| Build | Sidebar cards, then click the map |
| Camera | WASD / arrow keys, screen-edge pan, minimap, mouse wheel zoom |
| Stop units | `S` |
| Jump to HQ | `H` |
| Lock mouse in the window | Click the battlefield (Esc releases) |
| Repair / sell | Sidebar mode buttons, then click a building |

Mission 1 on Easy is the tutorial: move, power plant, refinery (free harvester), barracks, train troops, then take the enemy HQ.

## Tests

```bash
npm test
npm run test:scripts
```

## License

Personal / hobby project. Command & Conquer is a trademark of its owners; this is an independent fan clone, not affiliated with EA.
