/* ============================================================================
 *  FIVICS ATF-X  ·  UI / INTERACTION LAYER
 *  Parts tree, detail sheet, colour-id picking, CAD annotations, dimensions,
 *  orbit + pan + zoom camera, keyboard shortcuts, HUD.
 * ==========================================================================*/
(function () {
'use strict';

var view = { down: false, btn: 0, lx: 0, ly: 0, moved: 0, shift: false };
var tooltipEl, outEl, statEl, dbodyEl, didEl;

/* ------------------------------------------------------------------ helpers */
function fmt(v, d) {
  if (v == null || isNaN(v)) return '—';
  var s = (Math.round(v * Math.pow(10, d == null ? 1 : d)) / Math.pow(10, d == null ? 1 : d)).toString();
  return s;
}
function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; }); }

/* ------------------------------------------------------------- parts tree UI */
var treeSeq = 0;

function buildTree2() {
  /* builds one collapsible group per assembly; identical hardware folds to ×n */
  var host = document.getElementById('tree');
  if (!host) return;
  host.innerHTML = '';
  treeSeq = 0;
  var frag = document.createDocumentFragment();
  STATE.groups.forEach(function (g) {
    var wrap = document.createElement('div');
    wrap.className = 'grp';
    var head = document.createElement('h4');
    head.style.setProperty('--gc', g.tint);
    var names = {}, order = [];
    g.items.forEach(function (o) {
      if (!names[o.g.name]) { names[o.g.name] = { o: o, q: 0 }; order.push(o.g.name); }
      names[o.g.name].q++;
    });
    head.innerHTML = '<u></u>' + esc(g.en) + ' · ' + esc(g.cn) + '<s>' + order.length + '</s>';
    head.onclick = function () { wrap.classList.toggle('cl'); };
    wrap.appendChild(head);
    var list = document.createElement('div');
    list.className = 'lst';
    order.forEach(function (k) {
      var rec = names[k], o = rec.o;
      var it = document.createElement('div');
      it.className = 'it';
      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = String(++treeSeq).padStart(2, '0');
      var nm = document.createElement('span');
      nm.className = 'nm';
      nm.innerHTML = '<b>' + esc(o.part) + '</b><i>' + esc(o.spec) + '</i>';
      var qt = document.createElement('span');
      qt.className = 'qt';
      qt.textContent = '×' + rec.q;
      it.appendChild(idx); it.appendChild(nm); it.appendChild(qt);
      it.onclick = function (ev) { if (ev.shiftKey) focusOn(o); else select(o); };
      it.ondblclick = function () { focusOn(o); };
      o._treeEl = it; o._qtEl = qt; o.qty = rec.q;
      list.appendChild(it);
    });
    wrap.appendChild(list);
    frag.appendChild(wrap);
  });
  host.appendChild(frag);
  var pc = document.getElementById('pcount');
  if (pc) pc.textContent = STATE.objs.length + ' pcs';
}

function markTree(o, on) {
  if (o._treeEl) o._treeEl.classList[on ? 'add' : 'remove']('on');
}

/* ----------------------------------------------------------------- selection */
function select(o) {
  if (STATE.sel) markTree(STATE.sel, false);
  STATE.sel = o || null;
  if (o) markTree(o, true);
  applyGhost();
  showDetail(o);
}
window.selectPart = select;

