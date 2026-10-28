/* ============================================================================
   THE STORM — Acts 27:13–44 (King James Version, public domain)
   A 3D retelling of Paul's voyage and shipwreck.

   One self-contained scene: shader ocean, procedural ship and crew, rain,
   lightning, thirteen narrated beats, synthesized storm audio.

   Query hooks:
     ?still=1&t=SECONDS   freeze at a second and render one frame
     ?autostart=1         begin without a click (silent audio)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  const params = new URLSearchParams(location.search);
  const STILL = params.get('still') === '1';
  const STILL_T = clamp(parseFloat(params.get('t') || '0') || 0, 0, 900);

  /* ------------------------------------------------------------------- dom */
  const $ = (id) => document.getElementById(id);
  const stageEl = $('stage');
  const fadeEl = $('fade');
  const flashEl = $('flash');
  const capEl = $('caption');
  const capTextEl = $('cap-text');
  const capRefEl = $('cap-ref');
  const titlecardEl = $('titlecard');
  const endcardEl = $('endcard');
  const labelEl = $('act-label');
  const refEl = $('act-ref');
  const barEl = $('bar');
  const timeEl = $('time');
  const errEl = $('err');

  function showErr(msg) {
    errEl.style.display = 'block';
    errEl.textContent += (errEl.textContent ? '\n' : '') + msg;
  }
  window.addEventListener('error', (e) => showErr('ERROR: ' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', (e) => showErr('REJECTION: ' + e.reason));

  /* -------------------------------------------------------------- scripture */
  const QUOTES = {
    calm: { t: 'And when the south wind blew softly, supposing that they had obtained their purpose, loosing thence, they sailed close by Crete.', r: 'ACTS 27:13' },
    storm: { t: 'But not long after there arose against it a tempestuous wind, called Euroclydon. And when the ship was caught, and could not bear up into the wind, we let her drive.', r: 'ACTS 27:14–15' },
    lighten: { t: 'And we being exceedingly tossed with a tempest, the next day they lightened the ship; And the third day we cast out with our own hands the tackling of the ship.', r: 'ACTS 27:18–19' },
    despair: { t: 'And when neither sun nor stars in many days appeared, and no small tempest lay on us, all hope that we should be saved was then taken away.', r: 'ACTS 27:20' },
    paulA: { t: 'And now I exhort you to be of good cheer: for there shall be no loss of any man’s life among you, but of the ship.', r: 'ACTS 27:22' },
    paulB: { t: 'For there stood by me this night the angel of God, whose I am, and whom I serve, Saying, Fear not, Paul; thou must be brought before Caesar: and, lo, God hath given thee all them that sail with thee. Wherefore, sirs, be of good cheer: for I believe God, that it shall be even as it was told me.', r: 'ACTS 27:23–25' },
    soundings: { t: 'But when the fourteenth night was come, as we were driven up and down in Adria, about midnight the shipmen deemed that they drew near to some country; And sounded, and found it twenty fathoms: and when they had gone a little further, they sounded again, and found it fifteen fathoms. Then fearing lest we should have fallen upon rocks, they cast four anchors out of the stern, and wished for the day.', r: 'ACTS 27:27–29' },
    boat: { t: 'And as the shipmen were about to flee out of the ship, when they had let down the boat into the sea, under colour as though they would have cast anchors out of the foreship, Paul said to the centurion and to the soldiers, Except these abide in the ship, ye cannot be saved. Then the soldiers cut off the ropes of the boat, and let her fall off.', r: 'ACTS 27:30–32' },
    bread: { t: 'And while the day was coming on, Paul besought them all to take meat, saying, This day is the fourteenth day that ye have tarried and continued fasting, having taken nothing. Wherefore I pray you to take some meat: for this is for your health: for there shall not an hair fall from the head of any of you. And when he had thus spoken, he took bread, and gave thanks to God in presence of them all: and when he had broken it, he began to eat. Then were they all of good cheer, and they also took some meat.', r: 'ACTS 27:33–36' },
    wheat: { t: 'And when they had eaten enough, they lightened the ship, and cast out the wheat into the sea.', r: 'ACTS 27:38' },
    shore: { t: 'And when it was day, they knew not the land: but they discovered a certain creek with a shore, into the which they were minded, if it were possible, to thrust in the ship. And when they had taken up the anchors, they committed themselves unto the sea, and loosed the rudder bands, and hoised up the mainsail to the wind, and made toward shore. And falling into a place where two seas met, they ran the ship aground; and the forepart stuck fast, and remained unmoveable, but the hinder part was broken with the violence of the waves.', r: 'ACTS 27:39–41' },
    escape: { t: 'And the soldiers’ counsel was to kill the prisoners, lest any of them should swim out, and escape. But the centurion, willing to save Paul, kept them from their purpose; and commanded that they which could swim should cast themselves first into the sea, and get to land: And the rest, some on boards, and some on broken pieces of the ship. And so it came to pass, that they escaped all safe to land.', r: 'ACTS 27:42–44' },
    melita: { t: 'And when they were escaped, then they knew that the island was called Melita.', r: 'ACTS 28:1' }
  };

  /* --------------------------------------------------------------- renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stageEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const skyCol = new THREE.Color(0x05080d);
  scene.background = skyCol.clone();
  scene.fog = new THREE.FogExp2(0x05080d, 0.021);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1600);
  camera.position.set(36, 10, 62);
  const lookAt = new THREE.Vector3(0, 8, 0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------------------------------------------------------------- lights */
  const hemi = new THREE.HemisphereLight(0x3a4c60, 0x05070a, 1.35);
  scene.add(hemi);

  const stormKey = new THREE.DirectionalLight(0x93a8bf, 2.6);
  stormKey.position.set(-40, 70, 30);
  scene.add(stormKey);

  const fillDir = new THREE.DirectionalLight(0x6f8aa5, 1.6);
  fillDir.position.set(45, 28, 50);
  scene.add(fillDir);

  const moonBack = new THREE.DirectionalLight(0x9fb8d8, 1.4);
  moonBack.position.set(-80, 50, -140);
  scene.add(moonBack);

  const lightningLight = new THREE.DirectionalLight(0xcfe0ff, 0);
  lightningLight.position.set(30, 60, -40);
  scene.add(lightningLight);

  const dawnKey = new THREE.DirectionalLight(0xffb27a, 0);
  dawnKey.position.set(-40, 14, -140);
  scene.add(dawnKey);

  /* -------------------------------------------------------------- textures */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return t;
  }

  const woodTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#553b2a'; x.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = r * rh;
      const tint = 0.82 + Math.random() * 0.26;
      x.fillStyle = 'rgb(' + Math.floor(96 * tint) + ',' + Math.floor(67 * tint) + ',' + Math.floor(45 * tint) + ')';
      x.fillRect(0, y, w, rh - 1);
      x.fillStyle = 'rgba(16,10,6,0.85)';
      x.fillRect(0, y + rh - 2, w, 2);
      for (let g = 0; g < 44; g++) {
        x.strokeStyle = Math.random() < 0.5 ? 'rgba(32,18,10,' + (0.05 + Math.random() * 0.12) + ')' : 'rgba(150,116,84,' + (0.05 + Math.random() * 0.1) + ')';
        x.lineWidth = 1 + Math.random();
        x.beginPath();
        const yy = y + Math.random() * rh;
        x.moveTo(0, yy);
        x.bezierCurveTo(w * 0.33, yy + rand(-3, 3), w * 0.66, yy + rand(-3, 3), w, yy + rand(-5, 5));
        x.stroke();
      }
      for (let b = 0; b < 5; b++) {
        x.fillStyle = 'rgba(20,12,7,0.85)';
        x.beginPath(); x.arc(45 + b * 100 + rand(-12, 12), y + rh * 0.5, 2.2, 0, Math.PI * 2); x.fill();
      }
    }
  });
  woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.repeat.set(3, 2);

  const deckTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#6c5039'; x.fillRect(0, 0, w, h);
    const cols = 8, cw = w / cols;
    for (let c = 0; c < cols; c++) {
      const xx = c * cw;
      const tint = 0.82 + Math.random() * 0.26;
      x.fillStyle = 'rgb(' + Math.floor(116 * tint) + ',' + Math.floor(85 * tint) + ',' + Math.floor(58 * tint) + ')';
      x.fillRect(xx, 0, cw - 1, h);
      x.fillStyle = 'rgba(18,11,6,0.8)';
      x.fillRect(xx + cw - 2, 0, 2, h);
      for (let g = 0; g < 34; g++) {
        x.strokeStyle = 'rgba(40,24,14,' + (0.05 + Math.random() * 0.1) + ')';
        x.lineWidth = 1;
        x.beginPath();
        const gx = xx + Math.random() * cw;
        x.moveTo(gx, 0);
        x.bezierCurveTo(gx + rand(-4, 4), h * 0.33, gx + rand(-4, 4), h * 0.66, gx + rand(-5, 5), h);
        x.stroke();
      }
    }
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(1, 5);

  const sailTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#c9bda3'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() < 0.5 ? 'rgba(120,100,74,' + (Math.random() * 0.05) + ')' : 'rgba(255,250,235,' + (Math.random() * 0.06) + ')';
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 22, 0, Math.PI * 2); x.fill();
    }
    for (let r = 1; r < 8; r++) {
      const y = (r / 8) * h;
      x.strokeStyle = 'rgba(90,74,52,0.35)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke();
      x.strokeStyle = 'rgba(230,224,205,0.25)';
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, y + 3); x.lineTo(w, y + 3); x.stroke();
    }
    // patches
    x.fillStyle = 'rgba(150,132,102,0.55)';
    x.fillRect(w * 0.18, h * 0.42, 70, 52);
    x.fillRect(w * 0.62, h * 0.62, 54, 64);
    x.strokeStyle = 'rgba(70,58,40,0.5)';
    x.lineWidth = 1.5;
    x.strokeRect(w * 0.18, h * 0.42, 70, 52);
    x.strokeRect(w * 0.62, h * 0.62, 54, 64);
    // stains
    for (let i = 0; i < 12; i++) {
      const gx = Math.random() * w, gy = Math.random() * h, r = 10 + Math.random() * 40;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, r);
      g.addColorStop(0, 'rgba(90,76,52,0.14)');
      g.addColorStop(1, 'rgba(90,76,52,0)');
      x.fillStyle = g; x.beginPath(); x.arc(gx, gy, r, 0, Math.PI * 2); x.fill();
    }
    // frayed bottom
    x.fillStyle = 'rgba(60,50,36,0.35)';
    for (let i = 0; i < 90; i++) {
      x.fillRect(Math.random() * w, h - 14 + Math.random() * 14, 2 + Math.random() * 8, 2 + Math.random() * 6);
    }
  });

  const rainTex = canvasTex(16, 64, (x) => {
    x.clearRect(0, 0, 16, 64);
    const g = x.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.45, 'rgba(220,235,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(6, 0, 3, 64);
  });

  const softTex = canvasTex(64, 64, (x) => {
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  });

  const glowTex = canvasTex(256, 256, (x) => {
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(128, 128, 128, 0, Math.PI * 2); x.fill();
  });

  const cloudTex = canvasTex(256, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * w, py = h * 0.35 + Math.random() * h * 0.4;
      const r = 20 + Math.random() * 46;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
    }
  });

  /* ----------------------------------------------------------------- ocean */
  // wave directions / frequencies must match the vertex shader below
  const WAVES = [
    { dx: 0.962, dz: 0.271, f: 0.100, s: 1.10, a: 0.40, ph: 0.0 },
    { dx: -0.472, dz: 0.882, f: 0.065, s: 0.85, a: 0.70, ph: 1.7 },
    { dx: 0.589, dz: -0.808, f: 0.170, s: 1.70, a: 0.25, ph: 3.1 },
    { dx: -0.921, dz: -0.389, f: 0.045, s: 0.60, a: 1.00, ph: 4.4 },
    { dx: 0.200, dz: 0.980, f: 0.240, s: 2.20, a: 0.12, ph: 2.2 }
  ];
  function waveHeight(x, z, t, amp) {
    let h = 0;
    for (let i = 0; i < WAVES.length; i++) {
      const w = WAVES[i];
      h += Math.sin((x * w.dx + z * w.dz) * w.f - t * w.s + w.ph) * w.a;
    }
    return h * amp;
  }

  const seaUniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.4 },
    uDeep: { value: new THREE.Color(0x0c2029) },
    uShallow: { value: new THREE.Color(0x2e5560) },
    uFoam: { value: new THREE.Color(0xd9e8ec) },
    uFog: { value: new THREE.Color(0x05080d) },
    uFogDensity: { value: 0.021 },
    uLightDir: { value: new THREE.Vector3(-0.3, 0.55, 0.78).normalize() },
    uLightColor: { value: new THREE.Color(0xc2d8e8) },
    uDawn: { value: 0 },
    uFlash: { value: 0 }
  };

  const seaVert = `
    uniform float uTime;
    uniform float uAmp;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vH;
    void main() {
      vec3 p = position;
      vec2 xz = p.xz;
      float h = 0.0;
      vec2 g = vec2(0.0);
      {
        vec2 d = normalize(vec2(0.962, 0.271));
        float ph = dot(xz, d) * 0.100 - uTime * 1.10 + 0.0;
        h += sin(ph) * 0.40;
        g += cos(ph) * 0.40 * 0.100 * d;
      }
      {
        vec2 d = normalize(vec2(-0.472, 0.882));
        float ph = dot(xz, d) * 0.065 - uTime * 0.85 + 1.7;
        h += sin(ph) * 0.70;
        g += cos(ph) * 0.70 * 0.065 * d;
      }
      {
        vec2 d = normalize(vec2(0.589, -0.808));
        float ph = dot(xz, d) * 0.170 - uTime * 1.70 + 3.1;
        h += sin(ph) * 0.25;
        g += cos(ph) * 0.25 * 0.170 * d;
      }
      {
        vec2 d = normalize(vec2(-0.921, -0.389));
        float ph = dot(xz, d) * 0.045 - uTime * 0.60 + 4.4;
        h += sin(ph) * 1.00;
        g += cos(ph) * 1.00 * 0.045 * d;
      }
      {
        vec2 d = normalize(vec2(0.200, 0.980));
        float ph = dot(xz, d) * 0.240 - uTime * 2.20 + 2.2;
        h += sin(ph) * 0.12;
        g += cos(ph) * 0.12 * 0.240 * d;
      }
      h *= uAmp;
      g *= uAmp;
      p.y = h;
      vec3 wp = (modelMatrix * vec4(p, 1.0)).xyz;
      float d = length(cameraPosition - wp);
      g *= 1.0 / (1.0 + d * 0.05);
      vWorld = wp;
      vH = h;
      vNormal = normalize(vec3(-g.x, 1.0, -g.y));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `;

  const seaFrag = `
    uniform float uTime;
    uniform float uAmp;
    uniform float uFogDensity;
    uniform float uDawn;
    uniform float uFlash;
    uniform vec3 uDeep;
    uniform vec3 uShallow;
    uniform vec3 uFoam;
    uniform vec3 uFog;
    uniform vec3 uLightDir;
    uniform vec3 uLightColor;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying float vH;

    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
      fres = clamp(fres, 0.0, 1.0) * 0.45;
      vec3 base = mix(uDeep, uShallow, clamp(vH * 0.25 + 0.48, 0.0, 1.0));
      vec3 sky = mix(vec3(0.02, 0.035, 0.055), vec3(0.30, 0.25, 0.22), uDawn);
      vec3 col = mix(base, sky, fres);
      vec3 L = normalize(uLightDir);
      vec3 H = normalize(L + V);
      float spec = pow(max(dot(N, H), 0.0), 24.0);
      col += uLightColor * spec * (0.16 + uDawn * 0.35) * (0.75 + uFlash * 2.0);
      float crest = smoothstep(0.45, 1.05, vH / (uAmp * 1.85 + 0.001));
      float fn1 = 0.5 + 0.5 * sin(vWorld.x * 2.3 + uTime * 1.9);
      float fn2 = 0.5 + 0.5 * sin(vWorld.z * 2.7 - uTime * 1.5);
      float fn3 = 0.5 + 0.5 * sin((vWorld.x + vWorld.z) * 4.3 + uTime * 2.7);
      float foamNoise = 0.35 + 0.4 * fn1 * fn2 + 0.25 * fn3;
      float foam = clamp(crest * foamNoise * (0.15 + 0.85 * uAmp), 0.0, 1.0);
      col = mix(col, uFoam, foam * 0.7);
      col += uFlash * vec3(0.35, 0.42, 0.5) * 0.22;
      float dist = distance(cameraPosition, vWorld);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
      col = mix(col, uFog, clamp(fogF, 0.0, 1.0));
      col = aces(col);
      col = pow(col, vec3(1.0 / 2.2));
      float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (dither - 0.5) * 0.12 / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const seaGeo = new THREE.PlaneGeometry(900, 900, 220, 220);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(seaGeo, new THREE.ShaderMaterial({
    uniforms: seaUniforms,
    vertexShader: seaVert,
    fragmentShader: seaFrag,
    toneMapped: false
  }));
  sea.frustumCulled = false;
  scene.add(sea);

  /* ------------------------------------------------------------------ ship */
  function hullGeo(L, W, D, segZ, segT) {
    const positions = [], uvs = [], indices = [];
    const half = L / 2;
    const pw = (z) => {
      const t = Math.min(1, Math.abs(z) / half);
      let w = W * Math.pow(Math.max(0, 1 - t * t), 0.62);
      if (z < 0) w *= 1 - 0.28 * Math.pow(Math.min(1, -z / half), 3);
      return Math.max(0.02, w);
    };
    const pd = (z) => {
      const t = Math.min(1, Math.abs(z) / half);
      return D * Math.pow(Math.max(0, 1 - Math.pow(t, 2.6)), 0.35) + 0.04;
    };
    for (let side = 0; side < 2; side++) {
      const s = side === 0 ? 1 : -1;
      const base = positions.length / 3;
      for (let i = 0; i <= segZ; i++) {
        const z = -half + (i / segZ) * 2 * half;
        const w = pw(z), d = pd(z);
        for (let j = 0; j <= segT; j++) {
          const th = (j / segT) * (Math.PI / 2);
          positions.push(s * w * Math.sin(th), -d * Math.cos(th), z);
          uvs.push(i / segZ, j / segT);
        }
      }
      for (let i = 0; i < segZ; i++) {
        for (let j = 0; j < segT; j++) {
          const a = base + i * (segT + 1) + j;
          const b = a + 1;
          const c = a + segT + 1;
          const d = c + 1;
          if (s > 0) indices.push(a, b, c, b, d, c);
          else indices.push(a, c, b, b, c, d);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  function deckGeo(L, W, segZ) {
    const half = L / 2;
    const positions = [], uvs = [], indices = [];
    const pw = (z) => {
      const t = Math.min(1, Math.abs(z) / half);
      let w = W * Math.pow(Math.max(0, 1 - t * t), 0.62);
      if (z < 0) w *= 1 - 0.28 * Math.pow(Math.min(1, -z / half), 3);
      return Math.max(0.05, w);
    };
    for (let i = 0; i <= segZ; i++) {
      const z = -half + (i / segZ) * 2 * half;
      const w = pw(z);
      positions.push(-w, 0.02, z, w, 0.02, z);
      uvs.push(0, i / segZ, 1, i / segZ);
    }
    for (let i = 0; i < segZ; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  function makeLantern(s) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a1c10, roughness: 0.6, metalness: 0.5 }));
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0x331100, emissive: 0xffb066, emissiveIntensity: 2.6, transparent: true, opacity: 0.95 }));
    g.add(body); g.add(glass);
    g.scale.setScalar(s || 1);
    return g;
  }

  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x9c7f63, roughness: 0.88, metalness: 0.04, side: THREE.DoubleSide });
  const deckMat = new THREE.MeshStandardMaterial({ map: deckTex, color: 0xc0a582, roughness: 0.9, metalness: 0.02 });
  const ropeMat = new THREE.LineBasicMaterial({ color: 0x1d1710 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2c1f15, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x3b3f42, roughness: 0.55, metalness: 0.7 });

  const SHIP = (function buildShip() {
    const g = new THREE.Group();

    const hull = new THREE.Mesh(hullGeo(30, 3.9, 2.5, 48, 10), woodMat);
    g.add(hull);
    const deck = new THREE.Mesh(deckGeo(30, 3.9, 44), deckMat);
    g.add(deck);

    // gunwales and posts
    const edgePts = [[], []];
    for (let i = 0; i <= 40; i++) {
      const z = -15 + (i / 40) * 30;
      const t = Math.min(1, Math.abs(z) / 15);
      let w = 3.9 * Math.pow(Math.max(0, 1 - t * t), 0.62);
      if (z < 0) w *= 1 - 0.28 * Math.pow(Math.min(1, -z / 15), 3);
      w = Math.max(0.05, w) * 0.985;
      edgePts[0].push(new THREE.Vector3(-w, 0.62, z));
      edgePts[1].push(new THREE.Vector3(w, 0.62, z));
    }
    for (let s = 0; s < 2; s++) {
      const curve = new THREE.CatmullRomCurve3(edgePts[s]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.07, 5, false), darkWood));
      for (let i = 0; i < 40; i += 4) {
        const p = edgePts[s][i];
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 5), darkWood);
        post.position.set(p.x, 0.31, p.z);
        g.add(post);
      }
    }

    // stern cabin
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.3, 4.4), woodMat);
    cabin.position.set(0, 1.15, 10.6);
    g.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.24, 5.0), darkWood);
    roof.position.set(0, 2.4, 10.6);
    g.add(roof);
    const winMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, emissive: 0xffb066, emissiveIntensity: 2.1, roughness: 0.5 });
    [-1, 1].forEach((s) => {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), winMat);
      win.position.set(s * 2.62, 1.35, 10.6);
      win.rotation.y = s * Math.PI / 2;
      g.add(win);
    });
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.5), darkWood);
    door.position.set(0, 0.78, 8.38);
    g.add(door);

    // mast, yard, sail
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 16.5, 8), darkWood);
    mast.position.set(0, 8.25, 1.5);
    g.add(mast);
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 13.4, 6), darkWood);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 12.55, 1.5);
    g.add(yard);

    const sailGeo = new THREE.PlaneGeometry(12.6, 9.2, 18, 12);
    sailGeo.translate(0, -4.6, 0);
    const sailBase = Float32Array.from(sailGeo.attributes.position.array);
    const sailMat = new THREE.MeshStandardMaterial({ map: sailTex, color: 0xffffff, roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide });
    const sail = new THREE.Mesh(sailGeo, sailMat);
    const sailGroup = new THREE.Group();
    sailGroup.position.set(0, 12.45, 1.62);
    sailGroup.add(sail);
    g.add(sailGroup);

    // bowsprit + rudder
    const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.16, 7.2, 6), darkWood);
    sprit.rotation.x = -1.15;
    sprit.position.set(0, 2.4, -16.6);
    g.add(sprit);
    const rudder = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.6, 1.1), darkWood);
    rudder.position.set(0.2, -1.1, 15.3);
    g.add(rudder);

    // rigging
    function rope(a, b) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), ropeMat);
      g.add(line);
    }
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(0, 1.3, -14.6));
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(0, 1.2, 14.6));
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(-3.7, 0.8, -3.0));
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(3.7, 0.8, -3.0));
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(-3.7, 0.8, 8.0));
    rope(new THREE.Vector3(0, 12.3, 1.5), new THREE.Vector3(3.7, 0.8, 8.0));

    // lanterns
    const mastLantern = makeLantern(1.2);
    mastLantern.position.set(0.5, 2.7, 1.7);
    g.add(mastLantern);
    const mastLight = new THREE.PointLight(0xffc078, 30, 24, 2);
    mastLight.position.set(0.5, 2.9, 1.7);
    g.add(mastLight);

    const sternLantern = makeLantern(1);
    sternLantern.position.set(-2.3, 2.0, 13.6);
    g.add(sternLantern);
    const sternLight = new THREE.PointLight(0xffb066, 16, 18, 2);
    sternLight.position.set(-2.3, 2.1, 13.6);
    g.add(sternLight);

    const bowLantern = makeLantern(0.9);
    bowLantern.position.set(0, 1.4, -14.2);
    g.add(bowLantern);
    const bowLight = new THREE.PointLight(0xffb066, 9, 14, 2);
    bowLight.position.set(0, 1.5, -14.2);
    g.add(bowLight);

    // crates
    const crateGeo = new THREE.BoxGeometry(1.0, 0.9, 1.0);
    const crates = [];
    const cratePos = [[-1.7, 0.47, 5.8], [1.6, 0.47, 6.6], [-1.1, 0.47, -0.6], [2.1, 0.47, -1.8]];
    cratePos.forEach((p) => {
      const c = new THREE.Mesh(crateGeo, woodMat);
      c.position.set(p[0], p[1], p[2]);
      c.rotation.y = rand(-0.4, 0.4);
      g.add(c);
      crates.push({ mesh: c, base: c.position.clone(), thrown: false, t0: 0 });
    });
    const sacks = [];
    [[-1.5, 0.4, 7.6], [1.2, 0.4, 7.9]].forEach((p) => {
      const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x7a6a4c, roughness: 0.95 }));
      s.rotation.z = Math.PI / 2;
      s.position.set(p[0], p[1], p[2]);
      g.add(s);
      sacks.push({ mesh: s, base: s.position.clone(), thrown: false, t0: 0 });
    });

    // boat on deck
    const boat = new THREE.Group();
    const boatHull = new THREE.Mesh(hullGeo(6.4, 1.05, 0.55, 16, 6), woodMat);
    boat.add(boatHull);
    const boatDeck = new THREE.Mesh(deckGeo(6.2, 1.0, 12), deckMat);
    boat.add(boatDeck);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), darkWood);
    bench.position.set(0, 0.25, 0);
    boat.add(bench);
    boat.position.set(2.5, 0.55, 0.2);
    boat.rotation.y = 0.2;
    g.add(boat);

    // anchors
    const anchors = [];
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 5), ironMat);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), ironMat);
      arm.position.y = -0.5;
      a.add(shaft); a.add(arm);
      a.position.set(-1.6 + i * 1.05, 0.9, 13.9);
      a.visible = false;
      g.add(a);
      anchors.push({ group: a, base: a.position.clone(), t0: 0, active: false });
    }

    // crew figures
    const crew = [];
    const crewDefs = [
      { role: 'sailor', cloth: 0x45505c, dark: 0x242a30, skin: 0xb98f6c, pos: [-2.4, 0.02, 4.6], yaw: 0.7 },
      { role: 'sailor', cloth: 0x5a4b3c, dark: 0x2a241c, skin: 0xc09a74, pos: [2.3, 0.02, 3.2], yaw: -0.6 },
      { role: 'sailor', cloth: 0x3d4a52, dark: 0x22282e, skin: 0xa98263, pos: [-2.1, 0.02, -2.4], yaw: 0.3 },
      { role: 'sailor', cloth: 0x55483a, dark: 0x2a241c, skin: 0xc4a07c, pos: [2.4, 0.02, -5.4], yaw: -0.35 },
      { role: 'sailor', cloth: 0x4a4440, dark: 0x24211e, skin: 0xb08a68, pos: [0.9, 0.02, 8.4], yaw: 0.15 },
      { role: 'paul', cloth: 0xcfc2a8, dark: 0x3a3226, skin: 0xc9a37e, pos: [0.5, 0.02, 2.4], yaw: 0.1 },
      { role: 'centurion', cloth: 0x6b2b25, dark: 0x3a2a1c, skin: 0xc09a74, pos: [-1.2, 0.02, 3.5], yaw: 0.4, helmet: true }
    ];
    crewDefs.forEach((d, i) => {
      const f = makeFigure(d);
      f.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
      f.group.rotation.y = d.yaw;
      g.add(f.group);
      crew.push({ fig: f, role: d.role, index: i, seed: i * 1.7, mode: 'stand' });
    });

    // Paul's lantern light (attached to the deck by the mast)
    const paulLight = new THREE.PointLight(0xffb066, 20, 20, 2);
    paulLight.position.set(0.9, 1.7, 2.6);
    g.add(paulLight);

    scene.add(g);

    return {
      group: g, sail, sailGroup, sailGeo, sailBase, boat, crates, sacks, anchors,
      crew, mastLight, sternLight, bowLight, paulLight,
      paulCrew: crew.find((c) => c.role === 'paul')
    };
  })();

  /* ---------------------------------------------------------------- figures */
  function makeFigure(cfg) {
    const skin = new THREE.MeshStandardMaterial({ color: cfg.skin || 0xc09a74, roughness: 0.85 });
    const cloth = new THREE.MeshStandardMaterial({ color: cfg.cloth || 0x4a4a44, roughness: 0.92 });
    const dark = new THREE.MeshStandardMaterial({ color: cfg.dark || 0x2a241c, roughness: 0.92 });
    const g = new THREE.Group();

    [-1, 1].forEach((s) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.78, 6), dark);
      leg.position.set(s * 0.11, 0.39, 0);
      g.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.24), dark);
      foot.position.set(s * 0.11, 0.045, 0.05);
      g.add(foot);
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.23, 0.66, 8), cloth);
    torso.position.y = 1.02;
    g.add(torso);
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.07, 8), dark);
    belt.position.y = 0.72;
    g.add(belt);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 5), skin);
    neck.position.y = 1.38;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 10), skin);
    head.position.y = 1.5;
    g.add(head);

    if (cfg.helmet) {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: 0x8a7a52, roughness: 0.4, metalness: 0.8 }));
      helm.position.y = 1.54;
      g.add(helm);
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x7a2220, roughness: 0.8 }));
      crest.position.y = 1.68;
      g.add(crest);
    } else if (cfg.role === 'paul') {
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.24, 7, 1, true), dark);
      hood.position.y = 1.6;
      g.add(hood);
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.95, 9, 1, true), new THREE.MeshStandardMaterial({ color: cfg.dark, roughness: 1, side: THREE.DoubleSide }));
      cloak.position.set(-0.04, 0.78, 0);
      g.add(cloak);
    } else {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), dark);
      cap.position.y = 1.57;
      g.add(cap);
    }

    const arms = [];
    [-1, 1].forEach((s) => {
      const armG = new THREE.Group();
      armG.position.set(s * 0.21, 1.3, 0);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.042, 0.54, 6), cloth);
      arm.position.y = -0.27;
      armG.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 6), skin);
      hand.position.y = -0.55;
      armG.add(hand);
      g.add(armG);
      arms.push(armG);
    });

    let loaf = null;
    if (cfg.role === 'paul') {
      loaf = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.17, 0.07, 10),
        new THREE.MeshStandardMaterial({ color: 0x9a6d3f, roughness: 0.9 })
      );
      loaf.position.set(0, -0.6, 0.05);
      loaf.visible = false;
      arms[1].add(loaf);
    }

    return { group: g, arms, head, torso, loaf };
  }

  /* ------------------------------------------------------------- island/land */
  const island = new THREE.Group();
  island.position.set(0, 0, -200);
  scene.add(island);
  (function buildIsland() {
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x2b3326, roughness: 1, metalness: 0 });
    const hills = [
      { x: -40, z: -28, w: 34, h: 9 },
      { x: 6, z: -34, w: 44, h: 13 },
      { x: 44, z: -24, w: 30, h: 7.5 },
      { x: -74, z: -42, w: 38, h: 11 }
    ];
    hills.forEach((h) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), hillMat);
      m.scale.set(h.w, h.h, h.w * 0.8);
      m.position.set(h.x, 0, h.z);
      island.add(m);
    });

    const beach = new THREE.Mesh(new THREE.PlaneGeometry(70, 18), new THREE.MeshStandardMaterial({ color: 0x9a8866, roughness: 0.95 }));
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(0, 0.95, 30);
    island.add(beach);

    // shoreline rocks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a2b26, roughness: 1 });
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.6, 1.6), 0), rockMat);
      r.position.set(rand(-34, 34), rand(0.2, 0.6), 23 + rand(-4, 4));
      r.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      island.add(r);
    }
  })();

  const beachGroup = new THREE.Group();
  beachGroup.position.set(0, 0.95, -168.5);
  beachGroup.visible = false;
  scene.add(beachGroup);
  (function buildBeachGroup() {
    // fire
    const fire = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x26241f, roughness: 1 });
    for (let i = 0; i < 7; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.18, 0.32), 0), rockMat);
      const a = (i / 7) * Math.PI * 2;
      r.position.set(Math.cos(a) * 0.7, 0.1, Math.sin(a) * 0.7);
      fire.add(r);
    }
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6), darkWood);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = 0.4;
    log.position.y = 0.16;
    fire.add(log);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.3, 7), new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0xff7a2a, emissiveIntensity: 3.2 }));
    flame.position.y = 0.75;
    fire.add(flame);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff9a4a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(5, 5, 1);
    glow.position.y = 1.0;
    fire.add(glow);
    const fireLight = new THREE.PointLight(0xff8a3a, 26, 30, 2);
    fireLight.position.y = 1.2;
    fire.add(fireLight);
    fire.position.set(0, 0, -1.5);
    beachGroup.add(fire);
    beachGroup.userData.fire = fire;
    beachGroup.userData.flame = flame;

    const survivors = [
      { role: 'sailor', cloth: 0x4a5058, dark: 0x24282c, skin: 0xb08a68, pos: [-3.2, 0, -1.2], yaw: 1.5 },
      { role: 'sailor', cloth: 0x5a4b3c, dark: 0x2a241c, skin: 0xc09a74, pos: [-1.4, 0, -0.4], yaw: 2.2 },
      { role: 'paul', cloth: 0xcfc2a8, dark: 0x3a3226, skin: 0xc9a37e, pos: [1.8, 0, -1.0], yaw: -1.4 }
    ];
    survivors.forEach((d) => {
      const f = makeFigure(d);
      f.group.position.set(d.pos[0], d.pos[1], d.pos[2]);
      f.group.rotation.y = d.yaw;
      beachGroup.add(f.group);
    });
  })();

  /* ------------------------------------------------------------------- moon */
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xcfe0ff, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  moon.scale.set(90, 90, 1);
  moon.position.set(-140, 90, -230);
  scene.add(moon);

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffc98a, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  sunGlow.scale.set(130, 130, 1);
  sunGlow.position.set(-80, 12, -300);
  scene.add(sunGlow);

  /* ----------------------------------------------------------------- clouds */
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, color: 0x0b1118, transparent: true, opacity: 0.45,
      depthWrite: false, fog: false
    }));
    c.scale.set(rand(120, 220), rand(50, 90), 1);
    c.position.set(rand(-220, 220), rand(45, 80), rand(-260, -60));
    scene.add(c);
    clouds.push({ sprite: c, speed: rand(0.3, 1.0) });
  }

  /* -------------------------------------------------------------- particles */
  class Pool {
    constructor(n, tex, size, colorHex, blending, gravity, drag) {
      this.n = n;
      this.base = new THREE.Color(colorHex);
      this.pos = new Float32Array(n * 3);
      this.col = new Float32Array(n * 3);
      this.vel = new Float32Array(n * 3);
      this.life = new Float32Array(n);
      this.maxLife = new Float32Array(n);
      this.gravity = gravity;
      this.drag = drag;
      for (let i = 0; i < n; i++) this.pos[i * 3 + 1] = -900;
      this.geo = new THREE.BufferGeometry();
      this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
      this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
      this.mat = new THREE.PointsMaterial({
        map: tex, size, transparent: true, depthWrite: false,
        blending, vertexColors: true, sizeAttenuation: true, alphaTest: 0.002
      });
      this.points = new THREE.Points(this.geo, this.mat);
      this.points.frustumCulled = false;
      this.cursor = 0;
      scene.add(this.points);
    }
    spawn(px, py, pz, vx, vy, vz, life) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const j = i * 3;
      this.pos[j] = px; this.pos[j + 1] = py; this.pos[j + 2] = pz;
      this.vel[j] = vx; this.vel[j + 1] = vy; this.vel[j + 2] = vz;
      this.life[i] = life; this.maxLife[i] = life;
      this.col[j] = this.base.r * 0.2;
      this.col[j + 1] = this.base.g * 0.2;
      this.col[j + 2] = this.base.b * 0.2;
    }
    burst(p, count, spd, life) {
      for (let k = 0; k < count; k++) {
        const a = Math.random() * Math.PI * 2;
        const up = rand(0.2, 1);
        const s = rand(spd * 0.4, spd);
        this.spawn(
          p.x + rand(-0.3, 0.3), p.y + rand(-0.2, 0.2), p.z + rand(-0.3, 0.3),
          Math.cos(a) * s, up * s, Math.sin(a) * s,
          rand(life * 0.6, life)
        );
      }
    }
    update(dt) {
      const pos = this.pos, col = this.col, vel = this.vel;
      const damp = Math.pow(this.drag, dt * 60);
      for (let i = 0; i < this.n; i++) {
        const l = this.life[i];
        if (l <= 0) continue;
        const nl = l - dt;
        const j = i * 3;
        if (nl <= 0) {
          this.life[i] = 0;
          pos[j + 1] = -900;
          col[j] = col[j + 1] = col[j + 2] = 0;
          continue;
        }
        this.life[i] = nl;
        vel[j] *= damp; vel[j + 1] *= damp; vel[j + 2] *= damp;
        vel[j + 1] += this.gravity * dt;
        pos[j] += vel[j] * dt;
        pos[j + 1] += vel[j + 1] * dt;
        pos[j + 2] += vel[j + 2] * dt;
        const k = nl / this.maxLife[i];
        const f = this.gravity < -1 ? Math.pow(k, 0.65) : Math.sin(Math.PI * clamp(k, 0, 1));
        col[j] = this.base.r * f;
        col[j + 1] = this.base.g * f;
        col[j + 2] = this.base.b * f;
      }
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.color.needsUpdate = true;
    }
  }

  const spray = new Pool(260, softTex, 0.5, 0xd8e6ec, THREE.AdditiveBlending, -9, 0.99);
  const splash = new Pool(220, softTex, 0.45, 0xbfd8e2, THREE.NormalBlending, -10, 0.99);
  const foamPool = new Pool(200, softTex, 0.7, 0xdfeef2, THREE.AdditiveBlending, -3, 0.99);

  /* ------------------------------------------------------------------- rain */
  const RAIN_N = 2400;
  const rainPos = new Float32Array(RAIN_N * 3);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.PointsMaterial({
    map: rainTex, color: 0xbcd0e0, size: 1.6, transparent: true, opacity: 0.4,
    depthWrite: false, sizeAttenuation: true, alphaTest: 0.01
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  function resetDrop(i, initial) {
    const j = i * 3;
    const s = SHIP.group.position;
    rainPos[j] = s.x + rand(-70, 70);
    rainPos[j + 1] = initial ? rand(1, 48) : rand(40, 52);
    rainPos[j + 2] = s.z + rand(-80, 80);
  }
  for (let i = 0; i < RAIN_N; i++) resetDrop(i, true);

  /* ----------------------------------------------------------------- state */
  const state = {
    storm: 0.15,
    dawn: 0,
    rain: 0.05,
    sail: 1,
    lamp: 0.35,
    pad: 0,
    flash: 0,
    shipZ: 0
  };
  const want = {
    storm: 0.15,
    dawn: 0,
    rain: 0.05,
    sail: 1,
    lamp: 0.35,
    pad: 0,
    shipZ: 0
  };
  const grounded = { on: false, tilt: 0 };
  let shake = 0;

  /* -------------------------------------------------------------- lightning */
  function lightning() {
    state.flash = 1;
    shake = Math.min(1.2, shake + 0.5);
    audio.thunder(rand(0.4, 1.4));
  }

  /* ------------------------------------------------------------------ audio */
  const audio = (function () {
    let ctx = null, master = null, started = false, enabled = true;
    let noise = null;
    let windG = null, seaG = null, rainG = null, droneG = null, padG = null;

    function init() {
      if (started) return;
      started = true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { enabled = false; return; }
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);

        noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = noise.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) {
          const white = Math.random() * 2 - 1;
          last = last * 0.96 + white * 0.04;
          d[i] = last * 3.2;
        }

        const windSrc = ctx.createBufferSource();
        windSrc.buffer = noise; windSrc.loop = true;
        const windBp = ctx.createBiquadFilter();
        windBp.type = 'bandpass'; windBp.frequency.value = 480; windBp.Q.value = 0.7;
        windG = ctx.createGain(); windG.gain.value = 0.05;
        windSrc.connect(windBp); windBp.connect(windG); windG.connect(master);
        windSrc.start();
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
        const lfoG = ctx.createGain(); lfoG.gain.value = 0.03;
        lfo.connect(lfoG); lfoG.connect(windG.gain); lfo.start();

        const seaSrc = ctx.createBufferSource();
        seaSrc.buffer = noise; seaSrc.loop = true;
        const seaLp = ctx.createBiquadFilter();
        seaLp.type = 'lowpass'; seaLp.frequency.value = 240; seaLp.Q.value = 0.8;
        seaG = ctx.createGain(); seaG.gain.value = 0.08;
        seaSrc.connect(seaLp); seaLp.connect(seaG); seaG.connect(master);
        seaSrc.start();

        const rainSrc = ctx.createBufferSource();
        rainSrc.buffer = noise; rainSrc.loop = true;
        const rainHp = ctx.createBiquadFilter();
        rainHp.type = 'highpass'; rainHp.frequency.value = 1700;
        rainG = ctx.createGain(); rainG.gain.value = 0.0;
        rainSrc.connect(rainHp); rainHp.connect(rainG); rainG.connect(master);
        rainSrc.start();

        droneG = ctx.createGain(); droneG.gain.value = 0.025; droneG.connect(master);
        [55, 82.41, 110].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = [0.030, 0.016, 0.008][i];
          o.connect(g); g.connect(droneG); o.start();
        });

        padG = ctx.createGain(); padG.gain.value = 0.0; padG.connect(master);
        [110, 164.81, 220, 261.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
          const g = ctx.createGain(); g.gain.value = [0.020, 0.012, 0.008, 0.005][i];
          o.connect(g); g.connect(padG); o.start();
        });

        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { enabled = false; }
    }

    function setMood() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      windG.gain.setTargetAtTime(0.015 + state.storm * 0.11, t, 0.6);
      seaG.gain.setTargetAtTime(0.02 + state.storm * 0.10, t, 0.7);
      rainG.gain.setTargetAtTime(state.rain * 0.05, t, 0.5);
      droneG.gain.setTargetAtTime(0.012 + state.storm * 0.02, t, 0.8);
      padG.gain.setTargetAtTime(state.pad * 0.06, t, 1.2);
    }

    function thunder(delay) {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime + (delay || 0);
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(72, t);
      o.frequency.exponentialRampToValueAtTime(18, t + 2.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.55, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 2.7);

      const n = ctx.createBufferSource(); n.buffer = noise; n.playbackRate.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, t);
      lp.frequency.exponentialRampToValueAtTime(80, t + 2.0);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.3, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 2.3);
      n.connect(lp); lp.connect(ng); ng.connect(master);
      n.start(t); n.stop(t + 2.4);
    }

    function creak() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(rand(55, 75), t);
      o.frequency.linearRampToValueAtTime(rand(35, 55), t + 0.9);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.035, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); o.stop(t + 1.1);
    }

    function splashSfx() {
      if (!ctx || !enabled) return;
      const t = ctx.currentTime;
      const n = ctx.createBufferSource(); n.buffer = noise; n.playbackRate.value = 0.9;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      n.connect(hp); hp.connect(g); g.connect(master);
      n.start(t); n.stop(t + 0.8);
    }

    function crash() {
      thunder(0);
      splashSfx();
      if (!ctx || !enabled) return;
      const t = ctx.currentTime + 0.1;
      const n = ctx.createBufferSource(); n.buffer = noise; n.playbackRate.value = 0.6;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      n.connect(lp); lp.connect(g); g.connect(master);
      n.start(t); n.stop(t + 1.7);
    }

    function toggle() {
      enabled = !enabled;
      if (master) master.gain.value = enabled ? 0.9 : 0;
      return enabled;
    }

    return { init, setMood, thunder, creak, splashSfx, crash, toggle, isOn: () => enabled };
  })();

  /* ------------------------------------------------------------------ crew */
  const POSES = {
    stand: { ax: [0.05, 0.05], az: [0.12, -0.12], lean: 0, y: 0 },
    brace: { ax: [0.55, 0.45], az: [0.5, -0.45], lean: 0.14, y: -0.02 },
    pull: { ax: [1.9, 1.5], az: [0.3, -0.3], lean: 0.26, y: -0.03 },
    slump: { ax: [0.25, 0.25], az: [0.06, -0.06], lean: 0.55, y: -0.34 },
    hail: { ax: [2.3, 0.3], az: [0.25, -0.1], lean: 0.03, y: 0 },
    eat: { ax: [0.9, 0.9], az: [0.28, -0.28], lean: 0.36, y: -0.34 },
    throw: { ax: [2.0, 1.6], az: [0.2, -0.2], lean: 0.18, y: 0 },
    pray: { ax: [2.5, 2.5], az: [0.1, -0.1], lean: 0, y: -0.1 }
  };

  function modeFor(role, beat, idx) {
    if (role === 'paul') {
      if (beat === 'paul' || beat === 'bread') return 'hail';
      if (beat === 'despair' || beat === 'soundings') return 'pray';
      if (beat === 'storm' || beat === 'lighten' || beat === 'shore') return 'brace';
      return 'stand';
    }
    if (role === 'centurion') {
      if (beat === 'storm' || beat === 'lighten' || beat === 'shore') return 'brace';
      if (beat === 'bread') return 'eat';
      return 'stand';
    }
    if (beat === 'storm' || beat === 'shore') return idx % 2 ? 'pull' : 'brace';
    if (beat === 'lighten' || beat === 'wheat') return 'throw';
    if (beat === 'despair') return 'slump';
    if (beat === 'soundings' || beat === 'boat') return idx < 2 ? 'pull' : 'brace';
    if (beat === 'bread') return idx % 2 ? 'eat' : 'stand';
    return 'stand';
  }

  function applyPose(f, mode, T, seed) {
    const P = POSES[mode] || POSES.stand;
    let ax0 = P.ax[0], ax1 = P.ax[1];
    if (mode === 'throw') {
      ax0 = 1.4 + Math.sin(T * 3.0 + seed) * 0.95;
      ax1 = 1.4 + Math.sin(T * 3.0 + seed + 1.1) * 0.95;
    } else if (mode === 'hail') {
      ax0 = 2.25 + Math.sin(T * 0.9) * 0.16;
    } else if (mode === 'pull') {
      ax0 = P.ax[0] + Math.sin(T * 2.4 + seed) * 0.18;
      ax1 = P.ax[1] + Math.sin(T * 2.4 + 1.2 + seed) * 0.18;
    }
    const sway = Math.sin(T * 1.15 + seed) * 0.05 * (0.5 + state.storm);
    f.arms[0].rotation.x = lerp(f.arms[0].rotation.x, ax0 + sway, 0.09);
    f.arms[1].rotation.x = lerp(f.arms[1].rotation.x, ax1 - sway, 0.09);
    f.arms[0].rotation.z = lerp(f.arms[0].rotation.z, P.az[0], 0.09);
    f.arms[1].rotation.z = lerp(f.arms[1].rotation.z, P.az[1], 0.09);
    f.group.rotation.x = lerp(f.group.rotation.x, P.lean, 0.06);
    f.group.position.y = lerp(f.group.position.y, P.y, 0.06);
  }

  /* -------------------------------------------------------------- ship step */
  const tmpV = new THREE.Vector3();

  function updateShip(dt) {
    const t = state.time || 0;
    const amp = 0.24 + state.storm * 1.0;
    const sx = Math.sin(t * 0.06) * 2.4 * state.storm;
    const sz = state.shipZ;
    const hC = waveHeight(sx, sz, t, amp);
    const hBow = waveHeight(sx, sz - 12, t, amp);
    const hStern = waveHeight(sx, sz + 12, t, amp);
    const hPort = waveHeight(sx - 3.5, sz, t, amp);
    const hStar = waveHeight(sx + 3.5, sz, t, amp);

    const g = SHIP.group;
    if (!grounded.on) {
      g.position.set(sx, hC + 0.45, sz);
      g.rotation.x = -Math.atan2(hStern - hBow, 24) + Math.sin(t * 0.9) * 0.05 * state.storm;
      g.rotation.z = Math.atan2(hStar - hPort, 7.0) + Math.sin(t * 1.1 + 1.0) * 0.07 * state.storm;
      g.rotation.y = Math.sin(t * 0.08) * 0.04 * state.storm;
    } else {
      g.position.set(sx * 0.2, lerp(g.position.y, 0.0, Math.min(1, dt * 1.2)), sz);
      g.rotation.x = lerp(g.rotation.x, 0.14, Math.min(1, dt * 0.8));
      g.rotation.z = lerp(g.rotation.z, 0.32, Math.min(1, dt * 0.8));
      g.rotation.y = lerp(g.rotation.y, 0.05, Math.min(1, dt * 0.8));
    }

    // sail
    const sg = SHIP.sailGroup;
    sg.scale.y = 0.055 + state.sail * 0.945;
    SHIP.sail.visible = state.sail > 0.03;
    if (SHIP.sail.visible) {
      const pos = SHIP.sailGeo.attributes.position;
      const base = SHIP.sailBase;
      const billow = 1.25 * state.sail;
      for (let i = 0; i < pos.count; i++) {
        const j = i * 3;
        const x = base[j], y = base[j + 1];
        const u = x / 12.6 + 0.5;
        const v = -y / 9.2;
        const belly = Math.sin(u * Math.PI) * Math.sin(Math.min(1, v) * Math.PI) * billow;
        const flutter = Math.sin(v * 9 + t * 7 + u * 4) * 0.1 * state.storm;
        pos.setZ(i, -belly + flutter);
      }
      pos.needsUpdate = true;
      SHIP.sailGeo.computeVertexNormals();
    }

    // lights
    const lamp = 0.2 + state.lamp * 1.4;
    SHIP.mastLight.intensity = 26 * lamp;
    SHIP.sternLight.intensity = 14 * lamp;
    SHIP.bowLight.intensity = 8 * lamp;
    SHIP.paulLight.intensity = 16 * lamp;

    // crew poses
    const beatNow = currentBeat;
    SHIP.crew.forEach((c) => {
      const mode = modeFor(c.role, beatNow, c.index);
      c.mode = mode;
      applyPose(c.fig, mode, t, c.seed);
    });
    if (SHIP.paulCrew && SHIP.paulCrew.fig.loaf) {
      SHIP.paulCrew.fig.loaf.visible = currentBeat === 'bread';
    }

    // boat
    updateBoat(t);

    // crates / sacks throws
    [SHIP.crates, SHIP.sacks].forEach((arr) => {
      arr.forEach((c) => {
        if (!c.thrown) return;
        const p = clamp((t - c.t0) / 1.4, 0, 1);
        c.mesh.position.set(
          c.base.x + p * 4.5,
          c.base.y + Math.sin(p * Math.PI) * 1.2 - p * p * 6.5,
          c.base.z - p * 1.2
        );
        c.mesh.rotation.x += dt * 2.4;
        c.mesh.rotation.z += dt * 1.7;
        if (p >= 1) c.mesh.visible = false;
      });
    });

    // anchors
    SHIP.anchors.forEach((a) => {
      if (!a.active) return;
      const p = clamp((t - a.t0) / 1.4, 0, 1);
      a.group.visible = true;
      a.group.position.set(a.base.x, a.base.y - p * 3.2, a.base.z - p * 2.2);
      if (p >= 1 && !a.splashed) {
        a.splashed = true;
        splash.burst(a.group.position, 10, 2.2, 0.8);
      }
    });

    // bow spray
    if (state.storm > 0.45 && Math.random() < dt * 22) {
      const p = tmpV.set(0, 0.6, -13.5).applyMatrix4(g.matrixWorld);
      spray.spawn(p.x + rand(-0.8, 0.8), p.y + rand(0, 0.6), p.z + rand(-0.6, 0.6),
        rand(-1, 1), rand(1.5, 4.5), rand(-3.5, -1), rand(0.4, 0.9));
    }
  }

  function updateBoat(t) {
    const b = SHIP.boat;
    if (!b.visible) return;
    const bp = clamp((state.boatT || 0), 0, 1);
    if (bp > 0) {
      b.position.set(2.5 + bp * 3.2, 0.55 - bp * 2.1, 0.2);
      b.rotation.z = bp * 0.5;
    }
  }

  /* --------------------------------------------------------------- swimmers */
  let swimmers = [];
  let swimmerPlanks = [];
  function spawnSwimmers() {
    swimmers.forEach((s) => scene.remove(s.fig.group));
    swimmerPlanks.forEach((p) => scene.remove(p.mesh));
    swimmers = [];
    swimmerPlanks = [];
    const s = SHIP.group.position;
    const cloths = [0xcbb489, 0x9db0bc, 0xa8866a, 0xb9c3cd, 0x8f7f66, 0x9aa8b3];
    for (let i = 0; i < 6; i++) {
      const f = makeFigure({ cloth: cloths[i], dark: 0x2d2a24, skin: 0xb98f6c });
      f.group.scale.setScalar(1.15);
      scene.add(f.group);
      swimmers.push({
        fig: f,
        sx: s.x + rand(-7, 7),
        sz: s.z - rand(1, 14),
        ex: rand(-26, 10),
        ez: -166 + rand(-6, 6),
        t0: state.time
      });
    }
    for (let i = 0; i < 3; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.9), woodMat);
      plank.position.set(s.x + rand(-8, 8), 0.25, s.z - rand(2, 12));
      scene.add(plank);
      swimmerPlanks.push({ mesh: plank, idx: i * 2, sx: plank.position.x, sz: plank.position.z, t0: state.time });
    }
  }

  function updateSwimmers(t) {
    if (!swimmers.length) return;
    swimmers.forEach((s, i) => {
      const p = smooth(clamp((t - s.t0) / 17, 0, 1));
      const x = lerp(s.sx, s.ex, p);
      const z = lerp(s.sz, s.ez, p);
      const y = 0.5 + Math.sin(t * 2 + i) * 0.12;
      s.fig.group.position.set(x, y, z);
      s.fig.group.rotation.x = -1.3;
      s.fig.group.rotation.z = Math.sin(t * 1.6 + i) * 0.25;
      const stroke = Math.sin(t * 3.2 + i * 1.1);
      s.fig.arms[0].rotation.x = 1.6 + stroke * 1.0;
      s.fig.arms[1].rotation.x = 1.6 - stroke * 1.0;
      if (Math.random() < 0.03) {
        splash.spawn(x + rand(-0.4, 0.4), 0.35, z + rand(-0.4, 0.4), rand(-0.5, 0.5), rand(0.5, 1.4), rand(-0.5, 0.5), 0.5);
      }
    });
    swimmerPlanks.forEach((p, i) => {
      const prog = smooth(clamp((t - p.t0) / 17, 0, 1));
      p.mesh.position.set(
        p.sx + Math.sin(t * 0.6 + i) * 0.6,
        0.22 + Math.sin(t * 1.1 + i) * 0.08,
        lerp(p.sz, -164 + i * 2, prog)
      );
      p.mesh.rotation.x = Math.sin(t * 1.3 + i) * 0.12;
      p.mesh.rotation.z = Math.sin(t * 0.9 + i) * 0.1;
    });
  }

  /* ---------------------------------------------------------------- weather */
  const colDeepA = new THREE.Color(0x07141a), colDeepB = new THREE.Color(0x18343c);
  const colShallowA = new THREE.Color(0x1b3842), colShallowB = new THREE.Color(0x3a5a5e);
  const colFoamA = new THREE.Color(0xbfd0d4), colFoamB = new THREE.Color(0xe8dcc4);
  const colFogA = new THREE.Color(0x05080d), colFogB = new THREE.Color(0x6a625a);
  const colSkyA = new THREE.Color(0x05080d), colSkyB = new THREE.Color(0x6f645c);
  const moonLightDir = new THREE.Vector3(-0.35, 0.55, -0.2).normalize();
  const sunLightDir = new THREE.Vector3(-0.25, 0.07, -0.97).normalize();
  const lightTmp = new THREE.Vector3();
  const colMoonLight = new THREE.Color(0x9fb8d8), colDawnLight = new THREE.Color(0xffd6a6);

  function updateWeather(dt) {
    const t = state.time;
    seaUniforms.uTime.value = t;
    const amp = 0.24 + state.storm * 1.0;
    seaUniforms.uAmp.value = amp;
    seaUniforms.uFog.value.copy(colFogA).lerp(colFogB, state.dawn);
    seaUniforms.uFogDensity.value = scene.fog.density;
    seaUniforms.uDawn.value = state.dawn;
    seaUniforms.uFlash.value = state.flash;
    seaUniforms.uDeep.value.copy(colDeepA).lerp(colDeepB, state.dawn);
    seaUniforms.uShallow.value.copy(colShallowA).lerp(colShallowB, state.dawn);
    seaUniforms.uFoam.value.copy(colFoamA).lerp(colFoamB, state.dawn);
    lightTmp.copy(moonLightDir).lerp(sunLightDir, state.dawn).normalize();
    seaUniforms.uLightDir.value.copy(lightTmp);
    seaUniforms.uLightColor.value.copy(colMoonLight).lerp(colDawnLight, state.dawn);

    scene.fog.color.copy(colFogA).lerp(colFogB, state.dawn);
    scene.fog.density = lerp(0.021, 0.006, state.dawn);
    scene.background.copy(colSkyA).lerp(colSkyB, state.dawn);

    // lights
    stormKey.intensity = 1.15 * (1 - state.dawn * 0.7);
    dawnKey.intensity = 3.2 * state.dawn;
    hemi.intensity = 0.75 + state.dawn * 0.55;
    lightningLight.intensity = state.flash * 9;
    flashEl.style.opacity = (state.flash * 0.42).toFixed(3);

    moon.material.opacity = 0.22 * (1 - state.dawn);
    sunGlow.material.opacity = 0.7 * state.dawn;

    // rain
    rainMat.opacity = 0.5 * state.rain;
    rain.visible = state.rain > 0.02;
    const wind = 6 + state.storm * 8;
    for (let i = 0; i < RAIN_N; i++) {
      const j = i * 3;
      rainPos[j + 1] -= (26 + state.storm * 14) * dt;
      rainPos[j] += wind * dt * 0.4;
      rainPos[j + 2] += 2.5 * dt;
      if (rainPos[j + 1] < 0.4) resetDrop(i, false);
    }
    rainGeo.attributes.position.needsUpdate = true;

    // clouds drift
    clouds.forEach((c) => {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > 260) c.sprite.position.x = -260;
      c.sprite.material.opacity = 0.4 * (1 - state.dawn * 0.45);
    });

    // auto lightning in heavy weather
    if (state.storm > 0.5 && Math.random() < dt * (0.06 + state.storm * 0.06)) lightning();
    if (state.storm > 0.4 && Math.random() < dt * 0.28) audio.creak();

    audio.setMood();
  }

  /* ---------------------------------------------------------------- timeline */
  const SEGMENTS = [];
  let cursor = 0;
  function segment(dur, enter, update, exit) {
    SEGMENTS.push({ start: cursor, dur, enter, update, exit });
    cursor += dur;
  }

  function setLabel(text, ref) {
    labelEl.textContent = text;
    refEl.textContent = ref || '';
  }
  function showCaption(text, ref) {
    if (!text) { capEl.classList.remove('on'); return; }
    capTextEl.textContent = '\u201C' + text + '\u201D';
    capRefEl.textContent = ref || '';
    capEl.classList.add('on');
  }
  function hideCaption() { capEl.classList.remove('on'); }
  function setTitleCard(on) { titlecardEl.classList.toggle('off', !on); }

  function shot(a, b, look, lt, dur) {
    const k = smooth(lt / (dur * 0.92));
    const s = SHIP.group.position;
    camera.position.set(s.x + lerp(a[0], b[0], k), s.y + lerp(a[1], b[1], k), s.z + lerp(a[2], b[2], k));
    lookAt.set(s.x + look[0], s.y + look[1], s.z + look[2]);
  }

  let currentBeat = 'title';

  /* 1 — title */
  segment(7.0,
    () => {
      currentBeat = 'title';
      setLabel('ACTS', 'KING JAMES VERSION');
      hideCaption();
      setTitleCard(true);
      want.storm = 0.12; want.dawn = 0; want.rain = 0.05; want.sail = 1; want.lamp = 0.3; want.pad = 0;
    },
    (lt) => {
      const k = smooth(lt / 6.6);
      camera.position.set(lerp(40, 28, k), lerp(11, 8, k), lerp(66, 48, k));
      lookAt.set(0, lerp(10, 7, k), 0);
      want.storm = 0.12;
    },
    () => { setTitleCard(false); titlecardEl.style.visibility = 'hidden'; titlecardEl.style.display = 'none'; }
  );

  /* 2 — the south wind */
  segment(17.0,
    () => {
      currentBeat = 'calm';
      setLabel('THE SOUTH WIND', 'ACTS 27:13');
      showCaption(QUOTES.calm.t, QUOTES.calm.r);
      want.storm = 0.12; want.dawn = 0; want.rain = 0.05; want.sail = 1; want.lamp = 0.35; want.pad = 0;
      want.shipZ = 0;
    },
    (lt) => {
      shot([26, 9, 34], [19, 7, 24], [0, 4.2, 0], lt, 16.5);
      want.storm = 0.12 + smooth((lt - 11) / 6) * 0.18;
    },
    () => hideCaption()
  );

  /* 3 — Euroclydon */
  let stormFlashIdx = -1;
  segment(22.0,
    () => {
      currentBeat = 'storm';
      setLabel('EUROCLYDON', 'ACTS 27:14–15');
      showCaption(QUOTES.storm.t, QUOTES.storm.r);
      want.storm = 1.0; want.rain = 1.0; want.sail = 1; want.lamp = 0.3; want.pad = 0; want.shipZ = -4;
      lightning();
    },
    (lt) => {
      shot([30, 10, 36], [18, 6.0, 20], [0.3, 4.0, 0], lt, 21);
      if (lt > 5.0) want.sail = 0.05;
      want.storm = 1.0;
      want.shipZ = -4 - lt * 0.25;
      const fi = Math.floor(lt / 6.5);
      if (lt > 1.5 && fi > stormFlashIdx) { stormFlashIdx = fi; lightning(); }
    },
    () => hideCaption()
  );

  /* 4 — lightening the ship */
  segment(16.0,
    () => {
      currentBeat = 'lighten';
      setLabel('LIGHTENING THE SHIP', 'ACTS 27:18–19');
      showCaption(QUOTES.lighten.t, QUOTES.lighten.r);
      want.storm = 0.95; want.sail = 0.05; want.rain = 0.9; want.lamp = 0.3; want.pad = 0; want.shipZ = -12;
      SHIP.crates.forEach((c, i) => { c.thrown = true; c.t0 = state.time + 0.7 + i * 2.1; });
    },
    (lt) => {
      shot([24, 9, 10], [17, 7, 6], [0, 3.4, 0], lt, 15.5);
      want.shipZ = -12 - lt * 0.2;
    },
    () => hideCaption()
  );

  /* 5 — no sun nor stars */
  segment(15.0,
    () => {
      currentBeat = 'despair';
      setLabel('NO SUN NOR STARS', 'ACTS 27:20');
      showCaption(QUOTES.despair.t, QUOTES.despair.r);
      want.storm = 0.78; want.rain = 0.85; want.sail = 0.05; want.lamp = 0.75; want.pad = 0; want.shipZ = -16;
    },
    (lt) => {
      shot([8.5, 3.6, 12], [6.2, 3.0, 9], [0.2, 1.9, 2.2], lt, 14.5);
      want.storm = 0.78;
    },
    () => hideCaption()
  );

  /* 6 — be of good cheer */
  segment(30.0,
    () => {
      currentBeat = 'paul';
      setLabel('BE OF GOOD CHEER', 'ACTS 27:22');
      showCaption(QUOTES.paulA.t, QUOTES.paulA.r);
      want.storm = 0.45; want.rain = 0.35; want.sail = 0.05; want.lamp = 1.0; want.pad = 0.55; want.shipZ = -18;
    },
    (lt) => {
      shot([-11, 4.6, 10], [-8, 3.7, 7], [0.4, 2.0, 2.6], lt, 29);
      if (lt > 13.5 && !segment._paulB) {
        segment._paulB = true;
        showCaption(QUOTES.paulB.t, QUOTES.paulB.r);
      }
      want.storm = 0.45;
      want.pad = 0.55;
    },
    () => { hideCaption(); segment._paulB = false; }
  );

  /* 7 — the fourteenth night */
  segment(19.0,
    () => {
      currentBeat = 'soundings';
      setLabel('THE FOURTEENTH NIGHT', 'ACTS 27:27–29');
      showCaption(QUOTES.soundings.t, QUOTES.soundings.r);
      want.storm = 0.62; want.rain = 0.65; want.sail = 0.05; want.lamp = 0.95; want.pad = 0.3; want.shipZ = -22;
      SHIP.anchors.forEach((a, i) => { a.active = true; a.t0 = state.time + 9 + i * 0.35; a.splashed = false; });
    },
    (lt) => {
      shot([13, 4.4, 18], [9, 3.2, 14], [0, 2.2, 8], lt, 18.5);
      want.storm = 0.62;
    },
    () => hideCaption()
  );

  /* 8 — the boat */
  segment(15.0,
    () => {
      currentBeat = 'boat';
      setLabel('THE BOAT', 'ACTS 27:30–32');
      showCaption(QUOTES.boat.t, QUOTES.boat.r);
      want.storm = 0.68; want.rain = 0.7; want.sail = 0.05; want.lamp = 0.95; want.pad = 0.2; want.shipZ = -25;
      state.boatT = 0;
      boatDropT = state.time + 7.5;
    },
    (lt) => {
      shot([24, 9, 14], [17, 6.2, 9], [1.5, 2.4, 1], lt, 14.5);
      state.boatT = clamp((state.time - (segmentStart + 2)) / 5, 0, 1);
      if (state.time > boatDropT && !boatDropped) {
        boatDropped = true;
        SHIP.boat.position.y = -3.4;
        splash.burst(SHIP.boat.position, 20, 2.5, 1.0);
        audio.splashSfx();
      }
    },
    () => hideCaption()
  );

  /* 9 — bread */
  segment(22.0,
    () => {
      currentBeat = 'bread';
      setLabel('BREAD', 'ACTS 27:33–36');
      showCaption(QUOTES.bread.t, QUOTES.bread.r);
      want.storm = 0.38; want.dawn = 0.08; want.rain = 0.35; want.sail = 0.05; want.lamp = 1.0; want.pad = 0.5; want.shipZ = -30;
      boatDropped = true;
    },
    (lt) => {
      shot([8.0, 3.6, 10.5], [6.2, 3.0, 8.2], [0.6, 1.8, 2.8], lt, 21.5);
      want.storm = 0.38;
      want.dawn = 0.08;
    },
    () => hideCaption()
  );

  /* 10 — the wheat */
  segment(11.0,
    () => {
      currentBeat = 'wheat';
      setLabel('THE WHEAT', 'ACTS 27:38');
      showCaption(QUOTES.wheat.t, QUOTES.wheat.r);
      want.storm = 0.3; want.dawn = 0.22; want.rain = 0.2; want.sail = 0.08; want.lamp = 0.8; want.pad = 0.3; want.shipZ = -34;
      SHIP.sacks.forEach((c, i) => { c.thrown = true; c.t0 = state.time + 1.0 + i * 1.8; });
    },
    (lt) => {
      shot([17, 7.5, 7], [14, 6.0, 4], [0, 2.6, 2.5], lt, 10.5);
      want.storm = 0.3;
    },
    () => hideCaption()
  );

  /* 11 — toward the creek */
  segment(22.0,
    () => {
      currentBeat = 'shore';
      setLabel('THE CREEK', 'ACTS 27:39–41');
      showCaption(QUOTES.shore.t, QUOTES.shore.r);
      want.storm = 0.3; want.dawn = 0.7; want.rain = 0.08; want.sail = 0.05; want.lamp = 0.55; want.pad = 0.5; want.shipZ = -150;
      grounded.on = false;
    },
    (lt) => {
      const s = SHIP.group.position;
      const k = smooth(lt / 21);
      camera.position.set(s.x + lerp(26, 34, k), s.y + lerp(8, 10, k), s.z + lerp(14, 7, k));
      lookAt.set(0, 3.0, s.z - lerp(22, 40, k));
      if (lt > 3) want.sail = 1;
      want.storm = 0.3;
      want.dawn = 0.7;
      if (lt > 13 && !grounded.on) {
        grounded.on = true;
        splash.burst(SHIP.group.position, 70, 4.5, 1.5);
        shake = Math.min(1.5, shake + 1.0);
        audio.crash();
      }
    },
    () => hideCaption()
  );

  /* 12 — all safe to land */
  segment(19.0,
    () => {
      currentBeat = 'escape';
      setLabel('ALL SAFE TO LAND', 'ACTS 27:42–44');
      showCaption(QUOTES.escape.t, QUOTES.escape.r);
      want.storm = 0.18; want.dawn = 1.0; want.rain = 0; want.sail = 1; want.lamp = 0.4; want.pad = 0.8; want.shipZ = -150;
      SHIP.crew.forEach((c) => { c.fig.group.visible = false; });
      grounded.on = true;
      spawnSwimmers();
    },
    (lt) => {
      const k = smooth(lt / 18);
      camera.position.set(lerp(22, 28, k), lerp(5, 6.5, k), lerp(-136, -128, k));
      lookAt.set(0, 1.4, -169);
      want.storm = 0.18;
      want.dawn = 1.0;
    },
    () => hideCaption()
  );

  /* 13 — Melita */
  segment(10.0,
    () => {
      currentBeat = 'epilogue';
      setLabel('MELITA', 'ACTS 28:1');
      showCaption(QUOTES.melita.t, QUOTES.melita.r);
      want.storm = 0.12; want.dawn = 1.0; want.rain = 0; want.sail = 1; want.lamp = 0.8; want.pad = 0.9;
      swimmers.forEach((s) => { s.fig.group.visible = false; });
      swimmerPlanks.forEach((p) => { p.mesh.visible = false; });
      beachGroup.visible = true;
      beachGroup.userData.fire.visible = true;
    },
    (lt) => {
      const k = smooth(lt / 9.5);
      camera.position.set(lerp(-31, -28, k), lerp(4.8, 4.3, k), lerp(-157, -160, k));
      lookAt.set(lerp(-4, -2, k), 1.2, -169);
      const flame = beachGroup.userData.flame;
      flame.scale.set(1 + Math.sin(state.time * 7) * 0.12, 1 + Math.sin(state.time * 9 + 1) * 0.2, 1);
      want.storm = 0.12;
      want.dawn = 1.0;
    },
    () => hideCaption()
  );

  const total = cursor;

  /* ------------------------------------------------------------------- step */
  let globalTime = 0;
  let segIdx = -1;
  let fadeAlpha = 1;
  let activeHorse = -1;
  let running = false;
  let paused = false;
  let ended = false;
  let lastT = 0;
  let segmentStart = 0;
  let boatDropT = 0;
  let boatDropped = false;

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function endSequence() {
    if (ended) return;
    ended = true;
    hideCaption();
    endcardEl.classList.add('on');
    if (STILL) {
      endcardEl.style.opacity = '1';
      endcardEl.style.visibility = 'visible';
    }
    document.body.classList.add('ended');
  }

  function updateSegments() {
    if (globalTime >= total) endSequence();
    let idx = 0;
    for (let i = 0; i < SEGMENTS.length; i++) if (globalTime >= SEGMENTS[i].start) idx = i;
    const seg = SEGMENTS[idx];
    const lt = globalTime - seg.start;
    if (idx !== segIdx) {
      const prev = SEGMENTS[segIdx];
      if (prev && prev.exit) prev.exit();
      segIdx = idx;
      segmentStart = seg.start;
      fadeAlpha = 1;
      if (seg.enter) seg.enter();
    }
    if (seg.update) seg.update(lt, globalTime);
  }

  function updateState(dt) {
    const k = (rate) => 1 - Math.exp(-dt * rate);
    state.storm = lerp(state.storm, want.storm, k(0.45));
    state.dawn = lerp(state.dawn, want.dawn, k(0.22));
    state.rain = lerp(state.rain, want.rain, k(0.5));
    state.sail = lerp(state.sail, want.sail, k(1.6));
    state.lamp = lerp(state.lamp, want.lamp, k(0.8));
    state.pad = lerp(state.pad, want.pad, k(0.7));
    state.shipZ = lerp(state.shipZ, want.shipZ, k(0.24));
    state.flash = Math.max(0, state.flash - dt * 3.4);
  }

  function applyCameraShake() {
    camera.lookAt(lookAt);
    if (shake > 0.001) {
      camera.position.x += Math.sin(state.time * 41.3) * 0.12 * shake;
      camera.position.y += Math.cos(state.time * 37.1) * 0.09 * shake;
      camera.rotation.z += Math.sin(state.time * 29.7) * 0.008 * shake;
    }
    if (state.storm > 0.2) {
      const s = state.storm * 0.16;
      camera.position.x += Math.sin(state.time * 7.1) * s;
      camera.position.y += Math.sin(state.time * 9.3 + 1.2) * s * 0.6;
      camera.rotation.z += Math.sin(state.time * 8.7) * 0.006 * state.storm;
    }
    shake = Math.max(0, shake - 0.02);
  }

  function step(dt) {
    if (paused || ended) return;
    globalTime += dt;
    state.time = globalTime;
    updateState(dt);
    updateShip(dt);
    updateWeather(dt);
    updateSwimmers(globalTime);
    updateSegments();

    spray.update(dt);
    splash.update(dt);
    foamPool.update(dt);

    shake = Math.max(0, shake - dt * 1.4);
    fadeAlpha = Math.max(0, fadeAlpha - dt * 2.4);
    fadeEl.style.opacity = fadeAlpha.toFixed(3);

    applyCameraShake();

    barEl.style.transform = 'scaleX(' + clamp(globalTime / total, 0, 1).toFixed(5) + ')';
    timeEl.textContent = fmt(Math.min(globalTime, total)) + ' / ' + fmt(total);
  }

  function renderFrame() { renderer.render(scene, camera); }

  function frame(now) {
    if (!lastT) lastT = now;
    let dt = (now - lastT) / 1000;
    lastT = now;
    dt = clamp(dt, 0.001, 0.05);
    if (running) step(dt);
    renderFrame();
  }

  /* -------------------------------------------------------------------- UI */
  const beginBtn = $('begin');
  const replayBtn = $('replay');
  const pauseBtn = $('btn-pause');
  const muteBtn = $('btn-mute');
  const fullBtn = $('btn-full');

  function begin() {
    if (running) return;
    audio.init();
    running = true;
    lastT = performance.now();
    fadeAlpha = 1;
    document.body.classList.add('playing');
    beginBtn.blur();
  }
  beginBtn.addEventListener('click', begin);
  replayBtn.addEventListener('click', () => location.reload());
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶' : '❚❚';
  });
  muteBtn.addEventListener('click', () => {
    const on = audio.toggle();
    muteBtn.textContent = on ? '♪' : '✕';
    muteBtn.classList.toggle('muted', !on);
  });
  fullBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen && document.exitFullscreen();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!running) begin();
      else pauseBtn.click();
    } else if (e.key === 'm' || e.key === 'M') muteBtn.click();
    else if (e.key === 'r' || e.key === 'R') location.reload();
    else if (e.key === 'f' || e.key === 'F') fullBtn.click();
  });
  document.addEventListener('fullscreenchange', () => {
    fullBtn.textContent = document.fullscreenElement ? '⤢' : '⛶';
  });

  /* ------------------------------------------------------------------ boot */
  state.time = 0;
  fadeEl.style.opacity = '1';

  if (STILL) {
    document.body.classList.add('still', 'playing');
    endcardEl.classList.remove('on');
    $('start').style.display = 'none';
    running = false;
    const target = STILL_T;
    const dt = 1 / 60;
    let t = 0;
    do {
      step(dt);
      t += dt;
    } while (t < target - 1e-6 && !ended);
    applyCameraShake();
    renderFrame();
    window.__READY__ = true;
    if (renderer.setAnimationLoop) renderer.setAnimationLoop(() => renderFrame());
  } else {
    renderFrame();
    renderer.setAnimationLoop(frame);
    if (params.get('autostart') === '1') {
      setTimeout(() => { try { begin(); } catch (e) { showErr('AUTOSTART: ' + e.message); } }, 300);
    }
  }

  window.__REV = {
    total,
    segments: SEGMENTS,
    get time() { return globalTime; },
    begin,
    jump(seconds) {
      if (!running) begin();
      globalTime = clamp(seconds, 0, total - 0.01);
      segIdx = -1;
      fadeAlpha = 0;
    }
  };
})();
