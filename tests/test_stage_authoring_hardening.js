'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageCompiler = require('../js/stage/compiler.js');
const { DocumentSession, createFragment } = require('../js/stage/document.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));
const wave = source.items.find(item => item.type === 'wave');
const large = JSON.parse(JSON.stringify(source));
large.id = 'authoring-limit-fixture';
large.items = Array.from({ length: 2000 }, (_, index) => {
  const item = JSON.parse(JSON.stringify(wave));
  item.id = `limit-wave-${String(index).padStart(4, '0')}`;
  item.name = `한계 웨이브 ${index + 1}`;
  item.timing.start = +(index % 118 * 0.99).toFixed(3);
  return item;
});

const started = performance.now();
const report = StageCompiler.validate(large);
assert.deepEqual(report.errors, []);
const compiled = StageCompiler.compile(large, { difficulty: 'normal' });
assert.equal(compiled.items.length, 2000);
const simulation = new Simulation(compiled, { snapshotInterval: 15 });
assert.ok(simulation.buildSnapshotCache(15, { analyzeBudget: false }) >= 1);
assert.equal(simulation.budgetAnalysis, null);
assert.ok(performance.now() - started < 5000, '2,000-item 문서는 5초 안에 검증·컴파일되어야 한다');

const document = new DocumentSession(large, { historyLimit: 100 });
const selected = large.items.slice(0, 500).map(item => item.id);
assert.equal(document.shiftItems(selected, 0.1), 0.1);
assert.equal(document.history.length, 1, '500개 이동은 undo 한 단계여야 한다');
assert.equal(document.undo(), '여러 클립 이동');
assert.equal(document.redo(), '여러 클립 이동');

const fragment = createFragment(document.stage, selected.slice(0, 20));
const destination = new DocumentSession(source);
const pasted = destination.pasteFragment(fragment, 60);
assert.equal(pasted.length, 20);
assert.equal(new Set(pasted.map(item => item.id)).size, 20);
assert.doesNotThrow(() => StageCompiler.compile(destination.stage, { difficulty: 'hard' }));

console.log('stage authoring hardening: ok', {
  items: compiled.items.length,
  compileMs: +(performance.now() - started).toFixed(1),
  bulkUndoRecords: document.history.length,
});
