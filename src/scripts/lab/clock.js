/** Format a duration. Negative values render as overtime, for example +1:05. */
export function formatClock(ms) {
  const overtime = ms < 0;
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const text = `${minutes}:${String(seconds).padStart(2, '0')}`;
  return overtime ? `+${text}` : text;
}

export function formatStamp(epochMs) {
  if (!epochMs) return '';
  try {
    return new Date(epochMs).toLocaleString('en-HK', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}
