# ABYSS ANGLER — independent QA & static review

Reviewer: reviewer (task-3). Scope: `fishing game/` only; no game source was modified.
Date: 2026-10-17 (~11:22–11:34 UTC). Harness: headless Chrome (SwiftShader), raw CDP,
`file:///F:/repo-aiscan2/fishing%20game/index.html?debug=1`, desktop 1600x900 + mobile
390x844 (dpr 2, touch emulated). Real CDP mouse/key events for cast, strike, reel, give-line;
`Game.debug.*` only for deterministic species/landing/unlock. Four sessions, no source edits.

Snapshot tested (sha1 prefix, stable through all runs):

    index.html a3371275b1   css/style.css 210833ccf2   js/data.js cc448bfb94
    js/world.js 1010b8f18d  js/fishfactory.js 29c4bbc44c  js/audio.js f806555d2a
    js/game.js ddf09015d5   README.md 8afe72cdcc
    (Note: README + docs/screenshot-*.png and a small game.js sonar-hint change landed
    during the review window; all tests below ran after that snapshot was stable.)

## Critical

**None found.** No console errors, no uncaught exceptions, and no network requests in any
of the four sessions. Load, level flow, economy, save/load and the final screen all work.

## Major

**None found.** No player-facing flow is broken. The only defect that repeatedly bit the
*test harness* is the debug landing helper (listed under Minor because it is debug-only).

## Minor

1. **`js/game.js:1690` (+ `js/game.js:723-743`) — `Game.debug.land()` silently fails during a surge.**
   The helper sets `fight.depth = 1.5`, but `updateFight` then applies the resting/surge sink
   `+ (0.5 + power*0.15 + 1.5)*dt` **before** the `depth <= 1.6` landing check, so the fish is
   pushed past 1.6 and keeps diving. Repro: `Game.debug.hook('sunfish')`; wait until
   `Game.getState().fight.surge === true`; call `Game.debug.land()` → no catch card, depth climbs.
   Observed in QA: 7–9 retries needed per catch (scripts D and C2). Player reeling is unaffected
   (reel always reduces depth). Fix: set a `forcedLand` flag or check `depth <= 1.6` before
   applying the sink; alternatively set debug depth to the clamp floor 0.8.

2. **`css/style.css:215-218` + `:604` + `:633` — on 390x844 the cast meter overlaps the depth panel while charging.**
   At ≤560 px `.depth-control` is full-width `bottom:76px`; `.cast-meter` sits at `bottom:94px`,
   so the power bar is drawn across the lure-depth panel (measured overlap 346x54 px). Also
   `.pill` (school hint) overlaps the quota chips by ~9 px at this width.
   Repro: mobile emulation, enter level 1, hold to charge, screenshot. Fix: hide/dim
   `#depth-control` while `phase === 'charging'` on narrow screens, or move `.cast-meter` above it.

3. **`js/world.js:670-671` — dead night branch (use-before-declare).**
   `if (night) skyRef = ...` is evaluated before `var night = lv.time === 'night';` on line 678,
   so `night` is `undefined` there and the night water sky-reflection tint never applies.
   Repro: load level 4/5 (night/dusk), inspect `waterUniforms.uSky` — always the day tint.
   Fix: move `var night` above line 670. Visual only.

4. **`js/world.js:87-97` + `js/fishfactory.js:29-49` — disposal frees FishFactory's shared resources.**
   `disposeGroup()` traverses a fish and disposes every geometry/material, but FishFactory reuses
   shared `geos()` (sphere/cone/cyl/...), `EYE_MAT` and `MOUTH_MAT` across all fish. Every
   caught/ambient fish therefore forces shared geometry re-upload and material recompile.
   Repro: catch ~10 fish / wait for ambient jumps, watch GPU buffer/program churn (no crash).
   Fix: mark shared resources (`userData.shared = true`) and skip them in `disposeGroup`, or
   let FishFactory own disposal.

5. **`js/world.js:122, 803, 1298` — `kelpGroup` is not cleared on level change.**
   `buildEnvironment` only assigns `kelpGroup` for levels with the `kelp` feature; switching
   from Kelp Trench to a level without kelp leaves the variable pointing at a disposed group,
   which `updateEnvironment` keeps rotating each frame. No crash; stale work each frame.
   Fix: `kelpGroup = null` at the start of `buildEnvironment`.

6. **`js/game.js:1684, 1694` — `Game.debug.hook()` / `Game.debug.bite()` throw on a fresh page.**
   Both do `FISH[state.level.species[0]]`; `state.level` is `null` before the first
   `startLevel()`, so `Game.debug.bite()` from the title screen throws a TypeError.
   Fix: fall back to `LEVELS[0]` when `state.level` is null.

