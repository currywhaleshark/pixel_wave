// ============================================================
// board.js — 온라인 스코어보드 (총점 랭킹, Supabase)
//
// BOARD_CFG에 Supabase 프로젝트 URL과 anon 키를 넣으면 켜진다.
// 비어 있으면 랭킹 기능 전체가 조용히 숨는다 (오프라인 플레이 불변).
// 서버 세팅 절차·SQL은 docs/SCOREBOARD.md 참고.
//
// 설계:
// - 총점 = 해역별 최고 점수 합산. 제출은 해역별 점수(stages)를 보내고
//   합산·상한 검증은 서버(RPC submit_score)가 한다 — 클라이언트 합계를 믿지 않는다.
// - 플레이어 식별: 로그인 없이 localStorage의 무작위 UUID.
// - anon 키는 공개용 키다(RLS + RPC로만 쓰기 가능). 커밋해도 된다.
// ============================================================
const BOARD_CFG = {
  url: 'https://zrwqwsnzbnicxjguyctv.supabase.co',      // 예: 'https://abcd1234.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyd3F3c256Ym5pY3hqZ3V5Y3R2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDk5MzYsImV4cCI6MjEwMzU4NTkzNn0.yyNUtWV1oufbLlULzx6-VkmOG5DUxvgTUnFXMQM0cp4',  // Supabase 프로젝트의 anon public 키
};

const Board = {
  rows: null,          // 마지막으로 받은 랭킹 [{player_id, name, total}]
  state: 'idle',       // idle | loading | ok | error
  lastError: '',
  submitting: false,

  ready() { return !!(BOARD_CFG.url && BOARD_CFG.anonKey); },

  playerId() {
    const KEY = 'pixelwave_player_id';
    let id = null;
    try { id = localStorage.getItem(KEY); } catch {}
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      try { localStorage.setItem(KEY, id); } catch {}
    }
    return id;
  },

  headers() {
    return {
      apikey: BOARD_CFG.anonKey,
      Authorization: `Bearer ${BOARD_CFG.anonKey}`,
      'Content-Type': 'application/json',
    };
  },

  // 총점 제출 (해역별 최고 점수를 보냄 — 합산은 서버가)
  async submit() {
    if (!this.ready() || !Meta.data.nick || this.submitting) return;
    const stages = Meta.data.best || {};
    if (!Object.keys(stages).length) return;
    this.submitting = true;
    try {
      const res = await fetch(`${BOARD_CFG.url}/rest/v1/rpc/submit_score`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          p_player: this.playerId(),
          p_name: Meta.data.nick,
          p_stages: stages,
        }),
      });
      if (!res.ok) throw new Error(`submit ${res.status}`);
    } catch (e) {
      console.warn('[board] 제출 실패:', e.message);  // 게임 진행에는 영향 없음
    } finally {
      this.submitting = false;
    }
  },

  async fetchTop(limit = 15) {
    if (!this.ready()) return;
    this.state = 'loading';
    try {
      const res = await fetch(
        `${BOARD_CFG.url}/rest/v1/scoreboard?select=player_id,name,total&order=total.desc,updated_at.asc&limit=${limit}`,
        { headers: this.headers() });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      this.rows = await res.json();
      this.state = 'ok';
    } catch (e) {
      this.state = 'error';
      this.lastError = e.message;
    }
  },

  // 닉네임 입력 — 한글 IME 때문에 캔버스가 아니라 실제 DOM input을 띄운다
  askNick(onDone) {
    if (document.getElementById('nickOverlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'nickOverlay';
    wrap.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(3,8,28,0.75);z-index:50;';
    const fam = (typeof Fonts !== 'undefined' && Fonts.loaded) ? "'Galmuri11', sans-serif" : 'sans-serif';
    wrap.innerHTML = `
      <div style="background:#0b1c4e;border:2px solid #cfe0ff;padding:22px 26px;text-align:center;
                  box-shadow:4px 4px 0 rgba(2,6,24,0.6);font-family:${fam};color:#fff;">
        <div style="font-size:15px;margin-bottom:12px;">랭킹에 쓸 이름 (1~12자)</div>
        <input id="nickInput" maxlength="12" autocomplete="off"
               style="background:#061030;border:2px solid #7dffd8;color:#fff;padding:8px 10px;
                      font-family:${fam};font-size:16px;width:200px;text-align:center;outline:none;">
        <div style="margin-top:14px;">
          <button id="nickOk" style="background:#7dffd8;border:none;color:#0b1c4e;font-family:${fam};
                  font-size:14px;font-weight:bold;padding:8px 22px;cursor:pointer;
                  box-shadow:2px 2px 0 rgba(2,6,24,0.6);">확인</button>
          <button id="nickCancel" style="background:transparent;border:2px solid rgba(255,255,255,0.35);
                  color:rgba(255,255,255,0.7);font-family:${fam};font-size:14px;padding:6px 16px;
                  cursor:pointer;margin-left:8px;">취소</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const input = document.getElementById('nickInput');
    input.value = Meta.data.nick || '';
    input.focus();
    const close = (save) => {
      const v = input.value.trim();
      wrap.remove();
      if (save && v) {
        Meta.data.nick = v.slice(0, 12);
        Meta.save();
        if (onDone) onDone(true);
      } else if (onDone) onDone(false);
    };
    document.getElementById('nickOk').onclick = () => close(true);
    document.getElementById('nickCancel').onclick = () => close(false);
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();   // 게임 키 입력과 분리
      if (e.key === 'Enter') close(true);
      if (e.key === 'Escape') close(false);
    });
  },
};
