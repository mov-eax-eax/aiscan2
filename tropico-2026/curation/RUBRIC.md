# RUBRIC — how to score a TROPICO 2026 painting
Curator's instrument. Six axes from BRIEF §6, 1–10 each, 60 maximum. The brief's floor is 34/60.
This file exists so that a critique is a set of claims about the picture, not a set of tastes.

## 0. Rules of the instrument

1. **Score the PNG, never the SVG.** The source is not the painting; the file can be beautiful and the
   render dead. The curator renders independently, from the artist's own file, into curation/_tmp/.
2. **Score before reading NOTES.md or the statement.** Intent is not a defence. If the picture needs the
   paragraph to work, the paragraph is doing the painting's job.
3. **Integer scores only.** Half-points are indecision. Never score an axis you cannot point at.
4. **Every score carries a place.** The report format is "axis 2 = 6, because the shadow under the tinaco
   has no contact shadow and floats". Not "lighting feels off".
5. **Same order every time:** axis 1 → 6, then the two named tests, then the collection checks. Order is
   calibration: changing it changes the scores.
6. **Re-score the first piece after the third.** If a score moves by more than one point and the image did
   not change, the eye drifted. Say so in the critique; it is information about the critic.
7. **The score is not the product.** Three ranked fixes are the product. The score only makes the ranking
   auditable.

---

## 1. The two named tests

### T1 — The thumbnail test (gates axis 1)

**Procedure.** Render at 1600. Downscale a copy to 400 px wide, then 200, then 100. Look at each on a
screen from about one metre. Ask: *is this recognisably itself?*

- **Pass 400:** it is identifiable as *this* picture — not "the dark one", not "the still life", not "the
  pattern". You could describe it to someone in one sentence that only fits this frame.
- **Pass 200:** the value structure survives — you can still see the dominant dark and the bright event.
- **Pass 100:** it is a legible shape with a light and a dark, like a piano reduction of the painting.
- **Fail:** at 400 it reads as a texture, a pattern, a single flat mass, or a decorative border.

**Consequence.** T1 fail caps axis 1 at 4 and stops the piece: return to the silhouette pass (BRIEF §4.1).
The gallery shows these at roughly 400–600 px; more people will meet the thumbnail than the painting.

### T2 — Would a painter hang it (gates the whole piece)

**Procedure.** Imagine the piece 1.2 × 0.9 m, glazed, on a wall lit by one window, next to a photograph and
an oil painting. Answer five questions, each yes/no:

1. **Scale.** Does it have a *surface* at 1:1, or does it only work reduced? A vector tell is uniform edge
   quality: every edge the same softness, no passage that behaves differently when you get close.
2. **Touching.** Is there one passage you would stand in front of — a specular, a fold, the caustic in the
   glass, the grain of the concrete, a place where two materials meet?
3. **Decision.** Can you point at a mark that was made *against* the obvious? (The obvious edge, the
   obvious colour, the obvious crop.)
4. **Method.** Would a painter want to know how a passage was done — or can they see the radial gradient and
   stop looking? Curiosity is the sign that there is craft to be curious about.
5. **Light.** Does the picture agree with itself about where the sun is and what time it is?

**Pass: four of five.** **Fail: "poster-competent"** — everything works, nothing was seen. A poster is a
legitimate object. It is not this collection.

The two verdicts, in one line each:
- Thumbnail test: *does it exist at 400 px?*
- Painter test: *does it have a surface a painter would want to touch?*

---

## 2. Axis 1 — Composition & value structure

**Measures:** whether the eye is taken somewhere and held; whether the masses are *shapes* rather than
areas; whether the picture survives reduction.

**Tests.**
- T1.
- **Posterise to four values** and count the masses:
       magick render.png -resize 400x -colorspace Gray -posterize 4 -depth 8 p4.png
  Expect four (light wall · mid concrete · dark ground · near-black). Five is fine. More than six means no
  hierarchy; two means no picture.
- **The first-three-seconds test.** Name the first thing the eye hit, then the second, then the third. If
  that order is not the intended one, axis 1 ≤ 5. (For pattern pieces 03 and 06, "intended" may be
  "no focal point" — then the test becomes rhythm: does the eye travel and return?)
