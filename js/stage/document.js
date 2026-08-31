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

  function createFragment(stage, ids) {
    const wanted = new Set((ids || []).map(String));
    const items = (stage?.items || []).filter(item => wanted.has(item.id)).map(clone);
    const timed = items.filter(item => item.timing?.domain === 'time');
    const origin = timed.length ? Math.min(...timed.map(item => Number(item.timing.start) || 0)) : 0;
    return {
      format: 'pixel-wave-stage-fragment',
      schemaVersion: 1,
      sourceStageId: stage?.id || null,
      origin,
      dependencies: clone(stage?.dependencies || {}),
      items,
    };
  }

  function mergeDependencies(base, incoming) {
    const merged = clone(base || {});
    for (const [key, values] of Object.entries(incoming || {})) {
      if (!Array.isArray(values)) continue;
      const current = Array.isArray(merged[key]) ? merged[key] : [];
      merged[key] = [...new Set([...current, ...values])];
    }
    return merged;
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

    _applyRecord(record, forward) {
      if (record.kind === 'replace-item') {
        const expected = forward ? record.before.id : record.after.id;
        this._replace(expected, forward ? record.after : record.before);
      } else if (record.kind === 'replace-item-dependencies') {
        const expected = forward ? record.before.id : record.after.id;
        this._replace(expected, forward ? record.after : record.before);
        this.stage.dependencies = clone(forward ? record.afterDependencies : record.beforeDependencies);
      } else if (record.kind === 'insert-item') {
        if (forward) this.stage.items.splice(record.index, 0, clone(record.item));
        else {
          const index = this.itemIndex(record.item.id);
          if (index >= 0) this.stage.items.splice(index, 1);
        }
      } else if (record.kind === 'insert-item-dependencies') {
        if (forward) this.stage.items.splice(record.index, 0, clone(record.item));
        else {
          const index = this.itemIndex(record.item.id);
          if (index >= 0) this.stage.items.splice(index, 1);
        }
        this.stage.dependencies = clone(forward ? record.afterDependencies : record.beforeDependencies);
      } else if (record.kind === 'remove-item') {
        if (forward) {
          const index = this.itemIndex(record.item.id);
          if (index >= 0) this.stage.items.splice(index, 1);
        } else this.stage.items.splice(record.index, 0, clone(record.item));
      } else if (record.kind === 'replace-dependencies') {
        this.stage.dependencies = clone(forward ? record.after : record.before);
      } else if (record.kind === 'batch') {
        const records = forward ? record.records : [...record.records].reverse();
        for (const child of records) this._applyRecord(child, forward);
      } else {
        throw new Error(`알 수 없는 문서 명령 '${record.kind}'입니다.`);
      }
    }

    _apply(record, forward) {
      this._applyRecord(record, forward);
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

    replaceItemWithDependencies(id, nextItem, dependencies, label = '클립 수정') {
      const before = this.findItem(id);
      if (!before) throw new Error(`클립 '${id}'을 찾을 수 없습니다.`);
      const after = clone(nextItem);
      const afterDependencies = clone(dependencies);
      if (same(before, after) && same(this.stage.dependencies, afterDependencies)) return false;
      return this._commit({
        kind: 'replace-item-dependencies',
        label,
        before: clone(before),
        after,
        beforeDependencies: clone(this.stage.dependencies),
        afterDependencies,
      });
    }

    replaceItemsWithDependencies(changes, dependencies, label = '여러 클립 수정') {
      const records = [];
      for (const change of changes || []) {
        const before = this.findItem(change?.id);
        if (!before) throw new Error(`클립 '${change?.id}'을 찾을 수 없습니다.`);
        const after = clone(change.item);
        if (!same(before, after)) records.push({ kind: 'replace-item', before: clone(before), after });
      }
      const afterDependencies = clone(dependencies);
      if (!same(this.stage.dependencies, afterDependencies)) {
        records.push({
          kind: 'replace-dependencies',
          before: clone(this.stage.dependencies),
          after: afterDependencies,
        });
      }
      return this.commitBatch(records, label);
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

    insertItemWithDependencies(item, dependencies, index = this.stage.items.length, label = '클립 추가') {
      const next = clone(item);
      next.id = this.uniqueId(next.id);
      const target = Math.max(0, Math.min(this.stage.items.length, Number(index) || 0));
      this._commit({
        kind: 'insert-item-dependencies',
        label,
        item: next,
        index: target,
        beforeDependencies: clone(this.stage.dependencies),
        afterDependencies: clone(dependencies),
      });
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

    commitBatch(records, label = '여러 클립 수정') {
      const usable = (records || []).filter(Boolean);
      if (!usable.length) return false;
      return this._commit({ kind: 'batch', label, records: clone(usable) });
    }

    shiftItems(ids, requestedDelta, label = '여러 클립 이동') {
      const wanted = new Set((ids || []).map(String));
      const items = this.stage.items.filter(item => wanted.has(item.id) && item.timing?.domain === 'time');
      if (!items.length) return 0;
      const minimum = Math.min(...items.map(item => Number(item.timing.start) || 0));
      const maximum = Math.max(...items.map(item => (Number(item.timing.start) || 0) + (Number(item.timing.duration) || 0)));
      const delta = Math.max(-minimum, Math.min(Number(requestedDelta) || 0, this.stage.timeline.duration - maximum));
      if (Math.abs(delta) < 1e-9) return 0;
      const records = items.map(item => {
        const after = clone(item);
        after.timing.start = +((Number(after.timing.start) || 0) + delta).toFixed(3);
        return { kind: 'replace-item', before: clone(item), after };
      });
      this.commitBatch(records, label);
      return delta;
    }

    removeItems(ids, label = '여러 클립 삭제') {
      const wanted = new Set((ids || []).map(String));
      const records = this.stage.items
        .map((item, index) => ({ item, index }))
        .filter(entry => wanted.has(entry.item.id))
        .sort((left, right) => right.index - left.index)
        .map(entry => ({ kind: 'remove-item', item: clone(entry.item), index: entry.index }));
      return this.commitBatch(records, label) ? records.length : 0;
    }

    pasteFragment(fragment, at = 0, label = '클립 조각 붙여넣기') {
      if (fragment?.format !== 'pixel-wave-stage-fragment' || fragment.schemaVersion !== 1 || !Array.isArray(fragment.items)) {
        throw new Error('지원하지 않는 클립 조각입니다.');
      }
      const used = new Set(this.stage.items.map(item => item.id));
      const unique = preferred => {
        const base = cleanId(preferred);
        let id = base;
        let suffix = 2;
        while (used.has(id)) id = `${base}-${suffix++}`;
        used.add(id);
        return id;
      };
      const origin = Number(fragment.origin) || 0;
      const insertions = fragment.items.map(source => {
        const item = clone(source);
        item.id = unique(`${source.id}-copy`);
        item.name = `${source.name || source.id} 복사본`;
        if (item.timing?.domain === 'time') {
          const start = Math.max(0, Math.min(
            this.stage.timeline.duration - (Number(item.timing.duration) || 0),
            (Number(at) || 0) + (Number(item.timing.start) || 0) - origin,
          ));
          item.timing.start = +start.toFixed(3);
        }
        return item;
      });
      if (!insertions.length) return [];
      const startIndex = this.stage.items.length;
      const records = insertions.map((item, offset) => ({ kind: 'insert-item', item, index: startIndex + offset }));
      const dependencies = mergeDependencies(this.stage.dependencies, fragment.dependencies);
      if (!same(dependencies, this.stage.dependencies)) {
        records.push({ kind: 'replace-dependencies', before: clone(this.stage.dependencies), after: dependencies });
      }
      this.commitBatch(records, label);
      return clone(insertions);
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

  const api = Object.freeze({ DocumentSession, clone, cleanId, difficultyId, createFragment, mergeDependencies });
  root.StageDocument = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
