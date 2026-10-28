/* ABYSS ANGLER — 3D world: ocean, sky, boat, rod, line, effects, underwater view. */
(function () {
  'use strict';
  var T = window.THREE;
  if (!T) { console.error('Abyss Angler: three.js failed to load.'); return; }

  var W = window.World = {};

  // ------------------------------------------------------------------ helpers
  function C(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function canvasTexture(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    draw(g, w, h);
    var t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.needsUpdate = true;
    return t;
  }
  var dotTex = null;
  function getDotTex() {
    if (dotTex) return dotTex;
    dotTex = canvasTexture(64, 64, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,0.8)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    return dotTex;
  }

  function softPointsMaterial(color, worldSize, opacity, additive) {
    return new T.ShaderMaterial({
      uniforms: {
        uColor: { value: new T.Color(color) },
        uOpacity: { value: opacity },
        uSize: { value: worldSize }
      },
      vertexShader: [
        'uniform float uSize;',
        'void main(){',
        '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
        '  gl_PointSize = uSize * (520.0 / max(0.2, -mv.z));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'void main(){',
        '  vec2 uv = gl_PointCoord - vec2(0.5);',
        '  float d = length(uv);',
        '  float a = smoothstep(0.5, 0.06, d);',
        '  gl_FragColor = vec4(uColor, a * uOpacity);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: additive ? T.AdditiveBlending : T.NormalBlending
    });
  }

  function setPointOpacity(mesh, value) {
    if (!mesh || !mesh.material) return;
    if (mesh.material.uniforms && mesh.material.uniforms.uOpacity) mesh.material.uniforms.uOpacity.value = value;
    else mesh.material.opacity = value;
  }

  function disposeGroup(root) {
    if (!root) return;
    root.traverse(function (o) {
      if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function (m) {
          if (m.map && m.map.dispose && !(m.map.userData && m.map.userData.shared)) m.map.dispose();
          if (!(m.userData && m.userData.shared)) m.dispose();
        });
      }
    });
    if (root.parent) root.parent.remove(root);
  }

  // ------------------------------------------------------------------ state
  var canvas, renderer, scene, camera, pipEl, flashEl;
  var underScene, underCam, underRoot;
  var level = null, envGroup = null, underFish = null, underFishLen = 1, underFishDef = null;
  var time = 0, mode = 'title';
  var WIDTH = 1, HEIGHT = 1;
  var waveAmp = 0.4, waveSpeed = 1;
  var distance = 0, lureDepth = 0, lureTarget = 0, charge = 0;
  var biteTimer = 0;
  var jigT = 0;
  var fight = null, fightSurgePrev = false;
  var shake = 0, flash = 0, lightningTimer = 9;
  var castTween = null, catchTween = null, catchFishGroup = null;
  var pipVisible = false;

  var sky, skyUniforms, water, waterUniforms, stars, sunSprite, moonSprite, clouds = [];
  var boat, rodRoot, rodJoints = [], rodTipObj, rodTipWorld = new T.Vector3();
  var line, lineGeo, linePos, lineVisible = false;
  var bobber, bobberVisible = false, bobberRipples = [];
  var splash, splashData = [], splashPos;
  var school, schoolRings = [], schoolBait, schoolVisible = false;
  var rain, rainPos, rainVel;
  var glowMotes, glowData = [];
  var ambientJumps = [], jumpTimer = 5;
  var buoys = [], kelpGroup = null;

  var cameraPos = new T.Vector3(0, 8, 18);
  var cameraLook = new T.Vector3(0, 2, -10);
  var camPosTarget = new T.Vector3(0, 8, 18);
  var camLookTarget = new T.Vector3(0, 2, -10);
  var camSnap = true;

  // ------------------------------------------------------------------ shaders
  var skyVert = [
    'varying vec3 vWorld;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var skyFrag = [
    'varying vec3 vWorld;',
    'uniform vec3 uTop;',
    'uniform vec3 uBottom;',
    'uniform vec3 uCloud;',
    'uniform vec3 uSunColor;',
    'uniform vec3 uSunDir;',
    'uniform float uTime;',
    'float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1.0,0.0)), c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0; float a = 0.55; for(int i=0;i<4;i++){ v += a*vnoise(p); p *= 2.03; a *= 0.5; } return v; }',
    'void main(){',
    '  vec3 d = normalize(vWorld);',
    '  float h = clamp(d.y * 1.15 + 0.06, 0.0, 1.0);',
    '  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 0.82, h));',
    '  vec2 sph = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));',
    '  float cloud = fbm(vec2(sph.x * 1.55, sph.y * 3.4) + vec2(uTime * 0.004, 0.0));',
    '  float band = smoothstep(0.32, 0.66, cloud) * smoothstep(-0.08, 0.34, d.y);',
    '  float high = fbm(vec2(sph.x * 2.7, sph.y * 5.6) + vec2(-uTime * 0.003, 0.0));',
    '  col = mix(col, uCloud, band * 0.68);',
    '  col = mix(col, uCloud, smoothstep(0.55, 0.80, high) * 0.22 * smoothstep(0.02, 0.42, d.y));',
    '  col = mix(col, uBottom, exp(-abs(d.y) * 9.0) * 0.16);',
    '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
    '  col += uSunColor * (pow(sd, 320.0) * 0.55 + pow(sd, 9.0) * 0.045);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var waterVert = [
    'uniform float uTime;',
    'uniform float uAmp;',
    'varying vec3 vWorld;',
    'varying vec3 vNormal;',
    'varying float vHeight;',
    'float wh(vec2 p){',
    '  float t = uTime;',
    '  float h = sin(dot(p, vec2(0.033, 0.012)) * 2.0 + t * 0.52) * 0.58;',
    '  h += sin(dot(p, vec2(-0.017, 0.040)) * 2.3 - t * 0.40) * 0.37;',
    '  h += sin(dot(p, vec2(0.071, 0.055)) * 1.35 + t * 0.83) * 0.17;',
    '  h += sin(dot(p, vec2(0.26, -0.19)) * 1.15 + t * 1.65) * 0.055;',
    '  return h * uAmp;',
    '}',
    'vec3 wn(vec2 p){',
    '  float e = 0.9;',
    '  float hl = wh(p - vec2(e,0.0));',
    '  float hr = wh(p + vec2(e,0.0));',
    '  float hu = wh(p - vec2(0.0,e));',
    '  float hd = wh(p + vec2(0.0,e));',
    '  return normalize(vec3(-(hr-hl)/(2.0*e), 1.0, -(hd-hu)/(2.0*e)));',
    '}',
    'void main(){',
    '  vec3 pos = position;',
    '  float h = wh(pos.xz);',
    '  pos.y += h;',
    '  vHeight = h;',
    '  vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;',
    '  vNormal = wn(pos.xz);',
    '  gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);',
    '}'
  ].join('\n');

  var waterFrag = [
    'uniform vec3 uTop;',
    'uniform vec3 uDeep;',
    'uniform vec3 uSky;',
    'uniform vec3 uSunColor;',
    'uniform vec3 uSunDir;',
    'uniform vec3 uFogColor;',
    'uniform vec3 uFoamColor;',
    'uniform float uFogDensity;',
    'uniform float uAmp;',
    'uniform float uFoam;',
    'uniform float uTime;',
    'varying vec3 vWorld;',
    'varying vec3 vNormal;',
    'varying float vHeight;',
    'float hash21(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 31.7); return fract(p.x * p.y); }',
    'float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);',
    '  float a = hash21(i), b = hash21(i+vec2(1.0,0.0)), c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  float dx = vnoise(vWorld.xz * 0.16 + vec2(uTime * 0.11, 0.0)) - 0.5;',
    '  float dz = vnoise(vWorld.xz * 0.19 + vec2(0.0, -uTime * 0.09)) - 0.5;',
    '  n = normalize(n + vec3(dx, 0.0, dz) * 0.34);',
    '  vec3 viewDir = normalize(cameraPosition - vWorld);',
    '  float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.2);',
    '  vec3 base = mix(uDeep, uTop, smoothstep(-uAmp*1.5, uAmp*1.1, vHeight));',
    '  base *= mix(0.86, 1.06, smoothstep(-uAmp*0.8, uAmp*0.9, vHeight));',
    '  vec3 col = mix(base, uSky, clamp(fres*0.55, 0.0, 0.52));',
    '  vec3 halfV = normalize(normalize(uSunDir) + viewDir);',
    '  float spec = pow(max(dot(n, halfV), 0.0), 130.0) * 0.20;',
    '  float sheen = pow(max(dot(n, normalize(uSunDir)), 0.0), 8.0) * 0.018;',
    '  col += uSunColor * (spec + sheen);',
    '  float crest = smoothstep(uAmp*0.26, uAmp*1.16, vHeight);',
    '  float n1 = vnoise(vWorld.xz * 0.070 + vec2(uTime * 0.055, -uTime * 0.040));',
    '  float n2 = vnoise(vWorld.xz * 0.20 + vec2(-uTime * 0.10, uTime * 0.065));',
    '  float lanes = smoothstep(0.48, 0.78, n1) * smoothstep(0.08, 0.56, 1.0 - fres);',
    '  float chop = smoothstep(0.63, 0.90, n2) * 0.50;',
    '  float ripple = smoothstep(0.68, 0.88, vnoise(vWorld.xz * 0.85 + vec2(uTime * 0.32, uTime * 0.18))) * 0.075;',
    '  float foam = clamp(crest * uFoam * 1.35 + lanes * uFoam * 0.95 + chop * uFoam + ripple, 0.0, 0.92);',
    '  col = mix(col, uFoamColor, foam);',
    '  float d = length(cameraPosition - vWorld);',
    '  float f = 1.0 - exp(-uFogDensity*uFogDensity*d*d);',
    '  col = mix(col, uFogColor, clamp(f, 0.0, 1.0));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var underVert = [
    'varying vec3 vWorld;',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWorld = wp.xyz;',
    '  gl_Position = projectionMatrix * viewMatrix * wp;',
    '}'
  ].join('\n');

  var underFrag = [
    'varying vec3 vWorld;',
    'uniform vec3 uTop;',
    'uniform vec3 uDeep;',
    'void main(){',
    '  float h = clamp(normalize(vWorld).y * 1.6 + 0.58, 0.0, 1.0);',
    '  vec3 col = mix(uDeep, uTop, pow(h, 1.35));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  // ------------------------------------------------------------------ init
  W.init = function (cv) {
    canvas = cv;
    pipEl = document.getElementById('pip');
    flashEl = document.getElementById('flash');
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.autoClear = false;

    scene = new T.Scene();
    scene.fog = new T.FogExp2(C(0x9fd8d8), 0.0028);
    camera = new T.PerspectiveCamera(52, 1, 0.1, 2400);
    camera.position.copy(cameraPos);

    buildSky();
    buildWater();
    buildBoat();
    buildBobber();
    buildLine();
    buildSplash();
    buildSchool();
    buildStars();
    buildClouds();
    buildSunMoon();

    underScene = new T.Scene();
    underScene.fog = new T.FogExp2(C(0x062c3a), 0.022);
    underCam = new T.PerspectiveCamera(55, 16 / 9, 0.05, 1200);
    var underHemi = new T.HemisphereLight(C(0xbdf3ff), C(0x06202a), 1.35);
    underScene.add(underHemi);
    var underDir = new T.DirectionalLight(C(0xe2fbff), 1.5);
    underDir.position.set(0, 1, 0.35);
    underScene.add(underDir);
    underScene.add(new T.AmbientLight(C(0x2b6470), 0.85));
    var underPoint = new T.PointLight(C(0xaef7ff), 2.2, 55);
    underPoint.position.set(0, -6, 3);
    underScene.add(underPoint);
    underScene.userData.point = underPoint;
    underRoot = new T.Group();
    underScene.add(underRoot);

    window.addEventListener('resize', W.resize);
    W.resize();
    cameraPos.set(0, 8, 18);
    cameraLook.set(0, 2, -10);
  };

  W.resize = function () {
    if (!renderer) return;
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(WIDTH, HEIGHT, false);
    camera.aspect = WIDTH / Math.max(1, HEIGHT);
    camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ builders
  function buildSky() {
    skyUniforms = {
      uTop: { value: C(0x2f7fb0) },
      uBottom: { value: C(0xffd6a0) },
      uCloud: { value: C(0x5f6a66) },
      uSunColor: { value: C(0xffe6b8) },
      uSunDir: { value: new T.Vector3(0.25, 0.4, -1).normalize() },
      uTime: { value: 0 }
    };
    var geo = new T.SphereGeometry(1100, 32, 18);
    var mat = new T.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: T.BackSide,
      depthWrite: false,
      fog: false
    });
    sky = new T.Mesh(geo, mat);
    scene.add(sky);
  }

  function buildWater() {
    waterUniforms = {
      uTime: { value: 0 },
      uAmp: { value: waveAmp },
      uTop: { value: C(0x2fa3a8) },
      uDeep: { value: C(0x0a3b46) },
      uSky: { value: C(0xbfe3e6) },
      uSunColor: { value: C(0xffe0b0) },
      uSunDir: { value: new T.Vector3(0.25, 0.4, -1).normalize() },
      uFogColor: { value: C(0xa8dde0) },
      uFoamColor: { value: C(0xd9ddcc) },
      uFogDensity: { value: 0.0026 },
      uFoam: { value: 0.18 }
    };
    var geo = new T.PlaneGeometry(1800, 1800, 120, 120);
    geo.rotateX(-Math.PI / 2);
    var mat = new T.ShaderMaterial({ uniforms: waterUniforms, vertexShader: waterVert, fragmentShader: waterFrag });
    water = new T.Mesh(geo, mat);
    water.position.y = 0;
    water.frustumCulled = false;
    scene.add(water);
  }

  function buildBoat() {
    boat = new T.Group();
    scene.add(boat);

    var hullMat = new T.MeshStandardMaterial({ color: C(0xd4c9b4), roughness: 0.78, metalness: 0.04, flatShading: true });
    var trimMat = new T.MeshStandardMaterial({ color: C(0x7c4035), roughness: 0.72 });
    var woodMat = new T.MeshStandardMaterial({ color: C(0x6d573f), roughness: 0.94 });
    var darkMat = new T.MeshStandardMaterial({ color: C(0x272b28), roughness: 0.74 });
    var glassMat = new T.MeshStandardMaterial({ color: C(0x18282a), roughness: 0.18, metalness: 0.5 });
    var cabinMat = new T.MeshStandardMaterial({ color: C(0x2b403f), roughness: 0.65, metalness: 0.10 });
    var roofMat = new T.MeshStandardMaterial({ color: C(0xbfb19a), roughness: 0.76, flatShading: true });

    var shape = new T.Shape();
    shape.moveTo(0, 3.3);
    shape.bezierCurveTo(0.8, 2.7, 1.18, 1.7, 1.18, 0.2);
    shape.bezierCurveTo(1.18, -1.35, 1.02, -2.5, 0.84, -2.9);
    shape.lineTo(-0.84, -2.9);
    shape.bezierCurveTo(-1.02, -2.5, -1.18, -1.35, -1.18, 0.2);
    shape.bezierCurveTo(-1.18, 1.7, -0.8, 2.7, 0.0, 3.3);
    var hullGeo = new T.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: true, bevelSize: 0.13, bevelThickness: 0.14, bevelSegments: 2, steps: 1, curveSegments: 14 });
    hullGeo.rotateX(-Math.PI / 2);
    hullGeo.translate(0, 0.2, 0);
    var hull = new T.Mesh(hullGeo, hullMat);
    boat.add(hull);

    // flat transom + name board
    var transom = new T.Mesh(new T.BoxGeometry(1.62, 0.34, 0.08), trimMat);
    transom.position.set(0, 0.62, 2.92);
    boat.add(transom);
    var plateTex = canvasTexture(256, 64, function (g, w, h) {
      g.fillStyle = '#08171d'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#c9a35e'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#f0c47a'; g.font = 'bold 27px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ABYSS ANGLER', w / 2, h / 2 + 1);
    });
    var plate = new T.Mesh(new T.PlaneGeometry(1.15, 0.29), new T.MeshBasicMaterial({ map: plateTex }));
    plate.position.set(0, 0.62, 2.965);
    boat.add(plate);

    var deck = new T.Mesh(new T.BoxGeometry(2.05, 0.14, 5.0), woodMat);
    deck.position.set(0, 1.22, 0.05);
    boat.add(deck);
    var bowDeck = new T.Mesh(new T.BoxGeometry(1.35, 0.1, 1.1), trimMat);
    bowDeck.position.set(0, 1.3, -2.2);
    boat.add(bowDeck);

    var cabin = new T.Mesh(new T.BoxGeometry(1.65, 1.05, 1.65), cabinMat);
    cabin.position.set(0, 1.85, 1.45);
    boat.add(cabin);
    var roof = new T.Mesh(new T.BoxGeometry(1.9, 0.14, 1.9), roofMat);
    roof.position.set(0, 2.43, 1.45);
    boat.add(roof);
    var roofLip = new T.Mesh(new T.BoxGeometry(2.02, 0.08, 2.02), trimMat);
    roofLip.position.set(0, 2.35, 1.45);
    boat.add(roofLip);
    var windshield = new T.Mesh(new T.BoxGeometry(1.45, 0.55, 0.06), glassMat);
    windshield.position.set(0, 2.02, 0.6);
    boat.add(windshield);
    var sideWin = new T.Mesh(new T.BoxGeometry(0.06, 0.45, 1.2), glassMat);
    sideWin.position.set(0.83, 1.97, 1.45);
    boat.add(sideWin);
    var sideWin2 = sideWin.clone();
    sideWin2.position.x = -0.83;
    boat.add(sideWin2);
    var rearWin = new T.Mesh(new T.BoxGeometry(1.05, 0.42, 0.06), glassMat);
    rearWin.position.set(0, 2.03, 2.29);
    boat.add(rearWin);
    var door = new T.Mesh(new T.BoxGeometry(0.5, 0.85, 0.05), roofMat);
    door.position.set(0, 1.62, 2.29);
    boat.add(door);
    var doorKnob = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), new T.MeshStandardMaterial({ color: C(0xf0c47a), roughness: 0.4, metalness: 0.7 }));
    doorKnob.position.set(0.17, 1.62, 2.33);
    boat.add(doorKnob);

    // outboard motor
    var motorMat = new T.MeshStandardMaterial({ color: C(0x1b252b), roughness: 0.5, metalness: 0.35 });
    var motor = new T.Mesh(new T.BoxGeometry(0.52, 0.72, 0.42), motorMat);
    motor.position.set(0, 1.2, 2.95);
    boat.add(motor);
    var shaft = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.0, 6), motorMat);
    shaft.position.set(0, 0.55, 3.02);
    boat.add(shaft);
    var skeg = new T.Mesh(new T.BoxGeometry(0.12, 0.28, 0.5), motorMat);
    skeg.position.set(0, 0.16, 3.1);
    boat.add(skeg);

    // mast + rigging
    var mast = new T.Mesh(new T.CylinderGeometry(0.05, 0.075, 3.2, 8), woodMat);
    mast.position.set(-0.55, 2.9, 2.1);
    boat.add(mast);
    var rigMat = new T.LineBasicMaterial({ color: C(0x2b3036), transparent: true, opacity: 0.65 });
    var rigGeo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(-0.55, 4.45, 2.1), new T.Vector3(0.4, 1.35, -2.7),
      new T.Vector3(-0.55, 4.45, 2.1), new T.Vector3(0.8, 1.35, 2.5)
    ]);
    boat.add(new T.LineSegments(rigGeo, rigMat));
    var flag = new T.Mesh(new T.PlaneGeometry(0.75, 0.46), new T.MeshStandardMaterial({ color: C(0xd94f3a), roughness: 0.8, side: T.DoubleSide }));
    flag.position.set(-0.15, 4.22, 2.1);
    flag.rotation.y = Math.PI / 2;
    boat.add(flag);

    var cooler = new T.Mesh(new T.BoxGeometry(0.7, 0.5, 0.5), new T.MeshStandardMaterial({ color: C(0x4e7f8c), roughness: 0.6 }));
    cooler.position.set(-0.62, 1.55, 0.35);
    boat.add(cooler);
    var bucket = new T.Mesh(new T.CylinderGeometry(0.22, 0.18, 0.42, 10), darkMat);
    bucket.position.set(0.68, 1.5, 0.55);
    boat.add(bucket);

    // bow lantern
    var lanternMat = new T.MeshStandardMaterial({ color: C(0xffe0a0), emissive: C(0xffb347), emissiveIntensity: 0.9, roughness: 0.4 });
    var lantern = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), lanternMat);
    lantern.position.set(0, 1.4, -3.45);
    boat.add(lantern);
    boat.userData.lanternMat = lanternMat;

    // rod
    rodRoot = new T.Group();
    rodRoot.position.set(1.16, 1.4, -1.55);
    rodRoot.rotation.x = -1.02;
    boat.add(rodRoot);
    var rodMat = new T.MeshStandardMaterial({ color: C(0x20262b), roughness: 0.45, metalness: 0.35 });
    var gripMat = new T.MeshStandardMaterial({ color: C(0x6b4b2f), roughness: 0.9 });
    var grip = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.55, 8), gripMat);
    grip.position.y = 0.26;
    rodRoot.add(grip);
    var reel = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.12, 12), new T.MeshStandardMaterial({ color: C(0x3c4a55), roughness: 0.35, metalness: 0.6 }));
    reel.rotation.z = Math.PI / 2;
    reel.position.set(0.13, 0.5, 0);
    rodRoot.add(reel);
    var handle = new T.Mesh(new T.BoxGeometry(0.16, 0.03, 0.03), rodMat);
    handle.position.set(0.23, 0.5, 0.08);
    rodRoot.add(handle);

    var lens = [1.35, 1.15, 0.95];
    var rads = [0.034, 0.026, 0.019];
    var parent = rodRoot;
    var jointAngles = [0.10, 0.16, 0.24];
    for (var i = 0; i < lens.length; i++) {
      var joint = new T.Group();
      joint.rotation.x = jointAngles[i];
      parent.add(joint);
      var seg = new T.Mesh(new T.CylinderGeometry(rads[i], rads[i] + 0.008, lens[i], 8), rodMat);
      seg.position.y = lens[i] / 2;
      joint.add(seg);
      var next = new T.Group();
      next.position.y = lens[i];
      joint.add(next);
      rodJoints.push({ joint: joint, base: jointAngles[i] });
      parent = next;
    }
    rodTipObj = new T.Group();
    rodTipObj.position.y = 0.02;
    parent.add(rodTipObj);
    var tipBall = new T.Mesh(new T.SphereGeometry(0.028, 6, 5), new T.MeshStandardMaterial({ color: C(0xffd166), roughness: 0.4 }));
    rodTipObj.add(tipBall);
  }

  function buildBobber() {
    bobber = new T.Group();
    var red = new T.MeshStandardMaterial({ color: C(0xd83a2e), roughness: 0.5 });
    var white = new T.MeshStandardMaterial({ color: C(0xf5f1e8), roughness: 0.5 });
    var bottom = new T.Mesh(new T.SphereGeometry(0.14, 10, 8), red);
    bobber.add(bottom);
    var top = new T.Mesh(new T.SphereGeometry(0.135, 10, 8), white);
    top.position.y = 0.08;
    top.scale.set(1, 0.72, 1);
    bobber.add(top);
    var stick = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.32, 6), red);
    stick.position.y = 0.28;
    bobber.add(stick);
    bobber.visible = false;
    scene.add(bobber);

    var ringGeo = new T.RingGeometry(0.19, 0.23, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (var i = 0; i < 3; i++) {
      var mat = new T.MeshBasicMaterial({ color: C(0xd8f5ef), transparent: true, opacity: 0.0, depthWrite: false });
      var ring = new T.Mesh(ringGeo, mat);
      ring.visible = false;
      scene.add(ring);
      bobberRipples.push({ mesh: ring, phase: i / 3 });
    }
  }

  function buildLine() {
    var n = 26;
    linePos = new Float32Array(n * 3);
    lineGeo = new T.BufferGeometry();
    lineGeo.setAttribute('position', new T.BufferAttribute(linePos, 3));
    var mat = new T.LineBasicMaterial({ color: C(0xf3f7f5), transparent: true, opacity: 0.55 });
    line = new T.Line(lineGeo, mat);
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
  }

  function buildSplash() {
    var n = 110;
    splashPos = new Float32Array(n * 3);
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(splashPos, 3));
    var mat = softPointsMaterial(0xe9fdf8, 0.3, 0.9, true);
    splash = new T.Points(geo, mat);
    splash.frustumCulled = false;
    splash.visible = false;
    scene.add(splash);
    for (var i = 0; i < n; i++) splashData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
  }

  function buildSchool() {
    school = new T.Group();
    school.visible = false;
    scene.add(school);
    var ringGeo = new T.RingGeometry(0.8, 0.95, 36);
    ringGeo.rotateX(-Math.PI / 2);
    for (var i = 0; i < 3; i++) {
      var m = new T.MeshBasicMaterial({ color: C(0xbff3ea), transparent: true, opacity: 0.25, depthWrite: false });
      var ring = new T.Mesh(ringGeo, m);
      ring.position.y = 0.06;
      school.add(ring);
      schoolRings.push({ mesh: ring, phase: i / 3 });
    }
    var baitGeo = new T.BufferGeometry();
    var bp = new Float32Array(45 * 3);
    for (var j = 0; j < 45; j++) {
      var a = Math.random() * Math.PI * 2;
      var r = Math.random() * 2.2;
      bp[j * 3] = Math.cos(a) * r;
      bp[j * 3 + 1] = 0.05 + Math.random() * 0.06;
      bp[j * 3 + 2] = Math.sin(a) * r;
    }
    baitGeo.setAttribute('position', new T.BufferAttribute(bp, 3));
    schoolBait = new T.Points(baitGeo, softPointsMaterial(0xd9fbf6, 0.12, 0.85, true));
    school.add(schoolBait);
  }

  function buildStars() {
    var n = 700;
    var pos = new Float32Array(n * 3);
    var rng = makeRng(4242);
    for (var i = 0; i < n; i++) {
      var theta = rng() * Math.PI * 2;
      var y = 60 + rng() * 700;
      var r = Math.sqrt(Math.max(0, 1000 * 1000 - y * y));
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    var mat = new T.PointsMaterial({ color: C(0xdfefff), size: 1.9, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false });
    stars = new T.Points(geo, mat);
    stars.visible = false;
    scene.add(stars);
  }

  function buildClouds() {
    var tex = canvasTexture(256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h);
      for (var i = 0; i < 12; i++) {
        var x = 40 + Math.random() * (w - 80);
        var y = 45 + Math.random() * (h - 80);
        var r = 22 + Math.random() * 30;
        var gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)');
        gr.addColorStop(0.6, 'rgba(255,255,255,0.18)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
    for (var i = 0; i < 9; i++) {
      var mat = new T.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false, color: C(0xffffff) });
      var sp = new T.Sprite(mat);
      sp.position.set((i % 3 - 1) * 160 + (Math.random() - 0.5) * 90, 55 + Math.random() * 80, -180 - Math.random() * 320);
      sp.scale.set(90 + Math.random() * 110, 34 + Math.random() * 32, 1);
      scene.add(sp);
      clouds.push({ sprite: sp, speed: 0.6 + Math.random() * 1.0 });
    }
  }

  function buildSunMoon() {
    var sunTex = canvasTexture(128, 128, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 60);
      gr.addColorStop(0, 'rgba(255,245,215,1)');
      gr.addColorStop(0.18, 'rgba(255,220,150,0.95)');
      gr.addColorStop(0.55, 'rgba(255,180,90,0.22)');
      gr.addColorStop(1, 'rgba(255,160,60,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    sunSprite = new T.Sprite(new T.SpriteMaterial({ map: sunTex, transparent: true, opacity: 0.95, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
    sunSprite.scale.set(165, 165, 1);
    scene.add(sunSprite);

    var moonTex = canvasTexture(128, 128, function (g, w, h) {
      var gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 46);
      gr.addColorStop(0, 'rgba(225,245,255,1)');
      gr.addColorStop(0.35, 'rgba(190,225,255,0.85)');
      gr.addColorStop(0.7, 'rgba(140,190,255,0.18)');
      gr.addColorStop(1, 'rgba(120,170,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    moonSprite = new T.Sprite(new T.SpriteMaterial({ map: moonTex, transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
    moonSprite.scale.set(150, 150, 1);
    moonSprite.visible = false;
    scene.add(moonSprite);
  }

  // ------------------------------------------------------------------ level setup
  W.setLevel = function (lv) {
    level = lv;
    W.clearFish();
    W.hideSchool();
    W.reset();
    if (envGroup) { disposeGroup(envGroup); envGroup = null; }
    scene.fog = new T.FogExp2(C(lv.fog), fogDensityFor(lv));
    buoys = [];
    kelpGroup = null;
    ambientJumps.forEach(function (j) { disposeGroup(j.mesh); });
    ambientJumps = [];
    var weather = lv.weather;
    waveAmp = weather === 'storm' ? 0.95 : weather === 'rain' ? 0.55 : weather === 'mist' ? 0.28 : 0.38;
    waveSpeed = weather === 'storm' ? 1.45 : 1.0;
    waterUniforms.uAmp.value = waveAmp;
    waterUniforms.uTop.value = C(lv.water.top);
    waterUniforms.uDeep.value = C(lv.water.deep);
    var night = lv.time === 'night';
    var skyRef = C(lv.sky.bottom).lerp(C(lv.water.top), 0.30);
    if (night) skyRef = C(0x1a2a30).lerp(C(lv.water.top), 0.25);
    waterUniforms.uSky.value.copy(skyRef);
    waterUniforms.uFogColor.value = C(lv.fog);
    waterUniforms.uFogDensity.value = fogDensityFor(lv);
    waterUniforms.uFoam.value = weather === 'storm' ? 0.70 : weather === 'rain' ? 0.38 : weather === 'mist' ? 0.14 : 0.26;
    waterUniforms.uFoamColor.value = C(night ? 0xb8c4bb : 0xe3e2d2);
    skyUniforms.uTop.value = C(lv.sky.top);
    skyUniforms.uBottom.value = C(lv.sky.bottom);
    skyUniforms.uCloud.value = C(night ? 0x0e1718 : 0x4c5751).lerp(C(lv.sky.top), 0.18);
    var sunDir = night ? new T.Vector3(-0.3, 0.4, -1) : new T.Vector3(0.22, 0.46, -1);
    sunDir.normalize();
    skyUniforms.uSunDir.value.copy(sunDir);
    skyUniforms.uSunColor.value = C(night ? 0xb7ced3 : 0xf3e3c8);
    waterUniforms.uSunDir.value.copy(sunDir);
    waterUniforms.uSunColor.value = C(night ? 0xa9c6cf : 0xeadcc4);
    sunSprite.material.opacity = night ? 0 : 0.58;
    moonSprite.visible = night;
    var sunPos = sunDir.clone().multiplyScalar(820);
    sunSprite.position.copy(sunPos);
    moonSprite.position.copy(sunDir.clone().multiplyScalar(760));
    stars.visible = night;
    stars.material.opacity = night ? 0.9 : 0;
    scene.userData.night = night;

    // lights
    if (scene.userData.hemi) scene.remove(scene.userData.hemi);
    if (scene.userData.dir) scene.remove(scene.userData.dir);
    var hemi = new T.HemisphereLight(C(night ? 0x24383d : 0x9eaaa0), C(night ? 0x020506 : 0x161f1a), night ? 0.55 : 0.78);
    scene.add(hemi);
    scene.userData.hemi = hemi;
    var dir = new T.DirectionalLight(C(night ? 0xa9c4d0 : 0xeadcc2), night ? 0.45 : 0.68);
    dir.position.set(sunDir.x * 60, 45, sunDir.z * 60);
    scene.add(dir);
    scene.userData.dir = dir;
    scene.userData.baseHemi = hemi.intensity;
    scene.userData.baseDir = dir.intensity;

    buildEnvironment(lv);
    buildUnderLevel(lv);
    camSnap = true;
    W.resize();
  };

  function fogDensityFor(lv) {
    var d = 0.0024;
    if (lv.weather === 'mist') d = 0.0052;
    if (lv.weather === 'rain') d = 0.0031;
    if (lv.weather === 'storm') d = 0.0038;
    if (lv.time === 'night') d = 0.0020;
    return d;
  }

  W.setMode = function (m) {
    mode = m;
    camSnap = true;
    if (m !== 'fight') pipVisible = false;
  };

  // ------------------------------------------------------------------ environment
  function buildEnvironment(lv) {
    envGroup = new T.Group();
    scene.add(envGroup);
    var rng = makeRng(lv.index * 7919 + 131);
    var feats = lv.features || [];
    var fogC = C(lv.fog);

    function addMesh(geo, mat, x, y, z, rx, ry, rz) {
      var m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx || 0, ry || 0, rz || 0);
      envGroup.add(m);
      return m;
    }

    // distant island layers
    var islandMat = new T.MeshStandardMaterial({ color: C(lv.time === 'night' ? 0x101b24 : 0x2e4a42), roughness: 1, flatShading: true });
    var islandMat2 = new T.MeshStandardMaterial({ color: C(lv.time === 'night' ? 0x0b1218 : 0x3d5c50), roughness: 1, flatShading: true });
    var treeMat = new T.MeshStandardMaterial({ color: C(lv.time === 'night' ? 0x08120e : 0x1d3329), roughness: 1, flatShading: true });
    for (var i = 0; i < 6; i++) {
      var ang = -0.5 - i * 0.28 + rng() * 0.14;
      var dist = 210 + rng() * 300;
      var x = Math.sin(ang) * dist;
      var z = -Math.cos(ang) * dist;
      var h = 11 + rng() * 24;
      var w = 42 + rng() * 70;
      addMesh(new T.ConeGeometry(w, h, 8), islandMat, x, h / 2 - 1, z, 0, rng() * 6, 0);
      addMesh(new T.ConeGeometry(w * 0.6, h * 0.72, 7), islandMat2, x + w * 0.45, h * 0.34 - 1, z + 8, 0, rng() * 6, 0);
      addMesh(new T.ConeGeometry(w * 0.45, h * 0.55, 6), islandMat2, x - w * 0.42, h * 0.24 - 1, z - 6, 0, rng() * 6, 0);
      for (var tr = 0; tr < 5; tr++) {
        var tx = x + (rng() - 0.5) * w * 0.7;
        var tz = z + (rng() - 0.5) * w * 0.5;
        var th = 3.5 + rng() * 7;
        addMesh(new T.ConeGeometry(th * 0.42, th, 5), treeMat, tx, h * 0.32 + th * 0.5, tz, 0, rng() * 6, 0);
      }
    }

    // near rocks
    var rockMat = new T.MeshStandardMaterial({ color: C(lv.time === 'night' ? 0x1b2329 : 0x5a665f), roughness: 1, flatShading: true });
    for (var r = 0; r < 5; r++) {
      var side = rng() < 0.5 ? -1 : 1;
      var rx = side * (22 + rng() * 55);
      var rz = -18 - rng() * 60;
      var rs = 1.2 + rng() * 3.2;
      var rock = addMesh(new T.DodecahedronGeometry(rs, 0), rockMat, rx, rs * 0.22, rz, rng(), rng() * 6, rng());
      rock.scale.y = 0.55 + rng() * 0.3;
    }

    if (feats.indexOf('buoys') !== -1) {
      for (var b = 0; b < 3; b++) {
        var bx = (b - 1) * (9 + rng() * 5);
        var bz = -15 - b * 9 - rng() * 8;
        var g = new T.Group();
        var buoyMat = new T.MeshStandardMaterial({ color: C(0xd0453a), roughness: 0.6 });
        var buoy = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), buoyMat);
        buoy.position.y = 0.2;
        g.add(buoy);
        var cap = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), new T.MeshStandardMaterial({ color: C(0xf1ede2), roughness: 0.6 }));
        cap.position.y = 0.55;
        g.add(cap);
        var pole = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 1.2, 6), new T.MeshStandardMaterial({ color: C(0x3a4147) }));
        pole.position.y = 1.0;
        g.add(pole);
        var lampMat = new T.MeshStandardMaterial({ color: C(0xfff0b0), emissive: C(0xffb347), emissiveIntensity: 1.0 });
        var lamp = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), lampMat);
        lamp.position.y = 1.65;
        g.add(lamp);
        g.position.set(bx, 0, bz);
        envGroup.add(g);
        buoys.push({ group: g, mat: lampMat, phase: rng() * 6 });
      }
    }

    if (feats.indexOf('kelp') !== -1) {
      kelpGroup = new T.Group();
      envGroup.add(kelpGroup);
      var kelpMat = new T.MeshStandardMaterial({ color: C(0x37543a), roughness: 1, side: T.DoubleSide });
      var kelpMat2 = new T.MeshStandardMaterial({ color: C(0x506b44), roughness: 1, side: T.DoubleSide });
      for (var k = 0; k < 30; k++) {
        var kx = (rng() - 0.5) * 150;
        var kz = -48 - rng() * 110;
        var kh = 1.6 + rng() * 2.8;
        var stalk = new T.Mesh(new T.CylinderGeometry(0.035, 0.07, kh, 4), kelpMat);
        stalk.position.set(kx, kh / 2 - 0.3, kz);
        stalk.rotation.z = (rng() - 0.5) * 0.3;
        kelpGroup.add(stalk);
        var leaf = new T.Mesh(new T.PlaneGeometry(0.3 + rng() * 0.35, 0.8 + rng() * 1.1), rng() < 0.5 ? kelpMat : kelpMat2);
        leaf.position.set(kx + 0.12, kh * 0.72, kz);
        leaf.rotation.y = rng() * Math.PI;
        leaf.rotation.z = (rng() - 0.5) * 0.35;
        kelpGroup.add(leaf);
      }
    }

    if (feats.indexOf('reef') !== -1) {
      var coralMats = [C(0xff7f6e), C(0xffb86b), C(0x8be0c4), C(0xd18cff)].map(function (c) { return new T.MeshStandardMaterial({ color: c, roughness: 0.8, flatShading: true }); });
      for (var cr = 0; cr < 18; cr++) {
        var cx = (rng() - 0.5) * 90;
        var cz = -12 - rng() * 55;
        var cs = 0.5 + rng() * 1.4;
        var mat = coralMats[Math.floor(rng() * coralMats.length)];
        addMesh(new T.ConeGeometry(cs, cs * 2.2, 5), mat, cx, cs * 0.8, cz, (rng() - 0.5) * 0.4, rng() * 6, (rng() - 0.5) * 0.4);
        if (rng() < 0.4) addMesh(new T.SphereGeometry(cs * 0.7, 7, 6), mat, cx + 0.7, cs * 0.4, cz + 0.5, 0, 0, 0);
      }
    }

    if (feats.indexOf('wreck') !== -1) {
      var wreck = new T.Group();
      var hMat = new T.MeshStandardMaterial({ color: C(0x352d26), roughness: 1, flatShading: true });
      var h = new T.Mesh(new T.BoxGeometry(13, 3.2, 4.2), hMat);
      h.position.y = 0.6;
      wreck.add(h);
      var bow = new T.Mesh(new T.ConeGeometry(2.2, 5, 4), hMat);
      bow.rotation.z = -Math.PI / 2;
      bow.position.set(8, 0.6, 0);
      bow.rotation.y = Math.PI / 4;
      wreck.add(bow);
      var cab = new T.Mesh(new T.BoxGeometry(3.2, 2.0, 2.6), hMat);
      cab.position.set(-1.5, 2.4, 0);
      wreck.add(cab);
      var brokenMast = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 9, 6), hMat);
      brokenMast.position.set(-3.5, 3.6, 0);
      brokenMast.rotation.z = 0.7;
      wreck.add(brokenMast);
      wreck.position.set(24, 0, -72);
      wreck.rotation.y = -0.5;
      envGroup.add(wreck);
    }

    if (feats.indexOf('lighthouse') !== -1) {
      var lh = new T.Group();
      var white = new T.MeshStandardMaterial({ color: C(0xe8e4d8), roughness: 0.8 });
      var red = new T.MeshStandardMaterial({ color: C(0xb23a32), roughness: 0.8 });
      var tower = new T.Mesh(new T.CylinderGeometry(1.1, 1.9, 16, 12), white);
      tower.position.y = 8;
      lh.add(tower);
      var band = new T.Mesh(new T.CylinderGeometry(1.55, 1.7, 2.2, 12), red);
      band.position.y = 7;
      lh.add(band);
      var top = new T.Mesh(new T.CylinderGeometry(0.8, 1.1, 1.6, 10), red);
      top.position.y = 16.6;
      lh.add(top);
      var beamMat = new T.MeshStandardMaterial({ color: C(0xfff3c4), emissive: C(0xffd166), emissiveIntensity: 1.4 });
      var beam = new T.Mesh(new T.SphereGeometry(0.55, 10, 8), beamMat);
      beam.position.y = 17.6;
      lh.add(beam);
      lh.position.set(-70, 0, -150);
      envGroup.add(lh);
      buoys.push({ group: lh, mat: beamMat, phase: 0, lighthouse: true });
    }

    if (feats.indexOf('glow') !== -1 || lv.time === 'night') {
      var n = 260;
      var gp = new Float32Array(n * 3);
      glowData = [];
      for (var gi = 0; gi < n; gi++) {
        var gx = (rng() - 0.5) * 150;
        var gz = 8 - rng() * 110;
        var gy = 0.1 + rng() * 2.4;
        gp[gi * 3] = gx; gp[gi * 3 + 1] = gy; gp[gi * 3 + 2] = gz;
        glowData.push({ baseY: gy, phase: rng() * 6, speed: 0.3 + rng() * 0.6 });
      }
      var ggeo = new T.BufferGeometry();
      ggeo.setAttribute('position', new T.BufferAttribute(gp, 3));
      glowMotes = new T.Points(ggeo, softPointsMaterial(0x66ffe0, 0.18, 0.65, true));
      envGroup.add(glowMotes);
    } else {
      glowMotes = null;
    }

    // rain
    rain = null;
    if (lv.weather === 'rain' || lv.weather === 'storm') {
      var rn = lv.weather === 'storm' ? 1500 : 900;
      rainPos = new Float32Array(rn * 6);
      rainVel = new Float32Array(rn);
      for (var ri = 0; ri < rn; ri++) {
        var rx = (rng() - 0.5) * 90;
        var ry = rng() * 45;
        var rz = 25 - rng() * 110;
        rainPos[ri * 6] = rx;
        rainPos[ri * 6 + 1] = ry;
        rainPos[ri * 6 + 2] = rz;
        rainPos[ri * 6 + 3] = rx + 0.32;
        rainPos[ri * 6 + 4] = ry - 1.35;
        rainPos[ri * 6 + 5] = rz + 0.08;
        rainVel[ri] = 26 + rng() * 22;
      }
      var rgeo = new T.BufferGeometry();
      rgeo.setAttribute('position', new T.BufferAttribute(rainPos, 3));
      rain = new T.LineSegments(rgeo, new T.LineBasicMaterial({ color: C(0xc6e2ea), transparent: true, opacity: 0.3, depthWrite: false }));
      rain.frustumCulled = false;
      envGroup.add(rain);
    }

    // clouds tint
    var cloudTint = lv.weather === 'storm' ? C(0x55646b) : lv.time === 'night' ? C(0x263341) : C(0xffffff);
    clouds.forEach(function (c) {
      c.sprite.material.color = cloudTint;
      c.sprite.material.opacity = lv.weather === 'mist' ? 0.38 : 0.5;
    });

    jumpTimer = 4 + rng() * 4;
  }

  // ------------------------------------------------------------------ underwater scene
  function buildUnderLevel(lv) {
    while (underRoot.children.length) {
      var ch = underRoot.children.pop();
      disposeGroup(ch);
    }
    underFish = null;
    underFishLen = 1;
    underFishDef = null;
    underRoot.userData = {};

    var bgUniforms = { uTop: { value: C(lv.water.top) }, uDeep: { value: C(0x03131c) } };
    var bgGeo = new T.SphereGeometry(850, 24, 16);
    var bg = new T.Mesh(bgGeo, new T.ShaderMaterial({ uniforms: bgUniforms, vertexShader: underVert, fragmentShader: underFrag, side: T.BackSide, depthWrite: false, fog: false }));
    bg.visible = false;
    underRoot.add(bg);
    underRoot.userData.bgUniforms = bgUniforms;
    underScene.background = new T.Color(lv.time === 'night' ? 0x04141d : 0x0a3c4a);

    underScene.fog.color = C(lv.water.deep);
    underScene.fog.density = 0.014;

    // depth rings every 10 m
    var maxRing = Math.ceil((lv.depthMax + 10) / 10) * 10;
    for (var d = 10; d <= maxRing; d += 10) {
      var pts = [];
      for (var a = 0; a <= 48; a++) {
        var ang = (a / 48) * Math.PI * 2;
        pts.push(new T.Vector3(Math.cos(ang) * 7, 0, Math.sin(ang) * 7));
      }
      var rgeo = new T.BufferGeometry().setFromPoints(pts);
      var rmat = new T.LineBasicMaterial({ color: C(0x6fe3d2), transparent: true, opacity: 0.18, depthWrite: false });
      var ring = new T.LineLoop(rgeo, rmat);
      ring.position.y = -d;
      underRoot.add(ring);
      underRoot.userData['ring' + d] = ring;
    }

    // light shafts
    var shaftTex = canvasTexture(64, 256, function (g, w, h) {
      var gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, 'rgba(190,245,255,0.55)');
      gr.addColorStop(0.55, 'rgba(120,220,255,0.12)');
      gr.addColorStop(1, 'rgba(80,180,220,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    });
    for (var s = 0; s < 6; s++) {
      var sm = new T.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.18, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
      var shaft = new T.Mesh(new T.PlaneGeometry(7, 60), sm);
      shaft.position.set(-34 + s * 14, -18, -18 + (s % 2) * 8);
      shaft.rotation.z = 0.25;
      underRoot.add(shaft);
    }

    // marine snow
    var sn = 520;
    var sp = new Float32Array(sn * 3);
    underRoot.userData.snowData = [];
    for (var i = 0; i < sn; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 90;
      sp[i * 3 + 1] = -Math.random() * 170;
      sp[i * 3 + 2] = (Math.random() - 0.5) * 90;
      underRoot.userData.snowData.push({ vy: 0.15 + Math.random() * 0.5, phase: Math.random() * 6 });
    }
    var snowGeo = new T.BufferGeometry();
    snowGeo.setAttribute('position', new T.BufferAttribute(sp, 3));
    var snow = new T.Points(snowGeo, softPointsMaterial(0xbfefff, 0.055, 0.5, false));
    snow.frustumCulled = false;
    underRoot.add(snow);
    underRoot.userData.snow = snow;

    // bubble stream from the hooked fish
    var bcount = 60;
    var bpos = new Float32Array(bcount * 3);
    var bdat = [];
    for (var bi = 0; bi < bcount; bi++) {
      bdat.push({ x: (Math.random() - 0.5) * 3.2, z: (Math.random() - 0.5) * 2.4, speed: 0.5 + Math.random() * 1.1, phase: Math.random() * 6, radius: 1 + Math.random() * 3 });
      bpos[bi * 3] = bdat[bi].x; bpos[bi * 3 + 1] = -6; bpos[bi * 3 + 2] = bdat[bi].z;
    }
    var bgeo = new T.BufferGeometry();
    bgeo.setAttribute('position', new T.BufferAttribute(bpos, 3));
    var bubbles = new T.Points(bgeo, softPointsMaterial(0xc8f7ff, 0.045, 0.45, true));
    bubbles.frustumCulled = false;
    underRoot.add(bubbles);
    underRoot.userData.bubbles = bubbles;
    underRoot.userData.bubbleData = bdat;

    // hook line
    var ulp = new Float32Array(24 * 3);
    var ulgeo = new T.BufferGeometry();
    ulgeo.setAttribute('position', new T.BufferAttribute(ulp, 3));
    var uline = new T.Line(ulgeo, new T.LineBasicMaterial({ color: C(0xe8f7f2), transparent: true, opacity: 0.7 }));
    uline.frustumCulled = false;
    underRoot.add(uline);
    underRoot.userData.uline = uline;
    underRoot.userData.surface = -1;
  }

  function makeFishModel(def, len) {
    var g = null;
    if (window.FishFactory && window.FishFactory.create) {
      try { g = window.FishFactory.create(def, len); } catch (e) { g = null; }
    }
    if (!g) {
      g = new T.Group();
      var mat = new T.MeshStandardMaterial({ color: C(def.color), roughness: 0.6, flatShading: true, emissive: def.glow ? C(def.glow) : C(0x000000), emissiveIntensity: def.glow ? 0.8 : 0 });
      var body = new T.Mesh(new T.SphereGeometry(0.5, 10, 8), mat);
      body.scale.set(len * 0.42, len * 0.22, len * 0.15);
      g.add(body);
      var tail = new T.Mesh(new T.ConeGeometry(len * 0.14, len * 0.34, 4), mat);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -len * 0.46;
      g.add(tail);
      var fin = new T.Mesh(new T.ConeGeometry(len * 0.1, len * 0.24, 3), mat);
      fin.position.set(0, len * 0.22, 0);
      fin.rotation.x = Math.PI;
      g.add(fin);
      g.userData.tail = tail;
    }
    return g;
  }

  // ------------------------------------------------------------------ public controls
  W.setCharge = function (p) { charge = clamp(p, 0, 1); };

  W.cast = function (dist, onLand) {
    distance = Math.max(3, dist);
    bobberVisible = true;
    bobber.visible = true;
    jigT = 0;
    lineVisible = true;
    line.visible = true;
    biteTimer = 0;
    var start = rodTipWorld.clone();
    if (start.length() < 1) start.set(0.8, 3.2, -4.5);
    var end = new T.Vector3(0, 0, -distance);
    var power = clamp((dist - 7) / 40, 0.2, 1);
    castTween = { t: 0, dur: 0.72 + power * 0.2, start: start, end: end, arc: 3.5 + power * 4, onLand: onLand || null, landed: false };
    bobber.position.copy(start);
    charge = 0;
  };

  W.reset = function () {
    distance = 0;
    lureDepth = 0; lureTarget = 0;
    bobberVisible = false;
    if (bobber) bobber.visible = false;
    bobberRipples.forEach(function (r) { r.mesh.visible = false; });
    lineVisible = false;
    if (line) line.visible = false;
    biteTimer = 0;
    castTween = null;
    clearCatchFish();
    if (underFish) {
      disposeGroup(underFish);
      underFish = null;
    }
    underFishDef = null;
    W.hideSchool();
  };

  W.showSchool = function (dist, depth) {
    if (!school) return;
    schoolVisible = true;
    school.visible = true;
    school.position.set(0, 0, -dist);
    school.userData.depth = depth;
  };

  W.hideSchool = function () {
    schoolVisible = false;
    if (school) school.visible = false;
  };

  W.setLureDepth = function (cur, target) {
    lureDepth = cur;
    lureTarget = target;
  };

  W.bite = function () {
    biteTimer = 1.5;
    if (bobber) {
      burstSplash(bobber.position.x, bobber.position.z, 0.5);
    }
  };

  W.endBite = function () { biteTimer = 0; };

  W.jig = function () {
    jigT = 0.55;
    if (bobber && bobberVisible) burstSplash(bobber.position.x, bobber.position.z, 0.25);
  };

  W.hook = function (def, len, depth) {
    underFishDef = def;
    underFishLen = Math.max(0.8, len || 1);
    if (underFish) { disposeGroup(underFish); underFish = null; }
    underFish = makeFishModel(def, underFishLen);
    underFish.scale.multiplyScalar(1.4);
    underFish.position.set(0, -Math.max(1, depth || 10), 0);
    underRoot.add(underFish);
    mode = 'fight';
    pipVisible = true;
    shake = Math.max(shake, 0.45);
    if (bobber) burstSplash(bobber.position.x, bobber.position.z, 0.8);
    fight = { depth: Math.max(1, depth || 10), tension: 0.2, stamina: 1, reeling: false, giveLine: false, surge: false };
    fightSurgePrev = false;
  };

  W.setFight = function (f) {
    if (!f) return;
    if (!fight) fight = { depth: 10, tension: 0, stamina: 1, reeling: false, giveLine: false, surge: false };
    if (f.surge && !fightSurgePrev) shake = Math.max(shake, 0.55);
    fightSurgePrev = !!f.surge;
    fight.depth = f.depth;
    fight.tension = f.tension;
    fight.stamina = f.stamina;
    fight.reeling = f.reeling;
    fight.giveLine = f.giveLine;
    fight.surge = f.surge;
  };

  W.land = function (def, len) {
    if (underFish) { disposeGroup(underFish); underFish = null; }
    pipVisible = false;
    mode = 'catch';
    clearCatchFish();
    var size = Math.max(1, len || 1);
    catchFishGroup = makeFishModel(def, size);
    catchFishGroup.position.set(0.4, 1.0, -4.0);
    scene.add(catchFishGroup);
    catchTween = { t: 0, dur: 1.5, size: size, def: def };
    burstSplash(0, -3.5, 1.0);
    shake = Math.max(shake, 0.3);
  };

  W.snap = function () {
    shake = Math.max(shake, 1.1);
    lineVisible = false;
    if (line) line.visible = false;
    if (bobber) bobber.visible = false;
    bobberRipples.forEach(function (r) { r.mesh.visible = false; });
    burstSplash(0, -distance, 0.7);
  };

  function clearCatchFish() {
    if (catchFishGroup) { disposeGroup(catchFishGroup); catchFishGroup = null; }
    catchTween = null;
  }

  W.clearFish = function () {
    clearCatchFish();
    if (underFish) { disposeGroup(underFish); underFish = null; }
    pipVisible = false;
  };

  function burstSplash(x, z, strength) {
    if (!splash) return;
    strength = strength || 1;
    var n = splashData.length;
    var y = waveHeight(x, z, time);
    for (var i = 0; i < n; i++) {
      var d = splashData[i];
      var a = Math.random() * Math.PI * 2;
      var sp = (0.8 + Math.random() * 2.4) * strength;
      splashPos[i * 3] = x + Math.cos(a) * 0.1;
      splashPos[i * 3 + 1] = y + 0.08;
      splashPos[i * 3 + 2] = z + Math.sin(a) * 0.1;
      d.vx = Math.cos(a) * sp * 0.5;
      d.vz = Math.sin(a) * sp * 0.5;
      d.vy = 1.2 + Math.random() * 3.2 * strength;
      d.life = 0.55 + Math.random() * 0.65;
    }
    splash.geometry.attributes.position.needsUpdate = true;
    setPointOpacity(splash, 0.9);
    splash.visible = true;
  }

  // ------------------------------------------------------------------ waves
  function waveHeight(x, z, t) {
    var tt = t * waveSpeed;
    return (Math.sin(x * 0.06 + tt * 0.8) * 0.55 + Math.sin(z * 0.045 - tt * 0.62) * 0.45 + Math.sin((x + z) * 0.11 + tt * 1.3) * 0.18) * waveAmp +
      (Math.sin(x * 0.55 + tt * 2.1) * 0.045 + Math.sin(z * 0.62 - tt * 1.9) * 0.045) * (0.4 + waveAmp);
  }

  // ------------------------------------------------------------------ frame update
  W.render = function (dt) {
    if (!renderer) return;
    dt = Math.min(dt || 0.016, 0.05);
    time += dt;

    waterUniforms.uTime.value = time * 1.0;
    waterUniforms.uAmp.value = waveAmp;

    updateBoat(dt);
    updateEnvironment(dt);
    updateBobber(dt);
    updateLine(dt);
    updateSplash(dt);
    updateUnder(dt);
    updateCatch(dt);
    updateCamera(dt);
    updateFlash(dt);

    if (flashEl) flashEl.style.opacity = String(clamp(flash, 0, 0.75));

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, WIDTH, HEIGHT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    if (pipVisible && mode === 'fight' && pipEl && !pipEl.classList.contains('hidden')) {
      var r = pipEl.getBoundingClientRect();
      if (r.width > 4 && r.height > 4) {
        var x = r.left;
        var y = window.innerHeight - r.bottom;
        underCam.aspect = r.width / r.height;
        underCam.updateProjectionMatrix();
        renderer.setScissorTest(true);
        renderer.setViewport(x, y, r.width, r.height);
        renderer.setScissor(x, y, r.width, r.height);
        renderer.clear(true, true, true);
        renderer.render(underScene, underCam);
        renderer.setScissorTest(false);
        renderer.setViewport(0, 0, WIDTH, HEIGHT);
      }
    }
  };

  function updateBoat() {
    var bob = waveHeight(0, 0, time);
    boat.position.y = bob * 0.55 - 0.15;
    boat.rotation.z = Math.sin(time * 0.75) * 0.018 + Math.sin(time * 0.31) * 0.01;
    boat.rotation.x = Math.sin(time * 0.52 + 0.7) * 0.012;
    boat.rotation.y = Math.sin(time * 0.19) * 0.005;
    boat.updateMatrixWorld(true);
    rodTipObj.getWorldPosition(rodTipWorld);

    var bend = 0;
    var tension = fight ? fight.tension : 0;
    if (mode === 'fight') bend = 0.12 + tension * 0.55;
    else if (charge > 0) bend = -charge * 0.55;
    for (var i = 0; i < rodJoints.length; i++) {
      var j = rodJoints[i];
      j.joint.rotation.x = j.base - bend * 0.16 * (i + 1);
    }
    // pull the whole rod back slightly when a fish runs
    rodRoot.rotation.x = -1.02 - (fight && fight.surge ? 0.09 : 0.0) * Math.min(1, tension + 0.4);
  }

  function updateEnvironment(dt) {
    if (sky) sky.rotation.y = time * 0.004;
    if (skyUniforms && skyUniforms.uTime) skyUniforms.uTime.value = time;
    // clouds drift
    clouds.forEach(function (c) {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > 280) c.sprite.position.x = -280;
    });
    // buoys bob
    buoys.forEach(function (b) {
      if (b.lighthouse) {
        b.mat.emissiveIntensity = 1.0 + Math.sin(time * 2.2 + b.phase) * 0.5;
        return;
      }
      var p = b.group.position;
      b.group.position.y = waveHeight(p.x, p.z, time) * 0.9;
      b.group.rotation.z = Math.sin(time * 1.2 + b.phase) * 0.1;
      b.mat.emissiveIntensity = 0.8 + Math.max(0, Math.sin(time * 1.6 + b.phase)) * 1.2;
    });
    if (kelpGroup) kelpGroup.rotation.z = Math.sin(time * 0.5) * 0.012;
    // glow motes breathe
    if (glowMotes) {
      var arr = glowMotes.geometry.attributes.position.array;
      for (var i = 0; i < glowData.length; i++) {
        var g = glowData[i];
        arr[i * 3 + 1] = g.baseY + Math.sin(time * g.speed + g.phase) * 0.35;
      }
      glowMotes.geometry.attributes.position.needsUpdate = true;
    }
    // rain (slanted segments)
    if (rain) {
      var rp = rain.geometry.attributes.position.array;
      for (var r = 0; r < rainVel.length; r++) {
        var bi = r * 6;
        rp[bi + 1] -= rainVel[r] * dt;
        rp[bi] += 4.2 * dt;
        if (rp[bi + 1] < -1) {
          rp[bi + 1] = 34 + Math.random() * 14;
          rp[bi] = (Math.random() - 0.5) * 90;
          rp[bi + 2] = 25 - Math.random() * 110;
        }
        rp[bi + 3] = rp[bi] + 0.32;
        rp[bi + 4] = rp[bi + 1] - 1.35;
        rp[bi + 5] = rp[bi + 2] + 0.08;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    // lightning
    if (level && (level.weather === 'storm' || level.weather === 'rain')) {
      lightningTimer -= dt;
      if (lightningTimer <= 0) {
        lightningTimer = 7 + Math.random() * 10;
        flash = 1.3;
        if (window.AudioKit && window.AudioKit.thunder) { try { window.AudioKit.thunder(); } catch (e) {} }
      }
    }
    // ambient fish jumps
    jumpTimer -= dt;
    if (jumpTimer <= 0 && level) {
      jumpTimer = 5 + Math.random() * 8;
      spawnAmbientJump();
    }
    for (var j = ambientJumps.length - 1; j >= 0; j--) {
      var jump = ambientJumps[j];
      jump.t += dt;
      var p = jump.t / jump.dur;
      var fish = jump.mesh;
      fish.position.x = jump.x0 + (jump.x1 - jump.x0) * p;
      fish.position.z = jump.z0 + (jump.z1 - jump.z0) * p;
      fish.position.y = waveHeight(fish.position.x, fish.position.z, time) + Math.sin(p * Math.PI) * jump.height;
      fish.rotation.z = Math.cos(p * Math.PI) * 0.9;
      fish.rotation.y = jump.heading;
      if (window.FishFactory && window.FishFactory.animate) {
        try { window.FishFactory.animate(fish, time, 2.5, 0.6); } catch (e) {}
      }
      if (p >= 1) {
        burstSplash(fish.position.x, fish.position.z, 0.4);
        disposeGroup(fish);
        ambientJumps.splice(j, 1);
      }
    }
  }

  function spawnAmbientJump() {
    if (!window.GAME_DATA || !window.GAME_DATA.FISH) return;
    var pool = level.species.map(function (id) {
      for (var i = 0; i < window.GAME_DATA.FISH.length; i++) if (window.GAME_DATA.FISH[i].id === id) return window.GAME_DATA.FISH[i];
      return null;
    }).filter(Boolean);
    if (!pool.length) return;
    var def = pool[Math.floor(Math.random() * pool.length)];
    var len = 0.35 + Math.random() * 0.5;
    var fish = makeFishModel(def, len);
    var x0 = (Math.random() - 0.5) * 50;
    var z0 = -14 - Math.random() * 40;
    var heading = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    fish.position.set(x0, 0, z0);
    fish.rotation.y = heading;
    scene.add(fish);
    ambientJumps.push({ mesh: fish, t: 0, dur: 1.0 + Math.random() * 0.6, x0: x0, z0: z0, x1: x0 + (heading > 0 ? 3 : -3), z1: z0 + 1.5, height: 1.2 + Math.random() * 1.6, heading: heading });
    burstSplash(x0, z0, 0.35);
  }

  function updateBobber(dt) {
    if (!bobber || !bobberVisible) {
      bobberRipples.forEach(function (r) { r.mesh.visible = false; });
      return;
    }
    if (castTween) {
      castTween.t += dt;
      var p = clamp(castTween.t / castTween.dur, 0, 1);
      var e = p;
      var x = lerp(castTween.start.x, castTween.end.x, e);
      var z = lerp(castTween.start.z, castTween.end.z, e);
      var y = lerp(castTween.start.y, 0, e) + Math.sin(p * Math.PI) * castTween.arc;
      bobber.position.set(x, y, z);
      if (p >= 1 && !castTween.landed) {
        castTween.landed = true;
        burstSplash(castTween.end.x, castTween.end.z, 0.9);
        var cb = castTween.onLand;
        castTween = null;
        if (cb) { try { cb(); } catch (err) { console.error(err); } }
      }
    }
    if (!castTween) {
      var bx = Math.sin(time * 0.5) * 0.12;
      var bz = -distance;
      var y = waveHeight(bx, bz, time);
      var dip = 0;
      if (biteTimer > 0) dip = 0.22 + Math.sin(time * 22) * 0.06;
      if (jigT > 0) { jigT -= dt; dip += Math.sin((1 - jigT / 0.55) * Math.PI) * 0.22; }
      if (mode === 'fight' && fight) dip = 0.06 + Math.sin(time * 9) * 0.04 + fight.tension * 0.08;
      if (mode === 'fight' && fight && fight.surge) dip += 0.12;
      bobber.position.set(bx, y + dip, bz);
      bobber.rotation.z = Math.sin(time * 3.2 + 1.4) * 0.14;
    }
    bobber.visible = true;
    // ripples
    bobberRipples.forEach(function (r) {
      var ph = (time * 0.45 + r.phase) % 1;
      var s = 0.7 + ph * 3.2;
      r.mesh.visible = true;
      r.mesh.position.set(bobber.position.x, waveHeight(bobber.position.x, bobber.position.z, time) + 0.02, bobber.position.z);
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = (1 - ph) * 0.22;
    });
    if (schoolVisible) {
      var sp = school.position;
      sp.y = waveHeight(sp.x, sp.z, time);
      schoolRings.forEach(function (r) {
        var ph = (time * 0.3 + r.phase) % 1;
        var s = 1 + ph * 2.4;
        r.mesh.scale.set(s, 1, s);
        r.mesh.material.opacity = (1 - ph) * 0.3;
      });
    }
  }

  function updateLine() {
    if (!line) return;
    var show = lineVisible && bobberVisible && bobber;
    if (!show) { line.visible = false; return; }
    line.visible = true;
    var tip = rodTipWorld;
    var end = bobber.position;
    var midX = (tip.x + end.x) / 2;
    var midY = (tip.y + end.y) / 2 - 0.25 - (fight ? (1 - fight.tension) * 0.8 : 0);
    var midZ = (tip.z + end.z) / 2;
    var n = linePos.length / 3;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1);
      var a = (1 - t) * (1 - t);
      var b = 2 * (1 - t) * t;
      var c = t * t;
      linePos[i * 3] = a * tip.x + b * midX + c * end.x;
      linePos[i * 3 + 1] = a * tip.y + b * midY + c * end.y;
      linePos[i * 3 + 2] = a * tip.z + b * midZ + c * end.z;
    }
    lineGeo.attributes.position.needsUpdate = true;
  }

  function updateSplash(dt) {
    if (!splash || !splash.visible) return;
    var alive = false;
    for (var i = 0; i < splashData.length; i++) {
      var d = splashData[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      alive = true;
      splashPos[i * 3] += d.vx * dt;
      splashPos[i * 3 + 1] += d.vy * dt;
      splashPos[i * 3 + 2] += d.vz * dt;
      d.vy -= 9.8 * dt;
      if (splashPos[i * 3 + 1] < 0) { splashPos[i * 3 + 1] = 0; d.vy *= -0.15; d.life = Math.min(d.life, 0.2); }
    }
    splash.geometry.attributes.position.needsUpdate = true;
    setPointOpacity(splash, Math.max(0, (splash.material.uniforms ? splash.material.uniforms.uOpacity.value : 0) - dt * 0.7));
    if (!alive) splash.visible = false;
  }

  function updateFlash(dt) {
    if (flash > 0) flash = Math.max(0, flash - dt * 3.2);
    if (scene.userData.dir) {
      var baseDir = scene.userData.baseDir || 1;
      scene.userData.dir.intensity = baseDir + flash * 2.2;
    }
    if (scene.userData.hemi) {
      var baseHemi = scene.userData.baseHemi || 0.8;
      scene.userData.hemi.intensity = baseHemi + flash * 0.8;
    }
  }

  function updateCamera(dt) {
    var night = scene.userData.night;
    var bobY = waveHeight(0, 0, time) * 0.4;
    var portrait = HEIGHT > WIDTH * 1.15;
    if (mode === 'title' || mode === 'harbor' || mode === 'results') {
      var a = time * 0.045 + 0.6;
      var orbit = portrait ? 23 : 14.5;
      camPosTarget.set(Math.sin(a) * orbit, (portrait ? 9.6 : 7.2) + bobY + Math.sin(time * 0.23) * 0.5, Math.cos(a) * orbit);
      camLookTarget.set(0, 2.2, -12);
    } else if (mode === 'fight') {
      var tension = fight ? fight.tension : 0;
      camPosTarget.set(portrait ? 1.2 : 2.4 + Math.sin(time * 0.4) * 0.4, (portrait ? 8.4 : 5.4) + bobY, portrait ? 20 : 11.6);
      camLookTarget.set(0, 0.6, -Math.max(8, distance * 0.55) - (portrait ? 4 : 0));
      if (fight && fight.surge) {
        camPosTarget.x += Math.sin(time * 40) * 0.08;
        camPosTarget.y += Math.cos(time * 34) * 0.06;
      }
    } else if (mode === 'catch') {
      camPosTarget.set(portrait ? 9.5 : 6.2, (portrait ? 6.2 : 4.4) + bobY, portrait ? 15 : 9.2);
      camLookTarget.set(portrait ? 1.5 : 1.0, 2.7, -3.2);
    } else {
      var d = distance > 0 ? distance : 18;
      camPosTarget.set((portrait ? 1.2 : 3.6) + Math.sin(time * 0.18) * 0.3, (portrait ? 10.2 : 7.1) + bobY, portrait ? 25 : 14.8);
      camLookTarget.set(-0.4, 0.55, -Math.max(10, d * 0.5) - (portrait ? 3 : 0));
      if (biteTimer > 0) {
        camPosTarget.y -= 0.25;
        camLookTarget.y -= 0.3;
      }
    }
    if (shake > 0) {
      camPosTarget.x += (Math.random() - 0.5) * shake * 0.55;
      camPosTarget.y += (Math.random() - 0.5) * shake * 0.4;
      shake = Math.max(0, shake - dt * 2.2);
    }
    var k = camSnap ? 1 : 1 - Math.exp(-dt * 4.2);
    cameraPos.lerp(camPosTarget, k);
    cameraLook.lerp(camLookTarget, camSnap ? 1 : 1 - Math.exp(-dt * 5.0));
    camSnap = false;
    camera.position.copy(cameraPos);
    camera.lookAt(cameraLook);
    camera.fov = mode === 'fight' ? 50 : 52;
    camera.updateProjectionMatrix();
    if (mode === 'fight') camera.position.y += Math.sin(time * 0.9) * 0.05;
  }

  function updateUnder(dt) {
    if (!underFish || !fight) return;
    var depth = Math.max(0.6, fight.depth);
    var def = underFishDef;
    underFish.position.y = -depth;
    underFish.position.x = Math.sin(time * 0.7) * 0.4;
    var excite = fight.surge ? 1 : (fight.reeling ? 0.55 : 0.22);
    underFish.rotation.z = Math.sin(time * 5.2) * 0.08 * excite;
    underFish.rotation.y = Math.sin(time * 0.9) * 0.2 * excite;
    if (window.FishFactory && window.FishFactory.animate) {
      try { window.FishFactory.animate(underFish, time, fight.reeling ? 2.2 : 1.1, excite); } catch (e) {}
    }

    var len = underFishLen;
    var fishY = -depth;
    var camTargetY = Math.min(-1.1, fishY + 0.7 + Math.sin(time * 0.6) * 0.2);
    var dist = Math.max(2.6, len * 1.4);
    if (underCam) {
      underCam.position.set(0.9, camTargetY + 0.15, dist);
      underCam.lookAt(0.1, fishY + len * 0.05, 0);
      underCam.fov = 55;
      underCam.updateProjectionMatrix();
    }
    underScene.fog.density = 0.010 + Math.min(1, depth / 150) * 0.018;
    if (underScene.userData.point) {
      underScene.userData.point.position.set(0, -depth + 1.2, 2.6);
      underScene.userData.point.intensity = 0.75 + 0.45 * (1 - Math.min(1, depth / 60));
    }
    underScene.fog.color = C(level.water.deep);
    var bgU = underRoot.userData.bgUniforms;
    if (bgU) {
      bgU.uTop.value = C(level.water.top);
      bgU.uDeep.value = C(0x03131c);
    }
    // surface line
    var uline = underRoot.userData.uline;
    if (uline) {
      var arr = uline.geometry.attributes.position.array;
      var n = arr.length / 3;
      var noseX = underFish.position.x + Math.cos(underFish.rotation.y) * len * 0.66;
      for (var i = 0; i < n; i++) {
        var t = i / (n - 1);
        arr[i * 3] = lerp(noseX, 0.2, t);
        arr[i * 3 + 1] = lerp(-depth, 0, t) + Math.sin(t * Math.PI) * 0.4;
        arr[i * 3 + 2] = lerp(0.1, 0.1, t);
      }
      uline.geometry.attributes.position.needsUpdate = true;
      uline.material.opacity = 0.55;
    }
    // rings fade by distance from camera
    for (var key in underRoot.userData) {
      if (key.indexOf('ring') !== 0) continue;
      var ring = underRoot.userData[key];
      var dy = Math.abs(ring.position.y - camTargetY);
      ring.material.opacity = clamp(1 - dy / 40, 0, 1) * 0.22;
    }
    // shafts fade when deep
    var shaftOpacity = clamp(1 - depth / 70, 0, 1) * 0.7;
    underRoot.children.forEach(function (o) {
      if (o.material && o.material.map && o.material.blending === T.AdditiveBlending) o.material.opacity = shaftOpacity;
    });
    // bubbles rising from the fish
    var bub = underRoot.userData.bubbles;
    if (bub) {
      var bd = underRoot.userData.bubbleData;
      var ba = bub.geometry.attributes.position.array;
      for (var q = 0; q < bd.length; q++) {
        var datum = bd[q];
        var rise = (time * datum.speed + datum.phase * 3.5) % 16;
        ba[q * 3] = datum.x + Math.sin(time * 1.4 + datum.phase) * 0.18;
        ba[q * 3 + 1] = Math.min(-0.4, -depth + 1.0 + rise);
        ba[q * 3 + 2] = datum.z + Math.cos(time * 1.1 + datum.phase) * 0.14;
      }
      bub.geometry.attributes.position.needsUpdate = true;
    }
    // snow drift
    var snow = underRoot.userData.snow;
    if (snow) {
      var sp = snow.geometry.attributes.position.array;
      var data = underRoot.userData.snowData;
      for (var s = 0; s < data.length; s++) {
        sp[s * 3 + 1] -= data[s].vy * dt * 2;
        sp[s * 3] += Math.sin(time * 0.4 + data[s].phase) * dt * 0.3;
        if (sp[s * 3 + 1] < -depth - 50) sp[s * 3 + 1] = -depth + 60;
      }
      snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  function updateCatch(dt) {
    if (!catchTween || !catchFishGroup) return;
    catchTween.t += dt;
    var p = clamp(catchTween.t / catchTween.dur, 0, 1);
    var y = 1.0 + Math.sin(p * Math.PI) * 2.6 - p * 1.0;
    catchFishGroup.position.set(0.4 + Math.sin(p * 3) * 0.3, y, -4.0);
    catchFishGroup.rotation.z = -0.4 + p * 1.4;
    catchFishGroup.rotation.y = 0.5 + p * 1.6;
    if (window.FishFactory && window.FishFactory.animate) {
      try { window.FishFactory.animate(catchFishGroup, time, 2.8, 1); } catch (e) {}
    }
    if (p >= 1) catchFishGroup.rotation.z = 0.9;
  }

  W.debugUnder = function () {
    if (!underFish || !underCam) return null;
    var box = new T.Box3().setFromObject(underFish);
    return {
      len: underFishLen,
      scale: underFish.scale.x,
      pos: underFish.position.toArray(),
      cam: underCam.position.toArray(),
      boxMin: box.min.toArray(),
      boxMax: box.max.toArray(),
      fishName: underFishDef ? underFishDef.name : null
    };
  };

  // expose a couple of internals for the game (read-only-ish)
  W.getState = function () {
    return { mode: mode, distance: distance, bobberVisible: bobberVisible, fight: fight, tip: rodTipWorld };
  };
})();