function showDetail(o) {
  if (!dbodyEl) return;
  if (!o) {
    didEl.textContent = '— 未选择 —';
    dbodyEl.innerHTML = '<div class="dsub">在右侧清单或模型上点击任意零件查看详细规格。' +
      '拖拽旋转，滚轮缩放，Shift+拖拽平移。双击清单条目可将视角对准该零件。</div>';
    return;
  }
  didEl.textContent = o.id;
  var q = o.qty || 1;
  var html = '';
  html += '<div class="dname">' + esc(o.part) + (o.partEn ? ' <span style="color:#57657e;font-size:12px">/ ' + esc(o.partEn) + '</span>' : '') + '</div>';
  html += '<div class="dsub">ID ' + esc(o.id) + ' &nbsp;·&nbsp; 数量 ×' + q + ' &nbsp;·&nbsp; ' + esc(o.group ? (o.group.en + ' · ' + o.group.cn) : '基准 / 场景') + '</div>';
  html += '<table class="spec">';
  html += '<tr><td>材料</td><td>' + esc(o.mat) + '</td></tr>';
  html += '<tr><td>规格</td><td>' + esc(o.spec) + '</td></tr>';
  html += '<tr><td>表面</td><td>' + (o.texMode >= 0 ? esc(o.tex) + ' 程序化贴图' : '纯色着色') +
    ' · 粗糙度 ' + fmt(o.rough, 2) + ' · 金属度 ' + fmt(o.metal, 2) + '</td></tr>';
  html += '<tr><td>包围盒</td><td>Ø' + fmt(o.g.r * 2) + ' mm · 三角面 ' + fmt(o.g.tri.length / 3, 0) + '</td></tr>';
  html += '</table>';
  if (o.note && o.note.length) {
    html += '<div class="sec">工程备注 / NOTES</div><ul class="notes">';
    o.note.forEach(function (n) { html += '<li>' + esc(n) + '</li>'; });
    html += '</ul>';
  }
  if (o.group) {
    html += '<div class="sec">同组零件 / GROUP</div><ul class="notes">';
    var names = {};
    o.group.items.forEach(function (x) { names[x.part] = (names[x.part] || 0) + 1; });
    Object.keys(names).forEach(function (k) { html += '<li>' + esc(k) + ' ×' + names[k] + '</li>'; });
    html += '</ul>';
  }
  dbodyEl.innerHTML = html;
}

function focusOn(o) {
  var c = o.g.ctr, m = modelOf(o);
  var w = m4xform(m, c);
  STATE.cam.tx = w.x; STATE.cam.ty = w.y; STATE.cam.tz = w.z;
  var d = Math.max(90, o.g.r * 5.0);
  STATE.cam.dist = Math.min(2600, d);
  STATE.auto = false;
  var el = document.getElementById('tAuto');
  if (el) el.checked = false;
}
window.focusOn = focusOn;

/* ------------------------------------------------------------------- picking */
function handlePick(cx, cy) {
  var r = STATE.rect;
  if (!r || cx < r.x || cx > r.x + r.w || cy < r.y || cy > r.y + r.h) return;
  var px = Math.round((cx - r.x) * STATE.dpr * (STATE.vw / (r.w * STATE.dpr)));
  var py = Math.round((cy - r.y) * STATE.dpr * (STATE.vh / (r.h * STATE.dpr)));
  px = clamp(Math.round((cx - r.x) / r.w * STATE.vw), 0, STATE.vw - 1);
  py = clamp(Math.round((cy - r.y) / r.h * STATE.vh), 0, STATE.vh - 1);
  var id = pickAt(px, py);
  return id > 0 ? STATE.objs[id - 1] : null;
}

