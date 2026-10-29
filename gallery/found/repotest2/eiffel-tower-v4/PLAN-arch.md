# PLAN — the bottom of the tower (arch zone and 1st platform)

**Rule applied throughout: Eiffel's French text is authoritative.** Every dimension below is
quoted from §13 *« Poutres de l'arc et arcs décoratifs »* and §13's constructional
description. Where the text is silent I say so rather than filling it in.

---

## What the plan is correcting

The arch currently reads as **two curved chords with radial uprights** — a rib, but an
isolated one. It merges into the legs now (radial uprights continuing through the tympana),
but three things are missing entirely, and one thing is built wrong:

| | current model | Eiffel §13 |
|---|---|---|
| **arch beam above** | a plain girder, one wall | **POUTRES DOUBLES** — two, in the planes of the inner and outer faces |
| **arch ribs per face** | one | **DEUX** — two per face |
| **panel divisions** | every 4th arc sample | **panneaux de 3,8825 m de largeur** on the beams; radial posts on the ribs |
| **tympanum** | thin plates, sparse | **3 mm sheet cut in circular arcs**, plus volute/rosette ornament |
| **springing** | rib simply reaches the leg | extrados **dies into the arbalétriers**; intrados **detaches to a `retombée factice`** |
| **panel 1** | ordinary | **« largement évidé »** — largely hollowed out |

---

## The two elements, as documented

### A. The `poutres de l'arc` — the beams that carry the arches

> Ce sont des **poutres doubles** placées dans les plans des **faces intérieures et
> extérieures des montants** de la Tour … Leur **longueur est de 45,287 m à la base et de
> 38,250 m au sommet** : leur **hauteur est de 7,00 m en projection verticale et de 7,834 m
> suivant leur plan**. Leurs membrures comportent une **semelle de 610 × 8** assemblée par des
> cornières spéciales de **100 × 100 × 12** à angle aigu ou obtus, avec des **âmes de 330 × 6**
> placées dans les plans des faces intérieures et extérieures des arbalétriers. Ces âmes sont
> reliées par un **treillis quadruple** et de distance en distance par des montants verticaux
> formant des **panneaux de 3,8825 m de largeur**.

Key: their height **« a été déterminée uniquement par des considérations d'aspect »** — chosen
for appearance, not strength. So this is a *visual* element and getting its depth right matters.

### B. The decorative arcs

> Les **arcs décoratifs** … **au nombre de deux sur chaque face**, sont constitués par **deux
> membrures cintrées en caisson de 600 mm de hauteur, dont l'écartement intérieur est de
> 2,72 m**. L'intervalle entre ces deux membrures est divisé en panneaux par des **montants de
> 400 mm de largeur, dirigés suivant des rayons**, lesquels **se prolongent à travers les
> tympans jusqu'aux arbalétriers et aux poutres de l'arc**.

And the governing shape:

> **Ces arcs décoratifs, considérés dans le plan des montants, sont des cercles.**

8 curved ribs in plan — **2 per face × 4 faces** = **four decorative arches, each doubled**.
The two on one face are **entretoisés dans le sens vertical sur trois points** : at their
crown and at the tympanum springings.

### C. The connection geometry — this is what makes it "merged"

> Leurs **membrures inférieures** sont à une hauteur telle que les arcs décoratifs
> s'inscrivent dans le **trapèze** formé par ces poutres et les deux montants.

> La membrure d'**extrados** de l'arc décoratif, **tangente au sommet à la membrure inférieure
> de la poutre de l'arc**, vient s'amortir contre les arbalétriers **un peu au-dessous de
> l'entretoise horizontale du panneau 3**.

> La membrure d'**intrados**, **tangente à l'arbalétrier à la base du panneau 2**, se détache
> de celui-ci et vient se terminer sur une **retombée factice** reliée au soubassement général
> de la pile.

> Dans la moitié inférieure du panneau 1, elle est reliée à l'arcade par un **léger treillis**.

So: the arches **inscribe in a trapezoid** bounded by the arch beams above and the two uprights
at the sides. The extrados is tangent to the beam's lower chord at the crown and dies into the
leg chords; the intrados springs off the leg lower down and terminates on a decorative block.

---

## Phases, in build order

### Phase 1 — the `poutres de l'arc` (fixes the element above the arch)
1. Rebuild the 1st-platform girder as **POUTRES DOUBLES** — two parallel girders in the planes
   of the inner and outer faces of the uprights, joined by vertical braces and upper/lower
   horizontal bracing.
2. Depth **7.834 m** in their own plane (**7.00 m** vertical projection) — not the 7.53 m
   currently used.
3. Chords: **semelle 610 × 8** with **100 × 100 × 12** angles. Webs **330 × 6**.
4. **Treillis quadruple** between the webs (already built) with vertical uprights at
   **3.8825 m** panel pitch — currently the pitch is arbitrary.
5. Length **45.287 m at the base / 38.250 m at the top** — a check on the span.

### Phase 2 — the two decorative arcs per face
6. Build **TWO** ribs per face, not one. Between them, vertical bracing at **three points**:
   the crown and the two tympanum springings.
7. Each rib: two curved box chords **600 mm**, clear gap **2.72 m**, radial uprights **400 mm**
   — already built; extend to two ribs.
8. Continue the radial uprights **through the tympana to the arbalétriers and the beams** —
   partially built; must reach all the way.

### Phase 3 — the geometry that merges the arch
9. Anchor the **extrados** so it is **tangent at the crown to the beam's lower chord**, and
   carry it until it **dies into the leg chords just below panel 3's horizontal brace**.
