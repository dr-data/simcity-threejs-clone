import * as THREE from 'three';
import { DevelopmentState } from '../sim/buildings/modules/development.js';
import { DISASTER_TYPES } from './disasterConfig.js';

const DAMAGE_TINTS = {
  fire: 0x994422,
  earthquake: 0x666666,
  flood: 0x336699,
  tornado: 0x777788,
  meteor: 0x993333,
  blizzard: 0x8899bb,
  drought: 0x998844,
};

/**
 * Persistent and animated visual effects on zone/building models.
 */
export class DisasterBuildingEffects {
  /** @type {Map<string, THREE.Group>} */
  static #ongoing = new Map();

  static #key(zone) {
    return `${zone.x}-${zone.y}`;
  }

  static #removeOngoingGroup(zone) {
    const key = this.#key(zone);
    const group = this.#ongoing.get(key);
    if (group) {
      group.parent?.remove(group);
      this.#disposeGroup(group);
      this.#ongoing.delete(key);
    }
  }

  static removeEffects(zone) {
    this.#removeOngoingGroup(zone);
    zone.rotation.z = 0;
    zone.position.y = 0;
  }

  static #disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  /**
   * Apply wrecked building pose and tint after damage.
   */
  static applyWreckAppearance(zone) {
    const dev = zone.development;
    if (!dev) return;

    if (dev.damageTilt == null) {
      dev.damageTilt = (Math.random() - 0.5) * 0.55;
      dev.damageSink = 0.06 + Math.random() * 0.14;
      dev.damageScaleMul = 0.45 + Math.random() * 0.2;
    }

    zone.rotation.z = dev.damageTilt;
    zone.position.y = -dev.damageSink;

    const mesh = zone.mesh;
    if (mesh) {
      const tint = DAMAGE_TINTS[dev.damageType] || 0x884444;
      mesh.traverse((obj) => {
        if (!obj.material) return;
        if (!obj.userData._origColor && obj.material.color) {
          obj.userData._origColor = obj.material.color.clone();
        }
        obj.material.color.setHex(tint);
        if (obj.material.emissive) {
          obj.material.emissive.setHex(tint);
          obj.material.emissiveIntensity = 0.35;
        }
      });
      mesh.scale.multiplyScalar(dev.damageScaleMul);
    }

    this.#attachOngoingEffects(zone, dev.damageType || 'fire');
  }

  static #attachOngoingEffects(zone, type) {
    this.#removeOngoingGroup(zone);
    const key = this.#key(zone);
    const meta = DISASTER_TYPES[type] || DISASTER_TYPES.fire;
    const group = new THREE.Group();
    group.name = 'damage-effects';

    const count = type === 'fire' ? 8 : type === 'meteor' ? 6 : 5;
    const color = new THREE.Color(meta.tint);

    for (let i = 0; i < count; i++) {
      const size = 0.04 + Math.random() * 0.06;
      const geo =
        type === 'fire'
          ? new THREE.ConeGeometry(size, size * 2.5, 4)
          : new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55 + Math.random() * 0.35,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(
        (Math.random() - 0.5) * 0.35,
        0.15 + Math.random() * 0.45,
        (Math.random() - 0.5) * 0.35
      );
      p.userData.phase = Math.random() * Math.PI * 2;
      p.userData.speed = 0.02 + Math.random() * 0.04;
      p.userData.baseY = p.position.y;
      group.add(p);
    }

    if (type === 'fire' || type === 'meteor') {
      const light = new THREE.PointLight(
        new THREE.Color(meta.tint),
        type === 'meteor' ? 1.2 : 0.8,
        2.5
      );
      light.position.set(0, 0.35, 0);
      group.add(light);
    }

    zone.add(group);
    this.#ongoing.set(key, group);
  }

  static updateOngoing() {
    const t = performance.now() / 1000;
    for (const group of this.#ongoing.values()) {
      group.children.forEach((p) => {
        if (!p.userData.phase) return;
        p.position.y =
          p.userData.baseY + Math.sin(t * 3 + p.userData.phase) * 0.08;
        p.rotation.y += p.userData.speed;
        if (p.material) {
          p.material.opacity = 0.45 + Math.sin(t * 4 + p.userData.phase) * 0.25;
        }
      });
    }
  }
}

/**
 * Per-building destruction animations — animates the zone model in-world.
 */
export class DisasterAnimationManager {
  /** @type {Array<{update: () => boolean}>} */
  active = [];
  /** @type {THREE.Scene | null} */
  scene = null;

  setScene(scene) {
    this.scene = scene;
  }

