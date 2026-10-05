import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_PHASES, CLASS_MINUTES } from './phases.js';
import {
  createLabState,
  startClass,
  pauseClass,
  resumeClass,
  goToPhase,
  nextPhase,
  issueDisaster,
  describeClock,
  phaseElapsedMs,
} from './labState.js';
import { shockFor } from './shocks.js';
import { measureSnapshot, cascadeSentence } from './resilience.js';
import { startRecovery, stepRecovery, recoveryText } from './recovery.js';
import { createResultRow, resultsToCsv, compareDesigns, upsertRow } from './resultsTable.js';
import { REFLECTION_PROMPTS, reflectionSummary, emptyReflection } from './reflection.js';
import { sanitizeLabState } from '../../../worker/src/labState.js';

function home({ residents, level, supplied, waterfront, state = 'developed', required = 10 }) {
  return {
    waterfront,
    building: {
      type: 'residential',
      residents,
      level,
      state,
      supplied,
      required,
      road: true,
    },
  };
}

describe('class phases', () => {
  it('adds up to an 80-minute class', () => {
    const minutes = LAB_PHASES.reduce((sum, phase) => sum + phase.minutes, 0);
    assert.equal(minutes, CLASS_MINUTES);
    assert.equal(minutes, 80);
    assert.deepEqual(
      LAB_PHASES.map((phase) => phase.id),
      ['intro', 'investigate', 'test', 'report']
    );
  });
});

describe('lab clock', () => {
  it('pauses, resumes, and moves phase without counting the pause', () => {
    const started = startClass(createLabState(), 1_000);
    const paused = pauseClass(started, 61_000);
    assert.equal(phaseElapsedMs(paused, 120_000), 60_000);
    const resumed = resumeClass(paused, 120_000);
    assert.equal(phaseElapsedMs(resumed, 120_000), 60_000);
    const testing = goToPhase(resumed, 'test', 130_000);
    assert.equal(testing.phase, 'test');
    assert.equal(phaseElapsedMs(testing, 130_000), 0);
    const view = describeClock(testing, 190_000);
    assert.equal(view.timerText.startsWith('Test'), true);
    assert.equal(view.classText.includes('/'), true);
  });

  it('starts on the test phase if a disaster is sent before the class clock', () => {
    const sent = issueDisaster(createLabState(), {
      type: 'typhoon',
      level: 'major',
      now: 5_000,
      id: 'd1',
    });
    assert.equal(sent.phase, 'test');
    assert.equal(sent.status, 'running');
    assert.equal(sent.disaster.id, 'd1');
  });

  it('moves a running introduction into the test when a disaster is sent', () => {
    const started = startClass(createLabState(), 0);
    const sent = issueDisaster(started, { type: 'grid', level: 'major', now: 5_000, id: 'g1' });
    assert.equal(sent.status, 'running');
    assert.equal(sent.phase, 'test');
    assert.equal(sent.disaster.type, 'grid');
  });

  it('advances introduction to investigation', () => {
    const started = startClass(createLabState(), 0);
    const next = nextPhase(started, 10_000);
    assert.equal(next.phase, 'investigate');
  });
});

describe('infrastructure shocks', () => {
  it('cuts the grid without a harbour flood, and cuts harbour water in a typhoon', () => {
    const grid = shockFor('grid', 'major');
    assert.ok(grid.grid >= 40);
    assert.equal(grid.waterfront, 0);
    const typhoon = shockFor('typhoon', 'major');
    assert.equal(typhoon.grid, 0);
    assert.ok(typhoon.waterfront > 0);
    assert.ok(typhoon.comms > 0);
    assert.equal(shockFor('fire', 'major').grid, 0);
  });
});

