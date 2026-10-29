/*!
 * eiffelTower.js - procedural, dimensionally-authoritative Eiffel Tower for three.js.
 *
 * DERIVED WORK - MIT licensed.
 *   Upstream: https://github.com/iamtechartist/eiffel-tower-district
 *   Copyright (c) 2026 Techartist. Licensed under the MIT License.
 *   \`buildEiffelTower\` and \`EIFFEL_OFFICIAL_DIMENSIONS\` are taken from that
 *   project's \`index.html\` (lines 512-1899) and repackaged as a standalone
 *   classic script. Every modification is listed in vendor/ATTRIBUTION.md, and
 *   the MIT licence text is reproduced there in full.
 *
 * Verified headlessly (three r160) with the deck sizes set below: builds 4382
 * structural members / 1682 nodes in ~80 ms, bounding box exactly
 * 125.00 m x 330.00 m x 125.00 m (0.000 m error on both axes), with the
 * builder's own audit reporting zero NaN transforms, zero invalid bounding
 * boxes, zero unsupported members and zero transparent materials.
 *
 * Usage (classic script, no build step):
 *   <script src="vendor/three.min.js"></script>
 *   <script src="src/eiffelTower.js"></script>
 *   const kit = EiffelTowerKit.buildEiffelTower(THREE, { detail: 'compact' });
 *   scene.add(kit.group);
 */
