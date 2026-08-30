/** Tool / building descriptions for tooltips and the active-tool hint bar. */
export const TOOL_TIPS = {
  select: {
    name: 'Select',
    tip: 'Tap or click a tile to inspect buildings and zones.',
    cost: null,
  },
  bulldoze: {
    name: 'Bulldoze',
    tip: 'Remove buildings and zones. Refunds part of the cost.',
    cost: null,
  },
  residential: {
    name: 'Residential',
    tip: 'Housing zone. Needs road access and power to grow.',
    cost: 100,
  },
  commercial: {
    name: 'Commercial',
    tip: 'Shops and offices. Creates jobs for residents.',
    cost: 150,
  },
  industrial: {
    name: 'Industrial',
    tip: 'Factories and warehouses. High jobs but disaster-prone.',
    cost: 200,
  },
  road: {
    name: 'Road',
    tip: 'Connect zones to the city network so they can develop.',
    cost: 50,
  },
  'power-plant-petroleum': {
    name: 'Petroleum Plant',
    tip: 'Generates 120 kW. Cheaper but no meltdown risk.',
    cost: 450,
  },
  'power-plant-nuclear': {
    name: 'Nuclear Plant',
    tip: 'Generates 280 kW. Can melt down during earthquakes or fires.',
    cost: 900,
  },
  'fire-station': {
    name: 'Fire Station',
    tip: 'Slows fire spread nearby. Pair with Fire Dispatch during disasters.',
    cost: 350,
  },
  'power-line': {
    name: 'Power Line',
    tip: 'Carries electricity from plants to zones.',
    cost: 25,
  },
};

export function getToolTip(toolId) {
  return TOOL_TIPS[toolId] || { name: toolId, tip: '', cost: null };
}

export function formatToolHint(toolId) {
  const meta = getToolTip(toolId);
  const costStr = meta.cost != null ? ` · $${meta.cost}` : '';
  return `${meta.name}${costStr} — ${meta.tip}`;
}
