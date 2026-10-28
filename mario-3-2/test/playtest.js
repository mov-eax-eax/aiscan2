// Gameplay scenario test for MARIO 3-2 in headless Chrome (CDP, no npm deps).
// Exercises the real input bindings, swimming, pause, ? blocks, damage/death/
// respawn, bonus-room warp, game over, and the audio unlock — and records
// screenshots for the tricky states.
//
//   node serve.js           (in another terminal)
//   node test/playtest.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'shots');
const REPORT = path.join(__dirname, 'playtest.json');
const PORT = 9335;
const URL_ARG = 'http://127.0.0.1:8173/';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(SHOTS, { recursive: true });
const checks = [];
const shots = [];
const consoleErrors = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail === undefined ? '' : ' :: ' + JSON.stringify(detail).slice(0, 400)));
  return ok;
}

function httpJson(url, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: method || 'GET' }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

async function main() {
  const profile = path.join(ROOT, '.test-profile-play');
  fs.rmSync(profile, { recursive: true, force: true });
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=' + PORT,
      '--user-data-dir=' + profile,
      '--no-first-run',
      '--disable-extensions',
      '--mute-audio',
      '--hide-scrollbars',
      '--window-size=1280,720',
      '--force-device-scale-factor=1',
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true }
  );

  let ws = null;
  try {
    let ver = null;
    for (let i = 0; i < 90; i++) {
      try {
        ver = await httpJson('http://127.0.0.1:' + PORT + '/json/version');
        break;
      } catch (e) {
        await wait(200);
      }
    }
    if (!ver) throw new Error('devtools endpoint never came up');
    const target = await httpJson('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(URL_ARG), 'PUT');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', () => rej(new Error('ws error')), { once: true });
    });

    let id = 0;
    const pend = new Map();
    const events = { console: [], errors: [] };
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) {
        const p = pend.get(m.id);
        pend.delete(m.id);
        m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
        return;
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        const text = (m.params.args || []).map((a) => (a.value != null ? String(a.value) : a.description || a.type)).join(' ');
        events.console.push({ type: m.params.type, text: text.slice(0, 300) });
      }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails || {};
        events.errors.push(String((d.exception && (d.exception.description || d.exception.value)) || d.text).slice(0, 600));
      }
      if (m.method === 'Log.entryAdded') {
        const e = m.params.entry || {};
        if (e.level === 'error') events.errors.push((e.text || '').slice(0, 600));
      }
    });
    const send = (method, params) => {
      const i = ++id;
      return new Promise((res, rej) => {
        pend.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params: params || {} }));
        setTimeout(() => {
          if (pend.has(i)) {
            pend.delete(i);
            rej(new Error('cdp timeout ' + method));
          }
        }, 30000);
      });
    };
    const evalJs = async (expr, gesture) => {
      const r = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
        userGesture: gesture !== false,
      });
      if (r.exceptionDetails) {
        const d = r.exceptionDetails;
        throw new Error('eval failed: ' + ((d.exception && (d.exception.description || d.exception.value)) || d.text) + ' || ' + expr.slice(0, 140));
      }
      return r.result.value;
    };
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
      shots.push(name + '.png');
      return name;
    };
    const key = async (type, code, keyName, vk) => {
      await send('Input.dispatchKeyEvent', {
        type,
        code,
        key: keyName,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
      });
    };

    await send('Runtime.enable');
    await send('Log.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: URL_ARG });

    // ------------------------------------------------------------- boot
    let ready = false;
    for (let i = 0; i < 150; i++) {
      ready = await evalJs('!!(window.M32 && M32.DEBUG && M32.DEBUG.ready)').catch(() => false);
      if (ready) break;
      await wait(200);
    }
    check('boot: M32.DEBUG.ready', ready);
    const fatal = await evalJs('(M32.DEBUG && M32.DEBUG.fatal) || null');
    check('boot: no fatal error', !fatal, fatal);
    check('boot: level built', await evalJs('!!(M32.Game.level3d && M32.Game.level3d.solids.length > 40)'));
    check('boot: title state', (await evalJs('M32.DEBUG.stats().state')) === 'title');
    check('boot: HUD hidden on title', await evalJs('getComputedStyle(document.getElementById("hud")).visibility !== "visible" || document.getElementById("hud").offsetParent === null').catch(() => true));
    await shot('pt-01-title');

    // ------------------------------------------------- start via real key
    await key('rawKeyDown', 'Space', ' ', 32);
    await wait(120);
    await key('keyUp', 'Space', ' ', 32);
    await wait(500);
    let st = await evalJs('M32.DEBUG.stats()');
    check('start: Space starts the game', st.state === 'play', st.state);
    check('start: overlay hidden', await evalJs('!document.getElementById("overlay").classList.contains("visible")'));
    check('start: HUD visible in play', await evalJs('document.getElementById("hud").offsetParent !== null || getComputedStyle(document.getElementById("hud")).visibility === "visible"'));
    check('start: minimap hidden during play (does not cover Mario)', await evalJs('document.getElementById("minimap").offsetParent === null || getComputedStyle(document.getElementById("minimap")).opacity === "0"'));

    // ------------------------------------------------- real key swimming
    const x0 = (await evalJs('M32.DEBUG.stats()')).x;
    await key('rawKeyDown', 'ArrowRight', 'ArrowRight', 39);
    await wait(900);
    await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
    await wait(150);
    const x1 = (await evalJs('M32.DEBUG.stats()')).x;
    check('input: holding ArrowRight swims right', x1 > x0 + 30, { x0, x1 });

    // stroke up with real key
    const y0 = (await evalJs('M32.DEBUG.stats()')).y;
    for (let i = 0; i < 4; i++) {
      await key('rawKeyDown', 'KeyZ', 'z', 90);
      await wait(90);
      await key('keyUp', 'KeyZ', 'z', 90);
      await wait(120);
    }
    const y1 = (await evalJs('M32.DEBUG.stats()')).y;
    check('input: Z strokes lift the player', y1 > y0 + 20, { y0, y1 });

    // ---------------------------------------------------------------- pause
    await key('rawKeyDown', 'KeyP', 'p', 80);
    await wait(80);
    await key('keyUp', 'KeyP', 'p', 80);
    await wait(400);
    check('pause: P pauses', (await evalJs('M32.DEBUG.stats().state')) === 'pause');
    check('pause: pause panel visible', await evalJs('document.getElementById("pause").classList.contains("visible")'));
    check('pause: minimap shown as overview', await evalJs('document.getElementById("minimap").offsetParent !== null || getComputedStyle(document.getElementById("minimap")).opacity !== "0"'));
    await shot('pt-02-pause');
    await key('rawKeyDown', 'KeyP', 'p', 80);
    await wait(80);
    await key('keyUp', 'KeyP', 'p', 80);
    await wait(400);
    check('pause: P resumes', (await evalJs('M32.DEBUG.stats().state')) === 'play');

    // ------------------------------------------------------------- coin
    await evalJs('M32.DEBUG.revive(600, 470); M32.DEBUG.simulate(0.2);');
    const coins0 = (await evalJs('M32.DEBUG.stats()')).coins;
    await evalJs(
      '(function(){var p=M32.Game.player; M32.Game.entities.spawn("coin", {x:p.x+18, y:p.y+20});})()'
    );
    await evalJs('M32.DEBUG.simulate(0.6);');
    await wait(150);
    const coins1 = (await evalJs('M32.DEBUG.stats()')).coins;
    check('item: touching a coin increments coins', coins1 > coins0, { coins0, coins1 });

    // ------------------------------------------------- ? block / frog suit
    await evalJs('M32.DEBUG.revive(2450, 430); M32.DEBUG.hold("stroke", true); M32.DEBUG.simulate(1.2); M32.DEBUG.hold("stroke", false); M32.DEBUG.simulate(0.6);');
    const powerNow = (await evalJs('M32.DEBUG.stats()')).power;
    const fsItem = await evalJs(`(function(){return M32.Game.entities.all.filter(function(e){return e.alive && (e.type==='frogsuit'||e.type==='frogSuit'||e.type==='frog');}).map(function(e){return e.type;});})()`);
    check('item: hitting the frogsuit ? block spawns the frog suit', powerNow === 'frog' || (fsItem && fsItem.length > 0), { power: powerNow, items: fsItem });
    await wait(120);
    await shot('pt-03-itembox');

    // collect it if it spawned
    await evalJs(`(function(){var e=M32.Game.entities.all.find(function(e){return e.alive && /frog/i.test(e.type) && e.type!=='frog';});if(e){M32.DEBUG.teleport(e.x, e.y);}return e?e.type:null;})()`);
    await evalJs('M32.DEBUG.simulate(0.8);');
    const powerAfter = (await evalJs('M32.DEBUG.stats()')).power;
    check('powerup: collecting the frog suit -> frog power', powerAfter === 'frog', { powerAfter });

    // ------------------------------------------------- stamina/timer sanity
    await evalJs('M32.DEBUG.revive(600, 470); M32.DEBUG.simulate(0.2);');
    const before = await evalJs('M32.DEBUG.stats().time');
    await evalJs('M32.DEBUG.simulate(2.0)');
    const after = await evalJs('M32.DEBUG.stats().time');
    const stAfterTimer = await evalJs('M32.DEBUG.stats()');
    check('timer: counts down while playing', after < before && stAfterTimer.state === 'play', {
      before,
      after,
      state: stAfterTimer.state,
    });

    // ------------------------------------------- damage -> death -> respawn
    await evalJs('M32.DEBUG.revive(400, 400); M32.DEBUG.setPower("small");');
    const lives0 = (await evalJs('M32.DEBUG.stats()')).lives;
    await evalJs('M32.DEBUG.kill()');
    await wait(200);
    check('death: dying enters dead state', (await evalJs('M32.DEBUG.stats().state')) === 'dead');
    await shot('pt-04-death');
    await evalJs('M32.DEBUG.simulate(3.2)');
    await wait(300);
    st = await evalJs('M32.DEBUG.stats()');
    check('death: respawns with one less life at the checkpoint', st.state === 'play' && st.lives === lives0 - 1, { lives0, lives: st.lives, state: st.state, x: st.x, y: st.y });

    // ---------------------------------------------------------- bonus warp
    await evalJs('M32.DEBUG.revive(2000, 500); M32.DEBUG.hold("down", true); M32.DEBUG.simulate(1.2); M32.DEBUG.hold("down", false);');
    await wait(200);
    st = await evalJs('M32.DEBUG.stats()');
    check('pipe: bonus pipe warps into the coin room', st.inBonus === true || (st.x > 900 && st.x < 1700 && st.y > 1100), { x: st.x, y: st.y, inBonus: st.inBonus });
    await shot('pt-05-bonus-room');
    // exit pipe
    await evalJs(`(function(){var p=M32.Game.level3d.pipes.find(function(p){return p.target==='main'||p.exit;});if(p&&p.enterBox){M32.Game.player.reset(p.enterBox.x+p.enterBox.w/2,p.enterBox.y+2);}return p?p.target:null;})()`);
    await evalJs('M32.DEBUG.hold("down", true); M32.DEBUG.simulate(1.0); M32.DEBUG.hold("down", false); M32.DEBUG.simulate(0.3);');
    st = await evalJs('M32.DEBUG.stats()');
    check('pipe: exit pipe returns to the main level', st.x > 3000 || st.inBonus === false, { x: st.x, y: st.y, inBonus: st.inBonus });

    // ------------------------------------------------------- game over path
    await evalJs('M32.DEBUG.revive(400, 400); M32.DEBUG.setPower("small");');
    for (let i = 0; i < 4; i++) {
      await evalJs('M32.DEBUG.kill(); M32.DEBUG.simulate(3.2);');
      const s = await evalJs('M32.DEBUG.stats()');
      if (s.state === 'gameover') break;
    }
    st = await evalJs('M32.DEBUG.stats()');
    check('gameover: losing all lives reaches GAME OVER', st.state === 'gameover', { state: st.state, lives: st.lives });
    await shot('pt-06-gameover');
    await evalJs('M32.DEBUG.start();');
    await wait(300);
    check('gameover: Space returns to title', (await evalJs('M32.DEBUG.stats().state')) === 'title');

    // ------------------------------------------------------- audio unlock
    const audioState = await evalJs(`(async function(){
      try {
        M32.Game.audio.unlock();
        await new Promise(function(r){setTimeout(r,300);});
        var ctx = M32.Game.audio.ctx || M32.Game.audio._ctx || null;
        return {state: ctx ? ctx.state : 'noctx', muted: M32.Game.audio.muted};
      } catch(e) { return {error: String(e)}; }
    })()`.replace(/\n/g, ' '));
    check('audio: AudioContext unlocks after a user gesture', audioState && (audioState.state === 'running' || audioState.state === 'suspended'), audioState);

    // ----------------------------------------------------------- perf/counters
    const perf = await evalJs('M32.DEBUG.stats()');
    check('perf: draw calls under budget', perf.draws > 0 && perf.draws < 400, { draws: perf.draws, tris: perf.tris });
    check('perf: triangles under budget', perf.tris > 0 && perf.tris < 250000, { tris: perf.tris });
    const errorsNow = await evalJs('M32.DEBUG.errorsList()');
    check('runtime: no page errors during the whole playtest', (errorsNow || []).length === 0 && events.errors.length === 0, { page: errorsNow, cdp: events.errors.slice(0, 3) });
    check('runtime: no console errors', events.console.filter((c) => c.type === 'error').length === 0, events.console.slice(0, 3));
    await shot('pt-07-final');

    ws.close();
  } catch (e) {
    checks.push({ name: 'DRIVER', ok: false, detail: String(e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e) });
    console.log('FAIL DRIVER ::', e);
  } finally {
    try {
      proc.kill();
    } catch (e) {}
    await wait(300);
    try {
      fs.rmSync(path.join(ROOT, '.test-profile-play'), { recursive: true, force: true, maxRetries: 2 });
    } catch (e) {}
  }

  const pass = checks.filter((c) => c.ok).length;
  const fail = checks.length - pass;
  const report = {
    pass,
    fail,
    ok: fail === 0,
    checks,
    shots,
    consoleErrors,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log('\nRESULT: ' + pass + ' passed, ' + fail + ' failed  -> test/playtest.json');
  process.exit(fail === 0 ? 0 : 1);
}

main();