/* ------------------------------------------------------------- pointer input */
function initInput() {
  var cv = STATE.canvas;
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  cv.addEventListener('pointerdown', function (e) {
    view.down = true; view.btn = e.button; view.lx = e.clientX; view.ly = e.clientY;
    view.moved = 0; view.shift = e.shiftKey;
    cv.classList.add('drag');
    cv.setPointerCapture(e.pointerId);
  });

  window.addEventListener('pointerup', function (e) {
    if (!view.down) return;
    view.down = false;
    cv.classList.remove('drag');
    if (view.moved < 5 && view.btn === 0 && !view.shift) {
      var o = handlePick(e.clientX, e.clientY);
      select(o);
      if (o) showDetail(o);
    }
  });

  cv.addEventListener('pointermove', function (e) {
    var dx = e.clientX - view.lx, dy = e.clientY - view.ly;
    view.lx = e.clientX; view.ly = e.clientY;
    if (view.down) {
      view.moved += Math.abs(dx) + Math.abs(dy);
      if (view.btn === 2 || view.shift) {
        /* pan in the camera's screen plane */
        var s = STATE.cam.dist / 1400;
        var az = STATE.cam.az * DEG, el = STATE.cam.el * DEG;
        var right = V3(Math.cos(az), 0, -Math.sin(az));
        var up = V3(-Math.sin(az) * Math.sin(el), Math.cos(el), -Math.cos(az) * Math.sin(el));
        STATE.cam.tx -= (right.x * dx - up.x * dy) * s;
        STATE.cam.ty -= (right.y * dx - up.y * dy) * s;
        STATE.cam.tz -= (right.z * dx - up.z * dy) * s;
      } else {
        STATE.cam.az -= dx * 0.34;
        STATE.cam.el = clamp(STATE.cam.el + dy * 0.30, -88, 88);
      }
      STATE.auto = false;
      var ta = document.getElementById('tAuto');
      if (ta) ta.checked = false;
    } else {
      /* hover identification */
      var o = handlePick(e.clientX, e.clientY);
      if (o !== STATE.hover) {
        STATE.hover = o;
        cv.style.cursor = o ? 'pointer' : 'grab';
      }
      showTooltip(o, e.clientX, e.clientY);
    }
  });

  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = Math.exp(e.deltaY * 0.0011);
    STATE.cam.dist = clamp(STATE.cam.dist * f, 220, 7000);
  }, { passive: false });

  /* touch pinch */
  var pinch = null;
  cv.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  cv.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      var d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      STATE.cam.dist = clamp(STATE.cam.dist * (pinch / Math.max(1, d)), 220, 7000);
      pinch = d;
    }
  }, { passive: true });
  cv.addEventListener('touchend', function () { pinch = null; }, { passive: true });

  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    var k = e.key.toLowerCase();
    if (k === 'e') { setRange('rX', STATE.explode > 0.01 ? 0 : 0.42); }
    if (k === 'w') { toggle('tWire'); }
    if (k === 'l') { toggle('tLab'); }
    if (k === 'd') { toggle('tDim'); }
    if (k === 'g') { toggle('tGho'); }
    if (k === ' ') { e.preventDefault(); toggle('tAuto'); }
    if (k === 'escape') { select(null); }
  });
}

function showTooltip(o, x, y) {
  if (!tooltipEl) return;
  if (!o) { tooltipEl.style.display = 'none'; return; }
  tooltipEl.style.display = 'block';
  tooltipEl.innerHTML = '<b>' + esc(o.part) + '</b><br>' + esc(o.mat) +
    '<br><span style="color:#57657e">' + esc(o.spec) + '</span>';
  var w = tooltipEl.offsetWidth, h = tooltipEl.offsetHeight;
  tooltipEl.style.left = Math.min(window.innerWidth - w - 12, x + 16) + 'px';
  tooltipEl.style.top = Math.max(8, Math.min(window.innerHeight - h - 12, y + 16)) + 'px';
}

/* --------------------------------------------------------------- controls UI */
function setRange(id, v) {
  var el = document.getElementById(id);
  if (!el) return;
  el.value = String(Math.round(v * 100));
  el.dispatchEvent(new Event('input'));
}
function toggle(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.checked = !el.checked;
  el.dispatchEvent(new Event('change'));
}

