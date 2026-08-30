// ============================================================
// stage/path.js — Stage JSON 경로 정규화·보간·좌표 변환
// 런타임과 Stage Sequencer가 같은 경로 해석을 공유한다.
// ============================================================
(function initStagePath(root) {
  'use strict';

  const EASES = Object.freeze(['linear', 'smooth', 'ease-in', 'ease-out', 'ease-in-out']);

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

  function normalize(path) {
    if (!Array.isArray(path)) return [];
    return path.map((point, index) => {
      const normalized = {
        t: clamp(point?.t, 0, 300),
        x: clamp(point?.x, -2, 3),
        y: clamp(point?.y, -2, 3),
      };
      if (EASES.includes(point?.ease)) normalized.ease = point.ease;
      if (finite(point?.hold, 0) > 0) normalized.hold = clamp(point.hold, 0, 120);
      if (point?.action && typeof point.action === 'object' && !Array.isArray(point.action)) normalized.action = clone(point.action);
      return { point: normalized, index };
    }).sort((left, right) => (left.point.t - right.point.t) || (left.index - right.index))
      .map(entry => entry.point);
  }

  function validate(path) {
    const errors = [];
    if (!Array.isArray(path) || path.length < 2) return ['경로에는 점이 2개 이상 필요합니다.'];
    if (path.length > 64) errors.push('경로 점은 최대 64개입니다.');
    let previousTime = -Infinity;
    path.forEach((point, index) => {
      if (!Number.isFinite(Number(point?.t)) || point.t < 0 || point.t > 300) errors.push(`경로 점 ${index + 1}의 시간이 올바르지 않습니다.`);
      if (!Number.isFinite(Number(point?.x)) || point.x < -2 || point.x > 3
        || !Number.isFinite(Number(point?.y)) || point.y < -2 || point.y > 3) {
        errors.push(`경로 점 ${index + 1}의 위치가 올바르지 않습니다.`);
      }
      if (Number(point?.t) <= previousTime) errors.push(`경로 점 ${index + 1}의 시간은 앞 점보다 커야 합니다.`);
      if (point?.ease !== undefined && !EASES.includes(point.ease)) errors.push(`경로 점 ${index + 1}의 이징이 올바르지 않습니다.`);
      if (point?.hold !== undefined && (!Number.isFinite(Number(point.hold)) || point.hold < 0 || point.hold > 120)) {
        errors.push(`경로 점 ${index + 1}의 대기 시간이 올바르지 않습니다.`);
      }
      const nextTime = Number(path[index + 1]?.t);
      if (Number.isFinite(nextTime) && Number(point?.t) + finite(point?.hold, 0) > nextTime) {
        errors.push(`경로 점 ${index + 1}의 대기 시간이 다음 점 도착 시간을 넘습니다.`);
      }
      previousTime = Number(point?.t);
    });
    return errors;
  }

  function easeRatio(ratio, ease = 'linear') {
    const t = clamp(ratio, 0, 1);
    if (ease === 'smooth') return t * t * (3 - 2 * t);
    if (ease === 'ease-in') return t * t;
    if (ease === 'ease-out') return 1 - (1 - t) * (1 - t);
    if (ease === 'ease-in-out') return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    return t;
  }

  function sample(path, at, viewport = { width: 1, height: 1 }) {
    const points = path || [];
    if (!points.length) return null;
    const time = Math.max(0, finite(at));
    const scale = point => ({ x: point.x * viewport.width, y: point.y * viewport.height });
    if (time <= points[0].t) {
      return { ...scale(points[0]), pointIndex: 0, ratio: 0, done: false, directionX: 0 };
    }
    for (let index = 1; index < points.length; index++) {
      const previous = points[index - 1];
      const next = points[index];
      const departAt = previous.t + (previous.hold || 0);
      if (time <= departAt) return { ...scale(previous), pointIndex: index - 1, ratio: 0, done: false, directionX: 0 };
      if (time <= next.t) {
        const span = next.t - departAt;
        const ratio = span > 0 ? easeRatio((time - departAt) / span, next.ease || 'linear') : 1;
        return {
          x: (previous.x + (next.x - previous.x) * ratio) * viewport.width,
          y: (previous.y + (next.y - previous.y) * ratio) * viewport.height,
          pointIndex: index,
          ratio,
          done: false,
          directionX: Math.sign(next.x - previous.x),
        };
      }
    }
    const last = points[points.length - 1];
    return {
      ...scale(last),
      pointIndex: points.length - 1,
      ratio: 1,
      done: time > last.t + (last.hold || 0),
      directionX: points.length > 1 ? Math.sign(last.x - points[points.length - 2].x) : 0,
    };
  }

  function defaultForWave(wave, viewport = { width: 960, height: 540 }) {
    const entry = wave?.payload?.entry || {};
    const fromLeft = entry.presetId === 'left-to-right';
    const startX = Number.isFinite(Number(entry.x)) ? Number(entry.x) : (fromLeft ? -0.05 : 1.05);
    const endX = fromLeft ? 1.08 : -0.08;
    const y = clamp(entry.y ?? 0.5, -0.2, 1.2);
    const speed = Math.max(30, finite(wave?.payload?.enemy?.speed, 150));
    const travel = Math.max(2, (viewport.width * Math.abs(endX - startX)) / speed);
    return normalize([
      { t: 0, x: startX, y },
      { t: +(travel * 0.5).toFixed(2), x: 0.5, y, ease: 'smooth' },
      { t: +travel.toFixed(2), x: endX, y, ease: 'smooth' },
    ]);
  }

  const api = Object.freeze({ EASES, normalize, validate, easeRatio, sample, defaultForWave });
  root.StagePath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
