/* 60-city-blocks.js — the Paris urban fabric: Haussmann blocks, zinc mansard
   roofs, diagonal boulevards radiating from the tower, tree allées along the
   Champ de Mars and the river, and windows that warm up at night.
   TEAM MODULE (owner: city-blocks).

   Contract: buildCityBlocks(scene) adds content and may call registerEnv /
   registerUpdater. Everything repeated is an InstancedMesh: roughly 6.7k blocks,
   2.2k trees, 20k instances and 275k triangles in a handful of draw calls.

   Map conventions (see 10-utils.js): +Z Champ de Mars, -Z the Seine, tower at
   the origin, the grey city floor ring starts at radius WORLD.cityInner (760).
   The fabric therefore re-uses that shared floor outside the ring and lays its
   own thin pavement (a lower plane, so the mall and plaza stay on top) inside
   it, while leaving the Champ de Mars, the tower gardens, the Seine and every
   LANDMARK_SITES clearing empty. */
function buildCityBlocks(scene) {
  /* ------------------------------------------------------------------ */
  /*  deterministic randomness (the city must look the same every load)  */
  /* ------------------------------------------------------------------ */
  let rng = 0x5eed1a7e;
  function rnd() {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  }
  const rr = (a, b) => a + (b - a) * rnd();

  /* ------------------------------------------------------------------ */
  /*  map facts and the keep-out zones                                   */
  /* ------------------------------------------------------------------ */
  const BASE_Y = WORLD.ringY;      // city-floor height: all blocks sit on it
  const STOREY = 3.4;              // one Haussmann storey, in metres
  const FABRIC_R = 2600;           // fabric fades into the fog past this
  const TOWER_GARDEN = 235;        // nothing built this close to the tower
  const PAVE_Y = 0.22;             // our pavement, under plaza (0.25) / paths (0.3)
  const PAVE_HALF = 800;           // pavement half-size; tucks under the floor ring
  const GRID_HALF = 2760;          // the street grid covers the whole fabric
  const RIVER_Z0 = -478;           // Seine + quays keep-out band (far edge)
  const RIVER_Z1 = -184;           // Seine + quays keep-out band (near edge)
  const PARK = { x0: -96, x1: 96, z0: 88, z1: 760 }; // Champ de Mars

  const sites = [];
  for (const key in LANDMARK_SITES) {
    const s = LANDMARK_SITES[key];
    sites.push({ x: s.x, z: s.z, r: s.clearing });
  }

  /** True when a footprint (centre + half extents) must stay empty. */
  function blocked(cx, cz, hx, hz) {
    const rad = Math.hypot(cx, cz);
    if (rad > FABRIC_R || rad < TOWER_GARDEN) return true;
    // Champ de Mars + its tree allées
    if (cx + hx > PARK.x0 && cx - hx < PARK.x1 && cz + hz > PARK.z0 && cz - hz < PARK.z1) return true;
    // the Seine: water plus the two quays
    if (cz + hz > RIVER_Z0 && cz - hz < RIVER_Z1) return true;
    // reserved landmark clearings
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      const dx = Math.max(0, Math.abs(cx - s.x) - hx);
      const dz = Math.max(0, Math.abs(cz - s.z) - hz);
      if (dx * dx + dz * dz < s.r * s.r) return true;
    }
    return false;
  }

  /** True when a point is clear of every block footprint (plus a canopy margin). */
  function clearOfBlocks(x, z) {
    for (let i = 0; i < walls.length; i++) {
      const b = walls[i];
      const dx = x - b.x;
      const dz = z - b.z;
      const lx = dx * b.rc - dz * b.rs;
      const lz = dx * b.rs + dz * b.rc;
      if (Math.abs(lx) < b.sx * 0.5 + 4.6 && Math.abs(lz) < b.sz * 0.5 + 4.6) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------ */
  /*  the radiating boulevards                                           */
  /* ------------------------------------------------------------------ */
  const AVENUES = [];
  {
    const angles = [18, -18, 47, -47, 76, -76, 120, -120, 150, -150, 180];
    for (let i = 0; i < angles.length; i++) {
      const a = (angles[i] * Math.PI) / 180;
      AVENUES.push({
        a,
        dx: Math.sin(a),
        dz: Math.cos(a),
        w: angles[i] === 180 ? 42 : rr(22, 31),
      });
    }
  }

  /** True if a block would sit in a boulevard corridor. */
  function onAvenue(cx, cz, hx, hz) {
    for (let i = 0; i < AVENUES.length; i++) {
      const av = AVENUES[i];
      const reach = av.w * 0.5 + 40;                 // corridor includes the frontages
      const centre = Math.abs(av.dx * cz - av.dz * cx);
      if (centre > reach + Math.hypot(hx, hz)) continue;
      for (let k = 0; k < 4; k++) {
        const px = cx + ((k & 1) ? hx : -hx);
        const pz = cz + ((k & 2) ? hz : -hz);
        if (px * av.dx + pz * av.dz < 80) continue;
        if (Math.abs(av.dx * pz - av.dz * px) < reach) return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------ */
  /*  collecting the blocks, their roofs and the trees                   */
  /* ------------------------------------------------------------------ */
  const walls = [];
  const roofs = [];
  const trees = [];
  const tint = new THREE.Color();

  function limestone() {
    tint.setHSL(0.075 + rnd() * 0.042, 0.10 + rnd() * 0.15, 0.42 + rnd() * 0.20, THREE.SRGBColorSpace);
    return [tint.r, tint.g, tint.b];
  }

  function zinc(flat) {
    if (flat) tint.setHSL(0.57 + rnd() * 0.05, 0.03 + rnd() * 0.06, 0.39 + rnd() * 0.13, THREE.SRGBColorSpace);
    else tint.setHSL(0.55 + rnd() * 0.08, 0.03 + rnd() * 0.09, 0.33 + rnd() * 0.16, THREE.SRGBColorSpace);
    return [tint.r, tint.g, tint.b];
  }

  /** Add one Haussmann block: walls + a mansard-ish cap. */
  function addBuilding(x, z, sx, sz, height, rot) {
    const c = Math.abs(Math.cos(rot));
    const s = Math.abs(Math.sin(rot));
    const hx = c * sx * 0.5 + s * sz * 0.5;
    const hz = s * sx * 0.5 + c * sz * 0.5;
    if (blocked(x, z, hx, hz)) return false;

    walls.push({ x, z, sx, sy: height, sz, rot, rc: Math.cos(rot), rs: Math.sin(rot), col: limestone() });

    const flat = height > 29 || rnd() < 0.14;      // tall infill / terraces
    const rh = flat ? rr(0.6, 1.3) : rr(2.4, 4.4);
    const inset = flat ? 0.45 : rr(0.6, 1.5);
    roofs.push({
      x, z, rot,
      sx: Math.max(4, sx - inset * 2),
      sy: rh,
      sz: Math.max(4, sz - inset * 2),
      y: BASE_Y + height + rh * 0.5,
      col: zinc(flat),
    });
    return true;
  }

  /* ---- the orthogonal street grid (avenues parallel to the mall axis) ---- */
  const cols = [];
  {
    let x = -GRID_HALF;
    let n = 0;
    while (x < GRID_HALF) {
      const w = rr(60, 118);
      cols.push({ x, w });
      const wide = n++ % 4 === 1;
      x += w + (wide ? rr(24, 29) : rr(13, 22));
    }
  }
  const rows = [];
  {
    let z = -GRID_HALF;
    let n = 0;
    while (z < GRID_HALF) {
      const d = rr(20, 36);
      rows.push({ z, d });
      const wide = n++ % 5 === 2;
      z += d + (wide ? rr(24, 29) : rr(12, 20));
    }
  }

  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    const cornice = rr(19.5, 24.5);       // blocks in a row share the skyline
    const cz = row.z + row.d * 0.5;
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const cx = col.x + col.w * 0.5;
      if (Math.hypot(cx, cz) > FABRIC_R + 120) continue;
      if (onAvenue(cx, cz, col.w * 0.5, row.d * 0.5)) continue;

      const pieces = rnd() < 0.45 ? (rnd() < 0.4 ? 3 : 2) : 1;
      let cursor = col.x;
      let left = col.w;
      for (let k = 0; k < pieces; k++) {
        const share = k === pieces - 1 ? left : left * (k === 0 ? rr(0.4, 0.62) : 0.5);
        const bw = share - 0.7;
        if (bw > 9) {
          let floors = clamp(Math.round((cornice + rr(-1.2, 1.2)) / STOREY), 5, 8);
          const roll = rnd();
          if (roll < 0.05) floors = 10 + ((rnd() * 4) | 0);   // 34-45 m infill
          else if (roll < 0.16) floors = 5;
          addBuilding(cursor + share * 0.5, cz, bw, row.d, floors * STOREY - 0.2, 0);
        }
        cursor += share;
        left -= share;
      }
    }
  }

  /* ---- frontages lining the diagonal boulevards ---- */
  for (let ai = 0; ai < AVENUES.length; ai++) {
    const av = AVENUES[ai];
    const halfW = av.w * 0.5;
    const perpX = av.dz;
    const perpZ = -av.dx;
    const rot = av.a - Math.PI * 0.5;
    for (let side = -1; side <= 1; side += 2) {
      const cornice = rr(19.5, 23.5);
      let t = 250;
      while (t < 2450) {
        const len = rr(14, 30);
        const depth = rr(26, 34);
        const off = halfW + 1.6 + depth * 0.5;
        const along = t + len * 0.5;
        const cx = av.dx * along + perpX * off * side;
        const cz = av.dz * along + perpZ * off * side;
        let floors = clamp(Math.round((cornice + rr(-1.0, 1.0)) / STOREY), 5, 9);
        if (rnd() < 0.06) floors = 10 + ((rnd() * 3) | 0);
        addBuilding(cx, cz, len - 0.5, depth, floors * STOREY - 0.2, rot);
        t += len + rr(0.5, 1.3);
      }
    }
  }

  /* ---- trees ---- */
  function treeFits(x, z) {
    const rad = Math.hypot(x, z);
    if (rad < 118 || rad > FABRIC_R + 40) return false;
    if (z > -452 && z < -212) return false;          // the Seine
    if (Math.abs(x) < 34 && z > 90 && z < 760) return false; // the mall itself
    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      if (Math.hypot(x - s.x, z - s.z) < s.r + 12) return false;
    }
    return true;
  }
  function addTree(x, z, s) {
    if (!treeFits(x, z)) return;
    trees.push({ x, z, s: s === undefined ? rr(1.05, 1.45) : s });
  }

  // Champ de Mars: the double allées on both flanks
  for (const xx of [-76, -52, 52, 76]) {
    let z = 118 + rr(0, 10);
    while (z < 640) {
      addTree(xx + rr(-1.4, 1.4), z, rr(1.1, 1.45));
      z += rr(13, 18);
    }
  }
  // a belt of trees along the park edge, in front of the flanking blocks
  for (const xx of [-88, 88]) {
    let z = 108;
    while (z < 646) {
      addTree(xx + rr(-1.2, 1.2), z, rr(1.1, 1.4));
      z += rr(22, 27);
    }
  }
  // the gardens around the tower
  for (let i = 0; i < 26; i++) {
    const a = rnd() * TAU;
    const rad = rr(122, 182);
    addTree(Math.sin(a) * rad, Math.cos(a) * rad, rr(1.15, 1.55));
  }
  // the boulevard allées
  for (let ai = 0; ai < AVENUES.length; ai++) {
    const av = AVENUES[ai];
    const perpX = av.dz;
    const perpZ = -av.dx;
    const off = av.w * 0.5 - 2.8;
    for (let side = -1; side <= 1; side += 2) {
      let t = 258;
      while (t < 2440) {
        const x = av.dx * t + perpX * off * side;
        const z = av.dz * t + perpZ * off * side;
        addTree(x + rr(-1, 1), z + rr(-1, 1), rr(1.0, 1.4));
        t += rr(26, 34);
      }
    }
  }
  // the quays (inside the quay road, clear of the block frontages)
  {
    let x = -2530;
    while (x < 2530) {
      if (Math.abs(x) > 48) {
        addTree(x + rr(-1.5, 1.5), -196 + rr(-1.5, 1.5), rr(1.1, 1.5));
        addTree(x + rr(-1.5, 1.5), -462 + rr(-1.5, 1.5), rr(1.1, 1.5));
      }
      x += rr(26, 34);
    }
  }
  // a garden belt around the reserved landmark clearings
  {
    const belts = ['ecoleMilitaire', 'trocadero', 'defense', 'invalides']
      .map((key) => LANDMARK_SITES[key])
      .filter((site) => site);
    for (let b = 0; b < belts.length; b++) {
      const site = belts[b];
      const n = Math.round(site.r * 0.5);
      for (let i = 0; i < n; i++) {
        const a = rnd() * TAU;
        const rad = site.r + rr(14, 34);
        const x = site.x + Math.sin(a) * rad;
        const z = site.z + Math.cos(a) * rad;
        if (!clearOfBlocks(x, z)) continue;
        addTree(x, z, rr(1.15, 1.5));
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  pavement inside the ring, with the park and gardens cut out        */
  /* ------------------------------------------------------------------ */
  {
    const paveMat = new THREE.MeshStandardMaterial({
      color: 0x565248, roughness: 1, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });

    // south bank: from the near quay to well past the ring
    const south = new THREE.Shape();
    south.moveTo(-PAVE_HALF, -PAVE_HALF);
    south.lineTo(PAVE_HALF, -PAVE_HALF);
    south.lineTo(PAVE_HALF, 218);
    south.lineTo(-PAVE_HALF, 218);
    south.closePath();

    // the Champ de Mars merges into the garden circle around the tower
    const garden = new THREE.Path();
    const gr = 190;
    const a0 = Math.asin(92 / gr);
    garden.moveTo(92, -752);
    garden.lineTo(92, -166);
    for (let i = 0; i <= 44; i++) {
      const a = a0 + ((TAU - 2 * a0) * i) / 44;
      garden.lineTo(gr * Math.sin(a), -gr * Math.cos(a));
    }
    garden.lineTo(-92, -752);
    garden.closePath();
    south.holes.push(garden);

    const southMesh = new THREE.Mesh(new THREE.ShapeGeometry(south), paveMat);
    southMesh.rotation.x = -Math.PI / 2;
    southMesh.position.y = PAVE_Y;
    southMesh.receiveShadow = true;
    scene.add(southMesh);

    // north bank: from the far quay to past the ring
    const north = new THREE.Shape();
    north.moveTo(-PAVE_HALF, 442);
    north.lineTo(PAVE_HALF, 442);
    north.lineTo(PAVE_HALF, PAVE_HALF);
    north.lineTo(-PAVE_HALF, PAVE_HALF);
    north.closePath();
    const northMesh = new THREE.Mesh(new THREE.ShapeGeometry(north), paveMat);
    northMesh.rotation.x = -Math.PI / 2;
    northMesh.position.y = PAVE_Y;
    northMesh.receiveShadow = true;
    scene.add(northMesh);
  }

  /* ------------------------------------------------------------------ */
  /*  the stone walls and their roofs, batched as instanced boxes        */
  /* ------------------------------------------------------------------ */
  const night = { value: 0 };   // eased by registerEnv below

  const wallGeo = new THREE.BoxGeometry(1, 1, 1);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0 });
  wallMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFacade;
        varying float vUpFace;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 iScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vec3 iPos = instanceMatrix[3].xyz;
        float faceU = (abs(normal.x) > 0.5) ? position.z * iScale.z : position.x * iScale.x;
        vFacade = vec3(faceU + iPos.x * 0.73 + iPos.z * 0.29,
                       position.y * iScale.y + iPos.y - ${BASE_Y.toFixed(2)},
                       iPos.x * 3.71 + iPos.z * 1.93);
        vUpFace = step(0.5, abs(normal.y));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight;
        varying vec3 vFacade;
        varying float vUpFace;
        float cHash(vec2 p) {
          p = fract(p * vec2(127.13, 311.77));
          p += dot(p, p + 34.53);
          return fract(p.x * p.y);
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wallMask = 1.0 - vUpFace;
        float cellW = 3.05;
        float cellH = ${STOREY.toFixed(2)};
        vec2 fGrid = vec2(vFacade.x / cellW, vFacade.y / cellH);
        vec2 fCell = floor(fGrid);
        vec2 fLocal = fract(fGrid);
        // tall French windows: narrow and high, one per bay
        float winX = smoothstep(0.30, 0.37, fLocal.x) * (1.0 - smoothstep(0.63, 0.70, fLocal.x));
        float winY = smoothstep(0.20, 0.28, fLocal.y) * (1.0 - smoothstep(0.79, 0.86, fLocal.y));
        float win = winX * winY * wallMask * step(3.15, vFacade.y);
        // ground floor: taller shopfront openings
        float shopBand = (1.0 - smoothstep(2.9, 3.2, vFacade.y)) * wallMask;
        float shopU = fract(vFacade.x / 4.8);
        float shop = shopBand * smoothstep(0.15, 0.21, shopU) * (1.0 - smoothstep(0.76, 0.82, shopU));
        float openings = max(win, shop);
        // stone courses, a shaded ground floor and darker glass in daylight
        diffuseColor.rgb *= 1.0 - 0.13 * (1.0 - smoothstep(0.0, 0.10, fLocal.y));
        diffuseColor.rgb *= mix(0.80, 1.0, smoothstep(3.0, 3.7, vFacade.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.55, openings);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float litFlat = step(0.60, cHash(fCell + vFacade.z * vec2(2.9, 8.1) + 17.0));
        float bright = 0.35 + 0.95 * cHash(fCell + vFacade.z * vec2(5.1, 2.3) + 41.0);
        float litShop = step(0.52, cHash(floor(vec2(vFacade.x / 4.8, 0.0)) + vFacade.z));
        vec3 warm = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.86, 0.64), cHash(fCell + 3.7));
        warm = mix(warm, vec3(0.82, 0.88, 1.0), step(0.88, cHash(fCell + 11.3)) * 0.75);
        float glow = win * litFlat * bright + shop * litShop * 1.15;
        totalEmissiveRadiance += warm * glow * uNight;`);
  };

  const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, walls.length);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  wallMesh.frustumCulled = false;

  const roofMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.0 });
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMesh = new THREE.InstancedMesh(roofGeo, roofMat, roofs.length);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  roofMesh.frustumCulled = false;

  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();

    for (let i = 0; i < walls.length; i++) {
      const b = walls[i];
      q.setFromAxisAngle(up, b.rot);
      p.set(b.x, BASE_Y + b.sy * 0.5, b.z);
      s.set(b.sx, b.sy, b.sz);
      m4.compose(p, q, s);
      wallMesh.setMatrixAt(i, m4);
      c.setRGB(b.col[0], b.col[1], b.col[2]);
      wallMesh.setColorAt(i, c);
    }
    wallMesh.instanceMatrix.needsUpdate = true;
    if (wallMesh.instanceColor) wallMesh.instanceColor.needsUpdate = true;

    for (let i = 0; i < roofs.length; i++) {
      const b = roofs[i];
      q.setFromAxisAngle(up, b.rot);
      p.set(b.x, b.y, b.z);
      s.set(b.sx, b.sy, b.sz);
      m4.compose(p, q, s);
      roofMesh.setMatrixAt(i, m4);
      c.setRGB(b.col[0], b.col[1], b.col[2]);
      roofMesh.setColorAt(i, c);
    }
    roofMesh.instanceMatrix.needsUpdate = true;
    if (roofMesh.instanceColor) roofMesh.instanceColor.needsUpdate = true;
  }
  scene.add(wallMesh, roofMesh);

  /* ------------------------------------------------------------------ */
  /*  the trees                                                          */
  /* ------------------------------------------------------------------ */
  const trunkGeo = new THREE.CylinderGeometry(0.8, 1.15, 1, 5, 1, true);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a392a, roughness: 1 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  trunkMesh.castShadow = true;
  trunkMesh.frustumCulled = false;

  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, trees.length * 2);
  leafMesh.castShadow = true;
  leafMesh.frustumCulled = false;

  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();

    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      const h = 3.4 * t.s;
      q.setFromAxisAngle(up, rnd() * TAU);

      p.set(t.x, h * 0.5, t.z);
      s.set((0.22 + 0.12 * t.s) * t.s, h, (0.22 + 0.12 * t.s) * t.s);
      m4.compose(p, q, s);
      trunkMesh.setMatrixAt(i, m4);

      const lean = rnd() * 0.5;
      c.setHSL(0.215 + rnd() * 0.06, 0.30 + rnd() * 0.18, 0.17 + rnd() * 0.13, THREE.SRGBColorSpace);
      p.set(t.x, h + 1.7 * t.s, t.z);
      s.set(2.9 * t.s, 2.4 * t.s, 2.9 * t.s);
      m4.compose(p, q, s);
      leafMesh.setMatrixAt(i * 2, m4);
      leafMesh.setColorAt(i * 2, c);

      p.set(t.x + Math.cos(lean) * 1.1 * t.s, h + 3.1 * t.s, t.z + Math.sin(lean) * 1.1 * t.s);
      s.set(1.9 * t.s, 1.7 * t.s, 1.9 * t.s);
      m4.compose(p, q, s);
      leafMesh.setMatrixAt(i * 2 + 1, m4);
      leafMesh.setColorAt(i * 2 + 1, c);
    }
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
  }
  scene.add(trunkMesh, leafMesh);

  /* ------------------------------------------------------------------ */
  /*  the city at night                                                  */
  /* ------------------------------------------------------------------ */
  registerEnv((t) => {
    night.value = t;
    // roofs fall into shadow at night so the lit windows read as the city
    roofMat.color.setScalar(mix(1, 0.5, t));
  });
}
