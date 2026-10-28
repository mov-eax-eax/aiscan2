/* =========================================================================
   MARIO 3-2 — js/level.js        (LEVEL ownership — this file only)
   The complete Super Mario Bros. 3 World 3-2 underwater layout.

   BASED ON SPEC.md §5. All coordinates are PIXELS:
     blocks (and pipes / bonus-room walls) = bottom-left anchored rects
     enemies / items                      = center anchored points
   World: 6400 x 1080. Open water top y=900, sea floor top y=40.
   The level is swum left->right and ends on a dry beach plateau at y=900
   (x >= 5900) where the white-flag goal (x=6150) stands.

   ---------------------------------------------------------------------------
   REQUIRED SCHEMA (SPEC §5)
     name, width, height, zones, blocks, pipes, enemies, items, blocks2,
     checkpoints, goal, bonusRooms, progressMarks

   EXTRA FIELDS (all optional for consumers, documented here):
     start            {x,y}                 player spawn (feet, in water)
     meta             {theme, waterTopY, floorY, beachX, plateauY, goalX,
                       bonusRoomId, par}    HUD / camera / world hints
     sections         [{id,name,x0,x1}]      the eight beats, in order
     progressMarks    [{x,label}]           minimap marks (objects: x + label)
     progressMarkXs   [number]              same marks as bare x values
     decor            [{type,x,y,...}]      NON-SOLID art hints (world.js may
                                            ignore): kelp / coralFan / bubbles /
                                            rock / arch / vine
     checkpoints[]    {x,y,label}           y = safe in-water respawn height
     bonusRooms[]     {id, rect:{x,y,w,h}, coins, entrancePipe:{x,y},
                       exitPipe:{x,y}, returnTo:{x,y}, entry:{x,y},
                       name, dry:true}
                      entry = where the player appears inside the room.
     pipes[]          {x,y,w,h,dir,target,entrance,room}
                      `room` links a pipe to a bonus room; level3d derives
                      mouth / enterBox / destination (`to`) from these.
     goal             {x,y,groundY,w,h,flagTopY,kind:'flag'}

   CONVENTIONS / NOTES
   * `zones` with water:true define the swimmable volume (SPEC §5). Every
     water zone is a complete rectangle; overlapping edges are fine.
   * `blocks2` = SMB3 ? blocks. y is the BOTTOM of the 32x32 block.
     content: 'frogsuit' | 'oneup' | 'starman'.
     The matching `items` entries carry fromBlock:true (item template that is
     spawned when the block is hit) — same pattern as the SPEC §5 example.
   * `pipes` are a solid body + solid lip with a shallow NON-SOLID mouth well, so
     the player can sink into the mouth and press DOWN to warp (level3d derives
     `enterBox` / `mouth` / the destination). Enterable pipes have target:
     'bonus' (main world -> bonus room) or 'main' (bonus room -> main world).
   * The bonus room is a DRY cave above the level bounds (y 1160..1500):
     jump for the 20 coins, then enter the exit pipe. No water zone up there,
     so waterTopAt() keeps meaning "main world surface".
   * Goal sits on the beach plateau: goal.y = 900 = plateau top.
   * The level is fully traversable with a 26x46 player box; verified with a
     flood-fill + per-column gap check (see Lead report).
   ========================================================================= */
