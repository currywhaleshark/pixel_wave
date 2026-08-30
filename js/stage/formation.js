// ============================================================
// stage/formation.js — 편대 파라미터 정규화·검증·배치
// 컴파일러와 Stage Sequencer가 같은 편대 해석을 공유한다.
// ============================================================
(function initStageFormation(root) {
  'use strict';

  const PRESETS = Object.freeze(['single', 'column', 'v', 'wall-gap']);

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

  function integer(value, min, max, fallback) {
    return Math.round(clamp(value ?? fallback, min, max));
  }

  function normalize(formation, spawnCount = 1) {
    const presetId = PRESETS.includes(formation?.presetId) ? formation.presetId : 'single';
    const sourceParams = formation?.params && typeof formation.params === 'object' && !Array.isArray(formation.params)
      ? clone(formation.params)
      : {};
    if (presetId === 'v') {
      return {
        presetId,
        params: {
          ...sourceParams,
          spacingX: clamp(sourceParams.spacingX ?? 34, 0, 240),
          spacingY: clamp(sourceParams.spacingY ?? 42, 0, 180),
        },
      };
    }
    if (presetId === 'wall-gap') {
      const slotCount = integer(sourceParams.slotCount, 2, 128, 10);
      const gapSlots = integer(sourceParams.gapSlots, 0, slotCount - 1, 2);
      const maxStart = slotCount - gapSlots;
      const rawRange = Array.isArray(sourceParams.gapStartRange) ? sourceParams.gapStartRange : [1, Math.max(1, maxStart - 1)];
      const first = integer(rawRange[0], 0, maxStart, 0);
      const second = integer(rawRange[1], 0, maxStart, first);
      return {
        presetId,
        params: {
          ...sourceParams,
          slotCount,
          gapSlots,
          gapStartRange: [Math.min(first, second), Math.max(first, second)],
          topPadding: clamp(sourceParams.topPadding ?? 40, 0, 520),
          bottomPadding: clamp(sourceParams.bottomPadding ?? 20, 0, 520),
        },
      };
    }
    const output = { presetId };
    if (Object.keys(sourceParams).length) output.params = sourceParams;
    return output;
  }

  function validate(formation, spawnCount = 1) {
    const errors = [];
    if (!PRESETS.includes(formation?.presetId)) return errors;
    const params = formation?.params || {};
    const validNumber = (value, min, max) => value === undefined || (Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max);
    if (formation.presetId === 'v') {
      if (!validNumber(params.spacingX, 0, 240)) errors.push('V 편대의 가로 간격이 올바르지 않습니다.');
      if (!validNumber(params.spacingY, 0, 180)) errors.push('V 편대의 세로 간격이 올바르지 않습니다.');
    }
    if (formation.presetId === 'wall-gap') {
      const slotCount = Number(params.slotCount ?? 10);
      const gapSlots = Number(params.gapSlots ?? 2);
      if (!Number.isInteger(slotCount) || slotCount < 2 || slotCount > 128) errors.push('벽 편대의 전체 칸 수가 올바르지 않습니다.');
      if (!Number.isInteger(gapSlots) || gapSlots < 0 || gapSlots >= slotCount) errors.push('벽 편대의 빈 칸 수가 올바르지 않습니다.');
      if (!validNumber(params.topPadding, 0, 520) || !validNumber(params.bottomPadding, 0, 520)) {
        errors.push('벽 편대의 위아래 여백이 올바르지 않습니다.');
      } else if (Number(params.topPadding ?? 40) + Number(params.bottomPadding ?? 20) >= 540) {
        errors.push('벽 편대의 위아래 여백 합은 화면 높이보다 작아야 합니다.');
      }
      if (Array.isArray(params.gapStartRange)) {
        const maxStart = slotCount - gapSlots;
        if (params.gapStartRange.length !== 2 || params.gapStartRange.some(value => !Number.isInteger(Number(value)) || value < 0 || value > maxStart)) {
          errors.push('벽 편대의 틈 위치가 올바르지 않습니다.');
        }
      }
    }
    if (formation.presetId !== 'wall-gap' && (!Number.isFinite(Number(spawnCount)) || spawnCount < 1 || spawnCount > 256)) {
      errors.push('편대의 생성 마릿수가 올바르지 않습니다.');
    }
    return errors;
  }

  function resolvedCount(formation, spawnCount = 1) {
    const normalized = normalize(formation, spawnCount);
    if (normalized.presetId === 'wall-gap') return normalized.params.slotCount - normalized.params.gapSlots;
    return integer(spawnCount, 1, 256, 1);
  }

  function layout(formation, spawnCount, options = {}) {
    const normalized = normalize(formation, spawnCount);
    const baseX = finite(options.baseX);
    const baseY = finite(options.baseY);
    const width = Math.max(1, finite(options.width, 960));
    const height = Math.max(1, finite(options.height, 540));
    const rawDirectionX = finite(options.directionX, -1);
    const rawDirectionY = finite(options.directionY, 0);
    const directionLength = Math.hypot(rawDirectionX, rawDirectionY) || 1;
    const directionX = rawDirectionX / directionLength;
    const directionY = rawDirectionY / directionLength;
    const backwardX = -directionX;
    const backwardY = -directionY;
    const sideX = directionY;
    const sideY = -directionX;
    if (normalized.presetId === 'wall-gap') {
      const params = normalized.params;
      const maxStart = params.slotCount - params.gapSlots;
      const gapStart = integer(options.gapStart, 0, maxStart, params.gapStartRange[0]);
      const verticalWall = Math.abs(directionX) >= Math.abs(directionY);
      const span = verticalWall ? height : width;
      const usableSpan = Math.max(0, span - params.topPadding - params.bottomPadding);
      const spacing = params.slotCount > 1 ? usableSpan / (params.slotCount - 1) : 0;
      const points = [];
      for (let slot = 0; slot < params.slotCount; slot++) {
        if (slot >= gapStart && slot < gapStart + params.gapSlots) continue;
        const position = params.topPadding + slot * spacing;
        points.push({
          x: verticalWall ? baseX : position,
          y: verticalWall ? position : baseY,
          wallSlot: slot,
          rank: slot,
        });
      }
      return { formation: normalized, points, resolvedCount: points.length, gapStart, spacing, verticalWall, width, height };
    }
    const count = resolvedCount(normalized, spawnCount);
    if (normalized.presetId === 'v') {
      const points = [];
      for (let index = 0; index < count; index++) {
        const rank = index === 0 ? 0 : Math.ceil(index / 2);
        const side = index === 0 ? 0 : (index % 2 === 1 ? -1 : 1);
        const backward = rank * normalized.params.spacingX;
        const spread = side * rank * normalized.params.spacingY;
        points.push({
          x: baseX + backwardX * backward + sideX * spread,
          y: baseY + backwardY * backward + sideY * spread,
          rank,
          side,
          targetXOffset: backwardX * backward + sideX * spread,
          targetYOffset: backwardY * backward + sideY * spread,
        });
      }
      return { formation: normalized, points, resolvedCount: count, width, height };
    }
    return {
      formation: normalized,
      points: Array.from({ length: count }, () => ({ x: baseX, y: baseY, rank: 0, side: 0 })),
      resolvedCount: count,
      width,
      height,
    };
  }

  const api = Object.freeze({ PRESETS, normalize, validate, resolvedCount, layout });
  root.StageFormation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
