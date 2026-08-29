import { Game } from './game.js';
import { SimObject } from './sim/simObject';
import playIconUrl from '/icons/play-color.png';
import pauseIconUrl from '/icons/pause-color.png';
import gameConfig from './gameConfig.js';
import { CITY_TEMPLATES } from './templates/cityTemplates.js';
import { authClient } from './auth/authClient.js';

export class GameUI {
  activeToolId = 'select';
  selectedControl = document.getElementById('button-select');
  isPaused = false;
  godMode = false;
  currentUser = null;

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
    this.activeToolId = this.selectedControl.getAttribute('data-type');
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

  toggleGodMode() {
    if (!gameConfig.allowGodMode) {
      this.showToast('GOD mode disabled for this class session.');
      return;
    }
    this.godMode = !this.godMode;
    const btn = document.getElementById('button-god');
    if (btn) btn.classList.toggle('selected', this.godMode);
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
    const date = new Date('1/1/2023');
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
  }

  updateTimeRemaining(time) {
    const el = document.getElementById('stat-time');
    if (el) el.textContent = time;
  }

  updateInfoPanel(object) {
    const infoElement = document.getElementById('info-panel');
    if (object) {
      infoElement.style.visibility = 'visible';
      infoElement.innerHTML = object.toHTML();
    } else {
      infoElement.style.visibility = 'hidden';
      infoElement.innerHTML = '';
    }
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
    const el = document.getElementById('tutorial-overlay');
    if (el) el.style.display = 'flex';
  }

  hideTutorial() {
    const el = document.getElementById('tutorial-overlay');
    if (el) el.style.display = 'none';
  }

  showEndScreen(stats) {
    const overlay = document.getElementById('end-screen');
    if (!overlay) return;
    overlay.style.display = 'flex';
    document.getElementById('end-score').textContent = stats.score;
    document.getElementById('end-residents').textContent = stats.residents;
    document.getElementById('end-zones').textContent = stats.developedZones;
    document.getElementById('end-resilience').textContent = `${stats.disasterResilience}%`;
    const prompts = gameConfig.reflectionPrompts;
    const promptEl = document.getElementById('reflection-prompts');
    if (promptEl) {
      promptEl.innerHTML = prompts.map((p) => `<li>${p}</li>`).join('');
    }
    window.game?.stop();
  }

  onCameraView(view) {
    window.game?.cameraManager?.setView(view);
  }

  onTemplateChange(event) {
    const id = event.target.value;
    if (id && window.game) {
      window.game.loadTemplate(id);
    }
  }

  onSaveCity() {
    window.saveLoadManager?.save();
    this.showToast('City saved locally!');
  }

  onLoadCity() {
    if (window.saveLoadManager?.load()) {
      this.showToast('City loaded!');
      window.ui.updateTitleBar(window.game);
      window.ui.updateStatsPanel(window.game.city);
    } else {
      this.showToast('No saved city found.');
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

  onDisaster() {
    window.game?.triggerDisaster();
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
      if (tipEl) tipEl.textContent = data.tip || 'No tip available.';
      this.showToast(`AI tip (${data.remaining ?? '?'} left today)`);
    } catch (err) {
      if (tipEl) tipEl.textContent = 'Could not load tip. Try again later.';
      this.showToast(err.message);
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
    const select = document.getElementById('template-select');
    if (!select) return;
    select.innerHTML = Object.entries(CITY_TEMPLATES)
      .map(([id, t]) => `<option value="${id}">${t.name}</option>`)
      .join('');
  }
}

window.ui = new GameUI();
window.ui.populateTemplates();