describe('resilience metrics', () => {
  const plant = {
    waterfront: false,
    building: { type: 'power-plant-petroleum', residents: 0, level: 1, state: '', supplied: 0, required: 0, road: true },
  };
  const shop = {
    waterfront: false,
    building: { type: 'commercial', residents: 0, level: 2, state: 'developed', supplied: 0, required: 10, road: true },
  };

  it('counts people who lose water and communications when the grid fails', () => {
    const metrics = measureSnapshot({
      gridOutageTicks: 30,
      tiles: [
        plant,
        shop,
        home({ residents: 40, level: 1, supplied: 10, waterfront: true }),
        home({ residents: 20, level: 3, supplied: 10, waterfront: false }),
      ],
    });
    assert.equal(metrics.people, 60);
    assert.equal(metrics.withoutPower, 60);
    assert.equal(metrics.withoutWater, 60);
    assert.equal(metrics.withoutComms, 60);
    assert.ok(metrics.servicesLost >= 2);
    assert.match(metrics.mostAffected, /harbour/);
    assert.match(metrics.mostAffected, /40/);
    assert.match(cascadeSentence(metrics), /grid/i);
  });

  it('cuts water on the harbour during a flood while inland homes keep it', () => {
    const metrics = measureSnapshot({
      waterfrontCutTicks: 20,
      tiles: [
        plant,
        home({ residents: 15, level: 1, supplied: 10, waterfront: true }),
        home({ residents: 30, level: 2, supplied: 10, waterfront: false }),
      ],
    });
    assert.equal(metrics.withoutPower, 0);
    assert.equal(metrics.withoutWater, 15);
    assert.equal(metrics.withoutComms, 0);
    assert.match(metrics.mostAffected, /harbour/);
    assert.match(cascadeSentence(metrics), /Harbour/);
  });

  it('reports nobody cut off when homes have power and a working plant', () => {
    const metrics = measureSnapshot({
      tiles: [plant, home({ residents: 8, level: 2, supplied: 10, waterfront: false })],
    });
    assert.equal(metrics.withoutPower, 0);
    assert.equal(metrics.withoutWater, 0);
    assert.equal(metrics.mostAffected, 'No one is cut off');
  });
});

describe('recovery time', () => {
  it('waits for the impact, then times how long services take to return', () => {
    const baseline = { withoutPower: 0, withoutWater: 0, withoutComms: 0 };
    let recovery = startRecovery(baseline, 0, 'd1');
    recovery = stepRecovery(recovery, baseline, 1000);
    assert.equal(recovery.seenImpact, false);
    recovery = stepRecovery(recovery, { withoutPower: 10, withoutWater: 10, withoutComms: 10 }, 2000);
    assert.equal(recovery.seenImpact, true);
    assert.match(recoveryText(recovery, 5000), /Still out/);
    recovery = stepRecovery(recovery, baseline, 8000);
    assert.equal(recoveryText(recovery, 9000), '0:08');
  });
});

describe('results export', () => {
  it('builds a CSV and a Design A versus Design B line', () => {
    const designA = createResultRow({
      kind: 'design-a',
      label: 'Design A',
      phase: 'Investigation',
      metrics: {
        people: 100,
        withoutPower: 0,
        withoutWater: 0,
        withoutComms: 0,
        servicesLost: 0,
        servicesDetail: 'Services running',
        mostAffected: 'No one is cut off',
      },
      recovery: '—',
      cost: 0,
      now: 1_700_000_000_000,
      note: 'before',
    });
    const designB = createResultRow({
      kind: 'design-b',
      label: 'Design B',
      phase: 'Test and improve',
      metrics: {
        people: 90,
        withoutPower: 10,
        withoutWater: 10,
        withoutComms: 4,
        servicesLost: 1,
        servicesDetail: '1 shop closed',
        mostAffected: 'Older low-rise homes on the harbour (10 people)',
      },
      recovery: '1:12',
      cost: 400,
      now: 1_700_000_100_000,
      note: 'second plant, "inland"',
    });
    const rows = upsertRow(upsertRow([], designA), designB);
    const csv = resultsToCsv(rows);
    assert.match(csv, /Without communications/);
    assert.match(csv, /"second plant, ""inland"""/);
    assert.match(compareDesigns(rows), /Without power: 0 → 10/);
    const reflection = emptyReflection({ name: 'Alex', city: 'North Point' });
    reflection.answers.cascade = 'The plant sat on the harbour.';
    assert.match(reflectionSummary(reflection), /Alex/);
    assert.equal(REFLECTION_PROMPTS.length, 6);
  });
});

describe('shared class state', () => {
  it('drops unknown disaster types and keeps a valid phase', () => {
    const clean = sanitizeLabState({
      status: 'running',
      phase: 'nope',
      updatedAt: 12,
      disaster: { id: 'x', type: 'alien', level: 'major' },
    });
    assert.equal(clean.phase, 'intro');
    assert.equal(clean.status, 'running');
    assert.equal(clean.disaster, null);
    assert.equal(clean.updatedAt, 12);
  });
});
