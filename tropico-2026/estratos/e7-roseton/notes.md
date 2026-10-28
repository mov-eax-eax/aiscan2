# Rosetón — notes

**Idiom:** cathedral rose window (1400 x 1400 square).

## The argument, before drawing

What this window knows that the caption will not say: the rose is a **resistor network**, and its
twelve lights are twelve resistors whose colour bands are the first twelve digits of π read through
the resistor code (0 black, 1 brown, 2 red, 3 orange, 4 yellow, 5 green, 6 blue, 7 violet, 8 grey,
9 white). π = 3·1·4·1·5·9·2·6·5·3·5·8, so the glass runs orange, brown, yellow, brown, green, white,
red, blue, green, orange, green, grey — a sequence no glazier would choose, which is how you know it
is code and not taste. The stone tracery is a circuit: the mullions carry the traces, the junctions
are soldered, and the chip at the centre has twelve pins, one per light. One light — the seventh — is
reversed: its bands run inward-out, the deliberate break. And the stone casts its shadow on the
glass: the shadow is not uniform, and where the light comes from outside the window the shadows
assemble into a **dove**, which only exists at the distance where your nose is to the glass.

## The rule (one sentence)

One petal module — a lancet carrying a four-band resistor built out of its own glass — is drawn
twelve times at 30° intervals; its colour permutation follows the resistor code applied to the first
twelve digits of π, the seventh petal is inverted (bands mirrored, widest band at the centre), and
the stone's cast shadows are computed as a second image rather than as shading.

## Hidden systems

1. **The resistor code**: 12 petals, 4 bands each, colours = resistor digits of π; the seventh is
   inverted. Reading the bands outward on any petal gives four digits of the sequence.
2. **The circuit**: 12 gold traces along the mullions, 24 solder junctions, the central 12-pin chip.
3. **The dove**: stone shadows cast from outside onto the glass, clipped to the glass circle; only
   resolvable at 100%.

## Registers

the glass (quarries) · the leading (black lines between pieces) · the stone tracery (mullions, cusps,
outer ring) · the light (cast shadows). Three scales: window/masonry > petals/roundels > quarries and
solder dots.

## Palette

glass: orange #d9651f, brown #7a4a24, yellow #e8c72c, green #2f7a45, blue #2b4f9e, violet #5a2f7a,
grey #8d8a84, white #eae4d6, red #b4232a, black #1a1a1a · leading #1d1d1f · stone #b9b0a0 /
#cfc7b8 · light #f2ead2.

## Pass log (5 passes)

1. **Build.** Twelve wedges, resistor capsules clustered near the centre, a ring of 24 roundels, a
   chip. Result: a beige wheel with a coloured ring at the middle; the capsule was too small.
2. **Bands as glass.** Replaced the capsules with four glass bands per petal (the petal *is* the
   resistor), deep blue ground, stone mullions, gold traces. Colour now spans the window.
3. **Quarries + inversion.** Subdivided every band into quarries (radial and arch lead lines) and
   mirrored the seventh petal's bands. PASS-3 CHECKPOINT WRITTEN. The inverted petal was drawn into
   the wrong slot (rotated about the window centre) leaving a blank blue petal — fixed next pass.
4. **Pointed petals.** Lancet heads (pointed apex), heavier stone mullions, the inverted petal kept
   in its own slot. PASS-4 CHECKPOINT WRITTEN.
5. **Light.** Tracery shadows directionally offset, the dove enlarged ×1.3, clipped to the glass,
   opacity 0.46; grain last.

## Checkpoint — pass 3

- **FAR (400 px):** a rose window — circular, stone surround, radiating tracery, a ring of small
  lights, a grey centre. Archetype passes, but the colour ring sits in the middle third and the
  outer third is pale, so at thumbnail it reads as a fan, not a window.
- **MIDDLE (1600 px):** the four-band sequence per petal is legible, so the resistor reading works;
  the seventh petal is missing (drawn into the wrong slot) — an obvious hole at 9 o'clock.
- **NEAR:** quarries and lead lines are countable, the chip has its 12 pins, but the dove reads as
  three grey smudges, not as a bird.
**Failing: NEAR** (the hidden system was not resolving) and one structural bug at MIDDLE.

## Checkpoint — pass 4

- **FAR:** the window now reads as a gothic rose: pointed lancets, stone mullions, a jewelled outer
  ring. PASS.
- **MIDDLE:** twelve lancets with four-band sequences; the inverted petal is in place but its
  difference (widest band at the centre) is a near-reading, not a middle one. PASS.
- **NEAR:** quarries, solder junctions, chip pins and traces all resolve; the dove is still weak
  (0.30 opacity, small). FAILING: NEAR.
**Fix applied in pass 5:** the dove scaled and strengthened; it now reads as a cast shadow across the
glass, and as a bird at 100%.

## Honest critique

- **What works:** the far reading is instant and correct, and the code is genuinely in the glass: a
  glazier's palette made strange by π. The four-band logic reads at middle distance without any
  caption, and the chip-and-trace register gives the window a second life as a diagram.
- **What is weak:** the window is more "colour wheel" than "cathedral" — twelve saturated hues are a
  schematic rainbow, not the restricted deep-blue-and-ruby palette of real glass, and the tracery is
  light where a rose window's stone is heavy. The dove exists, but as a smudge: I would build it from
  the *shadows of the cusps only* (so it is architecture-caused) rather than from free shadow shapes,
  which is the honest version of the idea even if it is harder to control.
- **Craft:** flat glass colours with lead lines; the only filter is the final grain (0.11); the
  circuits are drawn, not simulated.
