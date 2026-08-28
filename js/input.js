// ============================================================
// input.js — 조작 체계는 하나, 입력 수단은 셋 (GDD 3장)
// 마지막 입력 기준 자동 전환: keys / pointer(마우스·터치)
// ============================================================
const Input = {
  mode: 'keys',            // 'keys' | 'pointer'
  keys: {},
  pointer: { x: CFG.W / 2, y: CFG.H * 0.7, active: false, isTouch: false },
  bombQueued: false,
  anyPressed: false,       // 타이틀/재시작용
  clicks: [],              // 메뉴 UI용 클릭 좌표 큐 (게임 좌표계)
  keyPresses: [],          // 메뉴 UI용 단발 키 입력 큐 (repeat 제외)

  init(canvas) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      Sound.unlock();   // 브라우저 자동재생 정책: 첫 입력에서 오디오 활성화
      this.keys[e.key.toLowerCase()] = true;
      this.mode = 'keys';
      this.anyPressed = true;
      if (!e.repeat) this.keyPresses.push(e.key.toLowerCase());
      if (e.key === ' ' || e.key.toLowerCase() === 'b') this.bombQueued = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    const toGame = (clientX, clientY) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: (clientX - r.left) * (CFG.W / r.width),
        y: (clientY - r.top) * (CFG.H / r.height),
      };
    };

    canvas.addEventListener('mousemove', (e) => {
      const p = toGame(e.clientX, e.clientY);
      this.pointer.x = p.x; this.pointer.y = p.y;
      this.pointer.active = true; this.pointer.isTouch = false;
      this.mode = 'pointer';
    });
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.anyPressed = true;
      const p = toGame(e.clientX, e.clientY);
      this.clicks.push(p);
      if (this.inBombButton(p)) { this.bombQueued = true; return; }
      if (this.mode === 'pointer') this.bombQueued = true; // 클릭 = 봄
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.anyPressed = true;
      const t = e.changedTouches[0];
      const p = toGame(t.clientX, t.clientY);
      this.clicks.push(p);
      if (this.inBombButton(p)) { this.bombQueued = true; return; } // 버튼 터치는 이동에 안 씀
      this.pointer.x = p.x; this.pointer.y = p.y + CFG.touchOffsetY;
      this.pointer.active = true; this.pointer.isTouch = true;
      this.mode = 'pointer';
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const p = toGame(t.clientX, t.clientY);
      if (this.inBombButton(p)) return;
      this.pointer.x = p.x; this.pointer.y = p.y + CFG.touchOffsetY;
      this.pointer.active = true; this.pointer.isTouch = true;
      this.mode = 'pointer';
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // 화면 봄 버튼 (우하단 원, 터치·마우스 공용)
  bombBtn: { x: CFG.W - 58, y: CFG.H - 58, r: 40 },
  inBombButton(p) {
    const b = this.bombBtn;
    return (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= b.r ** 2;
  },

  // 이동 벡터 (키보드 모드) — 정규화, slow 여부 포함
  keyMove() {
    let dx = 0, dy = 0;
    if (this.keys['arrowleft'] || this.keys['a']) dx -= 1;
    if (this.keys['arrowright'] || this.keys['d']) dx += 1;
    if (this.keys['arrowup'] || this.keys['w']) dy -= 1;
    if (this.keys['arrowdown'] || this.keys['s']) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }
    return { dx, dy, slow: !!this.keys['shift'] };
  },

  consumeBomb() {
    const q = this.bombQueued;
    this.bombQueued = false;
    return q;
  },
  consumeClicks() {
    const c = this.clicks;
    this.clicks = [];
    return c;
  },
  consumeKeyPresses() {
    const k = this.keyPresses;
    this.keyPresses = [];
    return k;
  },
  consumeAny() {
    const a = this.anyPressed;
    this.anyPressed = false;
    return a;
  },
};
