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
  main: 'assets/sprites.png',   // 잡몹·플레이어·돌고래·탄·진주
  boss: 'assets/bosses.png',    // 보스 7종
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
  'mermaid.swim':   { sheet: 'main', x: 0,   y: 0,  w: 24, h: 16, frames: 4, fps: 8,  ax: 12, ay: 8,  on: false },
  'mermaid.bubble': { sheet: 'main', x: 96,  y: 0,  w: 24, h: 24, frames: 2, fps: 4,  ax: 12, ay: 12, on: false },

  // ---- 돌고래 (옵션) ----
  'dolphin.homing': { sheet: 'main', x: 0,   y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: false },
  'dolphin.burst':  { sheet: 'main', x: 36,  y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: false },
  'dolphin.pierce': { sheet: 'main', x: 72,  y: 24, w: 18, h: 10, frames: 2, fps: 6,  ax: 9,  ay: 5,  on: false },

  // ---- 잡몹 (kind 이름과 1:1) ----
  'enemy.fish':     { sheet: 'main', x: 0,   y: 40, w: 16, h: 10, frames: 2, fps: 8,  ax: 8,  ay: 5,  on: false },
  'enemy.jelly':    { sheet: 'main', x: 32,  y: 40, w: 16, h: 20, frames: 2, fps: 4,  ax: 8,  ay: 6,  on: false },
  'enemy.ray':      { sheet: 'main', x: 64,  y: 40, w: 20, h: 14, frames: 2, fps: 6,  ax: 10, ay: 7,  on: false },
  'enemy.turret':   { sheet: 'main', x: 104, y: 40, w: 16, h: 14, frames: 1, fps: 0,  ax: 8,  ay: 7,  on: false },
  'enemy.lantern':  { sheet: 'main', x: 0,   y: 64, w: 18, h: 24, frames: 2, fps: 4,  ax: 9,  ay: 8,  on: false },
  'enemy.viper':    { sheet: 'main', x: 36,  y: 64, w: 20, h: 10, frames: 2, fps: 8,  ax: 10, ay: 5,  on: false },
  'enemy.ghost':    { sheet: 'main', x: 76,  y: 64, w: 14, h: 12, frames: 2, fps: 4,  ax: 7,  ay: 6,  on: false },
  'enemy.big':      { sheet: 'main', x: 0,   y: 96, w: 32, h: 24, frames: 2, fps: 4,  ax: 16, ay: 12, on: false },
  'enemy.wreck':    { sheet: 'main', x: 64,  y: 96, w: 40, h: 32, frames: 1, fps: 0,  ax: 20, ay: 16, on: false },
  'turtle.taxi':    { sheet: 'main', x: 0,   y: 128, w: 32, h: 20, frames: 2, fps: 6, ax: 16, ay: 10, on: false },

  // ---- 진주 · 탄 ----
  'pearl.small':    { sheet: 'main', x: 0,   y: 152, w: 6,  h: 6,  frames: 1, fps: 0, ax: 3,  ay: 3,  on: false },
  'pearl.big':      { sheet: 'main', x: 8,   y: 152, w: 10, h: 10, frames: 1, fps: 0, ax: 5,  ay: 5,  on: false },
  'bullet.bubble':  { sheet: 'main', x: 24,  y: 152, w: 8,  h: 8,  frames: 1, fps: 0, ax: 4,  ay: 4,  on: false },
  'bullet.spike':   { sheet: 'main', x: 32,  y: 152, w: 8,  h: 8,  frames: 1, fps: 0, ax: 4,  ay: 4,  on: false },
  'bullet.mine':    { sheet: 'main', x: 40,  y: 152, w: 10, h: 10, frames: 2, fps: 8, ax: 5,  ay: 5,  on: false },
  'bullet.star':    { sheet: 'main', x: 64,  y: 152, w: 10, h: 10, frames: 2, fps: 6, ax: 5,  ay: 5,  on: false },
  'shot.wave':      { sheet: 'main', x: 88,  y: 152, w: 10, h: 6,  frames: 1, fps: 0, ax: 5,  ay: 3,  on: false },

  // ---- 보스 (별도 시트) ----
  'boss.pangpang':  { sheet: 'boss', x: 0,   y: 0,   w: 48, h: 48, frames: 2, fps: 4, ax: 24, ay: 24, on: false },
  'boss.mongsil':   { sheet: 'boss', x: 96,  y: 0,   w: 48, h: 56, frames: 2, fps: 4, ax: 24, ay: 24, on: false },
  'boss.ssing':     { sheet: 'boss', x: 0,   y: 64,  w: 56, h: 40, frames: 2, fps: 6, ax: 28, ay: 20, on: false },
  'boss.chorong':   { sheet: 'boss', x: 112, y: 64,  w: 56, h: 48, frames: 2, fps: 4, ax: 28, ay: 24, on: false },
  'boss.buu':       { sheet: 'boss', x: 0,   y: 128, w: 40, h: 32, frames: 2, fps: 6, ax: 20, ay: 16, on: false },
  'boss.ureu':      { sheet: 'boss', x: 80,  y: 128, w: 40, h: 40, frames: 2, fps: 6, ax: 20, ay: 20, on: false },
  'boss.hwii':      { sheet: 'boss', x: 0,   y: 176, w: 64, h: 64, frames: 4, fps: 8, ax: 32, ay: 32, on: false },
};

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
