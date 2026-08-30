import gameConfig from '../gameConfig.js';
import {
  CITY_TEMPLATES,
  applyTemplate,
  placeZonesInArea,
  placePowerPlants,
} from '../templates/cityTemplates.js';

/**
 * Teacher cheat console — press / or click console button.
 */
export class CheatConsole {
  visible = false;

  constructor(game) {
    this.game = game;
    this.el = document.getElementById('cheat-console');
    this.input = document.getElementById('cheat-input');
    this.output = document.getElementById('cheat-output');

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !this.visible && gameConfig.allowCheats) {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this.visible) {
        this.toggle();
      }
    });

    if (this.input) {
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.run(this.input.value);
          this.input.value = '';
        }
      });
    }
  }

  toggle() {
    if (!gameConfig.allowCheats) return;
    this.visible = !this.visible;
    if (this.el) {
      this.el.style.display = this.visible ? 'flex' : 'none';
    }
    if (this.visible && this.input) {
      this.input.focus();
    }
  }

  log(msg) {
    if (this.output) {
      this.output.textContent = msg;
    }
  }

  run(cmdLine) {
    const parts = cmdLine.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const city = this.game.city;

    switch (cmd) {
      case 'help':
        this.log(
          'Commands: zone residential|commercial|industrial <n>, powerplants <n>, god on|off, template <name>, budget <n>'
        );
        break;
      case 'zone':
        const type = parts[1];
        const count = parseInt(parts[2], 10) || 5;
        if (!['residential', 'commercial', 'industrial'].includes(type)) {
          this.log('Usage: zone residential|commercial|industrial <count>');
        } else {
          const n = placeZonesInArea(city, type, count);
          this.log(`Placed ${n} ${type} zones.`);
        }
        break;
      case 'powerplants':
        const pp = placePowerPlants(city, parseInt(parts[1], 10) || 1);
        this.log(`Placed ${pp} power plants.`);
        break;
      case 'god':
        const on = parts[1] === 'on';
        window.ui.godMode = on;
        this.log(`GOD mode ${on ? 'ON' : 'OFF'}`);
        break;
      case 'template':
        const id = parts[1] || 'small-town';
        if (!CITY_TEMPLATES[id]) {
          this.log(`Unknown template. Available: ${Object.keys(CITY_TEMPLATES).join(', ')}`);
        } else {
          const result = applyTemplate(city, id);
          this.game.initialize(city);
          if (result && window.budgetManager) {
            window.budgetManager.budget = result.budget;
          }
          this.log(`Loaded template: ${result?.name || id}`);
        }
        break;
      case 'budget':
        const amount = parseInt(parts[1], 10);
        if (window.budgetManager && amount) {
          window.budgetManager.budget = amount;
          this.log(`Budget set to $${amount}`);
        }
        break;
      case 'disaster':
        const dType = parts[1];
        const dLevel = parts[2] || 'moderate';
        if (dType) {
          window.disasterManager?.triggerDisaster(dType, dLevel);
        } else {
          window.disasterManager?.triggerRandomDisaster();
        }
        this.log('Disaster triggered!');
        break;
      default:
        this.log('Unknown command. Type help.');
    }
  }
}