10. Anchor the **intrados tangent to the leg at the base of panel 2**, then have it **detach
    and terminate on a `retombée factice`** — a modelled springing block tied to the masonry.
11. Connect the intrados to the arcade in the **lower half of panel 1** by a **light lattice**.

### Phase 4 — the ornament
12. **3 mm sheet cut in circular arcs** across each tympanum panel — the plates that give the
    band its solid look. Modelled at ~0.05 m so they survive at 6.43 px/m.
13. **Cornières et volutes avec macarons en fonte** — angle-iron volutes with cast-iron
    rosettes, per panel. This is the detail that makes the band read as *ornamented metal*
    rather than a plain ribbon.

### Phase 5 — the panels around it
14. **Panel 1 largely hollowed out** (« largement évidés ») — it should read OPEN, and the
    contrast with the quadruple-lattice beams is what the `masques` exist to soften.
15. The **`masques`** on those panels.
16. The **frise décorative** and the 72 names on the 1st platform.

---

## Verification added alongside

Each phase gets an assertion, so the same class of error cannot recur:

- `poutre de l'arc depth == 7.834 m in plane` (not 7.53)
- `panel pitch == 3.8825 m`
- `two ribs per face` (a count, not a dimension)
- `extrados crown tangent to the beam's lower chord` — a distance check at the crown
- `extrados terminates within 0.5 m of the leg chord at panel 3's brace`
- `intrados terminates on the retombée factice`
- `radial upright count spans tympanum to beam` — none should stop mid-gap

## What this plan does NOT claim

- The **radial pitch on the ribs** is **NOT FOUND** in the source — only the beams' 3.8825 m
  panel pitch is documented. The ribs' own pitch stays a stated assumption.
- The **shape of the `retombée factice`** is not described. It must be modelled from
  Plate XI (f57, *« Ensembles et détails des ARCS DÉCORATIFS »*) — **not invented.**
- The **volute/rosette motif** needs Plate XI, figure 18 and 22–25.

---

# GROUNDED — Plate XI (f57), read directly

`research/sources/gallica/PL-XI-f57-arcs.jpg`, 5949×8774.
Title: **« ARCS, POUTRES DES ARCS ET POUTRES DU 1er ÉTAGE »**

## The three unknowns are no longer unknown

**1. The radius is printed.**
> **« Rayon 36,4064 »** — Fig. 15

An **attested radius of 36.4064 m**, on the detail plate. It sits between the extrados and
intrados of a 3.92 m-deep rib, so it is most likely the **rib's mid-line radius**. That must
be reconciled against the documented **74.24 m span** before use — `2 × 36.4064 = 72.81 m`
is not 74.24, so one of the two is a different curve. **Reconcile before modelling.**

**2. The volutes are cast iron.**
> **« Volute en fonte »** — Fig. 16 (cross-section)

**3. The ornament is fully drawn** — Fig. 15, *« Panneau au-dessus des faces 1 et 4 »*, at
**1:50**. It shows two **volutes** as spiral scrolls with these sections labelled:

| member | section |
|---|---|
| Corn. (angle) | **100 × 100 × 12** |
| Corn. | **60 × 60 × 6** |
| Corn. | **100 × 45 × 6** *(unequal)* |
| Corn. | **100 × 45 × 8** *(unequal)* |
| Corn. | **70 × 70 × 7** |
| Entretoise | **120 × 6** |
| **montant** (radial upright) | **0,40** ✓ *confirms the 400 mm from §13* |

## And a correction to the arch beam

Fig. 16's cross-section gives the `poutre de l'arc` chords as:

| member | section |
|---|---|
| **Semelle** | **720 × 7** |
| **Âme** | **600 × 7** |
| **Âme** | **160 × 7** |

**The semelle is 720 × 7, not the 610 × 8 quoted in the *Texte*.** Two attested sources
disagree. Per the project rule the *Texte* was taken first, but **the plate is the drawing of
record for a section** — resolve before use rather than picking one.

## Additional figures now identified on the plate

| figure | content |
|---|---|
| Fig. 15 | Panneau au-dessus des faces 1 et 4 — **the ornament, 1:50** |
| Fig. 16 | Cross-section — volute en fonte, semelle/âmes |
| **Fig. 17** | **« Assemblage des abouts des arcs »** — the arch springing ends |
| Fig. 18 | Panneau non décoré des faces 2 et 3 |
| Fig. 19 / 20 | Élévation de la poutre de l'arc, Face 1 / Face 2 |
| **Fig. 21** | Coupe transversale devant un entretoisement vertical |
| Fig. 22 / 23 | Contreventement inférieur / supérieur des poutres de l'arc |
| **Fig. 24 / 25** | **Entretoise entre les montants 1 des arcs décoratifs** — the three-point bracing |
| Fig. 26 / 27 | Partie K de l'arc inférieur |
| **Fig. 28** | **Détail du grand arc — nœud** |
| Fig. 57 / 59 | Contreventement inférieur / supérieur des poutres décoratives |

**Fig. 17 and Fig. 28 are where the `retombée factice` and the extrados/leg junction will be
— the connection geometry the plan's Phase 3 depends on. Not yet read.**

## A note on Fig. 17's own annotation

> *« Nota — Ce treillis n'existe qu'en re[nd]… des fac[es]… »*

The trellis exists **only on certain faces** — which is consistent with §13's *« Les panneaux
restent sans aucune décoration sur les autres faces »*. **Which faces carry it is not yet
read.** Do not assume symmetry.

