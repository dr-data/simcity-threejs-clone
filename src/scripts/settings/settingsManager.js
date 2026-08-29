const STORAGE_KEY = 'simcity_user_settings';

const defaults = {
  tutorialOnStart: true,
  tutorialWelcomeSeen: false,
};

export const settingsManager = {
  get() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
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

  hasSeenWelcome() {
    return this.get().tutorialWelcomeSeen;
  },

  markWelcomeSeen() {
    return this.set({ tutorialWelcomeSeen: true });
  },

  resetWelcomeSeen() {
    return this.set({ tutorialWelcomeSeen: false });
  },
};
