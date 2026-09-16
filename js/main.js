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
    // Selected team color from lobby ('blue' or 'red')
    playerTeam: 'blue'
  };

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
      renderer.setPlayCapture(false);
    });
  }

  // -----------------------------------------------------------------------
  // MAIN GAME LOOP (60 FPS)
  // -----------------------------------------------------------------------
  let lastTime = performance.now();

  function gameLoop(time) {
    requestAnimationFrame(gameLoop);

    const rawDelta = (time - lastTime) / 1000;
    lastTime = time;
    // Clamp delta to prevent physics jumps during background tabs
    const delta = Math.min(rawDelta, 0.1);

    // Only run simulation when a mission is active
    if (!gameContext.missionActive) {
      renderer.render();
      return;
    }

    // 1. Camera Panning & Zoom
    renderer.update(delta);
    if (renderer.canvas && renderer.canvas.clientWidth > 64) {
      const gl = renderer.renderer.getContext && renderer.renderer.getContext();
      if (gl && gl.drawingBufferWidth <= 300 && renderer.canvas.clientWidth > 300) {
        renderer.onResize();
      }
    }

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

    // 9. Minimap & Radar Display
    minimap.update();

    // 10. HUD Sidebar & Build Queues
    hud.update(delta);

    // 11. World-space command markers (move pips / attack brackets)
    if (inputManager.update) inputManager.update(delta);

    // 12. Render 3D Scene
    renderer.render();
  }

  requestAnimationFrame(gameLoop);
  console.log('[CNC RTS]: Systems operational. Awaiting Commander deployment order.');
});
