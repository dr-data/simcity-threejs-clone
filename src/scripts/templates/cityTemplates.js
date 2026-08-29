import * as THREE from 'three';
import { BuildingType } from '../sim/buildings/buildingType.js';
import { createBuilding } from '../sim/buildings/buildingFactory.js';

/**
 * Predefined city layouts for classroom scenarios.
 */
export const CITY_TEMPLATES = {
  blank: {
    name: 'Blank Slate',
    description: 'Empty grid — plan from scratch.',
    budget: 5000,
    buildings: [],
  },
  'small-town': {
    name: 'Small Town',
    description: 'Balanced starter with roads, power, and mixed zones.',
    budget: 4000,
    buildings: [
      { x: 7, y: 7, type: 'power-plant' },
      { x: 6, y: 7, type: 'power-line' },
      { x: 8, y: 7, type: 'power-line' },
      { x: 7, y: 6, type: 'road' },
      { x: 7, y: 8, type: 'road' },
      { x: 6, y: 6, type: 'road' },
      { x: 8, y: 6, type: 'road' },
      { x: 6, y: 8, type: 'road' },
      { x: 8, y: 8, type: 'road' },
      { x: 5, y: 6, type: 'residential' },
      { x: 5, y: 7, type: 'residential' },
      { x: 9, y: 6, type: 'commercial' },
      { x: 9, y: 7, type: 'commercial' },
      { x: 5, y: 8, type: 'industrial' },
    ],
  },
  industrial: {
    name: 'Industrial Hub',
    description: 'Heavy industry focus — balance jobs and pollution trade-offs.',
    budget: 3500,
    buildings: [
      { x: 8, y: 8, type: 'power-plant' },
      { x: 7, y: 8, type: 'power-line' },
      { x: 9, y: 8, type: 'power-line' },
      { x: 6, y: 7, type: 'road' },
      { x: 7, y: 7, type: 'road' },
      { x: 8, y: 7, type: 'road' },
      { x: 9, y: 7, type: 'road' },
      { x: 10, y: 7, type: 'road' },
      { x: 5, y: 6, type: 'industrial' },
      { x: 5, y: 7, type: 'industrial' },
      { x: 5, y: 8, type: 'industrial' },
      { x: 10, y: 6, type: 'residential' },
      { x: 10, y: 8, type: 'residential' },
    ],
  },
  balanced: {
    name: 'Balanced City',
    description: 'Equal RCI zones with infrastructure — good for 15-min sessions.',
    budget: 4500,
    buildings: [
      { x: 8, y: 8, type: 'power-plant' },
      { x: 7, y: 8, type: 'power-line' },
      { x: 9, y: 8, type: 'power-line' },
      { x: 7, y: 7, type: 'road' },
      { x: 8, y: 7, type: 'road' },
      { x: 9, y: 7, type: 'road' },
      { x: 6, y: 6, type: 'residential' },
      { x: 6, y: 7, type: 'residential' },
      { x: 10, y: 6, type: 'commercial' },
      { x: 10, y: 7, type: 'commercial' },
      { x: 6, y: 9, type: 'industrial' },
      { x: 10, y: 9, type: 'industrial' },
    ],
  },
};

export function applyTemplate(city, templateId) {
  const template = CITY_TEMPLATES[templateId];
  if (!template) return null;

  // Clear city
  for (let x = 0; x < city.size; x++) {
    for (let y = 0; y < city.size; y++) {
      city.bulldoze(x, y);
    }
  }

  for (const b of template.buildings) {
    city.placeBuilding(b.x, b.y, b.type);
  }

  return { budget: template.budget, name: template.name };
}

export function placeZonesInArea(city, type, count) {
  let placed = 0;
  for (let x = 0; x < city.size && placed < count; x++) {
    for (let y = 0; y < city.size && placed < count; y++) {
      const tile = city.getTile(x, y);
      if (!tile.building) {
        city.placeBuilding(x, y, type);
        placed++;
      }
    }
  }
  return placed;
}

export function placePowerPlants(city, count) {
  let placed = 0;
  for (let x = 0; x < city.size && placed < count; x++) {
    for (let y = 0; y < city.size && placed < count; y++) {
      const tile = city.getTile(x, y);
      if (!tile.building) {
        city.placeBuilding(x, y, BuildingType.powerPlant);
        placed++;
      }
    }
  }
  return placed;
}
