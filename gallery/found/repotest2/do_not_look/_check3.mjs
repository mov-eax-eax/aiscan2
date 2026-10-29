
/*EIF_MODULE*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

'use strict';
/* =====================================================================
   TOUR EIFFEL — fully procedural, metric (1 unit = 1 m)
   Structure levels: piers 0–4.8 m · lattice legs 4.8–187.4 m ·
   merged shaft 187.4–299.7 m · top platform 276.1 m · mast to 330 m.
   Envelope half-width s(y)=62.5·exp(-0.0082·y) (125 m base → ~13 m @276 m)
   ===================================================================== */

/* ---------------- params (URL query overrides) ---------------- */
const _u = new URLSearchParams(location.search);
const params = {
  seed:     _u.has('seed')     ? Number(_u.get('seed'))     : 20240218,
  density:  _u.has('density')  ? Number(_u.get('density'))  : 1.0,
  intro:    _u.has('intro')    ? (_u.get('intro') === '1' || _u.get('intro') === 'true') : true,
  night:    _u.has('night')    ? Number(_u.get('night'))    : 0,
  post:     _u.has('post')     ? (_u.get('post') === '0' ? false : true) : true,
  shadows:  _u.has('shadows')  ? (_u.get('shadows') === '0' ? false : true) : true,
  pr:       _u.has('pr')       ? Number(_u.get('pr'))       : 0,
  sparks:   _u.has('sparks')   ? Number(_u.get('sparks'))   : 20000,
  view:     _u.get('view')     || '',
  reduced:  matchMedia('(prefers-reduced-motion: reduce)').matches
};
const REDUCED = params.reduced;

/* ---------------- dom helpers ---------------- */
const $ = s => document.querySelector(s);
function setPhase(text, detail){ const p=$('#ovPhase'); if(p)p.textContent=text; const d=$('#ovDetail'); if(d)d.textContent=detail||''; }
function reportProgress(f, text, detail){
  const bar=$('#ovBar'); if(bar) bar.style.width = Math.min(100, Math.round(f*100)) + '%';
  if(text) setPhase(text, detail||$('#ovDetail').textContent);
}
/* yield to the event loop so the progress overlay actually paints */
const _yield = () => new Promise(r => setTimeout(r, 0));
let _lastYield = 0;
async function breatheEvery(n, i){ if(i - _lastYield > n){ _lastYield = i; await _yield(); } }

/* ---------------- deterministic rng ---------------- */
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const RND = mulberry32(params.seed);
const rnd = RND;
const rndRange = (a,b)=> a + (b-a)*RND();
const rndInt = (a,b)=> Math.floor(rndRange(a,b+0.999999));
const pick = arr => arr[Math.floor(RND()*arr.length)];
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp = (a,b,t)=> a+(b-a)*t;
const smooth = t => t*t*(3-2*t);
const easeIO = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;
const dist2 = (ax,az,bx,bz)=>{ const dx=ax-bx,dz=az-bz; return dx*dx+dz*dz; };

/* ---------------- tower dimensions (metric) ---------------- */
const H_TIP   = 330.0;     // antenna/flagpole tip
const Y_P1    = 57.0;      // 1st platform (deck top level ~57.4)
const Y_P2    = 115.0;     // 2nd platform
const Y_P3    = 276.1;     // 3rd / top platform
const LEG_Y0  = 4.8;       // lattice legs start on pier caps
const LEG_Y1  = 187.4;     // legs merge into the central shaft
const SHAFT_Y1= 299.7;     // lattice shaft / belfry top
const MAST_Y0 = 299.7;     // antenna mast base
const envR   = y => 62.5*Math.exp(-0.0082*y);              // outer envelope corner radius (m)
const legWid = y => 21.8*Math.exp(-0.00685*(y-LEG_Y0));    // leg box width (m)
const legInR = y => envR(y) - legWid(y);                   // inner corner radius
const legOutR= y => envR(y);                               // outer corner radius
function shaftHalf(y){ return envR(y); }                   // merged shaft envelope
function mastHalf(y){ const t=clamp((y-MAST_Y0)/(330-MAST_Y0),0,1); return lerp(0.82,0.15,t); }

/* ---------------- palette & material buckets ---------------- */
const COL = { base:0x4a3b2f, mid:0x6b5540, hi:0x8a6e52, stone:0xb7a893, stoneDark:0x8f8071,
  gold:0xd9b071, glass:0x9fd4e0, leaf:0x3f5a34, leafL:0x557a40, trunk:0x4e3b2b };
const BUCKETS = {
  chord : { s:1.20, c:0x8a6e52, n:'corner chords / heavy' },
  girder: { s:1.95, c:0x8a6e52, n:'platform girders' },
  belt  : { s:0.78, c:0x6b5540, n:'horizontal belts' },
  diag  : { s:0.48, c:0x5d4a38, n:'X braces' },
  sub   : { s:0.30, c:0x55432f, n:'secondary diagonals' },
  tiny  : { s:0.20, c:0x4f3e2c, n:'fine lattice' },
  rail  : { s:0.14, c:0x6b5540, n:'railings / posts' }
};

/* beam factory — everything lattice-like goes through here so it can be
   instanced in a handful of draw calls at the end */
const FB = {
  buckets: {},
  nodeCount: 0,
  bucket(name){ let b=this.buckets[name]; if(!b){ const d=BUCKETS[name]; if(!d) throw new Error('unknown bucket '+name);
      b=this.buckets[name]={ name, s:d.s, c:d.c, n:d.n, beams:[] }; } return b; },
  add(name, x0,y0,z0, x1,y1,z1){ this.bucket(name).beams.push(x0,y0,z0,x1,y1,z1); this.nodeCount++; },
  addB(name, p0, p1){ this.add(name, p0[0],p0[1],p0[2], p1[0],p1[1],p1[2]); },
  count(){ let n=0; for(const k in this.buckets) n += this.buckets[k].beams.length/6; return n; },
  /* call at end of modelling: bake every bucket into InstancedMesh(es) */
  finalize(roughness, metalness){
    const out = [];
    for(const key in this.buckets){
      const bk = this.buckets[key], arr = bk.beams;
      if(!arr.length) continue;
      const count = arr.length/6;
      const geo = new THREE.BoxGeometry(1,1,1);
      geo.computeBoundingSphere(); geo.boundingSphere.radius = 420;
      const mat = new THREE.MeshStandardMaterial({
        color: bk.c, roughness, metalness, name:'bucket-'+key,
        envMapIntensity:0.9 });
      const q = new THREE.Quaternion(), m = new THREE.Matrix4(), up = new THREE.Vector3();
      const X = new THREE.Vector3(1,0,0), dir = new THREE.Vector3();
      const pos = new THREE.Vector3(), scale = new THREE.Vector3();
      const chunks = Math.ceil(count / 24000);
      for(let cix=0; cix<chunks; cix++){
        const c0 = cix*24000, c1 = Math.min(count, c0+24000), n = c1-c0;
        const im = new THREE.InstancedMesh(geo, mat, n);
        im.name = 'FB-'+key+'-'+(cix+1)+'/'+chunks;
        im.frustumCulled = false;
        im.castShadow = true; im.receiveShadow = true;
        const col = new THREE.Color();
        for(let i=c0;i<c1;i++){
          const k=i-c0, o=i*6;
          const x0=arr[o], y0=arr[o+1], z0=arr[o+2], x1=arr[o+3], y1=arr[o+4], z1=arr[o+5];
          dir.set(x1-x0,y1-y0,z1-z0);
          const L = dir.length(); if(L<1e-5) continue;
          dir.multiplyScalar(1/L);
          q.setFromUnitVectors(X, dir);
          pos.set((x0+x1)*0.5,(y0+y1)*0.5,(z0+z1)*0.5);
          scale.set(L, bk.s, bk.s);
          m.compose(pos, q, scale);
          im.setMatrixAt(k, m);
          // subtle per-instance brightness / tint jitter so metal does not look flat
          const j = 0.94 + RND()*0.12;
          const tint = RND();
          col.setHex(bk.c).multiplyScalar(j);
          if(tint>0.85) col.lerp(new THREE.Color(0x9a7a54), (tint-0.85)*4);
          else if(tint<0.15) col.lerp(new THREE.Color(0x3c2f25), (0.15-tint)*4);
          im.setColorAt(k, col);
        }
        if(im.instanceColor) im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere(); im.boundingSphere.radius = 500;
        out.push(im);
      }
    }
    return out;
  }
};


/* =====================================================================
   PART 2 — renderer / camera / controls factories, procedural canvas
   textures, sky dome, environment lighting.
   ===================================================================== */

/* ---------------- canvas texture factory ---------------- */
function canvasTex(w, h, draw, opts){
  opts = opts || {};
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.clearRect(0,0,w,h);
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if(opts.sRGB !== false) t.colorSpace = THREE.SRGBColorSpace;
  if(opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  t.anisotropy = 8;
  if(opts.flipY === false) t.flipY = false;
  return t;
}
function noiseFill(g,w,h,alpha,colorFn){ // grainy value noise for organic surfaces
  const id = g.createImageData(w,h);
  const d = id.data;
  for(let i=0;i<w*h;i++){
    const v = colorFn ? colorFn(i) : (Math.random()*255)|0;
    const o = i*4;
    d[o]=v; d[o+1]=v; d[o+2]=v; d[o+3]=alpha!==undefined?alpha:255;
  }
  g.putImageData(id,0,0);
}

const TX = {};   // texture store

function createTextures(){
  // --- iron streak roughness (subtle brushed vertical streaks) ---
  TX.streak = canvasTex(128,128,(g)=>{
    g.fillStyle='#808080'; g.fillRect(0,0,128,128);
    for(let i=0;i<1500;i++){
      const v = 96+Math.random()*80|0;
      g.fillStyle='rgba('+v+','+v+','+v+',0.09)';
      g.fillRect(Math.random()*128, Math.random()*128, 1+Math.random()*2, 2+Math.random()*8);
    }
  },{sRGB:false});
  TX.streak.wrapS = TX.streak.wrapT = THREE.RepeatWrapping;

  // --- grass meadow (with mowing stripes) ---
  TX.grass = canvasTex(256,256,(g,w,h)=>{
    const base=[[106,128,70],[96,120,62],[116,138,80],[88,112,58]];
    const id=g.createImageData(w,h), d=id.data;
    for(let i=0;i<w*h;i++){
      const px=i%w, py=(i/w)|0;
      const band=base[((px/32)|0 + (py/32)|0)%2];
      let n=Math.random()*26-13;
      const streak = Math.random()<0.10 ? (Math.random()*26-13) : 0;
      d[i*4]  =clamp(band[0]+n+streak,30,190);
      d[i*4+1]=clamp(band[1]+n*1.1+streak,40,200);
      d[i*4+2]=clamp(band[2]+n*0.8,30,150);
      d[i*4+3]=255;
    }
    g.putImageData(id,0,0);
    // faint path wear patches (baked, mostly covered by real paths)
  },{repeat:[1,1]});
  TX.grass.colorSpace = THREE.SRGBColorSpace;

  // --- gravel for paths / esplanade alleys ---
  TX.gravel = canvasTex(128,128,(g)=>{
    g.fillStyle='#8d8574'; g.fillRect(0,0,128,128);
    for(let i=0;i<2200;i++){
      const v=120+Math.random()*110|0;
      g.fillStyle='rgba('+v+','+(v*0.96)|0+','+(v*0.85)|0+',0.8)';
      g.beginPath(); g.arc(Math.random()*128,Math.random()*128,0.6+Math.random()*1.9,0,7); g.fill();
    }
    for(let i=0;i<400;i++){ g.fillStyle='rgba(60,54,46,0.16)'; g.fillRect(Math.random()*128,Math.random()*128,1,1); }
  },{repeat:[1,1]});

  // --- esplanade paving slabs ---
  TX.plaza = canvasTex(512,512,(g,w,h)=>{
    g.fillStyle='#a69b89'; g.fillRect(0,0,w,h);
    for(let i=0;i<26000;i++){
      const v=140+Math.random()*70|0;
      g.fillStyle='rgba('+v+','+v+','+(v*0.93)|0+',0.10)';
      g.fillRect(Math.random()*w,Math.random()*h,1,1);
    }
    const sw=64, jw=2;
    g.strokeStyle='rgba(64,56,46,0.55)'; g.lineWidth=jw;
    for(let x=0;x<=w;x+=sw){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
    for(let y=0;y<=h;y+=sw){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
    g.fillStyle='rgba(52,46,38,0.5)';
    for(let x=0;x<w;x+=sw) for(let y=0;y<h;y+=sw){ if(Math.random()<0.12) g.fillRect(x+4,y+4,sw-8,sw-8); }
  },{repeat:[1,1]});

  // --- ashlar stone (piers & masonry) ---
  TX.stone = canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#a99b87'; g.fillRect(0,0,w,h);
    noiseFill(g,w,h,255,()=> (120+Math.random()*80)|0);
    g.globalAlpha=0.22; g.fillStyle='#9a8b76';
    const cw=64,ch=32;
    for(let y=0;y<h;y+=ch){
      const off=(y/ch)%2?32:0;
      for(let x=-off;x<w;x+=cw){
        g.beginPath(); g.rect(x+1,y+1,cw-2,ch-2); g.stroke();
        g.fillRect(x+1,y+1,cw-2,ch-2);
      }
    }
    g.globalAlpha=1;
    g.strokeStyle='rgba(60,52,42,0.9)'; g.lineWidth=2;
    for(let y=0;y<=h;y+=ch){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
    const cw2=64;
    for(let y=0;y<h;y+=ch){ const off=(y/ch)%2?32:0; for(let x=-off;x<w+off;x+=cw2){ g.beginPath(); g.moveTo(x,y); g.lineTo(x,y+ch); g.stroke(); } }
    // corner bevel shading
    for(let i=0;i<60;i++){ const x=Math.random()*w,y=Math.random()*h; g.fillStyle='rgba(0,0,0,'+(0.04+Math.random()*0.08)+')'; g.fillRect(x,y,6,6); }
  },{repeat:[1,1]});

  // --- dark roof sheet ---
  TX.roof = canvasTex(128,128,(g)=>{
    g.fillStyle='#3f4a52'; g.fillRect(0,0,128,128);
    for(let i=0;i<2500;i++){ const v=50+Math.random()*70|0; g.fillStyle='rgba('+v+','+(v+10)+','+(v+16)+',0.5)'; g.fillRect(Math.random()*128,Math.random()*128,2,1); }
  },{repeat:[1,1]});

  // --- foliage leaf sprigs (alpha) ---
  TX.leaf = canvasTex(128,128,(g,w,h)=>{
    g.clearRect(0,0,w,h);
    const cols=['#4d7039','#587f42','#416132','#66924c'];
    for(let i=0;i<140;i++){
      g.fillStyle=cols[i%cols.length];
      const r=2+Math.random()*9, x=Math.random()*w, y=Math.random()*h;
      g.globalAlpha=0.5+Math.random()*0.5;
      g.beginPath();
      if(Math.random()<0.7){ g.arc(x,y,r,0,7); g.fill(); }
      else{ g.ellipse(x,y,r*1.6,r*0.7,Math.random()*3,0,7); g.fill(); }
    }
    g.globalAlpha=1;
  },{repeat:[1,1]});
  TX.leaf.anisotropy = 4;

  // --- windowed facade: ONE shared window layout feeds both maps, so lit
  //     windows land exactly on the day-window holes.
  //     DAY map: light stone + recessed glass panes (unchanged look).
  //     NIGHT emissive map: near-black wall whose only bright content is a
  //     sparse grid of small warm panes — the wall itself never glows.
  const facadeDraw = (emit)=>{
    return (g,w,h)=>{
      const colsX=7, rowsY=9, cw=w/colsX, ch=h/rowsY;
      if(!emit){
        const cols=['#b0a08a','#a4947e','#bbaa93','#9d8d76'];
        g.fillStyle=cols[0]; g.fillRect(0,0,w,h);
        noiseFill(g,w,h,255,()=> (130+Math.random()*60)|0);
        for(let i=0;i<420;i++){ g.fillStyle='rgba(40,30,20,'+(0.05+Math.random()*0.1)+')'; g.fillRect(Math.random()*w,Math.random()*h,4,4); }
        for(let cx=0;cx<colsX;cx++) for(let ry=0;ry<rowsY;ry++){
          g.fillStyle = (Math.random()<0.75)?'rgba(38,46,58,0.9)':'rgba(120,134,146,0.8)';
          g.fillRect(cx*cw+4, ry*ch+3, cw-8, ch-6);
        }
        // cornice lines
        g.fillStyle='rgba(60,52,44,0.8)';
        for(let ry=0;ry<=rowsY;ry++) g.fillRect(0,ry*ch-1,w,3);
      } else {
        g.fillStyle='#05060a'; g.fillRect(0,0,w,h);     // black wall base
        for(let cx=0;cx<colsX;cx++) for(let ry=0;ry<rowsY;ry++){
          const lit = Math.random();
          if(lit>0.30) continue;                         // most windows stay dark
          // smaller pane centred inside the day hole → reads punctate, not slab
          const px0=cx*cw+10, py0=ry*ch+8, ww=cw-20, wh=ch-16;
          if(lit<0.165){                                 // warm tungsten
            const b=195+(Math.random()*45|0);
            g.fillStyle='rgba(255,'+b+',120,'+(0.6+Math.random()*0.4)+')';
          } else if(lit<0.235){                          // cool / screen glow
            g.fillStyle='rgba(170,200,240,'+(0.3+Math.random()*0.35)+')';
          } else {                                       // dim curtained room
            g.fillStyle='rgba(255,190,120,'+(0.12+Math.random()*0.2)+')';
          }
          g.fillRect(px0,py0,ww,wh);
        }
      }
    };
  };
  TX.facadeDay = canvasTex(256,288,facadeDraw(false),{repeat:[1,1]});
  TX.facadeEmt = canvasTex(256,288,facadeDraw(true),{sRGB:false,repeat:[1,1]});

  // --- water / seine strip ---
  TX.water = canvasTex(256,256,(g,w,h)=>{
    const grad=g.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'#5c7280'); grad.addColorStop(0.5,'#465d6b'); grad.addColorStop(1,'#33474f');
    g.fillStyle=grad; g.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){
      const y=Math.random()*h, x=Math.random()*w, L=3+Math.random()*22;
      g.strokeStyle='rgba(190,214,224,'+(0.03+Math.random()*0.10)+')';
      g.beginPath(); g.moveTo(x,y); g.lineTo(x+L,y+(Math.random()*2-1)); g.stroke();
    }
  },{repeat:[1,1]});

  // --- circular sun glow sprite for lamp bulbs ---
  TX.bulb = canvasTex(64,64,(g,w,h)=>{
    const grad=g.createRadialGradient(32,32,2,32,32,30);
    grad.addColorStop(0,'rgba(255,246,214,1)');
    grad.addColorStop(0.25,'rgba(255,226,160,0.9)');
    grad.addColorStop(0.6,'rgba(255,190,110,0.25)');
    grad.addColorStop(1,'rgba(255,170,80,0)');
    g.fillStyle=grad; g.fillRect(0,0,w,h);
  },{sRGB:false});
}