function initControls() {
  function bind(id, fn) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () { fn(el.checked); });
  }
  bind('tAuto', function (v) { STATE.auto = v; });
  bind('tWire', function (v) { STATE.wire = v; });
  bind('tLab', function (v) { STATE.labels = v; });
  bind('tDim', function (v) { STATE.dims = v; });
  bind('tGho', function (v) { STATE.ghost = v; applyGhost(); });
  bind('tGrid', function (v) { STATE.grid = v; });
  var rx = document.getElementById('rX'), vx = document.getElementById('vX');
  if (rx) rx.addEventListener('input', function () {
    STATE.explode = parseInt(rx.value, 10) / 100;
    if (vx) vx.textContent = rx.value + '%';
  });
  var ba = document.getElementById('bAll');
  if (ba) ba.addEventListener('click', function () {
    var closed = document.querySelectorAll('#tree .grp.cl').length > 0;
    document.querySelectorAll('#tree .grp').forEach(function (g) {
      g.classList[closed ? 'remove' : 'add']('cl');
    });
  });
  var bo = document.getElementById('bOri');
  if (bo) bo.addEventListener('click', function () {
    STATE.cam.az = 0; STATE.cam.el = 0; STATE.cam.dist = 2500;
    STATE.cam.tx = 0; STATE.cam.ty = 0; STATE.cam.tz = 0;
    STATE.auto = false;
    var el = document.getElementById('tAuto'); if (el) el.checked = false;
  });
  var dc = document.getElementById('dclr');
  if (dc) dc.addEventListener('click', function () { select(null); });
  var q = document.getElementById('q');
  if (q) q.addEventListener('input', function () {
    var s = q.value.trim().toLowerCase();
    var shown = 0;
    STATE.groups.forEach(function (g) {
      g.items.forEach(function (o) {
        var hit = !s || (o.part + o.id + o.mat + o.spec + (o.partEn || '')).toLowerCase().indexOf(s) >= 0;
        if (o._treeEl) o._treeEl.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
    });
    var pc = document.getElementById('pcount');
    if (pc) pc.textContent = s ? (shown + ' / ' + STATE.objs.length) : (STATE.objs.length + ' pcs');
  });
}

/* ----------------------------------------------------------- annotations 3D */
var LABELS = [
  { t: '弓把 Riser (25″)', p: V3(-46, 92, 6), c: '' },
  { t: '弓窗 Sight Window', p: V3(-58, 172, -6), c: '' },
  { t: 'ILF 弓片座 Pocket', p: V3(40, 238, 6), c: '' },
  { t: '上弓片 Upper Limb', p: V3(46, 430, 4), c: '' },
  { t: '反曲梢 Recurve Tip', p: V3(30, 574, 22), c: '' },
  { t: '弓弦 Bowstring (18 股)', p: V3(-30, 300, 34), c: '' },
  { t: '搭箭点 Nocking Point', p: V3(-34, -2, 36), c: '' },
  { t: '箭侧垫 Plunger', p: V3(-54, -14, -6), c: '' },
  { t: '箭台 Arrow Rest', p: V3(-56, 26, -8), c: '' },
  { t: '响片 Clicker', p: V3(-52, 128, -2), c: '' },
  { t: '瞄准器 Sight (4″ 延长)', p: V3(-62, 12, -92), c: '' },
  { t: '握把 Grip', p: V3(36, -100, -24), c: '' },
  { t: '稳定杆座 Bushes', p: V3(30, -136, 30), c: '' },
  { t: '长杆 Long Rod (30″)', p: V3(26, -180, -420), c: '' },
  { t: '配重 Weight Stack', p: V3(24, -186, -790), c: '' },
  { t: 'V 型座 + 侧杆 V-Bar', p: V3(200, -240, -150), c: '' },
  { t: '箭 Arrow', p: V3(-26, 26, -300), c: '' },
  { t: '箭羽 Vane ×3', p: V3(-30, 30, -160), c: '' }
];

window.updateOverlay = function () {
  if (!outEl) return;
  /* ---- labels ---- */
  if (!STATE.labels) {
    if (outEl.childElementCount) outEl.innerHTML = '';
    return;
  }
  var need = LABELS.length;
  if (outEl.childElementCount !== need) {
    outEl.innerHTML = '';
    LABELS.forEach(function (L) {
      var d = document.createElement('div');
      d.className = 'lab';
      d.innerHTML = esc(L.t);
      outEl.appendChild(d);
    });
  }
  var r = STATE.rect || viewRect();
  for (var i = 0; i < need; i++) {
    var el = outEl.children[i];
    var L2 = LABELS[i];
    var wp = V3(L2.p.x * (1 + STATE.explode * 0.30), L2.p.y * (1 + STATE.explode * 0.16), L2.p.z * (1 + STATE.explode * 0.30));
    var s = project(wp);
    if (!s || s.x < r.x - 40 || s.x > r.x + r.w + 40 || s.y < r.y - 40 || s.y > r.y + r.h + 40) {
      el.style.display = 'none';
      continue;
    }
    el.style.display = 'block';
    el.style.left = s.x + 'px';
    el.style.top = s.y + 'px';
  }
};

/* ------------------------------------------------------------- dimensions 3D */
window.buildDimensions = function () {
  var segs = [], marks = [];
  function line(a, b) { segs.push([a, b]); }
  function tick(p, dir, len) {
    var t = vnorm(dir), n = V3(-t.y, t.x, t.z);
    line(vadd(p, vscale(n, -len)), vadd(p, vscale(n, len)));
  }
  /* --- A. AMO bow length (tip to tip) --- */
  var xA = -140;
  var top = V3(xA, BOW.tipY, BOW.tipZ), bot = V3(xA, -BOW.tipY, BOW.tipZ);
  line(top, bot);
  tick(top, V3(0, 1, 0), 14); tick(bot, V3(0, 1, 0), 14);
  line(top, V3(-16, BOW.tipY, BOW.tipZ + 2));
  line(bot, V3(-16, -BOW.tipY, BOW.tipZ + 2));
  marks.push({ t: 'A · 整弓长 Bow Length 66″ = 1 676 mm', p: V3(xA - 90, 0, BOW.tipZ) });

  /* --- B. brace height (string -> grip throat) --- */
  var xB = 118, yB = -60;
  var s1 = V3(xB, yB, BOW.stringZ - 6), s2 = V3(xB, yB, BOW.gripZ + 32);
  line(s1, s2);
  tick(s1, V3(0, 0, 1), 12); tick(s2, V3(0, 0, 1), 12);
  line(s1, V3(46, yB, BOW.stringZ - 6));
  line(s2, V3(46, yB, BOW.gripZ + 32));
  marks.push({ t: 'B · 弦高 Brace Height ' + fmt(BOW.brace, 1) + ' mm', p: V3(xB + 96, yB - 26, 0) });

  /* --- C. riser length --- */
  var xC = -140, zC = -78;
  line(V3(xC, 250, zC), V3(xC, -250, zC));
  tick(V3(xC, 250, zC), V3(1, 0, 0), 12); tick(V3(xC, -250, zC), V3(1, 0, 0), 12);
  marks.push({ t: 'C · 弓把 Riser 25″ = 635 mm', p: V3(xC - 40, -250, zC) });

  /* --- D. limb length (pocket -> tip) --- */
  var lp = limbParam(1, 1);
  line(V3(0, BOW.pocketY, -26), V3(0, lp.y, lp.z));
  marks.push({ t: 'D · 弓片 Limb 498 mm', p: V3(20, 400, -60) });

  /* --- E. draw length reference (arrow) --- */
  var a0 = arrowPointAt(30), a1 = arrowPointAt(ARROW.len);
  line(V3(-44, 30, a0.z), V3(-44, 30, a1.z));
  marks.push({ t: 'E · 箭长 Arrow 760 mm (挠度 600)', p: V3(-70, 30, -700) });

  /* --- F. string length --- */
  line(V3(60, BOW.tipY, BOW.tipZ + 3), V3(60, -BOW.tipY, BOW.tipZ + 3));
  marks.push({ t: 'F · 弦长 String 1 610 mm · 18 股', p: V3(120, 420, BOW.tipZ) });

  buildDimGeo(segs);
  window.DIMMARKS = marks;
};

/* stat / HUD */
window.updateHUD = function () {
  if (!statEl) return;
  var c = STATE.cam;
  var sel = STATE.sel ? STATE.sel.part : (STATE.hover ? STATE.hover.part : '—');
  var q = STATE.sel ? (STATE.sel.qty || 1) : 0;
  statEl.innerHTML =
    '<b>' + Math.round(STATE.fps) + '</b> fps &nbsp;<u>|</u>&nbsp; 三角面 <b>' + Math.round(STATE.tris).toLocaleString() + '</b>' +
    '<br>零件 <b>' + STATE.objs.length + '</b> &nbsp;<u>|</u>&nbsp; 视距 <b>' + Math.round(c.dist) + '</b> mm' +
    '<br>方位 <b>' + Math.round(((c.az % 360) + 360) % 360) + '°</b> 仰角 <b>' + Math.round(c.el) + '°</b>' +
    '<br><u>选中:</u> ' + esc(sel) + (q ? ' <u>×' + q + '</u>' : '');
};

/* ---------------------------------------------------------------- dim labels */
function initDimLabels() {
  /* dimension texts live in the overlay as well (kept separate from LABELS) */
  var host = document.getElementById('out');
  if (!host) return;
  window.__dimEls = [];
  (window.DIMMARKS || []).forEach(function (m) {
    var d = document.createElement('div');
    d.className = 'lab dim';
    d.textContent = m.t;
    host.appendChild(d);
    window.__dimEls.push({ el: d, m: m });
  });
}

window.updateDimLabels = function () {
  if (!window.__dimEls) return;
  var show = STATE.dims;
  for (var i = 0; i < window.__dimEls.length; i++) {
    var rec = window.__dimEls[i];
    if (!show) { rec.el.style.display = 'none'; continue; }
    var s = project(rec.m.p);
    if (!s) { rec.el.style.display = 'none'; continue; }
    rec.el.style.display = 'block';
    rec.el.style.left = s.x + 'px';
    rec.el.style.top = s.y + 'px';
  }
};

/* --------------------------------------------------------------------- boot */
window.initUI = function () {
  outEl = document.getElementById('out');
  statEl = document.getElementById('stat');
  dbodyEl = document.getElementById('dbody');
  didEl = document.getElementById('did');
  tooltipEl = document.getElementById('tt');

  buildTree2();
  initControls();
  initInput();
  showDetail(null);

  /* dimension lines + their HTML labels */
  window.buildDimensions();
  initDimLabels();

  /* hook the overlay update to also move the dimension captions */
  var prevOverlay = window.updateOverlay;
  window.updateOverlay = function () { prevOverlay(); window.updateDimLabels(); };

  /* ground plane is drawn as a real object so it participates in the depth pass */
  addObj({
    id: 'scene.floor', g: disc({ axis: 'y', r: 3400, seg: 84, name: 'floor', normal: V3(0, -1, 0) }),
    pos: V3(0, -690, 40), color: [0.052, 0.062, 0.082], rough: .96, metal: 0,
    emiss: [0.016, 0.020, 0.030], ghostOpacity: 1, noPick: true, opacity: 0.9
  });
  var _floor = STATE.objs[STATE.objs.length - 1];
  _floor.part = '工程基准平面 Datum Plane';
  _floor.mat = '—';
  _floor.spec = '5 000 × 5 000 mm · 网格 500 mm';
  _floor.note = ['仅作尺寸参考，不属于弓的零件。'];
  _floor.qty = 1;
  makeGL(_floor);

  /* engineering grid: 500 mm squares in one shared line buffer */
  (function grid() {
    var y = -686, ext = 2500, step = 500, v;
    var pts = [];
    for (v = -ext; v <= ext; v += step) {
      pts.push(V3(v, y, -ext), V3(v, y, ext));
      pts.push(V3(-ext, y, v), V3(ext, y, v));
    }
    STATE.gridGeo = buildLineGeo(pts);
  })();

  /* camera defaults sized to the bow */
  STATE.cam.dist = 2900;
  STATE.cam.el = 7;
  STATE.cam.az = -24;

  STATE.auto = document.getElementById('tAuto') ? document.getElementById('tAuto').checked : true;
  STATE.wire = document.getElementById('tWire').checked;
  STATE.labels = document.getElementById('tLab').checked;
  STATE.dims = document.getElementById('tDim').checked;
  STATE.grid = document.getElementById('tGrid').checked;

  window.renderFrame();
};

/* ------------------------------------------------------------------- start */
window.addEventListener('load', function () {
  try {
    if (!window.initCore()) return;
    window.buildBowModel();
    window.uploadAll();
    window.initUI();
  } catch (err) {
    window.fail((err && err.message ? err.message : String(err)) + '<br><span style="color:#8b6b70">' + (err && err.stack ? esc(err.stack.split('\n').slice(0, 5).join('<br>')) : '') + '</span>');
    if (window.console) console.error(err);
  }
});

})();
