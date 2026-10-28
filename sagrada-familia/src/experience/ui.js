// All DOM for the experience: splash, HUD, tour captions, hotspot labels,
// info card, help overlay, plan/map panel, toasts and the touch controls.
// Styling lives in css/ui.css. This module owns no camera or physics.

import { formatClock, periodOfDay, isNightHour, isTypingTarget } from './util.js';

const QUALITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' };

const HINTS = {
  walk: [
    ['WASD', 'move'],
    ['SHIFT', 'run'],
    ['SPACE', 'jump'],
    ['E', 'read'],
    ['M', 'plan'],
    ['T', 'tour'],
    ['H', 'help'],
  ],
  fly: [
    ['WASD', 'fly'],
    ['SPACE / E', 'rise'],
    ['CTRL / Q', 'fall'],
    ['SHIFT', 'boost'],
    ['F', 'walk'],
    ['M', 'plan'],
    ['H', 'help'],
  ],
  tour: [
    ['← →', 'stops'],
    ['SPACE', 'pause'],
    ['ESC', 'exit'],
  ],
  splash: [],
  photo: [['P', 'exit photo']],
};

function hintHTML(pairs) {
  return pairs.map(([key, label]) => `<span class="sf-hint"><kbd>${key}</kbd>${label}</span>`).join('<span class="sf-hint-sep">·</span>');
}

