
import fs from 'node:fs';
const OUT  = 'F:/repo-aiscan2/tropico-2026/iterations/02-la-siesta-de-los-peces/la-siesta-de-los-peces.svg';
const TEST = 'F:/repo-aiscan2/tropico-2026/iterations/02-la-siesta-de-los-peces/_sil.svg';

let S = 20261017;
const rnd = () => { S = (S * 1103515245 + 12345) & 0x7fffffff; return S / 0x7fffffff; };
const rr = (a, b) => a + (b - a) * rnd();
const f = n => Math.round(n * 10) / 10;

function strokes(cmds, filter) {
  const m = new Map();
  for (const [c, w, op, d] of cmds) {
    const k = c + '|' + Math.round(w) + '|' + (Math.round(op * 50) / 50);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  let s = '';
  for (const [k, arr] of m) {
    const p = k.split('|');
    s += '<path d="' + arr.join('') + '" fill="none" stroke="' + p[0] + '" stroke-width="' + p[1] +
         '" stroke-opacity="' + p[2] + '" stroke-linecap="round"/>';
  }
  return filter ? '<g filter="url(#' + filter + ')">' + s + '</g>' : s;
}
function dash(x1, y1, x2, y2, bow) {
  bow = bow || 0;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  return 'M' + f(x1) + ' ' + f(y1) + 'Q' + f(mx + nx * bow) + ' ' + f(my + ny * bow) + ' ' + f(x2) + ' ' + f(y2);
}

// ---------------- PALETTE ----------------
const SKY_L='#fff8e8', SKY_R='#dff0ea';
const SEA_HI='#fdfefb', SEA_A='#dff2ec', SEA_B='#b0d8d2', SEA_C='#83bdb8',
      SEA_D='#5c9d9b';
const SAND='#eedcb6', SAND_HI='#fff7dc', SAND_M='#e6cfa6', SAND_D='#d3b98d';
const VIO_S='#b5aacb', VIO_M='#9489ae', VIO_D='#6d6289', VIO_X='#463f60';
const LINEN='#fdf9ee', LINEN_S='#e3dded', LINEN_SS='#bdb3d2';
const SKIN='#d28f6d', SKIN_HI='#f5c6a0', SKIN_SH='#a2665a', SKIN_D='#77463f';
const HAIR='#3a2823', HAIR_H='#9c5f3e';
const CORAL='#dd7f66', CORAL_D='#ac5040';
const ORANGE='#f26f2b';
const TURQ='#6fb0b3', TURQ_D='#3f7f88';
const BLU='#3f4a63', BLU_L='#68789a';
const WALL='#f9efdb', WALL_S='#d6c9c6';
const DOOR='#1e1a28';

const out = [];
const P = s => out.push(s);
const figShapes = [];   // reusable silhouettes for the black test

// ================= DEFS =================
P('<?xml version="1.0" encoding="UTF-8"?>');
P('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">');
P('<defs>');
for (const [id, sd] of [['b1',1],['b2',2],['b3',3],['b5',5],['b8',8],['b14',14],['b24',24],['b48',48]])
  P('<filter id="'+id+'" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="'+sd+'"/></filter>');
P('<filter id="rough" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="11" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>');
P('<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.30 0.30 0.30 0 0"/></filter>');

P('<linearGradient id="skyG" x1="0" y1="0" x2="1" y2="0.25"><stop offset="0" stop-color="#fffaee"/><stop offset="0.3" stop-color="#fdf6e6"/><stop offset="0.68" stop-color="#eef8f3"/><stop offset="1" stop-color="#dcf0ea"/></linearGradient>');
P('<radialGradient id="sunGlow" cx="0" cy="0" r="1"><stop offset="0" stop-color="#ffffff" stop-opacity="1"/><stop offset="0.3" stop-color="#fffcf0" stop-opacity="0.85"/><stop offset="0.62" stop-color="#fff2cf" stop-opacity="0.42"/><stop offset="1" stop-color="#ffeec6" stop-opacity="0"/></radialGradient>');
P('<linearGradient id="seaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fdfa"/><stop offset="0.12" stop-color="#e2f4ee"/><stop offset="0.42" stop-color="#b7dad4"/><stop offset="0.72" stop-color="#98c9c3"/><stop offset="1" stop-color="#a9d3cc"/></linearGradient>');
P('<linearGradient id="seaGlare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="0.35" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="0.7" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>');
P('<linearGradient id="paraG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf5"/><stop offset="0.3" stop-color="#f7e9cc"/><stop offset="1" stop-color="#d9c5a6"/></linearGradient>');
P('<linearGradient id="groundG" x1="0.1" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#e5cb9c"/><stop offset="0.3" stop-color="#f2dfb6"/><stop offset="1" stop-color="#eCD7aa"/></linearGradient>');
P('<radialGradient id="gHot" cx="0.22" cy="0.12" r="0.8"><stop offset="0" stop-color="#fffaea" stop-opacity="0.9"/><stop offset="0.45" stop-color="#fff3d4" stop-opacity="0.4"/><stop offset="1" stop-color="#ffefc8" stop-opacity="0"/></radialGradient>');
P('<radialGradient id="shadeG" cx="0.92" cy="0.95" r="1.15"><stop offset="0" stop-color="#4a4270" stop-opacity="0.95"/><stop offset="0.28" stop-color="#4e4674" stop-opacity="0.95"/><stop offset="0.6" stop-color="#7e7499" stop-opacity="0.86"/><stop offset="0.86" stop-color="#9c92b6" stop-opacity="0.7"/><stop offset="1" stop-color="#c0b4d2" stop-opacity="0.42"/></radialGradient>');
P('<radialGradient id="warmBounce" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8e" stop-opacity="0.6"/><stop offset="1" stop-color="#ffcf8e" stop-opacity="0"/></radialGradient>');
P('<linearGradient id="tarpG" x1="0.2" y1="1" x2="0.5" y2="0"><stop offset="0" stop-color="#fffdf4"/><stop offset="0.35" stop-color="#fbf4e4"/><stop offset="0.75" stop-color="#ecdfcd"/><stop offset="1" stop-color="#ddcfc6"/></linearGradient>');
P('<linearGradient id="wallG" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fffcf3"/><stop offset="0.4" stop-color="#f8edD8"/><stop offset="1" stop-color="#ddcfc5"/></linearGradient>');
P('<linearGradient id="figLight" x1="0" y1="0" x2="0.7" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="0.55" stop-color="#f8f2e4"/><stop offset="1" stop-color="#e8e2ea"/></linearGradient>');
P('<pattern id="netP" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path d="M0 5 H10 M5 0 V10" stroke="#4f5d5e" stroke-width="1" fill="none"/></pattern>');
P('<pattern id="canvP" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 3.5 H7 M3.5 0 V7" stroke="#8a7b68" stroke-width="0.5" fill="none"/></pattern>');
P('<clipPath id="tarpClip"><path d="M974 296 C 1040 322 1120 350 1200 376 C 1240 390 1280 400 1300 404 L 1330 420 L 1470 -40 L 980 -40 L 950 200 Z"/></clipPath>');
P('</defs>');

// ================= SKY =================
P('<rect width="1600" height="400" fill="url(#skyG)"/>');
P('<ellipse cx="40" cy="0" rx="820" ry="620" fill="url(#sunGlow)"/>');
P('<ellipse cx="0" cy="-40" rx="470" ry="360" fill="url(#sunGlow)" opacity="0.9"/>');
{
  const c = [];
  for (let i = 0; i < 22; i++) {
    const x = rr(80, 1560), y = rr(30, 340);
    c.push([rnd() > 0.5 ? '#fff9e8' : '#e8f5f0', rr(10, 40), rr(0.05, 0.12), dash(x, y, x + rr(120, 380), y + rr(-10, 10), rr(-16, 16))]);
  }
  P(strokes(c, 'b24'));
}

// ================= SEA =================
P('<rect x="0" y="380" width="1600" height="242" fill="url(#seaG)"/>');
P('<rect x="0" y="380" width="1600" height="150" fill="url(#seaGlare)"/>');
P('<rect x="0" y="376" width="1600" height="20" fill="#ffffff" opacity="0.7" filter="url(#b5)"/>');
{
  const c = [];
  for (let i = 0; i < 240; i++) {
    const y = rr(390, 618), x = rr(-20, 1620);
    const nearFar = (y - 390) / 228;
    const len = rr(12, 70) * (0.45 + nearFar * 0.9);
    const t = rnd();
    const col = t > 0.5 ? '#ffffff' : (t > 0.25 ? '#eaf8f4' : '#c9e6e0');
    c.push([col, rr(2, 8), rr(0.10, 0.34), dash(x, y, x + len, y + rr(-1.5, 1.5), rr(-1, 1))]);
  }
  for (let i = 0; i < 70; i++) {
    const y = rr(440, 618), x = rr(180, 1600);
    c.push([rnd() > 0.5 ? '#7fb9b4' : '#6aa8a6', rr(3, 9), rr(0.08, 0.22), dash(x, y, x + rr(40, 200), y + rr(-2, 2), rr(-2, 2))]);
  }
  P(strokes(c, 'b2'));
}
// distant boat
P('<g opacity="0.6" filter="url(#b1)"><path d="M1120 452 q30 -8 60 -2 q-12 8 -30 9 q-18 1 -30 -7 z" fill="#54626e"/><path d="M1150 452 v-18" stroke="#54626e" stroke-width="1.5"/><path d="M1150 442 q12 2 16 -8 v11 z" fill="#8592a0"/></g>');
P('<ellipse cx="1150" cy="468" rx="34" ry="4" fill="#ffffff" opacity="0.4" filter="url(#b3)"/>');
P('<g opacity="0.35" filter="url(#b1)"><path d="M330 500 q20 -5 40 -1 q-8 5 -20 6 q-12 1 -20 -5 z" fill="#4f5d69"/></g>');

// ================= PARAPET =================
P('<rect x="0" y="620" width="1600" height="64" fill="url(#paraG)"/>');
P('<rect x="0" y="620" width="1600" height="6" fill="#fffef8"/>');
P('<rect x="0" y="620" width="1600" height="12" fill="#ffffff" opacity="0.55" filter="url(#b3)"/>');
P('<rect x="0" y="678" width="1600" height="8" fill="#8d82ab" opacity="0.55" filter="url(#b3)"/>');
{
  const c = [];
  for (let i = 0; i < 34; i++) {
    const x = rr(0, 1600), y = rr(628, 674);
    c.push(['#ffffff', rr(4, 18), rr(0.06, 0.18), dash(x, y, x + rr(10, 60), y + rr(-3, 3), 0)]);
  }
  P(strokes(c, 'b5'));
}

// ================= GROUND =================
P('<rect x="0" y="684" width="1600" height="516" fill="url(#groundG)"/>');
P('<rect x="0" y="684" width="1600" height="516" fill="url(#gHot)"/>');
// receding joints
{
  const c = [];
  for (let i = 0; i < 8; i++) {
    const y = 700 + i * i * 7.5 + i * 20;
    c.push(['#cbb489', rr(1, 2.5), rr(0.10, 0.20), dash(rr(-60, 40), y, rr(1520, 1680), y + rr(-5, 5), rr(-5, 5))]);
  }
  P(strokes(c, 'b2'));
}

// ================= AWNING SHADOW (hard diagonal) =================
P('<path d="M300 1218 C 470 1080 640 940 760 840 C 850 766 930 720 1016 686 L 1600 660 L 1600 1218 Z" fill="url(#shadeG)"/>');
P('<path d="M300 1218 C 470 1080 640 940 760 840 C 850 766 930 720 1016 686" fill="none" stroke="#cfc3dd" stroke-width="14" opacity="0.5" filter="url(#b8)"/>');
P('<ellipse cx="960" cy="740" rx="380" ry="80" fill="url(#warmBounce)" opacity="0.8"/>');
P('<ellipse cx="700" cy="1010" rx="260" ry="150" fill="url(#warmBounce)" opacity="0.45"/>');
P('<ellipse cx="1040" cy="1150" rx="340" ry="180" fill="#3d3560" opacity="0.35" filter="url(#b24)"/>');

// ---- three bounced lights in the shade (curator fix 2)
P('<path d="M1010 470 L 1600 470 L 1600 700 L 1010 760 Z" fill="#2f7f86" opacity="0.28" filter="url(#b14)"/>');
P('<path d="M1010 700 L 1600 660 L 1600 900 L 1010 940 Z" fill="#6d6289" opacity="0.30" filter="url(#b14)"/>');
P('<path d="M980 940 L 1600 900 L 1600 1218 L 940 1218 Z" fill="#f0a866" opacity="0.22" filter="url(#b18)"/>');
P('<path d="M1180 900 C 1300 880 1440 862 1600 850 L 1600 1218 L 1140 1218 Z" fill="#c88a5e" opacity="0.10" filter="url(#b24)"/>');
P('<path d="M1010 470 L 1600 470 L 1600 660 L 1010 720 Z" fill="none" stroke="#3f8f8a" stroke-width="10" opacity="0.12" filter="url(#b14)"/>');
// ================= PAVEMENT PAINT =================
{
  const lit = [], sh = [];
  for (let i = 0; i < 150; i++) {
    const y = rr(690, 1200), x = rr(-40, 900);
    const t = rnd();
    lit.push([t > 0.6 ? '#fff9e2' : (t > 0.25 ? '#f6e5c0' : '#dfc79c'), rr(4, 16), rr(0.04, 0.14), dash(x, y, x + rr(30, 130), y + rr(-3, 3), rr(-6, 6))]);
  }
  for (let i = 0; i < 150; i++) {
    const y = rr(690, 1200), x = rr(880, 1620);
    const t = rnd();
    sh.push([t > 0.62 ? '#c3b7d4' : (t > 0.3 ? '#9b90b5' : '#7b7099'), rr(4, 14), rr(0.05, 0.16), dash(x, y, x + rr(30, 120), y + rr(-3, 3), rr(-8, 8))]);
  }
  P(strokes(lit, 'b2'));
  P(strokes(sh, 'b2'));
  const sp = [];
  for (let i = 0; i < 40; i++) sp.push(['#ffffff', rr(2, 6), rr(0.2, 0.55), dash(rr(0, 900), rr(950, 1195), rr(0, 0) + rr(900, 1000), rr(950, 1195), 0)]);
  P('<g opacity="0.5" filter="url(#b1)">' + strokes(sp) + '</g>');
}

// ================= WALL (right) =================
P('<g filter="url(#rough)">');
P('<path d="M1252 470 L 1600 442 L 1600 984 L 1252 956 Z" fill="url(#wallG)"/>');
P('<path d="M1252 470 L 1600 442 L 1600 464 L 1252 492 Z" fill="#fffef6"/>');
P('</g>');
P('<path d="M1252 470 L 1600 442 L 1600 452 L 1252 480 Z" fill="#ffffff" filter="url(#b3)"/>');
P('<path d="M1252 956 L 1600 984 L 1600 862 L 1252 838 Z" fill="#9489ae" opacity="0.55" filter="url(#b14)"/>');
// salt bloom on wall
{
  const c = [];
  for (let i = 0; i < 30; i++) {
    const x = rr(1260, 1590), y = rr(480, 950);
    c.push(['#ffffff', rr(6, 24), rr(0.05, 0.15), dash(x, y, x + rr(15, 70), y + rr(-8, 8), 0)]);
  }
  P(strokes(c, 'b8'));
}
// doorway
P('<path d="M1462 966 L 1466 596 L 1558 590 L 1564 972 Z" fill="' + DOOR + '"/>');
P('<path d="M1468 962 L 1472 602 L 1552 597 L 1558 966 Z" fill="#2f2942" opacity="0.85" filter="url(#b5)"/>');
P('<path d="M1474 908 L 1552 903 L 1556 962 L 1470 966 Z" fill="#c9a684" opacity="0.6" filter="url(#b5)"/>');
P('<path d="M1462 966 L 1466 596 L 1558 590 L 1564 972 Z" fill="none" stroke="#7d6e6c" stroke-width="3" opacity="0.35"/>');
// one worn painted mark (unreadable)
P('<g opacity="0.32" filter="url(#rough)">');
P('<path d="M1332 500 C 1372 486 1418 492 1446 512 C 1440 528 1424 534 1400 532 C 1372 530 1344 520 1332 512 Z" fill="#767296"/>');
P('<path d="M1348 542 C 1386 530 1426 534 1452 550 C 1444 564 1426 568 1404 566 C 1380 564 1358 552 1348 542 Z" fill="#767296"/>');
P('<path d="M1394 488 C 1394 518 1398 548 1406 574" stroke="#767296" stroke-width="14" fill="none"/>');
P('</g>');
P('<path d="M1252 700 C 1300 690 1300 810 1252 800" fill="#ffffff" opacity="0.25" filter="url(#b8)"/>');

// ================= SOLAR PANEL =================
P('<g transform="rotate(-8 1345 800)">');
P('<path d="M1300 690 L 1404 686 L 1416 916 L 1312 920 Z" fill="#3b4762" filter="url(#rough)"/>');
P('<path d="M1306 700 L 1398 696 L 1408 906 L 1316 910 Z" fill="#2f3a52"/>');
P('<g stroke="#26304a" stroke-width="2.2" opacity="0.85"><path d="M1306 740 L 1404 736"/><path d="M1308 790 L 1406 786"/><path d="M1310 842 L 1408 838"/><path d="M1338 698 L 1346 908"/><path d="M1372 696 L 1380 906"/></g>');
P('<path d="M1310 702 L 1350 700 L 1326 908 L 1318 908 Z" fill="#a8cbd6" opacity="0.62"/>');
P('<path d="M1318 704 L 1342 702 L 1324 904 L 1316 904 Z" fill="#ffffff" opacity="0.55" filter="url(#b3)"/>');
P('<path d="M1300 690 L 1404 686 L 1406 694 L 1302 698 Z" fill="#d5dccd"/>');
P('<path d="M1312 920 L 1416 916 L 1412 928 L 1308 932 Z" fill="#8b8a84"/>');
P('</g>');
P('<ellipse cx="1370" cy="930" rx="78" ry="12" fill="#6f6590" opacity="0.5" filter="url(#b8)"/>');

// ================= TARP =================
P('<path d="M974 296 C 1040 322 1120 350 1200 376 C 1240 390 1280 400 1300 404 L 1330 420 L 1470 -40 L 980 -40 L 950 200 Z" fill="url(#tarpG)" filter="url(#rough)"/>');
P('<path d="M974 296 C 1040 322 1120 350 1200 376 C 1240 390 1280 400 1300 404 L 1330 420 L 1470 -40 L 980 -40 L 950 200 Z" fill="url(#canvP)" opacity="0.06"/>');
{
  const c = [];
  for (let i = 0; i < 18; i++) {
    const x = rr(960, 1400), y = rr(-30, 380);
    c.push(['#e0d3c4', rr(6, 26), rr(0.08, 0.22), dash(x, y, x + rr(-20, 30), y + rr(70, 190), rr(-24, 24))]);
  }
  for (let i = 0; i < 12; i++) {
    const x = rr(960, 1420), y = rr(-20, 340);
    c.push(['#ffffff', rr(4, 18), rr(0.12, 0.3), dash(x, y, x + rr(30, 120), y + rr(-6, 30), rr(-18, 18))]);
  }
  P(strokes(c, 'b8'));
}
// hem: hot rim, and the flap hanging at the left
P('<path d="M974 296 C 1040 322 1120 350 1200 376 C 1240 390 1280 400 1300 404 L 1330 420" fill="none" stroke="#fffef6" stroke-width="6" filter="url(#b2)"/>');
P('<path d="M950 200 C 940 260 950 320 974 296" fill="none" stroke="#f6ecd9" stroke-width="7"/>');
P('<path d="M980 -40 C 972 60 962 140 950 200" fill="none" stroke="#fffdf4" stroke-width="5" opacity="0.9"/>');
// corner flap hanging down
P('<path d="M950 200 C 930 250 918 300 924 344 C 946 330 962 312 974 296 Z" fill="#fbf3e2" filter="url(#rough)"/>');
P('<path d="M924 344 C 946 330 962 312 974 296" fill="none" stroke="#cfc2d4" stroke-width="4" opacity="0.55" filter="url(#b2)"/>');
// fold lines from pole toward wall
{
  const c = [];
  c.push(['#d9ccbe', 12, 0.2, 'M1000 300 C 1090 250 1200 200 1300 150']);
  c.push(['#d9ccbe', 9, 0.16, 'M1010 330 C 1100 300 1220 280 1320 270']);
  c.push(['#fffdf2', 7, 0.35, 'M996 280 C 1080 220 1180 160 1290 100']);
  P(strokes(c, 'b14'));
}
// pole (off centre, 0.62)
P('<path d="M984 292 L 974 1030 L 996 1032 L 1006 292 Z" fill="#bfa887" filter="url(#rough)"/>');
P('<path d="M986 294 L 978 1028 L 986 1028 L 996 294 Z" fill="#fff2d8" opacity="0.9"/>');
P('<path d="M1000 294 L 994 1030 L 996 1030 L 1004 294 Z" fill="#6d6281" opacity="0.7"/>');
P('<ellipse cx="988" cy="1032" rx="24" ry="7" fill="#6a6088" opacity="0.55" filter="url(#b5)"/>');
// rope lashing at the top
P('<path d="M972 302 C 986 316 1000 312 1006 300" fill="none" stroke="#c9b393" stroke-width="4"/>');
P('<path d="M962 330 L 940 420" stroke="#d3c0a2" stroke-width="3" opacity="0.8"/>');
// the tarp's shadow on the wall
P('<path d="M1252 470 L 1600 442 L 1600 520 L 1252 552 Z" fill="#8a7fa4" opacity="0.28" filter="url(#b14)"/>');

// ---- the sun event, top right (curator fix 3)
P('<g clip-path="url(#tarpClip)">');
P('<ellipse cx="1408" cy="112" rx="360" ry="320" fill="#ffffff" opacity="0.30" filter="url(#b24)"/>');
P('<ellipse cx="1424" cy="104" rx="220" ry="196" fill="#fffdf0" opacity="0.35" filter="url(#b18)"/>');
P('<ellipse cx="1444" cy="86" rx="190" ry="170" fill="#ffffff" opacity="0.55" filter="url(#b18)"/>');
P('<ellipse cx="1450" cy="80" rx="70" ry="58" fill="#ffffff" opacity="0.55" filter="url(#b14)"/>');
P('<path d="M1290 0 L 1600 0 L 1600 196 L 1330 172 Z" fill="#fffef6" opacity="0.30" filter="url(#b24)"/>');
P('<path d="M1336 210 L 1600 150 L 1600 186 L 1342 250 Z" fill="#fff2cc" opacity="0.40" filter="url(#b14)"/>');
P('</g>');
// sunlight through the cloth: the tarp glows warm from behind, one bright fold
P('<path d="M974 296 C 1040 322 1120 350 1200 376 C 1240 390 1280 400 1300 404 L 1330 420 L 1470 -40 L 980 -40 L 950 200 Z" fill="#ffd79a" opacity="0.30"/>');
P('<path d="M1060 250 C 1140 290 1230 330 1310 366 L 1340 300 C 1250 262 1160 222 1080 180 Z" fill="#ffe8b8" opacity="0.40" filter="url(#b14)"/>');
P('<path d="M1150 90 C 1200 170 1250 260 1290 350" stroke="#fffbe8" stroke-width="16" opacity="0.35" filter="url(#b14)"/>');
// the pole's shadow on the underside of the cloth
P('<path d="M1000 300 L 1044 120 L 1076 128 L 1014 306 Z" fill="#8a6a6a" opacity="0.22" filter="url(#b14)"/>');
// ================= FIGURES =================
const A_BODY = 'M474 656 C 470 692 464 742 464 792 C 464 816 474 830 490 834 L 552 836 C 568 832 576 816 576 792 C 576 742 570 692 558 658 L 538 650 L 492 650 Z';
const A_ARM_R = 'M486 660 C 468 706 456 756 458 808 L 478 864 L 502 856 C 494 806 500 748 508 668 Z';
const A_ARM_L = 'M550 664 C 568 710 578 760 576 812 L 598 860 L 574 870 C 562 820 556 758 548 676 Z';
const A_SKIRT = 'M468 830 C 446 868 438 926 446 972 C 450 998 468 1012 494 1014 L 546 1010 C 556 982 554 938 548 898 L 538 838 Z';
const A_HEAD = 'M508 618 m-26 0 a26 29 0 1 0 52 0 a26 29 0 1 0 -52 0';
const B_TORSO = 'M778 574 C 772 630 786 668 792 706 C 788 728 786 748 788 768 L 882 772 C 884 748 882 728 878 706 C 886 666 894 622 888 578 C 866 568 800 568 778 574 Z';
const B_SKIRT = 'M786 766 C 776 806 772 856 774 898 L 912 904 C 916 860 910 808 900 770 Z';
const B_LEG_L = 'M784 896 L 794 1046 L 822 1050 L 814 898 Z';
const B_LEG_R = 'M876 900 L 886 1050 L 914 1052 L 910 902 Z';
const B_ARM_L = 'M784 576 C 760 620 746 668 744 720 L 742 820 L 766 824 C 768 766 774 704 796 592 Z';
const B_ARM_R = 'M886 582 C 912 626 926 676 928 728 L 930 828 L 906 832 C 904 772 896 710 874 596 Z';
const B_HEAD = 'M832 508 m-30 0 a30 34 0 1 0 60 0 a30 34 0 1 0 -60 0';
const B_BUN = 'M812 526 m-19 0 a19 15 0 1 0 38 0 a19 15 0 1 0 -38 0';
const C_TORSO = 'M1018 702 C 1010 740 1008 800 1012 862 L 1108 866 C 1114 802 1110 740 1104 706 L 1062 698 L 1030 698 Z';
const C_LEGS = 'M1008 858 C 992 900 996 946 1024 962 L 1096 964 C 1126 954 1136 916 1124 876 Z';
const C_HEAD = 'M1062 676 m-24 0 a24 26 0 1 0 48 0 a24 26 0 1 0 -48 0';
const C_ARM_L = 'M1020 706 C 1000 754 988 810 984 862 L 980 918 L 1002 922 C 1008 866 1018 810 1034 716 Z';
const C_ARM_R = 'M1102 710 C 1118 756 1124 812 1120 862 L 1116 916 L 1094 920 C 1098 866 1090 806 1078 714 Z';

// solid base silhouettes - no transparency anywhere
P('<g filter="url(#rough)">');
P('<path d="' + A_SKIRT + '" fill="#565a78"/>');
P('<path d="M492 844 C 486 892 484 940 486 1000 L 512 1004 C 508 946 508 894 514 846 Z" fill="#454963"/>');
P('<path d="' + A_BODY + '" fill="' + LINEN + '"/>');
P('<path d="' + A_ARM_R + '" fill="' + LINEN + '"/>');
P('<path d="' + A_ARM_L + '" fill="' + LINEN + '"/>');
P('<path d="' + B_LEG_L + '" fill="#6b6480"/>');
P('<path d="' + B_LEG_R + '" fill="#5a5370"/>');
P('<path d="' + B_SKIRT + '" fill="#6b6580"/>');
P('<path d="M800 772 C 796 820 796 866 798 900 L 828 902 C 822 858 820 812 824 774 Z" fill="#585271"/>');
P('<path d="M862 776 C 866 818 866 864 862 902 L 888 904 C 888 862 886 818 884 778 Z" fill="#7d7791"/>');
P('<path d="' + B_TORSO + '" fill="' + LINEN + '"/>');
P('<path d="' + B_ARM_L + '" fill="' + SKIN + '"/>');
P('<path d="' + B_ARM_R + '" fill="' + SKIN + '"/>');
P('<ellipse cx="1066" cy="966" rx="78" ry="13" fill="#463f63" opacity="0.42" filter="url(#b5)"/>');
P('<ellipse cx="1066" cy="960" rx="52" ry="8" fill="#332e4c" opacity="0.45" filter="url(#b2)"/>');
P('<path d="' + C_LEGS + '" fill="#4a4463"/>');
P('<path d="' + C_TORSO + '" fill="#a79ec0"/>');
P('<path d="' + C_ARM_L + '" fill="' + SKIN_SH + '"/>');
P('<path d="' + C_ARM_R + '" fill="' + SKIN_SH + '"/>');
P('</g>');
// necks
P('<path d="M497 638 L 495 664 L 523 666 L 523 636 Z" fill="' + SKIN_SH + '"/>');
P('<path d="M821 532 L 819 572 L 849 574 L 849 534 Z" fill="' + SKIN + '"/>');
P('<path d="M1050 688 L 1048 714 L 1076 716 L 1076 690 Z" fill="' + SKIN_SH + '"/>');

P('<defs>');
P('<clipPath id="cA"><path d="' + A_BODY + '"/><path d="' + A_ARM_L + '"/><path d="' + A_ARM_R + '"/><path d="' + A_SKIRT + '"/></clipPath>');
P('<clipPath id="cA2"><path d="' + A_BODY + '"/><path d="' + A_ARM_L + '"/><path d="' + A_ARM_R + '"/></clipPath>');
P('<clipPath id="cB"><path d="' + B_TORSO + '"/><path d="' + B_SKIRT + '"/><path d="' + B_LEG_L + '"/><path d="' + B_LEG_R + '"/></clipPath>');
P('<clipPath id="cB2"><path d="' + B_ARM_L + '"/><path d="' + B_ARM_R + '"/></clipPath>');
P('<clipPath id="cC"><path d="' + C_TORSO + '"/><path d="' + C_LEGS + '"/><path d="' + C_ARM_L + '"/><path d="' + C_ARM_R + '"/></clipPath>');
P('<clipPath id="cC2"><path d="' + C_ARM_L + '"/><path d="' + C_ARM_R + '"/></clipPath>');
P('</defs>');

// ---- A: sunlit crouch, hard shade on the right, blaze on the left, warm bounce low
P('<g clip-path="url(#cA2)">');
P('<path d="M462 634 C 490 638 512 640 528 646 L 534 828 L 462 828 Z" fill="#ffffff" opacity="0.95"/>');
P('<path d="M520 646 C 538 676 552 716 552 760 C 552 806 548 838 544 862 L 584 862 L 584 630 L 520 630 Z" fill="' + VIO_M + '" opacity="0.92" filter="url(#b4)"/>');
P('<path d="M552 650 C 560 710 560 790 556 852 L 582 852 L 582 650 Z" fill="' + VIO_D + '" opacity="0.8" filter="url(#b5)"/>');
P('<path d="M462 780 L 536 786 L 540 856 L 462 856 Z" fill="#ffcf8e" opacity="0.4" filter="url(#b6)"/>');
P('</g>');
P('<g clip-path="url(#cA)">');
P('<path d="M420 834 L 470 834 L 474 1016 L 418 1016 Z" fill="#d9d0e6" opacity="0.5" filter="url(#b5)"/>');
P('<path d="M484 896 L 512 896 L 512 1016 L 480 1016 Z" fill="' + VIO_D + '" opacity="0.5" filter="url(#b6)"/>');
{
  const c = [];
  for (let i = 0; i < 18; i++) {
    const x = rr(496, 560), y = rr(660, 800);
    c.push(['#c7bedb', rr(4, 9), rr(0.15, 0.4), dash(x, y, x + rr(-4, 8), y + rr(24, 60), rr(-6, 6))]);
  }
  for (let i = 0; i < 12; i++) {
    const x = rr(436, 496), y = rr(660, 800);
    c.push(['#ffffff', rr(4, 9), rr(0.25, 0.6), dash(x, y, x + rr(-4, 8), y + rr(24, 60), rr(-6, 6))]);
  }
  P(strokes(c, 'b2'));
}
P('</g>');
P('<g filter="url(#rough)">');
P('<path d="M482 612 C 482 586 496 572 512 572 C 530 572 542 586 540 608 C 538 624 528 634 518 636 C 502 638 488 630 484 620 Z" fill="' + HAIR + '"/>');
P('<path d="M536 604 C 542 614 540 624 530 630" fill="none" stroke="' + SKIN + '" stroke-width="9" opacity="0.95"/>');
P('<path d="M484 616 C 490 592 500 574 514 570" fill="none" stroke="' + HAIR_H + '" stroke-width="6" opacity="0.9" filter="url(#b2)"/>');
P('</g>');
P('<path d="M472 662 C 466 704 462 752 464 800" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.8" filter="url(#b1)"/>');
P('<path d="M486 664 C 470 708 458 758 460 810" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.5" filter="url(#b1)"/>');
P('<ellipse cx="490" cy="858" rx="13" ry="10" fill="' + SKIN + '"/><ellipse cx="488" cy="854" rx="9" ry="5" fill="' + SKIN_HI + '"/>');
P('<ellipse cx="592" cy="856" rx="13" ry="10" fill="' + SKIN_SH + '"/><ellipse cx="590" cy="852" rx="8" ry="4" fill="' + SKIN + '"/>');

// ---- B: standing, sunlit
P('<g clip-path="url(#cB)">');
P('<path d="M768 566 C 800 568 826 568 846 570 L 848 786 L 764 786 Z" fill="#ffffff" opacity="0.95"/>');
P('<path d="M838 568 C 858 610 872 664 872 720 C 872 786 868 860 866 906 L 918 906 L 920 566 Z" fill="' + VIO_M + '" opacity="0.9" filter="url(#b4)"/>');
P('<path d="M868 572 C 876 650 878 780 874 906 L 916 906 L 916 572 Z" fill="' + VIO_D + '" opacity="0.75" filter="url(#b5)"/>');
P('<path d="M768 826 L 850 830 L 852 908 L 770 908 Z" fill="#ffcf8e" opacity="0.35" filter="url(#b6)"/>');
P('</g>');
P('<g clip-path="url(#cB)">');
{
  const c = [];
  for (let i = 0; i < 18; i++) {
    const x = rr(790, 886), y = rr(600, 860);
    c.push([rnd() > 0.5 ? '#c7bedb' : '#a99ec6', rr(4, 10), rr(0.12, 0.32), dash(x, y, x + rr(-6, 8), y + rr(28, 70), rr(-8, 8))]);
  }
  for (let i = 0; i < 14; i++) {
    const x = rr(772, 850), y = rr(590, 800);
    c.push(['#ffffff', rr(4, 9), rr(0.2, 0.55), dash(x, y, x + rr(-6, 8), y + rr(28, 66), rr(-8, 8))]);
  }
  P(strokes(c, 'b2'));
}
P('</g>');
P('<g clip-path="url(#cB2)">');
P('<path d="M740 716 L 768 720 L 770 828 L 738 828 Z" fill="' + SKIN_HI + '" opacity="0.5" filter="url(#b3)"/>');
P('<path d="M904 716 L 932 720 L 932 832 L 902 832 Z" fill="' + SKIN_SH + '" opacity="0.9" filter="url(#b3)"/>');
P('</g>');
P('<g filter="url(#rough)">');
P('<path d="M804 502 C 804 478 820 466 838 468 C 856 470 866 486 862 504 C 860 518 850 524 840 522 C 822 520 808 512 806 504 Z" fill="' + HAIR + '"/>');
P('<ellipse cx="812" cy="528" rx="19" ry="15" fill="' + HAIR + '"/>');
P('<path d="M856 506 C 862 516 860 528 852 534" fill="none" stroke="' + SKIN_HI + '" stroke-width="10" opacity="0.95"/>');
P('<path d="M808 480 C 816 470 832 466 844 472" fill="none" stroke="' + HAIR_H + '" stroke-width="6" opacity="0.9" filter="url(#b2)"/>');
P('</g>');
P('<path d="M778 578 C 758 622 744 668 742 720" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.75" filter="url(#b1)"/>');
P('<path d="M790 586 C 768 628 754 674 752 724" fill="none" stroke="#fff8e0" stroke-width="3" opacity="0.5" filter="url(#b1)"/>');
P('<path d="M806 504 C 804 482 820 468 838 470" fill="none" stroke="#ffd9a8" stroke-width="4" opacity="0.7" filter="url(#b2)"/>');
P('<ellipse cx="750" cy="828" rx="13" ry="10" fill="' + SKIN + '"/><ellipse cx="748" cy="824" rx="9" ry="5" fill="' + SKIN_HI + '"/>');


// ---- C: kneeling in shade, rim from the left, warm bounce
P('<g clip-path="url(#cC)">');
P('<path d="M1004 690 L 1046 694 L 1048 972 L 1002 972 Z" fill="#efe8e0" opacity="0.72"/>');
P('<path d="M1046 694 C 1058 760 1060 860 1056 972 L 1130 972 L 1130 690 Z" fill="' + VIO_M + '" opacity="0.88" filter="url(#b3)"/>');
P('<path d="M1080 700 C 1090 780 1090 880 1084 972 L 1130 972 L 1130 700 Z" fill="' + VIO_D + '" opacity="0.62" filter="url(#b3)"/>');
P('<path d="M1002 896 L 1060 900 L 1062 974 L 1002 974 Z" fill="#ffc98a" opacity="0.32" filter="url(#b6)"/>');
P('</g>');
P('<g clip-path="url(#cC)">');
{
  const c = [];
  for (let i = 0; i < 16; i++) {
    const x = rr(1010, 1110), y = rr(720, 960);
    c.push([rnd() > 0.5 ? '#b7accb' : '#8a7fa8', rr(4, 10), rr(0.12, 0.3), dash(x, y, x + rr(-6, 8), y + rr(24, 56), rr(-6, 6))]);
  }
  P(strokes(c, 'b2'));
}
P('</g>');
P('<g filter="url(#rough)">');
// C: the head under the hat - opaque, working, face down-left
P('<g filter="url(#rough)">');
P('<path d="M1038 646 C 1042 664 1082 664 1086 646 Z" fill="#3a2823"/>');
P('<ellipse cx="1062" cy="680" rx="24" ry="26" fill="#a97a6a"/>');
P('<path d="M1038 672 C 1044 692 1082 692 1088 672 C 1080 696 1046 696 1038 672 Z" fill="#c08a72"/>');
P('<path d="M1040 670 C 1050 676 1076 676 1086 670 C 1080 678 1048 678 1040 670 Z" fill="#4a2f30" opacity="0.8"/>');
P('<path d="M1052 700 C 1058 706 1066 706 1072 700 L 1070 712 L 1054 712 Z" fill="#9a6a5c"/>');
P('</g>');
P('<path d="M1040 678 C 1038 690 1044 698 1052 700" fill="none" stroke="#f0c49e" stroke-width="3" opacity="0.75" filter="url(#b1)"/>');
// C body: hard shade side + rim so nothing passes through it
P('<path d="M1056 704 C 1066 762 1068 842 1064 902 L 1112 904 L 1112 704 Z" fill="#7a6f9a" opacity="0.85" filter="url(#b2)"/>');
P('<path d="M1088 708 C 1096 782 1096 860 1090 904 L 1112 904 L 1112 708 Z" fill="#5c5480" opacity="0.8" filter="url(#b2)"/>');
P('<path d="M1012 708 C 1000 762 994 820 992 882" fill="none" stroke="#fffbe8" stroke-width="7" opacity="0.65" filter="url(#b2)"/>');
P('<ellipse cx="1060" cy="644" rx="58" ry="17" fill="#e2cd9d"/>');
P('<path d="M1032 642 C 1040 620 1080 620 1088 642 Z" fill="#f0e0b6"/>');
P('<path d="M1022 668 q36 -12 72 0 q-10 12 -36 12 q-26 0 -36 -12 z" fill="' + CORAL + '" opacity="0.92"/>');
P('<ellipse cx="1060" cy="646" rx="58" ry="17" fill="none" stroke="#bda072" stroke-width="2.5" opacity="0.55"/>');
P('</g>');
P('<path d="M1006 648 C 1022 660 1050 666 1076 664" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.5" filter="url(#b2)"/>');
P('<path d="M1012 710 C 994 756 984 810 980 862" fill="none" stroke="#fff6e4" stroke-width="4" opacity="0.6" filter="url(#b2)"/>');
P('<ellipse cx="980" cy="916" rx="12" ry="9" fill="' + SKIN_SH + '"/>');
P('<ellipse cx="1098" cy="914" rx="12" ry="9" fill="#7d544c"/>');

// ---- OLD WOMAN (left edge)
P('<g filter="url(#rough)">');
P('<path d="M92 706 C 106 702 118 710 120 726 L 124 794 L 74 796 L 72 730 C 74 714 80 708 92 706 Z" fill="#f7f2e2"/>');
P('<path d="M72 790 L 126 788 L 136 862 L 64 864 Z" fill="' + CORAL + '"/>');
P('<path d="M82 858 L 88 902 L 100 902 L 100 858 Z" fill="#5e4e4c"/>');
P('<path d="M112 858 L 116 902 L 126 902 L 122 860 Z" fill="#5e4e4c"/>');
P('<ellipse cx="94" cy="696" rx="14" ry="15" fill="' + SKIN_SH + '"/>');
P('<path d="M80 694 C 80 680 88 672 96 672 C 106 672 112 682 112 694 Z" fill="#42312b"/>');
P('<circle cx="85" cy="683" r="8" fill="#42312b"/>');
P('<path d="M120 740 L 130 792 L 122 796 L 112 748 Z" fill="' + SKIN_SH + '"/>');
P('<path d="M138 800 L 162 798 L 158 836 L 142 836 Z" fill="#c6d1cd"/>');
P('<path d="M138 800 L 162 798 L 160 806 L 140 808 Z" fill="#e9f1ed"/>');
P('</g>');
P('<ellipse cx="106" cy="906" rx="46" ry="9" fill="#524a72" opacity="0.55" filter="url(#b5)"/>');
P('<path d="M72 732 L 72 792" stroke="#fffdf2" stroke-width="3" opacity="0.8" filter="url(#b1)"/>');

// ================= NET =================
P('<g filter="url(#rough)">');
P('<path d="M560 880 C 620 906 700 900 760 872 C 830 840 890 850 916 900 C 940 946 916 1010 860 1046 C 800 1084 706 1104 630 1090 C 560 1078 512 1030 508 980 C 506 936 526 898 560 880 Z" fill="#cbc7ae" opacity="0.12"/>');
P('<path d="M560 880 C 620 906 700 900 760 872 C 830 840 890 850 916 900 C 940 946 916 1010 860 1046 C 800 1084 706 1104 630 1090 C 560 1078 512 1030 508 980 C 506 936 526 898 560 880 Z" fill="url(#netP)" opacity="0.22"/>');
P('</g>');
// net folds + weight
{
  const c = [];
  for (let i = 0; i < 46; i++) {
    const x = rr(510, 920), y = rr(870, 1100);
    c.push([rnd() > 0.55 ? '#fffdf0' : (rnd() > 0.4 ? '#96a0a0' : '#7a7096'), rr(3, 10), rr(0.08, 0.22), dash(x, y, x + rr(-40, 40), y + rr(-26, 34), rr(-8, 8))]);
  }
  P(strokes(c, 'b2'));
}
// net drape over B's hands (darker, in shadow under the cloth)
P('<path d="M748 826 C 780 860 830 866 890 844" fill="none" stroke="#7b7096" stroke-width="9" opacity="0.35" filter="url(#b5)"/>');
P('<path d="M520 900 C 560 940 620 956 690 950" fill="none" stroke="#7b7096" stroke-width="8" opacity="0.28" filter="url(#b5)"/>');
// net cast shadow
P('<path d="M540 920 C 620 950 700 946 780 916 C 850 890 902 916 916 962" fill="none" stroke="#6d6289" stroke-width="12" opacity="0.22" filter="url(#b14)"/>');
// floats
{
  const c = [];
  for (let i = 0; i < 18; i++) {
    const x = rr(512, 916), y = rr(880, 1096);
    c.push(['#fff6dc', rr(5, 10), rr(0.35, 0.75), dash(x, y, x + rr(6, 16), y + rr(-3, 3), 0)]);
  }
  P(strokes(c, 'b1'));
}

// ================= CRATES / FISH / ICE / COOLER =================
// cyan crate in front of A (sunlit, shows top plane)
P('<g filter="url(#rough)">');
P('<path d="M486 902 L 612 892 L 622 918 L 496 928 Z" fill="#8fc4c4"/>');           // top, lit
P('<path d="M496 928 L 622 918 L 630 1002 L 502 1014 Z" fill="#4a848b"/>');        // front
P('<path d="M622 918 L 630 1002 L 642 992 L 634 910 Z" fill="#356a72"/>');         // right side
P('<path d="M502 942 L 626 932 L 628 944 L 503 955 Z" fill="#28585f" opacity="0.7"/>');
P('<path d="M503 966 L 627 955 L 629 967 L 504 979 Z" fill="#28585f" opacity="0.65"/>');
P('<path d="M504 990 L 628 979 L 629 991 L 505 1003 Z" fill="#28585f" opacity="0.6"/>');
P('</g>');
// fish in the crate
P('<g filter="url(#rough)">');
P('<path d="M512 900 q26 -14 50 -4 q-8 16 -26 18 q-18 2 -24 -14 z" fill="#e9eeea"/>');
P('<path d="M540 898 q16 -8 30 2 q-12 10 -30 8 z" fill="#c2d2ce"/>');
P('<path d="M516 894 q24 -12 46 -4" stroke="#ffffff" stroke-width="2.6" opacity="0.85" filter="url(#b1)"/>');
P('<path d="M556 918 q26 -16 52 -4 q-10 18 -30 20 q-20 2 -22 -16 z" fill="#dfe7e2"/>');
P('<path d="M584 914 q16 -8 30 2 q-12 10 -30 8 z" fill="#b6c7c3"/>');
P('<path d="M560 944 q28 -16 54 -2 q-12 18 -32 20 q-20 2 -22 -18 z" fill="' + ORANGE + '"/>');
P('<path d="M590 940 q16 -6 28 4 q-12 10 -28 8 z" fill="#c8511e"/>');
P('<path d="M568 939 q22 -10 42 -2" stroke="#ffbf96" stroke-width="2.6" opacity="0.9" filter="url(#b1)"/>');
P('</g>');
// coral crate (tipped, in the sun near B's feet)
P('<g transform="rotate(-5 700 1030)" filter="url(#rough)">');
P('<path d="M636 992 L 754 984 L 760 1008 L 642 1016 Z" fill="#e08b72"/>');
P('<path d="M642 1016 L 760 1008 L 768 1082 L 648 1090 Z" fill="#b4553f"/>');
P('<path d="M760 1008 L 768 1082 L 780 1072 L 772 1000 Z" fill="#8e3f30"/>');
P('<path d="M648 1030 L 762 1022 L 764 1034 L 649 1042 Z" fill="#7d3628" opacity="0.7"/>');
P('<path d="M649 1054 L 764 1046 L 766 1058 L 650 1066 Z" fill="#7d3628" opacity="0.65"/>');
P('</g>');
// dark crate (in shade, far right of the group)
P('<g filter="url(#rough)">');
P('<path d="M902 966 L 998 958 L 1006 982 L 910 990 Z" fill="#6b7a95"/>');
P('<path d="M910 990 L 1006 982 L 1012 1058 L 916 1066 Z" fill="#313c52"/>');
P('<path d="M1006 982 L 1012 1058 L 1022 1048 L 1016 974 Z" fill="#222a3c"/>');
P('<path d="M916 1006 L 1008 998 L 1010 1010 L 917 1018 Z" fill="#1b2130" opacity="0.8"/>');
P('<path d="M917 1032 L 1010 1024 L 1011 1036 L 918 1044 Z" fill="#1b2130" opacity="0.75"/>');
P('</g>');
// ice bucket (in shade)
P('<g filter="url(#rough)">');
P('<path d="M1000 966 L 1082 958 L 1090 984 L 1008 992 Z" fill="#f4f7f2"/>');
P('<path d="M1008 992 L 1090 984 L 1082 1062 L 1016 1070 Z" fill="#cdd6d3"/>');
P('<path d="M1090 984 L 1082 1062 L 1092 1052 L 1100 976 Z" fill="#aab6b4"/>');
P('</g>');
{
  const c = [];
  for (let i = 0; i < 26; i++) {
    const x = rr(1010, 1086), y = rr(966, 1010);
    c.push([rnd() > 0.4 ? '#ffffff' : '#d4e8ee', rr(4, 9), rr(0.35, 0.85), dash(x, y, x + rr(4, 14), y + rr(-4, 4), 0)]);
  }
  P(strokes(c, 'b1'));
}
// cooler + phone
P('<g filter="url(#rough)">');
P('<path d="M1112 974 L 1200 966 L 1208 990 L 1120 998 Z" fill="#fbfdf6"/>');
P('<path d="M1120 998 L 1208 990 L 1214 1050 L 1126 1058 Z" fill="#d9ded6"/>');
P('<path d="M1208 990 L 1214 1050 L 1224 1040 L 1218 982 Z" fill="#b9c1b9"/>');
P('</g>');
P('<g><path d="M1146 950 L 1182 947 L 1188 984 L 1152 987 Z" fill="#2b2937" filter="url(#rough)"/>' +
  '<path d="M1150 954 L 1179 951 L 1184 978 L 1155 981 Z" fill="#3d3b4c"/>' +
  '<path d="M1153 956 L 1170 955 L 1154 976 Z" fill="#d7e0e4" opacity="0.6"/>' +
  '<path d="M1146 950 L 1182 947" stroke="#ffffff" stroke-width="2.4" opacity="0.9" filter="url(#b1)"/></g>');
// wet ground under the ice
P('<ellipse cx="1050" cy="1076" rx="62" ry="14" fill="#8f84aa" opacity="0.5" filter="url(#b3)"/>');
P('<ellipse cx="1044" cy="1073" rx="34" ry="6" fill="#ffffff" opacity="0.4" filter="url(#b2)"/>');

// ================= CONTACT SHADOWS =================
P('<ellipse cx="546" cy="1008" rx="88" ry="16" fill="#7d7299" opacity="0.35" filter="url(#b8)"/>');
P('<ellipse cx="842" cy="1056" rx="90" ry="15" fill="#7d7299" opacity="0.32" filter="url(#b8)"/>');
P('<ellipse cx="1064" cy="986" rx="78" ry="13" fill="#4c4468" opacity="0.3" filter="url(#b8)"/>');
P('<ellipse cx="1150" cy="1060" rx="60" ry="11" fill="#4c4468" opacity="0.28" filter="url(#b8)"/>');
// B's cast shadow to the right
P('<path d="M900 1050 C 960 1064 1010 1072 1060 1066" fill="none" stroke="#7d7299" stroke-width="16" opacity="0.22" filter="url(#b14)"/>');
// A's cast shadow
P('<path d="M640 1000 C 700 1016 750 1024 800 1020" fill="none" stroke="#7d7299" stroke-width="14" opacity="0.2" filter="url(#b14)"/>');

// dark anchor: deep corner under the awning
P('<path d="M1020 560 L 1600 520 L 1600 1218 L 980 1218 Z" fill="#3a3357" opacity="0.16" filter="url(#b24)"/>');
P('<path d="M1300 900 L 1600 880 L 1600 1218 L 1240 1218 Z" fill="#2e2848" opacity="0.22" filter="url(#b24)"/>');
// awning shadow on the ground and the wall base
P('<path d="M700 900 C 820 860 980 826 1120 800 L 1200 806 C 1040 848 860 890 740 940 Z" fill="#5e5480" opacity="0.28" filter="url(#b24)"/>');
// contact shadows under the crates
P('<ellipse cx="560" cy="1016" rx="86" ry="14" fill="#4d4568" opacity="0.45" filter="url(#b6)"/>');
P('<ellipse cx="700" cy="1092" rx="78" ry="12" fill="#4d4568" opacity="0.4" filter="url(#b6)"/>');
P('<ellipse cx="956" cy="1068" rx="64" ry="11" fill="#2f2947" opacity="0.45" filter="url(#b6)"/>');
P('<ellipse cx="1076" cy="1072" rx="52" ry="10" fill="#2f2947" opacity="0.4" filter="url(#b6)"/>');
P('<ellipse cx="1180" cy="1058" rx="58" ry="10" fill="#2f2947" opacity="0.4" filter="url(#b6)"/>');
// ================= AIR =================
P('<ellipse cx="300" cy="260" rx="700" ry="460" fill="#ffffff" opacity="0.14" filter="url(#b48)"/>');
P('<rect x="0" y="1020" width="1600" height="200" fill="#ffe9bf" opacity="0.12" filter="url(#b48)"/>');
// edge dissolve
{
  const c = [];
  for (let i = 0; i < 40; i++) {
    const x = rr(430, 1120), y = rr(500, 1000);
    c.push([rnd() > 0.5 ? '#fffdf2' : '#cfc4dc', rr(3, 9), rr(0.05, 0.16), dash(x, y, x + rr(-26, 26), y + rr(-26, 26), rr(-6, 6))]);
  }
  P(strokes(c, 'b5'));
}
// ================= GRAIN =================
P('<rect width="1600" height="1200" filter="url(#grain)" opacity="0.15"/>');
P('</svg>');

fs.writeFileSync(OUT, out.join('\n'));
// black-silhouette test
const t = ['<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200"><rect width="1600" height="1200" fill="#c9c9c9"/>'];
for (const p of figShapes) t.push('<path d="' + p + '" fill="#111"/>');
t.push('<path d="M92 706 C 106 702 118 710 120 726 L 124 794 L 74 796 L 72 730 C 74 714 80 708 92 706 Z" fill="#333"/><path d="M72 790 L 126 788 L 136 862 L 64 864 Z" fill="#333"/><path d="M82 858 L 88 902 L 100 902 L 100 858 Z" fill="#333"/><path d="M112 858 L 116 902 L 126 902 L 122 860 Z" fill="#333"/><ellipse cx="94" cy="696" rx="14" ry="15" fill="#333"/>');
t.push('</svg>');
fs.writeFileSync(TEST, t.join('\n'));
console.log('ok', out.join('\n').length);
