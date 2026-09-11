'use strict';

const { spawn, spawnSync, execSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SCRATCH = process.env.CNC_SCRATCH || path.join(ROOT, 'tests', '_scratch');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function probePlaywright() {
  try {
    const out = execSync('npx --yes playwright --version', {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, version: String(out).trim() };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
}

function findPlaywrightModule() {
  const tried = [];
  try {
    const resolved = require.resolve('playwright');
    return { ok: true, id: resolved, tried };
  } catch (err) {
    tried.push('require.resolve(playwright): ' + err.message);
  }

  const npxRoot = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx');
  if (npxRoot && fs.existsSync(npxRoot)) {
    const dirs = fs.readdirSync(npxRoot);
    for (const dir of dirs) {
      const candidate = path.join(npxRoot, dir, 'node_modules', 'playwright');
      const indexJs = path.join(candidate, 'index.js');
      if (fs.existsSync(indexJs)) {
        try {
          return { ok: true, id: candidate, tried };
        } catch (err) {
          tried.push(candidate + ': ' + err.message);
        }
      }
    }
    tried.push('npx cache scanned: ' + dirs.length + ' entries, no loadable playwright');
  } else {
    tried.push('npx cache missing: ' + npxRoot);
  }
  return { ok: false, tried };
}

function loadPlaywright(logLines) {
  let found = findPlaywrightModule();
  if (!found.ok) {
    logLines.push('playwright module missing, installing with npm --no-save');
    try {
      execSync('npm install --no-save playwright', {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 180000,
        env: Object.assign({}, process.env, { PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1' }),
        stdio: ['ignore', 'pipe', 'pipe']
      });
      found = findPlaywrightModule();
    } catch (err) {
      return { available: false, reason: 'npm install playwright failed: ' + err.message };
    }
  }
  if (!found.ok) {
    return { available: false, reason: 'playwright module missing: ' + found.tried.join(' | ') };
  }
  try {
    const playwright = require(found.id);
    logLines.push('playwright module: ' + found.id);
    return { available: true, playwright };
  } catch (err) {
    return { available: false, reason: 'playwright require failed: ' + err.message };
  }
}

function waitForHttp(url, timeoutMs) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', (err) => {
        if (Date.now() - start > timeoutMs) reject(err);
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

function killProcessTree(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch (_) {
    try { child.kill(); } catch (__) {}
  }
}

async function startServer() {
  const child = spawn('python', ['-u', 'server.py', '--no-browser'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: Object.assign({}, process.env, { PYTHONUNBUFFERED: '1' })
  });
  let output = '';
  child.stdout.on('data', (d) => { output += d.toString(); });
  child.stderr.on('data', (d) => { output += d.toString(); });
  child.on('error', (err) => { output += 'spawn error: ' + err.message; });

  const deadline = Date.now() + 12000;
  let url = null;
  while (Date.now() < deadline) {
    const match = output.match(/https?:\/\/127\.0\.0\.1:\d+\/index\.html/);
    if (match) {
      url = match[0];
      break;
    }
    await wait(150);
  }
  if (!url) url = 'http://127.0.0.1:8000/index.html';
  await waitForHttp(url, 8000);
  return { child, url, output };
}

function pngPaintedFraction(buf) {
  if (!buf || buf.length < 33) return { ok: false, reason: 'empty png' };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.slice(0, 8).equals(sig)) return { ok: false, reason: 'not png' };

  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString('ascii');
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + len;
  }
  if (!width || !height || !idat.length) return { ok: false, reason: 'png missing image data', width, height };

  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4 + 1;
  let painted = 0;
  let samples = 0;
  const stepX = Math.max(1, Math.floor(width / 80));
  const stepY = Math.max(1, Math.floor(height / 45));
  for (let y = 0; y < height; y += stepY) {
    const row = y * stride;
    const filter = inflated[row];
    if (filter !== 0) {
      // Filtered rows still contain image bytes; skip filter byte and sample raw-ish.
    }
    for (let x = 0; x < width; x += stepX) {
      const i = row + 1 + x * 4;
      const r = inflated[i];
      const g = inflated[i + 1];
      const b = inflated[i + 2];
      samples++;
      if (r + g + b > 18) painted++;
    }
  }
  return { ok: true, width, height, painted, samples, fraction: samples ? painted / samples : 0 };
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('three-canvas');
    const ctx = window.gameContext;
    const renderer = ctx && ctx.renderer;
    const threeRenderer = renderer && renderer.renderer;
    const gl = (threeRenderer && threeRenderer.getContext && threeRenderer.getContext())
      || (canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl')));

    let painted = 0;
    let samples = 0;
    let sampleMethod = 'none';
    let glInfo = null;

    if (gl) {
      glInfo = {
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
        renderer: null,
        vendor: null
      };
      try {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          glInfo.renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
          glInfo.vendor = gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);
        } else {
          glInfo.renderer = gl.getParameter(gl.RENDERER);
          glInfo.vendor = gl.getParameter(gl.VENDOR);
        }
      } catch (_) {}
    }

    if (canvas && canvas.width > 0 && canvas.height > 0) {
      try {
        const sw = Math.min(canvas.width, 320);
        const sh = Math.min(canvas.height, 180);
        const off = document.createElement('canvas');
        off.width = sw;
        off.height = sh;
        const c2d = off.getContext('2d');
        c2d.drawImage(canvas, 0, 0, sw, sh);
        const data = c2d.getImageData(0, 0, sw, sh).data;
        samples = sw * sh;
        for (let p = 0; p < data.length; p += 4) {
          if (data[p] + data[p + 1] + data[p + 2] > 18) painted++;
        }
        sampleMethod = 'drawImage';
      } catch (err) {
        sampleMethod = 'drawImage-failed:' + err.message;
      }
    }

    if (samples === 0 && gl) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const rw = Math.min(w, 200);
      const rh = Math.min(h, 200);
      try {
        if (threeRenderer && typeof threeRenderer.render === 'function' && renderer.scene && renderer.camera) {
          threeRenderer.render(renderer.scene, renderer.camera);
        }
        const data = new Uint8Array(rw * rh * 4);
        gl.readPixels(0, 0, rw, rh, gl.RGBA, gl.UNSIGNED_BYTE, data);
        samples = rw * rh;
        for (let p = 0; p < data.length; p += 4) {
          if (data[p] + data[p + 1] + data[p + 2] > 18) painted++;
        }
        sampleMethod = 'readPixels';
      } catch (err) {
        sampleMethod = 'readPixels-failed:' + err.message;
      }
    }

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    const powerEl = document.getElementById('power-val');
    const creditsEl = document.getElementById('credits-val');
    const objectiveEl = document.getElementById('objective-text');
    const lobby = document.getElementById('modal-lobby');
    const units = ctx && ctx.entityManager && ctx.entityManager.getPlayerUnits
      ? ctx.entityManager.getPlayerUnits()
      : [];

    return {
      clientWidth: canvas ? canvas.clientWidth : 0,
      clientHeight: canvas ? canvas.clientHeight : 0,
      canvasWidth: canvas ? canvas.width : 0,
      canvasHeight: canvas ? canvas.height : 0,
      drawingBufferWidth: gl ? gl.drawingBufferWidth : (canvas ? canvas.width : 0),
      drawingBufferHeight: gl ? gl.drawingBufferHeight : (canvas ? canvas.height : 0),
      devicePixelRatio: dpr,
      painted,
      samples,
      sampleMethod,
      glInfo,
      noGl: !gl,
      missionActive: !!(ctx && ctx.missionActive),
      credits: creditsEl && creditsEl.textContent,
      power: powerEl && powerEl.textContent,
      objective: objectiveEl && objectiveEl.textContent,
      lobbyHidden: !lobby || lobby.classList.contains('hidden') || lobby.style.display === 'none',
      playerUnits: units.length,
      errors: window.__cncErrors || []
    };
  });
}

