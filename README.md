# Operation Vanguard

A browser Command & Conquer–style RTS: harvest ore, keep the power grid up, build from the sidebar, and destroy the enemy command center.

**Fastest way to play (no install):** [holsteredsoul.github.io/rob-cnc](https://holsteredsoul.github.io/rob-cnc/)

---

## Play a copy on your PC

You do **not** need Node, npm, or a game engine. The game is HTML/JS. A tiny Python server is only there so the browser can load the files (opening `index.html` as a file usually fails).

### 1. Get the files

**Option A — Download ZIP (no Git required)**

1. Open [github.com/HolsteredSoul/rob-cnc](https://github.com/HolsteredSoul/rob-cnc)
2. Click the green **Code** button → **Download ZIP**
3. Unzip it somewhere easy, e.g. `C:\Games\rob-cnc`
4. Open that folder. You should see `start_game.bat`, `server.py`, and `index.html`

**Option B — Git clone**

1. Install [Git for Windows](https://git-scm.com/download/win) if you do not have it
2. Open PowerShell or Command Prompt and run:

```bash
git clone https://github.com/HolsteredSoul/rob-cnc.git
cd rob-cnc
```

### 2. Install Python 3 (if you do not have it)

1. Download the installer from [python.org/downloads](https://www.python.org/downloads/)
2. Run it
3. Tick **Add python.exe to PATH** before you click Install
4. Finish the installer, then close and reopen any terminal windows

Check it worked:

```bash
python --version
```

If that fails, try:

```bash
py -3 --version
```

You want a 3.x version (3.10 or newer is fine).

### 3. Start the game (Windows)

1. Double-click **`start_game.bat`**
2. Leave that black window open
3. Your browser should open `http://127.0.0.1:8000/index.html`
4. In the lobby: pick a team, leave **Easy** and **Mission 1** selected, click **DEPLOY FORCES**

To quit: close the browser tab, then in the black window press `Ctrl+C` and any key.

If the browser did not open, go to [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html) yourself.

### Mac / Linux

```bash
python3 server.py
```

Then open [http://127.0.0.1:8000/index.html](http://127.0.0.1:8000/index.html)

### If something goes wrong

| What you see | What to do |
| --- | --- |
| `'python' is not recognized` / `py` not found | Install Python 3 and tick **Add to PATH**, then retry in a **new** terminal |
| `Server error` / port already in use | Close other copies of the game, or anything else using port 8000, then run the `.bat` again |
| Black / empty map after Deploy | Hard-refresh (`Ctrl+F5`). Do not open `index.html` by double-clicking it — use the local server URL |
| Browser says the site cannot be reached | The black server window must stay open. Check it still says it is running on port 8000 |
| Clicking units does nothing | Click the **battlefield** (the 3D view, not the sidebar) to lock the mouse, then left-click a soldier and right-click the ground |

---

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

---

## Tests (optional, for developers)

Needs [Node.js](https://nodejs.org/) only for this part — not for playing.

```bash
npm test
npm run test:scripts
```

---

## License

Personal / hobby project. Command & Conquer is a trademark of its owners; this is an independent fan clone, not affiliated with EA.
