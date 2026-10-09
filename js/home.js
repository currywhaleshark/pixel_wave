// 집 메뉴 · 음악 감상실. 제목은 MP3의 title 태그 그대로 (엔딩만 ed 추가).
const MUSIC_TRACKS = Object.freeze([
  { key: 'title', title: '픽셀 파도 집으로 가는 길' },
  { key: 'map', title: 'Starlight Static' },
  { key: 'stage1', title: 'Pastel Pixel Cove' },
  { key: 'boss1', title: 'Pixel Fury March' },
  { key: 'stage2', title: 'Neon Tide' },
  { key: 'boss2', title: 'Glass Garden Waltz' },
  { key: 'stage3', title: 'Neon Coastline' },
  { key: 'boss3', title: 'Neon Velocity' },
  { key: 'stage4', title: 'Static Horizon' },
  { key: 'boss4', title: 'Deep Sea Pulse' },
  { key: 'stage5', title: "Little Ghost's Lullaby" },
  { key: 'boss5', title: 'Poltergeist Pixel' },
  { key: 'stage6', title: 'Static Storm' },
  { key: 'boss6', title: 'Thunderous Brass Fanfare' },
  { key: 'stage7', title: 'Dawn of the Square' },
  { key: 'boss7', title: 'The Last Static' },
  { key: 'ending', title: '픽셀 파도 집으로 가는 길 ed' },
]);

