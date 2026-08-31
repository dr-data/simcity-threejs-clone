import { DevelopmentState } from '../sim/buildings/modules/development.js';

const ZONE_TYPES = new Set(['residential', 'commercial', 'industrial']);

export function applyGeneratedLayout(city, buildings) {
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      city.bulldoze(x, y);
    }
  }
  for (const b of buildings || []) {
    if (b.x <= 0 || b.y <= 0 || b.x >= city.size - 1 || b.y >= city.size - 1) continue;
    city.placeBuilding(b.x, b.y, b.type);
    const building = city.getTile(b.x, b.y)?.building;
    if (building?.development && ZONE_TYPES.has(b.type)) {
      building.development.state = DevelopmentState.developed;
      building.development.level = Math.min(3, Math.max(1, b.level || 2));
    }
    if (building?.residents?.seedOccupants) {
      building.residents.seedOccupants();
    }
  }
  city.services.forEach((service) => service.simulate(city));
  return buildings?.length ?? 0;
}
