// ============================================================
// stage/budget.js — Stage 미리보기 활성 개체 예산 측정
// 편집기와 결정론 시뮬레이션이 같은 기준·최고치 계산을 공유한다.
// ============================================================
(function initStageBudget(root) {
  'use strict';

  const DEFAULT_LIMITS = Object.freeze({
    enemies: Object.freeze({ warning: 24, critical: 32 }),
    projectiles: Object.freeze({ warning: 240, critical: 360 }),
  });
  const SEVERITY_RANK = Object.freeze({ ok: 0, warning: 1, critical: 2 });

  function finite(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function normalizeChannel(raw, fallback) {
    const warning = Math.max(1, Math.round(finite(raw?.warning, fallback.warning)));
    const critical = Math.max(warning + 1, Math.round(finite(raw?.critical, fallback.critical)));
    return { warning, critical };
  }

  function normalizeLimits(raw = {}) {
    return {
      enemies: normalizeChannel(raw.enemies, DEFAULT_LIMITS.enemies),
      projectiles: normalizeChannel(raw.projectiles, DEFAULT_LIMITS.projectiles),
    };
  }

  function severity(value, limits) {
    if (value >= limits.critical) return 'critical';
    if (value >= limits.warning) return 'warning';
    return 'ok';
  }

  function measure(value, limits) {
    const count = Math.max(0, Math.round(finite(value)));
    return {
      value: count,
      warning: limits.warning,
      critical: limits.critical,
      ratio: count / limits.critical,
      severity: severity(count, limits),
    };
  }

  function highest(...values) {
    return values.reduce((best, value) => SEVERITY_RANK[value] > SEVERITY_RANK[best] ? value : best, 'ok');
  }

  class Tracker {
    constructor(limits = DEFAULT_LIMITS) {
      this.limits = normalizeLimits(limits);
      this.reset();
    }

    reset() {
      this.current = { time: 0, enemies: 0, projectiles: 0 };
      this.peaks = {
        enemies: { value: 0, time: 0 },
        projectiles: { value: 0, time: 0 },
      };
      this.observed = false;
      return this;
    }

    observe(time, counts = {}) {
      const at = Math.max(0, finite(time));
      const enemies = Math.max(0, Math.round(finite(counts.enemies)));
      const projectiles = Math.max(0, Math.round(finite(counts.projectiles)));
      this.current = { time: at, enemies, projectiles };
      if (!this.observed || enemies > this.peaks.enemies.value) this.peaks.enemies = { value: enemies, time: at };
      if (!this.observed || projectiles > this.peaks.projectiles.value) this.peaks.projectiles = { value: projectiles, time: at };
      this.observed = true;
      return this;
    }

    snapshot() {
      return JSON.parse(JSON.stringify({ current: this.current, peaks: this.peaks, observed: this.observed }));
    }

    restore(snapshot = {}) {
      this.reset();
      const current = snapshot.current || {};
      const peaks = snapshot.peaks || {};
      this.current = {
        time: Math.max(0, finite(current.time)),
        enemies: Math.max(0, Math.round(finite(current.enemies))),
        projectiles: Math.max(0, Math.round(finite(current.projectiles))),
      };
      for (const key of ['enemies', 'projectiles']) {
        this.peaks[key] = {
          value: Math.max(0, Math.round(finite(peaks[key]?.value))),
          time: Math.max(0, finite(peaks[key]?.time)),
        };
      }
      this.observed = snapshot.observed === true;
      return this;
    }

    report() {
      const current = {
        time: this.current.time,
        enemies: measure(this.current.enemies, this.limits.enemies),
        projectiles: measure(this.current.projectiles, this.limits.projectiles),
      };
      const peaks = {
        enemies: { ...measure(this.peaks.enemies.value, this.limits.enemies), time: this.peaks.enemies.time },
        projectiles: { ...measure(this.peaks.projectiles.value, this.limits.projectiles), time: this.peaks.projectiles.time },
      };
      return {
        limits: normalizeLimits(this.limits),
        current,
        peaks,
        severity: highest(current.enemies.severity, current.projectiles.severity),
        peakSeverity: highest(peaks.enemies.severity, peaks.projectiles.severity),
      };
    }
  }

  const api = Object.freeze({ DEFAULT_LIMITS, SEVERITY_RANK, normalizeLimits, severity, measure, Tracker });
  root.StageBudget = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
