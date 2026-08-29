// ============================================================
// bombs.js — 조개폰 봄(폭탄) 8종
//
// 기본 「소나 펄스」는 작은 범위 탄 소거.
// 보스를 격파할 때마다 그 보스 컨셉의 강화 봄이 해금되고,
// 항해도에서 돌고래처럼 하나를 골라 출격한다.
//
// 설계 원칙: 강화 봄은 "더 센 소나"가 아니라 **성격이 다른 선택지**다.
//   넓이(휘이) / 무적(부우) / 화력(우르릉) / 지속(몽실) / 기동(씽씽) 처럼
//   각자 잘 듣는 상황이 달라야 고르는 재미가 생긴다.
// ============================================================
const BOMB_DEFS = {
  // ---- 기본 (항상 보유) ----
  sonar: {
    name: '소나 펄스', color: '#7dffd8', unlock: null,
    desc: '내 주변의 적탄을 진주로 바꾼다',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 1.6);
      g.clearBulletsRadius(p.x, p.y, 210, true);
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.55, maxLife: 0.55, r: 210, color: '125,255,216' });
      Sound.sfx('sonar');
      g.message('소나 펄스!', '#7dffd8');
    },
  },

  // ---- 1. 팡팡: 부풀었다 터지는 가시 ----
  spike: {
    name: '가시 폭발', color: '#ffd76e', unlock: 'stage1',
    desc: '중간 범위 탄 소거 + 사방으로 관통 가시',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 1.6);
      g.clearBulletsRadius(p.x, p.y, 260, true);
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.5, maxLife: 0.5, r: 260, color: '255,215,110' });
      for (let i = 0; i < 12; i++) {          // 관통 가시 — 적에게 피해
        const a = (i / 12) * 6.28;
        g.shots.push({
          kind: 'beam', x: p.x, y: p.y,
          vx: Math.cos(a) * 460, vy: Math.sin(a) * 460,
          dmg: 6, pierce: 999, r: 5, t: 0,
        });
      }
      Sound.sfx('sonar');
      g.message('가시 폭발!', '#ffd76e');
    },
  },

  // ---- 2. 몽실: 시간차로 켜지는 등불 ----
  lantern: {
    name: '등불 정원', color: '#c9a3ff', unlock: 'stage2',
    desc: '등불 3개를 놓아 시간차로 터뜨린다 — 소거 + 범위 피해',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 2.2);
      g.clearBulletsRadius(p.x, p.y, 150, true);
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.45, maxLife: 0.45, r: 150, color: '201,163,255' });
      for (let i = 0; i < 3; i++) {
        const a = -0.6 + i * 0.6;
        g.bombLanterns.push({
          x: p.x + Math.cos(a) * 150, y: p.y + Math.sin(a) * 150,
          t: 0.5 + i * 0.45, r: 210,
        });
      }
      Sound.sfx('phase');
      g.message('등불 정원!', '#c9a3ff');
    },
  },

  // ---- 3. 씽씽: 특급 배송 대시 ----
  dash: {
    name: '특급 배송', color: '#8fa3e8', unlock: 'stage3',
    desc: '무적으로 돌진 — 지나간 길의 탄을 쓸고 적을 들이받는다',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 1.4);
      g.bombDash = { t: 0.55, dmgDone: new Set() };
      g.clearBulletsRadius(p.x, p.y, 130, true);
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.4, maxLife: 0.4, r: 130, color: '143,163,232' });
      Sound.sfx('ride');
      g.message('특급 배송!', '#8fa3e8');
    },
  },

  // ---- 4. 초롱: 빛으로 끌어당겨 삼킨다 ----
  lure: {
    name: '초롱 유인', color: '#7ee8e0', unlock: 'stage4',
    desc: '넓게 적탄을 빨아들여 진주로 삼킨다 (어둠도 잠시 걷힌다)',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 2.4);
      g.bombLure = { t: 1.6, x: p.x, y: p.y, r: 380 };
      Sound.sfx('sonar');
      g.message('초롱 유인!', '#7ee8e0');
    },
  },

  // ---- 5. 부우: 유령화 ----
  ghost: {
    name: '유령화', color: '#9fe8b8', unlock: 'stage5',
    desc: '탄은 지우지 않지만 3초간 완전 무적 (탄막을 그냥 통과)',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 3.0);
      g.bombGhost = 3.0;
      Sound.sfx('shield');
      g.message('유령화!', '#9fe8b8');
    },
  },

  // ---- 6. 우르릉: 전방 낙뢰 ----
  thunder: {
    name: '낙뢰', color: '#ffe9a8', unlock: 'stage6',
    desc: '작은 범위 탄 소거 + 전방으로 강력한 번개',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 1.6);
      g.clearBulletsRadius(p.x, p.y, 170, true);
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.4, maxLife: 0.4, r: 170, color: '255,233,168' });
      g.bombThunder = { t: 0.45, y: p.y, x0: p.x };
      // 전방 일직선 강타 (관통)
      g.shots.push({
        kind: 'beam', x: p.x + 20, y: p.y,
        vx: 1400, vy: 0, dmg: 60, pierce: 999, r: 16, big: true, t: 0,
      });
      g.flashT = Math.max(g.flashT, 0.2);
      g.shake = Math.max(g.shake, 0.35);
      Sound.sfx('bossDeath');
      g.message('낙뢰!', '#ffe9a8');
    },
  },

  // ---- 7. 휘이: 태풍의 눈 ----
  storm: {
    name: '태풍의 눈', color: '#b8d8f0', unlock: 'stage7',
    desc: '전 화면의 적탄을 진주로 바꾸고 전부 회수한다',
    use(g) {
      const p = g.player;
      p.invuln = Math.max(p.invuln, 2.6);
      for (const b of g.ebullets) {
        g.pearls.push(new Pearl(b.x, b.y, { life: 12, auto: true }));   // 자동 회수
      }
      g.ebullets = [];
      g.bolts = [];
      g.fx.push({ x: p.x, y: p.y, ring: true, life: 0.9, maxLife: 0.9, r: 1200, color: '184,216,240' });
      Sound.sfx('sonar');
      g.message('태풍의 눈!', '#b8d8f0');
    },
  },
};

const BOMB_ORDER = ['sonar', 'spike', 'lantern', 'dash', 'lure', 'ghost', 'thunder', 'storm'];

// 해금 여부 — 해당 해역을 한 번이라도 클리어했으면 사용 가능
function bombUnlocked(id) {
  const def = BOMB_DEFS[id];
  if (!def) return false;
  if (!def.unlock) return true;                 // 기본 봄
  if (typeof Game !== 'undefined' && Game.debug) return true;
  return Meta.clearedLevel(def.unlock) >= 0;
}
