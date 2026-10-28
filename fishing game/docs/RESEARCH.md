# Fishing-game mechanics review

Notes from a short survey of fishing sims and their HUDs, and how those ideas were
adapted for Abyss Angler. This is design research, not a copy of any one game.

## What other games do well

- **Ultimate Fishing Simulator** uses a real tackle model: rod power, reel drag,
  line strength, hook size and bait all affect the same fight. Drag is the passive
  resistance the reel puts on a running fish; more drag tires fish faster but snaps
  light line. [Beginner guide](https://steamcommunity.com/app/468920/discussions/0/591784592221095554/)
- **My Paradise Lagoon Fishing Simulator** lists rod-angle management, line-tension
  control, drag tuning, hook sets, reel pumping, line types with different stretch,
  and species-specific lures/baits/rigs as core techniques. [Store page](https://store.steampowered.com/app/4163060/My_Paradise_Lagoon_Fishing_Simulator/)
- **Gone Fishing** makes depth the main progression axis: average fish size rises
  with depth, and bait, salinity, weather and map change the catch. [Mechanics wiki](https://gonefishing.fandom.com/wiki/Mechanics)
- **Ships at Sea**'s reworked sonar includes an optional **fish species indicator**
  so raw sonar data can be read as species, not only blips. [Sonar update](https://www.eprison.de/spiele/ships-at-sea/steam-news/6212244583179795854/7699/78740.html)
- **Fishing Planet**'s float fishing explains how a float suspends bait at a chosen
  depth and drifts with the current. [Bait fishing](https://wiki.fishingplanet.com/wiki/Bait_fishing)
- Small arcade fishing games commonly use a moving **green zone** against a fish
  that moves left/right, with timing as the skill. [Minigame example](https://alonestudios.gitbook.io/fishing-documentation/usage/usage-guide.md)

## What was added to Abyss Angler

1. **Lure box with real trade-offs** (keys 1/2/3)
   - Silver Minnow: neutral sink, reliable bite, no rarity bias.
   - Reef Jig: fast sink, strong inside the feeding layer, weak outside it.
   - Abyss Glow: slow sink, fewer bites, but heavily biases rare/heavy fish and
     gets a bonus at dusk/night.
   This is the species-specific lure idea reduced to three legible choices.
2. **Depth scan line in the HUD** - the sonar now names the species in the lure's
   band instead of only showing anonymous blips. At sonar tier 1 it reports count
   and rarities; at tier 2 it names the fish, which is the sonar species indicator
   borrowed from modern sonar UIs.
3. **Recall and recast** (R / RECALL) - reel in without waiting for a bite, so a
   bad depth or cast can be corrected immediately. This is the missing reposition
   verb in most cast-wait-strike loops.
4. **Live 3D catch showcase** - the catch card now renders the actual model that was
   caught, rotating slowly under a specimen grid, rather than only a text card.
5. **Deeper fish behaviours** (from the previous pass) - runner, thrasher, diver,
   deadweight and steady fish change how a fight reads at the same weight.

## What was deliberately not added

- **Drag tuning** and **rod-angle management**: both need dedicated controls and a
  much more detailed line model. The current fight already has tension, safe band,
  give-line and stamina; adding drag without a clear UI would muddy it.
- **Current drift**: a real current that moves the float is interesting, but it
  fights the direct depth slider and would need a second position control. The
  moving feeding layer supplies the read-the-water decision instead.
- **Reel pumping**: hold-to-reel plus surge/give-line already gives the rhythm;
  a separate pump input would be redundant on touch.

## HUD principles used

- One primary decision per panel: depth on the right, quota at the top, fight at
  the bottom.
- The new lure row and scan line stay in the depth panel because both only matter
  while choosing a depth.
- The catch preview is a separate, disposable WebGL surface: it never touches the
  world renderer, runs only while the card is open, and disposes the fish model on
  close.

## Endgame engagement

Fishing games keep players after the gear is maxed with repeatable goals rather than more
power. The common patterns are rotating contracts/missions (Fishing Planet, Dredge), renown
or reputation tracks with titles, collectible sidegrades (charms/attachments), record fish,
and score/endurance modes. Abyss Angler now uses the first three:

- Three rotating **bounty contracts** with progress that carries across waters.
- **Renown** titles from Contract Hand to Ridge Broker.
- Token-bought **charms** that change a rule rather than add raw power: storm rarity,
  slower feeding-layer drift, and a higher streak cap.
- A persistent **best streak** and contract count on the board and captain card.

Deliberately not added yet: a true endless descent (needs its own results/score screen),
daily resets (needs date handling and a server-independent save policy), and tournaments
(no online leaderboard to compare against).

## Visual direction pass

The first model pass was bright and toy-like. The current pass moves toward a **cold North
Atlantic survey**: a pewter overcast sky, long swell, wind foam and a weathered ivory boat in the
world; ink-and-brass UI, aged-paper cards, chart grids, etched wave borders and a compass-rose
title plate above it. Fish use muted maritime colours and bioluminescence only where the species
is deep. The swim cycle adds a small vertex wave along the body, plus tail/fin animation, so the
models read as living animals rather than rigid low-poly props.