import { DISASTER_LEVELS, DISASTER_LEVEL_IDS, DISASTER_TYPES, DISASTER_TYPE_IDS } from '../disaster/disasterConfig.js';
import { formatClock } from './clock.js';
import { copyText, downloadText, escapeHtml, openPrintDocument } from './labFiles.js';
import {
  describeClock,
  goToPhase,
  issueDisaster,
  nextPhase,
  pauseClass,
  resetClass,
  resumeClass,
  startClass,
} from './labState.js';
import { labStore } from './labStore.js';
import { labSync, preferLabState } from './labSync.js';
import { getPhase, LAB_PHASES } from './phases.js';
import { recoveryText, startRecovery, stepRecovery } from './recovery.js';
import { emptyReflection, fullHandout, REFLECTION_PROMPTS, reflectionSummary } from './reflection.js';
import { cascadeSentence, measureCity } from './resilience.js';
import { compareDesigns, createResultRow, resultsSummary, resultsToCsv, upsertRow } from './resultsTable.js';

const RECORD_BUTTONS = [
  ['design-a', 'Design A', 'Record Design A'],
  ['impact', 'After the disaster', 'Record impact'],
  ['design-b', 'Design B', 'Record Design B'],
];

export class LabController {
  constructor() {
    this.state = labSync.readLocal();
    this.rows = [];
    this.reflection = null;
    this.recovery = null;
    this.metrics = null;
    this.cost = 0;
    this.serverOk = false;
    this.shared = false;
    this._rowSig = '';
    this._reflectionReady = false;
  }

  start() {
    const host = document.getElementById('lab-lecturer');
    if (host) host.innerHTML = lecturerMarkup();
    this.rows = labStore.loadResults();
    this.recovery = labStore.loadRecovery();
    this.reflection = labStore.loadReflection();
    this.bind();
    this.fillDisasterSelects();
    labSync.channel?.addEventListener('message', (event) => {
      this.applyState(preferLabState(this.state, event.data));
    });
    window.addEventListener('storage', (event) => {
      if (event.key !== 'classroom-lab-shared-v1' || this.serverOk || !event.newValue) return;
      try {
        this.applyState(preferLabState(this.state, JSON.parse(event.newValue)));
      } catch {
        /* ignore broken local state */
      }
    });
    this.poll();
    this._poll = setInterval(() => this.poll(), 2500);
    this._tick = setInterval(() => this.renderClock(), 1000);
    this.renderAll();
  }

  isClassActive() {
    return this.state?.status === 'running' || this.state?.status === 'paused';
  }

  async poll() {
    try {
      const incoming = await labSync.fetchState();
      this.serverOk = true;
      this.shared = true;
      this.applyState(preferLabState(this.state, incoming));
    } catch {
      this.serverOk = false;
      this.shared = false;
      this.applyState(preferLabState(this.state, labSync.readLocal()));
    }
  }

  applyState(next) {
    if (!next) return;
    const previousId = this.state?.disaster?.id || '';
    this.state = next;
    document.body.classList.toggle('lab-active', this.isClassActive());
    if (this.isClassActive()) this.holdDrill();
    const disasterId = this.state.disaster?.id || '';
    if (disasterId && disasterId !== previousId) this.maybeApplyDisaster();
    this.renderAll();
  }

  holdDrill() {
    const session = window.sessionManager;
    if (!session) return;
    session.durationMs = 90 * 60 * 1000;
    if (session.isActive) session.endTime = Date.now() + session.durationMs;
  }

  onCityReady() {
    document.body.classList.add('lab-metrics-on');
    const bar = document.getElementById('lab-metrics-bar');
    if (bar) bar.hidden = false;
    this.maybeApplyDisaster();
    if (window.game?.city) {
      window.game.city.services?.forEach((service) => service.simulate(window.game.city));
      this.onCityTick(window.game.city);
    }
  }

