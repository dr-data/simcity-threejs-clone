import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_SIZE_PRESETS, estimateBuildingCount, LAYOUT_STYLES } from './citySizes.js';
import { generateCityLayout, createRng } from './generateCity.js';
import { computeDrillScore, scoreDrill, rhythmMultiplier } from '../session/drillScore.js';

describe('city size presets', () => {
  it('offers four maps and metro has the most estimated buildings', () => {
    assert.equal(CITY_SIZE_PRESETS.length, 4);
    const village = estimateBuildingCount(12, 0.92);
    const metro = estimateBuildingCount(24, 0.99);
    assert.ok(metro > village * 2);
  });
});

describe('generateCityLayout', () => {
  it('fills a developed street grid inside the playable inner tiles', () => {
    const layout = generateCityLayout({ size: 16, density: 0.95, style: 'grid-quarters', seed: 42 });
    const inner = 14 * 14;
    assert.ok(layout.buildings.length > inner * 0.7);
    const roads = layout.buildings.filter((b) => b.type === 'road');
    const zones = layout.buildings.filter((b) =>
      ['residential', 'commercial', 'industrial'].includes(b.type)
    );
    assert.ok(roads.length > 20);
    assert.ok(zones.length > 30);
    assert.ok(zones.every((z) => z.level >= 1 && z.level <= 3));
    for (const b of layout.buildings) {
      assert.ok(b.x >= 1 && b.x <= 14);
      assert.ok(b.y >= 1 && b.y <= 14);
    }
  });

  it('is deterministic for a seed and denser sizes place more buildings', () => {
    const a = generateCityLayout({ size: 16, density: 0.95, style: 'sprawl', seed: 7 });
    const b = generateCityLayout({ size: 16, density: 0.95, style: 'sprawl', seed: 7 });
    assert.deepEqual(a.buildings, b.buildings);
    const small = generateCityLayout({ size: 12, density: 0.92, style: 'sprawl', seed: 7 });
    const big = generateCityLayout({ size: 24, density: 0.99, style: 'sprawl', seed: 7 });
    assert.ok(big.buildings.length > small.buildings.length);
  });

  it('knows the layout styles the AI may pick', () => {
    assert.ok(LAYOUT_STYLES.includes('harbor-spine'));
    assert.equal(typeof createRng(1)(), 'number');
  });
});

describe('drill score', () => {
  const base = {
    buildingsDestroyed: 40,
    buildingsRemaining: 40,
    startingBuildings: 80,
    durationSeconds: 8 * 60,
    durationAllowedSeconds: 10 * 60,
    disasterCount: 5,
    disasterTypes: ['fire', 'flood'],
    casualties: 4,
    injured: 10,
    disasterIndex: 20,
    disasterCost: 400,
    zonesDamaged: 12,
  };

  it('pays more for destroying a larger share of a bigger city', () => {
    const village = computeDrillScore({
      ...base,
      buildingsDestroyed: 10,
      buildingsRemaining: 10,
      startingBuildings: 20,
    });
    const metro = computeDrillScore({
      ...base,
      buildingsDestroyed: 80,
      buildingsRemaining: 80,
      startingBuildings: 160,
    });
    assert.ok(metro > village);
  });

  it('counts harm, people, leftover time, and strike rhythm', () => {
    const withPeople = computeDrillScore({ ...base, casualties: 10, injured: 20, disasterIndex: 40 });
    const quiet = computeDrillScore({ ...base, casualties: 0, injured: 0, disasterIndex: 0 });
    assert.ok(withPeople > quiet);

    const fast = scoreDrill({ ...base, durationSeconds: 4 * 60 });
    const slow = scoreDrill({ ...base, durationSeconds: 10 * 60 });
    assert.ok(fast.tempo > slow.tempo);
    assert.ok(fast.score > slow.score);

    assert.ok(rhythmMultiplier(5, 10) > rhythmMultiplier(0, 10));
    assert.ok(rhythmMultiplier(5, 10) > rhythmMultiplier(20, 10));

    const noHits = scoreDrill({ ...base, disasterCount: 0, disasterTypes: [] });
    const sweet = scoreDrill({ ...base, disasterCount: 5 });
    const spam = scoreDrill({ ...base, disasterCount: 20 });
    assert.ok(sweet.score > noHits.score);
    assert.ok(sweet.score > spam.score);
  });
});
