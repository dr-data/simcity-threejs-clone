import { Building } from '../building.js';
import { BuildingType } from '../buildingType.js';

export class FireStation extends Building {
  /** Tiles within this radius get faster fire suppression */
  suppressionRadius = 4;

  constructor(x = 0, y = 0) {
    super(x, y);
    this.type = BuildingType.fireStation;
    this.name = 'Fire Station';
    this.power.required = 0;
  }

  refreshView() {
    const mesh = window.assetManager.getModel(this.type, this);
    this.setMesh(mesh);
  }

  toHTML() {
    let html = super.toHTML();
    html += `
      <div class="info-heading">Fire Service</div>
      <span class="info-label">Coverage </span>
      <span class="info-value">${this.suppressionRadius} tiles</span>
      <br>
      <span class="info-label">Effect </span>
      <span class="info-value">Slows fire spread & helps extinguish</span>
      <br>`;
    return html;
  }
}
