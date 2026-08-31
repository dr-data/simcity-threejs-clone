import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_SIZE_PRESETS, estimateBuildingCount, LAYOUT_STYLES } from './citySizes.js';
import { generateCityLayout, createRng } from './generateCity.js';
import { computeDrillScore } from '../session/drillScore.js';

describe('city size presets', () => {
  it('offers four maps and metro has the most estimated buildings', () => {
    assert.equal(CITY_SIZE_PRESETS.length, 4);
    const village = estimateBuildingCount(12, 0.24);
    const metro = estimateBuildingCount(24, 0.5);
    assert.ok(metro > village * 3);
  });
});

describe('generateCityLayout', () => {
  it('keeps buildings inside the playable inner grid', () => {
    const layout = generateCityLayout({ size: 16, density: 0.34, style: 'grid-quarters', seed: 42 });
    assert.ok(layout.buildings.length > 10);
    for (const b of layout.buildings) {
      assert.ok(b.x >= 1 && b.x <= 14);
      assert.ok(b.y >= 1 && b.y <= 14);
    }
  });

  it('is deterministic for a seed and denser sizes place more buildings', () => {
    const a = generateCityLayout({ size: 16, density: 0.34, style: 'sprawl', seed: 7 });
    const b = generateCityLayout({ size: 16, density: 0.34, style: 'sprawl', seed: 7 });
    assert.deepEqual(a.buildings, b.buildings);
    const small = generateCityLayout({ size: 12, density: 0.24, style: 'sprawl', seed: 7 });
    const big = generateCityLayout({ size: 24, density: 0.5, style: 'sprawl', seed: 7 });
    assert.ok(big.buildings.length > small.buildings.length);
  });

  it('knows the layout styles the AI may pick', () => {
    assert.ok(LAYOUT_STYLES.includes('harbor-spine'));
    assert.equal(typeof createRng(1)(), 'number');
  });
});

describe('drill score', () => {
  it('pays more for destroying a larger share of a bigger city', () => {
    const village = computeDrillScore({
      buildingsDestroyed: 10,
      buildingsRemaining: 10,
      startingBuildings: 20,
    });
    const metro = computeDrillScore({
      buildingsDestroyed: 80,
      buildingsRemaining: 80,
      startingBuildings: 160,
    });
    assert.ok(metro > village);
    const sweep = computeDrillScore({
      buildingsDestroyed: 20,
      buildingsRemaining: 0,
      startingBuildings: 20,
    });
    const miss = computeDrillScore({
      buildingsDestroyed: 0,
      buildingsRemaining: 20,
      startingBuildings: 20,
    });
    assert.ok(sweep > miss);
  });
});
