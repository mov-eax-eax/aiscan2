# ABYSS ANGLER — design + module contracts

A single-page, offline 3D fishing game. Five full levels, each deeper and more hostile than the last.
Core loop: choose a level → cast toward the school → sink your lure to the right depth → strike the bite →
fight the fish up from its depth while managing line tension → land it, bank coins, upgrade, descend.

Everything runs from `index.html` by double-clicking. Classic scripts only (no ES modules, no build step,
no network at runtime). Three.js r128 is vendored at `vendor/three.min.js` and exposed as global `THREE`.

## Files and ownership

    index.html            markup + script tags (Lead)
    css/style.css         UI / HUD / screens (Lead)
    js/data.js            fish catalogue, levels, upgrades, copy (Lead)  -> window.GAME_DATA
    js/audio.js           procedural WebAudio sound kit (Teammate A)     -> window.AudioKit
    js/fishfactory.js     detailed procedural fish models                -> window.FishFactory
    js/catchlab.js        live 3D catch-card specimen (separate WebGL)    -> window.CatchLab
    js/world.js           3D scene, camera, boat, water, effects, PiP    (Lead)
    js/game.js            state machine, UI, save, economy, sonar        (Lead)
    docs/DESIGN.md        this file
    README.md             how to play (Lead)

Do not read or modify anything outside the `fishing game` folder. Each owner writes only their own files.

## Visual direction

Cold North Atlantic 3D world: pewter overcast sky with drifting cloud bands, long swell and
wind foam, weathered ivory/teal boat, abyssal blue-green water, soft fog. The interface is a
**deepwater survey ledger**: ink-green chart grounds, brass rules, aged-paper cards and tags,
etched wave borders, a compass-rose title plate, and Palatino/Georgia serif instrument labels.
No neon glow, no glassy toy panels. Display and labels are serif; long copy stays humanist sans.
Never rely on external fonts, images, audio or network.

## Fish data schema (window.GAME_DATA.FISH)

    {
      id: "sunfish",            // unique, lowercase
      name: "Sunfish",
      level: 1,                 // 1..5, primary level
      rarity: "common" | "uncommon" | "rare" | "epic" | "legendary",
      depth: [2, 12],           // metres, preferred band
      weight: [0.3, 1.8],       // kg
      value: 18,                // base coins
      power: 1.0,               // 0.5..4 tension multiplier
      stamina: 1.0,             // 0.5..4 fight length multiplier
      agility: 0.4,             // 0..1 surge frequency
      shape: "round" | "long" | "eel" | "shark" | "flat" | "angler" | "seahorse",
      fin: "fan" | "sail" | "spike" | "small",
      color: 16764077,          // 0xRRGGBB body
      accent: 15239455,         // fins / pattern
      pattern: "plain" | "stripes" | "spots" | "bands",
      glow: null,               // 0xRRGGBB or null; emissive / bioluminescence
      behavior: "steady" | "runner" | "thrasher" | "diver" | "deadweight",
      junk: false,              // true = not counted toward level quota
      desc: "Short flavour line shown in the bestiary."
    }

## Lure schema (window.GAME_DATA.LURES)

    {
      id: "minnow",
      name: "Silver Minnow",
      short: "MINNOW",
      icon: "◆",
      tint: "#cfe8ff",
      sink: 1.0,          // sink-rate multiplier
      bite: 1.08,         // base bite-rate multiplier
      rare: 0,            // rarity weighting bias
      layer: 1.0,         // multiplier inside the feeding layer
      desc: "..."
    }

## Level schema (window.GAME_DATA.LEVELS)

    {
      id: "shallows",
      index: 1,
      name: "Sunny Shallows",
      tagline: "...",
      depthMax: 20,             // metres of water
      castRange: 26,            // metres, base max cast distance
      sky:   { top: 0x2a6f9e, bottom: 0xffd6a0 },     // gradient hex
      water: { top: 0x2fa3a8, deep: 0x062c3a },
      fog: 0x9fd8d8,
      time: "day" | "dusk" | "night",
      weather: "clear" | "mist" | "rain" | "storm",
      features: ["islands", "buoys", "rocks", "reef", "kelp", "wreck", "iceberg", "lighthouse"],
      species: ["sunfish", ...],           // ids available here
      quota: { total: 5, targets: [{ id: "silverfin", count: 1 }] },
      starCasts: 12,                        // <= this many casts for the 2nd star
      reward: 150,                          // completion coins
      brief: "One or two sentences of mission text."
    }

## Upgrade schema (window.GAME_DATA.UPGRADES)

    { id: "rod", name: "Carbon Rod", desc: "...", max: 3, costs: [0, 180, 420, 900],
      effect: "+4 m cast range per tier", icon: "rod" }

The game reads tiers and applies its own numbers; costs are coins, index 0 is the starting tier (free).

## Audio contract — window.AudioKit (js/audio.js)

