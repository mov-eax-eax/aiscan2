# Alien Park 04 — shared run board

This board is the coordination surface for the RSI loop. Agents and the patron can append notes, claim a cycle, or challenge a critique. The code is not allowed to change without a completed render on the board.

## Objective

Build an impressive, modular HTML+JS alien park from scratch. Then improve it through recursive self-improvement cycles: look at the actual render, write a dispassionate critique, make one highest-leverage change, render again. The goal is not to follow a fixed recipe. The goal is for every pass to be more detailed, better looking, more coherent and more atmospheric.

## Loop protocol

1. **Observe** — render the current park, inspect the image, read the code when needed.
2. **Critique** — name what is actually weak, not what was intended.
3. **Choose one move** — the smallest change with the largest visual/structural return.
4. **Build** — make the change; keep it modular.
5. **Verify** — render fresh, check console and FPS, inspect the image.
6. **Record** — append the cycle below and to `js/process.js`.

## Cycle board

| Cycle | State | Title | Critique | Move |
|---|---|---|---|---|
| 00 | done | Base construction | Terraces and bloom exist, but the sky is a flat orange wall, the bloom is cropped, the island reads as stacked cylinders and the atmosphere is thin. | Build the first runnable version and establish a baseline. |
| 01 | done | Frame and dark sky | The re-frame brought the crown into shot, but the sky has a hard shader seam, the flat purple field has no depth, and the bloom is still a dark stem with a few flat leaves. | Rebuild the sky shader, re-frame the camera, and reveal the ringed planet. |
| 02 | done | Bloom as destination | The crown now reads as an opening flower with layered petals, veins, halos and a hot core. The sky seam is gone. The terraces are still clean cylinders with no water, edges or scale cues. | Build the bloom crown; replace the broken WebGL sky with a transparent CSS atmosphere; verify the new baseline. |
| 03 | done | The core is the key light | The core-as-key-light improves the value structure; the crown finally glows. But the petals became edge-on blades, the halo is close to washing the crown out, and the front terrace wall is an empty band. | Add a core PointLight + warm inner light + radial halo sprite; cut hemisphere/ambient flood; re-frame the crown larger. |
| 04 | done | Crown silhouette | Opening the petals further helps, but the crown reads as a blue fan rather than a living flower. The island is cropped at the bottom and the front wall is still blank. | Invert the petal lean, tame the halo, keep the core light. |
| 05 | done | Terraces alive | Ribs, railings and streams are in but too dark to register; the waterfalls hide behind the terrace edge; the front wall is still an empty band. | Add cliff ribs, railings, rivers, waterfalls and mist; push the main fall past the wall. |
| 06 | done | Front face | The wider frame and front fall help; the fall is a sliver, glyphs/ledges vanish into the dark wall, and the camera cuts the bottom. | Push water and ledges off the wall, lower the camera, add a front fall and strata bands. |
| 07 | done | Inhabitation | The crowd gives the island scale. The pavilions still read as props, the sky creatures are paper scraps, and there is no unmistakable ride. | Add instanced visitors, pennants and clusters. |
| 08 | done | Sky life | The manta-ribbons beat the tan wing-scraps, but they are small and distant. The terraces still read as decorated drums. | Replace the flat ray wings with additive shape-ribbon mantas and trails. |
| 09 | done | The halo wheel | The wheel finally puts a ride in the skyline, but it is thin and isolated; the pavilions still read as props and the foreground is a cut-off cliff. | Add the halo wheel on the east terrace. |
| 10 | done | Pavilions with identity | Each embassy gets a crown ring, antenna, forecourt and coloured light. The foreground is still a cut-off cliff and the atmosphere is a flat violet field. | Add crown rings, lights, steps and hanging orbs to all six pavilions. |
| 11 | done | The approach | The causeway gives the island a foreground spine and a real entrance; the lower camera reveals the terraces. Atmosphere between layers is still missing. | Add a curved approach causeway with lamps, landing and entry arch; lower the camera. |
| 12 | failed | Air between the layers | The light shafts rendered as black wedges, aurora vanished behind the CSS sky, mist was invisible, and FPS fell to 29. | Add aurora, mist and pavilion light shafts. |
| 13 | done | Freeze the frame | Reverting the failed shafts restores the image; freezing static shadows recovers ~50 fps. The flat nameplates and dark foreground remain. | Revert atmospheric geometry, freeze shadow map, restore headroom. |
| 14 | done | Nameplates | The flat nameplates are lost against the crowns; the world names do not read. | Add readable names as billboards and prepare the final archive. |
| 15 | done | The archive | The park is detailed and the world names now hang over the pavilions. The process archive carries all fifteen renders. | Billboard names, process archive with renders, final QA. |

## Open questions / next likely pressure

- The island needs edge life, scale cues and a stronger silhouette.
- The bloom crown should be the visual destination once it is in frame.
- The lower terrace is under-populated.
- Need a second pass on pavilion identity and the transit line.
- The process overlay should become a shared archive of renders.

## Claims

- Lead: ran cycles 00–15; wrote `gallery/alien-park4/`.
- Critic: independent pass complete in `cycles/critic-01.md`; reviewer saw only the cycle-01 render and did not touch app source.
- Cycle 12 is deliberately recorded as a failed pass and was reverted in cycle 13.
- The process archive is inside the app under **Process ↗** and contains all sixteen renders (base + fifteen RSI passes).
