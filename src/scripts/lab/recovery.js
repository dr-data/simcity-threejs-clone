import { formatClock } from './clock.js';

export function startRecovery(metrics, now, disasterId) {
  return {
    disasterId,
    startedAt: now,
    seenImpact: false,
    noImpact: false,
    baseline: {
      withoutPower: metrics?.withoutPower ?? 0,
      withoutWater: metrics?.withoutWater ?? 0,
      withoutComms: metrics?.withoutComms ?? 0,
    },
    powerAt: null,
    waterAt: null,
    commsAt: null,
  };
}

export function stepRecovery(recovery, metrics, now) {
  if (!recovery) return null;
  if (!recovery.seenImpact) {
    const worse =
      metrics.withoutPower > recovery.baseline.withoutPower ||
      metrics.withoutWater > recovery.baseline.withoutWater ||
      metrics.withoutComms > recovery.baseline.withoutComms;
    if (worse) return { ...recovery, seenImpact: true, impactAt: now };
    if (now - recovery.startedAt > 4000) {
      return {
        ...recovery,
        seenImpact: true,
        noImpact: true,
        powerAt: now,
        waterAt: now,
        commsAt: now,
      };
    }
    return recovery;
  }
  if (recovery.noImpact) return recovery;
  const next = { ...recovery };
  if (next.powerAt == null && metrics.withoutPower <= recovery.baseline.withoutPower) next.powerAt = now;
  if (next.waterAt == null && metrics.withoutWater <= recovery.baseline.withoutWater) next.waterAt = now;
  if (next.commsAt == null && metrics.withoutComms <= recovery.baseline.withoutComms) next.commsAt = now;
  return next;
}

export function recoveryText(recovery, now) {
  if (!recovery) return '—';
  if (!recovery.seenImpact) return `Waiting (${formatClock(now - recovery.startedAt)})`;
  if (recovery.noImpact) return 'No extra outage';
  if (recovery.powerAt == null || recovery.waterAt == null || recovery.commsAt == null) {
    return `Still out (${formatClock(now - recovery.startedAt)})`;
  }
  const end = Math.max(recovery.powerAt, recovery.waterAt, recovery.commsAt);
  return formatClock(end - recovery.startedAt);
}
