import gameConfig from '../gameConfig.js';
import { City } from '../sim/city.js';

const SAVE_KEY = 'classroom_simcity_save';

/**
 * Local save/load via localStorage + city serialization.
 */
export class SaveLoadManager {
  constructor(game) {
    this.game = game;
  }

  save(name = 'default') {
    const city = this.game.city;
    const data = {
      name,
      timestamp: Date.now(),
      city: city.serialize(),
      budget: window.budgetManager?.budget ?? 0,
      godMode: window.ui?.godMode ?? false,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  }

  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    this.game.city.deserialize(data.city);
    this.game.initialize(this.game.city);
    if (window.budgetManager && data.budget) {
      window.budgetManager.budget = data.budget;
    }
  }

  reset(citySize = 16) {
    const city = new City(citySize);
    this.game.city = city;
    this.game.initialize(city);
    if (window.budgetManager) {
      window.budgetManager.budget = gameConfig.startingBudget;
    }
  }

  hasSave() {
    return localStorage.getItem(SAVE_KEY) !== null;
  }
}
