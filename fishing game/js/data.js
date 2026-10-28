/* ABYSS ANGLER — static game data.
   Everything here is plain data; js/game.js owns the rules. */
(function () {
  'use strict';

  var FISH = [
    // ---------------------------------------------------------------- level 1
    {
      id: 'sunfish', name: 'Sunfish', level: 1, rarity: 'common',
      depth: [2, 12], weight: [0.4, 2.2], value: 18,
      power: 0.8, stamina: 0.8, agility: 0.35,
      shape: 'round', fin: 'fan', color: 0xffc94d, accent: 0xe8891f, pattern: 'spots',
      glow: null, junk: false,
      desc: 'A warm-water drifter that sunbathes just under the surface. Easy to hook, easier to love.'
    },
    {
      id: 'silverfin', name: 'Silverfin', level: 1, rarity: 'common',
      depth: [4, 16], weight: [0.6, 2.6], value: 24,
      power: 1.0, stamina: 1.0, agility: 0.55,
      shape: 'long', fin: 'small', color: 0xbfd7de, accent: 0x7aa7b5, pattern: 'stripes',
      glow: null, junk: false,
      desc: 'Quick, bright and stubborn. The first fish that teaches you to give line instead of fighting it.'
    },
    {
      id: 'mudcarp', name: 'Mud Carp', level: 1, rarity: 'common',
      depth: [8, 19], weight: [2.0, 6.5], value: 32,
      power: 1.2, stamina: 1.2, agility: 0.3,
      shape: 'round', fin: 'fan', color: 0x8a6a3d, accent: 0x5c4326, pattern: 'plain',
      glow: null, junk: false,
      desc: 'A bottom-hugging bruiser. Slow to run, impossible to rush.'
    },
    {
      id: 'goldenkoi', name: 'Golden Koi', level: 1, rarity: 'rare',
      depth: [2, 10], weight: [1.2, 4.0], value: 95,
      power: 1.3, stamina: 1.2, agility: 0.5,
      shape: 'round', fin: 'sail', color: 0xffb52e, accent: 0xfff1cf, pattern: 'bands',
      glow: null, junk: false,
      desc: 'A stray ornamental koi that followed the warm current out to sea. Worth a small fortune, fights like a bigger one.'
    },

    // ---------------------------------------------------------------- level 2
    {
      id: 'clownfish', name: 'Clownfish', level: 2, rarity: 'common',
      depth: [1, 9], weight: [0.15, 0.7], value: 26,
      power: 0.9, stamina: 0.8, agility: 0.7,
      shape: 'round', fin: 'fan', color: 0xf26d1f, accent: 0xfff6e8, pattern: 'stripes',
      glow: null, junk: false,
      desc: 'Lives in the anemones of the reef flat. Darting, nervous, and always first to the lure.'
    },
    {
      id: 'parrotfish', name: 'Parrotfish', level: 2, rarity: 'common',
      depth: [3, 15], weight: [0.8, 4.5], value: 42,
      power: 1.3, stamina: 1.2, agility: 0.5,
      shape: 'long', fin: 'fan', color: 0x2ec4b6, accent: 0xff8fb1, pattern: 'spots',
      glow: null, junk: false,
      desc: 'Crunching coral all day makes it heavy for its size. The pink-and-teal flash is unmistakable.'
    },
    {
      id: 'seahorse', name: 'Seahorse', level: 2, rarity: 'uncommon',
      depth: [2, 11], weight: [0.05, 0.25], value: 55,
      power: 0.6, stamina: 0.6, agility: 0.3,
      shape: 'seahorse', fin: 'small', color: 0xffc857, accent: 0xff7b54, pattern: 'bands',
      glow: null, junk: false,
      desc: 'Barely a mouthful, but the reef keepers pay for them. Hangs in the weed and refuses to swim properly.'
    },
    {
      id: 'lionfish', name: 'Lionfish', level: 2, rarity: 'uncommon',
      depth: [7, 24], weight: [0.5, 2.2], value: 78,
      power: 1.7, stamina: 1.4, agility: 0.6,
      shape: 'round', fin: 'spike', color: 0xc0392b, accent: 0xffd8c2, pattern: 'stripes',
      glow: null, junk: false,
      desc: 'An invasive beauty with a nasty set of spines. Handle with the net, not with the hand.'
    },
    {
      id: 'electricray', name: 'Electric Ray', level: 2, rarity: 'rare',
      depth: [12, 31], weight: [3.0, 9.0], value: 130,
      power: 2.4, stamina: 2.0, agility: 0.5,
      shape: 'flat', fin: 'small', color: 0x3a4a6b, accent: 0x54e0ff, pattern: 'bands',
      glow: 0x2ea8ff, junk: false,
      desc: 'A living battery that hunts the sandy channel between the reef fingers. Its pulse lights the murk.'
    },
    {
      id: 'reefshark', name: 'Reef Shark', level: 2, rarity: 'rare',
      depth: [17, 35], weight: [15, 45], value: 240,
      power: 3.2, stamina: 2.8, agility: 0.6,
      shape: 'shark', fin: 'sail', color: 0x7f8c8d, accent: 0xdfe6e9, pattern: 'plain',
      glow: null, junk: false,
      desc: 'Patrols the drop-off below the coral shelf. The first fish that can genuinely snap a bad line.'
    },

    // ---------------------------------------------------------------- level 3
    {
      id: 'lanternfish', name: 'Lanternfish', level: 3, rarity: 'common',
      depth: [18, 46], weight: [0.1, 0.6], value: 50,
      power: 0.9, stamina: 0.8, agility: 0.7,
      shape: 'long', fin: 'small', color: 0x28344a, accent: 0x7ef9ff, pattern: 'spots',
      glow: 0x4de8ff, junk: false,
      desc: 'A handful of blue light travelling in hundreds. The trench at dusk is made of them.'
    },
    {
      id: 'kelpeel', name: 'Kelp Eel', level: 3, rarity: 'common',
      depth: [8, 42], weight: [1.2, 4.0], value: 65,
      power: 1.5, stamina: 1.5, agility: 0.6,
      shape: 'eel', fin: 'small', color: 0x4f6f3a, accent: 0xc9d67a, pattern: 'stripes',
      glow: null, junk: false,
      desc: 'Sleeps in the kelp stalks and wakes up furious. It will tie your line in a knot if you let it.'
    },
    {
      id: 'ghosthalibut', name: 'Ghost Halibut', level: 3, rarity: 'uncommon',
      depth: [24, 56], weight: [4.0, 14.0], value: 140,
      power: 2.2, stamina: 2.0, agility: 0.4,
      shape: 'flat', fin: 'small', color: 0xcfd8d0, accent: 0x8fb0a0, pattern: 'spots',
      glow: null, junk: false,
      desc: 'A pale slab that lies flat on the trench floor and pretends to be sand. The quota target of the Kelp Trench.'
    },
    {
      id: 'trenchgrouper', name: 'Trench Grouper', level: 3, rarity: 'rare',
      depth: [34, 63], weight: [14, 38], value: 260,
      power: 3.4, stamina: 3.0, agility: 0.45,
      shape: 'round', fin: 'sail', color: 0x3d3b4f, accent: 0xb04a4a, pattern: 'bands',
      glow: null, junk: false,
      desc: 'The landlord of the kelp trench. It does not run; it simply refuses to come up.'
    },
    {
      id: 'wreckray', name: 'Wreck Ray', level: 3, rarity: 'epic',
      depth: [44, 64], weight: [8, 22], value: 360,
      power: 3.0, stamina: 2.6, agility: 0.55,
      shape: 'flat', fin: 'sail', color: 0x4a3b2f, accent: 0xd9b36c, pattern: 'spots',
      glow: null, junk: false,
      desc: 'Wears the barnacle-crusted outline of a drowned ship. Older than the trench it circles.'
    },

    // ---------------------------------------------------------------- level 4
    {
      id: 'viperfish', name: 'Viperfish', level: 4, rarity: 'common',
      depth: [30, 75], weight: [1.0, 3.5], value: 80,
      power: 1.6, stamina: 1.3, agility: 0.8,
      shape: 'eel', fin: 'spike', color: 0x141a24, accent: 0x6cf0ff, pattern: 'spots',
      glow: 0x37e0ff, junk: false,
      desc: 'Needle teeth, a chin lamp, and absolutely no manners. Strikes at anything that glows.'
    },
    {
      id: 'anglerfish', name: 'Anglerfish', level: 4, rarity: 'uncommon',
      depth: [48, 92], weight: [2.0, 8.0], value: 180,
      power: 2.2, stamina: 1.8, agility: 0.5,
      shape: 'angler', fin: 'spike', color: 0x3b2c3f, accent: 0xffd166, pattern: 'spots',
      glow: 0xffc94d, junk: false,
      desc: 'A mouth with a fishing rod attached. Its lamp is the only sun this deep.'
    },
    {
      id: 'gulpereel', name: 'Gulper Eel', level: 4, rarity: 'rare',
      depth: [55, 104], weight: [5, 16], value: 300,
      power: 3.0, stamina: 2.8, agility: 0.6,
      shape: 'eel', fin: 'fan', color: 0x2b1d36, accent: 0xb388ff, pattern: 'bands',
      glow: 0x9b5cff, junk: false,
      desc: 'A skin balloon with a tail. Swallows whole what the trench lets fall.'
    },
    {
      id: 'ghostlantern', name: 'Ghost Lantern', level: 4, rarity: 'rare',
      depth: [68, 108], weight: [1.0, 4.5], value: 330,
      power: 2.0, stamina: 1.7, agility: 0.9,
      shape: 'round', fin: 'fan', color: 0xdfe9ff, accent: 0x9ff6ff, pattern: 'plain',
      glow: 0xbff8ff, junk: false,
      desc: 'Not quite a fish and not quite a light. It circles the drop line in slow, patient rings.'
    },
    {
      id: 'abyssalghost', name: 'Abyssal Ghost', level: 4, rarity: 'legendary',
      depth: [92, 110], weight: [8, 22], value: 950,
      power: 4.0, stamina: 3.6, agility: 0.7,
      shape: 'angler', fin: 'sail', color: 0xd9f6ff, accent: 0x59c8ff, pattern: 'bands',
      glow: 0x7fe6ff, junk: false,
      desc: 'The trench is its body and the cold is its blood. The proof that the deep remembers you.'
    },

    // ---------------------------------------------------------------- level 5
    {
      id: 'stormmackerel', name: 'Storm Mackerel', level: 5, rarity: 'common',
      depth: [10, 55], weight: [1.0, 4.5], value: 95,
      power: 2.0, stamina: 1.5, agility: 0.8,
      shape: 'long', fin: 'small', color: 0x39556b, accent: 0xd7f0ff, pattern: 'stripes',
      glow: null, junk: false,
      desc: 'Rides the storm swell in silver sheets. The ridge is never calm when they are running.'
    },
    {
      id: 'ironscale', name: 'Ironscale', level: 5, rarity: 'uncommon',
      depth: [40, 95], weight: [8, 26], value: 220,
      power: 2.8, stamina: 2.4, agility: 0.5,
      shape: 'round', fin: 'sail', color: 0x6b7280, accent: 0xcfd6df, pattern: 'bands',
      glow: null, junk: false,
      desc: 'A slab of plated muscle that treats a fishing line as an insult. The ridge currents carved it.'
    },
    {
      id: 'thunderfin', name: 'Thunderfin', level: 5, rarity: 'rare',
      depth: [65, 120], weight: [10, 32], value: 380,
      power: 3.3, stamina: 2.7, agility: 0.85,
      shape: 'long', fin: 'spike', color: 0x2b3a8f, accent: 0x8ef0ff, pattern: 'stripes',
      glow: 0x6fd8ff, junk: false,
      desc: 'Its lateral line glows when the storm charges the water. Holding one is like holding a cut cable.'
    },
    {
      id: 'depthsentinel', name: 'Depth Sentinel', level: 5, rarity: 'epic',
      depth: [98, 142], weight: [30, 75], value: 700,
      power: 3.8, stamina: 3.2, agility: 0.55,
      shape: 'shark', fin: 'sail', color: 0x1b2430, accent: 0x5ff0c8, pattern: 'spots',
      glow: 0x42ffd0, junk: false,
      desc: 'Something enormous keeps the ridge floor. The sonar returns it as a wall, not a fish.'
    },
    {
      id: 'leviathan', name: 'Leviathan', level: 5, rarity: 'legendary',
      depth: [128, 150], weight: [120, 320], value: 2200,
      power: 5.0, stamina: 4.5, agility: 0.9,
      shape: 'eel', fin: 'spike', color: 0x0c1a22, accent: 0x39ffd0, pattern: 'bands',
      glow: 0x3fffd8, junk: false, behavior: 'diver',
      desc: 'The ridge does not have a monster. The ridge is the monster. Bring your strongest line.'
    },

    // ---------------------------------------------------------------- variety update
    {
      id: 'speckledperch', name: 'Speckled Perch', level: 1, rarity: 'common',
      depth: [3, 14], weight: [0.5, 2.4], value: 26,
      power: 0.9, stamina: 0.9, agility: 0.45,
      shape: 'round', fin: 'fan', color: 0x6f8f4a, accent: 0xe8d59a, pattern: 'spots',
      glow: null, junk: false, behavior: 'steady',
      desc: 'A lake fish that followed the tide out. Its spots are how the old anglers counted the seasons.'
    },
    {
      id: 'ribboneel', name: 'Ribbon Eel', level: 1, rarity: 'uncommon',
      depth: [7, 19], weight: [0.8, 3.0], value: 66,
      power: 1.4, stamina: 1.3, agility: 0.7,
      shape: 'eel', fin: 'small', color: 0x2f7f72, accent: 0x6fcaa4, pattern: 'plain',
      glow: null, junk: false, behavior: 'diver',
      desc: 'A green ribbon that ties itself around the line and then dives for the bottom.'
    },
    {
      id: 'triggerfish', name: 'Clown Triggerfish', level: 2, rarity: 'uncommon',
      depth: [6, 20], weight: [0.8, 3.5], value: 84,
      power: 1.5, stamina: 1.2, agility: 0.65,
      shape: 'round', fin: 'spike', color: 0x3a3f6b, accent: 0xffd166, pattern: 'spots',
      glow: null, junk: false, behavior: 'thrasher',
      desc: 'Half clown, half hardware store. It bites the line, the rod, and occasionally the boat.'
    },
    {
      id: 'mantapup', name: 'Manta Pup', level: 2, rarity: 'rare',
      depth: [10, 28], weight: [3.0, 10.0], value: 155,
      power: 2.0, stamina: 1.9, agility: 0.5,
      shape: 'flat', fin: 'sail', color: 0x47617a, accent: 0xa9e7ff, pattern: 'spots',
      glow: null, junk: false, behavior: 'runner',
      desc: 'A young manta still small enough to hook, already strong enough to tow the boat.'
    },
    {
      id: 'silverhake', name: 'Silver Hake', level: 3, rarity: 'common',
      depth: [20, 45], weight: [1.0, 4.0], value: 72,
      power: 1.7, stamina: 1.4, agility: 0.6,
      shape: 'long', fin: 'small', color: 0xc6d6d9, accent: 0x6f8f9a, pattern: 'stripes',
      glow: null, junk: false, behavior: 'runner',
      desc: 'A cold-current sprinter that runs in loose silver schools through the green water.'
    },
    {
      id: 'kelpdragon', name: 'Kelp Dragon', level: 3, rarity: 'rare',
      depth: [15, 50], weight: [0.4, 1.6], value: 210,
      power: 1.8, stamina: 1.5, agility: 0.8,
      shape: 'seahorse', fin: 'sail', color: 0x5b7f3a, accent: 0xffc857, pattern: 'bands',
      glow: null, junk: false, behavior: 'thrasher',
      desc: 'A leafy seadragon the kelp grew around. Beautiful, weightless, and surprisingly violent.'
    },
    {
      id: 'fangtooth', name: 'Fangtooth', level: 4, rarity: 'uncommon',
      depth: [55, 100], weight: [0.5, 2.0], value: 190,
      power: 2.4, stamina: 1.7, agility: 0.9,
      shape: 'round', fin: 'spike', color: 0x1a2230, accent: 0xff6b57, pattern: 'spots',
      glow: 0xff7b5c, junk: false, behavior: 'thrasher',
      desc: 'The smallest fish in the abyss with the largest opinion about being hooked.'
    },
    {
      id: 'lanternray', name: 'Lantern Ray', level: 4, rarity: 'rare',
      depth: [70, 108], weight: [4.0, 12.0], value: 340,
      power: 2.8, stamina: 2.4, agility: 0.6,
      shape: 'flat', fin: 'sail', color: 0x142b3a, accent: 0x7ef9ff, pattern: 'bands',
      glow: 0x57e6ff, junk: false, behavior: 'diver',
      desc: 'A warm lantern-shaped shadow that folds its wings and drops when it feels the hook.'
    },
    {
      id: 'stormcod', name: 'Storm Cod', level: 5, rarity: 'common',
      depth: [30, 90], weight: [3.0, 10.0], value: 140,
      power: 2.2, stamina: 1.8, agility: 0.55,
      shape: 'long', fin: 'small', color: 0x566b6f, accent: 0xd6f0e6, pattern: 'spots',
      glow: null, junk: false, behavior: 'steady',
      desc: 'A stubborn ridge fish that rides out the weather in the lee of the rocks.'
    },
    {
      id: 'ridgehammer', name: 'Ridge Hammerhead', level: 5, rarity: 'epic',
      depth: [100, 145], weight: [55, 130], value: 920,
      power: 4.2, stamina: 3.4, agility: 0.65,
      shape: 'shark', fin: 'sail', color: 0x24313a, accent: 0x8ff0d8, pattern: 'plain',
      glow: 0x4fffd0, junk: false, behavior: 'runner',
      desc: 'The ridge has more than one hunter. This one sees you before the sonar does.'
    }
  ];

  var LEVELS = [
    {
      id: 'shallows', index: 1, name: 'Sunny Shallows', tagline: 'Where everybody learns to hold a rod.',
      depthMax: 20, castRange: 26,
      sky: { top: 0x45575c, bottom: 0xd8cdb4 }, water: { top: 0x496d68, deep: 0x091d1f },
      fog: 0xa6aea2, time: 'day', weather: 'clear',
      features: ['islands', 'buoys', 'rocks'],
      species: ['sunfish', 'speckledperch', 'silverfin', 'mudcarp', 'goldenkoi', 'ribboneel'],
      quota: { total: 5, targets: [{ id: 'silverfin', count: 1 }] },
      starCasts: 14, reward: 160,
      brief: 'Silverfin are running through the shallows. Land five fish and bring back one Silverfin to prove the new rod works.'
    },
    {
      id: 'reef', index: 2, name: 'Coral Gardens', tagline: 'Bright water, sharp teeth.',
      depthMax: 38, castRange: 30,
      sky: { top: 0x35545a, bottom: 0xc3c0a6 }, water: { top: 0x386f68, deep: 0x06262a },
      fog: 0x8aa39b, time: 'day', weather: 'clear',
      features: ['islands', 'reef', 'buoys'],
      species: ['clownfish', 'triggerfish', 'parrotfish', 'seahorse', 'lionfish', 'mantapup', 'electricray', 'reefshark'],
      quota: { total: 6, targets: [{ id: 'reefshark', count: 1 }] },
      starCasts: 18, reward: 280,
      brief: 'The reef patrol wants a Reef Shark off the drop-off. Six fish and one shark — the deep side of the shelf is where it lives.'
    },
    {
      id: 'trench', index: 3, name: 'Kelp Trench', tagline: 'The green dark below the shelf.',
      depthMax: 65, castRange: 36,
      sky: { top: 0x2b4441, bottom: 0x99987f }, water: { top: 0x274c45, deep: 0x021310 },
      fog: 0x748a7f, time: 'dusk', weather: 'mist',
      features: ['islands', 'kelp', 'rocks', 'wreck'],
      species: ['lanternfish', 'kelpeel', 'kelpdragon', 'silverhake', 'ghosthalibut', 'trenchgrouper', 'wreckray'],
      quota: { total: 6, targets: [{ id: 'ghosthalibut', count: 1 }, { id: 'trenchgrouper', count: 1 }] },
      starCasts: 22, reward: 460,
      brief: 'The trench has swallowed a survey boat, and its ledger with it. Bring up a Ghost Halibut and a Trench Grouper, and six fish in total.'
    },
    {
      id: 'abyss', index: 4, name: 'Midnight Abyss', tagline: 'No sun has ever reached this far.',
      depthMax: 110, castRange: 40,
      sky: { top: 0x050a0b, bottom: 0x0f1c1e }, water: { top: 0x0a2427, deep: 0x010506 },
      fog: 0x081211, time: 'night', weather: 'clear',
      features: ['rocks', 'wreck', 'glow'],
      species: ['viperfish', 'fangtooth', 'anglerfish', 'gulpereel', 'ghostlantern', 'lanternray', 'abyssalghost'],
      quota: { total: 7, targets: [{ id: 'anglerfish', count: 1 }, { id: 'abyssalghost', count: 1 }] },
      starCasts: 26, reward: 780,
      brief: 'The institute will pay for proof of the Abyssal Ghost. Seven fish, one Anglerfish with its lamp intact, and the Ghost itself.'
    },
    {
      id: 'ridge', index: 5, name: 'Storm Ridge', tagline: 'The last water before the world ends.',
      depthMax: 150, castRange: 44,
      sky: { top: 0x1b2423, bottom: 0x5c6862 }, water: { top: 0x274542, deep: 0x010606 },
      fog: 0x3a4842, time: 'dusk', weather: 'storm',
      features: ['islands', 'rocks', 'wreck', 'lighthouse'],
      species: ['stormmackerel', 'stormcod', 'ironscale', 'thunderfin', 'ridgehammer', 'depthsentinel', 'leviathan'],
      quota: { total: 8, targets: [{ id: 'thunderfin', count: 1 }, { id: 'leviathan', count: 1 }] },
      starCasts: 30, reward: 1400,
      brief: 'The ridge is breaking apart and something below is using the storm as cover. Bring up a Thunderfin and the Leviathan. Eight fish. Then go home.'
    }
  ];

  var LURES = [
    {
      id: 'minnow', name: 'Silver Minnow', short: 'MINNOW', icon: '◆', tint: '#cfe8ff',
      sink: 1.0, bite: 1.08, rare: 0, layer: 1.0,
      desc: 'A balanced shallow swimmer. Reliable bites and a neutral sink rate.'
    },
    {
      id: 'jig', name: 'Reef Jig', short: 'JIG', icon: '⬟', tint: '#ffd48a',
      sink: 1.35, bite: 0.98, rare: 0.06, layer: 1.32,
      desc: 'Fast sink. Best inside the feeding layer, dead weight outside it.'
    },
    {
      id: 'glow', name: 'Abyss Glow', short: 'GLOW', icon: '✦', tint: '#7ef9ff',
      sink: 0.78, bite: 0.90, rare: 0.38, layer: 1.0,
      desc: 'A slow luminous plug. Fewer bites, heavier and rarer fish — strongest in the dark.'
    }
  ];

  var UPGRADES = [
    { id: 'rod', name: 'Carbon Rod', icon: 'rod', costs: [0, 180, 420, 900],
      desc: 'A stiffer blank throws the lure further and keeps a big fish from steering the boat.',
      effect: '+4 m cast range and +0.8 m school window per tier', branch: 'cast' },
    { id: 'reel', name: 'High-Speed Reel', icon: 'reel', costs: [0, 160, 380, 820],
      desc: 'More turns per second. The single best answer to a deep, heavy fish.',
      effect: '+18% reel speed per tier', branch: 'reel' },
    { id: 'line', name: 'Braided Line', icon: 'line', costs: [0, 170, 400, 860],
      desc: 'Stronger braid with more stretch. Widens the safe tension band.',
      effect: '+12 max tension per tier', branch: 'line' },
    { id: 'sonar', name: 'Depth Sonar', icon: 'sonar', costs: [0, 220, 520, 1100],
      desc: 'Reads the water column. Tier 1 shows fish blips and the school; tier 2 identifies what is down there.',
      effect: 'Reveals depth blips, then species', branch: 'sonar' },
    { id: 'lure', name: 'Glow Lure', icon: 'lure', costs: [0, 190, 450, 950],
      desc: 'A hand-painted lure with a soft pulse. Attracts more fish and better fish.',
      effect: '+12% bite rate and rarer fish per tier', branch: 'lure' }
  ];

  var RANKS = [
    { xp: 0, name: 'Deckhand' },
    { xp: 300, name: 'Angler' },
    { xp: 900, name: 'Deep Angler' },
    { xp: 1800, name: 'Trenchmaster' },
    { xp: 3200, name: 'Abyss Hunter' },
    { xp: 5000, name: 'Ridge Legend' }
  ];

  var TIPS = [
    'Sink the lure into a fish\u2019s depth band before you expect a bite. The sonar panel shows where they live.',
    'A fish that runs is not a fish that wins. Let go of the reel when the tension bar hits the red.',
    'Hold Shift to give line. The fish dives, but the line survives.',
    'Land close to the school for double bites. Charge the cast and watch the ring on the water.',
    'Heavier fish pull harder. Upgrade the line before you chase the deep targets.',
    'The 3rd star asks for a clean trip: fill the quota without losing a single fish.',
    'Replay a level to fill your bestiary. Every species has a best weight to beat.',
    'The reel only lifts when you hold it. Resting lets the fish sink back down.',
    'Deeper water holds rarer fish. The abyss pays for the risk.'
  ];

  window.GAME_DATA = {
    FISH: FISH,
    LEVELS: LEVELS,
    UPGRADES: UPGRADES,
    RANKS: RANKS,
    LURES: LURES,
    TIPS: TIPS,
    VERSION: 3
  };
})();
