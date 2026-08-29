import { DevelopmentState } from '../sim/buildings/modules/development.js';
import { BuildingType } from '../sim/buildings/buildingType.js';

const DISASTER_TYPES = ['fire', 'earthquake', 'flood'];

/**
 * Random disasters with visual effects and zone damage.
 */
export class DisasterManager {
  disasterCount = 0;
  totalZonesAtStart = 0;
  damagedZones = 0;
  overlayEl = null;
  shakeIntensity = 0;

  constructor(game) {
    this.game = game;
    this.overlayEl = document.getElementById('disaster-overlay');
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
    this.totalZonesAtStart = city.getDevelopedZoneCount();
    this.configure(
      window.gameConfig?.disasterFrequencyMin ?? 1,
      window.gameConfig?.disasterFrequencyMax ?? 3,
      window.gameConfig?.disasterSeverity ?? 0.25
    );
  }

  update() {
    if (window.ui?.godMode) return;
    if (this.disasterCount >= this._plannedDisasters) return;
    if (Date.now() >= this._nextDisasterTime) {
      this.triggerRandomDisaster();
    }
    if (this.shakeIntensity > 0) {
      this.shakeIntensity *= 0.9;
      if (this.shakeIntensity < 0.01) this.shakeIntensity = 0;
    }
  }

  triggerRandomDisaster() {
    const type = DISASTER_TYPES[Math.floor(Math.random() * DISASTER_TYPES.length)];
    this.triggerDisaster(type);
  }

  triggerDisaster(type) {
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
          )
        ) {
          zones.push(tile);
        }
      }
    }
    if (zones.length === 0) return;

    const hitCount = Math.max(1, Math.floor(zones.length * this.severity));
    const shuffled = zones.sort(() => Math.random() - 0.5).slice(0, hitCount);

    for (const tile of shuffled) {
      const zone = tile.building;
      if (zone.development) {
        zone.development.state = DevelopmentState.damaged;
        zone.development.repairCounter = 0;
        this.damagedZones++;
      }
    }

    this.disasterCount++;
    this._scheduleNext();
    this._playEffects(type, hitCount);
    this._showMessage(type, hitCount);

    const resilience = city.getDisasterResilience();
    const damagePercent = 100 - resilience;
    if (window.sessionManager) {
      window.sessionManager.recordDisasterSurvived(damagePercent);
    }
  }

  _playEffects(type, hitCount) {
    this.shakeIntensity = Math.min(1, hitCount * 0.15);
    if (this.overlayEl) {
      const colors = {
        fire: 'rgba(255,80,0,0.35)',
        earthquake: 'rgba(100,100,100,0.4)',
        flood: 'rgba(0,100,200,0.35)',
      };
      this.overlayEl.style.background = colors[type] || colors.fire;
      this.overlayEl.style.opacity = '1';
      setTimeout(() => {
        this.overlayEl.style.opacity = '0';
      }, 1500);
    }
  }

  _showMessage(type, hitCount) {
    const el = document.getElementById('disaster-message');
    if (!el) return;
    const labels = {
      fire: '🔥 Fire outbreak!',
      earthquake: '🌋 Earthquake!',
      flood: '🌊 Flood!',
    };
    el.textContent = `${labels[type] || 'Disaster!'} ${hitCount} zones damaged. Repair or rebuild!`;
    el.style.visibility = 'visible';
    setTimeout(() => {
      el.style.visibility = 'hidden';
    }, 4000);
  }

  applyShake(camera) {
    if (this.shakeIntensity <= 0) return;
    const offset = this.shakeIntensity * 0.05;
    camera.position.x += (Math.random() - 0.5) * offset;
    camera.position.z += (Math.random() - 0.5) * offset;
  }
}
