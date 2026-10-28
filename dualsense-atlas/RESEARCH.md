# DualSense (CFI-ZCT1W) — Ontology-Grade Research Brief

**Subject lock:** Sony PlayStation 5 **DualSense wireless controller**, standard model **CFI-ZCT1W** (and its hardware revisions).
**Explicitly out of scope / not conflated:** DualSense **Edge** (CFI-ZCP1, 2023) — a different product with replaceable stick modules, back paddles, trigger stops and a different FCC ID. Any figure below that could differ on Edge is flagged.
**Compiled:** 2026-10-17. **Author:** researcher (DSH agent), task-1.
**Source workspace:** `F:\repo-aiscan2\dualsense-atlas`. The abandoned `F:\repo-aiscan2\ps5-dualsense` project was not read, used or written.

## Confidence scheme (applies to every figure in this document)

| Tag | Meaning |
|---|---|
| **V** | **VERIFIED** — stated by a primary/regulatory/teardown source; URL given in the figure row or in §14. |
| **E** | **ESTIMATED** — not published by Sony; derived in this brief (photogrammetry, parts listings, or engineering inference from teardown imagery). Error band stated. |
| **U** | **UNKNOWN** — no public figure exists / could not be established from accessible sources. Not silently guessed. |

Photogrammetric estimates (tag **E‑PH**) come from a straight-on, white-background product photograph, calibrated to the published 160 mm overall width (22.39 px/mm at source resolution 3840 × 2778; Wikimedia Commons "front" image, §13). Systematic error ≈ ±4 % (perspective, slight camera tilt), random error ≈ ±1 mm on features ≥ 10 mm; smaller features ±0.5 mm. They are good enough to build an atlas, not to machine a part.

### Coordinate system used throughout
Right-handed, millimetres, **front elevation** (face toward viewer):
* **x** — lateral, **+ right**, origin at the controller's vertical centreline.
* **y** — **downward from the controller's top edge** (the top of the touchpad bezel), because the top edge is the only unambiguous datum on the object.
* **z** — out of the face toward the user (thickness axis).
Placements below are given as (`x`, `y below top edge`). Where a placement is photo-derived it is **E‑PH**.

---

## 1. Identity

| Attribute | Value | Conf. | Source |
|---|---|---|---|
| Product | DualSense wireless controller (PS5) | V | Sony product page; Wikipedia |
| Standard model number | **CFI-ZCT1W** | V | Rear label (§13 image), iFixit device page |
| Hardware revisions | CFI-ZCT1W (base), **CFI-ZCT1WA** (A revision, different internal design/FCC ID suffix) | V | iFixit battery guide 142053 ("FCC ID ending in 1" vs "ending in A"); iFixit device page |
| Mainboard revisions | **BDM-010 / -020 / -030 / -040 / -050** (V1–V5); serial number's 2nd digit = version | V | iFixit device page |
| Retail SKU suffixes | Region/bundle suffixes appended to the base model (e.g. `CFI-ZCT1WZDX`, `CFI-ZCT1W10X` seen in retail listings) | E | Retail listings (Croma) |
| Manufacturer | Sony Interactive Entertainment Inc., 1-7-1 Konan, Minato-ku, Tokyo 108-0075, Japan | V | Rear label |
| Country of manufacture | **Made in China** | V | Rear label |
| Announced | 2020-04-07 | V | Wikipedia |
| Release | 2020-11-12 (AU/JP/KR/NA/NZ), 2020-11-19 (rest of world); INA 2021-01-22, IND 2021-02-02, CHN 2021-05-15 | V | Wikipedia |
| Colours | Arctic White (launch) / black core; the calibration image in §13 is a **Midnight Black** unit (same geometry) | V | Sony product page; Wikipedia; Commons image |
| Successor to | DualShock 4 (CUH-ZCT2) | V | Wikipedia |
| Simultaneous controllers per console | up to 4 | V | Sony support (pairing page) |
| Bluetooth pairings stored | up to 4 device slots | V | Sony support (pairing page) |

### 1.1 Regulatory identifiers

