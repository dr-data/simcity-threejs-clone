/**
 * What the lecturer may store in the shared class record.
 * Students can read it. Only an admin can change it.
 */

const PHASES = new Set(['intro', 'investigate', 'test', 'report']);
const STATUSES = new Set(['idle', 'running', 'paused']);
const TYPES = new Set([
  'fire',
  'earthquake',
  'flood',
  'typhoon',
  'nuclear',
  'meteor',
  'blizzard',
  'grid',
]);
const LEVELS = new Set(['minor', 'moderate', 'major', 'catastrophic']);

function num(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function defaultLabState() {
  return {
    status: 'idle',
    phase: 'intro',
    classClockStart: null,
    phaseClockStart: null,
    frozenAt: null,
    disaster: null,
    updatedAt: 0,
  };
}

export function sanitizeLabState(input) {
  const src = input && typeof input === 'object' ? input : {};
  let disaster = null;
  if (src.disaster && typeof src.disaster === 'object' && TYPES.has(src.disaster.type)) {
    disaster = {
      id: String(src.disaster.id || '').slice(0, 80),
      type: src.disaster.type,
      level: LEVELS.has(src.disaster.level) ? src.disaster.level : 'major',
      issuedAt: num(src.disaster.issuedAt),
    };
  }
  return {
    status: STATUSES.has(src.status) ? src.status : 'idle',
    phase: PHASES.has(src.phase) ? src.phase : 'intro',
    classClockStart: num(src.classClockStart),
    phaseClockStart: num(src.phaseClockStart),
    frozenAt: num(src.frozenAt),
    disaster,
    updatedAt: num(src.updatedAt) || 0,
  };
}
