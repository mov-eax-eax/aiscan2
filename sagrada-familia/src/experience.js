// Sagrada Família — the walkable experience.
//
// createExperience(ctx) is called by src/main.js after every builder has run.
// It owns the camera pose in walk / fly / tour / splash, the HUD, the guided
// tour, hotspot discovery, procedural audio, the plan, and the mobile controls.
//
// Debug surface: URL parameters and window.__sagrada (see the QA contract in
// the project brief). main.js owns the global; this module augments it.

import { THREE } from './lib.js';
import { DIM as CONFIG_DIM } from './config.js';
import { createUI } from './experience/ui.js';
import { createControls } from './experience/controls.js';
import { createTour } from './experience/tour.js';
import { createAudio } from './experience/audio.js';
import { createMinimap } from './experience/minimap.js';
import { createStudy } from './experience/study.js';
import { prepareColliders } from './experience/collide.js';
import { clamp, easeInOutCubic, isCoarsePointer, isNightHour, isTypingTarget, readVec3 } from './experience/util.js';

const ENTER_WALK_TOAST = 'Walking · click the view to look around';
const ENTER_FLY_TOAST = 'Free fly · no collision · wheel speed · R reset';
const NIGHT_HOUR = 21.5;
const DAY_HOUR = 10.35;
// Late-afternoon raking light for the first impression (and the splash view).
const DEFAULT_HOUR = 16.75;

// Cinematic framing overrides for the guided tour. Teleport keeps the authored
// TOUR positions (the QA contract compares against them); the tour may reframe
// a stop so the whole silhouette — including the tower of Jesus — fits the
// 58° lens, and so interior stops sit at eye level instead of gazing upward.
const TOUR_FRAMING = {
  plaza: { pos: [96, 28, 112], target: [0, 70, 0], fov: 74 },
  towers: { pos: [70, 118, 55], target: [0, 120, 0], fov: 74 },
  summit: { target: [0, 105, 0] },
  night: { pos: [85, 24, 95], target: [0, 80, 0], fov: 76 },
  nave: { pos: [0, 1.9, 39], target: [0, 9, -6] },
  crossing: { pos: [2.5, 1.9, 8], target: [0, 10, -10] },
  altar: { pos: [0, 1.9, -30], target: [0, 10, -56] },
  organ: { target: [0, 11, 20] },
  'nativity-portal': { pos: [41, 1.9, 4], target: [30.5, 6, 0] },
};

// Used only when the builders supplied no hotspot data of their own.
const FALLBACK_HOTSPOTS = [
  {
    id: 'glory-facade',
    title: 'Glory Façade',
    kicker: 'The south face · main entrance',
    body: 'The largest of the three façades, and the one still being completed. Seven portals lead toward the nave under a sculpted cloud of virtues, angels and the Holy Spirit — the door the city enters by.',
    position: [0, 14, 56],
    radius: 36,
  },
  {
    id: 'nativity-facade',
    title: 'Nativity Façade',
    kicker: 'The east face · Gaudí’s own work',
    body: 'Built between 1894 and 1930, the only façade Gaudí saw completed. Faith, Hope and Charity are wrapped in the Tree of Life: doves, vines, angels, animals and the Holy Family. Every surface is carved.',
    position: [37, 14, 0],
    radius: 32,
  },
  {
    id: 'passion-facade',
    title: 'Passion Façade',
    kicker: 'The west face · Subirachs',
    body: 'Josep Maria Subirachs answered Gaudí’s organic abundance with angular, hollow-eyed figures — the scourging, the crown of thorns, the denial of Peter. The Passion is meant to feel stripped bare.',
    position: [-37, 14, 0],
    radius: 32,
  },
  {
    id: 'nave',
    title: 'The Nave',
    kicker: 'Interior · a forest of stone',
    body: 'The columns lean toward the centre, split into branches and flower into a lattice of hyperboloid vaults. Gaudí derived the geometry from trees and ruled surfaces: every arch is a path for light.',
    position: [0, 7, 30],
    radius: 19,
  },
  {
    id: 'crossing',
    title: 'The Crossing',
    kicker: 'Under the tower of Jesus',
    body: 'Four columns of red porphyry hold the crossing. Above, the vault opens toward the lantern and the great tower: the still centre of the building around which the eighteen towers are arranged.',
    position: [0, 8, 0],
    radius: 17,
  },
  {
    id: 'altar',
    title: 'The High Altar',
    kicker: 'Apse and sanctuary',
    body: 'Beyond the crossing the apse curves around the altar, with seven radial chapels along the ambulatory. The whole geometry narrows toward this point of focus.',
    position: [0, 7, -34],
    radius: 20,
  },
  {
    id: 'organ',
    title: 'The Organ Gallery',
    kicker: 'Above the Glory door',
    body: 'The organ looks back down the nave, its pipes rising into the gallery like another plantation of stone and metal. Turn around from here and the nave reads as a single avenue of light.',
    position: [0, 16, 38],
    radius: 16,
  },
  {
    id: 'tower-jesus',
    title: 'Above the Crossing',
    kicker: 'The crown of the temple',
    body: 'From up here the plan resolves: nave, transept, apse and the three façades, with the tower of Jesus at the centre. The Latin cross has been softened into a mountain of pinnacles and light.',
    position: [0, 120, 0],
    radius: 110,
  },
];

