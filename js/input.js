// ============================================================
// input.js — 조작 체계는 하나, 입력 수단은 셋 (GDD 3장)
// 마지막 입력 기준 자동 전환: keys / mouse / touch
// - mouse: 커서 절대좌표 추종
// - touch: 상대 드래그 — 손가락 이동량 × 감도만큼 목표를 옮긴다.
//   손가락이 기체를 가리지 않고, 화면 어디를 잡아도 조종할 수 있다.
// 셋 다 Player.update는 같은 pointer.x/y를 향해 움직인다 (속도 상한 공통).
// ============================================================
const Input = {
  mode: 'keys',            // 'keys' | 'mouse' | 'touch'
  moveTouchId: null,       // 이동을 잡고 있는 손가락 (봄 버튼 두 번째 손가락과 구분)
  touchAnchor: null,       // { fx, fy, px, py } — 드래그 시작 시 손가락·목표 위치
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
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // 닉네임 입력 중
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
      this.mode = 'mouse';
    });
    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.anyPressed = true;
      const p = toGame(e.clientX, e.clientY);
      this.clicks.push(p);
      // 일시정지·봄 버튼은 플레이 중에만 — 다른 화면에선 UI 클릭과 겹친다
      const inPlay = typeof Game !== 'undefined' && Game.state === 'play';
      if (inPlay && this.inPauseButton(p)) { this.pauseQueued = true; return; }
      if (inPlay && this.inBombButton(p)) { this.bombQueued = true; return; }
      if (this.mode === 'mouse') this.bombQueued = true; // 클릭 = 봄
    });

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      Sound.unlock();
      this.anyPressed = true;
      const t = e.changedTouches[0];
      const p = toGame(t.clientX, t.clientY);
      this.clicks.push(p);
      const inPlayT = typeof Game !== 'undefined' && Game.state === 'play';
      if (inPlayT && this.inPauseButton(p)) { this.pauseQueued = true; return; }
      if (inPlayT && this.inBombButton(p)) { this.bombQueued = true; return; } // 봄은 두 번째 손가락으로
      // 상대 드래그 시작: 손가락 위치와 "현재 기체 위치"를 앵커로 잡는다
      if (this.moveTouchId === null) {
        this.moveTouchId = t.identifier;
        const px = (typeof Game !== 'undefined' && Game.player) ? Game.player.x : p.x;
        const py = (typeof Game !== 'undefined' && Game.player) ? Game.player.y : p.y;
        this.touchAnchor = { fx: p.x, fy: p.y, px, py };
        this.pointer.x = px; this.pointer.y = py;   // 잡은 순간엔 제자리
        this.pointer.active = true; this.pointer.isTouch = true;
        this.mode = 'touch';
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier !== this.moveTouchId || !this.touchAnchor) continue;
        const p = toGame(t.clientX, t.clientY);
        const a = this.touchAnchor;
        // 목표 = 시작 기체 위치 + 드래그 이동량 × 감도. 화면 안으로 클램프 —
        // 클램프가 없으면 가장자리 너머로 끌었다 돌아올 때 그만큼 되끌어야 반응한다.
        this.pointer.x = Math.max(10, Math.min(CFG.W - 10, a.px + (p.x - a.fx) * CFG.touchSens));
        this.pointer.y = Math.max(10, Math.min(CFG.H - 10, a.py + (p.y - a.fy) * CFG.touchSens));
        this.pointer.active = true; this.pointer.isTouch = true;
        this.mode = 'touch';
      }
    }, { passive: false });
    const endTouch = (e) => {
      // iOS WebKit은 media.play()를 touchend 같은 직접 제스처에서 허용한다.
      // touchstart에서 시도한 재생이 막혔더라도 손을 떼는 순간 다시 깨운다.
      Sound.unlock();
      for (const t of e.changedTouches) {
        if (t.identifier === this.moveTouchId) {
          this.moveTouchId = null;
          this.touchAnchor = null;
          // 손을 떼면 그 자리에 정지 (목표를 현재 기체 위치로)
          if (typeof Game !== 'undefined' && Game.player) {
            this.pointer.x = Game.player.x; this.pointer.y = Game.player.y;
          }
        }
      }
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // 화면 봄 버튼 (우하단 원, 터치·마우스 공용)
  bombBtn: { x: CFG.W - 58, y: CFG.H - 58, r: 40 },
  inBombButton(p) {
    const b = this.bombBtn;
    return (p.x - b.x) ** 2 + (p.y - b.y) ** 2 <= b.r ** 2;
  },
  // 일시정지 버튼 (우상단) — 터치엔 ESC가 없으니 화면 버튼이 필요
  pauseBtn: { x: CFG.W - 46, y: 8, w: 38, h: 28 },
  inPauseButton(p) {
    const b = this.pauseBtn;
    return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  },
  consumePause() {
    const q = this.pauseQueued;
    this.pauseQueued = false;
    return q;
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
