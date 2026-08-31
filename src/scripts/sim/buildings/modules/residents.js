import config from '../../../config.js';
import { Citizen } from '../../citizen.js';
import { City } from '../../city.js';
import { Zone as ResidentialZone } from '../../buildings/zones/zone.js';
import { DevelopmentState } from './development.js';
import { SimModule } from './simModule.js';

/**
 * Logic for residents moving into and out of a building
 */
export class ResidentsModule extends SimModule {
  /**
   * @type {ResidentialZone}
   */
  #zone;

  /**
   * @type {Citizen[]}
   */
  #residents = [];

  /**
   * @param {ResidentialZone} zone 
   */
  constructor(zone) {
    super();
    this.#zone = zone;
  }

  /**
   * Returns the number of residents
   * @type {number}
   */
  get count() {
    return this.#residents.length;
  }

  /**
   * Maximuim number of residents that can live in this building
   * @returns {number}
   */
  get maximum() {
    return Math.pow(config.modules.residents.maxResidents, this.#zone.development.level);
  }

  /**
   * @param {City} city 
   */
  simulate(city) {
    // If building is abandoned, all residents are evicted and no more residents are allowed to move in.
    if (this.#zone.development.state === DevelopmentState.abandoned && this.#residents.length > 0) {
      this.evictAll();
    } else if (this.#zone.development.state === DevelopmentState.developed) {
      // Move in new residents if there is room
      if (this.#residents.length < this.maximum && Math.random() < config.modules.residents.residentMoveInChance) {
        this.#residents.push(new Citizen(this.#zone));
      }
    }

    for (const resident of this.#residents) {
      resident.simulate(city);
    }
  }

  seedOccupants() {
    if (this.#zone.development.state !== DevelopmentState.developed) return;
    while (this.#residents.length < this.maximum) {
      this.#residents.push(new Citizen(this.#zone));
    }
  }

  /**
   * Evicts all residents from the building
   */
  #evictAll() {
    for (const resident of this.#residents) {
      resident.dispose();
    }
    this.#residents = [];
  }

  /**
   * Disaster casualties — removes killed residents, counts injured survivors.
   * @param {number} fatalRate 0–1 fraction of residents killed
   * @param {number} injureRate 0–1 fraction of remaining residents injured
   */
  applyDisasterCasualties(fatalRate, injureRate) {
    const total = this.#residents.length;
    if (total === 0) return { killed: 0, injured: 0 };

    const killTarget = Math.min(total, Math.max(0, Math.round(total * fatalRate)));
    const shuffled = [...this.#residents].sort(() => Math.random() - 0.5);

    for (let i = 0; i < killTarget; i++) {
      shuffled[i].dispose();
    }
    this.#residents = shuffled.slice(killTarget);

    const remaining = this.#residents.length;
    const injured = Math.min(
      remaining,
      Math.max(0, Math.round(remaining * injureRate))
    );

    return { killed: killTarget, injured };
  }

  /**
   * Handles any clean up needed before a building is removed
   */
  dispose() {
    this.#evictAll();
  }

  /**
   * Returns an HTML representation of this object
   * @returns {string}
   */
  toHTML() {
    let html = `<div class="info-heading">Residents (${this.#residents.length}/${this.maximum})</div>`;

    html += '<ul class="info-citizen-list">';
    for (const resident of this.#residents) {
      html += resident.toHTML();
    }
    html += '</ul>';

    return html;
  }
}