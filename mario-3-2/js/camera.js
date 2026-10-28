/* =========================================================================
   MARIO 3-2 — camera.js
   Orthographic follow camera: deadzone + facing/speed lookahead, slow vertical
   tracking, level bounds, bonus-room clamp with a quick pan, screen shake and
   damped zoom. Owned by UI. Public: window.M32.CameraRig
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;

  const Z_CAM = 600;

  M32.CameraRig = class CameraRig {
    /**
     * @param {THREE.WebGLRenderer} renderer
     * @param {THREE.Scene} scene
     * @param {object} level      M32.LEVEL
     * @param {object} level3d    M32.Level3D.build(level) (optional but preferred)
     */
    constructor(renderer, scene, level, level3d) {
      this.renderer = renderer || null;
      this.scene = scene || null;
      this.level = level || (M.Game && M.Game.level) || null;
      this.level3d = level3d || (M.Game && M.Game.level3d) || null;

      // view size in world units (recomputed on resize)
      this.viewW = 1100;
      this.viewH = 800;
      this.aspect = 1100 / 800;
      this.width = 0;
      this.height = 0;
      this.pixelRatio = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      // camera x/y = centre of the view in world space
      this.x = 0;
      this.y = 400;

      // follow state (all distances are retuned proportionally in resize())
      this._followX = 0;
      this._followY = 400;
      this._hasFollow = false;
      this.deadzoneX = 130;
      this.deadzoneY = 58;
      this.lookahead = 145;
      this.followOffsetY = 19;
      this.speedLookX = 100;
      this.speedLookY = 65;

      // shake
      this.shakeAmp = 0;
      this.shakeTime = 0;
      this.shakeDur = 0;
      this._shakeX = 0;
      this._shakeY = 0;

      // zoom
      this.zoom = 1;
      this._zoomTarget = 1;

      // bonus room state
      this._roomKey = null;
      this._roomPan = 0;

      const camera = new THREE.OrthographicCamera(
        -this.viewW / 2, this.viewW / 2, this.viewH / 2, -this.viewH / 2, 0.1, 2000
      );
      camera.position.set(0, 400, Z_CAM);
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      this.camera = camera;

      this._tmpV = new THREE.Vector3();

      const w = (typeof window !== 'undefined' && window.innerWidth) || 1280;
      const h = (typeof window !== 'undefined' && window.innerHeight) || 720;
      this.resize(w, h);
    }

    /* ------------------------------------------------------------- resize */
    resize(w, h) {
      w = Math.max(1, Math.round(w || (this.renderer && this.renderer.domElement
        ? this.renderer.domElement.clientWidth : 1280)));
      h = Math.max(1, Math.round(h || (this.renderer && this.renderer.domElement
        ? this.renderer.domElement.clientHeight : 720)));
      this.width = w;
      this.height = h;

      const C = M.C || {};
      const baseH = C.VIEW_H || 480;
      const minW = C.VIEW_W_MIN || 700;
      const maxW = C.VIEW_W_MAX || 1080;
      const aspect = M.clamp(w / h, 0.35, 3.5);

      let vw = baseH * aspect;
      let vh = baseH;

      if (aspect < 1) {
        // ---------- portrait: keep a usable width, then cap the vertical view.
        // (with baseH clamped to 480 a 1400-tall cap is mostly out of reach, but
        // it still guards very tall phones against absurd vertical views.)
        if (vw < minW) {
          vw = minW;
          vh = vw / aspect;
        }
        const portraitMaxH = Math.max(baseH, 1400);
        if (vh > portraitMaxH) {
          vh = portraitMaxH;
          vw = vh * aspect;
        }
      } else {
        // ---------- landscape: width clamp, keep square pixels by deriving height
        if (vw < minW) { vw = minW; vh = vw / aspect; }
        else if (vw > maxW) { vw = maxW; vh = vw / aspect; }
      }

      this.viewW = vw;
      this.viewH = vh;
      this.aspect = vw / vh;
      this._tuneToView();

      const cam = this.camera;
      cam.left = -vw / 2;
      cam.right = vw / 2;
      cam.top = vh / 2;
      cam.bottom = -vh / 2;
      cam.near = 0.1;
      cam.far = 2000;
      cam.updateProjectionMatrix();

      // keep the camera inside the level after an aspect change
      this.x = this._clampX(this.x);
      this.y = this._clampY(this.y);
      this._applyCamera();
    }

    /* -------------------------------------------------------------- update */
    update(dt) {
      dt = M.clamp(typeof dt === 'number' && isFinite(dt) ? dt : 0, 0, 0.1);
      const game = M.Game || null;
      const player = game && game.player ? game.player : null;
      const level3d = this.level3d || (game && game.level3d) || null;

      // ----- zoom damping
      if (Math.abs(this.zoom - this._zoomTarget) > 0.0005) {
        this.zoom = M.damp(this.zoom, this._zoomTarget, 7, dt);
        if (Math.abs(this.zoom - this._zoomTarget) < 0.001) this.zoom = this._zoomTarget;
        this.camera.zoom = this.zoom;
        this.camera.updateProjectionMatrix();
      }

      // ----- bonus room? (short, quick pan; camera stays inside the room)
      let room = null;
      if (player && level3d && typeof level3d.roomAt === 'function') {
        try {
          room = level3d.roomAt(player.x, player.y);
        } catch (e) {
          room = null;
        }
      }

      let lamX = 6.5;
      let lamY = 3.6;

      if (room) {
        const rect = room.rect || room;
        const rx = typeof rect.x === 'number' ? rect.x : 0;
        const ry = typeof rect.y === 'number' ? rect.y : 0;
        const rw = typeof rect.w === 'number' ? rect.w : 520;
        const rh = typeof rect.h === 'number' ? rect.h : 420;
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;

        let tx;
        let ty;
        if (rw > this.viewW) tx = M.clamp(cx, rx + this.viewW / 2, rx + rw - this.viewW / 2);
        else tx = cx;
        if (rh > this.viewH) ty = M.clamp(cy, ry + this.viewH / 2, ry + rh - this.viewH / 2);
        else ty = cy;

        const key = room.id != null ? 'id:' + room.id : 'r:' + rx + ',' + ry;
        if (key !== this._roomKey) {
          this._roomKey = key;
          this._roomPan = 0.35; // quick pan on entry
        }
        lamX = this._roomPan > 0 ? 11 : 7;
        lamY = this._roomPan > 0 ? 10 : 7;
        this._followX = tx;
        this._followY = ty;
        this.x = M.damp(this.x, tx, lamX, dt);
        this.y = M.damp(this.y, ty, lamY, dt);
        // fully settle so a large pan never keeps sub-pixel motion going
        if (Math.abs(this.x - tx) < 0.5) this.x = tx;
        if (Math.abs(this.y - ty) < 0.5) this.y = ty;
        // room rects are authoritative while inside: never show outside it
        if (rw >= this.viewW) this.x = M.clamp(this.x, rx + this.viewW / 2, rx + rw - this.viewW / 2);
        if (rh >= this.viewH) this.y = M.clamp(this.y, ry + this.viewH / 2, ry + rh - this.viewH / 2);
      } else {
        this._roomKey = null;
        this._roomPan = 0;

        if (player) {
          if (!this._hasFollow) {
            this._hasFollow = true;
            this._followX = player.x;
            this._followY = player.y + this.followOffsetY;
            this.x = this._clampX(this._followX);
            this.y = this._clampY(this._followY);
          }

          const vx = isFinite(player.vx) ? player.vx : 0;
          const vy = isFinite(player.vy) ? player.vy : 0;

          // facing (player exposes either a number or a string)
          let dir = vx < -4 ? -1 : vx > 4 ? 1 : 1;
          if (typeof player.facing === 'number' && player.facing !== 0) dir = player.facing < 0 ? -1 : 1;
          else if (typeof player.facing === 'string' && player.facing) {
            dir = /left/i.test(player.facing) ? -1 : 1;
          }

          const look = dir * this.lookahead + M.clamp(vx * 0.38, -this.speedLookX, this.speedLookX);
          const bandX = this.deadzoneX + Math.min(this.lookahead * 0.55, Math.abs(vx) * 0.12);

          // horizontal deadzone: re-target when the *desired* view drifts too far
          const desiredX = player.x + look;
          if (Math.abs(desiredX - this.x) > bandX) {
            this._followX = desiredX;
          }
          this.x = M.damp(this.x, this._followX, lamX, dt);
          this.x = this._clampX(this.x);

          // vertical: slower tracking, biased slightly above the feet
          const bandY = this.deadzoneY + Math.min(this.viewH * 0.08, Math.abs(vy) * 0.1);
          const desiredY = player.y + this.followOffsetY +
            M.clamp(vy * 0.22, -this.speedLookY, this.speedLookY);
          if (Math.abs(desiredY - this.y) > bandY) {
            this._followY = desiredY;
          }
          this.y = M.damp(this.y, this._followY, lamY, dt);
          this.y = this._clampY(this.y);
        } else {
          this.x = this._clampX(this.x);
          this.y = this._clampY(this.y);
        }
      }

      if (this._roomPan > 0) this._roomPan -= dt;

      // ----- shake (decaying random offset, applied only to the camera transform)
      if (this.shakeTime > 0 || this.shakeAmp > 0) {
        this.shakeTime -= dt;
        if (this.shakeTime <= 0 || this.shakeAmp <= 0.05) {
          this.shakeAmp = 0;
          this.shakeTime = 0;
          this._shakeX = 0;
          this._shakeY = 0;
        } else {
          const k = this.shakeDur > 0 ? M.clamp(this.shakeTime / this.shakeDur, 0, 1) : 0;
          const amp = this.shakeAmp * k * k;
          this._shakeX = (Math.random() * 2 - 1) * amp;
          this._shakeY = (Math.random() * 2 - 1) * amp;
        }
      }

      this._applyCamera();
    }

    /* ---------------------------------------------------------------- API */

    /** snap the camera to a world point (used on respawn / teleport) */
    snapTo(x, y) {
      const player = M.Game && M.Game.player;
      if (typeof x !== 'number' || !isFinite(x)) x = player ? player.x : this.x;
      if (typeof y !== 'number' || !isFinite(y)) y = player ? player.y : this.y;

      this._followX = x;
      this._followY = y + this.followOffsetY;
      this._hasFollow = true;

      // check whether this point is inside a bonus room and aim at it
      const l3 = this.level3d || (M.Game && M.Game.level3d);
      let room = null;
      if (l3 && typeof l3.roomAt === 'function') {
        try { room = l3.roomAt(x, y); } catch (e) { room = null; }
      }
      if (room) {
        const rect = room.rect || room;
        const rx = rect.x || 0;
        const ry = rect.y || 0;
        const rw = rect.w || 520;
        const rh = rect.h || 420;
        const cx = rx + rw / 2;
        const cy = ry + rh / 2;
        this.x = rw > this.viewW
          ? M.clamp(cx, rx + this.viewW / 2, rx + rw - this.viewW / 2) : cx;
        this.y = rh > this.viewH
          ? M.clamp(cy, ry + this.viewH / 2, ry + rh - this.viewH / 2) : cy;
        this._followX = this.x;
        this._followY = this.y;
        this._roomKey = room.id != null ? 'id:' + room.id : 'r:' + rx + ',' + ry;
        this._roomPan = 0;
      } else {
        this.x = this._clampX(x);
        this.y = this._clampY(y + this.followOffsetY);
        this._roomKey = null;
        this._roomPan = 0;
      }

      this._shakeX = 0;
      this._shakeY = 0;
      this.shakeAmp = 0;
      this.shakeTime = 0;
      this._applyCamera();
    }

    /** screen rumble: amount in world px, time in seconds */
    shake(amount, time) {
      const a = typeof amount === 'number' && isFinite(amount) ? Math.abs(amount) : 6;
      const t = typeof time === 'number' && isFinite(time) ? Math.max(0.02, time) : 0.2;
      if (a <= 0) return;
      this.shakeAmp = Math.max(this.shakeAmp, a);
      this.shakeTime = Math.max(this.shakeTime, t);
      this.shakeDur = this.shakeTime;
    }

    /** damped zoom target (1 = default). Death zoom-in / clear zoom-out. */
    setZoom(target) {
      const t = typeof target === 'number' && isFinite(target) ? target : 1;
      this._zoomTarget = M.clamp(t, 0.4, 4);
    }

    /** project a world point to CSS pixel coordinates (for HUD markers) */
    worldToScreen(v3) {
      const cam = this.camera;
      if (!cam) return { x: 0, y: 0 };
      const src = v3 || { x: this.x, y: this.y };
      this._tmpV.set(
        typeof src.x === 'number' ? src.x : 0,
        typeof src.y === 'number' ? src.y : 0,
        typeof src.z === 'number' ? src.z : 0
      );
      if (cam.updateMatrixWorld) cam.updateMatrixWorld();
      this._tmpV.project(cam);
      const w = this.width || (typeof window !== 'undefined' ? window.innerWidth : 1280) || 1;
      const h = this.height || (typeof window !== 'undefined' ? window.innerHeight : 720) || 1;
      return {
        x: (this._tmpV.x * 0.5 + 0.5) * w,
        y: (-this._tmpV.y * 0.5 + 0.5) * h,
      };
    }

    /* ----------------------------------------------------------- internals */

    /**
     * Follow distances scale with the view so the framing stays identical at
     * 480 / 700 / 800-tall views and on portrait phones.
     */
    _tuneToView() {
      const vw = this.viewW;
      const vh = this.viewH;
      // horizontal camera band (~16% of the view) and facing/speed lookahead
      this.deadzoneX = Math.max(36, vw * 0.16);
      this.lookahead = M.clamp(vw * 0.17, 90, 170);
      this.speedLookX = vw * 0.12;
      // vertical tracking is lazier: ~12% band, small upward bias, capped speed lead
      this.deadzoneY = Math.max(26, vh * 0.12);
      this.followOffsetY = vh * 0.04;
      this.speedLookY = vh * 0.14;
    }

    _levelSize() {
      const level = this.level || (M.Game && M.Game.level) || null;
      const C = M.C || {};
      return {
        w: level && isFinite(level.width) ? level.width : (C.WORLD_W || 6400),
        h: level && isFinite(level.height) ? level.height : (C.WORLD_H || 1080),
      };
    }

    _clampX(x) {
      const lv = this._levelSize();
      const hw = this.viewW / 2;
      if (!(lv.w > this.viewW)) return lv.w / 2;
      return M.clamp(x, hw, lv.w - hw);
    }

    _clampY(y) {
      const lv = this._levelSize();
      const hh = this.viewH / 2;
      if (!(lv.h > this.viewH)) return lv.h / 2;
      return M.clamp(y, hh, lv.h - hh);
    }

    _applyCamera() {
      const cam = this.camera;
      if (!cam) return;
      cam.position.set(this.x + this._shakeX, this.y + this._shakeY, Z_CAM);
    }
  };
})();
