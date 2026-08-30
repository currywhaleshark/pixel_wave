'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { DocumentSession, createFragment } = require('../js/stage/document.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

{
  const document = new DocumentSession(source);
  const originalHash = document.stateHash();
  const original = document.findItem('s3-w001');
  const edited = JSON.parse(JSON.stringify(original));
  edited.name = '수정한 웨이브';
  edited.timing.start = 2.5;

  assert.equal(document.replaceItem(original.id, edited, '웨이브 수정'), true);
  assert.equal(document.findItem(original.id).timing.start, 2.5);
  assert.equal(document.canUndo, true);
  assert.equal(document.undo(), '웨이브 수정');
  assert.equal(document.stateHash(), originalHash);
  assert.equal(document.redo(), '웨이브 수정');
  assert.equal(document.findItem(original.id).name, '수정한 웨이브');
}

{
  const document = new DocumentSession(source);
  const ids = ['s3-w001', 's3-w002'];
  const before = ids.map(id => document.findItem(id).timing.start);
  assert.equal(document.shiftItems(ids, 2), 2);
  assert.deepEqual(ids.map(id => document.findItem(id).timing.start), before.map(value => value + 2));
  assert.equal(document.undo(), '여러 클립 이동');
  assert.deepEqual(ids.map(id => document.findItem(id).timing.start), before);

  const fragment = createFragment(document.stage, ids);
  fragment.dependencies.enemyKinds.push('jelly');
  const copies = document.pasteFragment(fragment, 20);
  assert.equal(copies.length, 2);
  assert.deepEqual(copies.map(item => item.timing.start), [20, 22]);
  assert.ok(document.stage.dependencies.enemyKinds.includes('jelly'));
  assert.equal(document.undo(), '클립 조각 붙여넣기');
  assert.ok(!document.stage.dependencies.enemyKinds.includes('jelly'));
  assert.ok(copies.every(item => !document.findItem(item.id)));

  assert.equal(document.removeItems(ids), 2);
  assert.ok(ids.every(id => !document.findItem(id)));
  document.undo();
  assert.ok(ids.every(id => document.findItem(id)));
}

{
  const document = new DocumentSession(source);
  const edited = JSON.parse(JSON.stringify(document.findItem('s3-w001')));
  edited.payload.enemy.kind = 'jelly';
  const dependencies = JSON.parse(JSON.stringify(document.stage.dependencies));
  dependencies.enemyKinds.push('jelly');
  assert.equal(document.replaceItemWithDependencies(edited.id, edited, dependencies, '적 라이브러리 변경'), true);
  assert.equal(document.findItem(edited.id).payload.enemy.kind, 'jelly');
  assert.ok(document.stage.dependencies.enemyKinds.includes('jelly'));
  assert.equal(document.undo(), '적 라이브러리 변경');
  assert.equal(document.findItem(edited.id).payload.enemy.kind, 'fish');
  assert.ok(!document.stage.dependencies.enemyKinds.includes('jelly'));
}

{
  const document = new DocumentSession(source);
  const count = document.stage.items.length;
  const copy = document.duplicateItem('s3-w001', { startOffset: 1 });
  assert.equal(document.stage.items.length, count + 1);
  assert.notEqual(copy.id, 's3-w001');
  assert.equal(copy.timing.start, 3);
  assert.ok(copy.name.endsWith('복사본'));
  assert.equal(document.removeItem(copy.id), true);
  assert.equal(document.stage.items.length, count);
  document.undo();
  assert.ok(document.findItem(copy.id));
}

{
  const document = new DocumentSession(source, { historyLimit: 2 });
  for (let index = 0; index < 3; index++) {
    const item = JSON.parse(JSON.stringify(document.findItem('s3-w001')));
    item.name = `수정 ${index}`;
    document.replaceItem(item.id, item);
  }
  assert.equal(document.history.length, 2);
  document.undo();
  document.undo();
  assert.equal(document.canUndo, false);
  assert.equal(document.findItem('s3-w001').name, '수정 0');
}

{
  const document = new DocumentSession(source, { historyLimit: 100 });
  const originalHash = document.stateHash();
  for (let index = 1; index <= 100; index++) {
    const item = JSON.parse(JSON.stringify(document.findItem('s3-w001')));
    item.name = `100회 편집 ${index}`;
    document.replaceItem(item.id, item);
  }
  for (let index = 0; index < 100; index++) assert.ok(document.undo());
  assert.equal(document.stateHash(), originalHash, '100번 편집 후 전부 undo하면 원문이 복원되어야 한다');
  for (let index = 0; index < 100; index++) assert.ok(document.redo());
  assert.equal(document.findItem('s3-w001').name, '100회 편집 100');
}

{
  const document = new DocumentSession(source);
  const environment = JSON.parse(JSON.stringify(document.findItem('s3-scroll-base')));
  environment.payload.params.curve = environment.payload.params.curve.map(point => ({ ...point, value: 0.5 }));
  document.replaceItem(environment.id, environment, '스크롤 배율 수정');
  const compiled = StageCompiler.compile(document.stage, { difficulty: 'easy' });
  const simulation = new Simulation(compiled);
  simulation.buildSnapshotCache();
  simulation.seek(120);
  assert.ok(Math.abs(simulation.scroll - 4680) < 1e-6, '환경 클립 수정이 실제 미리보기 스크롤에 반영되어야 한다');
}

