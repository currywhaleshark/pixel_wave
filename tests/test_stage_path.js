'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StagePath = require('../js/stage/path.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');
const { DocumentSession } = require('../js/stage/document.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
}

{
  const raw = [
    { t: 3, x: -0.1, y: 0.4, ease: 'ease-out' },
    { t: 0, x: 1.05, y: 0.2 },
    { t: 1, x: 0.5, y: 0.8, ease: 'smooth', hold: 0.5 },
  ];
  const normalized = StagePath.normalize(raw);
  assert.deepEqual(normalized.map(point => point.t), [0, 1, 3]);
  assert.deepEqual(StagePath.validate(normalized), []);

  const halfway = StagePath.sample(normalized, 0.5, { width: 100, height: 100 });
  closeTo(halfway.x, 77.5);
  closeTo(halfway.y, 50);
  const held = StagePath.sample(normalized, 1.25, { width: 100, height: 100 });
  closeTo(held.x, 50);
  closeTo(held.y, 80);
  assert.equal(StagePath.sample(normalized, 3.01, { width: 100, height: 100 }).done, true);

  const invalidHold = StagePath.normalize([{ t: 0, x: 0, y: 0, hold: 2 }, { t: 1, x: 1, y: 1 }]);
  assert.ok(StagePath.validate(invalidHold).some(error => error.includes('다음 점 도착 시간을 넘습니다')));
}

{
  const stage = StageCompiler.clone(source);
  const wave = stage.items.find(item => item.id === 's3-w001');
  wave.timing.duration = 0;
  wave.payload.spawn = { count: 1, interval: 0 };
  wave.payload.movement = {
    presetId: 'custom-path',
    path: [
      { t: 0, x: 0.9, y: 0.2 },
      { t: 1, x: 0.5, y: 0.8, ease: 'linear', hold: 0.5 },
      { t: 2.5, x: 0.1, y: 0.3, ease: 'smooth' },
    ],
  };
  const compiled = StageCompiler.compile(stage, { difficulty: 'easy' });
  const event = compiled.events.find(entry => entry.itemId === wave.id && entry.type === 'spawn-enemy');
  closeTo(event.enemy.x, 864);
  closeTo(event.enemy.y, 108);
  assert.equal(event.enemy.directionX, -1);

  const simulation = new Simulation(compiled, { fixedStep: 1 / 60 });
  simulation.seek(wave.timing.start + 1);
  const enemy = simulation.enemies.find(entry => entry.itemId === wave.id);
  closeTo(enemy.x, 480, 1e-4);
  closeTo(enemy.y, 432, 1e-4);
  simulation.seek(wave.timing.start + 3);
  assert.ok(!simulation.enemies.some(entry => entry.itemId === wave.id), '끝난 경로의 적은 제거되어야 한다');
}

{
  const document = new DocumentSession(source);
  document.setDifficultyOverride('s3-w001', 'hard', {
    enabled: true,
    mode: 'patch',
    patch: {
      payload: {
        movement: {
          presetId: 'custom-path',
          path: [
            { t: 0, x: 1.05, y: 0.2 },
            { t: 2, x: 0.45, y: 0.75, ease: 'smooth' },
            { t: 4, x: -0.08, y: 0.4, ease: 'ease-in' },
          ],
        },
      },
    },
  }, '하드 경로 편집');
  assert.equal(StageCompiler.compile(document.stage, { difficulty: 'easy' })
    .items.find(item => item.id === 's3-w001').payload.movement.presetId, 'sine');
  assert.equal(StageCompiler.compile(document.stage, { difficulty: 'hard' })
    .items.find(item => item.id === 's3-w001').payload.movement.path[1].y, 0.75);
  assert.equal(document.undo(), '하드 경로 편집');
  assert.equal(StageCompiler.compile(document.stage, { difficulty: 'hard' })
    .items.find(item => item.id === 's3-w001').payload.movement.presetId, 'sine');
}

console.log('stage path: ok');
