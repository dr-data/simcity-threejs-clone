/**
 * Teacher-configurable settings for classroom sessions.
 * Override via VITE_GAME_CONFIG JSON env or edit defaults below.
 */

const defaults = {
  sessionLengthMinutes: 15,
  simStartDate: '2026-09-01',
  disasterFrequencyMin: 1,
  disasterFrequencyMax: 3,
  disasterSeverity: 0.25,
  startingBudget: 5000,
  allowGodMode: true,
  allowCheats: true,
  aiEnabled: true,
  defaultTemplate: 'blank',
  quickStartTemplate: 'disaster-lab',
  showTutorial: true,
  milestones: [
    { id: 'flatten-half', label: 'Destroy half the buildings', check: (s) => s.buildingsDestroyed >= (s.startingBuildings || 1) / 2 },
    { id: 'disaster-two', label: 'Run 2 disasters', check: (s) => (s.disasterCount || 0) >= 2 },
  ],
  buildingCosts: {
    residential: 100,
    commercial: 150,
    industrial: 200,
    road: 50,
    'power-plant': 500,
    'power-plant-petroleum': 450,
    'power-plant-nuclear': 900,
    'fire-station': 350,
    'power-line': 25,
  },
  reflectionPrompts: [
    'Which disaster type cleared the most buildings, and why?',
    'Did a bigger map leave you too much standing when time ran out?',
    'Would a shorter timer have changed which buildings you hit first?',
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
