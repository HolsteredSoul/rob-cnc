// ==========================================================================
// Command & Conquer RTS: Operation Vanguard - Main Entry Point & Game Loop
// ==========================================================================

window.addEventListener('DOMContentLoaded', () => {
  console.log('[CNC RTS]: Initializing Operation Vanguard...');

  // 1. Core 3D Renderer & Scene
  const renderer = new GameRenderer('three-canvas');

  // 2. Terrain & Environment
  const terrain = new Terrain(renderer.scene, 100, 100, 2, 'temperate');

  // 3. Dynamic Fog of War & Shroud
  const fogOfWar = new FogOfWar(renderer.scene, 100, 100, 2);

  // 4. A* Pathfinding
  const pathfinding = new Pathfinding(terrain);

  // 5. Projectiles, Ballistics & Particle FX
  const projectileManager = new ProjectileManager(renderer.scene);

  // 6. Entity Lifecycle Manager
  const entityManager = new EntityManager(renderer.scene, terrain);

  // 7. Credits & Electrical Power Grid
  const economy = new Economy();

  // 8. Skirmish AI Opponent
  const skirmishAI = new SkirmishAI('easy');

  // Game Context Object for inter-system communication
  const gameContext = {
    renderer,
    terrain,
    fogOfWar,
    pathfinding,
    projectileManager,
    entityManager,
    economy,
    skirmishAI,
    soundFX: window.soundFX,
    // Track whether a mission is currently running
    missionActive: false,
    paused: false,
    simulationSpeed: 1,
    portraitBlocked: false,
    discardNextFrame: false,
    // Selected team color from lobby ('blue' or 'red')
    playerTeam: 'blue'
  };

  gameContext.pause = () => {
    if (!gameContext.missionActive || gameContext.paused) return;
    gameContext.paused = true;
    gameContext.discardNextFrame = true;
    renderer.exitPlayLock();
    renderer.keysDown = {};
    if (gameContext.inputManager) {
      gameContext.inputManager.cancelTouchGesture();
      gameContext.inputManager.setCommandMode('normal');
    }
    if (gameContext.minimap) gameContext.minimap.isDragging = false;
    if (gameContext.hud) gameContext.hud.updateSessionControls();
  };
  gameContext.resume = () => {
    if (!gameContext.missionActive || document.hidden || gameContext.portraitBlocked) return;
    gameContext.paused = false;
    gameContext.discardNextFrame = true;
    if (gameContext.hud) gameContext.hud.updateSessionControls();
  };
  gameContext.updateOrientation = () => {
    const compact = renderer.touchInput || window.innerWidth <= 900;
    document.documentElement.classList.toggle('touch-layout', compact);
    gameContext.portraitBlocked = compact && window.innerHeight > window.innerWidth;
    const prompt = document.getElementById('rotate-prompt');
    if (prompt) prompt.hidden = !(gameContext.missionActive && gameContext.portraitBlocked);
    if (gameContext.portraitBlocked) gameContext.pause();
    renderer.onResize();
  };
  gameContext.resetSession = () => {
    gameContext.paused = false;
    gameContext.simulationSpeed = 1;
    gameContext.discardNextFrame = true;
    if (gameContext.inputManager) {
      gameContext.inputManager.cancelTouchGesture();
      gameContext.inputManager.setCommandMode('normal');
    }
    if (gameContext.hud) {
      gameContext.hud.closeTouchPanels();
      gameContext.hud.cancelSell();
    }
  };
  window.addEventListener('resize', gameContext.updateOrientation);
  document.addEventListener('visibilitychange', () => { if (document.hidden) gameContext.pause(); });
  window.addEventListener('pagehide', gameContext.pause);
  window.addEventListener('blur', gameContext.pause);

  // 9. Mission & Campaign Level Manager
  const missionManager = new MissionManager(gameContext);
  gameContext.missionManager = missionManager;

  // 10. Mouse & Keyboard RTS Input
  const inputManager = new InputManager(gameContext);
  gameContext.inputManager = inputManager;

  // 11. Tactical Radar Minimap
  const minimap = new Minimap('minimap-canvas', gameContext);
  gameContext.minimap = minimap;

  // 12. Classic C&C Sidebar HUD
  const hud = new HUD(gameContext);
  gameContext.hud = hud;
  window.hud = hud;
  window.gameContext = gameContext;
  gameContext.updateOrientation();

  // -----------------------------------------------------------------------
  // LOBBY SCREEN LOGIC
  // -----------------------------------------------------------------------

  const lobbyEl      = document.getElementById('modal-lobby');
  const deployBtn    = document.getElementById('btn-deploy-forces');

  // Team card selection
  document.querySelectorAll('.team-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      gameContext.playerTeam = card.dataset.team; // 'blue' or 'red'
      if (gameContext.soundFX) gameContext.soundFX.playClick();
    });
  });

  // Mission & difficulty selection in lobby
  document.querySelectorAll('#modal-lobby .mission-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#modal-lobby .mission-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      if (gameContext.soundFX) gameContext.soundFX.playClick();
    });
  });

  document.querySelectorAll('#modal-lobby .diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modal-lobby .diff-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      if (gameContext.soundFX) gameContext.soundFX.playClick();
    });
  });

  // DEPLOY FORCES button
  deployBtn.addEventListener('click', () => {
    try {
      const missionCard = document.querySelector('#modal-lobby .mission-card.selected');
      const diffBtn     = document.querySelector('#modal-lobby .diff-btn.selected');
      const missionIdx  = missionCard ? parseInt(missionCard.dataset.mission) : 0;
      const difficulty  = diffBtn     ? diffBtn.dataset.diff                  : 'medium';

      // Set model team colors based on selected team
      UnitModels.playerTeam = gameContext.playerTeam || 'blue';
      BuildingModels.playerTeam = gameContext.playerTeam || 'blue';

      // Update team badge on HUD
      const teamBadge = document.getElementById('team-badge');
      const teamBadgeVal = document.getElementById('team-badge-val');
      if (teamBadge && teamBadgeVal) {
        teamBadgeVal.textContent = gameContext.playerTeam.toUpperCase();
        teamBadgeVal.style.color = gameContext.playerTeam === 'blue' ? '#00b0ff' : '#ff3333';
        teamBadge.style.display = 'flex';
      }

      // Close lobby immediately
      lobbyEl.classList.add('hidden');
      lobbyEl.style.display = 'none';

      // Load mission and start game simulation
      missionManager.loadMission(missionIdx, difficulty);
      hud.refreshBuildCards();
      gameContext.missionActive = true;
      gameContext.updateOrientation();
      renderer.onResize();
      renderer.setPlayCapture(true);

      if (gameContext.soundFX) {
        gameContext.soundFX.speak('Battlefield control established');
      }

      console.log(`[CNC RTS]: Deployed as ${gameContext.playerTeam.toUpperCase()} team on mission ${missionIdx} (${difficulty})`);
    } catch (err) {
      console.error('[CNC RTS]: Error deploying forces:', err);
      // Ensure modal is hidden even if non-fatal error occurs
      lobbyEl.classList.add('hidden');
      lobbyEl.style.display = 'none';
      gameContext.missionActive = true;
      gameContext.updateOrientation();
      renderer.setPlayCapture(true);
    }
  });

  // Back to lobby from in-game menu
  const backToLobbyBtn = document.getElementById('btn-back-to-lobby');
  if (backToLobbyBtn) {
    backToLobbyBtn.addEventListener('click', () => {
      const menuModal = document.getElementById('modal-mission-select');
      if (menuModal) {
        menuModal.classList.add('hidden');
        menuModal.style.display = 'none';
      }
      lobbyEl.classList.remove('hidden');
      lobbyEl.style.display = 'flex';
      gameContext.missionActive = false;
      gameContext.updateOrientation();
      renderer.setPlayCapture(false);
    });
  }

  // Return to lobby from victory/defeat
  const victoryLobbyBtn = document.getElementById('btn-victory-lobby');
  if (victoryLobbyBtn) {
    victoryLobbyBtn.addEventListener('click', () => {
      const victoryModal = document.getElementById('modal-victory');
      if (victoryModal) {
        victoryModal.classList.add('hidden');
        victoryModal.style.display = 'none';
      }
      lobbyEl.classList.remove('hidden');
      lobbyEl.style.display = 'flex';
      gameContext.missionActive = false;
      gameContext.updateOrientation();
      renderer.setPlayCapture(false);
    });
  }

  const defeatLobbyBtn = document.getElementById('btn-defeat-lobby');
  if (defeatLobbyBtn) {
    defeatLobbyBtn.addEventListener('click', () => {
      const defeatModal = document.getElementById('modal-defeat');
      if (defeatModal) {
        defeatModal.classList.add('hidden');
        defeatModal.style.display = 'none';
      }
      lobbyEl.classList.remove('hidden');
      lobbyEl.style.display = 'flex';
      gameContext.missionActive = false;
      gameContext.updateOrientation();
      renderer.setPlayCapture(false);
    });
  }

  // -----------------------------------------------------------------------
  // MAIN GAME LOOP (60 FPS)
  // -----------------------------------------------------------------------
  let lastTime = performance.now();
  let minimapElapsed = 1;

  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    const rawDelta = (time - lastTime) / 1000;
    lastTime = time;
    // Clamp delta to prevent physics jumps during background tabs
    const frameDelta = gameContext.discardNextFrame ? 0 : Math.max(0, Math.min(rawDelta, 0.1));
    gameContext.discardNextFrame = false;
    const delta = frameDelta * gameContext.simulationSpeed;
    if (document.hidden) { gameContext.pause(); return; }
    // Orientation is also checked on mission changes, including retry/continue.
    if (gameContext.missionActive && gameContext.portraitBlocked) gameContext.pause();

    // Only run simulation when a mission is active
    if (!gameContext.missionActive) {
      renderer.render();
      return;
    }

    // 1. Camera Panning & Zoom
    renderer.update(frameDelta);
    if (renderer.canvas && renderer.canvas.clientWidth > 64) {
      const gl = renderer.renderer.getContext && renderer.renderer.getContext();
      if (gl && gl.drawingBufferWidth <= 300 && renderer.canvas.clientWidth > 300) {
        renderer.onResize();
      }
    }

    if (!gameContext.paused) {
      // 2. Ore Crystals Regrowth
      terrain.updateOreRegeneration(delta);

      // 3. Fog of War Line-of-Sight
      const hasPoweredRadar = typeof isPlayerRadarOperational === 'function'
        ? isPlayerRadarOperational(gameContext)
        : entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && b.isAlive && !b.isBuilding) && economy.isBasePowered('player');
      fogOfWar.update(
        entityManager.getPlayerUnits(),
        entityManager.getPlayerBuildings(),
        hasPoweredRadar
      );

      // 4. Units & Buildings Simulation
      entityManager.update(delta, gameContext);

      // 5. Projectiles & Explosions
      projectileManager.update(delta, entityManager);

      // 6. Economy & Power Grid Calculation
      economy.update(delta, entityManager, window.soundFX);

      // 7. Enemy AI Decisions & Assaults
      skirmishAI.update(delta, gameContext);

      // 8. Mission Objectives & Tutorial Checks
      missionManager.update(delta);
    }

    // 9. Minimap & Radar Display
    minimapElapsed += frameDelta;
    if (!renderer.mobileGraphics || minimapElapsed >= 0.15) {
      minimap.update();
      minimapElapsed = 0;
    }

    // 10. HUD Sidebar & Build Queues
    hud.update(frameDelta);

    // 11. World-space command markers (move pips / attack brackets)
    if (inputManager.update) inputManager.update(frameDelta);

    // 12. Render 3D Scene
    renderer.render();
  }

  requestAnimationFrame(gameLoop);
  console.log('[CNC RTS]: Systems operational. Awaiting Commander deployment order.');
});
