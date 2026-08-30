import * as THREE from 'three';
import { BuildingType } from '../sim/buildings/buildingType.js';
import { DevelopmentState } from '../sim/buildings/modules/development.js';
import { isPowerPlant } from '../sim/buildings/power/powerPlantTypes.js';
import { DISASTER_LEVELS } from './disasterConfig.js';
import { DisasterZoneVisuals } from './disasterZoneVisuals.js';

const RCI = [BuildingType.residential, BuildingType.commercial, BuildingType.industrial];

const LEVEL_SCALE = {
  minor: 1,
  moderate: 1.4,
  major: 1.8,
  catastrophic: 2.4,
};

/**
 * Area-based disasters: floods, spreading fires, typhoon paths, radiation zones.
 */
export class DisasterAreaSim {
  floods = [];
  fires = [];
  typhoons = [];
  radiationZones = [];

  zoneVisuals = new DisasterZoneVisuals();

  constructor(game, animationManager) {
    this.game = game;
    this.animations = animationManager;
  }

  attachToCity(city) {
    this.zoneVisuals.attachToCity(city);
  }

  update() {
    const now = performance.now();
    this.#updateFloods(now);
    this.#updateFires(now);
    this.#updateTyphoons(now);
    this.#updateRadiation(now);
    this.zoneVisuals.update(now, this);
    this.zoneVisuals.syncFromCity(this.game.city, this);
  }

  dispatchFirefighters() {
    let reduced = 0;
    for (const fire of this.fires) {
      for (const cell of fire.cells.values()) {
        cell.intensity = Math.max(0, cell.intensity - 0.45);
        reduced++;
      }
    }
    this.fires = this.fires.filter((f) => {
      for (const c of f.cells.values()) if (c.intensity > 0.05) return true;
      return false;
    });
    return reduced;
  }

