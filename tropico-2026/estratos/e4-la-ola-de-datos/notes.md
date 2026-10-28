# E4 — La Ola de Datos

**Idiom:** ukiyo-e woodblock print (nishiki-e), 1600x1200. 405 vector elements.

## Argument (written before drawing) — what the piece knows that the caption will not say

The sea in this print is not water. Every swell is a sheath packed with fibre, and the foam
is the broken end of the bundle where it has been cut. The wave is not a disaster that
arrives; it is a disaster that was installed, and the print is its manifest. The small marks
in the foam are a tide-gauge tally: each group of five is one gauge reporting its count,
incremented left to right along the break, so the composition is also a graph of sea-level
records. The boat is a trawler dragging a data net; the distant Fuji is a server rack with
its status lights lit; the red cartouche is not a signature but a clock — its border is a
measuring scale of ticks and its inner bars record an edition. The break — the one strand
that leaves the wave and runs out of the frame — is the only element in the print that is
not bundled.

## Rule (one sentence)

One wave-claw module (a bundle of five cable strands ending in a cut cross-section) is stamped
at four scales and permuted by rotation; a single unwinding strand leaves the bundle at the
crest and is the one deliberate break of the rule.

## Hidden system

Tide-gauge tally register in the foam: groups of five marks (four uprights plus a crossbar)
increasing left to right; the final group is deliberately short (three), so the register ends
in a break. A second register in the sea (connector pins, same counting logic) and a kento
registration mark in the bottom-right corner count the edition. The cartouche's border is a
tick scale.

## Pass log

1. **Build 1.** Sky bands, sea, first wave polygon, claws as fans, boat, Fuji, seal. Looked:
   the wave was a blob with a hook; claws read as caterpillar legs; foam was a white stripe.
2. **Build 2.** Wave redrawn as a hook silhouette (outer flank, lip, inner face); mountain
   became a rack; tallies placed in the sea. Looked: the silhouette read as a wave, the
   hollow worked; the foam was still a stripe and the claws floated like debris.
3. **Build 3 — CHECKPOINT.** FAR: reads as a great wave with a curling crest; the idiom reads.
   MIDDLE: cable ridges and claws legible, but the foam does not read as foam, the tally band
   read as a white plank, the sea fingers as debris. NEAR: cut faces with fibre dots resolve;
   tallies not yet legible. **Failing: middle.**
4. **Build 4.** Foam mass with a bumpy outline; curved cable fingers (quadratic band + strands
   + cut ellipse); register moved into the foam following the crest; strand given an unwinding
   loop. Looked: far read much stronger, fingers read as cable bundles.
5. **Build 5.** Foam thickened; crest fingers directed with a rotation permutation; mountain
   rack panel; boat moved clear of the fingers; strand thickened.
6. **Build 6.** Tally register enlarged and rotated to follow the foam; connector-pin register
   moved beside the boat; sea patches reorganised.
7. **Build 7 — CHECKPOINT.** FAR: the wave, boat, Fuji and seal all read; it is a ukiyo-e
   print. MIDDLE: cable bundles and cut ends legible; foam still too smooth; some crest
   fingers read as hooks. NEAR: tally marks legible as counts, kento mark added, cut faces
   with seven fibre dots resolve. **Failing: middle (foam texture and finger direction).**
8. **Build 8.** Larger foam lobes and crest spray; foam underside added on the lip; kento
   registration mark; sea depth band.
9. **Build 9.** Attempted a bumpy outer foam edge; the band disappeared (polygon degenerated),
   caught it in the render.
10. **Build 10.** Foam band restored with lobes; band widened.
11. **Build 11.** Sky cooled so the cream foam separates from it; foam hatching darkened.
12. **Build 12.** Foam spikes along the inner edge; final render.

## Three-distance result (final)

- **FAR (400 px):** the wave, the curl, the hanging claw-fingers, the boat and the Fuji read
  instantly; the red seal reads as a cartouche. The idiom is unmistakable.
- **MIDDLE (1600 px):** the wave is made of bundled cable (ridges, clamp rings, sheath bands);
  each foam finger ends in a cut cross-section; the boat is a trawler with a net; the Fuji is
  a rack with status LEDs; the cartouche is a geometric seal. The foam band is still smoother
  than a real ukiyo-e foam edge.
- **NEAR (100%):** every finger shows seven fibre dots in a cut ellipse; the tally groups
  increment left to right, the last group short; the connector-pin register counts beside the
  boat; the kento mark sits in the corner; the seal border is a tick scale.

## Critique (honest)

- The foam is the weak register: it reads as a smooth cream ribbon with lobes rather than the
  lacy, shredded foam of the idiom. The band's edge is too even, and the lobes are too round.
- The crest fingers, while readable as cable bundles, still sit on the crest like objects
  rather than being thrown off it; at middle distance several read as hooks.
- The wave's body is a single flat blue mass with parallel ridges; the ukiyo-e original gets
  much of its power from graded bokashi and from foam moving inside the curl. The hollow here
  is empty.
- The register rule is present but quiet: at 400 px the tallies are texture, not a count. That
  is intended (hidden system) but it means the "graph" reading only arrives at 100%.
- The boat is a vehicle for a net, not a character; the print's human scale is missing.
