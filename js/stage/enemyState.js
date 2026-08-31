// ============================================================
// stage/enemyState.js — 적 종류별 등장·실체화 상태의 공유 계약
// 게임 런타임과 시퀀서 미리보기가 같은 판정/연출 타이밍을 사용한다.
// ============================================================
(function initStageEnemyState(root) {
  'use strict';

  const RULES = Object.freeze({
    viper: Object.freeze({
      revealDelay: Object.freeze({ min: 0, max: 30, default: 0.8 }),
      glintDuration: Object.freeze({ min: 0.05, max: 10, default: 0.55 }),
    }),
    ghost: Object.freeze({
      warningDuration: Object.freeze({ min: 0, max: 30, default: 0.8 }),
      outlineDuration: Object.freeze({ min: 0, max: 10, default: 0.2 }),
      solidDuration: Object.freeze({ min: 0.05, max: 30, default: 1.6 }),
      phaseOffset: Object.freeze({ min: 0, max: 120, default: 0 }),
      phaseStep: Object.freeze({ min: 0, max: 120, default: 0 }),
    }),
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalize(kind, raw, spawnIndex = 0) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {};
    const rules = RULES[kind];
    if (!rules) return source;
    for (const [key, rule] of Object.entries(rules)) {
      source[key] = Math.max(rule.min, Math.min(rule.max, finite(source[key], rule.default)));
    }
    if (kind === 'ghost' && spawnIndex > 0 && source.phaseStep > 0) {
      source.phaseOffset += spawnIndex * source.phaseStep;
    }
    return source;
  }

  function validate(kind, raw) {
    const errors = [];
    if (raw === undefined) return errors;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return ['적 params는 객체여야 합니다.'];
    const rules = RULES[kind];
    if (!rules) return errors;
    for (const [key, rule] of Object.entries(rules)) {
      if (raw[key] === undefined) continue;
      const value = Number(raw[key]);
      if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
        errors.push(`${key} 값이 ${rule.min}~${rule.max} 범위를 벗어났습니다.`);
      }
    }
    return errors;
  }

  function base(phase = 'active') {
    return {
      phase,
      alpha: 1,
      glow: 1,
      outline: false,
      targetable: true,
      hittable: true,
      collidable: true,
      canFire: true,
      tracking: true,
    };
  }

  function resolveViper(age, params, movementParams) {
    const revealEnd = params.revealDelay;
    const glintEnd = revealEnd + params.glintDuration;
    const trackingDuration = Math.max(0, finite(movementParams?.trackingDuration, 9));
    const huntEnd = glintEnd + trackingDuration;
    if (age < revealEnd) {
      return {
        ...base('unlit'), alpha: 0.18, glow: 0,
        targetable: false, hittable: false, collidable: false, canFire: false, tracking: false,
      };
    }
    if (age < glintEnd) {
      const progress = params.glintDuration > 0 ? (age - revealEnd) / params.glintDuration : 1;
      const pulse = Math.sin(progress * Math.PI * 2) ** 2;
      return {
        ...base('glint'), alpha: 0.34 + pulse * 0.28, glow: 0.25 + pulse * 0.75,
        targetable: false, hittable: false, collidable: false, canFire: false, tracking: false,
      };
    }
    if (age < huntEnd) return base('hunt');
    return { ...base('leave'), glow: 0.65, tracking: false };
  }

  function resolveGhost(age, params) {
    const cycle = params.warningDuration + params.outlineDuration + params.solidDuration;
    const local = cycle > 0 ? ((age + params.phaseOffset) % cycle + cycle) % cycle : 0;
    if (local < params.warningDuration) {
      return {
        ...base('warning'), alpha: 0.22, glow: 0, targetable: false,
        hittable: false, collidable: false, canFire: false, tracking: false,
      };
    }
    if (local < params.warningDuration + params.outlineDuration) {
      return {
        ...base('outline'), alpha: 0.58, glow: 0.4, outline: true, targetable: false,
        hittable: false, collidable: false, canFire: false, tracking: false,
      };
    }
    return { ...base('solid'), alpha: 0.9, glow: 0.2 };
  }

  function resolve(kind, age, rawParams, movementParams) {
    const params = normalize(kind, rawParams);
    const elapsed = Math.max(0, finite(age, 0));
    if (kind === 'viper') return resolveViper(elapsed, params, movementParams);
    if (kind === 'ghost') return resolveGhost(elapsed, params);
    if (kind === 'wreck') return { ...base('terrain'), targetable: false, hittable: false, canFire: false, tracking: false };
    return base();
  }

  const api = Object.freeze({ RULES, normalize, validate, resolve });
  root.StageEnemyState = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
