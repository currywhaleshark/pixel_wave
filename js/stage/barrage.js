// ============================================================
// stage/barrage.js — Stage 무기와 BarrageRuntime 사이의 공유 어댑터
// 패턴 카탈로그·참조 검증·컴파일을 편집기와 시뮬레이터가 함께 쓴다.
// ============================================================
(function initStageBarrage(root) {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && !root.BARRAGE_PATTERN_DATA) {
    require('../barragePatterns.generated.js');
  }
  if (typeof module !== 'undefined' && module.exports && !root.BarrageRuntime) require('../barrage.js');
  const Runtime = root.BarrageRuntime;
  const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function localPatterns() {
    try {
      const parsed = JSON.parse(root.localStorage?.getItem(Runtime.STORAGE_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function entries() {
    const catalog = new Map();
    for (const pattern of Object.values(root.BARRAGE_PATTERN_DATA || {})) {
      const normalized = Runtime.normalize(pattern);
      catalog.set(normalized.id, { ...normalized, sourceLabel: '프로젝트' });
    }
    for (const pattern of Object.values(localPatterns())) {
      const normalized = Runtime.normalize(pattern);
      catalog.set(normalized.id, { ...normalized, sourceLabel: '이 기기' });
    }
    return [...catalog.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
  }

  function get(id) {
    return ID.test(String(id || '')) ? Runtime.get(id) : null;
  }

  function normalizeReference(raw) {
    const output = {
      patternId: String(raw?.patternId || ''),
      startDelay: Math.max(0, Math.min(120, Number(raw?.startDelay ?? 0.6) || 0)),
      stopWhenLeaving: raw?.stopWhenLeaving !== false,
    };
    return output;
  }

  function validateReference(raw) {
    const errors = [];
    if (!raw?.patternId || !ID.test(String(raw.patternId))) {
      errors.push('탄막 패턴 id가 올바르지 않습니다.');
      return errors;
    }
    if (raw.presetId) errors.push('무기는 presetId와 patternId를 동시에 사용할 수 없습니다.');
    const startDelay = Number(raw.startDelay ?? 0.6);
    if (!Number.isFinite(startDelay) || startDelay < 0 || startDelay > 120) errors.push('탄막 첫 발 지연이 올바르지 않습니다.');
    if (!get(raw.patternId)) errors.push(`탄막 패턴 '${raw.patternId}'을 찾을 수 없습니다.`);
    return errors;
  }

  function compileReference(raw) {
    const reference = normalizeReference(raw);
    const pattern = get(reference.patternId);
    return pattern ? { ...reference, pattern: clone(pattern) } : reference;
  }

  const api = Object.freeze({ ID, Runtime, entries, get, normalizeReference, validateReference, compileReference });
  root.StageBarrage = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
