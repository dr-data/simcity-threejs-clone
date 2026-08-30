import { Building } from '../building.js';
import { BuildingType } from '../buildingType.js';

/**
 * Power plant — petroleum (default) or nuclear variant.
 */
export class PowerPlant extends Building {
  powerCapacity = 120;
  powerConsumed = 0;
  /** @type {'petroleum' | 'nuclear'} */
  plantKind = 'petroleum';

  constructor(x = 0, y = 0, plantKind = 'petroleum') {
    super(x, y);
    this.plantKind = plantKind;
    if (plantKind === 'nuclear') {
      this.type = BuildingType.powerPlantNuclear;
      this.powerCapacity = 280;
      this.name = 'Nuclear Plant';
    } else {
      this.type =
        plantKind === 'legacy' ? BuildingType.powerPlant : BuildingType.powerPlantPetroleum;
      this.powerCapacity = 120;
      this.name = 'Petroleum Plant';
    }
  }

  get powerAvailable() {
    if (this.roadAccess.value) {
      return this.powerCapacity - this.powerConsumed;
    }
    return 0;
  }

  get isNuclear() {
    return this.plantKind === 'nuclear';
  }

  refreshView() {
    let modelKey = 'power-plant-petroleum';
    if (this.plantKind === 'nuclear') modelKey = 'power-plant-nuclear';
    else if (this.type === BuildingType.powerPlant) modelKey = 'power-plant';

    const mesh = window.assetManager.getModel(modelKey, this);
    this.setMesh(mesh);
  }

  toHTML() {
    let html = super.toHTML();
    html += `
      <div class="info-heading">Power</div>
      <span class="info-label">Plant Type </span>
      <span class="info-value">${this.plantKind === 'nuclear' ? 'Nuclear' : 'Petroleum'}</span>
      <br>
      <span class="info-label">Power Capacity (kW)</span>
      <span class="info-value">${this.powerCapacity}</span>
      <br>
      <span class="info-label">Power Consumed (kW)</span>
      <span class="info-value">${this.powerConsumed}</span>
      <br>
      <span class="info-label">Power Available (kW)</span>
      <span class="info-value">${this.powerAvailable}</span>
      <br>`;
    return html;
  }
}
