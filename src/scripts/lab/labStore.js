const RESULTS_KEY = 'classroom-lab-results-v1';
const REFLECTION_KEY = 'classroom-lab-reflection-v1';
const RECOVERY_KEY = 'classroom-lab-recovery-v1';
const APPLIED_KEY = 'classroom-lab-applied-disaster';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export const labStore = {
  loadResults() {
    const rows = readJson(RESULTS_KEY, []);
    return Array.isArray(rows) ? rows : [];
  },
  saveResults(rows) {
    localStorage.setItem(RESULTS_KEY, JSON.stringify(rows));
  },
  loadReflection() {
    return readJson(REFLECTION_KEY, null);
  },
  saveReflection(reflection) {
    localStorage.setItem(REFLECTION_KEY, JSON.stringify(reflection));
  },
  loadRecovery() {
    return readJson(RECOVERY_KEY, null);
  },
  saveRecovery(recovery) {
    if (!recovery) localStorage.removeItem(RECOVERY_KEY);
    else localStorage.setItem(RECOVERY_KEY, JSON.stringify(recovery));
  },
  loadAppliedId() {
    return sessionStorage.getItem(APPLIED_KEY) || '';
  },
  saveAppliedId(id) {
    if (!id) sessionStorage.removeItem(APPLIED_KEY);
    else sessionStorage.setItem(APPLIED_KEY, id);
  },
};
