'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageFormation = require('../js/stage/formation.js');
const StageCompiler = require('../js/stage/compiler.js');
const { DocumentSession } = require('../js/stage/document.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

{
  const formation = StageFormation.normalize({ presetId: 'v' }, 5);
  assert.equal(formation.params.spacingX, 34);
  assert.equal(formation.params.spacingY, 42);
  const layout = StageFormation.layout(formation, 5, { baseX: 100, baseY: 200, width: 960, height: 540 });
  assert.equal(layout.resolvedCount, 5);
  assert.deepEqual(layout.points.map(point => [point.x, point.y]), [
    [100, 200],
    [134, 158],
    [134, 242],
    [168, 116],
    [168, 284],
  ]);
}

{
  const formation = StageFormation.normalize({
    presetId: 'wall-gap',
    params: { slotCount: 10, gapSlots: 2, gapStartRange: [3, 3], topPadding: 40, bottomPadding: 20 },
  });
  const layout = StageFormation.layout(formation, 1, { baseX: 990, baseY: 270, width: 960, height: 540, gapStart: 3 });
  assert.equal(StageFormation.resolvedCount(formation), 8);
  assert.equal(layout.resolvedCount, 8);
  assert.deepEqual(layout.points.map(point => point.wallSlot), [0, 1, 2, 5, 6, 7, 8, 9]);
  assert.deepEqual(StageFormation.validate(formation), []);
  assert.ok(StageFormation.validate({ presetId: 'wall-gap', params: { slotCount: 4, gapSlots: 4 } })
    .some(error => error.includes('빈 칸 수')));
  assert.ok(StageFormation.validate({ presetId: 'wall-gap', params: { topPadding: 300, bottomPadding: 240 } })
    .some(error => error.includes('화면 높이')));
}

{
  const stage = StageCompiler.clone(source);
  const wave = stage.items.find(item => item.id === 's3-w003');
  wave.payload.entry.presetId = 'left-to-right';
  wave.payload.formation = { presetId: 'v', params: { spacingX: 60, spacingY: 30 } };
  const compiled = StageCompiler.compile(stage, { difficulty: 'easy' });
  const events = compiled.events.filter(event => event.itemId === wave.id && event.type === 'spawn-enemy');
  assert.equal(events.length, wave.payload.spawn.count);
  assert.equal(events[0].enemy.x, -30);
  assert.equal(events[0].enemy.directionX, 1);
  assert.equal(events[1].enemy.x - events[0].enemy.x, 60);
  assert.equal(events[0].enemy.y - events[1].enemy.y, 30);
}

{
  const document = new DocumentSession(source);
  document.setDifficultyOverride('s3-w003', 'hard', {
    enabled: true,
    mode: 'patch',
    patch: { payload: { formation: { presetId: 'v', params: { spacingX: 72, spacingY: 55 } } } },
  }, '하드 V 편대 조정');
  const easyEvents = StageCompiler.compile(document.stage, { difficulty: 'easy' }).events
    .filter(event => event.itemId === 's3-w003' && event.type === 'spawn-enemy');
  const hardEvents = StageCompiler.compile(document.stage, { difficulty: 'hard' }).events
    .filter(event => event.itemId === 's3-w003' && event.type === 'spawn-enemy');
  assert.equal(Math.abs(easyEvents[1].enemy.x - easyEvents[0].enemy.x), 34);
  assert.equal(Math.abs(hardEvents[1].enemy.x - hardEvents[0].enemy.x), 72);
  assert.equal(Math.abs(hardEvents[1].enemy.y - hardEvents[0].enemy.y), 55);
  assert.equal(document.undo(), '하드 V 편대 조정');
  const restored = StageCompiler.compile(document.stage, { difficulty: 'hard' }).events
    .filter(event => event.itemId === 's3-w003' && event.type === 'spawn-enemy');
  assert.equal(Math.abs(restored[1].enemy.x - restored[0].enemy.x), 34);
}

console.log('stage formation: ok');
