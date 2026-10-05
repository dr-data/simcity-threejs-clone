import { formatStamp } from './clock.js';

export function createResultRow({ kind, label, phase, metrics, recovery, cost, now, note = '' }) {
  return {
    id: `${now}-${kind}`,
    kind,
    label,
    phase: phase || '',
    recordedAt: now,
    note,
    people: metrics?.people ?? 0,
    withoutPower: metrics?.withoutPower ?? 0,
    withoutWater: metrics?.withoutWater ?? 0,
    withoutComms: metrics?.withoutComms ?? 0,
    servicesLost: metrics?.servicesLost ?? 0,
    servicesDetail: metrics?.servicesDetail || '',
    recovery: recovery || '—',
    cost: cost ?? 0,
    mostAffected: metrics?.mostAffected || '',
  };
}

export function upsertRow(rows, row) {
  const next = rows.filter((item) => item.kind !== row.kind || (row.kind === 'custom' && item.id !== row.id));
  next.push(row);
  return next;
}

function csvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const CSV_HEADERS = [
  'Label',
  'Phase',
  'Recorded',
  'People',
  'Without power',
  'Without water',
  'Without communications',
  'Services lost',
  'Services detail',
  'Recovery',
  'Cost',
  'Most affected',
  'Notes',
];

export function resultsToCsv(rows) {
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.label,
        row.phase,
        formatStamp(row.recordedAt),
        row.people,
        row.withoutPower,
        row.withoutWater,
        row.withoutComms,
        row.servicesLost,
        row.servicesDetail,
        row.recovery,
        row.cost,
        row.mostAffected,
        row.note,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return lines.join('\n');
}

export function latestByKind(rows, kind) {
  const matches = rows.filter((row) => row.kind === kind);
  return matches.length ? matches[matches.length - 1] : null;
}

export function compareDesigns(rows) {
  const before = latestByKind(rows, 'design-a');
  const after = latestByKind(rows, 'design-b');
  if (!before || !after) return '';
  const pair = (label, key) => `${label}: ${before[key]} → ${after[key]}`;
  return [
    'Design A compared with Design B.',
    pair('Without power', 'withoutPower'),
    pair('Without water', 'withoutWater'),
    pair('Without communications', 'withoutComms'),
    pair('Services lost', 'servicesLost'),
    `Recovery: ${before.recovery} → ${after.recovery}`,
    pair('Cost', 'cost'),
  ].join(' ');
}

export function resultsSummary(rows, reflection) {
  const lines = ['Classroom SimCity — lab results', ''];
  if (reflection?.name) lines.push(`Name: ${reflection.name}`);
  if (reflection?.city) lines.push(`City: ${reflection.city}`);
  lines.push('');
  if (!rows.length) {
    lines.push('No rows recorded yet.');
  }
  for (const row of rows) {
    lines.push(`${row.label} (${row.phase || 'lab'}, ${formatStamp(row.recordedAt)})`);
    lines.push(`People: ${row.people}`);
    lines.push(`Without power: ${row.withoutPower}`);
    lines.push(`Without water: ${row.withoutWater}`);
    lines.push(`Without communications: ${row.withoutComms}`);
    lines.push(`Services lost: ${row.servicesLost} (${row.servicesDetail})`);
    lines.push(`Recovery: ${row.recovery}`);
    lines.push(`Cost: $${row.cost}`);
    lines.push(`Most affected: ${row.mostAffected}`);
    if (row.note) lines.push(`Notes: ${row.note}`);
    lines.push('');
  }
  const comparison = compareDesigns(rows);
  if (comparison) {
    lines.push(comparison);
    lines.push('');
  }
  return lines.join('\n').trim();
}
