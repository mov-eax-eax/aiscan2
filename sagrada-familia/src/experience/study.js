// Study modes for the HUD: Mesh (wireframe), Section (cutaway) and Isolate
// (only one part of the building). These are visual study tools, deliberately
// separate from walk/fly/tour, and fully reversible.
//
// Kept in its own module so the interaction layer stays readable.

import { THREE } from '../lib.js';

const MESH_COLOR = 0x72d7ff;
const MESH_BG = 0x030811;
const SECTION_Z = 8;

export function createStudy({ scene, renderer }) {
  const groups = {
    shell: scene.getObjectByName('glory-shell') || null,
    facades: scene.getObjectByName('facades-np') || null,
    towers: scene.getObjectByName('towers') || null,
    interior: scene.getObjectByName('interior') || null,
    environment: scene.getObjectByName('environment') || null,
  };
  const buildingGroups = [groups.shell, groups.facades, groups.towers, groups.interior].filter(Boolean);
  const partGroups = {
    shell: [groups.shell, groups.facades].filter(Boolean),
    towers: [groups.towers].filter(Boolean),
    interior: [groups.interior].filter(Boolean),
  };

  let meshOn = false;
  let sectionOn = false;
  let part = 'all';
  let savedBackground = null;
  let meshHidden = [];
  let sectionMaterials = [];
  let sectionPlane = null;
  let cutVisual = null;
  let savedClipping = false;

  const state = () => ({
    mesh: meshOn,
    section: sectionOn,
    part,
    partsOpen: part !== 'all' || false,
  });

  // ------------------------------------------------------------------ mesh
  const meshMat = new THREE.MeshBasicMaterial({
    color: MESH_COLOR,
    wireframe: true,
    // Back-side only: this behaves like an X-ray survey. Front faces drop away
    // so the interior wireframe is visible instead of a solid silhouette.
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    fog: true,
  });

  function setMesh(on) {
    on = !!on;
    if (on === meshOn) return;
    meshOn = on;
    if (on) {
      if (sectionOn) setSection(false);
      savedBackground = scene.background || null;
      scene.background = new THREE.Color(MESH_BG);
      // Hide things that a wireframe override would turn into noise: the sky
      // shader sphere, stars and the moon sprite. Keep the ground/city meshes —
      // a wireframe city around a wireframe temple reads like a survey drawing.
      meshHidden = [];
      const hide = (o) => {
        if (!o || !o.visible) return;
        o.visible = false;
        meshHidden.push(o);
      };
      if (groups.environment) {
        groups.environment.traverse((o) => {
          if (o === groups.environment) return;
          const m = o.material;
          if (o.isSprite || o.isPoints) hide(o);
          else if (o.isMesh && m && m.isShaderMaterial) hide(o);
        });
      }
      scene.overrideMaterial = meshMat;
    } else {
      scene.overrideMaterial = null;
      for (const o of meshHidden) o.visible = true;
      meshHidden = [];
      scene.background = savedBackground;
      savedBackground = null;
    }
  }

  // --------------------------------------------------------------- section
  function uniqueMaterials() {
    const set = new Set();
    for (const g of buildingGroups) {
      g.traverse((o) => {
        if (!o.isMesh || !o.material) return;
        const list = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of list) set.add(m);
      });
    }
    return set;
  }

  function setSection(on) {
    on = !!on;
    if (on === sectionOn) return;
    sectionOn = on;
    if (on) {
      if (meshOn) setMesh(false);
      savedClipping = renderer.localClippingEnabled;
      renderer.localClippingEnabled = true;
      sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), SECTION_Z);
      // A ghost plane makes the cut legible from outside.
      const g = new THREE.Group();
      g.name = 'study-section-cut';
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(92, 62),
        new THREE.MeshBasicMaterial({
          color: 0x7ce0ff,
          transparent: true,
          opacity: 0.055,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      pane.position.set(0, 30, SECTION_Z);
      g.add(pane);
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(92, 62)),
        new THREE.LineBasicMaterial({ color: 0xa8efff, transparent: true, opacity: 0.5, depthWrite: false })
      );
      edge.position.set(0, 30, SECTION_Z);
      g.add(edge);
      cutVisual = g;
      scene.add(g);
      sectionMaterials = [];
      for (const m of uniqueMaterials()) {
        sectionMaterials.push({ m, planes: m.clippingPlanes });
        m.clippingPlanes = [sectionPlane];
        m.clipShadows = false;
        m.needsUpdate = true;
      }
    } else {
      for (const { m, planes } of sectionMaterials) {
        m.clippingPlanes = planes;
        m.needsUpdate = true;
      }
      sectionMaterials = [];
      if (cutVisual) {
        scene.remove(cutVisual);
        cutVisual.traverse((o) => {
          o.geometry?.dispose?.();
          o.material?.dispose?.();
        });
        cutVisual = null;
      }
      sectionPlane = null;
      // Do not disable local clipping globally: other tools might rely on it.
      renderer.localClippingEnabled = savedClipping;
    }
  }

  // ---------------------------------------------------------------- isolate
  function applyPart() {
    const show = (group, visible) => {
      if (group) group.visible = visible;
    };
    if (part === 'all') {
      for (const g of buildingGroups) show(g, true);
      return;
    }
    const keep = new Set(partGroups[part] || []);
    for (const g of buildingGroups) show(g, keep.has(g));
  }

  function setPart(next) {
    if (!['all', 'shell', 'towers', 'interior'].includes(next)) next = 'all';
    part = next;
    applyPart();
  }

  function reset() {
    if (meshOn) setMesh(false);
    if (sectionOn) setSection(false);
    setPart('all');
  }

  return {
    setMesh,
    setSection,
    setPart,
    reset,
    getState: state,
    groups,
  };
}
