// ============================================================
// stage/plugin.js — Stage 플러그인 계약, 상태 채널, 수치 곡선
// 런타임과 편집기가 같은 보간·검증 규칙을 사용한다.
// ============================================================
(function initStagePlugin(root) {
  'use strict';

  const CURVE_MIN = 0;
  const CURVE_MAX = 5;
  const EPS = 1e-9;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }

  function sampleCurve(points, at, fallback = 1) {
    if (!Array.isArray(points) || !points.length) return fallback;
    if (at <= points[0].at) return finite(points[0].value, fallback);
    for (let index = 1; index < points.length; index++) {
      const next = points[index];
      const previous = points[index - 1];
      if (at <= next.at) {
        const span = finite(next.at) - finite(previous.at);
        const ratio = span > EPS ? (at - previous.at) / span : 1;
        return finite(previous.value, fallback)
          + (finite(next.value, fallback) - finite(previous.value, fallback)) * ratio;
      }
    }
    return finite(points[points.length - 1].value, fallback);
  }

  function normalizeCurve(points, duration) {
    const end = Math.max(0, finite(duration));
    const source = Array.isArray(points) && points.length
      ? points
      : [{ at: 0, value: 1 }, { at: end, value: 1 }];
    const sorted = source.map(point => ({
      at: clamp(point?.at, 0, end),
      value: clamp(point?.value, CURVE_MIN, CURVE_MAX),
    })).sort((a, b) => a.at - b.at);
    const unique = [];
    for (const point of sorted) {
      const previous = unique[unique.length - 1];
      if (previous && Math.abs(previous.at - point.at) <= EPS) previous.value = point.value;
      else unique.push(point);
    }
    if (!unique.length) unique.push({ at: 0, value: 1 });
    if (unique[0].at > EPS) unique.unshift({ at: 0, value: unique[0].value });
    else unique[0].at = 0;
    if (end > EPS) {
      const last = unique[unique.length - 1];
      if (last.at < end - EPS) unique.push({ at: end, value: last.value });
      else last.at = end;
    }
    return unique;
  }

  function validateCurve(points, duration) {
    const errors = [];
    const end = finite(duration, -1);
    if (!Array.isArray(points) || points.length < 2) return ['curve는 시작점과 끝점을 포함해 2개 이상의 점이 필요합니다.'];
    let previousAt = -Infinity;
    points.forEach((point, index) => {
      const at = Number(point?.at);
      const value = Number(point?.value);
      if (!Number.isFinite(at)) errors.push(`curve[${index}].at은 유한한 수여야 합니다.`);
      else {
        if (at < 0 || at > end) errors.push(`curve[${index}].at이 클립 길이 밖입니다.`);
        if (at <= previousAt) errors.push('curve 점의 at은 중복 없이 오름차순이어야 합니다.');
        previousAt = at;
      }
      if (!Number.isFinite(value) || value < CURVE_MIN || value > CURVE_MAX) {
        errors.push(`curve[${index}].value는 ${CURVE_MIN}–${CURVE_MAX} 범위여야 합니다.`);
      }
    });
    if (Number(points[0]?.at) !== 0) errors.push('curve 첫 점은 클립 시작(0초)이어야 합니다.');
    if (Math.abs(Number(points[points.length - 1]?.at) - end) > EPS) errors.push('curve 마지막 점은 클립 끝과 같아야 합니다.');
    return [...new Set(errors)];
  }

  const definitions = Object.freeze({
    'scroll-speed': Object.freeze({
      itemTypes: Object.freeze(['environment']),
      channels: Object.freeze([Object.freeze({ id: 'background-scroll', mode: 'multiply' })]),
    }),
    'turtle-ride': Object.freeze({
      itemTypes: Object.freeze(['gimmick']),
      channels: Object.freeze([
        Object.freeze({ id: 'background-scroll', mode: 'multiply' }),
        Object.freeze({ id: 'player-control', mode: 'exclusive' }),
      ]),
    }),
    'boss-warning': Object.freeze({ itemTypes: Object.freeze(['cue']), channels: Object.freeze([]) }),
    'boss-start': Object.freeze({ itemTypes: Object.freeze(['boss']), channels: Object.freeze([]) }),
  });

  function definition(pluginId) {
    return definitions[pluginId] || null;
  }

  function validateItem(item) {
    const pluginId = item?.payload?.pluginId;
    const contract = definition(pluginId);
    if (!contract) return [];
    const errors = [];
    if (!contract.itemTypes.includes(item.type)) errors.push(`${pluginId} 플러그인은 ${contract.itemTypes.join(', ')} 클립에서만 사용할 수 있습니다.`);
    if (pluginId === 'scroll-speed') errors.push(...validateCurve(item.payload?.params?.curve, item.timing?.duration));
    return errors;
  }

  function channels(pluginId) {
    return (definition(pluginId)?.channels || []).slice();
  }

  const api = Object.freeze({
    CURVE_MIN,
    CURVE_MAX,
    definitions,
    definition,
    channels,
    sampleCurve,
    normalizeCurve,
    validateCurve,
    validateItem,
  });
  root.StagePlugin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
