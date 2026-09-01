import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRE_DAMAGE_INTENSITY,
  FLOOD_DAMAGE_INTENSITY,
  fireStartIntensity,
  fireDecayPerSpread,
  fireSpreadChance,
  floodMaxDepth,
  shouldHitHazard,
} from './disasterImpact.js';

describe('disaster building hits', () => {
  it('starts fire hot enough to wreck the origin tile', () => {
    for (const level of ['minor', 'moderate', 'major', 'catastrophic']) {
      assert.ok(fireStartIntensity(level) >= FIRE_DAMAGE_INTENSITY);
    }
  });

  it('lets fire stations slow a blaze without making it cosmetic', () => {
    const withCrews = fireDecayPerSpread(3);
    const alone = fireDecayPerSpread(0);
    assert.ok(withCrews > alone);
    assert.ok(withCrews < 0.05);
    assert.ok(fireSpreadChance(3) > 0.1);
  });

  it('floods several blocks inland instead of a one-tile puddle', () => {
    assert.ok(floodMaxDepth('moderate', 16) >= 4);
    assert.ok(floodMaxDepth('catastrophic', 16) >= 7);
  });

  it('hits a tile once when water or flame is high enough', () => {
    assert.equal(shouldHitHazard(0.2, FLOOD_DAMAGE_INTENSITY, false), false);
    assert.equal(shouldHitHazard(0.5, FLOOD_DAMAGE_INTENSITY, false), true);
    assert.equal(shouldHitHazard(0.9, FIRE_DAMAGE_INTENSITY, true), false);
  });
});
