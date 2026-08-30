'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { DocumentSession } = require('../js/stage/document.js');
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