/* ---------------- sky dome (custom gradient + sun + scattering) ---------------- */
let skyMesh, sunDirV = new THREE.Vector3(-0.42,0.40,0.81).normalize();
function buildSky(){
  const uniforms = {
    uSunDir:  { value: sunDirV.clone().normalize() },
    uNight:   { value: 0 },
    uDayZen:  { value: new THREE.Color(0x3f7cc2) },
    uDayHor:  { value: new THREE.Color(0xcfe0ec) },
    uDuskZen: { value: new THREE.Color(0x2a3f72) },
    uDuskHor: { value: new THREE.Color(0xe8a468) },
    uNightZen:{ value: new THREE.Color(0x05070f) },
    uNightHor:{ value: new THREE.Color(0x0b1222) },
    uSunCol:  { value: new THREE.Color(0xffe2ad) },
    uSunPow:  { value: 1600.0 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /*glsl*/`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /*glsl*/`
      varying vec3 vDir;
      uniform vec3 uSunDir; uniform float uNight;
      uniform vec3 uDayZen,uDayHor,uDuskZen,uDuskHor,uNightZen,uNightHor,uSunCol;
      uniform float uSunPow;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y*0.5+0.5,0.0,1.0);
        vec3 dayCol   = mix(uDayHor, uDayZen, pow(h,0.75));
        vec3 duskCol  = mix(uDuskHor,uDuskZen, pow(h,0.8));
        vec3 nightCol = mix(uNightHor,uNightZen, pow(h,0.9));
        vec3 col = mix(dayCol, duskCol, uNight*0.5);
        col = mix(col, nightCol, max(0.0,uNight*1.35-0.35));
        // warm back-light band around the sun
        float s = max(dot(d,uSunDir),0.0);
        col += uSunCol * (pow(s,24.0)*0.10 + pow(s,3.0)*0.035) * (1.0-uNight);
        // sun disc
        float disc = smoothstep(0.99965,0.99995,s);
        col = mix(col, vec3(1.0,0.98,0.92), disc*(1.0-uNight));
        // very subtle zenith atmospheric gradient boost
        col += vec3(0.015,0.025,0.045)*pow(h,6.0);
        gl_FragColor = vec4(col,1.0);
      }`
  });
  const geo = new THREE.SphereGeometry(6500, 40, 20);
  skyMesh = new THREE.Mesh(geo, mat);
  skyMesh.frustumCulled = false;
  skyMesh.renderOrder = -10;
  scene.add(skyMesh);
  app.skyUniforms = uniforms;

  // ---- stars ----
  const N = 2200;
  const pos = new Float32Array(N*3), col = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const a = rndRange(0,Math.PI*2);
    const e = Math.acos(rndRange(0.02,1.0));
    const r = 5900;
    pos[i*3]=Math.cos(a)*Math.sin(e)*r;
    pos[i*3+1]=Math.cos(e)*r;
    pos[i*3+2]=Math.sin(a)*Math.sin(e)*r;
    const v = 0.5+Math.random()*0.5;
    col[i*3]=v; col[i*3+1]=v; col[i*3+2]=v;
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  sgeo.setAttribute('color', new THREE.BufferAttribute(col,3));
  const smat = new THREE.PointsMaterial({ size:2.6, sizeAttenuation:false, vertexColors:true,
    map:TX.bulb, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false });
  const stars = new THREE.Points(sgeo, smat);
  stars.frustumCulled = false; stars.renderOrder = -9;
  scene.add(stars);
  app.stars = { mesh: stars, mat: smat };
}

/* ---------------- core: renderer / scene / camera / controls ---------------- */
const app = {};
let clock;
function initCore(){
  const container = $('#app');
  const w = container.clientWidth || window.innerWidth;
  const h = container.clientHeight || window.innerHeight;
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(params.pr>0 ? params.pr : Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(w,h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = params.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.debug.checkShaderErrors = true;
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x22385a);
  scene.fog = new THREE.Fog(0xc8d4de, 1300, 5200);

  camera = new THREE.PerspectiveCamera(46, w/h, 0.5, 15000);
  camera.position.set(190, 96, 330);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0,120,0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.minDistance = 8;
  controls.maxDistance = 2400;
  controls.maxPolarAngle = Math.PI*0.499;
  controls.autoRotateSpeed = 0.65;
  controls.zoomSpeed = 0.8;

  clock = new THREE.Clock();
  app.container = container;
  app.camera = camera; app.scene = scene; app.controls = controls;

  // shared objects
  app.dynamic = { nightT:0, nightTarget: params.night>0?1:0, t:0, sparkleOn:true,
    wire:false, xray:false, autoRotate:false };
  app.structuralMats = [];   // every tower material (for wireframe/xray)
  app.fx = [];               // emissive int controllers for day/night
  app.fxAlb = [];            // albedo (diffuse colour) dimmers for day/night
  app.lights = [];
}

function onResize(){
  if(!renderer || !app.container) return;
  const w = app.container.clientWidth, h = app.container.clientHeight;
  camera.aspect = w/h; camera.updateProjectionMatrix();
  renderer.setSize(w,h);
  if(composer) composer.setSize(w,h);
}
window.addEventListener('resize', onResize);

/* ---------------- environment & lights ---------------- */
function initEnvAndLights(){
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  // warm directional sun with a fitted ortho shadow camera
  const sun = new THREE.DirectionalLight(0xffdab0, 3.6);
  sun.position.set(330, 560, 280);
  sun.castShadow = params.shadows;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -400; sc.right = 400; sc.top = 500; sc.bottom = -300;
  sc.near = 60; sc.far = 1400;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 1.6;
  scene.add(sun);
  scene.add(sun.target);
  sun.target.position.set(0,130,0);
  app.sun = sun; app.lights.push(sun);

  const hemi = new THREE.HemisphereLight(0xcfe0f2, 0x423828, 0.62);
  scene.add(hemi);
  app.hemi = hemi; app.lights.push(hemi);

  const amb = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(amb); app.ambient = amb;
}

/* helper used by later parts: register emissive controller */
function regFx(material, dayInt, nightInt){ app.fx.push({ mat:material, d:dayInt, n:nightInt }); }
/* helper: day/night diffuse-albedo dimmer (nightHex lerped in setDynamicLights).
   City mass then goes dark at night while its emissive windows still glow. */
function regAlb(material, nightHex){
  app.fxAlb.push({ mat:material, d:material.color.clone(), n:new THREE.Color(nightHex) });
}


/* =====================================================================
   PART 3 — ground plane, esplanade, Champ de Mars / Trocadéro gardens,
   Seine, distant Paris skyline, lamps / benches / trees / hedges.
   ===================================================================== */
function stdMat(opt){ return new THREE.MeshStandardMaterial(Object.assign({
  roughness:0.8, metalness:0.06 }, opt)); }
function planeTex(base, rx, ry){
  const t = base.clone(); t.repeat.set(rx,ry); t.needsUpdate = true; return t;
}
function groundMesh(geo, mat){ const m=new THREE.Mesh(geo,mat); m.receiveShadow=true; return m; }
function addInstanced(geo, mat, n, fill, shadow, receive){
  const im = new THREE.InstancedMesh(geo, mat, n);
  im.frustumCulled = false;
  im.castShadow = !!shadow; im.receiveShadow = !!receive;
  if(fill) fill(im);
  scene.add(im);
  return im;
}
function yawM(q, ay){ q.setFromAxisAngle(_UP, ay); }
const _UP = new THREE.Vector3(0,1,0);
const _M4 = new THREE.Matrix4(), _P = new THREE.Vector3(), _Q = new THREE.Quaternion(), _SC = new THREE.Vector3();

function buildGround(){
  // ---------- big grass meadow ----------
  {
    const g = new THREE.CircleGeometry(3000, 80);
    const m = stdMat({ map: planeTex(TX.grass, 700, 700), roughness:0.95, metalness:0 });
    const me = new THREE.Mesh(g, m);
    me.rotation.x = -Math.PI/2; me.position.y = 0;
    me.receiveShadow = true;
    scene.add(me);
  }
  // darker green collar immediately around the paved esplanade
  {
    const g = new THREE.RingGeometry(181, 250, 90);
    const m = stdMat({ map: planeTex(TX.grass, 60, 12), roughness:1, metalness:0, color:0x87986a });
    const me = new THREE.Mesh(g, m);
    me.rotation.x = -Math.PI/2; me.position.y = 0.004;
    me.receiveShadow = true; scene.add(me);
  }

  // ---------- main esplanade paving (square around the tower) ----------
  {
    const g = new THREE.PlaneGeometry(362, 362);
    const m = stdMat({ map: planeTex(TX.plaza, 24, 24), roughness:0.92, metalness:0 });
    const me = new THREE.Mesh(g, m);
    me.rotation.x = -Math.PI/2; me.position.y = 0.03;
    me.receiveShadow = true; scene.add(me);
  }
  // low stone curb around the plaza
  {
    const curb = stdMat({ color:0x8f8373, roughness:0.85 });
    const S = 181.4;
    const mk = (sx,sz,lx,lz)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(lx,0.4,lz),curb);
      m.position.set(sx,0.2,sz); m.receiveShadow=true; scene.add(m); };
    mk(0,S,363,1.4); mk(0,-S,363,1.4); mk(S,0,1.4,363); mk(-S,0,1.4,363);
  }

  // ---------- gravel avenues ----------
  const addPath = (w, len, cx, cz, rotY, rx, rz)=>{
    const g = new THREE.PlaneGeometry(w, len);
    const m = stdMat({ map: planeTex(TX.gravel, rx||10, rz||10), roughness:1, metalness:0, color:0xd8d0c0 });
    const me = new THREE.Mesh(g, m);
    me.rotation.x = -Math.PI/2;
    if(rotY) me.rotation.y = rotY;
    me.position.set(cx,0.045,cz);
    me.receiveShadow = true; scene.add(me);
  };
  addPath(64, 470, 0, -425);                       // south Champ-de-Mars avenue
  addPath(90, 150, 0, 240);                        // north Trocadéro approach
  addPath(1500, 46, 0, -730, 0, 130, 4);           // cross avenue far south
  // diagonal walks from the plaza corners into the meadow
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const len=300, ang=Math.atan2(-sz*len, sx*len);
    addPath(10, len, sx*272, sz*272, ang-Math.PI/2, 30, 1.2);
  }

  // ---------- Trocadéro fountain pond (north) ----------
  {
    const pondMat = stdMat({ color:0x7fa8b8, roughness:0.12, metalness:0.1, transparent:true, opacity:0.94 });
    const me = new THREE.Mesh(new THREE.CircleGeometry(55, 44), pondMat);
    me.rotation.x=-Math.PI/2; me.position.set(0,0.06,430); scene.add(me);
    const rim = new THREE.Mesh(new THREE.RingGeometry(55,58,56), stdMat({ color:0x9aa0a4, roughness:0.6 }));
    rim.rotation.x=-Math.PI/2; rim.position.set(0,0.09,430); scene.add(rim);
    const sprayGeo=new THREE.ConeGeometry(0.8,7,6);
    const sprayMat=stdMat({color:0xcfe2e6,transparent:true,opacity:0.5,roughness:0.3});
    addInstanced(sprayGeo,sprayMat,12,(im)=>{
      for(let i=0;i<12;i++){
        const a=(i/12)*Math.PI*2;
        _M4.makeTranslation(Math.cos(a)*30,5,430+Math.sin(a)*30);
        im.setMatrixAt(i,_M4);
      }
    },false,false);
  }
  // simplified Palais de Chaillot (two long blocks facing the tower)
  {
    const day=planeTex(TX.facadeDay,5,1), emt=planeTex(TX.facadeEmt,5,1);
    const palMat = stdMat({ map:day, emissive:0xffffff, emissiveMap:emt, emissiveIntensity:0.10, roughness:0.9, metalness:0 });
    regAlb(palMat, 0x242b36);
    for(const sx of [-1,1]){
      const body=new THREE.Mesh(new THREE.BoxGeometry(220,22,28), palMat);
      body.position.set(sx*100,11,655); body.castShadow=true; body.receiveShadow=true; scene.add(body);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(228,2.6,34), stdMat({map:planeTex(TX.roof,44,6),roughness:0.9}));
      roof.position.set(sx*100,23.3,655); roof.castShadow=true; scene.add(roof);
    }
    regFx(palMat, 0.05, 0.55);
  }

  // ---------- Seine river + bridge (far north) ----------
  {
    const wm = stdMat({ map: planeTex(TX.water, 80, 3), roughness:0.06, metalness:0.2 });
    const me = new THREE.Mesh(new THREE.PlaneGeometry(9000, 340), wm);
    me.rotation.x=-Math.PI/2; me.position.set(0,0.02,1700); scene.add(me);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000,140), stdMat({color:0x465259,roughness:1}));
    far.rotation.x=-Math.PI/2; far.position.set(0,0.005,1940); scene.add(far);
    for(const sx of [-1,1]){
      const pier=new THREE.Mesh(new THREE.BoxGeometry(10,9,40), stdMat({color:0x8d8478,roughness:0.9}));
      pier.position.set(sx*240,4.5,1500); pier.castShadow=true; scene.add(pier);
    }
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(1400,2.4,30), stdMat({color:0x7c7266,roughness:0.8}));
    bridge.position.set(0,9,1500); bridge.castShadow=true; scene.add(bridge);
    for(const sx of [-1,1]){
      const r=new THREE.Mesh(new THREE.BoxGeometry(1400,1.2,0.5), stdMat({color:0x4c463f,metalness:0.5,roughness:0.5}));
      r.position.set(0,11.4,1500+sx*13.5); scene.add(r);
    }
  }

  // ---------- Paris city: École Militaire axis, Haussmann quarters, far skyline ----------
  buildParisCity();

  // ---------- trees (instanced trunks + two canopy layers) ----------
  {
    const trunkGeo = new THREE.CylinderGeometry(0.28,0.44,5.2,6);
    const trunkMat = stdMat({ color:0x4e3b2b, roughness:0.95 });
    const leafGeo = new THREE.IcosahedronGeometry(1,1);
    const leafMatA = stdMat({ color:0x46682f, roughness:1, map:TX.leaf.clone(), alphaTest:0.42, side:THREE.DoubleSide });
    const leafMatB = stdMat({ color:0x5c8045, roughness:1, map:TX.leaf.clone(), alphaTest:0.42, side:THREE.DoubleSide });
    const spots = [];
    for(const sx of [-1,1]) for(let z=-250; z>-650; z-=36) spots.push([sx*(40+rndRange(-6,6)), z+rndRange(-3,3)]);
    for(let i=0;i<52;i++){ const a=rndRange(0,Math.PI*2), r=rndRange(250,720); spots.push([Math.cos(a)*r, Math.sin(a)*r]); }
    for(const sx of [-1,1]) for(let z=225;z<450;z+=32) spots.push([sx*(150+rndRange(0,40)), z+rndRange(-2,2)]);
    const N=spots.length;
    const treeData=[];
    for(let i=0;i<N;i++){
      const h=rndRange(5.6,7.6), s=rndRange(0.9,1.3);
      treeData.push({ x:spots[i][0], z:spots[i][1], h, s, yaw:rndRange(0,6.283) });
    }
    addInstanced(trunkGeo, trunkMat, N, (im)=>{
      for(let i=0;i<N;i++){ const t=treeData[i];
        _Q.setFromAxisAngle(_UP,t.yaw);
        _P.set(t.x, t.h*0.46, t.z); _SC.set(1, t.h/5.2, 1);
        _M4.compose(_P,_Q,_SC); im.setMatrixAt(i,_M4); }
    }, true, true);
    addInstanced(leafGeo, leafMatA, N, (im)=>{
      for(let i=0;i<N;i++){ const t=treeData[i];
        const r=t.s*rndRange(2.6,3.8);
        _P.set(t.x, t.h*1.12, t.z); _SC.set(r, r*0.85, r);
        _M4.makeScale(r, r*0.85, r); _M4.setPosition(_P); im.setMatrixAt(i,_M4); }
    }, true, false);
    addInstanced(leafGeo, leafMatB, N, (im)=>{
      for(let i=0;i<N;i++){ const t=treeData[i];
        const r=t.s*rndRange(1.5,2.1);
        _P.set(t.x+r*0.2, t.h*1.28, t.z+r*0.1); _SC.set(r,r*0.95,r);
        _M4.makeScale(r, r*0.95, r); _M4.setPosition(_P); im.setMatrixAt(i,_M4); }
    }, true, false);
  }

  // ---------- hedges ----------
  {
    const hedgeMat = stdMat({ color:0x37501f, roughness:1, side:THREE.DoubleSide });
    const rects=[];
    const seg=(x0,z0,x1,z1,w,cols)=>{
      const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz); if(L<1) return;
      const n=Math.max(1,Math.round(L/cols));
      for(let i=0;i<n;i++){
        const t0=i/n,t1=(i+1)/n;
        rects.push({ cx:(x0+dx*(t0+t1)/2), cz:(z0+dz*(t0+t1)/2),
          a:Math.atan2(dz,dx), Ln:L/n, w });
      }
    };
    for(const sx of [-1,1]){
      seg(sx*30,-260, sx*30,-700, 2.6, 22);                       // avenue flanks
      seg(sx*196,-196, sx*196,-340, 2.4, 20);                     // plaza east/west hedges
      seg(-196,sx*196, -340,sx*196, 2.4, 20);                     // plaza north/south hedges
    }
    seg(0,250, 0,540, 3.6, 26);                                   // trocadéro divider
    const im = addInstanced(new THREE.BoxGeometry(1,1,1), hedgeMat, rects.length, (im)=>{
      for(let i=0;i<rects.length;i++){
        const r=rects[i];
        _Q.setFromAxisAngle(_UP, r.a);
        _P.set(r.cx, 0.8, r.cz);
        _SC.set(r.Ln+r.w*0.12, 1.6, r.w);
        _M4.compose(_P,_Q,_SC); im.setMatrixAt(i,_M4);
      }
    }, false, true);
  }

  // ---------- lamp posts ----------
  {
    const N=64; const lampPos=[];
    for(let z=-182; z<=182; z+=28) lampPos.push([-182,z],[182,z]);
    for(let x=-182; x<=182; x+=28) lampPos.push([x,-182],[x,182]);
    for(let z=-260; z>=-600; z-=42) lampPos.push([-34,z],[34,z]);
    const nL=lampPos.length;
    const poleGeo=new THREE.CylinderGeometry(0.1,0.15,7.6,8);
    const poleMat = stdMat({ color:0x211d17, metalness:0.55, roughness:0.5 });
    addInstanced(poleGeo, poleMat, nL, (im)=>{
      for(let i=0;i<nL;i++){ _M4.makeTranslation(lampPos[i][0],3.8,lampPos[i][1]); im.setMatrixAt(i,_M4); } }, true, false);
    const headGeo=new THREE.BoxGeometry(0.7,0.42,0.42);
    const headMat = stdMat({ color:0xfff2d2, emissive:0xffc37a, emissiveIntensity:0.3, roughness:0.4 });
    addInstanced(headGeo, headMat, nL, (im)=>{
      for(let i=0;i<nL;i++){ _M4.makeTranslation(lampPos[i][0],7.75,lampPos[i][1]); im.setMatrixAt(i,_M4); } }, false, false);
    const bulbMat = new THREE.PointsMaterial({ size:2.6, map:TX.bulb, transparent:true, opacity:0,
      depthWrite:false, blending:THREE.AdditiveBlending });
    const bp = new Float32Array(nL*3);
    for(let i=0;i<nL;i++){ bp[i*3]=lampPos[i][0]; bp[i*3+1]=7.8; bp[i*3+2]=lampPos[i][1]; }
    const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.BufferAttribute(bp,3));
    const bulbs=new THREE.Points(bg,bulbMat); bulbs.frustumCulled=false; scene.add(bulbs);
    regFx(headMat, 0.26, 2.4);
    app.fx.push({ mat:bulbMat, d:0, n:0.85, cur:0 });
    groundLampMats = [poleMat, headMat];
  }

  // ---------- benches ----------
  {
    const seatMat = stdMat({ color:0x6d4f33, roughness:0.9 });
    const ironMat = stdMat({ color:0x2b2620, metalness:0.7, roughness:0.4 });
    const spots=[];
    for(let i=0;i<34;i++){
      const side=i%4, t=(i>>2)/8.5; let x,z,a; const H=162;
      if(side===0){ x=-H+18+(t)*324; z=H-8; a=Math.PI/2; }
      else if(side===1){ x=H-8; z=H-18-t*324; a=0; }
      else if(side===2){ x=H-18-t*324; z=-H+8; a=-Math.PI/2; }
      else { x=-H+8; z=-H+18+t*324; a=Math.PI; }
      spots.push([x,z,a]);
    }
    const seatGeo=new THREE.BoxGeometry(2.1,0.16,0.62);
    const backGeo=new THREE.BoxGeometry(2.1,0.52,0.09);
    const legGeo=new THREE.BoxGeometry(0.1,0.5,0.5);
    const n=spots.length;
    addInstanced(seatGeo, seatMat, n, (im)=>{
      for(let i=0;i<n;i++){ _Q.setFromAxisAngle(_UP,spots[i][2]); _P.set(spots[i][0],0.56,spots[i][1]);
        _M4.compose(_P,_Q,_SC.set(1,1,1)); im.setMatrixAt(i,_M4); } },false,false);
    addInstanced(backGeo, seatMat, n, (im)=>{
      for(let i=0;i<n;i++){ _Q.setFromAxisAngle(_UP,spots[i][2]); _P.set(spots[i][0],0.96,spots[i][1]+0.29);
        _M4.compose(_P,_Q,_SC.set(1,1,1)); im.setMatrixAt(i,_M4); } },false,false);
    addInstanced(legGeo, ironMat, n*2, (im)=>{
      for(let i=0;i<n;i++) for(let j=0;j<2;j++){
        const lx=j?0.86:-0.86;
        _Q.setFromAxisAngle(_UP,spots[i][2]);
        _P.set(spots[i][0]+lx,0.28,spots[i][1]);
        _M4.compose(_P,_Q,_SC.set(1,1,1));
        im.setMatrixAt(i*2+j,_M4);
      } },false,false);
  }

  // ---------- glass ticket pavilions at the four pier feet ----------
  {
    const glassMat = stdMat({ color:0x9fc3cd, metalness:0.15, roughness:0.12, transparent:true, opacity:0.5 });
    const frameMat = stdMat({ color:0x27353d, metalness:0.8, roughness:0.35 });
    for(const [px,pz] of [[-96,-96],[96,-96],[-96,96],[96,96]]){
      const base = new THREE.Mesh(new THREE.BoxGeometry(24,1.2,24), stdMat({ color:0xb0a187, map:planeTex(TX.stone,3,3), roughness:0.9 }));
      base.position.set(px,0.6,pz); base.receiveShadow=true; scene.add(base);
      const body = new THREE.Mesh(new THREE.BoxGeometry(22,6,22), glassMat);
      body.position.set(px,4.2,pz); body.castShadow=true; scene.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(26,0.6,26), stdMat({ color:0x9db3a0, roughness:0.7 }));
      roof.position.set(px,7.5,pz); roof.castShadow=true; scene.add(roof);
      for(const sx of [-1,1]) for(const sz of [-1,1]){
        const c=new THREE.Mesh(new THREE.BoxGeometry(0.8,7,0.8), frameMat);
        c.position.set(px+sx*10.6,3.6,pz+sz*10.6); scene.add(c);
      }
      // little awning signs
      const sign=new THREE.Mesh(new THREE.BoxGeometry(8,1.0,0.25), stdMat({color:0x8a6e52,roughness:0.7}));
      sign.position.set(px,6.1,pz+ (pz>0? 12:-12)); scene.add(sign);
    }
  }
}
let groundLampMats = [];

/* =====================================================================
   PART 3.5 — Paris streetscape around the Champ de Mars.
   Layered, instanced, deterministic (uses its own RNG so it does not
   perturb the rest of the build). Geometry kept OUT of:
     - the esplanade square   (|x|,|z| < 181)
     - the gravel avenues     (south axis |x|<32 to z -660, north |x|<45,
                               cross avenue at z=-730, diagonal walks)
     - the Champ-de-Mars lawn between the plaza and the École Militaire
       (keeps the tower's vista clear)
     - the Seine water band   (z 1530..1870) + Trocadéro pond/palais zone
   The Eiffel tower stays the visual hero: everything here is peripheral.
   ===================================================================== */
function buildParisCity(){
  const rr = mulberry32(987654321);          // private stream → deterministic, isolated
  const rndA = (a,b)=> a+(b-a)*rr();
  const px = (x,z,y,h,w,d)=>{                // push one axis-aligned box footprint
    return { x, z, y, h, w, d };
  };

  const UNITS = {};

  /* ---------- helpers: push many boxes into one InstancedMesh ---------- */
  const bakeBoxes = (boxes, mat, opts)=>{
    if(!boxes.length) return null;
    const n = boxes.length;
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1), mat, n);
    im.frustumCulled = false;
    im.castShadow = opts && opts.shadow;
    im.receiveShadow = opts && opts.receive;
    const c = new THREE.Color();
    for(let i=0;i<n;i++){
      const b = boxes[i];
      _P.set(b.x, b.y + (b.h||b.scaleY||1)*0.5, b.z);
      _SC.set(b.w, (b.h||b.scaleY||1), b.d);
      _M4.compose(_P, _Q.identity(), _SC);
      im.setMatrixAt(i,_M4);
      if(opts && opts.tint){
        c.setHex(opts.tint);
        if(opts.tintJitter) c.multiplyScalar(0.85+rndA(0,0.3));
        im.setColorAt(i,c);
      }
    }
    if(im.instanceColor) im.instanceColor.needsUpdate = true;
    scene.add(im);
    return im;
  };

  /* building helper: facade body + dark roof + occasional chimney, all instanced,
     bottoms sit exactly on y=0 so nothing floats. */
  const FAC = planeTex(TX.facadeDay, 1, 1);
  const FME = planeTex(TX.facadeEmt, 1, 1);
  const facadeMat = stdMat({ map:FAC, emissive:0xffffff, emissiveMap:FME,
    emissiveIntensity:0.10, roughness:0.92, metalness:0 });
  regFx(facadeMat, 0.05, 0.6);
  regAlb(facadeMat, 0x252c38);        // walls sink to dark indigo at night
  const roofMat = stdMat({ map: planeTex(TX.roof, 3, 1), roughness:0.95, metalness:0 });
  const chimneyMat = stdMat({ color:0x3a3a3d, roughness:0.9 });
  const towerRoofMat = stdMat({ color:0x565d63, roughness:0.9, metalness:0.05 });
  regAlb(roofMat, 0x0d1016);          // keep roof slabs dark
  regAlb(chimneyMat, 0x0d1016);
  regAlb(towerRoofMat, 0x161c26);

  /* "districts": accept(x,z) keeps the box centre inside the allowed collar */
  const allowedMid = (x,z)=>{
    const r2 = x*x+z*z;
    if(r2 < 560*560 || r2 > 1750*1750) return false;   // collar between gardens & far ring
    const ax = Math.abs(x);
    if(z > 1450) return false;                          // north of the river band
    if(z > 300 && ax < 640) return false;               // pond / palais / palace gardens
    if(z >= -870 && z < 30 && ax < 430) return false;   // lawn vista plaza → École front
    if(z < -900 && ax < 160) return false;              // corridor right behind the École dome
    if(Math.abs(z+730) < 42 && ax < 900) return false;  // the cross avenue stays a road
    return true;
  };
  const allowedFar = (x,z)=>{
    const r2 = x*x+z*z;
    if(r2 < 1680*1680) return false;
    if(r2 > 2950*2950) return false;
    // keep the Seine water band clear (river z 1530..1870 plus its quays)
    if(z > 1480 && z < 2000 && Math.abs(x) < 4200) return false;
    if(z < -790 && Math.abs(x) < 160) return false;     // narrow slot behind the École dome
    return true;
  };

  /* ============ A) École Militaire mass at the end of the Champ de Mars ============ */
  {
    const stoneMat = stdMat({ color:0xcbbfa9, roughness:0.85, metalness:0 });
    const darkMat  = stdMat({ color:0x7e8078, roughness:0.9 });
    const roofM    = stdMat({ map: planeTex(TX.roof, 6, 2), roughness:0.9 });
    regAlb(stoneMat, 0x1b222d);       // pale stone goes dark after sunset
    regAlb(roofM, 0x0e1218);
    // main long corps-de-logis, centered on the vista axis at the south end of the lawn
    const body = [];
    // wings (two long 4-storey ranges flanking a central dome)
    for(const sx of [-1,1]){
      body.push(px(sx*115, -838, 0, 18, 230, 34));    // wing along x
      body.push(px(sx*36,  -838, 0, 24, 62, 34));     // taller inner pavilion
    }
    bakeBoxes(body, stoneMat, { shadow:true, receive:true });
    const wingsRoof=[];
    for(const sx of [-1,1]){
      wingsRoof.push(px(sx*115, -838, 18, 2.4, 238, 41));
      wingsRoof.push(px(sx*36,  -838, 24, 2.6, 70, 41));
    }
    bakeBoxes(wingsRoof, roofM, { shadow:true });
    // dome + lantern over the centre
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14, 0, Math.PI*2, 0, Math.PI/2),
      stdMat({ color:0x3e7d63, roughness:0.28, metalness:0.55 }));
    dome.scale.set(16, 12, 16); dome.position.set(0, 34, -838);
    scene.add(dome);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(9,11,8,14), stoneMat);
    drum.position.set(0, 28, -838); scene.add(drum);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.8,1.4,9,8),
      stdMat({ color:0x6a6a50, roughness:0.35, metalness:0.6 }));
    lantern.position.set(0, 47, -838); scene.add(lantern);
    // mansard over the centre block behind the dome
    const central = bakeBoxes([px(0, -838, 17, 9, 74, 36)], towerRoofMat, { shadow:true });
    // small pediment-like fronton over the entrance
    const ped = bakeBoxes([px(0, -806, 0, 12, 30, 30)], stoneMat, { shadow:true });
    // gravel forecourt plane + two parterre hedges in front
    {
      const fc = new THREE.Mesh(new THREE.PlaneGeometry(560, 26),
        stdMat({ map: planeTex(TX.gravel, 30, 2), roughness:1, metalness:0 }));
      fc.rotation.x = -Math.PI/2; fc.position.set(0,0.02,-808); fc.receiveShadow=true;
      scene.add(fc);
    }
    {
      const hedge = bakeBoxes([
        px(-115,-788,0,1.6,340,2.2), px(115,-788,0,1.6,340,2.2)
      ], stdMat({ color:0x2f4a1e, roughness:1 }), {});
    }
    void central; void ped; void darkMat;
  }

  /* ============ B) mid-band Haussmann quarters (south & east/west edges) ============ */
  {
    // Dense Haussmann FABRIC: rows along the park flanks + quarters south of the
    // École and on the Chaillot sides — houses share party walls with narrow
    // gaps (streets), so the mid-ground reads as city blocks, not scattered dice.
    const cellD = 46;
    const placed = new Map();
    const near = (x,z,minD)=>{
      const kx = Math.floor(x/cellD), kz = Math.floor(z/cellD);
      for(let a=kx-1;a<=kx+1;a++) for(let b=kz-1;b<=kz+1;b++){
        const arr = placed.get(a+','+b); if(!arr) continue;
        for(const p of arr){
          const dx=x-p[0], dz=z-p[1];
          if(dx*dx+dz*dz < minD*minD) return true;
        }
      }
      return false;
    };
    const put = (x,z)=>{ const k=Math.floor(x/cellD)+','+Math.floor(z/cellD);
      const a=placed.get(k)||(placed.set(k,[]).get(k)); a.push([x,z]); };
    const mkHouse = (x,z)=>{
      if(!allowedMid(x,z)) return;
      if(near(x,z,13)) return;
      if(rr()<0.20) return;                                   // courtyard/garden gaps
      const w = rndA(16,25), d = rndA(13,19);
      const h = (rr()<0.07) ? rndA(23,32) : rndA(16.5,22.5);   // cornice rhythm + corners
      blocks.push(px(x,z,0,h,w,d));
      put(x,z);
    };
    const blocks = [];
    // 1) street walls flanking the Champ-de-Mars, both sides (avenues de
    //    Suffren / Bourdonnais), running N–S; density fades with distance
    for(const sx of [-1,1]){
      for(const fx of [470, 560, 660, 780, 920, 1100, 1320, 1580]){
        for(let z=-880; z<=260; z+=27) mkHouse(sx*fx, z + rndA(-5,5));
      }
    }
    // 2) the 7th arrondissement south of the École (rows running E–W)
    for(let z=-960; z>=-1700; z-=27){
      for(let x=-1660; x<=1660; x+=30){
        if(Math.abs(x) < 180) continue;                       // axial avenue behind the dome
        mkHouse(x + rndA(-6,6), z);
      }
    }
    // 3) Chaillot / Passy sides north-west & north-east of the palais
    for(const sx of [-1,1]){
      for(const fx of [760, 900, 1080, 1300, 1540]){
        for(let z=330; z<=1420; z+=30) mkHouse(sx*fx, z + rndA(-6,6));
      }
    }
    bakeBoxes(blocks, facadeMat, { tint:0xe6dcc8, tintJitter:true });
    // zinc roofs with a slight overhang
    const roofs = blocks.map(b=>px(b.x, b.z, b.h, rndA(2,3.4), b.w+1.6, b.d+1.6));
    bakeBoxes(roofs, roofMat, {});
    // chimneys on a subset (reads as Haussmann silhouettes, must clear the roof)
    const chims=[];
    for(const b of blocks){
      if(rr()<0.45){
        chims.push(px(b.x + b.w*rndA(-0.3,0.3), b.z + b.d*rndA(-0.3,0.3), b.h + 3.2, 1.6, 0.5, 0.5));
      }
    }
    bakeBoxes(chims, chimneyMat, {});
  }

  /* ============ C) far skyline ring — Paris in the distance ============ */
  {
    const cellD = 46;
    const placed = new Map();
    const near = (x,z,minD)=>{
      const kx = Math.floor(x/cellD), kz = Math.floor(z/cellD);
      for(let a=kx-1;a<=kx+1;a++) for(let b=kz-1;b<=kz+1;b++){
        const arr = placed.get(a+','+b); if(!arr) continue;
        for(const p of arr){
          const dx=x-p[0], dz=z-p[1];
          if(dx*dx+dz*dz < minD*minD) return true;
        }
      }
      return false;
    };
    const put = (x,z)=>{ const k=Math.floor(x/cellD)+','+Math.floor(z/cellD);
      const a=placed.get(k)||(placed.set(k,[]).get(k)); a.push([x,z]); };

    const far = [];
    const towers = [];
    let guard=0;
    while(far.length < 2200 && guard++ < 70000){
      const a = rndA(0, Math.PI*2), r = rndA(1850, 2860);
      const x = Math.cos(a)*r, z = Math.sin(a)*r;
      if(!allowedFar(x,z)) continue;
      const w = rndA(14, 44), d = rndA(12, 28);
      if(near(x,z, Math.max(w,d)*0.5 + 3)) continue;
      // far edges of the ring climb higher → gives the skyline its layering
      const h = rndA(16, 42) + Math.max(0,(r-2400))*0.035 + (rr()<0.08 ? rndA(20,50) : 0);
      far.push(px(x,z,0,Math.min(h,120),w,d));
      put(x,z);
    }
    bakeBoxes(far, facadeMat, { tint:0x9db4c8, tintJitter:true });
    // zinc roofs top every far block too (dark silhouette against the haze)
    bakeBoxes(far.map(b=>px(b.x,b.z,b.h,rndA(1.6,2.6),b.w+1.4,b.d+1.4)), roofMat, {});
    // dark towers punch the skyline — a Montparnasse-like one south of the vista
    for(let i=0;i<26 && guard++<2200;i++){
      const southBias = (i===0);                         // first tower: south-east of École
      const a = southBias ? rndA(2.2, 3.6) : rndA(0, Math.PI*2);
      const r = rndA(2000, 2500);
      const x = Math.cos(a)*r, z = Math.sin(a)*r;
      if(!allowedFar(x,z) || near(x,z,70)){ i--; continue; }
      const h = southBias ? rndA(170,205) : rndA(95, 170);
      const w = rndA(16, 26), d = rndA(16, 26);
      towers.push(px(x,z,0,h,w,d));
      towers.push(px(x - w*0.22, z - d*0.22, h, 7, 2.2, 2.2));   // antenna block
      put(x,z);
    }
    bakeBoxes(towers, towerRoofMat, { tint:0x5d646c, tintJitter:true });
    // far-side blocks standing right behind the river (visible from north walks)
    {
      const bank=[];
      let g2=0;
      while(bank.length < 190 && g2++ < 3000){
        const x = rndA(-2900,2900);
        if(Math.abs(x) < 560) continue;
        const z = rndA(1960, 2380);
        const h = rndA(13, 32), w = rndA(20, 58), d = rndA(13, 24);
        bank.push(px(x,z,0,h,w,d));
      }
      const banks = bakeBoxes(bank, facadeMat, { tint:0x9db4c8, tintJitter:true });
      const bankRoof = bakeBoxes(bank.map(b=>px(b.x,b.z,b.h,rndA(1.8,2.6),b.w+1.4,b.d+1.4)), roofMat, {});
      void banks; void bankRoof;
    }
  }

  /* ============ D) small extras that sell the scene ============ */
  {
    // Parisian plane trees (bigger, rounder canopy than the existing cones):
    // flank the main Champ-de-Mars avenue and the north esplanade.
    const spots=[];
    for(const sx of [-1,1]){
      for(let z=-205; z>=-640; z-=64) spots.push([sx*58+rndA(-4,4), z+rndA(-3,3)]);
      for(let z=190; z<=305; z+=52)   spots.push([sx*(96+rndA(-5,5)), z+rndA(-2,2)]);
    }
    const trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5,0.75,9,6),
      stdMat({ color:0x4e3b2b, roughness:0.95 }), spots.length);
    const canopyGeo = new THREE.IcosahedronGeometry(1,1);
    const canopyA = new THREE.InstancedMesh(canopyGeo,
      stdMat({ color:0x527a3a, roughness:1, map:TX.leaf.clone(), alphaTest:0.42, side:THREE.DoubleSide }), spots.length);
    const canopyB = new THREE.InstancedMesh(canopyGeo,
      stdMat({ color:0x69913f, roughness:1, map:TX.leaf.clone(), alphaTest:0.42, side:THREE.DoubleSide }), spots.length);
    trunks.frustumCulled = canopyA.frustumCulled = canopyB.frustumCulled = false;
    trunks.castShadow = true; canopyA.castShadow = true; canopyB.castShadow = true;
    for(let i=0;i<spots.length;i++){
      const x=spots[i][0], z=spots[i][1];
      const h=9.4+rndA(0,1.6);
      _M4.makeScale(1, h/9, 1); _M4.setPosition(x, h*0.5, z);
      trunks.setMatrixAt(i,_M4);
      const ra=rndA(4.2,5.6);
      _M4.makeScale(ra, ra*0.8, ra); _M4.setPosition(x, h*0.62, z);
      canopyA.setMatrixAt(i,_M4);
      const rb=ra*rndA(0.62,0.8);
      _M4.makeScale(rb, rb*0.9, rb); _M4.setPosition(x+ra*0.15, h*0.95, z+ra*0.08);
      canopyB.setMatrixAt(i,_M4);
    }
    scene.add(trunks); scene.add(canopyA); scene.add(canopyB);
  }
  void UNITS;
}

/* =====================================================================
   PART 4 — the four masonry piers and the four converging lattice legs.
   Every lattice bar is pushed into FB (instanced later) so the tower
   renders in a handful of draw calls.
   ===================================================================== */

/* flat-shaded tapered box (non-indexed, accurate outward normals) */
function makeTaperedBox(w0, d0, w1, d1, h){
  const verts = [];
  const push = (v)=>{ verts.push(v[0],v[1],v[2]); };
  const quad = (a,b,c,d)=>{
    const tri = (p,q,r)=>{ push(p); push(q); push(r); };
    // two triangles per quad, orientation fixed by winding below
    tri(a,b,c); tri(a,c,d);
  };
  const hx0=w0/2, hz0=d0/2, hx1=w1/2, hz1=d1/2;
  const p0=[-hx0,0,-hz0], p1=[ hx0,0,-hz0], p2=[ hx0,0, hz0], p3=[-hx0,0, hz0];
  const q0=[-hx1,h,-hz1], q1=[ hx1,h,-hz1], q2=[ hx1,h, hz1], q3=[-hx1,h, hz1];
  // faces, wound to face outward (verified by normal flip below)
  quad(q0,q2,q1,q3);   // top
  quad(p0,p1,p2,p3);   // bottom
  quad(p1,q1,q0,p0);   // -z side
  quad(p2,q2,q1,p1);   // +x side
  quad(p3,q3,q2,p2);   // +z side
  quad(p0,q0,q3,p3);   // -x side
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  g.computeVertexNormals();
  return g;
}

/* P I E R S — four masonry frustums with plinths & caps */
function buildPiers(){
  const stoneMat = new THREE.MeshStandardMaterial({
    map: planeTex(TX.stone, 5, 3), roughness:0.92, metalness:0 });
  const capMat  = new THREE.MeshStandardMaterial({
    map: planeTex(TX.stone, 4, 1), roughness:0.85, metalness:0, color:0xc7b9a4 });
  const baseMat = new THREE.MeshStandardMaterial({
    map: planeTex(TX.stone, 6, 1), roughness:0.95, metalness:0, color:0x9b8d7a });
  const C = 50; // pier centre distance from tower axis on each axis
  for(const sx of [-1,1]) for(const sz of [-1,1]){
    const x=sx*C, z=sz*C;
    const grp = new THREE.Group();
    // plinth
    const pl = new THREE.Mesh(makeTaperedBox(27.4,27.4,27.0,27.0,0.7), baseMat);
    pl.position.y = 0.35; grp.add(pl);
    // main battered shaft (top inset)
    const body = new THREE.Mesh(makeTaperedBox(26.0,26.0,23.8,23.8,3.0), stoneMat);
    body.position.y = 2.2; grp.add(body);
    // string course + cornice
    const belt1 = new THREE.Mesh(makeTaperedBox(24.6,24.6,24.9,24.9,0.45), capMat);
    belt1.position.y = 3.925; grp.add(belt1);
    const belt2 = new THREE.Mesh(makeTaperedBox(25.0,25.0,25.0,25.0,0.3), capMat);
    belt2.position.y = 4.3; grp.add(belt2);
    // cap slab the legs stand on (top at 4.8 m = LEG_Y0)
    const cap = new THREE.Mesh(makeTaperedBox(25.6,25.6,25.6,25.6,0.35), capMat);
    cap.position.y = 4.625; grp.add(cap);
    // decorative impost blocks centred on each face of the pier shaft
    const impMat = stdMat({ color:0x7e7363, roughness:0.8 });
    for(const [fx,fz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const w = fx ? 0.9 : 8.6, d = fx ? 8.6 : 0.9;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.0, d), impMat);
      b.position.set(x + fx*12.4, 3.0, z + fz*12.4);
      grp.add(b);
    }
    grp.position.set(x, 0, z);
    grp.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
    scene.add(grp);
    // 4 columnar pilasters at each corner face for masonry rhythm
    for(const [fx,fz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const pil = new THREE.Mesh(new THREE.BoxGeometry(fx?1.6:4.2, 4.6, fx?4.2:1.6),
        stdMat({ color:0xa2937f, roughness:0.85 }));
      pil.position.set(sx*(C+fx*12.1), 2.4, sz*(C+fz*12.1));
      pil.castShadow = true; pil.receiveShadow = true;
      scene.add(pil);
    }
  }
}

/* L E G S — four curved box-truss legs, each with 4 corner chords,
   dense X lattice on every face, horizontal belts, secondary diagonals.
   Ring spacing and cell width shrink with height → bracing density
   increases upward (like the real tower). */
function buildLegs(){
  const ySpan = LEG_Y1 - LEG_Y0;
  const ringSp = y => lerp(3.05, 2.15, (y-LEG_Y0)/ySpan) / params.density;
  const cellW = y => lerp(4.1, 2.5, (y-LEG_Y0)/ySpan) / Math.sqrt(params.density);

  // 4 corners of one leg box at height y, quadrant (sx,sz)
  const legCorner = (sx,sz,y,k)=>{           // k: 0 inner-inner,1 xOuter,2 outer-outer,3 zOuter
    const i = legInR(y), o = legOutR(y);
    const cx = sx>0 ? (k===1||k===2 ? o : i) : (k===1||k===2 ? -o : -i);
    const cz = sz>0 ? (k===2||k===3 ? o : i) : (k===2||k===3 ? -o : -i);
    return [cx, cz];
  };

  for(const sx of [-1,1]) for(const sz of [-1,1]){
    // build ring heights
    const ys=[LEG_Y0];
    let y=LEG_Y0;
    while(y < LEG_Y1-0.01){ y = Math.min(LEG_Y1, y+ringSp(y)); ys.push(y); }
    if(ys[ys.length-1] < LEG_Y1-0.01) ys.push(LEG_Y1);
    let ringIdx=0;
    for(let ri=0; ri<ys.length-1; ri++){
      const y0=ys[ri], y1=ys[ri+1], ym=(y0+y1)*0.5;
      // corner chord segments
      for(let k=0;k<4;k++){
        const a=legCorner(sx,sz,y0,k), b=legCorner(sx,sz,y1,k);
        FB.addB('chord', [a[0],y0,a[1]], [b[0],y1,b[1]]);
      }
      const nW = clamp(Math.round(legWid(ym)/cellW(ym)), 1, 8);
      const faces=[[0,1],[1,2],[2,3],[3,0]];
      for(const f of faces){
        const kA=f[0], kB=f[1];
        const A0=legCorner(sx,sz,y0,kA), B0=legCorner(sx,sz,y0,kB);
        const A1=legCorner(sx,sz,y1,kA), B1=legCorner(sx,sz,y1,kB);
        for(let c=0;c<nW;c++){
          const t0=c/nW, t1=(c+1)/nW;
          const ax0=A0[0]+(B0[0]-A0[0])*t0, az0=A0[1]+(B0[1]-A0[1])*t0;
          const ax1=A0[0]+(B0[0]-A0[0])*t1, az1=A0[1]+(B0[1]-A0[1])*t1;
          const bx0=A1[0]+(B1[0]-A1[0])*t0, bz0=A1[1]+(B1[1]-A1[1])*t0;
          const bx1=A1[0]+(B1[0]-A1[0])*t1, bz1=A1[1]+(B1[1]-A1[1])*t1;
          // X brace pair (the heart of the lattice)
          FB.add('diag', ax0,y0,az0, bx1,y1,bz1);
          FB.add('diag', ax1,y0,az1, bx0,y1,bz0);
          // lower belt of this ring band (covers this cell top edge at y0)
          FB.add('belt', ax0,y0,az0, ax1,y0,az1);
          // secondary micro-diagonals when the bay is large enough
          const hw=(y1-y0)*0.5;
          if(y1-y0>2.6 && (ax1-ax0)>2.2){
            const mx0=(ax0+ax1)*0.5, mz0=(az0+az1)*0.5;
            FB.add('sub', ax0+ (ax1-ax0)*0.15, y0+hw, az0, ax1, y0, az1);
            FB.add('sub', ax0, y0, az0, ax1-(ax1-ax0)*0.15, y0+hw, az1);
          }
        }
        // short vertical posts at cell boundaries of this face (subtle)
      }
      // box interior torsion diagonals every 3rd band (visible when flying inside)
      if(ringIdx % 3 === 0){
        const a=legCorner(sx,sz,y0,0), c=legCorner(sx,sz,y1,2);
        const b=legCorner(sx,sz,y0,2), d=legCorner(sx,sz,y1,0);
        FB.add('sub', a[0],y0,a[1], c[0],y1,c[1]);
        FB.add('sub', b[0],y0,b[1], d[0],y1,d[1]);
      }
      ringIdx++;
    }
    // top closing ring belts (so the leg top is a clean ring)
    const yT=LEG_Y1, nWT=clamp(Math.round(legWid(yT)/cellW(yT)),1,8);
    const faces=[[0,1],[1,2],[2,3],[3,0]];
    for(const f of faces){
      const A=legCorner(sx,sz,yT,f[0]), B=legCorner(sx,sz,yT,f[1]);
      for(let c=0;c<nWT;c++){
        const t0=c/nWT, t1=(c+1)/nWT;
        FB.add('belt', A[0]+(B[0]-A[0])*t0,yT,A[1]+(B[1]-A[1])*t0,
                     A[0]+(B[0]-A[0])*t1,yT,A[1]+(B[1]-A[1])*t1);
      }
    }
  }
}


/* =====================================================================
   PART 5 — platform decks (1st & 2nd are the classic “cross” plan with
   the four corner squares occupied by the legs; the 3rd is an octagon),
   perimeter railings, the gold-engraved name frieze under level 1,
   glass floor, restaurant & gallery volumes.
   ===================================================================== */
let renderer, scene, camera, controls, composer, bloomPass;   // (declared here for module scope)
let nightLights = [];            // SpotLights for night flooding
const structureMats = [];        // all tower materials (wireframe/x-ray)

function crossPoly(H, N){
  return [[ N, H],[-N, H],[-N, N],[-H, N],[-H,-N],[-N,-N],[-N,-H],
          [ N,-H],[ N,-N],[ H,-N],[ H, N],[ N, N]];
}
function octPoly(R){
  const p=[]; for(let i=0;i<8;i++){ const a=Math.PI*(i+0.5)/4; p.push([Math.cos(a)*R, Math.sin(a)*R]); } return p;
}
function polyShape(poly){
  const s = new THREE.Shape();
  s.moveTo(poly[0][0], -poly[0][1]);
  for(let i=1;i<poly.length;i++) s.lineTo(poly[i][0], -poly[i][1]);
  s.closePath();
  return s;
}
/* thin plate following a floor polygon (with optional holes) */
function addPlateShape(poly, y, mat, holes){
  const s = polyShape(poly);
  if(holes) for(const h of holes){
    const hh = new THREE.Path();
    hh.moveTo(h[0][0], -h[0][1]);
    for(let i=h.length-1;i>0;i--) hh.lineTo(h[i][0], -h[i][1]);
    hh.closePath();
    s.holes.push(hh);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth:0.14, bevelEnabled:false });
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/* slab: extrude a floor polygon upward from yBottom with thickness th */
function addSlab(poly, yBottom, th, mat, holes){
  const s = polyShape(poly);
  if(holes) for(const h of holes){
    const hh = new THREE.Path();
    hh.moveTo(h[0][0], -h[0][1]);
    for(let i=h.length-1;i>0;i--) hh.lineTo(h[i][0], -h[i][1]);   // opposite winding
    hh.closePath();
    s.holes.push(hh);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled:false });
  const m = new THREE.Mesh(g, mat);
  m.position.y = yBottom;
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m);
  return m;
}

/* riveted metal deck plate texture */
function makePlateTexture(){
  if(TX.plate) return TX.plate;
  TX.plate = canvasTex(256,256,(g,w,h)=>{
    g.fillStyle='#5f4d39'; g.fillRect(0,0,w,h);
    noiseFill(g,w,h,255,()=> (72+Math.random()*60)|0);
    const pl=64;
    g.strokeStyle='rgba(26,20,14,0.85)'; g.lineWidth=3;
    for(let x=0;x<=w;x+=pl){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
    for(let y=0;y<=h;y+=pl){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
    // rivets at plate corners
    g.fillStyle='rgba(200,170,120,0.5)';
    for(let x=8;x<w;x+=pl) for(let y=8;y<h;y+=pl){ g.beginPath(); g.arc(x,y,2,0,7); g.fill(); }
    for(let i=0;i<2600;i++){ g.fillStyle='rgba(0,0,0,'+(0.03+Math.random()*0.07)+')'; g.fillRect(Math.random()*w,Math.random()*h,3,2); }
  },{repeat:[1,1]});
  return TX.plate;
}

/* railing along a polygon: instanced posts + top & mid rails (rail bucket) */
function addDeckRailings(poly, yBase, yTop, spacing){
  const pts = poly.map(p=>[p[0], p[1]]);
  const segs=[];
  for(let i=0;i<pts.length;i++){
    const a=pts[i], b=pts[(i+1)%pts.length];
    const L=Math.hypot(b[0]-a[0], b[1]-a[1]);
    const n=Math.max(1, Math.round(L/spacing));
    for(let j=0;j<n;j++){
      const t0=j/n, t1=(j+1)/n;
      segs.push({ x0:a[0]+(b[0]-a[0])*t0, z0:a[1]+(b[1]-a[1])*t0,
                  x1:a[0]+(b[0]-a[0])*t1, z1:a[1]+(b[1]-a[1])*t1 });
    }
  }
  const railY=[yTop+0.28, yTop+0.85];
  for(const ry of railY){
    for(const s of segs){
      FB.add('rail', s.x0, yBase+ry, s.z0, s.x1, yBase+ry, s.z1);
    }
  }
  // posts
  const postPts=[];
  for(const s of segs) postPts.push([ (s.x0+s.x1)/2, (s.z0+s.z1)/2 ]);
  for(const p of postPts){
    FB.add('rail', p[0], yBase+yTop, p[1], p[0], yBase+yTop+1.02, p[1]);
  }
}

/* ---------------- gold engraved name frieze ---------------- */
const NAMES_72 = [
  'Ampère','Arago','Balard','Becquerel','Bélanger','Bichat','Borda','Brémontier','Bresse','Broca',
  'Cauchy','Chaptal','Chasles','Combes','Coriolis','Coulomb','Cuvier','Daguerre','David','de Dion',
  'de Fermat','Delambre','Delaunay','Dulong','Duméry','Fourier','Fresnel','Foucault','Fizeau','Fraunhofer',
  'Gay-Lussac','Giffard','Gouin','Haüy','Jamin','Jousselin','Lagrange','Lalande','Lamarck','Laplace',
  'Lavoisier','Le Chatelier','Le Verrier','Lévêque','Lorentz','Lucas','Malus','Marcelin Berthelot','Monge','Morin',
  'Père','Perronet','Petiet','Plateau','Poinsot','Poisson'
];

function makeFriezeTextures(){
  if(TX.frieze) return TX.frieze;
  const groups=[[],[],[],[]];
  NAMES_72.forEach((nm,i)=>groups[i%4].push(nm.toUpperCase()));
  const W=8192, H=512;
  TX.frieze=[];
  for(const grp of groups){
    const tex = canvasTex(W,H,(g)=>{
      // band background: bronzed steel with subtle vertical brushed gradient
      const bg=g.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#4c3d2e'); bg.addColorStop(0.5,'#5f4d39'); bg.addColorStop(1,'#453729');
      g.fillStyle=bg; g.fillRect(0,0,W,H);
      for(let i=0;i<2400;i++){ g.fillStyle='rgba(0,0,0,'+(0.03+Math.random()*0.09)+')'; g.fillRect(Math.random()*W,Math.random()*H,10,2); }
      // fine horizontal rule lines
      g.fillStyle='rgba(22,16,10,0.8)'; g.fillRect(0,10,W,6); g.fillRect(0,H-16,W,6);
      g.fillStyle='rgba(210,175,120,0.35)'; g.fillRect(0,17,W,3); g.fillRect(0,H-19,W,3);
      // gold engraving of names
      g.font = '700 190px Georgia,"Times New Roman",serif';
      g.textBaseline = 'middle';
      const gap = 150;
      let strs=[];
      let x=gap*0.8;
      g.textAlign='left';
      for(let k=0;k<grp.length;k++){
        strs.push(grp[k]);
      }
      // measure total
      const widths=strs.map(s=>g.measureText(s).width);
      const total = widths.reduce((a,b)=>a+b,0) + gap*(strs.length);
      const fit = Math.min(1, (W*0.985)/total);
      g.save();
      g.translate(W*0.5, H*0.5);
      g.scale(fit, fit);
      let curX = -total*fit/(2*fit);
      // redraw with transform; easier: draw un-transformed inside translated scale
      for(let k=0;k<strs.length;k++){
        g.font = '700 190px Georgia,"Times New Roman",serif';
        const w = widths[k];
        const cx = curX + w/2;
        // engraved shading (dark offset bottom-right, highlight top-left, gold fill)
        g.save();
        g.translate(cx, 0);
        g.shadowColor='rgba(20,12,4,0.95)'; g.shadowBlur=8; g.shadowOffsetX=6; g.shadowOffsetY=8;
        g.fillStyle='#2c2013';
        g.fillText(strs[k], -w/2, 0);
        g.restore();
        g.save();
        g.translate(cx, 0);
        g.fillStyle='rgba(255,220,150,0.16)';
        g.fillText(strs[k], -w/2, -5);
        g.restore();
        g.save();
        g.translate(cx, 0);
        g.fillStyle='#caa96b';
        g.shadowColor='rgba(0,0,0,0.7)'; g.shadowBlur=2; g.shadowOffsetX=1; g.shadowOffsetY=2;
        g.fillText(strs[k], -w/2, 0);
        g.restore();
        // diamond separator
        g.fillStyle='rgba(232,196,132,0.75)';
        const sepX = curX + w + gap/2;
        g.beginPath();
        g.moveTo(sepX-10,0); g.lineTo(sepX,10); g.lineTo(sepX+10,0); g.lineTo(sepX,-10);
        g.closePath(); g.fill();
        curX += w + gap;
      }
      g.restore();
    },{sRGB:true});
    TX.frieze.push(tex);
  }
  return TX.frieze;
}

/* attach the four frieze panels around level-1 under the deck */
function addFrieze(Hside, N, yBandBottom, yBandTop, thickness){
  const texs = makeFriezeTextures();
  const addPanel = (len, y, cx, cz, yaw, tex)=>{
    const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.72, metalness:0.4,
      emissive:0xd9b071, emissiveMap:tex, emissiveIntensity:0.0 });
    const hBand = yBandTop-yBandBottom;
    const g = new THREE.BoxGeometry(len, hBand, thickness);
    const m = new THREE.Mesh(g, mat);
    m.position.set(cx, (yBandBottom+yBandTop)/2, cz);
    m.rotation.y = yaw;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    regFx(mat, 0.0, 0.85);
    return m;
  };
  const L = 2*N;
  // four faces: z=+Hside (facing -z? north), z=-Hside, x=+Hside, x=-Hside
  // normals pointing outward: box at z=Hside+th shows its +z face outside
  addPanel(L, 0, 0,  Hside+thickness/2, 0,     texs[0]);   // north face of deck (outward +z)
  addPanel(L, 0, 0, -Hside-thickness/2, Math.PI, texs[1]);
  addPanel(L, 0,  Hside+thickness/2, 0,  Math.PI/2, texs[2]);
  addPanel(L, 0, -Hside-thickness/2, 0, -Math.PI/2, texs[3]);
}

/* under-deck girder framework (visible when looking up from ground) */
function addUnderDeckGirders(poly, y, section){
  const n=poly.length;
  for(let i=0;i<n;i++){
    const a=poly[i], b=poly[(i+1)%n];
    FB.addB('girder', [a[0],y,a[1]],[b[0],y,b[1]]);
  }
  // diagonal cross braces near corners
  for(let i=0;i<n;i+=1){
    const a=poly[i], c=poly[(i+4)%n];
    FB.addB('diag', [a[0],y,a[1]],[c[0],y-0.6,c[1]]);
  }
}

/* ============ build all three decks & level details ============ */
function buildDecks(){
  const plateMat = stdMat({ map: planeTex(makePlateTexture(), 18, 18),
    color:0x8a7355, roughness:0.55, metalness:0.5 });
  const slabMat  = stdMat({ color:0x5b4936, roughness:0.75, metalness:0.35 });
  const paintMat = stdMat({ color:0x6b5540, roughness:0.6, metalness:0.45 });

  /* ---------- LEVEL 1 : y 57 ---------- */
  {
    const N1 = legInR(Y_P1), H1 = envR(Y_P1) - 0.35;
    const bottom=55.9, top=bottom+1.25;
    const poly=crossPoly(H1, N1);
    // glass floor cut-out along the western arm
    const hole = [[ 27.5,-2.6],[ 34.5,-2.6],[ 34.5, 2.6],[ 27.5, 2.6]];
    addSlab(poly, bottom, top-bottom, slabMat, [hole]);
    // riveted deck surface slightly above
    addPlateShape(poly, top+0.02, plateMat, [hole]);
    // glass panes + frame in the cut-out
    {
      const glass = stdMat({ color:0x9fd0da, transparent:true, opacity:0.30,
        roughness:0.05, metalness:0.1, side:THREE.DoubleSide });
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(7,5.2), glass);
      pane.rotation.x=-Math.PI/2; pane.position.set(31, top+0.02, 0);
      scene.add(pane);
      const frameMat=stdMat({ color:0x4a3b2f, metalness:0.6, roughness:0.5 });
      for(let i=0;i<3;i++){
        const f1=new THREE.Mesh(new THREE.BoxGeometry(7,0.12,0.12), frameMat);
        f1.position.set(31,top+0.05,-2.6+ i*2.6 +1.3); f1.rotation.x=0; scene.add(f1);
      }
      for(const z of [-2.6,2.6]){
        const f2=new THREE.Mesh(new THREE.BoxGeometry(7,0.12,0.12), frameMat);
        f2.position.set(31,top+0.05,z); scene.add(f2);
      }
    }
    addDeckRailings(poly, top, 1.05, 2.8);
    addUnderDeckGirders(poly, bottom-0.7, 1);
    // name frieze band under the balcony between the legs
    addFrieze(H1, N1, 54.35, 55.75, 0.5);

    // restaurant / gallery volumes on the deck arms
    const volMat = stdMat({ color:0x2e3c40, roughness:0.25, metalness:0.3,
      transparent:true, opacity:0.94, emissive:0xffcf9a, emissiveIntensity:0.08 });
    const roofMat = stdMat({ color:0x8a8f93, roughness:0.6 });
    const addVolume=(cx,cz,w,d,h,yaw)=>{
      const body=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), volMat);
      body.position.set(cx, top+h/2, cz);
      body.rotation.y = yaw||0; body.castShadow=true; scene.add(body);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w+0.8,0.45,d+0.8), roofMat);
      roof.position.set(cx, top+h+0.22, cz); roof.rotation.y=yaw||0; roof.castShadow=true; scene.add(roof);
      return body;
    };
    addVolume( 0, N1+9, 22, 9, 4.4);            // south arm restaurant
    addVolume( -10, -N1-9, 13, 8, 4.2, 0);      // north-west ticket hall volume
    // elevator machinery houses beside two legs
    const machMat=stdMat({ color:0x4c463f, roughness:0.55, metalness:0.6 });
    const addMach=(x,z,s)=>{
      const m=new THREE.Mesh(new THREE.BoxGeometry(s,s,3.2), machMat);
      m.position.set(x, top+1.6, z); m.castShadow=true; scene.add(m);
    };
    addMach(N1+2, N1+2, 4.2); addMach(-N1-2, -N1-2, 4.2);
    regFx(volMat, 0.06, 0.85);
  }

  /* ---------- LEVEL 2 : y 115 ---------- */
  {
    const N2 = legInR(Y_P2), H2 = envR(Y_P2) - 0.3;
    const bottom=113.7, top=bottom+1.25;
    const poly=crossPoly(H2, N2);
    addSlab(poly, bottom, top-bottom, slabMat, null);
    addPlateShape(poly, top+0.02,
      stdMat({ map: planeTex(makePlateTexture(), 12, 12), color:0x7d6850, roughness:0.55, metalness:0.5 }), null);
    addDeckRailings(poly, top, 1.1, 2.6);
    addUnderDeckGirders(poly, bottom-0.7, 1);
    // Jules Verne restaurant volume (south-east corner of the deck)
    const jvMat = stdMat({ color:0x1f2a30, roughness:0.2, metalness:0.35,
      transparent:true, opacity:0.96, emissive:0xffd9a0, emissiveIntensity:0.05 });
    const jv=new THREE.Mesh(new THREE.BoxGeometry(14,4.6,9), jvMat);
    jv.position.set(12, top+2.3, -13); jv.castShadow=true; scene.add(jv);
    const jr=new THREE.Mesh(new THREE.BoxGeometry(14.8,0.4,9.8), stdMat({color:0x757a7e,roughness:0.6}));
    jr.position.set(12, top+4.8, -13); scene.add(jr);
    regFx(jvMat, 0.05, 0.9);
    // corner pylon bases (stairs & lift landings) at the four legs
    const pylMat=stdMat({ color:0x5d4a36, roughness:0.6, metalness:0.45 });
    for(const sx of [-1,1]) for(const sz of [-1,1]){
      const px=sx*(N2+2.4), pz=sz*(N2+2.4);
      const p=new THREE.Mesh(new THREE.BoxGeometry(4.6,4.4,4.6), pylMat);
      p.position.set(px, top+2.2, pz); p.castShadow=true; scene.add(p);
    }
    // 4 corner pylons above level 2 are the legs themselves (continuing up)
  }

  /* ---------- LEVEL 3 (top) : y 276.1 ---------- */
  {
    const R3 = shaftHalf(Y_P3);          // 6.5 m shaft half side
    const outer = R3 + 6.4;              // deck octagon circumradius
    const holeR = R3 + 0.55;
    const poly = octPoly(outer);
    const holePts = octPoly(holeR);
    const bottom=274.6, top=bottom+1.35;
    const slabMat3 = stdMat({ color:0x52412f, roughness:0.6, metalness:0.4 });
    addSlab(poly, bottom, top-bottom, slabMat3, [holePts]);
    addSlab(poly, top+0.02, 0.14,
      stdMat({ map: planeTex(makePlateTexture(), 8, 8), color:0x7d6850, roughness:0.5, metalness:0.5 }), [holePts]);
    addDeckRailings(poly, top, 1.1, 2.2);
    addUnderDeckGirders(poly, bottom-0.5, 1);
    // enclosed gallery cabin (the “lab” volume) on the deck
    const cabMat = stdMat({ color:0x35424a, roughness:0.3, metalness:0.3,
      emissive:0xffd9a0, emissiveIntensity:0.05 });
    const cab=new THREE.Mesh(new THREE.BoxGeometry(7.5,4.2,5.2), cabMat);
    cab.position.set(4.2, top+2.1, 0.5); cab.castShadow=true; scene.add(cab);
    const cr=new THREE.Mesh(new THREE.BoxGeometry(8,0.5,5.7), stdMat({color:0x999d9f,roughness:0.5}));
    cr.position.set(4.2, top+4.4, 0.5); scene.add(cr);
    // small radio cabin
    const r2=new THREE.Mesh(new THREE.BoxGeometry(3.6,3.0,3.0), cabMat);
    r2.position.set(-4.8, top+1.5, -1.2); scene.add(r2);
    regFx(cabMat, 0.05, 1.0);
    // wind-bracing truss girders on the shaft just under the deck
    const ytr = bottom - 2.5;
    const s = shaftHalf(ytr);
    const ring=[[-s,-s],[ s,-s],[ s, s],[-s, s]];
    for(let i=0;i<4;i++){
      const a=ring[i], b=ring[(i+1)%4];
      FB.addB('girder', [a[0],ytr,a[1]],[b[0],ytr,b[1]]);
    }
  }
}


/* =====================================================================
   PART 6 — decorative arches, merged upper shaft (187→300 m) with the
   196 m landing, antenna mast & radio farm, beacon, elevators inside
   the legs, and the internal staircases (toggleable).
   ===================================================================== */

/* second beam collector for toggleable interior bars (stairs etc) */
const FB2 = Object.create(FB);
FB2.buckets = {};

/* ============ A R C H E S ============ */
function buildArches(){
  /* sides: 0:+z  1:-z  2:+x  3:-x  (w = width axis of the opening) */
  const sides=[];
  sides.push({ w:1, sd:1 });   // plane normal +z, width along x
  sides.push({ w:1, sd:-1 });
  sides.push({ w:0, sd:1 });   // plane normal +x, width along z
  sides.push({ w:0, sd:-1 });
  const NS = 46;
  const YB=30.6, YT=36.5, CB=44.6, CT=52.6;
  for(const sd of sides){
    const alongX = sd.w===1;          // true: width axis = x, plane coord = z
    const xB = legInR(YB)+1.1, xT = legInR(YT)+1.1;
    const circ=(xS,yS,yC)=>{ const yc=(xS*xS+yS*yS-yC*yC)/(2*(yS-yC)); return { yc, r:yC-yc }; };
    const bR=circ(xB,YB,CB), tR=circ(xT,YT,CT);
    const pBase = legInR(YB) + (legOutR(YB)-legInR(YB))*0.40;
    const pt = (wv,yv,pv)=> alongX ? [wv,yv,sd.sd*pv] : [sd.sd*pv,yv,wv];
    for(const off of [-1.8, 1.8]){
      const pv = pBase+off;
      const sample=(R0, xS)=>{
        const pts=[];
        const s0=Math.asin(xS/R0.r);
        for(let k=0;k<=NS;k++){
          const psi = -s0 + 2*s0*(k/NS);
          pts.push([ R0.r*Math.sin(psi), R0.yc + R0.r*Math.cos(psi) ]);
        }
        return pts;
      };
      const bot=sample(bR,xB), top=sample(tR,xT);
      for(let k=0;k<NS;k++){
        const pb0=bot[k], pb1=bot[k+1], pt0=top[k], pt1=top[k+1];
        // short chord segments along the two circular arcs
        FB.addB('belt', pt(pb0[0],pb0[1],pv), pt(pb1[0],pb1[1],pv));
        FB.addB('belt', pt(pt0[0],pt0[1],pv), pt(pt1[0],pt1[1],pv));
        // radial web between the arcs
        FB.addB('diag', pt(pb0[0],pb0[1],pv), pt(pt0[0],pt0[1],pv));
        FB.addB('sub',  pt(pb0[0],pb0[1],pv), pt(pt1[0],pt1[1],pv));
        FB.addB('sub',  pt(pb1[0],pb1[1],pv), pt(pt0[0],pt0[1],pv));
      }
    }
    // transverse ties linking the inner & outer arch planes
    const pI=pBase-1.8, pO=pBase+1.8;
    {
      const s0=Math.asin(xB/bR.r);
      for(let k=0;k<=NS;k+=3){
        const psi=-s0+2*s0*(k/NS);
        const wv=bR.r*Math.sin(psi), yv=bR.yc+bR.r*Math.cos(psi);
        FB.addB('sub', pt(wv,yv,pI), pt(wv,yv,pO));
      }
    }
    // spring connectors tying each arch end down along the leg inner corner
    for(const sg of [-1,1]){
      for(const [ys,yc] of [[YB,YB-3.6],[YT,YT-3.6]]){
        FB.addB('diag',
          pt(sg*legInR(ys), ys, pBase+sg*1.8),
          pt(sg*legInR(yc), yc, pBase+sg*1.8));
      }
    }
  }
}

/* ============ M E R G E D  S H A F T  (187.4 → 299.7 m) ============ */
function buildShaft(){
  const y0=LEG_Y1, y1=SHAFT_Y1;
  const ringSp = y => lerp(2.7,1.85,(y-y0)/(y1-y0))/params.density;
  const cellW  = y => lerp(4.6,2.7,(y-y0)/(y1-y0))/Math.sqrt(params.density);
  const cc = (y,k)=>{ const s=shaftHalf(y);
    if(k===0) return [-s,-s]; if(k===1) return [ s,-s]; if(k===2) return [ s, s]; return [-s, s]; };

  const ys=[y0]; let y=y0;
  while(y<y1-0.01){ y=Math.min(y1, y+ringSp(y)); ys.push(y); }
  if(ys[ys.length-1] < y1-0.01) ys.push(y1);

  for(let i=0;i<ys.length-1;i++){
    const ya=ys[i], yb=ys[i+1], ym=(ya+yb)/2;
    const nW=clamp(Math.round((2*shaftHalf(ym))/cellW(ym)),2,10);
    for(let k=0;k<4;k++){
      const a=cc(ya,k), b=cc(yb,k);
      FB.addB('chord',[a[0],ya,a[1]],[b[0],yb,b[1]]);
    }
    const faces=[[0,1],[1,2],[2,3],[3,0]];
    for(const f of faces){
      const A0=cc(ya,f[0]), B0=cc(ya,f[1]), A1=cc(yb,f[0]), B1=cc(yb,f[1]);
      for(let c=0;c<nW;c++){
        const t0=c/nW, t1=(c+1)/nW;
        const ax0=A0[0]+(B0[0]-A0[0])*t0, az0=A0[1]+(B0[1]-A0[1])*t0;
        const ax1=A0[0]+(B0[0]-A0[0])*t1, az1=A0[1]+(B0[1]-A0[1])*t1;
        const bx0=A1[0]+(B1[0]-A1[0])*t0, bz0=A1[1]+(B1[1]-A1[1])*t0;
        const bx1=A1[0]+(B1[0]-A1[0])*t1, bz1=A1[1]+(B1[1]-A1[1])*t1;
        FB.add('diag', ax0,ya,az0, bx1,yb,bz1);
        FB.add('diag', ax1,ya,az1, bx0,yb,bz0);
        FB.add('belt', ax0,ya,az0, ax1,ya,az1);
        // extra counter-diagonals: denser classic criss-cross
        FB.add('sub', ax0,ya,az0, (ax0+ax1)/2, (ya+yb)/2, (az0+az1)/2);
        FB.add('sub', ax1,ya,az1, (ax0+ax1)/2, (ya+yb)/2, (az0+az1)/2);
      }
    }
  }
  // closing ring at the very top
  const sT=shaftHalf(y1), nWT=clamp(Math.round(2*sT/cellW(y1)),2,8);
  const ringT=[[-sT,-sT],[sT,-sT],[sT,sT],[-sT,sT]];
  for(let f=0;f<4;f++){
    const A=ringT[f], B=ringT[(f+1)%4];
    for(let c=0;c<nWT;c++){
      const t0=c/nWT, t1=(c+1)/nWT;
      FB.add('belt', A[0]+(B[0]-A[0])*t0, y1, A[1]+(B[1]-A[1])*t0,
                     A[0]+(B[0]-A[0])*t1, y1, A[1]+(B[1]-A[1])*t1);
    }
  }
  /* intermediate landing platform at 196 m (the spiral stair starts here) */
  {
    const ly=196.0;
    const plate=new THREE.Mesh(new THREE.CircleGeometry(3.5, 26),
      stdMat({ map: planeTex(makePlateTexture(), 6, 6), color:0x7d6850, roughness:0.5, metalness:0.5 }));
    plate.rotation.x=-Math.PI/2; plate.position.y=ly; (app.interiorGrp||scene).add(plate);
    for(let k=0;k<4;k++){
      const a=k*Math.PI/2+Math.PI/4;
      FB.addB('girder', [Math.cos(a)*3.0,ly-0.06,Math.sin(a)*3.0], [Math.cos(a)*0.5,ly-0.06,Math.sin(a)*0.5]);
    }
  }
}

/* ============ M A S T  (299.7 → 330) & radio farm ============ */
function buildMastAndAntennas(){
  const y0=MAST_Y0, y1=330.0;
  const blend = y => lerp(shaftHalf(y0), mastHalf(y), clamp((y-y0)/2.2,0,1));
  const corner=(h,k)=> (k===0?[-h,-h]:k===1?[h,-h]:k===2?[h,h]:[-h,h]);
  const ys=[y0]; let y=y0;
  while(y<y1-0.01){ y=Math.min(y1, y+1.85); ys.push(y); }
  if(ys[ys.length-1]<y1-0.01) ys.push(y1);
  for(let i=0;i<ys.length-1;i++){
    const ya=ys[i], yb=ys[i+1];
    const ha=blend(ya), hb=blend(yb);
    for(let k=0;k<4;k++){
      const a=corner(ha,k), b=corner(hb,k);
      FB.add('chord', a[0],ya,a[1], b[0],yb,b[1]);
    }
    const A=corner(ha,0),B=corner(ha,1),C=corner(ha,2),D=corner(ha,3);
    const A2=corner(hb,0),B2=corner(hb,1),C2=corner(hb,2),D2=corner(hb,3);
    const X=(a,b,c,d)=>{ FB.add('diag',a[0],ya,a[1],b[0],yb,b[1]); FB.add('diag',c[0],ya,c[1],d[0],yb,d[1]); };
    X(A,B2,B,A2); X(B,C2,C,B2); X(C,D2,D,C2); X(D,A2,A,D2);
    FB.add('belt', A[0],ya,A[1], B[0],ya,B[1]);
    FB.add('belt', B[0],ya,B[1], C[0],ya,C[1]);
    FB.add('belt', C[0],ya,C[1], D[0],ya,D[1]);
    FB.add('belt', D[0],ya,D[1], A[0],ya,A[1]);
  }

  /* --- rotating beacon --- */
  const beaconGrp = new THREE.Group();
  const beaconLamp = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.6,0.8),
    stdMat({ color:0xfff6d8, emissive:0xffe9b0, emissiveIntensity:1.2 }));
  beaconLamp.position.set(0,303.6,0);
  beaconGrp.add(beaconLamp);
  const beamGeo = new THREE.CylinderGeometry(0.03, 30, 230, 14, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color:0xfff3c8, transparent:true, opacity:0,
    side:THREE.DoubleSide, blending:THREE.AdditiveBlending, depthWrite:false });
  const mkBeam=()=>{ const bm=new THREE.Mesh(beamGeo, beamMat);
    bm.position.y=303.6; beaconGrp.add(bm); return bm; };
  const bmA=mkBeam(), bmB=mkBeam();
  bmA.rotation.z = 0; bmB.rotation.z = Math.PI;
  scene.add(beaconGrp);
  regFx(beaconLamp.material, 0.5, 7.0);
  app.fx.push({ mat:beamMat, d:0, n:0.14 });
  app.beacon = { grp:beaconGrp, beams:[bmA,bmB] };
  const tipLamp = new THREE.Mesh(new THREE.SphereGeometry(0.3,10,8),
    stdMat({ color:0xff3322, emissive:0xff2211, emissiveIntensity:0.5 }));
  tipLamp.position.set(0,329.5,0); scene.add(tipLamp);
  regFx(tipLamp.material, 0.5, 2.8);

  /* --- stub antennas all around the top belfry & mast --- */
  {
    const rodGeo=new THREE.CylinderGeometry(0.02,0.03,1,5);
    const rodMat=stdMat({ color:0x3a3128, metalness:0.6, roughness:0.4 });
    const spots=[];
    for(const [r0,r1,radFn] of [[280.5,298.5,(hh)=>shaftHalf(hh)+1.0],[301,328.5,(hh)=>mastHalf(hh)+0.5]]){
      let hh=r0;
      while(hh<r1){
        hh += 2.2+rndRange(0,2.4);
        const ang=rndRange(0,Math.PI*2);
        spots.push({ x:Math.cos(ang)*radFn(hh), y:hh, z:Math.sin(ang)*radFn(hh), len:2.2+rndRange(0,3.4) });
      }
    }
    addInstanced(rodGeo, rodMat, spots.length, (im)=>{
      for(let i=0;i<spots.length;i++){
        const s=spots[i];
        _M4.makeTranslation(s.x, s.y+s.len*0.5, s.z);
        _M4.scale(_SC.set(1,s.len,1));
        im.setMatrixAt(i,_M4);
      }
    },false,false);
    // cross arms on the upper mast
    const armGeo=new THREE.BoxGeometry(1,1,1);
    const armMat=stdMat({color:0x241f19,metalness:0.6,roughness:0.5});
    const arms=[];
    for(let i=0;i<9;i++){ const yy=302.5+i*2.9; arms.push({ y:yy, r:mastHalf(yy)+0.6, ang:i*0.7+0.3, L:2.6 }); }
    addInstanced(armGeo, armMat, arms.length, (im)=>{
      for(let i=0;i<arms.length;i++){
        const a=arms[i];
        _Q.setFromAxisAngle(_UP, a.ang);
        _P.set(Math.cos(a.ang)*a.r, a.y+1.6, Math.sin(a.ang)*a.r);
        _SC.set(a.L,0.07,0.07);
        _M4.compose(_P,_Q,_SC); im.setMatrixAt(i,_M4);
      }
    },false,false);
  }
  /* microwave drums + dishes */
  {
    const drumGeo=new THREE.CylinderGeometry(0.4,0.4,1.0,12);
    const drumMat=stdMat({ color:0xd4d6d8, roughness:0.25, metalness:0.4 });
    const dl=[];
    for(let i=0;i<3;i++) dl.push({ y:310.5+i*1.6, ang:0.5+i*2.1 });
    addInstanced(drumGeo, drumMat, dl.length, (im)=>{
      const qx=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI/2);
      for(let i=0;i<dl.length;i++){
        const d=dl[i]; const r=mastHalf(d.y)+0.55;
        _Q.setFromAxisAngle(_UP,d.ang).multiply(qx);
        _P.set(Math.cos(d.ang)*r, d.y, Math.sin(d.ang)*r);
        _M4.compose(_P,_Q,_SC.set(1,1,1)); im.setMatrixAt(i,_M4);
      }
    },false,false);
    const dishGeo=new THREE.SphereGeometry(0.85,14,8,0,Math.PI*2,0,Math.PI/2);
    const dishMat=stdMat({ color:0xf2f4f5, roughness:0.18, metalness:0.3 });
    const dl2=[[-2.3,308.2,1.5],[2.6,314.8,-1.3],[1.0,319.6,2.7]];
    for(let i=0;i<dl2.length;i++){
      const d=dl2[i];
      const dish=new THREE.Mesh(dishGeo, dishMat);
      dish.position.set(d[0],d[1],d[2]);
      const ang=Math.atan2(d[2],d[0])+Math.PI;
      dish.rotation.y=ang; dish.rotation.x=-0.6;
      scene.add(dish);
    }
  }
  /* guy wires */
  {
    const pts=[];
    const anchors=[ [300.5,0.55],[306.5,0.5],[315.0,0.45] ];
    const ringC=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(const a of anchors){
      const rr=a[1];
      for(let k=0;k<4;k++){
        const y=a[0], s=shaftHalf(y)*0.92;
        const c=ringC[k];
        pts.push(c[0]*rr, y, c[1]*rr);
        pts.push(c[0]*s, y-2.5, c[1]*s);
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
    const ln=new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color:0x201a14 }));
    scene.add(ln);
  }
  /* tricolore flag just below the tip */
  {
    const grp=new THREE.Group();
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.04,3.4,6),
      stdMat({ color:0x8d8577, metalness:0.7, roughness:0.3 }));
    pole.position.y=1.7; grp.add(pole);
    const cv=document.createElement('canvas'); cv.width=180; cv.height=120;
    const g=cv.getContext('2d');
    g.fillStyle='#002395'; g.fillRect(0,0,60,120);
    g.fillStyle='#ffffff'; g.fillRect(60,0,60,120);
    g.fillStyle='#ED2939'; g.fillRect(120,0,60,120);
    const flagTex=new THREE.CanvasTexture(cv);
    flagTex.colorSpace=THREE.SRGBColorSpace;
    const flag=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.2),
      new THREE.MeshStandardMaterial({ map:flagTex, side:THREE.DoubleSide, roughness:0.8 }));
    flag.position.set(0.02,2.6,0.04);
    grp.add(flag);
    grp.position.set(0,325.4,0);
    scene.add(grp);
    app.flag=grp;
  }
}

/* ============ E L E V A T O R S inside the legs ============ */
function buildElevators(){
  for(const [sx,sz] of [[1,1],[-1,-1]]){
    const q=y=> [ sx*(legInR(y)-0.7), sz*(legInR(y)-0.7) ];
    const build=(y0,y1,step)=>{
      const ys=[y0]; let y=y0;
      while(y<y1-step){ y+=step; ys.push(y); }
      ys.push(y1);
      for(let i=0;i<ys.length-1;i++){
        const a=ys[i], b=ys[i+1];
        const pa=q(a), pb=q(b);
        for(const off of [-0.9, 0.9]){
          FB.add('rail', pa[0]-off, a, pa[1]+off, pb[0]-off, b, pb[1]+off);
        }
        if(i%4===0){
          FB.add('sub', pa[0]-0.9, a, pa[1]+0.9, pa[0]+0.9, a, pa[1]-0.9);
        }
      }
    };
    build(2.0, Y_P1+1, 5.2);
    build(Y_P1+1, Y_P2+1, 6.2);
    for(const yy of [Y_P1+2.6, Y_P2+2.6]){
      const c=q(yy);
      const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.6,14),
        stdMat({ color:0x3a342e, metalness:0.8, roughness:0.3 }));
      wheel.rotation.x=Math.PI/2;
      wheel.position.set(c[0], yy, c[1]);
      (app.interiorGrp||scene).add(wheel);
    }
  }
  // elevator cars at mid heights of the runs
  const carMat=stdMat({ color:0xa8c0c4, metalness:0.2, roughness:0.15, transparent:true, opacity:0.9 });
  const carAt=(sx,sz,y)=>{
    const c=[ sx*(legInR(y)-0.7), sz*(legInR(y)-0.7) ];
    const car=new THREE.Mesh(new THREE.BoxGeometry(1.6,2.8,1.4), carMat);
    car.position.set(c[0], y+1.4, c[1]);
    (app.interiorGrp||scene).add(car);
  };
  carAt(1,1,36); carAt(-1,-1,40);
  carAt(1,1,84); carAt(-1,-1,90);
}

/* ============ I N T E R N A L  S T A I R S  (toggleable) ============ */
function buildStairs(){
  const grp=new THREE.Group();
  const stepGeo=new THREE.BoxGeometry(1,1,1);
  const stepMat=stdMat({ color:0x5d4934, roughness:0.8, metalness:0.3 });
  const treads=[];                    // {x,y,z,yaw,len,w}
  const railPts=[];
  const addSpiral=(cy0, cy1, r, rise, ang0, cx0, cz0, angFn)=>{
    // centre moves with height for the leg stairs (curved axis), fixed for shaft
    const n=Math.max(2, Math.round((cy1-cy0)/rise));
    const dA=Math.PI*2/ (rise>0.5? 8 : 8);      // steps per revolution ≈ 8
    let ang=ang0;
    let last=null;
    for(let i=0;i<=n;i++){
      const t=i/n, y=cy0+(cy1-cy0)*t;
      const a=angFn? angFn(ang) : ang;
      ang += 0.66; // rad per step
      const cx = angFn? cx0 : cx0;
      const cz = angFn? cz0 : cz0;
      const px=cx + Math.cos(a)*r, pz=cz + Math.sin(a)*r;
      treads.push({ x:px, y:y, z:pz, a, len:r*1.05, w:0.34 });
      if(last){
        // handrail bars (previous step point, +rail height)
        railPts.push([last[0], last[1]+0.85, last[2], px, y+0.85, pz]);
      }
      last=[px,y,pz];
    }
  };
  // main spiral inside the merged shaft 196.5 → 274.5
  addSpiral(196.5, 274.0, 2.1, 0.42, 0, 0, 0, null);
  // second spiral inside the north-east leg 5.5 → 56.5 (leg axis curves)
  const legAxis = y => { const d = (legInR(y)+legOutR(y))/2; return d; };
  {
    let ang=1.2;
    const n=Math.round((56.5-5.5)/0.45);
    let last=null;
    for(let i=0;i<=n;i++){
      const y=5.5+(56.5-5.5)*i/n;
      const d=legAxis(y);
      ang += 0.64;
      const r=2.7;
      const px2=d+Math.cos(ang)*r, pz2=d+Math.sin(ang)*r;
      treads.push({ x:px2, y, z:pz2, a:ang, len:r*1.1, w:0.34 });
      if(last){ railPts.push([last[0],last[1]+0.9,last[2], px2, y+0.9, pz2]); }
      last=[px2,y,pz2];
    }
  }
  // bake treads (real box geometry allows flat orientation)
  {
    const im=new THREE.InstancedMesh(stepGeo, stepMat, treads.length);
    im.castShadow=false; im.receiveShadow=false; im.frustumCulled=false;
    const X=new THREE.Vector3(1,0,0);
    const tan=new THREE.Vector3(), q=new THREE.Quaternion(), p=new THREE.Vector3();
    for(let i=0;i<treads.length;i++){
      const s=treads[i];
      tan.set(-Math.sin(s.a),0,Math.cos(s.a));
      q.setFromUnitVectors(X,tan);
      p.set(s.x,s.y,s.z);
      _M4.compose(p,q,_SC.set(s.w,0.3,s.len));
      im.setMatrixAt(i,_M4);
    }
    im.instanceMatrix.needsUpdate=true;
    grp.add(im);
  }
  // bake handrails & centre column into FB2 (bars collector)
  for(const rp of railPts){
    FB2.add('rail', rp[0],rp[1],rp[2], rp[3],rp[4],rp[5]);
  }
  const center=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,78,6),
    stdMat({ color:0x4a3b2f, roughness:0.7, metalness:0.5 }));
  center.position.set(0,196+39,0);
  grp.add(center);
  scene.add(grp);
  app.stairsGroup=grp;
}

/* =====================================================================
   PART 7 — night lighting: warm floodlights, the 20,000-light sparkle
   (per-instance phase blink), day/night animation of every emissive.
   ===================================================================== */

/* ---------- floodlight spots (only meaningful at night) ---------- */
function buildFloods(){
  const mk=(x,y,z,tx,ty,tz,ang)=>{
    const s=new THREE.SpotLight(0xffc894, 0, 900, ang, 0.65, 1.2);
    s.position.set(x,y,z);
    s.target.position.set(tx,ty,tz);
    scene.add(s); scene.add(s.target);
    nightLights.push({ light:s, day:0, night:5200 });
    return s;
  };
  // esplanade washes raking the tower from the four corners
  mk(  95, 6,  95, 0, 45, 0, 0.85);
  mk( -95, 6,  95, 0, 45, 0, 0.85);
  mk(  95, 6, -95, 0, 45, 0, 0.85);
  mk( -95, 6, -95, 0, 45, 0, 0.85);
  // upper belfry floods from the 2nd platform corners
  mk( 26, 117,  26, 0, 215, 0, 0.6);
  mk(-26, 117,  26, 0, 215, 0, 0.6);
  mk( 26, 117, -26, 0, 215, 0, 0.6);
  mk(-26, 117, -26, 0, 215, 0, 0.6);
}

/* ---------- sparkle points (20000 “lights”) ---------- */
function buildSparkles(){
  const N = Math.max(0, Math.min(24000, Math.round(params.sparks)));
  const pos=new Float32Array(N*3);
  const ph =new Float32Array(N);
  const rndA=new Float32Array(N);
  const siz=new Float32Array(N);

  const cornersOf = (y)=>{
    // cross-section corners of the tower at height y
    if(y < LEG_Y1){
      const R0=legOutR(y), inR=legInR(y);
      const cs=[]; // [ [x,z]... ] for quadrant corner (we later mirror)
      cs.push([ inR, inR ],[ R0, inR ],[ R0, R0 ],[ inR, R0 ]);
      return cs;
    }
    if(y < SHAFT_Y1){ const s=shaftHalf(y); return [[-s,-s],[s,-s],[s,s],[-s,s]]; }
    const s=mastHalf(y); return [[-s,-s],[s,-s],[s,s],[-s,s]];
  };
  const sample=(out)=>{
    const r=Math.random();
    let y, c4;
    if(r<0.795){ y=lerp(4.2, LEG_Y1-0.5, Math.random()); }
    else if(r<0.935){ y=lerp(LEG_Y1, SHAFT_Y1-0.5, Math.random()); }
    else if(r<0.97){ y=lerp(SHAFT_Y1, 329.5, Math.random()); }
    else {
      // platform rim sparkles
      const rim = Math.random();
      if(rim<0.4){ y=57.4; }
      else if(rim<0.75){ y=115.4; }
      else { y=276.6; }
    }
    if(y<LEG_Y1){
      const sx=Math.random()<0.5?1:-1, sz=Math.random()<0.5?1:-1;
      const i=legInR(y), o=legOutR(y);
      // four corners of the (+,+) box mirrored into this quadrant
      const c=[[i,i],[o,i],[o,o],[i,o]];
      const ck=Math.floor(Math.random()*4), ck2=(ck+1)%4;
      const t=Math.random();
      const wx = sx*(c[ck][0]+(c[ck2][0]-c[ck][0])*t);
      const wz = sz*(c[ck][1]+(c[ck2][1]-c[ck][1])*t);
      out.push(wx,y,wz);
    } else if(y<SHAFT_Y1){
      const s=shaftHalf(y);
      const c=[[-s,-s],[s,-s],[s,s],[-s,s]];
      const ck=Math.floor(Math.random()*4), ck2=(ck+1)%4;
      const t=Math.random();
      out.push(c[ck][0]+(c[ck2][0]-c[ck][0])*t, y, c[ck][1]+(c[ck2][1]-c[ck][1])*t);
    } else {
      const s=mastHalf(y);
      const c=[[-s,-s],[s,-s],[s,s],[-s,s]];
      const ck=Math.floor(Math.random()*4), ck2=(ck+1)%4;
      const t=Math.random();
      out.push(c[ck][0]+(c[ck2][0]-c[ck][0])*t, y, c[ck][1]+(c[ck2][1]-c[ck][1])*t);
    }
  };
  const arr=[];
  for(let i=0;i<N;i++){
    sample(arr);
    pos[i*3]=arr[i*3]; pos[i*3+1]=arr[i*3+1]; pos[i*3+2]=arr[i*3+2];
    ph[i]=Math.random();
    rndA[i]=Math.random();
    siz[i]=0.5+Math.random()*1.4;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(ph,1));
  geo.setAttribute('aRand',  new THREE.BufferAttribute(rndA,1));
  geo.setAttribute('aSize',  new THREE.BufferAttribute(siz,1));
  const uni={
    uTime:{value:0},
    uA:{value:0},
    uPx:{value:800},
    uGold:{value:new THREE.Color(0xffcf7a)},
    uWhite:{value:new THREE.Color(0xf4f7ff)}
  };
  const mat=new THREE.ShaderMaterial({
    uniforms:uni,
    transparent:true,
    depthWrite:false,
    blending:THREE.AdditiveBlending,
    vertexShader:/*glsl*/`
      attribute float aPhase; attribute float aRand; attribute float aSize;
      uniform float uTime; uniform float uPx;
      varying float vBlink; varying float vTint;
      void main(){
        vec4 mv = modelViewMatrix*vec4(position,1.0);
        float ph = fract(aPhase + uTime*0.055*(0.5+aRand));
        float bl = 0.5+0.5*sin(ph*18.0);
        float steady = step(0.72,aRand);
        float tw  = 0.5+0.5*sin(ph*60.0+10.0*aRand);
        vBlink = mix(bl, 0.55+0.45*tw, steady);
        vTint = aRand;
        gl_PointSize = aSize * uPx / max(1.0,-mv.z);
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader:/*glsl*/`
      uniform float uA;
      uniform vec3 uGold; uniform vec3 uWhite;
      varying float vBlink; varying float vTint;
      void main(){
        vec2 c=gl_PointCoord-0.5;
        float d=length(c);
        float a=smoothstep(0.5,0.18,d);
        vec3 col = mix(uGold, uWhite, step(0.42,vTint));
        float core = smoothstep(0.30,0.04,d);
        col *= 0.55+1.45*core;
        float alpha = a*0.92*uA*vBlink;
        if(alpha<0.003) discard;
        gl_FragColor = vec4(col*alpha, alpha);
      }`
  });
  const pts=new THREE.Points(geo,mat);
  pts.frustumCulled=false;
  scene.add(pts);
  app.sparkle={ mesh:pts, mat, uni };
}

