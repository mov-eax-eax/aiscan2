// ============================================================================
// DualSense Ontology Atlas - schema, classes, predicates and sources
// Canonical runtime data. Loaded as a classic script so the atlas opens from
// file:// without a server. No network calls.
// ============================================================================
(function () {
  "use strict";

  const ONTOLOGY = {
    meta: {
      id: "dsa:dualsense",
      name: "DualSense Ontology Atlas",
      shortName: "DSOA",
      version: "1.0.0",
      subject: "Sony PlayStation 5 DualSense wireless controller (CFI-ZCT1W)",
      compiled: "2026-10-17",
      units: "millimetres (mm), grams (g), milliampere-hours (mAh), volts (V), watt-hours (Wh), gigahertz (GHz)",
      crs: {
        x: "lateral, + right (face-on, product orientation)",
        y: "front elevation, 0 at the top edge, + downward toward the grips",
        z: "depth, 0 at the face plane, + toward the viewer, - into the body",
      },
      envelope: { width: 160, frontHeight: 106, thickness: 66, weight: 280 },
      note: "Every asserted value carries a confidence code (V verified, E estimated, U unknown) and a source id. Estimates are photogrammetric (+/-4%) unless noted. This is an atlas-grade model, not CAD.",
    },

    classes: [
      { id: "cls.thing", label: "Thing", parent: null, layer: "meta", color: "#8b98a8", desc: "Root of the ontology." },
      { id: "cls.product", label: "Product", parent: "cls.thing", layer: "product", color: "#ffd166", desc: "A marketable controller product or variant." },
      { id: "cls.controller", label: "Controller", parent: "cls.product", layer: "product", color: "#ffd166", desc: "A complete controller individual." },
      { id: "cls.variant", label: "Variant", parent: "cls.product", layer: "product", color: "#ffc14d", desc: "A colourway or edition that shares the same hardware envelope." },
      { id: "cls.system", label: "Subsystem", parent: "cls.thing", layer: "system", color: "#6ee7ff", desc: "A functional subsystem of the controller." },
      { id: "cls.assembly", label: "Assembly", parent: "cls.thing", layer: "assembly", color: "#8ab4ff", desc: "A serviceable or conceptual group of parts." },
      { id: "cls.part", label: "Part", parent: "cls.thing", layer: "part", color: "#d7e2ee", desc: "A physical component of the controller." },
      { id: "cls.control", label: "Control", parent: "cls.thing", layer: "control", color: "#ff9f68", desc: "A user-operable input, axis or gesture surface." },
      { id: "cls.feature", label: "Feature", parent: "cls.thing", layer: "feature", color: "#c792ff", desc: "A user-facing capability realised by parts and behaviours." },
      { id: "cls.sensor", label: "Sensor", parent: "cls.thing", layer: "sensor", color: "#7dffc0", desc: "A transducer that converts a physical quantity into a signal." },
      { id: "cls.actuator", label: "Actuator", parent: "cls.thing", layer: "actuator", color: "#ff7d9c", desc: "A transducer that converts a signal into a physical effect." },
      { id: "cls.interface", label: "Interface", parent: "cls.thing", layer: "interface", color: "#5ad1ff", desc: "An external electrical or radio interface." },
      { id: "cls.geometry", label: "Geometry", parent: "cls.thing", layer: "geometry", color: "#57c7ff", desc: "A parametric geometric archetype used by the SVG projector." },
      { id: "cls.curve", label: "Curve", parent: "cls.thing", layer: "curve", color: "#4ea8de", desc: "A mathematical curve or profile definition." },
      { id: "cls.material", label: "Material", parent: "cls.thing", layer: "material", color: "#b8a98a", desc: "A bulk material with visual and mechanical properties." },
      { id: "cls.finish", label: "Finish", parent: "cls.thing", layer: "finish", color: "#9c8f78", desc: "A surface treatment applied to a material." },
      { id: "cls.color", label: "Colour", parent: "cls.thing", layer: "color", color: "#d8b4fe", desc: "A named colourway or light colour." },
      { id: "cls.dimension", label: "Dimension", parent: "cls.thing", layer: "dimension", color: "#ffcf5c", desc: "A measured or estimated quantity with unit, confidence and source." },
      { id: "cls.state", label: "State", parent: "cls.thing", layer: "state", color: "#9aa7b8", desc: "An operational state of the controller." },
      { id: "cls.interaction", label: "Interaction", parent: "cls.thing", layer: "interaction", color: "#f59e0b", desc: "A user action and its semantics." },
      { id: "cls.process", label: "Process", parent: "cls.thing", layer: "process", color: "#94a3b8", desc: "A manufacturing, assembly or test process." },
      { id: "cls.standard", label: "Standard", parent: "cls.thing", layer: "standard", color: "#7dd3fc", desc: "A regulatory, industry or certification standard." },
    ],

    predicates: [
      { id: "hasPart", label: "has part", inverse: "partOf", desc: "Mereological containment." },
      { id: "partOf", label: "part of", inverse: "hasPart", desc: "Inverse of has part." },
      { id: "hasSubsystem", label: "has subsystem", inverse: "subsystemOf", desc: "Product to subsystem." },
      { id: "subsystemOf", label: "subsystem of", inverse: "hasSubsystem", desc: "Inverse of has subsystem." },
      { id: "hasVariant", label: "has variant", inverse: "variantOf", desc: "Product to colourway." },
      { id: "variantOf", label: "variant of", inverse: "hasVariant", desc: "Colourway to product." },
      { id: "hasGeometry", label: "has geometry", inverse: "geometryOf", desc: "Part to parametric geometry archetype." },
      { id: "geometryOf", label: "geometry of", inverse: "hasGeometry", desc: "Inverse of has geometry." },
      { id: "hasMaterial", label: "has material", inverse: "materialOf", desc: "Part to bulk material." },
      { id: "materialOf", label: "material of", inverse: "hasMaterial", desc: "Inverse of has material." },
      { id: "hasFinish", label: "has finish", inverse: "finishOf", desc: "Part or material to surface finish." },
      { id: "finishOf", label: "finish of", inverse: "hasFinish", desc: "Inverse of has finish." },
      { id: "hasColor", label: "has colour", inverse: "colorOf", desc: "Part or variant to colour." },
      { id: "colorOf", label: "colour of", inverse: "hasColor", desc: "Inverse of has colour." },
      { id: "hasDimension", label: "has dimension", inverse: "dimensionOf", desc: "Entity to measurement." },
      { id: "dimensionOf", label: "dimension of", inverse: "hasDimension", desc: "Inverse of has dimension." },
      { id: "realizes", label: "realizes", inverse: "realizedBy", desc: "Part or assembly to feature." },
      { id: "realizedBy", label: "realized by", inverse: "realizes", desc: "Feature to implementing part." },
      { id: "controls", label: "controls", inverse: "controlledBy", desc: "Control to the function or system it drives." },
      { id: "controlledBy", label: "controlled by", inverse: "controls", desc: "Inverse of controls." },
      { id: "senses", label: "senses", inverse: "sensedBy", desc: "Sensor to the quantity or input it measures." },
      { id: "sensedBy", label: "sensed by", inverse: "senses", desc: "Inverse of senses." },
      { id: "actuates", label: "actuates", inverse: "actuatedBy", desc: "Actuator to the effect it produces." },
      { id: "actuatedBy", label: "actuated by", inverse: "actuates", desc: "Inverse of actuates." },
      { id: "communicatesVia", label: "communicates via", inverse: "carries", desc: "Device to interface." },
      { id: "carries", label: "carries", inverse: "communicatesVia", desc: "Interface to device." },
      { id: "connectsTo", label: "connects to", inverse: "connectedFrom", desc: "Part to part mating relation." },
      { id: "connectedFrom", label: "connected from", inverse: "connectsTo", desc: "Inverse of connects to." },
      { id: "mountedOn", label: "mounted on", inverse: "hosts", desc: "Part to host part or assembly." },
      { id: "hosts", label: "hosts", inverse: "mountedOn", desc: "Inverse of mounted on." },
      { id: "covers", label: "covers", inverse: "coveredBy", desc: "Part to part it conceals." },
      { id: "coveredBy", label: "covered by", inverse: "covers", desc: "Inverse of covers." },
      { id: "measures", label: "measures", inverse: "measuredBy", desc: "Dimension to measured entity." },
      { id: "measuredBy", label: "measured by", inverse: "measures", desc: "Inverse of measures." },
      { id: "requires", label: "requires", inverse: "requiredBy", desc: "Feature to prerequisite." },
      { id: "requiredBy", label: "required by", inverse: "requires", desc: "Inverse of requires." },
      { id: "compatibleWith", label: "compatible with", inverse: "compatibleWith", desc: "Platform compatibility." },
      { id: "pairsWith", label: "pairs with", inverse: "pairsWith", desc: "Pairing relationship." },
      { id: "indicates", label: "indicates", inverse: "indicatedBy", desc: "Light or output to the state it signals." },
      { id: "indicatedBy", label: "indicated by", inverse: "indicates", desc: "Inverse of indicates." },
      { id: "powers", label: "powers", inverse: "poweredBy", desc: "Power source to powered part." },
      { id: "poweredBy", label: "powered by", inverse: "powers", desc: "Inverse of powers." },
      { id: "produces", label: "produces", inverse: "producedBy", desc: "Process to output." },
      { id: "producedBy", label: "produced by", inverse: "produces", desc: "Inverse of produces." },
      { id: "hasState", label: "has state", inverse: "stateOf", desc: "Device to operational state." },
      { id: "stateOf", label: "state of", inverse: "hasState", desc: "Inverse of has state." },
      { id: "governedBy", label: "governed by", inverse: "governs", desc: "Product to standard." },
      { id: "governs", label: "governs", inverse: "governedBy", desc: "Inverse of governed by." },
      { id: "documents", label: "documents", inverse: "documentedBy", desc: "Source to entity (reserved for graph use)." },
      { id: "documentedBy", label: "documented by", inverse: "documents", desc: "Inverse of documents." },
    ],

    sources: [
      { id: "S1", label: "Sony - DualSense wireless controller product page", publisher: "Sony Interactive Entertainment", url: "https://www.playstation.com/en-us/accessories/dualsense-wireless-controller/", type: "Manufacturer", accessed: "2026-10-17", reliability: "High for feature semantics; no dimensions" },
      { id: "S2", label: "Sony Support - Connect a DualSense controller", publisher: "Sony Interactive Entertainment", url: "https://www.playstation.com/en-us/support/hardware/dualsense-controller-support/", type: "Manufacturer support", accessed: "2026-10-17", reliability: "High" },
      { id: "S3", label: "Sony Support - Troubleshoot DualSense", publisher: "Sony Interactive Entertainment", url: "https://www.playstation.com/en-ie/support/hardware/troubleshoot-dualsense/", type: "Manufacturer support", accessed: "2026-10-17", reliability: "High" },
      { id: "S4", label: "Wikipedia - DualShock, DualSense section", publisher: "Wikimedia Foundation", url: "https://en.wikipedia.org/wiki/DualShock", type: "Encyclopaedia", accessed: "2026-10-17", reliability: "High for infobox; medium for prose" },
      { id: "S5", label: "FCC ID AK8CFIZCT1", publisher: "fccid.io", url: "https://fccid.io/AK8CFIZCT1", type: "Regulatory database", accessed: "2026-10-17", reliability: "High" },
      { id: "S6", label: "iFixit - DualSense device page", publisher: "iFixit", url: "https://www.ifixit.com/Device/DualSense", type: "Teardown / repair", accessed: "2026-10-17", reliability: "High" },
      { id: "S7", label: "iFixit - Rear Case Separation (guide 182449)", publisher: "iFixit", url: "https://www.ifixit.com/Guide/Rear+Case+Separation/182449", type: "Teardown / repair", accessed: "2026-10-17", reliability: "High" },
      { id: "S8", label: "iFixit - Motherboard Removal (guide 154744)", publisher: "iFixit", url: "https://www.ifixit.com/Guide/Motherboard+Removal/154744", type: "Teardown / repair", accessed: "2026-10-17", reliability: "High" },
      { id: "S9", label: "iFixit - PS5 Controller Trigger Teardown (guide 158397)", publisher: "iFixit", url: "https://www.ifixit.com/Teardown/PS5+Controller+Trigger+Teardown/158397", type: "Teardown", accessed: "2026-10-17", reliability: "High" },
      { id: "S10", label: "iFixit - DualSense Battery Replacement (guide 142053)", publisher: "iFixit", url: "https://www.ifixit.com/Guide/Sony+DualSense+Controller+Battery+Replacement/142053", type: "Teardown / repair", accessed: "2026-10-17", reliability: "High" },
      { id: "S11", label: "Engadget - DualSense teardown reveals trigger gears", publisher: "Engadget", url: "https://www.engadget.com/dualsense-teardown-070738419.html", type: "Press", accessed: "2026-10-17", reliability: "Medium-high" },
      { id: "S12", label: "Wikimedia Commons - DualSense Midnight Black (front, calibration image)", publisher: "Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/File:Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(front).jpg", type: "Photograph (CC BY-SA 4.0)", accessed: "2026-10-17", reliability: "Geometry only; calibrated to 160 mm" },
      { id: "S13", label: "Wikimedia Commons - DualSense white three-quarter render", publisher: "Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/File:Playstation_DualSense_Controller.png", type: "Photograph (CC BY-SA 4.0)", accessed: "2026-10-17", reliability: "Geometry / colour blocking" },
      { id: "S14", label: "Wikimedia Commons - DualSense Midnight Black (rear label)", publisher: "Wikimedia Commons", url: "https://commons.wikimedia.org/wiki/File:Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(rear).jpg", type: "Photograph (CC BY-SA 4.0)", accessed: "2026-10-17", reliability: "Labels / regulatory IDs" },
    ],

    entities: [],
  };

  window.ONTOLOGY = ONTOLOGY;
  window.P = function P(k, v, u, c, s, note) {
    return { k: k, v: v, u: u || "", c: c || "V", s: s || "", note: note || "" };
  };
  window.L = function L(p, o, note) {
    return { p: p, o: o, note: note || "" };
  };
})();
