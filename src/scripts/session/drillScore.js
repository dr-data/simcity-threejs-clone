export function expectedStrikes(minutesAllowed) {
  return Math.max(2, Math.round(Math.max(1, minutesAllowed) * 0.5));
}

export function rhythmMultiplier(strikes, minutesAllowed) {
  const expected = expectedStrikes(minutesAllowed);
  if (strikes <= 0) return 0.4;
  const ratio = strikes / expected;
  if (ratio <= 1) return 0.45 + 0.55 * ratio;
  return Math.max(0.5, 1.15 - 0.25 * (ratio - 1));
}

/**
 * Disaster-drill score.
 * Impact (harm, people, cost, buildings) is multiplied by strike rhythm.
 * Tempo pays leftover clock only if you actually hit the city.
 * Mix pays for using more than one disaster type.
 */
export function scoreDrill({
  buildingsDestroyed = 0,
  buildingsRemaining = 0,
  startingBuildings = 0,
  casualties = 0,
  injured = 0,
  disasterIndex = 0,
  disasterCost = 0,
  zonesDamaged = 0,
  roadsDestroyed = 0,
  durationSeconds = 0,
  durationAllowedSeconds = 15 * 60,
  disasterCount = 0,
  disasterTypes = [],
} = {}) {
  const start = startingBuildings || buildingsDestroyed + buildingsRemaining;
  const coverage = start > 0 ? buildingsDestroyed / start : 0;

  const impact = Math.round(
    buildingsDestroyed * 12 +
      zonesDamaged * 8 +
      roadsDestroyed * 4 +
      casualties * 16 +
      injured * 5 +
      disasterIndex * 6 +
      Math.floor(Math.max(0, disasterCost) / 20)
  );

  const allowed = Math.max(1, durationAllowedSeconds);
  const used = Math.min(allowed, Math.max(0, durationSeconds));
  const leftoverMin = Math.max(0, allowed - used) / 60;
  const tempo = Math.round(leftoverMin * 40 * coverage);

  const minutesAllowed = allowed / 60;
  const rhythmMul = rhythmMultiplier(disasterCount, minutesAllowed);
  const unique = new Set((disasterTypes || []).filter(Boolean)).size;
  const mix = unique * 35;
  const expected = expectedStrikes(minutesAllowed);
  const score = Math.max(0, Math.round(impact * rhythmMul + tempo + mix));

  return {
    score,
    impact,
    tempo,
    mix,
    rhythmMul,
    expectedStrikes: expected,
    strikes: disasterCount,
    coverage,
  };
}

export function computeDrillScore(input) {
  return scoreDrill(input).score;
}