export function createExperience(ctx) {
  const {
    scene,
    camera,
    renderer,
    env,
    app,
    DIM = CONFIG_DIM,
    TOUR = [],
    colliders = [],
    hotspots = [],
    walkables = [],
  } = ctx || {};

  const params = new URLSearchParams(window.location.search);
  const isTouch = isCoarsePointer();
  const EYE = DIM.eyeHeight ?? 1.72;
  const PLAYER_CLAMP = DIM.playerClamp ?? 128;

  const prepared = prepareColliders(colliders);

  // ------------------------------------------------------------------ state
  let mode = 'splash';
  let started = false;
  let photo = false;
  let disposed = false;
  let intro = null;
  let splashAngle = Math.atan2(camera.position.z || 110, camera.position.x || 95);
  let splashTime = 0;

  let activeHotspot = null;
  let hotspotAccum = 0;
  let hudAccum = 0;
  let mapAccum = 0;
  let tourAccum = 0;

  let savedUserTime = env.time;
  let savedUserAuto = env.auto;
  let tourTimeChanged = false;
  let wasLocked = false;
  let hadGesture = false;

  const tmpVec = new THREE.Vector3();
  const tmpVec2 = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  // ---------------------------------------------------------------- audio
  const audio = createAudio();

  // ------------------------------------------------------------------- UI
  const handlers = {};
  const ui = createUI({ TOUR, handlers, isTouch });
  const study = createStudy({ scene, renderer });
  ui.setStudy(study.getState());
  ui.setSound(audio.isMuted());
  ui.setQuality(env.quality || 'high');
  ui.setSoftwareMode(!!(app && (app.softwareRenderer || env.softwareRenderer)));
  ui.setClock(env.time);
  ui.setAuto(env.auto);
  ui.setMode('splash');

  // -------------------------------------------------------------- controls
  const controls = createControls({
    camera,
    dom: renderer.domElement,
    DIM,
    prepared,
    walkables,
    isCoarse: isTouch,
    callbacks: {
      onFootstep(surface) {
        audio.footstep(surface);
      },
      canLock() {
        return started && !intro && (mode === 'walk' || mode === 'fly') && !ui.isModalOpen() && !ui.isHelpOpen();
      },
      onLockChange(locked) {
        ui.root.classList.toggle('is-locked', locked);
        if (!locked && wasLocked && started && !intro && mode !== 'tour') {
          ui.toast('Pointer released · click the view to look', 1900);
        }
        wasLocked = locked;
      },
      onLockFailure() {
        if (started) ui.toast('Mouse capture unavailable here — drag the view to look', 3200);
      },
      hotspotActive() {
        return !!activeHotspot && !ui.isModalOpen();
      },
      surfaceAt(x, z) {
        return surfaceForPosition(x, z);
      },
    },
  });
  controls.setMode('walk');

  // ------------------------------------------------------------- minimap
  const minimap = createMinimap({
    DIM,
    TOUR,
    canvas: ui.els.mapCanvas,
    getPlayer: () => ({ pos: camera.position, yaw: viewYaw() }),
    onSelectStop: (id) => {
      teleport(id);
      ui.closeMap();
    },
  });

  // ---------------------------------------------------------------- tour
  const BASE_FOV = camera.isPerspectiveCamera ? camera.fov : 58;
  const framedTour = (Array.isArray(TOUR) ? TOUR : []).map((stop) => {
    const frame = TOUR_FRAMING[stop.id];
    if (!frame) return stop;
    return {
      ...stop,
      pos: frame.pos || stop.pos,
      target: frame.target || stop.target,
      fov: frame.fov || null,
    };
  });
  const tour = createTour({
    camera,
    TOUR: framedTour,
    prepared,
    playerClamp: PLAYER_CLAMP,
    callbacks: {
      onStop(stop, index, total) {
        ui.setTourStop(stop, index, total);
        ui.setTourProgress(0, false);
        minimap.setCurrentStop(stop.id);
        if (stop && stop.time != null) {
          applyTime(stop.time);
          tourTimeChanged = true;
        }
      },
      onTravelStart(stop, index, total) {
        // Show the destination caption while the camera is on its way there.
        ui.setTourStop(stop, index, total);
        ui.setTourProgress(0, false);
        minimap.setCurrentStop(stop.id);
      },
      onFinish() {
        finishTourToFree(true);
      },
      onExit() {
        ui.hideTour();
      },
      onPause(paused) {
        ui.setTourPaused(paused);
      },
    },
  });

  // -------------------------------------------------------------- hotspots
  const hotspotList = buildHotspotList(hotspots);

  // ------------------------------------------------------------- handlers
  Object.assign(handlers, {
    start(next) {
      enter(next);
    },
    modeToggle: toggleWalkFly,
    study: (mode) => toggleStudy(mode),
    studyPart: (part) => selectStudyPart(part),
    auto: toggleAuto,
    night: toggleNight,
    tour: toggleTour,
    teleport: (id) => teleport(id),
    time: (h) => setTime(h),
    sound: toggleSound,
    quality: (q) => setQuality(q),
    photo: togglePhoto,
    help: () => {
      if (ui.isHelpOpen()) closeHelp();
      else openHelp();
    },
    tourPrev() {
      if (!tour.isActive()) return;
      tour.prev();
      const st = tour.getState();
      if (st.stop) ui.setTourStop(st.stop, st.index, st.total);
    },
    tourNext() {
      if (!tour.isActive()) return;
      tour.next();
      const st = tour.getState();
      if (st.stop) ui.setTourStop(st.stop, st.index, st.total);
    },
    tourPause() {
      if (!tour.isActive()) return;
      tour.togglePause();
    },
    tourExit() {
      exitTour(false);
    },
    hotspotOpen: openActiveHotspot,
    mapShown: () => renderMinimap(true),
    touchMove: (x, y) => controls.setTouchMove(x, y),
    touchVertical: (v) => controls.setTouchVertical(v),
    touchRun: (v) => controls.setTouchRun(v),
  });

  // ------------------------------------------------------------- lifecycle

  function viewYaw() {
    camera.getWorldDirection(tmpDir);
    return Math.atan2(-tmpDir.x, -tmpDir.z);
  }

  function surfaceForPosition(x, z) {
    const pos = tmpVec2.set(x, camera.position.y, z);
    return isInterior(pos) ? 'stone' : 'plaza';
  }

  function isInterior(point) {
    if (!point) return false;
    if (point.y > 48) return false;
    const naveHalf = DIM.naveHalfLength ?? 45;
    const naveX = (DIM.naveWallOuterX ?? 16.2) + 1.4;
    const transHalf = (DIM.transeptHalfLength ?? 30) + 1.4;
    const transW = (DIM.transeptHalfWidth ?? 15) + 1.4;
    const apseOuter = (DIM.apseOuterRadius ?? 22.5) + 0.5;
    if (Math.abs(point.x) <= naveX && point.z >= -naveHalf && point.z <= naveHalf) return true;
    if (Math.abs(point.z) <= transW && Math.abs(point.x) <= transHalf) return true;
    if (point.z < -naveHalf && Math.hypot(point.x, point.z + naveHalf) <= apseOuter) return true;
    return false;
  }

  function defaultPose(target) {
    if (target === 'fly') {
      return { pos: [96, 46, 118], look: [0, 58, 0] };
    }
    return { pos: [72, EYE, 100], look: [0, 42, 0] };
  }

  function enter(target, opts = {}) {
    if (started || disposed) return;
    started = true;
    restoreFov();
    if (hadGesture && !audio.isMuted()) audio.ensure();
    ui.hideSplash();
    ui.onEnter();

    if (target === 'tour') {
      mode = 'tour';
      ui.setMode('tour');
      startTour(opts.tourId ?? 0, { instant: !!opts.instant });
      return;
    }

    const next = target === 'fly' ? 'fly' : 'walk';
    mode = next;
    ui.setMode(next);
    controls.setMode(next);
    const pose = defaultPose(next);
    if (opts.instant) {
      controls.setPose(pose.pos, pose.look);
      controls.setEnabled(true);
      if (!opts.silent) ui.toast(next === 'walk' ? ENTER_WALK_TOAST : ENTER_FLY_TOAST, 3400);
    } else {
      beginIntro(next, pose);
    }
  }

  function beginIntro(target, pose) {
    const fromPos = camera.position.clone();
    camera.getWorldDirection(tmpDir);
    const fromLook = fromPos.clone().addScaledVector(tmpDir, 40);
    const toPos = new THREE.Vector3(pose.pos[0], pose.pos[1], pose.pos[2]);
    const toLook = new THREE.Vector3(pose.look[0], pose.look[1], pose.look[2]);
    const dist = fromPos.distanceTo(toPos);
    const ctrl = fromPos.clone().add(toPos).multiplyScalar(0.5);
    ctrl.y += clamp(dist * 0.22, 4, 34);
    intro = {
      t: 0,
      dur: 2.35,
      fromPos,
      fromLook,
      toPos,
      toLook,
      ctrl,
      target,
      lift: ctrl.y,
    };
    ui.setMode(target);
    controls.setMode(target);
    controls.setEnabled(false);
  }

  function updateIntro(dt) {
    const tr = intro;
    tr.t += dt;
    const u = clamp(tr.t / tr.dur, 0, 1);
    const e = easeInOutCubic(u);
    const inv = 1 - e;
    tmpVec.set(0, 0, 0);
    tmpVec.addScaledVector(tr.fromPos, inv * inv);
    tmpVec.addScaledVector(tr.ctrl, 2 * inv * e);
    tmpVec.addScaledVector(tr.toPos, e * e);
    tmpVec2.lerpVectors(tr.fromLook, tr.toLook, easeInOutCubic(clamp(u * 1.18, 0, 1)));
    camera.position.copy(tmpVec);
    camera.lookAt(tmpVec2);
    if (u >= 1) {
      intro = null;
      controls.setPose(tr.toPos, tr.toLook);
      controls.setEnabled(true);
    }
  }

  function updateSplashCamera(dt) {
    splashTime += dt;
    splashAngle += dt * 0.03;
    const radius = 153 + Math.sin(splashTime * 0.05) * 6;
    const y = 50 + Math.sin(splashTime * 0.07 + 1.1) * 9;
    // A slightly wider lens and a high look target keep the whole silhouette —
    // including the tower of Jesus — inside the frame from this close orbit.
    if (camera.isPerspectiveCamera && camera.fov !== 66) {
      camera.fov = 66;
      camera.updateProjectionMatrix();
    }
    camera.position.set(Math.cos(splashAngle) * radius, y, Math.sin(splashAngle) * radius);
    camera.lookAt(0, 79, 0);
  }

  // ----------------------------------------------------------- study modes
  const STUDY_PART_ORDER = ['all', 'shell', 'towers', 'interior'];
  const STUDY_PART_LABEL = {
    all: 'Whole temple',
    shell: 'Shell & façades',
    towers: 'Towers & roofs',
    interior: 'Interior',
  };

  function toggleStudy(mode) {
    if (!started) return;
    if (ui.isHelpOpen()) closeHelp();
    const st = study.getState();
    if (mode === 'mesh') {
      study.setMesh(!st.mesh);
      const on = study.getState().mesh;
      ui.toast(on ? 'Mesh · wireframe survey' : 'Mesh off', 1900);
    } else if (mode === 'section') {
      study.setSection(!st.section);
      const on = study.getState().section;
      ui.toast(on ? 'Section · cutaway at z = 8 m' : 'Section closed', 2100);
    } else if (mode === 'parts') {
      ui.toast('Isolate · choose a part below', 1800);
    }
    ui.setStudy(study.getState());
  }

  function selectStudyPart(part) {
    if (!started) return;
    study.setPart(part);
    ui.setStudy(study.getState());
    ui.toast(`Only · ${STUDY_PART_LABEL[study.getState().part] || part}`, 1800);
  }

  function cycleStudyPart() {
    const current = study.getState().part;
    const next = STUDY_PART_ORDER[(STUDY_PART_ORDER.indexOf(current) + 1) % STUDY_PART_ORDER.length];
    selectStudyPart(next);
  }

  // ------------------------------------------------------------------ modes

  function setMode(next) {
    if (next === 'tour') {
      startTour(0);
      return true;
    }
    if (next !== 'walk' && next !== 'fly') return false;
    if (mode === 'tour' || tour.isActive()) {
      tour.exit();
      ui.hideTour();
    }
    if (!started) {
      enter(next, { instant: true });
      return true;
    }
    if (next === mode) return true;
    mode = next;
    restoreFov();
    ui.setMode(next);
    controls.setMode(next);
    controls.setEnabled(true);
    restoreUserTimeIfNeeded();
    ui.toast(next === 'walk' ? 'Walking · click the view to look' : 'Free fly · wheel speed · R reset · Space/E up', 2400);
    return true;
  }

  function toggleWalkFly() {
    if (intro) return;
    if (mode === 'tour' || tour.isActive()) {
      exitTour(false);
      return;
    }
    setMode(mode === 'walk' ? 'fly' : 'walk');
  }

  function startTour(idOrIndex, opts = {}) {
    if (intro) return false;
    if (!started) {
      enter('tour', { instant: !!opts.instant, tourId: idOrIndex });
      return false;
    }
    if (tour.stops.length === 0) {
      ui.toast('No tour stops are available', 2200);
      return false;
    }
    if (!tour.isActive()) {
      savedUserTime = env.time;
      savedUserAuto = env.auto;
      tourTimeChanged = false;
    }
    let index = 0;
    if (typeof idOrIndex === 'string') {
      const found = tour.stops.findIndex((s) => s.id === idOrIndex);
      if (found >= 0) index = found;
    } else if (Number.isFinite(Number(idOrIndex))) {
      index = clamp(Math.round(Number(idOrIndex)), 0, tour.stops.length - 1);
    }
    mode = 'tour';
    ui.setMode('tour');
    controls.exitLock();
    controls.setEnabled(false);
    // Study views are for free exploration; restore the full fabric for the tour.
    study.reset();
    ui.setStudy(study.getState());
    closeAllOverlays();
    ui.showTour();
    ui.hideHotspot();
    tour.start(index, { instant: !!opts.instant });
    const st = tour.getState();
    if (st.stop) {
      ui.setTourStop(st.stop, st.index, st.total);
      ui.setTourProgress(st.progress, false);
      minimap.setCurrentStop(st.stop.id);
    }
    return true;
  }

  function toggleTour() {
    if (mode === 'tour' || tour.isActive()) exitTour(false);
    else startTour(0);
  }

  function exitTour(completed) {
    if (!tour.isActive() && mode !== 'tour') return;
    const stop = tour.getStop();
    tour.exit();
    restoreFov();
    ui.hideTour();
    minimap.setCurrentStop(null);
    mode = 'fly';
    ui.setMode('fly');
    controls.setMode('fly');
    camera.getWorldDirection(tmpDir);
    controls.setPose(camera.position, camera.position.clone().addScaledVector(tmpDir, 30));
    controls.setEnabled(true);
    restoreUserTimeIfNeeded();
    if (!completed) ui.toast(stop ? 'Tour ended · free look' : 'Free look', 2000);
  }

  function finishTourToFree(completed) {
    exitTour(true);
    if (completed) ui.toast('Tour complete · free look', 2600);
  }

  function restoreFov() {
    if (!camera.isPerspectiveCamera) return;
    if (camera.fov !== BASE_FOV) {
      camera.fov = BASE_FOV;
      camera.updateProjectionMatrix();
    }
  }

  function restoreUserTimeIfNeeded() {
    if (!tourTimeChanged) return;
    tourTimeChanged = false;
    if (app.setTimeOfDay) app.setTimeOfDay(savedUserTime, savedUserAuto); else env.time = savedUserTime;
    ui.setClock(env.time);
    ui.syncSlider(env.time);
  }

  // ---------------------------------------------------------------- teleport

  function teleport(id) {
    if (!id || intro) return false;
    const stop = (Array.isArray(TOUR) ? TOUR : []).find((s) => s.id === id);
    if (!stop) return false;
    if (!started) enter('walk', { instant: true, silent: true });
    if (tour.isActive() || mode === 'tour') {
      tour.exit();
      ui.hideTour();
      minimap.setCurrentStop(null);
      restoreUserTimeIfNeeded();
    }
    const next = stop.mode === 'walk' ? 'walk' : 'fly';
    mode = next;
    ui.setMode(next);
    controls.setMode(next);
    // Teleport lands on the authored stop (QA compares against TOUR[i].pos);
    // the guided tour itself uses collision-checked, framed positions. For a
    // few hero stops we widen the lens and raise the look target so the whole
    // silhouette is framed (the position stays exactly as authored).
    restoreFov();
    const frame = TOUR_FRAMING[stop.id];
    if (frame && camera.isPerspectiveCamera) {
      if (Number.isFinite(frame.fov) && camera.fov !== frame.fov) {
        camera.fov = frame.fov;
        camera.updateProjectionMatrix();
      }
    }
    controls.setPose(stop.pos, (frame && frame.target) || stop.target);
    controls.setEnabled(true);
    if (stop.time != null) {
      applyTime(stop.time);
      tourTimeChanged = false;
    }
    ui.hideHotspot();
    activeHotspot = null;
    ui.toast(stop.title || id, 2200);
    return true;
  }

  function setPoseAPI(posValue, lookValue) {
    const pos = readVec3(posValue);
    if (!pos) return false;
    const look = readVec3(lookValue);
    if (!started) enter(mode === 'fly' ? 'fly' : 'walk', { instant: true, silent: true });
    if (tour.isActive() || mode === 'tour') {
      tour.exit();
      restoreFov();
      ui.hideTour();
      minimap.setCurrentStop(null);
      restoreUserTimeIfNeeded();
      mode = 'fly';
      ui.setMode('fly');
      controls.setMode('fly');
    }
    controls.setPose(pos, look || null);
    controls.setEnabled(true);
    ui.hideHotspot();
    return true;
  }

  // ---------------------------------------------------------------- time

  function applyTime(hours) {
    const h = ((Number(hours) % 24) + 24) % 24;
    if (app.setTimeOfDay) app.setTimeOfDay(h, false);
    env.time = h;
    ui.setClock(h);
    ui.syncSlider(h);
  }

  function noteUserTime(h) {
    if (!tour.isActive()) return;
    savedUserTime = ((Number(h) % 24) + 24) % 24;
    savedUserAuto = false;
  }

  function setTime(hours) {
    if (!Number.isFinite(Number(hours))) return;
    applyTime(Number(hours));
    noteUserTime(hours);
    ui.setAuto(false);
    if (app.setAutoTime) app.setAutoTime(false);
  }

  function toggleAuto() {
    if (app.setAutoTime) app.setAutoTime(!env.auto);
    ui.setAuto(env.auto);
    ui.toast(env.auto ? 'Clock cycling' : 'Clock paused', 1800);
  }

  function toggleNight() {
    const night = isNightHour(env.time);
    const target = night ? DAY_HOUR : NIGHT_HOUR;
    applyTime(target);
    noteUserTime(target);
    ui.toast(night ? 'Daylight' : 'Night illumination', 2400);
  }

  // ---------------------------------------------------------------- sound

  function toggleSound() {
    const muted = audio.toggleMuted();
    if (!muted) audio.ensure();
    ui.setSound(muted);
    ui.toast(muted ? 'Sound muted' : 'Sound on', 1700);
  }

  // --------------------------------------------------------------- quality

  function setQuality(q) {
    if (!['low', 'medium', 'high'].includes(q)) return;
    if (app.setQuality) app.setQuality(q);
    ui.setQuality(q);
    ui.toast(`Quality · ${q}`, 1600);
  }

  // ------------------------------------------------------------------ photo

  function setPhotoAPI(on) {
    const value = !!on;
    if (value && !started) {
      enter(modeParam() || 'fly', { instant: true, silent: true });
    }
    if (value && tour.isActive()) exitTour(false);
    photo = value;
    ui.setPhoto(value);
    if (value) {
      ui.hideHotspot();
      controls.exitLock();
      ui.toast('Photo mode · P or Esc to exit', 3400);
    } else {
      ui.toast('Interface restored', 1500);
    }
  }

  function togglePhoto() {
    setPhotoAPI(!photo);
  }

  function hideUI(value) {
    const hidden = value !== false;
    ui.setAllHidden(hidden);
    if (hidden) ui.hideSplash();
  }

  // ---------------------------------------------------------------- overlays

  function closeAllOverlays() {
    for (let i = 0; i < 8; i++) {
      if (!ui.closeOverlay()) break;
    }
  }

  function openHelp() {
    controls.exitLock();
    ui.openHelp();
    controls.setEnabled(false);
  }

  function closeHelp() {
    ui.closeHelp();
    controls.setEnabled(started && !intro && !ui.isModalOpen());
  }

  function openActiveHotspot() {
    if (!activeHotspot) return false;
    controls.exitLock();
    ui.openModal({
      kicker: activeHotspot.kicker || 'Place',
      title: activeHotspot.title,
      body: activeHotspot.body,
    });
    return true;
  }

  function openHotspotById(id) {
    const hs = hotspotList.find((h) => h.id === id);
    if (!hs) return false;
    activeHotspot = hs;
    return openActiveHotspot();
  }

  // --------------------------------------------------------------- map

  function toggleMap() {
    ui.toggleMap();
    minimap.setVisible(ui.isMapOpen());
    if (ui.isMapOpen()) renderMinimap(true);
  }

  function renderMinimap(force = false) {
    const open = ui.isMapOpen();
    minimap.setVisible(open);
    if (!open) return;
    camera.getWorldDirection(tmpDir);
    minimap.setPlayer({ pos: camera.position, yaw: Math.atan2(-tmpDir.x, -tmpDir.z) });
    minimap.setCurrentStop(mode === 'tour' ? tour.getStop()?.id : null);
    minimap.render();
  }

  // -------------------------------------------------------------- hotspots

  function buildHotspotList(source) {
    const list = [];
    const seen = new Set();
    const useSource = Array.isArray(source) && source.length >= 3;
    const items = useSource ? source : FALLBACK_HOTSPOTS;
    for (const raw of items) {
      if (!raw) continue;
      const id = raw.id || raw.title || `hotspot-${list.length}`;
      if (seen.has(id)) continue;
      const pos = readVec3(raw.position || raw.pos || raw.point);
      if (!pos) continue;
      if (!raw.title && !raw.body) continue;
      seen.add(id);
      list.push({
        id,
        title: raw.title || id,
        kicker: raw.kicker || '',
        body: raw.body || '',
        position: new THREE.Vector3(pos.x, pos.y, pos.z),
        radius: Number.isFinite(Number(raw.radius)) ? Number(raw.radius) : 14,
      });
    }
    return list;
  }

  function updateHotspots() {
    if (disposed || !started) {
      ui.hideHotspot();
      activeHotspot = null;
      return;
    }
    if (mode !== 'walk' && mode !== 'fly') {
      ui.hideHotspot();
      activeHotspot = null;
      return;
    }
    if (intro || photo || ui.isPhoto() || ui.isAllHidden() || ui.isModalOpen() || ui.isHelpOpen() || ui.isSplash()) {
      ui.hideHotspot();
      activeHotspot = null;
      return;
    }
    camera.getWorldDirection(tmpDir);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxPx = Math.min(width, height) * 0.3;
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < hotspotList.length; i++) {
      const hs = hotspotList[i];
      tmpVec.copy(hs.position).sub(camera.position);
      const dist = tmpVec.length();
      if (dist < 0.4 || dist > hs.radius) continue;
      tmpVec.multiplyScalar(1 / dist);
      if (tmpVec.dot(tmpDir) < 0.5) continue; // must be in front, near the centre of view
      tmpVec2.copy(hs.position).project(camera);
      if (tmpVec2.z < -1 || tmpVec2.z > 1) continue;
      const sx = (tmpVec2.x * 0.5 + 0.5) * width;
      const sy = (-tmpVec2.y * 0.5 + 0.5) * height;
      if (sx < -40 || sx > width + 40 || sy < -40 || sy > height + 40) continue;
      const px = Math.hypot(sx - centerX, sy - centerY);
      if (px > maxPx) continue;
      const score = dist / hs.radius + (px / maxPx) * 0.45;
      if (score < bestScore) {
        bestScore = score;
        best = { hs, sx, sy };
      }
    }

    if (!best) {
      activeHotspot = null;
      ui.hideHotspot();
      return;
    }
    activeHotspot = best.hs;
    ui.showHotspot({
      id: best.hs.id,
      title: best.hs.title,
      kicker: best.hs.kicker,
      x: best.sx,
      y: best.sy,
      hint: isTouch ? 'tap to read' : 'E to read',
    });
  }

  // ---------------------------------------------------------------- input

  const onKeyDown = (e) => {
    if (disposed) return;
    if (e.key === 'Escape') {
      handleEscape(e);
      return;
    }
    if (isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!started) {
      if (e.code === 'Enter') {
        e.preventDefault();
        enter('walk');
      }
      return;
    }
    if (ui.isHelpOpen()) {
      // Only H (or Escape, handled above) may dismiss the help overlay.
      if (e.code === 'KeyH') {
        e.preventDefault();
        closeHelp();
      }
      return;
    }
    if (ui.isModalOpen()) return;
    switch (e.code) {
      case 'KeyH':
        e.preventDefault();
        if (ui.isHelpOpen()) closeHelp();
        else openHelp();
        break;
      case 'KeyT':
        e.preventDefault();
        toggleTour();
        break;
      case 'KeyM':
        e.preventDefault();
        toggleMap();
        break;
      case 'KeyP':
        e.preventDefault();
        togglePhoto();
        break;
      case 'KeyF':
        e.preventDefault();
        toggleWalkFly();
        break;
      case 'KeyN':
        e.preventDefault();
        toggleNight();
        break;
      case 'KeyV':
        e.preventDefault();
        toggleStudy('mesh');
        break;
      case 'KeyX':
        e.preventDefault();
        toggleStudy('section');
        break;
      case 'KeyI':
        e.preventDefault();
        cycleStudyPart();
        break;
      case 'KeyE':
        if (activeHotspot && !ui.isModalOpen()) {
          e.preventDefault();
          openActiveHotspot();
        }
        break;
      case 'Space':
        if (mode === 'tour') {
          e.preventDefault();
          tour.togglePause();
        }
        break;
      case 'ArrowLeft':
        if (mode === 'tour') {
          e.preventDefault();
          handlers.tourPrev();
        }
        break;
      case 'ArrowRight':
        if (mode === 'tour') {
          e.preventDefault();
          handlers.tourNext();
        }
        break;
      default:
        break;
    }
  };

  function handleEscape() {
    const closed = ui.closeOverlay();
    if (closed) {
      controls.setEnabled(started && !intro);
      return;
    }
    if (mode === 'tour' || tour.isActive()) {
      exitTour(false);
      return;
    }
    if (photo) {
      setPhotoAPI(false);
      return;
    }
    // Bare Escape with nothing open simply releases the pointer lock; no toast
    // (keeps repeated Escape calls in QA from stacking messages).
  }

  const onVisibility = () => {
    if (document.hidden) audio.suspend();
    else audio.resume();
  };

  const onResize = () => {
    if (ui.isMapOpen()) renderMinimap(true);
  };

  const firstGesture = () => {
    hadGesture = true;
    if (!audio.isMuted()) audio.ensure();
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  };
  window.addEventListener('pointerdown', firstGesture, { once: true });
  window.addEventListener('keydown', firstGesture, { once: true });

  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);
  if (app.onQuality) app.onQuality((q) => {
    ui.setQuality(q);
  });

  // ------------------------------------------------------------ debug / URLs

  function modeParam() {
    const raw = params.get('mode');
    if (raw === 'walk' || raw === 'fly' || raw === 'tour') return raw;
    return null;
  }

  function parseVecParam(name) {
    const raw = params.get(name);
    if (!raw) return null;
    const parts = raw.split(',').map((v) => Number(v));
    if (parts.length < 3 || !parts.every((v) => Number.isFinite(v))) return null;
    return [parts[0], parts[1], parts[2]];
  }

  function applyURLParams() {
    const skipSplash = params.get('skipSplash') === '1';
    const photoParam = params.get('photo') === '1';
    const uiParam = params.get('ui') === '0';
    const hudParam = params.get('hud') === '0';
    const timeRaw = params.get('time');
    const timeParam = timeRaw !== null && timeRaw !== '' ? Number(timeRaw) : NaN;
    const modeQ = modeParam();
    const tourQ = params.get('tour');
    const posQ = parseVecParam('pos');
    const lookQ = parseVecParam('look');

    if (hudParam) ui.setHudHidden(true);

    if (Number.isFinite(timeParam)) {
      applyTime(timeParam);
    } else {
      applyTime(DEFAULT_HOUR);
    }

    if (skipSplash || photoParam || uiParam) {
      if (uiParam) {
        ui.setAllHidden(true);
      }
      if (photoParam) ui.setPhoto(true);
      let target = modeQ || (photoParam ? 'fly' : 'walk');
      if (tourQ) target = 'tour';
      enter(target, { instant: true, silent: true, tourId: tourQ ?? 0 });
      if (target !== 'tour') {
        if (posQ) {
          const pose = { x: posQ[0], y: posQ[1], z: posQ[2] };
          const look = lookQ ? { x: lookQ[0], y: lookQ[1], z: lookQ[2] } : null;
          controls.setPose(pose, look);
        } else if (lookQ) {
          controls.lookToward({ x: lookQ[0], y: lookQ[1], z: lookQ[2] });
        }
      }
      if (photoParam) {
        photo = true;
        ui.setPhoto(true);
      }
      if (Number.isFinite(timeParam)) applyTime(timeParam);
    } else {
      ui.setClock(env.time);
    }
  }

  // ------------------------------------------------------------ render loop

  function update(dtRaw, elapsed) {
    if (disposed) return;
    if (document.hidden) return;
    const dt = Math.min(dtRaw, 0.06);

    // Gate input by overlays before applying it this frame.
    const shouldEnable = started && !intro && !ui.isModalOpen() && !ui.isHelpOpen() && (mode === 'walk' || mode === 'fly');
    if (controls.isEnabled() !== shouldEnable) controls.setEnabled(shouldEnable);

    if (mode === 'splash') {
      updateSplashCamera(dt);
    } else if (intro) {
      updateIntro(dt);
    } else if (mode === 'tour') {
      tour.update(dt);
    } else {
      controls.update(dt);
    }

    // Audio follows the camera.
    audio.update(dt, {
      interior: isInterior(camera.position),
      altitude: camera.position.y,
    });

    // HUD at ~4 Hz.
    hudAccum += dt;
    if (hudAccum >= 0.26) {
      hudAccum = 0;
      ui.setClock(env.time);
      ui.syncSlider(env.time);
      ui.setStats(env.fps, env.quality);
      ui.setAuto(env.auto);
    }

    // Hotspot projection at ~10 Hz.
    hotspotAccum += dt;
    if (hotspotAccum >= 0.1) {
      hotspotAccum = 0;
      updateHotspots();
    }

    // Tour captions / progress.
    if (mode === 'tour') {
      tourAccum += dt;
      if (tourAccum >= 0.1) {
        tourAccum = 0;
        const st = tour.getState();
        ui.setTourProgress(st.progress, st.paused);
      }
    }

    // Plan at <= 10 fps.
    if (ui.isMapOpen()) {
      mapAccum += dt;
      if (mapAccum >= 0.11) {
        mapAccum = 0;
        renderMinimap();
      }
    }
  }

  // ------------------------------------------------------------ public API

  function dispose() {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    try { study.reset(); } catch (e) { /* ignore */ }
    controls.dispose();
    minimap.dispose();
    audio.dispose();
    try {
      ui.root.remove();
    } catch (e) {
      /* ignore */
    }
  }

  function applyInitialCamera() {
    // Set a plausible first frame for the very first rendered frame.
    splashTime = 0;
    if (camera.isPerspectiveCamera) {
      camera.fov = 66;
      camera.updateProjectionMatrix();
    }
    camera.position.set(Math.cos(splashAngle) * 155, 50, Math.sin(splashAngle) * 155);
    camera.lookAt(0, 79, 0);
  }

  const api = {
    get mode() {
      return mode;
    },
    update,
    teleport,
    setMode,
    startTour,
    setPose: setPoseAPI,
    setTime,
    hideUI,
    resize(w, h) {
      minimap.resize();
      if (ui.isMapOpen()) renderMinimap(true);
    },
    dispose,
    ui,
    controls,
    tour,
    audio,
    minimap,
    study,
    setStudy(mode, on) {
      if (mode === 'mesh') study.setMesh(on === undefined ? !study.getState().mesh : on);
      else if (mode === 'section') study.setSection(on === undefined ? !study.getState().section : on);
      else if (mode === 'part') selectStudyPart(on || 'all');
      ui.setStudy(study.getState());
      return study.getState();
    },
    resetStudy() {
      study.reset();
      ui.setStudy(study.getState());
    },
    freeFly() {
      setMode('fly');
    },
    resetFlyView() {
      return controls.resetFlyView();
    },
    getFlySpeed() {
      return controls.getFlySpeed();
    },
    hotspots: hotspotList,
    openHotspot: openHotspotById,
    toggleMap,
    setPhoto: setPhotoAPI,
    // Deterministic stepping for headless QA: the render rate can be far below
    // real time under software WebGL, so tests can advance the simulation here.
    simulate(seconds = 1, step = 1 / 60) {
      const count = Math.max(1, Math.min(2400, Math.round(seconds / step)));
      for (let i = 0; i < count; i++) {
        update(step, env.elapsed + (i + 1) * step);
      }
      camera.getWorldDirection(tmpDir);
      const tourState = tour.getState();
      return {
        pos: camera.position.toArray(),
        mode,
        photo,
        yaw: Math.atan2(-tmpDir.x, -tmpDir.z),
        pitch: Math.asin(clamp(tmpDir.y, -1, 1)),
        look: camera.position.clone().addScaledVector(tmpDir, 20).toArray(),
        tour: tourState.active
          ? { active: true, phase: tourState.phase, index: tourState.index, stop: tourState.stop ? tourState.stop.id : null, progress: tourState.progress, paused: tourState.paused }
          : { active: false },
      };
    },
    getView() {
      camera.getWorldDirection(tmpDir);
      return {
        mode,
        photo,
        locked: controls.isLocked(),
        pos: camera.position.toArray(),
        yaw: Math.atan2(-tmpDir.x, -tmpDir.z),
        pitch: Math.asin(clamp(tmpDir.y, -1, 1)),
        lookTarget: camera.position.clone().addScaledVector(tmpDir, 20).toArray(),
      };
    },
  };

  const instance = api;

  // ------------------------------------------------------------------- boot

  applyInitialCamera();
  applyURLParams();

  // Augment main.js's window.__sagrada once it exists.
  let patchAttempts = 0;
  function patchGlobal() {
    if (disposed) return;
    const g = window.__sagrada;
    if (!g) {
      if (patchAttempts++ < 300) requestAnimationFrame(patchGlobal);
      return;
    }
    if (g.__sfExperience) return;
    g.__sfExperience = true;
    g.setPose = (pos, look) => setPoseAPI(pos, look);
    g.startTour = (id) => startTour(id ?? 0);
    g.hideUI = (value) => hideUI(value);
    g.setTime = (h) => setTime(h);
    g.openHotspot = (id) => openHotspotById(id);
    g.setPhoto = (on) => setPhotoAPI(on);
    g.toggleMap = () => toggleMap();
    g.freeFly = () => setMode('fly');
    g.resetFlyView = () => controls.resetFlyView();
    g.setStudy = (mode, on) => instance.setStudy(mode, on);
    g.setStudyPart = (part) => selectStudyPart(part);
    g.studyState = () => study.getState();
    g.getMode = () => mode;
    g.hotspots = () => hotspotList.map((h) => ({ id: h.id, title: h.title, position: h.position.toArray(), radius: h.radius }));
    g.view = () => instance.getView();
    g.experienceAPI = instance;
    g.simulate = (seconds, step) => instance.simulate(seconds, step);
    try {
      Object.defineProperty(g, 'modeName', {
        configurable: true,
        get: () => mode,
      });
    } catch (e) {
      g.modeName = mode;
    }
    if (!started && mode === 'splash') revealWhenLoaderDone(0);
    g.uiReady = true;
    g.ready = true;
  }

  // Hold the entry screen until main.js has dismissed the loader, so the two
  // crossfade instead of the splash peeking through the loading screen.
  function revealWhenLoaderDone(attempt) {
    if (disposed || started) return;
    const loader = document.getElementById('loader');
    const gone =
      !loader ||
      loader.classList.contains('hidden') ||
      getComputedStyle(loader).display === 'none' ||
      getComputedStyle(loader).visibility === 'hidden';
    if (gone || attempt > 250) {
      ui.revealSplash();
      return;
    }
    setTimeout(() => revealWhenLoaderDone(attempt + 1), 120);
  }

  requestAnimationFrame(patchGlobal);

  return api;
}