/* ============ per-frame night factor driver ============ */
function setDynamicLights(night){
  // emissive controllers (materials)
  for(const fx of app.fx){
    const m=fx.mat;
    if(!m) continue;
    if(m.isPointsMaterial){
      m.opacity = (fx.d+(fx.n-fx.d)*night);
      if(m.opacity<0.004 && m.opacity!==0) m.opacity=0;
    } else if('emissiveIntensity' in m){
      m.emissiveIntensity = fx.d+(fx.n-fx.d)*night;
    } else if(m.isMeshBasicMaterial){
      m.opacity = fx.d+(fx.n-fx.d)*night;
    }
  }
  // albedo dimmers: darken city masses at night (emissive windows stay bright)
  for(const alb of app.fxAlb){
    const m=alb.mat;
    if(m && m.color) m.color.copy(alb.d).lerp(alb.n, night);
  }
  // main sun / ambient / hemi
  if(app.sun) app.sun.intensity = 3.7*(1-night);
  if(app.hemi) app.hemi.intensity = 0.62*Math.max(0.08, 1-night*0.9);
  if(app.ambient) app.ambient.intensity = 0.10 + 0.10*night;
  if(scene.environment) scene.environmentIntensity = 0.85*(1-night*0.55);
  // flood spots
  for(const f of nightLights){
    f.light.intensity = f.day+(f.night-f.day)*night;
  }
  // sky & fog colours
  if(skyMesh){
    skyMesh.material.uniforms.uNight.value = night;
    if(app.stars) app.stars.mat.opacity = night*(REDUCED?0.6:0.9);
  }
  if(scene.fog){
    scene.fog.color.setHex(0xc8d4de).lerp(new THREE.Color(0x0a0f1c), night);
  }
  // sparkles
  if(app.sparkle){
    const on = night>0.02 && app.dynamic.sparkleOn;
    app.sparkle.mesh.visible = on;
    app.sparkle.uni.uA.value = on ? night : 0;
    app.sparkle.uni.uTime.value = app.time||0;
  }
  if(app.beacon){
    app.beacon.grp.visible = night>0.02;
  }
}


