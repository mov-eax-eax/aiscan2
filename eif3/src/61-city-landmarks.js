/* 61-city-landmarks.js — the memorable Paris silhouettes on the horizon.
   TEAM MODULE · owner: city-landmarks · file only you may edit.

   Contract
     buildCityLandmarks(scene) is called once after the terrain and the urban
     fabric exist. Add meshes to `scene`, keep them stylised but recognisable and
     in scale (1 unit = 1 metre). For anything that changes with the light or
     moves, use registerEnv((night) => {...}) and registerUpdater((dt, elapsed)
     => {...}) from 20-env.js.

   Map conventions (shared with the other city modules)
     +Z  Champ de Mars / École Militaire          (mall runs 100 → 740)
     -Z  the Seine (z = -330) then Trocadéro
     +X  Montparnasse side
     -X  the far west / La Défense side
     ground plane   y = 0
     city floor     y = WORLD.ringY (0.6), radius WORLD.cityInner (760) outward
     water          y = WORLD.waterY (1.2)

   Landmarks built here (all inside their LANDMARK_SITES clearings):
     École Militaire     (0, 830)     long classical range + pediment + dome, closes the mall
     Palais de Chaillot  (0, -640)    two curved wings round the Trocadéro esplanade,
                                      fountain basin + gardens toward the Seine
     Tour Montparnasse   (980, -260)  dark glass slab, ~210 m
     La Défense          (-1280,-880) Grande Arche (open ~110 m cube) + four towers
     Les Invalides       (560, 720)   optional golden dome, peeking over the city roofs

   Performance: everything is shared primitive geometry; the repeated parts (all
   facade windows, the tower floor bands, the Chaillot wing bays, the garden
   trees) are a handful of InstancedMeshes. No per-frame allocation: the night
   handler only writes emissiveIntensity on materials created once here.
   Do not edit any file other than this one. */

