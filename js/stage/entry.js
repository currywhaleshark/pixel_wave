// ============================================================
// stage/entry.js — 진입 프리셋 정규화·검증·화면 가장자리 해석
// 컴파일러와 Stage Sequencer가 같은 시작점·방향을 공유한다.
// ============================================================
(function initStageEntry(root) {
  'use strict';

  const PRESETS = Object.freeze([
    'right-to-left',
    'left-to-right',
    'top-to-bottom',
    'bottom-to-top',
    'diagonal',
  ]);
  const REAR_WARNING_DEFAULTS = Object.freeze({ enabled: true, lead: 0.9 });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }

  function normalize(entry) {
    const presetId = PRESETS.includes(entry?.presetId) ? entry.presetId : 'right-to-left';
    const sourceParams = entry?.params && typeof entry.params === 'object' && !Array.isArray(entry.params)
      ? clone(entry.params)
      : {};
    const output = {
      presetId,
      x: clamp(entry?.x ?? 0.5, -1, 2),
      y: clamp(entry?.y ?? 0.5, -1, 2),
    };
    if (presetId === 'diagonal') {
      output.params = {
        ...sourceParams,
        vertical: sourceParams.vertical === 'up' ? 'up' : 'down',
      };
    } else if (Object.keys(sourceParams).length) output.params = sourceParams;
    return output;
  }

  function validate(entry) {
    const errors = [];
    if (!PRESETS.includes(entry?.presetId)) return errors;
    if (entry.x !== undefined && (!Number.isFinite(Number(entry.x)) || Number(entry.x) < -1 || Number(entry.x) > 2)) {
      errors.push('진입 X 좌표가 올바르지 않습니다.');
    }
    if (entry.y !== undefined && (!Number.isFinite(Number(entry.y)) || Number(entry.y) < -1 || Number(entry.y) > 2)) {
      errors.push('진입 Y 좌표가 올바르지 않습니다.');
    }
    if (entry.presetId === 'diagonal' && entry.params?.vertical !== undefined && !['down', 'up'].includes(entry.params.vertical)) {
      errors.push('대각 진입 방향이 올바르지 않습니다.');
    }
    if (entry.presetId === 'left-to-right') {
      if (entry.params?.warningEnabled !== undefined && typeof entry.params.warningEnabled !== 'boolean') {
        errors.push('후방 진입 경고 표시 여부가 올바르지 않습니다.');
      }
      if (entry.params?.warningLead !== undefined) {
        const lead = Number(entry.params.warningLead);
        if (!Number.isFinite(lead) || lead < 0.2 || lead > 5) {
          errors.push('후방 진입 경고 시간은 0.2~5초여야 합니다.');
        }
      }
    }
    return errors;
  }

  function rearWarning(entry) {
    const normalized = normalize(entry);
    if (normalized.presetId !== 'left-to-right') return null;
    return {
      enabled: normalized.params?.warningEnabled !== false,
      lead: clamp(normalized.params?.warningLead ?? REAR_WARNING_DEFAULTS.lead, 0.2, 5),
    };
  }

  function resolve(entry, viewport, margin = 30) {
    const normalized = normalize(entry);
    const width = Math.max(1, finite(viewport?.width, 960));
    const height = Math.max(1, finite(viewport?.height, 540));
    const x = normalized.x * width;
    const y = normalized.y * height;
    if (normalized.presetId === 'left-to-right') {
      return { entry: normalized, x: -margin, y, directionX: 1, directionY: 0, coordinate: 'y' };
    }
    if (normalized.presetId === 'top-to-bottom') {
      return { entry: normalized, x, y: -margin, directionX: -0.25, directionY: 1, coordinate: 'x' };
    }
    if (normalized.presetId === 'bottom-to-top') {
      return { entry: normalized, x, y: height + margin, directionX: -0.25, directionY: -1, coordinate: 'x' };
    }
    if (normalized.presetId === 'diagonal') {
      const upward = normalized.params.vertical === 'up';
      return {
        entry: normalized,
        x,
        y: upward ? height + margin : -margin,
        directionX: -0.55,
        directionY: upward ? -0.83 : 0.83,
        coordinate: 'x',
      };
    }
    return { entry: normalized, x: width + margin, y, directionX: -1, directionY: 0, coordinate: 'y' };
  }

  const api = Object.freeze({ PRESETS, REAR_WARNING_DEFAULTS, normalize, validate, rearWarning, resolve });
  root.StageEntry = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
