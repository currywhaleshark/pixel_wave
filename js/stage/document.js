// ============================================================
// stage/document.js — Stage JSON 편집 문서와 명령 기반 undo/redo
// DOM이나 저장소를 모르며, 한 번의 사용자 동작을 한 명령으로 기록한다.
// ============================================================
(function initStageDocument(root) {
  'use strict';

  const RandomApi = root.StageRandom || (typeof require === 'function' ? require('./random.js') : null);
  const { hashString } = RandomApi;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function same(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function cleanId(value) {
    return String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item';
  }

  function difficultyId(value) {
    const id = String(value || '');
    if (!['easy', 'normal', 'hard'].includes(id)) {
      throw new Error(`알 수 없는 난이도 '${id}'입니다.`);
    }
    return id;
  }

  class DocumentSession {
    constructor(stage, options = {}) {
      this.historyLimit = Math.max(1, Number(options.historyLimit) || 100);
      this.replaceStage(stage);
    }

    replaceStage(stage) {
      this.stage = clone(stage);
      this.history = [];
      this.future = [];
      this.revision = 0;
      return this;
    }

    snapshot() {
      return clone(this.stage);
    }

    stateHash() {
      return hashString(JSON.stringify(this.stage)).toString(16).padStart(8, '0');
    }

    findItem(id) {
      return this.stage.items.find(item => item.id === id) || null;
    }

    itemIndex(id) {
      return this.stage.items.findIndex(item => item.id === id);
    }

    uniqueId(preferred) {
      const base = cleanId(preferred);
      const ids = new Set(this.stage.items.map(item => item.id));
      if (!ids.has(base)) return base;
      let suffix = 2;
      while (ids.has(`${base}-${suffix}`)) suffix++;
      return `${base}-${suffix}`;
    }

    _replace(expectedId, value) {
      const index = this.itemIndex(expectedId);
      if (index < 0) throw new Error(`클립 '${expectedId}'을 찾을 수 없습니다.`);
      this.stage.items[index] = clone(value);
    }

    _apply(record, forward) {
      if (record.kind === 'replace-item') {
        const expected = forward ? record.before.id : record.after.id;
        this._replace(expected, forward ? record.after : record.before);
      } else if (record.kind === 'insert-item') {
        if (forward) this.stage.items.splice(record.index, 0, clone(record.item));
        else {
          const index = this.itemIndex(record.item.id);
          if (index >= 0) this.stage.items.splice(index, 1);
        }
      } else if (record.kind === 'remove-item') {
        if (forward) {
          const index = this.itemIndex(record.item.id);
          if (index >= 0) this.stage.items.splice(index, 1);
        } else this.stage.items.splice(record.index, 0, clone(record.item));
      } else {
        throw new Error(`알 수 없는 문서 명령 '${record.kind}'입니다.`);
      }
      this.revision++;
    }

    _commit(record) {
      this._apply(record, true);
      this.history.push(record);
      if (this.history.length > this.historyLimit) this.history.shift();
      this.future = [];
      return true;
    }

    replaceItem(id, nextItem, label = '클립 수정') {
      const before = this.findItem(id);
      if (!before) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
      const after = clone(nextItem);
      if (same(before, after)) return false;
      return this._commit({ kind: 'replace-item', label, before: clone(before), after });
    }

    setDifficultyOverride(id, difficulty, override, label = '난이도 덮어쓰기') {
      const item = this.findItem(id);
      if (!item) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
      const target = difficultyId(difficulty);
      const next = clone(item);
      next.difficulty = clone(next.difficulty || {});
      next.difficulty[target] = clone(override || {});
      return this.replaceItem(id, next, label);
    }

    clearDifficultyOverride(id, difficulty, label = '난이도 상속 복원') {
      const item = this.findItem(id);
      if (!item) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
      const target = difficultyId(difficulty);
      if (!item.difficulty?.[target]) return false;
      const next = clone(item);
      delete next.difficulty[target];
      if (!Object.keys(next.difficulty).length) delete next.difficulty;
      return this.replaceItem(id, next, label);
    }

    insertItem(item, index = this.stage.items.length, label = '클립 추가') {
      const next = clone(item);
      next.id = this.uniqueId(next.id);
      const target = Math.max(0, Math.min(this.stage.items.length, Number(index) || 0));
      this._commit({ kind: 'insert-item', label, item: next, index: target });
      return clone(next);
    }

    duplicateItem(id, options = {}) {
      const source = this.findItem(id);
      if (!source) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
      const copy = clone(source);
      copy.id = this.uniqueId(options.id || `${source.id}-copy`);
      copy.name = options.name || `${source.name} 복사본`;
      copy.timing.start = Math.max(0, Math.min(
        this.stage.timeline.duration - copy.timing.duration,
        copy.timing.start + (Number(options.startOffset) || 1),
      ));
      return this.insertItem(copy, this.itemIndex(id) + 1, '클립 복제');
    }

    removeItem(id, label = '클립 삭제') {
      const index = this.itemIndex(id);
      if (index < 0) return false;
      return this._commit({ kind: 'remove-item', label, item: clone(this.stage.items[index]), index });
    }

    undo() {
      const record = this.history.pop();
      if (!record) return null;
      this._apply(record, false);
      this.future.push(record);
      return record.label;
    }

    redo() {
      const record = this.future.pop();
      if (!record) return null;
      this._apply(record, true);
      this.history.push(record);
      return record.label;
    }

    get canUndo() { return this.history.length > 0; }
    get canRedo() { return this.future.length > 0; }
  }

  const api = Object.freeze({ DocumentSession, clone, cleanId, difficultyId });
  root.StageDocument = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
