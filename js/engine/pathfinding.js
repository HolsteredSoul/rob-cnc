// ==========================================================================
// Command & Conquer RTS - A* Pathfinding & Unit Movement Smoothing
// ==========================================================================

class Pathfinding {
  constructor(terrain) {
    this.terrain = terrain;
    this.gridWidth = terrain.width;
    this.gridHeight = terrain.height;
    this.tileSize = terrain.tileSize;
  }

  // Find shortest path from start world position to target world position
  findPath(startX, startZ, endX, endZ) {
    const start = this.terrain.worldToGrid(startX, startZ);
    const goal = this.terrain.worldToGrid(endX, endZ);

    // If goal is out of bounds or completely blocked, find closest neighbor
    let targetGx = goal.gx;
    let targetGz = goal.gz;
    if (this.terrain.grid[targetGz * this.gridWidth + targetGx] !== 0) {
      const alt = this.findNearestWalkableTile(targetGx, targetGz);
      if (!alt) return [];
      targetGx = alt.gx;
      targetGz = alt.gz;
    }

    if (start.gx === targetGx && start.gz === targetGz) {
      return [{ x: endX, z: endZ }];
    }

    // A* Data structures
    const openSet = [];
    const openSetHash = new Set();
    const closedSet = new Uint8Array(this.gridWidth * this.gridHeight);
    
    const gScore = new Float32Array(this.gridWidth * this.gridHeight).fill(Infinity);
    const fScore = new Float32Array(this.gridWidth * this.gridHeight).fill(Infinity);
    const cameFrom = new Int32Array(this.gridWidth * this.gridHeight).fill(-1);

    const startIdx = start.gz * this.gridWidth + start.gx;
    const goalIdx = targetGz * this.gridWidth + targetGx;

    gScore[startIdx] = 0;
    fScore[startIdx] = this.heuristic(start.gx, start.gz, targetGx, targetGz);

    openSet.push({ idx: startIdx, f: fScore[startIdx] });
    openSetHash.add(startIdx);

    const neighbors = [
      { dx: 1, dz: 0, cost: 1.0 },
      { dx: -1, dz: 0, cost: 1.0 },
      { dx: 0, dz: 1, cost: 1.0 },
      { dx: 0, dz: -1, cost: 1.0 },
      { dx: 1, dz: 1, cost: 1.414 },
      { dx: -1, dz: 1, cost: 1.414 },
      { dx: 1, dz: -1, cost: 1.414 },
      { dx: -1, dz: -1, cost: 1.414 }
    ];

    let iterations = 0;
    const maxIterations = 800; // Limit search execution time to guarantee 60fps

    while (openSet.length > 0 && iterations < maxIterations) {
      iterations++;

      // Find node with lowest fScore
      let bestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[bestIndex].f) {
          bestIndex = i;
        }
      }

      const current = openSet.splice(bestIndex, 1)[0];
      const curIdx = current.idx;
      openSetHash.delete(curIdx);

      if (curIdx === goalIdx) {
        // Goal reached! Reconstruct path
        return this.reconstructPath(cameFrom, curIdx, endX, endZ);
      }

      closedSet[curIdx] = 1;

      const cx = curIdx % this.gridWidth;
      const cz = Math.floor(curIdx / this.gridWidth);

      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        const nx = cx + n.dx;
        const nz = cz + n.dz;

        if (nx < 0 || nx >= this.gridWidth || nz < 0 || nz >= this.gridHeight) continue;
        const nIdx = nz * this.gridWidth + nx;

        if (closedSet[nIdx] === 1) continue;
        if (this.terrain.grid[nIdx] !== 0) continue; // Blocked obstacle

        // Prevent cutting corners through diagonal blocked tiles
        if (n.dx !== 0 && n.dz !== 0) {
          const adj1 = cz * this.gridWidth + nx;
          const adj2 = nz * this.gridWidth + cx;
          if (this.terrain.grid[adj1] !== 0 || this.terrain.grid[adj2] !== 0) continue;
        }

        const tentativeG = gScore[curIdx] + n.cost;

        if (tentativeG < gScore[nIdx]) {
          cameFrom[nIdx] = curIdx;
          gScore[nIdx] = tentativeG;
          const h = this.heuristic(nx, nz, targetGx, targetGz);
          fScore[nIdx] = tentativeG + h;

          if (!openSetHash.has(nIdx)) {
            openSet.push({ idx: nIdx, f: fScore[nIdx] });
            openSetHash.add(nIdx);
          }
        }
      }
    }

    // Fallback: direct line if search exceeded iterations
    return [{ x: endX, z: endZ }];
  }

  heuristic(x1, z1, x2, z2) {
    const dx = Math.abs(x1 - x2);
    const dz = Math.abs(z1 - z2);
    // Octile distance
    return (dx + dz) + (1.414 - 2) * Math.min(dx, dz);
  }

  reconstructPath(cameFrom, currentIdx, finalX, finalZ) {
    const waypoints = [];
    let curr = currentIdx;

    while (curr !== -1) {
      const gx = curr % this.gridWidth;
      const gz = Math.floor(curr / this.gridWidth);
      const world = this.terrain.gridToWorld(gx, gz);
      waypoints.push({ x: world.x, z: world.z });
      curr = cameFrom[curr];
    }

    waypoints.reverse();

    // Replace final grid point with exact clicked world point
    if (waypoints.length > 0) {
      waypoints[waypoints.length - 1] = { x: finalX, z: finalZ };
    }

    // Path smoothing: remove unnecessary intermediate waypoints if direct line of sight exists
    return this.smoothPath(waypoints);
  }

  smoothPath(path) {
    if (path.length <= 2) return path;

    const smoothed = [path[0]];
    let current = 0;

    while (current < path.length - 1) {
      let farthest = current + 1;
      for (let next = path.length - 1; next > current + 1; next--) {
        if (this.isLineWalkable(path[current].x, path[current].z, path[next].x, path[next].z)) {
          farthest = next;
          break;
        }
      }
      smoothed.push(path[farthest]);
      current = farthest;
    }

    return smoothed;
  }

  // Raycast straight line between two world points to check if unobstructed
  isLineWalkable(x0, z0, x1, z1) {
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const steps = Math.ceil(dist / (this.tileSize * 0.5));
    if (steps <= 1) return true;

    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const wx = x0 + (x1 - x0) * t;
      const wz = z0 + (z1 - z0) * t;
      if (this.terrain.isBlocked(wx, wz)) {
        return false;
      }
    }
    return true;
  }

  findNearestWalkableTile(gx, gz) {
    for (let r = 1; r <= 5; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = gx + dx;
          const nz = gz + dz;
          if (nx >= 0 && nx < this.gridWidth && nz >= 0 && nz < this.gridHeight) {
            if (this.terrain.grid[nz * this.gridWidth + nx] === 0) {
              return { gx: nx, gz: nz };
            }
          }
        }
      }
    }
    return null;
  }
}
