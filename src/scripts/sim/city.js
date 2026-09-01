import * as THREE from 'three';
import { BuildingType } from './buildings/buildingType.js';
import { createBuilding } from './buildings/buildingFactory.js';
import { Tile } from './tile.js';
import { VehicleGraph } from './vehicles/vehicleGraph.js';
import { PowerService } from './services/power.js';
import { SimService } from './services/simService.js';
import { DevelopmentState } from './buildings/modules/development.js';

export class City extends THREE.Group {
  /**
   * Separate group for organizing debug meshes so they aren't included
   * in raycasting checks
   * @type {THREE.Group}
   */
  debugMeshes = new THREE.Group();
  /**
   * Root node for all scene objects 
   * @type {THREE.Group}
   */
  root = new THREE.Group();
  /**
   * List of services for the city
   * @type {SimService}
   */
  services = [];
  /**
   * The size of the city in tiles
   * @type {number}
   */
  size = 16;
  /**
   * The current simulation time
   */
  simTime = 0;
  /**
   * 2D array of tiles that make up the city
   * @type {Tile[][]}
   */
  tiles = [];
  /**
   * 
   * @param {VehicleGraph} size 
   */
  vehicleGraph;

  constructor(size, name = 'My City') {
    super();

    this.name = name;
    this.size = size;
    
    this.add(this.debugMeshes);
    this.add(this.root);

    this.tiles = [];
    for (let x = 0; x < this.size; x++) {
      const column = [];
      for (let y = 0; y < this.size; y++) {
        const tile = new Tile(x, y);
        tile.refreshView(this);
        this.root.add(tile);
        column.push(tile);
      }
      this.tiles.push(column);
    }

    this.services = [];
    this.services.push(new PowerService());
    
    this.vehicleGraph = new VehicleGraph(this.size);
    this.debugMeshes.add(this.vehicleGraph);

    this.#initWaterEdges();
  }