- **The cut.** Is at least one thing cut by the frame? A composition that sits entirely inside the frame
  is a postcard. (Mandated for 01; desirable everywhere.)
- **The dark has a shape.** You should be able to draw the outline of the dominant dark mass. If the dark
  is just "the background", it is a fill.
- **Middle-value disease (measure, don't guess).** Fraction of pixels between 25% and 75% grey. Each
  command prints the fraction of pixels ABOVE its threshold; subtract the second from the first:
       magick render.png -colorspace Gray -threshold 25% -format "%[fx:mean]" info:
       magick render.png -colorspace Gray -threshold 75% -format "%[fx:mean]" info:
  Above about 0.70 and the painting is all mid-tone mush; below about 0.25 and it is a two-tone poster.

**Anchors.**
- **1–2.** A scatter of similar-value shapes. No first thing. Nothing cut. The frame is a box the objects
  sit in.
- **3–4.** One focal point, surrounded by middle values; the dark is a fill; the composition is centred and
  the frame is doing no work.
- **5–6.** Three clear masses and a focal event, but the secondary mass is unresolved, or the composition
  is a *stack* — objects in a row, towers in a row — with no off-axis tension.
- **7–8.** Four masses; one dominant dark with an edge; one bright event off-centre; one element cut by the
  frame; the intended reading order is the actual reading order.
- **9–10.** The value structure *is* the argument: remove the colour and the picture still says what it is,
  and it could not be cropped anywhere else without loss.

**Instant fail:** T1 fail (cap 4). "Everything in the middle" caps at 5.
**This medium's usual failure:** objects each with a radial gradient, all the same size and darkness,
arranged in a row.

---

## 3. Axis 2 — Light & atmosphere

**Measures:** one sun, consistent physics, and air you can see.

**Tests.**
- **The direction test.** On a copy, draw the shadow direction of three separated objects. They must agree.
  Two suns is a painting of a collage.
- **Shadow is a projection, not a smudge.** Every object standing on a surface needs a tight dark contact
  shadow AND a wide soft cast shadow in perspective (the kit's two-shadow recipe is the minimum).
- **Warm/cool.** Name the place where warm light meets cool shadow, or the reverse. If the answer is
  "everywhere a little", there is none.
- **Air.** Is the empty space one flat value, or does it have a light pool, a haze, a value gradient? A
  flat wall or sky has no air in it.
- **Light events.** Count them. BRIEF §4.4 asks for two or three, placed. More than five is confetti; zero
  is a dead surface.
- **The thumb test.** Cover the brightest area: does the rest still read as lit?

**Anchors.**
- **1–2.** Shadows in different directions, or none. A global gradient standing in for light. The light
  source is drawn as a shape in the corner (a sun disc).
- **3–4.** One direction, but the shadows are smudges under objects; no contact shadow; no temperature
  difference between light and shade.
- **5–6.** Consistent direction, warm/cool present, but the air is a flat fill and each object gets the
  same single white ellipse as a highlight.
- **7–8.** One verifiable sun; contact plus cast shadows; two or three placed events including a specular
  and a transmitted or reflected light; the air has a value gradient.
- **9–10.** Light is the subject: it enters the frame as a *shape* (a blade, a pool, a caustic), the shadows
  are as designed as the objects, and the temperature tells you the hour.

**Instant fail:** two suns; a sun disc; pure white speculars on everything.
**This medium's usual failure:** the default glow — a radial white blob behind every object. That is not
light, it is a vignette.

---

## 4. Axis 3 — Material truth

**Measures:** can you identify the material by texture alone, in greyscale, at 100%?

**Tests.**
- **The four-crop test.** Four 100% greyscale crops of different materials. Name each: concrete ≠ metal ≠
  paper ≠ fruit ≠ glass ≠ plastic.
- **Edge law.** Each material has its own edge: concrete chips and goes soft with dust; metal has a hard
  specular line; paper is soft and slightly fibrous; fruit has a soft terminator and a waxy micro-specular;
  glass has a hard bright rim and a dark interior. Count how many materials share the same edge treatment.
  More than two sharing means the piece is one material pretending to be several.
- **Texture direction.** Concrete has formwork, stain, salt bloom with a direction; wood has grain; metal
  has a brush or a scratch; cloth has a weave. Is any of it directional, or is it all isotropic noise?
- **The grain trap.** One global noise overlay does not make materials. Grain is the last ten percent; the
  material lives in the shape, the edge, and the local texture.

**Anchors.**
- **1–2.** Every surface is a gradient; one noise layer; identical edges everywhere; the metal is a grey
  shape.
- **3–4.** Materials differ by colour only; in greyscale they collapse; one texture repeated on several
  objects.
- **5–6.** Two or three materials are legible, the rest are colour-coded; edge quality varies, but not
  per-material.
- **7–8.** All materials legible in greyscale at 100%; each has an edge law and a texture direction;
  speculars appear where the material puts them (concrete: none; glass: a rim; metal: a line).
- **9–10.** Materials carry time: salt bloom, a rust bleed, a scratch that follows a use, the ghost of a
  sticker. You could date the object by its surface.

**Instant fail:** a material rendered as a sphere with a highlight sticker; the same blur on everything.
**This medium's usual failure:** feTurbulence at one scale over the whole canvas. It makes a texture, not
a material.

---

## 5. Axis 4 — Trópico 2026 legibility

**Measures:** without the title, is this that country in that year — and is it *lived in*?

**Tests.**
- **The three objects.** Name the three most specific things in the frame. They must come from the canon
  (BRIEF §1) and be specific: tinaco, machete, solar charge controller, monobloc chair, azulejo, stamped
  form — not table, chair, wall, sky.
- **The 2026 test.** Does anything belong to another decade in a way that is not about *wear*? Sci-fi is a
  fail. A 1990s TV that is old is fine. A floating drone is a fail unless it is a real 2026 object doing a
  real 2026 job.
- **The no-text test.** Cover every letterform: does the piece still say what it is? If text is doing the
  work, axis 4 ≤ 5 and axis 1 ≤ 6.
- **The repair test.** Is there evidence of use, maintenance, improvisation — a cable run, a patch, a
  stain, a thing fixed with wire? A place with no repairs is a render.
- **The weather test.** Is the light noon or shutter (BRIEF §1)? Golden hour, sunset, neon or "holiday
  light" is not this country. And is the heat visible — glare, bleached surfaces, air that moves?
- **The people test (when there are figures).** Working, waiting, carrying, in profile or from behind or
  small or half in shadow — and nobody looks at us.

**Anchors.**
- **1–2.** Could be anywhere. No specific object; the palette says "tropical stock photo".
- **3–4.** One specific object used as a symbol rather than as a thing (a palm, a mango). The year is
  unmarked.
- **5–6.** Plausibly a tropical place, but the place has no economy — nice weather, no systems, no
  repairs, no debt.
- **7–8.** Three or more specific objects that are *systems* (a solar controller with its cable, a tinaco
  with its overflow, a form with its stamp); evidence of use; visible heat; the year legible with no
  caption.
- **9–10.** The picture could not be set in 2006 or 2046. It contains the country's argument — sun as
  resource and debt — without stating it. It has one detail a local would recognise and a foreigner would
  not.

**Instant fail:** legible text doing the work; sci-fi; golden-hour idyll; nobody doing anything and nothing
to do.
**Usual failure:** "tropical" as a palette (green plus orange) rather than as a set of systems and
frictions.

---

## 6. Axis 5 — Craft of the medium

**Measures:** control. Every artefact below is named and checkable, at 100%, in four quadrants and four
corners.

**The artefact sweep.**
- **a. Wash seams.** Hard rectangular edges where a translucent shape's filter region ended (BRIEF §5, the
  number-one accidental artefact). Look for a straight line inside a haze.
- **b. Clipped filters.** A blur cut off at a straight edge near the border; corners that go flat where a
  glow should fade.
- **c. Banding.** Visible steps in a long gradient at 8 bits. Fix with fewer stops, a blur, or noise.
- **d. Plastic.** A gradient ellipse used as a 3D object; a perfect white oval as a specular; a highlight
  in the centre of a sphere.
- **e. Edge law.** Every edge the same blur reads as "rendered". Soft edges at 1600 should be roughly
  0.8–2 px for shapes and more for depth; and there must be some hard edges that are *meant* to be hard (a
  counter edge, a metal rim).
- **f. Moiré.** A pattern scaled by a transform, or a grid visible at 100% where it should be fine.
- **g. Grain.** Grain over the speculars and the brightest lights (it should be weakest in the light and
  strongest in the dark); grain over lettering.
- **h. Text.** Any lettering that is a font rather than drawn marks; any legible word.
- **i. Economy.** Over 500 KB, or a render over 30 s: the artist stopped looking.

**Anchors.**
- **1–2.** Visible seams, clipped glows, plastic spheres, uniform edges.
- **3–4.** No seams, but every object is a gradient with a highlight; edges uniform; grain is a global
  layer.
- **5–6.** Controlled, no glaring artefact, but the touch is generic — soft everywhere, no hard decision;
  one artefact still visible at thumbnail.
- **7–8.** No artefacts at 100%; soft and hard edges used as depth cues; grain modulated; texture local;
  file under budget.
- **9–10.** The medium is used as paint: displacement that reads as scumble, blur that reads as glaze, a
  pattern that reads as canvas — and you cannot tell where the vector ends.

**Instant fail:** a visible filter rectangle; a legible word; text set as a font.
**Note:** "clean" is not the goal, "controlled" is. A deliberate brush mark is craft; a blur rectangle you
did not see is not.

---

## 7. Axis 6 — Risk

**Measures:** a decision you can name, that could have failed, and that the picture needs.

**Tests.**
- **a.** The artist names it (NOTES/meta): one sentence — the decision, the safe alternative, what would
  have gone wrong.
- **b.** The critic verifies it is *visible* without the caption.
- **c.** **Removal test:** if you removed it, would the piece be worse — or just different? A risk that can
  be removed without loss is a flourish.
- **d.** **Risk is not noise.** An unusual colour, a weird crop, "glitch" as texture, a strange object:
  none of these count unless the piece would have failed without them.
- **e.** **Risk is not failure.** A decision that failed is an error. Score it on the axis it broke.

**Anchors.**
- **1–2.** No decision beyond "in the style". A competent illustration of the brief.
- **3–4.** One decorative liberty (a colour, a crop) that costs nothing and risks nothing.
- **5–6.** One real decision, contained to one region, with a plausible failure that was survived.
- **7–8.** A compositional or lighting decision that reorganises the picture, could have failed, and is
  visible at thumbnail.
- **9–10.** The risk is the reason the piece exists: it changes what the collection can do, and a second
  painting could be built from it.

**Instant fail:** no nameable decision; or the "risk" is a filter.
**Note:** this is where a critic earns their keep. Do not award risk for strangeness. Award it for a bet.

---

## 8. The score sheet

    | axis | score | the place in the image that justifies it | fix if ≤ 6 |
    |------|-------|------------------------------------------|------------|
    | 1 composition & value | | | |
    | 2 light & atmosphere  | | | |
    | 3 material truth      | | | |
    | 4 Trópico 2026        | | | |
    | 5 craft of the medium | | | |
    | 6 risk                | | | |
    | T1 thumbnail          | pass / fail | | |
    | T2 painter test       | /5 | | |
    | TOTAL                 | /60 | | |

**Reading the total** (the brief's floor is 34; these bands are the curator's recommendation, the Lead
decides):
- **54–60** exceptional. It should probably be the hinge of the collection.
- **46–53** strong. Ship.
- **40–45** ship if the collection needs it; one more pass would move it up a band.
- **34–39** borderline. It passes the brief's floor and would be the weakest thing on the wall.
- **28–33** revise. Do not ship as-is.
- **below 28** re-block from the composition; no amount of surface will save it.

**Collection-critical gates (recommended).** Axis 1 below 6, or axis 4 below 6, means do not ship even if
the total passes. The collection fails as a set faster than it fails as seven pieces: a beautifully made
picture that could be anywhere is worse for the argument than a clumsy picture that is unmistakably here.

---

## 9. Cross-collection checks (after each round, on the set)

- **One weather.** Name the sun's height in each piece. If three pieces are at different times of day with
  no argument for it, the collection is an anthology, not a place.
- **Palette discipline.** Per BRIEF §1: one accent only, hot orange OR cyan, never both in one frame.
  Across the set, count orange versus cyan. If six of seven are orange, the accent has become a filter; if
  cyan only appears in 05, the accent has become a typology rather than a palette.
- **No repeated composition.** List each piece's composition type (still life on a counter / cropped
  bodies at the sea / frontal façade / figure in a dark room / grid / panorama). Two pieces of the same
  type means one must change.
