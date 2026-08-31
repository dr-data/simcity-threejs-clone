import { DISASTER_TYPES, DISASTER_LEVELS } from './disasterConfig.js';

export function formatDisasterEvent(event) {
  const type = DISASTER_TYPES[event.type];
  const level = DISASTER_LEVELS[event.level];
  const source = event.source === 'random' ? 'random' : 'triggered';
  const time = event.at
    ? new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const harm = [];
  if (event.killed) harm.push(`${event.killed} killed`);
  if (event.injured) harm.push(`${event.injured} injured`);
  if (event.zonesDamaged) harm.push(`${event.zonesDamaged} zones`);
  if (event.repairCost) harm.push(`$${event.repairCost}`);
  const impact = harm.length ? harm.join(', ') : 'no casualties yet';
  return `${type?.emoji || '⚠'} ${type?.label || event.type} (${level?.label || event.level}) · ${source}${time ? ` · ${time}` : ''} — ${impact}`;
}