  startFlood(level = 'moderate') {
    const city = this.game.city;
    const waterfront = city.getWaterfrontTiles();
    if (waterfront.length === 0) {
      window.ui?.showToast('No waterfront — map edges are water.');
      return false;
    }
    const origin = waterfront[Math.floor(Math.random() * waterfront.length)];
    const scale = LEVEL_SCALE[level] || 1.4;
    const maxDepth = Math.min(5, Math.ceil(2 * scale));
    const affected = this.#expandFrom(origin.x, origin.y, maxDepth, (x, y) => {
      const t = city.getTile(x, y);
      return t && t.terrain !== 'water';
    });

    const riseMs = 6000 * scale;
    const holdMs = 10000 * scale;
    const fallMs = 8000 * scale;

    const cells = new Map();
    for (const { x, y } of affected) {
      cells.set(city.tileKey(x, y), { x, y, intensity: 0, peak: 0.55 + Math.random() * 0.35 });
    }

    this.floods.push({
      level,
      cells,
      phase: 'rise',
      phaseStart: performance.now(),
      riseMs,
      holdMs,
      fallMs,
    });
    return true;
  }

  startFire(level = 'moderate', originTile = null) {
    const city = this.game.city;
    let tile = originTile;

    if (!tile) {
      const candidates = [];
      for (let x = 0; x < city.size; x++) {
        for (let y = 0; y < city.size; y++) {
          const t = city.getTile(x, y);
          const b = t?.building;
          if (!b?.development) continue;
          if (b.development.state === DevelopmentState.damaged) continue;
          if (RCI.includes(b.type)) {
            const weight =
              b.type === BuildingType.industrial ? 3 : b.development.state === DevelopmentState.abandoned ? 2 : 1;
            candidates.push({ tile: t, weight });
          }
        }
      }
      if (candidates.length === 0) return false;
      const total = candidates.reduce((s, c) => s + c.weight, 0);
      let roll = Math.random() * total;
      for (const c of candidates) {
        roll -= c.weight;
        if (roll <= 0) {
          tile = c.tile;
          break;
        }
      }
      tile = tile || candidates[0].tile;
    }

    const cells = new Map();
    cells.set(city.tileKey(tile.x, tile.y), {
      x: tile.x,
      y: tile.y,
      intensity: 0.55 + Math.random() * 0.25,
    });

    this.fires.push({
      level,
      cells,
      lastSpread: performance.now(),
      spreadInterval: 900 / (LEVEL_SCALE[level] || 1),
    });
    return true;
  }

  startTyphoon(level = 'moderate') {
    const city = this.game.city;
    const size = city.size;
    // Map border tiles are water — keep typhoon path on playable land (1..size-2).
    const innerMin = 1;
    const innerMax = size - 2;
    const innerSpan = Math.max(1, innerMax - innerMin);
    const edge = Math.floor(Math.random() * 4);
    let x0, y0, x1, y1;
    switch (edge) {
      case 0:
        x0 = innerMin + Math.floor(Math.random() * innerSpan);
        y0 = innerMin;
        x1 = innerMin + Math.floor(Math.random() * innerSpan);
        y1 = innerMax;
        break;
      case 1:
        x0 = innerMax;
        y0 = innerMin + Math.floor(Math.random() * innerSpan);
        x1 = innerMin;
        y1 = innerMin + Math.floor(Math.random() * innerSpan);
        break;
      case 2:
        x0 = innerMin;
        y0 = innerMin + Math.floor(Math.random() * innerSpan);
        x1 = innerMax;
        y1 = innerMin + Math.floor(Math.random() * innerSpan);
        break;
      default:
        x0 = innerMin + Math.floor(Math.random() * innerSpan);
        y0 = innerMax;
        x1 = innerMin + Math.floor(Math.random() * innerSpan);
        y1 = innerMin;
        break;
    }

    const path = this.#bresenham(x0, y0, x1, y1);
    const scale = LEVEL_SCALE[level] || 1.4;

    this.typhoons.push({
      level,
      path,
      progress: 0,
      speed: 0.018 * scale,
      radius: Math.min(2, Math.ceil(scale)),
      hit: new Set(),
    });
    return true;
  }

  startMeltdown(x, y, level = 'catastrophic') {
    const city = this.game.city;
    const scale = LEVEL_SCALE[level] || 2;
    const radius = Math.min(5, Math.ceil(2 + scale));

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) + Math.abs(dy) > radius) continue;
        const t = city.getTile(x + dx, y + dy);
        if (!t) continue;
        t.isRadioactive = true;
        t.hazardType = 'nuclear';
        t.hazardIntensity = Math.max(t.hazardIntensity, 0.85);
        this.#damageTileBuilding(t, 'nuclear', level, true);
      }
    }

    this.radiationZones.push({
      x,
      y,
      radius,
      level,
      start: performance.now(),
      duration: 120000 * scale,
    });
    return true;
  }

  checkNuclearMeltdownTrigger(cause) {
    const city = this.game.city;
    const plants = city.getNuclearPlants();
    for (const { x, y, building } of plants) {
      const chance = cause === 'earthquake' ? 0.35 : cause === 'fire' ? 0.25 : 0.15;
      if (Math.random() < chance) {
        this.startMeltdown(x, y, 'catastrophic');
        window.ui?.showToast('☢ Nuclear meltdown! Large area contaminated.');
        return true;
      }
    }
    return false;
  }

  runEarthquake(level) {
    const city = this.game.city;
    const scale = LEVEL_SCALE[level] || 1.4;
    const allTiles = [];
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const t = city.getTile(x, y);
        if (t?.building && t.terrain !== 'water') allTiles.push(t);
      }
    }
    if (allTiles.length === 0) return { damaged: 0, fires: 0 };

    const hitCount = Math.max(1, Math.floor(allTiles.length * 0.22 * scale));
    const shuffled = [...allTiles].sort(() => Math.random() - 0.5).slice(0, hitCount);
    const zoneHits = [];

    for (const tile of shuffled) {
      const b = tile.building;
      if (b.type === BuildingType.road) {
        window.disasterManager?.consequences?.recordRoadDestroyed();
        city.bulldoze(tile.x, tile.y);
      } else if (RCI.includes(b.type) && b.development) {
        zoneHits.push(tile);
        this.animations.animateDamage(b, 'earthquake', level, DISASTER_LEVELS[level]?.repairTicks ?? 8, () => {});
      } else if (isPowerPlant(b) || b.type === BuildingType.fireStation) {
        this.#damageTileBuilding(tile, 'earthquake', level, false);
      }
    }

    const fireCount = Math.max(1, Math.floor(zoneHits.length * 0.25));
    for (let i = 0; i < fireCount && zoneHits.length > 0; i++) {
      const t = zoneHits[Math.floor(Math.random() * zoneHits.length)];
      this.startFire('minor', t);
    }

    this.checkNuclearMeltdownTrigger('earthquake');
    return { damaged: shuffled.length, fires: fireCount };
  }

  #updateFloods(now) {
    this.floods = this.floods.filter((flood) => {
      const elapsed = now - flood.phaseStart;
      let phaseDone = false;

      if (flood.phase === 'rise') {
        const t = Math.min(1, elapsed / flood.riseMs);
        for (const cell of flood.cells.values()) {
          cell.intensity = cell.peak * t;
          this.#setTileHazard(cell.x, cell.y, cell.intensity, 'flood');
          if (cell.intensity > 0.75) this.#tryFloodDamage(cell.x, cell.y, flood.level);
        }
        if (t >= 1) {
          flood.phase = 'hold';
          flood.phaseStart = now;
        }
      } else if (flood.phase === 'hold') {
        if (elapsed >= flood.holdMs) {
          flood.phase = 'fall';
          flood.phaseStart = now;
        }
      } else if (flood.phase === 'fall') {
        const t = Math.min(1, elapsed / flood.fallMs);
        for (const cell of flood.cells.values()) {
          cell.intensity = cell.peak * (1 - t);
          this.#setTileHazard(cell.x, cell.y, cell.intensity, 'flood');
        }
        if (t >= 1) {
          for (const cell of flood.cells.values()) {
            this.#clearTileHazard(cell.x, cell.y);
          }
          phaseDone = true;
        }
      }
      return !phaseDone;
    });
  }

  #updateFires(now) {
    const city = this.game.city;

    this.fires = this.fires.filter((fire) => {
      if (now - fire.lastSpread >= fire.spreadInterval) {
        fire.lastSpread = now;
        const toSpread = [];

        for (const cell of fire.cells.values()) {
          if (cell.intensity >= 0.85) {
            this.#damageTileBuilding(city.getTile(cell.x, cell.y), 'fire', fire.level, false);
          }
          const stations = city.countFireStationsNear(cell.x, cell.y);
          const decay = 0.02 + stations * 0.04;
          cell.intensity = Math.max(0, cell.intensity - decay);

          if (cell.intensity < 0.08) continue;

          const neighbors = city.getTileNeighbors(cell.x, cell.y);
          for (const n of neighbors) {
            if (!n || n.terrain === 'water') continue;
            const key = city.tileKey(n.x, n.y);
            if (fire.cells.has(key)) continue;
            if (!n.building) continue;
            if (!this.#isBurnable(n.building)) continue;
            const spreadChance = 0.22 / (1 + stations * 0.5);
            if (Math.random() < spreadChance) {
              toSpread.push({ x: n.x, y: n.y, intensity: cell.intensity * 0.65 });
            }
          }
        }

        for (const s of toSpread) {
          fire.cells.set(city.tileKey(s.x, s.y), s);
        }
      }

      let alive = false;
      for (const cell of fire.cells.values()) {
        if (cell.intensity > 0.05) {
          this.#setTileHazard(cell.x, cell.y, cell.intensity, 'fire');
          alive = true;
        } else {
          this.#clearTileHazard(cell.x, cell.y);
        }
      }
      return alive;
    });
  }

  #updateTyphoons(now) {
    const city = this.game.city;

    this.typhoons = this.typhoons.filter((ty) => {
      ty.progress += ty.speed;
      const idx = Math.floor(ty.progress * ty.path.length);
      if (idx >= ty.path.length) return false;

      const center = ty.path[idx];
      for (let dx = -ty.radius; dx <= ty.radius; dx++) {
        for (let dy = -ty.radius; dy <= ty.radius; dy++) {
          if (Math.abs(dx) + Math.abs(dy) > ty.radius) continue;
          const x = center.x + dx;
          const y = center.y + dy;
          const key = city.tileKey(x, y);
          if (ty.hit.has(key)) continue;
          const tile = city.getTile(x, y);
          if (!tile?.building || tile.terrain === 'water') continue;
          ty.hit.add(key);
          const b = tile.building;
          if (b.type === BuildingType.road) {
            window.disasterManager?.consequences?.recordRoadDestroyed();
            city.bulldoze(x, y);
          } else if (RCI.includes(b.type) && b.development) {
            this.animations.animateDamage(b, 'typhoon', ty.level, DISASTER_LEVELS[ty.level]?.repairTicks ?? 6, () => {});
          }
          this.#setTileHazard(x, y, 0.75, 'typhoon');
          setTimeout(() => this.#clearTileHazard(x, y), 4500);
        }
      }
      return ty.progress < 1.05;
    });
  }

  #updateRadiation(now) {
    this.radiationZones = this.radiationZones.filter((z) => {
      const alive = now - z.start < z.duration;
      if (!alive) {
        const city = this.game.city;
        for (let dx = -z.radius; dx <= z.radius; dx++) {
          for (let dy = -z.radius; dy <= z.radius; dy++) {
            const t = city.getTile(z.x + dx, z.y + dy);
            if (t) {
              t.isRadioactive = false;
              t.hazardIntensity = 0;
            }
          }
        }
      }
      return alive;
    });
  }

  #setTileHazard(x, y, intensity, type) {
    const tile = this.game.city.getTile(x, y);
    if (tile) {
      tile.hazardIntensity = Math.max(tile.hazardIntensity, intensity);
      if (type) tile.hazardType = type;
    }
  }

  #clearTileHazard(x, y) {
    const tile = this.game.city.getTile(x, y);
    if (tile && !tile.isRadioactive) {
      tile.hazardIntensity = 0;
      tile.hazardType = null;
    }
  }

  #tryFloodDamage(x, y, level) {
    const tile = this.game.city.getTile(x, y);
    if (!tile?.building) return;
    const b = tile.building;
    if (RCI.includes(b.type) && b.development?.state !== DevelopmentState.damaged) {
      if (Math.random() < 0.15) {
        this.animations.animateDamage(b, 'flood', level, DISASTER_LEVELS[level]?.repairTicks ?? 5, () => {});
      }
    }
  }

  #damageTileBuilding(tile, type, level, force) {
    if (!tile?.building) return;
    const b = tile.building;
    if (RCI.includes(b.type) && b.development) {
      if (b.development.state !== DevelopmentState.damaged || force) {
        this.animations.animateDamage(
          b,
          type,
          level,
          DISASTER_LEVELS[level]?.repairTicks ?? 8,
          () => {}
        );
      }
    }
  }

  #isBurnable(building) {
    if (!building) return false;
    if (RCI.includes(building.type)) return true;
    return false;
  }

  #expandFrom(sx, sy, depth, valid) {
    const city = this.game.city;
    const result = [];
    const queue = [{ x: sx, y: sy, d: 0 }];
    const seen = new Set([city.tileKey(sx, sy)]);

    while (queue.length) {
      const { x, y, d } = queue.shift();
      if (!valid(x, y)) continue;
      result.push({ x, y });
      if (d >= depth) continue;
      for (const n of city.getTileNeighbors(x, y)) {
        if (!n) continue;
        const k = city.tileKey(n.x, n.y);
        if (seen.has(k)) continue;
        seen.add(k);
        queue.push({ x: n.x, y: n.y, d: d + 1 });
      }
    }
    return result;
  }

  #bresenham(x0, y0, x1, y1) {
    const path = [];
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    while (true) {
      path.push({ x, y });
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return path;
  }
}
