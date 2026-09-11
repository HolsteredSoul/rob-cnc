'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fake2d(canvas) {
  return {
    canvas,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    globalAlpha: 1,
    font: '10px sans-serif',
    textAlign: 'left',
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    quadraticCurveTo() {},
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createImageData(w, h) {
      if (typeof w === 'object') {
        h = w.height;
        w = w.width;
      }
      w = w || 1;
      h = h || 1;
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    },
    putImageData() {},
    drawImage() {},
    getImageData(x, y, w, h) {
      return { data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w || 1, height: h || 1 };
    },
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    setTransform() {},
    measureText(t) {
      return { width: String(t).length * 6 };
    },
    fillText() {}
  };
}

function createClassList(el) {
  return {
    add(...names) {
      const set = new Set((el.className || '').split(/\s+/).filter(Boolean));
      names.forEach((n) => set.add(n));
      el.className = Array.from(set).join(' ');
    },
    remove(...names) {
      const drop = new Set(names);
      el.className = (el.className || '').split(/\s+/).filter((n) => n && !drop.has(n)).join(' ');
    },
    contains(name) {
      return (el.className || '').split(/\s+/).includes(name);
    },
    toggle(name, force) {
      const has = this.contains(name);
      const should = force === undefined ? !has : !!force;
      if (should) this.add(name);
      else this.remove(name);
      return should;
    }
  };
}

function parseInnerHTML(el, html) {
  el.children = [];
  if (!html) return;
  const tagRe = /<([a-zA-Z0-9]+)([^>]*)>/g;
  let match;
  while ((match = tagRe.exec(html))) {
    const tag = match[1];
    const attrs = match[2] || '';
    const child = new FakeElement(tag);
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
    const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
    if (idMatch) child.id = idMatch[1];
    if (classMatch) child.className = classMatch[1];
    el.appendChild(child);
  }
}

class FakeElement {
  constructor(tag, attrs = {}) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.id = attrs.id || '';
    this.className = attrs.className || attrs.class || '';
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.dataset = Object.assign({}, attrs.dataset || {});
    this.disabled = !!attrs.disabled;
    this._innerHTML = '';
    this._text = attrs.textContent || '';
    this.width = attrs.width || (this.tagName === 'CANVAS' ? 800 : 0);
    this.height = attrs.height || (this.tagName === 'CANVAS' ? 600 : 0);
    this.clientWidth = attrs.clientWidth || (this.tagName === 'CANVAS' ? 960 : 280);
    this.clientHeight = attrs.clientHeight || (this.tagName === 'CANVAS' ? 720 : 200);
    this.nodeType = 1;
    this.classList = createClassList(this);
    this._listeners = {};
    if (this.tagName === 'CANVAS') {
      this._ctx2d = fake2d(this);
    }
  }

  requestPointerLock() {
    const doc = this.ownerDocument;
    if (doc) {
      doc.pointerLockElement = this;
      if (doc.dispatchEvent) doc.dispatchEvent({ type: 'pointerlockchange' });
    }
  }

  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }

  removeEventListener(type, fn) {
    const list = this._listeners[type];
    if (!list) return;
    this._listeners[type] = list.filter((x) => x !== fn);
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    if (child) child.parentNode = null;
    return child;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value) {
    this._innerHTML = String(value == null ? '' : value);
    parseInnerHTML(this, this._innerHTML);
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value == null ? '' : value);
  }

  getContext(type) {
    if (String(type).indexOf('2d') !== -1) {
      if (!this._ctx2d) this._ctx2d = fake2d(this);
      return this._ctx2d;
    }
    return null;
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.clientWidth,
      height: this.clientHeight,
      right: this.clientWidth,
      bottom: this.clientHeight
    };
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    return queryAll(this, sel);
  }

  setAttribute(name, value) {
    if (name === 'id') this.id = value;
    else if (name === 'class') this.className = value;
    else if (name.indexOf('data-') === 0) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = value;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id;
    if (name === 'class') return this.className;
    return null;
  }
}

function collect(el, out) {
  out.push(el);
  (el.children || []).forEach((c) => collect(c, out));
}

