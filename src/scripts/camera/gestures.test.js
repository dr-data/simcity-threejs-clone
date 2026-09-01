import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOrbit,
  applyPinchZoom,
  isTap,
  panOrigin,
  TAP_MOVE_PX,
  MIN_CAMERA_ELEVATION,
  MAX_CAMERA_ELEVATION,
} from './gestures.js';

describe('applyOrbit', () => {
  it('changes look direction from a horizontal drag', () => {
    const next = applyOrbit(225, 45, 20, 0);
    assert.ok(next.azimuth < 225);
    assert.equal(next.elevation, 45);
  });

  it('clamps elevation so the camera cannot flip', () => {
    const high = applyOrbit(0, 88, 0, 80);
    const low = applyOrbit(0, 12, 0, -80);
    assert.equal(high.elevation, MAX_CAMERA_ELEVATION);
    assert.equal(low.elevation, MIN_CAMERA_ELEVATION);
  });
});

describe('applyPinchZoom', () => {
  it('zooms in when fingers move apart', () => {
    const zoomed = applyPinchZoom(0.5, 40, 80);
    assert.ok(zoomed > 0.5);
  });
});

describe('panOrigin', () => {
  it('moves the look target when the pinch midpoint slides', () => {
    const origin = panOrigin({ x: 8, y: 0, z: 8 }, 225, 30, 0);
    assert.ok(origin.x !== 8 || origin.z !== 8);
  });
});

describe('isTap', () => {
  it('treats a small finger move as a tap, not an orbit', () => {
    assert.equal(isTap(3), true);
    assert.equal(isTap(TAP_MOVE_PX + 5), false);
  });
});
