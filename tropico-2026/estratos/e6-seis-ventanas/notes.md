# E6 — Seis Ventanas

**Idiom:** six-panel comic page, 1600x1200.

## Argument (written before drawing) — what this piece knows that the caption will not say

Six windows, one building, six hours. The building is never shown; it is the grid itself.
Each panel is a room on a different floor, and the panel border is its distance from the
street: thick at the ground floor, thin at the top, absent where the page bleeds. The
recurring object is a satellite dish on the roof opposite; it is seen through every window
and its scale and state record the day (new, visited by a bird, snowed on, rusted and cabled,
silhouetted, gone). The crack is one crack: drawn once in page coordinates, each panel shows
only the part its wall contains, so across the gutters it is continuous even though no single
panel admits it. The sixth panel is the roof room at 05:00; its window looks at the building's
own facade, and the facade has six lit windows, each with a dish, and one with a figure in it.
Nobody in the comic finds this strange.

## Rule (one sentence)

Six panels, each one hour later and one floor higher; the panel border thickness encodes the
floor's distance from the street; one dish and one page-wide crack recur in every panel, and
the sixth panel breaks both the sequence and the grid.

## Hidden system

The crack: one polyline in page coordinates, clipped to each panel's wall (the window punched
out), continuous across the gutters. The clocks carry the hour; the left border of each panel
carries as many notches as its floor number; the sixth clock has a reversed red hand. The
six dots at the bottom-left count the panels.

## Pass log

1. **Build 1.** Six panels laid out (2 / 3 / 1 bleeding), walls, windows, dishes, clocks,
   page-wide crack. Looked: the crack ran across the windows, the dish's pole escaped the
   window, and the rooms read as empty boxes.
2. **Build 2.** View clipped to the window; the crack clipped to the wall (window punched out)
   with a light edge and branches. Looked: the crack still crossed the furniture; the clock
   and the picture overlapped the window.
3. **Build 3 — CHECKPOINT.** FAR: a comic page with six rooms whose wall tones change by hour;
   the bleeding bottom strip reads. MIDDLE: the dish is legible in each window at different
   scales, rooms have a clock, lamp, picture, furniture. NEAR: the crack's branches and border
   notches are visible but the crack reads as a stray line; clock/picture overlap the window;
   rooms underfurnished. **Failing: middle (incident/overlap) and near (crack).**
4. **Build 4.** Per-panel window geometry; crack drawn before furniture and clipped to the
   wall; picture and clock repositioned clear of the window; rugs and cups added; the sixth
   panel's recursive windows toned to mirror the six panels.
5. **Build 5.** Clocks placed relative to each window edge; cat on the sill (panel B); crack
   thickened; a tiny figure placed in one recursive window.
6. **Build 6.** Snow state for the dish in panel C; inner shadow at the panel edges; near crop
   checked at 100%.
7. **Build 7 — CHECKPOINT.** FAR: reads as a comic page: six panels, the bleed, the dish in
   five windows, the crack crossing. MIDDLE: each panel is a room at its hour; the dish states
   and scales are legible; the border thicknesses vary. NEAR: the crack's branches and light
   edge, the clock hands, the floor notches, the cups, the picture, the tiny figure in the
   recursive window, the six dots. All three distances hold. Converged.

## Three-distance result (final)

- **FAR (400 px):** a six-panel comic page with a bleeding bottom strip; rooms read; the hours
  read as wall colours.
- **MIDDLE (1600 px):** six rooms of one building at six hours; the dish on the roof opposite
  in six scales/states; the page-wide crack; the clocks.
- **NEAR (100%):** the crack's branching with a lit edge; the border notches counting the
  floor; the clock hands; the dishes' rust cables and the bird; the six recursive windows with
  their six dishes and one tiny figure.

## Critique (honest)

- The rooms are still thin: a comic page usually carries people, and this one carries
  furniture. The cat and the tiny figure are the only living marks.
- The sixth panel's impossibility is quiet to the point of being missable: the recursive
  facade reads as a nice exterior view unless you notice the six dishes and the figure. That
  is deliberate but risky.
- The crack is a system, not a drawing: it reads as a diagram line in places, especially where
  it crosses the floor.
- The border thickness code is real but invisible without a ruler — a hidden system that only
  the maker knows is barely a system. The notches help, but they are small.
- The page's colour script (warm to cold) is the strongest part; the drawings themselves are
  flat.