/* =====================================================================
   PART 8 — instancing bake, post pipeline, animation loop, UI wiring,
   camera presets + intro, boot orchestration with live progress and the
   EIFFEL-OK self test.
   ===================================================================== */
let usePost = false, vigPass = null;
let frames = 0, introActive = false, introT = 0, stateDone = false;
let tStart = 0;

/* ---------- bake every beam bucket into InstancedMesh ---------- */
function finalizeInstancing(){
  const iron = { rough:0.48, metal:0.62 };
  const meshes = FB.finalize(iron.rough, iron.metal);
  for(const m of meshes){
    scene.add(m);
    if(structureMats.indexOf(m.material) < 0) structureMats.push(m.material);
  }
  for(const mat of structureMats){
    mat.roughnessMap = TX.streak;
    mat.metalness = iron.metal;
    mat.needsUpdate = true;
  }
  // stairs collector → toggleable group
  if(FB2 && Object.keys(FB2.buckets).length){
    const m2 = FB2.finalize(iron.rough, iron.metal);
    const grp = app.stairsGroup;
    for(const m of m2){ (grp||scene).add(m); }
  }
}

/* ---------- UI wiring ---------- */
function btn(sel){ return $(sel); }
function setBtn(id, on){ const b=$(id); if(b) b.classList.toggle('on', !!on); }

