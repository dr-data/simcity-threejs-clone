export const CITY_SIZE_PRESETS = [
  {
    id: 'village',
    size: 12,
    density: 0.92,
    label: 'Village',
    difficulty: 'Easier',
    hint: 'Finished streets and houses. Smaller, so you can cover it.',
  },
  {
    id: 'town',
    size: 16,
    density: 0.95,
    label: 'Town',
    difficulty: 'Standard',
    hint: 'A developed town on a full street grid.',
  },
  {
    id: 'city',
    size: 20,
    density: 0.97,
    label: 'City',
    difficulty: 'Hard',
    hint: 'Dense downtown. Many blocks still standing when time is gone.',
  },
  {
    id: 'metro',
    size: 24,
    density: 0.99,
    label: 'Metro',
    difficulty: 'Brutal',
    hint: 'Fully built metropolis. You will not flatten it all.',
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
  const innerTiles = inner * inner;
  const step = 3;
  const lines = Math.max(1, Math.floor((inner - 2) / step) + 1);
  const roads = Math.min(innerTiles, 2 * lines * inner - lines * lines);
  const lots = Math.max(0, innerTiles - roads);
  return roads + Math.round(lots * density);
}
