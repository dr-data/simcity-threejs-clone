/**
 * Teacher-configurable settings for classroom sessions.
 * Override via VITE_GAME_CONFIG JSON env or edit defaults below.
 */

const defaults = {
  sessionLengthMinutes: 15,
  disasterFrequencyMin: 1,
  disasterFrequencyMax: 3,
  disasterSeverity: 0.25,
  startingBudget: 5000,
  allowGodMode: true,
  allowCheats: true,
  defaultTemplate: 'balanced',
  quickStartTemplate: 'small-town',
  showTutorial: true,
  milestones: [
    { id: 'residents-500', label: 'Reach 500 residents', check: (s) => s.residents >= 500 },
    {
      id: 'disaster-survivor',
      label: 'Survive 2 disasters with <20% damage',
      check: (s) => s.disastersSurvived >= 2 && s.disasterResilience >= 80,
    },
    { id: 'zones-20', label: 'Develop 20 zones', check: (s) => s.developedZones >= 20 },
  ],
  buildingCosts: {
    residential: 100,
    commercial: 150,
    industrial: 200,
    road: 50,
    'power-plant': 500,
    'power-line': 25,
  },
  reflectionPrompts: [
    'What trade-offs did you make between growth, sustainability, and safety?',
    'What was your biggest challenge?',
    'How did disasters change your planning?',
  ],
};

let config = { ...defaults };

try {
  const envConfig = import.meta.env.VITE_GAME_CONFIG;
  if (envConfig) {
    config = { ...defaults, ...JSON.parse(envConfig) };
  }
} catch {
  /* use defaults */
}

export default config;
export { defaults };
