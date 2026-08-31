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

function add(map, x, y, type) {
  if (!map.has(key(x, y))) map.set(key(x, y), { x, y, type });
}

function inInner(size, x, y) {
  const { min, max } = innerBounds(size);
  return x >= min && x <= max && y >= min && y <= max;
}

function emptyNear(map, size, rng, tries = 40) {
  const { min, max } = innerBounds(size);
  for (let i = 0; i < tries; i++) {
    const x = min + Math.floor(rng() * (max - min + 1));
    const y = min + Math.floor(rng() * (max - min + 1));
    if (!map.has(key(x, y))) return { x, y };
  }
  return null;
}

function placeRoadLine(map, size, axis, index) {
  const { min, max } = innerBounds(size);
  for (let i = min; i <= max; i++) {
    if (axis === 'x') add(map, index, i, 'road');
    else add(map, i, index, 'road');
  }
}

function fillDistrict(map, size, rng, x0, y0, x1, y1, types, remaining) {
  const cells = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (inInner(size, x, y) && !map.has(key(x, y))) cells.push({ x, y });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  let placed = 0;
  for (const cell of cells) {
    if (placed >= remaining) break;
    add(map, cell.x, cell.y, pick(rng, types));
    placed++;
  }
  return placed;
}

function addUtilities(map, size, rng) {
  const plants =
    size >= 20 ? ['power-plant-petroleum', 'power-plant-nuclear'] : ['power-plant-petroleum'];
  if (size >= 24) plants.push('power-plant');
  for (const type of plants) {
    const spot = emptyNear(map, size, rng);
    if (spot) add(map, spot.x, spot.y, type);
  }
  const fires = size >= 20 ? 3 : size >= 16 ? 2 : 1;
  for (let i = 0; i < fires; i++) {
    const spot = emptyNear(map, size, rng);
    if (spot) add(map, spot.x, spot.y, 'fire-station');
  }
}

function targetCount(size, density) {
  const inner = Math.max(1, size - 2);
  return Math.round(inner * inner * density);
}

/**
 * Build a seeded city layout. Larger size + density means more buildings to flatten.
 */
export function generateCityLayout({
  size = 16,
  density = 0.34,
  style = 'grid-quarters',
  seed = 1,
} = {}) {
  const rng = createRng(seed);
  const chosen = LAYOUT_STYLES.includes(style) ? style : pick(rng, LAYOUT_STYLES);
  const map = new Map();
  const { min, max } = innerBounds(size);
  const mid = Math.floor((min + max) / 2);
  const third = Math.floor((max - min) / 3);

  if (chosen === 'harbor-spine') {
    placeRoadLine(map, size, 'x', mid);
    placeRoadLine(map, size, 'y', min + 1);
  } else if (chosen === 'industrial-ring') {
    placeRoadLine(map, size, 'x', min + 1);
    placeRoadLine(map, size, 'x', max - 1);
    placeRoadLine(map, size, 'y', min + 1);
    placeRoadLine(map, size, 'y', max - 1);
  } else if (chosen === 'campus') {
    placeRoadLine(map, size, 'x', mid);
    placeRoadLine(map, size, 'y', mid);
  } else if (chosen === 'twin-cores') {
    placeRoadLine(map, size, 'y', min + third);
    placeRoadLine(map, size, 'y', max - third);
    placeRoadLine(map, size, 'x', mid);
  } else if (chosen === 'sprawl') {
    placeRoadLine(map, size, 'x', mid);
  } else {
    placeRoadLine(map, size, 'x', mid);
    placeRoadLine(map, size, 'y', mid);
  }

  addUtilities(map, size, rng);

  let remaining = Math.max(8, targetCount(size, density) - map.size);

  if (chosen === 'grid-quarters') {
    remaining -= fillDistrict(map, size, rng, min, min, mid - 1, mid - 1, ['residential'], Math.ceil(remaining * 0.3));
    remaining -= fillDistrict(map, size, rng, mid + 1, min, max, mid - 1, ['commercial'], Math.ceil(remaining * 0.35));
    remaining -= fillDistrict(map, size, rng, min, mid + 1, mid - 1, max, ['industrial'], Math.ceil(remaining * 0.4));
    remaining -= fillDistrict(
      map,
      size,
      rng,
      mid + 1,
      mid + 1,
      max,
      max,
      ['residential', 'commercial'],
      remaining
    );
  } else if (chosen === 'harbor-spine') {
    remaining -= fillDistrict(map, size, rng, min, min, max, mid, ['residential', 'commercial'], Math.ceil(remaining * 0.65));
    remaining -= fillDistrict(map, size, rng, min, mid + 1, max, max, ['industrial'], remaining);
  } else if (chosen === 'industrial-ring') {
    remaining -= fillDistrict(map, size, rng, min, min, max, min + 2, ['industrial'], Math.ceil(remaining * 0.25));
    remaining -= fillDistrict(map, size, rng, min, max - 2, max, max, ['industrial'], Math.ceil(remaining * 0.25));
    remaining -= fillDistrict(
      map,
      size,
      rng,
      mid - 2,
      mid - 2,
      mid + 2,
      mid + 2,
      ['residential', 'commercial'],
      remaining
    );
  } else if (chosen === 'campus') {
    remaining -= fillDistrict(map, size, rng, mid, min, max, mid, ['industrial', 'commercial'], Math.ceil(remaining * 0.4));
    remaining -= fillDistrict(map, size, rng, min, min, mid - 1, max, ['residential'], remaining);
  } else if (chosen === 'twin-cores') {
    const c = Math.ceil(remaining / 2);
    remaining -= fillDistrict(
      map,
      size,
      rng,
      min,
      min,
      mid,
      min + third + 1,
      ['residential', 'commercial'],
      c
    );
    remaining -= fillDistrict(
      map,
      size,
      rng,
      mid,
      max - third - 1,
      max,
      max,
      ['industrial', 'commercial'],
      remaining
    );
  } else {
    remaining -= fillDistrict(
      map,
      size,
      rng,
      min,
      min,
      max,
      max,
      ['residential', 'commercial', 'industrial'],
      remaining
    );
  }

  while (remaining > 0) {
    const spot = emptyNear(map, size, rng, 80);
    if (!spot) break;
    add(map, spot.x, spot.y, pick(rng, ['residential', 'commercial', 'industrial']));
    remaining--;
  }

  return {
    style: chosen,
    seed,
    size,
    buildings: [...map.values()],
  };
}

export function applyGeneratedLayout(city, buildings) {
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      city.bulldoze(x, y);
    }
  }
  for (const b of buildings || []) {
    if (b.x <= 0 || b.y <= 0 || b.x >= city.size - 1 || b.y >= city.size - 1) continue;
    city.placeBuilding(b.x, b.y, b.type);
  }
  return buildings?.length ?? 0;
}
