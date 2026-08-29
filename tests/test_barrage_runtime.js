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
  const { bullets } = run(base({ type: 'fan', count: 1, angle: 0, speed: 50, motion: { acceleration: 50, angularVelocity: 90 } }));
  const bullet = bullets[0];
  BarrageRuntime.updateProjectile(bullet, 0.5, {});
  assert.ok(bullet.barrage.speed > 60, '가속도가 탄속을 높인다');
  assert.ok(bullet.vy > 0, '각속도가 탄의 진행 방향을 굽힌다');
}

{
  const { bullets } = run(base({ type: 'fan', count: 1, angle: 0, motion: { homingTurnRate: 180, homingDuration: 2 } }));
  const bullet = bullets[0];
  BarrageRuntime.updateProjectile(bullet, 0.25, { target: { x: 80, y: 150 } });
  assert.ok(bullet.barrage.heading > 0, '유도탄은 제한된 회전 속도로 목표를 향한다');
}

{
  const { bullets } = run(base({ type: 'fan', count: 1, actions: [{ type: 'spawn', at: 0.2, repeat: 2, interval: 0.2, count: 3, spread: 120, speed: 80 }] }));
  const spawned = [];
  const budget = { remaining: 20 };
  BarrageRuntime.updateProjectile(bullets[0], 0.25, { spawnBudget: budget, spawn: bullet => spawned.push(bullet) });
  BarrageRuntime.updateProjectile(bullets[0], 0.2, { spawnBudget: budget, spawn: bullet => spawned.push(bullet) });
  assert.equal(spawned.length, 6, '시간 행동은 이동 중 자탄을 반복해서 생성한다');
  assert.ok(spawned.every(bullet => bullet.barrage.depth === 1));
}

{
  const { bullets } = run(base({ type: 'fan', count: 1, speed: 100, actions: [
    { type: 'changeSpeed', at: 0.1, value: 0, relative: false },
    { type: 'changeDirection', at: 0.1, value: 90, relative: false },
    { type: 'vanish', at: 0.5 },
  ] }));
  const bullet = bullets[0];
  BarrageRuntime.updateProjectile(bullet, 0.2, {});
  assert.equal(bullet.barrage.speed, 0, '속도 변경 행동이 절대 속도를 적용한다');
  assert.ok(Math.abs(bullet.barrage.heading - Math.PI / 2) < 1e-6, '방향 변경 행동이 절대 각도를 적용한다');
  BarrageRuntime.updateProjectile(bullet, 0.25, {});
  BarrageRuntime.updateProjectile(bullet, 0.1, {});
  assert.equal(bullet.dead, true, '소멸 행동이 탄을 제거한다');
}

{
  const { bullets } = run(base({ type: 'laser', angle: 0, speed: 0, laserLength: 200, laserWidth: 20, laserTelegraph: 0.5, laserActive: 0.5, laserFade: 0.2 }));
  const laser = bullets[0];
  BarrageRuntime.updateProjectile(laser, 0.25, {});
  assert.equal(BarrageRuntime.laserHits(laser, { x: 120, y: 50 }, 3), false, '레이저 예고선은 무해하다');
  BarrageRuntime.updateProjectile(laser, 0.25, {});
  BarrageRuntime.updateProjectile(laser, 0.05, {});
  assert.equal(BarrageRuntime.laserHits(laser, { x: 120, y: 50 }, 3), true, '활성 레이저는 선분 전체에 충돌한다');
  BarrageRuntime.updateProjectile(laser, 0.25, {});
  BarrageRuntime.updateProjectile(laser, 0.25, {});
  BarrageRuntime.updateProjectile(laser, 0.2, {});
  assert.equal(laser.dead, true, '레이저는 예고·공격·소멸 수명이 끝나면 제거된다');
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
