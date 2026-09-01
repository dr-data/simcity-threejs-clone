import gameConfig from '../gameConfig.js';
import { authClient } from '../auth/authClient.js';
import { computeDrillScore, scoreDrill } from './drillScore.js';

/**
 * Manages timed classroom sessions: scoring, milestones, and end screen.
 */
export class SessionManager {
  startTime = null;
  endTime = null;
  isActive = false;
  isEnded = false;
  disastersSurvived = 0;
  achievedMilestones = new Set();
  lastStats = null;
  _liveInterval = null;
  _liveTimeout = null;
  startingBuildings = 0;

  constructor(onTick, onMilestone, onEnd) {
    this.onTick = onTick;
    this.onMilestone = onMilestone;
    this.onEnd = onEnd;
    this.durationMs = gameConfig.sessionLengthMinutes * 60 * 1000;
  }

  start() {
    this.startTime = Date.now();
    this.endTime = this.startTime + this.durationMs;
    this.isActive = true;
    this.isEnded = false;
    this.disastersSurvived = 0;
    this.achievedMilestones.clear();
    this.lastStats = null;
    this.startingBuildings = window.game?.city?.countBuildings?.() ?? 0;
    this._interval = setInterval(() => this.tick(), 1000);
    clearTimeout(this._liveTimeout);
    clearInterval(this._liveInterval);
    this._liveTimeout = setTimeout(() => this.pushLiveScore(), 8000);
    this._liveInterval = setInterval(() => this.pushLiveScore(), 45000);
  }

  stop() {
    this.isActive = false;
    clearInterval(this._interval);
    clearTimeout(this._liveTimeout);
    clearInterval(this._liveInterval);
  }

  collectLiveStats() {
    const city = window.game?.city;
    if (!city) return null;
    const stats = city.getSessionStats();
    const consequences = window.disasterManager?.consequences?.getSnapshot() ?? {};
    const currentBuildings = stats.buildings ?? city.countBuildings();
    const startingBuildings = this.startingBuildings || currentBuildings;
    const input = this.scoringInput(stats, consequences);
    const breakdown = scoreDrill(input);
    const sessionStats = {
      residents: stats.residents,
      developedZones: stats.developedZones,
      disasterResilience: stats.disasterResilience ?? 100,
      disastersSurvived: this.disastersSurvived,
      casualties: input.casualties,
      injured: input.injured,
      disaster_cost: input.disasterCost,
      startingBuildings,
      buildingsRemaining: currentBuildings,
      buildingsDestroyed: input.buildingsDestroyed,
      disasterCount: input.disasterCount,
    };
    sessionStats.score = breakdown.score;
    sessionStats.scoreBreakdown = breakdown;
    return sessionStats;
  }

  async pushLiveScore() {
    if (!this.isActive || this.isEnded) return;
    if (window.saveLoadManager?.scoreEligible === false) return;
    if (!window.ui?.currentUser) return;
    const stats = this.collectLiveStats();
    if (!stats) return;
    try {
      await authClient.liveScore({
        score: stats.score,
        residents: stats.residents,
        developed_zones: stats.developedZones,
        disaster_resilience: stats.disasterResilience,
      });
    } catch {
      /* guest, offline, or API down */
    }
  }

  getTimeRemainingMs() {
    if (!this.endTime) return this.durationMs;
    return Math.max(0, this.endTime - Date.now());
  }

