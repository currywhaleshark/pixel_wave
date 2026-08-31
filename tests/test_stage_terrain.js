'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageLayerTransform = require('../js/stage/layerTransform.js');
const StageTerrain = require('../js/stage/terrain.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/coverage-stage1-terrain.v1.draft.json'), 'utf8'));
const profile = JSON.parse(fs.readFileSync(path.join(root, 'data/terrain-profiles/stage1-near-v1.json'), 'utf8'));
const stage1 = JSON.parse(fs.readFileSync(path.join(root, 'data/stages/stage1.v1.json'), 'utf8'));

assert.deepEqual(StageTerrain.validateProfile(profile).errors, []);
assert.equal(profile.review.status, 'approved');
assert.equal(profile.sockets.length, 6);
assert.ok(profile.sockets.every(socket => socket.reviewStatus === 'approved'));
assert.deepEqual(StageCompiler.validate(fixture).errors, []);

for (const item of fixture.items.filter(entry => entry.type === 'terrain-object')) {
  assert.deepEqual(StageTerrain.validateItem(item, profile).errors, [], item.id);
}

const compiled = StageCompiler.compile(fixture, { difficulty: 'normal' });
const terrainItems = compiled.items.filter(item => item.type === 'terrain-object');
assert.equal(terrainItems.length, 3);
assert.ok(Math.abs(terrainItems[0].projectedTime - 45.54) < 0.1);
assert.ok(Math.abs(terrainItems[1].projectedTime - 77.03) < 0.1);
assert.ok(Math.abs(terrainItems[2].projectedTime - 79.52) < 0.1);

const simulation = new Simulation(compiled, { terrainProfile: profile, snapshotInterval: 5 });
simulation.buildSnapshotCache();
simulation.seek(45.54);
const first = simulation.terrainObjects.find(item => item.itemId === 's1-turret-01');
assert.ok(first.drawX > 930 && first.drawX < 1000, `첫 포대가 오른쪽 진입선에 있어야 한다: ${first.drawX}`);
assert.equal(first.profileX, 1320);
const hash = simulation.stateHash();
simulation.seek(90);
simulation.seek(45.54);
assert.equal(simulation.stateHash(), hash, '지형 오브젝트 seek는 동일한 transform을 복원해야 한다');

{
  const faster = StageCompiler.clone(fixture);
  faster.items.find(item => item.id === 's1-scroll-base').payload.params.curve = [
    { at: 0, value: 2 }, { at: 114, value: 2 },
  ];
  const fasterCompiled = StageCompiler.compile(faster, { difficulty: 'normal' });
  const fasterItem = fasterCompiled.items.find(item => item.id === 's1-turret-01');
  assert.ok(fasterItem.projectedTime < terrainItems[0].projectedTime * 0.51);
  const fasterSimulation = new Simulation(fasterCompiled, { terrainProfile: profile });
  fasterSimulation.advance(fasterItem.projectedTime);
  const fasterObject = fasterSimulation.terrainObjects.find(item => item.itemId === 's1-turret-01');
  assert.equal(fasterObject.profileX, first.profileX);
  assert.equal(fasterObject.drawY, first.drawY, '스크롤 배율이 달라도 같은 지형 표면에 붙어야 한다');
}

{
  const layer = StageLayerTransform.layerConfig('stage1', 'near');
  const item = fixture.items.find(entry => entry.id === 's1-turret-01');
  const atZero = StageLayerTransform.objectPosition(item, profile, 0, {
    layer, contact: { x: 8, y: 14 }, spriteAnchor: { x: 8, y: 7 },
  });
  const afterWrap = StageLayerTransform.objectPosition(item, profile, profile.binding.width * 2 / layer.speed, {
    layer, contact: { x: 8, y: 14 }, spriteAnchor: { x: 8, y: 7 },
  });
  assert.equal(atZero.drawX - afterWrap.drawX, profile.binding.width * 2);
  assert.equal(atZero.drawY, afterWrap.drawY);
  const nativeTravel = StageLayerTransform.layerTravelNative(187.5, layer.speed, 2, layer.scrollScale);
  assert.equal(StageLayerTransform.stripOffset(187.5, layer.speed, 2, profile.binding.width), nativeTravel % profile.binding.width);
}

{
  const easy = StageCompiler.compile(stage1, { difficulty: 'easy' });
  const normal = StageCompiler.compile(stage1, { difficulty: 'normal' });
  const hard = StageCompiler.compile(stage1, { difficulty: 'hard' });
  const turrets = easy.items.filter(item => item.type === 'terrain-object');
  assert.equal(turrets.length, 5, 'Stage 1 포대는 승인 소켓을 사용하는 지형 오브젝트여야 한다');
  assert.deepEqual(turrets.map(item => item.payload.weapon.params.count), [6, 6, 6, 6, 6]);
  assert.deepEqual(normal.items.filter(item => item.type === 'terrain-object').map(item => item.payload.weapon.params.count), [8, 8, 8, 8, 8]);
  assert.deepEqual(hard.items.filter(item => item.type === 'terrain-object').map(item => item.payload.weapon.params.count), [10, 10, 10, 10, 10]);
  assert.deepEqual([
    turrets[0].payload.hp,
    normal.items.find(item => item.id === turrets[0].id).payload.hp,
    hard.items.find(item => item.id === turrets[0].id).payload.hp,
  ], [6, 7, 9]);
  assert.ok(easy.events.some(event => event.type === 'spawn-terrain' && event.itemId === turrets[0].id));

  const turretItem = turrets[0];
  const turretSimulation = new Simulation(easy, { fixedStep: 1 / 60, terrainProfile: profile });
  turretSimulation.seek(turretItem.projectedTime);
  const atSpawn = turretSimulation.enemies.find(enemy => enemy.itemId === turretItem.id);
  assert.ok(atSpawn);
  const spawnX = atSpawn.x;
  const spawnY = atSpawn.y;
  const spawnScroll = turretSimulation.scroll;
  turretSimulation.seek(turretItem.projectedTime + 1);
  const afterOneSecond = turretSimulation.enemies.find(enemy => enemy.itemId === turretItem.id);
  assert.ok(afterOneSecond);
  const layer = StageLayerTransform.layerConfig('stage1', 'near');
  const expectedTravel = (
    StageLayerTransform.layerTravelNative(turretSimulation.scroll, layer.speed, 2, layer.scrollScale)
    - StageLayerTransform.layerTravelNative(spawnScroll, layer.speed, 2, layer.scrollScale)
  ) * 2;
  assert.equal(spawnX - afterOneSecond.x, expectedTravel, '포대 X 이동은 near 지형 픽셀 이동과 같아야 한다');
  assert.equal(afterOneSecond.y, spawnY, '포대 높이는 배치한 지형 높이에 고정되어야 한다');

  turretSimulation.seek(turretItem.projectedTime + 2);
  assert.equal(turretSimulation.firedBulletCount, 5, '이지 포대 링은 6방향 중 읽을 수 있는 1칸을 비운다');
}

console.log('stage terrain: ok');
