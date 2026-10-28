// Circle-vs-box (with Y rotation) and circle-vs-circle collision for the walker.
//
// Collider contract (see src/lib.js):
//   box    { type:'box', x, z, hw, hd, y0, y1, ry }
//   circle { type:'circle', x, z, r, y0, y1 }
// All colliders are centred in XZ; y0/y1 are the vertical span that blocks.

/**
 * Pre-compute cos/sin and a conservative bounding radius so the per-frame test
 * is only a few arithmetic ops. Call once after the builders have merged
 * ctx.colliders.
 */
export function prepareColliders(colliders) {
  const out = [];
  if (!Array.isArray(colliders)) return out;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c || typeof c !== 'object') continue;
    const x = Number(c.x);
    const z = Number(c.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const y0 = Number.isFinite(Number(c.y0)) ? Number(c.y0) : -1000;
    const y1 = Number.isFinite(Number(c.y1)) ? Number(c.y1) : 1000;
    if (c.type === 'box') {
      const hw = Math.max(0.04, Number(c.hw) || 0);
      const hd = Math.max(0.04, Number(c.hd) || 0);
      const ry = Number(c.ry) || 0;
      out.push({
        kind: 0,
        x,
        z,
        y0,
        y1,
        hw,
        hd,
        cos: Math.cos(ry),
        sin: Math.sin(ry),
        br: Math.hypot(hw, hd),
      });
    } else if (c.type === 'circle') {
      const r = Math.max(0.04, Number(c.r) || 0);
      out.push({ kind: 1, x, z, y0, y1, r, br: r });
    }
  }
  return out;
}

/**
 * Does a collider block a body whose feet are at `feetY`, 1.7 m tall?
 * Anything lower than a boot sole (steps, thresholds, paving trims) is walked
 * over rather than collided with.
 */
const STEP_HEIGHT = 0.34;
function blocksAt(c, feetY, playerHeight) {
  return c.y0 < feetY + playerHeight * 0.92 && c.y1 > feetY + STEP_HEIGHT;
}

/**
 * Push a point circle out of every collider it overlaps. Mutates `p.x` and
 * `p.z`. Does three relaxation passes so corners between two walls resolve.
 * Returns true when the point was moved.
 */
export function resolveCollisions(p, radius, prepared, feetY, playerHeight = 1.7) {
  if (!prepared || prepared.length === 0) return false;
  let moved = false;
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (let i = 0; i < prepared.length; i++) {
      const c = prepared[i];
      if (!blocksAt(c, feetY, playerHeight)) continue;
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const reach = c.br + radius;
      if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;

      if (c.kind === 1) {
        const d = Math.hypot(dx, dz);
        const min = c.r + radius;
        if (d < min) {
          if (d < 1e-5) {
            p.x += min + 0.001;
          } else {
            const k = (min - d) / d;
            p.x += dx * k;
            p.z += dz * k;
          }
          any = true;
        }
        continue;
      }

      // Local box space (rotate the world delta by -ry).
      const lx = dx * c.cos - dz * c.sin;
      const lz = dx * c.sin + dz * c.cos;
      const qx = lx < -c.hw ? -c.hw : lx > c.hw ? c.hw : lx;
      const qz = lz < -c.hd ? -c.hd : lz > c.hd ? c.hd : lz;
      const ox = lx - qx;
      const oz = lz - qz;
      const d = Math.hypot(ox, oz);
      if (d >= radius) continue;

      let pushLx;
      let pushLz;
      if (d > 1e-6) {
        const k = (radius - d) / d;
        pushLx = ox * k;
        pushLz = oz * k;
      } else {
        // Centre is inside the box: escape along the shallowest face.
        const px = c.hw - Math.abs(lx);
        const pz = c.hd - Math.abs(lz);
        if (px < pz) {
          pushLx = (lx >= 0 ? 1 : -1) * (px + radius);
          pushLz = 0;
        } else {
          pushLx = 0;
          pushLz = (lz >= 0 ? 1 : -1) * (pz + radius);
        }
      }
      // Local push back to world (forward Y rotation).
      p.x += pushLx * c.cos + pushLz * c.sin;
      p.z += -pushLx * c.sin + pushLz * c.cos;
      any = true;
    }
    if (!any) break;
    moved = true;
  }
  return moved;
}

/** Clamp a point to a radial distance from the world origin. */
export function clampToRadius(p, maxRadius) {
  const d = Math.hypot(p.x, p.z);
  if (d > maxRadius && d > 1e-5) {
    const k = maxRadius / d;
    p.x *= k;
    p.z *= k;
  }
}

/**
 * Is this XZ point (with the given clearance) clear of every collider that
 * blocks at this height? Used by the tour to keep authored stops out of walls.
 */
export function isClear(x, z, clearance, prepared, feetY = 0, playerHeight = 1.7) {
  if (!prepared || prepared.length === 0) return true;
  for (let i = 0; i < prepared.length; i++) {
    const c = prepared[i];
    if (!blocksAt(c, feetY, playerHeight)) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const reach = c.br + clearance;
    if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
    if (c.kind === 1) {
      if (Math.hypot(dx, dz) < c.r + clearance) return false;
      continue;
    }
    const lx = dx * c.cos - dz * c.sin;
    const lz = dx * c.sin + dz * c.cos;
    const qx = lx < -c.hw ? -c.hw : lx > c.hw ? c.hw : lx;
    const qz = lz < -c.hd ? -c.hd : lz > c.hd ? c.hd : lz;
    if (Math.hypot(lx - qx, lz - qz) < clearance) return false;
  }
  return true;
}
