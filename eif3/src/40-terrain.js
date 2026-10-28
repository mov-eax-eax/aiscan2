/* 40-terrain.js — ground, plaza, city floor, the Seine and Pont d'Iéna.
   All near-coplanar surfaces are deliberately separated in Y; do not place
   overlay planes on the same Y or they will flicker. */
function buildTerrain(scene) {
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x444d36, roughness: 1 });
  const plazaMat = new THREE.MeshStandardMaterial({ color: 0x9c9080, roughness: 0.92 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xa99e8b, roughness: 0.95 });
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x35697d, metalness: 0.35, roughness: 0.12 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x968b7c, metalness: 0.02, roughness: 0.96 });

/* ------------------------------------------------------------------ */
/*  ground, plaza, river, bridge                                      */
/* ------------------------------------------------------------------ */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const plaza = new THREE.Mesh(new THREE.CircleGeometry(100, 72), plazaMat);
plaza.rotation.x = -Math.PI / 2;
plaza.position.y = 0.25;
plaza.receiveShadow = true;
scene.add(plaza);

// the city floor, so the distant blocks don't float on a lawn
const urban = new THREE.Mesh(
  new THREE.RingGeometry(WORLD.cityInner, WORLD.cityOuter, 96),
  new THREE.MeshStandardMaterial({ color: 0x4b4944, roughness: 1 })
);
urban.rotation.x = -Math.PI / 2;
urban.position.y = WORLD.ringY;
urban.receiveShadow = true;
scene.add(urban);

// Champ de Mars, stretching away from the tower, and the short walk to the river
const mall = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.mallWidth, WORLD.mallEnd - WORLD.mallStart), pathMat);
mall.rotation.x = -Math.PI / 2;
mall.position.set(0, 0.3, (WORLD.mallStart + WORLD.mallEnd) / 2);
mall.receiveShadow = true;
scene.add(mall);

const riverWalk = new THREE.Mesh(new THREE.PlaneGeometry(46, 124), pathMat);
riverWalk.rotation.x = -Math.PI / 2;
riverWalk.position.set(0, 0.3, -162.5);
riverWalk.receiveShadow = true;
scene.add(riverWalk);

// the Seine, crossing the scene behind the tower
const river = new THREE.Mesh(new THREE.PlaneGeometry(9000, WORLD.riverWidth), waterMat);
river.rotation.x = -Math.PI / 2;
river.position.set(0, WORLD.waterY, WORLD.riverZ);
scene.add(river);

for (const z of [-220, -440]) {
  const quay = new THREE.Mesh(new THREE.BoxGeometry(9000, 3.2, 4), stoneMat);
  quay.position.set(0, 0.5, z);
  scene.add(quay);
}

// Pont d'Iéna, on the tower's axis
{
  const deck = new THREE.Mesh(new THREE.BoxGeometry(40, 2.2, 224), stoneMat);
  deck.position.set(0, 1.9, -330);
  deck.castShadow = true;
  scene.add(deck);

  for (const x of [-19.5, 19.5]) {
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 224), stoneMat);
    parapet.position.set(x, 3.6, -330);
    scene.add(parapet);
  }
  for (const z of [-256, -330, -404]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(34, 4.6, 9), stoneMat);
    pier.position.set(0, 0.4, z);
    scene.add(pier);
  }
}
}