(function () {
  'use strict';
  window.M32 = window.M32 || {};
  const M = window.M32;
  const C = M.C || {};

  const WORLD_W = C.WORLD_W || 6400;
  const WORLD_H = C.WORLD_H || 1080;
  const TILE = C.TILE || 32;
  const FLOOR_Y = C.FLOOR_Y || 40;
  const WATER_TOP_Y = C.WATER_TOP_Y || 900;

  const BEACH_X = 5900;      // beach bank starts here (no water from here on)
  const PLATEAU_Y = 900;     // dry beach plateau top
  const GOAL_X = 6150;       // white flag / card panel
  const ROOM_ID = 'coinroom';

  /* --------------------------------------------------------------------- *
   *  Accumulators — everything below is plain data after this file runs.  *
   * --------------------------------------------------------------------- */
  const zones = [];
  const blocks = [];
  const pipes = [];
  const enemies = [];
  const items = [];
  const blocks2 = [];
  const decor = [];

  /* --------------------------------------------------------------------- *
   *  Tiny deterministic builders (run once at load; data has no functions) *
   * --------------------------------------------------------------------- */

  function zone(x, w, yBottom, yTop, kind, extra) {
    const z = { x: x, w: w, yBottom: yBottom, yTop: yTop, water: true, kind: kind || 'open' };
    if (extra) Object.assign(z, extra);
    zones.push(z);
    return z;
  }
  function airZone(x, w, yBottom, yTop, kind, extra) {
    const z = { x: x, w: w, yBottom: yBottom, yTop: yTop, water: false, kind: kind || 'air' };
    if (extra) Object.assign(z, extra);
    zones.push(z);
    return z;
  }
  /** solid terrain block, bottom-left anchored. w/h default one tile. */
  function block(x, y, w, h, type, extra) {
    const b = {
      x: x,
      y: y,
      w: w === undefined || w === null ? TILE : w,
      h: h === undefined || h === null ? TILE : h,
      type: type || 'stone'
    };
    if (extra) Object.assign(b, extra);
    blocks.push(b);
    return b;
  }
  /** classic pipe; rect is bottom-left anchored, dir 'up' => mouth at y+h */
  function pipe(x, y, w, h, extra) {
    const p = { x: x, y: y, w: w === undefined ? 96 : w, h: h === undefined ? 112 : h, dir: 'up' };
    if (extra) Object.assign(p, extra);
    pipes.push(p);
    return p;
  }
  function enemy(type, x, y, extra) {
    const e = { type: type, x: x, y: y };
    if (extra) Object.assign(e, extra);
    enemies.push(e);
    return e;
  }
  function item(o) {
    items.push(o);
    return o;
  }
  function coin(x, y, extra) {
    return item(Object.assign({ type: 'coin', x: x, y: y }, extra));
  }
  function coinLine(x, y, n, dx, dy, extra) {
    for (let i = 0; i < n; i++) coin(x + i * dx, y + i * dy, extra);
  }
  /** n coins in an arc centred on x,y (entities.js decides the arc shape) */
  function coinArc(x, y, n, extra) {
    return item(Object.assign({ type: 'coinArc', x: x, y: y, n: n || 5 }, extra));
  }
  /** n coins around an ellipse — baited rings */
  function coinRing(cx, cy, rx, ry, n, extra) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      coin(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, extra);
    }
  }
  /** SMB3 ? block; y = bottom of the block */
  function itembox(x, y, content, extra) {
    const b = { x: x, y: y, w: TILE, h: TILE, type: 'itembox', content: content };
    if (extra) Object.assign(b, extra);
    blocks2.push(b);
    return b;
  }
  /** item template for a ? block's content (spawned when the block is hit) */
  function boxItem(type, bx, by, extra) {
    return item(Object.assign({ type: type, x: bx + TILE / 2, y: by + TILE + 36, fromBlock: true, blockX: bx, blockY: by }, extra));
  }
  /* non-solid decoration hints ------------------------------------------------ */
  function kelp(x, y, h, extra) { decor.push(Object.assign({ type: 'kelp', x: x, y: y, h: h || 120 }, extra)); }
  function fan(x, y, s, extra) { decor.push(Object.assign({ type: 'coralFan', x: x, y: y, scale: s || 1 }, extra)); }
  function bubbles(x, y, h) { decor.push({ type: 'bubbles', x: x, y: y, h: h || 220 }); }
  function rockArt(x, y, w, h) { decor.push({ type: 'rock', x: x, y: y, w: w || 64, h: h || 40 }); }
  function vine(x, y, h) { decor.push({ type: 'vine', x: x, y: y, h: h || 160 }); }
  function arch(x, y, w, h) { decor.push({ type: 'arch', x: x, y: y, w: w || 180, h: h || 120 }); }

  /* =====================================================================
   *  WORLD SHELL
   * ===================================================================== */

  // Sea floor across the whole level (top y = 40).
  block(0, 0, WORLD_W, FLOOR_Y, 'floor');

  // Water volumes, left to right (SPEC §5 zones). Every rectangle that the
  // player can swim through is listed here. Surface tops step up near the
  // beach so the player naturally surfaces at ~y980 before climbing out.
  zone(0, 900, FLOOR_Y, WATER_TOP_Y, 'open', { id: 'start' });
  zone(900, 600, FLOOR_Y, WATER_TOP_Y, 'open', { id: 'gardens' });
  zone(1500, 800, 380, 860, 'tunnel', { id: 'tunnel' });
  zone(2300, 1050, FLOOR_Y, WATER_TOP_Y, 'open', { id: 'gauntlet' });
  zone(3350, 200, FLOOR_Y, 980, 'shaft', { id: 'shaft' });
  zone(3550, 300, 620, 980, 'tunnel', { id: 'highcorridor' });
  zone(3850, 550, FLOOR_Y, WATER_TOP_Y, 'open', { id: 'descent' });
  zone(4400, 900, FLOOR_Y, WATER_TOP_Y, 'open', { id: 'deeprun' });
  zone(5300, 200, FLOOR_Y, 900, 'open', { id: 'ascent' });
  zone(5500, 180, FLOOR_Y, 940, 'open', { id: 'ascent2' });
  zone(5680, 220, FLOOR_Y, 980, 'open', { id: 'surface' });

  // Warm sky above the beach (NOT water — inWater() stays false here).
  airZone(BEACH_X, WORLD_W - BEACH_X, PLATEAU_Y, WORLD_H, 'sky', { beach: true, id: 'beachsky' });

  /* =====================================================================
   *  BEAT 1 — START (x 0..900)  open water, easy
   * ===================================================================== */
  block(250, FLOOR_Y, 96, 64, 'coral');
  block(430, FLOOR_Y, 64, 120, 'coral');
  block(620, FLOOR_Y, 128, 72, 'coral');
  block(760, FLOOR_Y, 48, 240, 'coral');

  coinLine(180, 470, 10, 66, 0);          // easy trail leading right
  coinArc(540, 640, 5);

  enemy('cheep', 430, 400, { variant: 'green' });

  kelp(120, FLOOR_Y, 150); kelp(190, FLOOR_Y, 96); kelp(340, FLOOR_Y, 190);
  kelp(560, FLOOR_Y, 120); kelp(700, FLOOR_Y, 170); kelp(830, FLOOR_Y, 110);
  fan(300, FLOOR_Y + 64, 1.0); fan(650, FLOOR_Y + 72, 1.2);
  bubbles(400, FLOOR_Y + 120, 300); bubbles(800, FLOOR_Y + 160, 260);

  /* =====================================================================
   *  BEAT 2 — CORAL GARDENS (x 900..1500)  pillars + coin arcs
   *  Weave: floor pillar (over it) -> hanging pillar (under it) -> ...
   * ===================================================================== */
  block(1010, FLOOR_Y, 56, 520, 'coral');   // top 560  (go over)
  block(1160, 700, 56, 200, 'coral');       // 700..900  (go under)
  block(1300, FLOOR_Y, 56, 360, 'coral');   // top 400
  block(1420, 760, 56, 140, 'coral');       // 760..900

  coinArc(1090, 660, 5);                    // above pillar 1
  coinArc(1250, 560, 5);                    // gap between pillars
  coinArc(1400, 520, 5);                    // lower route reward
  coinLine(1460, 700, 1, 0, 0);             // lone breadcrumb into the tunnel

  enemy('blooper', 1100, 640);
  enemy('blooper', 1400, 400);
  enemy('cheep', 1270, 780, { variant: 'green' });
  enemy('cheep', 960, 300, { variant: 'green' });

  kelp(940, FLOOR_Y, 140); kelp(1220, FLOOR_Y, 200); kelp(1480, FLOOR_Y, 130);
  fan(1030, FLOOR_Y + 520, 1.2); fan(1330, FLOOR_Y + 360, 0.9);
  bubbles(1000, FLOOR_Y + 80, 320); bubbles(1440, FLOOR_Y + 100, 300);

  /* =====================================================================
   *  BEAT 3 — TUNNEL ENTRY (x 1500..2300)  narrow corridor 380..860
   *  floor rock 40..380, ceiling 860..1080, obstacles leave >=300px gaps.
   *  Bonus pipe on the tunnel floor at x=2000.
   * ===================================================================== */
  block(1500, FLOOR_Y, 800, 340, 'stone');    // tunnel floor, top 380
  // The tunnel roof is a low reef: its top (1000) is reachable by leaping out
  // of the water, so it doubles as an above-water secret route (coins on top)
  // while the enclosed water corridor underneath is the rich route. Its top is
  // BELOW the world ceiling, never a walkway outside the level.
  block(1500, 860, 800, 140, 'stone');        // tunnel roof / reef, top 1000
  coinLine(1560, 1044, 5, 120, 0);            // reward for the reef-top route
  block(1620, 380, 64, 200, 'stone');         // stalagmite, top 580
  block(1760, 700, 64, 160, 'stone');         // stalactite, bottom 700
  block(1860, 520, 96, 48, 'brick');          // floating brick

  pipe(2000, 380, 96, 112, { target: 'bonus', entrance: true, room: ROOM_ID });
  pipe(2170, 380, 96, 112, {});               // piranha pipe on the tunnel floor

  coinLine(1580, 660, 10, 72, 0);             // upper route through the tunnel
  coinArc(1960, 440, 4);                      // near the bonus pipe mouth

  enemy('jelectro', 1700, 700);
  enemy('jelectro', 1930, 640);
  enemy('spike', 1800, 420);
  enemy('piranha', 2218, 492, { pipeX: 2170, pipeY: 380 });

  kelp(1540, 380, 110); kelp(1700, 380, 90); kelp(2100, 380, 120);
  fan(1580, 380, 0.8); fan(2260, 380, 0.7);
  vine(1660, 860, 120); vine(1980, 860, 150);

  /* =====================================================================
   *  BEAT 4 — BOSS BASS GAUNTLET (x 2300..3350)  big open arena
   * ===================================================================== */
  block(2720, FLOOR_Y, 160, 120, 'coral');    // low central island (cover)

  coinRing(2780, 470, 150, 120, 12);          // ring of coins as bait
  coinArc(2520, 640, 6);                      // upper route (risky: boss lane)
  coinArc(3120, 260, 6);                      // lower route

  enemy('bossbass', 2780, 400);
  enemy('cheep', 2480, 720, { variant: 'red' });
  enemy('cheep', 3050, 280, { variant: 'red' });
  enemy('blooper', 2960, 660);
  enemy('jelectro', 2620, 300);              // gauntlet hazard
  enemy('jelectro', 3180, 620);

  // Frog Suit ? block on the arena approach (x~2450) + spawn template.
  itembox(2450, 520, 'frogsuit');
  boxItem('frogsuit', 2450, 520);

  kelp(2320, FLOOR_Y, 200); kelp(2620, FLOOR_Y, 150); kelp(2900, FLOOR_Y, 230);
  kelp(3180, FLOOR_Y, 170); kelp(3280, FLOOR_Y, 120);
  fan(2580, FLOOR_Y + 120, 1.4); fan(3000, FLOOR_Y + 120, 1.1);
  bubbles(2400, FLOOR_Y + 100, 420); bubbles(3150, FLOOR_Y + 100, 380);
  arch(2860, FLOOR_Y + 160, 180, 140);

  /* =====================================================================
   *  BEAT 5 — VERTICAL SHAFT (x 3300..4400)
   *  A low rock spur leaves a wide window (y 400..900) into the shaft
   *  x 3350..3550, which runs from y=40 to y=980. The shaft's right side is
   *  closed below y=620 (high-corridor floor), so the ONLY way on is to swim
   *  UP inside the shaft to the high corridor (water 620..980), cross it for
   *  300px, then drop back into open water at x 3850.
   * ===================================================================== */
  block(3300, FLOOR_Y, 50, 360, 'stone');     // low left spur, top 400 (window above)
  block(3550, FLOOR_Y, 300, 580, 'stone');    // shaft right side + high-corridor floor (top 620)
  // The high corridor is open to the sky above y980 (no lid) — you swim up the
  // shaft, cross the raised shelf, then drop back into open water at x3850.
  // kelp "walls" are decoration only (see decor below)

  coinLine(3450, 200, 12, 0, 64);             // vertical line up the shaft (200..904)
  coinArc(3700, 800, 5);                      // high corridor reward

  enemy('jelectro', 3400, 300);               // hazards live in the lower water:
  enemy('jelectro', 3500, 520);               // the upper lane is the safe fast lane
  enemy('jelectro', 3410, 760);

  kelp(3358, FLOOR_Y, 320); kelp(3358, 380, 240); kelp(3538, FLOOR_Y, 300);
  kelp(3560, 620, 120); kelp(3820, 620, 150);
  fan(3380, 200, 0.9); fan(3520, 500, 0.8);
  bubbles(3400, FLOOR_Y + 60, 700); bubbles(3510, FLOOR_Y + 200, 620);
  vine(3600, 980, 140); vine(3790, 980, 120);

  /* =====================================================================
   *  BEAT 6 — DEEP RUN (x 4400..5300)  staggered pilings
   *  floor pillars and hanging pillars alternate; the weave is continuous.
   * ===================================================================== */
  // floor pilings (top heights 400 / 240 / 480 / 300)
  block(4520, FLOOR_Y, 48, 360, 'stone');
  block(4780, FLOOR_Y, 48, 200, 'stone');
  block(5040, FLOOR_Y, 48, 440, 'stone');
  block(5240, FLOOR_Y, 48, 260, 'stone');
  // hanging pilings (bottom 660 / 560 / 700)
  block(4640, 660, 48, 240, 'stone');
  block(4900, 560, 48, 340, 'stone');
  block(5140, 700, 48, 200, 'stone');
  // frog ledge: a shelf sitting on the floor-pillar top (top 512) — the frog
  // hops along it, and the swim route passes *over* it (free band 512..700).
  // NOTE the frog enemy is a ground enemy: entities.js grounds it with
  // groundBelow(), so spawn it clear above the shelf (no solid within 70px
  // below) — it paddles/hops just above the ledge.
  block(5040, 480, 96, 32, 'stone');
  enemy('frog', 5076, 592);

  // 1-Up ? block parked in the quiet drop zone (x~4050) + spawn template.
  itembox(4050, 520, 'oneup');
  boxItem('oneup', 4050, 520);
  // Starman ? block in the deep run (x~4700) + spawn template.
  itembox(4700, 520, 'starman');
  boxItem('starman', 4700, 520);

  coinArc(4580, 760, 5);
  coinArc(4860, 420, 5);
  coinArc(5000, 740, 5);

  enemy('blooper', 4580, 560);
  enemy('blooper', 5000, 700);
  enemy('blooper', 5180, 300);
  enemy('cheep', 4760, 780, { variant: 'green' });
  enemy('cheep', 4980, 420, { variant: 'red' });

  kelp(4440, FLOOR_Y, 180); kelp(4720, FLOOR_Y, 140); kelp(4960, FLOOR_Y, 210);
  kelp(5120, FLOOR_Y, 160); kelp(5280, FLOOR_Y, 120);
  fan(4580, FLOOR_Y + 360, 1.0); fan(5040, FLOOR_Y + 440, 1.2);
  bubbles(4500, FLOOR_Y + 80, 400); bubbles(5080, FLOOR_Y + 60, 460);
  arch(4780, FLOOR_Y + 200, 160, 130);

  /* =====================================================================
   *  BEAT 7 — ASCENT + SURFACE (x 5300..5900)
   *  Water top climbs 900 -> 940 -> 980 so the player surfaces near x5900.
   * ===================================================================== */
  block(5340, FLOOR_Y, 96, 64, 'coral');
  block(5620, FLOOR_Y, 128, 96, 'coral');

  pipe(5450, FLOOR_Y, 96, 128, {});            // piranha pipe on the floor (top 168)
  enemy('piranha', 5498, 168, { pipeX: 5450, pipeY: FLOOR_Y });

  coinLine(5320, 640, 10, 58, 28);             // last coin run, rising with the surface
  coinArc(5580, 760, 5);
  coinArc(5780, 840, 5);

  enemy('cheep', 5560, 600, { variant: 'green' });
  enemy('blooper', 5760, 760);
  enemy('cheep', 5860, 400, { variant: 'red' });

  kelp(5320, FLOOR_Y, 220); kelp(5560, FLOOR_Y, 140); kelp(5720, FLOOR_Y, 190);
  kelp(5840, FLOOR_Y, 160);
  fan(5400, FLOOR_Y + 64, 0.9); fan(5700, FLOOR_Y + 96, 1.1);
  bubbles(5480, FLOOR_Y + 80, 420); bubbles(5820, FLOOR_Y + 120, 380);

  /* =====================================================================
   *  BEAT 8 — BEACH GOAL (x 5900..6400)
   *  A solid sand bank rises from the sea floor to the plateau at y900; the
   *  player surfaces at ~y980 (last water zone), drifts right over the bank
   *  lip and lands on the dry plateau. No water above the plateau.
   * ===================================================================== */
  block(BEACH_X, FLOOR_Y, WORLD_W - BEACH_X + 40, PLATEAU_Y - FLOOR_Y, 'sand'); // top 900
  // decorative dry-land blocks — all BEHIND the goal (x6150) so the walk to
  // the flag is unobstructed
  block(6250, PLATEAU_Y, 96, 64, 'sand');
  block(6330, PLATEAU_Y, 32, 96, 'sand');
  coinLine(5980, PLATEAU_Y + 40, 3, 48, 0);     // 3 coins on the sand (jump)
  rockArt(5820, FLOOR_Y, 80, 40);
  rockArt(6020, PLATEAU_Y, 48, 24);

  /* =====================================================================
   *  BONUS ROOM — coinroom (dry cave above the level bounds)
   *  rect x 900..1660, y 1160..1500. Enter via the main-world bonus pipe at
   *  x2000 (tunnel floor); leave via the room's exit pipe x1560.
   * ===================================================================== */
  block(860, 1120, 840, 40, 'stone');          // room floor, top 1160
  block(860, 1500, 840, 40, 'stone');          // room ceiling, bottom 1500
  block(860, 1160, 40, 340, 'stone');          // left wall
  block(1660, 1160, 40, 340, 'stone');         // right wall
  // exit pipe (72 tall) on the room floor + a matching stone step beside it so
  // the player can simply walk/jump up at floor level and press DOWN to leave.
  block(1496, 1160, 64, 72, 'stone');          // step, top 1232 == pipe mouth
  pipe(1560, 1160, 96, 72, { target: 'main', entrance: true, room: ROOM_ID });

  // 20 coins in two rows (jump height ~260px from the floor at 1160).
  for (let i = 0; i < 10; i++) coin(960 + i * 62, 1250);
  for (let i = 0; i < 10; i++) coin(992 + i * 62, 1310);

  /* =====================================================================
   *  FINAL ASSEMBLY
   * ===================================================================== */
  const LEVEL = {
    name: '3-2',
    width: WORLD_W,
    height: WORLD_H,
    theme: 'underwater',

    start: { x: 100, y: 200 },

    meta: {
      theme: 'underwater',
      waterTopY: WATER_TOP_Y,
      floorY: FLOOR_Y,
      beachX: BEACH_X,
      plateauY: PLATEAU_Y,
      goalX: GOAL_X,
      bonusRoomId: ROOM_ID,
      par: 165
    },

    sections: [
      { id: 'start', name: 'Start', x0: 0, x1: 900 },
      { id: 'gardens', name: 'Coral Gardens', x0: 900, x1: 1500 },
      { id: 'tunnel', name: 'Tunnel', x0: 1500, x1: 2300 },
      { id: 'gauntlet', name: 'Gauntlet', x0: 2300, x1: 3350 },
      { id: 'shaft', name: 'Shaft', x0: 3350, x1: 4400 },
      { id: 'deeprun', name: 'Deep Run', x0: 4400, x1: 5300 },
      { id: 'ascent', name: 'Ascent', x0: 5300, x1: 5900 },
      { id: 'beach', name: 'Beach', x0: 5900, x1: 6400 }
    ],

    zones: zones,
    blocks: blocks,
    pipes: pipes,
    enemies: enemies,
    items: items,
    blocks2: blocks2,

    checkpoints: [
      { x: 960, y: 640, label: 'Gardens' },
      { x: 1700, y: 660, label: 'Tunnel' },
      { x: 2360, y: 700, label: 'Gauntlet' },
      { x: 3900, y: 450, label: 'Ascent' }
    ],

    goal: {
      x: GOAL_X,
      y: PLATEAU_Y,
      groundY: PLATEAU_Y,
      w: 120,
      h: 240,
      flagTopY: PLATEAU_Y + 240,
      kind: 'flag'
    },

    progressMarks: [
      { x: 100, label: 'Start' },
      { x: 1500, label: 'Tunnel' },
      { x: 2300, label: 'Gauntlet' },
      { x: 3350, label: 'Ascent' },
      { x: GOAL_X, label: 'Goal' }
    ],
    progressMarkXs: [100, 1500, 2300, 3350, GOAL_X],

    bonusRooms: [
      {
        id: ROOM_ID,
        name: 'Coin Room',
        dry: true,
        rect: { x: 900, y: 1160, w: 760, h: 340 },
        coins: 20,
        entrancePipe: { x: 2000, y: 380 },   // main-world pipe (tunnel floor y=380)
        exitPipe: { x: 1560, y: 1160 },      // pipe inside the room
        entry: { x: 940, y: 1260 },          // where the player pops in
        returnTo: { x: 3400, y: 520 }        // where the exit pipe puts the player back
      }
    ],

    decor: decor
  };

  M.LEVEL = LEVEL;
})();
