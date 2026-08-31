import gameConfig from '../gameConfig.js';
import { authClient } from '../auth/authClient.js';

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
    this._interval = setInterval(() => this.tick(), 1000);
  }

  stop() {
    this.isActive = false;
    clearInterval(this._interval);
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
      this.endSession();
      return;
    }
    if (this.onTick) this.onTick(this.getTimeRemainingFormatted());
  }

  computeScore(stats) {
    const residentPts = stats.residents * 2;
    const zonePts = stats.developedZones * 15;
    const resiliencePts = Math.round(stats.disasterResilience * 3);
    const disasterBonus = this.disastersSurvived * 50;
    const casualtyPenalty = (stats.casualties ?? 0) * 12 + (stats.injured ?? 0) * 4;
    const costPenalty = Math.floor((stats.disaster_cost ?? 0) / 20);
    return Math.max(
      0,
      residentPts + zonePts + resiliencePts + disasterBonus - casualtyPenalty - costPenalty
    );
  }

  checkMilestones(stats) {
    const snapshot = {
      residents: stats.residents,
      developedZones: stats.developedZones,
      disasterResilience: stats.disasterResilience,
      disastersSurvived: this.disastersSurvived,
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
    const sessionStats = {
      residents: stats.residents,
      developedZones: stats.developedZones,
      disasterResilience,
      disastersSurvived: this.disastersSurvived,
      durationSeconds: Math.round((Date.now() - this.startTime) / 1000),
      casualties: consequences.casualties ?? 0,
      injured: consequences.injured ?? 0,
      disaster_cost: consequences.disaster_cost ?? 0,
      zones_damaged: consequences.zones_damaged ?? 0,
      disaster_index: consequences.disaster_index ?? 0,
      disaster_log: consequences.disaster_log ?? [],
    };
    sessionStats.score = this.computeScore({
      ...sessionStats,
      disasterResilience,
    });
    this.lastStats = sessionStats;

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

    if (this.onEnd) this.onEnd(sessionStats);
  }
}