function bindUI(){
  const dyn = app.dynamic;
  const toggles = [
    ['#bRot','autoRotate',(v)=>{ dyn.autoRotate=v; }],
    ['#bWire','wire',(v)=>{ dyn.wire=v; applyLooks(); }],
    ['#bXray','xray',(v)=>{ dyn.xray=v; applyLooks(); }],
    ['#bStairs','stairs',(v)=>{ if(app.stairsGroup) app.stairsGroup.visible=v; }],
    ['#bInt','interior',(v)=>{ if(app.interiorGrp) app.interiorGrp.visible=v; }],
    ['#bSpark','sparkle',(v)=>{ dyn.sparkleOn=v; }]
  ];
  for(const t of toggles){
    const el=$(t[0]);
    if(!el) continue;
    const key=t[1];
    dyn[key] = (key==='autoRotate')?false:true;
    el.addEventListener('click',()=>{
      dyn[key] = !dyn[key];
      setBtn(t[0], dyn[key]);
      t[2](dyn[key]);
    });
  }
  btn('#bDay').addEventListener('click',()=>{
    dyn.nightTarget = dyn.nightTarget<0.5 ? 1 : 0;
    btn('#bDay', dyn.nightTarget>0.5);
    if(dyn.nightTarget>0.5) dyn.sparkleOn=true;
  });
  btn('#bReset').addEventListener('click',()=> applyPreset('hero', true));
  document.querySelectorAll('#presetRow .btnP').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('#presetRow .btnP').forEach(x=>x.classList.remove('act'));
      b.classList.add('act');
      if(b.dataset.p==='flyby') startIntro();
      else applyPreset(b.dataset.p, true);
    });
  });
  $('#hudTitle').addEventListener('click',()=>{
    $('#hud').classList.toggle('collapsed');
    $('#hudChevron').textContent = $('#hud').classList.contains('collapsed') ? '▸':'▾';
  });
  window.addEventListener('keydown',(e)=>{
    const k=(e.key||'').toLowerCase();
    if(k==='a'){ dyn.autoRotate=!dyn.autoRotate; setBtn('#bRot',dyn.autoRotate); }
    else if(k==='n'){ dyn.nightTarget = dyn.nightTarget<0.5?1:0; setBtn('#bDay',dyn.nightTarget>0.5); }
    else if(k==='w'){ dyn.wire=!dyn.wire; setBtn('#bWire',dyn.wire); applyLooks(); }
    else if(k==='x'){ dyn.xray=!dyn.xray; setBtn('#bXray',dyn.xray); applyLooks(); }
    else if(k==='s'){ dyn.stairs=!dyn.stairs; if(app.stairsGroup)app.stairsGroup.visible=dyn.stairs; setBtn('#bStairs',dyn.stairs); }
    else if(k==='i'){ dyn.interior=!dyn.interior; if(app.interiorGrp)app.interiorGrp.visible=dyn.interior; setBtn('#bInt',dyn.interior); }
    else if(k==='l'){ dyn.sparkleOn=!dyn.sparkleOn; setBtn('#bSpark',dyn.sparkleOn); }
    else if(k==='r'){ applyPreset('hero',true); }
    else if(k==='f'){ startIntro(); }
    else if(k==='1'||k==='2'||k==='3'||k==='4'||k==='5'||k==='6'){
      const names=['hero','ground','base','lvl1','lvl2','top'];
      applyPreset(names[+k-1], true);
    }
    else if(k==='h'){
      $('#hud').classList.toggle('collapsed');
      $('#hudChevron').textContent=$('#hud').classList.contains('collapsed')?'▸':'▾';
    }
  });
}