7. **`js/game.js:1650-1669` — NEW EXPEDITION does not reset the 3D scene.**
   It calls `World.clearFish/reset/hideSchool` but never `World.setLevel(LEVELS[0])`, and
   `showHarbor()` does not sync the level either, so after wiping an end-game save from the
   title the harbour backdrop still shows Storm Ridge while only Sunny Shallows is open.
   Fix: `World.setLevel(LEVELS[0])` in `newExpedition()` (or sync inside `showHarbor`).

8. **`js/game.js:1212` — bestiary can throw on a partial/corrupt save.**
   `fmtWeight(save.best[f.id])` receives `undefined` if `save.caught` has a species but
   `save.best` lacks it (only reachable via a hand-edited/partial localStorage entry); the
   throw aborts the whole bestiary render. Fix: `fmtWeight(Number(bestW) || 0)`, and validate
   `caught`/`best` entries in `loadSave()`.

9. **`js/data.js:291` vs `js/game.js:544,587` — lure copy/code mismatch.**
   Shop text says "+12% bite rate and rarer fish per tier"; bite rate is 12% (`0.12 * tier`),
   but rarity weighting is only +10%/tier (`w *= 1 + tier('lure') * 0.1`). Fix copy or multiplier.

10. **`js/game.js:1544-1545` — Arrow Up/Down `preventDefault()` on every screen.**
    The handlers run before the in-level guard, so keyboard scrolling of the scrollable
    harbour/bestiary/help lists is blocked (wheel/drag still work). Fix: only
    `preventDefault()` when `state.inLevel && !state.paused && !state.screen`.

## Verified-good (independent evidence)

- **Load / title**: `?debug=1` from `file://`; boot overlay clears; title renders (screenshot);
  **zero console errors/exceptions, zero non-file network requests** in all sessions.
  Fresh save: BEGIN EXPEDITION label, CONTINUE disabled; after a save: CONTINUE enabled,
  rank/bestiary/waters line correct.
- **New expedition**: save created with `startedAt`, coins 0, level 1 `current`, levels 2–5
  disabled/`locked`.
- **Cast / bite / fight (real mouse)**: hold LMB → `charging` with power/range readout;
  release → `casting` → `waiting`, cast counter +1; `Game.debug.bite` → `bite`; click → `fighting`,
  fight panel + underwater PiP visible with correct species. Reeling 3 s: depth 17.1→11.6 m,
  tension tracked; Shift give-line drops tension 11.4→1.7; surge warning shows.
- **Catch card**: name/weight/value/badges (NEW BEST, QUOTA TARGET, NEW SPECIES, DEEP WATER),
  quota-target kicker; ADD TO CREEL closes it and quota chips + HUD/harbour coins update
  immediately (save coins credited per catch).
- **Level completion**: 5/5 fish, **3 stars** for clean run inside cast limit, CLEAR BONUS 224,
  XP 180, result note + "New water unlocked: Coral Gardens"; `save.unlocked = 2`,
  `completed.shallows = {stars:3}`; NEXT DEPTH loads Coral Gardens (HUD name/index 2);
  harbour shows level 1 complete 3★, level 2 current, 3–5 locked. Loss run: **2 stars** and the
  correct "land the quota without losing a fish" note; escapes stat +1 and phase resets to idle.
- **Shop**: 12 000 coins gifted; all five lines bought to **TIER 3 / 3** (7 720 spent, 4 280 left,
  labels agree), each shows **MAXED** + disabled + 3 pips; reload restores coins, tiers and
  MAXED states, CONTINUE enabled.
- **Bestiary**: 25 cards; after one catch 1 known / 24 unknown ("1 / 25 LANDED", "1 / 25"),
  known card shows depth/best/count/description.
- **Pause / help / mute**: pause shows water/quota/casts/lost/creel value, resume and
  RETURN TO HARBOUR work; help has 6 cards and closes back to harbour; M toggles SOUND: OFF/ON
  and persists.
- **Final screen**: level 5 win → result button **FINISH EXPEDITION** → final screen shows
  waters cleared/stars/bestiary/catches/biggest fish/time; `finalSeen` saved; BACK TO HARBOUR works.
- **Mobile 390x844**: title, harbour, gameplay, charging, fight, pause and catch card all fit
  — no element outside the viewport, no horizontal page overflow; touch controls visible and
  correctly labelled; sonar hidden at ≤560 px by design; pause and catch dialogs fully inside
  the viewport with the action button visible.
