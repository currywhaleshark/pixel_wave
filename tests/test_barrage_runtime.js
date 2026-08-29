'use strict';

const assert = require('node:assert/strict');
require('../js/barrage.js');

const base = (emitter, extras = {}) => ({
  version: 1,
  id: 'test-pattern',
  name: 'test',
  duration: 2,
  loop: false,
  seed: 42,
  emitters: [{
    id: 'test-emitter', name: 'test', enabled: true,
    start: 0, end: 0, interval: 1, burstCount: 1, burstGap: 0.1,
    source: 'boss', x: 0, y: 0, bulletKind: 'bubble', radius: 5,
    speed: 100, mineTimer: 2.2, difficultyCount: 0, difficultySpeed: 0,
    count: 3, angle: 180, angleStep: 0, spread: 30, aim: false,
    arms: 4, rotationSpeed: 60, xMin: 0, xMax: 100, yMin: 0, yMax: 0,
    axis: 'vertical', gapCount: 2, gapIndex: 1, gapStep: 0, jitter: 0,
    ...emitter,
  }],
  ...extras,
});

function run(pattern, difficulty = 0) {
  const bullets = [];
  const runner = new BarrageRuntime.Runner(pattern, { emit: bullet => bullets.push(bullet) });
  runner.update(0, { source: { x: 80, y: 50 }, target: { x: 0, y: 50 }, difficulty });
  return { bullets, runner };
}

{
  const { bullets } = run(base({ type: 'fan', aim: true, count: 3, spread: 30 }));
  assert.equal(bullets.length, 3);
  assert.equal(bullets[1].x, 80);
  assert.ok(bullets[1].vx < -99, '가운데 탄은 플레이어를 향해야 한다');
}

{
  const { bullets } = run(base({ type: 'ring', count: 8, difficultyCount: 2 }), 2);
  assert.equal(bullets.length, 12, '하드는 difficultyCount를 두 번 더한다');
}

{
  const first = run(base({ type: 'rain', count: 5, xMin: 10, xMax: 90 })).bullets;
  const second = run(base({ type: 'rain', count: 5, xMin: 10, xMax: 90 })).bullets;
  assert.deepEqual(first, second, '같은 시드는 같은 비 패턴을 만든다');
}

{
  const { bullets } = run(base({ type: 'wall', count: 10, gapCount: 3 }));
  assert.equal(bullets.length, 7, '벽의 빈 칸은 발사하지 않는다');
}

{
  const { bullets } = run(base({ type: 'fan', count: 1, bulletKind: 'mine', mineTimer: 3.5 }));
  assert.equal(bullets[0].timer, 3.5, '기뢰는 실제 게임 폭발에 필요한 타이머를 포함한다');
}

{
  const pattern = base({ type: 'ring', count: 4 }, { duration: 1, loop: true });
  const bullets = [];
  const runner = new BarrageRuntime.Runner(pattern, { emit: bullet => bullets.push(bullet) });
  runner.update(1.1, { source: { x: 0, y: 0 }, target: { x: 1, y: 0 }, difficulty: 0 });
  assert.equal(bullets.length, 8, '반복 경계를 넘으면 다음 주기의 0초 발사도 실행한다');
  assert.equal(runner.loops, 1);
}

assert.deepEqual(BarrageRuntime.validate(base({ type: 'fan' })), []);

{
  const localPattern = base({ type: 'ring', count: 9 }, { id: 'phone-pattern', name: 'phone' });
  global.localStorage = {
    getItem(key) { return key === BarrageRuntime.STORAGE_KEY ? JSON.stringify({ 'phone-pattern': localPattern }) : null; },
  };
  assert.equal(BarrageRuntime.get('phone-pattern').emitters[0].count, 9, '게임은 모바일 기기에 저장한 패턴을 우선해서 읽는다');
  delete global.localStorage;
}

console.log('barrage runtime: ok');
