# Sources, provenance and credits

## 1. Reference bow — published specifications

The build target is the **Mathews LIFT 33 (2024)**, chosen because it is a current
flagship with a fully modular cam system and complete published numbers.

| value | source |
|---|---|
| ATA 33 in, brace 6.5 in, DL 26-31.5 in, peak 45-80 lb, let-off 80/85 %, IBO 343 fps, mass 4.26 lb | Compound Bow Choice, *Mathews Lift 33 Specifications* — https://compoundbowchoice.com/brands/mathews/lift-33/specs/ |
| SwitchWeight-X cam, RPD limbs, MATCH strings, skeletonised riser, 10 lb down-adjust | Abbey Archery, *Mathews LIFT 33* — https://www.abbeyarchery.com.au/p/MILA332024/Mathews+LIFT+33.html |
| Crosscentric cam + Advanced Vectoring System (offset vectoring discs), wide split limbs, closed-end limb pockets | Bowhunter, *Bow Review: Mathews Vertix* — https://www.bowhunter.com/editorial/bow-review-mathews-vertix/368523 |

## 2. Mechanics and standards

| topic | source |
|---|---|
| Eccentric topologies (single / hybrid / dual / binary / quad / hinged), let-off, parallel limbs, draw stops | Wikipedia, *Compound bow* — https://en.wikipedia.org/wiki/Compound_bow |
| AMO draw length (+1.75 in), ATA speed (350 gr, 70 lb, 30 in), IBO speed (5 gr/lb), 5 gr/lb minimum arrow, S.E./P.D.F., efficiency | Wikipedia, *Compound bow* (Specifications section) |
| Cam rotation vs. lever arm and cable take-up (used for the 210 deg draw cycle) | Commons, *Compound Cams Auszug Weg & Hebel* (see below) |

## 3. Reference photographs

All photos are from **Wikimedia Commons** and were resized through the
`Special:FilePath` thumbnail service. They are kept here as reference only.
The CC BY-SA licences require attribution and share-alike if these files are
redistributed; the project's own code and renders are separate works.

| local file | Commons file | author | licence |
|---|---|---|---|
| `commons_bow_full.jpg` | Compound Bow full.jpg | Ewok Slayer | CC BY-SA 3.0 |
| `commons_mathews_trx38_g2.jpg` | Compound Bow Mathews TRX 38 G2.jpg | Wacky1976 | CC BY-SA 4.0 |
| `commons_hoyt_double_cam.jpg` | HoytCompoundBOW.JPG | StromBer | CC BY-SA 3.0 |
| `commons_pse_talja.jpg` | Compound bow -Taljajousi PSE Archery.jpg | Jukka Wallin | CC BY-SA 4.0 |
| `commons_cam_closeup.jpg` | Compound Bow Pulley.jpg | Ewok Slayer | CC BY-SA 3.0 |
| `commons_cam_forcedraw.jpg` | Compound Cams Auszug Weg&Hebel.jpg | StromBer | CC BY-SA 3.0 |
| `commons_wheel_cam.jpg` | MissionWheelCam2.JPG | StromBer | CC BY-SA 3.0 |
| `commons_idler_stopper.jpg` | Mission Idler&Stopper.JPG | StromBer | CC BY-SA 3.0 |
| `commons_worldcup_draw.jpg` | 2013 FITA Archery World Cup - Men's individual compound - Semifinal - 23.jpg | Pierre-Yves Beaudouin | CC BY-SA 3.0 |

Full Commons pages are one click away at
`https://commons.wikimedia.org/wiki/File:<name>`.

### What each photo is for

* **commons_cam_forcedraw.jpg** — the single most useful mechanism reference: one
  cam photographed at 0, 45, 90, 135 and ~210 degrees, annotated with lever arms and
  the cable take-up length. This is where the 210 deg draw cycle and the
  "effective radius falls toward the wall" behaviour comes from.
* **commons_idler_stopper.jpg** — idler wheel, string stop and the Y-cable split.
* **commons_mathews_trx38_g2.jpg** — a modern target Mathews seen nearly side-on:
  riser bridges, sight window, rest, deep sight and cable geometry.
* **commons_worldcup_draw.jpg** — a compound archer at full draw / anchor.
* **commons_bow_full.jpg**, **commons_hoyt_double_cam.jpg**,
  **commons_pse_talja.jpg** — whole-bow silhouettes for proportions.
* **commons_cam_closeup.jpg**, **commons_wheel_cam.jpg** — cam / wheel detail.

## 4. Provenance codes used in the data files

* `published` — manufacturer or retailer spec for the reference model.
* `standard` — defined by AMO / ATA / IBO.
* `classTypical` — typical of the modern 30-34 in ATA class, **not** model-specific;
  replace with CAD or a measurement before the final build.
* `derived` — computed from other values by the formula given.

The dimension table (`refs/dimensions.json`) marks every class-typical row with a
`confidence` and, where useful, a plausible `band`, so the verification step can
reject a model that drifts out of the real-world range.
