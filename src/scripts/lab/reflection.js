/** Written prompts for the individual reflection. No login. */

export const REFLECTION_PROMPTS = [
  {
    id: 'dependence',
    theme: 'Theme 7',
    text: 'Which essential service failed first in your city, and which other services depended on it? Mention power, water, and communications.',
  },
  {
    id: 'cascade',
    theme: 'Theme 8',
    text: 'Describe the cascade. What failed because something else had already failed? Was this one shock, or a compound disaster (more than one at the same time)?',
  },
  {
    id: 'who',
    theme: 'Theme 7 and 12',
    text: 'Who was most affected, and why? Use your table. Think about harbour homes and older low-rise housing, not only the total population.',
  },
  {
    id: 'compare',
    theme: 'Theme 12',
    text: 'Compare Design A and Design B. Which numbers improved (people without power or water, services lost, recovery time, cost)? What did you change on the map?',
  },
  {
    id: 'redundancy',
    theme: 'Theme 12',
    text: 'What redundancy would you add with another ten minutes? Redundancy means the city still has a way to supply a service when one part fails.',
  },
  {
    id: 'protect',
    theme: 'Theme 12',
    text: 'One thing you would tell the Hong Kong government about protecting vulnerable people after a typhoon or a power cut.',
  },
];

export function emptyReflection(prefill = {}) {
  return {
    name: prefill.name || '',
    city: prefill.city || '',
    answers: Object.fromEntries(REFLECTION_PROMPTS.map((prompt) => [prompt.id, ''])),
  };
}

export function reflectionSummary(reflection) {
  const lines = ['Classroom SimCity — report and reflection', ''];
  lines.push(`Name: ${reflection?.name || ''}`);
  lines.push(`City: ${reflection?.city || ''}`);
  lines.push('');
  for (const prompt of REFLECTION_PROMPTS) {
    lines.push(`${prompt.theme}. ${prompt.text}`);
    lines.push(reflection?.answers?.[prompt.id]?.trim() || '(no answer yet)');
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function fullHandout(rowsSummary, reflection) {
  return `${rowsSummary}\n\n${reflectionSummary(reflection)}`;
}
