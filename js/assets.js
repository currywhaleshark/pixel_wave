// ============================================================
// assets.js — 스프라이트 시트 · 프레임 · 앵커 · 애니메이션 정의 (단일 진실 원천)
//
// 좌표 단위는 전부 "월드 픽셀"(480×270 기준). 게임 좌표로는 ×CFG.pxUnit(=2)로 확대되어 그려진다.
// 시트 파일이 없으면 Assets.ready()가 false → 각 엔티티는 기존 도형(폴백)으로 그린다.
// 즉 아트가 준비된 항목부터 하나씩 자연스럽게 교체된다.
//
// 시트 규격은 docs/ART_SPEC.md 참고. 프레임은 가로로 이어 붙인다(x + i*w).
// ============================================================
const SHEETS = {
  main: 'assets/sprites.png?v=8',   // 잡몹·플레이어·돌고래·탄·진주
  boss: 'assets/bosses.png?v=7',    // 보스 7종
  bossUreu: 'assets/boss-ureu.png?v=2',
  bossHwii: 'assets/boss-hwii.png?v=1',
  bossHwiiArm: 'assets/boss-hwii-arm.png?v=1',
  'screen.title': 'assets/screens/title-background.png?v=1',
  'stage5.buuHull': 'assets/backgrounds/stage5-buu-hull.png?v=1',
  'background.stage1.sea': 'assets/backgrounds/stage1-sea-strip.png?v=1',
  'background.stage1.far': 'assets/backgrounds/stage1-far-strip.png?v=8',
  'background.stage1.mid': 'assets/backgrounds/stage1-mid-strip.png?v=8',
  'background.stage1.near': 'assets/backgrounds/stage1-near-strip.png?v=8',
  'background.stage2.sea': 'assets/backgrounds/stage2-sea-strip.png?v=1',
  'background.stage2.far': 'assets/backgrounds/stage2-far-strip.png?v=2',
  'background.stage2.mid': 'assets/backgrounds/stage2-mid-strip.png?v=2',
  'background.stage2.near': 'assets/backgrounds/stage2-near-strip.png?v=2',
  'background.stage3.sea': 'assets/backgrounds/stage3-sea-strip.png?v=2',
  'background.stage3.far': 'assets/backgrounds/stage3-far-strip.png?v=1',
  'background.stage3.mid': 'assets/backgrounds/stage3-mid-strip.png?v=1',
  'background.stage3.near': 'assets/backgrounds/stage3-near-strip.png?v=1',
  'background.stage4.sea': 'assets/backgrounds/stage4-sea-strip.png?v=1',
  'background.stage4.far': 'assets/backgrounds/stage4-far-strip.png?v=1',
  'background.stage4.mid': 'assets/backgrounds/stage4-mid-strip.png?v=1',
  'background.stage4.near': 'assets/backgrounds/stage4-near-strip.png?v=1',
  'background.stage5.sea': 'assets/backgrounds/stage5-sea-strip.png?v=1',
  'background.stage5.far': 'assets/backgrounds/stage5-far-strip.png?v=1',
  'background.stage5.mid': 'assets/backgrounds/stage5-mid-strip.png?v=1',
  'background.stage5.near': 'assets/backgrounds/stage5-near-strip.png?v=1',
  'background.stage6.sea': 'assets/backgrounds/stage6-sea-strip.png?v=1',
  'background.stage6.far': 'assets/backgrounds/stage6-far-strip.png?v=1',
  'background.stage6.mid': 'assets/backgrounds/stage6-mid-strip.png?v=1',
  'background.stage6.near': 'assets/backgrounds/stage6-near-strip.png?v=1',
  'background.stage7.sea': 'assets/backgrounds/stage7-sea-strip.png?v=1',
  'background.stage7.far': 'assets/backgrounds/stage7-far-strip.png?v=1',
  'background.stage7.mid': 'assets/backgrounds/stage7-mid-strip.png?v=1',
  'background.stage7.near': 'assets/backgrounds/stage7-near-strip.png?v=1',
};