function buildCityLandmarks(scene) {
  /* Every base is sunk below ground (y = 0 … 0.6) so nothing floats and no
     facade starts exactly on the city-floor plane. */
  const BASE = -1;

  /* ------------------------------------------------------------------ */
  /*  shared materials — created once, shared by every mesh             */
  /* ------------------------------------------------------------------ */
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xa99b85, roughness: 0.95, metalness: 0.02, emissive: 0xffcf92, emissiveIntensity: 0 });
  const stoneLightMat = new THREE.MeshStandardMaterial({ color: 0xc2b69f, roughness: 0.9, metalness: 0.02, emissive: 0xffdaa6, emissiveIntensity: 0 });
  const stoneDarkMat = new THREE.MeshStandardMaterial({ color: 0x756b5c, roughness: 1.0, metalness: 0.02 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x565e68, roughness: 0.72, metalness: 0.3, emissive: 0x1b222b, emissiveIntensity: 0 });
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x646c78, roughness: 0.62, metalness: 0.35, emissive: 0xffb066, emissiveIntensity: 0 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0x332b23, roughness: 0.5, metalness: 0.15, emissive: 0xffc078, emissiveIntensity: 0 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x161d26, roughness: 0.2, metalness: 0.85, emissive: 0x22364e, emissiveIntensity: 0 });
  const bandDimMat = new THREE.MeshStandardMaterial({ color: 0x1e262f, roughness: 0.4, metalness: 0.5, emissive: 0xffc98a, emissiveIntensity: 0 });
  const bandLitMat = new THREE.MeshStandardMaterial({ color: 0x272e36, roughness: 0.35, metalness: 0.45, emissive: 0xffd09a, emissiveIntensity: 0 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x252c35, roughness: 0.45, metalness: 0.55, emissive: 0x162233, emissiveIntensity: 0 });
  const archMat = new THREE.MeshStandardMaterial({ color: 0xd6d0c2, roughness: 0.6, metalness: 0.04, emissive: 0xffe2b4, emissiveIntensity: 0 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc9a02c, roughness: 0.28, metalness: 0.92, emissive: 0xffcb52, emissiveIntensity: 0 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2e6a80, roughness: 0.12, metalness: 0.35, emissive: 0x123a4a, emissiveIntensity: 0 });
  const gardenMat = new THREE.MeshStandardMaterial({ color: 0x3c5933, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x38512e, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x463629, roughness: 1 });

  /* ------------------------------------------------------------------ */
  /*  shared geometry                                                   */
  /* ------------------------------------------------------------------ */
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  // 4-sided frustum = a hipped / mansard roof: base square side 1.4142 after
  // the 45° turn, top square 72 % of it. Scale x/z to the building footprint.
  const hipGeo = new THREE.CylinderGeometry(0.72, 1, 1, 4, 1);
  hipGeo.rotateY(Math.PI / 4);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
  const domeGeo = new THREE.SphereGeometry(1, 18, 10, 0, TAU, 0, Math.PI / 2);
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);

  // triangular pediment prism (unit height / half-width / depth)
  const pedShape = new THREE.Shape();
  pedShape.moveTo(-1, 0);
  pedShape.lineTo(1, 0);
  pedShape.lineTo(0, 1.1);
  pedShape.lineTo(-1, 0);
  const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 1, bevelEnabled: false });
  pedGeo.translate(0, 0, -0.5);

  /* ------------------------------------------------------------------ */
  /*  helpers — all scratch vectors are reused (no per-call garbage)    */
  /* ------------------------------------------------------------------ */
  const _m4 = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();

  /** Build one InstancedMesh from a list of {x,y,z,ry,sx,sy,sz}. */
  function instanced(geo, mat, items) {
    if (!items.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      _p.set(it.x, it.y, it.z);
      _e.set(0, it.ry || 0, 0);
      _q.setFromEuler(_e);
      _s.set(it.sx, it.sy, it.sz);
      _m4.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    scene.add(mesh);
    return mesh;
  }

  /** Box whose y argument is the BOTTOM height (bases stay level). */
  function addBox(parent, mat, x, bottom, z, w, h, d, ry) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(x, bottom + h * 0.5, z);
    mesh.scale.set(w, h, d);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function addHip(parent, mat, x, base, z, w, h, d, ry) {
    const mesh = new THREE.Mesh(hipGeo, mat);
    mesh.position.set(x, base + h * 0.5, z);
    mesh.scale.set(w / 1.41421, h, d / 1.41421);
    if (ry) mesh.rotation.y = ry;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function addCyl(parent, mat, x, bottom, z, r, h) {
    const mesh = new THREE.Mesh(cylGeo, mat);
    mesh.position.set(x, bottom + h * 0.5, z);
    mesh.scale.set(r, h, r);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function addDome(parent, mat, x, base, z, r, squash) {
    const mesh = new THREE.Mesh(domeGeo, mat);
    mesh.position.set(x, base, z);
    mesh.scale.set(r, r * (squash || 1), r);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function addWater(parent, x, y, z, w, d) {
    const mesh = new THREE.Mesh(planeGeo, waterMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    mesh.scale.set(w, d, 1);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  /** Group at (x,z) turned by ry: lets a rotated landmark use local coords. */
  function addGroup(x, z, ry) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    return g;
  }

  /* ================================================================== */
  /*  École Militaire — closes the Champ de Mars vista, at +Z            */
  /* ================================================================== */
  {
    const x = LANDMARK_SITES.ecoleMilitaire.x;   // 0
    const z = LANDMARK_SITES.ecoleMilitaire.z;   // 830
    const front = z - 12;                        // main range facade, toward the tower

    // terrace, long main range, cornice, mansard roof
    addBox(scene, stoneDarkMat, x, BASE, z, 204, 3.0, 36);
    // forecourt: carries the Champ de Mars paving up to the facade
    addBox(scene, stoneDarkMat, x, BASE, 778, 190, 1.9, 84);
    addBox(scene, stoneMat, x, BASE, z, 176, 17, 24);
    addBox(scene, stoneLightMat, x, 15.7, z, 180, 1.1, 27);
    addHip(scene, roofMat, x, 16.8, z, 178, 6.2, 26);

    // end pavilions give the long facade its rhythm
    for (const s of [-1, 1]) {
      const px = x + s * 80;
      addBox(scene, stoneMat, px, BASE, z, 26, 20, 28);
      addBox(scene, stoneLightMat, px, 18.6, z, 28, 1.1, 30);
      addHip(scene, roofMat, px, 19.7, z, 28, 4.6, 30);
    }

    // central pavilion, pediment and dome
    addBox(scene, stoneMat, x, BASE, z - 1, 46, 18, 30);
    addBox(scene, stoneLightMat, x, 16.6, z - 1, 49, 1.2, 32);
    {
      const ped = new THREE.Mesh(pedGeo, stoneLightMat);
      ped.position.set(x, 17.8, front + 3);
      ped.scale.set(20, 6.4, 6);
      ped.castShadow = false;
      ped.receiveShadow = false;
      scene.add(ped);
    }
    addCyl(scene, stoneLightMat, x, 17.0, z + 1, 8.6, 6.0);          // drum
    addDome(scene, domeMat, x, 23.0, z + 1, 8.6, 1.12);              // slate dome
    addCyl(scene, stoneLightMat, x, 32.6, z + 1, 2.5, 5.8);          // lantern
    addDome(scene, stoneLightMat, x, 38.4, z + 1, 2.5, 1.1);         // lantern cap
    addCyl(scene, goldMat, x, 41.1, z + 1, 0.3, 3.0);                // finial

    // windows: main range, central pavilion, end pavilions
    const win = [];
    for (const wy of [6.6, 11.8]) {
      for (let wx = -76; wx <= 76.1; wx += 7.4) {
        if (Math.abs(wx) < 27) continue;
        win.push({ x: wx, y: wy, z: front - 0.16, ry: Math.PI, sx: 2.6, sy: 3.5, sz: 1 });
      }
    }
    for (const wx of [-13.5, 0, 13.5]) {
      for (const wy of [7.4, 12.6]) {
        win.push({ x: wx, y: wy, z: z - 15 - 0.16, ry: Math.PI, sx: 3.4, sy: 4.4, sz: 1 });
      }
    }
    for (const s of [-1, 1]) {
      for (const wy of [8.2, 13.0]) {
        win.push({ x: x + s * 80, y: wy, z: z - 14 - 0.16, ry: Math.PI, sx: 2.8, sy: 4.0, sz: 1 });
      }
    }
    instanced(planeGeo, windowMat, win);
  }

  /* ================================================================== */
  /*  Palais de Chaillot — two curved wings embracing the esplanade      */
  /*  at -Z, with the fountain basin and gardens running to the Seine    */
  /* ================================================================== */
  {
    const site = LANDMARK_SITES.trocadero;
    const kx = site.x;
    const kz = site.z + 100;              // centre of the wings' curvature
    const R = 115;                        // radius of the arc of the wings
    const a0 = 0.24, a1 = 1.31, N = 7;    // arc from ~14° … ~75°, seven bays each

    const wingBoxes = [];
    const wingRoofs = [];
    const win = [];

    for (const side of [-1, 1]) {
      for (let i = 0; i < N; i++) {
        const am = a0 + (a1 - a0) * (i + 0.5) / N;
        const px = kx + side * R * Math.sin(am);
        const pz = kz - R * Math.cos(am);
        const ry = -side * am;
        wingBoxes.push({ x: px, y: BASE + 7.5, z: pz, ry, sx: 19.4, sy: 15, sz: 16 });
        wingRoofs.push({ x: px, y: 14.7, z: pz, ry, sx: 19.8, sy: 1.4, sz: 16.8 });

        // windows on the concave inner facade, facing the parvis / tower
        const rr = R - 8.15;
        const wx = kx + side * rr * Math.sin(am);
        const wz = kz - rr * Math.cos(am);
        for (const wy of [5.4, 10.6]) {
          win.push({ x: wx, y: wy, z: wz, ry, sx: 2.9, sy: 3.9, sz: 1 });
        }
      }

      // a pavilion at each end of every wing
      for (const p of [[a0 + 0.045, 24, 21, 24, 5.2], [a1 - 0.025, 27, 25, 28, 5.6]]) {
        const pa = p[0];
        const px = kx + side * R * Math.sin(pa);
        const pz = kz - R * Math.cos(pa);
        const ry = -side * pa;
        addBox(scene, stoneMat, px, BASE, pz, p[1], p[2], p[3], ry);
        addHip(scene, roofMat, px, BASE + p[2], pz, p[1] + 1.5, p[4], p[3] + 1.5, ry);
      }
    }

    instanced(boxGeo, stoneMat, wingBoxes);
    instanced(boxGeo, roofMat, wingRoofs);
    instanced(planeGeo, windowMat, win);

    // esplanade plateau behind the wings (Chaillot sits on its hill)
    addBox(scene, stoneDarkMat, 0, BASE, -672, 232, 2.4, 96);

    // fountain basin running toward the river, with garden beds and trees
    addBox(scene, stoneDarkMat, -43, BASE, -560, 5, 2.6, 84);
    addBox(scene, stoneDarkMat, 43, BASE, -560, 5, 2.6, 84);
    addBox(scene, stoneDarkMat, 0, BASE, -600, 96, 2.6, 5);
    addBox(scene, stoneDarkMat, 0, BASE, -520, 96, 2.6, 5);
    addWater(scene, 0, 1.1, -560, 82, 78);

    addBox(scene, gardenMat, -62, BASE, -560, 28, 1.6, 84);
    addBox(scene, gardenMat, 62, BASE, -560, 28, 1.6, 84);

    const trunks = [];
    const leaves = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const tx = side * 62;
        const tz = -592 + i * 16;
        trunks.push({ x: tx, y: 0.4, z: tz, ry: 0, sx: 0.7, sy: 2.8, sz: 0.7 });
        leaves.push({ x: tx, y: 3.6, z: tz, ry: 0, sx: 3.4, sy: 3.2, sz: 3.4 });
      }
    }
    instanced(boxGeo, trunkMat, trunks);
    instanced(leafGeo, leafMat, leaves);
  }

  /* ================================================================== */
  /*  Tour Montparnasse — the dark glass slab on the +X horizon          */
  /* ================================================================== */
  {
    const site = LANDMARK_SITES.montparnasse;
    const cx = site.x;
    // NOTE: the reserved site (980, -260) lies inside the Seine band
    // (z = -220 … -440; the river plane is 9000 m wide), so a tower built on
    // the exact spot stands in the water. It is moved 88 m north to the dry
    // bank, still just inside its 90 m clearing; nothing else occupies that
    // strip because the city fabric skips z = -120 … -500.
    const cz = site.z + 88;               // (980, -172), on the north bank
    const ROT = -1.31;                    // broad face turned toward the tower

    // podium, glazed slab, machine crown, antenna
    addBox(scene, stoneDarkMat, cx, BASE, cz, 80, 13, 54, ROT);
    addBox(scene, stoneLightMat, cx, 11.4, cz, 84, 1.2, 58, ROT);
    addBox(scene, glassMat, cx, 12, cz, 50, 197, 32, ROT);          // top ≈ 209 m
    addBox(scene, glassMat, cx, 208, cz, 46, 5.2, 28, ROT);
    addBox(scene, stoneLightMat, cx, 212.8, cz, 34, 2.6, 22, ROT);
    addCyl(scene, stoneLightMat, cx, 215.4, cz, 0.9, 8);
    addCyl(scene, stoneLightMat, cx, 222.6, cz, 0.4, 6);

    // floor lines: dark by day, a sparse grid of lit offices by night
    const dim = [];
    const lit = [];
    let row = 0;
    for (let y = 20; y <= 203; y += 5.6) {
      const item = { x: cx, y, z: cz, ry: ROT, sx: 50.7, sy: 0.7, sz: 32.7 };
      if (row % 3 === 1) lit.push(item); else dim.push(item);
      row++;
    }
    instanced(boxGeo, bandDimMat, dim);
    instanced(boxGeo, bandLitMat, lit);
  }

  /* ================================================================== */
  /*  La Défense — the Grande Arche and four towers on the -X horizon    */
  /* ================================================================== */
  {
    const site = LANDMARK_SITES.defense;

    // ---- Grande Arche: a hollow ~110 m cube, white stone ----
    const arche = addGroup(site.x + 20, site.z + 20, 0.97);
    addBox(arche, archMat, 0, BASE, 0, 124, 8, 124);                 // podium
    for (const s of [-1, 1]) {
      addBox(arche, archMat, s * 46, 7, 0, 22, 100, 110);            // piers
    }
    addBox(arche, archMat, 0, 87, 0, 114, 20, 110);                  // lintel
    // lit edges at night (the Arche is floodlit in reality)
    for (const s of [-1, 1]) {
      addBox(arche, bandLitMat, 0, 86.4, s * 55.2, 114, 0.8, 1.2);
      addBox(arche, bandLitMat, 0, 6.2, s * 55.2, 114, 0.8, 1.2);
    }

    // ---- four towers of the business district ----
    const towers = [
      { x: -1400, z: -980, w: 44, d: 38, h: 196, ry: 0.25 },
      { x: -1230, z: -1010, w: 40, d: 34, h: 232, ry: -0.10 },
      { x: -1400, z: -800, w: 48, d: 36, h: 142, ry: 0.15 },
      { x: -1150, z: -760, w: 42, d: 34, h: 168, ry: -0.30 },
    ];
    const dim = [];
    const lit = [];
    for (const t of towers) {
      addBox(scene, towerMat, t.x, BASE, t.z, t.w, t.h, t.d, t.ry);
      addBox(scene, glassMat, t.x, t.h - 7, t.z, t.w * 0.86, 6.5, t.d * 0.86, t.ry);   // crown
      addBox(scene, towerMat, t.x, t.h - 1, t.z, t.w * 0.55, 3.4, t.d * 0.55, t.ry);   // roof box
      let i = 0;
      for (let y = 16; y < t.h - 12; y += 8.5) {
        const item = { x: t.x, y, z: t.z, ry: t.ry, sx: t.w + 0.6, sy: 0.55, sz: t.d + 0.6 };
        if (i % 4 === 2) lit.push(item); else dim.push(item);
        i++;
      }
    }
    instanced(boxGeo, bandDimMat, dim);
    instanced(boxGeo, bandLitMat, lit);
  }

  /* ================================================================== */
  /*  Les Invalides — optional golden dome over the rooftops             */
  /* ================================================================== */
  {
    const ix = 560;
    const iz = 720;
    const irot = -0.32;

    addBox(scene, stoneDarkMat, ix, BASE, iz, 68, 3, 88, irot);
    addBox(scene, stoneMat, ix, BASE, iz, 46, 22, 72, irot);
    addHip(scene, roofMat, ix, 21, iz, 48, 6.5, 74, irot);

    addCyl(scene, stoneLightMat, ix, 20, iz, 15, 17);                // drum
    addDome(scene, goldMat, ix, 37, iz, 15, 1.35);                   // golden dome
    addCyl(scene, stoneLightMat, ix, 56.8, iz, 3.6, 8.5);            // lantern
    addDome(scene, goldMat, ix, 65.3, iz, 3.6, 1.2);                 // lantern cap
    addCyl(scene, goldMat, ix, 69.4, iz, 0.35, 5.5);                 // spire

    const win = [];
    // drum windows all the way round
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      win.push({ x: ix + Math.sin(a) * 15.12, y: 28.5, z: iz + Math.cos(a) * 15.12, ry: a, sx: 2.6, sy: 5, sz: 1 });
    }
    // nave windows on the facade turned toward the tower
    const c = Math.cos(irot);
    const s = Math.sin(irot);
    for (const wy of [6.8, 13.2]) {
      for (let k = -2; k <= 2; k++) {
        const lz = k * 9;
        win.push({
          x: ix - 23.15 * c + lz * s,
          y: wy,
          z: iz + 23.15 * s + lz * c,
          ry: irot - Math.PI / 2,
          sx: 3.2, sy: 4.6, sz: 1,
        });
      }
    }
    instanced(planeGeo, windowMat, win);
  }

  /* ------------------------------------------------------------------ */
  /*  day / night — floodlit stone, warm windows, golden dome            */
  /* ------------------------------------------------------------------ */
  registerEnv((t) => {
    stoneMat.emissiveIntensity = t * 0.10;
    stoneLightMat.emissiveIntensity = t * 0.15;
    roofMat.emissiveIntensity = t * 0.10;
    domeMat.emissiveIntensity = t * 0.30;
    archMat.emissiveIntensity = t * 0.09;
    windowMat.emissiveIntensity = t * 1.4;
    bandDimMat.emissiveIntensity = t * 0.35;
    bandLitMat.emissiveIntensity = t * 1.15;
    glassMat.emissiveIntensity = t * 0.16;
    towerMat.emissiveIntensity = t * 0.10;
    goldMat.emissiveIntensity = mix(0.04, 0.9, t);
    waterMat.emissiveIntensity = t * 0.5;
  });
}
