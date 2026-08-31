// ============================================================
// stage/wreck.js — 난파선 장애물 공통 규격
// 스테이지와 보스가 같은 치수, 진입 예고, 외형 선택을 사용한다.
// ============================================================
(function initStageWreck(root) {
  'use strict';

  const VARIANTS = Object.freeze(['auto', 'bow', 'ribs', 'stern', 'beams']);
  const VARIANT_INDEX = Object.freeze({ bow: 0, ribs: 1, stern: 2, beams: 3 });
  const DEFAULTS = Object.freeze({
    side: 'bottom', heightFraction: 0.4, speed: 100, width: 74,
    indestructible: true, hp: 30, variant: 'auto', entryCueDuration: 0.6,
  });

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max, fallback) {
    return Math.max(min, Math.min(max, finite(value, fallback)));
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const char of String(value || 'wreck')) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function normalize(raw, viewport = {}) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const viewportWidth = Math.max(1, finite(viewport.width, 960));
    const viewportHeight = Math.max(1, finite(viewport.height, 540));
    const variant = VARIANTS.includes(source.variant) ? source.variant : DEFAULTS.variant;
    const side = source.side === 'top' ? 'top' : 'bottom';
    const heightFraction = clamp(source.heightFraction, 0.05, 0.95, DEFAULTS.heightFraction);
    return {
      side,
      heightFraction,
      width: clamp(source.width, 1, viewportWidth, DEFAULTS.width),
      height: Math.max(1, heightFraction * viewportHeight),
      speed: clamp(source.speed, 1, 1000, DEFAULTS.speed),
      indestructible: source.indestructible === undefined ? DEFAULTS.indestructible : source.indestructible === true,
      hp: clamp(source.hp, 1, 1000000, DEFAULTS.hp),
      variant,
      entryCueDuration: clamp(source.entryCueDuration, 0, 3, DEFAULTS.entryCueDuration),
    };
  }

  function variantIndex(variant, itemId) {
    if (Object.prototype.hasOwnProperty.call(VARIANT_INDEX, variant)) return VARIANT_INDEX[variant];
    return hashString(itemId) % 4;
  }

  function positionAt(params, viewport, localTime = 0) {
    const normalized = normalize(params, viewport);
    const elapsed = Math.max(0, finite(localTime, 0));
    const x = viewport.width + normalized.width * 0.5
      + normalized.speed * normalized.entryCueDuration
      - normalized.speed * elapsed;
    const y = normalized.side === 'top'
      ? normalized.height * 0.5
      : viewport.height - normalized.height * 0.5;
    return { ...normalized, x, y, localTime: elapsed };
  }

  function createSpawnSpec(params, viewport, options = {}) {
    const state = positionAt(params, viewport, 0);
    return {
      kind: 'wreck', x: state.x, y: state.y,
      hp: state.indestructible ? 999999 : state.hp,
      spd: state.speed, M: 1, S: 0, dirX: -1, dirY: 0,
      wreckW: state.width, wreckH: state.height,
      side: state.side === 'top' ? 'top' : 'bot',
      wreckIndestructible: state.indestructible,
      wreckVariant: variantIndex(state.variant, options.itemId),
      wreckVariantId: state.variant,
      wreckCueDuration: state.entryCueDuration,
      groupId: options.groupId,
    };
  }

  // 지정한 구간을 원본 픽셀 타일로 대칭 채운다. 양 끝은 호출부 clip으로 자른다.
  function tileCenters(center, span, tileSpan) {
    const safeSpan = Math.max(1, finite(span, 1));
    const safeTile = Math.max(1, finite(tileSpan, 1));
    const count = Math.max(1, Math.ceil(safeSpan / safeTile));
    const first = finite(center, 0) - (count * safeTile) * 0.5 + safeTile * 0.5;
    return Array.from({ length: count }, (_value, index) => first + index * safeTile);
  }

  const api = Object.freeze({ DEFAULTS, VARIANTS, normalize, variantIndex, positionAt, createSpawnSpec, tileCenters });
  root.StageWreck = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