// id: { sheet, x, y, w, h, frames, fps, ax, ay }
//   x,y  = 시트 안 첫 프레임의 좌상단 (월드 픽셀)
//   w,h  = 프레임 크기
//   ax,ay= 앵커 (스프라이트 안에서 "엔티티 중심"에 해당하는 점)
//   fps  = 0이면 정지 프레임
//   on   = 아트 완성 여부. false면 이 항목만 도형 폴백을 쓴다.
//          → 시트에 그린 캐릭터부터 하나씩 true로 켜면서 점진 교체한다.
//            (시트 로드만 보고 판단하면, 아직 안 그린 칸이 투명하게 그려져 적이 사라진다)
const SPRITES = {
  // ---- 플레이어 ----
  'mermaid.swim':   { sheet: 'main', x: 0,   y: 0,  w: 36, h: 24, frames: 4, fps: 5,  ax: 18, ay: 12, on: true },
  'mermaid.bubble': { sheet: 'main', x: 144, y: 0,  w: 24, h: 24, frames: 2, fps: 4,  ax: 12, ay: 12, on: true },

  // ---- 돌고래 (옵션) ----
  'dolphin.homing': { sheet: 'main', x: 0,   y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: true },
  'dolphin.burst':  { sheet: 'main', x: 36,  y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: true },
  'dolphin.pierce': { sheet: 'main', x: 72,  y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: true },

  // ---- 잡몹 (kind 이름과 1:1) ----
  'enemy.fish':     { sheet: 'main', x: 0,   y: 40, w: 16, h: 10, frames: 2, fps: 8,  ax: 8,  ay: 5,  on: true },
  'enemy.jelly':    { sheet: 'main', x: 32,  y: 40, w: 16, h: 20, frames: 2, fps: 4,  ax: 8,  ay: 6,  on: true },
  'enemy.ray':      { sheet: 'main', x: 64,  y: 36, w: 32, h: 26, frames: 2, fps: 6,  ax: 16, ay: 13, on: true },
  'enemy.turret':   { sheet: 'main', x: 136, y: 40, w: 16, h: 14, frames: 1, fps: 0,  ax: 8,  ay: 7,  on: true },
  'enemy.lantern':  { sheet: 'main', x: 0,   y: 64, w: 18, h: 24, frames: 2, fps: 4,  ax: 9,  ay: 8,  on: true },
  'enemy.viper':    { sheet: 'main', x: 36,  y: 64, w: 20, h: 10, frames: 2, fps: 8,  ax: 10, ay: 5,  on: true },
  'enemy.ghost':    { sheet: 'main', x: 76,  y: 64, w: 14, h: 12, frames: 2, fps: 4,  ax: 7,  ay: 6,  on: true },
  'enemy.big':      { sheet: 'main', x: 0,   y: 96, w: 32, h: 24, frames: 2, fps: 4,  ax: 16, ay: 12, on: true },
  'enemy.wreck':    { sheet: 'main', x: 64,  y: 96, w: 40, h: 32, frames: 4, fps: 0,  ax: 20, ay: 16, on: true },
  'turtle.taxi':    { sheet: 'main', x: 0,   y: 128, w: 32, h: 20, frames: 2, fps: 6, ax: 16, ay: 10, on: true },

  // ---- 진주 · 탄 ----
  'pearl.small':    { sheet: 'main', x: 0,   y: 152, w: 6,  h: 6,  frames: 1, fps: 0, ax: 3,  ay: 3,  on: true },
  'pearl.big':      { sheet: 'main', x: 8,   y: 152, w: 10, h: 10, frames: 1, fps: 0, ax: 5,  ay: 5,  on: true },
  'bullet.bubble':  { sheet: 'main', x: 24,  y: 152, w: 8,  h: 8,  frames: 1, fps: 0, ax: 4,  ay: 4,  on: true },
  'bullet.spike':   { sheet: 'main', x: 32,  y: 152, w: 8,  h: 8,  frames: 1, fps: 0, ax: 4,  ay: 4,  on: true },
  'bullet.mine':    { sheet: 'main', x: 40,  y: 152, w: 10, h: 10, frames: 2, fps: 8, ax: 5,  ay: 5,  on: true },
  'bullet.star':    { sheet: 'main', x: 64,  y: 152, w: 10, h: 10, frames: 2, fps: 6, ax: 5,  ay: 5,  on: true },
  'shot.wave':      { sheet: 'main', x: 88,  y: 152, w: 10, h: 6,  frames: 1, fps: 0, ax: 5,  ay: 3,  on: true },

  // ---- 보스 (별도 시트) ----
  'boss.pangpang':  { sheet: 'boss', x: 0,   y: 0,   w: 48, h: 48, frames: 2, fps: 4, ax: 24, ay: 24, on: true },
  'boss.mongsil':   { sheet: 'boss', x: 96,  y: 0,   w: 48, h: 56, frames: 2, fps: 4, ax: 24, ay: 24, on: true },
  'boss.ssing':     { sheet: 'boss', x: 0,   y: 64,  w: 56, h: 40, frames: 2, fps: 6, ax: 28, ay: 20, on: true },
  'boss.chorong':   { sheet: 'boss', x: 112, y: 64,  w: 56, h: 48, frames: 2, fps: 4, ax: 28, ay: 24, on: true },
  // 부우의 좌표 기준은 머리 중심이 아니라 목 끝의 중심선이다. 몸통 궤적과 바로 이어진다.
  'boss.buu':       { sheet: 'boss', x: 0,   y: 128, w: 40, h: 32, frames: 2, fps: 6, ax: 20, ay: 21, on: true },
  'boss.buuHull':   { sheet: 'stage5.buuHull', x: 0, y: 0, w: 64, h: 250, frames: 1, fps: 0, ax: 32, ay: 125, on: true },
  // 우르릉은 머리 중심을 앵커로 삼는 세로형 전신 스프라이트다. 피탄 판정은 기존 머리 원형 그대로다.
  'boss.ureu':      { sheet: 'bossUreu', x: 0, y: 0, w: 48, h: 128, frames: 4, fps: 4, ax: 20, ay: 23, on: true },
  // 눈알은 코드로 아래에 그리고, 이 시트는 구름과 눈꺼풀만 위에 덮는다.
  'boss.hwii':      { sheet: 'bossHwii', x: 0, y: 0, w: 64, h: 64, frames: 4, fps: 0, ax: 32, ay: 32, on: true },
  // 왼쪽 뿌리가 중심핵 아래에 묻히도록 앵커를 잡은 모듈형 나선 구름 팔.
  'boss.hwiiArm':   { sheet: 'bossHwiiArm', x: 0, y: 0, w: 72, h: 40, frames: 2, fps: 4, ax: 6, ay: 20, on: true },
};

