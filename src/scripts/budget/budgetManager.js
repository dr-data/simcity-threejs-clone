import gameConfig from '../gameConfig.js';

/**
 * Simple city budget — building costs deducted on placement.
 */
export class BudgetManager {
  budget = gameConfig.startingBudget;

  getCost(buildingType) {
    if (window.ui?.godMode) return 0;
    return gameConfig.buildingCosts[buildingType] ?? 100;
  }

  canAfford(buildingType) {
    return this.budget >= this.getCost(buildingType);
  }

  spend(buildingType) {
    const cost = this.getCost(buildingType);
    if (!window.ui?.godMode) {
      this.budget -= cost;
    }
    return cost;
  }

  refund(buildingType) {
    if (!window.ui?.godMode) {
      this.budget += Math.floor(this.getCost(buildingType) * 0.5);
    }
  }
}
