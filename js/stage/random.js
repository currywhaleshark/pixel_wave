// ============================================================
// stage/random.js — Stage Runtime 전용 결정론 난수
// 같은 seed와 fork 이름은 브라우저·Node에서 같은 수열을 만든다.
// ============================================================
(function initStageRandom(root) {
  'use strict';

  function hashString(value) {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mixSeed(seed, label) {
    let value = (Number(seed) >>> 0) ^ hashString(label);
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d);
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b);
    value ^= value >>> 16;
    return value >>> 0;
  }

  class Random {
    constructor(seed = 1) {
      this.initialSeed = Number(seed) >>> 0;
      this.state = this.initialSeed || 0x6d2b79f5;
    }

    next() {
      // Mulberry32. 정수 연산만 사용해 실행 환경 차이를 없앤다.
      let value = this.state += 0x6d2b79f5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    }

    range(min, max) {
      return min + (max - min) * this.next();
    }

    int(min, maxInclusive) {
      return Math.floor(this.range(min, maxInclusive + 1));
    }

    pick(values) {
      return values.length ? values[this.int(0, values.length - 1)] : undefined;
    }

    fork(label) {
      return new Random(mixSeed(this.initialSeed, label));
    }

    snapshot() {
      return { initialSeed: this.initialSeed, state: this.state >>> 0 };
    }

    restore(snapshot) {
      this.initialSeed = Number(snapshot?.initialSeed) >>> 0;
      this.state = Number(snapshot?.state) >>> 0;
      if (!this.state) this.state = 0x6d2b79f5;
      return this;
    }
  }

  const api = Object.freeze({ Random, hashString, mixSeed });
  root.StageRandom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
