import { BuildingType } from '../sim/buildings/buildingType.js';
import { isPowerPlant } from '../sim/buildings/power/powerPlantTypes.js';

const ZONE_TYPES = new Set([
  BuildingType.residential,
  BuildingType.commercial,
  BuildingType.industrial,
]);

const OCCUPIED = new Set(['developed', 'abandoned', 'damaged']);

const LEVEL_NAME = {
  1: 'Older low-rise',
  2: 'Mid-rise',
  3: 'High-rise',
};

function hasElectricity(building, gridOut) {
  if (!building || gridOut) return false;
  if (building.state === 'damaged') return false;
  if (isPowerPlant(building)) return building.road !== false;
  if ((building.required ?? 0) <= 0) return true;
  return building.supplied >= building.required;
}

function groupLabel(level, waterfront) {
  const name = LEVEL_NAME[level] || `Level ${level}`;
  return waterfront ? `${name} homes on the harbour` : `${name} homes inland`;
}

/**
 * @param {{ gridOutageTicks?: number, commsOutageTicks?: number, waterfrontCutTicks?: number, tiles: object[] }} snapshot
 */
export function measureSnapshot(snapshot) {
  const tiles = snapshot?.tiles || [];
  const gridOut = (snapshot?.gridOutageTicks || 0) > 0;
  const commsOut = (snapshot?.commsOutageTicks || 0) > 0 || gridOut;
  const waterfrontCut = (snapshot?.waterfrontCutTicks || 0) > 0;

  const plants = tiles.filter((tile) => tile.building && isPowerPlant(tile.building));
  const waterworks =
    !gridOut &&
    plants.some((tile) => tile.building.road !== false && tile.building.state !== 'damaged');

  let people = 0;
  let withoutPower = 0;
  let withoutWater = 0;
  let withoutComms = 0;
  let shops = 0;
  let stations = 0;
  let plantsOffline = 0;
  const groups = new Map();

  for (const tile of tiles) {
    const building = tile.building;
    if (!building) continue;

    if (isPowerPlant(building) && (gridOut || building.road === false || building.state === 'damaged')) {
      plantsOffline += 1;
    }
    if (building.type === BuildingType.fireStation && gridOut) stations += 1;

    if (building.type === BuildingType.commercial && OCCUPIED.has(building.state)) {
      if (building.state === 'damaged' || !hasElectricity(building, gridOut)) shops += 1;
    }

    if (building.type !== BuildingType.residential) continue;
    const residents = building.residents || 0;
    if (residents <= 0) continue;
    people += residents;

    const powered = hasElectricity(building, gridOut);
    const water = powered && waterworks && !(waterfrontCut && tile.waterfront);
    const comms = powered && !commsOut;

    if (!powered) withoutPower += residents;
    if (!water) withoutWater += residents;
    if (!comms) withoutComms += residents;

    const affected = !powered || !water || !comms || building.state === 'damaged';
    if (!affected) continue;
    const level = building.level || 1;
    const key = `${level}|${tile.waterfront ? 'harbour' : 'inland'}`;
    const current = groups.get(key) || {
      level,
      waterfront: Boolean(tile.waterfront),
      count: 0,
    };
    current.count += residents;
    groups.set(key, current);
  }

  let most = null;
  for (const group of groups.values()) {
    if (!most || group.count > most.count) {
      most = group;
      continue;
    }
    if (group.count < most.count) continue;
    if (group.waterfront && !most.waterfront) most = group;
    else if (group.waterfront === most.waterfront && group.level < most.level) most = group;
  }

  const detailParts = [];
  if (shops) detailParts.push(`${shops} shop${shops === 1 ? '' : 's'} closed`);
  if (stations) detailParts.push(`${stations} fire station${stations === 1 ? '' : 's'} out`);
  if (plantsOffline) detailParts.push(`${plantsOffline} power plant${plantsOffline === 1 ? '' : 's'} offline`);

  const mostAffected = most
    ? `${groupLabel(most.level, most.waterfront)} (${most.count} people)`
    : 'No one is cut off';

  return {
    people,
    withoutPower,
    withoutWater,
    withoutComms,
    servicesLost: shops + stations + plantsOffline,
    servicesDetail: detailParts.join(', ') || 'Services running',
    mostAffected,
    mostAffectedCount: most?.count || 0,
    gridOut,
    commsOut,
    waterfrontCut,
    waterworks,
  };
}

export function cascadeSentence(metrics) {
  if (!metrics) return '';
  if (metrics.gridOut && metrics.withoutWater > 0) {
    return 'The grid is down, so pumps and mobile networks stop even where the buildings are still standing.';
  }
  if (metrics.waterfrontCut && metrics.withoutWater > 0 && metrics.withoutPower < metrics.withoutWater) {
    return 'Harbour homes have lost water. Inland homes keep water only while they still have power.';
  }
  if (metrics.withoutPower > 0 && metrics.withoutWater >= metrics.withoutPower) {
    return 'Homes without power also lose water, because the pumps need electricity.';
  }
  if (metrics.commsOut && metrics.withoutComms > 0) {
    return 'Communications are down. Exchanges and rooftop towers fail in a typhoon or an earthquake.';
  }
  return '';
}

export function cityToSnapshot(city) {
  const tiles = [];
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      const tile = city.getTile(x, y);
      if (!tile) continue;
      const building = tile.building;
      const neighbors = city.getTileNeighbors(x, y);
      tiles.push({
        x,
        y,
        terrain: tile.terrain,
        waterfront:
          tile.terrain !== 'water' && neighbors.some((neighbor) => neighbor?.terrain === 'water'),
        building: building
          ? {
              type: building.type,
              residents: building.residents?.count ?? 0,
              level: building.development?.level ?? 1,
              state: building.development?.state ?? '',
              supplied: building.power?.supplied ?? 0,
              required: building.power?.required ?? 0,
              road: building.roadAccess?.value !== false,
            }
          : null,
      });
    }
  }
  return {
    gridOutageTicks: city.gridOutageTicks || 0,
    commsOutageTicks: city.commsOutageTicks || 0,
    waterfrontCutTicks: city.waterfrontCutTicks || 0,
    tiles,
  };
}

export function measureCity(city) {
  if (!city) {
    return measureSnapshot({ tiles: [] });
  }
  return measureSnapshot(cityToSnapshot(city));
}
