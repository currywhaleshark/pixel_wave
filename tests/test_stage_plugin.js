'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const StagePlugin = require('../js/stage/plugin.js');
const StageWreck = require('../js/stage/wreck.js');
const StageCompiler = require('../js/stage/compiler.js');
const { Simulation } = require('../js/stage/simulation.js');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage3.v1.draft.json'), 'utf8'));
const stage4Source = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/stage4.v1.draft.json'), 'utf8'));
const stage6Source = JSON.parse(fs.readFileSync(path.join(root, 'data/stages/stage6.v1.json'), 'utf8'));
const coverage5 = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/coverage-stage5-wreck.v1.draft.json'), 'utf8'));
const coverage6 = JSON.parse(fs.readFileSync(path.join(root, 'docs/stage-editor/coverage-stage6-storm.v1.draft.json'), 'utf8'));

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
  assert.deepEqual(StagePlugin.channels('scroll-speed'), [{ id: 'world.scrollMultiplier', mode: 'multiply' }]);
  assert.ok(StagePlugin.channels('turtle-ride').some(channel => channel.id === 'player.motionOverride' && channel.mode === 'exclusive'));
  assert.equal(StagePlugin.definition('wreck-corridor').editor, 'generic');
  assert.equal(StagePlugin.definition('wreck-corridor').fields.find(field => field.path === 'variant').defaultValue, 'auto');
  assert.equal(StagePlugin.definition('wreck-corridor').fields.find(field => field.path === 'entryCueDuration').defaultValue, 0.6);
  assert.equal(StagePlugin.definition('storm-current').fields.length, 16);
}

{
  const viewport = { width: 960, height: 540 };
  const params = {
    side: 'top', heightFraction: 0.5, speed: 120, width: 150,
    indestructible: false, hp: 45, variant: 'stern', entryCueDuration: 0.75,
  };
  const spec = StageWreck.createSpawnSpec(params, viewport, { itemId: 'wreck-a', groupId: 'group-a' });
  assert.deepEqual(
    [spec.x, spec.y, spec.wreckW, spec.wreckH, spec.wreckVariant, spec.hp, spec.wreckIndestructible],
    [1125, 135, 150, 270, 2, 45, false],
  );
  assert.equal(spec.x - spec.wreckW * 0.5, viewport.width + params.speed * params.entryCueDuration,
    '예고가 끝나기 전에는 난파선 판정 폭이 화면에 들어오지 않아야 한다');
  const atEntry = StageWreck.positionAt(params, viewport, params.entryCueDuration);
  assert.equal(atEntry.x - atEntry.width * 0.5, viewport.width);
  assert.deepEqual(StageWreck.tileCenters(100, 150, 80), [60, 140], '가로 타일은 판정 폭 전체를 대칭으로 덮는다');
  assert.equal(StageWreck.variantIndex('stern', 'ignored'), 2);
  assert.equal(StageWreck.variantIndex('auto', 'wreck-a'), StageWreck.variantIndex('auto', 'wreck-a'));
}

{
  const bonus = StagePlugin.normalizeTurtleRide({});
  assert.equal(bonus.scrollMultiplier, 5);
  assert.equal(bonus.playerInvulnerable, true);
  assert.equal(bonus.taxiDurability, 0);
  assert.equal(bonus.bulletClearOnStart.enabled, true);
  assert.equal(bonus.pearlTrail.enabled, true);
  assert.equal(bonus.pearlRing.enabled, true);

  const chase = StagePlugin.normalizeTurtleRide({
    scrollMultiplier: 1.4,
    playerInvulnerable: false,
    taxiDurability: 3,
    continueIntoBoss: true,
    exitBehavior: 'silent',
    bulletClearOnStart: { enabled: false },
    pearlTrail: { enabled: false, streamLoosePearls: false },
    pearlRing: { enabled: false },
  });
  assert.deepEqual(
    [chase.scrollMultiplier, chase.playerInvulnerable, chase.taxiDurability, chase.continueIntoBoss, chase.exitBehavior],
    [1.4, false, 3, true, 'silent'],
  );
  assert.equal(chase.bulletClearOnStart.enabled, false);
  assert.equal(chase.pearlTrail.enabled, false);
  assert.equal(chase.pearlTrail.streamLoosePearls, false);
  assert.equal(chase.pearlRing.enabled, false);
  assert.ok(StagePlugin.validateTurtleRide({ scrollMultiplier: 8, taxiDurability: -1, exitBehavior: 'explode' }).length >= 3);
}

