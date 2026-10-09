'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const DolphinHints = require('../js/dolphinHints.js');
const root = path.resolve(__dirname, '..');
const viewport = { W: 960, H: 540 };
const context = vm.createContext({ console, Math, Sound: { sfx() {} }, Assets: {}, Sprites: {} });
for (const file of ['js/config.js', 'js/stage/enemyState.js', 'js/entities.js', 'js/boss2.js', 'js/boss4.js', 'js/boss6.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}
vm.runInContext('globalThis.Subjects = { Enemy, BossMongsil, BossChorong, BossUreu };', context);
const { Enemy, BossMongsil, BossChorong, BossUreu } = context.Subjects;

function makeGame() {
  return {
    state: 'play', dolphin: { type: 'homing', lv: 1 }, player: { x: 180, y: 270, bubble: 0 },
    ebullets: [], enemies: [], bolts: [], fx: [], spawner: { pending: [] },
    diff: 0, D: { bossInt: 1 }, stageT: 120,
    clearBulletsToPearls() { this.ebullets = []; },
    message() {}, say() {}, addBattery() {}, phaseReward() {}, bossRing() {}, addFx() {},
  };
}
const mine = (timer, x = 360) => ({ kind: 'mine', timer, x, y: 270, r: 7 });

function captureMarkers(hints) {
  const rectangles = [], corners = [];
  hints.drawMarkers({
    save() {}, restore() {}, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {},
    strokeRect(...bounds) { rectangles.push(bounds); }, stroke() { corners.push(true); },
  });
  return { rectangles, corners };
}

{
  const game = makeGame(), hints = new DolphinHints();
  const first = mine(1.2), later = mine(1.8);
  game.ebullets = [later, first, mine(0.1, -1), { ...mine(0.1), dead: true }, mine(NaN)];
  hints.update(0.1, game, viewport);
  assert.deepEqual(hints.cue.targets, [first], '가장 먼저 터질 등불만 표시하고 화면 밖·소거된 등불은 제외');
  assert.equal(hints.speech.text, '저 등불부터 터져!');
  assert.equal(captureMarkers(hints).corners.length, 1);
  first.timer = 2;
  hints.update(0.1, game, viewport);
  assert.deepEqual(hints.cue.targets, [later], '신관 편집 결과를 매번 다시 읽는다');
  game.ebullets = [];
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null, '소나 소거 뒤 표식과 대사가 즉시 사라진다');
  assert.equal(hints.speech, null);
  game.ebullets = [mine(1.4)];
  hints.update(20, game, viewport);
  assert.ok(hints.cue);
  assert.equal(hints.speech, null, '같은 출격의 반복 등불은 짧은 표식만 제공');
}

{
  const game = makeGame(), hints = new DolphinHints();
  const first = mine(1.2), tied = { ...mine(1.2005, 410), y: 340 }, later = mine(1.8);
  game.ebullets = [later, first, tied];
  hints.update(0.1, game, viewport);
  assert.deepEqual(hints.cue.targets, [first, tied], '동시 폭발 묶음 전체를 선택한다');
  assert.equal(hints.speech.text, '표시된 등불이 함께 터져!');
  assert.equal(hints.cue.short, '등불 동시 폭발 · 1.2초');
  assert.deepEqual(hints.cue.rows, [], '흩어진 동시 폭발을 한 줄이라고 부르지 않는다');
  assert.equal(captureMarkers(hints).corners.length, 2);
  tied.y = first.y;
  hints.update(0.1, game, viewport);
  assert.deepEqual(hints.cue.rows, [], '높이가 우연히 같아도 패턴의 줄 정보 없이는 묶지 않는다');
  first.timer = 2; tied.timer = 2;
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.text, '저 등불부터 터져!');
  assert.equal(hints.speech, null, '묶음이 단일 등불로 바뀌면 기존 동시 폭발 대사를 즉시 지운다');
  hints.update(6, game, viewport);
  assert.equal(hints.speech.text, '저 등불부터 터져!', '순차 폭발 설명은 별도로 한 번 제공한다');
}

for (const [diff, phase, rowCount] of [[0, 3, 1], [1, 3, 1], [2, 3, 1], [2, 4, 2]]) {
  const game = makeGame(), hints = new DolphinHints();
  game.diff = diff;
  game.boss = new BossMongsil(game);
  game.boss.phase = phase;
  game.boss.gardenRow = 2; // 하드의 아래→위 두 줄도 빈 가운데 줄을 묶으면 안 된다.
  game.boss.gardenT = 0;
  game.boss.curtainT = 5;
  game.boss.update(0.01);
  hints.update(0.01, game, viewport);
  assert.equal(hints.cue.kind, 'mine');
  assert.equal(hints.cue.targets.length, (5 + diff) * rowCount, '실제 몽실 정원의 동시 폭발 줄 전체를 표시');
  assert.ok(hints.cue.targets.every(target => game.ebullets.includes(target)));
  assert.equal(hints.cue.rows.length, rowCount);
  assert.equal(hints.speech.text, rowCount === 1 ? '저 줄이 한꺼번에 터져!' : '저 두 줄이 함께 터져!');
  assert.equal(hints.cue.short, `${rowCount}줄 동시 폭발 · 1.4초`);
  const drawing = captureMarkers(hints);
  assert.equal(drawing.rectangles.length, rowCount, '각 줄은 하나의 테두리로 표시');
  assert.equal(drawing.corners.length, 0, '줄에는 개별 등불 표식을 중복하지 않는다');
  for (const [index, [x, y, width, height]] of drawing.rectangles.entries()) {
    assert.ok([x, y, width, height].every(value => value % 2 === 0), '월드 픽셀 격자에 스냅');
    assert.ok(height <= 52, '위아래 픽셀 스냅 여유를 포함해도 다른 줄이나 그 사이 공간을 감싸지 않는다');
    assert.ok(width > 650, '점선이 줄의 양 끝 등불까지 감싼다');
    assert.ok(hints.cue.rows[index].every(target => target.x >= x && target.x <= x + width
      && target.y >= y && target.y <= y + height));
  }
  const later = { ...game.ebullets[0], timer: 2 };
  game.ebullets.push(later);
  hints.update(0.1, game, viewport);
  assert.ok(!hints.cue.targets.includes(later), '같은 줄이어도 신관이 다르면 함께 묶지 않는다');
  game.ebullets = [game.ebullets[0]];
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.text, '저 등불부터 터져!', '소거 후 한 개만 남으면 줄 안내를 해제');
  assert.equal(hints.speech, null);
  assert.equal(captureMarkers(hints).rectangles.length, 0);
  assert.equal(captureMarkers(hints).corners.length, 1);
  game.ebullets = [];
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null);
}

