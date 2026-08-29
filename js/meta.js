// ============================================================
// meta.js — 영구 데이터 (localStorage) + 세이브 섬 상점 카탈로그
// GDD 5.2: 공격력 영구 업그레이드는 팔지 않는다.
// ============================================================
const DOLPHIN_DEFS = {
  homing: { name: '파랑돌고래', label: '유도', color: '#5aa9ff',
            desc: '음파 링이 적을 쫓아감. 조준 불필요.' },
  burst:  { name: '분홍돌고래', label: '폭발', color: '#ff9ed2',
            desc: '기포탄이 범위 폭발. 잡몹 청소용.' },
  pierce: { name: '은빛돌고래', label: '관통', color: '#cfd8e8',
            desc: '초음파 빔이 직선 관통. 보스전 최고 화력.' },
};

const SHOP_ITEMS = [
  // 몸 (구제책)
  { id: 'necklace', cat: '몸', name: '진주 목걸이', desc: '격침될 피격을 판마다 1회 막아줌', cost: 600 },
  { id: 'fin1',     cat: '몸', name: '유선형 지느러미 I',  desc: '이동속도 +5%', cost: 320 },
  { id: 'fin2',     cat: '몸', name: '유선형 지느러미 II', desc: '이동속도 +5% (누적 10%)', cost: 800, req: 'fin1' },
  // 조개폰 (구제책)
  { id: 'battery3', cat: '조개폰', name: '배터리 확장', desc: '배터리 최대 2 → 3칸', cost: 480 },
  { id: 'charge1',  cat: '조개폰', name: '알뜰 충전기', desc: '시작 배터리 +1칸', cost: 400 },
  // 돌고래 (빌드의 몸통) — 타입×3레벨, 아래에서 생성
];
for (const type of ['homing', 'burst', 'pierce']) {
  const d = DOLPHIN_DEFS[type];
  const lvDesc = {
    homing: ['해금: 유도 음파 링', '강화: 링 2연발', '고유기: 피격 직전 자동 슬로우'],
    burst:  ['해금: 범위 폭발 기포탄', '강화: 폭발 범위 1.5배', '고유기: 폭발이 적탄 소거'],
    pierce: ['해금: 관통 초음파 빔', '강화: 빔 위력 업', '고유기: 주기적 더블 파도'],
  }[type];
  for (let lv = 1; lv <= 3; lv++) {
    SHOP_ITEMS.push({
      id: `${type}${lv}`, cat: '돌고래', dolphin: type, lv,
      name: `${d.name} Lv${lv}`, desc: lvDesc[lv - 1],
      cost: [400, 900, 1800][lv - 1],
      req: lv > 1 ? `${type}${lv - 1}` : undefined,
    });
  }
}

const Meta = {
  KEY: 'pixelwave_save_v1',
  data: null,

  defaults() {
    return {
      bank: 0,                                    // 영구 진주 (절대 안 잃음)
      owned: {},                                  // 구매한 업그레이드 id
      dolphinLv: { homing: 0, burst: 0, pierce: 0 },
      selected: null,                             // 출격 돌고래
      cleared: {},                                // 클리어한 해역
      audio: null,                                // 볼륨·음소거 (Sound가 관리)
      bombSel: 'sonar',                           // 선택한 봄 (bombs.js)
      best: {},                                   // 해역별 최고 점수
    };
  },

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(this.KEY));
      this.data = Object.assign(this.defaults(), raw || {});
      this.data.dolphinLv = Object.assign({ homing: 0, burst: 0, pierce: 0 }, this.data.dolphinLv);
      // 마이그레이션: 예전 클리어 기록(true) → 난이도 인덱스(0 = 이지)
      for (const k of Object.keys(this.data.cleared)) {
        if (this.data.cleared[k] === true) this.data.cleared[k] = 0;
      }
    } catch {
      this.data = this.defaults();
    }
  },

  // 해역별 최고 클리어 난이도 (-1 = 미클리어, 0=이지, 1=노멀, 2=하드)
  clearedLevel(stageId) {
    const v = this.data.cleared[stageId];
    if (v === true) return 0;
    return typeof v === 'number' ? v : -1;
  },
  bestFor(stageId) { return this.data.best?.[stageId] || 0; },
  // 최고 점수 갱신 시 true (클리어 시에만 기록 — 중도 포기는 점수 없음)
  recordScore(stageId, score) {
    if (!this.data.best) this.data.best = {};
    if (score > (this.data.best[stageId] || 0)) {
      this.data.best[stageId] = score;
      this.save();
      return true;
    }
    return false;
  },
  recordClear(stageId, diffIdx) {
    if (this.clearedLevel(stageId) < diffIdx) {
      this.data.cleared[stageId] = diffIdx;
      this.save();
    }
  },
  save() {
    try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch {}
  },

  has(id) { return !!this.data.owned[id]; },

  canBuy(item) {
    if (this.has(item.id)) return { ok: false, why: '보유 중' };
    if (item.req && !this.has(item.req)) return { ok: false, why: '이전 단계 필요' };
    if (this.data.bank < item.cost) return { ok: false, why: '진주 부족' };
    return { ok: true };
  },
  buy(item) {
    const c = this.canBuy(item);
    if (!c.ok) return c;
    this.data.bank -= item.cost;
    this.data.owned[item.id] = 1;
    if (item.dolphin) {
      this.data.dolphinLv[item.dolphin] = Math.max(this.data.dolphinLv[item.dolphin], item.lv);
      if (!this.data.selected) this.data.selected = item.dolphin; // 첫 해금 시 자동 선택
    }
    this.save();
    return { ok: true };
  },

  // 파생 스탯
  speedMult() { return 1 + (this.has('fin1') ? 0.05 : 0) + (this.has('fin2') ? 0.05 : 0); },
  batteryMax() { return this.has('battery3') ? 3 : 2; },
  batteryStart() { return Math.min(this.batteryMax(), 2 + (this.has('charge1') ? 1 : 0)); },
  armorCharges() { return this.has('necklace') ? 1 : 0; },
};