  animateDamage(zone, type, level, repairTicks, onDamaged) {
    if (!zone?.development) {
      onDamaged?.();
      return;
    }
    if (zone.development.state === DevelopmentState.damaged) {
      return;
    }

    this.#applyDamage(zone, type, level, repairTicks);
    onDamaged?.();

    const mesh = zone.mesh;
    if (!mesh) return;

    const meta = DISASTER_TYPES[type] || DISASTER_TYPES.fire;
    const duration =
      level === 'catastrophic' ? 1800 : level === 'major' ? 1500 : 1200;
    const start = performance.now();

    const targetTilt = (Math.random() - 0.5) * 0.55;
    const targetSink = 0.08 + Math.random() * 0.16;
    const targetScale = 0.42 + Math.random() * 0.18;

    const baseRotZ = zone.rotation.z;
    const basePosY = zone.position.y;
    const baseMeshScale = mesh.scale.clone();
    const burst = this.#spawnBurst(zone, meta.tint, level, type);

    const anim = {
      update: () => {
        const t = Math.min(1, (performance.now() - start) / duration);
        const ease = 1 - (1 - t) ** 3;
        const shake = type === 'earthquake' ? Math.sin(t * 32) * (1 - t) : 0;

        zone.rotation.z = baseRotZ + targetTilt * ease + shake * 0.35;
        zone.position.y = basePosY - targetSink * ease;

        const scaleFactor = 1 - (1 - targetScale) * ease;
        mesh.scale.set(
          baseMeshScale.x * scaleFactor,
          baseMeshScale.y * scaleFactor,
          baseMeshScale.z * scaleFactor
        );

        if (type === 'tornado') {
          zone.rotation.y += 0.12 * (1 - t);
        }

        this.#tintMesh(mesh, meta.tint, ease);
        this.#updateBurst(burst, t);

        if (t >= 1) {
          zone.development.damageTilt = targetTilt;
          zone.development.damageSink = targetSink;
          zone.development.damageScaleMul = targetScale;
          this.#removeBurst(burst);
          return false;
        }
        return true;
      },
    };

    this.active.push(anim);
  }

  update() {
    this.active = this.active.filter((a) => a.update());
    DisasterBuildingEffects.updateOngoing();
  }

  #applyDamage(zone, type, level, repairTicks) {
    if (!zone.development) return;
    if (zone.development.state === DevelopmentState.damaged) return;
    window.disasterManager?.recordBuildingDamage(zone, type, level);
    zone.development.damageType = type;
    zone.development.damageLevel = level;
    zone.development.repairTicksNeeded = repairTicks;
    zone.development.state = DevelopmentState.damaged;
    zone.development.repairCounter = 0;
  }

  #tintMesh(mesh, tint, intensity) {
    mesh.traverse((obj) => {
      if (!obj.material?.color) return;
      const c = new THREE.Color(tint);
      obj.material.color.lerp(c, 0.35 + intensity * 0.45);
      if (obj.material.emissive) {
        obj.material.emissive.setHex(tint);
        obj.material.emissiveIntensity = intensity * 0.85;
      }
    });
  }

  #spawnBurst(zone, tint, level, type) {
    if (!this.scene) return null;

    const wp = new THREE.Vector3();
    zone.getWorldPosition(wp);
    const group = new THREE.Group();
    group.position.set(wp.x, wp.y + 0.25, wp.z);

    const count =
      level === 'catastrophic' ? 24 : level === 'major' ? 16 : level === 'minor' ? 8 : 12;
    const color = new THREE.Color(tint);

    for (let i = 0; i < count; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const geo =
        type === 'meteor'
          ? new THREE.SphereGeometry(size, 6, 6)
          : new THREE.BoxGeometry(size, size, size);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });
      const p = new THREE.Mesh(geo, mat);
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.06 + Math.random() * 0.14;
      p.userData.vx = Math.cos(angle) * speed;
      p.userData.vy = 0.1 + Math.random() * 0.2;
      p.userData.vz = Math.sin(angle) * speed;
      p.position.set((Math.random() - 0.5) * 0.2, Math.random() * 0.15, (Math.random() - 0.5) * 0.2);
      group.add(p);
    }

    this.scene.add(group);
    return group;
  }

  #updateBurst(group, t) {
    if (!group) return;
    group.children.forEach((p) => {
      p.position.x += p.userData.vx;
      p.position.y += p.userData.vy * (1 - t * 0.5);
      p.position.z += p.userData.vz;
      if (p.material) p.material.opacity = 0.9 * (1 - t);
    });
  }

  #removeBurst(group) {
    if (!group || !this.scene) return;
    group.children.forEach((p) => {
      p.geometry?.dispose();
      p.material?.dispose();
    });
    this.scene.remove(group);
  }
}
