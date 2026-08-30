'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageEntry = require('../js/stage/entry.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));
const viewport = { width: 960, height: 540 };

{
  assert.deepEqual(StageEntry.resolve({ presetId: 'right-to-left', y: 0.25 }, viewport), {
    entry: { presetId: 'right-to-left', x: 0.5, y: 0.25 },
    x: 990, y: 135, directionX: -1, directionY: 0, coordinate: 'y',
  });
  assert.deepEqual(StageEntry.resolve({ presetId: 'top-to-bottom', x: 0.4 }, viewport), {
    entry: { presetId: 'top-to-bottom', x: 0.4, y: 0.5 },
    x: 384, y: -30, directionX: -0.25, directionY: 1, coordinate: 'x',
  });
  assert.equal(StageEntry.resolve({ presetId: 'diagonal', x: 0.8, params: { vertical: 'up' } }, viewport).directionY, -0.83);
  assert.ok(StageEntry.validate({ presetId: 'diagonal', params: { vertical: 'sideways' } })
    .some(error => error.includes('대각')));
}

{
  const stage = StageCompiler.clone(source);
  stage.dependencies.entryPresets.push('top-to-bottom');
  const wave = stage.items.find(item => item.id === 's3-w003');
  wave.payload.entry = { presetId: 'top-to-bottom', x: 0.5 };
  wave.payload.movement = { presetId: 'straight' };
  const compiled = StageCompiler.compile(stage, { difficulty: 'easy' });
  const events = compiled.events.filter(event => event.itemId === wave.id && event.type === 'spawn-enemy');
  assert.equal(events[0].enemy.y, -30);
  assert.equal(events[0].enemy.directionY, 1);
  assert.equal(events[0].enemy.directionX, -0.25);
  assert.ok(events[1].enemy.y < events[0].enemy.y, '세로 V 편대의 후열은 진입점 뒤에 배치되어야 한다');
  assert.notEqual(events[1].enemy.x, events[0].enemy.x, '세로 V 편대는 좌우로 벌어져야 한다');

  const simulation = new Simulation(compiled);
  simulation.seek(wave.timing.start + 0.5);
  const enemy = simulation.enemies.find(item => item.itemId === wave.id);
  assert.ok(enemy.y > -30, '위 진입 적은 아래 방향으로 이동해야 한다');
}

console.log('stage entry: ok');
