# V2 — Manifiesto del Agua

**Archetype assigned:** type-as-image / constructivist poster, letters as shapes.
**Style:** constructivist / Swiss poster, three colours.
**Theme:** a water-rights manifesto for 2031.

## Concept

The poster is the words. A black field, one red diagonal bar, cream letterforms.
"AGUA" is set at 320 units and cropped by the left edge; "VIDA" runs vertically
through it at 340 units, rotated 90°, cropped by the top edge, and crosses the
last A of AGUA with a black knockout so the two words interlock. "MANIFIESTO
2031" is the small top line; "NO SE VENDE" is the bottom-right line. Three icons
only — drop, pipe, hand — small, at the top right.

## Pass log

1. **Build 1.** Geometric alphabet (bars + diagonals), AGUA huge, VIDA vertical at
   the right, red bar, small line, icons. Looked: VIDA sat beside AGUA instead of
   crossing it; the icons were a single blob (all three drawn in one coordinate
   box); the bar dominated.
2. **Build 2.** VIDA moved over the last A of AGUA. It worked as a crossing but
   red-on-red over the bar was muddy; the word read as separate glyphs.
3. **Build 3.** VIDA changed to cream with a black knockout and tighter spacing;
   NO SE VENDE moved to the bottom-right. Looked: NO SE VENDE collided with the
   V of VIDA; the icons still merged.
4. **Converge.** NO SE VENDE shifted clear of VIDA; icons rebuilt as three
   separate groups (drop / pipe / hand) and moved clear of the bar. 400 px thumb
   checked: it reads as a poster, and the type reads as an image.

## Self-critique (honest)

- **VIDA is the weakest element.** The vertical word is a stack of four glyphs;
  the I is a bare bar and the spacing still reads as a ladder more than as a
  word. It is legible at 400 px only because the letters are enormous.
- **The knockout reads as an outline, not as overprint.** The black halo around
  VIDA separates it from AGUA and from the red bar, but it is a modern vector
  outline; a real two-colour print would misregister, not outline.
- **The manifesto argument is thin.** Four phrases (AGUA, VIDA, NO SE VENDE,
  MANIFIESTO 2031) plus three icons. It is a slogan poster, not a manifesto. The
  brief said the poster is the words, and the words are few.
- **The icons are small and secondary.** The pipe's flange nearly touches the
  hand. At 400 px they are marks, not icons.
- **Weight is bottom-left/centre.** The red bar and AGUA carry the left; the top
  right is empty except the icons. That asymmetry is deliberate, but it makes the
  poster feel heavier at the base than a constructivist poster usually does.
- **The alphabet is idiosyncratic.** The G and S are built from bars; at 320 px
  they read, at 74 px (MANIFIESTO 2031) the S is a little ambiguous.

## Technique notes

- All letterforms are <path> geometry; no <text>, no fonts, no external assets.
- Custom geometric alphabet: letters are unions of rectilinear bars (path
  subpaths) plus diagonal polygons; D and O use evenodd counters.
- Knockout = drawn twice: expanded black stroke behind, cream fill in front.
- Three colours only: #12100E, #BE2A1D, #E7DDC4.
- Rough edge filter (feDisplacementMap, scale 3) for a printed, hand-pulled feel.
- Grain last (0.11).
