'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function setup(saved = null) {
  const storage = { raw: saved ? JSON.stringify(saved) : null, saves: 0,
    getItem() { return this.raw; }, setItem(_key, value) { this.raw = value; this.saves++; } };
  const timers = new Map(); let timerId = 0;
  class FakeAudio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; this.events = {}; }
    addEventListener(event, fn) { this.events[event] = fn; }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    emit(event) { this.events[event]?.(); }
  }
  class FakeContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { connect() {}, gain: { value: 1, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} } }; }
    createMediaElementSource() { return { connect() {} }; }
  }
  const context = vm.createContext({ console, URLSearchParams, location: { search: '' },
    window: { Audio: FakeAudio, AudioContext: FakeContext }, localStorage: storage,
    performance: { now: () => 0 }, Fonts: { f: () => '13px sans-serif' },
    PXUI: { panel() {}, chip() {}, frame() {}, button(ctx, _rect, label) { ctx.fillText(label); } },
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    STAGES: Array.from({ length: 7 }, (_, i) => ({ id: `stage${i + 1}`, name: `stage ${i + 1}` })),
    Board: { ready: () => false },
  });
  for (const file of ['js/config.js', 'js/meta.js', 'js/audio.js', 'js/input.js', 'js/entities.js', 'js/home.js', 'js/map.js']) {
    vm.runInContext(read(file), context, { filename: file });
  }
  const source = read('js/main.js');
  vm.runInContext(source.slice(source.indexOf('const Game = {'), source.indexOf('// 탄막 공방의 "게임에서 시험"')), context);
  vm.runInContext('Meta.load(); Sound.sfx = () => {}; globalThis.test = { Meta, Sound, Input, HomeUI, MapUI, Game, MUSIC_TRACKS };', context);
  return { ...context.test, storage, timers,
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); } };
}
const center = rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

