// Headless Chrome test driver for MARIO 3-2, using the DevTools protocol directly
// (no npm deps). It loads the game, collects console/runtime errors, drives the
// built-in debug API, and writes screenshots + a JSON report.
//
//   node test/cdp.js [--url=http://127.0.0.1:8173/] [--quick]
//
// Requires the static server (node serve.js) to be running.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
const REPORT = path.join(__dirname, 'report.json');
const PORT = 9333;
const args = process.argv.slice(2);
const URL_ARG = (args.find((a) => a.startsWith('--url=')) || '--url=http://127.0.0.1:8173/').split('=')[1];
const QUICK = args.includes('--quick');
const SIZE_ARG = (args.find((a) => a.startsWith('--size=')) || '--size=1280,720').split('=')[1].split(',').map(Number);
const WIN_W = SIZE_ARG[0] || 1280;
const WIN_H = SIZE_ARG[1] || 720;
const SHOT_SUFFIX = args.find((a) => a.startsWith('--tag=')) ? '-' + args.find((a) => a.startsWith('--tag=')).split('=')[1] : '';

fs.mkdirSync(SHOTS, { recursive: true });

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
  throw new Error('no chrome/edge found');
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpJson(url, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: method || 'GET' }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('bad json from ' + url + ': ' + body.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout ' + url)));
    req.end();
  });
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (msg.id != null) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
          else p.resolve(msg.result);
        }
      } else if (msg.method) {
        const hs = this.handlers.get(msg.method) || [];
        for (const h of hs) h(msg.params);
      }
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('CDP timeout: ' + method));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('eval failed: ' + (d.exception && (d.exception.description || d.exception.value)) + ' in: ' + expression.slice(0, 160));
    }
    return r.result && r.result.value;
  }
}