function matchCompound(el, compound) {
  if (!compound) return true;
  let rest = compound;
  const tagMatch = rest.match(/^[a-zA-Z][\w-]*/);
  if (tagMatch) {
    if (el.tagName !== tagMatch[0].toUpperCase()) return false;
    rest = rest.slice(tagMatch[0].length);
  }
  const idMatch = rest.match(/^#([\w-]+)/);
  if (idMatch) {
    if (el.id !== idMatch[1]) return false;
    rest = rest.slice(idMatch[0].length);
  }
  const classes = [];
  rest.replace(/\.([\w-]+)/g, (_, c) => {
    classes.push(c);
    return '';
  });
  for (const c of classes) {
    if (!el.classList.contains(c)) return false;
  }
  return true;
}

function queryAll(root, selector) {
  if (!selector) return [];
  const parts = String(selector).trim().split(/\s+/);
  let current = [];
  collect(root, current);
  if (root.children) {
    // include descendants only for element roots; document handled by caller
  }
  for (const part of parts) {
    current = current.filter((el) => matchCompound(el, part));
    if (parts.length > 1 && part !== parts[parts.length - 1]) {
      const next = [];
      current.forEach((el) => collect(el, next));
      current = next;
    }
  }
  return current.filter((el) => el !== root || matchCompound(el, parts[parts.length - 1]));
}

function el(tag, attrs) {
  return new FakeElement(tag, attrs);
}

function buildDocument() {
  const byId = new Map();
  const all = [];

  function register(node) {
    all.push(node);
    if (node.id) byId.set(node.id, node);
    node.ownerDocument = null;
    return node;
  }

  const body = register(el('body', { id: 'body' }));
  const html = register(el('html'));
  html.appendChild(body);

  const game = register(el('div', { id: 'game-container', clientWidth: 1280, clientHeight: 720 }));
  body.appendChild(game);

  const viewport = register(el('div', { id: 'viewport' }));
  game.appendChild(viewport);
  viewport.appendChild(register(el('div', { id: 'pointer-lock-hint', className: 'hidden' })));
  body.appendChild(register(el('div', { id: 'game-cursor', className: 'hidden' })));

  const canvas = register(el('canvas', { id: 'three-canvas', clientWidth: 960, clientHeight: 720, width: 960, height: 720 }));
  viewport.appendChild(canvas);
  viewport.appendChild(register(el('div', { id: 'selection-box' })));

  const topBar = register(el('div', { id: 'top-tactical-bar' }));
  viewport.appendChild(topBar);
  topBar.appendChild(register(el('span', { id: 'credits-val', textContent: '$ 0' })));
  topBar.appendChild(register(el('div', { id: 'team-badge' })));
  topBar.appendChild(register(el('span', { id: 'team-badge-val', textContent: 'BLUE' })));
  topBar.appendChild(register(el('button', { id: 'btn-menu' })));

  const objBar = register(el('div', { id: 'mission-objective-bar' }));
  viewport.appendChild(objBar);
  objBar.appendChild(register(el('span', { id: 'objective-status', textContent: 'STANDBY' })));
  objBar.appendChild(register(el('div', { id: 'objective-text', textContent: 'Awaiting deployment orders, Commander.' })));
  viewport.appendChild(register(el('div', { id: 'radio-feed' })));

  const selCard = register(el('div', { id: 'selection-card', className: 'hidden' }));
  viewport.appendChild(selCard);
  selCard.appendChild(register(el('span', { id: 'selected-portrait-icon' })));
  selCard.appendChild(register(el('span', { id: 'selected-name' })));
  selCard.appendChild(register(el('span', { id: 'selected-count' })));
  selCard.appendChild(register(el('div', { id: 'selected-hp-fill' })));
  selCard.appendChild(register(el('div', { id: 'selected-stats' })));
  const stanceRow = register(el('div', { id: 'stance-actions-row' }));
  selCard.appendChild(stanceRow);
  ['aggressive', 'guard', 'holdground', 'holdfire'].forEach((s) => {
    const b = register(el('button', { className: 'stance-btn action-btn', dataset: { stance: s } }));
    stanceRow.appendChild(b);
  });

  const sidebar = register(el('div', { id: 'sidebar' }));
  game.appendChild(sidebar);
  const radar = register(el('div', { id: 'radar-container' }));
  sidebar.appendChild(radar);
  radar.appendChild(register(el('canvas', { id: 'minimap-canvas', width: 220, height: 200, clientWidth: 220, clientHeight: 200 })));
  radar.appendChild(register(el('div', { id: 'radar-offline-msg' })));
  sidebar.appendChild(register(el('div', { id: 'power-bar-fill' })));
  sidebar.appendChild(register(el('span', { id: 'power-val' })));
  sidebar.appendChild(register(el('button', { id: 'btn-mode-repair' })));
  sidebar.appendChild(register(el('button', { id: 'btn-mode-sell' })));
  sidebar.appendChild(register(el('button', { id: 'btn-mode-attackmove' })));
  sidebar.appendChild(register(el('button', { id: 'btn-mode-airstrike' })));

  const tabs = register(el('div', { id: 'build-tabs' }));
  sidebar.appendChild(tabs);
  ['structures', 'defenses', 'infantry', 'vehicles'].forEach((tab, i) => {
    const b = register(el('button', {
      className: i === 0 ? 'build-tab active' : 'build-tab',
      dataset: { tab }
    }));
    tabs.appendChild(b);
  });
  const gridWrap = register(el('div', { id: 'build-grid-container' }));
  sidebar.appendChild(gridWrap);
  gridWrap.appendChild(register(el('div', { id: 'build-grid', className: 'build-grid' })));

  body.appendChild(register(el('div', { id: 'build-tooltip' })));
  body.appendChild(register(el('div', { id: 'tooltip-title' })));
  body.appendChild(register(el('div', { id: 'tooltip-desc' })));
  body.appendChild(register(el('div', { id: 'tooltip-stats' })));

  const lobby = register(el('div', { id: 'modal-lobby', className: 'modal-overlay' }));
  body.appendChild(lobby);
  const teamBlue = register(el('div', { id: 'team-blue', className: 'team-card team-blue selected', dataset: { team: 'blue' } }));
  const teamRed = register(el('div', { id: 'team-red', className: 'team-card team-red', dataset: { team: 'red' } }));
  lobby.appendChild(teamBlue);
  lobby.appendChild(teamRed);
  ['easy', 'medium', 'hard'].forEach((d, i) => {
    lobby.appendChild(register(el('div', {
      className: i === 1 ? 'diff-btn selected' : 'diff-btn',
      dataset: { diff: d }
    })));
  });
  [0, 1, 2].forEach((m, i) => {
    lobby.appendChild(register(el('div', {
      className: i === 0 ? 'mission-card selected' : 'mission-card',
      dataset: { mission: String(m) }
    })));
  });
  lobby.appendChild(register(el('button', { id: 'btn-deploy-forces' })));

  const menuModal = register(el('div', { id: 'modal-mission-select', className: 'modal-overlay hidden' }));
  body.appendChild(menuModal);
  [0, 1, 2].forEach((m, i) => {
    menuModal.appendChild(register(el('div', {
      className: i === 0 ? 'mission-card selected' : 'mission-card',
      dataset: { mission: String(m) }
    })));
  });
  ['easy', 'medium', 'hard'].forEach((d, i) => {
    menuModal.appendChild(register(el('div', {
      className: i === 1 ? 'diff-btn selected' : 'diff-btn',
      dataset: { diff: d }
    })));
  });
  menuModal.appendChild(register(el('button', { id: 'btn-launch-mission' })));
  menuModal.appendChild(register(el('button', { id: 'btn-back-to-lobby' })));

  const victory = register(el('div', { id: 'modal-victory', className: 'modal-overlay hidden' }));
  body.appendChild(victory);
  victory.appendChild(register(el('button', { id: 'btn-victory-lobby' })));
  victory.appendChild(register(el('button', { id: 'btn-victory-continue' })));

  const defeat = register(el('div', { id: 'modal-defeat', className: 'modal-overlay hidden' }));
  body.appendChild(defeat);
  defeat.appendChild(register(el('button', { id: 'btn-defeat-lobby' })));
  defeat.appendChild(register(el('button', { id: 'btn-defeat-retry' })));

  const listeners = {};
  const document = {
    body,
    documentElement: html,
    readyState: 'complete',
    createElement(tag) {
      const node = register(el(tag));
      return node;
    },
    createElementNS(_ns, tag) {
      return document.createElement(tag);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(sel) {
      return document.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll(sel) {
      const parts = String(sel).trim().split(/\s+/);
      if (parts[0].charAt(0) === '#') {
        const id = parts[0].slice(1).split('.')[0];
        const root = byId.get(id);
        if (!root) return [];
        if (parts.length === 1) return [root];
        return queryAll(root, parts.slice(1).join(' '));
      }
      return queryAll(html, sel).filter((n) => n !== html);
    },
    addEventListener(type, fn) {
      (listeners[type] = listeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] || []).filter((x) => x !== fn);
    },
    dispatchEvent(evt) {
      (listeners[evt.type] || []).forEach((fn) => fn(evt));
    }
  };

  document._listeners = listeners;
  document._byId = byId;
  document._all = all;
  document.pointerLockElement = null;
  document.mozPointerLockElement = null;
  document.exitPointerLock = function () {
    document.pointerLockElement = null;
    document.dispatchEvent({ type: 'pointerlockchange' });
  };
  document.elementFromPoint = function () { return null; };
  all.forEach((node) => { node.ownerDocument = document; });
  return document;
}

function createSandbox() {
  const document = buildDocument();
  const windowListeners = {};

  const sandbox = {
    console,
    document,
    navigator: { userAgent: 'NodeTest' },
    location: { href: 'http://127.0.0.1:8000/index.html', protocol: 'http:' },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    scrollTo() {},
    MouseEvent: function MouseEvent(type, init) {
      this.type = type;
      Object.assign(this, init || {});
    },
    performance: { now: () => Date.now() },
    requestAnimationFrame(cb) {
      sandbox.__rafCount = (sandbox.__rafCount || 0) + 1;
      if (sandbox.__rafCount > 8) return 0;
      return setTimeout(() => cb(Date.now()), 0);
    },
    cancelAnimationFrame(id) {
      clearTimeout(id);
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Date,
    Math,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    Uint8Array,
    Uint8ClampedArray,
    Float32Array,
    Int32Array,
    Map,
    Set,
    Error,
    TypeError,
    Image: function Image() {
      this.width = 0;
      this.height = 0;
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    addEventListener(type, fn) {
      (windowListeners[type] = windowListeners[type] || []).push(fn);
    },
    removeEventListener(type, fn) {
      windowListeners[type] = (windowListeners[type] || []).filter((x) => x !== fn);
    },
    dispatchEvent(evt) {
      (windowListeners[evt.type] || []).forEach((fn) => fn(evt));
      if (evt.type === 'DOMContentLoaded') document.dispatchEvent(evt);
    }
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  document.defaultView = sandbox;

  return sandbox;
}

function loadScript(sandbox, relPath) {
  if (!vm.isContext(sandbox)) {
    vm.createContext(sandbox);
  }
  const abs = path.join(ROOT, relPath);
  const code = fs.readFileSync(abs, 'utf8');
  const names = [];
  const re = /^(?:class|const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm;
  let match;
  while ((match = re.exec(code))) {
    names.push(match[1]);
  }
  const suffix = names.length
    ? '\n;' + names.map((n) => 'this.' + n + ' = ' + n + ';').join('\n')
    : '';
  vm.runInContext(code + suffix, sandbox, { filename: abs });
}

function loadGameScripts(sandbox, { includeMain = false } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [];
  const re = /<script\s+src="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    scripts.push(match[1]);
  }
  if (scripts.length === 0) {
    throw new Error('index.html has no <script src> tags');
  }
  scripts.forEach((src) => {
    if (!includeMain && src.indexOf('main.js') !== -1) return;
    loadScript(sandbox, src);
  });
  return scripts;
}

function fireDOMContentLoaded(sandbox) {
  sandbox.dispatchEvent({ type: 'DOMContentLoaded' });
}

module.exports = {
  ROOT,
  createSandbox,
  loadScript,
  loadGameScripts,
  fireDOMContentLoaded,
  FakeElement
};