- **The quote test.** The hero (07) quotes the set in its predella. Each piece must contain something
  quotable at 160 × 160 px — a *shape*, not a style.
- **The thumbnail wall.** All seven at 400 px side by side. Do they read as seven versions of one
  country? Which is the odd one out, and is that oddness the argument or an accident?
- **The missing note.** Name the canon object that appears in no piece, and the one that appears in too
  many. (A mango in all seven is fine. A machete in only 01 is a missed argument.)

---

## 10. The critique format (what the artists receive)

Per piece, in this order:

1. **What works** — one line, and it is on the "do not change" list.
2. **Scores** — six axes plus T1/T2, each with the place in the image that justifies it.
3. **Three fixes, ranked** — each with: *what* to change, *where* (region or coordinates), *why* (the
   mechanism, cited from REFS or this file), the *acceptance test* (how the artist knows it worked), and
   the *cost* (a pass, a re-block, a colour change).
4. **Do not change** — the things that are working and would be destroyed by a careless next pass.
5. **The one question** — the question the picture asks that the artist has not answered yet.

Never write "make it more atmospheric". Always write "the tinaco's shadow at (x, y) has no contact
shadow — add a tight 8 px dark at its base; acceptance: at 400 px the tank must sit ON the counter."

---

## 11. Calibration and the critic's vices

