/** How long infrastructure stays failed, in simulation steps (about one second at 1×). */

const LEVEL_SCALE = {
  minor: 0.65,
  moderate: 1,
  major: 1.35,
  catastrophic: 1.8,
};

function scaled(base, level) {
  const factor = LEVEL_SCALE[level] ?? 1;
  return Math.max(8, Math.round(base * factor));
}

/**
 * Extra service failures on top of wrecked buildings.
 * Grid failure leaves the buildings standing and cuts power, water, and communications together.
 */
export function shockFor(type, level = 'major') {
  if (type === 'grid') {
    const ticks = { minor: 20, moderate: 35, major: 50, catastrophic: 80 }[level] ?? 50;
    return { grid: ticks, comms: ticks, waterfront: 0 };
  }
  if (type === 'typhoon') {
    return { grid: 0, comms: scaled(18, level), waterfront: scaled(40, level) };
  }
  if (type === 'flood') {
    return { grid: 0, comms: 0, waterfront: scaled(45, level) };
  }
  if (type === 'earthquake') {
    return { grid: 0, comms: scaled(24, level), waterfront: 0 };
  }
  return { grid: 0, comms: 0, waterfront: 0 };
}

export function applyShock(city, type, level) {
  if (!city) return null;
  const shock = shockFor(type, level);
  city.gridOutageTicks = Math.max(city.gridOutageTicks || 0, shock.grid);
  city.commsOutageTicks = Math.max(city.commsOutageTicks || 0, shock.comms);
  city.waterfrontCutTicks = Math.max(city.waterfrontCutTicks || 0, shock.waterfront);
  return shock;
}