{
  const game = makeGame(), hints = new DolphinHints();
  game.boss = new BossMongsil(game);
  game.boss.phase = 3; game.boss.gardenT = 0; game.boss.curtainT = 5;
  game.boss.update(0.01);
  hints.update(0.01, game, viewport);
  game.diff = 2;
  game.boss.phase = 4; game.boss.gardenT = 0;
  game.ebullets = [];
  game.boss.update(0.01);
  hints.update(0.01, game, viewport);
  assert.equal(hints.speech, null, '두 줄로 바뀌면 한 줄이라는 기존 대사는 지운다');
  assert.equal(hints.cue.short, '2줄 동시 폭발 · 1.4초', '대사 간격 중에도 현재 줄 개수는 정확히 표시');
  hints.update(6, game, viewport);
  assert.equal(hints.speech.text, '저 두 줄이 함께 터져!');
}

{
  const game = makeGame(), hints = new DolphinHints();
  game.boss = new BossChorong(game);
  game.boss.enterSurvival();
  const viper = new Enemy({ kind: 'viper', M: 1, S: 0, hp: 3, spd: 0, x: 450, y: 270, dirX: -1, dirY: 0,
    chorongSurvival: true, params: { revealDelay: 0.8, glintDuration: 0.55 } });
  game.enemies.push(viper);
  hints.update(0.1, game, viewport);
  assert.equal(hints.speech.text, '독니를 잡으면 빨리 끝나!');
  assert.equal(hints.cue.targets.length, 0, '잠복 적의 위치는 누설하지 않는다');
  viper.update(1, game);
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.targets.length, 0, '안광 예고 중에는 공격하라는 표식을 달지 않는다');
  viper.update(0.5, game);
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.targets[0], viper);
  const before = game.boss.survivalT;
  game.boss.onEnemyKilled(viper);
  viper.dead = true;
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.targets.length, 0);
  assert.ok(hints.cue.short.includes((before - 0.7).toFixed(1)), '실제 단축된 생존 시간을 읽는다');
  game.boss.enterPhase(3);
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null, '생존전 종료와 동시에 안내 종료');
}

{
  const game = makeGame(), hints = new DolphinHints();
  game.boss = new BossUreu(game);
  game.boss.enterPhase(3);
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.direction, 1);
  assert.equal(hints.speech.text, '곧 오른쪽으로 밀려!');
  assert.ok(game.boss.dolphinHint().remaining > 1.8, '첫 강한 해류는 페이즈 전환부터 알려준다');
  game.boss.transitionT = 0;
  game.boss.updateUndertow(0.71);
  hints.update(0.1, game, viewport);
  assert.equal(hints.speech, null, '해류 시작 뒤에는 곧 온다는 예고 문구를 남기지 않는다');
  assert.equal(hints.cue.short, '지금 해류 →');
  game.boss.updateUndertow(1.21);
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.direction, -1);
  assert.equal(hints.cue.short, '곧 해류 ←');
  assert.ok(game.boss.dolphinHint().remaining >= 1.7, '회복부터 다음 반전을 미리 표시');
  game.boss.updateUndertow(1.01);
  assert.equal(game.boss.undertowDir, hints.cue.direction, '예고 방향과 실제 다음 해류가 일치');
  game.ebullets = [mine(0.5)];
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.kind, 'mine', '폭발 직전의 등불은 해류보다 우선');
  assert.equal(hints.speech, null, '동시 위험에도 대사를 연달아 쏟아내지 않는다');
  game.ebullets = [];
  game.boss.dead = true;
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null);
}

for (const type of ['homing', 'burst', 'pierce']) {
  const game = makeGame(), hints = new DolphinHints();
  game.dolphin = { type, lv: 1 };
  game.ebullets = [mine(1)];
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue.kind, 'mine', '종류와 레벨에 무관하게 같은 정보를 제공');
  const time = hints.time;
  game.paused = true;
  hints.update(10, game, viewport);
  assert.equal(hints.time, time);
  game.paused = false;
  game.player.bubble = 1;
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null, '피격 복귀 중 전투 안내를 감춘다');
  game.player.bubble = 0;
  game.dolphin = null;
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null);
  game.dolphin = { type, lv: 1 };
  game.state = 'victory';
  hints.update(0.1, game, viewport);
  assert.equal(hints.cue, null);
  const nextRun = new DolphinHints();
  game.state = 'play';
  nextRun.update(0.1, game, viewport);
  assert.ok(nextRun.speech, '재출격 시 첫 설명은 다시 제공');
}

console.log('dolphin tactical hints: ok');
