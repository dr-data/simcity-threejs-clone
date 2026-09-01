export const LEVEL_SCALE = {
  minor: 1,
  moderate: 1.4,
  major: 1.8,
  catastrophic: 2.4,
};

export const FIRE_DAMAGE_INTENSITY = 0.32;
export const FLOOD_DAMAGE_INTENSITY = 0.32;

export function fireStartIntensity(level) {
  const scale = LEVEL_SCALE[level] || 1.4;
  return Math.min(1, 0.78 + 0.1 * scale);
}

export function fireDecayPerSpread(stationCount) {
  return 0.006 + Math.max(0, stationCount) * 0.01;
}

export function fireSpreadChance(stationCount) {
  return 0.42 / (1 + Math.max(0, stationCount) * 0.22);
}

export function floodMaxDepth(level, citySize = 16) {
  const scale = LEVEL_SCALE[level] || 1.4;
  const inner = Math.max(2, Number(citySize) - 2);
  return Math.min(inner, Math.max(3, Math.ceil(3.2 * scale)));
}

export function shouldHitHazard(intensity, threshold, alreadyHit) {
  return !alreadyHit && intensity >= threshold;
}
