import * as THREE from 'three';
import { AssetManager } from './assets/assetManager.js';
import { CameraManager } from './camera.js';
import { InputManager } from './input.js';
import { City } from './sim/city.js';
import { SimObject } from './sim/simObject.js';
import gameConfig from './gameConfig.js';
import { SessionManager } from './session/sessionManager.js';
import { DISASTER_LEVELS } from './disaster/disasterConfig.js';
import { DisasterManager } from './disaster/disasterManager.js';
import { CheatConsole } from './cheat/cheatConsole.js';
import { SaveLoadManager } from './save/saveLoadManager.js';
import { BudgetManager } from './budget/budgetManager.js';
import { applyTemplate, CITY_TEMPLATES } from './templates/cityTemplates.js';
import { authClient } from './auth/authClient.js';

/**
 * Manager for the Three.js scene. Handles rendering of a `City` object.
 */
export class Game {
  focusedObject = null;
  selectedObject = null;

  constructor() {
    window.gameConfig = gameConfig;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
    });
    this.scene = new THREE.Scene();

    this.inputManager = new InputManager(window.ui.gameWindow);
    this.cameraManager = new CameraManager(window.ui.gameWindow);

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    if (isMobile) {
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }

    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
    this.renderer.setClearColor(0x000000, 0);

    window.ui.gameWindow.appendChild(this.renderer.domElement);

    this.raycaster = new THREE.Raycaster();

    window.budgetManager = new BudgetManager();
    window.assetManager = new AssetManager(() => {
      window.ui.hideLoadingText();
      this.city = new City(16);
      this.initialize(this.city);
      this._setupManagers();
      this.start();
      setInterval(this.simulate.bind(this), 1000);
      this._initSession();
    });

    window.addEventListener('resize', this.onResize.bind(this), false);
  }

  _setupManagers() {
    window.disasterManager = new DisasterManager(this);
    window.saveLoadManager = new SaveLoadManager(this);
    window.cheatConsole = new CheatConsole(this);

    window.sessionManager = new SessionManager(
      (time) => window.ui.updateTimeRemaining(time),
      (m) => window.ui.showMilestone(m),
      (stats) => window.ui.showEndScreen(stats)
    );
    window.sessionManager.durationMs = gameConfig.sessionLengthMinutes * 60 * 1000;
  }

  async _initSession() {
    try {
      const { user } = await authClient.me();
      window.ui.setUser(user);
    } catch {
      window.ui.setUser(null);
    }

    const quickStart = new URLSearchParams(window.location.search).get('quick') === '1';
    if (quickStart || gameConfig.defaultTemplate !== 'blank') {
      const templateId = quickStart ? gameConfig.quickStartTemplate : gameConfig.defaultTemplate;
      if (CITY_TEMPLATES[templateId]) {
        const result = applyTemplate(this.city, templateId);
        this.initialize(this.city);
        if (result) window.budgetManager.budget = result.budget;
      }
    } else {
      window.budgetManager.budget = gameConfig.startingBudget;
    }

    if (gameConfig.showTutorial) {
      window.ui.maybeShowTutorialWelcome();
    }

    window.disasterManager.onSessionStart(this.city);
    window.sessionManager.start();
    window.ui.updateStatsPanel(this.city);
  }

  initialize(city) {
    this.scene.clear();
    this.scene.add(city);
    this.#setupLights();
    this.#setupGrid(city);
  }

  #setupGrid(city) {
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      map: window.assetManager.textures['grid'],
      transparent: true,
      opacity: 0.2,
    });
    gridMaterial.map.repeat = new THREE.Vector2(city.size, city.size);
    gridMaterial.map.wrapS = city.size;
    gridMaterial.map.wrapT = city.size;

    const grid = new THREE.Mesh(new THREE.BoxGeometry(city.size, 0.1, city.size), gridMaterial);
    grid.position.set(city.size / 2 - 0.5, -0.04, city.size / 2 - 0.5);
    this.scene.add(grid);
  }

  #setupLights() {
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-10, 20, 0);
    sun.castShadow = this.renderer.shadowMap.enabled;
    if (sun.castShadow) {
      sun.shadow.camera.left = -20;
      sun.shadow.camera.right = 20;
      sun.shadow.camera.top = 20;
      sun.shadow.camera.bottom = -20;
      sun.shadow.mapSize.width = 1024;
      sun.shadow.mapSize.height = 1024;
      sun.shadow.camera.near = 10;
      sun.shadow.camera.far = 50;
      sun.shadow.normalBias = 0.01;
    }
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  }

  start() {
    this.renderer.setAnimationLoop(this.draw.bind(this));
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  draw() {
    this.city.draw();
    this.updateFocusedObject();
    this.cameraManager.updateTransition();
    this.cameraManager.updateOrbit();
    window.disasterManager?.update();
    window.disasterManager?.applyShake(this.cameraManager.camera);

    if (this.inputManager.isLeftMouseDown) {
      this.useTool();
    }

    this.renderer.render(this.scene, this.cameraManager.camera);
  }

  simulate() {
    if (window.ui.isPaused || window.sessionManager?.isEnded) return;

    this.city.simulate(1);
    window.ui.updateTitleBar(this);
    window.ui.updateInfoPanel(this.selectedObject);
    window.ui.updateStatsPanel(this.city);

    const stats = this.city.getSessionStats();
    window.sessionManager?.checkMilestones(stats);

    if (window.sessionManager?.getTimeRemainingMs() <= 0) {
      window.sessionManager.endSession(stats);
    }
  }

  useTool() {
    switch (window.ui.activeToolId) {
      case 'select':
        this.updateSelectedObject();
        window.ui.updateInfoPanel(this.selectedObject);
        break;
      case 'bulldoze':
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const tile = this.city.getTile(x, y);
          if (tile?.building) {
            window.budgetManager.refund(tile.building.type);
            this.city.bulldoze(x, y);
            window.ui.updateTitleBar(this);
          }
        }
        break;
      default:
        if (this.focusedObject) {
          const { x, y } = this.focusedObject;
          const type = window.ui.activeToolId;
          if (!window.budgetManager.canAfford(type)) {
            window.ui.showToast('Insufficient budget!');
            return;
          }
          const tile = this.city.getTile(x, y);
          if (tile && !tile.building) {
            window.budgetManager.spend(type);
            this.city.placeBuilding(x, y, type);
            window.ui.updateTitleBar(this);
          }
        }
        break;
    }
  }

  updateSelectedObject() {
    this.selectedObject?.setSelected(false);
    this.selectedObject = this.focusedObject;
    this.selectedObject?.setSelected(true);
  }

  updateFocusedObject() {
    this.focusedObject?.setFocused(false);
    const newObject = this.#raycast();
    if (newObject !== this.focusedObject) {
      this.focusedObject = newObject;
    }
    this.focusedObject?.setFocused(true);
  }

  #raycast() {
    const coords = {
      x: (this.inputManager.mouse.x / this.renderer.domElement.clientWidth) * 2 - 1,
      y: -(this.inputManager.mouse.y / this.renderer.domElement.clientHeight) * 2 + 1,
    };

    this.raycaster.setFromCamera(coords, this.cameraManager.camera);

    const intersections = this.raycaster.intersectObjects(this.city.root.children, true);
    if (intersections.length > 0) {
      return intersections[0].object.userData;
    }
    return null;
  }

  onResize() {
    this.cameraManager.resize(window.ui.gameWindow);
    this.renderer.setSize(window.ui.gameWindow.clientWidth, window.ui.gameWindow.clientHeight);
  }

  triggerDisaster(type, level) {
    const levelId = level || 'moderate';
    const levelMeta = DISASTER_LEVELS[levelId] || DISASTER_LEVELS.moderate;
    const cost = levelMeta.cost;

    if (!window.ui.godMode) {
      if (window.budgetManager.budget < cost) {
        window.ui.showToast(`Need $${cost} budget to trigger disaster (or use GOD mode).`);
        return;
      }
      window.budgetManager.budget -= cost;
      window.ui.updateTitleBar(this);
    }

    if (type) {
      window.disasterManager?.triggerDisaster(type, levelId);
    } else {
      window.disasterManager?.triggerRandomDisaster();
    }
  }

  loadTemplate(templateId) {
    const result = applyTemplate(this.city, templateId);
    if (result) {
      this.initialize(this.city);
      window.budgetManager.budget = result.budget;
      window.ui.updateTitleBar(this);
      window.ui.updateStatsPanel(this.city);
    }
  }
}

window.onload = () => {
  window.game = new Game();
};
