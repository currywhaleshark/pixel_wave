// Opt-in adapter from compiled Stage JSON events to the existing game entities.
(function initStageGameAdapter(root) {
  'use strict';

  const Compiler = root.StageCompiler || (typeof require === 'function' ? require('./compiler.js') : null);
  const DATA = root.STAGE_DATA_REGISTRY || (typeof STAGE_DATA_REGISTRY !== 'undefined' ? STAGE_DATA_REGISTRY : {});
  const TEST_STORAGE_KEY = 'pixel-wave-stage-test-payload';
  const CONFIG = Object.freeze({
    defaultMode: 'legacy',
    optInStageIds: Object.freeze(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']),
  });

  function query(search = root.location?.search || '') {
    return new URLSearchParams(search);
  }

  function requestedMode(search) {
    const params = query(search);
    return params.has('debug') && params.get('stageRuntime') === 'data' ? 'data' : CONFIG.defaultMode;
  }

  function difficultyId(index) {
    return ['easy', 'normal', 'hard'][Math.max(0, Math.min(2, Number(index) || 0))];
  }

  function testPayload(stageId, search) {
    const params = query(search);
    if (!params.has('debug') || params.get('stageTest') !== '1') return null;
    try {
      const text = root.sessionStorage?.getItem(TEST_STORAGE_KEY);
      const payload = text ? JSON.parse(text) : null;
      if (payload?.format !== 'pixel-wave-stage-test' || payload.schemaVersion !== 1 || payload.stage?.id !== stageId) return null;
      const report = Compiler.validate(payload.stage);
      return report.errors.length ? null : payload;
    } catch (_error) { return null; }
  }

  function compile(stageId, difficulty, sourceOverride = null) {
    const source = sourceOverride || DATA[stageId];
    return source ? Compiler.compile(source, { difficulty: difficultyId(difficulty) }) : null;
  }

  function legacyResolvedCount(entry) {
    if (!entry || entry.warning || entry.boss || entry.ride) return 0;
    if (entry.F === 4) return Math.max(0, Number(entry.n || 0) - 1);
    return Math.max(0, Number(entry.n || 0));
  }

  function parityReport(stageId, legacyTimeline, difficulty = 0, sourceOverride = null) {
    const compiled = compile(stageId, difficulty, sourceOverride);
    if (!compiled) return { ok: false, errors: [`${stageId} 데이터가 없습니다.`], summary: {} };
    const legacyWaves = (legacyTimeline || []).filter(entry => (
      !entry.warning && !entry.boss && !entry.ride && entry.bolt === undefined && entry.kind !== 'wreck'
    ));
    const dataWaves = compiled.items.filter(item => item.type === 'wave');
    const errors = [];
    if (legacyWaves.length !== dataWaves.length) errors.push(`웨이브 수 ${legacyWaves.length}/${dataWaves.length}`);
    const count = Math.min(legacyWaves.length, dataWaves.length);
    for (let index = 0; index < count; index++) {
      const legacy = legacyWaves[index];
      const data = dataWaves[index];
      if (Math.abs(Number(legacy.t) - data.timing.start) > 0.011) errors.push(`${data.id} 시작 ${legacy.t}/${data.timing.start}`);
      if (legacyResolvedCount(legacy) !== data.resolvedCount) errors.push(`${data.id} 마릿수 ${legacyResolvedCount(legacy)}/${data.resolvedCount}`);
    }
    const legacyRide = (legacyTimeline || []).find(entry => entry.ride);
    const dataRide = compiled.items.find(item => item.payload?.pluginId === 'turtle-ride');
    if (!!legacyRide !== !!dataRide || (legacyRide && (legacyRide.t !== dataRide.timing.start || legacyRide.ride !== dataRide.timing.duration))) errors.push('거북 택시 시간이 다릅니다.');
    const legacyWrecks = (legacyTimeline || []).filter(entry => entry.kind === 'wreck');
    const dataWrecks = compiled.items.filter(item => item.payload?.pluginId === 'wreck-corridor');
    if (legacyWrecks.length !== dataWrecks.length) errors.push(`난파선 수 ${legacyWrecks.length}/${dataWrecks.length}`);
    for (let index = 0; index < Math.min(legacyWrecks.length, dataWrecks.length); index++) {
      if (Math.abs(legacyWrecks[index].t - dataWrecks[index].timing.start) > 0.011) errors.push(`난파선 ${index + 1} 시작 시간이 다릅니다.`);
    }
    const legacyBolts = (legacyTimeline || []).filter(entry => entry.bolt !== undefined);
    const dataBolts = compiled.items.filter(item => item.payload?.pluginId === 'lightning-strike');
    if (legacyBolts.length !== dataBolts.length) errors.push(`번개 수 ${legacyBolts.length}/${dataBolts.length}`);
    for (let index = 0; index < Math.min(legacyBolts.length, dataBolts.length); index++) {
      if (Math.abs(legacyBolts[index].t - dataBolts[index].timing.start) > 0.011
        || Math.abs(legacyBolts[index].bolt - dataBolts[index].payload.params.xRatio) > 0.001) errors.push(`번개 ${index + 1} 값이 다릅니다.`);
    }
    const legacyWarning = (legacyTimeline || []).find(entry => entry.warning)?.t;
    const dataWarning = compiled.items.find(item => item.payload?.pluginId === 'boss-warning')?.timing.start;
    const legacyBoss = (legacyTimeline || []).find(entry => entry.boss)?.t;
    const dataBoss = compiled.items.find(item => item.type === 'boss')?.timing.start;
    if (legacyWarning !== dataWarning) errors.push(`보스 경고 ${legacyWarning}/${dataWarning}`);
    if (legacyBoss !== dataBoss) errors.push(`보스 시작 ${legacyBoss}/${dataBoss}`);
    return {
      ok: errors.length === 0,
      errors,
      summary: {
        stageId, difficulty: difficultyId(difficulty), waves: dataWaves.length,
        enemies: compiled.resolvedEnemyCount, wrecks: dataWrecks.length, bolts: dataBolts.length,
        warningAt: dataWarning, bossAt: dataBoss,
      },
    };
  }

  function movementCode(movement) {
    return {
      straight: 1, sine: 2, 'enter-pause-exit': 3, 'u-turn': 4,
      tracking: 5, 'turret-scroll': 6, 'current-surf': 7,
    }[movement?.presetId] || 1;
  }

  function weaponCode(weapon) {
    return {
      none: 0, 'legacy-aimed': 1, 'legacy-ring': 2, 'legacy-drop': 3,
      'legacy-mine': 4, 'legacy-death-shot': 5,
    }[weapon?.presetId] || 0;
  }

  class GameSpawner {
    constructor(compiled, game, options = {}) {
      this.compiled = compiled;
      this.game = game;
      this.events = compiled.events.slice();
      this.idx = 0;
      this.pending = [];
      this.groupIds = new Map();
      this.nextGroupId = 1;
      this.range = options.range || null;
      this.testMode = !!options.testMode;
      this.returnUrl = options.returnUrl || null;
      this.sourceHash = options.sourceHash || null;
      this.rangeStopped = false;
      this.timeline = compiled.items.map(item => ({
        t: item.timing.domain === 'time' ? item.timing.start : item.projectedTime || compiled.timeline.duration,
        warning: item.payload?.pluginId === 'boss-warning' || undefined,
        boss: item.type === 'boss' || undefined,
      })).sort((left, right) => left.t - right.t);
    }

    _group(itemId) {
      if (!this.groupIds.has(itemId)) {
        const id = this.nextGroupId++;
        const total = this.events.filter(event => event.type === 'spawn-enemy' && event.itemId === itemId).length;
        this.groupIds.set(itemId, id);
        this.game.groups[id] = { total, killed: 0, escaped: 0, isFormation: total > 1 };
      }
      return this.groupIds.get(itemId);
    }

    _spawn(event) {
      const enemy = event.enemy;
      const movement = enemy.movement || { presetId: 'straight', params: {} };
      const weapon = enemy.weapon || { presetId: 'none', params: {} };
      let spawnX = enemy.x;
      let spawnY = enemy.y;
      let directionX = enemy.directionX;
      let directionY = enemy.directionY;
      if (Number.isFinite(enemy.surroundAngle) && Number.isFinite(enemy.surroundRadius)) {
        const center = this.game.player;
        spawnX = Math.min(center.x + Math.cos(enemy.surroundAngle) * enemy.surroundRadius, this.compiled.viewport.width + 90);
        spawnY = Math.max(-70, Math.min(this.compiled.viewport.height + 70, center.y + Math.sin(enemy.surroundAngle) * enemy.surroundRadius));
        const length = Math.hypot(center.x - spawnX, center.y - spawnY) || 1;
        directionX = (center.x - spawnX) / length;
        directionY = (center.y - spawnY) / length;
      }
      const spec = {
        kind: enemy.kind, hp: enemy.hp, spd: enemy.speed,
        x: spawnX, y: spawnY, dirX: directionX, dirY: directionY,
        phase: enemy.phase, M: movementCode(movement), S: weaponCode(weapon),
        amp: movement.params?.amplitude || 0, freq: movement.params?.frequency || 3,
        targetX: enemy.targetXOffset !== undefined
          ? (movement.params?.targetX ?? 0.68) * this.compiled.viewport.width + enemy.targetXOffset
          : (movement.params?.targetX ?? 0.68) * this.compiled.viewport.width,
        pauseDur: movement.params?.pauseDuration,
        fireInt: weapon.interval,
        ringN: weapon.params?.count,
        fireDelay: weapon.startDelay,
        barragePatternId: weapon.patternId || null,
        barragePattern: weapon.pattern || null,
        barrageStopWhenLeaving: weapon.stopWhenLeaving !== false,
        groupId: this._group(event.itemId),
      };
      this.game.enemies.push(new Enemy(spec));
    }

    _spawnWreck(event) {
      const params = event.payload?.params || {};
      const height = (params.heightFraction ?? 0.4) * this.compiled.viewport.height;
      const side = params.side === 'top' ? 'top' : 'bot';
      const groupId = this._group(event.itemId);
      this.game.groups[groupId].total = 1;
      this.game.groups[groupId].isFormation = false;
      this.game.enemies.push(new Enemy({
        kind: 'wreck', x: this.compiled.viewport.width + 60,
        y: side === 'top' ? height / 2 : this.compiled.viewport.height - height / 2,
        hp: 999999, spd: params.speed ?? 100, M: 1, S: 0,
        dirX: -1, dirY: 0, wreckW: params.width ?? 74, wreckH: height, side, groupId,
      }));
    }

    _apply(event) {
      if (event.type === 'spawn-enemy') this._spawn(event);
      else if (event.type === 'cue' && event.payload?.pluginId === 'boss-warning') this.game.startBossWarning();
      else if (event.type === 'boss') this.game.startBoss();
      else if (event.type === 'item-start' && event.payload?.pluginId === 'turtle-ride') {
        const item = this.compiled.items.find(candidate => candidate.id === event.itemId);
        this.game.startRide(item?.timing?.duration || 0);
      }
      else if (event.type === 'item-start' && event.payload?.pluginId === 'wreck-corridor') this._spawnWreck(event);
      else if (event.type === 'item-start' && event.payload?.pluginId === 'lightning-strike') this.game.spawnBolt(event.payload.params?.xRatio ?? 0.5);
    }

    seekRange(start) {
      const at = Math.max(0, Number(start) || 0);
      this.idx = this.events.findIndex(event => event.at >= at);
      if (this.idx < 0) this.idx = this.events.length;
      const ride = this.compiled.items.find(item => item.payload?.pluginId === 'turtle-ride'
        && item.timing.start < at && item.timing.start + item.timing.duration > at);
      if (ride) this.game.startRide(ride.timing.start + ride.timing.duration - at);
    }

    update(time) {
      while (this.idx < this.events.length && this.events[this.idx].at <= time) this._apply(this.events[this.idx++]);
      if (this.range && time >= this.range.end && !this.rangeStopped) {
        this.rangeStopped = true;
        if (this.testMode && typeof this.game.finishStageTest === 'function') this.game.finishStageTest('range');
        else {
          this.game.paused = true;
          this.game.message(`[DATA TEST] ${this.range.start.toFixed(1)}–${this.range.end.toFixed(1)}초 완료`, '#7dffd8');
        }
      }
    }

    done() { return this.idx >= this.events.length; }
  }

  function rangeFromSearch(search) {
    const value = query(search).get('stageRange');
    if (!value) return null;
    const [start, end] = value.split(',').map(Number);
    return Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start ? { start, end } : null;
  }

  function createSpawner(stageId, difficulty, game, legacyTimeline, search) {
    if (requestedMode(search) !== 'data') return null;
    const payload = testPayload(stageId, search);
    if (!payload && !CONFIG.optInStageIds.includes(stageId)) return null;
    const compiled = compile(stageId, difficulty, payload?.stage || null);
    if (!compiled) return null;
    const params = query(search);
    const range = rangeFromSearch(search);
    const spawner = new GameSpawner(compiled, game, {
      range,
      testMode: !!payload,
      returnUrl: payload ? params.get('returnTo') : null,
      sourceHash: payload?.stageHash || null,
    });
    spawner.parity = parityReport(stageId, legacyTimeline, difficulty, payload?.stage || null);
    return spawner;
  }

  const api = Object.freeze({ CONFIG, TEST_STORAGE_KEY, requestedMode, difficultyId, testPayload, compile, parityReport, GameSpawner, rangeFromSearch, createSpawner });
  root.StageGameAdapter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
