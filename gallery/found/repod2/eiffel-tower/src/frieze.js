import * as THREE from 'three';

/**
 * The 72 names engraved in 60 cm gold letters on the four faces, just under
 * the first balcony (1889), 18 per side, listed with the side of Paris each
 * face looks towards.
 */
export const FRIEZE_NAMES = [
  // 0 · local +z · SE · École Militaire side
  ['CAUCHY', 'BELGRAND', 'REGNAULT', 'FRESNEL', 'DE PRONY', 'VICAT', 'EBELMEN', 'COULOMB', 'POINSOT',
   'FOUCAULT', 'DELAUNAY', 'MORIN', 'HAÜY', 'COMBES', 'THÉNARD', 'ARAGO', 'POISSON', 'MONGE'],
  // 1 · local +x · NE · La Bourdonnais side
  ['PETIET', 'DAGUERRE', 'WURTZ', 'LE VERRIER', 'PERDONNET', 'DELAMBRE', 'MALUS', 'BREGUET', 'POLONCEAU',
   'DUMAS', 'CLAPEYRON', 'BORDA', 'FOURIER', 'BICHAT', 'SAUVAGE', 'PELOUZE', 'CARNOT', 'LAMÉ'],
  // 2 · local -z · NW · Trocadéro side
  ['SEGUIN', 'LALANDE', 'TRESCA', 'PONCELET', 'BRESSE', 'LAGRANGE', 'BELANGER', 'CUVIER', 'LAPLACE',
   'DULONG', 'CHASLES', 'LAVOISIER', 'AMPÈRE', 'CHEVREUL', 'FLACHAT', 'NAVIER', 'LEGENDRE', 'CHAPTAL'],
  // 3 · local -x · SW · Grenelle side
  ['JAMIN', 'GAY-LUSSAC', 'FIZEAU', 'SCHNEIDER', 'LE CHATELIER', 'BERTHIER', 'BARRAL', 'DE DION', 'GOÜIN',
   'JOUSSELIN', 'BROCA', 'BECQUEREL', 'CORIOLIS', 'CAIL', 'TRIGER', 'GIFFARD', 'PERRIER', 'STURM'],
];

/**
 * Paints the four frieze bands on canvases and returns them as textures
 * (index 0..3 matching FRIEZE_NAMES).  Needs a DOM; returns null otherwise.
 */
export function makeFriezeTextures(width = 4096, height = 156) {
  if (typeof document === 'undefined') return null;
  const out = [];
  for (let face = 0; face < 4; face++) {
    const cv = document.createElement('canvas');
    cv.width = width;
    cv.height = height;
    const g = cv.getContext('2d');

    // painted iron plate
    const grad = g.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#4a3524');
    grad.addColorStop(0.45, '#3d2c1d');
    grad.addColorStop(1, '#2c1f14');
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);

    // plate seams + rivet rows
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, width, 6);
    g.fillRect(0, height - 6, width, 6);
    g.fillStyle = 'rgba(214,176,110,0.45)';
    for (let x = 8; x < width; x += 26) {
      g.beginPath();
      g.arc(x, 12, 2.1, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.arc(x, height - 12, 2.1, 0, Math.PI * 2);
      g.fill();
    }

    // the names, centred in their slots, shrunk to fit
    const names = FRIEZE_NAMES[face];
    const slot = width / names.length;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < names.length; i++) {
      const cx = slot * (i + 0.5);
      let size = height * 0.42;
      g.font = `600 ${size}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
      const maxW = slot * 0.86;
      const w = g.measureText(names[i]).width;
      if (w > maxW) {
        size *= maxW / w;
        g.font = `600 ${size}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
      }
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillText(names[i], cx + 2, height * 0.5 + 3);
      g.fillStyle = '#e0b451';
      g.fillText(names[i], cx, height * 0.5);
      g.fillStyle = 'rgba(255,244,214,0.5)';
      g.fillText(names[i], cx - 1, height * 0.5 - 1.4);
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    out.push(tex);
  }
  return out;
}