  onCityTick(city) {
    this.metrics = measureCity(city);
    this.cost = window.disasterManager?.consequences?.getSnapshot()?.disaster_cost ?? 0;
    if (this.recovery && this.recovery.disasterId === (this.state.disaster?.id || this.recovery.disasterId)) {
      this.recovery = stepRecovery(this.recovery, this.metrics, Date.now());
      labStore.saveRecovery(this.recovery);
    }
    this.renderMetrics();
  }

  maybeApplyDisaster() {
    const disaster = this.state?.disaster;
    if (!disaster?.id) return;
    if (labStore.loadAppliedId() === disaster.id) return;
    if (window.game?.awaitingSetup || !window.game?.city) return;
    const before = measureCity(window.game.city);
    this.recovery = startRecovery(before, Date.now(), disaster.id);
    labStore.saveRecovery(this.recovery);
    labStore.saveAppliedId(disaster.id);
    window.disasterManager?.triggerDisaster(disaster.type, disaster.level || 'major', 'lecturer');
    window.ui?.showToast?.('The lecturer has sent a disaster. Watch what fails next.');
    this.onCityTick(window.game.city);
  }

  bind() {
    const open = () => this.openSheet(true);
    document.getElementById('lab-timer-btn')?.addEventListener('click', open);
    document.getElementById('lab-open-bar')?.addEventListener('click', open);
    document.getElementById('lab-open-menu')?.addEventListener('click', () => {
      window.ui?.toggleMorePanel?.(false);
      open();
    });
    document.getElementById('lab-close')?.addEventListener('click', () => this.openSheet(false));
    document.getElementById('lab-sheet')?.addEventListener('click', (event) => {
      if (event.target.id === 'lab-sheet') this.openSheet(false);
    });
    document.getElementById('lab-record-a')?.addEventListener('click', () => this.record('design-a', 'Design A'));
    document.getElementById('lab-record-impact')?.addEventListener('click', () => this.record('impact', 'After the disaster'));
    document.getElementById('lab-record-b')?.addEventListener('click', () => this.record('design-b', 'Design B'));
    document.getElementById('lab-csv')?.addEventListener('click', () => this.exportCsv());
    document.getElementById('lab-copy')?.addEventListener('click', () => this.copySummary());
    document.getElementById('lab-print')?.addEventListener('click', () => this.printSummary());
    document.getElementById('lab-open-report')?.addEventListener('click', () => this.openReport(true));
    document.getElementById('lab-report-menu')?.addEventListener('click', () => {
      window.ui?.toggleMorePanel?.(false);
      this.openReport(true);
    });
    document.getElementById('lab-report-close')?.addEventListener('click', () => this.openReport(false));
    document.getElementById('lab-report')?.addEventListener('click', (event) => {
      if (event.target.id === 'lab-report') this.openReport(false);
    });
    document.getElementById('lab-report-copy')?.addEventListener('click', () => this.copyReflection());
    document.getElementById('lab-report-print')?.addEventListener('click', () => this.printReflection());
    document.getElementById('lab-report-download')?.addEventListener('click', () => this.downloadReflection());
    document.getElementById('lab-results-table')?.addEventListener('input', (event) => {
      const input = event.target.closest('[data-note-id]');
      if (!input) return;
      const row = this.rows.find((item) => item.id === input.dataset.noteId);
      if (!row) return;
      row.note = input.value;
      labStore.saveResults(this.rows);
      this._rowSig = JSON.stringify(this.rows);
      this.renderCompare();
    });
    document.getElementById('lab-results-table')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-delete-id]');
      if (!button) return;
      this.rows = this.rows.filter((row) => row.id !== button.dataset.deleteId);
      labStore.saveResults(this.rows);
      this._rowSig = '';
      this.renderTable();
    });

    document.getElementById('lab-lecturer')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-lab-action]');
      if (!button) return;
      const action = button.dataset.labAction;
      const now = Date.now();
      let next = this.state;
      if (action === 'start') next = startClass(this.state, now);
      if (action === 'pause') next = pauseClass(this.state, now);
      if (action === 'resume') next = resumeClass(this.state, now);
      if (action === 'next') next = nextPhase(this.state, now);
      if (action === 'reset') {
        if (!window.confirm('Reset the class timer for every student?')) return;
        next = resetClass(now);
      }
      if (action === 'phase') next = goToPhase(this.state, button.dataset.phase, now);
      if (action === 'disaster') {
        const type = document.getElementById('lab-disaster-type')?.value || 'typhoon';
        const level = document.getElementById('lab-disaster-level')?.value || 'major';
        next = issueDisaster(this.state, { type, level, now, id: `${now}-${type}` });
      }
      if (next !== this.state) this.publish(next);
    });
  }

  fillDisasterSelects() {
    const typeOptions = DISASTER_TYPE_IDS.map(
      (id) => `<option value="${id}">${DISASTER_TYPES[id].emoji} ${DISASTER_TYPES[id].label}</option>`
    ).join('');
    const levelOptions = DISASTER_LEVEL_IDS.map(
      (id) => `<option value="${id}">${DISASTER_LEVELS[id].label}</option>`
    ).join('');
    const type = document.getElementById('lab-disaster-type');
    const level = document.getElementById('lab-disaster-level');
    if (type) {
      type.innerHTML = typeOptions;
      type.value = 'typhoon';
    }
    if (level) {
      level.innerHTML = levelOptions;
      level.value = 'major';
    }
  }

  async publish(next) {
    this.applyState(next);
    const result = await labSync.publish(next);
    this.shared = result.shared;
    this.renderLecturer();
    const where = result.shared ? 'Sent to the class.' : 'Saved on this browser only. The class link is not reachable.';
    window.ui?.showToast?.(where);
  }

  openSheet(open) {
    const sheet = document.getElementById('lab-sheet');
    if (!sheet) return;
    sheet.style.display = open ? 'flex' : 'none';
    if (open) this.renderTable();
  }

  openReport(open) {
    const panel = document.getElementById('lab-report');
    if (!panel) return;
    if (open) this.ensureReflection();
    panel.style.display = open ? 'flex' : 'none';
  }

  ensureReflection() {
    const mayor = window.ui?.mayorName || '';
    const city = window.game?.city?.name || '';
    if (!this.reflection) this.reflection = emptyReflection({ name: mayor, city });
    if (!this.reflection.name && mayor) this.reflection.name = mayor;
    if (!this.reflection.city && city) this.reflection.city = city;
    const host = document.getElementById('lab-report-fields');
    if (!host || this._reflectionReady) {
      this.fillReflection();
      return;
    }
    host.innerHTML = `
      <label>Your name <input id="lab-reflect-name" type="text" maxlength="60" autocomplete="name"></label>
      <label>City <input id="lab-reflect-city" type="text" maxlength="60"></label>
      ${REFLECTION_PROMPTS.map(
        (prompt) => `
        <label class="lab-prompt">
          <span class="lab-theme">${escapeHtml(prompt.theme)}</span>
          ${escapeHtml(prompt.text)}
          <textarea id="lab-answer-${prompt.id}" rows="4"></textarea>
        </label>`
      ).join('')}
    `;
    host.addEventListener('input', () => this.saveReflectionFromForm());
    this._reflectionReady = true;
    this.fillReflection();
  }

  fillReflection() {
    const name = document.getElementById('lab-reflect-name');
    const city = document.getElementById('lab-reflect-city');
    if (!this.reflection || !name) return;
    if (document.activeElement !== name) name.value = this.reflection.name || '';
    if (city && document.activeElement !== city) city.value = this.reflection.city || '';
    for (const prompt of REFLECTION_PROMPTS) {
      const field = document.getElementById(`lab-answer-${prompt.id}`);
      if (field && document.activeElement !== field) field.value = this.reflection.answers?.[prompt.id] || '';
    }
  }

  saveReflectionFromForm() {
    const answers = {};
    for (const prompt of REFLECTION_PROMPTS) {
      answers[prompt.id] = document.getElementById(`lab-answer-${prompt.id}`)?.value || '';
    }
    this.reflection = {
      name: document.getElementById('lab-reflect-name')?.value || '',
      city: document.getElementById('lab-reflect-city')?.value || '',
      answers,
    };
    labStore.saveReflection(this.reflection);
  }

  record(kind, label) {
    if (!this.metrics && window.game?.city) this.onCityTick(window.game.city);
    if (!this.metrics) {
      window.ui?.showToast?.('Start a city first, then record a row.');
      return;
    }
    const row = createResultRow({
      kind,
      label,
      phase: getPhase(this.state.phase).label,
      metrics: this.metrics,
      recovery: recoveryText(this.recovery, Date.now()),
      cost: this.cost,
      now: Date.now(),
    });
    this.rows = upsertRow(this.rows, row);
    labStore.saveResults(this.rows);
    this._rowSig = '';
    this.renderTable();
    window.ui?.showToast?.(`${label} saved on this device.`);
  }

  handoutText() {
    this.saveReflectionFromForm();
    const reflection = this.reflection || emptyReflection();
    return fullHandout(resultsSummary(this.rows, reflection), reflection);
  }

  exportCsv() {
    downloadText('lab-results.csv', resultsToCsv(this.rows), 'text/csv');
    window.ui?.showToast?.('CSV downloaded.');
  }

  async copySummary() {
    const ok = await copyText(resultsSummary(this.rows, this.reflection));
    window.ui?.showToast?.(ok ? 'Summary copied.' : 'Allow clipboard access, or use Print.');
  }

  printSummary() {
    const ok = openPrintDocument('Lab results', resultsSummary(this.rows, this.reflection));
    if (!ok) this.copySummary();
  }

  async copyReflection() {
    this.saveReflectionFromForm();
    const ok = await copyText(this.handoutText());
    window.ui?.showToast?.(ok ? 'Report copied.' : 'Allow clipboard access, or use Download.');
  }

  printReflection() {
    this.saveReflectionFromForm();
    const ok = openPrintDocument('Report and reflection', this.handoutText());
    if (!ok) this.copyReflection();
  }

  downloadReflection() {
    this.saveReflectionFromForm();
    downloadText('lab-reflection.txt', reflectionSummary(this.reflection));
    window.ui?.showToast?.('Reflection downloaded.');
  }

  renderAll() {
    this.renderClock();
    this.renderGuide();
    this.renderMetrics();
    this.renderTable();
    this.renderLecturer();
  }

  renderClock() {
    const view = describeClock(this.state, Date.now());
    const label = document.getElementById('lab-timer-label');
    const value = document.getElementById('lab-timer-value');
    if (label) label.textContent = view.status === 'idle' ? 'Lab' : view.phase.short;
    if (value) value.textContent = view.status === 'idle' ? 'Waiting' : view.status === 'paused' ? 'Paused' : formatClock(view.remainingMs);
    const button = document.getElementById('lab-timer-btn');
    if (button) {
      button.classList.toggle('overtime', view.overtime);
      button.title = `${view.phase.label}. ${view.classText}. ${view.phase.range}.`;
    }
    const phase = document.getElementById('lab-sheet-phase');
    if (phase) {
      phase.textContent =
        view.status === 'idle'
          ? 'Waiting for the lecturer to start the class.'
          : `${view.phase.label} · ${view.status === 'paused' ? 'Paused' : formatClock(view.remainingMs)} left · ${view.classText}`;
    }
  }

  renderGuide() {
    const phase = getPhase(this.state.phase);
    const guide = document.getElementById('lab-sheet-guide');
    if (guide) guide.textContent = this.isClassActive() ? phase.student : 'You can still measure the city and record Design A. The class timer starts when the lecturer presses Start class.';
  }

  renderMetrics() {
    const metrics = this.metrics;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    if (!metrics) {
      set('lab-cascade', '');
      return;
    }
    const recovery = recoveryText(this.recovery, Date.now());
    set('lab-m-power', `No power ${metrics.withoutPower}`);
    set('lab-m-water', `No water ${metrics.withoutWater}`);
    set('lab-m-comms', `No comms ${metrics.withoutComms}`);
    set('lab-m-services', `Services ${metrics.servicesLost}`);
    set('lab-m-recovery', `Recovery ${recovery}`);
    set('lab-m-cost', `Cost $${this.cost}`);
    set('lab-m-who', metrics.mostAffected);
    const cascade = document.getElementById('lab-cascade');
    if (cascade) cascade.textContent = cascadeSentence(metrics);
    const detail = document.getElementById('lab-metrics-detail');
    if (detail) {
      const cells = [
        ['People', metrics.people],
        ['Without power', metrics.withoutPower],
        ['Without water', metrics.withoutWater],
        ['Without communications', metrics.withoutComms],
        ['Services lost', metrics.servicesLost],
        ['Recovery', recovery],
        ['Cost', `$${this.cost}`],
        ['Most affected', metrics.mostAffected],
      ];
      detail.innerHTML = cells
        .map(
          ([label, value]) =>
            `<div class="lab-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
        )
        .join('');
    }
    const services = document.getElementById('lab-services-detail');
    if (services) services.textContent = metrics.servicesDetail;
  }

  renderCompare() {
    const line = document.getElementById('lab-compare');
    if (line) line.textContent = compareDesigns(this.rows);
  }

  renderTable() {
    this.renderCompare();
    const body = document.querySelector('#lab-results-table tbody');
    if (!body) return;
    const signature = JSON.stringify(this.rows);
    if (signature === this._rowSig) return;
    this._rowSig = signature;
    if (!this.rows.length) {
      body.innerHTML = '<tr><td colspan="10">No rows yet. Record Design A before the disaster.</td></tr>';
      return;
    }
    body.innerHTML = this.rows
      .map(
        (row) => `
        <tr>
          <td>${escapeHtml(row.label)}</td>
          <td>${row.withoutPower}</td>
          <td>${row.withoutWater}</td>
          <td>${row.withoutComms}</td>
          <td>${row.servicesLost}</td>
          <td>${escapeHtml(row.recovery)}</td>
          <td>$${row.cost}</td>
          <td>${escapeHtml(row.mostAffected)}</td>
          <td><input data-note-id="${escapeHtml(row.id)}" value="${escapeHtml(row.note || '')}" aria-label="Notes for ${escapeHtml(row.label)}"></td>
          <td><button type="button" class="action-btn small secondary" data-delete-id="${escapeHtml(row.id)}">Remove</button></td>
        </tr>`
      )
      .join('');
  }

  renderLecturer() {
    const host = document.getElementById('lab-lecturer');
    if (!host) return;
    const admin = Boolean(window.ui?.currentUser?.is_admin);
    host.hidden = !admin;
    if (!admin) return;
    const view = describeClock(this.state, Date.now());
    const link = this.shared ? 'Students on other devices are following this class.' : 'Class link not reachable. This browser only.';
    host.querySelector('[data-lab-status]')?.replaceChildren(document.createTextNode(`${view.phase.label}. ${view.classText}. ${link}`));
  }
}

export function lecturerMarkup() {
  return `
    <h3>Lecturer controls</h3>
    <p data-lab-status class="settings-hint"></p>
    <div class="lab-actions">
      <button type="button" class="action-btn small" data-lab-action="start">Start class</button>
      <button type="button" class="action-btn small" data-lab-action="pause">Pause</button>
      <button type="button" class="action-btn small" data-lab-action="resume">Resume</button>
      <button type="button" class="action-btn small" data-lab-action="next">Next phase</button>
      <button type="button" class="action-btn small secondary" data-lab-action="reset">Reset</button>
    </div>
    <div class="lab-actions">
      ${LAB_PHASES.map(
        (phase) =>
          `<button type="button" class="action-btn small secondary" data-lab-action="phase" data-phase="${phase.id}">${escapeHtml(phase.short)}</button>`
      ).join('')}
    </div>
    <div class="lab-actions">
      <label>Disaster <select id="lab-disaster-type" aria-label="Disaster type"></select></label>
      <label>Level <select id="lab-disaster-level" aria-label="Disaster level"></select></label>
      <button type="button" class="action-btn small" data-lab-action="disaster">Send to class</button>
    </div>
    <p class="settings-hint"><a href="/teacher-notes.html">Teacher notes, run sheet, and model answers</a></p>
  `;
}

export { RECORD_BUTTONS };
