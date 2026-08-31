export function simIntervalMs(speed) {
  return Math.max(50, Math.round(1000 / Math.max(1, Number(speed) || 1)));
}