export function createUI({ TOUR, handlers = {}, isTouch = false }) {
  const host = document.getElementById('ui') || document.body;
  const root = document.createElement('div');
  const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
  root.className = 'sf-root' + (isTouch ? ' is-touch' : '') + (automated ? ' is-automation' : '');
  root.setAttribute('data-mode', 'splash');
  root.innerHTML = `
    <div class="sf-splash" id="sf-splash" aria-label="Enter the Sagrada Família">
      <div class="sf-splash-scrim"></div>
      <div class="sf-splash-inner">
        <div class="sf-splash-rule"></div>
        <p class="sf-kicker">Barcelona · 1882 — forever unfinished</p>
        <h1 class="sf-splash-title">La Sagrada<br /><em>Família</em></h1>
        <p class="sf-splash-sub">A walkable study in stone, light and forest</p>
        <div class="sf-splash-actions">
          <button class="sf-btn sf-btn-primary" data-splash="walk"><span>Enter on foot</span><small>WASD &amp; mouse</small></button>
          <button class="sf-btn" data-splash="fly"><span>Free fly</span><small>6-DOF · no collision</small></button>
          <button class="sf-btn" data-splash="tour"><span>Guided tour</span><small>${Array.isArray(TOUR) ? TOUR.length : 12} stops</small></button>
        </div>
        <div class="sf-splash-controls">
          <div class="sf-splash-ctrl"><kbd>W A S D</kbd><span>Move</span></div>
          <div class="sf-splash-ctrl"><kbd>Mouse</kbd><span>Look</span></div>
          <div class="sf-splash-ctrl"><kbd>Shift</kbd><span>Run / boost</span></div>
          <div class="sf-splash-ctrl"><kbd>Space</kbd><span>Jump / rise</span></div>
          <div class="sf-splash-ctrl"><kbd>F</kbd><span>Free fly</span></div>
          <div class="sf-splash-ctrl"><kbd>E</kbd><span>Read</span></div>
          <div class="sf-splash-ctrl"><kbd>M</kbd><span>Plan</span></div>
          <div class="sf-splash-ctrl"><kbd>T</kbd><span>Tour</span></div>
          <div class="sf-splash-ctrl"><kbd>H</kbd><span>Help</span></div>
        </div>
        <p class="sf-splash-note">A procedurally built study: every stone, window and figure is generated in code from Gaudí's geometry. Not affiliated with the Basilica.<br />Sound begins after you enter.</p>
        <div class="sf-splash-foot">
          <button class="sf-textbtn" data-act="splash-sound" aria-pressed="true">Sound: on</button>
          <button class="sf-textbtn" data-act="splash-help">How to explore</button>
          <span class="sf-splash-credit">Three.js · no external assets</span>
        </div>
      </div>
    </div>

    <div class="sf-hud" id="sf-hud">
      <header class="sf-brand">
        <p class="sf-brand-kicker">Barcelona · 1882</p>
        <h2 class="sf-brand-title">La Sagrada Família</h2>
        <p class="sf-brand-sub">A walkable model</p>
      </header>

      <div class="sf-controls" id="sf-controls">
        <div class="sf-controls-top">
          <button class="sf-mode" data-act="mode" title="Toggle walk / free fly (F)" aria-label="Toggle walk or free fly mode">
            <span class="sf-mode-dot"></span><span class="sf-mode-label" data-mode-label>WALK</span><span class="sf-mode-sub" data-mode-sub>on foot</span>
          </button>
          <div class="sf-clock"><span class="sf-clock-time" data-clock>10:21</span><span class="sf-clock-label" data-period>Morning</span></div>
          <button class="sf-mobile-menu" data-act="sheet" aria-label="Open controls">Menu</button>
        </div>
        <div class="sf-time">
          <span class="sf-time-label">Time of day</span>
          <input class="sf-time-slider" type="range" min="0" max="24" step="0.25" value="16.75" aria-label="Time of day" data-slider />
        </div>
        <div class="sf-time-tools">
          <button class="sf-mini" data-act="auto" aria-pressed="false" title="Let the clock run">Auto-cycle</button>
          <button class="sf-mini" data-act="night" aria-pressed="false" title="Jump to night illumination">Night</button>
        </div>
        <nav class="sf-nav" aria-label="Experience controls">
          <button data-act="tour" data-nav="tour">Tour</button>
          <button data-act="teleport" data-nav="teleport">Teleport</button>
          <button data-act="study" data-nav="study" aria-pressed="false">Study</button>
          <button data-act="map" data-nav="map" aria-pressed="false">Map</button>
          <button data-act="sound" data-nav="sound" aria-pressed="true">Sound</button>
          <button data-act="quality" data-nav="quality">Quality</button>
          <button data-act="photo" data-nav="photo" aria-pressed="false">Photo</button>
          <button data-act="help" data-nav="help">Help</button>
        </nav>
        <div class="sf-pop sf-pop-teleport" data-pop="teleport" hidden>
          <div class="sf-pop-head"><span class="sf-kicker">Teleport</span><button class="sf-close" data-act="pop-close" aria-label="Close">×</button></div>
          <div class="sf-pop-list" data-teleport-list></div>
        </div>
        <div class="sf-pop sf-pop-quality" data-pop="quality" hidden>
          <div class="sf-pop-head"><span class="sf-kicker">Quality</span><button class="sf-close" data-act="pop-close" aria-label="Close">×</button></div>
          <div class="sf-quality-list">
            <button data-quality="low"><span>Low</span><small>fastest</small></button>
            <button data-quality="medium"><span>Medium</span><small>balanced</small></button>
            <button data-quality="high"><span>High</span><small>full detail</small></button>
          </div>
        </div>
        <div class="sf-pop sf-pop-study" data-pop="study" hidden>
          <div class="sf-pop-head"><span class="sf-kicker">Study the fabric</span><button class="sf-close" data-act="pop-close" aria-label="Close">×</button></div>
          <div class="sf-quality-list sf-study-list">
            <button data-study="mesh" aria-pressed="false"><span>Mesh</span><small>the wireframe skeleton</small></button>
            <button data-study="section" aria-pressed="false"><span>Section</span><small>cut the temple open</small></button>
            <button data-study="parts" aria-pressed="false"><span>Isolate</span><small>see one part at a time</small></button>
          </div>
          <div class="sf-study-parts" data-study-parts>
            <p class="sf-study-label">Only show</p>
            <div class="sf-study-partlist">
              <button data-study-part="all" aria-pressed="true">Whole temple</button>
              <button data-study-part="shell" aria-pressed="false">Shell &amp; façades</button>
              <button data-study-part="towers" aria-pressed="false">Towers &amp; roofs</button>
              <button data-study-part="interior" aria-pressed="false">Interior</button>
            </div>
          </div>
        </div>
      </div>
      <div class="sf-mobile-sheet" id="sf-mobile-sheet" hidden>
        <div class="sf-sheet-head"><span class="sf-kicker">Controls</span><button class="sf-close" data-act="sheet-close" aria-label="Close controls">×</button></div>
        <nav class="sf-sheet-nav">
          <button data-act="tour" data-nav="tour">Tour</button>
          <button data-act="teleport" data-nav="teleport">Teleport</button>
          <button data-act="study" data-nav="study">Study</button>
          <button data-act="map" data-nav="map">Map</button>
          <button data-act="sound" data-nav="sound">Sound</button>
          <button data-act="quality" data-nav="quality">Quality</button>
          <button data-act="photo" data-nav="photo">Photo</button>
          <button data-act="help" data-nav="help">Help</button>
        </nav>
      </div>
      <div class="sf-crosshair" id="sf-crosshair" aria-hidden="true"></div>
      <div class="sf-hints" id="sf-hints" aria-hidden="true"></div>
      <div class="sf-stats" id="sf-stats" aria-hidden="true"></div>
    </div>

    <div class="sf-hotspot" id="sf-hotspot" hidden>
      <button class="sf-hotspot-btn" data-act="hotspot" aria-label="Read about this place">
        <span class="sf-hotspot-dot"></span>
        <span class="sf-hotspot-copy">
          <span class="sf-hotspot-kicker" data-hotspot-kicker></span>
          <span class="sf-hotspot-title" data-hotspot-title></span>
          <span class="sf-hotspot-hint" data-hotspot-hint>E to read</span>
        </span>
      </button>
    </div>

    <div class="sf-scrim sf-modal" id="sf-modal" hidden>
      <article class="sf-card" role="dialog" aria-modal="true" aria-labelledby="sf-card-title" tabindex="-1">
        <button class="sf-close sf-card-close" data-act="modal-close" aria-label="Close information card">×</button>
        <p class="sf-kicker" data-card-kicker></p>
        <h2 class="sf-card-title" id="sf-card-title" data-card-title></h2>
        <div class="sf-card-rule"></div>
        <p class="sf-card-body" data-card-body></p>
        <footer class="sf-card-foot"><span>Esc or click outside to close</span></footer>
      </article>
    </div>

    <div class="sf-scrim sf-help" id="sf-help" hidden>
      <article class="sf-card sf-help-card" role="dialog" aria-modal="true" aria-labelledby="sf-help-title" tabindex="-1">
        <button class="sf-close sf-card-close" data-act="help-close" aria-label="Close help">×</button>
        <p class="sf-kicker">Guide</p>
        <h2 class="sf-card-title" id="sf-help-title">How to explore</h2>
        <div class="sf-card-rule"></div>
        <div class="sf-help-grid">
          <div>
            <h4>On foot</h4>
            <dl>
              <dt>W A S D</dt><dd>Walk, through the portals and into the nave</dd>
              <dt>Shift</dt><dd>Run</dd>
              <dt>Space</dt><dd>Jump</dd>
              <dt>Mouse</dt><dd>Look — click the view to capture the pointer</dd>
              <dt>E</dt><dd>Read the nearest label</dd>
            </dl>
          </div>
          <div>
            <h4>In the air</h4>
            <dl>
              <dt>W A S D</dt><dd>Fly in the direction you are looking</dd>
              <dt>Space / E</dt><dd>Rise — near a label, E reads it instead</dd>
              <dt>Ctrl / Q</dt><dd>Descend</dd>
              <dt>Wheel</dt><dd>Free-fly speed</dd>
              <dt>R</dt><dd>Reset to a clean aerial view</dd>
              <dt>Shift</dt><dd>Boost, for the tower tops</dd>
              <dt>F</dt><dd>Switch between walking and free flying</dd>
            </dl>
          </div>
          <div>
            <h4>The interface</h4>
            <dl>
              <dt>T</dt><dd>Guided tour</dd>
              <dt>M</dt><dd>Plan of the temple</dd>
              <dt>Study</dt><dd>Mesh, section and isolate views</dd>
              <dt>V / X / I</dt><dd>Mesh · cutaway · isolate</dd>
              <dt>N</dt><dd>Night illumination</dd>
              <dt>P</dt><dd>Photo mode — hides every overlay</dd>
              <dt>Esc</dt><dd>Close a panel, release the pointer</dd>
            </dl>
          </div>
          <div>
            <h4>About this model</h4>
            <p>Built procedurally with Three.js, 1:1 in metres. The geometry is derived from Gaudí's ruled surfaces and the published dimensions of the temple; it is an interpretation, not a survey. Not affiliated with the Basílica de la Sagrada Família.</p>
          </div>
        </div>
        <p class="sf-help-note" data-soft-note hidden>Software rendering detected — antialiasing and shadows are reduced so the model stays fluid.</p>
        <footer class="sf-card-foot"><span>La Sagrada Família · A walkable model</span><span>Sound is procedural — no files</span></footer>
      </article>
    </div>

    <aside class="sf-map" id="sf-map" hidden aria-label="Plan of the temple">
      <header class="sf-map-head">
        <div><p class="sf-kicker">Plan</p><h3>Ground plan</h3></div>
        <button class="sf-close" data-act="map-close" aria-label="Close plan">×</button>
      </header>
      <div class="sf-map-wrap"><canvas id="sf-map-canvas"></canvas></div>
      <footer class="sf-map-foot"><span>North is up · click a stop to go there</span><span>1:1 · metres</span></footer>
    </aside>

    <section class="sf-tour" id="sf-tour" hidden aria-live="polite" aria-label="Guided tour">
      <div class="sf-tour-meta">
        <span class="sf-tour-index" data-tour-index>01 / 12</span>
        <span class="sf-tour-kicker" data-tour-kicker></span>
      </div>
      <h2 class="sf-tour-title" data-tour-title></h2>
      <p class="sf-tour-body" data-tour-body></p>
      <div class="sf-tour-progress"><div class="sf-tour-bar" data-tour-bar></div></div>
      <div class="sf-tour-actions">
        <button data-act="tour-prev" aria-label="Previous stop">← Prev</button>
        <button data-act="tour-pause" data-tour-pause aria-label="Pause or resume tour">Pause</button>
        <button data-act="tour-next" aria-label="Next stop">Next →</button>
        <button class="sf-quiet" data-act="tour-exit">Exit tour</button>
      </div>
    </section>

    <div class="sf-touch" id="sf-touch" hidden>
      <div class="sf-joystick" id="sf-joystick" aria-label="Movement joystick">
        <div class="sf-joystick-ring"></div>
        <div class="sf-joystick-knob" id="sf-joystick-knob"></div>
      </div>
      <div class="sf-touch-actions">
        <button class="sf-touch-fly" data-act="fly-up" aria-label="Rise">↑</button>
        <button class="sf-touch-fly" data-act="fly-down" aria-label="Descend">↓</button>
        <button class="sf-touch-run" data-act="run" aria-pressed="false">Run</button>
        <button class="sf-touch-mode" data-act="mode" aria-label="Toggle walk or fly">Fly</button>
      </div>
      <p class="sf-touch-hint" id="sf-touch-hint">Drag to look · joystick to move</p>
    </div>

    <button class="sf-photo-exit" data-act="photo-exit" aria-label="Exit photo mode">Exit photo</button>

    <div class="sf-toast" id="sf-toast" role="status" hidden></div>
  `;
  host.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));

  const els = {
    splash: $('#sf-splash'),
    hud: $('#sf-hud'),
    brand: $('.sf-brand'),
    controls: $('#sf-controls'),
    modeLabel: $('[data-mode-label]'),
    clock: $('[data-clock]'),
    period: $('[data-period]'),
    slider: $('[data-slider]'),
    auto: $('[data-act="auto"]'),
    night: $('[data-act="night"]'),
    hints: $('#sf-hints'),
    stats: $('#sf-stats'),
    crosshair: $('#sf-crosshair'),
    hotspot: $('#sf-hotspot'),
    hotspotKicker: $('[data-hotspot-kicker]'),
    hotspotTitle: $('[data-hotspot-title]'),
    hotspotHint: $('[data-hotspot-hint]'),
    modal: $('#sf-modal'),
    cardKicker: $('[data-card-kicker]'),
    cardTitle: $('[data-card-title]'),
    cardBody: $('[data-card-body]'),
    help: $('#sf-help'),
    map: $('#sf-map'),
    mapCanvas: $('#sf-map-canvas'),
    tour: $('#sf-tour'),
    tourIndex: $('[data-tour-index]'),
    tourKicker: $('[data-tour-kicker]'),
    tourTitle: $('[data-tour-title]'),
    tourBody: $('[data-tour-body]'),
    tourBar: $('[data-tour-bar]'),
    tourPause: $('[data-tour-pause]'),
    touch: $('#sf-touch'),
    joystick: $('#sf-joystick'),
    joystickKnob: $('#sf-joystick-knob'),
    sheet: $('#sf-mobile-sheet'),
    toast: $('#sf-toast'),
    teleportList: $('[data-teleport-list]'),
    popTeleport: $('[data-pop="teleport"]'),
    popQuality: $('[data-pop="quality"]'),
    popStudy: $('[data-pop="study"]'),
    modeSub: $('[data-mode-sub]'),
    touchHint: $('#sf-touch-hint'),
  };

  const state = {
    mode: 'splash',
    splash: true,
    photo: false,
    allHidden: false,
    hudHidden: false,
    mapOpen: false,
    sheetOpen: false,
    modalOpen: false,
    helpOpen: false,
    popover: null,
    lastClock: '',
    lastPeriod: '',
    lastStats: '',
    lastHintMode: '',
    lastBar: -1,
    lastHotspotId: null,
    toastTimer: 0,
    splashTimer: 0,
    focusBefore: null,
    sliderDragging: false,
    quality: 'high',
    sound: true,
    auto: false,
    software: false,
    studyMesh: false,
    studySection: false,
    studyPart: 'all',
  };

  // ------------------------------------------------------------ event wiring

  function blurButton(el) {
    if (el && el.tagName === 'BUTTON' && el.blur) el.blur();
  }

  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-splash], [data-act], [data-teleport], [data-quality], [data-study], [data-study-part]');
    if (!target || !root.contains(target)) return;
    blurButton(target);
    const splashMode = target.getAttribute('data-splash');
    if (splashMode) {
      handlers.start?.(splashMode);
      return;
    }
    const studyMode = target.getAttribute('data-study');
    if (studyMode) {
      handlers.study?.(studyMode);
      return;
    }
    const studyPart = target.getAttribute('data-study-part');
    if (studyPart) {
      handlers.studyPart?.(studyPart);
      return;
    }
    const teleportId = target.getAttribute('data-teleport');
    if (teleportId) {
      handlers.teleport?.(teleportId);
      closePopover();
      closeSheet();
      return;
    }
    const quality = target.getAttribute('data-quality');
    // Only the menu rows carry data-quality; the nav button keeps a marker for
    // styling and must fall through to its data-act handler.
    if (quality && !target.hasAttribute('data-act')) {
      handlers.quality?.(quality);
      closePopover();
      return;
    }
    const act = target.getAttribute('data-act');
    switch (act) {
      case 'mode':
        handlers.modeToggle?.();
        break;
      case 'auto':
        handlers.auto?.();
        break;
      case 'night':
        handlers.night?.();
        break;
      case 'tour':
        handlers.tour?.();
        closeSheet();
        break;
      case 'study':
        if (state.popover === 'study') closePopover();
        else openPopover('study');
        closeSheet();
        break;
      case 'teleport':
        if (state.popover === 'teleport') closePopover();
        else openPopover('teleport');
        break;
      case 'quality':
        if (state.popover === 'quality') closePopover();
        else openPopover('quality');
        break;
      case 'map':
        toggleMap();
        closeSheet();
        break;
      case 'sound':
        handlers.sound?.();
        break;
      case 'photo':
        handlers.photo?.();
        closeSheet();
        break;
      case 'photo-exit':
        handlers.photo?.();
        break;
      case 'help':
        handlers.help?.();
        closeSheet();
        break;
      case 'splash-sound':
        handlers.sound?.();
        break;
      case 'splash-help':
        openHelp();
        break;
      case 'modal-close':
        closeModal();
        break;
      case 'help-close':
        closeHelp();
        break;
      case 'map-close':
        closeMap();
        break;
      case 'pop-close':
        closePopover();
        break;
      case 'tour-prev':
        handlers.tourPrev?.();
        break;
      case 'tour-next':
        handlers.tourNext?.();
        break;
      case 'tour-pause':
        handlers.tourPause?.();
        break;
      case 'tour-exit':
        handlers.tourExit?.();
        break;
      case 'hotspot':
        handlers.hotspotOpen?.();
        break;
      case 'sheet':
        toggleSheet();
        break;
      case 'sheet-close':
        closeSheet();
        break;
      // Fly up/down are hold-to-move and handled by their pointer listeners;
      // a click handler here would latch the vertical input on after release.
      case 'fly-up':
      case 'fly-down':
        break;
      case 'run':
        toggleRunButton();
        break;
      default:
        break;
    }
  });

  // Fly buttons are hold-to-move.
  for (const btn of $$('[data-act="fly-up"], [data-act="fly-down"]')) {
    const dir = btn.getAttribute('data-act') === 'fly-up' ? 1 : -1;
    const down = (e) => {
      e.preventDefault();
      handlers.touchVertical?.(dir);
      btn.classList.add('is-held');
    };
    const up = () => {
      handlers.touchVertical?.(0);
      btn.classList.remove('is-held');
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  }

  // Slider
  if (els.slider) {
    els.slider.addEventListener('pointerdown', () => {
      state.sliderDragging = true;
    });
    els.slider.addEventListener('pointerup', () => {
      state.sliderDragging = false;
    });
    els.slider.addEventListener('change', () => {
      state.sliderDragging = false;
    });
    els.slider.addEventListener('blur', () => {
      state.sliderDragging = false;
    });
    els.slider.addEventListener('input', () => {
      const value = parseFloat(els.slider.value);
      if (Number.isFinite(value)) handlers.time?.(value);
    });
  }

  // Scrim click-to-close
  els.modal.addEventListener('pointerdown', (e) => {
    if (e.target === els.modal) closeModal();
  });
  els.help.addEventListener('pointerdown', (e) => {
    if (e.target === els.help) closeHelp();
  });

  // Escape is handled by the experience; Tab is trapped here for dialogs.
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const card = state.modalOpen ? els.modal.querySelector('.sf-card') : state.helpOpen ? els.help.querySelector('.sf-card') : null;
    if (!card) return;
    const focusables = Array.from(
      card.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Teleport list
  if (els.teleportList) {
    const list = Array.isArray(TOUR) ? TOUR : [];
    list.forEach((stop, i) => {
      const btn = document.createElement('button');
      btn.className = 'sf-pop-item';
      btn.setAttribute('data-teleport', stop.id);
      const num = document.createElement('span');
      num.className = 'sf-pop-num';
      num.textContent = String(i + 1).padStart(2, '0');
      const copy = document.createElement('span');
      copy.className = 'sf-pop-copy';
      const title = document.createElement('span');
      title.className = 'sf-pop-title';
      title.textContent = stop.title || stop.id;
      const kicker = document.createElement('span');
      kicker.className = 'sf-pop-kicker';
      kicker.textContent = stop.kicker || '';
      copy.appendChild(title);
      copy.appendChild(kicker);
      btn.appendChild(num);
      btn.appendChild(copy);
      els.teleportList.appendChild(btn);
    });
  }

  // ---------------------------------------------------------------- joystick
  let joyId = null;
  function joyUpdate(e) {
    const rect = els.joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const maxR = rect.width * 0.36;
    const len = Math.hypot(dx, dy);
    if (len > maxR) {
      dx = (dx / len) * maxR;
      dy = (dy / len) * maxR;
    }
    els.joystickKnob.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    handlers.touchMove?.(dx / maxR, dy / maxR);
  }
  function joyEnd() {
    joyId = null;
    els.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    handlers.touchMove?.(0, 0);
  }
  els.joystick.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    try {
      els.joystick.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    joyUpdate(e);
    e.preventDefault();
  });
  els.joystick.addEventListener('pointermove', (e) => {
    if (joyId === e.pointerId) joyUpdate(e);
  });
  els.joystick.addEventListener('pointerup', (e) => {
    if (joyId === e.pointerId) joyEnd();
  });
  els.joystick.addEventListener('pointercancel', () => {
    if (joyId !== null) joyEnd();
  });

  // ---------------------------------------------------------------- updates

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    root.setAttribute('data-mode', mode);
    if (els.modeLabel) els.modeLabel.textContent = mode === 'tour' ? 'TOUR' : mode === 'fly' ? 'FREE FLY' : mode === 'splash' ? 'READY' : 'WALK';
    if (els.modeSub) els.modeSub.textContent = mode === 'tour' ? 'cinematic' : mode === 'fly' ? 'no collision' : mode === 'splash' ? 'choose below' : 'on foot';
    const touchMode = $('.sf-touch-mode');
    if (touchMode) touchMode.textContent = mode === 'fly' ? 'Walk' : 'Fly';
    setHints(mode);
    syncNav();
  }

  function setStudy(study) {
    if (!study) return;
    state.studyMesh = !!study.mesh;
    state.studySection = !!study.section;
    state.studyPart = study.part || 'all';
    setPressed('[data-study="mesh"]', state.studyMesh);
    setPressed('[data-study="section"]', state.studySection);
    setPressed('[data-study="parts"]', state.studyPart !== 'all');
    for (const el of $$('[data-study-part]')) {
      const on = el.getAttribute('data-study-part') === state.studyPart;
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    syncNav();
  }

  function setPressed(selector, on) {
    for (const el of $$(selector)) {
      el.classList.toggle('is-on', !!on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function syncNav() {
    for (const el of $$('[data-nav="tour"], .sf-sheet-nav [data-act="tour"]')) {
      el.classList.toggle('is-on', state.mode === 'tour');
    }
    setPressed('[data-nav="map"]', state.mapOpen);
    for (const el of $$('[data-nav="sound"]')) {
      el.classList.toggle('is-muted', !state.sound);
      el.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
    }
    setPressed('[data-nav="photo"]', state.photo);
    setPressed('[data-nav="help"]', state.helpOpen);
    setPressed('[data-nav="study"]', !!(state.studyMesh || state.studySection || state.studyPart !== 'all') || state.popover === 'study');
    for (const el of $$('[data-nav="quality"]')) {
      el.classList.toggle('is-on', state.quality !== 'high');
      el.setAttribute('data-quality', state.quality);
    }
  }

  function setClock(hours) {
    const h = Number.isFinite(hours) ? hours : 10.35;
    const clock = formatClock(h);
    if (clock !== state.lastClock) {
      state.lastClock = clock;
      if (els.clock) els.clock.textContent = clock;
    }
    const period = periodOfDay(h);
    if (period.label !== state.lastPeriod) {
      state.lastPeriod = period.label;
      if (els.period) els.period.textContent = period.label;
    }
    if (els.night) {
      const night = isNightHour(h);
      if (els.night.classList.contains('is-on') !== night) els.night.classList.toggle('is-on', night);
    }
  }

  function syncSlider(hours) {
    if (!els.slider || state.sliderDragging) return;
    const h = Number.isFinite(hours) ? hours : 0;
    const current = parseFloat(els.slider.value);
    if (Number.isFinite(current) && Math.abs(current - h) > 0.08) {
      els.slider.value = String(h);
    }
  }

  function setAuto(on) {
    const value = !!on;
    if (value === state.auto) return;
    state.auto = value;
    if (els.auto) {
      els.auto.classList.toggle('is-on', state.auto);
      els.auto.setAttribute('aria-pressed', state.auto ? 'true' : 'false');
    }
  }

  function setSound(muted) {
    state.sound = !muted;
    syncNav();
    for (const el of $$('[data-act="splash-sound"]')) {
      el.textContent = muted ? 'Sound: off' : 'Sound: on';
      el.setAttribute('aria-pressed', muted ? 'false' : 'true');
    }
  }

  function setQuality(q) {
    state.quality = q;
    syncNav();
    for (const el of $$('.sf-quality-list [data-quality]')) {
      el.classList.toggle('is-on', el.getAttribute('data-quality') === q);
    }
  }

  function setPhoto(on) {
    state.photo = !!on;
    root.classList.toggle('is-photo', state.photo);
    if (state.photo && isTouch) {
      // Touch users have no P key; the chip below is the only way out.
      setTimeout(() => {
        const chip = root.querySelector('.sf-photo-exit');
        if (chip) chip.hidden = false;
      }, 2600);
    } else {
      const chip = root.querySelector('.sf-photo-exit');
      if (chip) chip.hidden = true;
    }
    if (state.photo) {
      const chip = root.querySelector('.sf-photo-exit');
      if (chip) chip.hidden = true;
      closePopover();
      closeSheet();
      hideHotspot();
    }
    syncNav();
  }

  function setSoftwareMode(on) {
    state.software = !!on;
    root.classList.toggle('is-software', state.software);
    const note = root.querySelector('[data-soft-note]');
    if (note) note.hidden = !state.software;
    // Force the next stats update to show the software marker.
    state.lastStats = '';
  }

  function setStats(fps, quality) {
    const text = `${Math.round(fps || 0)} FPS · ${QUALITY_LABEL[quality] || 'High'}${state.software ? ' · SOFTWARE' : ''}`;
    if (text !== state.lastStats) {
      state.lastStats = text;
      if (els.stats) els.stats.textContent = text;
    }
  }

  function setHints(mode) {
    if (!els.hints || state.lastHintMode === mode) return;
    state.lastHintMode = mode;
    const pairs = HINTS[mode] || [];
    els.hints.innerHTML = hintHTML(pairs);
  }

  // --------------------------------------------------------------- splash

  function revealSplash() {
    if (!state.splash) return;
    els.splash.classList.add('is-shown');
  }

  function hideSplash() {
    if (!state.splash) return;
    state.splash = false;
    els.splash.classList.add('is-leaving');
    root.classList.add('is-entered');
    if (state.splashTimer) clearTimeout(state.splashTimer);
    state.splashTimer = setTimeout(() => {
      els.splash.hidden = true;
      els.splash.classList.remove('is-leaving');
    }, 1000);
  }

  function showSplash() {
    if (state.splash) return;
    state.splash = true;
    els.splash.hidden = false;
    els.splash.classList.remove('is-leaving');
    els.splash.classList.add('is-shown');
    root.classList.remove('is-entered');
  }

  // ------------------------------------------------------- hotspot label

  function showHotspot(data) {
    if (!data) {
      hideHotspot();
      return;
    }
    if (state.photo || state.mode === 'tour') {
      hideHotspot();
      return;
    }
    if (els.hotspot.hidden) els.hotspot.hidden = false;
    if (data.id !== state.lastHotspotId) {
      state.lastHotspotId = data.id;
      if (els.hotspotKicker) els.hotspotKicker.textContent = data.kicker || 'Place';
      if (els.hotspotTitle) els.hotspotTitle.textContent = data.title || '';
      if (els.hotspotHint) {
        els.hotspotHint.textContent = isTouch ? 'tap to read' : data.hint || 'E to read';
      }
    }
    const vw = window.innerWidth;
    const x = Math.round(Math.max(8, Math.min(vw - 8, data.x)));
    const y = Math.round(data.y);
    if (x !== state.lastHotspotX || y !== state.lastHotspotY) {
      state.lastHotspotX = x;
      state.lastHotspotY = y;
      els.hotspot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
    // Near an edge the label grows inward so it never leaves the viewport.
    const side = x > vw - 170 ? 'right' : x < 170 ? 'left' : 'center';
    if (side !== state.lastHotspotSide) {
      state.lastHotspotSide = side;
      els.hotspot.setAttribute('data-side', side);
    }
  }

  function hideHotspot() {
    if (!els.hotspot.hidden) els.hotspot.hidden = true;
    state.lastHotspotId = null;
    state.lastHotspotX = null;
    state.lastHotspotY = null;
    state.lastHotspotSide = null;
  }

  // ----------------------------------------------------------------- modal

  function openModal({ kicker, title, body }) {
    state.focusBefore = document.activeElement;
    if (els.cardKicker) {
      els.cardKicker.textContent = kicker || '';
      els.cardKicker.hidden = !kicker;
    }
    if (els.cardTitle) els.cardTitle.textContent = title || '';
    if (els.cardBody) els.cardBody.textContent = body || '';
    els.modal.hidden = false;
    state.modalOpen = true;
    hideHotspot();
    const card = els.modal.querySelector('.sf-card');
    const closeBtn = els.modal.querySelector('[data-act="modal-close"]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
    else if (card) card.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!state.modalOpen) return;
    els.modal.hidden = true;
    state.modalOpen = false;
    restoreFocus();
  }

  function restoreFocus() {
    const el = state.focusBefore;
    state.focusBefore = null;
    try {
      if (el && el.isConnected && el.focus) el.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
  }

  // ------------------------------------------------------------------ help

  function openHelp() {
    state.focusBefore = document.activeElement;
    els.help.hidden = false;
    state.helpOpen = true;
    closePopover();
    syncNav();
    const closeBtn = els.help.querySelector('[data-act="help-close"]');
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeHelp() {
    if (!state.helpOpen) return;
    els.help.hidden = true;
    state.helpOpen = false;
    syncNav();
    restoreFocus();
  }

  function toggleHelp() {
    if (state.helpOpen) closeHelp();
    else openHelp();
  }

  // ------------------------------------------------------------------- map

  function openMap() {
    state.mapOpen = true;
    els.map.hidden = false;
    closePopover();
    syncNav();
    handlers.mapShown?.();
  }

  function closeMap() {
    state.mapOpen = false;
    els.map.hidden = true;
    syncNav();
  }

  function toggleMap() {
    if (state.mapOpen) closeMap();
    else openMap();
  }

  // -------------------------------------------------------------- popovers

  function openPopover(name) {
    state.popover = name;
    if (state.mapOpen) closeMap();
    if (els.popTeleport) els.popTeleport.hidden = name !== 'teleport';
    if (els.popQuality) els.popQuality.hidden = name !== 'quality';
    if (els.popStudy) els.popStudy.hidden = name !== 'study';
    syncNav();
  }

  function closePopover() {
    state.popover = null;
    if (els.popTeleport) els.popTeleport.hidden = true;
    if (els.popQuality) els.popQuality.hidden = true;
    if (els.popStudy) els.popStudy.hidden = true;
    syncNav();
  }

  // ------------------------------------------------------------ mobile sheet

  function toggleSheet() {
    if (state.sheetOpen) closeSheet();
    else openSheet();
  }

  function openSheet() {
    state.sheetOpen = true;
    els.sheet.hidden = false;
    closePopover();
    syncNav();
  }

  function closeSheet() {
    state.sheetOpen = false;
    els.sheet.hidden = true;
  }

  function toggleRunButton() {
    const btn = $('.sf-touch-run');
    if (!btn) return;
    const on = !btn.classList.contains('is-on');
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    handlers.touchRun?.(on);
  }

  function resetRunButton() {
    const btn = $('.sf-touch-run');
    if (!btn) return;
    btn.classList.remove('is-on');
    btn.setAttribute('aria-pressed', 'false');
  }

  // ----------------------------------------------------------------- toast

  function toast(message, ms = 2800) {
    if (!els.toast) return;
    if (state.toastTimer) clearTimeout(state.toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.add('is-visible');
    state.toastTimer = setTimeout(() => {
      els.toast.classList.remove('is-visible');
      state.toastTimer = setTimeout(() => {
        els.toast.hidden = true;
      }, 420);
    }, ms);
  }

  // ------------------------------------------------------------------ tour

  function showTour() {
    els.tour.hidden = false;
    root.classList.add('is-touring');
  }

  function hideTour() {
    els.tour.hidden = true;
    root.classList.remove('is-touring');
    state.lastBar = -1;
  }

  function setTourStop(stop, index, total) {
    if (!stop) return;
    if (els.tourIndex) els.tourIndex.textContent = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    if (els.tourKicker) els.tourKicker.textContent = stop.kicker || '';
    if (els.tourTitle) els.tourTitle.textContent = stop.title || '';
    if (els.tourBody) els.tourBody.textContent = stop.body || '';
    els.tour.hidden = false;
    root.classList.add('is-touring');
  }

  function setTourPaused(paused) {
    if (els.tourPause) els.tourPause.textContent = paused ? 'Resume' : 'Pause';
  }

  function setTourProgress(progress, paused) {
    if (!els.tourBar) return;
    const p = Math.max(0, Math.min(1, progress || 0));
    const bucket = Math.round(p * 200);
    if (bucket !== state.lastBar) {
      state.lastBar = bucket;
      els.tourBar.style.transform = `scaleX(${p})`;
    }
    if (paused !== state.lastPaused) {
      state.lastPaused = paused;
      setTourPaused(paused);
    }
  }

  // -------------------------------------------------------------- visibility

  function setAllHidden(value) {
    state.allHidden = !!value;
    root.classList.toggle('is-hidden-all', state.allHidden);
    if (state.allHidden) {
      hideHotspot();
      closePopover();
      closeSheet();
    }
  }

  function setHudHidden(value) {
    state.hudHidden = !!value;
    root.classList.toggle('is-hud-hidden', state.hudHidden);
  }

  function setTouchUI(value) {
    root.classList.toggle('is-touch', !!value);
    if (els.touch) els.touch.hidden = !value;
  }

  function splashVisible() {
    return state.splash;
  }

  function closeOverlay() {
    if (state.modalOpen) {
      closeModal();
      return 'modal';
    }
    if (state.helpOpen) {
      closeHelp();
      return 'help';
    }
    if (state.mapOpen) {
      closeMap();
      return 'map';
    }
    if (state.sheetOpen) {
      closeSheet();
      return 'sheet';
    }
    if (state.popover) {
      closePopover();
      return 'popover';
    }
    return null;
  }

  function isAnyOverlayOpen() {
    return state.modalOpen || state.helpOpen || state.mapOpen || state.sheetOpen || !!state.popover;
  }

  function showTouchHint(ms = 5200) {
    if (!els.touchHint) return;
    els.touchHint.classList.add('is-visible');
    setTimeout(() => els.touchHint?.classList.remove('is-visible'), ms);
  }

  // Safety: if the app never signals ready (boot stalled), still reveal the
  // entry screen rather than leaving a blank dark page under the loader.
  setTimeout(() => {
    if (state.splash && !state.allHidden) revealSplash();
  }, 15000);

  return {
    root,
    els,
    handlers,
    setMode,
    setStudy,
    setClock,
    syncSlider,
    setAuto,
    setSound,
    setQuality,
    setPhoto,
    setStats,
    setSoftwareMode,
    isSoftware: () => state.software,
    setHints,
    hideSplash,
    showSplash,
    revealSplash,
    splashVisible,
    showHotspot,
    hideHotspot,
    openModal,
    closeModal,
    openHelp,
    closeHelp,
    toggleHelp,
    openMap,
    closeMap,
    toggleMap,
    openPopover,
    closePopover,
    showTour,
    hideTour,
    setTourStop,
    setTourPaused,
    setTourProgress,
    toast,
    setAllHidden,
    setHudHidden,
    setTouchUI,
    showTouchHint,
    closeOverlay,
    isAnyOverlayOpen,
    syncNav,
    resetRunButton,
    onEnter() {
      root.classList.add('is-entered');
      setHints(state.mode);
      if (isTouch) {
        if (els.touch) els.touch.hidden = false;
        showTouchHint();
      }
    },
    getState: () => ({ ...state }),
    isModalOpen: () => state.modalOpen,
    isHelpOpen: () => state.helpOpen,
    isMapOpen: () => state.mapOpen,
    isPhoto: () => state.photo,
    isSplash: () => state.splash,
    isAllHidden: () => state.allHidden,
    isTouch: () => isTouch,
    isTypingTarget,
  };
}
