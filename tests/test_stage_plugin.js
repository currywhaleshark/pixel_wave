'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StagePlugin = require('../js/stage/plugin.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

{
  const curve = [{ at: 0, value: 1 }, { at: 5, value: 2 }, { at: 10, value: 4 }];
  assert.equal(StagePlugin.sampleCurve(curve, -1), 1);
  assert.equal(StagePlugin.sampleCurve(curve, 2.5), 1.5);
  assert.equal(StagePlugin.sampleCurve(curve, 7.5), 3);
  assert.equal(StagePlugin.sampleCurve(curve, 11), 4);
  assert.equal(StagePlugin.sampleCurve([], 3), 1);
}

{
  const normalized = StagePlugin.normalizeCurve([
    { at: 8, value: 9 },
    { at: 2, value: -1 },
    { at: 2, value: 3 },
  ], 10);
  assert.deepEqual(normalized, [
    { at: 0, value: 3 },
    { at: 2, value: 3 },
    { at: 8, value: 5 },
    { at: 10, value: 5 },
  ]);
  assert.deepEqual(StagePlugin.validateCurve(normalized, 10), []);
}

{
  const errors = StagePlugin.validateCurve([
    { at: 1, value: 1 },
    { at: 1, value: 6 },
  ], 10);
  assert.ok(errors.some(error => error.includes('첫 점')));
  assert.ok(errors.some(error => error.includes('오름차순')));
  assert.ok(errors.some(error => error.includes('0–5')));
  assert.ok(errors.some(error => error.includes('마지막 점')));
}

{
  assert.deepEqual(StagePlugin.channels('scroll-speed'), [{ id: 'background-scroll', mode: 'multiply' }]);
  assert.ok(StagePlugin.channels('turtle-ride').some(channel => channel.id === 'player-control' && channel.mode === 'exclusive'));
}

{
  const invalid = StageCompiler.clone(source);
  invalid.items.find(item => item.id === 's3-scroll-base').payload.params.curve[1].at = 119;
  const report = StageCompiler.validate(invalid);
  assert.ok(report.errors.some(error => error.includes('curve 마지막 점은 클립 끝')));
}

{
  const curved = StageCompiler.clone(source);
  curved.items.find(item => item.id === 's3-scroll-base').payload.params.curve = [
    { at: 0, value: 1 },
    { at: 60, value: 2 },
    { at: 120, value: 1 },
  ];
  const simulation = new Simulation(StageCompiler.compile(curved, { difficulty: 'easy' }));
  simulation.buildSnapshotCache();
  simulation.seek(30);
  assert.ok(Math.abs(simulation.scroll - 1687.5) < 1e-6, '곡선 적분이 즉시 배경 스크롤에 반영되어야 한다');
  const hash = simulation.stateHash();
  simulation.seek(70);
  simulation.seek(30);
  assert.equal(simulation.stateHash(), hash, '활성 곡선 안 seek 복원은 전체 재생과 같아야 한다');
}

console.log('stage plugin: ok');
