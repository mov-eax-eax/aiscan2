/* 70-controls.js — damped orbit camera (pointer drag, wheel, pinch).
   Returns { orbit, updateCamera }. */
function createControls(renderer, camera, cameraTarget) {
/* ------------------------------------------------------------------ */
/*  lightweight orbit controls (damped, pointer + wheel + pinch)      */
/* ------------------------------------------------------------------ */
const orbit = {
  radius: 555, phi: 1.44, theta: 0.63,
  tr: 555, tphi: 1.44, ttheta: 0.63,
  auto: true, dragging: false,
  pointers: new Map(),
  pinch: 0,
};

function updateCamera() {
  camera.position.setFromSphericalCoords(orbit.radius, orbit.phi, orbit.theta).add(cameraTarget);
  camera.lookAt(cameraTarget);
}

const dom = renderer.domElement;
dom.addEventListener('contextmenu', (e) => e.preventDefault());

function pinchDistance() {
  const pts = [...orbit.pointers.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}

dom.addEventListener('pointerdown', (e) => {
  dom.setPointerCapture(e.pointerId);
  orbit.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  orbit.dragging = true;
  if (orbit.pointers.size === 2) orbit.pinch = pinchDistance();
});

dom.addEventListener('pointermove', (e) => {
  const p = orbit.pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x;
  const dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;

  if (orbit.pointers.size === 1) {
    orbit.ttheta -= dx * 0.0052;
    orbit.tphi = clamp(orbit.tphi - dy * 0.0044, 0.3, 1.52);
  } else if (orbit.pointers.size === 2) {
    const d = pinchDistance();
    if (orbit.pinch > 0 && d > 0) orbit.tr = clamp(orbit.tr * (orbit.pinch / d), 90, 1800);
    orbit.pinch = d;
  }
});

function endPointer(e) {
  orbit.pointers.delete(e.pointerId);
  if (orbit.pointers.size === 0) orbit.dragging = false;
  if (orbit.pointers.size < 2) orbit.pinch = 0;
}
dom.addEventListener('pointerup', endPointer);
dom.addEventListener('pointercancel', endPointer);

dom.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.tr = clamp(orbit.tr * Math.exp(e.deltaY * 0.0011), 90, 1800);
}, { passive: false });

  updateCamera();
  return { orbit, updateCamera };
}
