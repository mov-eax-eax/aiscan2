import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const ID = process.argv[2] || 'sketch';
const W = 1000, H = 1400;

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox',
    '--disable-dev-shm-usage', '--window-size=' + W + ',' + H, '--hide-scrollbars'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await page.goto('file:///F:/repod2/eiffel-simple.html', { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
await page.evaluate((id) => window.__profile(id), ID);
await new Promise((r) => setTimeout(r, 800));

const ref = await page.evaluate(() => window.__profileRef(0.5));
await page.evaluate(() => window.__silhouette(true));
const scan = await page.evaluate(() => window.__silhouetteScan());
const shot = await page.screenshot({ encoding: 'base64' });

const toX = (px) => scan.left + (px + 0.5) / scan.w * (scan.right - scan.left);
const toY = (ry) => scan.bottom + (ry + 0.5) / scan.h * (scan.top - scan.bottom);

const meas = new Map();
for (const [ry, lo, hi, n, gap] of scan.rows) {
  if (n === 0) continue;
  const y = toY(ry);
  if (y < -0.5 || y > ref.height + 0.5) continue;
  const key = Math.round(y * 2) / 2;
  if (meas.has(key)) continue;
  meas.set(key, { o: (toX(hi) - toX(lo)) / 2, v: gap >= 0 ? toX(gap) : 0 });
}

const idx = (y) => Math.round(y / ref.step);
const overlay = await page.evaluate(async ([b64, map, prof, w, h]) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const X = (x) => (x - map.left) / (map.right - map.left) * w;
  const Y = (y) => (map.top - y) / (map.top - map.bottom) * h;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,0,0,0.85)';
  for (const s of [1, -1]) {
    ctx.beginPath();
    prof.halfWidth.forEach((v, i) => { const px = X(s * v), py = Y(prof.y[i]); if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); });
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,180,255,0.9)';
  ctx.beginPath();
  let started = false;
  prof.voidHalf.forEach((v, i) => {
    const y = prof.y[i];
    if (v <= 0.6 || y > 92) { started = false; return; }
    if (!started) { ctx.moveTo(X(v), Y(y)); ctx.lineTo(X(-v), Y(y)); started = true; }
    else { ctx.lineTo(X(v), Y(y)); ctx.lineTo(X(-v), Y(y)); }
  });
  ctx.stroke();
  return c.toDataURL('image/png');
}, [shot, { left: scan.left, right: scan.right, top: scan.top, bottom: scan.bottom }, ref, scan.w, scan.h]);
const { writeFileSync } = await import('node:fs');
writeFileSync('F:/repod2/tower/shots/overlay-' + ID + '.png', Buffer.from(overlay.split(',')[1], 'base64'));
await browser.close();

let sum = 0, mx = 0, cnt = 0, sumV = 0, mxV = 0, cntV = 0, worst = '';
for (let k = 2; k <= ref.height; k += 2) {
  const m = meas.get(k);
  if (!m) continue;
  const i = idx(k);
  const d = m.o - ref.halfWidth[i];
  sum += Math.abs(d); cnt++;
  if (Math.abs(d) > mx) { mx = Math.abs(d); worst = 'y=' + k; }
  if (ref.voidHalf[i] > 1.5 && ref.voidHalf[i] < 0.95 * ref.halfWidth[i]) {
    const dv = m.v - ref.voidHalf[i];
    sumV += Math.abs(dv); mxV = Math.max(mxV, Math.abs(dv)); cntV++;
  }
}
console.log('profile  : ' + ref.id + ' (' + ref.label + ', ' + ref.style + ')');
console.log('envelope : rows ' + cnt + '  mean |err| ' + (sum / Math.max(cnt, 1)).toFixed(3) + '  max ' + mx.toFixed(3) + ' at ' + worst);
console.log('void     : rows ' + cntV + '  mean |err| ' + (sumV / Math.max(cntV, 1)).toFixed(3) + '  max ' + mxV.toFixed(3));
console.log('wrote shots/overlay-' + ID + '.png');
