import * as THREE from 'three';
import { mulberry32, range, pick, chance } from './rng.js';

const TAU = Math.PI * 2;

function hsl(h, s, l) {
  return new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s, l);
}

export function createTerrain() {
  const group = new THREE.Group();
  group.name = 'terrain';
  const rng = mulberry32(48119);

  const rock = new THREE.MeshStandardMaterial({ color: 0x1d2334, roughness: 0.88, metalness: 0.12, flatShading: true });
  const rockWarm = new THREE.MeshStandardMaterial({ color: 0x31283a, roughness: 0.9, metalness: 0.08, flatShading: true });
  const topA = new THREE.MeshStandardMaterial({ color: 0x123e3a, roughness: 0.76, metalness: 0.08, emissive: 0x061c1b, emissiveIntensity: 0.8 });
  const topB = new THREE.MeshStandardMaterial({ color: 0x182f4c, roughness: 0.72, metalness: 0.12, emissive: 0x071426, emissiveIntensity: 0.8 });
  const path = new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.48, blending: THREE.AdditiveBlending, depthWrite: false });
  const pathDim = new THREE.MeshBasicMaterial({ color: 0x7dffe3, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const water = new THREE.MeshStandardMaterial({ color: 0x0a7a87, emissive: 0x07545d, emissiveIntensity: 1.5, transparent: true, opacity: 0.72, roughness: 0.13, metalness: 0.34 });

  // Underside of the floating island.
  const underProfile = [
    [0, -56], [8, -52], [16, -44], [24, -34], [34, -24], [42, -14], [49, -7], [54, -1],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const underside = new THREE.Mesh(new THREE.LatheGeometry(underProfile, 56), rock);
  underside.receiveShadow = true;
  underside.castShadow = true;
  group.add(underside);

  const levels = [
    { radius: 55, top: 1.5, height: 6, material: topA },
    { radius: 40, top: 7.5, height: 7, material: topB },
    { radius: 27, top: 14, height: 7, material: topA },
    { radius: 16, top: 20, height: 6, material: topB },
  ];

  levels.forEach((level, index) => {
    const wallRadius = level.radius + (index === 0 ? 1.5 : 0.8);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(level.radius, wallRadius, level.height, 64, 2), index % 2 ? rockWarm : rock);
    wall.position.y = level.top - level.height / 2;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const cap = new THREE.Mesh(new THREE.CircleGeometry(level.radius + 0.04, 64), level.material);
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = level.top + 0.015;
    cap.receiveShadow = true;
    group.add(cap);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(level.radius + 0.2, 0.18, 4, 80), index % 2 ? path : pathDim);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = level.top + 0.1;
    group.add(rim);

    // Stratified cliff ribs: the drums stop reading as clean cylinders.
    const ribCount = 14 + index * 3;
    for (let i = 0; i < ribCount; i++) {
      const a = (i / ribCount) * TAU + index * 0.17;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.35 + (i % 3) * 0.14, level.height * (0.62 + (i % 4) * 0.08), 0.72 + (i % 2) * 0.28),
        i % 4 === 0 ? rockWarm : rock
      );
      rib.position.set(Math.sin(a) * (level.radius + 0.18), level.top - level.height * 0.5, Math.cos(a) * (level.radius + 0.18));
      rib.rotation.y = -a;
      rib.rotation.z = (i % 5 - 2) * 0.012;
      rib.castShadow = true;
      rib.receiveShadow = true;
      group.add(rib);
      if (i % 3 === 0) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.045, level.height * 0.54, 0.045), pathDim);
        seam.position.set(Math.sin(a + 0.035) * (level.radius + 0.46), level.top - level.height * 0.52, Math.cos(a + 0.035) * (level.radius + 0.46));
        group.add(seam);
      }
    }

    // Railings and edge lanterns: a human-scale cue on every terrace.
    const postCount = 18;
    for (let i = 0; i < postCount; i++) {
      const a = (i / postCount) * TAU + 0.08;
      const r = level.radius - 0.9;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.085, 0.95, 4), rockWarm);
      post.position.set(Math.sin(a) * r, level.top + 0.52, Math.cos(a) * r);
      post.castShadow = true;
      group.add(post);
      group.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), i % 3 === 0 ? path : pathDim).translateX(Math.sin(a) * r).translateY(level.top + 1.02).translateZ(Math.cos(a) * r));
    }
    const rail = new THREE.Mesh(new THREE.TorusGeometry(level.radius - 0.9, 0.045, 3, 80), pathDim);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = level.top + 0.82;
    group.add(rail);

    // Radial paths on this terrace.
    const count = 10 - index;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + index * 0.2;
      const inner = level.radius * 0.22;
      const outer = level.radius * 0.83;
      const length = outer - inner;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, length), pathDim);
      strip.position.set(Math.sin(a) * (inner + length / 2), level.top + 0.2, Math.cos(a) * (inner + length / 2));
      strip.rotation.y = -a;
      group.add(strip);
    }

    // Steps between the terraces.
    if (index > 0) {
      const a = 0.35 + index * 1.1;
      const stair = new THREE.Group();
      const stairX = Math.sin(a) * (level.radius + 2.5);
      const stairZ = Math.cos(a) * (level.radius + 2.5);
      for (let s = 0; s < 5; s++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.7, 2.4), rockWarm);
        box.position.set(0, -s * 0.65, s * 1.8);
        box.castShadow = true;
        stair.add(box);
      }
      stair.position.set(stairX, level.top - 2.8, stairZ);
      stair.rotation.y = -a;
      group.add(stair);
    }
  });

  // Front-face composition: ledges, hanging growth and a carved glyph panel.
  const frontAngle = 0.86;
  for (const [angle, y, width] of [[frontAngle, 0.45, 13], [frontAngle, -1.6, 9], [2.4, 0.3, 7], [5.1, -0.7, 6]]) {
    const ledge = new THREE.Group();
    const r = 57.1;
    ledge.position.set(Math.sin(angle) * r, y, Math.cos(angle) * r);
    ledge.rotation.y = -angle;
    ledge.add(new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, 3.2), rockWarm));
    for (let i = 0; i < 4; i++) {
      const x = -width / 2 + 0.6 + i * (width - 1.2) / 3;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.9, 4), rockWarm);
      post.position.set(x, 0.7, 1.3);
      ledge.add(post);
      ledge.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 5, 4), path).translateX(x).translateY(1.18).translateZ(1.3));
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, 0.05), pathDim);
    rail.position.set(0, 0.65, 1.3);
    ledge.add(rail);
    group.add(ledge);
  }

  // Hanging vines and lit growth on the cliff face.
  for (let i = 0; i < 22; i++) {
    const a = frontAngle + range(rng, -0.85, 0.85);
    const r = range(rng, 56.8, 58.4);
    const length = range(rng, 2, 8);
    const pts = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      pts.push(new THREE.Vector3(Math.sin(a) * r, 1.3 - u * length, Math.cos(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const vine = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.04, 4, false), i % 3 === 0 ? pathDim : new THREE.MeshBasicMaterial({ color: 0x2e8e75, transparent: true, opacity: 0.55 }));
    group.add(vine);
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), i % 2 ? path : pathDim).translateX(pts[pts.length - 1].x).translateY(pts[pts.length - 1].y).translateZ(pts[pts.length - 1].z));
  }

  // Carved glyph panel on the front wall.
  const glyphCanvas = document.createElement('canvas');
  glyphCanvas.width = 512; glyphCanvas.height = 256;
  const glyphCtx = glyphCanvas.getContext('2d');
  glyphCtx.clearRect(0, 0, 512, 256);
  glyphCtx.strokeStyle = 'rgba(125,255,226,0.8)';
  glyphCtx.lineWidth = 4;
  glyphCtx.shadowColor = 'rgba(125,255,226,0.65)';
  glyphCtx.shadowBlur = 12;
  for (let i = 0; i < 18; i++) {
    const x = 26 + (i % 9) * 52;
    const y = 42 + Math.floor(i / 9) * 92;
    glyphCtx.beginPath();
    glyphCtx.moveTo(x, y);
    glyphCtx.lineTo(x + range(rng, -16, 26), y + range(rng, -22, 28));
    glyphCtx.lineTo(x + range(rng, -8, 30), y + range(rng, -14, 34));
    glyphCtx.stroke();
  }
  const glyphTex = new THREE.CanvasTexture(glyphCanvas);
  glyphTex.colorSpace = THREE.SRGBColorSpace;
  const glyphPlane = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), new THREE.MeshBasicMaterial({ map: glyphTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glyphPlane.position.set(Math.sin(frontAngle) * 57.0, 0.35, Math.cos(frontAngle) * 57.0);
  glyphPlane.rotation.y = -frontAngle;
  group.add(glyphPlane);

  // Horizontal strata bands catch the core light on the silhouette.
  for (const [y, radius, opacity] of [[0.7, 56.9, 0.34], [-0.8, 57.4, 0.2], [-2.6, 58.2, 0.12]]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 4, 90), new THREE.MeshBasicMaterial({ color: 0x7dffe3, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  // The approach causeway: a foreground spine that gives the island an edge.
  const approach = new THREE.Group();
  const approachAngle = 0.86;
  const approachPoints = [55, 62, 69, 76, 82].map((r, i) => new THREE.Vector3(
    Math.sin(approachAngle - i * 0.025) * r,
    1.65 - i * 0.16,
    Math.cos(approachAngle - i * 0.025) * r
  ));
  const approachCurve = new THREE.CatmullRomCurve3(approachPoints);
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const p = approachCurve.getPointAt(t);
    const tangent = approachCurve.getTangentAt(t);
    const yaw = Math.atan2(tangent.x, tangent.z);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.38, 4.1), i % 3 === 0 ? rockWarm : rock);
    deck.position.copy(p);
    deck.rotation.y = yaw;
    deck.castShadow = true;
    deck.receiveShadow = true;
    approach.add(deck);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.04, 0.08), pathDim);
    glow.position.copy(p).add(new THREE.Vector3(0, 0.23, 0));
    glow.rotation.y = yaw;
    approach.add(glow);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 1.15, 4), rockWarm);
      post.position.copy(p).add(new THREE.Vector3(Math.cos(yaw) * side * 2.55, 0.7, -Math.sin(yaw) * side * 2.55));
      approach.add(post);
      if (i % 2 === 0) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 4), path);
        lamp.position.copy(post.position).add(new THREE.Vector3(0, 0.55, 0));
        approach.add(lamp);
      }
    }
  }
  const landing = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.8, 0.7, 12), rockWarm);
  landing.position.set(approachPoints[4].x, approachPoints[4].y - 0.1, approachPoints[4].z);
  landing.castShadow = true;
  approach.add(landing);
  const landingRim = new THREE.Mesh(new THREE.TorusGeometry(6.8, 0.18, 4, 40), path);
  landingRim.rotation.x = Math.PI / 2;
  landingRim.position.copy(landing.position).add(new THREE.Vector3(0, 0.42, 0));
  approach.add(landingRim);
  const entryArch = new THREE.Group();
  entryArch.position.copy(landing.position);
  entryArch.rotation.y = Math.PI / 2 + approachAngle;
  const archMetal = new THREE.MeshStandardMaterial({ color: 0x4a5268, roughness: 0.45, metalness: 0.5, emissive: 0x111b2b, emissiveIntensity: 0.7, flatShading: true });
  for (const x of [-4.6, 4.6]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 9, 1.6), archMetal);
    pillar.position.set(x, 4.5, 0);
    entryArch.add(pillar);
  }
  const entryRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.28, 5, 36, Math.PI), archMetal);
  entryRing.position.y = 9;
  entryArch.add(entryRing);
  approach.add(entryArch);
  group.add(approach);
  // Edge boulders.
  for (let i = 0; i < 42; i++) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 47, 60);
    const s = range(rng, 1.2, 5.4);
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), chance(rng, 0.35) ? rockWarm : rock);
    boulder.position.set(Math.sin(a) * r, range(rng, -4, 2.8) - s * 0.3, Math.cos(a) * r);
    boulder.rotation.set(range(rng, 0, TAU), range(rng, 0, TAU), range(rng, 0, TAU));
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    group.add(boulder);
  }

  // Pools on the lower and middle terraces.
  const pools = [
    { x: -23, z: 16, r: 8.5, y: 1.75 },
    { x: 21, z: 17, r: 5.2, y: 7.75 },
    { x: -15, z: -24, r: 4.6, y: 7.75 },
  ];
  for (const pool of pools) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(pool.r, 48), water);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pool.x, pool.y, pool.z);
    group.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(pool.r + 0.18, 0.18, 4, 48), path);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pool.x, pool.y + 0.1, pool.z);
    group.add(ring);
  }

  // A few stones and coral shelves around the rim.
  for (let i = 0; i < 22; i++) {
    const a = range(rng, 0, TAU);
    const r = range(rng, 28, 50);
    const y = r > 38 ? 1.7 : 7.7;
    const s = range(rng, 0.4, 1.4);
    const crystal = new THREE.Mesh(
      new THREE.ConeGeometry(s, s * range(rng, 3, 7), pick(rng, [4, 5, 6])),
      new THREE.MeshStandardMaterial({ color: hsl(range(rng, 160, 220), 0.4, 0.2), emissive: 0x0c3a44, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.4, flatShading: true })
    );
    crystal.position.set(Math.sin(a) * r, y + s * 2, Math.cos(a) * r);
    crystal.rotation.set(range(rng, -0.15, 0.15), range(rng, 0, TAU), range(rng, -0.15, 0.15));
    crystal.castShadow = true;
    group.add(crystal);
  }

  // Three service walkways crossing the terraces at different heights.
  for (let bridge = 0; bridge < 3; bridge++) {
    const a = 0.2 + bridge * 2.1;
    const inner = 16;
    const outer = 41;
    const y1 = 20.05;
    const y2 = 7.7;
    const points = [
      new THREE.Vector3(Math.sin(a) * inner, y1, Math.cos(a) * inner),
      new THREE.Vector3(Math.sin(a + 0.18) * 27, (y1 + y2) / 2 + 3, Math.cos(a + 0.18) * 27),
      new THREE.Vector3(Math.sin(a) * outer, y2, Math.cos(a) * outer),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.26, 5, false), new THREE.MeshStandardMaterial({ color: 0x2b374c, roughness: 0.55, metalness: 0.5, flatShading: true }));
    tube.castShadow = true;
    group.add(tube);
    const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.06, 4, false), path);
    group.add(glow);
  }

  return { group };
}
