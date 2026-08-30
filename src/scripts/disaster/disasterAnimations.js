import * as THREE from 'three';
import { DevelopmentState } from '../sim/buildings/modules/development.js';
import { DISASTER_TYPES } from './disasterConfig.js';

/**
 * Per-building destruction animations and particle bursts during disasters.
 */
export class DisasterAnimationManager {
  /** @type {Array<{update: () => boolean}>} */
  active = [];
  /** @type {THREE.Scene | null} */
  scene = null;

  setScene(scene) {
    this.scene = scene;
  }

  /**
   * Animate building damage, then apply damaged state.
   * @param {import('../sim/buildings/zones/zone.js').Zone} zone
   * @param {string} type
   * @param {string} level
   * @param {number} repairTicks
   * @param {() => void} onDamaged
   */
  animateDamage(zone, type, level, repairTicks, onDamaged) {
    const mesh = zone.mesh;
    if (!mesh) {
      this.#applyDamage(zone, type, level, repairTicks);
      onDamaged?.();
      return;
    }

    const meta = DISASTER_TYPES[type] || DISASTER_TYPES.fire;
    const duration = level === 'catastrophic' ? 1600 : level === 'major' ? 1400 : 1100;
    const start = performance.now();
    const baseY = mesh.position.y;
    const baseScale = mesh.scale.clone();
    const baseRotZ = mesh.rotation.z;
    const particles = this.#spawnParticles(zone, meta.tint, level);

    const anim = {
      update: () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        const ease = 1 - (1 - t) ** 3;

        switch (type) {
          case 'earthquake':
            mesh.rotation.z = baseRotZ + Math.sin(t * 28) * 0.25 * (1 - t);
            mesh.position.x = Math.sin(t * 40) * 0.08 * (1 - t);
            mesh.scale.y = baseScale.y * (1 - ease * 0.55);
            break;
          case 'flood':
            mesh.position.y = baseY - ease * 0.35;
            mesh.scale.x = baseScale.x * (1 + ease * 0.05);
            mesh.scale.z = baseScale.z * (1 + ease * 0.05);
            mesh.scale.y = baseScale.y * (1 - ease * 0.4);
            break;
          case 'tornado':
            mesh.rotation.y += 0.15;
            mesh.position.y = baseY + Math.sin(t * 12) * 0.12 * (1 - t);
            const s = 1 - ease * 0.15;
            mesh.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
            break;
          case 'meteor':
            mesh.position.y = baseY - ease * 0.5;
            mesh.scale.y = baseScale.y * (1 - ease * 0.75);
            mesh.scale.x = baseScale.x * (1 + ease * 0.2);
            mesh.scale.z = baseScale.z * (1 + ease * 0.2);
            break;
          case 'blizzard':
            mesh.scale.y = baseScale.y * (1 - ease * 0.35);
            mesh.position.y = baseY - ease * 0.15;
            break;
          case 'drought':
            mesh.scale.y = baseScale.y * (1 - ease * 0.3);
            this.#pulseEmissive(mesh, meta.tint, t);
            break;
          default:
            // fire and fallback
            mesh.scale.y = baseScale.y * (1 - ease * 0.6);
            mesh.position.y = baseY - ease * 0.25;
            this.#pulseEmissive(mesh, meta.tint, t);
            break;
        }

        this.#updateParticles(particles, t);

        if (t >= 1) {
          mesh.position.y = baseY;
          mesh.rotation.z = baseRotZ;
          mesh.scale.copy(baseScale);
          this.#clearEmissive(mesh);
          this.#removeParticles(particles);
          this.#applyDamage(zone, type, level, repairTicks);
          onDamaged?.();
          return false;
        }
        return true;
      },
    };

    this.active.push(anim);
  }

  #applyDamage(zone, type, level, repairTicks) {
    if (!zone.development) return;
    zone.development.damageType = type;
    zone.development.damageLevel = level;
    zone.development.repairTicksNeeded = repairTicks;
    zone.development.state = DevelopmentState.damaged;
    zone.development.repairCounter = 0;
  }

  update() {
    this.active = this.active.filter((a) => a.update());
  }

  #pulseEmissive(mesh, tint, t) {
    mesh.traverse((obj) => {
      if (obj.material?.emissive) {
        const intensity = (1 - t) * 0.6;
        obj.material.emissive.setHex(tint);
        obj.material.emissiveIntensity = intensity;
      }
    });
  }

  #clearEmissive(mesh) {
    mesh.traverse((obj) => {
      if (obj.material?.emissive) {
        obj.material.emissive.setHex(0);
        obj.material.emissiveIntensity = 0;
      }
    });
  }

  #spawnParticles(zone, tint, level) {
    if (!this.scene) return null;
    const count = level === 'catastrophic' ? 14 : level === 'major' ? 10 : 6;
    const group = new THREE.Group();
    group.position.set(zone.position.x, 0.4, zone.position.z);

    const color = new THREE.Color(tint);
    for (let i = 0; i < count; i++) {
      const size = 0.06 + Math.random() * 0.08;
      const geo = new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
      });
      const p = new THREE.Mesh(geo, mat);
      p.userData.vx = (Math.random() - 0.5) * 0.12;
      p.userData.vy = 0.08 + Math.random() * 0.15;
      p.userData.vz = (Math.random() - 0.5) * 0.12;
      p.position.set((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4);
      group.add(p);
    }
    this.scene.add(group);
    return group;
  }

  #updateParticles(group, t) {
    if (!group) return;
    group.children.forEach((p) => {
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy * (1 - t);
      p.position.z += p.userData.vz;
      if (p.material) p.material.opacity = 0.85 * (1 - t);
    });
  }

  #removeParticles(group) {
    if (!group || !this.scene) return;
    group.children.forEach((p) => {
      p.geometry?.dispose();
      p.material?.dispose();
    });
    this.scene.remove(group);
  }
}