{
  const invalid = StageCompiler.clone(source);
  invalid.items.find(item => item.id === 's3-scroll-base').payload.params.curve[1].at = 119;
  const report = StageCompiler.validate(invalid);
  assert.ok(report.errors.some(error => error.includes('curve 마지막 점은 클립 끝')));
}

{
  for (const fixture of [coverage5, coverage6]) {
    assert.deepEqual(StageCompiler.validate(fixture).errors, [], `${fixture.id} 플러그인 fixture가 검증되어야 한다`);
    for (const difficulty of ['easy', 'normal', 'hard']) {
      const compiled = StageCompiler.compile(fixture, { difficulty });
      for (const sourceItem of fixture.items) {
        assert.deepEqual(
          compiled.items.find(item => item.id === sourceItem.id)?.payload,
          sourceItem.payload,
          `${fixture.id} ${difficulty} ${sourceItem.id} payload가 원본 값을 보존해야 한다`,
        );
      }
    }
  }
}

{
  const invalid = StageCompiler.clone(coverage6);
  invalid.items.find(item => item.id === 's6-bolt-01').payload.params.xRatio = 2;
  assert.ok(StageCompiler.validate(invalid).errors.some(error => error.includes('xRatio은 0–1 범위')));
}

{
  const conflictStage = StageCompiler.clone(source);
  const ride = StageCompiler.clone(conflictStage.items.find(item => item.id === 's3-ride-01'));
  ride.id = 's3-ride-02';
  ride.name = '겹친 거북 택시';
  ride.timing = { domain: 'time', start: 40, duration: 3 };
  conflictStage.items.push(ride);
  const conflicts = StagePlugin.findChannelConflicts(conflictStage.items);
  assert.deepEqual(conflicts.map(conflict => conflict.itemIds), [['s3-ride-01', 's3-ride-02']]);
  assert.equal(conflicts[0].channelId, 'player.motionOverride');
  assert.ok(StageCompiler.compile(conflictStage, { difficulty: 'easy' }).validation.warnings.some(warning => (
    warning.includes("'s3-ride-01', 's3-ride-02'")
  )));

  ride.timing.start = 57;
  assert.deepEqual(StagePlugin.findChannelConflicts(conflictStage.items), [], '끝점만 닿는 독점 채널은 충돌하지 않는다');
}

{
  const params = { current: { xAmplitude: 70 } };
  StagePlugin.setPath(params, 'current.xAmplitude', StagePlugin.coerceField(
    StagePlugin.definition('storm-current').fields.find(field => field.path === 'current.xAmplitude'),
    900,
  ));
  assert.equal(StagePlugin.getPath(params, 'current.xAmplitude'), 500, '범용 필드는 계약 범위로 보정한다');
}

