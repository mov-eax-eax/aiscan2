/* 62-city-life.js — the city moves: bateaux-mouches on the Seine, lamplight
   along the Champ de Mars and Pont d'Iéna, a ribbon of night traffic on the
   quays, and one slow balloon over the Trocadéro.
   TEAM MODULE · owner: city-life · file only you may edit.

   Contract
     buildCityLife(scene) is called once after terrain, tower and the city
     modules. All per-frame motion goes through registerUpdater((dt, elapsed)
     => {...}) (delta-based) and all day/night response through
     registerEnv((night) => {...}) from 20-env.js. No geometry or material is
     created inside a frame loop, and the loops allocate nothing.

   Budget: ~35 draw calls, 54 lamp instances, 280 traffic points, 3 boats. */

function buildCityLife(scene) {
  /* ------------------------------------------------------------------ */
  /*  one shared soft-glow sprite for every light (canvas, built once)   */
  /* ------------------------------------------------------------------ */
  const glowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  /* ------------------------------------------------------------------ */
  /*  materials — created once, shared by every instance                 */
  /* ------------------------------------------------------------------ */
  const hullMat = new THREE.MeshStandardMaterial({ color: 0x1d2733, metalness: 0.3, roughness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd9d3c5, metalness: 0.1, roughness: 0.72 });
  const cabinMat = new THREE.MeshStandardMaterial({
    color: 0x2a3d47, metalness: 0.45, roughness: 0.25,
    emissive: 0xffcf94, emissiveIntensity: 0.04,
  });
  // thin warm string lights along the boat roofs — they read from above at night
  const boatLightMat = new THREE.MeshStandardMaterial({
    color: 0x6e6656, emissive: 0xffd9a0, emissiveIntensity: 0.04, roughness: 0.6,
  });

  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x1c2521, metalness: 0.55, roughness: 0.55 });
  const globeMat = new THREE.MeshStandardMaterial({
    color: 0xfff1cf, emissive: 0xffd08a, emissiveIntensity: 0.05, roughness: 0.35,
  });
  const poolMat = new THREE.MeshBasicMaterial({
    map: glowTex, color: 0xffbd6e, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const lampGlowMat = new THREE.PointsMaterial({
    map: glowTex, color: 0xffc27a, size: 9, sizeAttenuation: true,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const headMat = new THREE.PointsMaterial({
    map: glowTex, color: 0xfff2d2, size: 7.5, sizeAttenuation: true,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const tailMat = new THREE.PointsMaterial({
    map: glowTex, color: 0xff4326, size: 6, sizeAttenuation: true,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  });

  const balloonMat = new THREE.MeshStandardMaterial({
    color: 0xe4d9c4, roughness: 0.85, emissive: 0xffb066, emissiveIntensity: 0,
  });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xb8493a, roughness: 0.8 });
  const basketMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 1 });
  const burnerMat = new THREE.MeshStandardMaterial({
    color: 0xffb368, emissive: 0xff9a3c, emissiveIntensity: 0.2, roughness: 0.6,
  });
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.7 });

  /* ================================================================== */
  /*  1. bateaux-mouches on the Seine                                    */
  /* ================================================================== */
  const hullGeo = new THREE.BoxGeometry(58, 2.6, 8.6);
  const bowGeo = new THREE.BoxGeometry(8, 2.4, 6);
  const rimGeo = new THREE.BoxGeometry(56, 0.45, 9);
  const cabinGeo = new THREE.BoxGeometry(44, 3, 7.6);
  const roofGeo = new THREE.BoxGeometry(45, 0.4, 8.2);
  const deckLightGeo = new THREE.BoxGeometry(38, 0.16, 0.3);
  const wheelGeo = new THREE.BoxGeometry(4.4, 1.5, 4.4);

  const boats = [];
  // loop the long way round, off screen: the two visible edges of the river
  // are far outside the camera's view, so a wrap is never seen
  const BOAT_MIN = -1700;
  const BOAT_MAX = 1700;
  const BOAT_SPAN = BOAT_MAX - BOAT_MIN;
  // lanes inside the river (z -220…-440), clear of the bridge piers at
  // z = -256 / -330 / -404; two sail east, one west, at different speeds.
  const BOAT_LANES = [
    { z: -282, dir: 1, speed: 6.4, phase: 0.0, x: -740 },
    { z: -312, dir: -1, speed: 5.2, phase: 1.7, x: 880 },
    { z: -394, dir: 1, speed: 7.3, phase: 3.1, x: -190 },
  ];

  function buildBoat(lane) {
    const g = new THREE.Group();

    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.25;
    g.add(hull);

    // a 45° box makes a plausible tapered bow without new vertex data
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.position.set(26, 0.25, 0);
    bow.rotation.y = Math.PI / 4;
    g.add(bow);

    const rim = new THREE.Mesh(rimGeo, trimMat);
    rim.position.y = 1.62;
    g.add(rim);

    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-1.5, 3.2, 0);
    g.add(cabin);

    const roof = new THREE.Mesh(roofGeo, trimMat);
    roof.position.set(-1.5, 4.85, 0);
    g.add(roof);

    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(deckLightGeo, boatLightMat);
      strip.position.set(-1.5, 5.13, side * 3.75);
      g.add(strip);
    }

    const wheel = new THREE.Mesh(wheelGeo, trimMat);
    wheel.position.set(24, 2.6, 0);
    g.add(wheel);

    g.position.set(lane.x, WORLD.waterY, lane.z);
    g.rotation.y = lane.dir < 0 ? Math.PI : 0;
    scene.add(g);
    boats.push({ g: g, z: lane.z, dir: lane.dir, speed: lane.speed, phase: lane.phase, x: lane.x });
  }
  for (let i = 0; i < BOAT_LANES.length; i++) buildBoat(BOAT_LANES[i]);

  /* ================================================================== */
  /*  2. lamp posts — Champ de Mars allée + Pont d'Iéna                  */
  /* ================================================================== */
  const lampSpots = [];
  for (let z = 120; z <= 720; z += 30) {
    lampSpots.push({ x: -36, z: z, baseY: 0, s: 1 });
    lampSpots.push({ x: 36, z: z, baseY: 0, s: 1 });
  }
  // the bridge: shorter posts standing on the deck (top y = 3.0)
  for (let z = -240; z >= -420; z -= 36) {
    lampSpots.push({ x: -18.5, z: z, baseY: 3.0, s: 0.72 });
    lampSpots.push({ x: 18.5, z: z, baseY: 3.0, s: 0.72 });
  }

  const POLE_H = 5.2;
  const nLamps = lampSpots.length;

  const poleGeo = new THREE.CylinderGeometry(0.085, 0.14, POLE_H, 6);
  poleGeo.translate(0, POLE_H / 2, 0); // base sits on the instance origin
  const globeGeo = new THREE.SphereGeometry(0.36, 8, 6);
  const poolGeo = new THREE.CircleGeometry(5.5, 18);

  const poleMesh = new THREE.InstancedMesh(poleGeo, lampPoleMat, nLamps);
  const globeMesh = new THREE.InstancedMesh(globeGeo, globeMat, nLamps);
  const poolMesh = new THREE.InstancedMesh(poolGeo, poolMat, nLamps);
  poleMesh.frustumCulled = false;
  globeMesh.frustumCulled = false;
  poolMesh.frustumCulled = false;

  const glowPositions = new Float32Array(nLamps * 3);
  {
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();

    for (let i = 0; i < nLamps; i++) {
      const L = lampSpots[i];
      const s = L.s;
      const gy = L.baseY + (POLE_H + 0.32) * s;

      p.set(L.x, L.baseY, L.z);
      sc.set(s, s, s);
      m4.compose(p, q, sc);
      poleMesh.setMatrixAt(i, m4);

      p.set(L.x, gy, L.z);
      m4.compose(p, q, sc);
      globeMesh.setMatrixAt(i, m4);

      glowPositions[i * 3] = L.x;
      glowPositions[i * 3 + 1] = gy;
      glowPositions[i * 3 + 2] = L.z;

      // flat warm pool of light on the ground / deck under each lamp
      p.set(L.x, L.baseY + 0.06, L.z);
      sc.set(s, s, 1);
      m4.compose(p, qFlat, sc);
      poolMesh.setMatrixAt(i, m4);
    }
    poleMesh.instanceMatrix.needsUpdate = true;
    globeMesh.instanceMatrix.needsUpdate = true;
    poolMesh.instanceMatrix.needsUpdate = true;
  }

  const lampGlowGeo = new THREE.BufferGeometry();
  lampGlowGeo.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
  const lampGlow = new THREE.Points(lampGlowGeo, lampGlowMat);
  lampGlow.frustumCulled = false;

  poolMesh.visible = false;
  lampGlow.visible = false;
  scene.add(poleMesh, globeMesh, poolMesh, lampGlow);

  /* ================================================================== */
  /*  3. night traffic — head/tail light ribbon along both quays         */
  /* ================================================================== */
  const ROADS = [
    { z: -206, dir: 1, y: 1.15, speed: 17 },  // near bank (Quai Branly side)
    { z: -458, dir: -1, y: 1.05, speed: 15 }, // far bank, beyond the quay wall
  ];

  // a strip of asphalt under each lane so the lights belong to a road
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2e31, roughness: 0.95 });
  for (let r = 0; r < ROADS.length; r++) {
    const roadMesh = new THREE.Mesh(new THREE.BoxGeometry(9000, 0.06, 24), roadMat);
    roadMesh.position.set(0, 0.39, ROADS[r].z);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);
  }

  const CARS_PER_ROAD = 70;
  const CAR_COUNT = ROADS.length * CARS_PER_ROAD; // 140 cars → 280 points
  const WRAP_MIN = -2200;
  const WRAP_MAX = 2200;
  const WRAP_SPAN = WRAP_MAX - WRAP_MIN;

  const carX = new Float32Array(CAR_COUNT);
  const carSpeed = new Float32Array(CAR_COUNT);
  const carRoad = new Uint8Array(CAR_COUNT);
  const headPos = new Float32Array(CAR_COUNT * 3);
  const tailPos = new Float32Array(CAR_COUNT * 3);

  for (let i = 0; i < CAR_COUNT; i++) {
    const r = i & 1; // interleave the two roads so both are always populated
    const road = ROADS[r];
    const z = road.z + (Math.random() - 0.5) * 3;
    const x = WRAP_MIN + Math.random() * WRAP_SPAN;
    carRoad[i] = r;
    carX[i] = x;
    carSpeed[i] = road.speed * (0.85 + Math.random() * 0.3);

    const i3 = i * 3;
    headPos[i3] = x;
    headPos[i3 + 1] = road.y;
    headPos[i3 + 2] = z;
    tailPos[i3] = x - road.dir * 4.6;
    tailPos[i3 + 1] = road.y - 0.1;
    tailPos[i3 + 2] = z;
  }

  const headGeo = new THREE.BufferGeometry();
  const headAttr = new THREE.BufferAttribute(headPos, 3);
  headAttr.setUsage(THREE.DynamicDrawUsage);
  headGeo.setAttribute('position', headAttr);
  const headPoints = new THREE.Points(headGeo, headMat);
  headPoints.frustumCulled = false;

  const tailGeo = new THREE.BufferGeometry();
  const tailAttr = new THREE.BufferAttribute(tailPos, 3);
  tailAttr.setUsage(THREE.DynamicDrawUsage);
  tailGeo.setAttribute('position', tailAttr);
  const tailPoints = new THREE.Points(tailGeo, tailMat);
  tailPoints.frustumCulled = false;

  headPoints.visible = false;
  tailPoints.visible = false;
  scene.add(headPoints, tailPoints);

  /* ================================================================== */
  /*  4. one hot-air balloon, drifting over the Trocadéro               */
  /* ================================================================== */
  const balloon = new THREE.Group();

  const envelope = new THREE.Mesh(new THREE.SphereGeometry(11, 18, 12), balloonMat);
  envelope.position.y = 10;
  envelope.scale.set(1, 1.16, 1);
  balloon.add(envelope);

  const band = new THREE.Mesh(new THREE.CylinderGeometry(11.06, 11.06, 2.6, 18, 1, true), bandMat);
  band.position.y = 10;
  balloon.add(band);

  const basket = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.6, 3.2), basketMat);
  basket.position.y = -6.3;
  balloon.add(basket);

  const burner = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), burnerMat);
  burner.position.y = -3.9;
  balloon.add(burner);

  {
    const ropeGeo = new THREE.BufferGeometry();
    const rv = new Float32Array(4 * 2 * 3);
    const corners = [[1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5]];
    for (let i = 0; i < 4; i++) {
      rv[i * 6 + 0] = corners[i][0];
      rv[i * 6 + 1] = -5.0;
      rv[i * 6 + 2] = corners[i][1];
      rv[i * 6 + 3] = corners[i][0] * 0.55;
      rv[i * 6 + 4] = -2.9;
      rv[i * 6 + 5] = corners[i][1] * 0.55;
    }
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(rv, 3));
    balloon.add(new THREE.LineSegments(ropeGeo, ropeMat));
  }

  balloon.position.set(-60, 132, -700);
  scene.add(balloon);

  /* ================================================================== */
  /*  5. night response                                                  */
  /* ================================================================== */
  registerEnv((night) => {
    cabinMat.emissiveIntensity = mix(0.04, 1.15, night);
    boatLightMat.emissiveIntensity = mix(0.04, 2.2, night);
    globeMat.emissiveIntensity = mix(0.05, 2.6, night);
    poolMat.opacity = night * 0.22;
    lampGlowMat.opacity = night * 0.9;
    headMat.opacity = night * 0.9;
    tailMat.opacity = night * 0.8;

    const lit = night > 0.02;
    poolMesh.visible = lit;
    lampGlow.visible = lit;
    headPoints.visible = lit;
    tailPoints.visible = lit;
  });

  /* ================================================================== */
  /*  6. the single frame updater (boats → traffic → balloon)           */
  /* ================================================================== */
  registerUpdater((dt, elapsed) => {
    /* boats */
    for (let i = 0; i < boats.length; i++) {
      const b = boats[i];
      b.x += b.dir * b.speed * dt;
      if (b.x > BOAT_MAX) b.x -= BOAT_SPAN;
      else if (b.x < BOAT_MIN) b.x += BOAT_SPAN;
      b.g.position.x = b.x;
      b.g.position.y = WORLD.waterY + Math.sin(elapsed * 0.85 + b.phase) * 0.05;
      b.g.position.z = b.z + Math.sin(elapsed * 0.13 + b.phase) * 1.1;
      b.g.rotation.z = Math.sin(elapsed * 0.9 + b.phase) * 0.005;
    }

    /* night traffic: headlights + taillights, wrap-around far off screen */
    for (let i = 0; i < CAR_COUNT; i++) {
      const r = carRoad[i];
      const road = ROADS[r];
      let x = carX[i] + road.dir * carSpeed[i] * dt;
      if (x > WRAP_MAX) x -= WRAP_SPAN;
      else if (x < WRAP_MIN) x += WRAP_SPAN;
      carX[i] = x;

      const i3 = i * 3;
      headPos[i3] = x;
      tailPos[i3] = x - road.dir * 4.6;
    }
    headAttr.needsUpdate = true;
    tailAttr.needsUpdate = true;

    /* balloon: lazy circle, slow bob, occasional burner flash */
    const a = elapsed * 0.0075;
    balloon.position.x = -60 + Math.cos(a) * 180;
    balloon.position.y = 132 + Math.sin(elapsed * 0.11) * 7;
    balloon.position.z = -700 + Math.sin(a) * 180;
    balloon.rotation.y = elapsed * 0.012;

    const n = ENV.night;
    const flash = Math.pow(Math.max(0, Math.sin(elapsed * 0.55 + 1.2)), 12);
    burnerMat.emissiveIntensity = 0.25 + n * (1.4 + 5 * flash);
    balloonMat.emissiveIntensity = n * (0.04 + 0.3 * flash);
  });
}
