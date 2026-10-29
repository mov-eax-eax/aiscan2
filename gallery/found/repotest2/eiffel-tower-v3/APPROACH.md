# APPROACH.md — how to make this good, with the information we actually have

Governing document. Where it conflicts with `BUILD.md`, this wins: `BUILD.md` is the engineering
detail, this is the judgment about *what deserves care*.

---

## 1. The position

**This is a measured drawing brought into three dimensions.**

That is the whole design brief, and everything follows from it. The reference objects are not
photographs of the tower — they are **Eiffel's own 1900 plates**: restrained, information-dense,
warm, with a strict hierarchy of line and tone. They are beautiful *because* they know what to
show and what to leave out.

So the model is not a game asset and not a photoreal render. It is a piece of draughtsmanship
with depth. A structural engineer should look at it and recognise the building; a designer should
be willing to put a still of it on a wall.

Three consequences, immediately:

- **Clarity beats richness.** Every added detail must earn its place by making the structure more
  legible. Detail that only adds texture is noise.
- **The hierarchy is the design.** The profile, the three platform bars, the arch void and the
  summit block carry the whole thing. Everything else is tone.
- **The night mode is a reward, not the pitch.** Gold and glowing, yes — as something you
  discover after the technical reading is already satisfying on its own.

## 2. Tap the brakes on the verification machinery

I built ten pass/fail criteria and eight modules of assertions. They are not wrong — three
failures came from numbers I invented, and the harness is why the fourth won't. But **a model can
pass all ten and still be dull**, and there is a real risk that gates become a way of feeling
productive while avoiding the harder question of whether it looks right.

So the loop gets reordered:

> **The eye is primary. The metrics are the seatbelt.**

I will compare renders against the reference — Durandelle's 1888 photograph, the supplied
dimensioned elevation, Plate I — **at every stage, side by side**, and I will say out loud whether
it reads. The harness then stops me from fooling myself about *why*. That is all it is for.

This is the correction that matters most, because the failures so far were not metric failures.
"Wires where the original has none" is not a number. It is a look.

## 3. Where precision earns its keep — and where it does not

Fraction of how good this looks, honestly estimated:

| What | Weight | Precision warranted |
|---|---|---|
| The silhouette — faceted, concave, right proportions | **~50 %** | **to the millimetre.** Attested anchors only. |
| The three platform bars | **~20 %** | **exact**: 70.69 / 40.96 / 18.65 m at exactly 57.63 / 115.73 / 276.13 m |
| The lattice reading as dense warm iron — neither wire nor slab | ~15 % | the *tone* matters; individual member counts do not |
| The legs' splay and the arch void | ~10 % | the *gesture* matters more than the number |
| The summit and antenna | ~5 % | accurate enough to read as a spire |
| Rivets, internal diaphragms, upper-section schedules | **~0 %** | **not worth building** |

**70 % of the perceived result is the silhouette plus three horizontal bars.** So that is where
the effort goes, and I should be honest that most of the remaining research is chasing the other
30 %.

## 4. What to do with each unknown

The tasteful move with an unknown is usually **not** to resolve it — it is to **design so that
being wrong about it cannot hurt the silhouette.**

| Unknown | If we get it wrong | Decision |
|---|---|---|
| **Arch: 74 m or 30.2 m span?** | High — it is an LOD-1 feature | **Stop chasing the number. Derive the arch from constraints instead:** it must spring from both legs' inner faces and clear the 1st-floor underside, and Eiffel says it is a **circle**. Those three facts alone fix it, self-consistently, whether or not the published span is right. Flag the discrepancy, then let geometry win. |
| Panel schedule (29 heights, partly read) | Medium — it is the *rhythm* of the faceting, not the outline | Drive the profile from the **four attested anchors**. Let the panel boundaries set the *facet rhythm* on top. An error then produces a slightly wrong rhythm, never a wrong silhouette. |
| Base solidity: 0.48 measured vs "panels 1–5 solid" | Medium — porosity | **Use the measurement (0.48)** — it is a measurement *of the building* — and let the plate's *« sept panneaux évides »* note modulate it. Do not average, do not agonise. |
| Section schedule above L2 | Low — sub-pixel at most viewing distances | Take the **direction** (monotone decline) and the one figure that verifies arithmetically. |
| Are faces 1–4 decorated and 2–3 not? | Low | **Assume four-fold symmetry.** Every photograph of this building reads symmetric, and the asymmetry (if real) is internal to a caisson. Note it; don't build it. |
| `123,907`, the intermediate floor, `101.40` | Negligible | Ignore the first, include the floor as a modest band, treat `101.40` as dead. |

One rule underneath all of it: **uncertain inputs may only affect things that look uncertain
anyway.** Nothing shaky is allowed to touch the profile, the platform heights, or the base.