// ---- 항해도 해역 아이콘 (24×24 × 7, 가로 일렬) ----
// assets/stage-icons.png 가 준비되면 각 항목 on: true 로 켠다. 그 전엔 자리 표시 프레임.
SHEETS.icons = 'assets/stage-icons.png?v=1';
for (let i = 1; i <= 7; i++) {
  SPRITES[`icon.stage${i}`] = { sheet: 'icons', x: (i - 1) * 24, y: 0, w: 24, h: 24, frames: 1, fps: 0, ax: 12, ay: 12, on: false };
}

const Assets = {
  images: {},     // sheet id → { img, ok }
  loaded: false,

  load() {
    for (const [id, path] of Object.entries(SHEETS)) {
      const rec = { img: new Image(), ok: false };
      rec.img.onload = () => {
        rec.ok = true;
        this.loaded = true;
        console.log(`[assets] ${id} 로드: ${path} (${rec.img.width}×${rec.img.height})`);
      };
      // 파일이 아직 없는 건 정상 — 도형 폴백으로 계속 플레이 가능
      rec.img.onerror = () => { rec.ok = false; };
      rec.img.src = path;
      this.images[id] = rec;
    }
  },

  ready(sheetId) {
    const rec = this.images[sheetId];
    return !!(rec && rec.ok);
  },
  image(sheetId) { return this.images[sheetId].img; },

  // 이 스프라이트를 그릴 수 있는가 (아트 완성 + 시트 로드 둘 다여야 함)
  has(id) {
    const s = SPRITES[id];
    return !!(s && s.on && this.ready(s.sheet));
  },
};

Assets.load();