{
  const { Meta, HomeUI, MUSIC_TRACKS, storage } = setup();
  assert.equal(MUSIC_TRACKS.length, 17);
  assert.equal(new Set(MUSIC_TRACKS.map(track => track.key)).size, 17);
  for (const track of MUSIC_TRACKS) assert.ok(fs.existsSync(path.join(root, `assets/bgm/${track.key}.mp3`)));
  assert.equal(MUSIC_TRACKS.at(-1).title, `${MUSIC_TRACKS[0].title} ed`);
  assert.equal(HomeUI.homeItems().length, 1, 'unseen ending does not appear in the home menu');
  assert.ok(MUSIC_TRACKS.every(track => HomeUI.titleFor(track) === '???'));
  Meta.recordHeardMusic('stage1'); Meta.recordHeardMusic('stage1');
  Meta.recordHeardMusic('bogus'); Meta.recordHeardMusic('ending');
  assert.equal(storage.saves, 1, 'save once per new song, never for invalid/locked keys');
  assert.equal(Meta.hasHeardMusic('stage1'), true);
  assert.equal(Meta.hasHeardMusic('boss1'), false, 'entering a stage never unlocks its boss music');
  assert.equal(Meta.hasHeardMusic('ending'), false);
  assert.equal(setup(JSON.parse(storage.raw)).Meta.hasHeardMusic('stage1'), true, 'heard songs survive reload');
}
{
  const { Meta } = setup({ bank: 700, cleared: { stage1: true, stage2: 1 }, best: { stage1: 100 } });
  assert.equal(Meta.hasHeardMusic('title'), true);
  assert.equal(Meta.hasHeardMusic('boss2'), true);
  assert.equal(Meta.hasHeardMusic('stage3'), false, 'unlocked next stage was not necessarily visited');
  assert.equal(Meta.data.endingSeen, false);
  assert.equal(Meta.data.bank, 700);
  assert.equal(Meta.data.best.stage1, 100);
  const oldEnding = setup({ cleared: { stage7: 0 } }).Meta;
  assert.equal(oldEnding.data.endingSeen, true);
  assert.equal(oldEnding.hasHeardMusic('ending'), true, 'legacy final clear proves ending access');
  const modern = setup({ cleared: { stage7: 0 }, heardMusic: {}, endingSeen: false }).Meta;
  assert.equal(modern.hasHeardMusic('ending'), false, 'do not remigrate a current save');
  const malformed = setup({ heardMusic: { title: true, boss1: 'yes', unknown: true, ending: true }, endingSeen: false }).Meta;
  assert.equal(malformed.hasHeardMusic('title'), true);
  assert.equal(malformed.hasHeardMusic('boss1'), false);
  assert.equal(malformed.hasHeardMusic('unknown'), false);
  assert.equal(malformed.hasHeardMusic('ending'), false);
}
{
  const { Sound, Meta, Game, flushTimers } = setup();
  Sound.playBgm('title');
  assert.equal(Meta.hasHeardMusic('title'), false, 'preload/pending autoplay is not listening');
  Sound.unlock();
  assert.equal(Meta.hasHeardMusic('title'), false, 'a play request alone does not unlock');
  Sound.tracks.title.el.emit('playing');
  assert.equal(Meta.hasHeardMusic('title'), true);
  Sound.playBgm('stage1'); Sound.tracks.stage1.el.emit('playing');
  assert.equal(Meta.hasHeardMusic('stage1'), true);
  Sound.playBgm('boss1');
  Sound.tracks.boss1.el.emit('error'); Sound.tracks.boss1.el.emit('playing');
  assert.equal(Meta.hasHeardMusic('boss1'), false, 'missing/failed media is not unlocked');
  Sound.playBgm('stage2'); Sound.playBgm('map');
  Sound.tracks.stage2.el.emit('playing');
  assert.equal(Meta.hasHeardMusic('stage2'), false, 'ignore a stale playing event after switching songs');
  Game.stageTest = true;
  Sound.playBgm('boss2'); Sound.tracks.boss2.el.emit('playing');
  assert.equal(Meta.hasHeardMusic('boss2'), false, 'editor stage tests do not modify collection progress');
  Game.stageTest = false;
  Sound.playBgm('title'); Sound.playBgm('map'); Sound.playBgm('title');
  flushTimers();
  assert.equal(Sound.tracks.title.el.paused, false, 'A→B→A must not be stopped by A’s old fade timer');
  assert.equal(Sound.tracks.map.el.paused, true);
  Sound.stopBgm(); flushTimers();
  assert.equal(Sound.currentKey, null);
  assert.equal(Sound.tracks.title.el.paused, true);
  const cold = setup().Sound;
  cold.playBgm('title'); cold.stopBgm(); cold.unlock();
  assert.equal(cold.currentKey, null, 'stop clears a pre-unlock pending song too');
}
{
  const { Meta, Game, HomeUI, Input, MapUI, Sound, MUSIC_TRACKS } = setup();
  Game.state = 'map';
  Input.clicks.push({ ...MapUI.HOME }); MapUI.update(0.1, Game);
  assert.equal(HomeUI.view, 'home', 'click the palace to open its menu');
  HomeUI.update(Game, [], [center(HomeUI.homeRow(0))]);
  assert.equal(HomeUI.view, 'music', 'touch/click music entry works before ending');
  assert.equal(HomeUI.activateTrack(2), false);
  assert.equal(HomeUI.playingKey, null);
  Meta.recordHeardMusic('title'); Meta.recordHeardMusic('map'); Meta.recordHeardMusic('stage1');
  HomeUI.activateTrack(2); Game.syncBgm();
  assert.equal(Sound.currentKey, 'stage1', 'map sync does not override the chosen music');
  HomeUI.nextTrack(1);
  assert.equal(HomeUI.playingKey, 'title', 'next skips locked boss and stage tracks');
  HomeUI.nextTrack(-1);
  assert.equal(HomeUI.playingKey, 'stage1');
  HomeUI.update(Game, ['enter'], []); Game.syncBgm();
  assert.equal(Sound.currentKey, null, 'stopped music stays stopped in the room');
  Sound.muted = true;
  HomeUI.update(Game, [], [center(HomeUI.volumeBtn())]);
  assert.equal(Sound.muted, false, 'touch users can unmute without a keyboard');
  const text = [];
  const drawContext = new Proxy({ fillText(value) { text.push(value); } }, { get(target, prop) { return target[prop] ?? (() => {}); } });
  HomeUI.draw(drawContext);
  assert.equal(text.filter(label => label === '???').length, 14);
  assert.ok(!text.some(label => label.includes('Deep Sea Pulse') || label.includes(' ed')), 'locked titles never reach canvas text');
  HomeUI.update(Game, ['escape'], []);
  assert.equal(HomeUI.view, 'home');
  assert.equal(Sound.currentKey, 'map', 'leaving the music room restores map music');
  HomeUI.update(Game, ['escape'], []);
  assert.equal(HomeUI.view, null);
  Input.keyPresses.push('h'); MapUI.update(0.1, Game);
  assert.equal(HomeUI.view, 'home', 'keyboard shortcut also opens home');
  assert.ok(MUSIC_TRACKS.filter(track => !Meta.hasHeardMusic(track.key)).every(track => HomeUI.titleFor(track) === '???'));
}
{
  const { Meta, Game, Input, HomeUI, storage } = setup();
  Game.state = 'map';
  assert.equal(Game.replayEnding(), false);
  let settlements = 0;
  Game.commitRun = () => { settlements++; };
  Game.startEnding();
  assert.equal(settlements, 1);
  assert.equal(Game.state, 'ending');
  assert.equal(Meta.data.endingSeen, true);
  assert.equal(HomeUI.homeItems()[0].id, 'ending');
  const saved = storage.raw;
  Game.state = 'map'; Game.player = null;
  Input.anyPressed = true; Input.clicks.push({ x: 1, y: 1 }); Input.keyPresses.push('enter');
  assert.equal(Game.replayEnding(), true);
  assert.equal(Game.state, 'ending');
  assert.ok(Game.player);
  assert.equal(Game.endingT, 0);
  assert.equal(Input.anyPressed, false);
  assert.equal(Input.clicks.length, 0);
  assert.equal(settlements, 1, 'replay never settles a run or submits another score');
  assert.equal(storage.raw, saved, 'replay does not change bank, clears, or scores');
  Game.update(4.1); Input.anyPressed = true; Game.update(0.1);
  assert.equal(Game.state, 'map', 'ending replay returns to the map');
  const editor = setup();
  editor.Game.stageTest = true; editor.Game.finishStageTest = () => {};
  editor.Game.startEnding();
  assert.equal(editor.Meta.data.endingSeen, false);
}

console.log('music room: ok');
