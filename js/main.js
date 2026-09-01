// ============================================================
// main.js — 게임 루프 / 충돌 / 배경 / HUD / 상태 전환
// ============================================================
const canvas = document.getElementById('game');
const mainCtx = canvas.getContext('2d');
mainCtx.imageSmoothingEnabled = false;

// 월드 레이어: 480×270에 그린 뒤 2배 확대 (픽셀아트 규격)
const worldCanvas = document.createElement('canvas');
worldCanvas.width = CFG.WORLD_W;
worldCanvas.height = CFG.WORLD_H;
const worldCtx = worldCanvas.getContext('2d');
worldCtx.imageSmoothingEnabled = false;

// 현재 그리기 대상. 월드 구간에선 worldCtx로 바뀐다 (엔티티 코드는 그대로 게임 좌표를 쓴다)
let ctx = mainCtx;

// 화면 맞춤: 픽셀아트는 비정수 배율로 늘리면 픽셀이 뭉개진다.
// 월드(480×270)의 정수 배로만 표시하고, 그보다 작은 화면에서만 어쩔 수 없이 소수 배율.
function fitCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const exact = Math.min(vw / CFG.WORLD_W, vh / CFG.WORLD_H);
  const scale = exact >= 1 ? Math.floor(exact) : exact;
  canvas.style.width = `${Math.round(CFG.WORLD_W * scale)}px`;
  canvas.style.height = `${Math.round(CFG.WORLD_H * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);
fitCanvas();

Input.init(canvas);
Meta.load();
Sound.loadPrefs();
// boot 프레임이 타이틀곡을 예약하고, 첫 사용자 입력의 Sound.unlock()이
// 그 입력 허용 구간 안에서 곧바로 재생한다.

// M: 음소거 토글 (어느 화면에서나)
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'm') { Sound.toggleMute(); }
});

// ---- 오류 로그: 조용히 죽지 않게 화면에 띄운다 (루프가 멈추면 원인을 봐야 한다) ----
const ErrLog = {
  items: [],   // { msg, count }
  push(msg) {
    const last = this.items[this.items.length - 1];
    if (last && last.msg === msg) { last.count++; return; }
    this.items.push({ msg, count: 1 });
    if (this.items.length > 4) this.items.shift();
  },
  draw(ctx) {
    if (!this.items.length) return;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = Fonts.f(11);
    let y = CFG.H - 8 - this.items.length * 15;
    ctx.fillStyle = 'rgba(60,0,0,0.72)';
    ctx.fillRect(6, y - 12, CFG.W - 12, this.items.length * 15 + 8);
    for (const it of this.items) {
      ctx.fillStyle = '#ff9e9e';
      ctx.fillText(`⚠ ${it.msg}${it.count > 1 ? ` ×${it.count}` : ''}`.slice(0, 150), 12, y);
      y += 15;
    }
    ctx.restore();
  },
};
window.addEventListener('error', (e) => {
  ErrLog.push(`${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', (e) => ErrLog.push(`unhandled: ${e.reason}`));

const KIND_R = { fish: 10, jelly: 11, ray: 15, turret: 13, lantern: 13, big: 24, viper: 11, ghost: 10 };
const PEARL_DROP = { fish: 2, jelly: 2, ray: 4, turret: 5, lantern: 4, big: 10, viper: 3, ghost: 3 };
// 격파 기본 점수 (배율·난이도 적용 전)
const SCORE_KILL = { fish: 50, jelly: 50, ghost: 60, ray: 80, viper: 80, lantern: 80, turret: 100, big: 500 };

// 스테이지별 배경 팔레트 (해파리 초원 = 보랏빛 저녁, 고속도로 = 쨍한 청록)
const STAGE_BG = [
  { top: '#1c5bb8', mid: '#0e3d8f', bot: '#0a2461', coralFar: '#123a7d', coralNear: '#0d2a5e' },
  { top: '#4a3d9e', mid: '#2a2470', bot: '#160f45', coralFar: '#2d2470', coralNear: '#1d1755' },
  { top: '#17a0b8', mid: '#0e6aa8', bot: '#0a4183', coralFar: '#0e5592', coralNear: '#0a4078' },
  { top: '#0c1a42', mid: '#071130', bot: '#03081e', coralFar: '#0a1434', coralNear: '#050c26' },
  { top: '#1a4d4a', mid: '#10333a', bot: '#081f28', coralFar: '#0e2e33', coralNear: '#092127' },
  { top: '#5a7a9e', mid: '#2c3f61', bot: '#161f38', coralFar: '#20304e', coralNear: '#16233d' },
  { top: '#9e6a9e', mid: '#4a4a92', bot: '#202a60', coralFar: '#33306e', coralNear: '#252258' },
];

const Game = {
  debug: new URLSearchParams(location.search).has('debug'), // ?debug — 전 해역 해금 + 치트키
  barragePatternId: new URLSearchParams(location.search).get('barrage'), // 탄막 공방 실전 시험
  god: false,            // 디버그 무적 토글
  diff: 0,               // 난이도 인덱스 (DIFFS)
  D: DIFFS[0],
  state: 'boot',         // boot | title | map | play | victory | ending
  bootT: 0,              // 로딩 화면 경과 (에셋이 막혀도 6초 후 입장 허용)
  stageIdx: 0,           // 현재 해역 (STAGES 인덱스)
  player: null,
  enemies: [], shots: [], ebullets: [], pearls: [], fx: [], msgs: [], entryWarnings: [],
  explosions: [],
  boss: null, spawner: null,
  ride: null,            // 거북 택시 탑승 구간 {t, dur, ...}
  dolphin: null,         // 동행 옵션 (Meta.data.selected)
  groups: {},
  stageT: 0, scroll: 0,
  battery: 0, batteryMax: 2,
  slowT: 0,              // 유도 Lv3 자동 슬로우 타이머
  dark: 0, targetDark: 0, // 어둠 오버레이 (심해 스테이지)
  bombId: 'sonar',       // 선택된 봄 (bombs.js)
  replay: false,         // 이미 클리어한 해역 재도전 중인가
  stageTest: false,      // 시퀀서 초안 단독 시험 모드
  stageTestReturnUrl: null,
  // ---- 스코어 ----
  score: 0,              // 이번 런 점수
  mult: 1,               // 배율 (그레이즈·격파로 상승, 피격 시 반토막)
  grazeN: 0,             // 그레이즈 횟수
  bestAtStart: 0,        // 출격 시점의 해역 최고 점수 (HUD 표시용 — 런 중 갱신돼도 안 바뀜)
  bossScored: false,     // 보스 격파 점수 중복 방지
  phaseHitBase: 0,       // 페이즈 시작 시점의 피격 수 (무결 파도 판정)
  newBest: false,
  paused: false, pauseSel: 0, pauseView: 'menu',   // 일시정지 메뉴
  bombLanterns: [], bombDash: null, bombLure: null, bombGhost: 0, bombThunder: null,
  perf: { fps: 60, worst: 60, samples: 0, acc: 0 }, // 디버그 통계
  runLog: null,          // 런 기록 (잡몹 구간·보스전·페이즈별 시간)
  storm: false, stormScale: 1, curX: 0, curY: 0, surfaceY: 20, // 폭풍 해류 (폭풍 수면)
  bossCurrentOverride: null,
  bossCurrentField: null,
  stageRuntimeState: null,
  bolts: [], flashT: 0,   // 물속 번개
  stats: { pearls: 0, deaths: 0, bombs: 0, time: 0 },
  shake: 0,

  reset() {
    this.player = new Player();
    this.enemies = []; this.shots = []; this.ebullets = [];
    this.pearls = []; this.fx = []; this.msgs = [];
    this.entryWarnings = [];
    this.explosions = [];
    this.boss = null;
    this.ride = null;
    this.groups = {};
    this.stageT = 0;
    this.scroll = 0;
    this.slowT = 0;
    this.battery = Meta.batteryStart();
    this.batteryMax = Meta.batteryMax();
    const bsel = Meta.data.bombSel || 'sonar';
    this.bombId = bombUnlocked(bsel) ? bsel : 'sonar';
    this.paused = false; this.pauseView = 'menu';
    Input.pauseQueued = false; Input.bombQueued = false;   // 다른 화면에서 쌓인 잔여 입력 제거
    this.bombLanterns = []; this.bombDash = null; this.bombLure = null;
    this.bombGhost = 0; this.bombThunder = null;
    const sel = Meta.data.selected;
    this.dolphin = sel && Meta.data.dolphinLv[sel] > 0
      ? new Dolphin(sel, Meta.data.dolphinLv[sel]) : null;
    this.stats = { pearls: 0, deaths: 0, bombs: 0, time: 0 };
    // 런 기록: 실플레이 밸런스 측정용 (잡몹 구간 / 보스전 / 페이즈별 체류)
    this.runLog = { bossStart: null, phaseTime: [0, 0, 0, 0, 0], hitsTaken: 0 };
    this.perf = { fps: 60, worst: 999, samples: 0, acc: 0 };
    const stage = STAGES[this.stageIdx];
    // 재플레이 = 이미 클리어한 해역. 보스 대사와 엔딩 재생 여부가 갈린다.
    // (commitRun이 기록을 갱신하므로 반드시 출격 시점에 확정해 둔다)
    this.replay = Meta.clearedLevel(stage.id) >= 0;
    this.score = 0; this.mult = 1; this.grazeN = 0;
    this.bestAtStart = Meta.bestFor(stage.id);
    this.bossScored = false; this.newBest = false;
    this.dark = 0;
    this.targetDark = stage.dark ?? 0;  // 어둠은 서서히 내려온다
    this.storm = !!stage.storm;
    this.stormScale = stage.stormLevel ?? 1;
    this.curX = 0; this.curY = 0;
    this.bossCurrentOverride = null;
    this.bossCurrentField = null;
    this.stageRuntimeState = null;
    this.surfaceY = this.storm ? 58 : 20; // 수면 파도만큼 위 경계 하향
    this.bolts = [];
    this.flashT = 0;
    this.D = DIFFS[this.diff];
    const dataSpawner = typeof StageGameAdapter !== 'undefined'
      ? StageGameAdapter.createSpawner(stage.id, this.diff, this, stage.timeline, location.search)
      : null;
    this.spawner = dataSpawner || new Spawner(stage.timeline, this);
    this.stageRuntimeMode = dataSpawner ? 'data' : 'legacy';
    this.stageParity = dataSpawner?.parity || null;
    this.stageTest = !!dataSpawner?.testMode;
    this.stageTestReturnUrl = dataSpawner?.returnUrl || null;
    if (dataSpawner?.range) {
      this.stageT = dataSpawner.range.start;
      dataSpawner.seekRange(this.stageT);
    }
    this.state = 'play';
    this.message(`스테이지 ${this.stageIdx + 1} — ${stage.name}`, '#a8ffcf');
    if (this.diff > 0) this.message(`[${this.D.name}]`, this.D.color);
  },

  launchStage(idx, diff) {
    if (idx !== undefined) this.stageIdx = idx;
    if (diff !== undefined) this.diff = diff;
    this.D = DIFFS[this.diff];
    this.reset();
  },

  // 후퇴 (Esc): 모은 진주는 챙겨서 항해도로 — 파밍런 지원 (클리어 기록은 없음)
  togglePause() {
    if (this.state !== 'play') return;
    this.paused = !this.paused;
    this.pauseSel = 0;
    this.pauseView = 'menu';
    Input.bombQueued = false;   // 정지 중 쌓인 봄 입력이 재개 직후 터지지 않게
    Input.consumeClicks(); Input.consumeKeyPresses();
    Sound.sfx(this.paused ? 'uiSelect' : 'uiMove');
  },

  // 일시정지 메뉴 항목 배치 (drawPause와 공유)
  pauseItems() {
    return this.pauseView === 'menu'
      ? ['계속하기', this.stageTest ? '시퀀서로 돌아가기' : '항해도로 돌아가기', '설정']
      : ['BGM 볼륨', '효과음 볼륨', (Sound.muted ? '음소거 해제' : '음소거'), '뒤로'];
  },
  pauseItemRect(i) {
    return { x: CFG.W / 2 - 150, y: 218 + i * 56, w: 300, h: 44 };
  },

  updatePause() {
    const items = this.pauseItems();
    const act = (i) => {
      if (this.pauseView === 'menu') {
        if (i === 0) this.togglePause();
        else if (i === 1) { this.paused = false; this.retreat(); }
        else { this.pauseView = 'settings'; this.pauseSel = 0; Sound.sfx('uiSelect'); }
      } else {
        if (i === 0) Sound.cycleVol('bgm');
        else if (i === 1) Sound.cycleVol('sfx');
        else if (i === 2) Sound.toggleMute();
        else { this.pauseView = 'menu'; this.pauseSel = 0; Sound.sfx('uiMove'); }
      }
    };
    for (const k of Input.consumeKeyPresses()) {
      if (k === 'arrowup' || k === 'w') { this.pauseSel = (this.pauseSel + items.length - 1) % items.length; Sound.sfx('uiMove'); }
      else if (k === 'arrowdown' || k === 's') { this.pauseSel = (this.pauseSel + 1) % items.length; Sound.sfx('uiMove'); }
      else if (k === 'enter' || k === 'z' || k === ' ') act(this.pauseSel);
      else if (k === 'escape' || k === 'x') {
        if (this.pauseView === 'settings') { this.pauseView = 'menu'; this.pauseSel = 0; }
        // 'escape'는 위 togglePause 경로에서도 처리되므로 여기선 설정→메뉴만
      }
    }
    for (const p of Input.consumeClicks()) {
      for (let i = 0; i < items.length; i++) {
        if (this.inRect(p, this.pauseItemRect(i))) { this.pauseSel = i; act(i); break; }
      }
    }
    Input.consumeBomb(); Input.consumeAny();
  },

  inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; },

  retreat() {
    if (this.stageTest) {
      this.finishStageTest('retreat');
      return;
    }
    this.stats.banked = Math.round(this.stats.pearls * this.D.pearlMul);
    Meta.data.bank += this.stats.banked;
    Meta.save();
    this.state = 'map';
    Input.anyPressed = false;
  },

  finishStageTest(reason = 'complete') {
    if (!this.stageTest) return false;
    const fallback = `/tools/stage-sequencer.html?stage=${encodeURIComponent(STAGES[this.stageIdx]?.id || 'stage3')}`;
    let target = fallback;
    try {
      const candidate = new URL(this.stageTestReturnUrl || fallback, location.href);
      if (candidate.origin === location.origin) target = `${candidate.pathname}${candidate.search}${candidate.hash}`;
    } catch (_error) { /* 안전한 동일 출처 기본값 사용 */ }
    try {
      sessionStorage.setItem('pixel-wave-stage-test-result', JSON.stringify({
        stageId: STAGES[this.stageIdx]?.id,
        reason,
        sourceHash: this.spawner?.sourceHash || null,
        completedAt: new Date().toISOString(),
      }));
      sessionStorage.removeItem('pixel-wave-stage-test-payload');
    } catch (_error) { /* 복귀 자체는 계속한다 */ }
    location.replace(target);
    return true;
  },

  // 첫 만남 / 재대결 대사 분기 — 친구가 된 뒤에는 인사가 달라진다
  say(first, again, color) {
    this.message(this.replay && again ? again : first, color);
  },

  // 점수 획득. flat=true면 배율 미적용(클리어·페이즈 보너스 등 고정 보상).
  // 난이도 배율은 항상 적용 — 하드는 같은 행동도 더 비싸다.
  addScore(n, flat) {
    const gain = Math.round(n * (flat ? 1 : this.mult) * (this.D?.scoreMul ?? 1));
    this.score += gain;
    return gain;
  },

  message(text, color) {
    this.msgs.push({ text, color, life: 2.6, t: 0 });
  },

  addFx(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 40 + Math.random() * 140;
      this.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.4, color });
    }
  },

  // 페이즈 돌파 보상: 자동 흡수 진주 — 보스전 중 피탄으로 잃은 파워의 회복 루트.
  // 탄막 사이로 주우러 갈 필요 없이 터진 뒤 알아서 날아온다.
  phaseReward(x, y, n = 12) {
    Sound.sfx('phase');
    this.addScore(1000, true);
    // 무결 파도: 이 페이즈를 노히트로 돌파
    const hits = this.runLog?.hitsTaken || 0;
    if (hits === this.phaseHitBase) {
      this.addScore(2000, true);
      this.message('무결 파도! +2000', '#ffe9a8');
    }
    this.phaseHitBase = hits;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 80 + Math.random() * 160;
      this.pearls.push(new Pearl(x, y, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 20, auto: true }));
    }
  },

  addBattery(n) {
    const before = this.battery;
    this.battery = Math.min(this.batteryMax, this.battery + n);
    if (this.battery > before) this.message('조개폰 충전 +1!', '#7dffd8');
  },

  // ---- 적탄 생성 헬퍼 (적·보스 공용) ----
  spawnAimed(x, y, speed, count, spread) {
    const p = this.player;
    const base = Math.atan2(p.y - y, p.x - x);
    for (let i = 0; i < count; i++) {
      const a = base + (count === 1 ? 0 : (i - (count - 1) / 2) * spread);
      this.ebullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: CFG.ebR, kind: 'spike' });
    }
  },
  spawnRing(x, y, n, speed, offset, options = {}) {
    const gapCount = Math.max(0, Math.min(n - 1, Math.round(Number(options.gapCount) || 0)));
    const gapIndex = ((Math.round(Number(options.gapIndex) || 0) % n) + n) % n;
    for (let i = 0; i < n; i++) {
      const gapOffset = ((i - gapIndex) % n + n) % n;
      if (gapOffset < gapCount) continue;
      const a = offset + (i / n) * 6.28;
      this.ebullets.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r: CFG.ebR, kind: 'bubble' });
    }
  },
  // 보스 전용 탄 헬퍼 — 난이도에 따라 탄수 자동 증가 (조준 +1/+2발, 링 +3/+6발)
  // 잡몹의 난이도 진화는 Enemy.shoot이 별도로 담당
  bossAimed(x, y, speed, count, spread) {
    const c = count + this.diff;
    this.spawnAimed(x, y, speed * 1.12, c, spread || (c > 1 ? 0.2 : 0)); // 보스 탄속 기본 +12%
  },
  bossRing(x, y, n, speed, offset) {
    this.spawnRing(x, y, n + this.diff * 3, speed * 1.12, offset);
  },
  clearBulletsToPearls(toPearls) {
    for (const b of this.ebullets) {
      // 보스 격파·거북 택시 탑승의 일괄 변환 — 보상이니 자동 흡수
      if (toPearls) this.pearls.push(new Pearl(b.x, b.y, { life: 12, auto: true }));
      else this.addFx(b.x, b.y, '#bfe8ff', 1);
    }
    this.ebullets = [];
  },

  onEnemyKilled(e) {
    Sound.sfx(e.kind === 'big' ? 'killBig' : 'kill');
    this.addScore(SCORE_KILL[e.kind] ?? 50);
    this.mult = Math.min(3, this.mult + 0.03);
    const drop = PEARL_DROP[e.kind] ?? 1;
    for (let i = 0; i < drop; i++) this.pearls.push(new Pearl(e.x, e.y));
    this.addFx(e.x, e.y, '#ffd6e8', 8);
    if (this.boss && typeof this.boss.onEnemyKilled === 'function') this.boss.onEnemyKilled(e);
    // S5 유언탄: 이지 조준 1발 → 노멀 2발 → 하드 5방향 흩뿌림
    if (e.S === 5) {
      if (this.diff >= 2) this.spawnRing(e.x, e.y, 5, 125, Math.random() * 6.28);
      else this.spawnAimed(e.x, e.y, 135, 1 + this.diff, 0.22);
    }
    // 대물: 격파 보상 큰 진주 확정 (버틸수록 위험하니 잡을 가치를 보장)
    if (e.kind === 'big') {
      this.pearls.push(new Pearl(e.x, e.y, { big: true }));
      this.message('대물 사냥 성공!', '#ffd6a8');
      this.addFx(e.x, e.y, '#ffd6a8', 16);
    }
    const g = this.groups[e.groupId];
    if (g) {
      g.killed++;
      if (g.isFormation && g.killed === g.total) {
        this.pearls.push(new Pearl(e.x, e.y, { big: true }));
        this.addScore(300, true);
        this.addFx(e.x, e.y, '#ffe9a8', 10);   // 큰 진주 드랍이 보상 신호 — 문자는 생략
      }
    }
  },

  startBossWarning() {
    Sound.sfx('warn');
    this.message('!! 뭔가 다가온다 !!', '#ff8f8f');
    this.shake = 0.6;
  },

  // 물속 번개: 예고 기둥 → 낙뢰
  spawnBolt(xFrac, options = {}) {
    const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    this.bolts.push({
      x: xFrac * CFG.W,
      w: Math.max(1, finiteOr(options.width, CFG.boltW)),
      telT: Math.max(0, finiteOr(options.telegraphDuration, CFG.boltTelT)),
      strikeT: Math.max(0, finiteOr(options.strikeDuration, CFG.boltStrikeT)),
      hitDone: false,
    });
  },

  addStageEntryWarning(warning) {
    const source = warning && typeof warning === 'object' ? warning : {};
    this.entryWarnings.push({
      side: source.side === 'right' ? 'right' : 'left',
      y: Math.max(24, Math.min(CFG.H - 24, Number(source.y) || CFG.H * 0.5)),
      spawnAt: Math.max(this.stageT, Number(source.spawnAt) || this.stageT),
      duration: Math.max(0.05, Number(source.duration) || 0.9),
      count: Math.max(1, Math.round(Number(source.count) || 1)),
    });
    Sound.sfx('warn');
  },

  clearStageEntryWarnings() {
    this.entryWarnings = [];
  },

  applyStageRuntimeState(state) {
    this.stageRuntimeState = state;
    this.dark = state.darkness;
    this.targetDark = state.darknessTarget;
    this.storm = state.stormScale > 0 || state.drawSurfaceWaves || state.drawCurrentIndicator;
    this.stormScale = state.stormScale;
    this.curX = state.current.x;
    this.curY = state.current.y;
    this.surfaceY = state.surfaceBoundaryY || 20;
  },

  clearStageRuntimeState() {
    this.stageRuntimeState = null;
  },

  sampleStageCurrent(targetId = 'player', position = null) {
    const influence = {
      player: { x: 1, y: 1 },
      pointerTarget: { x: 0.6, y: 0.6 },
      enemyProjectile: { x: 0.75, y: 0.6 },
      currentSurfEnemy: { x: 1.4, y: 0.6 },
      raw: { x: 1, y: 1 },
    }[targetId] || { x: 0, y: 0 };
    if (this.bossCurrentField) {
      const raw = StageCurrentField.sample(
        this.bossCurrentField,
        position || this.player || this.bossCurrentField.center,
      );
      return {
        x: raw.x * influence.x,
        y: raw.y * influence.y,
      };
    }
    if (this.stageRuntimeState && typeof StagePlugin !== 'undefined') {
      return StagePlugin.sampleCurrent(this.stageRuntimeState, targetId);
    }
    if (this.bossCurrentOverride) {
      return {
        x: this.bossCurrentOverride.x * influence.x,
        y: this.bossCurrentOverride.y * influence.y,
      };
    }
    return { x: this.curX * influence.x, y: this.curY * influence.y };
  },

  // 보너스 구간과 보스 추격전이 공유하는 거북 택시 계약.
  startRide(dur, options = {}) {
    const params = typeof StagePlugin !== 'undefined'
      ? StagePlugin.normalizeTurtleRide(options)
      : options;
    this.ride = {
      t: 0,
      dur: Math.max(0, Number(dur) || 0),
      params,
      pearlT: 0,
      ringT: params.pearlRing.enabled ? params.pearlRing.firstDelay : Infinity,
      trailPhase: Math.random() * 6.28,
      durability: params.taxiDurability,
      durabilityMax: params.taxiDurability,
    };
    if (params.bulletClearOnStart.enabled) {
      for (const bullet of this.ebullets) {
        if (params.bulletClearOnStart.convertToPearls) {
          this.pearls.push(new Pearl(bullet.x, bullet.y, {
            life: params.bulletClearOnStart.pearlLifetime,
            auto: params.bulletClearOnStart.autoCollect,
          }));
        } else this.addFx(bullet.x, bullet.y, '#bfe8ff', 1);
      }
      this.ebullets = [];
    }
    if (params.startSoundId) Sound.sfx(params.startSoundId);
    for (const message of params.startMessages) if (message.text) this.message(message.text, message.color);
  },

  updateRide(dt) {
    const r = this.ride;
    r.t += dt;
    const params = r.params;
    if (params.playerInvulnerable) this.player.invuln = Math.max(this.player.invuln, 0.4);
    // 진주 트레일 (사인 곡선 — 따라가며 줍는 재미)
    if (params.pearlTrail.enabled) {
      r.pearlT -= dt;
      if (r.pearlT <= 0) {
        r.pearlT += params.pearlTrail.interval;
        const y = CFG.H * params.pearlTrail.centerY
          + Math.sin(r.t * params.pearlTrail.frequency + r.trailPhase) * CFG.H * params.pearlTrail.amplitudeY;
        this.pearls.push(new Pearl(CFG.W + 12, y, {
          vx: -params.pearlTrail.speed, vy: 0, life: params.pearlTrail.lifetime, stream: true,
        }));
      }
    }
    // 가끔 진주 링 (보너스 안의 보너스)
    if (params.pearlRing.enabled) {
      r.ringT -= dt;
      if (r.ringT <= 0) {
        r.ringT += params.pearlRing.interval;
        const range = params.pearlRing.centerYRange;
        const cy = (range[0] + Math.random() * (range[1] - range[0])) * CFG.H;
        for (let i = 0; i < params.pearlRing.count; i++) {
          const a = (i / params.pearlRing.count) * 6.28;
          this.pearls.push(new Pearl(
            CFG.W + 40 + Math.cos(a) * params.pearlRing.radius,
            cy + Math.sin(a) * params.pearlRing.radius,
            { vx: -params.pearlRing.speed, vy: 0, life: params.pearlRing.lifetime, stream: true },
          ));
        }
      }
    }
    if (r.t >= r.dur) this.finishRide('complete');
  },

  finishRide(reason = 'complete') {
    const ride = this.ride;
    if (!ride) return;
    this.ride = null;
    if (reason === 'broken') {
      if (ride.params.breakMessage.text) this.message(ride.params.breakMessage.text, ride.params.breakMessage.color);
    } else if (reason === 'complete' && ride.params.exitBehavior !== 'silent' && ride.params.endMessage.text) {
      this.message(ride.params.endMessage.text, ride.params.endMessage.color);
    }
  },

  absorbRideHit() {
    const ride = this.ride;
    if (!ride || ride.params.playerInvulnerable || ride.durability <= 0) return false;
    ride.durability--;
    this.player.invuln = Math.max(this.player.invuln, 0.75);
    this.shake = Math.max(this.shake, 0.22);
    Sound.sfx('shield');
    this.addFx(this.player.x, this.player.y + 16, '#ffe28a', 12);
    if (ride.durability > 0) this.message(`거북 택시 내구도 ${ride.durability}`, '#ffe28a');
    else this.finishRide('broken');
    return true;
  },
  startBoss() {
    if (this.ride && !this.ride.params.continueIntoBoss) this.finishRide('boss');
    this.phaseHitBase = this.runLog?.hitsTaken || 0;
    this.bossScored = false;
    if (this.runLog) this.runLog.bossStart = this.stageT;
    this.boss = STAGES[this.stageIdx].boss(this);
    // 난이도 체력 배율 (패턴 강화는 각 보스 mercy()의 bossInt가 담당)
    this.boss.maxHp = Math.round(this.boss.maxHp * this.D.bossHp);
    this.boss.hp = this.boss.maxHp;
  },

  // 반경 안의 적탄만 진주로 (기본 봄은 전 화면이 아니라 국소 소거)
  clearBulletsRadius(x, y, r, toPearls) {
    const r2 = r * r;
    this.ebullets = this.ebullets.filter(b => {
      if ((b.x - x) ** 2 + (b.y - y) ** 2 > r2) return true;
      if (toPearls) this.pearls.push(new Pearl(b.x, b.y, { life: 10 }));
      else this.addFx(b.x, b.y, '#bfe8ff', 1);
      return false;
    });
  },

  useBomb() {
    const p = this.player;
    if (this.battery <= 0 || p.bubble > 0) return;
    this.battery--;
    this.stats.bombs++;
    const def = BOMB_DEFS[this.bombId] || BOMB_DEFS.sonar;
    def.use(this);
  },

  // 지속형 봄 효과 (등불·대시·유인·유령화·낙뢰)
  updateBombs(dt) {
    const p = this.player;

    // 몽실: 시간차로 터지는 등불
    for (const L of this.bombLanterns) {
      L.t -= dt;
      if (L.t <= 0 && !L.done) {
        L.done = true;
        this.clearBulletsRadius(L.x, L.y, L.r, true);
        this.fx.push({ x: L.x, y: L.y, ring: true, life: 0.5, maxLife: 0.5, r: L.r, color: '201,163,255' });
        // 시간차가 곧 대가 — 터질 때 범위 피해도 준다
        const r2 = L.r * L.r;
        for (const e of this.enemies) {
          if (typeof e.isHittable === 'function' && !e.isHittable()) continue;
          if ((e.x - L.x) ** 2 + (e.y - L.y) ** 2 < r2) e.takeDamage(14, this);
        }
        if (this.boss && !this.boss.dead && this.boss.phase > 0 && this.boss.hittable !== false) {
          if ((this.boss.x - L.x) ** 2 + (this.boss.y - L.y) ** 2 < r2) this.boss.takeDamage(12);
        }
        this.addFx(L.x, L.y, '#ffd66e', 10);
        Sound.sfx('pearlBig');
      }
    }
    this.bombLanterns = this.bombLanterns.filter(L => !L.done);

    // 씽씽: 무적 돌진 — 지나가며 탄 소거 + 적 격돌
    if (this.bombDash) {
      this.bombDash.t -= dt;
      p.invuln = Math.max(p.invuln, 0.3);
      p.x = Math.min(CFG.W - 20, p.x + 900 * dt);
      this.clearBulletsRadius(p.x, p.y, 95, true);
      for (const e of this.enemies) {
        if ((typeof e.isHittable === 'function' && !e.isHittable()) || this.bombDash.dmgDone.has(e)) continue;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 70 * 70) {
          this.bombDash.dmgDone.add(e);
          e.takeDamage(10, this);
        }
      }
      if (this.boss && !this.boss.dead && this.boss.hittable !== false &&
          !this.bombDash.hitBoss &&
          (this.boss.x - p.x) ** 2 + (this.boss.y - p.y) ** 2 < 90 * 90) {
        this.bombDash.hitBoss = true;
        this.boss.takeDamage(25);
      }
      if (this.bombDash.t <= 0) this.bombDash = null;
    }

    // 초롱: 적탄을 빛으로 빨아들여 진주로
    if (this.bombLure) {
      const L = this.bombLure;
      L.t -= dt;
      L.x = p.x; L.y = p.y;
      const r2 = L.r * L.r;
      this.ebullets = this.ebullets.filter(b => {
        const dx = L.x - b.x, dy = L.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) return true;
        const d = Math.sqrt(d2) || 1;
        b.vx += dx / d * 900 * dt;   // 빨려들어간다
        b.vy += dy / d * 900 * dt;
        if (d < 46) {                // 삼킴
          this.pearls.push(new Pearl(b.x, b.y, { life: 10, auto: true }));
          return false;
        }
        return true;
      });
      if (L.t <= 0) this.bombLure = null;
    }

    // 부우: 유령화 (탄은 그대로, 나만 통과)
    if (this.bombGhost > 0) {
      this.bombGhost -= dt;
      p.invuln = Math.max(p.invuln, 0.2);
    }

    // 우르릉: 낙뢰 잔광
    if (this.bombThunder) {
      this.bombThunder.t -= dt;
      if (this.bombThunder.t <= 0) this.bombThunder = null;
    }
  },

  // 상태에 맞는 BGM을 고른다 (매 프레임 비교 — 바뀔 때만 크로스페이드)
  syncBgm() {
    let want = null;
    if (this.state === 'boot') want = 'title';        // 자동재생 허용 환경이면 로딩 중에도 흐른다
    else if (this.state === 'title') want = 'title';
    else if (this.state === 'map') want = 'map';
    else if (this.state === 'ending') want = 'ending';
    else if (this.state === 'play') {
      want = this.boss && !this.boss.dead
        ? `boss${this.stageIdx + 1}`
        : `stage${this.stageIdx + 1}`;
    } else if (this.state === 'victory') want = Sound.currentKey; // 클리어 화면은 그대로 두고 페이드는 victory()에서
    if (want !== undefined && want !== Sound.currentKey) Sound.playBgm(want);
  },

  // 런 정산: 입금 + 클리어 기록 + 저장을 한 곳에서 (분산되면 저장 누락이 생긴다)
  commitRun() {
    this.stats.time = this.stageT;
    this.stats.banked = Math.round(this.stats.pearls * this.D.pearlMul);
    Meta.data.bank += this.stats.banked;
    Meta.recordClear(STAGES[this.stageIdx].id, this.diff);
    Meta.save();   // 재클리어(기록 갱신 없음) 시에도 은행 잔액은 반드시 저장

    // 클리어 보너스 (배율 무관 고정) + 최고 기록
    const rl0 = this.runLog || {};
    this.stats.noMiss = (rl0.hitsTaken || 0) === 0;
    this.stats.noBomb = (this.stats.bombs || 0) === 0;
    if (this.stats.noMiss) this.addScore(5000, true);
    if (this.stats.noBomb) this.addScore(3000, true);
    this.stats.score = this.score;
    this.newBest = Meta.recordScore(STAGES[this.stageIdx].id, this.score);
    if (this.newBest && typeof Board !== 'undefined') Board.submit();   // 랭킹 자동 갱신 (설정 시)

    // 런 리포트 — 밸런스 측정용. Game.lastRun 으로도 확인 가능
    const rl = this.runLog || { bossStart: this.stageT, phaseTime: [] };
    const f = (v) => +(v || 0).toFixed(1);
    this.lastRun = {
      stage: STAGES[this.stageIdx].name,
      difficulty: this.D.name,
      total: f(this.stageT),
      mobs: f(rl.bossStart),
      boss: f(this.stageT - (rl.bossStart ?? this.stageT)),
      phases: (rl.phaseTime || []).slice(1).map(f),
      deaths: this.stats.deaths,
      hits: rl.hitsTaken || 0,
      bombs: this.stats.bombs,
      pearls: this.stats.pearls,
      banked: this.stats.banked,
      score: this.score,
      graze: this.grazeN,
      dolphin: this.dolphin ? `${this.dolphin.type}Lv${this.dolphin.lv}` : 'none',
      worstFps: Math.round(this.perf.worst),
    };
    console.log('[RUN]', this.lastRun);
  },

  // 라스보스 격파 → 엔딩 시퀀스 (일반 victory 대신)
  startEnding() {
    if (this.stageTest) { this.finishStageTest('victory'); return; }
    this.commitRun();
    this.msgs = [];
    this.state = 'ending';
    this.endingT = 0;
    this.bolts = [];
    this.ebullets = [];
    this.enemies = [];
    Input.anyPressed = false;
  },

  victory() {
    if (this.stageTest) { this.finishStageTest('victory'); return; }
    this.commitRun();
    Sound.stopBgm(1.5);
    Sound.sfx('clear');
    this.msgs = [];   // 남은 중앙 메시지가 결과창과 겹치지 않게
    this.state = 'victory';
    this.victoryT = 0;
    Input.anyPressed = false; // 클리어 순간의 잔여 입력으로 즉시 재시작 방지
  },

  // 유도탄 표적: 가장 가까운 적 (보스 포함)
  // 화면에 들어온 적만 — 화면 밖 스폰 지점 저격 방지 (유도 돌고래 밸런스의 핵심)
  nearestTarget(x, y) {
    let best = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.x > CFG.W - 12 || e.x < 4) continue; // 아직 화면 밖 (우측 진입 전 / 좌측 D5 진입 전)
      if (typeof e.isTargetable === 'function' && !e.isTargetable()) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (this.boss && !this.boss.dead && this.boss.phase > 0 && this.boss.hittable !== false) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < bd) best = this.boss;
    }
    return best;
  },

  // 폭발 (분홍돌고래 기포탄)
  explode(s) {
    this.explosions.push({ x: s.x, y: s.y, r: s.radius, life: 0.35, maxLife: 0.35 });
    for (const e of this.enemies) {
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (s.radius + 10) ** 2) e.takeDamage(s.dmg, this);
    }
    if (this.boss && !this.boss.dead && this.boss.phase > 0 && this.boss.hittable !== false) {
      const br = s.radius + 40 * this.boss.scale;
      if ((this.boss.x - s.x) ** 2 + (this.boss.y - s.y) ** 2 < br * br) this.boss.takeDamage(s.dmg);
    }
    if (s.clearBullets) {
      // 폭발 Lv3 고유기: 폭발이 적탄 소거
      this.ebullets = this.ebullets.filter(b => {
        if ((b.x - s.x) ** 2 + (b.y - s.y) ** 2 < s.radius ** 2) { this.addFx(b.x, b.y, '#ffc4e5', 1); return false; }
        return true;
      });
    }
  },

  // ================= UPDATE =================
  update(dt) {
    this.syncBgm();
    if (this.state !== 'play') {
      if (this.state === 'boot') {
        this.bootT += dt;
        const ready = Assets.progress() >= 1 || this.bootT > 6;
        if (Input.consumeAny() && ready) this.state = 'title';   // 이 입력이 오디오도 깨운다
        Input.consumeClicks(); Input.consumeBomb(); Input.consumeKeyPresses();
        return;
      }
      if (this.state === 'map') { MapUI.update(dt, this); return; }
      if (this.state === 'ending') {
        this.endingT += dt;
        // 인어와 친구들의 귀향 행진
        const p = this.player;
        p.anim += dt;
        p.bubble = 0; p.invuln = 0; p.slowVisual = false;
        p.x = Math.min(120 + this.endingT * 42, CFG.W * 0.6);
        p.y = CFG.H * 0.56 + Math.sin(this.endingT * 1.6) * 10;
        if (this.endingT > 4 && Input.consumeAny()) { this.state = 'map'; }
        Input.consumeClicks(); Input.consumeBomb(); Input.consumeKeyPresses();
        return;
      }
      if (this.state === 'victory') this.victoryT = (this.victoryT ?? 0) + dt;
      const ready = this.state === 'title' || (this.victoryT ?? 0) > 0.8;
      if ((Input.consumeAny() || Input.keys['r']) && ready) {
        this.state = 'map'; // 타이틀/클리어 → 항해도
        Input.consumeClicks();
      }
      Input.consumeClicks(); Input.consumeBomb(); Input.consumeKeyPresses();
      return;
    }

    // Esc = 후퇴 (진주는 챙겨감)
    if (Input.keys['escape']) {
      Input.keys['escape'] = false;
      if (this.paused && this.pauseView === 'settings') { this.pauseView = 'menu'; this.pauseSel = 0; }
      else this.togglePause();
    }
    if (Input.consumePause()) this.togglePause();
    if (this.paused) { this.updatePause(); return; }
    // 플레이 중 메뉴 입력 큐 처리 (디버그 치트키 포함, 봄은 bombQueued로 처리)
    Input.consumeClicks();
    for (const k of Input.consumeKeyPresses()) {
      if (!this.debug) continue;
      if (k === '1') {           // 파워 맥스 + 배터리 풀
        this.player.level = 3; this.player.gauge = 0;
        this.battery = this.batteryMax;
        this.message('[DEBUG] 파워 MAX + 배터리 풀', '#ff8fd8');
      } else if (k === '2') {    // 은행 진주 +1000
        Meta.data.bank += 1000; Meta.save();
        this.message(`[DEBUG] 은행 +1000 (보유 ${Meta.data.bank})`, '#ff8fd8');
      } else if (k === '3') {    // 무적 토글
        this.god = !this.god;
        this.message(`[DEBUG] 무적 ${this.god ? 'ON' : 'OFF'}`, '#ff8fd8');
      } else if (k === '4') {    // 보스 직행
        const wi = this.spawner.timeline.findIndex(e => e.warning);
        if (wi >= 0 && this.spawner.idx <= wi) {
          this.spawner.idx = wi;
          this.stageT = this.spawner.timeline[wi].t - 0.1;
          this.spawner.pending = [];
          this.enemies = [];
          this.clearBulletsToPearls(false);
          this.ride = null;
          this.message('[DEBUG] 보스 직행', '#ff8fd8');
        }
      } else if (k === '6') {    // 픽셀 렌더 토글 (480×270 ↔ 960×540 비교용)
        CFG.pixelMode = !CFG.pixelMode;
        this.message(`[DEBUG] 픽셀 렌더 ${CFG.pixelMode ? 'ON (480×270)' : 'OFF (960×540)'}`, '#ff8fd8');
      } else if (k === '5') {    // 보스 페이즈 스킵 (마지막 페이즈에서 누르면 격파)
        const b = this.boss;
        if (b && !b.dead && b.phase >= 1) {
          if (b.phase === 1) { b.hp = b.maxHp * 0.65; b.enterPhase(2); }
          else if (b.phase === 2) {
            b.hp = b.maxHp * 0.32;
            if (typeof b.enterSurvival === 'function') b.enterSurvival();
            else b.enterPhase(3);
          }
          else if (b.phase === 3 && this.diff >= 2) { b.hp = b.maxHp * 0.17; b.enterPhase(4); }
          else b.takeDamage(b.hp);
          this.message('[DEBUG] 보스 페이즈 스킵', '#ff8fd8');
        }
      }
    }
    if (this.god) this.player.invuln = Math.max(this.player.invuln, 0.5);

    // 유도 Lv3 자동 슬로우: 세계 전체가 잠깐 느려진다
    if (this.slowT > 0) { this.slowT -= dt; dt *= 0.45; }

    this.stageT += dt;
    this.spawner.update(this.stageT, dt);
    const stageScrollMultiplier = this.ride?.params?.scrollMultiplier ?? (this.stageRuntimeState?.scrollMultiplier ?? 1);
    this.scroll += CFG.scrollSpeed * stageScrollMultiplier * dt; // 데이터 런타임은 활성 환경 클립의 곡선을 따른다
    if (this.shake > 0) this.shake -= dt;
    if (this.ride) this.updateRide(dt);
    if (!this.stageRuntimeState) this.dark += (this.targetDark - this.dark) * Math.min(1, dt * 1.2);
    if (this.flashT > 0) this.flashT -= dt;

    // 폭풍 해류: 진동하는 흐름 (플레이어·적탄·M7이 밀린다)
    if (!this.stageRuntimeState) {
      if (this.storm) {
        this.curX = Math.sin(this.stageT * 0.45) * 70 * this.stormScale;
        this.curY = Math.sin(this.stageT * 0.85) * 26 * this.stormScale;
      } else {
        this.curX = 0; this.curY = 0;
      }
    }

    // 물속 번개
    for (const b of this.bolts) {
      if (b.telT > 0) {
        b.telT -= dt;
        if (b.telT <= 0) { this.flashT = 0.18; this.shake = Math.max(this.shake, 0.25); }
      } else {
        b.strikeT -= dt;
        const pl2 = this.player;
        if (!b.hitDone && pl2.bubble <= 0 && Math.abs(pl2.x - b.x) < b.w / 2 + CFG.playerHitR) {
          if (pl2.hit(this)) b.hitDone = true;
        }
      }
    }
    this.bolts = this.bolts.filter(b => b.telT > 0 || b.strikeT > 0);

    if (Input.consumeBomb()) this.useBomb();

    // 페이즈별 체류 시간 기록
    if (this.boss && !this.boss.dead && this.runLog) {
      const ph = Math.min(4, this.boss.phase);
      this.runLog.phaseTime[ph] += dt;
    }

    this.updateBombs(dt);
    this.player.update(dt, this);
    if (this.dolphin) this.dolphin.update(dt, this);
    if (this.boss) this.boss.update(dt);
    if (this.boss && this.boss.dead && !this.bossScored) {
      this.bossScored = true;
      this.addScore(3000, true);
      // 빠른 격파 보너스: 자비 타이머가 남을수록 크게
      const tb = Math.max(0, Math.round((CFG.bossMercyTime - this.boss.t) * 30));
      if (tb > 0) this.addScore(tb, true);
      // 마지막 페이즈 무결
      if ((this.runLog?.hitsTaken || 0) === this.phaseHitBase) this.addScore(2000, true);
    }

    // 적
    for (const e of this.enemies) e.update(dt, this);
    for (const e of this.enemies) {
      if (e.escaped) {
        const g = this.groups[e.groupId];
        if (g) g.escaped++;
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead && !e.escaped);

    // 플레이어/돌고래 샷
    for (const s of this.shots) {
      s.t += dt;
      if (s.kind === 'homing') {
        // 유도: 가장 가까운 적을 향해 선회
        const tgt = this.nearestTarget(s.x, s.y);
        if (tgt) {
          const want = Math.atan2(tgt.y - s.y, tgt.x - s.x);
          const cur = Math.atan2(s.vy, s.vx);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const a = cur + Math.max(-s.turn * dt, Math.min(s.turn * dt, diff));
          s.vx = Math.cos(a) * s.spd; s.vy = Math.sin(a) * s.spd;
        }
        s.x += s.vx * dt; s.y += s.vy * dt;
      } else if (s.kind === 'bomb') {
        // 기포탄은 명중해야 터진다 (충돌 처리에서 explode). 신관 자폭 없음 —
        // 예전 0.65초 신관은 사거리를 182px로 묶어 대부분 허공에서 터졌다.
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.timer !== undefined) { s.timer -= dt; if (s.timer <= 0) { this.explode(s); s.dead = true; } }
      } else if (s.kind === 'beam') {
        s.x += s.vx * dt; s.y += s.vy * dt;
      } else {
        // 기본 물결탄
        const px = -s.dirY, py = s.dirX; // 수직 방향
        const wave = s.amp * Math.sin(s.t * 14 + s.phase);
        s.x = s.baseX + s.dirX * (CFG.shotSpeed * s.t + 14) + px * wave;
        s.y = s.baseY + s.dirY * (CFG.shotSpeed * s.t + 14) + py * wave;
      }
    }
    this.shots = this.shots.filter(s => s.x > -30 && s.x < CFG.W + 30 && s.y > -30 && s.y < CFG.H + 30 && !s.dead);

    // 적탄 (JSON 탄막은 에디터와 같은 공통 런타임으로 이동·행동을 처리한다)
    const barrageSpawned = [];
    const barrageSpawnBudget = { remaining: 1200 };
    for (const b of this.ebullets) {
      const projectileCurrent = this.sampleStageCurrent('enemyProjectile', b);
      if (b.kind === 'storm' && this.boss && !this.boss.dead) {
        // 폭풍탄 (라스보스): 바깥에서 계속 생성되어 감겨들고, 안쪽 벽(반경 175)에서
        // 잠시 돌다 소멸 — 바깥은 항상 유입 탄으로 위험, 눈 안쪽만이 안전
        b.ang += b.angV * dt;
        b.orbitR = Math.max(175, b.orbitR - (b.inSpd ?? 80) * dt);
        if (b.orbitR <= 175.5) {
          b.holdT = (b.holdT ?? 0.9) - dt;
          if (b.holdT <= 0) b.dead = true;
        }
        b.x = this.boss.x + Math.cos(b.ang) * b.orbitR;
        b.y = this.boss.y + Math.sin(b.ang) * b.orbitR;
        continue;
      }
      // 난이도: 적탄 속도 배율 (탄 자체 속도에만 — 해류는 그대로)
      const sm = this.D.ebSpd;
      // 약추적: homing {turnRate(rad/s), duration} — 잠시 따라오다 직진
      if (b.homing) {
        const hp = this.player;
        b.homing.t = (b.homing.t || 0) + dt;
        if (b.homing.t < b.homing.duration && hp && hp.bubble <= 0) {
          const cur = Math.atan2(b.vy, b.vx);
          const want = Math.atan2(hp.y - b.y, hp.x - b.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = Math.max(-b.homing.turnRate * dt, Math.min(b.homing.turnRate * dt, diff));
          const spd = Math.hypot(b.vx, b.vy);
          const a = cur + turn;
          b.vx = Math.cos(a) * spd; b.vy = Math.sin(a) * spd;
        }
      }
      if (b.barrage && typeof BarrageRuntime !== 'undefined') {
        const mineWasArmed = b.kind === 'mine' && Number.isFinite(b.timer) && b.timer > 0;
        BarrageRuntime.updateProjectile(b, dt, {
          speedMul: sm,
          current: projectileCurrent,
          target: this.player,
          difficulty: this.diff,
          mineRingCount: CFG.mineRingN + this.diff,
          mineRingSpeed: CFG.mineRingSpd,
          spawnBudget: barrageSpawnBudget,
          spawn: child => barrageSpawned.push(child),
        });
        if (mineWasArmed && b.dead) this.addFx(b.x, b.y, '#ffd66e', 6);
        continue;
      }
      if (b.armT !== undefined && b.armT > 0) b.armT -= dt; // 태어나는 중 (무해 예고)
      if (b.fallTo) { // 별똥별 (초롱 진 대파도): 완만한 가속 — 읽힌다
        b.vx += (b.fallTo.vx - b.vx) * Math.min(1, dt * 2.2);
        b.vy += (b.fallTo.vy - b.vy) * Math.min(1, dt * 2.2);
      }
      b.x += (b.vx * sm + projectileCurrent.x) * dt; b.y += (b.vy * sm + projectileCurrent.y) * dt;
      if (b.kind === 'mine') {
        b.vy *= (1 - 1.5 * dt); // 설치 후 서서히 정지
        b.timer -= dt;
        const warningLead = b.mineWarningLead ?? 0.6;
        if (!b.mineWarningPlayed && b.timer <= warningLead) {
          b.mineWarningPlayed = true;
          if (b.mineWarningSound === 1) Sound.sfx('warn');
        }
        if (b.timer <= 0) {
          b.dead = true;
          const authored = b.mineAuthoredGeometry === 1;
          this.spawnRing(
            b.x, b.y,
            authored ? (b.mineRingCount ?? CFG.mineRingN) : CFG.mineRingN + this.diff,
            authored ? (b.mineRingSpeed ?? CFG.mineRingSpd) : CFG.mineRingSpd,
            authored ? (b.mineRingPhase ?? 0) : Math.random() * 6.28,
          );
          this.addFx(b.x, b.y, '#ffd66e', 6);
        }
      }
    }
    if (barrageSpawned.length) this.ebullets.push(...barrageSpawned);
    // x 경계는 넉넉하게 — 콘보이(줄지어 진입)는 화면 밖에서 스폰되어 걸어들어온다
    // 폭풍탄은 궤도가 화면 밖을 지나므로 경계 예외 (보스 있는 동안 유지)
    this.ebullets = this.ebullets.filter(b => !b.dead && (
      b.kind === 'storm' ? (this.boss && !this.boss.dead)
        : b.kind === 'laser' ? !b.dead
        : (b.x > -40 && b.x < CFG.W + 480 && b.y > -20 && b.y < CFG.H + 20)
    ));

    // 진주
    for (const p of this.pearls) p.update(dt, this.player);
    for (const p of this.pearls) {
      if (this.player.bubble <= 0 && p.noCollectT <= 0 &&
          Math.hypot(p.x - this.player.x, p.y - this.player.y) < CFG.pearlCollectR) {
        this.player.addPearl(this, p.value, p.big ? CFG.gaugeBig : CFG.gaugeNormal);
        if (!p.scattered) this.addScore(p.big ? 100 : 10);
        Sound.sfx(p.big ? 'pearlBig' : 'pearl');
        p.collected = true;
      }
    }
    this.pearls = this.pearls.filter(p => !p.collected && p.life > 0);

    // 폭발
    for (const ex of this.explosions) ex.life -= dt;
    this.explosions = this.explosions.filter(ex => ex.life > 0);

    this.collide(dt);

    // 이펙트/메시지
    for (const f of this.fx) {
      f.life -= dt;
      if (!f.ring) { f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.95; f.vy *= 0.95; }
    }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const m of this.msgs) { m.t += dt; m.life -= dt; }
    this.msgs = this.msgs.filter(m => m.life > 0);
    this.entryWarnings = this.entryWarnings.filter(warning => warning.spawnAt > this.stageT);
  },

  collide() {
    const pl = this.player;

    // 샷 vs 적
    for (const s of this.shots) {
      if (s.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (typeof e.isHittable === 'function' && !e.isHittable()) continue;
        if (s.hitSet && s.hitSet.has(e)) continue; // 관통탄이 같은 적을 매 프레임 때리는 것 방지
        let hit = false;
        if (e.kind === 'wreck') {
          const halfWidth = e.wreckW * 0.5;
          const halfHeight = e.wreckH * 0.5;
          const nearestX = Math.max(e.x - halfWidth, Math.min(s.x, e.x + halfWidth));
          const nearestY = Math.max(e.y - halfHeight, Math.min(s.y, e.y + halfHeight));
          hit = (s.x - nearestX) ** 2 + (s.y - nearestY) ** 2 < s.r * s.r;
        } else {
          const r = (KIND_R[e.kind] ?? 10) + s.r;
          hit = (s.x - e.x) ** 2 + (s.y - e.y) ** 2 < r * r;
        }
        if (hit) {
          if (s.kind === 'bomb') { this.explode(s); s.dead = true; break; }
          e.takeDamage(s.dmg ?? CFG.shotDmg, this);
          if (s.pierce > 0) { s.pierce--; (s.hitSet ??= new Set()).add(e); }
          else { s.dead = true; break; }
        }
      }
      // 샷 vs 보스
      if (!s.dead && !s.hitBoss && this.boss && !this.boss.dead && this.boss.phase > 0 && this.boss.hittable !== false) {
        const br = 44 * this.boss.scale + s.r;
        if ((s.x - this.boss.x) ** 2 + (s.y - this.boss.y) ** 2 < br * br) {
          if (s.kind === 'bomb') { this.explode(s); s.dead = true; }
          else {
            this.boss.takeDamage(s.dmg ?? CFG.shotDmg);
            this.addFx(s.x, s.y, '#fff3b0', 1);
            s.hitBoss = true; // 관통탄도 보스는 1회만
            if (!(s.pierce > 0)) s.dead = true;
          }
        }
      }
    }
    this.shots = this.shots.filter(s => !s.dead);

    if (pl.bubble > 0) return;

    // 적탄 vs 플레이어
    for (const b of this.ebullets) {
      if (b.armT !== undefined && b.armT > 0) continue; // 태어나는 중인 별은 무해
      if (b.kind === 'laser' && typeof BarrageRuntime !== 'undefined') {
        if (BarrageRuntime.laserHits(b, pl, CFG.playerHitR) && pl.hit(this)) break;
        continue;
      }
      const r = CFG.playerHitR + b.r;
      const d2 = (b.x - pl.x) ** 2 + (b.y - pl.y) ** 2;
      if (d2 < r * r) {
        if (pl.hit(this)) { b.dead = true; break; }
      } else if (!b.grazed && pl.invuln <= 0) {
        // 그레이즈: 피격판정을 스칠 만큼 가까운 탄. 탄마다 1회.
        const gr = r + 15;
        if (d2 < gr * gr) {
          b.grazed = true;
          this.grazeN++;
          this.addScore(10);
          this.mult = Math.min(3, this.mult + 0.06);
          this.addFx((b.x + pl.x) / 2, (b.y + pl.y) / 2, '#ffffff', 2);
          Sound.sfx('graze');
        }
      }
    }
    this.ebullets = this.ebullets.filter(b => !b.dead);

    // 적 몸통 vs 플레이어
    for (const e of this.enemies) {
      if (typeof e.isCollidable === 'function' && !e.isCollidable()) continue;
      if (e.kind === 'wreck') {
        // 지형: 원-사각형 충돌
        const hw = e.wreckW / 2, hh = e.wreckH / 2;
        const nx = Math.max(e.x - hw, Math.min(pl.x, e.x + hw));
        const ny = Math.max(e.y - hh, Math.min(pl.y, e.y + hh));
        const rr = CFG.playerHitR + 2;
        if ((nx - pl.x) ** 2 + (ny - pl.y) ** 2 < rr * rr) {
          if (pl.hit(this)) break;
        }
        continue;
      }
      const r = CFG.playerHitR + (KIND_R[e.kind] ?? 10) * 0.8;
      if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < r * r) {
        if (pl.hit(this)) break;
      }
    }
    // 보스 몸통 vs 플레이어 (숨어 있을 땐 제외)
    if (this.boss && !this.boss.dead && this.boss.phase > 0 && this.boss.hittable !== false) {
      const r = CFG.playerHitR + 40 * this.boss.scale;
      if ((this.boss.x - pl.x) ** 2 + (this.boss.y - pl.y) ** 2 < r * r) pl.hit(this);
    }
  },

  // ================= DRAW =================
  // 월드 레이어 시작: 이후 그리기는 480×270 캔버스로 (게임 좌표는 그대로 쓴다)
  beginWorld() {
    if (!CFG.pixelMode) {
      ctx = mainCtx;
      ctx.save();
      if (this.shake > 0) ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8);
      return;
    }
    ctx = worldCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CFG.WORLD_W, CFG.WORLD_H);
    ctx.save();
    const s = 1 / CFG.pxUnit;               // 게임 좌표 → 월드 픽셀
    ctx.scale(s, s);
    if (this.shake > 0) {
      // 흔들림도 월드 픽셀 단위로 스냅 (반픽셀 떨림 방지)
      const sx = Math.round((Math.random() - 0.5) * 8 / CFG.pxUnit) * CFG.pxUnit;
      const sy = Math.round((Math.random() - 0.5) * 8 / CFG.pxUnit) * CFG.pxUnit;
      ctx.translate(sx, sy);
    }
  },
  // 월드 레이어 종료: 2배 확대해 메인 캔버스로 올리고, 이후엔 UI를 풀 해상도로
  endWorld() {
    ctx.restore();
    if (!CFG.pixelMode) { ctx = mainCtx; return; }
    ctx = mainCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(worldCanvas, 0, 0, CFG.W, CFG.H);
  },

  draw() {
    // UI 화면(타이틀·항해도·엔딩)은 풀 해상도로 또렷하게
    if (this.state === 'boot' || this.state === 'title' || this.state === 'map' || this.state === 'ending') {
      ctx = mainCtx;
      ctx.save();
      this.drawBackground();
      if (this.state === 'boot') this.drawBoot();
      else if (this.state === 'title') this.drawTitle();
      else if (this.state === 'map') MapUI.draw(ctx, this);
      else this.drawEnding();
      ErrLog.draw(ctx);
      ctx.restore();
      return;
    }

    this.beginWorld();
    this.drawBackground();
    this.drawEntryWarnings();

    // 진주 → 적 → 보스 → 탄 → 플레이어 순
    for (const p of this.pearls) p.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    if (this.boss) this.boss.draw(ctx);

    this.drawShots(1);
    this.drawExplosions();
    this.drawEBullets(1);

    this.drawBombFx();
    if (this.ride?.params?.drawTurtle) {
      this.drawTurtle(this.player.x, this.player.y + 18);
      this.drawRideDurability(this.player.x, this.player.y - 25);
    }
    this.player.draw(ctx);
    if (this.dolphin) this.dolphin.draw(ctx, this);

    // 유도 Lv3 슬로우 연출 (파란 비네트)
    if (this.slowT > 0) {
      ctx.fillStyle = `rgba(90,169,255,${Math.min(0.12, this.slowT * 0.4)})`;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }

    // 이펙트
    for (const f of this.fx) {
      if (f.ring) {
        const p = 1 - f.life / f.maxLife;
        ctx.strokeStyle = `rgba(${f.color || '125,255,216'},${f.life / (f.maxLife || 1)})`;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(f.x, f.y, p * (f.r || 620), 0, 6.28); ctx.stroke();
      } else {
        ctx.globalAlpha = Math.max(0, f.life * 2);
        ctx.fillStyle = f.color;
        ctx.fillRect(f.x - 2, f.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }
    }

    // P3+ 대파도: 화면 어두워짐 (어둠 스테이지에선 자체 어둠이 담당)
    if (this.boss && this.boss.phase >= 3 && !this.boss.dead && this.targetDark <= 0) {
      ctx.fillStyle = 'rgba(8, 12, 50, 0.3)';
      ctx.fillRect(0, 0, CFG.W, CFG.H);
      if (this.boss) this.boss.draw(ctx); // 보스는 어둠 위에 다시
    }

    // 물속 번개 (예고 기둥 → 낙뢰)
    for (const b of this.bolts) {
      ctx.save();
      if (b.telT > 0) {
        const blink = Math.floor(b.telT * 10) % 2 === 0;
        ctx.fillStyle = `rgba(255,240,150,${blink ? 0.14 : 0.07})`;
        ctx.fillRect(b.x - b.w / 2, 0, b.w, CFG.H);
        ctx.strokeStyle = 'rgba(255,240,150,0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 8]);
        ctx.beginPath(); ctx.moveTo(b.x - b.w / 2, 0); ctx.lineTo(b.x - b.w / 2, CFG.H); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(b.x + b.w / 2, 0); ctx.lineTo(b.x + b.w / 2, CFG.H); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const a = Math.max(0, b.strikeT / CFG.boltStrikeT);
        const grad = ctx.createLinearGradient(b.x - b.w / 2, 0, b.x + b.w / 2, 0);
        grad.addColorStop(0, `rgba(255,240,150,0)`);
        grad.addColorStop(0.5, `rgba(255,250,220,${0.55 * a})`);
        grad.addColorStop(1, `rgba(255,240,150,0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(b.x - b.w / 2, 0, b.w, CFG.H);
        // 지그재그 본체
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        let zx = b.x, zy = 0;
        ctx.moveTo(zx, zy);
        while (zy < CFG.H) {
          zy += 36 + Math.random() * 20;
          zx = b.x + (Math.random() - 0.5) * b.w * 0.7;
          ctx.lineTo(zx, zy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    // 낙뢰 순간 화면 번쩍
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,252,235,${this.flashT * 0.5})`;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }

    // 심해 어둠 (광원 구멍 + 탄 희미 재드로)
    this.drawDarkness();

    // ---- 여기부터 UI 레이어 (풀 해상도) ----
    this.endWorld();

    this.drawHud();
    if (this.boss) this.boss.drawHpBar(ctx);

    // 중앙 메시지
    let my = CFG.H * 0.3;
    for (const m of this.msgs) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, m.life / 0.5);
      PXUI.text(ctx, m.text, CFG.W / 2, my - Math.min(m.t, 0.3) * 30, 22, m.color);
      ctx.restore();
      my += 32;
    }

    if (this.paused) this.drawPause();
    if (this.state === 'victory') this.drawVictory();
    ErrLog.draw(ctx);
  },

  drawEntryWarnings() {
    for (const warning of this.entryWarnings) {
      const remaining = Math.max(0, warning.spawnAt - this.stageT);
      const progress = 1 - Math.min(1, remaining / warning.duration);
      const pulse = Math.floor(this.stageT * 10) % 2 === 0 ? 1 : 0.62;
      const left = warning.side !== 'right';
      const x = left ? 18 : CFG.W - 18;
      const direction = left ? 1 : -1;
      const y = warning.y;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffdd73';
      ctx.strokeStyle = '#5b2447';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + direction * 16, y);
      ctx.lineTo(x - direction * 7, y - 13);
      ctx.lineTo(x - direction * 7, y + 13);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      const filled = Math.max(1, Math.ceil(progress * 3));
      for (let index = 0; index < 3; index++) {
        ctx.fillStyle = index < filled ? '#fff2b8' : 'rgba(255,242,184,0.28)';
        ctx.fillRect(x - direction * (12 + index * 8) - 3, y + 19, 6, 6);
      }
      if (warning.count > 1) {
        ctx.fillStyle = '#fff2b8';
        ctx.font = "bold 12px 'Galmuri11', monospace";
        ctx.textAlign = left ? 'left' : 'right';
        ctx.fillText(`×${warning.count}`, x + direction * 24, y + 4);
      }
      ctx.restore();
    }
  },

  drawPause() {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 40, 0.66)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    PXUI.panel(ctx, CFG.W / 2 - 190, 128, 380, 330, { border: '#cfe0ff', fill: '#0b1c4e' });
    ctx.textAlign = 'center';
    PXUI.text(ctx, this.pauseView === 'menu' ? '일시정지' : '설정', CFG.W / 2, 174, 22, '#fff');

    const items = this.pauseItems();
    const now = performance.now() / 1000;
    items.forEach((label, i) => {
      const r = this.pauseItemRect(i);
      const on = i === this.pauseSel;
      PXUI.chip(ctx, r, {
        border: on ? '#7dffd8' : 'rgba(210,225,255,0.3)',
        fill: on ? 'rgba(18, 48, 62, 0.95)' : 'rgba(6, 14, 40, 0.9)',
      });
      ctx.fillStyle = on ? '#7dffd8' : 'rgba(255,255,255,0.8)';
      ctx.font = Fonts.f(14, on);
      ctx.textAlign = 'center';
      ctx.fillText(label, r.x + r.w / 2, r.y + 28);
      // 설정: 볼륨 칸 표시
      if (this.pauseView === 'settings' && i < 2) {
        const v = Sound.muted ? 0 : Sound.vol[i === 0 ? 'bgm' : 'sfx'];
        PXUI.cells(ctx, r.x + r.w - 56, r.y + 17, 3, Math.round(v / 0.34), { cw: 12, ch: 10, gap: 3 });
      }
      if (on) PXUI.frame(ctx, r.x - 5, r.y - 5, r.w + 10, r.h + 10,
        `rgba(255,255,255,${0.7 + Math.sin(now * 6) * 0.3})`);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = Fonts.f(11); ctx.textAlign = 'center';
    ctx.fillText('↑↓ 이동 · Enter 선택 · Esc 계속하기', CFG.W / 2, 442);
    ctx.restore();
  },

  // 플레이어/돌고래 샷 렌더 (alphaMul: 어둠 위 재드로용)
  drawShots(alphaMul) {
    for (const s of this.shots) {
      if (!['homing', 'bomb', 'beam'].includes(s.kind) && Sprites.draw(ctx, 'shot.wave', s.x, s.y, {
        t: s.t,
        alpha: alphaMul,
        rot: Math.atan2(s.dirY, s.dirX),
        outline: '#145a70',
        outlineAlpha: 0.55,
      })) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.globalAlpha = 0.9 * alphaMul;
      if (s.kind === 'homing') {
        ctx.strokeStyle = '#7db8ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 6.28); ctx.stroke();
        ctx.strokeStyle = 'rgba(125,184,255,0.4)';
        ctx.beginPath(); ctx.arc(0, 0, s.r + 3, 0, 6.28); ctx.stroke();
      } else if (s.kind === 'bomb') {
        ctx.fillStyle = 'rgba(255,158,210,0.5)';
        ctx.strokeStyle = '#ff9ed2'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, s.r, 0, 6.28); ctx.fill(); ctx.stroke();
      } else if (s.kind === 'beam') {
        ctx.fillStyle = s.big ? '#eef4ff' : '#cfd8e8';
        ctx.beginPath(); ctx.ellipse(0, 0, s.big ? 18 : 12, s.r, 0, 0, 6.28); ctx.fill();
      } else {
        ctx.fillStyle = '#8ff7ff';
        ctx.rotate(Math.atan2(s.dirY, s.dirX));
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }

  },

  // 봄 지속 효과 렌더
  drawBombFx() {
    const p = this.player;
    const t = performance.now() / 1000;

    // 몽실: 놓인 등불 (터지기 직전 빠르게 깜빡)
    // 폭발 예정 반경을 미리 그려봤지만 큰 원이 화면을 덮어 오히려 헷갈렸다 —
    // 터질 때 퍼지는 링만으로 충분하다.
    for (const L of this.bombLanterns) {
      const urgent = L.t < 0.35;
      const blink = urgent && Math.floor(L.t * 14) % 2 === 0;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, 26);
      g.addColorStop(0, `rgba(255,214,110,${blink ? 0.95 : 0.6})`);
      g.addColorStop(1, 'rgba(201,163,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, 26, 0, 6.28); ctx.fill();
      ctx.strokeStyle = 'rgba(201,163,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(L.x, L.y, 9, 0, 6.28); ctx.stroke();
    }

    // 씽씽: 대시 잔상
    if (this.bombDash) {
      ctx.save();
      for (let k = 1; k <= 4; k++) {
        ctx.globalAlpha = 0.28 - k * 0.05;
        ctx.fillStyle = '#8fa3e8';
        ctx.beginPath(); ctx.ellipse(p.x - k * 34, p.y, 20, 9, 0, 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }

    // 초롱: 유인 광구 — 실제 흡입 반경을 점선으로 표시
    if (this.bombLure) {
      const L = this.bombLure;
      const pulse = 1 + Math.sin(t * 12) * 0.06;
      const g = ctx.createRadialGradient(L.x, L.y, 10, L.x, L.y, L.r * pulse);
      g.addColorStop(0, 'rgba(215,255,250,0.45)');
      g.addColorStop(0.35, 'rgba(126,232,224,0.14)');
      g.addColorStop(1, 'rgba(126,232,224,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r * pulse, 0, 6.28); ctx.fill();
      // 흡입 경계 (안쪽으로 흐르는 점선)
      ctx.save();
      ctx.strokeStyle = `rgba(126,232,224,${0.45 + Math.sin(t * 8) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.lineDashOffset = t * 40;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, 6.28); ctx.stroke();
      ctx.restore();
      // 삼키는 중심핵 (반경 46 안에서 진주로 바뀐다)
      ctx.strokeStyle = `rgba(215,255,250,${0.5 + Math.sin(t * 10) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(L.x, L.y, 46, 0, 6.28); ctx.stroke();
    }

    // 부우: 유령화 아우라
    if (this.bombGhost > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, this.bombGhost);
      ctx.strokeStyle = '#c8ffd8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(t * 8) * 3, 0, 6.28); ctx.stroke();
      ctx.fillStyle = 'rgba(200,255,216,0.14)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, 6.28); ctx.fill();
      ctx.restore();
    }

    // 우르릉: 전방 낙뢰 섬광
    if (this.bombThunder) {
      const T = this.bombThunder;
      const a = Math.max(0, T.t / 0.45);
      ctx.save();
      const g = ctx.createLinearGradient(0, T.y - 30, 0, T.y + 30);
      g.addColorStop(0, 'rgba(255,240,150,0)');
      g.addColorStop(0.5, `rgba(255,250,220,${0.55 * a})`);
      g.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(T.x0, T.y - 30, CFG.W - T.x0, 60);
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * a})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      let zx = T.x0, zy = T.y;
      ctx.moveTo(zx, zy);
      while (zx < CFG.W) {
        zx += 40 + Math.random() * 26;
        zy = T.y + (Math.random() - 0.5) * 34;
        ctx.lineTo(zx, zy);
      }
      ctx.stroke();
      ctx.restore();
    }
  },

  drawExplosions() {
    for (const ex of this.explosions) {
      const p = 1 - ex.life / ex.maxLife;
      ctx.strokeStyle = `rgba(255,158,210,${Math.max(0, ex.life * 2.5)})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * (0.5 + p * 0.5), 0, 6.28); ctx.stroke();
      ctx.fillStyle = `rgba(255,196,229,${Math.max(0, ex.life)})`;
      ctx.beginPath(); ctx.arc(ex.x, ex.y, ex.r * p, 0, 6.28); ctx.fill();
    }
  },

  // 적탄 렌더 (alphaMul: 어둠 위 희미 재드로용 — 안 보여서 맞는 건 금지)
  drawEBullets(alphaMul) {
    for (const b of this.ebullets) {
      const spriteId = b.kind === 'bubble' ? 'bullet.bubble'
        : b.kind === 'mine' ? 'bullet.mine'
          : (b.kind === 'spike' || b.kind === 'drop') ? 'bullet.spike' : null;
      if (b.kind === 'mine' && Assets.has('bullet.mine')) {
        // 기뢰: 맥동 글로우 — 폭발이 가까울수록 빠르게
        const urgency = b.timer !== undefined && b.timer < (b.mineWarningLead ?? 1.2);
        const pulse = 0.6 + Math.sin(performance.now() / (urgency ? 70 : 190)) * 0.3;
        const g = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, 20);
        g.addColorStop(0, `rgba(255, 214, 110, ${0.5 * pulse * alphaMul})`);
        g.addColorStop(1, 'rgba(255, 214, 110, 0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(b.x, b.y, 20, 0, 6.28); ctx.fill();
      }
      if (spriteId && Sprites.draw(ctx, spriteId, b.x, b.y, {
        t: b.kind === 'mine' ? Math.max(0, b.timer ?? 0) : 0,
        alpha: alphaMul,
      })) continue;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.globalAlpha = alphaMul;
      if (b.kind === 'laser' && typeof BarrageRuntime !== 'undefined') {
        const state = BarrageRuntime.laserState(b);
        const laser = b.laser;
        const endX = Math.cos(laser.angle) * laser.length;
        const endY = Math.sin(laser.angle) * laser.length;
        ctx.globalAlpha *= state.alpha;
        ctx.lineCap = 'round';
        if (state.phase === 'telegraph') {
          ctx.setLineDash([12, 9]);
          ctx.strokeStyle = 'rgba(255,224,126,0.88)';
          ctx.lineWidth = Math.max(2, laser.width * 0.18);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(endX, endY); ctx.stroke();
        } else {
          ctx.shadowColor = '#ff6fb5'; ctx.shadowBlur = 16;
          ctx.strokeStyle = 'rgba(255,82,155,0.34)'; ctx.lineWidth = laser.width * 1.55;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(endX, endY); ctx.stroke();
          ctx.shadowBlur = 7; ctx.strokeStyle = '#ff83be'; ctx.lineWidth = laser.width;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(endX, endY); ctx.stroke();
          ctx.shadowBlur = 0; ctx.strokeStyle = '#fff4fb'; ctx.lineWidth = Math.max(2, laser.width * 0.24);
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(endX, endY); ctx.stroke();
        }
      } else if (b.kind === 'car') {
        // 씽씽 P2: 차선 사이를 달리는 큰 탄 — 헤드라이트 달린 "차"
        const dir = Math.sign(b.vx) || -1;
        // 속도 잔상
        ctx.strokeStyle = 'rgba(255,220,150,0.3)'; ctx.lineWidth = 3;
        for (let k = 1; k <= 3; k++) {
          ctx.beginPath();
          ctx.moveTo(-dir * (16 + k * 12), -5);
          ctx.lineTo(-dir * (16 + k * 12 + 9), -5);
          ctx.moveTo(-dir * (16 + k * 12), 5);
          ctx.lineTo(-dir * (16 + k * 12 + 9), 5);
          ctx.stroke();
        }
        // 차체
        const body = ctx.createLinearGradient(0, -b.r, 0, b.r);
        body.addColorStop(0, '#ffd9a8');
        body.addColorStop(1, '#e89a5e');
        ctx.fillStyle = body;
        ctx.strokeStyle = '#b56a3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-15, -b.r + 3, 30, (b.r - 3) * 2, 8); ctx.fill(); ctx.stroke();
        // 헤드라이트 (진행 방향)
        ctx.fillStyle = '#fffbe0';
        ctx.beginPath(); ctx.arc(dir * 12, -4, 3, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(dir * 12, 4, 3, 0, 6.28); ctx.fill();
        const beamG = ctx.createLinearGradient(dir * 14, 0, dir * 42, 0);
        beamG.addColorStop(0, 'rgba(255,250,220,0.4)');
        beamG.addColorStop(1, 'rgba(255,250,220,0)');
        ctx.fillStyle = beamG;
        ctx.beginPath();
        ctx.moveTo(dir * 14, -5); ctx.lineTo(dir * 44, -11);
        ctx.lineTo(dir * 44, 11); ctx.lineTo(dir * 14, 5);
        ctx.fill();
      } else if (b.kind === 'storm') {
        // 폭풍탄: 바람 조각 (궤도 접선 방향의 흰 결, 안쪽 벽에선 서서히 흩어짐)
        if (b.holdT !== undefined) ctx.globalAlpha *= Math.max(0.15, Math.min(1, b.holdT / 0.4));
        ctx.rotate((b.ang ?? 0) + Math.PI / 2);
        ctx.fillStyle = 'rgba(226,240,255,0.85)';
        ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(184,216,240,0.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(13, 0); ctx.stroke();
      } else if (b.kind === 'star') {
        // 별탄 (심해의 별밤): 스스로 빛나는 탄. 태어나는 동안은 흐리게 커지며 반짝(무해 예고)
        const arming = b.armT !== undefined && b.armT > 0;
        if (arming) ctx.globalAlpha *= 0.25 + 0.75 * (1 - b.armT / 0.7);
        const tw = 0.8 + Math.sin((b.x + b.y) * 0.05 + performance.now() / 300) * 0.2;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 13);
        glow.addColorStop(0, `rgba(220,255,250,${0.9 * tw})`);
        glow.addColorStop(0.4, `rgba(140,240,226,${0.5 * tw})`);
        glow.addColorStop(1, 'rgba(140,240,226,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.28); ctx.fill();
        // 광원은 코드 효과로 유지하고, 충돌 중심의 별 코어만 네이티브 스프라이트로 교체한다.
        if (!Sprites.draw(ctx, 'bullet.star', 0, 0, { t: performance.now() / 1000 })) {
          ctx.fillStyle = '#eafffb';
          ctx.beginPath(); ctx.arc(0, 0, b.r * 0.7, 0, 6.28); ctx.fill();
        }
      } else if (b.kind === 'ghostflame') {
        // 유령불: 창백한 초록 도깨비불
        const fl = 0.75 + Math.sin((b.x + b.y) * 0.08 + performance.now() / 200) * 0.25;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
        glow.addColorStop(0, `rgba(200,255,216,${0.85 * fl})`);
        glow.addColorStop(0.5, `rgba(159,232,184,${0.45 * fl})`);
        glow.addColorStop(1, 'rgba(159,232,184,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#eafff2';
        ctx.beginPath();
        ctx.moveTo(0, -b.r - 2);
        ctx.quadraticCurveTo(b.r, -b.r * 0.3, 0, b.r);
        ctx.quadraticCurveTo(-b.r, -b.r * 0.3, 0, -b.r - 2);
        ctx.fill();
      } else if (b.kind === 'mine') {
        // 등불 기뢰: 따뜻한 광채, 터지기 직전 빠르게 깜빡
        const urgent = b.timer < (b.mineWarningLead ?? 0.6);
        const blink = urgent && Math.floor(b.timer * 12) % 2 === 0;
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
        glow.addColorStop(0, `rgba(255,214,110,${blink ? 0.8 : 0.4})`);
        glow.addColorStop(1, 'rgba(255,214,110,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.28); ctx.fill();
        ctx.fillStyle = blink ? '#fff3b0' : '#ffd66e';
        ctx.strokeStyle = '#c98f2e'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath(); ctx.moveTo(0, -b.r); ctx.lineTo(0, -b.r - 4); ctx.stroke(); // 등불 고리
      } else if (b.kind === 'bubble') {
        ctx.strokeStyle = '#cfeaff'; ctx.lineWidth = 1.8;
        ctx.fillStyle = 'rgba(180,225,255,0.35)';
        ctx.beginPath(); ctx.arc(0, 0, b.r + 1, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.2, 0, 6.28); ctx.fill();
      } else {
        const g = ctx.createRadialGradient(-1.5, -1.5, 0, 0, 0, b.r + 1);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ffb3cf');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, b.r + 1, 0, 6.28); ctx.fill();
      }
      ctx.restore();
    }
  },

  // ---- 심해 어둠 시스템 ----
  _glowSprite: null,
  glowSprite() {
    // 광원 구멍용 방사형 블롭 (매 프레임 그라디언트 생성 대신 캐시)
    if (!this._glowSprite) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
      this._glowSprite = c;
    }
    return this._glowSprite;
  },
  _darkCanvas: null,
  drawDarkness() {
    if (this.dark <= 0.02) return;
    if (!this._darkCanvas) {
      this._darkCanvas = document.createElement('canvas');
      this._darkCanvas.width = CFG.W;
      this._darkCanvas.height = CFG.H;
    }
    const d = this._darkCanvas.getContext('2d');
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, CFG.W, CFG.H);
    d.fillStyle = `rgba(3, 7, 26, ${this.dark})`;
    d.fillRect(0, 0, CFG.W, CFG.H);
    // 광원 = 구멍
    d.globalCompositeOperation = 'destination-out';
    const spr = this.glowSprite();
    const hole = (x, y, r) => d.drawImage(spr, x - r, y - r, r * 2, r * 2);
    hole(this.player.x, this.player.y, 175);
    if (this.dolphin) hole(this.dolphin.x, this.dolphin.y, 70);
    for (const e of this.enemies) {
      if (e.kind === 'lantern') hole(e.x, e.y, 185);       // 등불 해파리 = 이동 광원
      else if (e.kind === 'big') hole(e.x, e.y, 95);
      else if (e.kind === 'viper') {
        const glow = typeof e.glowStrength === 'function' ? e.glowStrength() : 1;
        if (glow > 0.01) hole(e.x, e.y, 17 * (0.35 + glow * 0.65));
      }
    }
    for (const b of this.ebullets) {
      if (b.kind === 'mine') hole(b.x, b.y, 70);
      else if (b.kind === 'star') hole(b.x, b.y, 28);      // 별탄은 스스로 빛남
    }
    if (this.boss && !this.boss.dead && this.boss.lureX !== undefined) {
      const lurePower = this.boss.lurePower ?? 1;
      if (lurePower > 0.01) hole(this.boss.lureX, this.boss.lureY, (this.boss.lureR ?? 150) * lurePower); // 초롱불
    }
    ctx.drawImage(this._darkCanvas, 0, 0);
    // 공정성: 어둠 위에 탄과 아군 샷을 희미하게 재드로 — 안 보여서 맞는 건 금지
    this.drawEBullets(0.5);
    this.drawShots(0.35);
  },

  drawBackground() {
    // 완성된 스테이지 배경은 네이티브 픽셀 패치 렌더러가 담당한다.
    // 아직 제작하지 않은 스테이지는 아래의 기존 코드 배경으로 안전하게 폴백한다.
    if (typeof Backgrounds !== 'undefined' && Backgrounds.draw(ctx, this)) return;

    const pal = STAGE_BG[Math.min(this.stageIdx, STAGE_BG.length - 1)];
    const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.5, pal.mid);
    g.addColorStop(1, pal.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CFG.W, CFG.H);

    const t = performance.now() / 1000;

    // 빛줄기
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#bfe8ff';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 260 + t * 12) % (CFG.W + 200)) - 100;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 90, 0);
      ctx.lineTo(x - 60, CFG.H); ctx.lineTo(x - 150, CFG.H);
      ctx.fill();
    }
    ctx.restore();

    // 떠오르는 기포 (배경)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#cfeaff';
    for (let i = 0; i < 14; i++) {
      const seed = i * 137.5;
      const x = (seed * 7.3) % CFG.W;
      const y = CFG.H - ((t * (18 + i * 3) + seed) % (CFG.H + 40)) + 20;
      ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, 6.28); ctx.stroke();
    }
    ctx.restore();

    // 폭풍 수면: 출렁이는 파도 띠 (상단)
    if (this.storm && this.state === 'play') {
      ctx.save();
      for (let layer = 0; layer < 2; layer++) {
        const base = 26 + layer * 16;
        const amp = (14 - layer * 5) * this.stormScale;
        ctx.fillStyle = layer === 0 ? 'rgba(220,235,255,0.25)' : 'rgba(160,190,230,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let x = 0; x <= CFG.W; x += 24) {
          ctx.lineTo(x, base + Math.sin(x * 0.02 + t * (2.2 - layer * 0.6) + layer * 2) * amp);
        }
        ctx.lineTo(CFG.W, 0);
        ctx.fill();
      }
      ctx.restore();
    }

    // 원경 산호 (패럴랙스)
    this.drawCoralLayer(this.scroll * 0.4, pal.coralFar, 60);
    // 근경 산호
    this.drawCoralLayer(this.scroll, pal.coralNear, 34);

    // 탑승 중 스피드 라인
    if (this.ride?.params?.drawSpeedLines && this.state === 'play') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const seed = i * 173.3;
        const y = (seed * 3.7) % CFG.H;
        const x = CFG.W - ((t * 1100 + seed * 11) % (CFG.W + 160)) + 80;
        const len = 50 + (i % 4) * 25;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      }
      ctx.restore();
    }
  },

  drawRideDurability(x, y) {
    const ride = this.ride;
    if (!ride || ride.durabilityMax <= 0) return;
    const width = ride.durabilityMax * 10 - 2;
    for (let index = 0; index < ride.durabilityMax; index++) {
      ctx.fillStyle = index < ride.durability ? '#ffe28a' : 'rgba(70,38,65,0.7)';
      ctx.fillRect(Math.round(x - width / 2 + index * 10), Math.round(y), 8, 5);
    }
  },

  // 거북 택시 (플레이어 아래에 그려짐)
  drawTurtle(x, y) {
    const t = performance.now() / 1000;
    if (Sprites.draw(ctx, 'turtle.taxi', x, y, { t })) return;
    ctx.save();
    ctx.translate(x, y);
    // 지느러미 (헤엄 애니메이션)
    ctx.fillStyle = '#5aa06a';
    const paddle = Math.sin(t * 9) * 6;
    ctx.beginPath(); ctx.ellipse(-14, 8, 9, 4, -0.4 + paddle * 0.05, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(10, 9, 9, 4, 0.4 - paddle * 0.05, 0, 6.28); ctx.fill();
    // 등껍질
    const shell = ctx.createRadialGradient(-4, -4, 2, 0, 0, 22);
    shell.addColorStop(0, '#8fce6a');
    shell.addColorStop(1, '#4e8a4e');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 13, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
    // 등껍질 무늬
    ctx.strokeStyle = 'rgba(46,88,46,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(12, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-4, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(4, -4); ctx.stroke();
    // 머리 (진행 방향, 기사님 모자)
    ctx.fillStyle = '#6ab87a';
    ctx.beginPath(); ctx.arc(24, -2, 7, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#2e4e8a';
    ctx.fillRect(19, -11, 11, 4); // 모자
    ctx.fillRect(26, -13, 5, 3);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(26, -3, 1.3, 0, 6.28); ctx.fill();
    ctx.restore();
  },

  drawCoralLayer(scroll, color, height) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, CFG.H);
    const seg = 40;
    for (let x = 0; x <= CFG.W + seg; x += seg) {
      const wx = x + scroll;
      const h = height + Math.sin(wx * 0.021) * 22 + Math.sin(wx * 0.053) * 14;
      ctx.lineTo(x, CFG.H - h);
    }
    ctx.lineTo(CFG.W, CFG.H);
    ctx.fill();
  },

  drawHud() {
    ctx.save();
    ctx.textAlign = 'left';
    // 진주
    ctx.fillStyle = '#fff';
    ctx.font = Fonts.f(16, true);
    ctx.fillStyle = '#d8b4e8';
    ctx.beginPath(); ctx.arc(22, 20, 8, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(17, 15, 4, 4);   // 픽셀 하이라이트
    ctx.fillStyle = '#fff';
    ctx.fillText(`× ${this.stats.pearls}`, 36, 26);

    // 파워 게이지
    ctx.font = Fonts.f(13);
    ctx.fillStyle = '#7dffd8';
    ctx.fillText(`파워 Lv${this.player.level}`, 16, 50);
    if (this.player.level < 3) {
      const ratio = this.player.gauge / this.player.gaugeMax();
      PXUI.cells(ctx, 90, 40, 10, Math.floor(ratio * 10 + 0.0001), { cw: 8, ch: 10, gap: 2 });
    } else {
      ctx.fillText('MAX', 90, 50);
    }

    // 조개폰 배터리 (칸이 차오르는 배터리 아이콘)
    ctx.fillStyle = '#ffb0c8';
    ctx.fillText('조개폰', 16, 74);
    {
      const bd = BOMB_DEFS[this.bombId] || BOMB_DEFS.sonar;
      ctx.fillStyle = bd.color; ctx.font = Fonts.f(11); ctx.textAlign = 'left';
      ctx.fillText(bd.name, 16, 90);
    }
    {
      const cells = this.batteryMax, cw = 12, cellH = 12, gap = 3;
      const bw = cells * cw + gap * (cells + 1);
      const bx = 70, by = 61;
      const empty = this.battery === 0;
      const blink = Math.floor(performance.now() / 400) % 2 === 0;
      const bc = empty ? (blink ? '#ff5a5a' : 'rgba(255,90,90,0.5)') : 'rgba(255,255,255,0.6)';
      PXUI.frame(ctx, bx, by, bw, cellH + 6, bc);
      ctx.fillStyle = bc;
      ctx.fillRect(bx + bw + 2, by + 5, 3, cellH - 4); // 단자
      for (let i = 0; i < this.battery; i++) {
        ctx.fillStyle = this.battery === 1 ? '#ffd76e' : '#7dffd8'; // 1칸 남으면 노랑
        ctx.fillRect(bx + gap + i * (cw + gap), by + 3, cw, cellH);
      }
      if (empty && blink) {
        ctx.fillStyle = '#ff8f8f'; ctx.font = Fonts.f(10, true);
        ctx.fillText('LOW!', bx + bw + 12, by + 14); // 앨범아트 오마주
      }
    }

    // 진주 목걸이 (격침 방어 잔여)
    if (this.player.armor > 0) {
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(24, 96, 7, 0.3, Math.PI - 0.3); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = 0.5 + i * (Math.PI - 1) / 4;
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(24 + Math.cos(a) * 7, 96 + Math.sin(a) * 7, 2, 0, 6.28); ctx.fill();
      }
      ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(11); ctx.textAlign = 'left';
      ctx.fillText('목걸이', 38, 100);
    }

    // 일시정지 버튼 (우상단) — ESC와 동일, 터치용
    {
      const pb = Input.pauseBtn;
      PXUI.chip(ctx, pb, { border: 'rgba(210,225,255,0.45)', fill: 'rgba(6,14,40,0.75)' });
      ctx.fillStyle = 'rgba(230,240,255,0.85)';
      ctx.fillRect(pb.x + 12, pb.y + 8, 4, 12);
      ctx.fillRect(pb.x + 22, pb.y + 8, 4, 12);
    }
    // 입력 모드 안내
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = Fonts.f(11);
    ctx.textAlign = 'right';
    ctx.fillText(Input.mode === 'keys' ? '키보드: 이동 ←↑↓→ · 저속 Shift · 봄 Space'
      : Input.mode === 'touch' ? '터치: 드래그로 조종 · 봄 버튼'
        : '마우스: 커서를 따라 유영 · 클릭 봄', CFG.W - 56, 18);
    if (this.debug) {
      ctx.fillStyle = '#ff8fd8';
      ctx.fillText(`DEBUG${this.god ? ' · 무적' : ''} — 1 파워 · 2 진주 · 3 무적 · 4 보스직행 · 5 페이즈스킵 · 6 픽셀${CFG.pixelMode ? 'ON' : 'OFF'}`, CFG.W - 56, 34);
      // 디버그 통계: 프레임·엔티티 수·경과
      const rl = this.runLog || {};
      const bossT = rl.bossStart != null ? (this.stageT - rl.bossStart).toFixed(0) : '-';
      ctx.fillStyle = this.perf.fps < 50 ? '#ff8f8f' : 'rgba(255,143,216,0.75)';
      ctx.fillText(
        `${Math.round(this.perf.fps)}fps (min ${Math.round(this.perf.worst)}) · ` +
        `적 ${this.enemies.length} 탄 ${this.ebullets.length} 진주 ${this.pearls.length} · ` +
        `t ${this.stageT.toFixed(0)}s 보스 ${bossT}s · 피격 ${rl.hitsTaken || 0} 격침 ${this.stats.deaths}`,
        CFG.W - 56, 50);
      if (this.stageRuntimeMode === 'data') {
        ctx.fillStyle = this.stageParity?.ok ? '#7dffd8' : '#ff8f8f';
        ctx.fillText(`${this.stageTest ? 'STAGE DRAFT' : 'STAGE DATA'} · parity ${this.stageParity?.ok ? 'OK' : `${this.stageParity?.errors?.length || 0} issue`}`, CFG.W - 56, 66);
      }
    }
    // 스코어 (우상단): 현재 점수 · 배율 · 해역 최고
    {
      const sy = this.debug ? (this.stageRuntimeMode === 'data' ? 82 : 66) : 34;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = Fonts.f(15, true);
      ctx.fillText(this.score.toLocaleString(), CFG.W - 56, sy);
      if (this.mult > 1.001) {
        ctx.fillStyle = this.mult >= 3 ? '#ffd76e' : '#7dffd8';
        ctx.font = Fonts.f(12, true);
        ctx.fillText(`×${this.mult.toFixed(2)}`, CFG.W - 56, sy + 16);
      }
      if (this.bestAtStart > 0) {
        ctx.fillStyle = this.score > this.bestAtStart ? '#ffe9a8' : 'rgba(255,255,255,0.45)';
        ctx.font = Fonts.f(11);
        ctx.fillText(`최고 ${this.bestAtStart.toLocaleString()}`, CFG.W - 56, sy + (this.mult > 1.001 ? 32 : 16));
      }
      // 난이도 뱃지
      if (this.diff > 0) {
        ctx.fillStyle = this.D.color;
        ctx.font = Fonts.f(12, true);
        ctx.fillText(this.D.name, CFG.W - 56, sy + 48);
      }
    }

    // 해류 표시 (폭풍 수면 — 방향·세기를 읽을 수 있게)
    if (this.storm) {
      const cx = CFG.W / 2, cy = 72;
      const len = this.curX * 0.35;
      ctx.strokeStyle = 'rgba(220,235,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - len, cy); ctx.lineTo(cx + len, cy); ctx.stroke();
      if (Math.abs(len) > 4) {
        const tip = cx + len, dir = Math.sign(len) * 7;
        ctx.beginPath();
        ctx.moveTo(tip, cy); ctx.lineTo(tip - dir, cy - 5);
        ctx.moveTo(tip, cy); ctx.lineTo(tip - dir, cy + 5);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(220,235,255,0.5)';
      ctx.font = Fonts.f(10); ctx.textAlign = 'center';
      ctx.fillText('해류', cx, cy + 16);
    }

    // 봄 버튼 (우하단) — 선택된 봄의 색과 이름
    const b = Input.bombBtn;
    const bd = BOMB_DEFS[this.bombId] || BOMB_DEFS.sonar;
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = this.battery > 0 ? 'rgba(125,255,216,0.18)' : 'rgba(120,120,120,0.2)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.28); ctx.fill();
    ctx.strokeStyle = this.battery > 0 ? bd.color : '#777';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.28); ctx.stroke();
    ctx.fillStyle = this.battery > 0 ? bd.color : '#999';
    ctx.font = Fonts.f(14, true);
    ctx.textAlign = 'center';
    ctx.fillText(bd.short || '봄', b.x, b.y + 5);
    ctx.restore();
  },

  // 엔딩: 폭풍이 걷힌 여명 바다 — 무지개, 용궁, 친구들의 귀향 행진
  drawEnding() {
    const T = this.endingT;
    // 완성 일러스트를 월드 픽셀 그대로 2배 확대한다.
    if (Assets.ready('screen.ending')) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Assets.image('screen.ending'), 0, 0, 480, 270, 0, 0, CFG.W, CFG.H);
      ctx.restore();
    } else {
      const g2 = ctx.createLinearGradient(0, 0, 0, CFG.H);
      g2.addColorStop(0, '#ffd9a8');
      g2.addColorStop(0.32, '#e8a8c8');
      g2.addColorStop(1, '#3a3a8e');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, CFG.W, CFG.H);
    }
    const now = performance.now() / 1000;

    // 별빛 길 (좌하 → 용궁, 완성된 길)
    for (let i = 0; i < 14; i++) {
      const fx = 60 + i * ((CFG.W * 0.82 - 60) / 13);
      const fy = CFG.H * 0.8 - i * (CFG.H * 0.22 / 13);
      const tw = 0.7 + Math.sin(now * 3 + i) * 0.3;
      ctx.fillStyle = `rgba(255,240,190,${tw})`;
      ctx.beginPath(); ctx.arc(fx, fy, 4, 0, 6.28); ctx.fill();
    }

    // 친구들의 행진 (인어 뒤로 일곱 친구)
    const p = this.player;
    for (let i = STAGES.length - 1; i >= 0; i--) {
      const fx2 = p.x - 52 - i * 46;
      const fy2 = p.y + Math.sin(now * 2 + i * 0.9) * 9 + 4;
      if (fx2 < -30) continue;
      const c = STAGES[i].friendColor;
      ctx.save();
      ctx.translate(fx2, fy2);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(-4, -3, 1.7, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -3, 1.7, 0, 6.28); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(0, 2, 4.5, 0.25, Math.PI - 0.25); ctx.stroke();
      ctx.restore();
    }
    this.player.draw(ctx);

    // 텍스트 시퀀스
    ctx.save();
    ctx.textAlign = 'center';
    const line = (text, t0, y, font, color) => {
      if (T < t0) return;
      ctx.globalAlpha = Math.min(1, (T - t0) / 1.2);
      ctx.fillStyle = color;
      ctx.font = font;
      ctx.fillText(text, CFG.W / 2, y);
    };
    line('폭풍이 걷혔다.', 2, CFG.H * 0.2, Fonts.f(18), 'rgba(255,255,255,0.9)');
    line('별빛 길의 끝 — 집.', 5, CFG.H * 0.27, Fonts.f(18), 'rgba(255,255,255,0.9)');
    line('"다녀왔습니다!"', 8.5, CFG.H * 0.35, Fonts.f(24, true), '#fff3b0');
    line(`여정의 기록 — 진주 ${Meta.data.bank}개, 그리고 친구 일곱.`, 11.5, CFG.H * 0.42, Fonts.f(15), 'rgba(255,255,255,0.8)');
    line('픽셀 파도: 집으로 가는 길', 14, CFG.H * 0.88, Fonts.f(20, true), '#ff9ec7');
    if (T > 15 && Math.sin(performance.now() / 300) > -0.3) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffe9a8';
      ctx.font = Fonts.f(14);
      ctx.fillText('아무 키 / 클릭 — 항해도로', CFG.W / 2, CFG.H * 0.94);
    }
    ctx.restore();
  },

  // 로딩 관문: 에셋 로딩바 → "아무 키로 시작".
  // 이 첫 입력이 브라우저 오디오 잠금을 풀어, 타이틀 화면부터 음악이 나온다.
  drawBoot() {
    ctx.save();
    ctx.fillStyle = '#081536';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    PXUI.text(ctx, '픽셀 파도', CFG.W / 2, CFG.H * 0.4, 30, '#ff9ec7');
    const prog = Assets.progress();
    const ready = prog >= 1 || this.bootT > 6;
    // 로딩바: 20칸
    const cells = 20, filled = Math.round(prog * cells);
    const bw = cells * 14 + (cells - 1) * 3;
    const bx = (CFG.W - bw) / 2, by = CFG.H * 0.52;
    PXUI.frame(ctx, bx - 8, by - 8, bw + 16, 28, 'rgba(210,225,255,0.4)');
    PXUI.cells(ctx, bx, by, cells, filled, { cw: 14, ch: 12, gap: 3, color: '#7dffd8' });
    ctx.textAlign = 'center';
    if (!ready) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = Fonts.f(12);
      ctx.fillText(`바다를 채우는 중... ${Math.round(prog * 100)}%`, CFG.W / 2, CFG.H * 0.62);
    } else if (Math.sin(performance.now() / 300) > -0.3) {
      PXUI.text(ctx, '▶ 아무 키 / 터치 — 시작', CFG.W / 2, CFG.H * 0.64, 16, '#ffe9a8');
    }
    ctx.restore();
  },

  drawTitle() {
    ctx.save();
    if (Assets.ready('screen.title')) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(Assets.image('screen.title'), 0, 0, 480, 270, 0, 0, CFG.W, CFG.H);
    }
    PXUI.text(ctx, '픽셀 파도', CFG.W / 2, CFG.H * 0.32, 44, '#ff9ec7');
    PXUI.text(ctx, '집으로 가는 길', CFG.W / 2, CFG.H * 0.42, 30, '#8ff7ff');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = Fonts.f(15);
    ctx.fillText('별빛 길을 따라 집으로', CFG.W / 2, CFG.H * 0.52);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = Fonts.f(11);
    ctx.fillText('Playable Alpha', CFG.W / 2, CFG.H * 0.57);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = Fonts.f(14);
    ctx.fillText('키보드: 방향키/WASD 이동 · Shift 저속 · Space 봄', CFG.W / 2, CFG.H * 0.64);
    ctx.fillText('마우스/터치: 포인터를 따라 유영 · 클릭/버튼 봄 · 샷은 자동', CFG.W / 2, CFG.H * 0.70);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = Fonts.f(18, true);
    const blink = Math.sin(performance.now() / 300) > -0.3;
    if (blink) PXUI.text(ctx, '▶ 아무 키 / 클릭 — 항해도로', CFG.W / 2, CFG.H * 0.82, 18, '#ffe9a8');
    ctx.restore();
  },

  drawVictory() {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 15, 45, 0.6)';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.textAlign = 'center';
    const stage = STAGES[this.stageIdx];
    PXUI.text(ctx, '해역 클리어!', CFG.W / 2, CFG.H * 0.26, 36, '#ffe9a8');
    // 재클리어면 친구가 된 뒤의 문구로
    ctx.fillStyle = '#a8ffcf';
    ctx.font = Fonts.f(16);
    ctx.fillText(this.replay ? (stage.clearMsgAgain ?? stage.clearMsg) : stage.clearMsg, CFG.W / 2, CFG.H * 0.35);
    // 점수 결산
    {
      const tags = [];
      if (this.stats.noMiss) tags.push('노미스 +5000');
      if (this.stats.noBomb) tags.push('노봄 +3000');
      if (this.grazeN > 0) tags.push(`그레이즈 ${this.grazeN}`);
      ctx.fillStyle = '#fff';
      ctx.font = Fonts.f(20, true);
      ctx.fillText(`점수 ${this.score.toLocaleString()}`, CFG.W / 2, CFG.H * 0.45);
      if (tags.length) {
        ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(12);
        ctx.fillText(tags.join(' · '), CFG.W / 2, CFG.H * 0.50);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = Fonts.f(15);
    ctx.fillText(`진주 ${this.stats.pearls} · 격침 ${this.stats.deaths}회 · 소나 ${this.stats.bombs}회 · ${Math.floor(this.stats.time)}초`, CFG.W / 2, CFG.H * 0.575);
    ctx.fillStyle = '#d8b4e8';
    ctx.font = Fonts.f(14);
    const bk = this.stats.banked ?? this.stats.pearls;
    ctx.fillText(`[${this.D.name}] 진주 ${bk}개 입금 완료 (×${this.D.pearlMul}) — 보유 ${Meta.data.bank}개`, CFG.W / 2, CFG.H * 0.635);
    if (this.newBest) {
      ctx.fillStyle = Math.sin(performance.now() / 200) > 0 ? '#ffd76e' : '#ffe9a8';
      ctx.font = Fonts.f(14, true);
      ctx.fillText('★ 최고 기록 갱신! ★', CFG.W / 2, CFG.H * 0.705);
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.font = Fonts.f(16, true);
    if (Math.sin(performance.now() / 300) > -0.3) ctx.fillText('아무 키 / 클릭 — 항해도로', CFG.W / 2, CFG.H * 0.79);
    ctx.restore();
  },
};

// 탄막 공방의 "게임에서 시험": 저장한 패턴을 팡팡 P1에 끼워 곧바로 시작한다.
// 실제 충돌·이동·난이도 배율을 모두 거치되 보스 HP와 잡몹은 고정해 패턴만 본다.
if (Game.debug && Game.barragePatternId) {
  const params = new URLSearchParams(location.search);
  const labDiff = Math.max(0, Math.min(2, Number(params.get('diff')) || 0));
  Game.launchStage(0, labDiff);
  Game.spawner.idx = Game.spawner.timeline.length;
  Game.spawner.pending = [];
  Game.stageT = Game.spawner.timeline.at(-1)?.t ?? 0;
  Game.boss = STAGES[0].boss(Game);
  Game.message(`[탄막 시험] ${Game.barragePatternId}`, '#ff8fd8');
}

// 데이터 기반 Stage 전체/구간 테스트 브리지. 명시적 legacy URL은 자동 실행하지 않는다.
if (Game.debug && !Game.barragePatternId) {
  const stageTestParams = new URLSearchParams(location.search);
  const testStageId = stageTestParams.get('stage');
  const testStageIndex = STAGES.findIndex(stage => stage.id === testStageId);
  const requestedStageRuntime = typeof StageGameAdapter !== 'undefined'
    ? StageGameAdapter.requestedMode(location.search)
    : 'legacy';
  if (requestedStageRuntime === 'data' && testStageIndex >= 0) {
    const testDifficulty = Math.max(0, Math.min(2, Number(stageTestParams.get('diff')) || 0));
    Game.launchStage(testStageIndex, testDifficulty);
    Game.message(`[DATA TEST] Stage ${testStageIndex + 1} · ${Game.spawner.range ? '선택 구간' : '전체'}`, '#7dffd8');
  }
}

// ---- 메인 루프 ----
let lastT = performance.now();
function frame(now) {
  let dt = (now - lastT) / 1000;
  lastT = now;
  const raw = dt;
  dt = Math.min(dt, 1 / 20); // 탭 전환 등 큰 프레임 방지
  // 프레임 통계 (0.5초 평균 + 플레이 중 최저) — 모바일 프레임 측정용
  if (raw > 0 && raw < 0.5) {
    const p = Game.perf;
    p.acc += raw; p.samples++;
    if (p.acc >= 0.5) { p.fps = p.samples / p.acc; p.acc = 0; p.samples = 0;
      if (Game.state === 'play' && Game.stageT > 2) p.worst = Math.min(p.worst, p.fps); }
  }
  try {
    Game.update(dt);
    Game.draw();
  } catch (err) {
    ErrLog.push(`${err.message}`);
    console.error(err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
