import { LAB_PHASES, LAB_PHASE_IDS, getPhase, phaseIndex, totalPlannedMs } from './phases.js';
import { formatClock } from './clock.js';

export function createLabState() {
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

export function clockNow(state, now) {
  if (state?.status === 'paused' && state.frozenAt) return state.frozenAt;
  return now;
}

export function startClass(state, now) {
  return {
    ...createLabState(),
    status: 'running',
    phase: 'intro',
    classClockStart: now,
    phaseClockStart: now,
    disaster: null,
    updatedAt: now,
  };
}

export function pauseClass(state, now) {
  if (state.status !== 'running') return state;
  return { ...state, status: 'paused', frozenAt: now, updatedAt: now };
}

export function resumeClass(state, now) {
  if (state.status !== 'paused' || !state.frozenAt) return state;
  const held = now - state.frozenAt;
  return {
    ...state,
    status: 'running',
    frozenAt: null,
    classClockStart: (state.classClockStart || now) + held,
    phaseClockStart: (state.phaseClockStart || now) + held,
    updatedAt: now,
  };
}

export function goToPhase(state, phaseId, now) {
  if (!LAB_PHASE_IDS.includes(phaseId)) return state;
  if (state.status === 'idle') {
    const started = startClass(state, now);
    return { ...started, phase: phaseId, updatedAt: now };
  }
  if (state.status === 'paused') {
    const frozen = state.frozenAt || now;
    return { ...state, phase: phaseId, phaseClockStart: frozen, updatedAt: now };
  }
  return { ...state, phase: phaseId, phaseClockStart: now, updatedAt: now };
}

export function nextPhase(state, now) {
  const base = state.status === 'idle' ? startClass(state, now) : state;
  const next = LAB_PHASES[Math.min(LAB_PHASES.length - 1, phaseIndex(base.phase) + (state.status === 'idle' ? 0 : 1))];
  if (state.status === 'idle') return { ...base, updatedAt: now };
  return goToPhase(base, next.id, now);
}

export function issueDisaster(state, { type, level, now, id }) {
  const disaster = {
    id: String(id || `${now}`),
    type,
    level: level || 'major',
    issuedAt: now,
  };
  const base =
    state.status === 'idle' || state.phase === 'intro' || state.phase === 'investigate'
      ? goToPhase(state, 'test', now)
      : state;
  return { ...base, disaster, updatedAt: now };
}

export function resetClass(now) {
  return { ...createLabState(), updatedAt: now };
}

export function phaseElapsedMs(state, now) {
  if (!state?.phaseClockStart) return 0;
  return Math.max(0, clockNow(state, now) - state.phaseClockStart);
}

export function classElapsedMs(state, now) {
  if (!state?.classClockStart) return 0;
  return Math.max(0, clockNow(state, now) - state.classClockStart);
}

export function describeClock(state, now) {
  const phase = getPhase(state?.phase);
  const planned = phase.minutes * 60 * 1000;
  const elapsed = phaseElapsedMs(state, now);
  const remaining = planned - elapsed;
  const status = state?.status || 'idle';
  let timerText = `${phase.short} ${formatClock(remaining)}`;
  if (status === 'idle') timerText = 'Lab waiting';
  if (status === 'paused') timerText = `${phase.short} paused`;
  return {
    status,
    phase,
    remainingMs: remaining,
    overtime: remaining < 0 && status === 'running',
    classElapsedMs: classElapsedMs(state, now),
    classPlannedMs: totalPlannedMs(),
    timerText,
    classText:
      status === 'idle'
        ? 'Class not started'
        : `${formatClock(classElapsedMs(state, now))} / ${formatClock(totalPlannedMs())}`,
  };
}
