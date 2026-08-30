// ============================================================
// stage/compiler.js — Stage JSON v1 검증·난이도 해석·스폰 일정 컴파일
// DOM과 게임 객체를 만들지 않는 순수 모듈이다.
// ============================================================
(function initStageCompiler(root) {
  'use strict';

  const Registry = root.StageRegistry || (typeof require === 'function' ? require('./registry.js') : null);
  const RandomApi = root.StageRandom || (typeof require === 'function' ? require('./random.js') : null);
  const PathApi = root.StagePath || (typeof require === 'function' ? require('./path.js') : null);
  const FormationApi = root.StageFormation || (typeof require === 'function' ? require('./formation.js') : null);
  const EntryApi = root.StageEntry || (typeof require === 'function' ? require('./entry.js') : null);
  const BehaviorApi = root.StageBehavior || (typeof require === 'function' ? require('./behavior.js') : null);
  const BarrageApi = root.StageBarrage || (typeof require === 'function' ? require('./barrage.js') : null);
  const PluginApi = root.StagePlugin || (typeof require === 'function' ? require('./plugin.js') : null);
  const { Random, hashString } = RandomApi;
  const ID = /^[a-z0-9][a-z0-9-]*$/;
  const REQUIRED_DEPENDENCIES = Object.freeze([
    'enemyKinds', 'entryPresets', 'formationPresets', 'movementPresets',
    'weaponPresets', 'barragePatterns', 'itemPlugins', 'terrainObjects',
    'terrainProfiles', 'bosses',
  ]);

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

  function deepMerge(base, patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return clone(patch);
    const output = base && typeof base === 'object' && !Array.isArray(base) ? clone(base) : {};
    for (const [key, value] of Object.entries(patch)) {
      output[key] = value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(output[key], value)
        : clone(value);
    }
    return output;
  }

  function stableSort(items) {
    return items.slice().sort((a, b) => {
      const time = finite(a.timing?.start) - finite(b.timing?.start);
      if (Math.abs(time) > 1e-9) return time;
      const priority = (Registry.itemPriority[a.type] ?? 99) - (Registry.itemPriority[b.type] ?? 99);
      return priority || String(a.id).localeCompare(String(b.id));
    });
  }

  function validate(stage) {
    const errors = [];
    const warnings = [];
    if (!stage || typeof stage !== 'object' || Array.isArray(stage)) {
      return { errors: ['Stage JSON이 객체가 아닙니다.'], warnings };
    }
    if (stage.format !== 'pixel-wave-stage') errors.push('format은 pixel-wave-stage여야 합니다.');
    if (stage.schemaVersion !== 1) errors.push('지원하지 않는 schemaVersion입니다.');
    if (stage.registryVersion !== 1) errors.push('지원하지 않는 registryVersion입니다.');
    if (!ID.test(stage.id || '')) errors.push('stage id가 올바르지 않습니다.');
    const duration = finite(stage.timeline?.duration, -1);
    if (duration <= 0 || duration > 3600) errors.push('timeline.duration이 올바르지 않습니다.');
    if (stage.viewport?.width !== 960 || stage.viewport?.height !== 540) errors.push('M1 viewport는 960×540이어야 합니다.');

    const dependencies = stage.dependencies;
    if (!dependencies || typeof dependencies !== 'object') {
      errors.push('dependencies가 필요합니다.');
    } else {
      for (const category of REQUIRED_DEPENDENCIES) {
        if (!Array.isArray(dependencies[category])) {
          errors.push(`dependencies.${category} 배열이 필요합니다.`);
          continue;
        }
        const seen = new Set();
        for (const id of dependencies[category]) {
          if (seen.has(id)) errors.push(`dependencies.${category}에 '${id}'가 중복됩니다.`);
          seen.add(id);
          if (!Registry.knows(category, id)) errors.push(`M1 레지스트리에 없는 ${category} '${id}'입니다.`);
        }
      }
    }

    if (!Array.isArray(stage.sections)) errors.push('sections 배열이 필요합니다.');
    else {
      const ids = new Set();
      for (const [index, section] of stage.sections.entries()) {
        if (!ID.test(section?.id || '')) errors.push(`sections[${index}].id가 올바르지 않습니다.`);
        if (ids.has(section?.id)) errors.push(`section id '${section?.id}'가 중복됩니다.`);
        ids.add(section?.id);
        if (finite(section?.start, -1) < 0 || finite(section?.end, -1) < finite(section?.start) || finite(section?.end) > duration) {
          errors.push(`section '${section?.id || index}' 시간이 타임라인을 벗어납니다.`);
        }
      }
    }

    if (!Array.isArray(stage.items)) {
      errors.push('items 배열이 필요합니다.');
      return { errors, warnings };
    }
    if (stage.items.length > 2000) errors.push('items는 최대 2000개입니다.');
    const itemIds = new Set();
    const useDependency = (category, id, itemId) => {
      if (!id) return;
      if (!dependencies?.[category]?.includes(id)) errors.push(`'${itemId}'가 선언하지 않은 ${category} '${id}'를 사용합니다.`);
    };
    for (const [index, item] of stage.items.entries()) {
      const label = item?.id || `items[${index}]`;
      if (!ID.test(item?.id || '')) errors.push(`${label} id가 올바르지 않습니다.`);
      if (itemIds.has(item?.id)) errors.push(`item id '${item?.id}'가 중복됩니다.`);
      itemIds.add(item?.id);
      if (!Object.hasOwn(Registry.itemPriority, item?.type)) errors.push(`${label} type '${item?.type}'을 지원하지 않습니다.`);
      const start = finite(item?.timing?.start, -1);
      const itemDuration = finite(item?.timing?.duration, -1);
      if (start < 0 || itemDuration < 0) errors.push(`${label} timing이 올바르지 않습니다.`);
      if (item?.timing?.domain === 'time' && (start > duration || start + itemDuration > duration + 1e-6)) {
        errors.push(`${label} 시간이 타임라인을 벗어납니다.`);
      }
      if (item?.type === 'wave') {
        const payload = item.payload || {};
        useDependency('enemyKinds', payload.enemy?.kind, label);
        useDependency('entryPresets', payload.entry?.presetId, label);
        for (const error of EntryApi.validate(payload.entry)) errors.push(`${label}: ${error}`);
        useDependency('formationPresets', payload.formation?.presetId, label);
        for (const error of FormationApi.validate(payload.formation, payload.spawn?.count)) errors.push(`${label}: ${error}`);
        useDependency('movementPresets', payload.movement?.presetId, label);
        for (const error of BehaviorApi.validateMovement(payload.movement)) errors.push(`${label}: ${error}`);
        if (payload.movement?.presetId === 'custom-path') {
          for (const error of PathApi.validate(payload.movement.path)) errors.push(`${label}: ${error}`);
        }
        if (payload.weapon?.presetId) useDependency('weaponPresets', payload.weapon.presetId, label);
        for (const error of BehaviorApi.validateWeapon(payload.weapon)) errors.push(`${label}: ${error}`);
        if (payload.weapon?.patternId) {
          useDependency('barragePatterns', payload.weapon.patternId, label);
          for (const error of BarrageApi.validateReference(payload.weapon)) errors.push(`${label}: ${error}`);
        }
        if (payload.formation?.presetId !== 'wall-gap') {
          const count = finite(payload.spawn?.count, 0);
          const interval = finite(payload.spawn?.interval, -1);
          if (count < 1 || interval < 0) errors.push(`${label} spawn 값이 올바르지 않습니다.`);
          const derived = Math.max(0, count - 1) * Math.max(0, interval);
          if (Math.abs(derived - itemDuration) > 0.011) warnings.push(`${label} duration ${itemDuration}과 파생값 ${derived.toFixed(3)}이 다릅니다.`);
        }
      } else if (item?.type === 'terrain-object') {
        useDependency('terrainObjects', item.payload?.objectId, label);
      } else if (item?.payload?.pluginId) {
        useDependency('itemPlugins', item.payload.pluginId, label);
        for (const error of PluginApi.validateItem(item)) errors.push(`${label}: ${error}`);
        if (item.type === 'boss') useDependency('bosses', item.payload.bossId, label);
      }
    }
    if (stage.draft) warnings.push('초안 Stage JSON입니다.');
    return { errors, warnings };
  }

  function resolveDifficulty(item, difficulty) {
    let resolved = clone(item);
    const override = item.difficulty?.[difficulty.id];
    if (!override) return resolved;
    if (override.enabled === false) return null;
    if (override.mode === 'replace') resolved.payload = clone(override.payload);
    else if (override.mode === 'patch') resolved = deepMerge(resolved, override.patch || {});
    if (override.enabled === true) resolved.enabled = true;
    return resolved;
  }

  function compileWeapon(raw, difficulty) {
    if (raw?.patternId) return BarrageApi.compileReference(raw);
    const weapon = BehaviorApi.normalizeWeapon(raw || { presetId: 'none' });
    if (weapon.presetId === 'none') return { presetId: 'none' };
    const effective = BehaviorApi.effectiveWeapon(weapon);
    weapon.interval = clamp((effective.interval ?? 2) * difficulty.fireInt, 0.03, 120);
    weapon.startDelay = clamp(effective.startDelay ?? 0.6, 0, 120);
    weapon.params = clone(weapon.params || {});
    if (weapon.presetId === 'legacy-ring') {
      weapon.params.count = Math.round(clamp(effective.params.count + difficulty.ringN, 1, 256));
    }
    return weapon;
  }

  function compileWave(item, stage, difficulty) {
    const payload = item.payload;
    const viewport = stage.viewport;
    const itemRandom = new Random(stage.seed).fork(`${item.id}:${payload.spawn?.seedOffset ?? 0}`);
    const formation = FormationApi.normalize(payload.formation, payload.spawn?.count);
    const entry = EntryApi.normalize(payload.entry);
    const movement = BehaviorApi.normalizeMovement(payload.movement);
    if (movement.presetId === 'custom-path') movement.path = PathApi.normalize(movement.path);
    const weapon = compileWeapon(payload.weapon, difficulty);
    const pathStart = movement.presetId === 'custom-path' ? movement.path?.[0] : null;
    const resolvedEntry = EntryApi.resolve(entry, viewport);
    const baseY = pathStart ? pathStart.y * viewport.height : resolvedEntry.y;
    const baseX = pathStart ? pathStart.x * viewport.width : resolvedEntry.x;
    const nextPathPoint = pathStart ? movement.path?.[1] : null;
    const pathDeltaX = nextPathPoint ? (nextPathPoint.x - pathStart.x) * viewport.width : 0;
    const pathDeltaY = nextPathPoint ? (nextPathPoint.y - pathStart.y) * viewport.height : 0;
    const pathLength = Math.hypot(pathDeltaX, pathDeltaY);
    const directionX = pathLength > 0 ? Math.sign(pathDeltaX) : resolvedEntry.directionX;
    const directionY = pathLength > 0 ? Math.sign(pathDeltaY) : resolvedEntry.directionY;
    const formationDirectionX = pathLength > 0 ? pathDeltaX / pathLength : resolvedEntry.directionX;
    const formationDirectionY = pathLength > 0 ? pathDeltaY / pathLength : resolvedEntry.directionY;
    const events = [];
    let count = Math.round(payload.spawn?.count ?? 1);
    let interval = clamp(payload.spawn?.interval ?? 0, 0, 30);
    let phase = itemRandom.range(0, Math.PI * 2);

    const makeEnemy = (index, at, x, y, extra = {}) => {
      const hpScale = payload.enemy.kind === 'big' ? difficulty.bigHp : 1;
      events.push({
        id: `${item.id}-e${String(index + 1).padStart(3, '0')}`,
        itemId: item.id,
        type: 'spawn-enemy',
        at,
        enemy: {
          kind: payload.enemy.kind,
          hp: Math.round(payload.enemy.hp * hpScale),
          maxHp: Math.round(payload.enemy.hp * hpScale),
          speed: payload.enemy.speed,
          x,
          y,
          directionX,
          directionY,
          phase,
          movement: clone(movement),
          weapon: clone(weapon),
          ...extra,
        },
      });
    };

    if (formation.presetId === 'wall-gap') {
      const params = formation.params;
      const range = params.gapStartRange;
      const gapStart = itemRandom.int(
        range[0],
        range[1],
      );
      const resolved = FormationApi.layout(formation, count, {
        baseX, baseY, width: viewport.width, height: viewport.height, gapStart,
        directionX: formationDirectionX, directionY: formationDirectionY,
      });
      for (const [index, point] of resolved.points.entries()) {
        makeEnemy(index, item.timing.start, point.x, point.y, { wallSlot: point.wallSlot });
      }
      count = resolved.resolvedCount;
      interval = 0;
    } else if (formation.presetId === 'v') {
      const resolved = FormationApi.layout(formation, count, {
        baseX, baseY, width: viewport.width, height: viewport.height,
        directionX: formationDirectionX, directionY: formationDirectionY,
      });
      for (const [index, point] of resolved.points.entries()) {
        makeEnemy(index, item.timing.start, point.x, point.y, {
          targetXOffset: point.targetXOffset,
          targetYOffset: point.targetYOffset,
        });
      }
    } else {
      for (let index = 0; index < count; index++) {
        makeEnemy(index, item.timing.start + index * interval, baseX, baseY);
      }
    }
    return { item, events, resolvedCount: count };
  }

  function eventPriority(event) {
    return { 'item-start': 0, 'spawn-enemy': 1, cue: 2, boss: 3, 'item-end': 4 }[event.type] ?? 9;
  }

  function compile(rawStage, options = {}) {
    const sourceReport = validate(rawStage);
    if (sourceReport.errors.length && options.allowInvalid !== true) {
      const error = new Error(`Stage JSON 검증 실패: ${sourceReport.errors.join(' / ')}`);
      error.validation = sourceReport;
      throw error;
    }
    const stage = clone(rawStage);
    const difficulty = Registry.difficulty(options.difficulty ?? 'easy');
    stage.items = stableSort(stage.items || [])
      .map(sourceItem => resolveDifficulty(sourceItem, difficulty))
      .filter(item => item && item.enabled !== false);
    const resolvedReport = validate(stage);
    const report = {
      errors: [...new Set([...sourceReport.errors, ...resolvedReport.errors])],
      warnings: [...new Set([...sourceReport.warnings, ...resolvedReport.warnings])],
    };
    if (report.errors.length && options.allowInvalid !== true) {
      const error = new Error(`난이도 적용 후 Stage JSON 검증 실패: ${report.errors.join(' / ')}`);
      error.validation = report;
      throw error;
    }
    const items = [];
    const events = [];
    let resolvedEnemyCount = 0;
    for (const item of stage.items) {
      if (item.type === 'wave') {
        const wave = compileWave(item, stage, difficulty);
        items.push({ ...item, resolvedCount: wave.resolvedCount });
        events.push(...wave.events);
        resolvedEnemyCount += wave.resolvedCount;
        continue;
      }
      items.push(item);
      const at = item.timing.start;
      if (item.type === 'cue') events.push({ id: `${item.id}-start`, itemId: item.id, type: 'cue', at, payload: clone(item.payload) });
      else if (item.type === 'boss') events.push({ id: `${item.id}-start`, itemId: item.id, type: 'boss', at, payload: clone(item.payload) });
      else {
        events.push({ id: `${item.id}-start`, itemId: item.id, type: 'item-start', at, itemType: item.type, payload: clone(item.payload) });
        if (item.timing.duration > 0) {
          events.push({ id: `${item.id}-end`, itemId: item.id, type: 'item-end', at: at + item.timing.duration, itemType: item.type, payload: clone(item.payload) });
        }
      }
    }
    events.sort((a, b) => (a.at - b.at) || (eventPriority(a) - eventPriority(b)) || a.id.localeCompare(b.id));
    const normalized = {
      metadata: {
        id: stage.id,
        name: stage.name,
        seed: stage.seed,
        schemaVersion: stage.schemaVersion,
        registryVersion: stage.registryVersion,
        draft: !!stage.draft,
      },
      timeline: clone(stage.timeline),
      viewport: clone(stage.viewport),
      background: clone(stage.background),
      sections: clone(stage.sections || []),
      dependencies: clone(stage.dependencies),
      difficulty,
      items,
      events,
      resolvedEnemyCount,
      validation: report,
    };
    normalized.compileHash = hashString(JSON.stringify(normalized));
    return normalized;
  }

  const api = Object.freeze({
    REQUIRED_DEPENDENCIES,
    clone,
    deepMerge,
    stableSort,
    validate,
    resolveDifficulty,
    compile,
  });
  root.StageCompiler = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
