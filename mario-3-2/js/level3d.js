/* =========================================================================
   MARIO 3-2 — js/level3d.js      (LEVEL ownership — this file only)
   M32.Level3D.build(level) -> the shared static AABB collision world.

   Pure data + geometry math. NO DOM, NO three.js (SPEC §6b).

   PUBLIC SHAPE (see SPEC §6b):
     {
       level, solids, zones, pipes, rooms, blocks, blocks2, checkpoints,
       inWater(x,y) -> bool
       waterTopAt(x) -> number|null       highest water:true zone top at x
       solidAt(x,y) -> solid|null
       query(box) -> solid[]              broadphase bucketed by 64px columns
       moveX(body, dx) -> solid|null      moves + clamps body.x
       moveY(body, dy) -> {solid, box, dir, bodyBox}|null
       hitFromBelow(box) -> [{block, content, solid, x, y}]
       roomAt(x,y) -> room|null
       respawnPoint(checkpointIndex) -> {x,y}
       goalBox, surfaceY(x), start, checkpoints...
     }

   EXTRA (harmless, useful):
     solids[] entries carry {type, block?} — `block` is the source data object
       for ? blocks (type:'itembox') / bumpable bricks.
     blocks2[] entries: {x,y,w,h,type,content,used,solid,src}
     pipes[] entries:   {x,y,w,h,dir,target,entrance,mouth,enterBox,room,to,
                         returnTo,solid,src}
     rooms[] entries:   {id,x,y,w,h,rect,coins,entry,returnTo,...}
     isSolid(x,y) alias of solidAt
     bounds {x0,y0,x1,y1} of the playfield

   Axis-separated resolution rules (Mario platformer):
     * body {x,y,w,h} uses the M32 AABB convention: x,y = bottom-left.
     * Caller owns velocities; this module only moves + clamps position and
       reports the wall/floor/ceiling hit.
     * Solids the body was ALREADY embedded in before the move are ignored,
       so a bad respawn can never slingshot the player.
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;

  const DEF_W = 32;       // SPEC §1 TILE
  const DEF_H = 32;
  const CELL = 64;        // broadphase bucket width in px
  const PLAYER_W = (M.C && M.C.PW) || 26;
  const PLAYER_H_BIG = (M.C && M.C.PH_BIG) || 46;

  /* -------------------------------------------------------------- utils */
  function num(v, d) {
    return typeof v === 'number' && isFinite(v) ? v : d;
  }
  function rect(x, y, w, h) {
    return { x: x, y: y, w: w, h: h };
  }
  /** AABB overlap (strict, same as M32.aabb) — a,b bottom-left anchored */
  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pointIn(px, py, b) {
    return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
  }
  /** copy of a plain rect */
  function boxCopy(b) {
    return { x: b.x, y: b.y, w: b.w, h: b.h };
  }

  /* =====================================================================
   *  build(level)
   * ===================================================================== */
  function makeLevel3D(level) {
    if (!level || typeof level !== 'object') level = {};
    const WORLD_W = num(level.width, (M.C && M.C.WORLD_W) || 6400);
    const WORLD_H = num(level.height, (M.C && M.C.WORLD_H) || 1080);

    const srcBlocks = Array.isArray(level.blocks) ? level.blocks : [];
    const srcBlocks2 = Array.isArray(level.blocks2) ? level.blocks2 : [];
    const srcPipes = Array.isArray(level.pipes) ? level.pipes : [];
    const srcZones = Array.isArray(level.zones) ? level.zones : [];
    const srcRooms = Array.isArray(level.bonusRooms) ? level.bonusRooms : [];
    const srcCPs = Array.isArray(level.checkpoints) ? level.checkpoints : [];

    /** level3d object constructed first so the closures below can use it. */
    const L = {
      level: level,
      solids: [],
      zones: [],
      pipes: [],
      rooms: [],
      blocks: srcBlocks,
      blocks2: [],
      checkpoints: [],
      cells: new Map(),
      cellSize: CELL,
      bounds: { x0: 0, y0: 0, x1: WORLD_W, y1: WORLD_H },
      goal: level.goal || null,
      goalBox: null,
      start: null
    };

    /* ------------------------------------------------------------ solids */
    function addSolid(x, y, w, h, type, extra) {
      if (!isFinite(x) || !isFinite(y) || !isFinite(w) || !isFinite(h)) return null;
      if (w <= 0 || h <= 0) return null;
      const s = { x: x, y: y, w: w, h: h, type: type || 'solid' };
      if (extra) {
        for (const k in extra) {
          if (Object.prototype.hasOwnProperty.call(extra, k)) s[k] = extra[k];
        }
      }
      L.solids.push(s);
      return s;
    }

    // --- level.blocks: every solid terrain tile ---------------------------
    for (let i = 0; i < srcBlocks.length; i++) {
      const b = srcBlocks[i];
      if (!b || typeof b !== 'object') continue;
      const s = addSolid(
        num(b.x, 0), num(b.y, 0),
        num(b.w, DEF_W), num(b.h, DEF_H),
        b.type || 'stone'
      );
      if (s) {
        s.block = b;                               // reference back to level data
        if (b.bumpable || b.content) s.bumpable = true;
      }
    }

    // --- blocks2: SMB3 ? blocks (solid + bumpable) ------------------------
    for (let i = 0; i < srcBlocks2.length; i++) {
      const b = srcBlocks2[i];
      if (!b || typeof b !== 'object') continue;
      const entry = {
        x: num(b.x, 0),
        y: num(b.y, 0),
        w: num(b.w, DEF_W),
        h: num(b.h, DEF_H),
        type: b.type || 'itembox',
        content: b.content || 'coin',
        used: !!b.used,
        src: b,
        solid: null
      };
      const s = addSolid(entry.x, entry.y, entry.w, entry.h, entry.type, {
        block: entry,
        bumpable: true,
        content: entry.content
      });
      entry.solid = s;
      L.blocks2.push(entry);
    }

    /* -------------------------------------------------------------- pipes */
    // A pipe is: a solid body + a solid rim, but with a shallow NON-SOLID well
    // in the mouth so the player can sink into the mouth (world.js draws the
    // pipe as a solid body / rim, so the collision here matches that silhouette
    // exactly). Entering a warp pipe is signalled by `enterBox` (only for
    // enterable pipes). `mouth` is the centre of the opening.
    function buildPipe(p, index) {
      if (!p || typeof p !== 'object') return null;
      const x = num(p.x, 0);
      const y = num(p.y, 0);
      const w = num(p.w, 96);
      const h = num(p.h, 112);
      if (w <= 12 || h <= 12) return null;
      let dir = p.dir;
      if (dir !== 'down' && dir !== 'left' && dir !== 'right') dir = 'up';

      const rim = Math.max(12, Math.min(24, Math.round(h * 0.22)));   // rim/lip thickness
      const mouthDepth = rim + Math.max(8, Math.round(h * 0.1));      // how far the player may sink in
      const edge = 6;                                                 // pipe body inset (drawing)
      const shoulder = Math.min(Math.round(w * 0.28), edge + 24);     // rim shoulder width
      const pieces = [];

      if (dir === 'up' || dir === 'down') {
        const atTop = dir === 'up';
        // solid plug below the mouth well
        if (atTop) pieces.push(addSolid(x + edge, y, w - edge * 2, Math.max(4, h - mouthDepth), 'pipe'));
        else pieces.push(addSolid(x + edge, y + mouthDepth, w - edge * 2, Math.max(4, h - mouthDepth), 'pipe'));
        // split rim: two shoulders, mouth interior between them stays open
        const rimY = atTop ? y + h - rim : y;
        pieces.push(addSolid(x - 5, rimY, shoulder + 5, rim, 'pipe'));
        pieces.push(addSolid(x + w - shoulder, rimY, shoulder + 5, rim, 'pipe'));
      } else {
        const atRight = dir === 'right';
        if (atRight) pieces.push(addSolid(x, y + edge, Math.max(4, w - mouthDepth), h - edge * 2, 'pipe'));
        else pieces.push(addSolid(x + mouthDepth, y + edge, Math.max(4, w - mouthDepth), h - edge * 2, 'pipe'));
        const rimX = atRight ? x + w - rim : x;
        pieces.push(addSolid(rimX, y - 5, rim, shoulder + 5, 'pipe'));
        pieces.push(addSolid(rimX, y + h - shoulder, rim, shoulder + 5, 'pipe'));
      }

      const entrance = !!(p.entrance || p.target);
      const mouth = dir === 'up'
        ? { x: x + w / 2, y: y + h }
        : dir === 'down'
          ? { x: x + w / 2, y: y }
          : dir === 'left'
            ? { x: x, y: y + h / 2 }
            : { x: x + w, y: y + h / 2 };

      // Trigger region: the mouth well plus a little above the lip, so both
      // "swim/fall into the mouth" and "stand on the pipe + press down" fire it.
      let enterBox = null;
      if (entrance) {
        if (dir === 'up') enterBox = rect(x + edge, y + h - mouthDepth - 8, Math.max(w - edge * 2, 12), mouthDepth + 44);
        else if (dir === 'down') enterBox = rect(x + edge, y + mouthDepth - 36, Math.max(w - edge * 2, 12), mouthDepth + 44);
        else if (dir === 'left') enterBox = rect(x + mouthDepth - 36, y + edge, mouthDepth + 44, Math.max(h - edge * 2, 12));
        else enterBox = rect(x + w - mouthDepth - 8, y + edge, mouthDepth + 44, Math.max(h - edge * 2, 12));
      }

      const entry = {
        x: x, y: y, w: w, h: h, dir: dir,
        target: p.target || null,
        entrance: entrance,
        mouth: mouth,
        enterBox: enterBox,
        room: p.room || null,
        to: p.to || p.spawn || null,       // destination in another space
        returnTo: p.returnTo || null,
        solid: pieces,
        index: index,
        src: p
      };
      return entry;
    }

    for (let i = 0; i < srcPipes.length; i++) {
      const e = buildPipe(srcPipes[i], i);
      if (e) L.pipes.push(e);
    }

    /* ------------------------------------------------- inWater / zones */
    for (let i = 0; i < srcZones.length; i++) {
      const z = srcZones[i];
      if (!z || typeof z !== 'object') continue;
      const nz = {
        x: num(z.x, 0),
        w: num(z.w, 0),
        yBottom: num(z.yBottom, 0),
        yTop: num(z.yTop, (M.C && M.C.WORLD_H) || WORLD_H),
        water: !!z.water,
        kind: z.kind || (z.water ? 'open' : 'air'),
        src: z
      };
      if (z.id) nz.id = z.id;
      if (z.surface !== undefined) nz.surface = !!z.surface;
      if (z.beach !== undefined) nz.beach = !!z.beach;
      L.zones.push(nz);
    }

    /** true when the point is inside any water:true zone (SPEC §6b). */
    function inWater(x, y) {
      const zs = L.zones;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (!z.water || z.w <= 0) continue;
        if (x >= z.x && x <= z.x + z.w && y >= z.yBottom && y <= z.yTop) return true;
      }
      return false;
    }

    /** highest water zone top at x, or null when there is no water there. */
    function waterTopAt(x) {
      let top = null;
      const zs = L.zones;
      for (let i = 0; i < zs.length; i++) {
        const z = zs[i];
        if (!z.water || z.w <= 0) continue;
        if (x < z.x || x > z.x + z.w) continue;
        if (top === null || z.yTop > top) top = z.yTop;
      }
      return top;
    }

    /* ---------------------------------------------------- bonus rooms */
    for (let i = 0; i < srcRooms.length; i++) {
      const r = srcRooms[i];
      if (!r || typeof r !== 'object') continue;
      const rr = r.rect || r;
      const room = {
        id: r.id || 'room' + i,
        x: num(rr.x, 0),
        y: num(rr.y, 0),
        w: num(rr.w, 0),
        h: num(rr.h, 0),
        coins: num(r.coins, 0),
        dry: r.dry !== false,
        water: r.water === true,        // dry cave by default (player.js reads this)
        entry: r.entry
          ? { x: num(r.entry.x, num(rr.x, 0) + 40), y: num(r.entry.y, num(rr.y, 0) + 60) }
          : { x: num(rr.x, 0) + 40, y: num(rr.y, 0) + 60 },
        returnTo: r.returnTo
          ? { x: num(r.returnTo.x, 0), y: num(r.returnTo.y, 0) }
          : null,
        entrancePipe: r.entrancePipe || null,
        exitPipe: r.exitPipe || null,
        src: r
      };
      room.rect = rect(room.x, room.y, room.w, room.h);
      L.rooms.push(room);
    }

    /** bonus room containing the point, or null. */
    function roomAt(x, y) {
      const rs = L.rooms;
      for (let i = 0; i < rs.length; i++) {
        if (pointIn(x, y, rs[i])) return rs[i];
      }
      return null;
    }

    // Link pipes <-> rooms: derive the warp destination (`to`) when missing.
    for (let i = 0; i < L.pipes.length; i++) {
      const p = L.pipes[i];
      if (!p.room) continue;
      const room = L.rooms.find(function (r) { return r.id === p.room; });
      if (!room) continue;
      p.roomRef = room;
      if (!p.to) {
        if (p.target === 'bonus' || p.target === 'room') p.to = boxCopy(room.entry);
        else p.to = room.returnTo ? boxCopy(room.returnTo) : null;
      }
    }

    /* ------------------------------------------- invisible boundaries */
    // Playfield containment (never rendered — world.js draws level.blocks).
    addSolid(-160, -400, 160, 2000, 'boundary');                       // left wall
    addSolid(WORLD_W, -400, 160, 2000, 'boundary');                    // right wall
    addSolid(-160, -240, WORLD_W + 320, 240, 'boundary');              // safety floor
    // Safety cap only above the bonus room (the main world is open to the sky).
    for (let i = 0; i < L.rooms.length; i++) {
      const r = L.rooms[i];
      addSolid(r.x - 40, r.y + r.h + 40, r.w + 80, 120, 'boundary');   // room roof
    }

    /* ---------------------------------------------------- broadphase */
    function bucketize() {
      L.cells.clear();
      const cs = CELL;
      for (let i = 0; i < L.solids.length; i++) {
        const s = L.solids[i];
        const c0 = Math.floor(s.x / cs);
        const c1 = Math.floor((s.x + s.w - 1e-6) / cs);
        for (let c = c0; c <= c1; c++) {
          let arr = L.cells.get(c);
          if (!arr) {
            arr = [];
            L.cells.set(c, arr);
          }
          arr.push(s);
        }
      }
    }

    let queryId = 1;

    /**
     * Broadphase: unique solids in the columns the box overlaps, filtered by
     * AABB. O(columns + candidates); safe for 800+ solids.
     */
    function query(box) {
      const out = [];
      if (!box || !isFinite(box.x) || !isFinite(box.y)) return out;
      const w = num(box.w, 0);
      const h = num(box.h, 0);
      if (w <= 0 || h <= 0) return out;
      const bx = box.x;
      const by = box.y;
      const bw = w;
      const bh = h;
      const id = queryId++;
      const c0 = Math.floor(bx / CELL);
      const c1 = Math.floor((bx + bw - 1e-6) / CELL);
      for (let c = c0; c <= c1; c++) {
        const arr = L.cells.get(c);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s._qid === id) continue;
          s._qid = id;
          if (bx < s.x + s.w && bx + bw > s.x && by < s.y + s.h && by + bh > s.y) out.push(s);
        }
      }
      return out;
    }

    /** first solid containing the point (or null). */
    function solidAt(x, y) {
      const cands = query(rect(x - 0.5, y - 0.5, 1, 1));
      return cands.length ? cands[0] : null;
    }

    /* ---------------------------------------------------- move helpers */
    /**
     * Axis-separated X move + clamp. body {x,y,w,h} (bottom-left anchored).
     * Returns the wall solid hit (or null). Body velocity is the caller's.
     */
    function moveX(body, dx) {
      if (!body || !isFinite(dx) || dx === 0) return null;
      const w = num(body.w, PLAYER_W);
      const h = num(body.h, PLAYER_H_BIG);
      const pre = rect(num(body.x, 0), num(body.y, 0), w, h);
      body.x = num(body.x, 0) + dx;
      const box = rect(body.x, num(body.y, 0), w, h);
      let hit = null;
      for (let pass = 0; pass < 4; pass++) {
        const cands = query(box);
        let pushed = false;
        for (let i = 0; i < cands.length; i++) {
          const s = cands[i];
          if (!overlap(box, s)) continue;
          if (overlap(pre, s)) continue;               // already embedded: ignore
          if (dx > 0) body.x = Math.min(body.x, s.x - w);
          else body.x = Math.max(body.x, s.x + s.w);
          box.x = body.x;
          hit = s;
          pushed = true;
        }
        if (!pushed) break;
      }
      return hit;
    }

    /**
     * Axis-separated Y move + clamp. body {x,y,w,h} (bottom-left anchored).
     * Returns {solid, box, dir, bodyBox} for the first blocking solid from the
     * movement direction, or null. `dir` is +1 when moving up, -1 when down.
     * The caller distinguishes head hits (dir > 0) from floor hits (dir < 0).
     */
    function moveY(body, dy) {
      if (!body || !isFinite(dy) || dy === 0) return null;
      const w = num(body.w, PLAYER_W);
      const h = num(body.h, PLAYER_H_BIG);
      const pre = rect(num(body.x, 0), num(body.y, 0), w, h);
      body.y = num(body.y, 0) + dy;
      const box = rect(num(body.x, 0), body.y, w, h);
      let hit = null;
      for (let pass = 0; pass < 4; pass++) {
        const cands = query(box);
        let pushed = false;
        for (let i = 0; i < cands.length; i++) {
          const s = cands[i];
          if (!overlap(box, s)) continue;
          if (overlap(pre, s)) continue;               // already embedded: ignore
          if (dy > 0) body.y = Math.min(body.y, s.y - h);
          else body.y = Math.max(body.y, s.y + s.h);
          box.y = body.y;
          if (!hit) {
            hit = s;
          } else if (dy > 0) {
            if (s.y < hit.y) hit = s;                  // first ceiling from below
          } else {
            if (s.y + s.h > hit.y + hit.h) hit = s;    // first floor from above
          }
          pushed = true;
        }
        if (!pushed) break;
      }
      if (!hit) return null;
      return {
        solid: hit,
        box: boxCopy(hit),
        dir: dy > 0 ? 1 : -1,
        bodyBox: rect(body.x, body.y, w, h)
      };
    }

    /**
     * ? blocks whose bottom edge is crossed by the box's head while moving up.
     * Marks them used (they can only be hit once) and returns
     * [{block, content, solid, x, y}]. Call right after an upward moveY.
     */
    function hitFromBelow(box) {
      const out = [];
      if (!box) return out;
      const w = num(box.w, PLAYER_W);
      const h = num(box.h, PLAYER_H_BIG);
      const bx = num(box.x, 0);
      const by = num(box.y, 0);
      const head = by + h;
      for (let i = 0; i < L.blocks2.length; i++) {
        const e = L.blocks2[i];
        if (e.used || !e.solid) continue;
        const s = e.solid;
        if (bx + w <= s.x + 1 || bx >= s.x + s.w - 1) continue;   // horizontal overlap
        if (head < s.y - 3 || head > s.y + 14) continue;          // head at the block's bottom
        e.used = true;
        if (e.src) e.src.used = true;
        if (s) s.used = true;
        out.push({
          block: e,
          content: e.content,
          solid: s,
          x: s.x + s.w / 2,      // centre-bottom of the block (spawn point)
          y: s.y + s.h
        });
      }
      return out;
    }

    /* ------------------------------------------------------- respawns */
    for (let i = 0; i < srcCPs.length; i++) {
      const cp = srcCPs[i];
      if (!cp || typeof cp !== 'object') continue;
      L.checkpoints.push({
        x: num(cp.x, 100),
        y: num(cp.y, (M.C && M.C.WATER_TOP_Y ? M.C.WATER_TOP_Y - 200 : 700)),
        label: cp.label || '',
        src: cp
      });
    }

    /** true when a player-sized box at (x,y) is clear of solids. */
    function playerFits(x, y, w, h) {
      return query(rect(x - w / 2, y, w, h)).length === 0;
    }

    /**
     * Respawn point for checkpoint index i.
     * 0 (or <=0)  -> level start;  1..n -> level.checkpoints[i-1].
     * If the authored point is somehow buried in geometry it is nudged up
     * until a player fits, so respawning can never soft-lock the run.
     */
    function respawnPoint(i) {
      const n = Math.max(0, Math.floor(num(i, 0)));
      let p;
      if (n <= 0) {
        const st = level.start || (level.meta && level.meta.start);
        p = st ? { x: num(st.x, 100), y: num(st.y, 200) } : { x: 100, y: 200 };
      } else if (L.checkpoints.length) {
        const cp = L.checkpoints[Math.min(n, L.checkpoints.length) - 1];
        p = { x: cp.x, y: cp.y };
      } else {
        p = { x: 100, y: 200 };
      }
      const w = PLAYER_W;
      const h = PLAYER_H_BIG;
      for (let t = 0; t < 14; t++) {
        if (playerFits(p.x, p.y, w, h)) break;
        p.y += 40;
      }
      return p;
    }

    /* ------------------------------------------------ goal / surface */
    const g = level.goal || {};
    const goalX = num(g.x, WORLD_W - 250);
    const goalY = num(g.y, (M.C && M.C.FLOOR_Y) || 40);
    L.goalBox = rect(
      goalX - num(g.w, 120) / 2,
      goalY,
      num(g.w, 120),
      num(g.h, 220)
    );
    L.goalX = goalX;
    L.goalY = goalY;

    /**
     * Walkable surface height at column x: the highest solid top at that
     * column (ignores invisible boundary boxes). Used by the beach/goal:
     * surfaceY(6150) === 900. Returns null when there is no solid at x.
     */
    function surfaceY(x) {
      const cands = query(rect(x - 1, -500, 2, 2600));
      let best = null;
      for (let i = 0; i < cands.length; i++) {
        const s = cands[i];
        if (s.type === 'boundary') continue;
        if (s.x > x + 1 || s.x + s.w < x - 1) continue;
        const top = s.y + s.h;
        if (best === null || top > best) best = top;
      }
      return best;
    }

    /* ------------------------------------------------- assemble + go */
    bucketize();

    L.start = respawnPoint(0);
    L.inWater = inWater;
    L.waterTopAt = waterTopAt;
    L.solidAt = solidAt;
    L.isSolid = solidAt;
    L.query = query;
    L.moveX = moveX;
    L.moveY = moveY;
    L.hitFromBelow = hitFromBelow;
    L.roomAt = roomAt;
    L.respawnPoint = respawnPoint;
    L.surfaceY = surfaceY;
    L.playerFits = playerFits;
    L._bucketize = bucketize;
    L._CELL = CELL;

    return L;
  }

  M.Level3D = {
    build: function (level) {
      return makeLevel3D(level);
    }
  };
})();
