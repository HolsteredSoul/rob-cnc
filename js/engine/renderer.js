// ==========================================================================
// Command & Conquer RTS - 3D Three.js Renderer & RTS Camera
// ==========================================================================

class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas && typeof document !== 'undefined') {
      this.canvas = document.createElement('canvas');
      this.canvas.id = canvasId || 'three-canvas';
    }
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // Camera target & navigation
    this.targetPos = new THREE.Vector3(50, 0, 50); // Center of starting area
    this.currentPos = new THREE.Vector3(50, 48, 86); // Angled C&C perspective
    this.camOffset = new THREE.Vector3(0, 48, 36);  // ~53 degree isometric tilt
    this.zoomLevel = 1.0;
    this.minZoom = 0.55;
    this.maxZoom = 1.8;
    
    // Pan speeds
    this.keyPanSpeed = 45;
    this.edgePanSpeed = 40;
    this.keysDown = {};
    this.mousePos = { x: 0, y: 0 };
    this.isMiddleDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.pointerInside = false;
    this.pointerLocked = false;
    this.lockEnabled = false;
    this.virtualCursor = { x: 400, y: 300 };
    this.lockRoot = null;
    this.cursorEl = null;
    this.lockHintEl = null;
    
    // Map bounds (clamping)
    this.mapBounds = { minX: 10, maxX: 190, minZ: 10, maxZ: 190 };
    
    this.init();
  }

  init() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1317);
    this.scene.fog = new THREE.FogExp2(0x0e1317, 0.0035);

    // 2. Camera: Angled RTS perspective
    const size = this.getViewportSize();
    const aspect = size.width / Math.max(1, size.height);
    this.camera = new THREE.PerspectiveCamera(42, aspect, 1, 600);
    this.updateCameraPosition();

    // 3. WebGL Renderer
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: true
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(size.width, size.height, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (err) {
      console.warn('[CNC RTS]: WebGL unavailable, using fallback renderer', err);
      this.renderer = this.createFallbackRenderer();
      this.renderer.setSize(size.width, size.height);
    }

    // 4. Lighting
    this.setupLighting();

    // 5. Event Listeners
    this.lockRoot = document.getElementById('game-container') || this.canvas;
    this.cursorEl = document.getElementById('game-cursor');
    this.lockHintEl = document.getElementById('pointer-lock-hint');

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => {
      this.keysDown[e.key.toLowerCase()] = true;
      if (this.lockEnabled && this.isScrollKey(e)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keysDown[e.key.toLowerCase()] = false);

    window.addEventListener('mousemove', (e) => this.applyMouseMove(e));
    this.canvas.addEventListener('mouseenter', () => {
      if (!this.pointerLocked) this.pointerInside = true;
    });
    this.canvas.addEventListener('mouseleave', () => {
      if (!this.pointerLocked) this.pointerInside = false;
    });
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget && !this.pointerLocked) this.pointerInside = false;
    });
    window.addEventListener('blur', () => {
      if (!this.pointerLocked) this.pointerInside = false;
    });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('mozpointerlockchange', () => this.onPointerLockChange());

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        this.isMiddleDragging = true;
        const pt = this.getPointerClient(e);
        this.lastMousePos = { x: pt.x, y: pt.y };
        e.preventDefault();
      }
      if (this.lockEnabled && !this.pointerLocked && e.button === 0) {
        this.requestPlayLock();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 1) this.isMiddleDragging = false;
    });

    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.lockEnabled || this.pointerInside || this.pointerLocked) {
        const zoomDelta = e.deltaY * 0.0012;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + zoomDelta));
      }
    }, { passive: false });

    window.addEventListener('scroll', () => {
      if (window.scrollTo) window.scrollTo(0, 0);
    });
  }

  isScrollKey(e) {
    const key = (e.key || '').toLowerCase();
    return key === 'arrowup' || key === 'arrowdown' || key === 'arrowleft' || key === 'arrowright'
      || key === ' ' || key === 'pageup' || key === 'pagedown' || key === 'home' || key === 'end';
  }

  applyMouseMove(e) {
    if (this.pointerLocked) {
      const bounds = this.getLockBounds();
      this.virtualCursor.x = Math.max(bounds.left + 1, Math.min(bounds.right - 1, this.virtualCursor.x + (e.movementX || 0)));
      this.virtualCursor.y = Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, this.virtualCursor.y + (e.movementY || 0)));
      this.pointerInside = true;
    } else {
      this.virtualCursor.x = e.clientX;
      this.virtualCursor.y = e.clientY;
      const root = this.lockRoot;
      if (root && root.getBoundingClientRect) {
        const r = root.getBoundingClientRect();
        this.pointerInside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      } else {
        this.pointerInside = true;
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = this.virtualCursor.x - rect.left;
    this.mousePos.y = this.virtualCursor.y - rect.top;
    if (rect.width > 0 && rect.height > 0) {
      this.mouse.x = (this.mousePos.x / rect.width) * 2 - 1;
      this.mouse.y = -(this.mousePos.y / rect.height) * 2 + 1;
    }

    if (this.isMiddleDragging) {
      const dx = this.virtualCursor.x - this.lastMousePos.x;
      const dy = this.virtualCursor.y - this.lastMousePos.y;
      this.targetPos.x -= dx * 0.12 * this.zoomLevel;
      this.targetPos.z -= dy * 0.12 * this.zoomLevel;
      this.clampTargetPos();
      this.lastMousePos = { x: this.virtualCursor.x, y: this.virtualCursor.y };
    }

    this.syncCursorHud();
  }

  getLockBounds() {
    const root = this.lockRoot;
    if (root && root.getBoundingClientRect) {
      const r = root.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }
    return { left: 0, top: 0, right: window.innerWidth || 1280, bottom: window.innerHeight || 720 };
  }

  getPointerClient(e) {
    if (this.pointerLocked) return { x: this.virtualCursor.x, y: this.virtualCursor.y };
    if (e) return { x: e.clientX, y: e.clientY };
    return { x: this.virtualCursor.x, y: this.virtualCursor.y };
  }

  onPointerLockChange() {
    const el = document.pointerLockElement || document.mozPointerLockElement;
    this.pointerLocked = !!(el && (el === this.lockRoot || el === this.canvas));
    if (this.pointerLocked) this.pointerInside = true;
    const root = this.lockRoot || document.body;
    if (root && root.classList) {
      if (this.pointerLocked) root.classList.add('pointer-locked');
      else root.classList.remove('pointer-locked');
    }
    if (document.documentElement && document.documentElement.classList) {
      document.documentElement.classList.toggle('pointer-locked', this.pointerLocked);
    }
    this.syncCursorHud();
  }

  requestPlayLock() {
    if (!this.lockEnabled) return;
    const el = this.lockRoot || this.canvas;
    if (!el) return;
    const fn = el.requestPointerLock || el.mozRequestPointerLock || el.webkitRequestPointerLock;
    if (!fn) return;
    try {
      const ret = fn.call(el);
      if (ret && typeof ret.catch === 'function') ret.catch(() => {});
    } catch (err) {
      // Gesture required or API unavailable — hint stays visible
    }
  }

  exitPlayLock() {
    const fn = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;
    if (fn) {
      try { fn.call(document); } catch (err) { /* ignore */ }
    }
    this.pointerLocked = false;
    this.syncCursorHud();
  }

  setPlayCapture(on) {
    this.lockEnabled = !!on;
    if (on) this.requestPlayLock();
    else this.exitPlayLock();
    this.syncCursorHud();
  }

  syncCursorHud() {
    if (this.cursorEl) {
      if (this.pointerLocked) {
        this.cursorEl.classList.remove('hidden');
        this.cursorEl.style.left = `${this.virtualCursor.x}px`;
        this.cursorEl.style.top = `${this.virtualCursor.y}px`;
      } else {
        this.cursorEl.classList.add('hidden');
      }
    }
    if (this.lockHintEl) {
      if (!this.lockEnabled) {
        this.lockHintEl.classList.add('hidden');
      } else {
        this.lockHintEl.classList.remove('hidden');
        this.lockHintEl.textContent = this.pointerLocked
          ? 'MOUSE LOCKED · Esc releases'
          : 'Click battlefield to lock mouse in the window';
      }
    }
  }

  getEdgePan() {
    if (!this.pointerInside && !this.pointerLocked) return { x: 0, z: 0 };

    const edgeThreshold = 24;
    const bounds = this.getLockBounds();
    const x = this.virtualCursor.x;
    const y = this.virtualCursor.y;
    let moveX = 0;
    let moveZ = 0;

    if (x <= bounds.left + edgeThreshold) moveX -= 0.9;
    if (x >= bounds.right - edgeThreshold) moveX += 0.9;
    if (y <= bounds.top + edgeThreshold) moveZ -= 0.9;
    if (y >= bounds.bottom - edgeThreshold) moveZ += 0.9;

    return { x: moveX, z: moveZ };
  }

  setupLighting() {
    // Ambient light: cool military blue tone
    const ambient = new THREE.AmbientLight(0x8cb0c8, 0.75);
    this.scene.add(ambient);

    // Main Sun Directional Light with Shadows
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    this.sunLight.position.set(80, 120, 60);
    this.sunLight.castShadow = true;
    
    // High-resolution shadow frustum covering RTS battlefield area
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const d = 110;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    
    this.scene.add(this.sunLight);

    // Tactical ground rim light
    const rimLight = new THREE.DirectionalLight(0x336688, 0.4);
    rimLight.position.set(-60, 40, -60);
    this.scene.add(rimLight);
  }

  update(delta) {
    let moveX = 0;
    let moveZ = 0;

    // Keyboard Pan: WASD (S is unit-stop) or Arrow Keys
    if (this.keysDown['w'] || this.keysDown['arrowup']) moveZ -= 1;
    if (this.keysDown['arrowdown']) moveZ += 1;
    if (this.keysDown['a'] || this.keysDown['arrowleft']) moveX -= 1;
    if (this.keysDown['d'] || this.keysDown['arrowright']) moveX += 1;

    const edge = this.getEdgePan();
    moveX += edge.x;
    moveZ += edge.z;

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      const speed = this.keyPanSpeed * this.zoomLevel * delta;
      this.targetPos.x += (moveX / len) * speed;
      this.targetPos.z += (moveZ / len) * speed;
      this.clampTargetPos();
    }

    this.updateCameraPosition();
  }

  updateCameraPosition() {
    const currentOffset = this.camOffset.clone().multiplyScalar(this.zoomLevel);
    this.camera.position.copy(this.targetPos).add(currentOffset);
    this.camera.lookAt(this.targetPos.x, 0, this.targetPos.z);
    
    // Keep sun shadow camera centered on the active viewport
    if (this.sunLight) {
      this.sunLight.position.set(this.targetPos.x + 80, 120, this.targetPos.z + 60);
      this.sunLight.target.position.set(this.targetPos.x, 0, this.targetPos.z);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  clampTargetPos() {
    this.targetPos.x = Math.max(this.mapBounds.minX, Math.min(this.mapBounds.maxX, this.targetPos.x));
    this.targetPos.z = Math.max(this.mapBounds.minZ, Math.min(this.mapBounds.maxZ, this.targetPos.z));
  }

  panTo(worldX, worldZ) {
    this.targetPos.x = worldX;
    this.targetPos.z = worldZ;
    this.clampTargetPos();
    this.updateCameraPosition();
  }

  // Convert screen coordinates to world ground position (Y=0)
  getGroundIntersection(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera({ x, y }, this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return hit ? target : null;
  }

  // Convert 3D world position to 2D screen coordinate
  worldToScreen(worldPos) {
    const p = worldPos.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((p.x + 1) / 2) * rect.width + rect.left,
      y: ((-p.y + 1) / 2) * rect.height + rect.top,
      visible: p.z < 1
    };
  }

  getViewportSize() {
    const parent = this.canvas && this.canvas.parentElement;
    let width = this.canvas ? this.canvas.clientWidth : 0;
    let height = this.canvas ? this.canvas.clientHeight : 0;
    if (!width && parent) width = parent.clientWidth;
    if (!height && parent) height = parent.clientHeight;
    if (!width && typeof window !== 'undefined') {
      width = Math.max(64, (window.innerWidth || 1024) - 280);
    }
    if (!height && typeof window !== 'undefined') {
      height = Math.max(64, window.innerHeight || 720);
    }
    return {
      width: Math.max(64, width || 800),
      height: Math.max(64, height || 600)
    };
  }

  createFallbackRenderer() {
    const self = this;
    return {
      shadowMap: { enabled: false, type: 0 },
      setSize(w, h) {
        if (self.canvas) {
          self.canvas.width = w;
          self.canvas.height = h;
        }
      },
      setPixelRatio() {},
      render() {},
      getContext() {
        return {
          drawingBufferWidth: self.canvas ? self.canvas.width : 0,
          drawingBufferHeight: self.canvas ? self.canvas.height : 0
        };
      }
    };
  }

  onResize() {
    if (!this.canvas || !this.camera || !this.renderer) return;
    const { width, height } = this.getViewportSize();
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    if (this.canvas && this.canvas.clientWidth > 64) {
      const gl = this.renderer.getContext && this.renderer.getContext();
      if (gl && gl.drawingBufferWidth <= 300 && this.canvas.clientWidth > 300) {
        this.onResize();
      }
    }
    this.renderer.render(this.scene, this.camera);
  }
}