- **HTML/CSS/JS wiring**: 108 unique ids in `index.html`; every id cached by `cacheUi()` exists;
  no CSS selector references a missing id; dynamic classes (`hidden`, `active`, `done`,
  `locked/current/complete`, `maxed`, `danger`, `hot`, `on`, `unknown`, `rarity.*`) are styled.
- **Save/load**: clamped/validated numerics, upgrades bounded 0..3, unknown upgrade ids dropped;
  round-trip after reload verified (coins, tiers, bestiary, unlocked, completed, `finalSeen`,
  mute setting). localStorage failure paths are guarded.
- **Audio guards**: `AudioKit` is a no-op before `init()`, init is idempotent, mutes with a ramp,
  tears down theme beds (`clearInterval` + node stop/disconnect); no autoplay/console errors.
- **three.js lifecycle**: level changes dispose env/underwater groups, ambient jump fish,
  under-water and catch fish; no WebGL errors across many level changes and ~15 catches.
- **Data integrity**: 25 fish / 5 levels; quota target bands are all reachable within each
  level's `depthMax`; reward math checked (5 catch values 20+19+41+16+41 + 224 clear bonus = 361
  shown and banked). Run against snapshot `ddf09015d5`/`1010b8f18d`.

## Limits of this review

Not exercised: Firefox/Edge; audible audio (headless/muted); sustained FPS/GPU memory
(noisy on SwiftShader); a full hand-played run of levels 2–5 (arrived via debug win/navigation);
90 s fight timeout and line-snap at high tension were reviewed statically, not played to failure.

## Post-review fixes (Lead, same day)

All ten minor findings were addressed after the review; no game-flow code was rewritten.

1. `Game.debug.land()` now forces depth 0.5 m, below the sink/landing race.
2. Mobile: the depth panel is hidden while charging, so the cast meter no longer overlaps it at
   390 px; the school pill is hidden on <=560 px (the prompt already names the school).
3. `night` is declared before the water sky-reflection branch in `world.js`.
4. FishFactory marks shared geometries / eye / mouth materials / halo texture
   (`userData.shared`); `World.disposeGroup` skips disposing them.
5. `kelpGroup` is cleared on level change.
6. `Game.debug.hook()` / `bite()` fall back to level 1 instead of throwing on a fresh page.
7. NEW EXPEDITION resets the 3D scene to Sunny Shallows.
8. Bestiary best-weight uses `Number(...) || 0`, so a partial save cannot abort the render.
9. Lure rarity weight now matches the documented +12%/tier.
10. Arrow keys only call `preventDefault()` while actually fishing, so menus scroll normally.

Re-checked after the fixes: `node --check` on all five scripts; headless load/cast/hook/catch on
levels 1 and 5 with a glow fish; no console errors or exceptions.

## Follow-up after play feedback (ambience + saved progress)

- The sustained background pad was reported as a buzz. The pad is no longer used; the default
  background is silent. An **optional** atmosphere layer (filtered surf only, no sustained pitch,
  no low drone) can be enabled in the harbour or pause menu and is saved in the save file.
- Save storage moved to `abyss_angler_save_v2` (later v3) with a `_backup` mirror. Older
  `abyss_angler_save_v1`/v2 slots are read once, migrated, and left untouched so tabs running an
  older build cannot overwrite newer progress.
- Added **SAVE DATA -> EXPORT / IMPORT** JSON in the harbour, schema versioning and field merging
  for future content releases. Verified: a v1 save (555 coins, unlocked 2) migrates to v2/v3 with
  a backup; the ambience toggle creates/destroys the surf bed and persists across reload.
- Effects are untouched in character (tonal plucks, soft filtered water) and remain audible.

## Gameplay update (variety, depth mechanics, autosave)

- Fish catalogue expanded from 25 to **35** species (10 new across all five waters) and fights now
  have behaviours: steady, runner, thrasher, diver, deadweight.
- Every cast has a live **feeding layer** (moving depth band) shown in the depth panel and sonar;
  bites are faster inside it. **Jigging** (click/Space while waiting) stirs bites but spamming the
  cooldown spooks the school.
- Consecutive catches build a **streak** up to +25% coin value; missed strikes and lost fish reset it.
- **Autosave** now writes a resumable run snapshot every 8 s and on casts/catches/losses/page hides.
  The harbour shows **RESUME RUN** and the current save time; finishing or quitting clears the run.
