window.PIECES = [
  {
    "id": "M1",
    "title": "La Feria",
    "idiom": "Bruegelian village panorama",
    "scene": "a town square on festival day: market stalls, a procession behind the market, children chasing a dog, two men fighting, a windmill, a gallows outside the walls, a church, washing lines, an overturned cart",
    "crowdRule": "The crowd thickens toward the church door and thins toward the gallows: density = two Gaussian attractions (church door, market row) minus a Gaussian repulsion at the gallows, sampled over jittered points with clearings around stalls and incidents; figures cluster in groups of 2-4 near the market.",
    "findIt": "one red cap appears 9 times on nine workers: market woman, porter at the church door, child chasing the dog, carter by the cart, merchant at stall four, miller at the windmill, watcher at the gallows, banner carrier in the procession, foreground carrier",
    "readings": {
      "far": "At 400 px: a walled town square on festival day, church dominant, windmill and gallows, a striped market row and a dense crowd.",
      "middle": "At 1600 px: the procession with baldachin crossing behind the market, the fight at the right, the dog chase and the overturned cart, the church-door crowd and the empty ground at the gallows.",
      "near": "At 100%: poses, skirts, hats, baskets, bundles and bundles on backs; stall counters and goods; the nine red caps; washing lines with clothes."
    },
    "artist": "grabador",
    "file": "renders/M1-la-feria.jpg",
    "svg": "m1-la-feria/la-feria.svg",
    "palette": [
      [
        "#aebfc2",
        "#e2ddd0"
      ],
      "#efe7d2",
      "#2b2720",
      "#b98a4e",
      "#a03a24",
      "#e8dcc0",
      "#5b6b3a",
      "#7f95a0",
      "#5a4632",
      "#8b8778"
    ],
    "statement": "A festival day in a walled town: market, procession, a fight, children, a cart on its side, a gallows outside the wall. The crowd is thickest at the church door and thinnest at the gallows, and nine red caps move through the day doing nine different jobs."
  },
  {
    "id": "M2",
    "title": "El Puente",
    "idiom": "ukiyo-e crowd print",
    "scene": "a wooden bridge in the rain, people crossing in both directions, boats and a fisherman below, a festival with lanterns on the far bank",
    "crowdRule": "The bridge recedes in eight bays of five figures, scale falling with each bay; every umbrella takes the next colour in a fixed sequence (red, indigo, cream), so the umbrellas are a register running up the bridge.",
    "findIt": "a small white heron appears 7 times, always at the edge of the frame, at different scales and in two poses (standing, flying)",
    "readings": {
      "far": "At 400 px: a diagonal bridge in rain, a dense band of red/indigo/cream umbrellas, indigo water below, a lit far bank.",
      "middle": "At 1600 px: eight bays of five figures, the umbrella colour register, boats and a fisherman below, a festival crowd and lantern strings on the far bank.",
      "near": "At 100%: robes, kasa hats, bundles, porter poles, the fisherman's net, the herons' legs and beaks, lantern reflections."
    },
    "artist": "grabador",
    "file": "renders/M2-el-puente.jpg",
    "svg": "m2-el-puente/el-puente.svg",
    "palette": [
      "#ece4d2",
      "#1c1a18",
      [
        "#c6cdcc",
        "#dcd9cb"
      ],
      [
        "#2b4a6b",
        "#3d6084"
      ],
      [
        "#8a6438",
        "#5d4326"
      ],
      "#b33a2a",
      "#2b4f7a",
      "#e8dfc8"
    ],
    "statement": "A bridge in the rain: eight bays of five, umbrellas moving up the span in a fixed sequence of red, indigo and cream. Below, a fisherman works the water the bridge ignores; on the far bank the festival has already begun. Seven white herons keep to the edges of the frame."
  },
  {
    "id": "M3",
    "title": "El Hotel",
    "idiom": "cutaway / dollhouse",
    "scene": "a six-storey hotel with the front wall removed: thirty rooms, twenty simultaneous lives, a lobby, a bar, a street",
    "crowdRule": "Every room is lit from within and the light temperature alternates warm/cool floor by floor; the wedding is lit warmer than its floor; the ground floor splits warm lobby / cool bar.",
    "findIt": "A black cat with pale eyes in eleven rooms, at eleven different heights (beds, sills, laps, tables, a bar stool).",
    "readings": {
      "far": "A cutaway hotel at night: dark frame, six bands of alternating warm and cool lit rooms, red canopy, yellow taxi, one pale line of water down the facade.",
      "middle": "Thirty rooms with readable incidents (wedding, argument, burglary at an open window, overflowing bath, wake, party), a working lobby and bar, a roof with tank and laundry, and a leak running from the second floor to a puddle at the kerb.",
      "near": "Figures with shoulders, hair and objects in hand; cats on sills and laps at eleven heights; puddle edges and wet reflections; bottles and bulbs at the bar."
    },
    "artist": "aereo",
    "file": "renders/M3-el-hotel.jpg",
    "svg": "m3-el-hotel/hotel.svg",
    "palette": [
      "#1b2331",
      "#20252c",
      "#e6c28c",
      "#d2a565",
      "#a5713f",
      "#ffe7b3",
      "#b3c6d5",
      "#98b0c2",
      "#6b879b",
      "#e0b03c",
      "#7e2f2c",
      "#2b2b2e"
    ],
    "statement": "A hotel is a machine for making strangers private in public, and the cutaway is the machine fantasy: every door open, every light on, no one speaking to anyone. The rule is the light - warm and cool alternating by floor - so the building reads as bands of living before it reads as people. The one line that crosses the floors is a leak, and the one thing that crosses the whole building is a cat."
  },
  {
    "id": "M4",
    "title": "La Torre",
    "idiom": "Bruegelian construction",
    "scene": "a tower under construction seen from below and one side: scaffolding, cranes, hundreds of workers, a city and harbour below, clouds",
    "crowdRule": "The scaffolding is a grid of bays, and each horizontal band of bays holds one trade (masons, carriers, carpenters, water-bearers, riggers), colour-coded by shirt so the tower reads as strata of labour.",
    "findIt": "One worker in every bay wears a blue sash — twelve in total, each a single blue stroke across the chest.",
    "readings": {
      "far": "A huge tapering lattice cone cut off by the top of the frame, cranes like gallows on both flanks, a dark city strip and a dark foreground crowd. Reads instantly as a construction site.",
      "middle": "The grid of bays, the stair climbing the right flank and ending in air beside a half-built arch, blocks hanging from cranes, the city and harbour complete and tiny below.",
      "near": "Individual workers with barrows, hods and saws; twelve blue sashes; stone courses; crane cables and hooks; blocks in the air."
    },
    "artist": "aereo",
    "file": "renders/M4-la-torre.jpg",
    "svg": "m4-la-torre/torre.svg",
    "palette": [
      "#c9d2d0",
      "#e2e7e3",
      "#a89a80",
      "#8f8370",
      "#5a4632",
      "#3f6f9a",
      "#c08a3e",
      "#443b30",
      "#26221c",
      "#332b22"
    ],
    "statement": "A tower that cannot be finished. Every bay of its scaffold holds one trade, so from a distance the thing reads as strata of labour rather than as architecture, and the higher the work the less it is doing: a stair climbs the right flank and ends in air, an arch stands on nothing, cranes lift blocks nobody waits for. Below, the city and the harbour are small and complete. The building is the labour, and the labour is endless."
  },
  {
    "id": "M5",
    "title": "El Puerto",
    "idiom": "harbour panorama at dusk",
    "scene": "a container port at shift change: gantry cranes, a container ship and a second at anchor, a crowd leaving through a gate, a bus, food stalls, a fire in the distance, gulls, a pilot boat",
    "crowdRule": "The crowd streams in three currents — gate, bus, stalls — in three spatial bands, and the currents never cross.",
    "findIt": "A child on shoulders appears seven times in the crowd, always facing away.",
    "readings": {
      "far": "A dusk port: a row of gantry cranes against a warm sky, a dark container ship, coloured container rows, three lit stalls, a smoke plume, a crowd band and a dark foreground with five silhouettes.",
      "middle": "Three crowd currents (gate stream, bus queue, stall crowd) with the gate and bus legible; the ship a long dark mass under the cranes; a fire and smoke on the far quay.",
      "near": "Hi-vis vests and shoulders on the foreground men; container ribs and shadows; bulbs over the stalls; coat colours and turned-away heads; seven children on shoulders."
    },
    "artist": "aereo",
    "file": "renders/M5-el-puerto.jpg",
    "svg": "m5-el-puerto/puerto.svg",
    "palette": [
      "#6f8597",
      "#b9a894",
      "#e8b57e",
      "#f4cd97",
      "#2b3138",
      "#3a4148",
      "#b5562f",
      "#3f6f8a",
      "#4f7a58",
      "#c9a03e",
      "#767d83",
      "#14181d"
    ],
    "statement": "A port at shift change is a machine letting its people out. The cranes stand over the ship like a row of gallows that are also hands; the gate releases one stream, the bus takes another, the stalls catch a third, and behind them a fire burns on the far quay that nobody in the picture is looking at. The crowd is organised into currents that never cross, which is how a port works and how a shift ends."
  },
  {
    "id": "M6",
    "title": "El Jardín",
    "idiom": "Mughal miniature",
    "scene": "a walled chahar-bagh durbar: a ruler on a marble terrace, courtiers, musicians, servants, two elephants with howdahs, water channels and fountains, cypresses, parterres",
    "crowdRule": "Every figure stands in one of the four quadrants of the chahar bagh (read from the feet); three quadrants hold the durbar and the fourth holds exactly one person. Secondary rule: in every group of three courtiers one carries a fan.",
    "findIt": "a drone painted as a bird, 8 times, at eight heights across the sky (x = 210, 430, 620, 790, 960, 1130, 1290, 1460; y from 70 to 300)",
    "readings": {
      "far": "a walled garden with a white pavilion, a cross of blue water, crowds in three quadrants and a bare fourth",
      "middle": "the durbar: audience on the terrace, musicians on a carpet, servants with trays (one dropped), two elephants, guards on the wall; four depth planes with figures shrinking by ground line",
      "near": "turban-jama-sash figure construction, the drone-birds rotor rings, the parterre flowers, the single gardener in the empty quadrant"
    },
    "artist": "colorista",
    "file": "renders/M6-el-jardin.jpg",
    "svg": "m6-el-jardin/el-jardin.svg",
    "palette": [
      "#efdcb4 sky",
      "#c9d6cf pale blue",
      "#6f8f5a garden",
      "#8fae74 parterre",
      "#2e4f7a water",
      "#f3ead6 marble",
      "#c08a46 wall",
      "#b23a2a vermilion",
      "#d9a23c saffron",
      "#c97a72 rose",
      "#3a2a1e ink"
    ],
    "statement": "A walled garden durbar planned as a chahar bagh: three quadrants full of court, music and service, the fourth empty except for one gardener, because the ruler procession has not arrived - and eight birds above the garden that are not birds."
  },
  {
    "id": "M7",
    "title": "La Caza",
    "idiom": "millefleurs tapestry",
    "scene": "a hunt across a flowering field: riders and hounds in three depth bands, a stag at bay in the foreground, a falconer over the river, a picnic, a mill, a castle on the hill, animals hidden in the flowers",
    "crowdRule": "The millefleurs module repeats on a 64 px lattice; figures are placed in three depth bands at a fixed scale ratio (1 : 0.62 : 0.40), and every third figure belongs to the hunt (hunter, hound or quarry).",
    "findIt": "a white hare, 10 times, in ten poses; five half-hidden in the flowers",
    "readings": {
      "far": "a dark green tapestry field with flowers, a river band, a castle on the hill and a large pale animal at bay in the foreground",
      "middle": "riders and hounds in three bands, the stag turning, the picnic, the mill and the falconer; three simultaneous actions",
      "near": "ten hares in ten poses, fourteen hidden animals inside the module, the weave and the border"
    },
    "artist": "colorista",
    "file": "renders/M7-la-caza.jpg",
    "svg": "m7-la-caza/la-caza.svg",
    "palette": [
      "#1e3b35 field",
      "#24453d field light",
      "#e8dcc0 cream",
      "#f2ecd8 white",
      "#c46a6a rose",
      "#c9a03c gold",
      "#8a4a2a russet",
      "#4e7a63 verdigris",
      "#3d6a72 water",
      "#241d18 ink"
    ],
    "statement": "A hunt laid on a tapestry field that does not care about it: the flowers repeat, the hunt is arranged in three depths, and the stag is at bay but not taken. Ten white hares are in the field, five of them inside the flowers."
  },
  {
    "id": "M8",
    "title": "El Jardín de los Datos",
    "idiom": "Boschian garden",
    "scene": "a garden of devices in six beds: server racks grown as hedges, machines standing on roots, a fountain spouting cable, a pavilion walled with monitors, a tree fruiting routers, animals with antennae, and a procession carrying screens",
    "crowdRule": "Six beds in a 3 x 2 grid; each bed grows one device species and every human belongs to a bed and serves it, except the procession, which is the only group allowed to cross beds. Every third gardener carries a tool.",
    "findIt": "a small naked human, 9 times, in nine absurd acts (astride a cable, inside a rack, riding a router, screen on the head, bathing in the fountain, asleep in a bed, feeding an antenna-animal, measuring a machine, hanging from the pavilion)",
    "readings": {
      "far": "a pale garden divided into six beds, each with a different machine, with crowds of small figures and a pale horizon",
      "middle": "the six species are distinguishable - rack hedges, root machines, cable fountain, monitor pavilion, router tree, antenna animals - the procession crosses the middle and the tug reads in the foreground",
      "near": "rack rows with lights and leaves, the monitors, the routers, the nine naked figures and their absurd acts"
    },
    "artist": "colorista",
    "file": "renders/M8-jardin-de-los-datos.jpg",
    "svg": "m8-jardin-de-los-datos/jardin-de-los-datos.svg",
    "palette": [
      "#d9c9a3 ochre",
      "#ede2c6 cream",
      "#d8a8a0 pale pink",
      "#a9c4b8 pale green",
      "#9a5a3c russet",
      "#8a8f88 device grey",
      "#7aa8c8 screen",
      "#3b2a20 ink"
    ],
    "statement": "A garden where the beds grow machines and the gardeners tend them like relics: a fountain of cable, a pavilion of monitors, a tree fruiting routers, and a procession carrying screens out of the beds. Nine small naked people are loose in it, doing the only sensible things left."
  },
  {
    "id": "M9",
    "title": "El Mural",
    "idiom": "social-realist street mural (Rivera / Siqueiros)",
    "scene": "a crowded street mural: labour below, history in the middle, sky and machines above; workers, a march, a mother and child, a skeleton in a sombrero, a tractor, hands",
    "crowdRule": "The mural is read in three registers (below: labour; middle: history; above: sky and machines), each with its own scale; the crowd faces the viewer in the centre and turns away at the edges.",
    "findIt": "one small naturalistic bird (a real bird, not painted in the mural's style) appears 8 times across all three registers: sky, crane, skeleton's sombrero, crowd, tractor, two workers, the hands",
    "readings": {
      "far": "At 400 px: a three-register mural — red sun, gears and a crane above; a facing crowd and a skeleton in a sombrero in the middle; workers, a tractor and raised hands below.",
      "middle": "At 1600 px: the three registers with their scale differences; the crowd facing the viewer at the centre and turning away at the edges; the march, the mother and child, the labour.",
      "near": "At 100%: plaster, cracks and patches; frontal, profile and back faces; hammers, drills, the tractor, the skeleton's ribs; eight naturalistic birds."
    },
    "artist": "grabador",
    "file": "renders/M9-el-mural.jpg",
    "svg": "m9-el-mural/el-mural.svg",
    "palette": [
      [
        "#b98a58",
        "#a97a4a",
        "#c99a68"
      ],
      "#241a12",
      "#a83422",
      "#d3a35c",
      "#3d5a55",
      "#435f74",
      "#e6d4b0",
      "#2e241a"
    ],
    "statement": "History compressed into one wall: labour below, history in the middle, sky and machines above. The crowd faces you at the centre and turns its back at the edges. Eight real birds move through a painted world, and the wall never mentions them."
  },
  {
    "id": "M10",
    "title": "El Mercado",
    "idiom": "night market scene",
    "scene": "a market street at night: stalls, crowd, bulbs, wet ground",
    "crowdRule": "86 figures placed by depth; density peaks in the middle distance; stalls recede in bays of two per side, awnings alternating through a four-colour cycle; every figure faces along the street, never at the viewer.",
    "findIt": "9 small red lanterns, one per depth band, never at the same height",
    "readings": {
      "far": "a lit street receding to a point: orange stalls either side, dark crowd, moon and wires above",
      "middle": "three stories: an argument mid-left, a vendor pouring at a stall, a child chasing a cat lower right",
      "near": "wet-ground reflections, goods as coloured dots, the nine red lanterns, foreground silhouettes cropping the frame"
    },
    "artist": "lead",
    "file": "renders/M10-el-mercado.jpg",
    "svg": "m10-el-mercado/el-mercado.svg",
    "palette": [
      "#06080f",
      "#1d1610",
      "#0a0705",
      "#7e2a20",
      "#8a5c26",
      "#26504a",
      "#ff9a4a",
      "#ffe1b0"
    ],
    "statement": "A night market is the densest social machine I could draw: eighty-six people, twenty stalls, and no protagonist. The light does the storytelling - each bulb is a small sun with its own pool on the wet ground."
  }
];
