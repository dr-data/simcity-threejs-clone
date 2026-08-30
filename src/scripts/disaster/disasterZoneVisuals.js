import * as THREE from 'three';

/**
 * Per-tile 3D disaster effects on zones (flood water, fire, typhoon debris).
 */
export class DisasterZoneVisuals {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  /** @type {Map<string, { type: string, group: THREE.Group, phase: number, baseHeight: number }>} */
  #effects = new Map();
  /** @type {THREE.Group[]} */
  #typhoonFunnels = [];

  attachToCity(city) {
    city.debugMeshes.add(this.group);
  }

  update(now, areaSim) {
    const t = now / 1000;
    for (const effect of this.#effects.values()) {
      this.#animateEffect(effect, t);
    }
    this.#syncTyphoonFunnels(areaSim, t);
  }

  syncFromCity(city, areaSim) {
    const activeKeys = new Set();

    for (let x = 0; x < city.size; x++) {
      for (let y = 0; y < city.size; y++) {
        const tile = city.getTile(x, y);
        if (!tile) continue;
        const key = city.tileKey(x, y);
        const intensity = tile.hazardIntensity;
        const isFire = this.#tileHasFire(areaSim, x, y);
        const type = tile.isRadioactive
          ? 'nuclear'
          : isFire
            ? 'fire'
            : tile.hazardType || (intensity > 0.02 ? 'flood' : null);

        if (!type || (intensity < 0.02 && !tile.isRadioactive)) continue;

        activeKeys.add(key);
        this.#ensureEffect(key, x, y, type, intensity, tile);
      }
    }

    for (const key of this.#effects.keys()) {
      if (!activeKeys.has(key)) {
        this.#removeEffect(key);
      }
    }
  }