/* x-ray / wireframe look driver */
function applyLooks(){
  const dyn=app.dynamic;
  for(const m of structureMats){
    m.wireframe = !!dyn.wire;
    if(dyn.xray){
      m.transparent=true; m.opacity=0.3; m.depthWrite=false;
    } else {
      m.transparent=false; m.opacity=1; m.depthWrite=true;
    }
    m.needsUpdate=true;
  }
}

/* ---------- camera presets & flyby ---------- */
const VIEWS={
  hero:   { pos:[285,195,530], tgt:[0,160,0] },
  ground: { pos:[0,2.4,188],   tgt:[0,168,0] },
  base:   { pos:[0,1.8,96],    tgt:[0,190,0] },
  lvl1:   { pos:[0,62,148],    tgt:[0,150,0] },
  lvl2:   { pos:[0,120,124],   tgt:[0,225,0] },
  top:    { pos:[118,330,170], tgt:[0,258,0] }
};
function applyPreset(name, tween){
  const v=VIEWS[name]||VIEWS.hero;
  const P=new THREE.Vector3(v.pos[0],v.pos[1],v.pos[2]);
  const T=new THREE.Vector3(v.tgt[0],v.tgt[1],v.tgt[2]);
  if(tween){
    app.camTween={ active:true, t:0, dur:1.4,
      pf:camera.position.clone(), pt:controls.target.clone(), tf:P, tt:T };
  } else {
    camera.position.copy(P); controls.target.copy(T);
    app.camTween={active:false};
  }
}
function startIntro(){
  if(REDUCED){ applyPreset('hero', true); return; }
  introActive=true; introT=0;
  app.camTween={active:false};
  controls.autoRotate=false;
}
function introCam(t){
  const p0=new THREE.Vector3(60,190,-760);
  const p1=new THREE.Vector3(430,260,120);
  const p2=new THREE.Vector3(285,195,530);   // = VIEWS.hero pose (seamless exit)
  const q=(a,b,c,u)=>{
    const w=1-u;
    return new THREE.Vector3().copy(a).multiplyScalar(w*w)
      .addScaledVector(b, 2*w*u).addScaledVector(c, u*u);
  };
  camera.position.copy(q(p0,p1,p2,t));
  const tt=new THREE.Vector3(0, lerp(150,160,t), 0);
  controls.target.copy(tt);
}