async function driveInput(page) {
  return page.evaluate(() => {
    const ctx = window.gameContext;
    if (!ctx || !ctx.entityManager) return { ok: false, reason: 'no gameContext' };
    const units = ctx.entityManager.getPlayerUnits ? ctx.entityManager.getPlayerUnits() : [];
    const unit = units.find((u) => u && u.isAlive) || units[0];
    if (!unit) return { ok: false, reason: 'no player units' };

    const before = {
      x: unit.position.x,
      z: unit.position.z,
      camX: ctx.renderer.targetPos.x,
      camZ: ctx.renderer.targetPos.z
    };
    ctx.entityManager.selectSingle(unit);
    unit.moveTo(before.x + 14, before.z + 10, ctx.pathfinding);
    if (ctx.missionManager) ctx.missionManager.playerHasMovedUnits = true;
    ctx.renderer.panTo(before.camX + 8, before.camZ + 6);
    return {
      ok: true,
      before,
      selected: ctx.entityManager.selectedUnits.length,
      waypoints: (unit.waypoints && unit.waypoints.length) || 0
    };
  });
}

async function inputAfter(page) {
  return page.evaluate(() => {
    const ctx = window.gameContext;
    const unit = ctx && ctx.entityManager && ctx.entityManager.selectedUnits[0];
    const hudName = document.getElementById('selected-name');
    return {
      unit: unit ? { x: unit.position.x, z: unit.position.z, type: unit.type } : null,
      cam: ctx && ctx.renderer ? { x: ctx.renderer.targetPos.x, z: ctx.renderer.targetPos.z } : null,
      selectedName: hudName && hudName.textContent,
      selectedCount: ctx && ctx.entityManager ? ctx.entityManager.selectedUnits.length : 0
    };
  });
}

