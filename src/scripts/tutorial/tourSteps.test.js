import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, STATUS } from 'react-joyride';
import { buildTourSteps, isTourEndEvent, joyrideOptions } from './tourSteps.js';

describe('buildTourSteps', () => {
  it('uses skipBeacon so the tooltip shows immediately (v3, not disableBeacon)', () => {
    for (const isMobile of [false, true]) {
      const steps = buildTourSteps(isMobile);
      assert.ok(steps.length > 0, `expected steps for mobile=${isMobile}`);
      for (const step of steps) {
        assert.equal(step.skipBeacon, true, `step ${step.target} should skip beacon`);
        assert.equal(step.disableBeacon, undefined);
      }
    }
  });

  it('starts with a centered intro that does not depend on chrome selectors', () => {
    const step = buildTourSteps(false)[0];
    assert.equal(step.target, 'body');
    assert.equal(step.placement, 'center');
  });
});

describe('joyrideOptions', () => {
  it('does not close the tour when the overlay is clicked', () => {
    assert.equal(joyrideOptions.overlayClickAction, false);
  });

  it('skips the beacon by default and includes a skip button', () => {
    assert.equal(joyrideOptions.skipBeacon, true);
    assert.ok(joyrideOptions.buttons.includes('skip'));
    assert.ok(joyrideOptions.buttons.includes('primary'));
  });
});

describe('isTourEndEvent', () => {
  it('treats v3 TOUR_END as completion', () => {
    assert.equal(isTourEndEvent({ type: EVENTS.TOUR_END, status: STATUS.FINISHED }), true);
    assert.equal(isTourEndEvent({ type: EVENTS.TOUR_START, status: STATUS.RUNNING }), false);
  });
});
