'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const createdAudio = [];

class FakeAudio {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.playCalls = 0;
    createdAudio.push(this);
  }
  addEventListener() {}
  play() {
    this.playCalls++;
    this.paused = false;
    return Promise.resolve();
  }
  pause() { this.paused = true; }
}

const gainParam = () => ({
  value: 1,
  cancelScheduledValues() {},
  setValueAtTime(value) { this.value = value; },
  linearRampToValueAtTime(value) { this.value = value; },
});

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
  }
  createGain() { return { gain: gainParam(), connect() {} }; }
  createMediaElementSource() { return { connect() {} }; }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

const context = vm.createContext({
  console,
  setTimeout,
  window: { Audio: FakeAudio, AudioContext: FakeAudioContext },
  Meta: { data: {}, save() {} },
});

vm.runInContext(fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8'), context, {
  filename: 'js/audio.js',
});

vm.runInContext('Sound.playBgm("title")', context);
assert.equal(vm.runInContext('Sound.pendingBgm', context), 'title');
assert.equal(vm.runInContext('Sound.currentKey', context), 'title');
assert.equal(createdAudio.length, 0, '잠금 전에는 HTMLAudio를 시작하지 않는다');

vm.runInContext('Sound.unlock()', context);
assert.equal(vm.runInContext('Sound.pendingBgm', context), null);
assert.equal(vm.runInContext('Sound.currentKey', context), 'title');
assert.equal(createdAudio.length, 1);
assert.equal(createdAudio[0].src, 'assets/bgm/title.mp3');
assert.equal(createdAudio[0].playCalls, 1, '첫 입력 안에서 예약된 타이틀곡을 재생한다');

vm.runInContext('Sound.unlock()', context);
assert.equal(createdAudio[0].playCalls, 1, '재생 중인 곡은 후속 입력에서 다시 시작하지 않는다');

console.log('audio unlock: ok');
