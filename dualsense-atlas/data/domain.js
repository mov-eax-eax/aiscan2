// ============================================================================
// DualSense Ontology Atlas - controls, features, sensors, interfaces,
// geometry, materials, dimensions, states, interactions, processes, standards
// ============================================================================
(function () {
  "use strict";
  const O = window.ONTOLOGY;
  const P = window.P, L = window.L;
  const E = O.entities;
  const add = (e) => E.push(e);

  // ---------------------------------------------------------------- controls
  add({ id: "ctl.left-stick", label: "Left stick (X/Y + L3)", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Two-axis spring-centred analog stick with full-travel L3 click. The PS5 host reports 8-bit axis values; internal resolution is not published.", props: [P("Axes", 2, "", "V", "S4"), P("Click", "L3", "", "V", "S4"), P("Reported resolution", "8-bit axes", "", "V", "S4"), P("Travel", "8-9", "mm", "E", "S12")], links: [L("controls", "sensor.stick-potentiometer"), L("senses", "sensor.stick-potentiometer"), L("partOf", "part.stick-left")] });
  add({ id: "ctl.right-stick", label: "Right stick (X/Y + R3)", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Two-axis analog stick with R3 click; same module class as the left stick.", props: [P("Axes", 2, "", "V", "S4"), P("Click", "R3", "", "V", "S4")], links: [L("controls", "sensor.stick-potentiometer"), L("partOf", "part.stick-right")] });
  add({ id: "ctl.l2", label: "L2 adaptive trigger", cls: "cls.control", layer: "control", parent: "sys.trigger", summary: "Analog left trigger whose resistance is programmable via a motor and gear train. Travel about 10-12 mm / 25-35 degrees; maximum force is not public.", props: [P("Type", "analog, position sensed", "", "V", "S4"), P("Travel", "10-12", "mm", "E", "S12"), P("Force", "unknown", "", "U", "S9")], links: [L("realizes", "feat.adaptive-triggers"), L("partOf", "part.trigger-l2")] });
  add({ id: "ctl.r2", label: "R2 adaptive trigger", cls: "cls.control", layer: "control", parent: "sys.trigger", summary: "Analog right trigger with programmable resistance.", props: [P("Type", "analog, position sensed", "", "V", "S4"), P("Travel", "10-12", "mm", "E", "S12")], links: [L("realizes", "feat.adaptive-triggers"), L("partOf", "part.trigger-r2")] });
  add({ id: "ctl.l1", label: "L1 bumper", cls: "cls.control", layer: "control", parent: "sys.trigger", summary: "Digital left shoulder button.", props: [P("Type", "digital", "", "V", "S4")], links: [L("partOf", "part.bumper-l1")] });
  add({ id: "ctl.r1", label: "R1 bumper", cls: "cls.control", layer: "control", parent: "sys.trigger", summary: "Digital right shoulder button.", props: [P("Type", "digital", "", "V", "S4")], links: [L("partOf", "part.bumper-r1")] });
  add({ id: "ctl.dpad", label: "D-pad", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Four digital direction buttons in a cross; discrete caps, not a rocking disc.", props: [P("Directions", 4, "", "V", "S4"), P("Type", "digital", "", "V", "S4")], links: [L("partOf", "part.dpad")] });
  add({ id: "ctl.face-buttons", label: "Face buttons (triangle/circle/cross/square)", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Four digital action buttons in a diamond, monochrome with white symbols.", props: [P("Buttons", 4, "", "V", "S4"), P("Pitch", 16, "mm", "E", "S12")], links: [L("partOf", "part.button-triangle"), L("partOf", "part.button-circle"), L("partOf", "part.button-cross"), L("partOf", "part.button-square")] });
  add({ id: "ctl.touchpad", label: "Touchpad input", cls: "cls.control", layer: "control", parent: "sys.input", summary: "2-point capacitive touch surface plus a mechanical click. Tracks one or two fingers and reports absolute position.", props: [P("Points", 2, "", "V", "S4"), P("Click", "integrated", "", "V", "S4"), P("Active area", "61 x 27", "mm", "E", "S12")], links: [L("senses", "sensor.touch"), L("partOf", "part.touchpad")] });
  add({ id: "ctl.ps", label: "PS button", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Home / wake / pairing button below the touchpad.", props: [P("Type", "digital", "", "V", "S1")], links: [L("partOf", "part.button-ps")] });
  add({ id: "ctl.create", label: "Create button", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Capture and broadcast entry point; replaced the DualShock 4 Share button.", props: [P("Type", "digital", "", "V", "S1")], links: [L("partOf", "part.button-create")] });
  add({ id: "ctl.options", label: "Options button", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Digital menu button.", props: [P("Type", "digital", "", "V", "S1")], links: [L("partOf", "part.button-options")] });
  add({ id: "ctl.mute", label: "Mute button", cls: "cls.control", layer: "control", parent: "sys.input", summary: "Hardware microphone mute toggle with LED state.", props: [P("Type", "digital latch", "", "V", "S1")], links: [L("partOf", "part.button-mute"), L("indicates", "state.mute")] });

  // ---------------------------------------------------------------- features
  const feat = (id, label, summary, props, links) => add({ id: "feat." + id, label: label, cls: "cls.feature", layer: "feature", parent: "product.dualsense", summary: summary, props: props, links: links || [] });
  feat("haptics", "Haptic feedback", "Two-channel, wide-band vibrotactile feedback rendered by voice-coil actuators instead of binary rumble motors. Games stream a haptic signal that can represent textures, impacts and recoil.", [P("Channels", 2, "", "V", "S1"), P("Actuators", "voice coil", "", "V", "S4")], [L("requires", "actuator.voice-coil"), L("requires", "part.actuator-left"), L("requires", "part.actuator-right")]);
  feat("adaptive-triggers", "Adaptive triggers", "Each trigger's resistance is a programmable function of travel, generated mechanically by a per-trigger motor and gear train pressing a stopper into the trigger path.", [P("Triggers", 2, "", "V", "S1"), P("Mechanism", "motor + gear train + stopper", "", "V", "S9"), P("Max force", "unknown", "", "U", "S9")], [L("requires", "actuator.trigger-motor"), L("requires", "part.trigger-motor-left"), L("requires", "part.trigger-motor-right"), L("requires", "part.trigger-gear-train")]);
  feat("touchpad", "Touchpad", "2-point capacitive touch surface with click, flanked by the two light-bar strips.", [P("Points", 2, "", "V", "S4"), P("Click", "yes", "", "V", "S4")], [L("requires", "sensor.touch")]);
  feat("mute", "Hardware mute", "Dedicated microphone mute button that cuts capture in hardware, with its own LED.", [P("LED", "amber", "", "E", "S12")], [L("requires", "part.button-mute"), L("requires", "part.mute-led")]);
  feat("lightbar", "RGB light bar", "Two RGB diffuser strips flanking the touchpad; used as player colour and for in-game effects.", [P("Strips", 2, "", "V", "S4"), P("Colour", "RGB", "", "V", "S4")], [L("requires", "part.lightbar-left"), L("requires", "part.lightbar-right")]);
  feat("player-led", "Player indicator", "Five white LEDs below the touchpad show player slot 1-4 or off.", [P("LEDs", 5, "", "V", "S4")], [L("requires", "part.player-led")]);
  feat("motion", "Motion sensing", "6-axis motion sensing: 3-axis accelerometer plus 3-axis gyroscope.", [P("Axes", 6, "", "V", "S4")], [L("requires", "part.imu")]);
  feat("create", "Create / capture", "Screenshot and video-clip capture, plus the broadcast entry point.", [P("Button", "Create", "", "V", "S1")], [L("requires", "part.button-create")]);
  feat("audio", "Headset audio", "Stereo audio and microphone over a 3.5 mm CTIA headset jack.", [P("Jack", "3.5 mm TRRS", "", "V", "S4")], [L("requires", "part.headphone-jack")]);
  feat("speaker", "Built-in speaker", "Mono speaker for in-game and system audio.", [P("Channels", 1, "", "V", "S1")], [L("requires", "part.speaker")]);
  feat("mic", "Built-in microphone array", "Two-microphone array for chat without a headset, with hardware mute.", [P("Mics", 2, "", "V", "S4")], [L("requires", "part.mic-array")]);
  feat("wireless", "Bluetooth 5.1", "Wireless link using Bluetooth 5.1 (2402-2480 MHz), up to four stored pairings.", [P("Version", "5.1", "", "V", "S4"), P("Band", "2402-2480", "MHz", "V", "S5"), P("Pairings", 4, "", "V", "S2")], [L("requires", "if.bluetooth")]);
  feat("wired", "USB-C wired link", "USB-C data and charging; haptics and adaptive triggers are guaranteed over a wired connection.", [P("Connector", "USB-C", "", "V", "S1"), P("Charging", "5 V / 1.5 A", "", "V", "S14")], [L("requires", "if.usb-c")]);
  feat("charging", "Charging", "Charge over USB-C or the bottom charging contacts in a dock.", [P("USB-C", "5 V / 1.5 A", "", "V", "S14")], [L("requires", "part.charging-contacts"), L("requires", "part.usb-c")]);
  feat("pairing", "Pairing", "Hold PS + Create to enter Bluetooth pairing; up to four controllers can be paired to one console.", [P("Combo", "PS + Create", "", "V", "S2"), P("Slots", 4, "", "V", "S2")], [L("requires", "state.pairing")]);
  feat("reset", "Hardware reset", "Pinhole reset next to the SONY logo on the rear, held for at least five seconds.", [P("Hold", ">= 5", "s", "", "S3")], [L("requires", "part.reset")]);

  // ---------------------------------------------------------------- sensors
  add({ id: "sensor.imu", label: "6-axis IMU", cls: "cls.sensor", layer: "sensor", parent: "sys.connectivity", summary: "Combined 3-axis accelerometer and 3-axis gyroscope on the main PCB.", props: [P("Axes", 6, "", "V", "S4")], links: [L("sensedBy", "part.imu")] });
  add({ id: "sensor.touch", label: "Capacitive touch digitizer", cls: "cls.sensor", layer: "sensor", parent: "sys.input", summary: "Two-point projected-capacitance grid under the touchpad, with click detection.", props: [P("Points", 2, "", "V", "S4")], links: [L("partOf", "part.touchpad-flex")] });
  add({ id: "sensor.trigger-position", label: "Trigger position sensor", cls: "cls.sensor", layer: "sensor", parent: "sys.trigger", summary: "Reports continuous trigger travel to the console; exact encoder type is not public.", props: [P("Output", "analog position", "", "V", "S4"), P("Type", "unknown", "", "U", "S9")], links: [L("partOf", "part.trigger-sensor")] });
  add({ id: "sensor.mic", label: "MEMS microphone", cls: "cls.sensor", layer: "sensor", parent: "sys.audio", summary: "Miniature MEMS pressure transducer; two are used in the array.", props: [P("Type", "MEMS", "", "E", "S8")], links: [L("partOf", "part.mic-array")] });
  add({ id: "sensor.stick-potentiometer", label: "Stick potentiometer", cls: "cls.sensor", layer: "sensor", parent: "sys.input", summary: "One potentiometer per stick axis, converting gimbal angle to an analog voltage.", props: [P("Per stick", 2, "", "E", "S6")], links: [L("partOf", "part.stick-left")] });

  // ---------------------------------------------------------------- actuators
  add({ id: "actuator.voice-coil", label: "Voice-coil actuator", cls: "cls.actuator", layer: "actuator", parent: "sys.haptics", summary: "Linear motor with a moving coil in a magnetic field, capable of fast, wide-band vibration.", props: [P("Type", "linear voice coil", "", "V", "S4"), P("Channels", 2, "", "V", "S4")], links: [L("actuatedBy", "part.actuator-left")] });
  add({ id: "actuator.trigger-motor", label: "Adaptive trigger motor", cls: "cls.actuator", layer: "actuator", parent: "sys.trigger", summary: "Small DC rotary motor driving the trigger stopper through a gear train.", props: [P("Type", "DC rotary", "", "V", "S4"), P("Per controller", 2, "", "V", "S4")], links: [L("actuatedBy", "part.trigger-motor-left")] });
  add({ id: "actuator.speaker", label: "Speaker driver", cls: "cls.actuator", layer: "actuator", parent: "sys.audio", summary: "Moving-coil loudspeaker behind the nine-hole grille.", props: [P("Channels", 1, "", "V", "S1")], links: [L("actuatedBy", "part.speaker")] });
  add({ id: "actuator.led", label: "LED emitter", cls: "cls.actuator", layer: "actuator", parent: "sys.lighting", summary: "RGB and white LEDs behind diffusers for the light bar, player indicator and mute state.", props: [P("Types", "RGB + white + amber", "", "V", "S4")], links: [L("actuatedBy", "part.lightbar-left")] });

  // ---------------------------------------------------------------- interfaces
  add({ id: "if.bluetooth", label: "Bluetooth 5.1 interface", cls: "cls.interface", layer: "interface", parent: "sys.connectivity", summary: "2.4 GHz Bluetooth 5.1 link carrying HID input, output reports and haptic/trigger data.", props: [P("Version", "5.1", "", "V", "S4"), P("Band", "2402-2480", "MHz", "V", "S5"), P("Pairings", 4, "", "V", "S2"), P("Protocol", "HID over Bluetooth", "", "E", "S2")], links: [L("carries", "part.bt-radio"), L("connectsTo", "if.hid")] });
  add({ id: "if.usb-c", label: "USB Type-C interface", cls: "cls.interface", layer: "interface", parent: "sys.power", summary: "USB-C for charging and wired data; 5 V / 1.5 A charging input.", props: [P("Connector", "USB Type-C", "", "V", "S1"), P("Power", "5 V / 1.5 A", "", "V", "S14")], links: [L("carries", "part.usb-c"), L("connectsTo", "part.battery")] });
  add({ id: "if.audio-jack", label: "3.5 mm CTIA jack", cls: "cls.interface", layer: "interface", parent: "sys.audio", summary: "Four-conductor TRRS jack: left, right, ground and microphone.", props: [P("Standard", "CTIA", "", "V", "S4"), P("Contacts", 4, "", "V", "S4")], links: [L("carries", "part.headphone-jack")] });
  add({ id: "if.dock", label: "Charging dock contacts", cls: "cls.interface", layer: "interface", parent: "sys.power", summary: "Bottom-edge contacts used by the DualSense charging station.", props: [P("Pins", 3, "", "E", "S12"), P("Plating", "gold", "", "V", "S13")], links: [L("carries", "part.charging-contacts")] });
  add({ id: "if.hid", label: "HID input protocol", cls: "cls.interface", layer: "interface", parent: "sys.connectivity", summary: "Standard human-interface-device report stream carrying buttons, axes, touch, motion and trigger positions.", props: [P("Class", "HID", "", "E", "S2")], links: [] });

  // ---------------------------------------------------------------- geometry archetypes
  const geo = (id, label, summary, props, links) => add({ id: "geo." + id, label: label, cls: "cls.geometry", layer: "geometry", parent: null, summary: summary, props: props, links: links || [] });
  geo("shell-loft", "Lofted two-tone shell", "Closed solid built by lofting the plan silhouette through rounded top and bottom rims. Top surface is the face plane; depth grows toward the grips. Faces are assigned to the front or rear shell by height.", [P("Primitive", "closed loft", "", "V", "", "parametric"), P("Outline", "Catmull-Rom silhouette", "", "V", ""), P("Rim inset", 6, "mm", "E", ""), P("Depth range", "22-54", "mm", "E", "")], [L("hasGeometry", "curve.body-outline")]);
  geo("plate", "Extruded rounded plate", "Planar outline extruded a small distance with a bevel; used for the touchpad, core plate, labels and button caps.", [P("Primitive", "extruded plate", "", "V", ""), P("Bevel", "0.3-0.6", "mm", "E", "")]);
  geo("lathe", "Lathed stick cap", "Surface of revolution from a 2D profile: a dished thumb surface with a raised knurled rim.", [P("Primitive", "lathe", "", "V", ""), P("Segments", 48, "", "E", "")], [L("hasGeometry", "curve.stick-dish")]);
  geo("extrude", "Rounded key extrusion", "Extruded rounded key cap with a bevel and optional directional arrow; used for the d-pad keys and system buttons.", [P("Primitive", "extrude + bevel", "", "V", "")]);
  geo("swept", "Swept trigger paddle", "Trigger paddle represented as a rounded, rotated volume; the real part is a swept shell around a metal pivot.", [P("Primitive", "rounded sweep", "", "E", "")]);
  geo("rounded-bar", "Rounded bar", "Superellipse-plan bar extruded in z; used for light-bar diffusers, LEDs, mute pill and bumpers.", [P("Primitive", "rounded bar", "", "V", "")], [L("hasGeometry", "curve.touchpad-corner")]);
  geo("grille", "Perforation array", "Array of small circular holes / dark apertures used for the speaker grille.", [P("Primitive", "hole array", "", "V", ""), P("Pattern", "5 + 4 staggered", "", "E", "S12")]);
  geo("slot", "Rounded slot / port aperture", "Rounded-rectangle aperture used for USB-C and the reset pinhole.", [P("Primitive", "rounded slot", "", "V", "")]);

  // ---------------------------------------------------------------- curves
  const curve = (id, label, summary, props, links) => add({ id: "curve." + id, label: label, cls: "cls.curve", layer: "curve", parent: null, summary: summary, props: props, links: links || [] });
  curve("body-outline", "Body silhouette", "Half-outline of the face, mirrored across the centreline and smoothed as a closed Catmull-Rom curve. Traced from a calibrated 160 mm front photograph; the width envelope matches Sony's published 160 mm.", [P("Type", "closed Catmull-Rom", "", "V", ""), P("Control points", 37, "", "E", ""), P("Calibration", "160 mm overall width", "", "V", "S12"), P("Symmetry", "mirrored about x=0", "", "V", "")], []);
  O.entities.find(function (e) { return e.id === "curve.body-outline"; }).params = {
    half: [[0,0],[14,0],[26,0.3],[36,1.1],[43,2.6],[49,5.2],[54,9],[59,14],[63,20],[67,27],[70,35],[73,43],[75.5,51],[77.5,59],[79,67],[80,74],[80,80],[79.3,86],[77.5,91],[75,96],[71.5,100],[67,103.2],[62,105.4],[57,106],[52,105.5],[48,103],[45,99],[42,94],[39,88],[36.5,81],[34.5,74],[33.5,67],[33,63.5],[34.5,60.5],[38,59.4],[42,59.1],[0,59]],
    samplesPerSpan: 5,
    closed: true,
    note: "Half outline runs from top centre (0,0) clockwise to the bottom-centre notch (0,59). Mirror for the left half.",
  };
  curve("cross-section", "Shell cross-section", "Rounded top and bottom rims connecting the face plane to the rear shell; inset rims produce the soft edge highlight.", [P("Type", "rounded loft", "", "E", ""), P("Rim radius", 6, "mm", "E", "")]);
  curve("touchpad-corner", "Touchpad superellipse", "Superellipse with exponent 4.2, 61 x 27 mm, giving the touchpad its soft-rectangular corners.", [P("Width", 61, "mm", "E", "S12"), P("Height", 27, "mm", "E", "S12"), P("Exponent", 4.2, "", "E", "")]);
  curve("stick-dish", "Stick cap dish profile", "Concave thumb dish, 19 mm rim diameter, about 2 mm deep, with a raised textured rim.", [P("Rim diameter", 19, "mm", "E", "S12"), P("Dish depth", 2, "mm", "E", "S12")]);
  curve("trigger-cam", "Trigger stopper cam", "Cam/lever profile that converts motor rotation into a resistance force against the trigger path.", [P("Travel", "25-35", "deg", "E", "S9")]);
  curve("grip-arc", "Grip outer arc", "The long outer arc from the widest point at y~74 to the rounded grip tip at y~106.", [P("Span", "32", "mm", "E", "S12")]);

  // ---------------------------------------------------------------- materials
  const mat = (id, label, color, summary, props) => add({ id: "mat." + id, label: label, cls: "cls.material", layer: "material", parent: null, summary: summary, color: color, props: props, links: [] });
  mat("shell-white", "Satin white shell plastic", "#e9ecf0", "Matte white injection-moulded outer shell; the launch colourway's signature surface.", [P("Colour", "#e9ecf0", "", "E", "S13"), P("Finish", "satin", "", "V", "S13"), P("Polymer", "PC/ABS", "", "E", "S13")]);
  mat("shell-rear", "Black rear shell plastic", "#101216", "Black lower shell; carries the grip microtexture and the specification label.", [P("Colour", "#101216", "", "V", "S13"), P("Finish", "microtexture", "", "V", "S4")]);
  mat("core-black", "Gloss black core plastic", "#16181d", "Gloss black core plate and button caps; the dark centre of the two-tone face.", [P("Colour", "#16181d", "", "V", "S13"), P("Finish", "gloss", "", "V", "S13")]);
  mat("touchpad", "Touchpad white plastic", "#f1f2f4", "Low-gloss, micro-textured touch surface (white on the launch colourway).", [P("Colour", "#f1f2f4", "", "E", "S13"), P("Finish", "satin / micro-texture", "", "V", "S13")]);
  mat("rubber", "Stick rubber (TPE)", "#1a1e25", "Textured rubber overmould on the analog stick caps.", [P("Colour", "#0c0d10", "", "V", "S13"), P("Feel", "tacky, knurled rim", "", "E", "S12")]);
  mat("clear", "Smoke translucent plastic", "#cfd6df", "Clear/smoke button caps that reveal white symbols underneath.", [P("Colour", "smoke", "", "V", "S13"), P("Transmission", "translucent", "", "V", "S13")]);
  mat("diffuser", "White LED diffuser", "#e8f6ff", "Translucent white diffuser for the player LEDs.", [P("Colour", "frosted white", "", "E", "S13")]);
  mat("lightbar", "RGB light guide", "#66e6ff", "Clear polycarbonate light guide, emissive when lit. Cyan is the default atlas glow, not a fixed product colour.", [P("Colour", "RGB", "", "V", "S4")]);
  mat("chrome", "Bright metal trim", "#aab4c0", "Thin bright trim and metal pivot parts; decorative chrome-like finish.", [P("Finish", "bright metal", "", "E", "S13")]);
  mat("gold", "Gold-plated contact", "#c9a24b", "Gold plating on charging contacts and test pads.", [P("Plating", "gold", "", "V", "S13")]);
  mat("pcb", "FR-4 PCB", "#0d3a2a", "Glass-reinforced epoxy printed circuit board.", [P("Colour", "green", "", "E", "S6")]);
  mat("battery", "Li-ion pouch", "#2a2d33", "Aluminium-laminate pouch cell.", [P("Chemistry", "Li-ion", "", "V", "S10")]);
  mat("label", "Label stock", "#d8dde2", "Printed synthetic label with regulatory marks and barcode.", [P("Colour", "light grey", "", "E", "S14")]);
  mat("screw", "Steel fastener", "#8f98a3", "Phillips steel screw, PH0.", [P("Material", "steel", "", "V", "S7")]);
  mat("dark", "Recess black", "#050608", "Deep recess / aperture black used for holes and slots.", [P("Use", "recesses", "", "E", "")]);
  mat("copper", "Copper voice coil", "#b06a3b", "Copper winding and motor internals.", [P("Material", "copper", "", "E", "S8")]);
  mat("speaker", "Speaker cone / mesh", "#22262c", "Speaker driver and protective mesh.", [P("Colour", "dark grey", "", "E", "")]);
  mat("dpad", "D-pad key plastic", "#2b3038", "Glossy dark key caps with a slightly lighter edge than the recess.", [P("Colour", "#2b3038", "", "E", "S13"), P("Finish", "gloss", "", "E", "S13")]);
  mat("stick-rim", "Stick rim polymer", "#5a6572", "Moulded textured rim around the stick cap.", [P("Colour", "#3b434e", "", "E", "S12"), P("Finish", "knurled", "", "E", "S12")]);

  // ---------------------------------------------------------------- finishes / colours
  add({ id: "finish.satin", label: "Satin", cls: "cls.finish", layer: "finish", parent: null, summary: "Low-sheen moulded finish with a soft highlight along rounded edges.", props: [P("Gloss", "low", "", "E", "S13")], links: [] });
  add({ id: "finish.gloss", label: "Gloss", cls: "cls.finish", layer: "finish", parent: null, summary: "High-gloss black core and button finish.", props: [P("Gloss", "high", "", "V", "S13")], links: [] });
  add({ id: "finish.microtexture", label: "Microtexture", cls: "cls.finish", layer: "finish", parent: null, summary: "Moulded PlayStation-symbol microtexture across the grips; about 40,000 symbols, largest about 0.5 mm.", props: [P("Symbols", 40000, "", "V", "S4"), P("Feature size", 0.5, "mm", "V", "S4")], links: [] });
  add({ id: "finish.laser-etch", label: "Laser etching", cls: "cls.finish", layer: "finish", parent: null, summary: "Laser-etched symbols and legends on button caps.", props: [P("Process", "laser", "", "E", "S9")], links: [] });
  add({ id: "finish.pad-print", label: "Pad printing", cls: "cls.finish", layer: "finish", parent: null, summary: "Pad-printed white legends on dark parts and label artwork.", props: [P("Process", "pad print", "", "E", "S9")], links: [] });
  add({ id: "color.white", label: "Arctic White", cls: "cls.color", layer: "color", parent: null, summary: "Launch shell white.", color: "#e9ebee", props: [P("Hex", "#e9ebee", "", "E", "S13")], links: [] });
  add({ id: "color.black", label: "Midnight Black", cls: "cls.color", layer: "color", parent: null, summary: "Black shell and core.", color: "#1b1d21", props: [P("Hex", "#1b1d21", "", "E", "S13")], links: [] });
  add({ id: "color.red", label: "Cosmic Red", cls: "cls.color", layer: "color", parent: null, summary: "Deep red shell.", color: "#a51f39", props: [P("Hex", "#a51f39", "", "E", "S13")], links: [] });
  add({ id: "color.blue", label: "Cobalt Blue", cls: "cls.color", layer: "color", parent: null, summary: "Blue shell.", color: "#20539c", props: [P("Hex", "#20539c", "", "E", "S13")], links: [] });

  // ---------------------------------------------------------------- dimensions
  const dim = (id, label, value, unit, conf, src, summary, annot) => add({ id: "dim." + id, label: label, cls: "cls.dimension", layer: "dimension", parent: null, summary: summary, props: [P(label, value, unit, conf, src)], links: [], annot: annot });
  dim("width", "Overall width", 160, "mm", "V", "S4", "Widest lateral envelope, grip outer face to grip outer face. Annotation drawn on the face view.", { view: "face", a: [-80, 113], b: [80, 113], label: "160 mm", axis: "x" });
  dim("front-height", "Front height", 106, "mm", "V", "S4", "Top edge to bottom of grips in front elevation. Sony labels this axis 'depth'; physically it is the face-on height.", { view: "face", a: [88, 0], b: [88, 106], label: "106 mm", axis: "y" });
  dim("thickness", "Thickness", 66, "mm", "V", "S4", "Face plane to the rear of the grips. Sony labels this axis 'height'.", { view: "edge", a: [88, 12], b: [88, -54], label: "66 mm", axis: "z" });
  dim("touchpad", "Touchpad width", 61, "mm", "E", "S12", "Active capacitive width, photogrammetrically estimated.", { view: "face", a: [-30.5, -4], b: [30.5, -4], label: "61 mm", axis: "x" });
  dim("stick-spacing", "Stick spacing", 50.4, "mm", "E", "S12", "Centre-to-centre distance between the two stick caps.", { view: "face", a: [-25.2, 70], b: [25.2, 70], label: "50.4 mm", axis: "x" });
  dim("button-pitch", "Face button pitch", 16, "mm", "E", "S12", "Centre-to-centre distance between adjacent face buttons.", { view: "face", a: [64, 15.3], b: [64, 31.3], label: "16 mm", axis: "y" });
  dim("dpad", "D-pad span", 26, "mm", "E", "S12", "Overall width and height of the d-pad cluster.", { view: "face", a: [-72, 10], b: [-72, 36], label: "26 mm", axis: "y" });
  dim("battery", "Battery capacity", 1560, "mAh", "V", "S4", "LIP1708 cell capacity; 3.65 V nominal, about 5.7 Wh.");
  dim("trigger-travel", "Trigger travel", "10-12", "mm", "E", "S12", "Fingertip travel of L2/R2; approximately 25-35 degrees of rotation.");
  dim("weight", "Mass", 280, "g", "V", "S4", "Approximate controller mass.");
  dim("ps-button", "PS button diameter", 15, "mm", "E", "S12", "Photogrammetric estimate.");
  dim("lightbar", "Light-bar strip", "22 x 2.5", "mm", "E", "S12", "Each of the two diffuser strips flanking the touchpad.");

  // ---------------------------------------------------------------- states
  add({ id: "state.power", label: "Power state", cls: "cls.state", layer: "state", parent: null, summary: "Off, on, or standby. The PS button wakes the console; the light bar indicates the active player colour.", props: [P("Values", "off / on / standby", "", "E", "S1")], links: [] });
  add({ id: "state.charge", label: "Charging state", cls: "cls.state", layer: "state", parent: null, summary: "Charging over USB-C or the dock; the light bar pulses to indicate charging.", props: [P("Input", "5 V / 1.5 A", "", "V", "S14")], links: [] });
  add({ id: "state.pairing", label: "Pairing state", cls: "cls.state", layer: "state", parent: null, summary: "Bluetooth discovery entered by holding PS + Create; player LEDs show the assigned slot.", props: [P("Combo", "PS + Create", "", "V", "S2")], links: [] });
  add({ id: "state.mute", label: "Mute state", cls: "cls.state", layer: "state", parent: null, summary: "Hardware microphone mute on/off, with an amber LED when muted.", props: [P("Indicator", "amber LED", "", "E", "S12")], links: [] });
  add({ id: "state.trigger-resistance", label: "Trigger resistance state", cls: "cls.state", layer: "state", parent: null, summary: "The programmable resistance curve currently commanded by the game for each adaptive trigger.", props: [P("Control", "per-trigger motor", "", "V", "S9")], links: [] });

  // ---------------------------------------------------------------- interactions
  add({ id: "act.press", label: "Press", cls: "cls.interaction", layer: "interaction", parent: null, summary: "Short digital actuation of a button, 0.8-1.2 mm travel.", props: [P("Travel", "0.8-1.2", "mm", "E", "S12")], links: [] });
  add({ id: "act.hold", label: "Hold", cls: "cls.interaction", layer: "interaction", parent: null, summary: "Sustained press, e.g. PS + Create for pairing or the rear reset for five seconds.", props: [P("Example", "PS + Create", "", "V", "S2")], links: [] });
  add({ id: "act.pull-trigger", label: "Pull trigger", cls: "cls.interaction", layer: "interaction", parent: null, summary: "Analog squeeze of L2/R2 through a programmable resistance curve.", props: [P("Range", "10-12", "mm", "E", "S12")], links: [] });
  add({ id: "act.tilt", label: "Tilt / rotate", cls: "cls.interaction", layer: "interaction", parent: null, summary: "Motion input read by the 6-axis IMU.", props: [P("Axes", 6, "", "V", "S4")], links: [] });
  add({ id: "act.touch", label: "Touch / swipe", cls: "cls.interaction", layer: "interaction", parent: null, summary: "One- or two-finger absolute touch on the capacitive pad.", props: [P("Points", 2, "", "V", "S4")], links: [] });
  add({ id: "act.pair", label: "Pair", cls: "cls.interaction", layer: "interaction", parent: null, summary: "Assign the controller to a console/player slot over Bluetooth.", props: [P("Slots", 4, "", "V", "S2")], links: [] });

  // ---------------------------------------------------------------- processes / standards
  add({ id: "proc.injection", label: "Injection moulding", cls: "cls.process", layer: "process", parent: null, summary: "Shell and button plastics are injection moulded; the microtexture is cut into the tool.", props: [P("Process", "injection moulding", "", "E", "S13")], links: [] });
  add({ id: "proc.laser-etch", label: "Laser etching", cls: "cls.process", layer: "process", parent: null, summary: "Laser-etched button symbols and legends.", props: [P("Process", "laser", "", "E", "S9")], links: [] });
  add({ id: "proc.pad-print", label: "Pad printing", cls: "cls.process", layer: "process", parent: null, summary: "Pad printing for labels and legends.", props: [P("Process", "pad print", "", "E", "S9")], links: [] });
  add({ id: "proc.assembly", label: "Assembly", cls: "cls.process", layer: "process", parent: null, summary: "Clip, screw and flex assembly in a Chinese contract-manufacturing line.", props: [P("Origin", "Made in China", "", "V", "S14")], links: [] });
  add({ id: "proc.test", label: "Functional test", cls: "cls.process", layer: "process", parent: null, summary: "End-of-line test of sticks, triggers, touch, haptics, radio and battery.", props: [P("Stage", "end of line", "", "E", "")], links: [] });

  add({ id: "std.fcc", label: "FCC Part 15", cls: "cls.standard", layer: "standard", parent: null, summary: "US radio certification. FCC ID AK8CFIZCT1; DSS transmitter, 2402-2480 MHz.", props: [P("ID", "AK8CFIZCT1", "", "V", "S5"), P("Class", "DSS", "", "V", "S5")], links: [] });
  add({ id: "std.ic", label: "ISED Canada", cls: "cls.standard", layer: "standard", parent: null, summary: "Canadian radio certification. IC 409B-CFIZCT1.", props: [P("ID", "409B-CFIZCT1", "", "V", "S14")], links: [] });
  add({ id: "std.ce", label: "CE marking", cls: "cls.standard", layer: "standard", parent: null, summary: "European conformity marking for radio and safety.", props: [P("Mark", "CE", "", "V", "S14")], links: [] });
  add({ id: "std.bluetooth", label: "Bluetooth 5.1", cls: "cls.standard", layer: "standard", parent: null, summary: "Bluetooth SIG specification level implemented by the radio.", props: [P("Version", "5.1", "", "V", "S4")], links: [] });
  add({ id: "std.usb", label: "USB Type-C", cls: "cls.standard", layer: "standard", parent: null, summary: "USB-IF Type-C connector and charging specification.", props: [P("Connector", "Type-C", "", "V", "S1")], links: [] });
  add({ id: "std.ctia", label: "CTIA TRRS", cls: "cls.standard", layer: "standard", parent: null, summary: "Four-conductor 3.5 mm headset wiring standard.", props: [P("Contacts", 4, "", "V", "S4")], links: [] });
  add({ id: "std.rohs", label: "RoHS", cls: "cls.standard", layer: "standard", parent: null, summary: "Restriction of hazardous substances compliance.", props: [P("Mark", "RoHS", "", "V", "S14")], links: [] });
  add({ id: "std.weee", label: "WEEE", cls: "cls.standard", layer: "standard", parent: null, summary: "Waste electrical and electronic equipment marking.", props: [P("Mark", "WEEE", "", "V", "S14")], links: [] });
})();