- **Score a piece you like lower than you want to,** then check the difference is defensible. If it is,
  the score stands.
- **The three vices of this project's critic**, predicted in advance:
  1. rewarding the difficulty of the technique over what the picture shows;
  2. rewarding the concept over the image (the brief is a good brief; the temptation is to grade the
     brief);
  3. flattering the artist because they are working hard — which is the worst of the three, because it is
     kind in the short run and cruel at the opening.
- **One note given to three pieces is not a note, it is a missing direction.** Escalate it to the Lead.
- **A critique that cannot be acted on is not a critique**, it is an opinion with a score attached.

---

## Worked example (hypothetical, not a real piece)

A still life, frontal, three objects, one blade of light. Scores: axis 1 = 7, axis 2 = 5, axis 3 = 4,
axis 4 = 6, axis 5 = 5, axis 6 = 3. Total 30.

Written out, that is: *"It exists at 400 px and the light blade is a real shape (1 = 7). But the shadow of
the tinaco is a smudge under it and does not agree with the blade's direction (2 = 5; place: the tinaco's
base, lower right). In greyscale the glass and the plastic fan blade are the same grey with the same
blurred edge (3 = 4). The solar controller reads as a generic black box; its cable stops at the frame
instead of continuing (4 = 6). Grain is one flat layer over everything including the speculars (5 = 5).
Nothing in the picture was a bet (6 = 3)."*

Fixes, ranked: (1) rebuild the light — one direction, contact-plus-cast shadows, the caustic from the glass
on the counter; acceptance: thumb test, three shadows converge. (2) give the glass a real material law —
hard rim, dark body, refraction, a caustic; acceptance: greyscale 100% crop names it as glass. (3) make one
risk: cut the solar controller so only half of it is in frame, and let the cable run out of the bottom
edge; acceptance: the inventory continues past us.

Note what the score does and does not do: 30 says "do not ship", and the three fixes say *what to do about
it*. The number is the least interesting part.