| Identifier | Value | Conf. | Source |
|---|---|---|---|
| **FCC ID (launch)** | **AK8CFIZCT1** | V | fccid.io/AK8CFIZCT1; iFixit device page |
| FCC ID (later revisions) | **AK8CFIZCT1A** (A/CFI‑ZCT1WA), **AK8CFIZCT1B** (seen on a 2023+ unit's rear label) | V | iFixit device page; rear-label photo (§13) |
| Grantee code | AK8 (Sony Group Corporation / Sony Interactive Entertainment) | V | fccid.io |
| FCC product code | CFIZCT1 | V | fccid.io |
| FCC equipment class | DSS — Part 15 Spread Spectrum Transmitter ("Wireless Controller") | V | fccid.io |
| FCC operating band | **2402–2480 MHz** (Bluetooth) | V | fccid.io |
| FCC filing date / final action | 2020-04-17 | V | fccid.io |
| FCC test firm | UL Japan, Inc. | V | fccid.io |
| FCC exhibits | Internal photos, block diagram, schematics, theory of operation, **antenna specification** (last four confidential/metadata-only) | V | fccid.io |
| **IC ID** | **409B-CFIZCT1** (revision: 409B-CFIZCT1B) | V | iFixit device page; rear label |
| Japan MIC / technical conformance | C-29341 mark | V | Rear label |
| Other marks on label | CE, UKCA, EAC, NOM, ANATEL 08316-20-06223, IFT S2SOCF23-19666, CONATEL PY 2023-05-I-0322, Energy Verified, WEEE | V | Rear label |
| Serial format | 17 characters, starts with a letter (E/F/G…), 2nd digit = hardware version 1–5 | V | iFixit device page |

### 1.2 Power & radio

| Attribute | Value | Conf. | Source |
|---|---|---|---|
| Battery model | **LIP1708** (Li-ion pouch, service part) | V* | iFixit part listing / parts suppliers; battery label photos in teardowns |
| Battery capacity | **1560 mAh** | V | Wikipedia; Sony (via Wikipedia) |
| Battery nominal voltage | **3.65 V** (Sony/Wikipedia) — vendors commonly print **3.7 V** | V | Wikipedia; parts listings |
| Battery energy | **≈ 5.7 Wh** (1560 mAh × 3.65 V = 5.69 Wh) — derived, not a Sony figure | E | arithmetic |
| Battery construction | Single-cell Li-ion pouch in a screwed bracket; 2-wire lead + connector (red/white) to main PCB | V | iFixit battery guide 142053; motherboard guide 154744 |
| Charging input | **5 V ⎓ 1500 mA** (printed on rear label) | V | Rear label |
| Charging interfaces | USB-C (charge + data), **copper/gold charging pins** on bottom edge for the charging dock | V | Rear label; Wikipedia; front photo |
| Radio | **Bluetooth 5.1** (2.402–2.480 GHz) | V | Wikipedia; FCC filing |
| Wired link | USB-C (data + power); USB host-powered | V | Wikipedia; Sony product page |
| Audio jack | **3.5 mm TRRS (CTIA)** stereo headset jack | V | Wikipedia |
| Charging time / runtime | not published consistently; runtime varies with haptics/LED use | U | — |

\* The *model number* LIP1708 is a service-part designation: it is printed on the cell and used by iFixit/parts sellers, but Sony does not print it on the public spec sheet. Capacity/voltage are Sony-published.

---

## 2. Envelope and axis resolution

**Sony's published envelope: 160 × 66 × 106 mm (widest × thickest × tallest), 280 g.**

The three axes are commonly mislabelled, so they are resolved here against the actual object geometry and a calibrated front elevation.

| Figure | Value | Conf. | Notes |
|---|---|---|---|
| Overall **width** (x, across grips, widest point) | **160 mm** | V | Sony/Wikipedia spec |
| Overall **thickness** (z, front face to rear of grips; the axis Sony calls "height") | **66 mm** | V | Sony/Wikipedia spec; consistent with trigger bulge + fat grips |
| Overall **front-elevation vertical extent** (y, top edge → bottom of grips; the axis Sony calls "depth") | **106 mm** | V | Sony/Wikipedia spec; **photo check:** silhouette 2505 px = 111.9 mm when the floor shadow is included, 106 ± 2 mm when the shadow is excluded (bbox top y=153, true grip bottom ≈ y=2500 at 22.39 px/mm) |
| Weight | **280 g** (9.88 oz) | V | Sony/Wikipedia spec |
| Largest planar outline | 160 × 106 mm footprint when laid face-up | E | derived |
| Widest point of the body | grip bulge, at y ≈ 80 mm below top edge (photo: widest row at y≈1935 px) | E‑PH | — |

**Axis resolution (important for the atlas):**
* **160 mm = x = width** — left grip outer face to right grip outer face.
* **66 mm = z = thickness** — front of the touchpad/triggers to the back of the palm grips. Sony's spec sheet calls this axis "height"; physically it is the front-to-back thickness.
* **106 mm = y = vertical extent in front elevation** — top of the touchpad bezel to the bottom tips of the grips. Sony's spec sheet calls this axis "depth"; physically it is how "tall" the controller is when viewed face-on.
* A 4th dimension, the **diagonal depth of the splayed grips** (front-to-back span measured across the grip ends when lying flat), is **U** and is not the 106 mm figure.

---

## 3. Surface layout — front elevation map

All placements **E‑PH** unless noted. Values are (`x` mm from centreline, `y` mm below top edge).

| Feature | Centre position | Extent (mm) | Conf. |
|---|---|---|---|
| Touchpad (active capacitive area) | (≈ −1, 14.5) | **≈ 61 × 27** (60.6 × 26.9 measured) | E‑PH |
| Touchpad bezel / opening | (≈ −1, 14.5) | ≈ 64 × 29 | E‑PH |
| Left analog stick centre | (−25.2, 41.2) | cap Ø **≈ 19**; well recess Ø ≈ 26 | E‑PH |
| Right analog stick centre | (+25.2, 41.2) | cap Ø **≈ 19**; well recess Ø ≈ 26 | E‑PH |
| Stick centre-to-centre spacing | — | **≈ 50.4** | E‑PH |
| Face-button diamond centre (△○✕□) | (+47.7, 23.3) | cluster ≈ 23 × 23 | E‑PH |
| D-pad centre | (−50.8, 23.2) | cluster ≈ 26 × 26 | E‑PH |
| Create button | (−39, ≈ 7) | pill ≈ 9 × 4 | E‑PH |
| Options button | (+35, ≈ 3–7) | pill ≈ 9 × 4 | E‑PH |
| PS button | (≈ +1.5, 44.1) | Ø ≈ 15 (logo glyph 13.8 × 6.5) | E‑PH |
| Mute button | (≈ −1, 53.6) | **8.3 × 2.5** pill | E‑PH |
| Speaker grille | (≈ 0, 33) | 16 × 3.6; 2 rows (5 + 4 holes), hole Ø ≈ 1.3, pitch ≈ 4 | E‑PH |
| Player-LED diffuser strip (5 LEDs) | (≈ 0, 29–31) | ≈ 45 × 2 | E‑PH |
| Light-bar strip, left | (−29 to −26, 2–24) | ≈ 22 long × 2.5–3 wide | E‑PH |
| Light-bar strip, right | (+26 to +29, 2–24) | ≈ 22 long × 2.5–3 wide | E‑PH |
| L1 / R1 bumpers | shoulders, above triggers | ≈ 28 × 9 (E) | E |
| L2 / R2 triggers | shoulders, outboard | paddle ≈ 22 × 14 (E) | E |

**Notes on the photo-derived placements.** The Create/Options pair is not perfectly symmetric in the photograph (Create reads lower than Options) because the camera is not perfectly normal to the face; treat their **lateral** values (±35–39 mm) as reliable and their **vertical** values as "upper 10 mm of the face", ±3 mm. The PS/mute pair does validate the centreline: both land within ±1.5 mm of x = 0, which is the reason the calibration is trusted to ≈ 4 %.

---

## 4. Controls — exact/estimated dimensions

### 4.1 Touchpad

| Attribute | Value | Conf. |
|---|---|---|
| Type | **2-point capacitive touchpad with a mechanical click** (the click is itself an input) | V (Wikipedia) |
| Active area | **≈ 61 × 27 mm** (measured 60.6 × 26.9) | E‑PH, ±2 mm |
| Aspect ratio | ≈ 2.25 : 1 | E‑PH |
| Position | centred on the face, top edge of the pad ≈ 1–2 mm below the controller's top edge | E‑PH |
| Travel of click | not published; feels ≈ 0.3–0.5 mm | U/E |
| Surface | slightly textured, low-gloss grey plate (see §8) | V (photo) |
| Light bar | two diffuser strips flanking the pad, see §9 | V (Wikipedia "light bar moved to horizontal edges of the touchpad") |

Sony does not publish touchpad dimensions; the figure above is the only quantitative route available without destructive measurement.

### 4.2 Analog sticks

| Attribute | Value | Conf. |
|---|---|---|
| Quantity / type | 2 × spring-centred 2-axis analog sticks, **same stick modules as DualShock 4** | V (TronicsFix via Engadget) |
| Cap diameter (top surface, textured ring OD) | **≈ 19 mm** (18.9 measured) | E‑PH |
| Cap height above bezel | ≈ 6–7 mm at rest | E‑PH |
| Stick well / recess diameter | ≈ 26 mm | E‑PH |
| Centre-to-centre spacing | **≈ 50.4 mm** | E‑PH |
| Lateral position | ±25.2 mm from centreline | E‑PH |
| Longitudinal position | 41.2 mm below top edge | E‑PH |
| Mechanical travel (cap displacement at extremes) | **≈ 8–9 mm** total (±4–4.5 mm) | E (not published; DS4-class gimbal) |
| Electrical resolution | not published for the DualSense; the PS5 reports 8-bit axes | U |
| Cap material | textured rubber/TPE over a hard plastic hub | E (visual) |
| Click (L3/R3) | yes, full-travel dome switch under the gimbal | V (13 digital buttons list, Wikipedia) |
| Known failure mode | stick drift; class action filed | V (Wikipedia) |

### 4.3 Face buttons (△ ○ ✕ □)

| Attribute | Value | Conf. |
|---|---|---|
| Quantity | 4, monochrome (first standard PS controller with non-coloured action buttons) | V (Wikipedia) |
| Cap (dome) diameter | **≈ 10 mm** (measured 9.8) | E‑PH |
| Seat/recess diameter | ≈ 12 mm | E‑PH |
| Centre-to-centre spacing (adjacent buttons) | **≈ 16 mm** | E‑PH |
| Diamond width × height | ≈ 23 × 23 mm | E‑PH |
| Cap construction | clear/smoke translucent plastic cap over a printed white symbol, seated on a conductive-rubber pad | E (image) / V (iFixit trigger teardown: "按键导电橡胶" conductive rubber) |
| Actuation type | membrane/conductive-rubber dome, digital | V (iFixit trigger teardown) |
| Travel | not published; ≈ 0.8–1.2 mm | U/E |
| Force | not published | U |

### 4.4 D-pad

| Attribute | Value | Conf. |
|---|---|---|
| Type | **digital** directional buttons, 4 separate caps in a cross (not a rocking disc) | V (Wikipedia "Digital directional buttons") |
| Individual cap size | ≈ 9–10 mm across | E‑PH |
| Overall span | **≈ 26 × 26 mm** | E‑PH |
| Centre position | (−50.8, 23.2) | E‑PH |
| Construction / travel / force | conductive rubber, ≈ 0.8 mm travel, force U | E/U |

### 4.5 Create / Options / PS / Mute

| Control | Type | Size (mm) | Position | Conf. |
|---|---|---|---|---|
| **Create** | digital pill button with 3-line icon; replaces DualShock 4 "Share" | ≈ 9 × 4 pill | (−39, ≈7) | V (exists/function), E‑PH (size/pos) |
| **Options** | digital pill button with 3-line icon | ≈ 9 × 4 pill | (+35, ≈3–7) | V/E‑PH |
| **PS** | digital button with PS monogram; wakes/pairs, opens home | Ø ≈ 15 button; glyph 13.8 × 6.5 | (+1.5, 44.1) | V/E‑PH |
| **Mute** | digital mic-mute button (hardware mute), **with its own LED** | **8.3 × 2.5** pill | (−1, 53.6) | V (Sony product page: dedicated mute button), E‑PH (size) |

Sony's "13 digital buttons" = the four face buttons (△○✕□) + L1/R1/L3/R3 + PS + Create + Options + touchpad click + mute (Wikipedia).

### 4.6 Bumpers L1 / R1

| Attribute | Value | Conf. |
|---|---|---|
| Type | shoulder buttons, hinged lever, conductive-rubber contact | V (iFixit trigger teardown) |
| Approx. size | ≈ 28 × 9 mm visible cap | E |
| Mounting | clipped into the trigger assembly / midframe; popped out with a spudger from the L1–L2 gap | V (iFixit guides) |
| Travel / force | U | U |

### 4.7 Adaptive triggers L2 / R2

| Attribute | Value | Conf. |
|---|---|---|
| Official name | "Adaptive Triggers" | V (Sony product page) |
| Sensing | analog, position-sensed (trigger potentiometer/encoder; full analog range reported to the console) | V (analog triggers, Wikipedia) |
| Base actuation | conventional spring-return trigger + conductive-rubber/contact for the digital threshold | V (iFixit trigger teardown) |
| Adaptive hardware | **one small DC rotary motor per trigger** driving a multi-stage **gear train** that presses a **stopper/lever into the trigger's rotation path** to create programmable resistance | V (Wikipedia: "force feedback mechanism provided by two DC rotary motors"; Engadget/TronicsFix: "several gears … to change its resistance") |
| Gear train detail | motor pinion → **worm/spur reduction → cam/rack** acting on the trigger lever; a return spring restores the trigger; the module is a self-contained, removable **trigger assembly** per side | V (teardown imagery, iFixit trigger teardown: 2 screws fix each assembly to the midframe; 3+1 screws open it) / E (exact gear type naming — "worm gear" is the common teardown description, not a Sony statement) |
| Trigger face travel | **≈ 10–12 mm at the fingertip; ≈ 25–35° rotation** | E (not published) |
| Maximum resisting force | **U** — no manufacturer or instrumented public figure. Do **not** quote newtons. | U |
| Trigger stop / range setting | none on the standard model (that is an **Edge** feature) | V (Wikipedia: Edge adds adjustable trigger lengths) |
| Maintenance | L1/R1 and L2/R2 button films are replaceable; trigger module removable after 2 screws per side | V (iFixit trigger teardown 158397) |

---

## 5. Haptics subsystem

| Attribute | Value | Conf. |
|---|---|---|
| Actuator type | **two voice-coil (linear) actuators**, one in each palm grip, replacing traditional eccentric-mass rumble motors | V (Wikipedia: "vibrotactile haptic through voice coil actuators in the palm grips") |
| Quantity / channels | 2 (stereo/independent L/R) | V |
| Wiring | four soldered wires from main PCB to the two actuators (2 each) | V (iFixit motherboard guide 154744) |
| Drive | console/PC streams haptic (vibrotactile) samples; the controller renders them on the voice coils | V (Sony: "dual actuators which replace traditional rumble motors") |
| Bandwidth / frequency response | **U** — Sony markets wide-band haptics but publishes no frequency or SPL spec | U |
| Mass / dimensions of actuator | **U** (teardown imagery only; larger than DualShock 4 motors — Engadget) | U |
| Relationship to audio | haptics are a separate channel from the speaker; games address them independently | E |

---

## 6. Internals inventory

| Assembly | Qty | Location / notes | Conf. |
|---|---|---|---|
| **Voice-coil haptic actuators** | 2 | one per palm grip, soldered (4 wires) | V |
| **Trigger assemblies** (motor + gear train + lever/rack + spring + potentiometer + rubber pad) | 2 (L, R) | removable modules, 2 screws each to the midframe | V |
| **Main PCB** ("BDM-0xx": BDM-010/020/030/040/050) | 1 | carries SoC, BT radio, IMU, audio, LED drivers, connectors | V (iFixit) |
| **6-axis IMU** | 1 | 3-axis accelerometer + 3-axis gyroscope, soldered to main PCB | V (Wikipedia) |
| **Microphone array** | 2 mics | "dual-microphone array"; **upper** mic on main PCB, **lower** mic on its own flex in a frame near the battery | V (Wikipedia; iFixit motherboard guide) |
| **Speaker** | 1 | mono controller speaker, grille on the face below the touchpad | V (Sony product page; Wikipedia) |
| **Touchpad module** | 1 | 2-point capacitive plate + click switch + flex to main PCB | V |
| **Battery** (LIP1708, 1560 mAh) | 1 | in a bracket held by one 6.5 mm screw; 2-wire lead + connector | V |
| **Antenna(s)** | ≥1 | 2.4 GHz Bluetooth antenna on/near the main PCB; **exact type (PCB trace vs chip antenna) is not public** — the FCC antenna specification exhibit is confidential | U (type) / V (existence, FCC exhibit list) |
| **Light bar diffusers** | 2 strips | translucent diffusers at the left/right edges of the touchpad | V |
| **Player indicator LEDs** | 5 | strip below the touchpad; 4 player slots + off | V (Wikipedia: "five LEDs below the touchpad") |
| **Mute LED** | 1 | behind/around the mute button | E |
| **Charging contacts** | 3 pins (count E) | bottom edge, gold/copper-plated, for the charging dock | V (existence: Wikipedia "copper pins for use with charging docks"; visible in front photo) / E (count) |
| **Reset button** | 1 | **pinhole next to the SONY logo on the back**; press ≥5 s with a pin | V (Sony support) |
| **Middle trim** | 1 | black plastic trim around the sticks; **removable without tools** (friction clips) | V (Wikipedia; iFixit) |
| **Screws** | see below | Phillips (PH0) cross-head | V |

### 6.1 Fasteners (from iFixit procedural guides)

| Screw | Location | Qty | Size | Conf. |
|---|---|---|---|---|
| Rear-case screws | two at the bottom corners of the lower shell + two behind the L1/R1 buttons | **4** | **6.4–6.5 mm Phillips** | V (iFixit 182449/154744/142053) |
| Midframe-to-outer-frame screws | revealed after removing the midframe | 4 | Phillips, length not stated | V (iFixit trigger teardown 158397) |
| Trigger assembly to midframe | 2 per trigger | 4 total | Phillips | V (iFixit 158397) |
| Inside each trigger assembly | 3 + 1 (one hidden behind a flex) | 8 total | Phillips | V (iFixit 158397) |
| Battery bracket | 1 | 1 | 6.5 mm Phillips | V (iFixit 154744) |
| Main PCB to front shell | several | U (count not stated in accessible steps) | Phillips | U |

### 6.2 Assembly architecture (useful for an ontology graph)

```
Outer shell (front + rear, clipped + 4 screws)
 └─ Middle trim (tool-less clips)
 └─ Touchpad module (flex) ── light-bar diffusers L/R
 └─ Trigger assemblies L/R (2 screws each)
     └─ L1/R1 bumper (clipped)
     └─ L2/R2 trigger (metal pivot pin) + motor/gear train
 └─ Main PCB (BDM-0xx)
     ├─ 6-axis IMU
     ├─ BT radio + antenna
     ├─ upper mic, speaker, LED drivers, connectors
     └─ battery bracket (1 screw) → LIP1708 cell
 └─ Lower mic flex (frame near battery)
 └─ Voice-coil actuators L/R (4 soldered wires)
 └─ Charging contacts (bottom edge) / USB-C / 3.5 mm jack
```

---

## 7. Feature semantics (what each subsystem means)

| Feature | Semantics | Conf. |
|---|---|---|
| **Haptic feedback** | Programmable, two-channel vibrotactile feedback rendered by voice-coil actuators; replaces binary rumble with a signal that can represent textures, impacts, recoil, wind/sand, etc. Console/PC sends a haptic stream; the controller actuates. | V (Sony) |
| **Adaptive triggers** | Each trigger's resistance is a programmable function of its travel: games can make the trigger stiffen progressively (bow), stop at a wall (gun jam/brake), vibrate/ratchet, or break away suddenly. Resistance is generated mechanically by the per-trigger motor + gear train, not by a spring change. | V (Sony + teardown) |
| **Trigger effect taxonomy** | Developer-facing API categories exist (continuous resistance, sectional/zone resistance, vibration, breakaway) but Sony publishes no public normative list; the names used by engines are implementation-level. | U (public spec) / E (categories) |
| **Mute** | Hardware microphone mute — cuts capture at the hardware level, with a dedicated button and LED state; independent of game/OS software mute. | V (Sony) |
| **Mute LED** | Illuminates to show muted state; colour is amber/orange | E (colour) / V (LED exists) |
| **Light bar** | RGB LED illumination in two diffuser strips flanking the touchpad; used as player-colour indicator (up to 4 players), and addressable by games for effects. Player colour is assigned on pairing (PS button press). | V (Wikipedia; Sony support) |
| **Player indicator** | Five white LEDs below the touchpad show slot 1–4 (and off); used with PS+△/○/✕/□ combos to assign a Bluetooth slot. | V (Wikipedia; Sony support) |
| **Create** | Capture/screenshot/clip and broadcast entry point; replaces DualShock 4 "Share". | V (Sony) |
| **Motion sensing** | 6-axis: 3-axis accelerometer + 3-axis gyroscope; used for tilt/aim in supported games, and exposed to PC. | V (Wikipedia) |
| **Wired** | USB-C: data + power; haptics/adaptive triggers are guaranteed over USB (Sony notes some features "may require USB connection"). | V (Sony product page footnote) |
| **Wireless** | Bluetooth 5.1 (BT Classic HID); pairing via PS+Create held, or USB first-pair. Up to 4 stored pairings. | V (Sony support) |
| **Charging** | USB-C (5 V/1.5 A) or charging dock via bottom contacts; can charge in rest mode. | V (Sony; label) |
| **Reset** | Back pinhole button next to the SONY logo, hold ≥5 s. | V (Sony support) |
| **Audio** | Built-in speaker + dual-mic array; 3.5 mm CTIA headset jack with mic support. | V (Wikipedia; Sony) |
| **PC/mobile** | Works over USB-C or Bluetooth on Windows/macOS/Android/iOS; advanced haptics/triggers need supported software. | V (Sony product page) |

---

## 8. Materials, finishes, manufacturing

| Element | Material / finish | Conf. |
|---|---|---|
| Outer shell (white units) | two-tone: matte **white** outer shell + **black** inner core visible around sticks/buttons | V (Wikipedia: "primarily white with black facing") |
| Shell polymer | ABS or PC/ABS blend, injection moulded; lower shell carries a fine **microtexture** | E (polymer) / V (microtexture) |
| **Microtexture** | ~**40,000** tiny PlayStation-symbol shapes (△○✕□), stacked in 3D; larger symbols **0.5 mm** wide; applied to the whole lower shell for grip | V (Wikipedia, citing The Verge) |
| Midframe / trim | black plastic (glossy on Midnight Black units), tool-less clip fit | V (visual) |
| Touchpad | low-gloss grey plastic plate with fine texture; capacitive laminate under it | V (visual) |
| Face buttons | **clear/smoke translucent** caps with printed white symbols over conductive rubber | V (visual) / V (rubber pad) |
| D-pad caps | dark translucent plastic with white arrows | V (visual) |
| Stick caps | textured **rubber/TPE** ring with hard plastic dome centre | E (visual) |
| Light-bar diffusers | translucent/clear polycarbonate light guides | E (visual) |
| Chrome/metal accents | thin bright trim ring at the touchpad bezel; metal pivot pin in trigger; gold-plated charging contacts | V (trim visual; metal pin per iFixit; gold contacts) |
| Fasteners | Phillips PH0 steel screws, 6.4–6.5 mm (external) | V (iFixit) |
| Manufacturing process notes | injection-moulded shells (multi-shot for the black core on some colourways), ultrasonic/clip assembly, flex-PCB interconnects, soldered actuator leads | E |
| Assembly origin | **Made in China** (Sony contract manufacturing; specific CMs not public) | V (label) / U (CM identity) |

Colourway-specific finishes: standard colours are matte shell + gloss black core; **Chroma** family is a "chromatic" pearl/iridescent gloss; **Sterling Silver** is metallic-look; **30th Anniversary** is grey/retro. (E, marketing descriptions.)

---

## 9. Lighting system (light bar, player LEDs, mute LED)

| Light | Geometry | Position | Conf. |
|---|---|---|---|
| **Light bar** | **2 strips**, each ≈ **22 mm long × 2.5–3 mm wide**, set into the gaps between the touchpad and the shell; they follow the touchpad's trapezoidal side edges, so the strips are **not vertical** — they converge toward the top and splay at the bottom | left strip: x ≈ −29…−26, y ≈ 2–24 mm below top edge; right strip mirrored at x ≈ +26…+29 | V (existence/placement: Wikipedia "horizontal edges of the touchpad") / E‑PH (sizes) |
| Light bar colour | RGB, software-addressable; used as player colour and for in-game effects | — | V |
| **Player indicator** | 5 small LEDs behind a diffuser strip ≈ **45 × 2 mm**, immediately below the touchpad's bottom edge (y ≈ 29–31 mm below top) | centred, x ≈ 0 | V (5 LEDs) / E‑PH (strip size) |
| **Mute LED** | single LED at the mute button; amber when muted | (≈ 0, 53.6) | V (exists) / E (colour) |
| PS button illumination | none (the PS button is not backlit) | — | E |

The light bar is the DualSense's **player-colour** device; the PS5 assigns blue/red/green/magenta per player slot (slot assignment verified; exact RGB values **U**).

---

## 10. Colourways and product variants

**Standard DualSense colourways (as listed by Sony/Wikipedia):** White (a.k.a. Arctic White), Midnight Black, Cosmic Red, Nova Pink, Galactic Purple, Starlight Blue, Gray/Grey Camouflage, Cobalt Blue, Volcanic Red, Sterling Silver, Chroma Indigo, Chroma Pearl, Chroma Teal, Techno Red, Remix Green, Rhythm Blue (HYPERPOP trio), plus **Chroma** and **metallic** finishes.

**Limited/special editions (non-exhaustive):** God of War Ragnarök, Hogwarts Legacy, LeBron James, Final Fantasy XVI (JP), Marvel's Spider-Man 2, Concord (US), Astro Bot (×2), Fortnite, PlayStation 30th Anniversary, Helldivers 2, Monster Hunter Wilds (JP), The Last of Us, Death Stranding 2, Ghost of Yōtei, God of War 20th Anniversary, Grand Theft Auto VI (black/white), LISA, Marvel's Wolverine, Marathon. Colour/edition does not change the hardware envelope or internals.

| Variant | Model | Distinguish from standard DualSense | Conf. |
|---|---|---|---|
| **DualSense Edge** | **CFI-ZCP1** | replaceable stick modules, interchangeable stick caps, back paddles, adjustable trigger stops/lengths, profiles, braided cable, carry case; released 2023-01-26 (PS Direct) / 2023-02-23 (retail) | V (Wikipedia) |
| DualSense (standard) | **CFI-ZCT1W** (revisions W/WA, BDM-010…050) | — | V |
| DualSense Edge battery guide exists separately (iFixit 160751) | — | do not mix part numbers | V |

---

## 11. Measurement appendix (how the estimates were produced)

1. Reference image: Wikimedia Commons *Playstation 5 DualSense controller in Midnight Black, 2026-02-07 (front)*, 3840 × 2778 px (CC BY-SA 4.0). Straight-on, white background, minimal perspective.
2. Silhouette segmentation on luminance (threshold sweep 120–210) gave a body bbox of **3582 × 2505 px**; the bottom edge is contaminated by the floor shadow, so the true vertical extent was taken as ≈ 2500 px.
3. Scale: **160 mm / 3582 px = 22.39 px/mm**. Cross-check: PS button and mute button both land within ±1.5 mm of the horizontal centreline, and the mfrs. front-elevation height comes out at ≈ 106 mm after shadow removal — both consistent with the published 160 × 106 mm envelope.
4. Feature boundaries were found by luminance-gradient maxima (touchpad edges), strict blue-channel segmentation (light bar), local-variance texture detection (stick caps), and connected-component analysis on white symbols (button centres). Values then converted at 22.39 px/mm.
5. All E‑PH numbers carry ±4 % systematic (≈ ±2.5 mm at 60 mm) and are rounded to 0.5–1 mm. They are **not** suitable for CAD; they are suitable for an atlas/ontology and for proportion tracing.

---

## 12. Known unknowns (do not fill these silently)

1. **Adaptive-trigger maximum force** (N) and any force-vs-travel curve — no public instrumented data.
2. Trigger electrical resolution and the exact encoder type.
3. Voice-coil actuator dimensions, mass, frequency response, and rated power.
4. Antenna type/gain (FCC antenna exhibit is confidential).
5. Main SoC / BT combo / IMU / audio-codec part numbers (vary by BDM revision; no public BOM).
6. Speaker driver size, impedance, rated power.
7. Stick gimbal resolution and dead-zone (firmware-defined).
8. Touchpad click travel, actuation force, and the exact active-area boundary (Sony does not publish; the 61 × 27 mm figure is photogrammetric).
9. L1/R1 and L2/R2 exact cap dimensions and travel.
10. Battery dimensions, charge time, and rated cycle life.
11. Contract manufacturer identity.
12. Exact RGB values for each player colour and the mute LED.

---

## 13. Reference images (for tracing proportions)

All are Wikimedia Commons files with free licences; the first is the calibrated image used for §11.

| # | Use | Description page | Direct file |
|---|---|---|---|
| 1 | **Straight-on face** (primary calibration image, Midnight Black) | https://commons.wikimedia.org/wiki/File:Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(front).jpg | https://upload.wikimedia.org/wikipedia/commons/5/5b/Playstation_5_DualSense_controller_in_Midnight_Black%2C_2026-02-07_%28front%29.jpg |
| 2 | **Rear** (labels, triggers, L1/R1, reset pinhole, FCC/IC IDs) | https://commons.wikimedia.org/wiki/File:Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(rear).jpg | https://upload.wikimedia.org/wikipedia/commons/5/52/Playstation_5_DualSense_controller_in_Midnight_Black%2C_2026-02-07_%28rear%29.jpg |
| 3 | **Three-quarter white unit** (shell split, colour blocking, grip form) | https://commons.wikimedia.org/wiki/File:Playstation_DualSense_Controller.png | https://upload.wikimedia.org/wikipedia/commons/3/3c/Playstation_DualSense_Controller.png |
| 4 | **Stick close-up** (cap texture, well, PS/mute/speaker geometry) | https://commons.wikimedia.org/wiki/File:Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(detail_of_joysticks).jpg | (via Special:FilePath, same filename) |

Licensing: CC BY-SA 4.0 (files 1, 2, 4) and CC BY-SA 4.0 (file 3); attribution to the Commons uploaders is required if reused. A true orthographic **top/edge view** (trigger silhouette) is **not** present in this set — flagged as a gap if the atlas needs it.

---

## 14. Source list

Accessed 2026-10-17 unless stated.

| # | Source | URL | Type | Reliability |
|---|---|---|---|---|
| S1 | Sony — DualSense wireless controller product page (features, haptics, adaptive triggers, mute, create, speaker, mic, USB/Bluetooth, 3.5 mm) | https://www.playstation.com/en-us/accessories/dualsense-wireless-controller/ | Primary (manufacturer marketing) | High for feature semantics; no dimensions |
| S2 | Sony Support — How to connect a DualSense wireless controller (pairing, PS+Create, 4 slots, player LEDs) | https://www.playstation.com/en-us/support/hardware/dualsense-controller-support/ | Primary (manufacturer support) | High |
| S3 | Sony Support — Troubleshoot DualSense (reset pinhole next to SONY logo, hold 5 s) | https://www.playstation.com/en-ie/support/hardware/troubleshoot-dualsense/ | Primary (manufacturer support) | High |
| S4 | Wikipedia — DualShock article, §DualSense (infobox: 160 × 66 × 106 mm, 280 g, 3.65 V 1560 mAh, BT 5.1, USB-C, 3.5 mm TRRS CTIA, 6-axis, voice coils, two DC rotary motors, light bar at touchpad edges, 5 player LEDs, microtexture) | https://en.wikipedia.org/wiki/DualSense | Secondary (encyclopaedic) | High for the spec table (sourced to Sony), medium for prose |
| S5 | fccid.io — FCC ID **AK8CFIZCT1** (grantee AK8, product code CFIZCT1, 2402–2480 MHz, DSS, UL Japan, 2020-04-17, exhibit list incl. confidential antenna spec) | https://fccid.io/AK8CFIZCT1 | Primary (regulatory database mirror) | High |
| S6 | iFixit — device page "DualSense" (Model CFI-ZCT1W, **FCC ID AK8CFIZCT1**, IC 409B-CFIZCT1, BDM-010…050, serial/version scheme, CFI-ZCT1WA note) | https://www.ifixit.com/Device/DualSense | Teardown/repair community | High (from physical units) |
| S7 | iFixit — guide 182449 "Rear Case Separation" (midframe tool-less clips; 4 × 6.4–6.5 mm Phillips screws; headphone-jack clips) | https://www.ifixit.com/Guide/Rear+Case+Separation/182449 | Teardown/repair | High |
| S8 | iFixit — guide 154744 "Motherboard Removal" (battery bracket 6.5 mm screw; upper + lower mics on flexes; trigger flexes; 4 soldered actuator wires) | https://www.ifixit.com/Guide/Motherboard+Removal/154744 | Teardown/repair | High |
| S9 | iFixit — guide 158397 "PS5 Controller Trigger Teardown" (4 midframe screws; 2 screws per trigger assembly; 3+1 screws inside; metal pivot pin; conductive rubber pad; replaceable L1/R1/L2/R2 button films) | https://www.ifixit.com/Teardown/PS5+Controller+Trigger+Teardown/158397 | Teardown | High |
| S10 | iFixit — guide 142053 "Sony DualSense Controller Battery Replacement" (FCC-ID-ending-1 vs -A internal difference; battery connector) | https://www.ifixit.com/Guide/Sony+DualSense+Controller+Battery+Replacement/142053 | Teardown/repair | High |
| S11 | iFixit — part page "PlayStation DualSense Controller Battery" / LIP1708 listing | https://www.ifixit.com/Item/PlayStation_DualSense_Controller_Battery ; https://modelpartfinder.com/parts/lip1708-dualsense-battery-dualsense-lip1708-1560-mah-battery | Parts catalogue | Medium (LIP1708 model number) |
| S12 | Engadget — "DualSense teardown exposes the gears behind Sony's adaptive triggers" (gears change trigger resistance; bigger battery/mainboard/haptic motors than DS4; same sticks as DS4; dual button cushioning) | https://www.engadget.com/dualsense-teardown-070738419.html | Press, reporting the TronicsFix teardown | Medium-high |
| S13 | ScreenRant — "How PS5 Controller's Adaptive Triggers Actually Work" (trigger module removable; gears + potentiometer; vibration dampener) | https://screenrant.com/ps5-controller-trigger-playstation-teardown-dualsense-take-apart/ | Press explainer | Medium-low (some imprecise claims) |
| S14 | Wikimedia Commons — image set used for photogrammetry and reference images | see §13 | User-contributed photographs, CC BY-SA | Medium (geometry only) |

**Evidence gaps:** Sony has no public dimensioned drawing or BOM; FCC confidential exhibits (block diagram, schematics, antenna spec) are not retrievable in text form; iFixit's DualSense teardown (as opposed to the trigger teardown) is not directly citable via its API at the time of writing.

---

## 15. One-paragraph summary for downstream use

The DualSense CFI-ZCT1W is a 160 (W) × 66 (thick) × 106 mm (front-elevation tall), 280 g wireless controller announced 2020-04-07 and released 2020-11-12/19. Its identity anchors are FCC ID **AK8CFIZCT1** (revision suffixes A/B), IC **409B-CFIZCT1**, battery **LIP1708** 1560 mAh / 3.65 V (≈ 5.7 Wh), **Bluetooth 5.1** (2402–2480 MHz), USB-C at 5 V / 1.5 A, 3.5 mm CTIA jack, and mainboard revisions BDM-010…050. Its face is dominated by a ≈ 61 × 27 mm 2-point capacitive touchpad with click, flanked by two ≈ 22 mm light-bar diffuser strips, with sticks at ±25 mm and caps ≈ 19 mm, a 16 mm-pitch face-button diamond at +48 mm, a ≈ 26 mm d-pad at −51 mm, Create/Options pills, a 15 mm PS button, an 8.3 × 2.5 mm mute pill and a 5 + 4-hole speaker grille. Inside: two voice-coil haptic actuators (one per grip, 4 soldered wires), two per-trigger DC-motor + gear-train adaptive-trigger modules, a 6-axis IMU, two microphones on separate flexes, a mono speaker, a 2.4 GHz antenna (type not public), the LIP1708 pack in a 1-screw bracket, five player LEDs, three bottom charging contacts and a back reset pinhole; assembly uses 4 external 6.4–6.5 mm Phillips screws plus internal ones, and a tool-less middle trim. Every dimension that Sony does not publish is tagged E‑PH with its calibration method in §11; the trigger force, actuator specs and chip identities are explicitly **UNKNOWN**.
