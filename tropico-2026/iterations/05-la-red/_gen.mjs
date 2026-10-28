
import fs from 'node:fs';
const OUT = 'F:/repo-aiscan2/tropico-2026/iterations/05-la-red/la-red.svg';

let S = 5052026;
const rnd = () => { S = (S * 1103515245 + 12345) & 0x7fffffff; return S / 0x7fffffff; };
const rr = (a, b) => a + (b - a) * rnd();
const f = n => Math.round(n * 10) / 10;
function dash(x1, y1, x2, y2, bow) {
  bow = bow || 0;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  return 'M' + f(x1) + ' ' + f(y1) + 'Q' + f(mx + (-dy / len) * bow) + ' ' + f(my + (dx / len) * bow) + ' ' + f(x2) + ' ' + f(y2);
}
function strokes(cmds, filter) {
  const m = new Map();
  for (const [c, w, op, d] of cmds) {
    const k = c + '|' + Math.round(w) + '|' + (Math.round(op * 40) / 40);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(d);
  }
  let s = '';
  for (const [k, arr] of m) { const p = k.split('|');
    s += '<path d="' + arr.join('') + '" fill="none" stroke="' + p[0] + '" stroke-width="' + p[1] + '" stroke-opacity="' + p[2] + '" stroke-linecap="round"/>'; }
  return filter ? '<g filter="url(#' + filter + ')">' + s + '</g>' : s;
}
const out = [];
const P = s => out.push(s);

// ---- TEMPERATURE RAMP (the moving zero) ----
const T_BLACK='#04060c', T_NIGHT='#080d1a', T_DEEP='#0d1a2e', T_BLUE='#123049',
      T_TEAL='#16475f', T_CYAN='#1f7183', T_CYAN2='#2f97a4', T_CYAN3='#57b8bc',
      T_MAG='#8e3068', T_MAG2='#c04a7e', T_MAG3='#e0708f',
      T_ORANGE='#f79a4c', T_AMBER='#ffc987', T_WHITE='#fff4dc', T_CORE='#ffffff';

P('<?xml version="1.0" encoding="UTF-8"?>');
P('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200" width="1600" height="1200">');
P('<defs>');
for (const [id, sd] of [['b1',1],['b2',2],['b3',3],['b5',5],['b8',8],['b14',14],['b26',26],['b46',46],['b80',80]])
  P('<filter id="'+id+'" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="'+sd+'"/></filter>');
// heat-edge wobble: the whole scene is organised by the sensor
P('<filter id="warp" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.0085" numOctaves="3" seed="17" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="13" xChannelSelector="R" yChannelSelector="G"/></filter>');
P('<filter id="warpS" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter>');
// sensor noise
P('<filter id="noise" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.72  0 0 0 0 1  0.22 0.22 0.22 0 0"/></filter>');
P('<filter id="blotch" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="21"/><feColorMatrix type="matrix" values="0 0 0 0 0.30  0 0 0 0 0.55  0 0 0 0 0.70  0.55 0.55 0.55 0 -0.18"/></filter>');
// gradients
P('<linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070e"/><stop offset="0.45" stop-color="#080e1c"/><stop offset="0.8" stop-color="#0e172b"/><stop offset="1" stop-color="#182740"/></linearGradient>');
P('<radialGradient id="cityGlow" cx="0.5" cy="1" r="0.75"><stop offset="0" stop-color="#7d2a58" stop-opacity="0.55"/><stop offset="0.45" stop-color="#4a1f42" stop-opacity="0.3"/><stop offset="1" stop-color="#4a1f42" stop-opacity="0"/></radialGradient>');
P('<linearGradient id="roadG" x1="0.5" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#0b1a2a"/><stop offset="0.28" stop-color="#123951"/><stop offset="0.62" stop-color="#17566a"/><stop offset="1" stop-color="#123c4e"/></linearGradient>');
P('<linearGradient id="wallL" x1="0" y1="0" x2="1" y2="0.2"><stop offset="0" stop-color="#39163a"/><stop offset="0.35" stop-color="#5b2050"/><stop offset="0.7" stop-color="#7a2c5e"/><stop offset="1" stop-color="#48193f"/></linearGradient>');
P('<linearGradient id="wallR" x1="1" y1="0" x2="0.2" y2="0.4"><stop offset="0" stop-color="#2d1230"/><stop offset="0.5" stop-color="#4d1d47"/><stop offset="1" stop-color="#33143a"/></linearGradient>');
P('<radialGradient id="doorG" cx="0.45" cy="0.75" r="0.8"><stop offset="0" stop-color="#ffd9a0"/><stop offset="0.28" stop-color="#ff9a52"/><stop offset="0.6" stop-color="#c04a4e"/><stop offset="1" stop-color="#6b1f3e"/></radialGradient>');
P('<radialGradient id="haloG" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff8fb0" stop-opacity="0.6"/><stop offset="0.35" stop-color="#c2316c" stop-opacity="0.5"/><stop offset="1" stop-color="#7d2050" stop-opacity="0"/></radialGradient>');
P('<linearGradient id="bodyG" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.22" stop-color="#fff0c8"/><stop offset="0.5" stop-color="#ffb877"/><stop offset="0.78" stop-color="#d4517a"/><stop offset="1" stop-color="#6b2350"/></linearGradient>');
P('<linearGradient id="carG" x1="0.1" y1="0" x2="0.9" y2="1"><stop offset="0" stop-color="#4a1b44"/><stop offset="0.45" stop-color="#2a1838"/><stop offset="0.75" stop-color="#1b2440"/><stop offset="1" stop-color="#11192c"/></linearGradient>');
P('<linearGradient id="ramp" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#05070e"/><stop offset="0.25" stop-color="#16475f"/><stop offset="0.45" stop-color="#2f97a4"/><stop offset="0.62" stop-color="#8e3068"/><stop offset="0.78" stop-color="#e0708f"/><stop offset="0.9" stop-color="#ffb877"/><stop offset="1" stop-color="#fff4dc"/></linearGradient>');
P('<pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity="0.55"/></pattern>');
P('<pattern id="mb8" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="1" fill="#7fe0ea" opacity="0.10"/></pattern>');
P('</defs>');
P('<rect width="1600" height="1200" fill="'+T_BLACK+'"/>');

