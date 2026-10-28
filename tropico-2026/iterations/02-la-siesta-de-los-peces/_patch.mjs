
import fs from 'node:fs';
const D='F:/repo-aiscan2/tropico-2026/iterations/02-la-siesta-de-los-peces/';
let s=fs.readFileSync(D+'_gen.mjs','utf8');
let n=0;
function rep(a,b){ if(!s.includes(a)){ console.log('MISS',a.slice(0,46)); return;} s=s.split(a).join(b); n++; }
// sun: keep it BEHIND the cloth - a hot patch on the tarp, not a disc over it
rep('P(\'<ellipse cx="1520" cy="30" rx="300" ry="220" fill="#ffffff" opacity="0.95" filter="url(#b26)"/>\');',
    'P(\'<ellipse cx="1424" cy="118" rx="164" ry="144" fill="#fffdf0" opacity="0.85" filter="url(#b18)"/>\');');
rep('P(\'<ellipse cx="1500" cy="10" rx="150" ry="120" fill="#ffffff" opacity="0.95" filter="url(#b8)"/>\');',
    'P(\'<ellipse cx="1436" cy="98" rx="72" ry="64" fill="#ffffff" opacity="0.9" filter="url(#b6)"/>\');');
rep('P(\'<path d="M1370 0 L 1600 0 L 1600 250 L 1420 210 Z" fill="#fffdf4" opacity="0.55" filter="url(#b24)"/>\');',
    'P(\'<path d="M1300 0 L 1600 0 L 1600 200 L 1330 176 Z" fill="#fffef6" opacity="0.35" filter="url(#b24)"/>\');');
rep('P(\'<path d="M1340 60 L 1600 30 L 1600 62 L 1350 96 Z" fill="#fff6dd" opacity="0.5" filter="url(#b14)"/>\');',
    'P(\'<path d="M1336 210 L 1600 150 L 1600 186 L 1342 250 Z" fill="#fff2cc" opacity="0.45" filter="url(#b14)"/>\');');
// C: a solid, darker body in the shade - the figure must not read as a veil
rep('<path d="\' + C_TORSO + \'" fill="#cfc8dd"/>', '<path d="\' + C_TORSO + \'" fill="#b0a8c6"/>');
rep('P(\'<path d="M1056 704 C 1066 762 1068 842 1064 902 L 1112 904 L 1112 704 Z" fill="#8b7fa8" opacity="0.6" filter="url(#b3)"/>\');',
    'P(\'<path d="M1056 704 C 1066 762 1068 842 1064 902 L 1112 904 L 1112 704 Z" fill="#7a6f9a" opacity="0.85" filter="url(#b2)"/>\');');
rep('P(\'<path d="M1088 708 C 1096 782 1096 860 1090 904 L 1112 904 L 1112 708 Z" fill="#6d6289" opacity="0.55" filter="url(#b3)"/>\');',
    'P(\'<path d="M1088 708 C 1096 782 1096 860 1090 904 L 1112 904 L 1112 708 Z" fill="#5c5480" opacity="0.8" filter="url(#b2)"/>\');');
rep('P(\'<path d="M1014 710 C 1002 764 996 822 994 882" fill="none" stroke="#fff6e4" stroke-width="6" opacity="0.5" filter="url(#b2)"/>\');',
    'P(\'<path d="M1012 708 C 1000 762 994 820 992 882" fill="none" stroke="#fffbe8" stroke-width="7" opacity="0.65" filter="url(#b2)"/>\');');
// shade: push the three bounced lights a little harder
rep('fill="#2f7f86" opacity="0.22" filter="url(#b14)"', 'fill="#2f7f86" opacity="0.28" filter="url(#b14)"');
rep('fill="#f0a866" opacity="0.16" filter="url(#b18)"', 'fill="#f0a866" opacity="0.22" filter="url(#b18)"');
fs.writeFileSync(D+'_gen.mjs',s);
console.log('patched',n);
