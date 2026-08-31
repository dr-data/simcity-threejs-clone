const STORAGE_KEY = 'simcity_user_settings';
const SESSION_SKIP_KEY = 'simcity_tutorial_welcome_skipped';

const defaults = {
  tutorialOnStart: true,
  tutorialTourCompleted: false,
};

export const settingsManager = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const stored = raw ? JSON.parse(raw) : {};
      // Migrate legacy flag: welcome seen without completing tour should not block replay
      if (stored.tutorialWelcomeSeen && !stored.tutorialTourCompleted) {
        stored.tutorialTourCompleted = false;
      }
      delete stored.tutorialWelcomeSeen;
      return { ...defaults, ...stored };
    } catch {
      return { ...defaults };
    }
  },

  set(patch) {
    const next = { ...this.get(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  },

  isTutorialOnStart() {
    return this.get().tutorialOnStart;
  },

  setTutorialOnStart(enabled) {
    return this.set({ tutorialOnStart: enabled });
  },

  hasCompletedTour() {
    return this.get().tutorialTourCompleted;
  },

  markTourCompleted() {
    return this.set({ tutorialTourCompleted: true });
  },

  resetTourCompleted() {
    return this.set({ tutorialTourCompleted: false });
  },

  wasWelcomeSkippedThisSession() {
    try {
      return sessionStorage.getItem(SESSION_SKIP_KEY) === '1';
    } catch {
      return false;
    }
  },

  markWelcomeSkippedThisSession() {
    try {
      sessionStorage.setItem(SESSION_SKIP_KEY, '1');
    } catch {
      /* ignore */
    }
  },

  clearWelcomeSkippedThisSession() {
    try {
      sessionStorage.removeItem(SESSION_SKIP_KEY);
    } catch {
      /* ignore */
    }
  },
};
