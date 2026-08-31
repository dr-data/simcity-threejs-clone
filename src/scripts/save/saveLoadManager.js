import gameConfig from '../gameConfig.js';
import { City } from '../sim/city.js';
import { authClient } from '../auth/authClient.js';
import { buildCityFile, parseCityFile, isForeignCityFile } from './cityFile.js';

/**
 * Manual city export/import. There is no autosave.
 * Short codes are server lookup slips bound to an HSU ID, not encodings of the map.
 */
export class SaveLoadManager {
  constructor(game) {
    this.game = game;
    this.scoreEligible = true;
  }

  snapshot() {
    return buildCityFile({
      city: this.game.city.serialize(),
      budget: window.budgetManager?.budget ?? 0,
      ownerId: window.ui?.currentUser?.username,
    });
  }

  applyFile(file) {
    const data = parseCityFile(file);
    this.game.city.deserialize(data.city);
    this.game.initialize(this.game.city);
    if (window.budgetManager && data.budget != null) {
      window.budgetManager.budget = data.budget;
    }
    const foreign = isForeignCityFile(data, window.ui?.currentUser?.username);
    this.scoreEligible = !foreign;
    return { foreign, ownerId: data.ownerId };
  }

  exportFile() {
    const file = this.snapshot();
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
    const who = file.ownerId || 'guest';
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `city-${who}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    return file;
  }

  async importFile(fileBlob) {
    const text = await fileBlob.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('That file is not valid JSON');
    }
    return this.applyFile(json);
  }

  async issueRestoreCode() {
    const data = await authClient.saveCityCode(this.snapshot());
    return data.code;
  }

  async redeemRestoreCode(raw) {
    const data = await authClient.loadCityCode(String(raw || '').trim());
    return this.applyFile(data.file);
  }

  reset(citySize = 16) {
    const city = new City(citySize);
    this.game.city = city;
    this.game.initialize(city);
    if (window.budgetManager) {
      window.budgetManager.budget = gameConfig.startingBudget;
    }
    this.scoreEligible = true;
  }
}
