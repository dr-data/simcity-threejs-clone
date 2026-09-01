import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiBase } from '../auth/apiConfig.js';
import { isAllowedOrigin } from '../../../worker/src/cors.js';
import { fallbackTip } from '../ai/localTip.js';
import { DisasterConsequences } from './disasterConsequences.js';
import { HARM_INDEX_HELP } from './harmIndex.js';
import { TYPHOON_BASE_SPEED } from './disasterConfig.js';
import { simIntervalMs } from '../sim/simSpeed.js';

describe('resolveApiBase', () => {
  it('replaces missing or placeholder Worker URLs', () => {
    assert.equal(
      resolveApiBase('https://classroom-simcity-api.YOUR_SUBDOMAIN.workers.dev'),
      'https://classroom-simcity-api.shorlol.workers.dev'
    );
    assert.equal(resolveApiBase(''), 'https://classroom-simcity-api.shorlol.workers.dev');
    assert.equal(
      resolveApiBase('https://classroom-simcity-api.shorlol.workers.dev/'),
      'https://classroom-simcity-api.shorlol.workers.dev'
    );
  });
});

describe('isAllowedOrigin', () => {
  it('allows production Pages, preview deploys, and localhost', () => {
    assert.equal(isAllowedOrigin('https://classroom-simcity.pages.dev', 'https://classroom-simcity.pages.dev'), true);
    assert.equal(isAllowedOrigin('https://68e65a24.classroom-simcity.pages.dev', 'https://classroom-simcity.pages.dev'), true);
    assert.equal(isAllowedOrigin('http://127.0.0.1:3000', 'https://classroom-simcity.pages.dev'), true);
    assert.equal(isAllowedOrigin('https://evil.example', 'https://classroom-simcity.pages.dev'), false);
  });
});

describe('fallbackTip', () => {
  it('returns a practical tip from city stats', () => {
    const tip = fallbackTip({
      residents: 12,
      developed_zones: 2,
      disaster_resilience: 40,
      power_capacity: 0,
      power_demand: 80,
    });
    assert.ok(tip.length > 20);
    assert.match(tip, /power|zone|road|spread|fire|resident/i);
  });
});

describe('harm index help', () => {
  it('explains the 0–100 scale', () => {
    assert.match(HARM_INDEX_HELP, /0–100|0-100/);
    assert.match(HARM_INDEX_HELP, /killed|casualt/i);
  });
});

describe('disaster event log', () => {
  it('records random and manual disasters separately', () => {
    const c = new DisasterConsequences();
    c.startEvent({ type: 'fire', level: 'major', source: 'random' });
    c.recordBuildingDamage(
      { type: 'residential', development: {}, residents: { applyDisasterCasualties: () => ({ killed: 2, injured: 5 }) } },
      'fire',
      'major'
    );
    c.startEvent({ type: 'flood', level: 'minor', source: 'manual' });
    const events = c.getEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0].source, 'random');
    assert.equal(events[0].type, 'fire');
    assert.equal(events[0].killed, 2);
    assert.equal(events[1].source, 'manual');
    assert.equal(events[1].type, 'flood');
  });
});

describe('typhoon speed', () => {
  it('crosses the map in several seconds, not about one second', () => {
    assert.ok(TYPHOON_BASE_SPEED < 0.005);
    assert.ok(TYPHOON_BASE_SPEED > 0.001);
  });
});

describe('sim speed', () => {
  it('maps 1x/2x/5x to interval length without pause as a speed', () => {
    assert.equal(simIntervalMs(1), 1000);
    assert.equal(simIntervalMs(2), 500);
    assert.equal(simIntervalMs(5), 200);
  });
});
