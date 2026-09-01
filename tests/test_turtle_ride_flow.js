'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

{
  const mainSource = read('js/main.js');
  assert.ok(
    mainSource.includes('this.ride?.params?.scrollMultiplier ?? (this.stageRuntimeState?.scrollMultiplier ?? 1)'),
    '활성 택시의 속도 배율이 데이터 런타임 환경 기본값보다 우선해야 한다',
  );
}

// 택시 탑승 중에는 적이 떨어뜨린 일반 진주도 트레일 진주와 같은 속도로 흐른다.
{
  const context = vm.createContext({
    console,
    Game: { ride: {} },
    Meta: { armorCharges: () => 0 },
  });
  vm.runInContext(read('js/config.js'), context, { filename: 'js/config.js' });
  vm.runInContext(`${read('js/entities.js')}\nglobalThis.PearlForTest = Pearl; globalThis.PlayerForTest = Player;`, context, {
    filename: 'js/entities.js',
  });

  const Pearl = context.PearlForTest;
  const player = { x: 0, y: 0, bubble: 0 };
  const dropped = new Pearl(400, 200, { vx: 12, vy: 20 });
  dropped.update(0.1, player);
  assert.equal(dropped.vx, -330);
  assert.equal(dropped.x, 367);

  context.Game.ride = { params: { pearlTrail: { streamLoosePearls: false } } };
  const disabledStream = new Pearl(400, 200, { vx: 12, vy: 20 });
  disabledStream.update(0.1, player);
  assert.notEqual(disabledStream.vx, -330, '추격 택시는 일반 진주 고속 이동을 끌 수 있다');

  context.Game.ride = null;
  const normal = new Pearl(400, 200, { vx: 12, vy: 20 });
  normal.update(0.1, player);
  assert.notEqual(normal.vx, -330, '택시 밖의 진주 흐름은 기존 속도를 유지한다');

  const rider = new context.PlayerForTest();
  rider.level = 1;
  let absorbed = 0;
  const game = { absorbRideHit() { absorbed++; return true; } };
  assert.equal(rider.hit(game), true);
  assert.equal(absorbed, 1, '유한 내구도 택시는 플레이어 피격보다 먼저 충격을 흡수한다');
  assert.equal(rider.bubble, 0);
}

// 거북이 고속도로만 모든 배경 레이어와 광선의 스크롤을 25% 빠르게 한다.
{
  const context = vm.createContext({
    console,
    CFG: { pxUnit: 2 },
    Assets: { ready: () => true, image: () => ({}) },
  });
  vm.runInContext(`${read('js/backgroundRenderer.js')}\nglobalThis.BackgroundsForTest = Backgrounds;`, context, {
    filename: 'js/backgroundRenderer.js',
  });

  const backgrounds = context.BackgroundsForTest;
  const scrolls = [];
  backgrounds.drawStrip = (_ctx, _image, scroll) => scrolls.push(scroll);
  backgrounds.drawLight = (_ctx, _game, _u, _palette, scroll) => scrolls.push(scroll);
  backgrounds.drawMotes = () => {};
  const ctx = { save() {}, restore() {}, imageSmoothingEnabled: true };

  backgrounds.draw(ctx, { stageIdx: 2, state: 'play', scroll: 100 });
  assert.deepEqual(scrolls, [125, 125, 125, 125, 125]);

  scrolls.length = 0;
  backgrounds.draw(ctx, { stageIdx: 0, state: 'play', scroll: 100 });
  assert.deepEqual(scrolls, [100, 100, 100, 100, 100]);
}

console.log('turtle ride flow: ok');
