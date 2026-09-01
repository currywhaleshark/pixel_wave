'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageRegistry = require('../js/stage/registry.js');
const StageBehavior = require('../js/stage/behavior.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));
const stage2Source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage2.v1.draft.json'), 'utf8'));

{
  assert.equal(StageRegistry.get('movementPresets', 'sine').name, '물결');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-ring').name, '원형탄');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-death-shot').fields.length, 0);
  assert.equal(StageRegistry.get('movementPresets', 'current-surf').name, '해류 편승');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-mine').name, '등불 기뢰');
  assert.equal(StageRegistry.get('enemyKinds', 'viper').name, '독니고기');
  assert.equal(StageRegistry.get('movementPresets', 'tracking').fields.length, 2);
}

{
  const normalized = StageBehavior.normalizeMovement({
    presetId: 'sine',
    params: { amplitude: '24', frequency: 3.5, extensionValue: 7 },
  });
  assert.deepEqual(normalized.params, { amplitude: 24, frequency: 3.5, extensionValue: 7 });
  assert.equal(StageBehavior.effectiveMovement({ presetId: 'sine' }).params.frequency, 3);
  assert.equal(StageBehavior.effectiveMovement(
    { presetId: 'enter-pause-exit' },
    { entryPresetId: 'left-to-right' },
  ).params.targetX, 0.32);
  assert.equal(StageBehavior.effectiveMovement(
    { presetId: 'enter-pause-exit' },
    { entryPresetId: 'bottom-to-top' },
  ).params.targetY, 0.7);
  assert.deepEqual(StageBehavior.validateMovement({ presetId: 'sine', params: { amplitude: 301 } }), [
    "이동 '물결'의 물결 폭 값이 올바르지 않습니다.",
  ]);
  assert.deepEqual(StageBehavior.validateWeapon({ presetId: 'legacy-ring', params: { count: 4.5 } }), [
    "무기 '원형탄'의 기본 탄 수 값이 올바르지 않습니다.",
  ]);
  assert.equal(StageBehavior.effectiveMovement({ presetId: 'tracking' }).params.trackingDuration, 9);
  assert.equal(StageBehavior.effectiveMovement({ presetId: 'tracking' }).params.turnRate, 1.1);
  assert.equal(StageBehavior.effectiveMovement({ presetId: 'u-turn' }).params.turnX, 0.93);
  assert.equal(StageBehavior.effectiveWeapon({ presetId: 'legacy-mine' }).params.fuseDuration, 2.2);
  assert.deepEqual(StageBehavior.validateWeapon({
    presetId: 'legacy-mine', params: { authoredGeometry: 1, ringCount: 4.5 },
  }), ["무기 '등불 기뢰'의 폭발 탄 수 값이 올바르지 않습니다."]);
}

{
  const expected = {
    easy: { fuseDuration: 3.8, ringCount: 5 },
    normal: { fuseDuration: 2.89, ringCount: 6 },
    hard: { fuseDuration: 2.24, ringCount: 7 },
  };
  for (const [difficulty, values] of Object.entries(expected)) {
    const compiled = StageCompiler.compile(stage2Source, { difficulty });
    const mine = compiled.events.find(event => event.itemId === 's2-w008').enemy.weapon;
    assert.ok(Math.abs(mine.params.fuseDuration - values.fuseDuration) < 1e-9);
    assert.equal(mine.params.ringCount, values.ringCount);
    assert.equal(mine.params.ringPhase, 1.57, '저작한 안전 방향은 난이도에서도 고정되어야 한다');
  }
}

{
  const compiled = StageCompiler.compile(stage2Source, { difficulty: 'easy' });
  const simulation = new Simulation(compiled, { fixedStep: 1 / 120 }).seek(16);
  let explodedMine = null;
  for (let step = 0; step < 1200; step++) {
    simulation.advance(1 / 120);
    const ring = simulation.bullets.filter(bullet => bullet.kind === 'bubble');
    if (ring.length >= 5) {
      explodedMine = ring.slice(-5);
      break;
    }
  }
  assert.equal(explodedMine?.length, 5, '첫 지뢰는 저작한 5발 링으로 폭발해야 한다');
  assert.ok(Math.abs(Math.atan2(explodedMine[0].vy, explodedMine[0].vx) - 1.57) < 0.01);
}

