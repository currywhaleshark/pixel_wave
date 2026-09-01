'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StageBudget = require('../js/stage/budget.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));

{
  const tracker = new StageBudget.Tracker();
  tracker.observe(1, { enemies: 23, projectiles: 239 });
  assert.equal(tracker.report().peakSeverity, 'ok');
  tracker.observe(2, { enemies: 24, projectiles: 240 });
  assert.equal(tracker.report().peakSeverity, 'warning');
  tracker.observe(3, { enemies: 32, projectiles: 360 });
  const critical = tracker.report();
  assert.equal(critical.peakSeverity, 'critical');
  assert.equal(critical.peaks.enemies.time, 3);
  assert.equal(critical.peaks.projectiles.ratio, 1);

  const restored = new StageBudget.Tracker().restore(tracker.snapshot()).report();
  assert.deepEqual(restored, critical);

  const emptyRange = new StageBudget.Tracker().observe(35, { enemies: 0, projectiles: 0 }).report();
  assert.equal(emptyRange.peaks.projectiles.time, 35);
}

{
  const limits = StageBudget.normalizeLimits({
    enemies: { warning: 5, critical: 5 },
    projectiles: { warning: 10, critical: 8 },
  });
  assert.deepEqual(limits.enemies, { warning: 5, critical: 6 });
  assert.deepEqual(limits.projectiles, { warning: 10, critical: 11 });
}

{
  const expected = {
    easy: { enemies: 21, projectiles: 38, severity: 'ok' },
    normal: { enemies: 21, projectiles: 87, severity: 'ok' },
    hard: { enemies: 21, projectiles: 176, severity: 'ok' },
  };
  for (const difficulty of Object.keys(expected)) {
    const simulation = new Simulation(StageCompiler.compile(source, { difficulty }), { fixedStep: 1 / 60, snapshotInterval: 5 });
    simulation.buildSnapshotCache();
    const report = simulation.budgetAnalysis;
    assert.equal(report.peaks.enemies.value, expected[difficulty].enemies);
    assert.equal(report.peaks.projectiles.value, expected[difficulty].projectiles);
    assert.equal(report.peakSeverity, expected[difficulty].severity);

    simulation.seek(57);
    const before = { time: simulation.time, hash: simulation.stateHash(), stats: simulation.stats().budget };
    const rangeReport = simulation.analyzeBudget(90, 110);
    assert.deepEqual(rangeReport.range, { start: 90, end: 110 });
    assert.ok(rangeReport.peaks.enemies.value > 0);
    assert.ok(rangeReport.peaks.projectiles.value > 0);
    assert.equal(simulation.time, before.time, '예산 분석이 현재 재생 위치를 바꾸면 안 된다');
    assert.equal(simulation.stateHash(), before.hash, '예산 분석 뒤 게임 상태가 그대로 복원되어야 한다');
    assert.deepEqual(simulation.stats().budget, before.stats, '예산 추적 상태도 함께 복원되어야 한다');
  }
}

{
  const html = fs.readFileSync(path.join(root, 'tools/stage-sequencer.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'tools/stage-sequencer.css'), 'utf8');
  const sequencer = fs.readFileSync(path.join(root, 'tools/stage-sequencer.js'), 'utf8');
  assert.ok(html.includes('id="budgetOverlay"'));
  assert.ok(html.includes('id="budgetEnemyPeak"'));
  assert.ok(html.includes('id="budgetProjectilePeak"'));
  assert.ok(css.includes(".budget-overlay[data-level='critical']"));
  assert.ok(sequencer.includes('function refreshBudgetReport()'));
  assert.ok(sequencer.includes('simulation.analyzeBudget(range.start, range.end)'));
  assert.ok(sequencer.includes("critical: '상한 초과'"));
}

console.log('stage budget: ok');
