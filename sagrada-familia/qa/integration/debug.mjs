import { chromium } from 'playwright-core';
const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 700 } });
page.on('console', (m) => console.log(`[console:${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(3000);
const report = await page.evaluate(() => {
  const p = window.__preview;
  rendererHold: {
    const r = p.renderer;
    const gl = r.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(600, 350, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const canvas = r.domElement;
    const cs = getComputedStyle(canvas);
    return {
      pixel: [...px],
      canvas: { w: canvas.width, h: canvas.height, rect: canvas.getBoundingClientRect().toJSON(), opacity: cs.opacity, visibility: cs.visibility, zIndex: cs.zIndex, position: cs.position, display: cs.display },
      bodyChildren: [...document.body.children].map((e) => ({ tag: e.tagName, id: e.id, display: getComputedStyle(e).display, rect: e.getBoundingClientRect().toJSON() })),
      camera: { pos: p.camera.position.toArray(), quat: p.camera.quaternion.toArray(), near: p.camera.near, far: p.camera.far, fov: p.camera.fov, aspect: p.camera.aspect },
      render: { calls: p.renderer.info.render.calls, tris: p.renderer.info.render.triangles },
    };
  }
});
console.log(JSON.stringify(report, null, 2));

for (const name of ['environment', 'glory-shell', 'facades-np', 'towers', 'interior']) {
  const info = await page.evaluate((name) => {
    const p = window.__preview;
    for (const c of p.scene.children) c.visible = c.name === name;
    p.renderer.render(p.scene, p.camera);
    const gl = p.renderer.getContext();
    const px = new Uint8Array(4);
    gl.readPixels(600, 350, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return { name, pixel: [...px], calls: p.renderer.info.render.calls, tris: p.renderer.info.render.triangles };
  }, name);
  console.log(JSON.stringify(info));
  await page.screenshot({ path: `F:/repo-aiscan2/sagrada-familia/qa/integration/solo-${name}.png` });
}
await browser.close();
