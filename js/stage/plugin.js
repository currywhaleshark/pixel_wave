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

  const numberField = (path, label, min, max, step) => Object.freeze({ path, label, type: 'number', min, max, step });
  const booleanField = (path, label) => Object.freeze({ path, label, type: 'boolean' });
  const selectField = (path, label, options) => Object.freeze({ path, label, type: 'select', options: Object.freeze(options) });
  const channel = (id, mode) => Object.freeze({ id, mode });

  const definitions = Object.freeze({
    'scroll-speed': Object.freeze({
      name: '스크롤 속도',
      description: '클립 안 시간에 따라 배경과 지형의 진행 배율을 바꿉니다.',
      itemTypes: Object.freeze(['environment']),
      channels: Object.freeze([channel('world.scrollMultiplier', 'multiply')]),
      editor: 'curve',
      fields: Object.freeze([]),
    }),
    darkness: Object.freeze({
      name: '암전',
      description: '배경 암전 목표값과 도달 속도를 조절합니다.',
      itemTypes: Object.freeze(['environment']),
      channels: Object.freeze([channel('environment.darkness', 'maximum')]),
      editor: 'generic',
      fields: Object.freeze([
        numberField('target', '암전 강도', 0, 1, 0.01),
        numberField('responseRate', '반응 속도', 0.01, 10, 0.01),
      ]),
    }),
    'storm-current': Object.freeze({
      name: '폭풍 해류',
      description: '수면과 해류의 세기, 움직임, 대상별 영향 배율을 조절합니다.',
      itemTypes: Object.freeze(['environment']),
      channels: Object.freeze([
        channel('environment.current', 'add'),
        channel('environment.stormScale', 'maximum'),
      ]),
      editor: 'generic',
      fields: Object.freeze([
        numberField('scale', '폭풍 세기', 0, 5, 0.05),
        numberField('surfaceBoundaryY', '수면 경계 Y', 0, 540, 1),
        booleanField('drawSurfaceWaves', '수면 파도 표시'),
        booleanField('drawCurrentIndicator', '해류 표시'),
        numberField('current.xAmplitude', '해류 X 진폭', 0, 500, 1),
        numberField('current.xAngularFrequency', '해류 X 각주파수', 0, 20, 0.01),
        numberField('current.yAmplitude', '해류 Y 진폭', 0, 500, 1),
        numberField('current.yAngularFrequency', '해류 Y 각주파수', 0, 20, 0.01),
        numberField('influence.player.x', '플레이어 X 영향', 0, 5, 0.05),
        numberField('influence.player.y', '플레이어 Y 영향', 0, 5, 0.05),
        numberField('influence.pointerTarget.x', '조준점 X 영향', 0, 5, 0.05),
        numberField('influence.pointerTarget.y', '조준점 Y 영향', 0, 5, 0.05),
        numberField('influence.enemyProjectile.x', '적탄 X 영향', 0, 5, 0.05),
        numberField('influence.enemyProjectile.y', '적탄 Y 영향', 0, 5, 0.05),
        numberField('influence.currentSurfEnemy.x', '해류 적 X 영향', 0, 5, 0.05),
        numberField('influence.currentSurfEnemy.y', '해류 적 Y 영향', 0, 5, 0.05),
      ]),
    }),
    'turtle-ride': Object.freeze({
      name: '거북 택시',
      description: '플레이어 이동을 거북 택시 주행으로 전환합니다.',
      itemTypes: Object.freeze(['gimmick']),
      channels: Object.freeze([
        channel('world.scrollMultiplier', 'multiply'),
        channel('player.invulnerable', 'or'),
        channel('player.motionOverride', 'exclusive'),
      ]),
      editor: 'turtle-ride',
      fields: Object.freeze([]),
    }),
    'lightning-strike': Object.freeze({
      name: '번개',
      description: '예고 뒤 지정한 화면 X 위치에 번개를 내리칩니다.',
      itemTypes: Object.freeze(['hazard']),
      channels: Object.freeze([channel('hazard.lightning', 'stack')]),
      editor: 'generic',
      fields: Object.freeze([
        numberField('xRatio', '화면 X 위치', 0, 1, 0.01),
        numberField('width', '번개 폭', 1, 960, 1),
        numberField('telegraphDuration', '예고 시간', 0, 30, 0.05),
        numberField('strikeDuration', '공격 시간', 0.01, 30, 0.05),
      ]),
    }),
    'wreck-corridor': Object.freeze({
      name: '난파선 통로',
      description: '화면 위나 아래에서 진입하는 파괴 불가 난파선 벽입니다.',
      itemTypes: Object.freeze(['hazard']),
      channels: Object.freeze([channel('hazard.corridor', 'stack')]),
      editor: 'generic',
      fields: Object.freeze([
        selectField('side', '배치 방향', Object.freeze([
          Object.freeze({ value: 'top', label: '위쪽' }),
          Object.freeze({ value: 'bottom', label: '아래쪽' }),
        ])),
        numberField('heightFraction', '화면 점유 높이', 0.05, 0.95, 0.01),
        numberField('speed', '진행 속도', 1, 1000, 1),
        numberField('width', '벽 너비', 1, 960, 1),
        booleanField('indestructible', '파괴 불가'),
      ]),
    }),
    'boss-warning': Object.freeze({
      name: '보스 경고', description: '보스 등장 전 경고를 표시합니다.',
      itemTypes: Object.freeze(['cue']), channels: Object.freeze([]), editor: 'boss-warning', fields: Object.freeze([]),
    }),
    'boss-start': Object.freeze({
      name: '보스 시작', description: '스테이지 보스를 시작합니다.',
      itemTypes: Object.freeze(['boss']), channels: Object.freeze([]), editor: null, fields: Object.freeze([]),
    }),
  });

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function getPath(object, path) {
    return String(path).split('.').reduce((value, key) => value?.[key], object);
  }

  function setPath(object, path, value) {
    const keys = String(path).split('.');
    let target = object;
    keys.slice(0, -1).forEach(key => {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
    return object;
  }

  function coerceField(field, value) {
    if (field.type === 'boolean') return !!value;
    if (field.type === 'number') return clamp(value, field.min, field.max);
    if (field.type === 'select') {
      const candidate = String(value ?? '');
      return field.options.some(option => option.value === candidate) ? candidate : field.options[0]?.value;
    }
    return String(value ?? '');
  }

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
    for (const field of contract.fields) {
      const value = getPath(item.payload?.params, field.path);
      if (field.type === 'number' && (!Number.isFinite(Number(value)) || Number(value) < field.min || Number(value) > field.max)) {
        errors.push(`${field.path}은 ${field.min}–${field.max} 범위의 수여야 합니다.`);
      } else if (field.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${field.path}은 boolean이어야 합니다.`);
      } else if (field.type === 'select' && !field.options.some(option => option.value === value)) {
        errors.push(`${field.path}은 ${field.options.map(option => option.value).join(', ')} 중 하나여야 합니다.`);
      }
    }
    return errors;
  }

  function channels(pluginId) {
    return (definition(pluginId)?.channels || []).slice();
  }

  function findChannelConflicts(items) {
    const active = (items || []).filter(item => item && item.enabled !== false && finite(item.timing?.duration) > 0);
    const owners = new Map();
    active.forEach(item => {
      channels(item.payload?.pluginId).filter(entry => entry.mode === 'exclusive').forEach(entry => {
        if (!owners.has(entry.id)) owners.set(entry.id, []);
        owners.get(entry.id).push(item);
      });
    });
    const conflicts = [];
    for (const [channelId, channelItems] of owners) {
      for (let leftIndex = 0; leftIndex < channelItems.length; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < channelItems.length; rightIndex++) {
          const left = channelItems[leftIndex];
          const right = channelItems[rightIndex];
          const start = Math.max(finite(left.timing.start), finite(right.timing.start));
          const end = Math.min(
            finite(left.timing.start) + finite(left.timing.duration),
            finite(right.timing.start) + finite(right.timing.duration),
          );
          if (end <= start + EPS) continue;
          conflicts.push({
            channelId,
            itemIds: [left.id, right.id],
            start,
            end,
            message: `${channelId} 독점 채널이 ${start.toFixed(2)}–${end.toFixed(2)}초에 '${left.id}', '${right.id}'에서 겹칩니다.`,
          });
        }
      }
    }
    return conflicts.sort((a, b) => (a.start - b.start) || a.channelId.localeCompare(b.channelId) || a.itemIds.join().localeCompare(b.itemIds.join()));
  }

  function initialRuntimeState() {
    return {
      scrollMultiplier: 1,
      darkness: 0,
      darknessTarget: 0,
      stormScale: 0,
      current: { x: 0, y: 0 },
      influence: {
        player: { x: 0, y: 0 },
        pointerTarget: { x: 0, y: 0 },
        enemyProjectile: { x: 0, y: 0 },
        currentSurfEnemy: { x: 0, y: 0 },
      },
      drawSurfaceWaves: false,
      drawCurrentIndicator: false,
      surfaceBoundaryY: 0,
      playerInvulnerable: false,
      lightning: [],
      wrecks: [],
    };
  }

  function activeValues(activeItems) {
    if (activeItems instanceof Map) return [...activeItems.entries()].map(([itemId, value]) => ({ itemId, ...value }));
    return Array.isArray(activeItems) ? activeItems : [];
  }

  function addInfluence(target, source, scale = 1) {
    for (const key of Object.keys(target)) {
      target[key].x += finite(source?.[key]?.x) * scale;
      target[key].y += finite(source?.[key]?.y) * scale;
    }
  }

  function sampleCurrent(state, targetId = 'player') {
    const current = state?.current || {};
    if (targetId === 'raw') {
      return { x: finite(current.x), y: finite(current.y) };
    }
    const influence = state?.influence?.[targetId] || {};
    return {
      x: finite(current.x) * finite(influence.x) || 0,
      y: finite(current.y) * finite(influence.y) || 0,
    };
  }

  function evaluateRuntimeState(previous, activeItems, at, dt, viewport = { width: 960, height: 540 }) {
    const state = initialRuntimeState();
    const before = previous || state;
    let darknessRate = 1.2;
    for (const active of activeValues(activeItems)) {
      const pluginId = active.payload?.pluginId;
      const params = active.payload?.params || {};
      const localTime = Math.max(0, finite(at) - finite(active.start));
      if (pluginId === 'scroll-speed') {
        state.scrollMultiplier *= sampleCurve(params.curve, localTime);
      } else if (pluginId === 'darkness') {
        if (finite(params.target) >= state.darknessTarget) {
          state.darknessTarget = finite(params.target);
          darknessRate = Math.max(0, finite(params.responseRate));
        }
      } else if (pluginId === 'storm-current') {
        const scale = Math.max(0, finite(params.scale));
        state.stormScale = Math.max(state.stormScale, scale);
        state.current.x += Math.sin(finite(at) * finite(params.current?.xAngularFrequency)) * finite(params.current?.xAmplitude) * scale;
        state.current.y += Math.sin(finite(at) * finite(params.current?.yAngularFrequency)) * finite(params.current?.yAmplitude) * scale;
        addInfluence(state.influence, params.influence, scale);
        state.drawSurfaceWaves ||= params.drawSurfaceWaves === true;
        state.drawCurrentIndicator ||= params.drawCurrentIndicator === true;
        state.surfaceBoundaryY = Math.max(state.surfaceBoundaryY, finite(params.surfaceBoundaryY));
      } else if (pluginId === 'turtle-ride') {
        state.scrollMultiplier *= Number(params.scrollMultiplier) || 1;
        state.playerInvulnerable ||= params.playerInvulnerable === true;
      } else if (pluginId === 'lightning-strike') {
        const telegraphDuration = Math.max(0, finite(params.telegraphDuration));
        const strikeDuration = Math.max(0, finite(params.strikeDuration));
        state.lightning.push({
          itemId: active.itemId,
          x: finite(params.xRatio) * viewport.width,
          width: Math.max(1, finite(params.width)),
          localTime,
          phase: localTime < telegraphDuration ? 'telegraph' : localTime < telegraphDuration + strikeDuration ? 'strike' : 'done',
          phaseProgress: localTime < telegraphDuration
            ? localTime / Math.max(telegraphDuration, EPS)
            : (localTime - telegraphDuration) / Math.max(strikeDuration, EPS),
        });
      } else if (pluginId === 'wreck-corridor') {
        const width = Math.max(1, finite(params.width));
        const height = Math.max(1, finite(params.heightFraction) * viewport.height);
        state.wrecks.push({
          itemId: active.itemId,
          side: params.side === 'top' ? 'top' : 'bottom',
          x: viewport.width + width * 0.5 - Math.max(0, finite(params.speed)) * localTime,
          y: params.side === 'top' ? height * 0.5 : viewport.height - height * 0.5,
          width,
          height,
          indestructible: params.indestructible === true,
        });
      }
    }
    const delta = Math.max(0, finite(dt));
    state.darkness = before.darkness + (state.darknessTarget - before.darkness) * Math.min(1, delta * darknessRate);
    state.scrollMultiplier = clamp(state.scrollMultiplier, 0, 5);
    state.lightning = state.lightning.filter(entry => entry.phase !== 'done');
    return state;
  }

  const api = Object.freeze({
    CURVE_MIN,
    CURVE_MAX,
    definitions,
    definition,
    channels,
    getPath,
    setPath,
    coerceField,
    clone,
    findChannelConflicts,
    initialRuntimeState,
    evaluateRuntimeState,
    sampleCurrent,
    sampleCurve,
    normalizeCurve,
    validateCurve,
    validateItem,
  });
  root.StagePlugin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