- Tested headlessly: 35 fish / five level pools with no missing ids; DIVER and RUNNER tags; catch,
  feed-layer drift, jig/spook, streak, reload-resume, run clear on completion, and 0/35 bestiary
  count. No console errors.
- Save is now **v6** with v5/v4/v3/v2/v1 migration and export/import; resumed runs restore quota,
  creel, casts, streak, lure depth and feed-layer depth.
- Recovery grant tested from a v2 save: `?grant=max` preserved caught/completed data, set all
  upgrades to tier 3, unlocked all 5 waters, set Ridge Legend XP and 5,000 coins, wrote the v6
  main+backup slots, left older keys untouched, and removed the grant query from the URL.

- Fish models upgraded: spline-smoothed body profiles, procedural scale/pattern maps, layered eyes,
  gill slits, lateral lines, fin membranes with rays, teeth and barbels, and a live 3D catch
  showcase on a separate disposable WebGL surface.
- HUD adds a three-lure box (minnow / jig / glow), a depth scan line that reports the species in the
  selected band (counts/rarities at sonar 1, names at sonar 2), and **R / RECALL** so a cast can be
  reeled in and retried without waiting for a bite.
- Reviewed mechanics from other fishing sims (drag, rod angle, hook sets, species-specific lures,
  sonar species indicators, depth/size) and documented what was borrowed or deliberately skipped in
  docs/RESEARCH.md.
- Tested headlessly at 1600x900 and 390x844: lure selection and persistence, scan-line names at
  sonar 2, recall by key and button, catch models (sunfish, eel, angler), catch preview sizing,
  mobile prompt/panel spacing, 0 console errors.

## Endgame systems and visual-style pass

- Added a rotating **Bounty Board** with three contracts (species orders, weight hunts, deep
  orders, clean runs, catch orders), persistent progress, HUD bounty chip, token/renown rewards and
  a claim flow. Charms buy with tokens and change a rule: Stormglass (rare fish in storms/dusk),
  Tidekeeper (slower feeding-layer drift), Ember Streak (higher streak cap). Renown titles run from
  Contract Hand to Ridge Broker.
- Added persistent contract/renown/token/charm fields and best-ever streak to the **v4** save,
  now carried into **v6**, with v5/v4/v3/v2/v1 migration. Old keys are never overwritten.
- Visual pass: muted maritime naturalist palette, darker eyes, thin scale relief, warm catch-preview
  survey lighting instead of cyan neon, and a vertex **body-wave** shader plus existing tail/fin
  animation so fish flex as they swim.
- Verified headlessly: a maxed v3/v4/v5 save migrates to v6 intact; board renders 3 contracts and 3 charms;
  token purchase (10 -> 7) equips Stormglass; a forced claim pays 1 token / 12 renown and replaces
  the contract; a real catch advances a species contract to 1/2 and shows the HUD bounty chip;
  0 console errors. Catch previews of sunfish, eel and angler render with the muted palette and no
  shader errors at desktop and mobile sizes.
## Full visual restyle (Deepwater Survey Ledger)

- Replaced the glassy teal/gold HUD and screens with an **ink, brass and aged-paper** system:
  chart-grid backdrops, etched wave borders, serif instrument labels, square-ruled panels,
  paper quota tags, a compass-rose title plate and dimmed 3D scene grade.
- Converted level cards, workshop rows, captain ledger, bestiary specimen cards, bounty contracts,
  charm cards, help cards and dialogs to parchment; HUD and the catch preview keep dark instrument
  insets for contrast. Sonar redrawn in sepia/brass; no neon.
- Paper prompt and compact maxed workshop keep the mobile HUD readable; mobile prompt/panel
  spacing verified at 390x844.
- Verified desktop 1600x900, tablet layout and mobile: title, harbour, bounty board, bestiary,
  help, pause, results and catch all render with the new palette and zero console errors.
## Cold-water world restyle

- Replaced the turquoise/sunset ocean with a **cold North Atlantic** look: pewter overcast sky,
  long directional swell, fine chop normals, procedural foam lanes/whitecaps and a weathered
  ivory/teal boat.
- New sky shader paints drifting layered cloud bands instead of a clean gradient; new water shader
  uses four directional swells, detail normals, wind lanes and crest foam. Level palettes, fog,
  hemisphere/directional light and foam colour were all retuned cold.
- Verified title, Sunny Shallows, Storm Ridge and a live Leviathan fight at 1600x900 with no
  shader/console errors. UI remains the ink/brass/paper ledger; the 3D scene is now a different
  visual world rather than a CSS tint.
