import { LAYOUT_STYLES } from './citySizes.js';

export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function innerBounds(size) {
  return { min: 1, max: size - 2 };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function key(x, y) {
  return `${x},${y}`;
}

function add(map, x, y, type, extra = {}) {
  if (!map.has(key(x, y))) map.set(key(x, y), { x, y, type, ...extra });
}

function inInner(size, x, y) {
  const { min, max } = innerBounds(size);
  return x >= min && x <= max && y >= min && y <= max;
}

function lotLevel(size, x, y, rng) {
  const mid = (size - 1) / 2;
  const d = (Math.abs(x - mid) + Math.abs(y - mid)) / size;
  if (d < 0.22) return rng() < 0.75 ? 3 : 2;
  if (d < 0.42) return rng() < 0.65 ? 2 : 3;
  return rng() < 0.55 ? 2 : 1;
}

function districtType(style, size, x, y, rng) {
  const { min, max } = innerBounds(size);
  const mid = Math.floor((min + max) / 2);
  const third = Math.floor((max - min) / 3);
  if (style === 'harbor-spine') {
    return y <= mid ? pick(rng, ['residential', 'commercial']) : 'industrial';
  }
  if (style === 'industrial-ring') {
    const edge = x <= min + 2 || x >= max - 2 || y <= min + 2 || y >= max - 2;
    return edge ? 'industrial' : pick(rng, ['residential', 'commercial']);
  }
  if (style === 'campus') {
    return x >= mid ? pick(rng, ['industrial', 'commercial']) : 'residential';
  }
  if (style === 'twin-cores') {
    return y < min + third + 1 ? pick(rng, ['residential', 'commercial']) : pick(rng, ['industrial', 'commercial']);
  }
  if (style === 'sprawl') {
    return pick(rng, ['residential', 'residential', 'commercial', 'industrial']);
  }
  if (x < mid && y < mid) return 'residential';
  if (x >= mid && y < mid) return 'commercial';
  if (x < mid && y >= mid) return 'industrial';
  return pick(rng, ['residential', 'commercial']);
}

function placeRoadLine(map, size, axis, index) {
  const { min, max } = innerBounds(size);
  for (let i = min; i <= max; i++) {
    if (axis === 'x') add(map, index, i, 'road');
    else add(map, i, index, 'road');
  }
}

function placeStreetGrid(map, size) {
  const { min, max } = innerBounds(size);
  const step = 3;
  for (let i = min + 1; i <= max; i += step) {
    placeRoadLine(map, size, 'y', i);
    placeRoadLine(map, size, 'x', i);
  }
}

function emptyRoadAdjacent(map, size, rng, tries = 80) {
  const { min, max } = innerBounds(size);
  for (let i = 0; i < tries; i++) {
    const x = min + Math.floor(rng() * (max - min + 1));
    const y = min + Math.floor(rng() * (max - min + 1));
    if (map.has(key(x, y))) continue;
    const nextToRoad =
      map.get(key(x - 1, y))?.type === 'road' ||
      map.get(key(x + 1, y))?.type === 'road' ||
      map.get(key(x, y - 1))?.type === 'road' ||
      map.get(key(x, y + 1))?.type === 'road';
    if (nextToRoad) return { x, y };
  }
  return null;
}

function addUtilities(map, size, rng) {
  const plants = ['power-plant-petroleum'];
  if (size >= 16) plants.push('power-plant-nuclear');
  if (size >= 20) plants.push('power-plant-petroleum');
  if (size >= 24) plants.push('power-plant-nuclear');
  for (const type of plants) {
    const spot = emptyRoadAdjacent(map, size, rng);
    if (spot) add(map, spot.x, spot.y, type);
  }
  const fires = size >= 20 ? 4 : size >= 16 ? 3 : 2;
  for (let i = 0; i < fires; i++) {
    const spot = emptyRoadAdjacent(map, size, rng);
    if (spot) add(map, spot.x, spot.y, 'fire-station');
  }
}

/**
 * Finished street grid plus developed lots. Density is how many leftover lots get buildings.
 */
export function generateCityLayout({
  size = 16,
  density = 0.95,
  style = 'grid-quarters',
  seed = 1,
} = {}) {
  const rng = createRng(seed);
  const chosen = LAYOUT_STYLES.includes(style) ? style : pick(rng, LAYOUT_STYLES);
  const map = new Map();
  const { min, max } = innerBounds(size);

  placeStreetGrid(map, size);
  if (chosen === 'harbor-spine') placeRoadLine(map, size, 'x', min);
  if (chosen === 'industrial-ring') {
    placeRoadLine(map, size, 'x', min);
    placeRoadLine(map, size, 'x', max);
    placeRoadLine(map, size, 'y', min);
    placeRoadLine(map, size, 'y', max);
  }
  if (chosen === 'campus') {
    const mid = Math.floor((min + max) / 2);
    placeRoadLine(map, size, 'x', mid);
    placeRoadLine(map, size, 'y', mid);
  }

  addUtilities(map, size, rng);

  const lots = [];
  for (let x = min; x <= max; x++) {
    for (let y = min; y <= max; y++) {
      if (!map.has(key(x, y))) lots.push({ x, y });
    }
  }
  for (let i = lots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [lots[i], lots[j]] = [lots[j], lots[i]];
  }
  const fill = Math.round(lots.length * Math.min(1, Math.max(0.7, density)));
  for (let i = 0; i < fill; i++) {
    const { x, y } = lots[i];
    add(map, x, y, districtType(chosen, size, x, y, rng), { level: lotLevel(size, x, y, rng) });
  }

  return {
    style: chosen,
    seed,
    size,
    buildings: [...map.values()],
  };
}

