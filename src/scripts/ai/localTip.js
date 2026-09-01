/** Local planning tips when the AI API is unreachable. */
export function fallbackTip(stats = {}) {
  const residents = Number(stats.residents) || 0;
  const zones = Number(stats.developed_zones) || 0;
  const resilience = Number(stats.disaster_resilience) || 0;
  const capacity = Number(stats.power_capacity) || 0;
  const demand = Number(stats.power_demand) || 0;

  if (capacity < demand) {
    return 'Power demand is higher than supply. Add a plant and connect it with power lines before zones go dark.';
  }
  if (zones < 4) {
    return 'Place residential, commercial, and industrial zones along roads so people can live, shop, and work.';
  }
  if (resilience < 60) {
    return 'Spread buildings and add a fire station. Clustered zones take heavier disaster losses.';
  }
  if (residents < 50) {
    return 'Residential zones need roads and power at the edge of the tile before people will move in.';
  }
  return 'Keep RCI balanced, leave gaps between clusters, and save budget for repairs after random disasters.';
}