// ================= SCENE (organised by the sensor) =================
P('<g filter="url(#warp)">');

// ---- sky: the coldest thing, and what every roof is losing heat to
P('<rect width="1600" height="480" fill="url(#skyG)"/>');
P('<ellipse cx="820" cy="480" rx="980" ry="130" fill="url(#cityGlow)"/>');
P('<path d="M0 352 C 170 330 320 346 470 328 C 640 306 770 330 930 320 C 1100 308 1250 336 1420 324 C 1510 318 1560 326 1600 320 L 1600 480 L 0 480 Z" fill="#05080f"/>');
P('<path d="M0 366 C 200 348 340 360 500 344 C 660 328 780 348 940 338 C 1110 328 1260 352 1430 342 L 1600 340 L 1600 480 L 0 480 Z" fill="#070c16"/>');
{
  const c = [];
  for (let i = 0; i < 18; i++) { const x = rr(60, 1560), y = rr(340, 366);
    c.push(['#0d1626', rr(20, 80), rr(0.2, 0.5), dash(x, y, x + rr(60, 200), y + rr(-4, 4), 0)]); }
  P(strokes(c, 'b5'));
}
// skyline: verticals, cold roofs, a few windows that are still awake
const BL = [[0,392,104],[104,376,72],[176,404,58],[234,362,86],[320,386,64],[384,406,48],[432,372,92],[524,394,60],[584,366,78],[662,398,52],[714,380,70],[784,402,58],[842,368,84],[926,392,64],[990,376,70],[1060,400,54],[1114,380,66],[1180,398,58],[1238,370,80],[1318,394,60],[1378,406,52],[1430,378,74],[1504,396,96]];
BL.forEach(function (b, i) {
  P('<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + (486 - b[1]) + '" fill="' + (i % 3 === 0 ? '#070b14' : (i % 3 === 1 ? '#05090f' : '#080d17')) + '"/>');
  P('<rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="4" fill="#1b2a40" opacity="0.85"/>');
});
P('<path d="M560 366 L 560 322" stroke="#080d16" stroke-width="2.5"/><path d="M520 322 L 600 322" stroke="#080d16" stroke-width="2"/><path d="M546 322 L 560 306 L 574 322" stroke="#080d16" stroke-width="1.6" fill="none"/>');
P('<path d="M1420 378 L 1420 296" stroke="#070c15" stroke-width="3"/><path d="M1396 318 L 1444 318" stroke="#070c15" stroke-width="2"/><path d="M1400 300 L 1440 300" stroke="#061020" stroke-width="2"/>');
P('<g><rect x="1268" y="330" width="46" height="40" fill="#070c15"/><path d="M1262 334 L 1268 330 L 1314 330 L 1320 334 L 1320 372 L 1262 372 Z" fill="#0a111c"/><path d="M1268 342 L 1316 342" stroke="#141d2c" stroke-width="1.5"/></g>');
// the ones still awake: tiny hot windows. Other people, in other rooms.
P('<g filter="url(#b2)">');
const WIN = [[120,410],[262,436],[452,392],[606,424],[700,410],[866,432],[1010,416],[1150,440],[1290,404],[1462,420],[300,452],[760,450]];
WIN.forEach(function (w, i) { P('<rect x="' + w[0] + '" y="' + w[1] + '" width="' + (i % 4 === 0 ? 9 : 6) + '" height="4" fill="#ffb877" opacity="' + (0.45 + ((i * 7) % 3) * 0.15) + '"/>'); });
P('</g>');
P('<ellipse cx="470" cy="424" rx="60" ry="26" fill="#8e3068" opacity="0.13" filter="url(#b26)"/>');
P('<ellipse cx="1290" cy="430" rx="70" ry="30" fill="#8e3068" opacity="0.11" filter="url(#b26)"/>');
// the roof band: horizontal surfaces see the sky. Cold.
P('<path d="M0 466 L 1600 456 L 1600 506 L 0 522 Z" fill="#060a12"/>');
{
  const c = [];
  for (let i = 0; i < 40; i++) { const x = rr(10, 1590), y = rr(474, 512);
    c.push([rnd() > 0.5 ? '#5f2048' : '#2a1738', rr(3, 9), rr(0.08, 0.24), dash(x, y, x + rr(16, 70), y + rr(-2, 2), 0)]); }
  P(strokes(c, 'b5'));
}
// ---- ground plane: cool, the road losing heat cool, the road losing heat
P('<path d="M0 470 L 1600 456 L 1600 1200 L 0 1200 Z" fill="url(#roadG)"/>');
// kerb + pavement band (colder, concrete)
P('<path d="M0 486 L 1600 470 L 1600 560 L 0 600 Z" fill="#0c1f2b" opacity="0.85"/>');
// the road proper, receding
P('<path d="M330 1210 L 1130 470 L 1310 470 L 1180 1210 Z" fill="#164a5c" opacity="0.85"/>');
P('<path d="M340 1210 L 1120 486 L 1160 486 L 900 1210 Z" fill="#1c5c6c" opacity="0.55" filter="url(#b8)"/>');
// centre line: warm paint? paint is a different emissivity - keep it cold, a ghost
P('<path d="M700 1210 L 1080 486 L 1100 486 L 760 1210 Z" fill="#2b8f96" opacity="0.16" filter="url(#b5)"/>');
// tyre tracks: warm rubber / traffic history
P('<path d="M600 1210 C 760 900 960 640 1090 500" fill="none" stroke="#3a2560" stroke-width="34" opacity="0.45" filter="url(#b14)"/>');
P('<path d="M830 1210 C 930 900 1040 640 1110 500" fill="none" stroke="#3a2560" stroke-width="30" opacity="0.38" filter="url(#b14)"/>');
// manhole: warm (a sewer under it)
P('<ellipse cx="520" cy="1076" rx="46" ry="16" fill="#5b2a52" opacity="0.85" filter="url(#b5)"/>');
P('<ellipse cx="520" cy="1076" rx="30" ry="10" fill="#8a3a62" opacity="0.5" filter="url(#b5)"/>');
// damp patch / litter
P('<path d="M300 1010 C 360 998 420 1002 470 1014 C 430 1030 350 1032 300 1022 Z" fill="#0f3140" opacity="0.5" filter="url(#b8)"/>');

// ---- kerbs: the two lines that give the street its depth
P('<path d="M0 1210 L 118 1210 L 700 512 L 660 500 Z" fill="#04101a" opacity="0.55"/>');
P('<path d="M0 1210 L 118 1210 L 700 512 L 660 500 Z" fill="none" stroke="#57b8bc" stroke-width="1.5" opacity="0.13"/>');
P('<path d="M1600 1210 L 1470 1210 L 902 508 L 946 496 Z" fill="#04101a" opacity="0.5"/>');
P('<path d="M1600 1210 L 1470 1210 L 902 508 L 946 496 Z" fill="none" stroke="#57b8bc" stroke-width="1.5" opacity="0.10"/>');
P('<g opacity="0.9"><rect x="368" y="1112" width="86" height="34" fill="#04070d"/><path d="M374 1116 L 374 1142 M 386 1116 L 386 1142 M 398 1116 L 398 1142 M 410 1116 L 410 1142 M 422 1116 L 422 1142 M 434 1116 L 434 1142 M 446 1116 L 446 1142" stroke="#16303f" stroke-width="3"/></g>');
P('<g><path d="M548 1024 L 566 1024 L 570 1150 L 544 1150 Z" fill="#05080f"/><path d="M540 1022 L 574 1022 L 572 1014 L 542 1014 Z" fill="#0c1622"/><path d="M544 1028 L 548 1030 L 550 1148 L 546 1148 Z" fill="#17303f" opacity="0.7"/></g>');
P('<ellipse cx="558" cy="1152" rx="34" ry="8" fill="#02040a" opacity="0.7" filter="url(#b5)"/>');
P('<path d="M0 1088 C 240 1064 420 1058 620 1074 L 620 1210 L 0 1210 Z" fill="#071019" opacity="0.72" filter="url(#b8)"/>');
P('<path d="M0 1088 C 240 1064 420 1058 620 1074" fill="none" stroke="#25505f" stroke-width="3" opacity="0.32" filter="url(#b2)"/>');
// ---- left building: a wall that held the day's sun. Warm.
P('<path d="M0 186 L 370 296 L 376 700 L 0 1210 Z" fill="url(#wallL)"/>');
P('<path d="M0 186 L 370 296 L 372 330 L 0 224 Z" fill="#94365f" opacity="0.55" filter="url(#b5)"/>');
// vertical heat variation on the wall (top edges warmer)
P('<path d="M0 200 L 370 306 L 372 420 L 0 330 Z" fill="#b04a6e" opacity="0.28" filter="url(#b26)"/>');
// doorway: the interior is HOT - a piece of the day still in there
P('<path d="M126 748 L 238 758 L 234 1050 L 124 1050 Z" fill="#2a0f2c"/>');
P('<path d="M136 762 L 228 770 L 225 1044 L 134 1044 Z" fill="url(#doorG)"/>');
P('<path d="M136 762 L 228 770 L 226 900 L 135 896 Z" fill="#b34a4e" opacity="0.4"/>');
P('<path d="M136 900 L 226 902 L 225 1044 L 134 1044 Z" fill="#ffc37c" opacity="0.32"/>');
P('<path d="M136 762 L 228 770 L 225 1044 L 134 1044 Z" fill="none" stroke="#ffca8e" stroke-width="3" opacity="0.45"/>');
P('<path d="M202 766 L 228 770 L 225 1044 L 198 1042 Z" fill="#170b1c" opacity="0.8"/>');
P('<path d="M118 1050 L 244 1050 L 272 1084 L 94 1084 Z" fill="#2b1226"/>');
P('<ellipse cx="184" cy="1080" rx="110" ry="22" fill="#ff9a52" opacity="0.18" filter="url(#b14)"/>');
P('<ellipse cx="184" cy="1076" rx="56" ry="12" fill="#ffcf96" opacity="0.28" filter="url(#b5)"/>');
// shop window: opaque to the instrument. A blank. Nothing in it.
P('<path d="M286 690 L 356 696 L 352 920 L 282 916 Z" fill="#02040a"/>');
P('<path d="M286 690 L 356 696 L 355 704 L 285 698 Z" fill="#16202e" opacity="0.8"/>');
P('<path d="M286 690 L 356 696 L 352 920 L 282 916 Z" fill="none" stroke="#243244" stroke-width="2" opacity="0.6"/>');
// shutters, pipes, AC unit on the wall
P('<path d="M40 520 L 110 526 L 108 640 L 38 634 Z" fill="#2a1130" opacity="0.8"/>');
P('<path d="M44 530 L 106 536 M 42 556 L 106 562 M 41 582 L 106 588 M 40 608 L 106 614" stroke="#48193f" stroke-width="3" opacity="0.7"/>');
P('<rect x="250" y="500" width="54" height="40" fill="#1a2233" opacity="0.9"/>');
P('<rect x="250" y="500" width="54" height="40" fill="none" stroke="#2c3a4e" stroke-width="1.5"/>');

// ---- right building + pole
P('<path d="M1230 330 L 1600 268 L 1600 1010 L 1230 720 Z" fill="url(#wallR)"/>');
P('<path d="M1230 330 L 1600 268 L 1600 300 L 1230 362 Z" fill="#8a3560" opacity="0.4" filter="url(#b5)"/>');
// dish: cold, a dark curve with one cool rim
P('<g opacity="0.85"><ellipse cx="1440" cy="596" rx="48" ry="42" fill="#0a1020"/><path d="M1400 574 C 1420 548 1466 552 1478 590" fill="none" stroke="#1d3a52" stroke-width="3" opacity="0.9"/><path d="M1440 596 L 1440 660" stroke="#0c1422" stroke-width="6"/><path d="M1428 660 L 1452 660" stroke="#16202e" stroke-width="5"/></g>');

// right wall detail
P('<path d="M1230 470 L 1600 420 L 1600 440 L 1230 490 Z" fill="#2a1430"/>');
P('<g opacity="0.9"><rect x="1300" y="760" width="86" height="112" fill="#1a1128"/><path d="M1304 772 L 1382 772 M 1304 796 L 1382 796 M 1304 820 L 1382 820 M 1304 844 L 1382 844" stroke="#4a1d47" stroke-width="6" opacity="0.8"/></g>');
P('<g><rect x="1470" y="700" width="66" height="44" fill="#160f22"/><rect x="1470" y="700" width="66" height="44" fill="none" stroke="#2c2038" stroke-width="1.5"/><path d="M1478 712 L 1528 712 M 1478 722 L 1528 722 M 1478 732 L 1528 732" stroke="#241a30" stroke-width="2"/></g>');
// ---- utility pole + cables (the camera's own hardware, or the one it watches)
P('<path d="M1342 150 L 1354 1210 L 1400 1210 L 1390 150 Z" fill="#0a0f18"/>');
P('<path d="M1346 156 L 1356 1200 L 1364 1200 L 1356 156 Z" fill="#1b2434" opacity="0.7"/>');
P('<path d="M1310 236 L 1430 230" stroke="#0b1220" stroke-width="9"/>');
P('<path d="M1312 292 L 1428 286" stroke="#0b1220" stroke-width="7"/>');
// cables across the frame
P('<path d="M1340 232 C 1080 300 760 330 430 300" fill="none" stroke="#070c14" stroke-width="4"/>');
P('<path d="M1346 240 C 1090 310 770 342 436 312" fill="none" stroke="#0a1018" stroke-width="2.5"/>');
P('<path d="M1350 290 C 1120 372 820 402 470 366" fill="none" stroke="#070c14" stroke-width="3.5"/>');
P('<path d="M1360 300 C 1140 384 840 414 480 380" fill="none" stroke="#0a1018" stroke-width="2"/>');
// a cable drops to the left building
P('<path d="M436 306 C 400 330 380 360 372 404" fill="none" stroke="#080d15" stroke-width="3"/>');

// ---- palm: cold, almost invisible, a hole in the temperature
P('<path d="M1188 470 C 1196 400 1200 340 1206 300" stroke="#05080f" stroke-width="9" fill="none"/>');
P('<path d="M1206 306 C 1160 268 1120 262 1086 274" stroke="#05080f" stroke-width="7" fill="none"/>');
P('<path d="M1206 306 C 1250 262 1296 258 1330 272" stroke="#05080f" stroke-width="7" fill="none"/>');
P('<path d="M1206 302 C 1176 258 1180 232 1200 214" stroke="#05080f" stroke-width="6" fill="none"/>');
P('<path d="M1208 302 C 1244 268 1250 236 1234 216" stroke="#05080f" stroke-width="6" fill="none"/>');
P('<path d="M1204 310 C 1150 300 1112 314 1090 340" stroke="#05080f" stroke-width="5" fill="none"/>');
P('<path d="M1208 310 C 1262 302 1300 316 1322 342" stroke="#05080f" stroke-width="5" fill="none"/>');

// ---- parked car: still cooling. Body mostly cool, engine bay warm.
P('<g filter="url(#warpS)">');
P('<path d="M1064 972 C 1074 934 1112 916 1176 912 L 1258 910 C 1300 912 1322 928 1330 958 L 1336 1006 L 1064 1014 Z" fill="url(#carG)"/>');
P('<path d="M1102 918 C 1128 890 1186 884 1222 892 C 1244 898 1256 908 1262 918 Z" fill="#151a2c"/>');
// windscreen: glass is opaque to the sensor - blank
P('<path d="M1118 918 C 1140 898 1178 892 1206 898 L 1198 916 L 1130 920 Z" fill="#03050b"/>');
P('<path d="M1130 920 L 1198 916" stroke="#2a3c50" stroke-width="2" opacity="0.6"/>');
// engine bay hot
P('<ellipse cx="1112" cy="972" rx="46" ry="26" fill="#c2504e" opacity="0.55" filter="url(#b14)"/>');
P('<ellipse cx="1104" cy="966" rx="26" ry="14" fill="#ff9a52" opacity="0.55" filter="url(#b8)"/>');
P('<ellipse cx="1100" cy="964" rx="13" ry="7" fill="#ffd9a0" opacity="0.6" filter="url(#b5)"/>');
// wheels: cold
P('<ellipse cx="1112" cy="1004" rx="26" ry="14" fill="#04060c"/><ellipse cx="1288" cy="1000" rx="26" ry="14" fill="#04060c"/>');
P('<path d="M1066 1004 L 1338 996" stroke="#05070d" stroke-width="12" opacity="0.8"/>');
P('</g>');
P('<ellipse cx="1200" cy="1024" rx="150" ry="24" fill="#04060c" opacity="0.6" filter="url(#b8)"/>');

// ---- heat strokes on the road and walls (where the sensor is uneven)
{
  const c = [];
  for (let i = 0; i < 130; i++) {
    const y = rr(480, 1200), x = rr(0, 1600);
    const t = rnd();
    const col = t > 0.75 ? '#2f8f9a' : (t > 0.5 ? '#164a5c' : (t > 0.25 ? '#3a2560' : '#0a1c2a'));
    c.push([col, rr(6, 26), rr(0.05, 0.16), dash(x, y, x + rr(40, 200), y + rr(-6, 6), rr(-8, 8))]);
  }
  P(strokes(c, 'b14'));
}
// wall heat strokes
{
  const c = [];
  for (let i = 0; i < 60; i++) {
    const x = rr(0, 370), y = rr(220, 1150);
    c.push([rnd() > 0.55 ? '#a03a72' : '#3a1638', rr(5, 18), rr(0.06, 0.18), dash(x, y, x + rr(10, 60), y + rr(-60, 60), rr(-10, 10))]);
  }
  P(strokes(c, 'b8'));
}

// ================= THE EVENT: two bodies, the hottest thing in the frame =================
function person(cx, feet, h, lean) {
  const head = feet - h, sh = head + h * 0.21, hip = head + h * 0.57, w = h * 0.155;
  const L = lean || 0;
  let s = '';
  s += '<ellipse cx="' + f(cx) + '" cy="' + f(head + h * 0.36) + '" rx="' + f(h * 0.26) + '" ry="' + f(h * 0.38) + '" fill="url(#haloG)"/>';
  // legs: cooler, dissolving into the road
  s += '<path d="M' + f(cx - w * 0.52) + ' ' + f(hip - 8) + ' C ' + f(cx - w * 0.5 + L * 0.5) + ' ' + f(hip + h * 0.16) + ' ' + f(cx - w * 0.66 + L) + ' ' + f(feet - h * 0.1) + ' ' + f(cx - w * 0.52 + L) + ' ' + f(feet) + ' L ' + f(cx - w * 0.08 + L * 0.8) + ' ' + f(feet) + ' C ' + f(cx - w * 0.12) + ' ' + f(feet - h * 0.16) + ' ' + f(cx - w * 0.1) + ' ' + f(hip + h * 0.1) + ' ' + f(cx - w * 0.08) + ' ' + f(hip - 8) + ' Z" fill="#a83f6e" opacity="0.9" filter="url(#b5)"/>';
  s += '<path d="M' + f(cx + w * 0.06) + ' ' + f(hip - 8) + ' C ' + f(cx + w * 0.1) + ' ' + f(hip + h * 0.14) + ' ' + f(cx + w * 0.2 + L) + ' ' + f(feet - h * 0.12) + ' ' + f(cx + w * 0.3 + L) + ' ' + f(feet) + ' C ' + f(cx + w * 0.36) + ' ' + f(feet) + ' ' + f(cx + w * 0.5) + ' ' + f(feet) + ' ' + f(cx + w * 0.52 + L) + ' ' + f(feet) + ' C ' + f(cx + w * 0.4) + ' ' + f(feet - h * 0.18) + ' ' + f(cx + w * 0.34) + ' ' + f(hip + h * 0.08) + ' ' + f(cx + w * 0.34) + ' ' + f(hip - 8) + ' Z" fill="#8e3363" opacity="0.8" filter="url(#b5)"/>';
  // the body: one melted mass, hotter at the core
  s += '<path d="M' + f(cx - w * 0.56) + ' ' + f(sh) + ' C ' + f(cx - w * 0.74) + ' ' + f(sh + h * 0.1) + ' ' + f(cx - w * 0.6) + ' ' + f(hip - h * 0.02) + ' ' + f(cx - w * 0.5) + ' ' + f(hip + 4) +
       ' L ' + f(cx + w * 0.5) + ' ' + f(hip + 4) + ' C ' + f(cx + w * 0.62) + ' ' + f(hip - h * 0.03) + ' ' + f(cx + w * 0.74) + ' ' + f(sh + h * 0.1) + ' ' + f(cx + w * 0.54) + ' ' + f(sh) + ' Z" fill="url(#bodyG)" filter="url(#b5)"/>';
  s += '<ellipse cx="' + f(cx + L * 0.3) + '" cy="' + f(sh + h * 0.14) + '" rx="' + f(w * 0.54) + '" ry="' + f(h * 0.15) + '" fill="#ffdfa8" opacity="0.8" filter="url(#b5)"/>';
  // head, melted into the shoulders
  s += '<ellipse cx="' + f(cx + 1 + L * 0.4) + '" cy="' + f(head + h * 0.075) + '" rx="' + f(w * 0.54) + '" ry="' + f(w * 0.62) + '" fill="#ffd2a0" filter="url(#b3)"/>';
  s += '<ellipse cx="' + f(cx + 1 + L * 0.4) + '" cy="' + f(head + h * 0.065) + '" rx="' + f(w * 0.31) + '" ry="' + f(w * 0.38) + '" fill="#ffffff" filter="url(#b2)"/>';
  s += '<path d="M' + f(cx - w * 0.5 + L * 0.5) + ' ' + f(sh + 8) + ' C ' + f(cx - w * 0.2) + ' ' + f(sh - 6) + ' ' + f(cx + w * 0.22) + ' ' + f(sh - 6) + ' ' + f(cx + w * 0.5 + L * 0.5) + ' ' + f(sh + 8) + '" fill="none" stroke="#ffc794" stroke-width="' + f(h * 0.1) + '" stroke-linecap="round" filter="url(#b6)"/>';
  // arms: soft smudges, never outlines
  s += '<ellipse cx="' + f(cx - w * 0.92) + '" cy="' + f(sh + h * 0.18) + '" rx="' + f(w * 0.3) + '" ry="' + f(h * 0.1) + '" fill="#e07a5c" opacity="0.5" filter="url(#b6)"/>';
  s += '<ellipse cx="' + f(cx + w * 0.9 + L * 0.6) + '" cy="' + f(sh + h * 0.22) + '" rx="' + f(w * 0.28) + '" ry="' + f(h * 0.09) + '" fill="#c85a52" opacity="0.45" filter="url(#b6)"/>';
  s += '<path d="M' + f(cx - w * 0.34) + ' ' + f(head + h * 0.135) + ' L ' + f(cx + w * 0.34) + ' ' + f(head + h * 0.135) + '" stroke="#8e3363" stroke-width="' + f(h * 0.045) + '" opacity="0.55" filter="url(#b2)"/>';
  return s;
}
P('<g>');
P(person(718, 1000, 194, -11));
P(person(842, 986, 216, 9));

P('<ellipse cx="884" cy="896" rx="14" ry="18" fill="#ff9a52" opacity="0.5" filter="url(#b6)"/>');
P('<ellipse cx="884" cy="900" rx="6" ry="8" fill="#ffd0a0" opacity="0.5" filter="url(#b3)"/>');
{
  const c = [];
  for (let i = 0; i < 30; i++) {
    const x = rr(706, 862), y = rr(700, 812);
    c.push([rnd() > 0.5 ? '#ff8f9e' : '#d8557f', rr(3, 10), rr(0.05, 0.18), dash(x, y, x + rr(-12, 14), y - rr(24, 90), rr(-8, 8))]);
  }
  P(strokes(c, 'b14'));
}
P('</g>');
P('</g>'); // end warp scene

P('<path d="M0 980 L 1600 950 L 1600 1200 L 0 1200 Z" fill="#04060c" opacity="0.35" filter="url(#b26)"/>');
// ================= SENSOR / POST =================
// bloom on the two cores only (the moving zero)
P('<ellipse cx="742" cy="800" rx="150" ry="190" fill="#ff6d84" opacity="0.16" filter="url(#b46)"/>');
P('<ellipse cx="818" cy="790" rx="160" ry="200" fill="#ff6d84" opacity="0.14" filter="url(#b46)"/>');
// 4:2:0 chroma bleed on the bodies: a magenta ghost offset sideways
P('<g opacity="0.22" filter="url(#b3)" transform="translate(-4,0)">' + person(742, 986, 196) + person(818, 976, 208) + '</g>');
// sensor blotch gain unevenness
P('<rect width="1600" height="1200" filter="url(#blotch)" opacity="0.2"/>');
// macroblock: a square that lagged behind the frame
P('<g opacity="0.4"><rect x="858" y="812" width="16" height="16" fill="#ffcf9a"/><rect x="858" y="828" width="16" height="10" fill="#c04a7e"/><rect x="874" y="812" width="6" height="16" fill="#7a2c5e"/></g>');
P('<rect x="856" y="810" width="26" height="30" fill="url(#mb8)" opacity="0.4"/>');
// scanlines: one artefact only, very low
P('<rect width="1600" height="1200" fill="url(#scan)" opacity="0.05"/>');
// grain
P('<rect width="1600" height="1200" filter="url(#noise)" opacity="0.10"/>');
// vignette: the lens and the pole
P('<radialGradient id="vig" cx="0.46" cy="0.42" r="0.72"><stop offset="0.62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient>');
P('<rect width="1600" height="1200" fill="url(#vig)"/>');

// ================= THE MARKS (one accent: pale instrument cyan) =================
const UI = '#9fd7ea';
// bounding ticks on the two bodies
P('<g stroke="'+UI+'" stroke-width="2" fill="none" opacity="0.72">' +
  '<path d="M690 720 L 690 700 L 722 700"/><path d="M872 700 L 900 700 L 900 720"/>' +
  '<path d="M690 940 L 690 962 L 722 962"/><path d="M872 962 L 900 962 L 900 940"/>' +
  '</g>');
P('<path d="M690 720 L 690 962" stroke="'+UI+'" stroke-width="1" opacity="0.22"/>');
P('<path d="M900 700 L 900 962" stroke="'+UI+'" stroke-width="1" opacity="0.22"/>');
// reticle-less: a small range/track marker above the pair
P('<g opacity="0.5" stroke="'+UI+'" stroke-width="1.6" fill="none"><path d="M786 676 L 786 692"/><path d="M778 684 L 794 684"/></g>');
// gain / palette strip: the sensor's lookup table, and where zero is
P('<g opacity="0.55">');
P('<rect x="1538" y="60" width="14" height="230" fill="#0a0e16"/>');
P('<rect x="1538" y="60" width="14" height="230" fill="url(#ramp)"/>');
P('<path d="M1532 60 L 1560 60 M 1532 118 L 1560 118 M 1532 176 L 1560 176 M 1532 290 L 1560 290" stroke="'+UI+'" stroke-width="1.4"/>');
P('<rect x="1534" y="60" width="22" height="230" fill="none" stroke="'+UI+'" stroke-width="1.2"/>');
P('<path d="M1556 118 L 1566 114 L 1566 122 Z" fill="'+UI+'"/>');
P('</g>');
// timestamp: the format of text without the information
P('<g opacity="0.6">');
P('<rect x="64" y="1104" width="286" height="42" fill="#04080e" opacity="0.6"/>');
P('<rect x="64" y="1104" width="286" height="42" fill="none" stroke="'+UI+'" stroke-width="1" opacity="0.5"/>');
P('<g fill="'+UI+'">');
P('<rect x="76" y="1116" width="9" height="18"/><rect x="90" y="1116" width="3" height="18"/><rect x="98" y="1116" width="9" height="18"/>');
P('<rect x="116" y="1116" width="3" height="18"/><rect x="124" y="1116" width="9" height="18"/><rect x="138" y="1116" width="9" height="18"/>');
P('<rect x="156" y="1116" width="3" height="18"/><rect x="164" y="1116" width="12" height="18"/><rect x="182" y="1116" width="3" height="18"/>');
P('<rect x="194" y="1116" width="9" height="18"/><rect x="208" y="1116" width="9" height="18"/><rect x="222" y="1116" width="3" height="6"/><rect x="222" y="1128" width="3" height="6"/>');
P('<rect x="234" y="1116" width="20" height="18" opacity="0.75"/><rect x="258" y="1116" width="9" height="18"/>');
P('<rect x="272" y="1116" width="3" height="18"/><rect x="280" y="1116" width="9" height="18"/><rect x="294" y="1116" width="3" height="18"/>');
P('<rect x="302" y="1116" width="12" height="18"/><rect x="320" y="1116" width="3" height="18"/><rect x="328" y="1116" width="9" height="18"/>');
P('</g>');
P('<path d="M76 1146 L 336 1146" stroke="'+UI+'" stroke-width="1" opacity="0.35"/>');
P('</g>');
// one thin frame line, top left: the format, not the interface
P('<path d="M64 60 L 64 116 M 64 60 L 120 60" stroke="'+UI+'" stroke-width="1.4" opacity="0.35" fill="none"/>');
P('</svg>');
fs.writeFileSync(OUT, out.join('\n'));
console.log('ok', out.join('\n').length);
