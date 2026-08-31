import { DISASTER_LEVELS } from './disasterConfig.js';
import { BuildingType } from '../sim/buildings/buildingType.js';

/** Fatality / injury rates by disaster type (fraction of residents in zone). */
const CASUALTY_PROFILE = {
  fire: { kill: 0.18, injure: 0.35 },
  flood: { kill: 0.08, injure: 0.25 },
  earthquake: { kill: 0.12, injure: 0.4 },
  typhoon: { kill: 0.1, injure: 0.3 },
  nuclear: { kill: 0.35, injure: 0.45 },
  meteor: { kill: 0.25, injure: 0.35 },
  blizzard: { kill: 0.04, injure: 0.15 },
  tornado: { kill: 0.1, injure: 0.3 },
};

const LEVEL_MULT = {
  minor: 0.45,
  moderate: 0.75,
  major: 1,
  catastrophic: 1.35,
};

/**
 * Tracks disaster impacts: casualties, injuries, repair & emergency costs.
 */
export class DisasterConsequences {
  casualties = 0;
  injured = 0;
  repairCost = 0;
  emergencySpend = 0;
  zonesDamaged = 0;
  roadsDestroyed = 0;
  disastersTriggered = 0;
  events = [];
  currentEvent = null;

  reset() {
    this.casualties = 0;
    this.injured = 0;
    this.repairCost = 0;
    this.emergencySpend = 0;
    this.zonesDamaged = 0;
    this.roadsDestroyed = 0;
    this.disastersTriggered = 0;
    this.events = [];
    this.currentEvent = null;
  }

  get totalCost() {
    return this.repairCost + this.emergencySpend;
  }

  /** Composite index: lower is better (0–100 scale). */
  get disasterIndex() {
    const harm =
      this.casualties * 8 +
      this.injured * 2 +
      this.zonesDamaged * 3 +
      this.roadsDestroyed * 2 +
      Math.floor(this.totalCost / 50);
    return Math.max(0, Math.min(100, Math.round(harm)));
  }

  recordDisasterTriggered() {
    this.disastersTriggered++;
  }

  startEvent({ type, level, source = 'manual' }) {
    this.currentEvent = {
      id: `${Date.now()}-${this.events.length}`,
      at: Date.now(),
      type,
      level,
      source,
      killed: 0,
      injured: 0,
      repairCost: 0,
      zonesDamaged: 0,
      roadsDestroyed: 0,
    };
    this.events.push(this.currentEvent);
    this.recordDisasterTriggered();
    return this.currentEvent;
  }

  getEvents() {
    return this.events.map((event) => ({ ...event }));
  }

  addEmergencySpend(amount) {
    this.emergencySpend += Math.max(0, amount);
  }

  recordRoadDestroyed() {
    this.roadsDestroyed++;
  }

  /**
   * Apply damage consequences to a zone/building.
   * @returns {{ killed: number, injured: number, repairCost: number }}
   */
  recordBuildingDamage(building, type, level) {
    const levelMeta = DISASTER_LEVELS[level] || DISASTER_LEVELS.moderate;
    const mult = LEVEL_MULT[level] || 1;
    const repair = Math.round((levelMeta.cost ?? 200) * mult);
    this.repairCost += repair;
    if (this.currentEvent) this.currentEvent.repairCost += repair;

    if (building?.type === BuildingType.road) {
      this.roadsDestroyed++;
      if (this.currentEvent) this.currentEvent.roadsDestroyed++;
      return { killed: 0, injured: 0, repairCost: repair };
    }

    if (
      building?.development &&
      [BuildingType.residential, BuildingType.commercial, BuildingType.industrial].includes(
        building.type
      )
    ) {
      this.zonesDamaged++;
      if (this.currentEvent) this.currentEvent.zonesDamaged++;
    }

    let killed = 0;
    let injured = 0;

    if (building?.residents) {
      const profile = CASUALTY_PROFILE[type] || CASUALTY_PROFILE.fire;
      const result = building.residents.applyDisasterCasualties(
        profile.kill * mult,
        profile.injure * mult
      );
      killed = result.killed;
      injured = result.injured;
      this.casualties += killed;
      this.injured += injured;
      if (this.currentEvent) {
        this.currentEvent.killed += killed;
        this.currentEvent.injured += injured;
      }
    }

    return { killed, injured, repairCost: repair };
  }

  getSnapshot() {
    return {
      casualties: this.casualties,
      injured: this.injured,
      disaster_cost: this.totalCost,
      repair_cost: this.repairCost,
      emergency_spend: this.emergencySpend,
      zones_damaged: this.zonesDamaged,
      roads_destroyed: this.roadsDestroyed,
      disasters_triggered: this.disastersTriggered,
      disaster_index: this.disasterIndex,
      disaster_log: this.getEvents(),
    };
  }

  formatSummary() {
    const parts = [];
    if (this.casualties > 0) parts.push(`${this.casualties} killed`);
    if (this.injured > 0) parts.push(`${this.injured} injured`);
    if (this.zonesDamaged > 0) parts.push(`${this.zonesDamaged} zones hit`);
    if (this.totalCost > 0) parts.push(`$${this.totalCost} cost`);
    return parts.length ? parts.join(', ') : 'No major harm';
  }
}
