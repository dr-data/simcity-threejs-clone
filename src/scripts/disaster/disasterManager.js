import { DevelopmentState } from '../sim/buildings/modules/development.js';
import { BuildingType } from '../sim/buildings/buildingType.js';
import {
  DISASTER_TYPES,
  DISASTER_LEVELS,
  pickRandomType,
  pickRandomLevel,
} from './disasterConfig.js';
import { DisasterAnimationManager } from './disasterAnimations.js';
import { DisasterAreaSim } from './disasterAreaSim.js';
import { DisasterConsequences } from './disasterConsequences.js';

/**
 * Disaster scheduling, area effects, and global screen feedback.
 */
export class DisasterManager {
  disasterCount = 0;
  totalZonesAtStart = 0;
  damagedZones = 0;
  overlayEl = null;
  shakeIntensity = 0;
  animations = new DisasterAnimationManager();
  areaSim = null;
  consequences = new DisasterConsequences();

  constructor(game) {
    this.game = game;
    this.overlayEl = document.getElementById('disaster-overlay');
    this.areaSim = new DisasterAreaSim(game, this.animations);
    this.frequencyMin = 1;
    this.frequencyMax = 3;
    this.severity = 0.25;
    this._plannedDisasters = 0;
    this._nextDisasterTime = 0;
  }

  configure(frequencyMin, frequencyMax, severity) {
    this.frequencyMin = frequencyMin;
    this.frequencyMax = frequencyMax;
    this.severity = severity;
    this._plannedDisasters =
      frequencyMin + Math.floor(Math.random() * (frequencyMax - frequencyMin + 1));
    this._scheduleNext();
  }

  _scheduleNext() {
    if (this.disasterCount >= this._plannedDisasters) return;
    const sessionMs = window.sessionManager?.durationMs || 15 * 60 * 1000;
    const remaining = this._plannedDisasters - this.disasterCount;
    const slot = sessionMs / (remaining + 1);
    this._nextDisasterTime = Date.now() + slot * (0.5 + Math.random());
  }

  onSessionStart(city) {
    this.disasterCount = 0;
    this.damagedZones = 0;
    this.consequences.reset();
    this.totalZonesAtStart = city.getDevelopedZoneCount();
    this.areaSim.attachToCity(city);
    this.configure(
      window.gameConfig?.disasterFrequencyMin ?? 1,
      window.gameConfig?.disasterFrequencyMax ?? 3,
      window.gameConfig?.disasterSeverity ?? 0.25
    );
  }