async function main() {
  const chrome = findChrome();
  const profile = path.join(ROOT, '.test-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--mute-audio',
      '--hide-scrollbars',
      '--window-size=' + WIN_W + ',' + WIN_H,
      '--force-device-scale-factor=1',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore', detached: false, windowsHide: true }
  );

  const report = { url: URL_ARG, startedAt: new Date().toISOString(), console: [], errors: [], steps: [], shots: [], ok: false };

  try {
    // wait for devtools endpoint
    let version = null;
    for (let i = 0; i < 60; i++) {
      try {
        version = await httpJson('http://127.0.0.1:' + PORT + '/json/version');
        break;
      } catch (e) {
        await wait(250);
      }
    }
    if (!version) throw new Error('chrome devtools endpoint never came up');

    const target = await httpJson('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL_ARG), 'PUT');
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('ws error')), { once: true });
    });
    const cdp = new CDP(ws);

    cdp.on('Runtime.consoleAPICalled', (p) => {
      const text = (p.args || [])
        .map((a) => (a.value != null ? String(a.value) : a.description || a.type))
        .join(' ');
      report.console.push({ type: p.type, text: text.slice(0, 500) });
    });
    cdp.on('Runtime.exceptionThrown', (p) => {
      const d = p.exceptionDetails || {};
      const desc = (d.exception && (d.exception.description || d.exception.value)) || d.text;
      report.errors.push(String(desc).slice(0, 800));
    });
    cdp.on('Log.entryAdded', (p) => {
      const e = p.entry || {};
      if (e.level === 'error' || e.level === 'warning') {
        report.console.push({ type: e.level, text: (e.text || '').slice(0, 500) });
        if (e.level === 'error') report.errors.push((e.text || '').slice(0, 800));
      }
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.enable');
    await cdp.send('Page.navigate', { url: URL_ARG });

    async function waitFor(expr, timeoutMs, label) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        try {
          if (await cdp.eval(expr)) return true;
        } catch (e) {
          /* page not ready */
        }
        await wait(200);
      }
      report.steps.push({ label: label || 'waitFor', ok: false, error: 'timeout: ' + expr });
      return false;
    }

    async function shot(name) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const full = name + SHOT_SUFFIX;
      const file = path.join(SHOTS, full + '.png');
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      report.shots.push(full + '.png');
      return file;
    }

    // ---------------------------------------------------------------- boot
    const booted = await waitFor('!!(window.M32 && window.M32.DEBUG && window.M32.DEBUG.ready) || !!(window.M32 && window.M32.DEBUG && window.M32.DEBUG.fatal)', 25000, 'boot');
    await wait(400);
    const fatal = await cdp.eval('(window.M32 && M32.DEBUG && M32.DEBUG.fatal) || null');
    if (fatal) report.fatal = fatal;
    report.steps.push({ label: 'boot', ok: booted && !fatal });
    await shot('01-title');

    if (!fatal) {
      report.worldInfo = await cdp.eval('M32.DEBUG.worldInfo()');
      report.statsTitle = await cdp.eval('M32.DEBUG.stats()');

      // start the game
      await cdp.eval('M32.DEBUG.start(); M32.DEBUG.simulate(1.0);');
      await wait(300);
      report.statsStart = await cdp.eval('M32.DEBUG.stats()');
      await shot('02-start');

      if (!QUICK) {
        // ---- visual tour: jump to key sections, let physics settle, screenshot
        const tour = [
          [420, 430, '03-coral-gardens'],
          [1900, 600, '04-tunnel'],
          [2500, 520, '05-bossbass'],
          [3450, 480, '06-shaft'],
          [4600, 460, '07-deep-run'],
          [5700, 700, '08-ascent'],
          [6050, 900, '09-beach-goal'],
        ];
        for (const [x, y, name] of tour) {
          await cdp.eval(`M32.DEBUG.revive(${x}, ${y}); M32.DEBUG.simulate(0.45);`);
          await wait(140);
          await shot(name);
          const st = await cdp.eval('M32.DEBUG.stats()');
          report.steps.push({ label: 'tour:' + name, ok: true, x: st.x, y: st.y, state: st.state, time: st.time, enemies: st.enemies, draws: st.draws });
        }

        // ---- bonus coin room
        await cdp.eval('M32.DEBUG.revive(); M32.DEBUG.teleport(2000, 300); M32.DEBUG.simulate(0.4);');
        await wait(120);
        await shot('09b-bonus-entry');
        await cdp.eval('M32.Game.emit("pipe-enter", {pipe: {target:"bonus", room:"coinroom"}}); M32.DEBUG.simulate(0.6);');
        await wait(200);
        await shot('09c-bonus-room');
        report.steps.push({ label: 'bonus-room', ok: true, ...(await cdp.eval('M32.DEBUG.stats()')) });
        await cdp.eval('M32.DEBUG.revive();');

        // ---- power states
        await cdp.eval('M32.DEBUG.revive(500, 430); M32.DEBUG.setPower("frog"); M32.DEBUG.simulate(0.5);');
        await wait(160);
        await shot('10-frog-suit');

        // ---- autopilot completability run (invincible so this tests level geometry,
        //      not combat luck; the bot still has to navigate every gap)
        await cdp.eval('M32.DEBUG.revive(140, 300); M32.DEBUG.giveInvincible(600); M32.DEBUG.autopilot(true);');
        let maxX = 0;
        let lastState = '';
        const t0 = Date.now();
        const progShots = [
          [1500, '11a-auto-1500'],
          [3000, '11b-auto-3000'],
          [4600, '11c-auto-4600'],
          [5900, '11d-auto-5900'],
        ];
        let progIdx = 0;
        for (let i = 0; i < 120; i++) {
          await cdp.eval('M32.DEBUG.stats().state === "dead" ? M32.DEBUG.revive() : 0; M32.DEBUG.simulate(1.5);');
          const st = await cdp.eval('M32.DEBUG.stats()');
          maxX = Math.max(maxX, st.x || 0);
          lastState = st.state;
          if (progIdx < progShots.length && maxX >= progShots[progIdx][0]) {
            await wait(120);
            await shot(progShots[progIdx][1]);
            progIdx++;
          }
          if (st.state === 'clear' || st.state === 'gameover' || st.lives <= 0) break;
          if (Date.now() - t0 > 220000) break;
        }
        report.autopilot = { maxX, state: lastState, goalX: report.statsStart ? report.statsStart.goalX : 6150, ...(await cdp.eval('M32.DEBUG.stats()')) };
        await shot('11e-autopilot-end');
        await cdp.eval('M32.DEBUG.autopilot(false);');
      }

      // ---- goal sequence
      await cdp.eval('M32.DEBUG.revive(6000, 900); M32.DEBUG.autopilot(false); M32.DEBUG.hold("right", true); M32.DEBUG.simulate(3.0); M32.DEBUG.hold("right", false);');
      await wait(300);
      report.statsGoal = await cdp.eval('M32.DEBUG.stats()');
      await shot('12-goal-sequence');
      await cdp.eval('M32.DEBUG.simulate(9.0);');
      await wait(500);
      await shot('13-results');
      report.statsResults = await cdp.eval('M32.DEBUG.stats()');

      report.errors = report.errors.concat((await cdp.eval('M32.DEBUG.errorsList()')) || []);
    }
  } catch (e) {
    report.errors.push('DRIVER: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e)));
  } finally {
    try {
      proc.kill();
    } catch (e) {
      /* ignore */
    }
    try {
      fs.rmSync(path.join(ROOT, '.test-profile'), { recursive: true, force: true, maxRetries: 2 });
    } catch (e) {
      /* ignore */
    }
  }

  // de-dup errors
  const seen = new Set();
  report.errors = report.errors.filter((e) => {
    const k = String(e).slice(0, 300);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (report.autopilot) {
    report.autopilotOk = report.autopilot.state === 'clear';
  }
  report.ok = !report.fatal && report.errors.length === 0 && report.autopilotOk !== false;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL DRIVER', e);
  process.exit(2);
});
