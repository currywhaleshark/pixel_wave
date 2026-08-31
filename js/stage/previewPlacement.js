// ============================================================
// stage/previewPlacement.js — 미리보기 스프라이트 드래그를 저작 값으로 환산
// 진행 축 이동은 등장 시각, 교차 축 이동은 진입 좌표/경로에 반영한다.
// ============================================================
(function initStagePreviewPlacement(root) {
  'use strict';

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, finite(value, minimum)));
  }

  function round(value, precision = 3) {
    const scale = 10 ** precision;
    return Math.round(finite(value) * scale) / scale;
  }

  function entryCoordinate(entry) {
    return ['top-to-bottom', 'bottom-to-top', 'diagonal'].includes(entry?.presetId) ? 'x' : 'y';
  }

  function translatePath(path, coordinate, deltaX, deltaY, viewport) {
    if (!Array.isArray(path)) return false;
    const delta = coordinate === 'x'
      ? finite(deltaX) / Math.max(1, finite(viewport?.width, 960))
      : finite(deltaY) / Math.max(1, finite(viewport?.height, 540));
    if (Math.abs(delta) < 1e-9) return false;
    for (const point of path) point[coordinate] = round(clamp(finite(point[coordinate]) + delta, 0, 1));
    return true;
  }

  function applyDrag(item, options = {}) {
    const next = clone(item);
    if (!next || next.type !== 'wave') return { item: next, changed: false };
    const viewport = {
      width: Math.max(1, finite(options.viewport?.width, 960)),
      height: Math.max(1, finite(options.viewport?.height, 540)),
    };
    const deltaX = finite(options.deltaX);
    const deltaY = finite(options.deltaY);
    const coordinate = options.coordinate || entryCoordinate(next.payload?.entry);
    const alongDelta = coordinate === 'x' ? deltaY : deltaX;
    let alongVelocity = coordinate === 'x' ? finite(options.velocityY) : finite(options.velocityX);
    const fallbackVelocity = coordinate === 'x' ? finite(options.fallbackVelocityY) : finite(options.fallbackVelocityX);
    if (Math.abs(alongVelocity) < 24) alongVelocity = fallbackVelocity;

    const originalStart = finite(next.timing?.start);
    const duration = Math.max(0, finite(next.timing?.duration));
    const timelineDuration = Math.max(duration, finite(options.timelineDuration, originalStart + duration));
    const latestVisibleStart = Number.isFinite(Number(options.latestVisibleStart))
      ? finite(options.latestVisibleStart)
      : timelineDuration - duration;
    const maximumStart = Math.max(0, Math.min(timelineDuration - duration, latestVisibleStart));
    let timingChanged = false;
    if (Math.abs(alongVelocity) >= 1) {
      const shifted = round(clamp(originalStart - alongDelta / alongVelocity, 0, maximumStart));
      timingChanged = Math.abs(shifted - originalStart) > 1e-9;
      next.timing.start = shifted;
    }

    const customPath = next.payload?.movement?.presetId === 'custom-path'
      ? next.payload.movement.path
      : null;
    let positionChanged = false;
    if (Array.isArray(customPath)) {
      positionChanged = translatePath(customPath, coordinate, deltaX, deltaY, viewport);
    } else {
      next.payload.entry = clone(next.payload.entry || {});
      const dimension = coordinate === 'x' ? viewport.width : viewport.height;
      const crossDelta = coordinate === 'x' ? deltaX : deltaY;
      const originalCoordinate = finite(next.payload.entry[coordinate], 0.5);
      const shiftedCoordinate = round(clamp(originalCoordinate + crossDelta / dimension, 0, 1));
      positionChanged = Math.abs(shiftedCoordinate - originalCoordinate) > 1e-9;
      next.payload.entry[coordinate] = shiftedCoordinate;
    }

    return {
      item: next,
      changed: timingChanged || positionChanged,
      timingChanged,
      positionChanged,
      coordinate,
      start: next.timing.start,
      entryValue: Array.isArray(customPath) ? customPath[0]?.[coordinate] : next.payload.entry[coordinate],
    };
  }

  const api = Object.freeze({ entryCoordinate, applyDrag });
  root.StagePreviewPlacement = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
