/** CCC1020 lab phases. Suggested lengths add up to one 80-minute class. */

export const CLASS_MINUTES = 80;

export const LAB_PHASES = [
  {
    id: 'intro',
    label: 'Introduction',
    short: 'Intro',
    minutes: 10,
    range: '10 min',
    student:
      'Listen for three questions: What do we depend on? How does one failure spread? Who is hardest to protect? Look around the city. Do not record numbers yet.',
    lecturer:
      'Set the scene for Theme 7, Theme 8, and Theme 12. Show a finished city. Do not send a disaster yet.',
  },
  {
    id: 'investigate',
    label: 'Investigation',
    short: 'Investigate',
    minutes: 42,
    range: '40–45 min',
    student:
      'This is Design A. Build a city, or study the one on the map. Read the resilience bar. Press Record Design A before anything goes wrong.',
    lecturer:
      'Students measure a healthy city: people without power, water, and communications. Walk the room. Do not send the disaster until the next phase.',
  },
  {
    id: 'test',
    label: 'Test and improve',
    short: 'Test',
    minutes: 13,
    range: '10–15 min',
    student:
      'Wait for the lecturer to send a typhoon, flood, earthquake, or grid failure. Watch what fails next. Record the impact, change the city (Design B), then record Design B.',
    lecturer:
      'Send one disaster from this panel. Leave speed at 1× so recovery time is easy to read. Give students time to see the cascade, then to rebuild one thing (a second plant inland, or homes off the harbour).',
  },
  {
    id: 'report',
    label: 'Report and reflection',
    short: 'Report',
    minutes: 15,
    range: '15–20 min',
    student:
      'Open Report and reflection. Answer in your own words. Download the CSV and print or copy the summary for your written report. You do not need to log in.',
    lecturer:
      'Stop building. Students export the table and complete the reflection on their own device.',
  },
];

export const LAB_PHASE_IDS = LAB_PHASES.map((phase) => phase.id);

export function getPhase(id) {
  return LAB_PHASES.find((phase) => phase.id === id) || LAB_PHASES[0];
}

export function phaseIndex(id) {
  const index = LAB_PHASE_IDS.indexOf(id);
  return index === -1 ? 0 : index;
}

export function totalPlannedMs() {
  return CLASS_MINUTES * 60 * 1000;
}