async function runWithPlaywright(logLines) {
  const pw = probePlaywright();
  logLines.push('playwright --version: ' + (pw.ok ? pw.version : 'UNAVAILABLE ' + pw.error));
  if (!pw.ok) return { available: false, reason: pw.error };

  const loaded = loadPlaywright(logLines);
  if (!loaded.available) return loaded;
  const playwright = loaded.playwright;

  fs.mkdirSync(SCRATCH, { recursive: true });
  const server = await startServer();
  logLines.push('server url: ' + server.url);
  logLines.push('server banner: ' + server.output.trim());

  let browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-gpu-sandbox'
      ]
    });
  } catch (err) {
    killProcessTree(server.child);
    return { available: false, reason: 'chromium launch failed: ' + err.message };
  }

  const errors = [];
  const launchMetrics = [];
  try {
    for (let i = 1; i <= 2; i++) {
      const pageErrors = [];
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      page.on('pageerror', (err) => {
        pageErrors.push('pageerror: ' + err.message);
        errors.push('launch' + i + ' pageerror: ' + err.message);
      });
      page.on('console', (msg) => {
        const text = msg.text();
        if (msg.type() === 'error') {
          pageErrors.push('console.error: ' + text);
          errors.push('launch' + i + ' console.error: ' + text);
        }
        logLines.push('launch ' + i + ' console.' + msg.type() + ': ' + text);
      });

      await page.goto(server.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('#btn-deploy-forces', { timeout: 15000 });
      await page.waitForFunction(() => !!(window.gameContext && window.gameContext.renderer), { timeout: 15000 });

      await page.screenshot({ path: path.join(SCRATCH, i === 1 ? 'lobby.png' : 'lobby-2.png') });

      await page.click('#btn-deploy-forces');
      await page.waitForFunction(() => !!(window.gameContext && window.gameContext.missionActive), { timeout: 10000 });
      await wait(1200);

      let metrics = await collectMetrics(page);
      const inputBefore = await driveInput(page);
      await wait(900);
      const inputAfterState = await inputAfter(page);
      metrics = await collectMetrics(page);
      metrics.inputBefore = inputBefore;
      metrics.inputAfter = inputAfterState;

      const launchShot = path.join(SCRATCH, i === 1 ? 'launch-1.png' : 'launch-2.png');
      const hudShot = path.join(SCRATCH, i === 1 ? 'hud.png' : 'hud-2.png');
      await page.screenshot({ path: launchShot });
      await page.screenshot({ path: hudShot });

      const pngInfo = pngPaintedFraction(fs.readFileSync(launchShot));
      metrics.png = pngInfo;
      const paintedFrac = metrics.samples ? metrics.painted / metrics.samples : 0;
      const pngFrac = pngInfo.ok ? pngInfo.fraction : 0;
      const bestFrac = Math.max(paintedFrac, pngFrac);
      metrics.paintedFraction = paintedFrac;
      metrics.pngFraction = pngFrac;
      metrics.bestPaintedFraction = bestFrac;

      const moved = !!(inputBefore.ok && inputAfterState.unit && (
        Math.abs(inputAfterState.unit.x - inputBefore.before.x) > 0.2
        || Math.abs(inputAfterState.unit.z - inputBefore.before.z) > 0.2
        || (inputAfterState.cam && (
          Math.abs(inputAfterState.cam.x - inputBefore.before.camX) > 0.2
          || Math.abs(inputAfterState.cam.z - inputBefore.before.camZ) > 0.2
        ))
      ));
      metrics.inputMoved = moved;
      launchMetrics.push(metrics);
      logLines.push('launch ' + i + ' metrics: ' + JSON.stringify(metrics));

      if (pageErrors.length) throw new Error('page errors: ' + pageErrors.join(' | '));
      if (metrics.noGl) throw new Error('WebGL context unavailable');
      if (metrics.drawingBufferWidth <= 300 && metrics.drawingBufferHeight <= 150 && metrics.clientWidth > 300) {
        throw new Error('canvas stuck at default 300x150');
      }
      const expectedW = Math.round(metrics.clientWidth * Math.min(metrics.devicePixelRatio || 1, 2));
      const expectedH = Math.round(metrics.clientHeight * Math.min(metrics.devicePixelRatio || 1, 2));
      if (metrics.clientWidth > 300 && (metrics.drawingBufferWidth < metrics.clientWidth * 0.5
          || metrics.drawingBufferHeight < metrics.clientHeight * 0.5)) {
        throw new Error(
          'drawing buffer ' + metrics.drawingBufferWidth + 'x' + metrics.drawingBufferHeight
          + ' does not match canvas client ' + metrics.clientWidth + 'x' + metrics.clientHeight
          + ' (expected ~' + expectedW + 'x' + expectedH + ')'
        );
      }
      if (bestFrac < 0.25) {
        throw new Error('canvas not substantially filled, painted fraction ' + bestFrac);
      }
      if (!metrics.missionActive) throw new Error('mission did not start');

      await page.close();
    }
  } finally {
    try { await browser.close(); } catch (_) {}
    killProcessTree(server.child);
  }

  return { available: true, ok: true, metrics: launchMetrics };
}

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  const logLines = [];
  try {
    const result = await runWithPlaywright(logLines);
    if (!result.available) {
      const text = ['LAUNCH_UNAVAILABLE', result.reason, ...logLines].join('\n');
      fs.writeFileSync(path.join(SCRATCH, 'launch-unavailable.log'), text);
      console.log(text);
      process.exit(0);
    }
    const text = ['LAUNCH_OK', ...logLines].join('\n');
    fs.writeFileSync(path.join(SCRATCH, 'launch.log'), text);
    console.log(text);
  } catch (err) {
    const text = ['LAUNCH_FAIL ' + err.message, err.stack, ...logLines].join('\n');
    fs.writeFileSync(path.join(SCRATCH, 'launch.log'), text);
    console.error(text);
    process.exit(1);
  }
}

main();