  #tileHasFire(areaSim, x, y) {
    const key = areaSim.game.city.tileKey(x, y);
    for (const fire of areaSim.fires) {
      const c = fire.cells.get(key);
      if (c && c.intensity > 0.1) return true;
    }
    return false;
  }

  #ensureEffect(key, x, y, type, intensity, tile) {
    let effect = this.#effects.get(key);
    if (!effect || effect.type !== type) {
      if (effect) this.#removeEffect(key);
      effect = {
        type,
        group: this.#createEffectGroup(type, intensity, tile),
        phase: Math.random() * Math.PI * 2,
        baseHeight: 0.08 + intensity * 0.45,
        x,
        y,
      };
      effect.group.position.set(x, 0, y);
      this.group.add(effect.group);
      this.#effects.set(key, effect);
    }

    effect.baseHeight = 0.08 + intensity * 0.45;
    this.#updateEffectGeometry(effect, intensity);
  }

  #createEffectGroup(type, intensity, tile) {
    const group = new THREE.Group();
    group.name = `disaster-${type}`;

    if (type === 'flood') {
      const height = 0.08 + intensity * 0.45;
      const water = new THREE.Mesh(
        new THREE.BoxGeometry(0.86, 0.2, 0.86),
        new THREE.MeshLambertMaterial({
          color: 0x1a8fd4,
          transparent: true,
          opacity: 0.62,
          emissive: 0x0a4a78,
          emissiveIntensity: 0.25,
        })
      );
      water.name = 'water';
      water.scale.y = height / 0.2;
      water.position.y = height / 2;
      group.add(water);

      const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(0.82, 0.82),
        new THREE.MeshBasicMaterial({
          color: 0x66ccff,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        })
      );
      surface.name = 'surface';
      surface.rotation.x = -Math.PI / 2;
      surface.position.y = height + 0.01;
      group.add(surface);

      for (let i = 0; i < 4; i++) {
        const drop = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.7 })
        );
        drop.name = 'splash';
        drop.userData.offset = i * 1.2;
        drop.position.set((Math.random() - 0.5) * 0.5, 0.2, (Math.random() - 0.5) * 0.5);
        group.add(drop);
      }
    } else if (type === 'fire') {
      const count = 6 + Math.floor(intensity * 4);
      for (let i = 0; i < count; i++) {
        const size = 0.05 + Math.random() * 0.07;
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(size, size * 2.8, 5),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? 0xff6600 : 0xffaa22,
            transparent: true,
            opacity: 0.75,
          })
        );
        flame.name = 'flame';
        flame.userData.phase = Math.random() * Math.PI * 2;
        flame.userData.baseY = 0.12 + Math.random() * 0.35;
        flame.position.set((Math.random() - 0.5) * 0.4, flame.userData.baseY, (Math.random() - 0.5) * 0.4);
        group.add(flame);
      }
      const light = new THREE.PointLight(0xff5500, 0.9 + intensity, 2.2);
      light.name = 'fire-light';
      light.position.set(0, 0.35, 0);
      group.add(light);

      if (tile.building) {
        const smoke = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.35 })
        );
        smoke.name = 'smoke';
        smoke.position.y = 0.55;
        group.add(smoke);
      }
    } else if (type === 'typhoon' || type === 'tornado') {
      for (let i = 0; i < 8; i++) {
        const streak = new THREE.Mesh(
          new THREE.BoxGeometry(0.06, 0.02, 0.35),
          new THREE.MeshBasicMaterial({ color: 0x99aacc, transparent: true, opacity: 0.55 })
        );
        streak.name = 'wind';
        streak.userData.angle = (i / 8) * Math.PI * 2;
        streak.position.y = 0.25 + Math.random() * 0.3;
        group.add(streak);
      }
      for (let i = 0; i < 5; i++) {
        const debris = new THREE.Mesh(
          new THREE.BoxGeometry(0.05, 0.05, 0.05),
          new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.8 })
        );
        debris.name = 'debris';
        debris.userData.orbit = 0.15 + Math.random() * 0.2;
        debris.userData.speed = 2 + Math.random() * 2;
        debris.userData.phase = Math.random() * Math.PI * 2;
        group.add(debris);
      }
    } else if (type === 'nuclear') {
      const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.08, 12),
        new THREE.MeshBasicMaterial({ color: 0x88ff44, transparent: true, opacity: 0.45 })
      );
      glow.name = 'rad-glow';
      glow.position.y = 0.04;
      group.add(glow);

      for (let i = 0; i < 6; i++) {
        const particle = new THREE.Mesh(
          new THREE.SphereGeometry(0.04, 6, 6),
          new THREE.MeshBasicMaterial({ color: 0xccff66, transparent: true, opacity: 0.65 })
        );
        particle.name = 'rad-particle';
        particle.userData.phase = Math.random() * Math.PI * 2;
        particle.position.set((Math.random() - 0.5) * 0.5, 0.15, (Math.random() - 0.5) * 0.5);
        group.add(particle);
      }
    }

    return group;
  }

  #updateEffectGeometry(effect, intensity) {
    const water = effect.group.getObjectByName('water');
    const surface = effect.group.getObjectByName('surface');
    if (water && effect.type === 'flood') {
      const h = effect.baseHeight;
      water.scale.y = h / 0.2;
      water.position.y = h / 2;
      if (surface) surface.position.y = h + 0.01;
    }
    const light = effect.group.getObjectByName('fire-light');
    if (light && effect.type === 'fire') {
      light.intensity = 0.7 + intensity * 0.8;
    }
  }

  #animateEffect(effect, t) {
    const group = effect.group;
    if (effect.type === 'flood') {
      const surface = group.getObjectByName('surface');
      if (surface) {
        surface.material.opacity = 0.25 + Math.sin(t * 3 + effect.phase) * 0.15;
      }
      group.children.forEach((c) => {
        if (c.name === 'splash') {
          c.position.y =
            effect.baseHeight + 0.05 + Math.sin(t * 4 + c.userData.offset) * 0.08;
        }
      });
    } else if (effect.type === 'fire') {
      group.children.forEach((c) => {
        if (c.name === 'flame') {
          c.position.y = c.userData.baseY + Math.sin(t * 5 + c.userData.phase) * 0.06;
          c.rotation.y += 0.08;
          if (c.material) {
            c.material.opacity = 0.55 + Math.sin(t * 6 + c.userData.phase) * 0.25;
          }
        }
        if (c.name === 'smoke') {
          c.position.y = 0.5 + Math.sin(t * 2) * 0.05;
          c.scale.setScalar(1 + Math.sin(t * 1.5) * 0.1);
        }
      });
    } else if (effect.type === 'typhoon' || effect.type === 'tornado') {
      group.rotation.y += 0.12;
      group.children.forEach((c) => {
        if (c.name === 'wind') {
          const a = c.userData.angle + t * 2;
          c.position.x = Math.cos(a) * 0.28;
          c.position.z = Math.sin(a) * 0.28;
          c.rotation.y = -a;
        }
        if (c.name === 'debris') {
          const a = t * c.userData.speed + c.userData.phase;
          c.position.x = Math.cos(a) * c.userData.orbit;
          c.position.z = Math.sin(a) * c.userData.orbit;
          c.position.y = 0.2 + Math.sin(a * 2) * 0.15;
        }
      });
    } else if (effect.type === 'nuclear') {
      const glow = group.getObjectByName('rad-glow');
      if (glow?.material) {
        glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.15;
      }
      group.children.forEach((c) => {
        if (c.name === 'rad-particle') {
          c.position.y = 0.12 + Math.sin(t * 2 + c.userData.phase) * 0.2;
        }
      });
    }
  }

  #syncTyphoonFunnels(areaSim, t) {
    const typhoons = areaSim.typhoons || [];

    while (this.#typhoonFunnels.length > typhoons.length) {
      const funnel = this.#typhoonFunnels.pop();
      this.group.remove(funnel);
      this.#disposeGroup(funnel);
    }

    typhoons.forEach((ty, i) => {
      let funnel = this.#typhoonFunnels[i];
      if (!funnel) {
        funnel = this.#createTyphoonFunnel(ty.level);
        this.#typhoonFunnels[i] = funnel;
        this.group.add(funnel);
      }

      const idx = Math.min(Math.floor(ty.progress * ty.path.length), ty.path.length - 1);
      const center = ty.path[idx];
      funnel.position.set(center.x, 0, center.y);
      funnel.rotation.y = t * 1.5;

      const scale = 0.8 + (ty.radius || 1) * 0.35;
      funnel.scale.set(scale, scale, scale);

      funnel.children.forEach((c) => {
        if (c.name === 'rain') {
          const a = t * 3 + c.userData.phase;
          c.position.x = Math.cos(a) * c.userData.radius;
          c.position.z = Math.sin(a) * c.userData.radius;
          c.position.y = 0.1 + ((t * 2 + c.userData.phase) % 1) * 0.8;
        }
      });
    });
  }

  #createTyphoonFunnel(level) {
    const group = new THREE.Group();
    group.name = 'typhoon-funnel';

    for (let i = 0; i < 5; i++) {
      const radius = 0.12 + i * 0.14;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(radius, 0.35, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x6a8ab8,
          transparent: true,
          opacity: 0.28 - i * 0.03,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      cone.position.y = 0.15 + i * 0.22;
      group.add(cone);
    }

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.03, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x99bbdd, transparent: true, opacity: 0.4 })
    );
    ring.name = 'typhoon-ring';
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);

    for (let i = 0; i < 12; i++) {
      const rain = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.12, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xccddee, transparent: true, opacity: 0.5 })
      );
      rain.name = 'rain';
      rain.userData.phase = (i / 12) * Math.PI * 2;
      rain.userData.radius = 0.35 + Math.random() * 0.25;
      group.add(rain);
    }

    return group;
  }

  #removeEffect(key) {
    const effect = this.#effects.get(key);
    if (!effect) return;
    this.group.remove(effect.group);
    this.#disposeGroup(effect.group);
    this.#effects.delete(key);
  }

  #disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
}
