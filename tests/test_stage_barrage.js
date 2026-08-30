'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageBarrage = require('../js/stage/barrage.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

{
  const entries = StageBarrage.entries();
  assert.ok(entries.some(pattern => pattern.id === 'pangpang-needle-fan'));
  assert.equal(StageBarrage.get('pangpang-needle-fan').emitters[0].type, 'fan');
  assert.deepEqual(StageBarrage.validateReference({ patternId: 'pangpang-needle-fan' }), []);
  assert.ok(StageBarrage.validateReference({ patternId: '../bad' })[0].includes('id'));
  assert.ok(StageBarrage.validateReference({ patternId: 'missing-pattern' }).some(error => error.includes('찾을 수 없습니다')));
}

function stageWithPattern() {
  const stage = StageCompiler.clone(source);
  const wave = stage.items.find(item => item.id === 's3-w003');
  wave.payload.weapon = {
    patternId: 'pangpang-needle-fan',
    startDelay: 0.2,
    stopWhenLeaving: true,
  };
  stage.dependencies.barragePatterns.push('pangpang-needle-fan');
  return stage;
}

{
  const stage = stageWithPattern();
  assert.deepEqual(StageCompiler.validate(stage).errors, []);
  const compiled = StageCompiler.compile(stage, { difficulty: 'normal' });
  const enemy = compiled.events.find(event => event.itemId === 's3-w003').enemy;
  assert.equal(enemy.weapon.patternId, 'pangpang-needle-fan');
  assert.equal(enemy.weapon.pattern.emitters[0].id, 'aimed-spikes');
  assert.equal(enemy.weapon.startDelay, 0.2);

  const simulation = new Simulation(compiled, { fixedStep: 1 / 60, snapshotInterval: 2 });
  simulation.buildSnapshotCache();
  simulation.seek(11.5);
  assert.ok(simulation.firedBulletCount > 0, 'BarrageRuntime 패턴이 시퀀서에서 탄을 발사해야 한다');
  assert.ok(simulation.bullets.some(bullet => bullet.patternId === 'pangpang-needle-fan'));
  const hash = simulation.stateHash();
  simulation.seek(15);
  simulation.seek(11.5);
  assert.equal(simulation.stateHash(), hash, '탄막 Runner도 스냅샷 seek 후 결정론적으로 복원되어야 한다');
}

{
  const stage = StageCompiler.clone(source);
  const wave = stage.items.find(item => item.id === 's3-w003');
  wave.difficulty = {
    hard: {
      enabled: true,
      mode: 'patch',
      patch: {
        payload: {
          weapon: {
            presetId: null,
            patternId: 'pangpang-needle-fan',
            startDelay: 0.15,
            stopWhenLeaving: true,
          },
        },
      },
    },
  };
  stage.dependencies.barragePatterns.push('pangpang-needle-fan');
  assert.deepEqual(StageCompiler.validate(stage).errors, []);
  const easyWeapon = StageCompiler.compile(stage, { difficulty: 'easy' }).events.find(event => event.itemId === 's3-w003').enemy.weapon;
  const hardWeapon = StageCompiler.compile(stage, { difficulty: 'hard' }).events.find(event => event.itemId === 's3-w003').enemy.weapon;
  assert.equal(easyWeapon.presetId, 'legacy-aimed');
  assert.equal(easyWeapon.patternId, undefined);
  assert.equal(hardWeapon.patternId, 'pangpang-needle-fan');
  assert.equal(hardWeapon.presetId, undefined);
}

{
  const missingDependency = stageWithPattern();
  missingDependency.dependencies.barragePatterns = [];
  assert.ok(StageCompiler.validate(missingDependency).errors.some(error => error.includes("선언하지 않은 barragePatterns 'pangpang-needle-fan'")));

  const conflicting = stageWithPattern();
  conflicting.items.find(item => item.id === 's3-w003').payload.weapon.presetId = 'legacy-ring';
  assert.ok(StageCompiler.validate(conflicting).errors.some(error => error.includes('동시에 사용할 수 없습니다')));
}

{
  const html = fs.readFileSync(path.join(root, 'tools/barrage-editor.html'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'tools/barrage-editor.js'), 'utf8');
  const sequencer = fs.readFileSync(path.join(root, 'tools/stage-sequencer.js'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(root, 'tools/barrage-sw.js'), 'utf8');
  assert.ok(html.includes('id="applyToSequencer"'));
  assert.ok(html.includes('barrage-editor.js?v=4'));
  assert.ok(editor.includes("query.get('returnTo') === 'stage-sequencer'"));
  assert.ok(editor.includes('barrageReturn'));
  assert.ok(editor.includes('applyToSequencer'));
  assert.ok(sequencer.includes('targetWeapon.presetId = null'));
  assert.ok(sequencer.includes('targetWeapon.patternId = null'));
  assert.ok(serviceWorker.includes('pixel-wave-barrage-lab-v4'));
}

console.log('stage barrage: ok');
