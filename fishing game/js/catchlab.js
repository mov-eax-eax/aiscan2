/* ABYSS ANGLER — live 3D catch showcase.
 *
 * A small second WebGL surface that renders the actual enhanced FishFactory
 * model of the fish that was just landed. It is created lazily, runs only
 * while the catch card is open, and disposes its model on hide.
 */
(function (global) {
  'use strict';

  var canvas = null;
  var renderer = null;
  var scene = null;
  var camera = null;
  var fish = null;
  var running = false;
  var raf = 0;
  var started = 0;
  var width = 0;
  var height = 0;

  function init() {
    if (renderer) return true;
    if (typeof THREE === 'undefined') return false;
    canvas = document.getElementById('catch-preview');
    if (!canvas) return false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch (e) {
      renderer = null;
      return false;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;
    }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    camera.position.set(0, 0.20, 3.45);
    camera.lookAt(0, 0, 0);

    var ambient = new THREE.AmbientLight(0x8d9a91, 0.40);
    scene.add(ambient);
    var key = new THREE.DirectionalLight(0xffd9a8, 0.78);
    key.position.set(4, 5, 6);
    scene.add(key);
    var rim = new THREE.PointLight(0x829d93, 0.24, 12);
    rim.position.set(-3, 1, -3);
    scene.add(rim);
    var bottom = new THREE.PointLight(0x1e2c29, 0.20, 8);
    bottom.position.set(0, -3, 2);
    scene.add(bottom);

    if (global.addEventListener) global.addEventListener('resize', resize);
    return true;
  }

  function resize() {
    if (!renderer || !canvas) return;
    var w = canvas.clientWidth || 340;
    var h = canvas.clientHeight || 160;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function clearFish() {
    if (!fish || !scene) return;
    scene.remove(fish);
    if (global.FishFactory && FishFactory.dispose) FishFactory.dispose(fish);
    fish = null;
  }

  function show(def, weight, length) {
    if (!init() || !def) return;
    clearFish();
    var L = 2.15;
    if (typeof length === 'number' && isFinite(length)) L = Math.max(1.45, Math.min(2.65, 1.35 + length * 0.50));
    fish = FishFactory.create(def, L);
    if (!fish) return;
    fish.rotation.y = -0.45;
    fish.rotation.x = -0.04;
    scene.add(fish);
    resize();
    running = true;
    started = performance.now();
    if (!width || !height) resize();
    if (canvas && canvas.parentElement) canvas.parentElement.classList.add('on');
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (!running) return;
    resize();
    var t = (now - started) / 1000;
    if (fish) {
      fish.rotation.y = -0.35 + Math.sin(t * 0.55) * 0.62;
      fish.rotation.z = Math.sin(t * 0.38) * 0.035;
      FishFactory.animate(fish, t, 0.55, 0.20);
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function hide() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clearFish();
    if (canvas && canvas.parentElement) canvas.parentElement.classList.remove('on');
  }

  global.CatchLab = { show: show, hide: hide, resize: resize };
})(window);
