import { Game } from './game.js';
import { SimObject } from './sim/simObject';
import playIconUrl from '/icons/play-color.png';
import pauseIconUrl from '/icons/pause-color.png';
import gameConfig from './gameConfig.js';
import { CITY_TEMPLATES } from './templates/cityTemplates.js';
import { authClient } from './auth/authClient.js';
import { settingsManager } from './settings/settingsManager.js';
import { initTutorial, startGuidedTour } from './tutorial/initTutorial.jsx';
import {
  DISASTER_TYPES,
  DISASTER_LEVELS,
  DISASTER_TYPE_IDS,
  DISASTER_LEVEL_IDS,
} from './disaster/disasterConfig.js';
import { TOOL_TIPS, formatToolHint } from './toolTips.js';
import { formatDisasterEvent } from './disaster/disasterLogFormat.js';
import { fallbackTip } from './ai/localTip.js';

const SIM_START_DATE = gameConfig.simStartDate || '2026-09-01';

export class GameUI {
  activeToolId = 'select';
  selectedControl = document.getElementById('button-select');
  isPaused = false;
  godMode = false;
  currentUser = null;
  simSpeed = 1;

  get gameWindow() {
    return document.getElementById('render-target');
  }

  showLoadingText() {
    document.getElementById('loading').style.visibility = 'visible';
  }

  hideLoadingText() {
    document.getElementById('loading').style.visibility = 'hidden';
  }

  onToolSelected(event) {
    const btn = event.target.closest('.ui-button');
    if (!btn) return;
    if (this.selectedControl) {
      this.selectedControl.classList.remove('selected');
    }
    this.selectedControl = btn;
    this.selectedControl.classList.add('selected');
    const type = this.selectedControl.getAttribute('data-type');
    if (type) {
      this.activeToolId = type;
      this.updateToolHint(type);
    }
  }

  updateToolHint(toolId = this.activeToolId) {
    const bar = document.getElementById('tool-hint-bar');
    if (!bar) return;
    const hint = formatToolHint(toolId);
    bar.textContent = hint;
    bar.dataset.tool = toolId;
  }

  initTooltips() {
    document.querySelectorAll('[data-tool]').forEach((el) => {
      const id = el.getAttribute('data-tool');
      const meta = TOOL_TIPS[id];
      if (!meta) return;
      const cost = meta.cost != null ? ` ($${meta.cost})` : '';
      el.setAttribute('title', `${meta.name}${cost}: ${meta.tip}`);
      el.setAttribute('aria-label', meta.name);
    });

    document.querySelectorAll('.ui-button[data-type]').forEach((btn) => {
      const id = btn.getAttribute('data-type');
      const meta = TOOL_TIPS[id];
      if (!meta) return;
      const cost = meta.cost != null ? ` ($${meta.cost})` : '';
      btn.setAttribute('title', `${meta.name}${cost}: ${meta.tip}`);
      btn.setAttribute('aria-label', meta.name);
    });

    const pauseBtn = document.getElementById('button-pause');
    if (pauseBtn) {
      pauseBtn.setAttribute('title', 'Pause or resume the simulation');
      pauseBtn.setAttribute('aria-label', 'Pause');
    }
    this.syncSimSpeedButtons(1);

    const godBtn = document.getElementById('button-god');
    if (godBtn) {
      godBtn.setAttribute('title', 'GOD mode — free building and disasters');
      godBtn.setAttribute('aria-label', 'GOD mode');
    }

    const disasterBtn = document.getElementById('button-disaster');
    if (disasterBtn) {
      disasterBtn.setAttribute('title', 'Trigger the selected disaster type');
      disasterBtn.setAttribute('aria-label', 'Trigger disaster');
    }

    this.updateToolHint('select');
  }

