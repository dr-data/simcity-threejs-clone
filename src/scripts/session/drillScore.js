export function computeDrillScore({
  buildingsDestroyed = 0,
  buildingsRemaining = 0,
  startingBuildings = 0,
  disastersSurvived = 0,
  casualties = 0,
  injured = 0,
} = {}) {
  const start = startingBuildings || buildingsDestroyed + buildingsRemaining;
  const pct = start > 0 ? buildingsDestroyed / start : 0;
  const casualtyPenalty = casualties * 8 + injured * 3;
  return Math.max(
    0,
    Math.round(buildingsDestroyed * 12 + pct * 200 + disastersSurvived * 25 - casualtyPenalty)
  );
}