  #initWaterEdges() {
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        if (x === 0 || y === 0 || x === this.size - 1 || y === this.size - 1) {
          const tile = this.tiles[x][y];
          tile.terrain = 'water';
          tile.refreshView(this);
        }
      }
    }
  }

  isWater(x, y) {
    const tile = this.getTile(x, y);
    return tile?.terrain === 'water';
  }

  /** Land tiles adjacent to water (flood origins) */
  getWaterfrontTiles() {
    const tiles = [];
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (!tile || tile.terrain === 'water') continue;
        const neighbors = this.getTileNeighbors(x, y);
        if (neighbors.some((n) => n?.terrain === 'water')) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  getTileNeighbors(x, y) {
    return [
      this.getTile(x - 1, y),
      this.getTile(x + 1, y),
      this.getTile(x, y - 1),
      this.getTile(x, y + 1),
    ];
  }

  countFireStationsNear(x, y, radius = 4) {
    let count = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const b = this.getTile(x + dx, y + dy)?.building;
        if (b?.type === BuildingType.fireStation) count++;
      }
    }
    return count;
  }

  getNuclearPlants() {
    const plants = [];
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const b = this.getTile(x, y)?.building;
        if (b?.type === BuildingType.powerPlantNuclear) {
          plants.push({ x, y, building: b });
        }
      }
    }
    return plants;
  }

  tileKey(x, y) {
    return `${x},${y}`;
  }

  /**
   * The total population of the city
   * @type {number}
   */
  get population() {
    let population = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        const building = tile.building;
        if (building?.development?.state === DevelopmentState.damaged) continue;
        population += building?.residents?.count ?? 0;
      }
    }
    return population;
  }

  /**
   * Count of developed (occupied) zones not damaged
   */
  getDevelopedZoneCount() {
    let count = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const b = this.getTile(x, y).building;
        if (
          b?.development &&
          b.development.state === DevelopmentState.developed
        ) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Percentage of zones undamaged (disaster resilience score 0-100)
   */
  getDisasterResilience() {
    let zones = 0;
    let undamaged = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const b = this.getTile(x, y).building;
        if (
          b &&
          [BuildingType.residential, BuildingType.commercial, BuildingType.industrial].includes(
            b.type
          )
        ) {
          zones++;
          if (b.development?.state !== DevelopmentState.damaged) {
            undamaged++;
          }
        }
      }
    }
    if (zones === 0) return 100;
    return Math.round((undamaged / zones) * 100);
  }

  getPowerStats() {
    let capacity = 0;
    let demand = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const b = this.getTile(x, y).building;
        if (b?.type === BuildingType.powerPlant || b?.type === BuildingType.powerPlantPetroleum || b?.type === BuildingType.powerPlantNuclear) {
          capacity += b.powerCapacity ?? 0;
        }
        if (b?.power?.required) {
          demand += b.power.required;
        }
      }
    }
    return { capacity, demand };
  }

  getSessionStats() {
    const buildings = this.countBuildings();
    return {
      residents: this.population,
      developedZones: this.getDevelopedZoneCount(),
      disasterResilience: this.getDisasterResilience(),
      power: this.getPowerStats(),
      buildings,
    };
  }

  countBuildings() {
    let n = 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const b = this.getTile(x, y)?.building;
        if (!b) continue;
        if (b.development?.state === DevelopmentState.damaged) continue;
        n++;
      }
    }
    return n;
  }

  serialize() {
    const buildings = [];
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        const tile = this.getTile(x, y);
        if (tile.building) {
          const b = tile.building;
          const entry = { x, y, type: b.type };
          if (b.development) {
            entry.state = b.development.state;
            entry.level = b.development.level;
            entry.repairCounter = b.development.repairCounter;
          }
          buildings.push(entry);
        }
      }
    }
    return { size: this.size, name: this.name, simTime: this.simTime, buildings };
  }

  deserialize(data) {
    if (!data) return;
    this.name = data.name || this.name;
    this.simTime = data.simTime || 0;
    for (let x = 0; x < this.size; x++) {
      for (let y = 0; y < this.size; y++) {
        this.bulldoze(x, y);
      }
    }
    for (const entry of data.buildings || []) {
      this.placeBuilding(entry.x, entry.y, entry.type);
      const tile = this.getTile(entry.x, entry.y);
      if (tile?.building?.development && entry.state) {
        tile.building.development.state = entry.state;
        if (entry.level) tile.building.development.level = entry.level;
        if (entry.repairCounter) tile.building.development.repairCounter = entry.repairCounter;
        tile.building.refreshView(this);
      }
    }
  }

  /** Returns the tile at the coordinates. If the coordinates
   * are out of bounds, then `null` is returned.
   * @param {number} x The x-coordinate of the tile
   * @param {number} y The y-coordinate of the tile
   * @returns {Tile | null}
   */
  getTile(x, y) {
    if (x === undefined || y === undefined ||
      x < 0 || y < 0 ||
      x >= this.size || y >= this.size) {
      return null;
    } else {
      return this.tiles[x][y];
    }
  }

  /**
   * Step the simulation forward by one step
   * @type {number} steps Number of steps to simulate forward in time
   */
  simulate(steps = 1) {
    let count = 0;
    while (count++ < steps) {
      // Update services
      this.services.forEach((service) => service.simulate(this));

      // Update each building
      for (let x = 0; x < this.size; x++) {
        for (let y = 0; y < this.size; y++) {
          this.getTile(x, y).simulate(this);
        }
      }
    }
    this.simTime++;
  }

  /**
   * Places a building at the specified coordinates if the
   * tile does not already have a building on it
   * @param {number} x 
   * @param {number} y 
   * @param {string} buildingType 
   */
  placeBuilding(x, y, buildingType) {
    const tile = this.getTile(x, y);

    if (!tile || tile.building) return;
    if (tile.terrain === 'water') return;

    tile.setBuilding(createBuilding(x, y, buildingType));
    tile.refreshView(this);

    this.getTile(x - 1, y)?.refreshView(this);
    this.getTile(x + 1, y)?.refreshView(this);
    this.getTile(x, y - 1)?.refreshView(this);
    this.getTile(x, y + 1)?.refreshView(this);

    if (tile.building.type === BuildingType.road) {
      this.vehicleGraph.updateTile(x, y, tile.building);
    }
  }

  /**
   * Bulldozes the building at the specified coordinates
   * @param {number} x 
   * @param {number} y
   */
  bulldoze(x, y) {
    const tile = this.getTile(x, y);

    if (tile.building) {
      if (tile.building.type === BuildingType.road) {
        this.vehicleGraph.updateTile(x, y, null);
      }

      tile.building.dispose();
      tile.setBuilding(null);
      tile.refreshView(this);

      // Update neighboring tiles in case they need to change their mesh (e.g. roads)
      this.getTile(x - 1, y)?.refreshView(this);
      this.getTile(x + 1, y)?.refreshView(this);
      this.getTile(x, y - 1)?.refreshView(this);
      this.getTile(x, y + 1)?.refreshView(this);
    }
  }

  draw() {
    this.vehicleGraph.updateVehicles();
  }

  /**
   * Finds the first tile where the criteria are true
   * @param {{x: number, y: number}} start The starting coordinates of the search
   * @param {(Tile) => (boolean)} filter This function is called on each
   * tile in the search field until `filter` returns true, or there are
   * no more tiles left to search.
   * @param {number} maxDistance The maximum distance to search from the starting tile
   * @returns {Tile | null} The first tile matching `criteria`, otherwiser `null`
   */
  findTile(start, filter, maxDistance) {
    const startTile = this.getTile(start.x, start.y);
    const visited = new Set();
    const tilesToSearch = [];

    // Initialze our search with the starting tile
    tilesToSearch.push(startTile);

    while (tilesToSearch.length > 0) {
      const tile = tilesToSearch.shift();

      // Has this tile been visited? If so, ignore it and move on
      if (visited.has(tile.id)) {
        continue;
      } else {
        visited.add(tile.id);
      }

      // Check if tile is outside the search bounds
      const distance = startTile.distanceTo(tile);
      if (distance > maxDistance) continue;

      // Add this tiles neighbor's to the search list
      tilesToSearch.push(...this.getTileNeighbors(tile.x, tile.y));

      // If this tile passes the criteria 
      if (filter(tile)) {
        return tile;
      }
    }

    return null;
  }

  /**
   * Finds and returns the neighbors of this tile
   * @param {number} x The x-coordinate of the tile
   * @param {number} y The y-coordinate of the tile
   */
  getTileNeighbors(x, y) {
    const neighbors = [];

    if (x > 0) {
      neighbors.push(this.getTile(x - 1, y));
    }
    if (x < this.size - 1) {
      neighbors.push(this.getTile(x + 1, y));
    }
    if (y > 0) {
      neighbors.push(this.getTile(x, y - 1));
    }
    if (y < this.size - 1) {
      neighbors.push(this.getTile(x, y + 1));
    }

    return neighbors;
  }
}