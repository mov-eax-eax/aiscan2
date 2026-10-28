import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(4000);
const info = await page.evaluate(() => {
  const p = window.__preview;
  if (!p) return { preview: false };
  const info = p.renderer.info;
  const gl = p.renderer.getContext();
  return {
    preview: true,
    camera: p.camera.position.toArray(),
    children: p.scene.children.map((c) => ({ type: c.type, name: c.name, visible: c.visible, children: c.children.length })),
    render: { calls: info.render.calls, tris: info.render.triangles, points: info.render.points, lines: info.render.lines },
    glError: gl.getError(),
    lost: gl.isContextLost(),
    errors: p.errors,
    walkables: p.walkables.length,
    colliders: p.colliders.length,
  };
});
await page.screenshot({ path: process.argv[3] || 'F:/repo-aiscan2/sagrada-familia/qa/integration/inspect.png' });
console.log(JSON.stringify({ info, logs }, null, 2));
await browser.close();
