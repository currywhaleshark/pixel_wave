// ============================================================
// stage/simulation.js — Stage Sequencer M1 결정론 미리보기 시뮬레이션
// 고정 스텝, snapshot/restore, 구간 seek를 제공한다.
// ============================================================
(function initStageSimulation(root) {
  'use strict';

  const RandomApi = root.StageRandom || (typeof require === 'function' ? require('./random.js') : null);
  const PathApi = root.StagePath || (typeof require === 'function' ? require('./path.js') : null);
  const BehaviorApi = root.StageBehavior || (typeof require === 'function' ? require('./behavior.js') : null);
  const BarrageApi = root.StageBarrage || (typeof require === 'function' ? require('./barrage.js') : null);
  const BudgetApi = root.StageBudget || (typeof require === 'function' ? require('./budget.js') : null);
  const PluginApi = root.StagePlugin || (typeof require === 'function' ? require('./plugin.js') : null);
  const TerrainApi = root.StageTerrain || (typeof require === 'function' ? require('./terrain.js') : null);
  const { Random, hashString, mixSeed } = RandomApi;
  const EPS = 1e-9;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function round(value, places = 5) {
    const scale = 10 ** places;
    return Math.round(value * scale) / scale;
  }

  class Simulation {
    constructor(compiled, options = {}) {
      this.compiled = compiled;
      this.fixedStep = options.fixedStep || 1 / 60;
      this.snapshotInterval = options.snapshotInterval || 5;
      this.snapshotCache = new Map();
      this.itemById = new Map(compiled.items.map(item => [item.id, item]));
      this.budgetLimits = BudgetApi.normalizeLimits(options.budgetLimits);
      this.budgetAnalysis = null;
      this.terrainProfile = options.terrainProfile || null;
      this.reset();
    }

    reset() {
      const { width, height } = this.compiled.viewport;
      this.time = 0;
      this.scroll = 0;
      this.pendingDuration = 0;
      this.eventCursor = 0;
      this.random = new Random(mixSeed(this.compiled.metadata.seed, `simulation:${this.compiled.difficulty.id}`));
      this.player = { x: width * 0.2, y: height * 0.5, invulnerable: false };
      this.enemies = [];
      this.bullets = [];
      this.barrageRunners = new Map();
      this.pearls = [];
      this.activeItems = new Map();
      this.messages = [];
      this.ride = null;
      this.boss = null;
      this.warningUntil = 0;
      this.pluginState = PluginApi.initialRuntimeState();
      this.terrainObjects = TerrainApi.resolveObjects(this.compiled.items, this.terrainProfile, this.scroll);
      this.spawnedEnemyCount = 0;
      this.firedBulletCount = 0;
      this.budgetTracker = new BudgetApi.Tracker(this.budgetLimits);
      this._processEventsAtCurrentTime();
      this.pluginState = PluginApi.evaluateRuntimeState(this.pluginState, this.activeItems, this.time, 0, this.compiled.viewport);
      this.terrainObjects = TerrainApi.resolveObjects(this.compiled.items, this.terrainProfile, this.scroll);
      this.budgetTracker.observe(this.time, { enemies: this.enemies.length, projectiles: this.bullets.length });
      return this;
    }

    _processEventsAtCurrentTime() {
      const events = this.compiled.events;
      while (this.eventCursor < events.length && events[this.eventCursor].at <= this.time + EPS) {
        this._applyEvent(events[this.eventCursor++]);
      }
    }

    _applyEvent(event) {
      if (event.type === 'spawn-enemy') {
        const source = clone(event.enemy);
        if (source.movement?.presetId === 'u-turn') {
          source.movement = BehaviorApi.effectiveMovement(source.movement);
        }
        const movementParams = source.movement?.params || {};
        source.id = event.id;
        source.itemId = event.itemId;
        source.age = 0;
        source.y0 = source.y;
        source.x0 = source.x;
        source.state = 'enter';
        source.pauseRemaining = 0;
        source.fireRemaining = source.weapon?.startDelay ?? 0.6;
        const horizontalEntry = Math.abs(source.directionX) >= Math.abs(source.directionY || 0);
        const defaultTargetX = horizontalEntry
          ? (source.directionX > 0 ? 0.32 : 0.68)
          : (source.x - (source.targetXOffset || 0)) / this.compiled.viewport.width;
        const defaultTargetY = horizontalEntry
          ? (source.y - (source.targetYOffset || 0)) / this.compiled.viewport.height
          : ((source.directionY || 0) > 0 ? 0.3 : 0.7);
        source.targetX = (movementParams.targetX ?? defaultTargetX) * this.compiled.viewport.width + (source.targetXOffset || 0);
        source.targetY = (movementParams.targetY ?? defaultTargetY) * this.compiled.viewport.height + (source.targetYOffset || 0);
        source.pauseDuration = movementParams.pauseDuration ?? 2.2;
        source.vx = null;
        source.waveOffset = 0;
        if (source.movement?.presetId === 'custom-path') {
          const first = source.movement.path?.[0];
          source.pathOffsetX = first ? source.x - first.x * this.compiled.viewport.width : 0;
          source.pathOffsetY = first ? source.y - first.y * this.compiled.viewport.height : 0;
          source.pathComplete = false;
        }
        this.enemies.push(source);
        if (source.weapon?.patternId && source.weapon?.pattern) {
          this.barrageRunners.set(source.id, this._createBarrageRunner(source));
        }
        this.spawnedEnemyCount++;
        return;
      }
      if (event.type === 'item-start') {
        this.activeItems.set(event.itemId, { start: event.at, type: event.itemType, payload: clone(event.payload) });
        if (event.payload?.pluginId === 'turtle-ride') this._startRide(event);
        return;
      }
      if (event.type === 'item-end') {
        this.activeItems.delete(event.itemId);
        if (event.payload?.pluginId === 'turtle-ride') this._endRide(event);
        return;
      }
      if (event.type === 'cue' && event.payload?.pluginId === 'boss-warning') {
        const item = this.itemById.get(event.itemId);
        this.warningUntil = event.at + (item?.timing?.duration || 0);
        this.messages.push({
          text: event.payload.params?.message || '!! 뭔가 다가온다 !!',
          color: event.payload.params?.color || '#ff8f8f',
          until: this.warningUntil,
        });
        return;
      }
      if (event.type === 'boss') {
        this.boss = {
          id: event.payload?.bossId || 'ssing',
          itemId: event.itemId,
          x: this.compiled.viewport.width * 0.81,
          y: this.compiled.viewport.height * 0.5,
          age: 0,
        };
      }
    }

    _startRide(event) {
      const params = event.payload.params || {};
      this.ride = {
        itemId: event.itemId,
        start: event.at,
        end: event.at + (this.itemById.get(event.itemId)?.timing?.duration || 0),
        params: clone(params),
        nextTrail: event.at,
        nextRing: event.at + (params.pearlRing?.firstDelay ?? 2.5),
        phase: this.random.range(0, Math.PI * 2),
      };
      if (params.bulletClearOnStart?.enabled) {
        if (params.bulletClearOnStart.convertToPearls) {
          for (const bullet of this.bullets) {
            this.pearls.push({
              x: bullet.x,
              y: bullet.y,
              vx: 0,
              vy: 0,
              life: params.bulletClearOnStart.pearlLifetime ?? 12,
              age: 0,
            });
          }
        }
        this.bullets = [];
      }
      this.player.invulnerable = !!params.playerInvulnerable;
      for (const message of params.startMessages || []) {
        this.messages.push({ text: message.text, color: message.color, until: event.at + 2.8 });
      }
    }

    _endRide(event) {
      const params = this.ride?.params || event.payload?.params || {};
      this.ride = null;
      this.player.invulnerable = false;
      if (params.endMessage?.text) {
        this.messages.push({ text: params.endMessage.text, color: params.endMessage.color, until: event.at + 2.8 });
      }
    }

    _scrollMultiplier(at) {
      let multiplier = 1;
      for (const active of this.activeItems.values()) {
        if (active.payload?.pluginId === 'scroll-speed') {
          multiplier *= PluginApi.sampleCurve(active.payload.params?.curve, at - active.start);
        }
        if (active.payload?.pluginId === 'turtle-ride') {
          multiplier *= Number(active.payload.params?.scrollMultiplier) || 1;
        }
      }
      return Math.max(0, Math.min(5, multiplier));
    }

    _spawnAimed(enemy, count, spread, speed) {
      const base = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
      for (let index = 0; index < count; index++) {
        const angle = base + (count === 1 ? 0 : (index - (count - 1) / 2) * spread);
        this.bullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, kind: 'spike', age: 0 });
        this.firedBulletCount++;
      }
    }

    _spawnRing(enemy, count, speed, offset) {
      for (let index = 0; index < count; index++) {
        const angle = offset + index / count * Math.PI * 2;
        this.bullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, kind: 'bubble', age: 0 });
        this.firedBulletCount++;
      }
    }

    _fire(enemy) {
      const weapon = enemy.weapon || { presetId: 'none' };
      const difficultyIndex = ['easy', 'normal', 'hard'].indexOf(this.compiled.difficulty.id);
      const speedScale = this.compiled.difficulty.ebSpd;
      const enemyRandom = this.random;
      if (weapon.presetId === 'legacy-aimed') {
        const count = 1 + difficultyIndex;
        this._spawnAimed(enemy, count, difficultyIndex > 0 ? 0.18 : 0, 145 * speedScale);
      } else if (weapon.presetId === 'legacy-ring') {
        this._spawnRing(enemy, weapon.params?.count || 8, 110 * 0.9 * speedScale, enemyRandom.range(0, Math.PI * 2));
        if (difficultyIndex >= 1) this._spawnAimed(enemy, 1, 0, 145 * 0.95 * speedScale);
        if (difficultyIndex >= 2) {
          for (let index = 0; index < 3; index++) {
            const angle = enemyRandom.range(0, Math.PI * 2);
            const speed = enemyRandom.range(70, 150) * speedScale;
            this.bullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius: 5, kind: 'bubble', age: 0 });
            this.firedBulletCount++;
          }
        }
      } else if (weapon.presetId === 'legacy-drop') {
        const count = 1 + difficultyIndex;
        for (let index = 0; index < count; index++) {
          const vx = count === 1 ? -20 : (index - (count - 1) / 2) * 55;
          this.bullets.push({ x: enemy.x, y: enemy.y + 8, vx, vy: 125 * speedScale, radius: 5, kind: 'drop', age: 0 });
          this.firedBulletCount++;
        }
      } else if (weapon.presetId === 'legacy-mine') {
        this.bullets.push({ x: enemy.x, y: enemy.y + 8, vx: -8, vy: 14, radius: 7, kind: 'mine', age: 0, timer: 1.8 });
        this.firedBulletCount++;
      }
    }

    _spawnBarrageProjectile(projectile, patternId) {
      this.bullets.push({
        ...projectile,
        age: projectile.barrage?.age || 0,
        radius: projectile.r ?? 5,
        patternId,
      });
      this.firedBulletCount++;
    }

    _createBarrageRunner(enemy, state = null) {
      const runner = new BarrageApi.Runtime.Runner(enemy.weapon.pattern, {
        emit: projectile => this._spawnBarrageProjectile(projectile, enemy.weapon.patternId),
      });
      if (state) {
        runner.time = state.time;
        runner.cursor = state.cursor;
        runner.loops = state.loops;
        runner.finished = state.finished;
        runner.started = state.started;
      }
      return runner;
    }

    _updateEnemy(enemy, dt) {
      enemy.age += dt;
      const movement = enemy.movement?.presetId || 'straight';
      const params = enemy.movement?.params || {};
      const directionX = Number(enemy.directionX) || 0;
      const directionY = Number(enemy.directionY) || 0;
      const directionLength = Math.hypot(directionX, directionY) || 1;
      const sideX = directionY / directionLength;
      const sideY = -directionX / directionLength;
      if (movement === 'straight') {
        enemy.x += directionX * enemy.speed * dt;
        enemy.y += directionY * enemy.speed * dt;
      } else if (movement === 'sine') {
        const waveOffset = (params.amplitude || 0) * Math.sin(enemy.age * (params.frequency ?? 3) + enemy.phase);
        if (directionY === 0) {
          enemy.x += directionX * enemy.speed * dt;
          enemy.y = enemy.y0 + sideY * waveOffset;
        } else {
          const waveDelta = waveOffset - enemy.waveOffset;
          enemy.x += directionX * enemy.speed * dt + sideX * waveDelta;
          enemy.y += directionY * enemy.speed * dt + sideY * waveDelta;
        }
        enemy.waveOffset = waveOffset;
      } else if (movement === 'u-turn') {
        if (enemy.vx === null) enemy.vx = -enemy.speed;
        enemy.vx = Math.min(enemy.speed * params.maxSpeedMultiplier, enemy.vx + enemy.speed * params.acceleration * dt);
        enemy.x += enemy.vx * dt;
        enemy.y = enemy.y0 + Math.sin(enemy.age * params.verticalFrequency) * params.verticalAmplitude;
      } else if (movement === 'enter-pause-exit') {
        if (enemy.state === 'enter') {
          enemy.x += directionX * enemy.speed * dt;
          enemy.y += directionY * enemy.speed * dt;
          const remaining = (enemy.targetX - enemy.x) * directionX + (enemy.targetY - enemy.y) * directionY;
          if (remaining <= 0) {
            enemy.x = enemy.targetX;
            enemy.y = enemy.targetY;
            enemy.state = 'pause';
            enemy.pauseRemaining = enemy.pauseDuration;
          }
        } else if (enemy.state === 'pause') {
          enemy.pauseRemaining -= dt;
          const wobble = Math.sin(enemy.age * 2) * 6;
          enemy.x = enemy.targetX + sideX * wobble;
          enemy.y = enemy.targetY + sideY * wobble;
          if (enemy.pauseRemaining <= 0) enemy.state = 'exit';
        } else {
          const exitMultiplier = params.exitMultiplier ?? 1.7;
          enemy.x += directionX * enemy.speed * exitMultiplier * dt;
          enemy.y += directionY * enemy.speed * exitMultiplier * dt;
        }
      } else if (movement === 'tracking') {
        if (enemy.vx === null) { enemy.vx = -enemy.speed; enemy.vy = 0; }
        if (enemy.age < 9) {
          const wanted = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
          const current = Math.atan2(enemy.vy, enemy.vx);
          let difference = wanted - current;
          while (difference > Math.PI) difference -= Math.PI * 2;
          while (difference < -Math.PI) difference += Math.PI * 2;
          const angle = current + Math.max(-1.1 * dt, Math.min(1.1 * dt, difference));
          enemy.vx = Math.cos(angle) * enemy.speed;
          enemy.vy = Math.sin(angle) * enemy.speed;
        }
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
      } else if (movement === 'turret-scroll') {
        enemy.x -= (this.compiled.background.baseScrollSpeed || 45) * dt;
      } else if (movement === 'current-surf') {
        const current = this.pluginState.current || { x: 0, y: 0 };
        enemy.x += (directionX * enemy.speed + current.x * 1.4) * dt;
        enemy.y = enemy.y0 + (params.amplitude || 0) * Math.sin(enemy.age * (params.frequency ?? 3) + enemy.phase) + current.y * 0.6;
      } else if (movement === 'custom-path') {
        const point = PathApi.sample(enemy.movement.path, enemy.age, this.compiled.viewport);
        if (point) {
          enemy.x = point.x + (enemy.pathOffsetX || 0);
          enemy.y = point.y + (enemy.pathOffsetY || 0);
          if (point.directionX || point.directionY) {
            enemy.directionX = point.directionX;
            enemy.directionY = point.directionY;
          }
          enemy.pathComplete = point.done;
        }
      }

      if (enemy.pathComplete) return;
      const onScreen = enemy.x > 30 && enemy.x < this.compiled.viewport.width - 10;
      const canFire = movement !== 'enter-pause-exit' || enemy.state === 'pause';
      if (enemy.weapon?.patternId) {
        const runner = this.barrageRunners.get(enemy.id);
        const canContinueOffScreen = enemy.weapon.stopWhenLeaving === false && runner?.started;
        if (runner && canFire && (onScreen || canContinueOffScreen)) {
          let activeDt = dt;
          if (enemy.fireRemaining > 0) {
            activeDt = Math.max(0, dt - enemy.fireRemaining);
            enemy.fireRemaining -= dt;
          }
          if (activeDt > 0) runner.update(activeDt, {
            source: enemy,
            target: this.player,
            difficulty: ['easy', 'normal', 'hard'].indexOf(this.compiled.difficulty.id),
          });
        }
        return;
      }
      if (enemy.weapon?.presetId !== 'none' && enemy.weapon?.presetId !== 'legacy-death-shot' && onScreen && canFire) {
        enemy.fireRemaining -= dt;
        if (enemy.fireRemaining <= 0) {
          enemy.fireRemaining += enemy.weapon.interval || 2;
          this._fire(enemy);
        }
      }
    }

    _updateRide(toTime) {
      if (!this.ride) return;
      const params = this.ride.params;
      const trail = params.pearlTrail || {};
      const ring = params.pearlRing || {};
      while (this.ride.nextTrail <= toTime + EPS) {
        const local = this.ride.nextTrail - this.ride.start;
        const y = this.compiled.viewport.height * (trail.centerY ?? 0.5)
          + Math.sin(local * (trail.frequency ?? 1.6) + this.ride.phase) * this.compiled.viewport.height * (trail.amplitudeY ?? 0.3);
        this.pearls.push({
          x: this.compiled.viewport.width + 12,
          y,
          vx: -(trail.speed ?? 330),
          vy: 0,
          life: trail.lifetime ?? 6,
          age: 0,
        });
        this.ride.nextTrail += trail.interval ?? 0.13;
      }
      while (this.ride.nextRing <= toTime + EPS) {
        const count = Math.max(1, Math.round(ring.count ?? 10));
        const yRange = ring.centerYRange || [0.3, 0.7];
        const centerY = this.random.range(yRange[0], yRange[1]) * this.compiled.viewport.height;
        for (let index = 0; index < count; index++) {
          const angle = index / count * Math.PI * 2;
          this.pearls.push({
            x: this.compiled.viewport.width + 40 + Math.cos(angle) * (ring.radius ?? 55),
            y: centerY + Math.sin(angle) * (ring.radius ?? 55),
            vx: -(ring.speed ?? 330),
            vy: 0,
            life: ring.lifetime ?? 6,
            age: 0,
          });
        }
        this.ride.nextRing += ring.interval ?? 4.5;
      }
    }

    _updateState(dt, fromTime, toTime) {
      const middle = fromTime + dt * 0.5;
      const midpointPluginState = PluginApi.evaluateRuntimeState(this.pluginState, this.activeItems, middle, 0, this.compiled.viewport);
      this.scroll += (this.compiled.background.baseScrollSpeed || 0) * midpointPluginState.scrollMultiplier * dt;
      this.player.x += midpointPluginState.current.x * midpointPluginState.influence.player.x * dt;
      this.player.y += midpointPluginState.current.y * midpointPluginState.influence.player.y * dt;
      this.player.x = Math.max(0, Math.min(this.compiled.viewport.width, this.player.x));
      this.player.y = Math.max(0, Math.min(this.compiled.viewport.height, this.player.y));
      this.player.invulnerable = midpointPluginState.playerInvulnerable;
      this._updateRide(toTime);
      for (const enemy of this.enemies) this._updateEnemy(enemy, dt);
      const { width, height } = this.compiled.viewport;
      this.enemies = this.enemies.filter(enemy => !enemy.pathComplete && enemy.x > -60 && enemy.x < width + 120 && enemy.y > -80 && enemy.y < height + 80);
      const liveEnemyIds = new Set(this.enemies.map(enemy => enemy.id));
      for (const id of this.barrageRunners.keys()) if (!liveEnemyIds.has(id)) this.barrageRunners.delete(id);
      const spawnedProjectiles = [];
      for (const bullet of this.bullets) {
        bullet.x += midpointPluginState.current.x * midpointPluginState.influence.enemyProjectile.x * dt;
        bullet.y += midpointPluginState.current.y * midpointPluginState.influence.enemyProjectile.y * dt;
        if (bullet.barrage) {
          BarrageApi.Runtime.updateProjectile(bullet, dt, {
            target: this.player,
            spawn: projectile => spawnedProjectiles.push({
              ...projectile,
              age: projectile.barrage?.age || 0,
              radius: projectile.r ?? 5,
              patternId: bullet.patternId,
            }),
            spawnBudget: { remaining: 256 },
            maxDepth: 2,
          });
          bullet.age = bullet.barrage.age;
        } else {
          bullet.age += dt;
          bullet.x += bullet.vx * dt;
          bullet.y += bullet.vy * dt;
          if (bullet.kind === 'mine' && Number.isFinite(bullet.timer)) {
            bullet.timer -= dt;
            if (bullet.timer <= 0) {
              bullet.dead = true;
              const count = 6 + ['easy', 'normal', 'hard'].indexOf(this.compiled.difficulty.id);
              for (let index = 0; index < count; index++) {
                const angle = index / count * Math.PI * 2;
                spawnedProjectiles.push({
                  x: bullet.x, y: bullet.y,
                  vx: Math.cos(angle) * 95, vy: Math.sin(angle) * 95,
                  radius: 5, kind: 'bubble', age: 0,
                });
              }
            }
          }
        }
      }
      this.firedBulletCount += spawnedProjectiles.length;
      this.bullets.push(...spawnedProjectiles);
      this.bullets = this.bullets.filter(bullet => !bullet.dead && bullet.x > -40 && bullet.x < width + 480 && bullet.y > -80 && bullet.y < height + 80);
      for (const pearl of this.pearls) {
        pearl.age += dt;
        pearl.x += pearl.vx * dt;
        pearl.y += pearl.vy * dt;
      }
      this.pearls = this.pearls.filter(pearl => pearl.age < pearl.life && pearl.x > -40 && pearl.x < width + 100);
      this.messages = this.messages.filter(message => message.until > toTime);
      if (this.boss) this.boss.age += dt;
      this.pluginState = PluginApi.evaluateRuntimeState(this.pluginState, this.activeItems, toTime, dt, this.compiled.viewport);
      this.terrainObjects = TerrainApi.resolveObjects(this.compiled.items, this.terrainProfile, this.scroll);
    }

    _stepTo(targetTime) {
      const events = this.compiled.events;
      while (this.time < targetTime - EPS) {
        const nextEventTime = this.eventCursor < events.length ? events[this.eventCursor].at : Infinity;
        const segmentEnd = Math.min(targetTime, nextEventTime);
        if (segmentEnd > this.time + EPS) {
          const from = this.time;
          const dt = segmentEnd - from;
          this._updateState(dt, from, segmentEnd);
          this.time = segmentEnd;
        } else {
          this.time = Math.min(targetTime, nextEventTime);
        }
        this._processEventsAtCurrentTime();
      }
      if (Math.abs(this.time - targetTime) <= EPS) {
        this.time = targetTime;
        this._processEventsAtCurrentTime();
      }
      this.budgetTracker.observe(this.time, { enemies: this.enemies.length, projectiles: this.bullets.length });
    }

    _advanceExactTo(targetTime) {
      const target = Math.max(this.time, Math.min(this.compiled.timeline.duration, targetTime));
      while (this.time + this.fixedStep < target - EPS) this._stepTo(this.time + this.fixedStep);
      if (this.time < target - EPS) this._stepTo(target);
      this.pendingDuration = 0;
    }

    advance(duration) {
      const requested = Math.max(0, Number(duration) || 0);
      const remaining = Math.max(0, this.compiled.timeline.duration - this.time - this.pendingDuration);
      this.pendingDuration += Math.min(requested, remaining);
      while (this.pendingDuration + EPS >= this.fixedStep && this.time < this.compiled.timeline.duration - EPS) {
        const target = Math.min(this.compiled.timeline.duration, this.time + this.fixedStep);
        const step = target - this.time;
        this._stepTo(target);
        this.pendingDuration = Math.max(0, this.pendingDuration - step);
      }
      if (this.time >= this.compiled.timeline.duration - EPS) this.pendingDuration = 0;
      return this;
    }

    createSnapshot() {
      return clone({
        time: this.time,
        scroll: this.scroll,
        pendingDuration: this.pendingDuration,
        eventCursor: this.eventCursor,
        random: this.random.snapshot(),
        player: this.player,
        enemies: this.enemies,
        bullets: this.bullets,
        barrageRunners: [...this.barrageRunners.entries()].map(([id, runner]) => [id, {
          time: runner.time,
          cursor: runner.cursor,
          loops: runner.loops,
          finished: runner.finished,
          started: runner.started,
        }]),
        pearls: this.pearls,
        activeItems: [...this.activeItems.entries()],
        messages: this.messages,
        ride: this.ride,
        boss: this.boss,
        warningUntil: this.warningUntil,
        pluginState: this.pluginState,
        terrainObjects: this.terrainObjects,
        spawnedEnemyCount: this.spawnedEnemyCount,
        firedBulletCount: this.firedBulletCount,
        budget: this.budgetTracker.snapshot(),
      });
    }

    restore(snapshot) {
      const state = clone(snapshot);
      this.time = state.time;
      this.scroll = state.scroll;
      this.pendingDuration = state.pendingDuration || 0;
      this.eventCursor = state.eventCursor;
      this.random = new Random(1).restore(state.random);
      this.player = state.player;
      this.enemies = state.enemies;
      this.bullets = state.bullets;
      this.barrageRunners = new Map();
      for (const [id, runnerState] of state.barrageRunners || []) {
        const enemy = this.enemies.find(item => item.id === id);
        if (enemy?.weapon?.pattern) this.barrageRunners.set(id, this._createBarrageRunner(enemy, runnerState));
      }
      this.pearls = state.pearls;
      this.activeItems = new Map(state.activeItems);
      this.messages = state.messages;
      this.ride = state.ride;
      this.boss = state.boss;
      this.warningUntil = state.warningUntil;
      this.pluginState = state.pluginState || PluginApi.evaluateRuntimeState(
        PluginApi.initialRuntimeState(), this.activeItems, this.time, 0, this.compiled.viewport,
      );
      this.terrainObjects = state.terrainObjects || TerrainApi.resolveObjects(this.compiled.items, this.terrainProfile, this.scroll);
      this.spawnedEnemyCount = state.spawnedEnemyCount;
      this.firedBulletCount = state.firedBulletCount;
      this.budgetTracker = new BudgetApi.Tracker(this.budgetLimits).restore(state.budget);
      return this;
    }

    buildSnapshotCache(interval = this.snapshotInterval, options = {}) {
      this.snapshotCache.clear();
      this.reset();
      this.snapshotCache.set(0, this.createSnapshot());
      for (let at = interval; at < this.compiled.timeline.duration - EPS; at += interval) {
        this._advanceExactTo(at);
        this.snapshotCache.set(round(at, 6), this.createSnapshot());
      }
      this.reset();
      this.budgetAnalysis = options.analyzeBudget === false
        ? null
        : this.analyzeBudget(0, this.compiled.timeline.duration);
      return this.snapshotCache.size;
    }

    analyzeBudget(start = 0, end = this.compiled.timeline.duration) {
      const duration = this.compiled.timeline.duration;
      const from = Math.max(0, Math.min(duration, Number(start) || 0));
      const requestedEnd = Number(end);
      const to = Math.max(from, Math.min(duration, Number.isFinite(requestedEnd) ? requestedEnd : duration));
      const preserved = this.createSnapshot();
      this.seek(from);
      this.budgetTracker = new BudgetApi.Tracker(this.budgetLimits);
      this.budgetTracker.observe(this.time, { enemies: this.enemies.length, projectiles: this.bullets.length });
      this._advanceExactTo(to);
      const report = this.budgetTracker.report();
      report.range = { start: from, end: to };
      this.restore(preserved);
      return report;
    }

    seek(target) {
      const time = Math.max(0, Math.min(this.compiled.timeline.duration, Number(target) || 0));
      let snapshotTime = 0;
      for (const at of this.snapshotCache.keys()) {
        if (at <= time + EPS && at >= snapshotTime) snapshotTime = at;
      }
      const snapshot = this.snapshotCache.get(snapshotTime);
      if (snapshot) this.restore(snapshot);
      else this.reset();
      this._advanceExactTo(time);
      return this;
    }

    stateHash() {
      const compact = {
        time: round(this.time),
        scroll: round(this.scroll),
        pendingDuration: round(this.pendingDuration),
        eventCursor: this.eventCursor,
        enemies: this.enemies.map(enemy => [enemy.id, round(enemy.x), round(enemy.y), round(enemy.age), enemy.state, round(enemy.fireRemaining)]),
        bullets: this.bullets.map(bullet => [round(bullet.x), round(bullet.y), round(bullet.vx), round(bullet.vy), bullet.kind]),
        pearls: this.pearls.map(pearl => [round(pearl.x), round(pearl.y), round(pearl.age)]),
        activeItems: [...this.activeItems.keys()].sort(),
        ride: this.ride ? [round(this.ride.nextTrail), round(this.ride.nextRing)] : null,
        boss: this.boss ? [this.boss.id, round(this.boss.x), round(this.boss.y)] : null,
        plugin: [
          round(this.pluginState.darkness), round(this.pluginState.stormScale),
          round(this.pluginState.current.x), round(this.pluginState.current.y),
          ...this.pluginState.lightning.map(entry => [entry.itemId, entry.phase, round(entry.phaseProgress)]),
          ...this.pluginState.wrecks.map(entry => [entry.itemId, round(entry.x), round(entry.y)]),
        ],
        terrain: this.terrainObjects.map(entry => [entry.itemId, round(entry.drawX), round(entry.drawY), entry.profileX]),
        random: this.random.snapshot(),
      };
      if (this.barrageRunners.size) {
        compact.barrageRunners = [...this.barrageRunners.entries()].map(([id, runner]) => [
          id, round(runner.time), runner.cursor, runner.loops, runner.finished, runner.started,
        ]);
      }
      return hashString(JSON.stringify(compact)).toString(16).padStart(8, '0');
    }

    stats() {
      return {
        time: this.time,
        scroll: this.scroll,
        enemies: this.enemies.length,
        bullets: this.bullets.length,
        pearls: this.pearls.length,
        spawnedEnemyCount: this.spawnedEnemyCount,
        firedBulletCount: this.firedBulletCount,
        budget: this.budgetTracker.report(),
        budgetAnalysis: this.budgetAnalysis,
        pluginState: clone(this.pluginState),
        terrainObjects: clone(this.terrainObjects),
        stateHash: this.stateHash(),
      };
    }
  }

  const api = Object.freeze({ Simulation, interpolateCurve: PluginApi.sampleCurve });
  root.StageSimulation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
