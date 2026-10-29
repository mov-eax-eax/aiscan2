import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const url = 'file:///F:/repod2/eiffel/dist/eiffel.dev.html?view=champ&hour=13&q=low&hud=0';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new',
  args: ['--headless=new', '--use-angle=d3d11', '--enable-gpu', '--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 700, height: 1050 });
await page.goto(url, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction('window.__ready === true', { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
const out = await page.evaluate(() => {
  const w = window.__world, THREE = window.__THREE;
  const cam = w.camera;
  const rc = new THREE.Raycaster();
  const hits = [];
  for (const dir of [[0, 0], [-0.3, 0.2], [0.3, 0.4], [0, 0.6]]) {
    rc.setFromCamera(new THREE.Vector2(dir[0], dir[1]), cam);
    const hit = rc.intersectObjects(w.scene.children, true)[0];
    hits.push(hit ? { obj: hit.object.name || hit.object.type, parent: hit.object.parent ? hit.object.parent.name : '', dist: +hit.distance.toFixed(1), at: [+hit.point.x.toFixed(1), +hit.point.y.toFixed(1), +hit.point.z.toFixed(1)] } : null);
  }
  return { cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)], target: [+w.scene.userData.x || 0], hits };
});
console.log(JSON.stringify(out, null, 1));
await page.screenshot({ path: 'F:/repod2/eiffel/shots/diagshot.png' });
await browser.close();
