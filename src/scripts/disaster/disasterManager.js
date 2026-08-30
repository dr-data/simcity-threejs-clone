import { DevelopmentState } from '../sim/buildings/modules/development.js';
import {
  DISASTER_TYPES,
  DISASTER_LEVELS,
  pickRandomType,
  pickRandomLevel,
} from './disasterConfig.js';
import { DisasterAnimationManager } from './disasterAnimations.js';

/**
 * Random disasters with visual effects, animations, and zone damage.
 */
export class DisasterManager {
  disasterCount = 0;
  totalZonesAtStart = 0;
  damagedZones = 0;
  overlayEl = null;
  shakeIntensity = 0;
  animations = new DisasterAnimationManager();

  constructor(game) {
    this.game = game;
    this.overlayEl = document.getElementById('disaster-overlay');
    this.frequencyMin = 1;
    this.frequencyMax = 3;
    this.severity = 0.25;
    this._plannedDisasters = 0;
    this._nextDisasterTime = 0;
    this._pendingDamage = 0;
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
    this.animations.setScene(this.game.scene);
    this.configure(
      window.gameConfig?.disasterFrequencyMin ?? 1,
      window.gameConfig?.disasterFrequencyMax ?? 3,
      window.gameConfig?.disasterSeverity ?? 0.25
    );
  }

  update() {
    this.animations.update();

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
    this.triggerDisaster(pickRandomType(), pickRandomLevel());
  }

  /**
   * @param {string} type
   * @param {string} level
   */
  triggerDisaster(type, level = 'moderate') {
    const typeMeta = DISASTER_TYPES[type] || DISASTER_TYPES.fire;
    const levelMeta = DISASTER_LEVELS[level] || DISASTER_LEVELS.moderate;

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
    if (zones.length === 0) return;

    const severity = Math.min(0.85, this.severity * (levelMeta.severityMult / 0.25));
    const hitCount = Math.max(1, Math.floor(zones.length * severity));
    const shuffled = zones.sort(() => Math.random() - 0.5).slice(0, hitCount);

    this._pendingDamage = hitCount;
    let completed = 0;

    const onOneDamaged = () => {
      this.damagedZones++;
      completed++;
      if (completed >= shuffled.length) {
        this._finishDisaster(type, level, hitCount, typeMeta, levelMeta);
      }
    };

    // Stagger animations slightly for visual impact
    shuffled.forEach((tile, i) => {
      const zone = tile.building;
      const delay = i * 80;
      setTimeout(() => {
        this.animations.animateDamage(
          zone,
          type,
          level,
          levelMeta.repairTicks,
          onOneDamaged
        );
      }, delay);
    });

    this._playEffects(type, level, hitCount, typeMeta, levelMeta);
    this._showMessage(type, level, hitCount, typeMeta, levelMeta);
  }

  _finishDisaster(type, level, hitCount, typeMeta, levelMeta) {
    this.disasterCount++;
    this._scheduleNext();

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

  _showMessage(type, level, hitCount, typeMeta, levelMeta) {
    const el = document.getElementById('disaster-message');
    if (!el) return;
    el.textContent = `${typeMeta.emoji} ${typeMeta.label} (${levelMeta.label})! ${hitCount} zones hit — buildings collapsing!`;
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
