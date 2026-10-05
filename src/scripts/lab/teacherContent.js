/** Lecturer copy for CCC1020 Doomsday Science, Hang Seng University of Hong Kong. */

import { LAB_PHASES, CLASS_MINUTES } from './phases.js';

export const LEARNING_OUTCOMES = [
  {
    theme: 'Theme 7 — critical infrastructure',
    text: 'Explain how power, fresh water, and communications depend on each other, using numbers from their own city.',
  },
  {
    theme: 'Theme 8 — cascading and compound risk',
    text: 'Trace a cascade from one shock (typhoon, flood, earthquake, or grid failure) to the services that fail next.',
  },
  {
    theme: 'Theme 12 — recovery and resilient cities',
    text: 'Compare Design A and Design B with people cut off, services lost, recovery time, and cost, and say who needs protection first.',
  },
];

export const MODEL_ANSWERS = [
  {
    id: 'dependence',
    title: 'Dependence (Theme 7)',
    text: 'Power fails first, or a plant on the harbour is lost in the typhoon. Fresh water in Hong Kong is pumped and treated with electricity (local reservoirs and water from the Dongjiang). Mobile networks, exchanges, and much of the MTR also need power. So a power cut becomes a water cut and a communications cut even when the flats are still standing. In the lab, “without water” and “without communications” rise together with “without power” during a grid failure.',
  },
  {
    id: 'cascade',
    title: 'Cascade (Theme 8)',
    text: 'A cascade is a chain: the second failure happens because the first one already happened. Example: typhoon floods harbour homes and knocks out the only power plant; inland estates then lose water because the pumps stopped. A compound disaster is two shocks at once, such as a typhoon plus a grid failure. Students should name the order they saw, not only the list of damage.',
  },
  {
    id: 'who',
    title: 'Who is most affected (Themes 7 and 12)',
    text: 'The metric groups homes by height and by the harbour. Older low-rise homes on the harbour are usually worst off: the flood or typhoon hits them directly, and they lose water and communications as well. Inland high-rise homes may keep their walls and still lose water if the grid is down. Vulnerable people include elderly residents, people in subdivided flats, and anyone who cannot leave when lifts, phones, and water fail together.',
  },
  {
    id: 'compare',
    title: 'Design A and Design B (Theme 12)',
    text: 'A strong comparison uses the table, not a vague “it was better”. Design B improves if fewer people are without power or water after the same shock, fewer shops and plants are lost, recovery time is shorter, or the repair bill is lower. Typical changes: a second plant inland (not only on the harbour), shorter power lines, homes set back from the water, and a fire station near dense housing so a fire does not take out the plant.',
  },
  {
    id: 'redundancy',
    title: 'Redundancy (Theme 12)',
    text: 'Redundancy means there is still a way to supply the service when one part fails. A second power plant on higher ground, two paths for power lines, and not housing everyone on the harbour are the levers this model actually rewards. Say which number that would change (recovery time, or people without water).',
  },
  {
    id: 'protect',
    title: 'Protecting people (Theme 12)',
    text: 'Answers should name a real Hong Kong measure: cooling and water for estate residents in a power cut, backup power for pumping stations and hospitals, typhoon shelters and clear messages when mobile networks fail, and extra help for elderly people and subdivided flats. Rebuilding the service matters as much as rebuilding the blocks.',
  },
];

export function runSheetRows() {
  let start = 0;
  return LAB_PHASES.map((phase) => {
    const from = start;
    start += phase.minutes;
    return {
      clock: `${formatMinute(from)}–${formatMinute(start)}`,
      phase: phase.label,
      range: phase.range,
      lecturer: phase.lecturer,
      students: phase.student,
    };
  });
}

function formatMinute(total) {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

export function teacherIntro() {
  return `CCC1020 Doomsday Science, Hang Seng University of Hong Kong. One ${CLASS_MINUTES}-minute class on Theme 7 (critical infrastructure), Theme 8 (cascading and compound risk), and Theme 12 (recovery and resilient cities). Students do not need to log in to record results or write the reflection.`;
}
