import { BuildingType } from '../buildingType.js';

/** All building types that count as power generators */
export const POWER_PLANT_TYPES = [
  BuildingType.powerPlant,
  BuildingType.powerPlantPetroleum,
  BuildingType.powerPlantNuclear,
];

export function isPowerPlant(building) {
  return building && POWER_PLANT_TYPES.includes(building.type);
}

export function isNuclearPlant(building) {
  return building?.type === BuildingType.powerPlantNuclear;
}