Must be fully procedural (oscillators / filtered noise), no samples, no network, no autoplay errors.
Safe to call every method before `init()` (no-op) and after `init()` many times. Master volume modest.

    AudioKit.init()                 // create AudioContext + master chain; idempotent; call on first gesture
    AudioKit.resume()               // resume if suspended
    AudioKit.setMuted(bool)         // silence/unmute master (ramp, not a click)
    AudioKit.isMuted() -> bool
    AudioKit.setTheme(theme)        // "day"|"reef"|"trench"|"night"|"storm"; crossfade ambient bed
    AudioKit.stopAmbient()
    AudioKit.ui()                   // soft click
    AudioKit.purchase()
    AudioKit.cast()                 // whoosh
    AudioKit.splash(strength)       // 0..1 water impact
    AudioKit.bite()                 // two-note "tug" cue
    AudioKit.strike()               // hook set
    AudioKit.miss()                 // fish got away, low blip
    AudioKit.reel(intensity)        // short mechanical tick; intensity 0..1
    AudioKit.surge()                // fish run warning
    AudioKit.snap()                 // line snap crack
    AudioKit.catchFish(rarity)      // rarity-scaled arpeggio
    AudioKit.levelComplete()
    AudioKit.tensionAlarm()         // metallic creak, called sparsely by the game
    AudioKit.thunder()              // storm level

Implementation notes: use a shared noise buffer, BiquadFilter, Gain envelopes, no more than ~8 concurrent
one-shots. Ambient bed = 2-3 detuned oscillators + filtered noise; theme changes ramp down old bed.
Add `window.addEventListener('pointerdown', ...)`? NO — the game calls init; do not steal input.

## Fish factory contract — window.FishFactory (js/fishfactory.js)

    FishFactory.create(fish, lengthMeters) -> THREE.Group

- Classic global script; THREE is global (r128). No ES modules/imports.
- The fish model faces +X (nose toward +X), +Y is up, +Z is its side. Origin at body centre.
- The model's total length along X is approximately `lengthMeters`. Caller may scale the group.
- Low-poly, chunky, readable. 5–14 meshes per fish. MeshStandardMaterial / MeshLambertMaterial.
- Use `fish.shape`, `fish.fin`, `fish.color`, `fish.accent`, `fish.pattern`, `fish.glow`.
  Patterns may be procedural CanvasTexture (cheap, 128x64, no external assets) or extra meshes.
- `glow` (hex): emissive body/fin parts + a soft additive point/sprite light is optional (max 1 light).
- Attach animation handles on `group.userData`: `{ tail, leftFin, rightFin, jaw, bodyMat, glowMat }`
  where `tail` is the tail Object3D pivot and fins/jaw are Object3D pivots that can be rotated.
- `FishFactory.animate(group, time, speed, excitement)` wiggles tail and fins:
  speed 0..3 (swim speed), excitement 0..1 (fight thrash). Must be cheap; called per fish per frame.
- Keep geometry/material counts sane: 30 fish on screen max. Dispose is not required.
- Provide a one-line comment per shape. No console noise.
- Test with `node --check js/fishfactory.js` (syntax only) and, if practical, a tiny three.js smoke test
  using the vendored lib in Node is not possible (DOM) — static review is enough.

## Core gameplay rules (for context; Lead implements)

- Cast: hold action to charge 0..100%, release. Distance = 7 m + charge * castRange (upgrades add range).
  A school (hotspot) spawns each cast at a random distance; landing within 3 m = 2x bite rate.
- Sink: player sets target lure depth 0..depthMax. Lure sinks at ~6 m/s. Bite rate is weighted by each
  species' depth band overlap, rarity, lure upgrade and distance to the school. Sonar upgrade reveals
  fish blips in the sonar panel (2D canvas) and the school depth.
- Bite: bobber plunges, "!" prompt for ~1.4 s. Click/Space to strike. Too late/early = lost bait + wait.
- Fight: fish starts at its hooked depth. Hold to reel (raises fish, adds tension); release to rest.
  Fish surges telegraph 0.6 s early, pull hard and dive. Hold Shift = give line (drops tension fast,
  fish dives). Tension > max for 0.8 s = snap. Reel the fish to the surface to land it. Fish stamina
  drains faster in the ideal tension zone. Fight has a 90 s timeout -> escape.
- Depth is the progression: deeper levels = bigger fish, longer fights, stronger pulls, more coins.
- Quota: catch the listed targets + total count. 1 star = complete, 2 = completed within starCasts,
  3 = no fish lost. Replays allowed for bestiary/coins.
- Coins buy upgrades at the harbour. XP/rank is cosmetic. Save to localStorage.

## UI screens

Title → Harbour (level select, shop, bestiary, stats) → Fishing HUD → Catch card → Level results →
Harbour. Pause menu (Esc). Controls: hold LMB/Space = cast or reel, Up/Down or wheel = lure depth,
Shift = give line, Esc = pause, M = mute. On-screen buttons mirror these for touch.

## Acceptance

- Opens from file:// with zero console errors and zero network requests.
- All five levels playable end-to-end, all upgrades purchasable, bestiary persists.
- 3D scene per level is visually distinct (sky/water/scenery/weather).
- A live underwater picture-in-picture shows the hooked fish rising through depth-marked water during a fight.
- Smooth 60 fps on a normal laptop; graceful on integrated graphics.
