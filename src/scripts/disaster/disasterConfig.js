/** Disaster types with visual and gameplay metadata */
export const DISASTER_TYPES = {
  fire: {
    id: 'fire',
    label: 'Fire',
    emoji: '🔥',
    overlay: 'rgba(255,80,0,0.38)',
    shake: 0.9,
    tint: 0xff6600,
    area: true,
  },
  earthquake: {
    id: 'earthquake',
    label: 'Earthquake',
    emoji: '🌋',
    overlay: 'rgba(90,90,90,0.42)',
    shake: 1.4,
    tint: 0x888888,
    area: true,
  },
  flood: {
    id: 'flood',
    label: 'Flood',
    emoji: '🌊',
    overlay: 'rgba(0,120,220,0.38)',
    shake: 0.7,
    tint: 0x3399ff,
    area: true,
  },
  typhoon: {
    id: 'typhoon',
    label: 'Typhoon',
    emoji: '🌀',
    overlay: 'rgba(100,140,200,0.42)',
    shake: 1.2,
    tint: 0x6699cc,
    area: true,
  },
  nuclear: {
    id: 'nuclear',
    label: 'Nuclear Meltdown',
    emoji: '☢',
    overlay: 'rgba(120,255,80,0.35)',
    shake: 1.5,
    tint: 0x88ff44,
    area: true,
  },
  meteor: {
    id: 'meteor',
    label: 'Meteor',
    emoji: '☄',
    overlay: 'rgba(255,40,40,0.45)',
    shake: 1.6,
    tint: 0xff3300,
    area: false,
  },
  blizzard: {
    id: 'blizzard',
    label: 'Blizzard',
    emoji: '❄',
    overlay: 'rgba(200,220,255,0.42)',
    shake: 0.5,
    tint: 0xccddff,
    area: false,
  },
};

export const DISASTER_LEVELS = {
  minor: {
    id: 'minor',
    label: 'Minor',
    severityMult: 0.12,
    repairTicks: 20,
    cost: 100,
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    severityMult: 0.25,
    repairTicks: 30,
    cost: 200,
  },
  major: {
    id: 'major',
    label: 'Major',
    severityMult: 0.4,
    repairTicks: 45,
    cost: 350,
  },
  catastrophic: {
    id: 'catastrophic',
    label: 'Catastrophic',
    severityMult: 0.6,
    repairTicks: 60,
    cost: 500,
  },
};

export const DISASTER_TYPE_IDS = Object.keys(DISASTER_TYPES);
export const DISASTER_LEVEL_IDS = Object.keys(DISASTER_LEVELS);

export function pickRandomType() {
  const areaTypes = DISASTER_TYPE_IDS.filter((id) => DISASTER_TYPES[id].area);
  const pool = areaTypes.length ? areaTypes : DISASTER_TYPE_IDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickRandomLevel() {
  const weights = [
    { id: 'minor', w: 3 },
    { id: 'moderate', w: 4 },
    { id: 'major', w: 2 },
    { id: 'catastrophic', w: 1 },
  ];
  const total = weights.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  for (const entry of weights) {
    roll -= entry.w;
    if (roll <= 0) return entry.id;
  }
  return 'moderate';
}

/** Typhoon path progress per animation frame. Old 0.018 crossed the map in ~1s at 60fps. */
export const TYPHOON_BASE_SPEED = 0.0022;
