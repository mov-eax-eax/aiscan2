const fs = require('fs');
const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();
if (!PNG) { console.log('no pngjs'); process.exit(0); }
for (const f of ['shots/04_riser.png']) {
  const png = PNG.sync.read(fs.readFileSync(f));
  const { width: W, height: H, data } = png;
  // bounding box of dark pixels (the bow) in the central region
  let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const lum = 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
    if (lum < 90) { if (x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
  }
  console.log(f, 'dark bbox', minx, miny, maxx, maxy, 'w', maxx-minx, 'h', maxy-miny, 'aspect', ((maxx-minx)/(maxy-miny)).toFixed(3));
}