{
  const invalid = StageCompiler.clone(source);
  invalid.items.find(item => item.id === 's3-w001').payload.movement.params.frequency = 99;
  invalid.items.find(item => item.id === 's3-w003').payload.weapon.interval = 0;
  const report = StageCompiler.validate(invalid);
  assert.ok(report.errors.some(error => error.includes("이동 '물결'의 물결 속도")));
  assert.ok(report.errors.some(error => error.includes("무기 '조준탄'의 발사 간격")));
}

{
  const patched = StageCompiler.clone(source);
  const wave = patched.items.find(item => item.id === 's3-w003');
  wave.difficulty = {
    hard: {
      mode: 'patch',
      patch: {
        payload: {
          movement: { params: { exitMultiplier: 3 } },
          weapon: { presetId: 'legacy-ring', interval: 0.75, startDelay: 0.2, params: { count: 10 } },
        },
      },
    },
  };
  const easyEnemy = StageCompiler.compile(patched, { difficulty: 'easy' }).events.find(event => event.itemId === wave.id).enemy;
  const hardEnemy = StageCompiler.compile(patched, { difficulty: 'hard' }).events.find(event => event.itemId === wave.id).enemy;
  assert.equal(easyEnemy.movement.params.exitMultiplier, undefined);
  assert.equal(hardEnemy.movement.params.exitMultiplier, 3);
  assert.equal(hardEnemy.weapon.interval, 0.36);
  assert.equal(hardEnemy.weapon.startDelay, 0.2);
  assert.equal(hardEnemy.weapon.params.count, 14);
}

{
  const baseline = StageCompiler.compile(source, { difficulty: 'easy' });
  const changedSource = StageCompiler.clone(source);
  changedSource.items.find(item => item.id === 's3-w007').payload.movement.params = {
    acceleration: 0.2,
    maxSpeedMultiplier: 0.5,
    verticalAmplitude: 70,
    verticalFrequency: 0.5,
  };
  const changed = StageCompiler.compile(changedSource, { difficulty: 'easy' });
  const baselineSimulation = new Simulation(baseline, { fixedStep: 1 / 60 }).seek(20);
  const changedSimulation = new Simulation(changed, { fixedStep: 1 / 60 }).seek(20);
  const baselineEnemy = baselineSimulation.enemies.find(enemy => enemy.itemId === 's3-w007');
  const changedEnemy = changedSimulation.enemies.find(enemy => enemy.itemId === 's3-w007');
  assert.notEqual(changedEnemy.x, baselineEnemy.x, '유턴 가속과 최대 속도가 이동에 반영되어야 한다');
  assert.notEqual(changedEnemy.y, baselineEnemy.y, '유턴 곡선 파라미터가 이동에 반영되어야 한다');
}

{
  const positioned = StageCompiler.clone(source);
  const wave = positioned.items.find(item => item.id === 's3-w007');
  wave.difficulty = {};
  wave.payload.spawn = { count: 1, interval: 0 };
  wave.timing.duration = 0;
  wave.payload.movement.params = { turnX: 0.7 };
  const compiled = StageCompiler.compile(positioned, { difficulty: 'easy' });
  const simulation = new Simulation(compiled, { fixedStep: 1 / 120 }).seek(wave.timing.start);
  let minimumX = Infinity;
  let sawBrakeCue = false;
  for (let step = 0; step < 600; step++) {
    simulation.advance(1 / 120);
    const enemy = simulation.enemies.find(item => item.itemId === wave.id);
    if (!enemy) break;
    minimumX = Math.min(minimumX, enemy.x);
    sawBrakeCue ||= enemy.uTurnPhase === 'brake';
    if (enemy.uTurnPhase === 'exit') break;
  }
  assert.ok(Math.abs(minimumX - positioned.viewport.width * 0.7) < 1.5, '저작한 회전 X가 유턴 꼭짓점이어야 한다');
  assert.equal(sawBrakeCue, true, '유턴 전 감속 예고 상태를 거쳐야 한다');
}

console.log('stage behavior: ok');