/* ---------- post processing (degrades gracefully) ---------- */
function setupPost(){
  usePost=false;
  try{
    composer=new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene,camera));
    bloomPass=new UnrealBloomPass(new THREE.Vector2(app.container.clientWidth||innerWidth, app.container.clientHeight||innerHeight), 0.35, 0.6, 0.82);
    composer.addPass(bloomPass);
    const vigMat=new THREE.ShaderMaterial({
      uniforms:{ tDiffuse:{value:null}, uNight:{value:0} },
      vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader:'uniform sampler2D tDiffuse; uniform float uNight; varying vec2 vUv;\n'+
        'void main(){ vec4 c=texture2D(tDiffuse,vUv);\n'+
        ' float d=length(vUv-0.5)*1.4142;\n'+
        ' float vig=1.0-0.24*pow(d,2.0)*(1.0+0.9*uNight);\n'+
        ' vec3 col=c.rgb*vig;\n'+
        ' col=mix(col, col*vec3(1.03,0.99,0.93)+vec3(0.012,0.006,0.02)*uNight, uNight);\n'+
        ' gl_FragColor=vec4(col,c.a); }'
    });
    vigPass=new ShaderPass(vigMat);
    composer.addPass(vigPass);
    composer.addPass(new OutputPass());
    usePost=true;
    composer.setSize(innerWidth, innerHeight);
  }catch(err){
    usePost=false;
    composer=null; bloomPass=null; vigPass=null;
  }
}

