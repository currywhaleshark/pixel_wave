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

{
  assert.equal(StageRegistry.get('movementPresets', 'sine').name, '물결');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-ring').name, '원형탄');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-death-shot').fields.length, 0);
  assert.equal(StageRegistry.get('movementPresets', 'current-surf').name, '해류 편승');
  assert.equal(StageRegistry.get('weaponPresets', 'legacy-mine').name, '등불 기뢰');
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

console.log('stage behavior: ok');