  update() {
    this.animations.update();
    this.areaSim.update();

    if (!window.sessionManager?.isActive) return;
    if (window.ui?.godMode) return;
    if (this.disasterCount >= this._plannedDisasters) return;
    if (Date.now() >= this._nextDisasterTime) {
      this.triggerRandomDisaster();
    }
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.88;
      if (this.shakeIntensity < 0.01) this.shakeIntensity = 0;
    }
  }

  triggerRandomDisaster() {
    const city = this.game.city;
    for (let attempt = 0; attempt < 6; attempt++) {
      const type = pickRandomType();
      if (type === 'nuclear' && city.getNuclearPlants().length === 0) continue;
      this.triggerDisaster(type, pickRandomLevel(), 'random');
      return;
    }
    this.triggerDisaster('fire', pickRandomLevel(), 'random');
  }

  triggerDisaster(type, level = 'moderate', source = 'manual') {
    this.areaSim.attachToCity(this.game.city);

    const typeMeta = DISASTER_TYPES[type] || DISASTER_TYPES.fire;
    const levelMeta = DISASTER_LEVELS[level] || DISASTER_LEVELS.moderate;

    if (type === 'nuclear' && this.game.city.getNuclearPlants().length === 0) {
      window.ui?.showToast('Build a nuclear plant first (or use petroleum only).');
      return;
    }

    this._playEffects(type, level, 1, typeMeta, levelMeta);
    this.consequences.startEvent({ type, level, source });

    let ok = false;
    let messageExtra = '';

    switch (type) {
      case 'flood':
        ok = this.areaSim.startFlood(level);
        break;
      case 'fire':
        ok = this.areaSim.startFire(level);
        break;
      case 'typhoon':
        ok = this.areaSim.startTyphoon(level);
        break;
      case 'earthquake':
        const eq = this.areaSim.runEarthquake(level);
        ok = eq.damaged > 0;
        messageExtra = `${eq.damaged} structures hit, ${eq.fires} fires started`;
        break;
      case 'nuclear':
        const plants = this.game.city.getNuclearPlants();
        const p = plants[Math.floor(Math.random() * plants.length)];
        ok = this.areaSim.startMeltdown(p.x, p.y, level);
        messageExtra = 'Radioactive zone — area uninhabitable!';
        break;
      default:
        ok = this.#triggerInstant(type, level, typeMeta, levelMeta);
        break;
    }

    this._showMessage(type, level, typeMeta, levelMeta, messageExtra);

    if (!ok && type !== 'earthquake') {
      window.ui?.showToast('Disaster could not start — check map conditions.');
      return;
    }

    this.disasterCount++;
    this._scheduleNext();
    this._finishDisasterStats();

    const summary = this.consequences.formatSummary();
    if (summary && summary !== 'No major harm') {
      window.ui?.showToast(`Impact: ${summary}`);
    }
  }

  recordBuildingDamage(building, type, level) {
    const result = this.consequences.recordBuildingDamage(building, type, level);
    if (building?.development) this.damagedZones++;
    window.ui?.updateDisasterStats?.();
    return result;
  }

  dispatchFirefighters() {
    const n = this.areaSim.dispatchFirefighters();
    if (n > 0) {
      if (!window.ui?.godMode) {
        this.consequences.addEmergencySpend(150);
        window.ui?.updateDisasterStats?.();
      }
      window.ui?.showToast(`Fire crews dispatched! (${n} fire zones targeted)`);
      return true;
    }
    window.ui?.showToast('No active fires to fight.');
    return false;
  }

  #triggerInstant(type, level, typeMeta, levelMeta) {
    const city = this.game.city;
    const zones = [];
    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        const b = tile?.building;
        if (
          b &&
          [BuildingType.residential, BuildingType.commercial, BuildingType.industrial].includes(
            b.type
          ) &&
          b.development?.state !== DevelopmentState.damaged
        ) {
          zones.push(tile);
        }
      }
    }
    if (zones.length === 0) return false;

    const severity = Math.min(0.85, this.severity * (levelMeta.severityMult / 0.25));
    const hitCount = Math.max(1, Math.floor(zones.length * severity));
    const developed = zones.filter(
      (t) => t.building.development?.state === DevelopmentState.developed
    );
    const pool = developed.length > 0 ? developed : zones;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, hitCount);

    let completed = 0;
    shuffled.forEach((tile, i) => {
      setTimeout(() => {
        this.animations.animateDamage(
          tile.building,
          type,
          level,
          levelMeta.repairTicks,
          () => {
            this.damagedZones++;
            completed++;
          }
        );
      }, i * 80);
    });
    return true;
  }

  _finishDisasterStats() {
    const city = this.game.city;
    const resilience = city.getDisasterResilience();
    const damagePercent = 100 - resilience;
    if (window.sessionManager) {
      window.sessionManager.recordDisasterSurvived(damagePercent);
    }
  }

  _playEffects(type, level, hitCount, typeMeta, levelMeta) {
    const levelShake = level === 'catastrophic' ? 1.5 : level === 'major' ? 1.2 : 1;
    this.shakeIntensity = Math.min(1.5, hitCount * 0.12 * typeMeta.shake * levelShake);
    if (this.overlayEl) {
      this.overlayEl.style.background = typeMeta.overlay;
      this.overlayEl.style.opacity = '1';
      const fadeMs = level === 'catastrophic' ? 2200 : 1600;
      setTimeout(() => {
        this.overlayEl.style.opacity = '0';
      }, fadeMs);
    }
  }

  _showMessage(type, level, typeMeta, levelMeta, extra = '') {
    const el = document.getElementById('disaster-message');
    if (!el) return;
    const detail =
      extra ||
      (DISASTER_TYPES[type]?.area
        ? 'Watch affected areas on the map!'
        : 'Zones damaged!');
    el.textContent = `${typeMeta.emoji} ${typeMeta.label} (${levelMeta.label})! ${detail}`;
    el.style.visibility = 'visible';
    setTimeout(() => {
      el.style.visibility = 'hidden';
    }, 5000);
  }

  applyShake(camera) {
    if (this.shakeIntensity <= 0) return;
    const offset = this.shakeIntensity * 0.06;
    camera.position.x += (Math.random() - 0.5) * offset;
    camera.position.z += (Math.random() - 0.5) * offset;
    camera.position.y += (Math.random() - 0.5) * offset * 0.3;
  }
}