/* ---------- animate loop ---------- */
function animate(){
  requestAnimationFrame(animate);
  try{
    const dt=Math.min(clock.getDelta(), 0.05);
    app.time=(app.time||0)+dt;
    const dyn=app.dynamic;

    // camera intro / tweens
    if(introActive){
      introT+=dt/9.5;
      if(introT>=1){ introActive=false; applyPreset('hero',false); }
      else introCam(easeIO(introT));
    } else if(app.camTween && app.camTween.active){
      const ct=app.camTween; ct.t+=dt/ct.dur;
      const e=smooth(Math.min(1,ct.t));
      camera.position.lerpVectors(ct.pf, ct.tf, e);
      controls.target.lerpVectors(ct.pt, ct.tt, e);
      if(ct.t>=1) ct.active=false;
    }

    // day ↔ night
    dyn.nightT += (dyn.nightTarget-dyn.nightT)*Math.min(1, dt*0.55);
    if(Math.abs(dyn.nightT-dyn.nightTarget)<0.0004) dyn.nightT=dyn.nightTarget;
    setDynamicLights(dyn.nightT);

    controls.autoRotate = !!dyn.autoRotate;
    controls.update();

    // beacon sweep + flag flutter
    if(app.beacon && dyn.nightT>0.02){
      app.beacon.grp.rotation.y = app.time*0.55;
    }
    if(app.flag){
      app.flag.rotation.z = Math.sin(app.time*1.7)*0.02;
      app.flag.rotation.y = Math.sin(app.time*0.6)*0.05;
    }
    if(app.sparkle && app.sparkle.uni) app.sparkle.uni.uTime.value=app.time;
    if(bloomPass){
      bloomPass.strength = 0.30+0.9*dyn.nightT;
      bloomPass.threshold = 0.88-0.3*dyn.nightT;
    }
    if(vigPass) vigPass.uniforms.uNight.value=dyn.nightT;

    if(usePost && composer) composer.render();
    else renderer.render(scene,camera);

    frames++;
    if(frames===1 && !stateDone) firstFrameDone();

    // fps + frame-time bookkeeping
    app._fpsEMA = app._fpsEMA||0;
    app._fpsEMA = app._fpsEMA*0.95 + (dt>0?1/dt:0)*0.05;
  }catch(err){
    if(!stateDone) __eiffelFatal(err);
  }
}

/* audit: every beam inside sane metric bounds (catches coordinate bugs) */
function auditFB(){
  const b = { minX:1e9, maxX:-1e9, minY:1e9, maxY:-1e9, minZ:1e9, maxZ:-1e9, bad:0, n:0, per:{} };
  const scan = fb => {
    for(const k in fb.buckets){
      const a = fb.buckets[k].beams;
      for(let i=0;i<a.length;i+=6){
        b.n++;
        for(let j=0;j<6;j++){
          const v = a[i+j];
          if(!isFinite(v)){
            b.bad++; b.per[k]=(b.per[k]||0)+1;
            if(!b.samples) b.samples={};
            if(!b.samples[k]) b.samples[k]=Array.from(a.slice(i,i+6));
            continue;
          }
          if(j%3===0){ if(v<b.minX)b.minX=v; if(v>b.maxX)b.maxX=v; }
          else if(j%3===1){ if(v<b.minY)b.minY=v; if(v>b.maxY)b.maxY=v; }
          else { if(v<b.minZ)b.minZ=v; if(v>b.maxZ)b.maxZ=v; }
        }
      }
    }
  };
  scan(FB); scan(FB2);
  return b;
}

function firstFrameDone(){
  if(stateDone) return;
  stateDone=true;
  // ---- static scene statistics (CPU side — stable & composer independent) ----
  let tris=0, calls=0;
  scene.traverse(o=>{
    if(!o.visible) return;
    if(o.isInstancedMesh){ calls++; const g=o.geometry;
      const gt = g.index ? g.index.count/3 : (g.attributes.position? g.attributes.position.count/3 : 0);
      tris += gt*o.count;
    } else if(o.isMesh){ calls++; const g=o.geometry;
      tris += g.index ? g.index.count/3 : (g.attributes.position? g.attributes.position.count/3 : 0);
    } else if(o.isPoints || o.isLineSegments || o.isLine){ calls++; }
  });
  const beams=Math.round(FB.count()+(FB2?Object.keys(FB2.buckets).reduce((a,k)=>a+FB2.buckets[k].beams.length/6,0):0));
  const buildMs=Math.round(performance.now()-tStart);
  const st=window.__EIFFEL_STATE__;
  const sparks = (app.sparkle && app.sparkle.mesh && app.sparkle.mesh.geometry && app.sparkle.mesh.geometry.attributes.position)
    ? app.sparkle.mesh.geometry.attributes.position.count : 0;
  st.ok=true; st.triangles=tris; st.calls=calls; st.beams=beams; st.buildMs=buildMs; st.sparks=sparks;
  try{ st.audit = auditFB(); }catch(e){}
  try{ document.title='EIFFEL-OK '+tris+' tris '+calls+' calls'; }catch(e){}
  const put=(id,val)=>{ const e=document.getElementById(id); if(e) e.textContent=val; };
  put('stTris', tris.toLocaleString());
  put('stCalls', calls.toLocaleString());
  put('stBeams', beams.toLocaleString());
  put('stSparks', sparks.toLocaleString());
  put('stTons', '10 100 t');
  setTimeout(()=>{ const o=document.getElementById('overlay'); if(o) o.classList.add('hide'); }, 120);
}

/* ---------- stats refresh (FPS live, geometry static) ---------- */
setInterval(()=>{
  if(frames<2) return;
  const el=document.getElementById('stFps');
  if(el) el.textContent=Math.round(app._fpsEMA||0);
},500);

/* ---------- boot / orchestration ---------- */
async function main(){
  tStart=performance.now();

  const step=async (f,label,detail)=>{
    reportProgress(f, label, detail);
    await _yield();
  };

  await step(0.02,'initialising renderer & textures');
  initCore();
  createTextures();
  await step(0.05,'sky, atmosphere, sun & environment');

  app.interiorGrp=new THREE.Group();
  scene.add(app.interiorGrp);

  buildSky();
  initEnvAndLights();

  await step(0.10,'Champ de Mars & esplanade…');
  buildGround();

  await step(0.16,'masonry piers');
  buildPiers();

  reportProgress(0.30,'lattice legs (stage 1/2)');
  await _yield();
  buildLegs();

  reportProgress(0.40,'lattice legs (stage 2/2) · arches');
  await _yield();
  buildArches();

  await step(0.52,'merged upper shaft & 196 m landing');
  buildShaft();

  await step(0.60,'mast, antennas, beacon & flag');
  buildMastAndAntennas();

  await step(0.70,'1st / 2nd / 3rd platforms & frieze');
  buildDecks();

  await step(0.80,'elevators & machinery');
  buildElevators();

  await step(0.86,'internal staircases');
  buildStairs();

  await step(0.90,'night floods & sparkle rig');
  buildFloods();
  buildSparkles();

  reportProgress(0.96,'instancing '+FB.count().toLocaleString()+' beams…');
  finalizeInstancing();

  await step(0.99,'post-processing');
  setupPost();
  bindUI();

  // initial dynamic settings from params
  const dyn=app.dynamic;
  dyn.nightTarget=params.night>0?1:0;
  if(params.night>0) dyn.sparkleOn=true;
  if(!params.view){
    if(params.intro && !REDUCED) startIntro();
    else applyPreset('hero', false);
  } else {
    applyPreset(params.view, false);
  }

  reportProgress(1,'ready');
  requestAnimationFrame(animate);
}

main().catch(err=>{
  const R=window.__eiffelFatal;
  if(R) R(err);
  else throw err;
});
/*EIF_MODULE_END*/