{
  const state = StagePlugin.initialRuntimeState();
  state.current = { x: 80, y: -30 };
  state.influence.player = { x: 1, y: 0.5 };
  state.influence.enemyProjectile = { x: 0.75, y: 0.6 };
  assert.deepEqual(StagePlugin.sampleCurrent(state, 'raw'), { x: 80, y: -30 });
  assert.deepEqual(StagePlugin.sampleCurrent(state, 'player'), { x: 80, y: -15 });
  assert.deepEqual(StagePlugin.sampleCurrent(state, 'enemyProjectile'), { x: 60, y: -18 });
  assert.deepEqual(StagePlugin.sampleCurrent(state, 'missing-target'), { x: 0, y: 0 });
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

{
  const simulation = new Simulation(StageCompiler.compile(coverage5, { difficulty: 'normal' }));
  simulation.buildSnapshotCache();
  simulation.seek(8.5);
  assert.ok(simulation.pluginState.darkness > 0.29 && simulation.pluginState.darkness <= 0.3);
  assert.equal(simulation.pluginState.wrecks.length, 1);
  assert.equal(simulation.pluginState.wrecks[0].side, 'bottom');
  assert.ok(Math.abs(simulation.pluginState.wrecks[0].x - 1006.5) < 1e-6);
  assert.ok(Math.abs(simulation.pluginState.wrecks[0].cueProgress - (0.5 / 0.6)) < 1e-6);
  const activeHash = simulation.stateHash();
  simulation.seek(37);
  simulation.seek(8.5);
  assert.equal(simulation.stateHash(), activeHash, '난파선 내부 seek가 동일한 플러그인 상태를 복원해야 한다');
}

{
  const simulation = new Simulation(StageCompiler.compile(stage4Source, { difficulty: 'normal' }));
  simulation.buildSnapshotCache();
  simulation.seek(54);
  const beforeBreak = simulation.pluginState.darkness;
  simulation.seek(58);
  const brightBreak = simulation.pluginState.darkness;
  simulation.seek(87);
  const deepest = simulation.pluginState.darkness;
  assert.ok(brightBreak < beforeBreak - 0.2, '58초 밝은 휴지에서 암전 곡선이 확실히 걷혀야 한다');
  assert.ok(deepest > brightBreak + 0.35, '후반 최심부에서 암전이 다시 깊어져야 한다');
}

{
  const simulation = new Simulation(StageCompiler.compile(coverage6, { difficulty: 'hard' }));
  simulation.buildSnapshotCache();
  simulation.seek(19.75);
  assert.equal(simulation.pluginState.lightning[0].phase, 'telegraph');
  assert.ok(Math.abs(simulation.pluginState.current.x) > 1);
  assert.equal(simulation.pluginState.stormScale, 1);
  simulation.seek(20.55);
  assert.equal(simulation.pluginState.lightning[0].phase, 'strike');
  const strikeSnapshot = simulation.createSnapshot();
  const strikeHash = simulation.stateHash();
  simulation.seek(60);
  simulation.restore(strikeSnapshot);
  assert.equal(simulation.stateHash(), strikeHash, '번개 타격 상태 snapshot/restore가 정확해야 한다');
}

{
  const simulation = new Simulation(StageCompiler.compile(stage6Source, { difficulty: 'normal' }));
  simulation.buildSnapshotCache();
  simulation.seek(52);
  assert.ok(simulation.pluginState.stormScale < 0.25, '50초대 회복 구간은 해류가 약해져야 한다');
  simulation.seek(65);
  assert.ok(simulation.pluginState.current.x < -20, '후반 돌입 전 해류 반전이 화면에서 읽혀야 한다');
  simulation.seek(99);
  assert.ok(simulation.pluginState.current.x > 20, '최종 낙뢰 스윕 전에는 해류가 오른쪽으로 전환되어야 한다');

  simulation.seek(14.9);
  const beforeBolt = { ...simulation.pluginState.current };
  simulation.seek(15.25);
  assert.equal(simulation.pluginState.lightning[0].phase, 'telegraph');
  assert.ok(Math.abs(simulation.pluginState.current.x - beforeBolt.x) < 3,
    '낙뢰 예고 중 해류는 안전지대가 밀리지 않도록 직전 값에 고정되어야 한다');
}

{
  const chaseStage = StageCompiler.clone(source);
  const ride = chaseStage.items.find(item => item.id === 's3-ride-01');
  ride.payload.params = {
    ...ride.payload.params,
    playerInvulnerable: false,
    taxiDurability: 3,
    bulletClearOnStart: { enabled: false },
    pearlTrail: { ...ride.payload.params.pearlTrail, enabled: false, streamLoosePearls: false },
    pearlRing: { ...ride.payload.params.pearlRing, enabled: false },
    exitBehavior: 'silent',
  };
  const simulation = new Simulation(StageCompiler.compile(chaseStage, { difficulty: 'normal' }));
  simulation.seek(36);
  assert.equal(simulation.ride.durability, 3);
  assert.equal(simulation.player.invulnerable, false);
  assert.equal(simulation.ride.nextTrail, null);
  assert.equal(simulation.ride.nextRing, null);
}

{
  const overlapStage = StageCompiler.clone(source);
  const ride = overlapStage.items.find(item => item.id === 's3-ride-01');
  ride.timing.duration = 30;
  const boss = overlapStage.items.find(item => item.type === 'boss');
  boss.timing.start = 50;
  const simulation = new Simulation(StageCompiler.compile(overlapStage, { difficulty: 'easy' }));
  simulation.seek(49.9);
  assert.ok(simulation.ride);
  simulation.seek(50);
  assert.equal(simulation.ride, null, '보스 시작과 겹친 보너스 택시는 미리보기에서도 종료되어야 한다');
  assert.equal(simulation.player.invulnerable, false);
}

console.log('stage plugin: ok');
