export const CITY_SIZE_PRESETS = [
  {
    id: 'village',
    size: 12,
    density: 0.24,
    label: 'Village',
    difficulty: 'Easier',
    hint: 'Few buildings. Easier to flatten before time runs out.',
  },
  {
    id: 'town',
    size: 16,
    density: 0.34,
    label: 'Town',
    difficulty: 'Standard',
    hint: 'Default classroom map.',
  },
  {
    id: 'city',
    size: 20,
    density: 0.42,
    label: 'City',
    difficulty: 'Hard',
    hint: 'More targets. You will miss some if you wait.',
  },
  {
    id: 'metro',
    size: 24,
    density: 0.5,
    label: 'Metro',
    difficulty: 'Brutal',
    hint: 'Packed. Disasters cannot cover everything in time.',
  },
];

export const TIME_PRESETS_MINUTES = [5, 10, 15, 20];

export const LAYOUT_STYLES = [
  'grid-quarters',
  'harbor-spine',
  'industrial-ring',
  'campus',
  'twin-cores',
  'sprawl',
];

export function getSizePreset(id) {
  return CITY_SIZE_PRESETS.find((p) => p.id === id) || CITY_SIZE_PRESETS[1];
}

export function estimateBuildingCount(size, density) {
  const inner = Math.max(1, size - 2);
  return Math.round(inner * inner * density);
}
