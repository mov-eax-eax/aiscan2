// Shared run board. Each entry is written after a render has been inspected.
// This is deliberately append-only: the process, including reversals, stays visible.
export const PROCESS = [
  {
    n: '00',
    title: 'Base construction',
    critique: 'First complete render. The terraces, bloom and pavilions exist; atmosphere is thin, the island reads as stacked discs, and the camera is too far from the architecture.',
    action: 'Build the first runnable version. Await the first dispassionate critique.',
  },
  {
    n: '01',
    title: 'Frame and dark sky',
    critique: 'The re-frame brought the bloom crown into shot. The island now reads as a place rather than a crop, but the sky has a hard shader seam and is a flat purple field; the bloom is still a dark stem with a few flat leaves, and the near edge is cropped by the HUD.',
    action: 'Re-frame the camera and rebuild the sky shader into a continuous deep-space dusk with stars, a ringed planet and a soft horizon. Next: make the bloom itself worth the frame.',
  },
  {
    n: '02',
    title: 'Bloom as destination',
    critique: 'The crown now reads as an opening flower: layered petals, luminous veins, halo rings and a hot core. The sky seam is gone and the ringed planet is visible. The terraces, however, are still clean cylinders; the island has no water, no edges and no scale cues.',
    action: 'Build the bloom crown and fix the sky backdrop with a transparent CSS atmosphere. Next: give the terraces geology, railings and falling water.',
  },
  {
    n: '03',
    title: 'The core is the key light',
    critique: 'The council was right: the core as key light transforms the value structure. The crown now has a real warm core, a halo and falloff; the rest of the park falls away into cool night. But the petals have become edge-on blades, the halo is close to washing the crown out, and the front terrace wall is still an empty band.',
    action: 'Make the bloom core the key light, add a radial halo, cut the hemisphere/ambient flood, and re-frame the crown larger. Next: restore the petal silhouette and make the crown read as a flower again.',
  },
  {
    n: '04',
    title: 'Crown silhouette',
    critique: 'Opening the petals further helps, but the crown now reads as a blue fan rather than a living flower. The core is strong; the island is still cropped at the bottom and the face of the front terrace is a dark, empty wall.',
    action: 'Invert the petal lean and tame the halo. Keep the core light. Next: put geology, water and detail on the front face so the island stops reading as a stack of drums.',
  },
  {
    n: '05',
    title: 'Terraces alive',
    critique: 'The ribs, railings and streams are in, but they are too dark to register at this distance. The waterfalls are hidden behind the terrace edge and the front wall remains a blank band. The pavilions still read as a dome, a hoop and a party hat.',
    action: 'Add cliff ribs, railings, rivers, waterfalls and mist; push the main fall out past the wall so it can be seen. Next: turn the front face into a real composition.',
  },
  {
    n: '06',
    title: 'Front face',
    critique: 'The wider frame and the front fall help the island read as a place, but the main waterfall is a sliver, the carved glyphs and ledges disappear into the dark wall, and the camera still cuts the bottom. The sky rays now read as tan scraps.',
    action: 'Push water and ledges off the wall, lower the camera, add a front fall and strata bands. Next: fill the park with inhabitants and make the scale legible.',
  },
  {
    n: '07',
    title: 'Inhabitation',
    critique: 'The crowd instances give the island scale; the terraces finally feel occupied. But the pavilions still read as props, the sky creatures are paper scraps, and there is no unmistakable ride.',
    action: 'Add 150 instanced visitors, pennants and cluster placement. Next: replace the sky creatures and give the park one impossible ride.',
  },
  {
    n: '08',
    title: 'Sky life',
    critique: 'The manta-ribbons are a real improvement over the tan scraps, but they are still small and distant. The park has atmosphere above the terraces now; the terraces themselves still read as decorated drums.',
    action: 'Replace the flat sky-ray wings with additive shape-ribbon mantas and trails. Next: give the park a ride with a silhouette you cannot ignore.',
  },
  {
    n: '09',
    title: 'The halo wheel',
    critique: 'The halo wheel finally puts a ride in the skyline. It is too thin and too isolated; the pavilions still read as a dome, a party hat and a hoop, and the foreground is still a cut-off cliff.',
    action: 'Add the halo wheel on the east terrace. Next: give the pavilions their own identities and build a foreground approach.',
  },
  {
    n: '10',
    title: 'Pavilions with identity',
    critique: 'Each embassy now has a crown ring, antenna, forecourt and coloured light. The island has more event and more scale, but the foreground is still a cut-off cliff and the atmosphere is still a flat violet field.',
    action: 'Add crown rings, lights, steps and hanging orbs to all six pavilions. Next: build a foreground approach and deepen the atmosphere.',
  },
  {
    n: '11',
    title: 'The approach',
    critique: 'The causeway gives the island a foreground spine and a real entrance, and the lower camera reveals the terraces. The composition is stronger, but it still needs atmosphere between the layers and a clearer sense of depth.',
    action: 'Add a curved approach causeway with lamps, landing and entry arch; lower the camera. Next: add aurora, mist and volumetric light.',
  },
  {
    n: '12',
    title: 'Air between the layers',
    critique: 'This pass failed. The pavilion light shafts rendered as black wedges, the aurora disappeared behind the CSS sky, the mist was invisible, and the frame rate dropped to 29 fps. The atmosphere got heavier without getting more atmospheric.',
    action: 'Revert the light shafts, disable the aurora and freeze the static shadow map. Keep the mist only if it pays for itself.',
  },
  {
    n: '13',
    title: 'Freeze the frame',
    critique: 'Reverting the failed shafts restores the image, and freezing the shadow map brings the frame back to ~50 fps. The scene is clean again, but the flat nameplates and the dark foreground are still unresolved.',
    action: 'Remove the bad atmospheric geometry, freeze shadows, and restore headroom. Next: make the world names actually readable.',
  },
  {
    n: '14',
    title: 'Nameplates',
    critique: 'The flat nameplates are a good idea executed too quietly: they are lost against the pavilion crowns and do not establish the planet identities. The scene is still legible and the performance holds.',
    action: 'Add readable embassy names as billboards so the six worlds are visible from any angle. Next: final archive and QA.',
  },
  {
    n: '15',
    title: 'The archive',
    critique: 'The park is detailed and the world names now hang over the pavilions as billboards. The remaining weakness is not geometry but memory: the fifteen passes are invisible inside the park itself. The RSI record should be part of the artifact.',
    action: 'Add the process archive with every cycle render, billboard the six embassy names, freeze the final baseline and close the run.',
  },];