const HomeUI = {
  view: null, // null | home | music
  cursor: 0,
  playingKey: null,
  PANEL: { x: 286, y: 154, w: 388, h: 220 },
  MUSIC_PANEL: { x: 96, y: 52, w: 768, h: 438 },
  ROWS: 9,
  closeBtn() { return this.view === 'music' ? { x: 824, y: 64, w: 28, h: 26 } : { x: 634, y: 166, w: 28, h: 26 }; },
  homeRow(i) { return { x: 326, y: 218 + i * 52, w: 308, h: 42 }; },
  musicRow(i) { return { x: 120 + Math.floor(i / this.ROWS) * 372, y: 120 + (i % this.ROWS) * 32, w: 348, h: 28 }; },
  control(i) { return { x: 120 + i * 94, y: 448, w: 86, h: 28 }; },
  volumeBtn() { return { x: 662, y: 88, w: 178, h: 24 }; },
  homeItems() {
    return [...(Meta.data.endingSeen ? [{ id: 'ending', title: '엔딩 다시보기' }] : []),
      { id: 'music', title: '음악 듣기' }];
  },
  available(track) { return Meta.hasHeardMusic(track.key); },
  titleFor(track) { return this.available(track) ? track.title : '???'; },
  reset() { this.view = null; this.playingKey = null; this.cursor = 0; },
  open() { this.view = 'home'; this.cursor = 0; Sound.sfx('uiSelect'); },
  openMusic() {
    this.view = 'music';
    const current = MUSIC_TRACKS.findIndex(track => track.key === Sound.currentKey && this.available(track));
    this.cursor = Math.max(0, current);
    this.playingKey = current >= 0 ? MUSIC_TRACKS[current].key : null;
    if (!this.playingKey) Sound.stopBgm(0.25);
    Sound.sfx('uiSelect');
  },
  back() {
    if (this.view === 'music') {
      this.view = 'home'; this.cursor = this.homeItems().length - 1; this.playingKey = null;
      Sound.playBgm('map', 0.3);
    } else this.reset();
    Sound.sfx('uiMove');
  },
  activateHome(game) {
    const item = this.homeItems()[this.cursor];
    if (item?.id === 'music') this.openMusic();
    else if (item?.id === 'ending' && game.replayEnding()) { this.reset(); Sound.sfx('uiSelect'); }
  },
  activateTrack(i, toggle = true) {
    const track = MUSIC_TRACKS[i];
    if (!track || !this.available(track)) { Sound.sfx('deny'); return false; }
    this.cursor = i;
    if (toggle && this.playingKey === track.key) this.stop();
    else { this.playingKey = track.key; Sound.playBgm(track.key, 0.3); }
    Sound.sfx('uiSelect');
    return true;
  },
  stop() { this.playingKey = null; Sound.stopBgm(0.25); },
  nextTrack(direction) {
    for (let step = 1; step <= MUSIC_TRACKS.length; step++) {
      const i = (this.cursor + direction * step + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
      if (this.available(MUSIC_TRACKS[i])) { this.activateTrack(i, false); return; }
    }
    Sound.sfx('deny');
  },
  bgmKey() { return this.view === 'music' ? this.playingKey : 'map'; },

  update(game, keys, clicks) {
    for (const key of keys) {
      if (key === 'escape' || key === 'x') { this.back(); return; }
      if (this.view === 'home') {
        if (['arrowup', 'w', 'arrowdown', 's'].includes(key)) {
          this.cursor = (this.cursor + 1) % this.homeItems().length; Sound.sfx('uiMove');
        } else if (['enter', 'z', ' '].includes(key)) { this.activateHome(game); return; }
      } else {
        const up = key === 'arrowup' || key === 'w', down = key === 'arrowdown' || key === 's';
        if (up || down) this.cursor = (this.cursor + (up ? -1 : 1) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
        else if (['arrowleft', 'a', 'arrowright', 'd'].includes(key)) {
          this.cursor = this.cursor >= this.ROWS ? this.cursor - this.ROWS : Math.min(MUSIC_TRACKS.length - 1, this.cursor + this.ROWS);
        } else if (['enter', 'z', ' '].includes(key)) { this.activateTrack(this.cursor); continue; }
        else continue;
        Sound.sfx('uiMove');
      }
    }
    for (const point of clicks) {
      if (MapUI.inRect(point, this.closeBtn())
        || !MapUI.inRect(point, this.view === 'home' ? this.PANEL : this.MUSIC_PANEL)) { this.back(); return; }
      if (this.view === 'home') {
        for (let i = 0; i < this.homeItems().length; i++) {
          if (MapUI.inRect(point, this.homeRow(i))) { this.cursor = i; this.activateHome(game); return; }
        }
      } else {
        if (MapUI.inRect(point, this.volumeBtn())) {
          if (Sound.muted) Sound.toggleMute(); else Sound.cycleVol('bgm');
          continue;
        }
        for (let i = 0; i < MUSIC_TRACKS.length; i++) {
          if (MapUI.inRect(point, this.musicRow(i))) { this.cursor = i; this.activateTrack(i); return; }
        }
        if (MapUI.inRect(point, this.control(0))) this.nextTrack(-1);
        else if (MapUI.inRect(point, this.control(1))) this.stop();
        else if (MapUI.inRect(point, this.control(2))) this.nextTrack(1);
      }
    }
  },

  draw(ctx) {
    if (!this.view) return;
    const music = this.view === 'music', panel = music ? this.MUSIC_PANEL : this.PANEL;
    ctx.save();
    ctx.fillStyle = 'rgba(4,12,40,0.8)'; ctx.fillRect(0, 0, CFG.W, CFG.H);
    PXUI.panel(ctx, panel.x, panel.y, panel.w, panel.h, { border: '#ffe9a8', fill: '#0b1c4e' });
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(20, true);
    ctx.fillText(music ? '음악 듣기' : '집', CFG.W / 2, panel.y + 32);
    MapUI.button(ctx, this.closeBtn(), '×', '#cfe0ff', false);
    if (!music) {
      this.homeItems().forEach((item, i) => {
        const rect = this.homeRow(i);
        MapUI.button(ctx, rect, item.title, '#ffe9a8', false);
        if (i === this.cursor) PXUI.frame(ctx, rect.x - 4, rect.y - 4, rect.w + 8, rect.h + 8, '#7dffd8');
      });
      ctx.fillStyle = '#a9bbda'; ctx.font = Fonts.f(11); ctx.textAlign = 'center';
      ctx.fillText('↑↓ 선택 · Enter 확인 · Esc 닫기', CFG.W / 2, panel.y + panel.h - 16);
    } else {
      ctx.fillStyle = '#a9bbda'; ctx.font = Fonts.f(11); ctx.textAlign = 'left';
      const unlocked = MUSIC_TRACKS.filter(track => this.available(track)).length;
      ctx.fillText(`여행에서 만난 음악  ${unlocked} / ${MUSIC_TRACKS.length}`, 120, 106);
      MapUI.button(ctx, this.volumeBtn(), Sound.muted ? '음소거 중 (M)' : `BGM ${Math.round(Sound.vol.bgm * 100)}%`, '#7dffd8', false);
      MUSIC_TRACKS.forEach((track, i) => {
        const rect = this.musicRow(i), available = this.available(track), playing = this.playingKey === track.key;
        PXUI.chip(ctx, rect, { border: i === this.cursor ? '#ffe9a8' : 'rgba(210,225,255,0.2)',
          fill: playing ? '#16434f' : '#081735' });
        ctx.textAlign = 'left'; ctx.font = Fonts.f(13, playing);
        ctx.fillStyle = available ? (playing ? '#7dffd8' : '#fff') : '#657796';
        ctx.fillText(playing ? '▶' : String(i + 1).padStart(2, '0'), rect.x + 8, rect.y + 19);
        ctx.fillText(this.titleFor(track), rect.x + 36, rect.y + 19, rect.w - 44);
      });
      const track = MUSIC_TRACKS.find(item => item.key === this.playingKey);
      const rec = this.playingKey && Sound.tracks[this.playingKey];
      const state = !track ? '재생 정지' : rec?.dead ? '재생할 수 없는 곡' : rec?.el.paused ? '재생 준비 중' : '재생 중';
      ctx.fillStyle = '#ffe9a8'; ctx.font = Fonts.f(12); ctx.textAlign = 'left';
      ctx.fillText(track ? `${state} · ${this.titleFor(track)}` : state, 120, 432);
      ['이전 곡', '정지', '다음 곡'].forEach((text, i) => MapUI.button(ctx, this.control(i), text, '#cfe0ff', false));
      ctx.fillStyle = '#a9bbda'; ctx.font = Fonts.f(11); ctx.textAlign = 'right';
      ctx.fillText('방향키 이동 · Enter 재생/정지 · Esc 뒤로', 840, 467);
    }
    ctx.restore();
  },
};