(function (global) {
  'use strict';

/**
 * Procedural Eiffel Tower for Three.js r183+.
 *
 * Local coordinates are metres, Y is up, and (0, 0, 0) is the centre of the
 * official 125 m square ground footprint.  The builder has no scene-global
 * dependencies and creates no transparent materials or Line primitives.
 */
const EIFFEL_OFFICIAL_DIMENSIONS = Object.freeze({
  currentHeight: 330,
  originalIronHeight: 300,
  groundWidth: 125,
  pillarGroundWidth: 25,
  firstLevel: 57,
  firstLevelArea: 4415,
  secondLevel: 115,
  secondLevelArea: 1430,
  thirdLevel: 276,
  thirdLevelArea: 250
});
function buildEiffelTower(THREE, options = {}) {
  if (!THREE || !THREE.Group || !THREE.InstancedMesh) {
    throw new TypeError('buildEiffelTower requires a Three.js namespace with Group and InstancedMesh.');
  }

  const compact = options.detail === 'compact' || options.compact === true;
  const includeLights = options.includeLights !== false;
  const fineDetailDistance = options.fineDetailDistance ?? (compact ? 300 : 520);
  const rivetDetailDistance = options.rivetDetailDistance ?? (compact ? 90 : 190);
  const tower = new THREE.Group();
  tower.name = 'EiffelTower';
  tower.userData.kind = 'authoritative-procedural-landmark';
  tower.userData.units = 'metres';
  tower.userData.officialDimensions = { ...EIFFEL_OFFICIAL_DIMENSIONS };

  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const structuralRecords = [];
  const supportSurfaces = [];
  const buckets = new Map();
  const detailMeshes = [];
  const nightLights = [];
  const nightLensMaterials = [];

  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder12 = new THREE.CylinderGeometry(1, 1, 1, 12, 1, false);
  const unitCylinder8 = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
  const unitSphere8 = new THREE.SphereGeometry(1, 8, 5);
  const unitCone8 = new THREE.CylinderGeometry(0.16, 0.55, 1, 8, 1, false);
  [unitBox, unitCylinder12, unitCylinder8, unitSphere8, unitCone8].forEach((geometry) => {
    ownedGeometries.add(geometry);
  });

  const materialOverrides = options.materials || {};
  function material(name, parameters) {
    if (materialOverrides[name]) return materialOverrides[name];
    const created = new THREE.MeshStandardMaterial(parameters);
    created.name = `Eiffel/${name}`;
    created.transparent = false;
    created.depthWrite = true;
    created.depthTest = true;
    created.side = THREE.FrontSide;
    ownedMaterials.add(created);
    return created;
  }

  function physicalMaterial(name, parameters) {
    if (materialOverrides[name]) return materialOverrides[name];
    const created = new THREE.MeshPhysicalMaterial(parameters);
    created.name = `Eiffel/${name}`;
    created.transparent = false;
    created.depthWrite = true;
    created.depthTest = true;
    created.side = THREE.FrontSide;
    ownedMaterials.add(created);
    return created;
  }

  const materials = {
    iron: material('iron', {
      color: 0x51332a,
      roughness: 0.46,
      metalness: 0.62,
      emissive: 0xffa02a,
      emissiveIntensity: 0
    }),
    ironMedium: material('ironMedium', {
      color: 0x5d3b31,
      roughness: 0.49,
      metalness: 0.57,
      emissive: 0xff8c20,
      emissiveIntensity: 0
    }),
    ironFine: material('ironFine', {
      color: 0x65443a,
      roughness: 0.53,
      metalness: 0.51,
      emissive: 0xf77919,
      emissiveIntensity: 0
    }),
    darkIron: material('darkIron', {
      color: 0x281c19,
      roughness: 0.48,
      metalness: 0.66
    }),
    foundationStone: material('foundationStone', {
      color: 0xd1c3aa,
      roughness: 0.82,
      metalness: 0.02
    }),
    foundationCap: material('foundationCap', {
      color: 0xb8aa91,
      roughness: 0.76,
      metalness: 0.03
    }),
    opaqueGlazing: material('opaqueGlazing', {
      color: 0x294247,
      roughness: 0.16,
      metalness: 0.58,
      emissive: 0x163036,
      emissiveIntensity: 0
    }),
    platformFloor: material('platformFloor', {
      color: 0x4a352a,
      roughness: 0.58,
      metalness: 0.48,
      emissive: 0xff861c,
      emissiveIntensity: 0
    }),
    bronze: material('bronze', {
      color: 0x735238,
      roughness: 0.42,
      metalness: 0.72
    }),
    champagneMetal: material('champagneMetal', {
      color: 0xa78962,
      roughness: 0.3,
      metalness: 0.86
    }),
    laminatedGlass: physicalMaterial('laminatedGlass', {
      color: 0x4f8589,
      roughness: 0.27,
      metalness: 0.28,
      transmission: 0,
      thickness: 0.3,
      ior: 1.5,
      clearcoat: 0.82,
      clearcoatRoughness: 0.24,
      envMapIntensity: 0.92,
      emissive: 0x285f65,
      emissiveIntensity: 0
    }),
    warmLens: material('warmLens', {
      color: 0xffd7a0,
      roughness: 0.3,
      metalness: 0.02,
      emissive: 0xff9d45,
      emissiveIntensity: 0.04
    })
  };
  nightLensMaterials.push(materials.warmLens);

  function addBox(name, size, position, meshMaterial, settings = {}) {
    const mesh = new THREE.Mesh(unitBox, meshMaterial);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.scale.copy(size);
    mesh.castShadow = settings.castShadow === true;
    mesh.receiveShadow = settings.receiveShadow !== false;
    mesh.frustumCulled = true;
    mesh.userData.kind = settings.kind || 'closed-solid';
    tower.add(mesh);
    detailMeshes.push(mesh);
    return mesh;
  }

  function addCylinder(name, radius, height, position, meshMaterial, settings = {}) {
    const geometry = settings.facets === 8 ? unitCylinder8 : unitCylinder12;
    const mesh = new THREE.Mesh(geometry, meshMaterial);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.scale.set(radius, height, radius);
    mesh.castShadow = settings.castShadow === true;
    mesh.receiveShadow = settings.receiveShadow !== false;
    mesh.frustumCulled = true;
    mesh.userData.kind = settings.kind || 'closed-solid';
    tower.add(mesh);
    detailMeshes.push(mesh);
    return mesh;
  }

  const bucketSettings = {
    heavy: { material: materials.iron, castShadow: true, receiveShadow: true },
    medium: { material: materials.ironMedium, castShadow: options.mediumShadows === true, receiveShadow: true },
    fine: { material: materials.ironFine, castShadow: false, receiveShadow: true, lod: fineDetailDistance },
    rail: { material: materials.darkIron, castShadow: false, receiveShadow: true, lod: fineDetailDistance },
    elevator: { material: materials.darkIron, castShadow: false, receiveShadow: true },
    stair: { material: materials.ironFine, castShadow: false, receiveShadow: true, lod: fineDetailDistance },
    antenna: { material: materials.darkIron, castShadow: false, receiveShadow: true }
  };

  for (const key of Object.keys(bucketSettings)) buckets.set(key, []);

  function finiteVector(vector) {
    return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
  }

  function queueMember(category, a, b, width, depth = width, label = category) {
    if (!buckets.has(category)) throw new Error(`Unknown Eiffel member category: ${category}`);
    const start = a.clone();
    const end = b.clone();
    const length = start.distanceTo(end);
    if (!finiteVector(start) || !finiteVector(end) || !Number.isFinite(length) || length < 0.015) {
      throw new Error(`Invalid Eiffel member "${label}".`);
    }
    const record = {
      id: structuralRecords.length,
      label,
      category,
      a: start,
      b: end,
      width: Math.max(0.035, width),
      depth: Math.max(0.035, depth),
      length
    };
    structuralRecords.push(record);
    buckets.get(category).push(record);
    return record;
  }

  function memberMatrix(record, targetMatrix) {
    const midpoint = record.a.clone().add(record.b).multiplyScalar(0.5);
    const direction = record.b.clone().sub(record.a);
    const length = direction.length();
    direction.multiplyScalar(1 / length);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );
    const scale = new THREE.Vector3(record.width, length, record.depth);
    targetMatrix.compose(midpoint, quaternion, scale);
  }

  // Four official 25 m footing zones establish the exact 125 m ground width.
  const legSigns = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1]
  ];
  for (let index = 0; index < legSigns.length; index += 1) {
    const [sx, sz] = legSigns[index];
    addBox(
      `Foundation ${index + 1} lower masonry`,
      new THREE.Vector3(25, 2.4, 25),
      new THREE.Vector3(sx * 50, 1.2, sz * 50),
      materials.foundationStone,
      { castShadow: true, kind: 'foundation' }
    );
    addBox(
      `Foundation ${index + 1} dressed plinth`,
      new THREE.Vector3(18, 2.2, 18),
      new THREE.Vector3(sx * 50, 3.5, sz * 50),
      materials.foundationCap,
      { castShadow: true, kind: 'foundation' }
    );
  }

  // The shaft silhouette is the envelope of the four leg chord boxes:
  //     outer(y) = 2 * (legSpread(y) + 1.287 * legHalfWidth(y))
  // where 1.287 = (1 + 0.82) / sqrt(2) comes from the per-chord radial and
  // tangential offsets. These upstream control points are deliberately kept
  // SLIMMER than the published two-exponential profile (Weidman & Pinelis 2004,
  // fitted to 0.94% in research/notes/01-real-tower-geometry.md). A shaft
  // widened to match that profile was trialled and rejected: it grew wider than
  // the platform decks, swallowed them, and flattened the skyline into a smooth
  // cone - the classic "pyramid / radio mast" failure. The decks below are sized
  // to the official outer dimensions instead, so every deck overhangs this
  // slimmer shaft and the skyline keeps its three crisp horizontal bars.
  // Do not "correct" these values without re-checking the decks.
  const curveControls = [
    [4.6, 50],
    [57, 28.7],
    [115, 13.8],
    [169, 8.8],
    [223, 5.8],
    [276, 3.8],
    [300, 2.75]
  ];

  function smoothstep(value) {
    return value * value * (3 - 2 * value);
  }

  function interpolateControls(y, controls) {
    if (y <= controls[0][0]) return controls[0][1];
    for (let index = 0; index < controls.length - 1; index += 1) {
      const a = controls[index];
      const b = controls[index + 1];
      if (y <= b[0]) {
        const t = smoothstep((y - a[0]) / (b[0] - a[0]));
        return THREE.MathUtils.lerp(a[1], b[1], t);
      }
    }
    return controls[controls.length - 1][1];
  }

  function legSpread(y) {
    return interpolateControls(y, curveControls);
  }

  function legHalfWidth(y) {
    const t = THREE.MathUtils.clamp((y - 4.6) / (300 - 4.6), 0, 1);
    return THREE.MathUtils.lerp(6.6, 0.48, Math.pow(t, 0.74));
  }

  const lowerNodes = compact
    ? [4.6, 13.8, 23.4, 33, 42.6, 52.2, 57]
    : [4.6, 9, 13.8, 18.6, 23.4, 28.2, 33, 37.8, 42.6, 47.4, 52.2, 57];
  const middleNodes = compact
    ? [69, 81, 93, 105, 115]
    : [63, 69, 75, 81, 87, 93, 99, 105, 110, 115];
  const upperNodes = compact
    ? [142, 169, 196, 223, 250, 276]
    : [124, 133, 142, 151, 160, 169, 178, 187, 196, 205, 214, 223, 232, 241, 250, 259, 268, 276];
  const summitNodes = [282, 288, 294, 300];
  const nodeHeights = [...lowerNodes, ...middleNodes, ...upperNodes, ...summitNodes];

  const chordDefinitions = [
    { radial: -1, tangent: -1 },
    { radial: -1, tangent: 1 },
    { radial: 1, tangent: 1 },
    { radial: 1, tangent: -1 }
  ];
  const legNodeMap = new Map();

  function legKey(sx, sz, height, chordIndex) {
    return `${sx}:${sz}:${height.toFixed(3)}:${chordIndex}`;
  }

  function legChordNode(sx, sz, y, chordIndex) {
    const key = legKey(sx, sz, y, chordIndex);
    if (legNodeMap.has(key)) return legNodeMap.get(key).clone();
    const chord = chordDefinitions[chordIndex];
    const radial = new THREE.Vector3(sx, 0, sz).normalize();
    const tangent = new THREE.Vector3(-sz, 0, sx).normalize();
    const width = legHalfWidth(y);
    const point = new THREE.Vector3(sx * legSpread(y), y, sz * legSpread(y))
      .addScaledVector(radial, chord.radial * width)
      .addScaledVector(tangent, chord.tangent * width * 0.82);
    legNodeMap.set(key, point.clone());
    return point;
  }

  function primaryThickness(y) {
    const t = THREE.MathUtils.clamp(y / 300, 0, 1);
    // The real tower's built-up chords contain several plates and angles. At
    // the Trocadéro viewing distance their combined silhouette needs at least
    // a sub-pixel physical envelope or the structure collapses to four lines.
    return THREE.MathUtils.lerp(1.42, 0.52, Math.pow(t, 0.7));
  }

  function secondaryThickness(y) {
    const t = THREE.MathUtils.clamp(y / 300, 0, 1);
    return THREE.MathUtils.lerp(0.58, 0.225, Math.pow(t, 0.68));
  }

  // Primary curved chords, leg-level ties, and two nested diagonal hierarchies.
  for (const [sx, sz] of legSigns) {
    for (let chordIndex = 0; chordIndex < 4; chordIndex += 1) {
      for (let index = 0; index < nodeHeights.length - 1; index += 1) {
        const y0 = nodeHeights[index];
        const y1 = nodeHeights[index + 1];
        const thickness = primaryThickness((y0 + y1) * 0.5);
        queueMember(
          'heavy',
          legChordNode(sx, sz, y0, chordIndex),
          legChordNode(sx, sz, y1, chordIndex),
          thickness,
          thickness * 0.72,
          `Primary chord ${sx},${sz}/${chordIndex}/${index}`
        );
      }
    }

    for (let index = 0; index < nodeHeights.length; index += 1) {
      const y = nodeHeights[index];
      const thickness = secondaryThickness(y) * 1.08;
      const nodes = [0, 1, 2, 3].map((chordIndex) => legChordNode(sx, sz, y, chordIndex));
      for (let edge = 0; edge < 4; edge += 1) {
        queueMember(
          'medium',
          nodes[edge],
          nodes[(edge + 1) % 4],
          thickness,
          thickness * 0.8,
          `Leg horizontal tie ${sx},${sz}/${index}/${edge}`
        );
      }
    }

    for (let index = 0; index < nodeHeights.length - 1; index += 1) {
      const y0 = nodeHeights[index];
      const y1 = nodeHeights[index + 1];
      const low = [0, 1, 2, 3].map((chordIndex) => legChordNode(sx, sz, y0, chordIndex));
      const high = [0, 1, 2, 3].map((chordIndex) => legChordNode(sx, sz, y1, chordIndex));
      const mediumWidth = secondaryThickness((y0 + y1) * 0.5);
      const mediumFaces = [[0, 1], [2, 3]];
      const fineFaces = [[1, 2], [3, 0]];
      for (const [aIndex, bIndex] of mediumFaces) {
        queueMember(
          'medium',
          low[aIndex],
          high[bIndex],
          mediumWidth,
          mediumWidth * 0.72,
          `Medium leg diagonal A ${sx},${sz}/${index}/${aIndex}`
        );
        queueMember(
          'medium',
          low[bIndex],
          high[aIndex],
          mediumWidth,
          mediumWidth * 0.72,
          `Medium leg diagonal B ${sx},${sz}/${index}/${aIndex}`
        );
      }
      if (!compact || index % 2 === 0 || y1 <= 57) {
        for (const [aIndex, bIndex] of fineFaces) {
          const fineWidth = mediumWidth * 0.56;
          queueMember(
            'fine',
            low[aIndex],
            high[bIndex],
            fineWidth,
            fineWidth * 0.72,
            `Fine leg diagonal A ${sx},${sz}/${index}/${aIndex}`
          );
          queueMember(
            'fine',
            low[bIndex],
            high[aIndex],
            fineWidth,
            fineWidth * 0.72,
            `Fine leg diagonal B ${sx},${sz}/${index}/${aIndex}`
          );
        }
      }
    }
  }

  function closestChordPair(sx0, sz0, sx1, sz1, y) {
    let best = null;
    for (let first = 0; first < 4; first += 1) {
      for (let second = 0; second < 4; second += 1) {
        const a = legChordNode(sx0, sz0, y, first);
        const b = legChordNode(sx1, sz1, y, second);
        const distance = a.distanceToSquared(b);
        if (!best || distance < best.distance) best = { a, b, distance };
      }
    }
    return [best.a, best.b];
  }

  function towerFacePairs(y) {
    return [
      closestChordPair(-1, -1, 1, -1, y),
      closestChordPair(1, -1, 1, 1, y),
      closestChordPair(1, 1, -1, 1, y),
      closestChordPair(-1, 1, -1, -1, y)
    ];
  }

  const galleryHeights = compact
    ? [57, 69, 81, 93, 105, 115, 142, 169, 196, 223, 250, 276, 288, 300]
    : [57, 63, 69, 75, 81, 87, 93, 99, 105, 110, 115, 124, 142, 169, 196, 223, 250, 276, 288, 300];

  for (let index = 0; index < galleryHeights.length; index += 1) {
    const y = galleryHeights[index];
    const bandWidth = Math.max(0.22, secondaryThickness(y) * 1.48);
    const faces = towerFacePairs(y);
    for (let face = 0; face < faces.length; face += 1) {
      queueMember(
        index === 0 || y === 115 || y === 276 ? 'heavy' : 'medium',
        faces[face][0],
        faces[face][1],
        bandWidth,
        bandWidth * 0.76,
        `Integrated gallery band ${y}/${face}`
      );
    }
  }

  for (let index = 0; index < galleryHeights.length - 1; index += 1) {
    const y0 = galleryHeights[index];
    const y1 = galleryHeights[index + 1];
    const lowFaces = towerFacePairs(y0);
    const highFaces = towerFacePairs(y1);
    const width = secondaryThickness((y0 + y1) * 0.5) * 0.74;
    for (let face = 0; face < 4; face += 1) {
      queueMember(
        'fine',
        lowFaces[face][0],
        highFaces[face][1],
        width,
        width * 0.72,
        `Integrated face diagonal A ${index}/${face}`
      );
      queueMember(
        'fine',
        lowFaces[face][1],
        highFaces[face][0],
        width,
        width * 0.72,
        `Integrated face diagonal B ${index}/${face}`
      );
    }
  }

  // The four Sauvestre arches are continuous physical members connected to
  // primary lower-leg chord nodes.  A parallel inner rib is tied to each arch.
  function selectOutsideChord(sx, sz, y, axis, sign) {
    let bestPoint = null;
    let bestScore = -Infinity;
    for (let chordIndex = 0; chordIndex < 4; chordIndex += 1) {
      const point = legChordNode(sx, sz, y, chordIndex);
      const outward = axis === 'x' ? point.x * sign : point.z * sign;
      const lateral = axis === 'x' ? Math.abs(point.z) : Math.abs(point.x);
      const score = outward - lateral * 0.008;
      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
      }
    }
    return bestPoint;
  }

  function buildArch(faceIndex, axis, sign, firstLeg, secondLeg) {
    const y0 = lowerNodes.includes(9) ? 9 : 13.8;
    const endpointA = selectOutsideChord(firstLeg[0], firstLeg[1], y0, axis, sign);
    const endpointB = selectOutsideChord(secondLeg[0], secondLeg[1], y0, axis, sign);
    const outward = axis === 'x'
      ? new THREE.Vector3(sign, 0, 0)
      : new THREE.Vector3(0, 0, sign);
    const innerOffset = outward.clone().multiplyScalar(-1.45);
    const segments = compact ? 12 : 18;
    const outerPoints = [];
    const innerPoints = [];

    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      const u = t * 2 - 1;
      const archRise = 42.5 * Math.pow(Math.max(0, 1 - u * u), 0.62);
      const point = endpointA.clone().lerp(endpointB, t);
      point.y = y0 + archRise;
      outerPoints.push(point);
      innerPoints.push(point.clone().add(innerOffset));
    }

    for (let step = 0; step < segments; step += 1) {
      queueMember(
        'heavy',
        outerPoints[step],
        outerPoints[step + 1],
        1.02,
        0.76,
        `Great arch ${faceIndex} outer/${step}`
      );
      queueMember(
        'medium',
        innerPoints[step],
        innerPoints[step + 1],
        0.62,
        0.48,
        `Great arch ${faceIndex} inner/${step}`
      );
      if (step % 2 === 0 || step === segments - 1) {
        queueMember(
          'medium',
          outerPoints[step],
          innerPoints[step],
          0.24,
          0.19,
          `Great arch ${faceIndex} depth tie/${step}`
        );
      }
    }
    queueMember(
      'medium',
      outerPoints[segments],
      innerPoints[segments],
      0.24,
      0.19,
      `Great arch ${faceIndex} final depth tie`
    );
  }

  buildArch(0, 'z', -1, [-1, -1], [1, -1]);
  buildArch(1, 'x', 1, [1, -1], [1, 1]);
  buildArch(2, 'z', 1, [1, 1], [-1, 1]);
  buildArch(3, 'x', -1, [-1, 1], [-1, -1]);

  function addRingPlatform(name, floorY, outer, inner, thickness, pavilionMode) {
    const edgeDepth = (outer - inner) * 0.5;
    const slabY = floorY - thickness * 0.5;
    const longCentre = outer * 0.5 - edgeDepth * 0.5;
    addBox(
      `${name} north deck`,
      new THREE.Vector3(outer, thickness, edgeDepth),
      new THREE.Vector3(0, slabY, -longCentre),
      materials.platformFloor,
      { castShadow: true, kind: 'platform-slab' }
    );
    addBox(
      `${name} south deck`,
      new THREE.Vector3(outer, thickness, edgeDepth),
      new THREE.Vector3(0, slabY, longCentre),
      materials.platformFloor,
      { castShadow: true, kind: 'platform-slab' }
    );
    addBox(
      `${name} west deck`,
      new THREE.Vector3(edgeDepth, thickness, inner),
      new THREE.Vector3(-longCentre, slabY, 0),
      materials.platformFloor,
      { castShadow: true, kind: 'platform-slab' }
    );
    addBox(
      `${name} east deck`,
      new THREE.Vector3(edgeDepth, thickness, inner),
      new THREE.Vector3(longCentre, slabY, 0),
      materials.platformFloor,
      { castShadow: true, kind: 'platform-slab' }
    );

    if (pavilionMode === 'first') {
      // The first-level glass floor is built as twelve thick laminated panels
      // spanning the inner gallery edge. Each panel sits above a champagne-
      // metal frame and never shares a plane with the opaque ring deck.
      const panelLength = 11.3;
      const panelDepth = 3.35;
      const offsets = [-12.2, 0, 12.2];
      for (const side of [-1, 1]) {
        for (const offset of offsets) {
          addBox(
            `${name} laminated glass floor north-south ${side}/${offset}`,
            new THREE.Vector3(panelLength, 0.2, panelDepth),
            new THREE.Vector3(
              offset,
              floorY + 0.12,
              side * (inner * 0.5 - panelDepth * 0.5 + 0.08)
            ),
            materials.laminatedGlass,
            { castShadow: false, receiveShadow: false, kind: 'laminated-glass-floor-panel' }
          );
          for (const frameOffset of [-panelDepth * 0.5, panelDepth * 0.5]) {
            addBox(
              `${name} glass floor longitudinal frame ${side}/${offset}/${frameOffset}`,
              new THREE.Vector3(panelLength + 0.32, 0.24, 0.16),
              new THREE.Vector3(
                offset,
                floorY - 0.02,
                side * (inner * 0.5 - panelDepth * 0.5 + 0.08) + frameOffset
              ),
              materials.champagneMetal,
              { castShadow: false, kind: 'glass-floor-support-frame' }
            );
          }
        }
      }
      for (const side of [-1, 1]) {
        for (const offset of offsets) {
          addBox(
            `${name} laminated glass floor east-west ${side}/${offset}`,
            new THREE.Vector3(panelDepth, 0.2, panelLength),
            new THREE.Vector3(
              side * (inner * 0.5 - panelDepth * 0.5 + 0.08),
              floorY + 0.12,
              offset
            ),
            materials.laminatedGlass,
            { castShadow: false, receiveShadow: false, kind: 'laminated-glass-floor-panel' }
          );
          for (const frameOffset of [-panelDepth * 0.5, panelDepth * 0.5]) {
            addBox(
              `${name} glass floor transverse frame ${side}/${offset}/${frameOffset}`,
              new THREE.Vector3(0.16, 0.24, panelLength + 0.32),
              new THREE.Vector3(
                side * (inner * 0.5 - panelDepth * 0.5 + 0.08) + frameOffset,
                floorY - 0.02,
                offset
              ),
              materials.champagneMetal,
              { castShadow: false, kind: 'glass-floor-support-frame' }
            );
          }
        }
      }
    }

    const beamHeight = Math.min(1.15, thickness * 0.48);
    const beamY = floorY - thickness - beamHeight * 0.5;
    addBox(
      `${name} north edge girder`,
      new THREE.Vector3(outer, beamHeight, 0.72),
      new THREE.Vector3(0, beamY, -outer * 0.5 + 0.36),
      materials.iron,
      { castShadow: true, kind: 'platform-girder' }
    );
    addBox(
      `${name} south edge girder`,
      new THREE.Vector3(outer, beamHeight, 0.72),
      new THREE.Vector3(0, beamY, outer * 0.5 - 0.36),
      materials.iron,
      { castShadow: true, kind: 'platform-girder' }
    );
    addBox(
      `${name} west edge girder`,
      new THREE.Vector3(0.72, beamHeight, inner),
      new THREE.Vector3(-outer * 0.5 + 0.36, beamY, 0),
      materials.iron,
      { castShadow: true, kind: 'platform-girder' }
    );
    addBox(
      `${name} east edge girder`,
      new THREE.Vector3(0.72, beamHeight, inner),
      new THREE.Vector3(outer * 0.5 - 0.36, beamY, 0),
      materials.iron,
      { castShadow: true, kind: 'platform-girder' }
    );

    supportSurfaces.push({ name, y: floorY, outer, inner });

    const postsPerSide = compact ? 8 : Math.max(10, Math.round(outer / 4.2));
    const perimeter = [];
    for (let index = 0; index < postsPerSide; index += 1) {
      const t = index / postsPerSide;
      perimeter.push(new THREE.Vector3(THREE.MathUtils.lerp(-outer * 0.5, outer * 0.5, t), floorY, -outer * 0.5));
    }
    for (let index = 0; index < postsPerSide; index += 1) {
      const t = index / postsPerSide;
      perimeter.push(new THREE.Vector3(outer * 0.5, floorY, THREE.MathUtils.lerp(-outer * 0.5, outer * 0.5, t)));
    }
    for (let index = 0; index < postsPerSide; index += 1) {
      const t = index / postsPerSide;
      perimeter.push(new THREE.Vector3(THREE.MathUtils.lerp(outer * 0.5, -outer * 0.5, t), floorY, outer * 0.5));
    }
    for (let index = 0; index < postsPerSide; index += 1) {
      const t = index / postsPerSide;
      perimeter.push(new THREE.Vector3(-outer * 0.5, floorY, THREE.MathUtils.lerp(outer * 0.5, -outer * 0.5, t)));
    }

    for (let index = 0; index < perimeter.length; index += 1) {
      const current = perimeter[index];
      const next = perimeter[(index + 1) % perimeter.length];
      const lowerPost = current.clone().setY(floorY + 0.72);
      const upperPost = current.clone().setY(floorY + 1.38);
      const postCap = current.clone().setY(floorY + 1.45);
      queueMember('rail', current, lowerPost, 0.105, 0.105, `${name} lower railing post ${index}`);
      queueMember('rail', lowerPost, upperPost, 0.105, 0.105, `${name} middle railing post ${index}`);
      queueMember('rail', upperPost, postCap, 0.105, 0.105, `${name} railing post cap ${index}`);
      queueMember(
        'rail',
        upperPost,
        next.clone().setY(floorY + 1.38),
        0.09,
        0.09,
        `${name} upper rail ${index}`
      );
      queueMember(
        'rail',
        lowerPost,
        next.clone().setY(floorY + 0.72),
        0.055,
        0.055,
        `${name} intermediate rail ${index}`
      );
    }

    if (pavilionMode === 'first') {
      const pavilionHeight = 5.4;
      const pavilionDepth = Math.max(4.2, edgeDepth - 2.2);
      addBox(
        `${name} north enclosed pavilion`,
        new THREE.Vector3(22, pavilionHeight, pavilionDepth),
        new THREE.Vector3(0, floorY + pavilionHeight * 0.5, -longCentre),
        materials.opaqueGlazing,
        { kind: 'closed-platform-enclosure' }
      );
      addBox(
        `${name} south enclosed pavilion`,
        new THREE.Vector3(22, pavilionHeight, pavilionDepth),
        new THREE.Vector3(0, floorY + pavilionHeight * 0.5, longCentre),
        materials.opaqueGlazing,
        { kind: 'closed-platform-enclosure' }
      );
      addBox(
        `${name} west mechanical enclosure`,
        new THREE.Vector3(pavilionDepth, 3.8, 12),
        new THREE.Vector3(-longCentre, floorY + 1.9, 0),
        materials.darkIron,
        { kind: 'closed-mechanical-enclosure' }
      );
      addBox(
        `${name} east mechanical enclosure`,
        new THREE.Vector3(pavilionDepth, 3.8, 12),
        new THREE.Vector3(longCentre, floorY + 1.9, 0),
        materials.darkIron,
        { kind: 'closed-mechanical-enclosure' }
      );
      for (const side of [-1, 1]) {
        const faceZ = side * (longCentre + pavilionDepth * 0.5 + 0.13);
        for (let bay = -3; bay <= 3; bay += 1) {
          addBox(
            `${name} restaurant champagne mullion ${side}/${bay}`,
            new THREE.Vector3(0.16, pavilionHeight - 0.55, 0.18),
            new THREE.Vector3(bay * 3.1, floorY + pavilionHeight * 0.5, faceZ),
            materials.champagneMetal,
            { castShadow: false, kind: 'platform-facade-mullion' }
          );
        }
        addBox(
          `${name} restaurant illuminated fascia ${side}`,
          new THREE.Vector3(22.4, 0.24, 0.2),
          new THREE.Vector3(0, floorY + pavilionHeight - 0.42, faceZ),
          materials.champagneMetal,
          { castShadow: false, kind: 'platform-facade-fascia' }
        );
      }
    } else if (pavilionMode === 'second') {
      addBox(
        `${name} enclosed observation room`,
        new THREE.Vector3(13, 4.2, Math.max(3.4, edgeDepth - 1.5)),
        new THREE.Vector3(0, floorY + 2.1, -longCentre),
        materials.opaqueGlazing,
        { kind: 'closed-platform-enclosure' }
      );
      addBox(
        `${name} enclosed service room`,
        new THREE.Vector3(10, 3.4, Math.max(3.2, edgeDepth - 1.8)),
        new THREE.Vector3(0, floorY + 1.7, longCentre),
        materials.darkIron,
        { kind: 'closed-mechanical-enclosure' }
      );
    }

    return { name, floorY, outer, inner, thickness };
  }

  // MODIFIED (see vendor/ATTRIBUTION.md): deck side lengths set to the official
  // outer dimensions so the three decks overhang the slimmer shaft above and read
  // as the three crisp horizontal bars in the skyline. Official deck sides are
  // 70.69 / 40.96 / 18.65 m at 57.63 / 115.73 / 276.13 m.
  const firstPlatform = addRingPlatform('First platform', 57, 70.69, 47.5, 2.4, 'first');
  const secondPlatform = addRingPlatform('Second platform', 115, 40.96, 25.5, 2.1, 'second');
  const thirdPlatform = addRingPlatform('Third platform', 276, 18.65, 8.4, 1.55, null);

  // Platform-to-leg transfer girders terminate at real leg nodes.
  for (const platform of [firstPlatform, secondPlatform, thirdPlatform]) {
    const faces = towerFacePairs(platform.floorY);
    for (let face = 0; face < 4; face += 1) {
      const a = faces[face][0];
      const b = faces[face][1];
      queueMember(
        'heavy',
        a,
        b,
        platform.floorY === 57 ? 1.18 : platform.floorY === 115 ? 0.78 : 0.42,
        platform.floorY === 57 ? 0.9 : platform.floorY === 115 ? 0.58 : 0.32,
        `${platform.name} load-transfer girder ${face}`
      );
    }
  }

  // Elevator tracks follow each inclined leg and are bracketed back to an
  // inner primary chord at every structural node up to the second platform.
  function closestChordToOrigin(sx, sz, y) {
    let result = null;
    let distance = Infinity;
    for (let chordIndex = 0; chordIndex < 4; chordIndex += 1) {
      const point = legChordNode(sx, sz, y, chordIndex);
      const planarDistance = point.x * point.x + point.z * point.z;
      if (planarDistance < distance) {
        distance = planarDistance;
        result = point;
      }
    }
    return result;
  }

  const elevatorNodes = nodeHeights.filter((height) => height <= 115);
  for (let legIndex = 0; legIndex < legSigns.length; legIndex += 1) {
    const [sx, sz] = legSigns[legIndex];
    const tangent = new THREE.Vector3(-sz, 0, sx).normalize();
    const rails = [-0.72, 0.72].map((offset) => elevatorNodes.map((height) => {
      const innerChord = closestChordToOrigin(sx, sz, height);
      const towardCentre = new THREE.Vector3(-innerChord.x, 0, -innerChord.z).normalize();
      return innerChord.clone().addScaledVector(towardCentre, 1.25).addScaledVector(tangent, offset);
    }));

    for (let railIndex = 0; railIndex < rails.length; railIndex += 1) {
      for (let index = 0; index < rails[railIndex].length - 1; index += 1) {
        queueMember(
          'elevator',
          rails[railIndex][index],
          rails[railIndex][index + 1],
          0.18,
          0.14,
          `Elevator track ${legIndex}/${railIndex}/${index}`
        );
      }
    }
    for (let index = 0; index < elevatorNodes.length; index += compact ? 2 : 1) {
      const support = closestChordToOrigin(sx, sz, elevatorNodes[index]);
      for (let railIndex = 0; railIndex < rails.length; railIndex += 1) {
        queueMember(
          'elevator',
          support,
          rails[railIndex][index],
          0.13,
          0.11,
          `Elevator bracket ${legIndex}/${railIndex}/${index}`
        );
      }
    }

    const cabinHeight = [27, 44, 76, 94][legIndex];
    const chord = closestChordToOrigin(sx, sz, cabinHeight);
    const towardCentre = new THREE.Vector3(-chord.x, 0, -chord.z).normalize();
    const cabinPosition = chord.clone().addScaledVector(towardCentre, 1.25);
    addBox(
      `Elevator cabin ${legIndex + 1}`,
      new THREE.Vector3(2.7, 3.6, 2.7),
      cabinPosition,
      materials.bronze,
      { kind: 'elevator-cabin' }
    );
  }

  // A selected low-level stair flight is visible inside the south-east leg.
  const stairLeg = [1, -1];
  const stairTangent = new THREE.Vector3(1, 0, 1).normalize();
  const stairNodes = [];
  const stairStepCount = compact ? 18 : 28;
  for (let index = 0; index <= stairStepCount; index += 1) {
    const t = index / stairStepCount;
    const y = THREE.MathUtils.lerp(4.6, 57, t);
    const centre = closestChordToOrigin(stairLeg[0], stairLeg[1], y);
    const inward = new THREE.Vector3(-centre.x, 0, -centre.z).normalize();
    const point = centre.clone().addScaledVector(inward, 2.15);
    stairNodes.push([
      point.clone().addScaledVector(stairTangent, -1.15),
      point.clone().addScaledVector(stairTangent, 1.15)
    ]);
  }
  for (let index = 0; index < stairNodes.length; index += 1) {
    queueMember('stair', stairNodes[index][0], stairNodes[index][1], 0.12, 0.42, `Visible stair tread ${index}`);
    if (index < stairNodes.length - 1) {
      queueMember('stair', stairNodes[index][0], stairNodes[index + 1][0], 0.16, 0.12, `Visible stair stringer A ${index}`);
      queueMember('stair', stairNodes[index][1], stairNodes[index + 1][1], 0.16, 0.12, `Visible stair stringer B ${index}`);
    }
  }
  queueMember(
    'stair',
    closestChordToOrigin(stairLeg[0], stairLeg[1], 4.6),
    stairNodes[0][0],
    0.17,
    0.14,
    'Visible stair foundation bracket'
  );

  // Closed upper observation and mechanical volumes.
  addBox(
    'Upper observation lower enclosure',
    new THREE.Vector3(13.8, 5.4, 13.8),
    new THREE.Vector3(0, 278.7, 0),
    materials.laminatedGlass,
    { castShadow: false, kind: 'closed-observation-enclosure' }
  );
  addBox(
    'Upper observation middle frame',
    new THREE.Vector3(10.8, 5.2, 10.8),
    new THREE.Vector3(0, 284, 0),
    materials.iron,
    { castShadow: false, kind: 'closed-observation-enclosure' }
  );
  for (const side of [-1, 1]) {
    addBox(
      `Gustave Eiffel summit salon champagne band ${side}`,
      new THREE.Vector3(14.4, 0.3, 0.24),
      new THREE.Vector3(0, 280.5, side * 7.03),
      materials.champagneMetal,
      { castShadow: false, kind: 'summit-salon-frame' }
    );
    addBox(
      `Gustave Eiffel summit salon side band ${side}`,
      new THREE.Vector3(0.24, 0.3, 14.4),
      new THREE.Vector3(side * 7.03, 280.5, 0),
      materials.champagneMetal,
      { castShadow: false, kind: 'summit-salon-frame' }
    );
  }
  addBox(
    'Summit equipment enclosure',
    new THREE.Vector3(8.4, 6.8, 8.4),
    new THREE.Vector3(0, 290, 0),
    materials.darkIron,
    { castShadow: false, kind: 'closed-mechanical-enclosure' }
  );
  addBox(
    'Summit crown deck',
    new THREE.Vector3(7.2, 1.1, 7.2),
    new THREE.Vector3(0, 299.45, 0),
    materials.iron,
    { castShadow: false, kind: 'platform-slab' }
  );
  supportSurfaces.push({ name: 'Summit crown deck', y: 300, outer: 7.2, inner: 0 });

  // Antenna truss and mast complete the current official 330 m height.
  const antennaBase = [
    new THREE.Vector3(-3.2, 300, -3.2),
    new THREE.Vector3(3.2, 300, -3.2),
    new THREE.Vector3(3.2, 300, 3.2),
    new THREE.Vector3(-3.2, 300, 3.2)
  ];
  const antennaShoulder = [
    new THREE.Vector3(-1.05, 311.5, -1.05),
    new THREE.Vector3(1.05, 311.5, -1.05),
    new THREE.Vector3(1.05, 311.5, 1.05),
    new THREE.Vector3(-1.05, 311.5, 1.05)
  ];
  for (let index = 0; index < 4; index += 1) {
    queueMember('antenna', antennaBase[index], antennaShoulder[index], 0.22, 0.18, `Antenna truss chord ${index}`);
    queueMember(
      'antenna',
      antennaBase[index],
      antennaShoulder[(index + 1) % 4],
      0.1,
      0.08,
      `Antenna truss diagonal ${index}`
    );
    queueMember(
      'antenna',
      antennaShoulder[index],
      antennaShoulder[(index + 1) % 4],
      0.12,
      0.1,
      `Antenna shoulder ring ${index}`
    );
  }
  addCylinder(
    'Communications mast',
    0.46,
    14.5,
    new THREE.Vector3(0, 318.75, 0),
    materials.darkIron,
    { facets: 12, kind: 'antenna-mast' }
  );
  const tip = new THREE.Mesh(unitCone8, materials.darkIron);
  tip.name = 'Antenna terminal';
  tip.position.set(0, 328, 0);
  tip.scale.set(1, 4, 1);
  tip.castShadow = false;
  tip.receiveShadow = true;
  tip.userData.kind = 'antenna-terminal';
  tower.add(tip);
  detailMeshes.push(tip);

  const ringGeometry = new THREE.TorusGeometry(1, 0.08, 5, 18);
  ownedGeometries.add(ringGeometry);
  for (const [index, y] of [312.3, 318.2, 324.2].entries()) {
    const ring = new THREE.Mesh(ringGeometry, materials.darkIron);
    ring.name = `Communications ring ${index + 1}`;
    ring.position.set(0, y, 0);
    ring.scale.setScalar(1.22 - index * 0.2);
    ring.rotation.x = Math.PI * 0.5;
    ring.castShadow = false;
    ring.receiveShadow = true;
    ring.userData.kind = 'antenna-detail';
    tower.add(ring);
    detailMeshes.push(ring);
  }

  // Platform and gallery lenses are opaque emissive solids, never transparent.
  const lensMatrices = [];
  function queueLens(position, scale) {
    const matrix = new THREE.Matrix4();
    matrix.compose(position, new THREE.Quaternion(), scale);
    lensMatrices.push(matrix);
  }
  for (const [floorY, outer] of [[57, 68], [115, 39], [276, 16]]) {
    const count = compact ? 5 : 8;
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count;
      const axisPosition = THREE.MathUtils.lerp(-outer * 0.42, outer * 0.42, t);
      queueLens(new THREE.Vector3(axisPosition, floorY + 0.38, -outer * 0.5 - 0.11), new THREE.Vector3(0.24, 0.18, 0.12));
      queueLens(new THREE.Vector3(axisPosition, floorY + 0.38, outer * 0.5 + 0.11), new THREE.Vector3(0.24, 0.18, 0.12));
      queueLens(new THREE.Vector3(-outer * 0.5 - 0.11, floorY + 0.38, axisPosition), new THREE.Vector3(0.12, 0.18, 0.24));
      queueLens(new THREE.Vector3(outer * 0.5 + 0.11, floorY + 0.38, axisPosition), new THREE.Vector3(0.12, 0.18, 0.24));
    }
  }
  const lensMesh = new THREE.InstancedMesh(unitBox, materials.warmLens, lensMatrices.length);
  lensMesh.name = 'Tower platform light lenses';
  for (let index = 0; index < lensMatrices.length; index += 1) lensMesh.setMatrixAt(index, lensMatrices[index]);
  lensMesh.instanceMatrix.needsUpdate = true;
  lensMesh.castShadow = false;
  lensMesh.receiveShadow = false;
  lensMesh.frustumCulled = true;
  lensMesh.userData.kind = 'opaque-emissive-lenses';
  tower.add(lensMesh);

  // Rivet suggestion is restricted to high-value platform and gallery nodes.
  const rivetPositions = [];
  const rivetScales = [];
  const rivetLevels = compact ? [57, 115, 276] : [57, 81, 115, 169, 223, 276];
  for (const y of rivetLevels) {
    const faces = towerFacePairs(y);
    for (const face of faces) {
      for (const point of face) {
        rivetPositions.push(point.clone().add(new THREE.Vector3(0, 0.18, 0)));
        rivetScales.push(y <= 115 ? 0.16 : 0.1);
        rivetPositions.push(point.clone().add(new THREE.Vector3(0, -0.18, 0)));
        rivetScales.push(y <= 115 ? 0.16 : 0.1);
      }
    }
  }
  const rivetMesh = new THREE.InstancedMesh(unitSphere8, materials.bronze, rivetPositions.length);
  rivetMesh.name = 'Selected structural rivets';
  const rivetMatrix = new THREE.Matrix4();
  for (let index = 0; index < rivetPositions.length; index += 1) {
    rivetMatrix.compose(
      rivetPositions[index],
      new THREE.Quaternion(),
      new THREE.Vector3(rivetScales[index], rivetScales[index], rivetScales[index])
    );
    rivetMesh.setMatrixAt(index, rivetMatrix);
  }
  rivetMesh.instanceMatrix.needsUpdate = true;
  rivetMesh.castShadow = false;
  rivetMesh.receiveShadow = true;
  rivetMesh.userData.kind = 'instanced-rivet-detail';
  const rivetLod = new THREE.LOD();
  rivetLod.name = 'Rivet detail LOD';
  rivetLod.addLevel(rivetMesh, 0);
  const emptyRivetLevel = new THREE.Group();
  emptyRivetLevel.name = 'Rivet detail culled';
  rivetLod.addLevel(emptyRivetLevel, rivetDetailDistance);
  tower.add(rivetLod);

  // Instantiate every physical bar after all categories have been assembled.
  const memberInstanceCounts = {};
  for (const [category, records] of buckets.entries()) {
    memberInstanceCounts[category] = records.length;
    if (records.length === 0) continue;
    const settings = bucketSettings[category];
    const instanced = new THREE.InstancedMesh(unitBox, settings.material, records.length);
    instanced.name = `Eiffel ${category} structural members`;
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < records.length; index += 1) {
      memberMatrix(records[index], matrix);
      instanced.setMatrixAt(index, matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.castShadow = settings.castShadow;
    instanced.receiveShadow = settings.receiveShadow;
    instanced.frustumCulled = true;
    instanced.userData.kind = 'instanced-physical-structural-members';
    instanced.userData.memberCategory = category;
    instanced.userData.memberCount = records.length;
    if (settings.lod) {
      const lod = new THREE.LOD();
      lod.name = `Eiffel ${category} LOD`;
      lod.addLevel(instanced, 0);
      const empty = new THREE.Group();
      empty.name = `Eiffel ${category} culled`;
      lod.addLevel(empty, settings.lod);
      tower.add(lod);
    } else {
      tower.add(instanced);
    }
  }

  if (includeLights) {
    for (let index = 0; index < legSigns.length; index += 1) {
      const [sx, sz] = legSigns[index];
      const light = new THREE.SpotLight(0xffb36a, 0, 245, Math.PI * 0.115, 0.62, 1.7);
      light.name = `Tower architectural uplight ${index + 1}`;
      light.position.set(sx * 53, 5.4, sz * 53);
      light.castShadow = false;
      light.userData.nightIntensity = compact ? 1320 : 1980;
      const target = new THREE.Object3D();
      target.name = `Tower uplight target ${index + 1}`;
      target.position.set(sx * 3.5, 204, sz * 3.5);
      tower.add(target);
      light.target = target;
      tower.add(light);
      nightLights.push(light);
    }
    for (const [index, y] of [57.8, 115.7, 276.5].entries()) {
      const light = new THREE.PointLight(0xffc078, 0, index === 2 ? 24 : 42, 2);
      light.name = `Tower platform practical ${index + 1}`;
      light.position.set(0, y, 0);
      light.castShadow = false;
      light.userData.nightIntensity = compact ? 46 : 72;
      tower.add(light);
      nightLights.push(light);
    }
  }

  function nodeKey(point) {
    const quantum = 1000;
    return `${Math.round(point.x * quantum)}:${Math.round(point.y * quantum)}:${Math.round(point.z * quantum)}`;
  }

  function pointOnSupportSurface(point) {
    const tolerance = 0.035;
    for (const surface of supportSurfaces) {
      if (Math.abs(point.y - surface.y) > tolerance) continue;
      const ax = Math.abs(point.x);
      const az = Math.abs(point.z);
      const withinOuter = ax <= surface.outer * 0.5 + tolerance && az <= surface.outer * 0.5 + tolerance;
      const onRing = surface.inner <= 0 || ax >= surface.inner * 0.5 - tolerance || az >= surface.inner * 0.5 - tolerance;
      if (withinOuter && onRing) return true;
    }
    return false;
  }

  function auditStructuralSupport() {
    const adjacency = new Map();
    const pointsByKey = new Map();
    function addEdge(a, b) {
      const ka = nodeKey(a);
      const kb = nodeKey(b);
      if (!adjacency.has(ka)) adjacency.set(ka, new Set());
      if (!adjacency.has(kb)) adjacency.set(kb, new Set());
      adjacency.get(ka).add(kb);
      adjacency.get(kb).add(ka);
      pointsByKey.set(ka, a);
      pointsByKey.set(kb, b);
    }
    for (const record of structuralRecords) addEdge(record.a, record.b);

    const supported = new Set();
    const queue = [];
    for (const [key, point] of pointsByKey.entries()) {
      if (point.y <= 4.635 || pointOnSupportSurface(point)) {
        supported.add(key);
        queue.push(key);
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const key = queue[cursor];
      for (const neighbour of adjacency.get(key) || []) {
        if (supported.has(neighbour)) continue;
        supported.add(neighbour);
        queue.push(neighbour);
      }
    }

    const unsupported = [];
    for (const record of structuralRecords) {
      if (!supported.has(nodeKey(record.a)) && !supported.has(nodeKey(record.b))) {
        unsupported.push({
          id: record.id,
          label: record.label,
          category: record.category,
          minimumHeight: Math.min(record.a.y, record.b.y)
        });
      }
    }
    return {
      structuralNodeCount: pointsByKey.size,
      supportedNodeCount: supported.size,
      unsupported
    };
  }

  function geometryBoundaryCount(geometry) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) return 0;
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const welded = new Map();
    const vertexKeys = [];
    const precision = 100000;
    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const key = `${Math.round(positions.getX(vertex) * precision)}:${Math.round(positions.getY(vertex) * precision)}:${Math.round(positions.getZ(vertex) * precision)}`;
      if (!welded.has(key)) welded.set(key, welded.size);
      vertexKeys[vertex] = welded.get(key);
    }
    const edgeCounts = new Map();
    function addEdge(a, b) {
      if (a === b) return;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
    }
    const triangleCount = index ? index.count / 3 : positions.count / 3;
    for (let triangle = 0; triangle < triangleCount; triangle += 1) {
      const ia = index ? index.getX(triangle * 3) : triangle * 3;
      const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
      const a = vertexKeys[ia];
      const b = vertexKeys[ib];
      const c = vertexKeys[ic];
      addEdge(a, b);
      addEdge(b, c);
      addEdge(c, a);
    }
    let boundaryCount = 0;
    for (const count of edgeCounts.values()) if (count !== 2) boundaryCount += 1;
    return boundaryCount;
  }

  tower.updateMatrixWorld(true);
  const supportAudit = auditStructuralSupport();
  const openGeometryMeshes = [];
  const auditedGeometries = new Set();
  tower.traverse((object) => {
    if (!object.isMesh || !object.geometry || auditedGeometries.has(object.geometry.uuid)) return;
    auditedGeometries.add(object.geometry.uuid);
    const boundaryEdges = geometryBoundaryCount(object.geometry);
    if (boundaryEdges > 0) openGeometryMeshes.push({ name: object.name, boundaryEdges });
  });

  const nanTransforms = [];
  const invalidBoundingBoxes = [];
  tower.traverse((object) => {
    if (!object.matrixWorld.elements.every(Number.isFinite)) nanTransforms.push(object.name || object.type);
    if (!object.isMesh) return;
    const objectBounds = new THREE.Box3().setFromObject(object);
    if (
      !finiteVector(objectBounds.min) ||
      !finiteVector(objectBounds.max) ||
      objectBounds.isEmpty()
    ) {
      invalidBoundingBoxes.push(object.name || object.type);
    }
  });

  const bounds = new THREE.Box3().setFromObject(tower);
  const boundsSize = bounds.getSize(new THREE.Vector3());
  const metadata = {
    sourceBasis: 'Official Eiffel Tower published dimensions and historical engineering descriptions',
    dimensions: { ...EIFFEL_OFFICIAL_DIMENSIONS },
    levelHeights: [57, 115, 276],
    calculatedBounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: boundsSize.toArray()
    },
    towerHeight: boundsSize.y,
    towerBaseWidth: Math.max(boundsSize.x, boundsSize.z),
    foundationCount: 4,
    archCount: 4,
    publicPlatformCount: 3,
    towerStructuralMemberCount: structuralRecords.length,
    structuralNodeCount: supportAudit.structuralNodeCount,
    supportedStructuralNodeCount: supportAudit.supportedNodeCount,
    unsupportedTowerMembers: supportAudit.unsupported,
    memberInstanceCounts,
    rivetInstanceCount: rivetPositions.length,
    platformLensInstanceCount: lensMatrices.length,
    firstLevelGlassFloorPanelCount: 12,
    openGeometryMeshes,
    nanTransforms,
    invalidBoundingBoxes,
    transparentMaterialCount: Object.values(materials).filter((entry) => entry.transparent).length,
    linePrimitiveCount: 0,
    compact
  };
  tower.userData.metadata = metadata;

  function setNightMix(value) {
    const mix = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
    // Night character comes from the four real tower uplights and platform
    // practicals. The small absolute emissive floor keeps individual members
    // legible without flattening the lattice into an orange silhouette.
    materials.iron.emissiveIntensity = THREE.MathUtils.lerp(0, 0.92, mix);
    materials.ironMedium.emissiveIntensity = THREE.MathUtils.lerp(0, 0.55, mix);
    materials.ironFine.emissiveIntensity = THREE.MathUtils.lerp(0, 0.2, mix);
    materials.platformFloor.emissiveIntensity = THREE.MathUtils.lerp(0, 0.18, mix);
    materials.laminatedGlass.emissiveIntensity = THREE.MathUtils.lerp(0, 0.12, mix);
    materials.opaqueGlazing.emissiveIntensity = THREE.MathUtils.lerp(0, 0.12, mix);
    materials.warmLens.emissiveIntensity = THREE.MathUtils.lerp(0.04, 3.8, mix);
    for (const light of nightLights) {
      light.intensity = (light.userData.nightIntensity || 0) * mix;
    }
    tower.userData.nightMix = mix;
  }

  function dispose() {
    for (const geometry of ownedGeometries) geometry.dispose();
    for (const entry of ownedMaterials) entry.dispose();
  }

  setNightMix(options.nightMix ?? 0);

  return {
    group: tower,
    metadata,
    materials,
    nightLights,
    setNightMix,
    dispose
  };
}

  global.EiffelTowerKit = {
    buildEiffelTower: buildEiffelTower,
    EIFFEL_OFFICIAL_DIMENSIONS: EIFFEL_OFFICIAL_DIMENSIONS
  };
})(typeof window !== 'undefined' ? window : globalThis);