## 5. Build in the order you perceive it

This is the change I'd make to `BUILD.md` even if nothing else changed. Build the model in the
**compression ladder's order** rather than the construction sequence, so that *every stage is
something you can look at and judge* — and so a wrong shape is never buried under detail.

| Stage | What exists | What you judge |
|---|---|---|
| **1** | The profile as a **flat extruded silhouette**, nothing else | Does that shape read as the Eiffel Tower? **If not, stop — nothing downstream can save it.** |
| **2** | + the three platform bars, the arch void, the summit block — still flat | The minimum stroke set. It should now be unmistakable at a glance. |
| **3** | + the legs' true 3D splay and the prismatic inner face | Does the base have the right weight? |
| **4** | + the lattice as a **solid with the right opacity** — no bars yet | Is the *tone* right? Too open, too solid? |
| **5** | + real bars, chords, treillis — the faceted profile made physical | The filigree, only now. |
| **6** | + decks, arches, frieze, `masque`, campanile, antenna | The silhouette's fine structure. |
| **7** | + lighting modes, blueprint, ortho views | The presentation. |

Stage 1 is the cheapest possible artifact that tests the most important 50 %. That ordering is
the single most useful thing in this document.

## 6. The look

**Ground.** No landscape. The technical views sit on a quiet neutral — a soft warm grey in Studio,
true paper-white in Blueprint. The plates have no ground plane and neither should these. A
horizon line only in the daylight mode, and only faintly.

**Tone hierarchy**, lifted from the plates and from Borson's rule that *"everything is related to
the distance between adjacent surfaces"*:

```
profile + platform bars   heaviest, darkest     ← the silhouette must read first
chords                    heavy
treillis, mullions        medium
fine lacing, hatch        lightest
deck undersides, arch     poché — near-black    ← the plates do this, and it is why
                                                   the arch reads as a void
```

**Colour.** The official three-tone degrade — base `#67482F` → mid `#775A3F` → top `#976C35` —
applied **restrained**. You should *feel* the degrade without noticing it. Base darker than the
eye expects, top lighter; that is what makes the tower look taller than it is, which is the whole
point of the scheme (its stated purpose is to accentuate the taper).

**Material.** Painted iron is a **dielectric**: `metalness` ≈ 0.2, roughness 0.6–0.7. This one
number was the difference between v2 looking like a black armature and looking like painted
steel, and it is not negotiable.

**Light.** One key from upper-left — the draughtsman's convention, and it matches the plates'
own shading. Soft fill, hemisphere, and **ambient occlusion doing the real work**: without AO the
near and far faces of a lattice take the same value and the whole thing flattens. No coloured
lights, no rim-light tricks. Restraint.

**Four modes**, in the order they matter: **Studio** (default reading), **Blueprint** (the
drawing), **Daylight** (as built), **Illuminated** (the reward).

**Camera.** Vertical verticals, always — the standing convention for tall buildings, and the
reason the tower looks right in photographs and wrong in casual 3D. Orthographic front, side and
plan at drawing scale. Generous margins: a drawing that fills the frame edge-to-edge looks
panicked.

## 7. Restraint — what I am not going to do

- **No Paris.** No Champ de Mars, no Trocadéro, no Seine, no trees. It was your call, and the
  plates agree: the tower alone, on nothing.
- **No rivet pass.** 2.5 million rivets do not make this better; they make it noisier.
- **No photorealism chase.** No HDRI weather, no lens dirt, no depth-of-field. It is a model of a
  designed object, not a photograph of one.
- **No interior.** The caisson diaphragms at 0.80 m, the manholes, the internal ladders — real,
  documented, and invisible from outside. Cut them.
- **No animating everything.** A slow turntable and a construction sequence, both optional.
- **No infinite polish on the internals** while the silhouette is imperfect.

## 8. Done

The stopping condition is deliberately about the eye, not the checklist:

> **In every mode, at every distance, the four things that make this building recognisable — the
> faceted concave silhouette, the three platform bars, the arch void, the summit — read
> immediately and correctly. Nothing else is permitted to compromise them.**

Plus the seatbelt: the harness passes, `124.90 × 330 m`, the profile faceted on the attested
anchors, and zero phantom members between the legs.

## 9. The short version

1. **Silhouette first, flat, and look at it.** 50 % of the result, cheapest possible test.
2. **Then the three bars, the arch void, the summit.** The minimum stroke set.
3. **Then tone, then legs, then bars, then detail.** In that order — never the reverse.
4. **Derive the arch from geometry, not from a contested number.**
5. **Let uncertain inputs touch only uncertain things.**
6. **Compare to Durandelle and to the plates at every stage, and say whether it reads.**
7. **Restraint everywhere:** painted iron, one key light, AO, no ground, no rivets, no Paris.
8. **Stop when the four features read.**
