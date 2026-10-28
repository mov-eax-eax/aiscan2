import { chromium } from 'playwright-core';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const variants = [
  { name: 'd3d11', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11', '--no-sandbox'] },
  { name: 'default', args: ['--no-sandbox'] },
  { name: 'swiftshader', args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--no-sandbox'] },
];
for (const v of variants) {
  let browser;
  try {
    const t0 = Date.now();
    browser = await chromium.launch({ executablePath: edge, headless: true, args: v.args });
    const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    await page.goto('http://127.0.0.1:8141/qa/probe.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('webgl'));
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      return {
        renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a',
        vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'n/a',
        canvas: c ? [c.width, c.height] : null,
        ready: window.__ready === true,
      };
    });
    console.log(v.name, JSON.stringify(info), `${Date.now() - t0}ms`);
  } catch (e) {
    console.log(v.name, 'ERROR', e.message.split('\n')[0]);
  } finally {
    await browser?.close();
  }
}
