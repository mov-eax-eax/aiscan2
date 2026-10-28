// ============================================================================
// DualSense Ontology Atlas - product, systems, assemblies and physical parts
// Coordinates: x mm lateral (+right), y mm down from top edge, z mm depth (+face)
// ============================================================================
(function () {
  "use strict";
  const O = window.ONTOLOGY;
  const P = window.P, L = window.L;
  const ents = O.entities;

  // ---------------------------------------------------------------- product
  ents.push({
    id: "product.dualsense", label: "DualSense Wireless Controller", cls: "cls.controller", layer: "product",
    summary: "Sony's PS5-era wireless controller: two-tone shell, two voice-coil haptic actuators, adaptive triggers, a 2-point clickable touchpad, RGB light bar and USB-C/Bluetooth 5.1 connectivity.",
    props: [
      P("Model", "CFI-ZCT1W", "", "V", "S6", "base model; CFI-ZCT1WA is the A revision"),
      P("Announced", "2020-04-07", "", "V", "S4"),
      P("Released", "2020-11-12 / 2020-11-19", "", "V", "S4", "region dependent"),
      P("Width", 160, "mm", "V", "S4", "x axis, widest point"),
      P("Front height", 106, "mm", "V", "S4", "y axis, top edge to grip tips"),
      P("Thickness", 66, "mm", "V", "S4", "z axis, face to rear of grips"),
      P("Mass", 280, "g", "V", "S4"),
      P("Price at launch", "USD 69.99 / EUR 69.99", "", "E", "S4", "regional pricing varied"),
    ],
    links: [
      L("hasPart", "sys.shell"), L("hasPart", "sys.input"), L("hasPart", "sys.trigger"),
      L("hasPart", "sys.haptics"), L("hasPart", "sys.audio"), L("hasPart", "sys.power"),
      L("hasPart", "sys.connectivity"), L("hasPart", "sys.lighting"), L("hasPart", "sys.structure"),
      L("hasPart", "sys.identity"),
      L("hasVariant", "variant.white"), L("hasVariant", "variant.midnight"), L("hasVariant", "variant.cosmic"),
      L("compatibleWith", "sys.connectivity"), L("governedBy", "std.fcc"), L("governedBy", "std.ce"),
    ],
  });

  const variants = [
    ["white", "Arctic White", "#e9ebee", "launch colourway: matte white shell, black core and black controls", "2020-11"],
    ["midnight", "Midnight Black", "#1b1d21", "all-black colourway: black shell, black core, black controls", "2021-06"],
    ["cosmic", "Cosmic Red", "#a51f39", "deep red shell with black core", "2021-06"],
    ["cobalt", "Cobalt Blue", "#20539c", "blue shell with black core", "2022-09"],
  ];
  for (const [id, label, hex, note, date] of variants) {
    ents.push({
      id: "variant." + id, label: label, cls: "cls.variant", layer: "product", parent: "product.dualsense",
      summary: label + " colourway. " + note + ".",
      props: [P("Colourway", label, "", "V", "S1"), P("Shell colour", hex, "", "E", "S13", "sampled approximation"), P("First seen", date, "", "E", "S4")],
      links: [L("variantOf", "product.dualsense"), L("hasColor", "color." + (id === "white" ? "white" : id === "midnight" ? "black" : id === "cosmic" ? "red" : "blue"))],
    });
  }
  ents.push({
    id: "product.edge", label: "DualSense Edge (sibling, not modelled)", cls: "cls.controller", layer: "product",
    summary: "Pro-grade sibling released 2023 with replaceable stick modules, back paddles, trigger stops and profiles. Deliberately excluded from this model so dimensions are never conflated.",
    props: [P("Model", "CFI-ZCP1", "", "V", "S4"), P("Released", "2023-02", "", "V", "S4"), P("Battery", "1050 mAh", "mAh", "V", "S4")],
    links: [L("variantOf", "product.dualsense")],
  });

  // ---------------------------------------------------------------- systems
  const systems = [
    ["shell", "Shell & Surfaces", "Two-tone outer shell, black core plate, touchpad, face surfaces and cosmetic details."],
    ["input", "Input & Controls", "Sticks, d-pad, face buttons, system buttons and the touch surface."],
    ["trigger", "Triggers & Shoulders", "L1/R1 bumpers and the two motorised adaptive trigger modules."],
    ["haptics", "Haptics", "Two voice-coil linear actuators, one in each palm grip."],
    ["audio", "Audio", "Mono speaker, dual-microphone array and 3.5 mm headset jack."],
    ["power", "Power", "LIP1708 lithium-ion pack, USB-C charging and dock contacts."],
    ["connectivity", "Connectivity & Compute", "Main PCB, Bluetooth 5.1 radio, antenna and the 6-axis IMU."],
    ["lighting", "Lighting", "Two RGB light-bar diffusers, five player LEDs and the mute LED."],
    ["structure", "Structure & Fasteners", "Midframe, clips, screws and the tool-less trim architecture."],
    ["identity", "Identity & Compliance", "Model numbers, regulatory IDs, labels and standards."],
  ];
  for (const [id, label, summary] of systems) {
    ents.push({
      id: "sys." + id, label: label, cls: "cls.system", layer: "system", parent: "product.dualsense",
      summary: summary,
      props: [P("Subsystem", label, "", "V", "S1")],
    });
  }

  // ---------------------------------------------------------------- assemblies
  const asms = [
    ["outer-shell", "Outer shell assembly", "sys.shell", "Front and rear shells, touchpad stack, speaker grille and cosmetic label."],
    ["core", "Black core assembly", "sys.shell", "The black core plate and the control cluster seated in it."],
    ["input", "Control assembly", "sys.input", "Sticks, d-pad, face buttons and system buttons."],
    ["trigger", "Trigger assembly (per side)", "sys.trigger", "Removable module: trigger paddle, motor, gear train, stopper, spring and position sensor."],
    ["haptics", "Haptic assembly", "sys.haptics", "Two voice-coil actuators and their wiring."],
    ["audio", "Audio assembly", "sys.audio", "Speaker, microphone array and headset jack."],
    ["power", "Power assembly", "sys.power", "Battery, bracket, USB-C port and charging contacts."],
    ["board", "Main board assembly", "sys.connectivity", "BDM-0xx main PCB, radio, antenna and IMU."],
    ["lighting", "Lighting assembly", "sys.lighting", "Light guides, player LED strip and mute LED."],
    ["fasteners", "Fasteners & frame", "sys.structure", "Midframe, external and internal screws, clips."],
  ];
  for (const [id, label, parent, summary] of asms) {
    ents.push({
      id: "asm." + id, label: label, cls: "cls.assembly", layer: "assembly", parent: parent,
      summary: summary,
      props: [P("Assembly type", label, "", "V", "S6")],
    });
  }

  // ---------------------------------------------------------------- outer shell parts
  const add = (o) => ents.push(o);

  add({
    id: "part.shell-front", label: "Front shell", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Injection-moulded upper shell: the white outer skin on launch colourways, carrying the core aperture, stick wells and button seats. The rear-facing lower half is modelled as the rear shell.",
    props: [
      P("Material", "PC/ABS blend", "", "E", "S13", "polymer not published by Sony"),
      P("Finish", "satin, fine mould texture", "", "V", "S13"),
      P("Width", 160, "mm", "V", "S4"),
      P("Front height", 106, "mm", "V", "S4"),
      P("Wall thickness", "2.0-2.5", "mm", "E", "S6", "typical for this class of shell"),
    ],
    links: [L("hasGeometry", "geo.shell-loft"), L("hasMaterial", "mat.shell-white"), L("hasFinish", "finish.satin"), L("hasPart", "part.shell-rear"), L("covers", "asm.board"), L("hasDimension", "dim.width"), L("hasDimension", "dim.front-height")],
    geom: [{ kind: "shell", outline: "curve.body-outline", topMat: "mat.shell-white", sideMat: "mat.shell-white", bottomMat: "mat.shell-rear", rearPart: "part.shell-rear", capInset: 6, topEdgeZ: -3.5, depthTop: 22, depthBase: 26, depthGrip: 54, gripStart: 50, gripEnd: 92 }],
  });
  add({
    id: "part.shell-rear", label: "Rear shell", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "The black lower shell. It closes the body, carries the microtexture grip, the specification label, reset pinhole and four external screws.",
    props: [
      P("Colour", "black", "", "V", "S13"),
      P("Finish", "microtextured grip", "", "V", "S4"),
      P("Fasteners", "4 x 6.4-6.5 mm Phillips", "", "V", "S7"),
    ],
    links: [L("hasGeometry", "geo.shell-loft"), L("hasMaterial", "mat.shell-rear"), L("hasFinish", "finish.microtexture"), L("hasPart", "part.spec-label"), L("hasPart", "part.reset"), L("hasPart", "part.microtexture")],
    geom: [],
  });
  add({
    id: "part.core-plate", label: "Black core plate", cls: "cls.part", layer: "part", parent: "asm.core",
    summary: "The gloss-black face plate that surrounds the sticks and carries the PS, mute and speaker details. It is the visual signature of the two-tone design.",
    props: [
      P("Material", "ABS", "", "E", "S13"),
      P("Finish", "gloss black", "", "V", "S13"),
      P("Thickness", 1.2, "mm", "E", "S13"),
    ],
    links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.core-black"), L("hasFinish", "finish.gloss"), L("mountedOn", "part.shell-front"), L("hasPart", "part.player-led"), L("hasPart", "part.speaker-grille"), L("hasPart", "part.button-ps"), L("hasPart", "part.button-mute")],
    geom: [{ kind: "plate", shape: { type: "polygon", half: [[0, 27], [10, 26.6], [20, 26.6], [28, 27.2], [33, 28.8], [36.5, 32], [38.5, 36], [40, 41], [42.5, 47], [44.5, 52], [45, 55.5], [42, 58], [37, 59.6], [30, 60.2], [18, 60.4], [0, 60.4]] }, at: [0, 0], z: 0.55, t: 1.1, bevel: 0.35, mat: "mat.core-black" }],
  });
  add({
    id: "part.core-gasket", label: "Core gasket", cls: "cls.part", layer: "part", parent: "asm.core",
    summary: "Thin elastomer gasket under the core plate, sealing the seam and damping rattle.",
    props: [P("Material", "TPE", "", "E", "S13"), P("Thickness", 0.4, "mm", "E", "S13")],
    links: [L("mountedOn", "part.core-plate")],
    geom: [{ kind: "plate", shape: { type: "polygon", half: [[0, 29], [24, 28.6], [33, 30], [38, 35], [41, 42], [43, 50], [40, 56], [33, 58.6], [0, 58.8]] }, at: [0, 0], z: 0.45, t: 0.4, bevel: 0.15, mat: "mat.rubber" }],
  });
  add({
    id: "part.midframe", label: "Midframe", cls: "cls.part", layer: "part", parent: "asm.fasteners",
    summary: "Internal chassis that locates the main PCB, trigger modules and battery. It is revealed after the rear shell and tool-less trim are removed.",
    props: [P("Material", "ABS", "", "E", "S7"), P("Fasteners", "4 internal Phillips", "", "V", "S7")],
    links: [L("hasMaterial", "mat.core-black"), L("mountedOn", "part.shell-front")],
    geom: [{ kind: "plate", shape: { type: "roundrect", w: 146, h: 86, r: 18 }, at: [0, 49], z: -25, t: 1.4, bevel: 0.2, mat: "mat.core-black", hidden: true }],
  });

  // touchpad stack
  add({
    id: "part.touchpad-bezel", label: "Touchpad bezel", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Black bezel surrounding the touchpad, recessing it into the shell and hiding the light-guide gap.",
    props: [P("Opening", "64 x 30", "mm", "E", "S12"), P("Material", "ABS", "", "E", "S13")],
    links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.core-black"), L("mountedOn", "part.shell-front"), L("covers", "part.touchpad-flex")],
    geom: [{ kind: "plate", shape: { type: "roundrect", w: 64, h: 30, r: 6 }, at: [0, 15.5], z: 0.9, t: 1.4, bevel: 0.5, mat: "mat.core-black" }],
  });
  add({
    id: "part.touchpad", label: "Touchpad", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "2-point capacitive touch surface with mechanical click; on the white colourway it is a white plate, slightly textured and low-gloss.",
    props: [
      P("Active width", 61, "mm", "E", "S12"),
      P("Active height", 27, "mm", "E", "S12"),
      P("Aspect ratio", "2.25:1", "", "E", "S12"),
      P("Top edge below controller top", 2, "mm", "E", "S12"),
      P("Touch points", 2, "", "V", "S4"),
      P("Click", "mechanical, integrated", "", "V", "S4"),
      P("Surface", "micro-textured white plastic", "", "E", "S13"),
    ],
    links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.touchpad"), L("hasFinish", "finish.satin"), L("realizes", "feat.touchpad"), L("controls", "ctl.touchpad"), L("hasDimension", "dim.touchpad"), L("connectsTo", "part.touchpad-flex")],
    geom: [{ kind: "plate", shape: { type: "superellipse", w: 61, h: 27, n: 4.2 }, at: [0, 15.5], z: 2.15, t: 1.3, bevel: 0.5, mat: "mat.touchpad" }],
  });
  add({
    id: "part.touchpad-flex", label: "Touchpad flex", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Flexible printed circuit carrying the capacitive sensor grid and click switch to the main board.",
    props: [P("Type", "FPC", "", "E", "S6"), P("Connector", "16-pin, 0.5 mm pitch (reported)", "", "E", "S6")],
    links: [L("mountedOn", "part.touchpad"), L("connectsTo", "part.main-pcb"), L("coveredBy", "part.touchpad-bezel")],
    geom: [{ kind: "box", at: [0, 16, -5], w: 44, h: 22, d: 0.3, mat: "mat.pcb", hidden: true }],
  });
  add({
    id: "part.touchpad-click", label: "Touchpad click switch", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Dome/tact switch under the touchpad giving the pad its click input.",
    props: [P("Type", "tact dome", "", "E", "S6"), P("Travel", "0.3-0.5", "mm", "E", "S12")],
    links: [L("mountedOn", "part.touchpad-flex"), L("realizes", "ctl.touchpad")],
    geom: [],
  });

  // light bar
  add({
    id: "part.lightbar-left", label: "Light bar - left diffuser", cls: "cls.part", layer: "part", parent: "asm.lighting",
    summary: "Translucent light guide along the left edge of the touchpad. Two of these replace the single DualShock 4 bar.",
    props: [P("Length", 22, "mm", "E", "S12"), P("Width", 2.5, "mm", "E", "S12"), P("Position x", -31.5, "mm", "E", "S12"), P("Colour", "RGB, software addressable", "", "V", "S4")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.lightbar"), L("realizes", "feat.lightbar"), L("mountedOn", "part.touchpad-bezel"), L("indicates", "state.power")],
    geom: [{ kind: "bar", at: [-31.5, 15], w: 2.3, h: 21, rot: -3.2, z: 1.75, t: 0.8, mat: "mat.lightbar", glow: true }],
  });
  add({
    id: "part.lightbar-right", label: "Light bar - right diffuser", cls: "cls.part", layer: "part", parent: "asm.lighting",
    summary: "Translucent light guide along the right edge of the touchpad, mirroring the left strip.",
    props: [P("Length", 22, "mm", "E", "S12"), P("Width", 2.5, "mm", "E", "S12"), P("Position x", 31.5, "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.lightbar"), L("realizes", "feat.lightbar"), L("mountedOn", "part.touchpad-bezel"), L("indicates", "state.power")],
    geom: [{ kind: "bar", at: [31.5, 15], w: 2.3, h: 21, rot: 3.2, z: 1.75, t: 0.8, mat: "mat.lightbar", glow: true }],
  });
  add({
    id: "part.player-led", label: "Player LED strip", cls: "cls.part", layer: "part", parent: "asm.lighting",
    summary: "Diffuser strip with five white LEDs just below the touchpad, showing player slot 1-4 and off.",
    props: [P("LEDs", 5, "", "V", "S4"), P("Strip width", 45, "mm", "E", "S12"), P("Strip height", 2, "mm", "E", "S12"), P("Position y", 30, "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.diffuser"), L("realizes", "feat.player-led"), L("mountedOn", "part.core-plate"), L("indicates", "state.pairing")],
    geom: [{ kind: "bar", at: [0, 30.2], w: 45, h: 2.1, z: 1.35, t: 0.5, mat: "mat.dark" }],
  });
  add({
    id: "part.mute-led", label: "Mute LED", cls: "cls.part", layer: "part", parent: "asm.lighting",
    summary: "Amber LED integrated into the mute button, indicating hardware microphone mute.",
    props: [P("Colour", "amber", "", "E", "S12"), P("State", "lit when muted", "", "V", "S1")],
    links: [L("hasMaterial", "mat.lightbar"), L("realizes", "feat.mute"), L("mountedOn", "part.button-mute"), L("indicates", "state.mute")],
    geom: [{ kind: "circle", at: [-4.4, 53.6], r: 0.65, z: 2.9, mat: "mat.lightbar", emissive: true }],
  });

  // speaker / mics
  add({
    id: "part.speaker-grille", label: "Speaker grille", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Nine small perforations in two staggered rows (5 + 4) above the PS button, letting the mono speaker out.",
    props: [P("Holes", "9 (5 + 4)", "", "E", "S12"), P("Hole diameter", 1.3, "mm", "E", "S12"), P("Pitch", 4, "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.grille"), L("mountedOn", "part.core-plate"), L("covers", "part.speaker")],
    geom: [{ kind: "grille", at: [0, 33.4], rows: 2, cols: 5, pitchX: 3.7, pitchY: 1.7, r: 0.65, z: 1.25, mat: "mat.dark" }],
  });
  add({
    id: "part.speaker", label: "Speaker", cls: "cls.part", layer: "part", parent: "asm.audio",
    summary: "Mono controller speaker behind the grille, used for in-game audio and system sounds.",
    props: [P("Channels", 1, "", "V", "S1"), P("Driver size", "unknown", "", "U", "S1")],
    links: [L("realizes", "feat.speaker"), L("mountedOn", "part.main-pcb")],
    geom: [{ kind: "box", at: [0, 37, -22], w: 18, h: 11, d: 4, mat: "mat.speaker", hidden: true }],
  });
  add({
    id: "part.mic-array", label: "Microphone array", cls: "cls.part", layer: "part", parent: "asm.audio",
    summary: "Two MEMS microphones: one on the main PCB, one on a separate flex near the battery, forming the built-in array used for chat and noise rejection.",
    props: [P("Mics", 2, "", "V", "S4"), P("Mounting", "PCB + separate lower flex", "", "V", "S8")],
    links: [L("hasGeometry", "geo.plate"), L("realizes", "feat.mic"), L("mountedOn", "part.main-pcb"), L("senses", "sensor.mic")],
    geom: [
      { kind: "cylinder", at: [-8, 36], r: 1.4, h: 1, z: -27, mat: "mat.chrome", hidden: true },
      { kind: "cylinder", at: [22, 76], r: 1.4, h: 1, z: -44, mat: "mat.chrome", hidden: true },
    ],
  });
  add({
    id: "part.headphone-jack", label: "3.5 mm headset jack", cls: "cls.part", layer: "part", parent: "asm.audio",
    summary: "CTIA TRRS jack on the bottom edge, carrying stereo audio and microphone for a wired headset.",
    props: [P("Type", "3.5 mm TRRS", "", "V", "S4"), P("Standard", "CTIA", "", "V", "S4"), P("Contacts", 4, "", "V", "S4")],
    links: [L("hasGeometry", "geo.slot"), L("hasMaterial", "mat.chrome"), L("realizes", "feat.audio"), L("mountedOn", "part.shell-front"), L("connectsTo", "if.audio-jack")],
    geom: [
      { kind: "circle", at: [0, 58.2], r: 3.4, z: 0.9, mat: "mat.dark" },
      { kind: "circle", at: [0, 58.2], r: 1.9, z: 1.2, mat: "mat.core-black" },
      { kind: "cylinder", at: [0, 57, -12], r: 5, h: 7, z: -12, mat: "mat.chrome", hidden: true, axis: "y" },
    ],
  });

  // labels / rear details
  add({
    id: "part.spec-label", label: "Specification label", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Rear label carrying model, serial, FCC/IC IDs, charging input, manufacturer and regulatory marks.",
    props: [P("Width", 36, "mm", "E", "S14"), P("Height", 18, "mm", "E", "S14"), P("Content", "CFI-ZCT1W, FCC ID AK8CFIZCT1, IC 409B-CFIZCT1, 5V 1500mA", "", "V", "S14")],
    links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.label"), L("mountedOn", "part.shell-rear"), L("documents", "product.dualsense")],
    geom: [{ kind: "plate", shape: { type: "roundrect", w: 36, h: 18, r: 2.5 }, at: [0, 50], z: -27.4, t: 0.2, bevel: 0.05, mat: "mat.label", rear: true }],
  });
  add({
    id: "part.reset", label: "Reset pinhole", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "Pinhole button next to the SONY logo on the rear; hold 5 s to reset the controller.",
    props: [P("Hole diameter", 0.9, "mm", "E", "S14"), P("Hold time", ">= 5", "s", "V", "S3")],
    links: [L("hasGeometry", "geo.slot"), L("mountedOn", "part.shell-rear"), L("realizes", "feat.reset")],
    geom: [{ kind: "circle", at: [-30, 50], r: 0.9, z: -27.2, mat: "mat.dark", rear: true }],
  });
  add({
    id: "part.microtexture", label: "Grip microtexture", cls: "cls.part", layer: "part", parent: "asm.outer-shell",
    summary: "About 40,000 moulded PlayStation-symbol shapes (triangle, circle, cross, square) stacked in 3D across the lower shell, with the largest symbols about 0.5 mm wide.",
    props: [P("Symbol count", 40000, "", "V", "S4", "approx."), P("Symbol size", 0.5, "mm", "V", "S4", "largest"), P("Coverage", "lower shell / grips", "", "V", "S4")],
    links: [L("hasFinish", "finish.microtexture"), L("mountedOn", "part.shell-rear")],
    geom: [],
  });

  // ---------------------------------------------------------------- sticks
  for (const side of ["left", "right"]) {
    const sx = side === "left" ? -25.2 : 25.2;
    add({
      id: "part.stick-" + side, label: "Analog stick module - " + side, cls: "cls.part", layer: "part", parent: "asm.input",
      summary: "Spring-centred 2-axis gimbal with a potentiometer per axis, L3 click and a dished rubber cap. Same class of module as DualShock 4.",
      props: [
        P("Centre x", sx, "mm", "E", "S12"),
        P("Centre y", 41.2, "mm", "E", "S12"),
        P("Well diameter", 26, "mm", "E", "S12"),
        P("Travel", "8-9", "mm", "E", "S12", "total cap displacement"),
        P("Click", "L3 / R3", "", "V", "S4"),
      ],
      links: [L("hasGeometry", "geo.lathe"), L("hasMaterial", "mat.rubber"), L("realizes", "ctl." + side + "-stick"), L("senses", "sensor.stick-potentiometer"), L("mountedOn", "part.core-plate"), L("hasPart", "part.stick-cap-" + side), L("hasDimension", "dim.stick-spacing")],
      geom: [
        { kind: "circle", at: [sx, 41.2], r: 13, z: 0.62, mat: "mat.core-black" },
        { kind: "ring", at: [sx, 41.2], r: 12.4, r2: 13, z: 1.0, h: 1.2, mat: "mat.chrome" },
        { kind: "cylinder", at: [sx, 41.2], r: 4.2, h: 3.2, z: 1.0, mat: "mat.core-black" },
      ],
    });
    add({
      id: "part.stick-cap-" + side, label: "Stick cap - " + side, cls: "cls.part", layer: "part", parent: "part.stick-" + side,
      summary: "Dished rubber thumb cap, about 19 mm across, with a moulded knurled rim for grip.",
      props: [P("Diameter", 19, "mm", "E", "S12"), P("Height above bezel", "6-7", "mm", "E", "S12"), P("Material", "TPE over hard hub", "", "E", "S13")],
      links: [L("hasGeometry", "geo.lathe"), L("hasMaterial", "mat.rubber"), L("hasFinish", "finish.satin"), L("mountedOn", "part.stick-" + side), L("realizes", "ctl." + side + "-stick")],
      geom: [
        { kind: "stickCap", at: [sx, 41.2], z: 4.2, r: 9.5, h: 7.4, mat: "mat.rubber" },
        { kind: "ring", at: [sx, 41.2], r: 9.7, r2: 8.8, z: 4.25, h: 1.2, mat: "mat.stick-rim" },
      ],
    });
  }

  // ---------------------------------------------------------------- d-pad
  add({
    id: "part.dpad", label: "D-pad", cls: "cls.part", layer: "part", parent: "asm.input",
    summary: "Digital directional pad: four separate translucent caps in a cross-shaped black recess. Digital only - no analog pressure.",
    props: [P("Span", 26, "mm", "E", "S12"), P("Centre x", -50.8, "mm", "E", "S12"), P("Centre y", 23.2, "mm", "E", "S12"), P("Type", "digital, 4 caps", "", "V", "S4")],
    links: [L("hasGeometry", "geo.extrude"), L("hasMaterial", "mat.core-black"), L("realizes", "ctl.dpad"), L("mountedOn", "part.shell-front"), L("hasPart", "part.dpad-up"), L("hasPart", "part.dpad-down"), L("hasPart", "part.dpad-left"), L("hasPart", "part.dpad-right"), L("hasDimension", "dim.dpad")],
    geom: [{ kind: "plate", shape: { type: "polygon", points: [[-4.5,-13.5],[4.5,-13.5],[4.5,-4.5],[13.5,-4.5],[13.5,4.5],[4.5,4.5],[4.5,13.5],[-4.5,13.5],[-4.5,4.5],[-13.5,4.5],[-13.5,-4.5],[-4.5,-4.5]] }, at: [-50.8, 23.2], z: 0.55, t: 0.7, bevel: 0.2, mat: "mat.core-black" }],
  });
  const dpadKeys = [
    ["up", 0, -7.4, 0, "up"],
    ["down", 0, 7.4, 180, "down"],
    ["left", -7.4, 0, 270, "left"],
    ["right", 7.4, 0, 90, "right"],
  ];
  for (const [id, dx, dy, rot, dir] of dpadKeys) {
    add({
      id: "part.dpad-" + id, label: "D-pad " + id + " key", cls: "cls.part", layer: "part", parent: "part.dpad",
      summary: "Individual d-pad key with a rounded, tapered cap and white direction arrow.",
      props: [P("Cap width", 9.5, "mm", "E", "S12"), P("Cap length", 7.6, "mm", "E", "S12"), P("Travel", 0.8, "mm", "E", "S12")],
      links: [L("hasGeometry", "geo.extrude"), L("hasMaterial", "mat.core-black"), L("realizes", "ctl.dpad"), L("mountedOn", "part.dpad")],
      geom: [{ kind: "petal", at: [-50.8 + dx, 23.2 + dy], w: 9.5, h: 7.6, rot: rot, z: 1.55, t: 1.1, mat: "mat.dpad", arrow: dir }],
    });
  }

  // ---------------------------------------------------------------- face buttons
  const face = [
    ["triangle", 47.7, 15.3, "triangle", "Triangle"],
    ["circle", 55.7, 23.3, "circle", "Circle"],
    ["cross", 47.7, 31.3, "cross", "Cross"],
    ["square", 39.7, 23.3, "square", "Square"],
  ];
  for (const [id, x, y, sym, label] of face) {
    add({
      id: "part.button-" + id, label: label + " button", cls: "cls.part", layer: "part", parent: "asm.input",
      summary: "Clear/smoke translucent " + label.toLowerCase() + " cap with a white symbol, over a conductive-rubber dome. Monochrome face buttons are a DualSense signature.",
      props: [P("Diameter", 10, "mm", "E", "S12"), P("Seat diameter", 12, "mm", "E", "S12"), P("Pitch", 16, "mm", "E", "S12"), P("Travel", "0.8-1.2", "mm", "E", "S12")],
      links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.clear"), L("realizes", "ctl.face-buttons"), L("mountedOn", "part.shell-front"), L("hasDimension", "dim.button-pitch")],
      geom: [
        { kind: "cylinder", at: [x, y], r: 6, h: 0.7, z: 0.75, mat: "mat.core-black" },
        { kind: "cylinder", at: [x, y], r: 5, h: 1.9, z: 1.1, mat: "mat.clear", dome: 0.5, glyph: sym },
      ],
    });
  }

  // ---------------------------------------------------------------- system buttons
  add({
    id: "part.button-create", label: "Create button", cls: "cls.part", layer: "part", parent: "asm.input",
    summary: "Pill button with a three-line capture icon. Replaces the DualShock 4 Share button; captures screenshots and clips.",
    props: [P("Size", "9 x 4", "mm", "E", "S12"), P("Position", "(-39, 6.5)", "mm", "E", "S12"), P("Function", "capture / broadcast entry", "", "V", "S1")],
    links: [L("hasGeometry", "geo.extrude"), L("hasMaterial", "mat.shell-white"), L("realizes", "feat.create"), L("controls", "ctl.create"), L("mountedOn", "part.shell-front")],
    geom: [{ kind: "bar", at: [-39, 6.5], w: 9, h: 4, z: 1.35, t: 1.2, mat: "mat.shell-white", glyph: "create", rot: -8 }],
  });
  add({
    id: "part.button-options", label: "Options button", cls: "cls.part", layer: "part", parent: "asm.input",
    summary: "Pill button with a three-line menu icon, opening in-game options.",
    props: [P("Size", "9 x 4", "mm", "E", "S12"), P("Position", "(35, 6.5)", "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.extrude"), L("hasMaterial", "mat.shell-white"), L("realizes", "ctl.options"), L("mountedOn", "part.shell-front")],
    geom: [{ kind: "bar", at: [35, 6.5], w: 9, h: 4, z: 1.35, t: 1.2, mat: "mat.shell-white", glyph: "options", rot: 6 }],
  });
  add({
    id: "part.button-ps", label: "PS button", cls: "cls.part", layer: "part", parent: "asm.input",
    summary: "Round PS monogram button below the touchpad. Wakes the console, opens the home screen and, with Create, enters Bluetooth pairing.",
    props: [P("Diameter", 15, "mm", "E", "S12"), P("Glyph", "13.8 x 6.5", "mm", "E", "S12"), P("Position", "(1.5, 44.1)", "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.plate"), L("hasMaterial", "mat.core-black"), L("realizes", "ctl.ps"), L("mountedOn", "part.core-plate"), L("indicates", "state.power")],
    geom: [
      { kind: "cylinder", at: [1.5, 44.1], r: 8.2, h: 0.8, z: 0.9, mat: "mat.core-black" },
      { kind: "cylinder", at: [1.5, 44.1], r: 7.5, h: 2.4, z: 1.2, mat: "mat.core-black", dome: 0.4, glyph: "ps" },
    ],
  });
  add({
    id: "part.button-mute", label: "Mute button", cls: "cls.part", layer: "part", parent: "asm.input",
    summary: "Hardware microphone mute pill with an integrated amber LED, below the PS button.",
    props: [P("Size", "8.3 x 2.5", "mm", "E", "S12"), P("Position", "(-1, 53.6)", "mm", "E", "S12"), P("LED", "amber when muted", "", "E", "S12")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.core-black"), L("realizes", "feat.mute"), L("controls", "ctl.mute"), L("mountedOn", "part.core-plate"), L("hasPart", "part.mute-led")],
    geom: [{ kind: "bar", at: [-1, 53.6], w: 8.3, h: 2.5, z: 1.35, t: 1.0, mat: "mat.core-black", glyph: "mute" }],
  });

  // ---------------------------------------------------------------- triggers
  add({
    id: "part.bumper-l1", label: "L1 bumper", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Left shoulder button, a hinged lever over a conductive-rubber contact.",
    props: [P("Visible cap", "16 x 8", "mm", "E", "S12"), P("Type", "hinged lever", "", "V", "S9")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.shell-white"), L("realizes", "ctl.l1"), L("mountedOn", "asm.trigger")],
    geom: [{ kind: "bar", at: [-36, 5], w: 16, h: 8, z: -10, t: 5, mat: "mat.shell-white", rot: 4 }],
  });
  add({
    id: "part.bumper-r1", label: "R1 bumper", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Right shoulder button, mirroring L1.",
    props: [P("Visible cap", "16 x 8", "mm", "E", "S12")],
    links: [L("hasGeometry", "geo.rounded-bar"), L("hasMaterial", "mat.shell-white"), L("realizes", "ctl.r1"), L("mountedOn", "asm.trigger")],
    geom: [{ kind: "bar", at: [36, 5], w: 16, h: 8, z: -10, t: 5, mat: "mat.shell-white", rot: -4 }],
  });
  for (const side of ["l2", "r2"]) {
    const isLeft = side === "l2";
    add({
      id: "part.trigger-" + side, label: (isLeft ? "L2" : "R2") + " adaptive trigger", cls: "cls.part", layer: "part", parent: "asm.trigger",
      summary: "Analog trigger paddle with programmable resistance generated by a dedicated motor and gear train. 'Adaptive Triggers' is Sony's marketing name.",
      props: [P("Paddle", "16 x 14", "mm", "E", "S12"), P("Travel", "10-12", "mm", "E", "S12"), P("Rotation", "25-35", "deg", "E", "S12"), P("Max force", "unknown", "", "U", "S9")],
      links: [L("hasGeometry", "geo.swept"), L("hasMaterial", "mat.shell-white"), L("realizes", "feat.adaptive-triggers"), L("controls", "ctl." + side), L("mountedOn", "asm.trigger"), L("hasPart", "part.trigger-motor-" + (isLeft ? "left" : "right")), L("hasPart", "part.trigger-gear-train"), L("hasPart", "part.trigger-spring"), L("hasPart", "part.trigger-sensor")],
      geom: [{ kind: "trigger", at: [isLeft ? -40 : 40, 8], z: -24, w: 16, h: 14, d: 10, rotX: 24, rotZ: isLeft ? 5 : -5, mat: "mat.shell-white" }],
    });
  }
  for (const side of ["left", "right"]) {
    add({
      id: "part.trigger-motor-" + side, label: "Trigger motor - " + side, cls: "cls.part", layer: "part", parent: "asm.trigger",
      summary: "Small DC rotary motor in the trigger module; through the gear train it presses a stopper into the trigger path to create programmable resistance.",
      props: [P("Type", "DC rotary motor", "", "V", "S4"), P("Quantity", 1, "", "V", "S4"), P("Gearbox", "multi-stage reduction", "", "E", "S9")],
      links: [L("hasMaterial", "mat.screw"), L("mountedOn", "asm.trigger"), L("actuates", "actuator.trigger-motor")],
      geom: [{ kind: "cylinder", at: [side === "left" ? -57 : 57, 2], r: 4, h: 8, z: -22, mat: "mat.screw", hidden: true }],
    });
  }
  add({
    id: "part.trigger-gear-train", label: "Trigger gear train", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Multi-stage gear train from the motor pinion to a cam/rack that sets the stopper position. 'Worm gear' is common teardown shorthand, not a Sony term.",
    props: [P("Stages", "multi-stage", "", "E", "S9"), P("Output", "stopper / lever", "", "V", "S9")],
    links: [L("mountedOn", "part.trigger-motor-left"), L("connectsTo", "part.trigger-stopper")],
    geom: [{ kind: "cylinder", at: [-57, 4], r: 5, h: 2, z: -17, mat: "mat.chrome", hidden: true }],
  });
  add({
    id: "part.trigger-stopper", label: "Trigger stopper / lever", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Lever pressed into the trigger's rotation path by the gear train; its position sets the resistance curve felt at the fingertip.",
    props: [P("Function", "programmable resistance", "", "V", "S9")],
    links: [L("mountedOn", "asm.trigger"), L("connectsTo", "part.trigger-gear-train")],
    geom: [{ kind: "box", at: [-57, 6, -14], w: 4, h: 9, d: 2, mat: "mat.chrome", hidden: true }],
  });
  add({
    id: "part.trigger-spring", label: "Trigger return spring", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Return spring restoring the trigger and providing the baseline feel when no adaptive force is commanded.",
    props: [P("Type", "helical spring", "", "E", "S9")],
    links: [L("mountedOn", "asm.trigger"), L("connectsTo", "part.trigger-l2")],
    geom: [],
  });
  add({
    id: "part.trigger-sensor", label: "Trigger position sensor", cls: "cls.part", layer: "part", parent: "asm.trigger",
    summary: "Position-sensing element reporting analog trigger travel to the main board. Exact encoder type is not public.",
    props: [P("Sensing", "analog position", "", "V", "S4"), P("Type", "unknown", "", "U", "S9")],
    links: [L("mountedOn", "asm.trigger"), L("senses", "sensor.trigger-position")],
    geom: [],
  });

  // ---------------------------------------------------------------- haptics
  for (const side of ["left", "right"]) {
    add({
      id: "part.actuator-" + side, label: "Voice-coil actuator - " + side, cls: "cls.part", layer: "part", parent: "asm.haptics",
      summary: "Linear voice-coil actuator in the palm grip, replacing the eccentric-mass rumble motor. Two channels give the DualSense its wide-band haptics.",
      props: [P("Type", "voice coil (linear)", "", "V", "S4"), P("Quantity", 2, "", "V", "S4"), P("Wiring", "4 soldered wires total", "", "V", "S8"), P("Dimensions", "unknown", "", "U", "S8")],
      links: [L("hasMaterial", "mat.copper"), L("mountedOn", "part.shell-rear"), L("actuates", "actuator.voice-coil"), L("realizes", "feat.haptics"), L("poweredBy", "part.battery")],
      geom: [{ kind: "cylinder", at: [side === "left" ? -44 : 44, 74], r: 12, h: 10, z: -30, mat: "mat.copper", hidden: true }],
    });
  }
  add({
    id: "part.haptic-wiring", label: "Haptic wiring", cls: "cls.part", layer: "part", parent: "asm.haptics",
    summary: "Four soldered wires linking the two voice-coil actuators to the main board.",
    props: [P("Wires", 4, "", "V", "S8")],
    links: [L("connectsTo", "part.actuator-left"), L("connectsTo", "part.actuator-right"), L("connectsTo", "part.main-pcb")],
    geom: [],
  });

  // ---------------------------------------------------------------- power
  add({
    id: "part.battery", label: "Battery LIP1708", cls: "cls.part", layer: "part", parent: "asm.power",
    summary: "1560 mAh lithium-ion pouch cell, 3.65 V nominal (about 5.7 Wh), held in a screwed bracket.",
    props: [P("Model", "LIP1708", "", "V", "S10"), P("Capacity", 1560, "mAh", "V", "S4"), P("Voltage", 3.65, "V", "V", "S4"), P("Energy", 5.7, "Wh", "E", "S4", "derived: 1560 mAh x 3.65 V"), P("Construction", "single-cell Li-ion pouch", "", "V", "S10")],
    links: [L("hasMaterial", "mat.battery"), L("powers", "part.main-pcb"), L("powers", "part.actuator-left"), L("powers", "part.actuator-right"), L("mountedOn", "part.battery-bracket"), L("hasDimension", "dim.battery")],
    geom: [{ kind: "box", at: [0, 73, -38], w: 55, h: 36, d: 8, mat: "mat.battery", hidden: true }],
  });
  add({
    id: "part.battery-bracket", label: "Battery bracket", cls: "cls.part", layer: "part", parent: "asm.power",
    summary: "Metal-reinforced bracket retaining the battery with one 6.5 mm Phillips screw.",
    props: [P("Fasteners", "1 x 6.5 mm Phillips", "", "V", "S8")],
    links: [L("mountedOn", "part.shell-rear"), L("hosts", "part.battery")],
    geom: [{ kind: "box", at: [0, 73, -43], w: 56, h: 38, d: 0.8, mat: "mat.screw", hidden: true }],
  });
  add({
    id: "part.charging-contacts", label: "Charging contacts", cls: "cls.part", layer: "part", parent: "asm.power",
    summary: "Gold-plated contacts on the bottom edge for the charging dock; three pins visible.",
    props: [P("Pins", 3, "", "E", "S12"), P("Plating", "gold", "", "V", "S13")],
    links: [L("hasMaterial", "mat.gold"), L("powers", "part.battery"), L("mountedOn", "part.shell-front"), L("connectsTo", "if.dock")],
    geom: [
      { kind: "bar", at: [-4.1, 58.0], w: 2.2, h: 1.2, z: 1.0, t: 0.5, mat: "mat.gold" },
      { kind: "bar", at: [0, 58.0], w: 2.2, h: 1.2, z: 1.0, t: 0.5, mat: "mat.gold" },
      { kind: "bar", at: [4.1, 58.0], w: 2.2, h: 1.2, z: 1.0, t: 0.5, mat: "mat.gold" },
    ],
  });
  add({
    id: "part.usb-c", label: "USB-C port", cls: "cls.part", layer: "part", parent: "asm.power",
    summary: "USB Type-C receptacle on the top edge for charging (5 V / 1.5 A) and wired data.",
    props: [P("Connector", "USB Type-C", "", "V", "S1"), P("Charging input", "5 V / 1.5 A", "", "V", "S14"), P("Data", "USB 2.0 class", "", "E", "S1")],
    links: [L("hasGeometry", "geo.slot"), L("hasMaterial", "mat.chrome"), L("realizes", "feat.wired"), L("mountedOn", "part.shell-front"), L("connectsTo", "if.usb-c"), L("powers", "part.battery")],
    geom: [
      { kind: "box", at: [0, -0.4, -11.5], w: 9, h: 2.4, d: 3.2, mat: "mat.dark", facing: "top" },
      { kind: "box", at: [0, 2, -11.5], w: 11, h: 4, d: 7, mat: "mat.chrome", hidden: true },
    ],
  });

  // ---------------------------------------------------------------- board
  add({
    id: "part.main-pcb", label: "Main PCB (BDM-0xx)", cls: "cls.part", layer: "part", parent: "asm.board",
    summary: "Main logic board carrying the Bluetooth SoC, IMU, audio codec, LED drivers and all flex connectors. Revisions run BDM-010 through BDM-050.",
    props: [P("Revisions", "BDM-010 / -020 / -030 / -040 / -050", "", "V", "S6"), P("Material", "FR-4", "", "E", "S6"), P("SoC", "unknown", "", "U", "S6")],
    links: [L("hasMaterial", "mat.pcb"), L("mountedOn", "part.midframe"), L("hosts", "part.bt-radio"), L("hosts", "part.imu"), L("hosts", "part.antenna"), L("powers", "part.speaker")],
    geom: [{ kind: "box", at: [0, 52, -28], w: 92, h: 54, d: 1.6, mat: "mat.pcb", hidden: true }],
  });
  add({
    id: "part.bt-radio", label: "Bluetooth 5.1 radio", cls: "cls.part", layer: "part", parent: "asm.board",
    summary: "2.4 GHz Bluetooth 5.1 radio (2402-2480 MHz), FCC equipment class DSS. Chipset identity is not public and varies by board revision.",
    props: [P("Standard", "Bluetooth 5.1", "", "V", "S4"), P("Band", "2402-2480 MHz", "MHz", "V", "S5"), P("FCC class", "DSS", "", "V", "S5"), P("Chipset", "unknown", "", "U", "S5")],
    links: [L("mountedOn", "part.main-pcb"), L("communicatesVia", "if.bluetooth"), L("connectsTo", "part.antenna")],
    geom: [{ kind: "box", at: [12, 50, -27], w: 14, h: 14, d: 1, mat: "mat.core-black", hidden: true }],
  });
  add({
    id: "part.antenna", label: "Bluetooth antenna", cls: "cls.part", layer: "part", parent: "asm.board",
    summary: "2.4 GHz antenna on/near the main board. Type (PCB trace vs chip) is not public; the FCC antenna exhibit is confidential.",
    props: [P("Type", "unknown", "", "U", "S5"), P("Band", "2402-2480 MHz", "MHz", "V", "S5")],
    links: [L("mountedOn", "part.main-pcb"), L("connectsTo", "part.bt-radio")],
    geom: [{ kind: "bar", at: [25, 45], w: 20, h: 6, z: -27, t: 0.4, mat: "mat.gold", hidden: true, depth: true }],
  });
  add({
    id: "part.imu", label: "6-axis IMU", cls: "cls.part", layer: "part", parent: "asm.board",
    summary: "3-axis accelerometer plus 3-axis gyroscope, soldered to the main PCB; provides tilt and motion sensing.",
    props: [P("Axes", 6, "", "V", "S4"), P("Components", "3-axis accelerometer + 3-axis gyroscope", "", "V", "S4")],
    links: [L("mountedOn", "part.main-pcb"), L("senses", "sensor.imu"), L("realizes", "feat.motion")],
    geom: [{ kind: "box", at: [-14, 50, -27], w: 4, h: 4, d: 1, mat: "mat.core-black", hidden: true }],
  });

  // ---------------------------------------------------------------- fasteners
  add({
    id: "part.screw-external", label: "External screws", cls: "cls.part", layer: "part", parent: "asm.fasteners",
    summary: "Four 6.4-6.5 mm Phillips screws closing the rear shell: two at the bottom corners, two behind the bumpers.",
    props: [P("Quantity", 4, "", "V", "S7"), P("Length", "6.4-6.5", "mm", "V", "S7"), P("Drive", "Phillips PH0", "", "V", "S7")],
    links: [L("hasMaterial", "mat.screw"), L("connectsTo", "part.shell-rear"), L("mountedOn", "part.shell-rear")],
    geom: [
      { kind: "screw", at: [-55, 88], z: -54.05, r: 1.3, mat: "mat.screw", rear: true },
      { kind: "screw", at: [55, 88], z: -54.05, r: 1.3, mat: "mat.screw", rear: true },
      { kind: "screw", at: [-60, 60], z: -34.5, r: 1.3, mat: "mat.screw", rear: true },
      { kind: "screw", at: [60, 60], z: -34.5, r: 1.3, mat: "mat.screw", rear: true },
    ],
  });
  add({
    id: "part.screw-internal", label: "Internal screws", cls: "cls.part", layer: "part", parent: "asm.fasteners",
    summary: "Midframe and trigger-module screws: 4 midframe plus 2 per trigger assembly; 3+1 inside each trigger module.",
    props: [P("Midframe", 4, "", "V", "S9"), P("Trigger modules", 4, "", "V", "S9"), P("Inside triggers", 8, "", "V", "S9")],
    links: [L("hasMaterial", "mat.screw"), L("connectsTo", "part.midframe")],
    geom: [],
  });

  // ---------------------------------------------------------------- misc
  add({
    id: "part.player-led-leds", label: "Player LEDs (5)", cls: "cls.part", layer: "part", parent: "part.player-led",
    summary: "Five white LEDs behind the diffuser, indicating player slot 1-4 and off.",
    props: [P("Count", 5, "", "V", "S4")],
    links: [L("mountedOn", "part.player-led"), L("indicates", "state.pairing")],
    geom: [],
  });
})();