  _syncBackdrop() {
    const backdrop = document.getElementById('ui-backdrop');
    if (!backdrop) return;
    const panelOpen =
      document.getElementById('more-panel')?.classList.contains('open') ||
      document.getElementById('mobile-build-sheet')?.classList.contains('open') ||
      document.getElementById('info-panel')?.classList.contains('open');
    backdrop.classList.toggle('visible', panelOpen);
    document.body.classList.toggle('panel-open', panelOpen);
  }

  closeInspector() {
    const infoElement = document.getElementById('info-panel');
    if (infoElement) {
      infoElement.classList.remove('open');
      infoElement.innerHTML = '';
      infoElement.setAttribute('aria-hidden', 'true');
    }
    document.getElementById('mobile-stats-strip')?.classList.remove('collapsed');
    document.body.classList.remove('inspector-open');
    this._syncBackdrop();
    if (window.game?.selectedObject) {
      window.game.selectedObject.setSelected(false);
      window.game.selectedObject = null;
    }
  }

  closeAllPanels() {
    this.toggleMorePanel(false);
    this.toggleMobileBuildSheet(false);
    this.closeInspector();
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      document.getElementById('pause-button-icon').src = playIconUrl;
      document.getElementById('paused-text').style.visibility = 'visible';
    } else {
      document.getElementById('pause-button-icon').src = pauseIconUrl;
      document.getElementById('paused-text').style.visibility = 'hidden';
    }
  }

  setSimSpeed(speed) {
    if (this.isPaused) this.togglePause();
    this.simSpeed = Number(speed);
    window.game?.setSimSpeed(this.simSpeed);
    this.syncSimSpeedButtons(this.simSpeed);
  }

  syncSimSpeedButtons(speed = this.simSpeed) {
    document.querySelectorAll('[data-sim-speed]').forEach((btn) => {
      btn.classList.toggle('selected', Number(btn.dataset.simSpeed) === Number(speed));
    });
  }

  toggleGodMode() {
    if (!gameConfig.allowGodMode) {
      this.showToast('GOD mode disabled for this class session.');
      return;
    }
    this.godMode = !this.godMode;
    const btn = document.getElementById('button-god');
    const moreBtn = document.getElementById('more-btn-god');
    if (btn) btn.classList.toggle('selected', this.godMode);
    if (moreBtn) moreBtn.classList.toggle('selected', this.godMode);
    this.showToast(this.godMode ? 'GOD mode ON' : 'GOD mode OFF');
  }

  setUser(user) {
    this.currentUser = user;
    const nav = document.getElementById('nav-user');
    const adminLink = document.getElementById('nav-admin');
    if (nav) {
      nav.textContent = user ? user.username : 'Guest';
    }
    if (adminLink) {
      adminLink.style.display = user?.is_admin ? 'inline' : 'none';
    }
  }

  updateTitleBar(game) {
    document.getElementById('city-name').innerHTML = game.city.name;
    document.getElementById('population-counter').innerHTML = game.city.population;
    const budgetEl = document.getElementById('budget-counter');
    if (budgetEl && window.budgetManager) {
      budgetEl.textContent = `$${window.budgetManager.budget}`;
    }
    const date = new Date(SIM_START_DATE);
    date.setDate(date.getDate() + game.city.simTime);
    document.getElementById('sim-time').innerHTML = date.toLocaleDateString();
  }

  updateStatsPanel(city) {
    const stats = city.getSessionStats();
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-residents', stats.residents);
    set('stat-zones', stats.developedZones);
    set('stat-power', `${stats.power.capacity}/${stats.power.demand} kW`);
    set('stat-resilience', `${stats.disasterResilience}%`);
    set('stat-residents-mobile', stats.residents);
    set('stat-zones-mobile', stats.developedZones);
    set('stat-power-mobile', `${stats.power.capacity}/${stats.power.demand}`);
    set('stat-resilience-mobile', `${stats.disasterResilience}%`);
    this.updateDisasterStats();
  }

  updateDisasterStats() {
    const snap = window.disasterManager?.consequences?.getSnapshot() ?? {
      casualties: 0,
      injured: 0,
      disaster_cost: 0,
      disaster_index: 0,
    };
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('stat-casualties', snap.casualties);
    set('stat-injured', snap.injured);
    set('stat-disaster-cost', `$${snap.disaster_cost}`);
    set('stat-disaster-index', snap.disaster_index);
    set('stat-casualties-mobile', snap.casualties);
    set('stat-injured-mobile', snap.injured);
    set('stat-disaster-cost-mobile', snap.disaster_cost);
    this.renderDisasterLog();
  }

  renderDisasterLog() {
    const events = window.disasterManager?.consequences?.getEvents?.() ?? [];
    const html =
      events.length === 0
        ? '<li class="disaster-log-empty">None yet — random events can strike during the session.</li>'
        : [...events]
            .reverse()
            .map((event) => `<li>${formatDisasterEvent(event)}</li>`)
            .join('');
    document.querySelectorAll('.disaster-log-list').forEach((el) => {
      el.innerHTML = html;
    });
  }

  updateTimeRemaining(time) {
    const el = document.getElementById('stat-time');
    const headerTimer = document.getElementById('stat-time-header');
    if (el) el.textContent = time;
    if (headerTimer) headerTimer.textContent = time;
  }

  updateInfoPanel(object) {
    const infoElement = document.getElementById('info-panel');
    const mobileStrip = document.getElementById('mobile-stats-strip');
    if (!infoElement) return;

    if (object) {
      infoElement.classList.add('open');
      infoElement.setAttribute('aria-hidden', 'false');
      document.body.classList.add('inspector-open');
      infoElement.innerHTML = `
        <div class="inspector-header">
          <span class="inspector-title">Tile / Building</span>
          <button type="button" class="inspector-close" onclick="ui.closeInspector()" aria-label="Close details">✕</button>
        </div>
        <div class="inspector-body">${object.toHTML()}</div>
      `;
      if (mobileStrip) mobileStrip.classList.add('collapsed');
      this.toggleMorePanel(false);
      this.toggleMobileBuildSheet(false);
    } else {
      this.closeInspector();
      return;
    }
    this._syncBackdrop();
  }

  showMilestone(milestone) {
    const el = document.getElementById('milestone-badge');
    if (!el) return;
    el.textContent = `✓ ${milestone.label}`;
    el.style.visibility = 'visible';
    setTimeout(() => {
      el.style.visibility = 'hidden';
    }, 5000);
  }

  showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.style.visibility = 'visible';
    setTimeout(() => {
      el.style.visibility = 'hidden';
    }, 3000);
  }

  showTutorial() {
    this.maybeShowTutorialWelcome();
  }

  maybeShowTutorialWelcome() {
    const forceTutorial =
      new URLSearchParams(window.location.search).get('tutorial') === '1';
    if (!forceTutorial && !settingsManager.isTutorialOnStart()) return;
    if (!forceTutorial && settingsManager.hasCompletedTour()) return;
    if (!forceTutorial && settingsManager.wasWelcomeSkippedThisSession()) return;

    const el = document.getElementById('tutorial-welcome');
    if (el) el.style.display = 'flex';
  }

  acceptTutorialWelcome() {
    document.getElementById('tutorial-welcome').style.display = 'none';
    settingsManager.clearWelcomeSkippedThisSession();
    this.replayGuidedTour();
  }

  skipTutorialWelcome() {
    document.getElementById('tutorial-welcome').style.display = 'none';
    settingsManager.markWelcomeSkippedThisSession();
  }

  replayGuidedTour(onComplete) {
    this.closeSettings();
    document.getElementById('tutorial-welcome').style.display = 'none';
    settingsManager.resetTourCompleted();
    settingsManager.clearWelcomeSkippedThisSession();
    initTutorial();
    startGuidedTour(() => {
      settingsManager.markTourCompleted();
      onComplete?.();
    });
  }

  openSettings() {
    const panel = document.getElementById('settings-panel');
    const checkbox = document.getElementById('setting-tutorial-on-start');
    if (checkbox) checkbox.checked = settingsManager.isTutorialOnStart();
    if (panel) panel.style.display = 'flex';
    this.syncTemplateSelects();
  }

  closeSettings() {
    const panel = document.getElementById('settings-panel');
    if (panel) panel.style.display = 'none';
  }

  onTutorialSettingChange(event) {
    settingsManager.setTutorialOnStart(event.target.checked);
    this.showToast(
      event.target.checked ? 'Tutorial on start enabled' : 'Tutorial on start disabled'
    );
  }

  openHelp() {
    document.getElementById('help-panel').style.display = 'block';
  }

  closeHelp() {
    document.getElementById('help-panel').style.display = 'none';
  }

  toggleMorePanel(forceOpen) {
    const panel = document.getElementById('more-panel');
    if (!panel) return;
    const open =
      forceOpen === true || forceOpen === false
        ? forceOpen
        : !panel.classList.contains('open');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      this.toggleMobileBuildSheet(false);
      this.closeInspector();
    }
    document.querySelectorAll('.mobile-tab').forEach((t) => {
      t.classList.toggle('selected', open && t.dataset.tool === 'menu');
    });
    this._syncBackdrop();
  }

  syncTemplateSelects() {
    const main = document.getElementById('template-select');
    const settings = document.getElementById('settings-template-select');
    if (main && settings && main.value) {
      settings.value = main.value;
    }
  }

  onSettingsTemplateChange(event) {
    const main = document.getElementById('template-select');
    if (main) main.value = event.target.value;
    this.onTemplateChange(event);
  }

  hideTutorial() {
    this.skipTutorialWelcome();
  }

  showEndScreen(stats) {
    const overlay = document.getElementById('end-screen');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('end-score').textContent = stats.score;
    document.getElementById('end-residents').textContent = stats.residents;
    document.getElementById('end-zones').textContent = stats.developedZones;
    document.getElementById('end-resilience').textContent = `${stats.disasterResilience}%`;
    document.getElementById('end-casualties').textContent = stats.casualties ?? 0;
    document.getElementById('end-injured').textContent = stats.injured ?? 0;
    document.getElementById('end-disaster-cost').textContent = `$${stats.disaster_cost ?? 0}`;
    document.getElementById('end-disaster-index').textContent = stats.disaster_index ?? 0;
    const logEl = document.getElementById('end-disaster-log');
    if (logEl) {
      const events = window.disasterManager?.consequences?.getEvents?.() ?? [];
      logEl.innerHTML =
        events.length === 0
          ? '<li>No disasters this session.</li>'
          : events.map((event) => `<li>${formatDisasterEvent(event)}</li>`).join('');
    }
    const prompts = gameConfig.reflectionPrompts;
    const promptEl = document.getElementById('reflection-prompts');
    if (promptEl) {
      promptEl.innerHTML = prompts.map((p) => `<li>${p}</li>`).join('');
    }
    window.game?.stop();
  }

  onCameraView(view) {
    window.game?.cameraManager?.setView(view);
    document.querySelectorAll('.view-btn').forEach((btn) => {
      const match =
        btn.getAttribute('data-view') === view ||
        btn.getAttribute('onclick')?.includes(`'${view}'`);
      btn.classList.toggle('active', match);
    });
  }

  onTemplateChange(event) {
    const id = event.target.value;
    if (id && window.game) {
      window.game.loadTemplate(id);
    }
  }

  onExportCity() {
    window.saveLoadManager?.exportFile();
    this.showToast('City file downloaded. Nothing is autosaved.');
  }

  onImportCity() {
    document.getElementById('city-import-file')?.click();
  }

  async onCityFilePicked(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await window.saveLoadManager.importFile(file);
      window.ui.updateTitleBar(window.game);
      window.ui.updateStatsPanel(window.game.city);
      if (result.foreign) {
        this.showToast('Imported for practice only. This run will not update the leaderboard.');
      } else {
        this.showToast('City imported. The class timer did not change.');
      }
    } catch (err) {
      this.showToast(err.message || 'Could not import that file');
    }
  }

  async onIssueRestoreCode() {
    try {
      const code = await window.saveLoadManager.issueRestoreCode();
      try {
        await navigator.clipboard.writeText(code);
      } catch {
        /* clipboard may be blocked */
      }
      this.showToast(`Restore slip ${code}. Only works when you are logged in as that HSU ID.`);
    } catch (err) {
      this.showToast(err.message || 'Log in with your HSU ID to issue a restore slip');
    }
  }

  async onRedeemRestoreCode() {
    const code = document.getElementById('restore-code-input')?.value;
    try {
      await window.saveLoadManager.redeemRestoreCode(code);
      window.ui.updateTitleBar(window.game);
      window.ui.updateStatsPanel(window.game.city);
      this.showToast('City restored from your slip. The class timer did not change.');
    } catch (err) {
      this.showToast(err.message || 'Could not redeem that slip');
    }
  }

  onResetCity() {
    if (confirm('Reset city? This cannot be undone.')) {
      window.saveLoadManager?.reset();
      window.budgetManager.budget = gameConfig.startingBudget;
      window.ui.updateTitleBar(window.game);
      window.ui.updateStatsPanel(window.game.city);
      this.showToast('City reset.');
    }
  }

  onFireDispatch() {
    const cost = 150;
    if (!window.ui?.godMode && window.budgetManager.budget < cost) {
      this.showToast(`Need $${cost} for fire dispatch (or GOD mode).`);
      return;
    }
    if (!window.ui?.godMode) {
      window.budgetManager.budget -= cost;
      window.ui.updateTitleBar(window.game);
    }
    window.disasterManager?.dispatchFirefighters();
  }

  mobileSelectTool(toolId) {
    this.toggleMobileBuildSheet(false);
    if (toolId !== 'menu') this.toggleMorePanel(false);
    this.activeToolId = toolId;
    this.updateToolHint(toolId);

    const idMap = {
      select: 'button-select',
      bulldoze: 'button-bulldoze',
      residential: 'button-residential',
      commercial: 'button-commercial',
      industrial: 'button-industrial',
      road: 'button-road',
      'power-plant-petroleum': 'button-power-petroleum',
      'power-plant-nuclear': 'button-power-nuclear',
      'fire-station': 'button-fire-station',
      'power-line': 'button-power-line',
    };
    const btnId = idMap[toolId];
    const btn = btnId ? document.getElementById(btnId) : null;
    if (btn) {
      if (this.selectedControl) this.selectedControl.classList.remove('selected');
      this.selectedControl = btn;
      btn.classList.add('selected');
    }

    document.querySelectorAll('.mobile-tab').forEach((t) => {
      const match =
        t.dataset.tool === toolId ||
        (toolId === 'road' && t.dataset.tool === 'road') ||
        (toolId === 'select' && t.dataset.tool === 'select');
      t.classList.toggle('selected', match);
    });
  }

  toggleMobileBuildSheet(forceOpen) {
    const sheet = document.getElementById('mobile-build-sheet');
    if (!sheet) return;
    const open =
      forceOpen === true || forceOpen === false
        ? forceOpen
        : !sheet.classList.contains('open');
    sheet.classList.toggle('open', open);
    sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      this.toggleMorePanel(false);
      this.closeInspector();
    }
    this._syncBackdrop();
  }

  onDisaster() {
    const type =
      document.getElementById('disaster-type-select')?.value ||
      document.getElementById('disaster-type-select-mobile')?.value;
    const level =
      document.getElementById('disaster-level-select')?.value ||
      document.getElementById('disaster-level-select-mobile')?.value ||
      'moderate';
    window.game?.triggerDisaster(type, level);
  }

  populateDisasterOptions() {
    const typeOptions = DISASTER_TYPE_IDS.map(
      (id) =>
        `<option value="${id}">${DISASTER_TYPES[id].emoji} ${DISASTER_TYPES[id].label}</option>`
    ).join('');
    const levelOptions = DISASTER_LEVEL_IDS.map(
      (id) => `<option value="${id}">${DISASTER_LEVELS[id].label}</option>`
    ).join('');

    ['disaster-type-select', 'disaster-type-select-mobile'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = typeOptions;
    });
    ['disaster-level-select', 'disaster-level-select-mobile'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.innerHTML = levelOptions;
        el.value = 'moderate';
      }
    });
  }

  async fetchAiTip() {
    if (!gameConfig.aiEnabled) {
      this.showToast('AI tips disabled for this session.');
      return;
    }
    const city = window.game?.city;
    if (!city) return;
    const stats = city.getSessionStats();
    const tipEl = document.getElementById('ai-tip-text');
    if (tipEl) tipEl.textContent = 'Thinking...';
    try {
      const data = await authClient.aiTip({
        residents: stats.residents,
        developed_zones: stats.developedZones,
        disaster_resilience: stats.disasterResilience,
        power_capacity: stats.power.capacity,
        power_demand: stats.power.demand,
      });
      if (tipEl) tipEl.textContent = data.tip || fallbackTip({
        residents: stats.residents,
        developed_zones: stats.developedZones,
        disaster_resilience: stats.disasterResilience,
        power_capacity: stats.power.capacity,
        power_demand: stats.power.demand,
      });
      this.showToast(`AI tip (${data.remaining ?? '?'} left today)`);
    } catch (err) {
      const tip = fallbackTip({
        residents: stats.residents,
        developed_zones: stats.developedZones,
        disaster_resilience: stats.disasterResilience,
        power_capacity: stats.power.capacity,
        power_demand: stats.power.demand,
      });
      if (tipEl) tipEl.textContent = tip;
      this.showToast(err.message || 'Using a local planning tip');
    }
  }

  async fetchAiReflection() {
    if (!gameConfig.aiEnabled) return;
    const stats = window.sessionManager?.lastStats;
    if (!stats) return;
    const btn = document.getElementById('btn-ai-reflection');
    if (btn) btn.disabled = true;
    try {
      const data = await authClient.aiSessionReview({
        score: stats.score,
        residents: stats.residents,
        developed_zones: stats.developedZones,
        disaster_resilience: stats.disasterResilience,
        disasters_survived: stats.disastersSurvived,
      });
      const promptEl = document.getElementById('reflection-prompts');
      if (promptEl && data.questions?.length) {
        promptEl.innerHTML = data.questions.map((q) => `<li>${q}</li>`).join('');
      }
      const reportEl = document.getElementById('ai-mayor-report');
      if (reportEl && data.report) {
        reportEl.textContent = data.report;
      }
      this.showToast(`AI review (${data.remaining ?? '?'} left today)`);
    } catch (err) {
      this.showToast(err.message);
      if (btn) btn.disabled = false;
    }
  }

  populateTemplates() {
    const options = Object.entries(CITY_TEMPLATES)
      .map(([id, t]) => `<option value="${id}">${t.name}</option>`)
      .join('');
    const select = document.getElementById('template-select');
    const settingsSelect = document.getElementById('settings-template-select');
    if (select) select.innerHTML = options;
    if (settingsSelect) settingsSelect.innerHTML = options;
  }
}

window.ui = new GameUI();
window.ui.populateTemplates();
window.ui.populateDisasterOptions();
window.ui.initTooltips();
initTutorial();
window.ui.maybeShowTutorialWelcome();