{
  const document = new DocumentSession(source);
  document.setDifficultyOverride('s3-w001', 'hard', {
    mode: 'patch',
    patch: {
      timing: { duration: 2.16 },
      payload: {
        spawn: { count: 10 },
        movement: { presetId: 'u-turn' },
        weapon: { presetId: 'legacy-aimed', interval: 0.8 },
      },
    },
  }, '하드 웨이브 수정');
  assert.equal(StageCompiler.compile(document.stage, { difficulty: 'easy' })
    .items.find(item => item.id === 's3-w001').resolvedCount, 6);
  const hard = StageCompiler.compile(document.stage, { difficulty: 'hard' })
    .items.find(item => item.id === 's3-w001');
  assert.equal(hard.resolvedCount, 10);
  assert.equal(hard.payload.movement.presetId, 'u-turn');
  assert.equal(hard.payload.weapon.presetId, 'legacy-aimed');
  assert.equal(document.undo(), '하드 웨이브 수정');
  assert.equal(StageCompiler.compile(document.stage, { difficulty: 'hard' })
    .items.find(item => item.id === 's3-w001').resolvedCount, 6);
  document.redo();
  document.clearDifficultyOverride('s3-w001', 'hard');
  assert.equal(document.findItem('s3-w001').difficulty, undefined);
}

{
  const document = new DocumentSession(source);
  document.setDifficultyOverride('s3-w002', 'normal', { enabled: false }, '노멀에서 끄기');
  assert.ok(StageCompiler.compile(document.stage, { difficulty: 'easy' }).items.some(item => item.id === 's3-w002'));
  assert.ok(!StageCompiler.compile(document.stage, { difficulty: 'normal' }).items.some(item => item.id === 's3-w002'));

  const hardOnly = StageCompiler.clone(document.findItem('s3-w001'));
  hardOnly.id = 's3-hard-only-test';
  hardOnly.name = '하드 전용 증원';
  hardOnly.enabled = false;
  hardOnly.difficulty = { hard: { enabled: true, mode: 'patch', patch: {} } };
  document.insertItem(hardOnly);
  assert.ok(!StageCompiler.compile(document.stage, { difficulty: 'easy' }).items.some(item => item.id === hardOnly.id));
  assert.ok(StageCompiler.compile(document.stage, { difficulty: 'hard' }).items.some(item => item.id === hardOnly.id));
}

{
  const document = new DocumentSession(source);
  document.setDifficultyOverride('s3-ride-01', 'hard', {
    mode: 'patch',
    patch: { payload: { params: { scrollMultiplier: 3, pearlRing: { count: 18 } } } },
  });
  const easyRide = StageCompiler.compile(document.stage, { difficulty: 'easy' }).items.find(item => item.id === 's3-ride-01');
  const hardRide = StageCompiler.compile(document.stage, { difficulty: 'hard' }).items.find(item => item.id === 's3-ride-01');
  assert.equal(easyRide.payload.params.scrollMultiplier, 5);
  assert.equal(easyRide.payload.params.pearlRing.count, 10);
  assert.equal(hardRide.payload.params.scrollMultiplier, 3);
  assert.equal(hardRide.payload.params.pearlRing.count, 18);
}

async function testPersistenceFallback() {
  const values = new Map();
  global.localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const Persistence = require('../js/stage/persistence.js');
  const saved = await Persistence.saveDraft(source, { exportedHash: 'abc123' });
  assert.equal(saved.storage, 'localstorage');
  const loaded = await Persistence.loadDraft(source.id);
  assert.equal(loaded.stage.items.length, 41);
  assert.equal(loaded.exportedHash, 'abc123');
  const recoveryStage = JSON.parse(JSON.stringify(source));
  recoveryStage.name = '강제 종료 복구본';
  Persistence.saveRecovery(recoveryStage, { revision: 7 });
  assert.equal(Persistence.loadRecovery(source.id).stage.name, '강제 종료 복구본');
  const legacy = JSON.parse(JSON.stringify(source));
  delete legacy.schemaVersion;
  legacy.items[0].timing.domain = undefined;
  const migration = Persistence.migrateStage(legacy);
  assert.equal(migration.migrated, true);
  assert.equal(migration.stage.schemaVersion, 1);
  assert.equal(migration.stage.items[0].timing.domain, 'time');
  const conflict = Persistence.resolveSyncConflict(
    { id: 'stage3', revision: 4, baseRevision: 2, stage: source },
    { id: 'stage3', revision: 5, baseRevision: 3, stage: recoveryStage },
  );
  assert.equal(conflict.winner, null);
  assert.equal(conflict.conflict.local.revision, 4);
  assert.equal(conflict.conflict.remote.revision, 5);
  await Persistence.deleteDraft(source.id);
  assert.equal(await Persistence.loadDraft(source.id), null);
  delete global.localStorage;
}

testPersistenceFallback()
  .then(() => console.log('stage document: ok'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
