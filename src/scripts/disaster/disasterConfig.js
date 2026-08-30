/** Disaster types with visual and gameplay metadata */
export const DISASTER_TYPES = {
  fire: {
    id: 'fire',
    label: 'Fire',
    emoji: '🔥',
    overlay: 'rgba(255,80,0,0.38)',
    shake: 0.9,
    tint: 0xff6600,
  },
  earthquake: {
    id: 'earthquake',
    label: 'Earthquake',
    emoji: '🌋',
    overlay: 'rgba(90,90,90,0.42)',
    shake: 1.4,
    tint: 0x888888,
  },
  flood: {
    id: 'flood',
    label: 'Flood',
    emoji: '🌊',
    overlay: 'rgba(0,120,220,0.38)',
    shake: 0.7,
    tint: 0x3399ff,
  },
  tornado: {
    id: 'tornado',
    label: 'Tornado',
    emoji: '🌪',
    overlay: 'rgba(140,140,170,0.4)',
    shake: 1.1,
    tint: 0xaaaaaa,
  },
  meteor: {
    id: 'meteor',
    label: 'Meteor',
    emoji: '☄',
    overlay: 'rgba(255,40,40,0.45)',
    shake: 1.6,
    tint: 0xff3300,
  },
  blizzard: {
    id: 'blizzard',
    label: 'Blizzard',
    emoji: '❄',
    overlay: 'rgba(200,220,255,0.42)',
    shake: 0.5,
    tint: 0xccddff,
  },
  drought: {
    id: 'drought',
    label: 'Drought',
    emoji: '☀',
    overlay: 'rgba(255,200,60,0.32)',
    shake: 0.35,
    tint: 0xffcc00,
  },
};

export const DISASTER_LEVELS = {
  minor: {
    id: 'minor',
    label: 'Minor',
    severityMult: 0.12,
    repairTicks: 3,
    cost: 100,
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    severityMult: 0.25,
    repairTicks: 5,
    cost: 200,
  },
  major: {
    id: 'major',
    label: 'Major',
    severityMult: 0.4,
    repairTicks: 8,
    cost: 350,
  },
  catastrophic: {
    id: 'catastrophic',
    label: 'Catastrophic',
    severityMult: 0.6,
    repairTicks: 12,
    cost: 500,
  },
};

export const DISASTER_TYPE_IDS = Object.keys(DISASTER_TYPES);
export const DISASTER_LEVEL_IDS = Object.keys(DISASTER_LEVELS);

export function pickRandomType() {
  return DISASTER_TYPE_IDS[Math.floor(Math.random() * DISASTER_TYPE_IDS.length)];
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
