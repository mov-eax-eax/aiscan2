/* Materials. Deliberately few: a modern target bow is matte black anodised
   aluminium, carbon laminate and a splash of anodised colour. */
import * as THREE from '../../vendor/three.module.js';

const M = (o) => new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.55, ...o });

export const MAT = {
  /* riser: matt black anodise on the outer rim ... */
  riserOuter: M({ color: 0x1b1d20, metalness: 0.55, roughness: 0.52 }),
  /* ... and the bright anodised inner faces seen through the windows */
  riserInner: M({ color: 0x8e1f24, metalness: 0.82, roughness: 0.28, side: THREE.DoubleSide }),
  /* limb: carbon laminate, satin */
  limb: M({ color: 0x232528, metalness: 0.30, roughness: 0.42 }),
  limbEdge: M({ color: 0x3a3d42, metalness: 0.35, roughness: 0.35 }),
  /* string: pale, slightly waxy */
  string: M({ color: 0xd9d4c8, metalness: 0.0, roughness: 0.85 }),
  serving: M({ color: 0x2c2c30, metalness: 0.0, roughness: 0.9 }),
  /* black machined hardware: sight, stabiliser shafts, clicker */
  black: M({ color: 0x131417, metalness: 0.65, roughness: 0.38 }),
  steel: M({ color: 0x9aa0a6, metalness: 0.95, roughness: 0.22 }),
  gold: M({ color: 0xb08d3f, metalness: 0.95, roughness: 0.25 }),
  rubber: M({ color: 0x2a2c2f, metalness: 0.0, roughness: 0.95 }),
  /* arrow */
  shaft: M({ color: 0x1e2124, metalness: 0.35, roughness: 0.40 }),
  fletch: M({ color: 0xe8e6e0, metalness: 0.0, roughness: 0.75, side: THREE.DoubleSide }),
  fletch2: M({ color: 0xc4342f, metalness: 0.0, roughness: 0.75, side: THREE.DoubleSide }),
  point: M({ color: 0x8f959b, metalness: 0.95, roughness: 0.25 }),
  /* display stand */
  stand: M({ color: 0x2f3237, metalness: 0.5, roughness: 0.55 }),
};

/* The flat pattern for a skeletonised riser: an inner-rib material on the
   sides of every bar, keyed off the extrusion's Z sign. `extrudeBars` in
   riser.js writes z into a `zsign` attribute so we can split without
   doubling the geometry. */

export function finishMesh(mesh, { cast = true, receive = true } = {}) {
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}