  getTimeRemainingFormatted() {
    const ms = this.getTimeRemainingMs();
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  tick() {
    if (!this.isActive) return;
    if (this.getTimeRemainingMs() <= 0) {
      this.endSession(window.game?.city?.getSessionStats() ?? {});
      return;
    }
    if (this.onTick) this.onTick(this.getTimeRemainingFormatted());
  }

  scoringInput(stats, consequences) {
    const city = window.game?.city;
    const currentBuildings = stats?.buildings ?? city?.countBuildings?.() ?? 0;
    const startingBuildings = this.startingBuildings || currentBuildings;
    const events = consequences.disaster_log || [];
    const elapsed = this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
    return {
      buildingsDestroyed: Math.max(0, startingBuildings - currentBuildings),
      buildingsRemaining: currentBuildings,
      startingBuildings,
      casualties: consequences.casualties ?? stats?.casualties ?? 0,
      injured: consequences.injured ?? stats?.injured ?? 0,
      disasterIndex: consequences.disaster_index ?? 0,
      disasterCost: consequences.disaster_cost ?? 0,
      zonesDamaged: consequences.zones_damaged ?? 0,
      roadsDestroyed: consequences.roads_destroyed ?? 0,
      durationSeconds: stats?.durationSeconds ?? elapsed,
      durationAllowedSeconds: Math.round(this.durationMs / 1000),
      disasterCount: consequences.disasters_triggered ?? events.length,
      disasterTypes: events.map((e) => e.type),
    };
  }

  computeScore(stats) {
    const consequences = window.disasterManager?.consequences?.getSnapshot() ?? {};
    return computeDrillScore(this.scoringInput(stats, consequences));
  }

  checkMilestones(stats) {
    const current = window.game?.city?.countBuildings?.() ?? 0;
    const snapshot = {
      residents: stats.residents,
      developedZones: stats.developedZones,
      disasterResilience: stats.disasterResilience,
      disastersSurvived: this.disastersSurvived,
      startingBuildings: this.startingBuildings,
      buildingsDestroyed: Math.max(0, this.startingBuildings - current),
      disasterCount: window.disasterManager?.disasterCount ?? 0,
    };
    for (const m of gameConfig.milestones) {
      if (!this.achievedMilestones.has(m.id) && m.check(snapshot)) {
        this.achievedMilestones.add(m.id);
        if (this.onMilestone) this.onMilestone(m);
      }
    }
  }

  recordDisasterSurvived(damagePercent) {
    if (damagePercent < 20) {
      this.disastersSurvived++;
    }
  }

  async endSession(stats) {
    if (this.isEnded) return;
    this.isEnded = true;
    this.isActive = false;
    this.stop();

    const disasterResilience = stats.disasterResilience ?? 100;
    const consequences = window.disasterManager?.consequences?.getSnapshot() ?? {};
    const input = this.scoringInput(
      { ...stats, durationSeconds: Math.round((Date.now() - this.startTime) / 1000) },
      consequences
    );
    const breakdown = scoreDrill(input);
    const sessionStats = {
      residents: stats.residents,
      developedZones: stats.developedZones,
      disasterResilience,
      disastersSurvived: this.disastersSurvived,
      durationSeconds: input.durationSeconds,
      casualties: input.casualties,
      injured: input.injured,
      disaster_cost: input.disasterCost,
      zones_damaged: input.zonesDamaged,
      disaster_index: input.disasterIndex,
      disaster_log: consequences.disaster_log ?? [],
      startingBuildings: input.startingBuildings,
      buildingsRemaining: input.buildingsRemaining,
      buildingsDestroyed: input.buildingsDestroyed,
      disasterCount: input.disasterCount,
      score: breakdown.score,
      scoreBreakdown: breakdown,
    };
    this.lastStats = sessionStats;

    if (window.saveLoadManager?.scoreEligible !== false) {
      try {
        await authClient.submitScore({
          score: sessionStats.score,
          residents: sessionStats.residents,
          developed_zones: sessionStats.developedZones,
          disaster_resilience: sessionStats.disasterResilience,
          disasters_survived: sessionStats.disastersSurvived,
          duration_seconds: sessionStats.durationSeconds,
          casualties: sessionStats.casualties,
          injured: sessionStats.injured,
          disaster_cost: sessionStats.disaster_cost,
          zones_damaged: sessionStats.zones_damaged,
          disaster_log: sessionStats.disaster_log,
        });
      } catch {
        /* offline or not logged in — stats still shown locally */
      }
    }

    if (this.onEnd) this.onEnd(sessionStats);
  }
}
